// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');

const CONFIG = {
  SOURCE_CHANNEL_ID: '1410985264884617286',
  BASE_ROLE: 'Ironman CC',
  ROLE_MAP: {
    'Officer'   : 'Vouch Lvl 2',
    'General'   : 'Vouch Lvl 1',
    'Legacy'    : 'Former Mod',
    'Scholar'   : 'Clogger!',
    'Wrath'     : 'PvM Master',
    'Merchant'  : 'Sherlock Holmes',
    'Competitor': 'Skilling Extraordinaire',
    'TzKal'     : 'Zuk Slayer',
    'Archer'    : 'Sol Vanquisher',
    'Maxed'     : 'Maxed',
    'Xerician'  : 'Raid Conqueror',
    'Achiever'  : 'Diary Cape Holder',
    'Corporal'  : '2000+ Total Lvl',
    'Recruit'   : '1750+ Total Lvl',
    'Champion'  : '<1750 Total Lvl'
  },
  RATE_DELAY_MS: 600
};

const MANAGED_ROLES = [...new Set(Object.values(CONFIG.ROLE_MAP).filter(Boolean))];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

function parseDump(text) {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [name, role] = l.split(',').map(s => (s ?? '').trim());
      return { name, dumpRole: role };
    })
    .filter(x => x.name && x.dumpRole);
}

async function getRowsFromMessage(message) {
  const txt = message.attachments?.find(a => /\.txt$/i.test(a.name || ''));
  if (txt) {
    const res = await fetch(txt.url);
    const body = await res.text();
    return parseDump(body);
  }
  if (message.content.includes(',')) {
    return parseDump(message.content);
  }
  return [];
}

function buildMemberIndex(collection) {
  const idx = new Map();
  collection.forEach(m => {
    const nick = (m.nickname || '').toLowerCase();
    const user = m.user.username.toLowerCase();
    if (nick) idx.set(nick, m);
    idx.set(user, m);
  });
  return idx;
}

async function resolveRoleByName(guild, roleName) {
  const roles = await guild.roles.fetch();
  return roles.find(r => r.name === roleName) || null;
}

async function resolveManagedRoles(guild) {
  const roles = await guild.roles.fetch();
  const map = new Map();
  for (const roleName of MANAGED_ROLES) {
    const r = roles.find(x => x.name === roleName);
    if (r) map.set(roleName, r);
  }
  return map;
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function processDump(message) {
  if (message.channel.id !== CONFIG.SOURCE_CHANNEL_ID) return;
  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;

  const guild = message.guild;
  const rows = await getRowsFromMessage(message);
  if (!rows.length) return;

  const [baseRole, managedRoles] = await Promise.all([
    resolveRoleByName(guild, CONFIG.BASE_ROLE),
    resolveManagedRoles(guild)
  ]);
  if (!baseRole) {
    await message.reply(`Error: base role "${CONFIG.BASE_ROLE}" not found in this server.`);
    return;
  }

  const managedRoleIds = new Set([...managedRoles.values()].map(r => r.id));
  const allMembers = await guild.members.fetch();
  const memberIndex = buildMemberIndex(allMembers);

  const results = { total: rows.length, updated: 0, baseAdded: 0, noMember: 0, noRoleInMap: 0, noDiscordRole: 0, errors: 0 };
  await message.reply(`Processing ${results.total} rows...`);

  for (const { name, dumpRole } of rows) {
    const discordRoleName = CONFIG.ROLE_MAP[dumpRole];
    if (!discordRoleName) {
      results.noRoleInMap++;
      continue;
    }
    const member = memberIndex.get(name.toLowerCase());
    if (!member) {
      results.noMember++;
      continue;
    }
    const targetRole = managedRoles.get(discordRoleName);
    if (!targetRole) {
      results.noDiscordRole++;
      continue;
    }
    try {
      if (!member.roles.cache.has(baseRole.id)) {
        await member.roles.add(baseRole);
        results.baseAdded++;
        await delay(CONFIG.RATE_DELAY_MS);
      }
      const currentManaged = member.roles.cache.filter(r => managedRoleIds.has(r.id));
      if (currentManaged.size) {
        await member.roles.remove(currentManaged);
        await delay(CONFIG.RATE_DELAY_MS);
      }
      await member.roles.add(targetRole);
      results.updated++;
    } catch {
      results.errors++;
    }
    await delay(CONFIG.RATE_DELAY_MS);
  }

  const summary = [
    `Updated: ${results.updated}`,
    `Base added: ${results.baseAdded}`,
    `No member: ${results.noMember}`,
    `Unmapped role: ${results.noRoleInMap}`,
    `Role missing in Discord: ${results.noDiscordRole}`,
    `Errors: ${results.errors}`
  ].join(' | ');
  await message.reply(`Done. ${summary}`);

  try { await message.delete(); } catch {}
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (message.channel.id !== CONFIG.SOURCE_CHANNEL_ID) return;
  const hasTxt = message.attachments?.some(a => /\.txt$/i.test(a.name || ''));
  const looksLikeDump = hasTxt || message.content.includes(',');
  if (!looksLikeDump) return;
  await processDump(message);
});

client.login(process.env.IRONMANCC_TOKEN);
