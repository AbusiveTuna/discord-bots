// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');

const CONFIG = {
  SOURCE_CHANNEL_ID: '1410985264884617286',
  ROLE_MAP: {
    'Corporal': '2000+ Total Lvl',
    'Recruit': '1750+ Total Lvl'
  },
  RATE_DELAY_MS: 600
};

const MANAGED_ROLES = [...new Set(Object.values(CONFIG.ROLE_MAP))];

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
    });
}

async function findMemberByNickname(guild, name) {
  const cleaned = name.toLowerCase();
  const members = await guild.members.fetch();
  let m = members.find(x => (x.nickname || '').toLowerCase() === cleaned);
  if (m) return m;
  return members.find(x => x.user.username.toLowerCase() === cleaned);
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

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function processDump(message) {
  if (message.channel.id !== CONFIG.SOURCE_CHANNEL_ID) return;
  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;

  const guild = message.guild;
  const managedRoles = await resolveManagedRoles(guild);
  const managedRoleIds = new Set([...managedRoles.values()].map(r => r.id));
  const rows = parseDump(message.content);

  const results = { updated: 0, noMember: 0, noRoleInMap: 0, noDiscordRole: 0, errors: 0 };

  for (const { name, dumpRole } of rows) {
    if (!name || !dumpRole) continue;

    const discordRoleName = CONFIG.ROLE_MAP[dumpRole];
    if (!discordRoleName) {
      results.noRoleInMap++;
      continue;
    }

    try {
      const member = await findMemberByNickname(guild, name);
      if (!member) {
        results.noMember++;
        continue;
      }

      const targetRole = managedRoles.get(discordRoleName);
      if (!targetRole) {
        results.noDiscordRole++;
        continue;
      }

      const currentManaged = member.roles.cache.filter(r => managedRoleIds.has(r.id));
      if (currentManaged.size) await member.roles.remove(currentManaged);
      await member.roles.add(targetRole);

      results.updated++;
      await delay(CONFIG.RATE_DELAY_MS);
    } catch {
      results.errors++;
      await delay(CONFIG.RATE_DELAY_MS * 2);
    }
  }

  const summary = [
    `Updated: ${results.updated}`,
    `No member: ${results.noMember}`,
    `Unmapped role: ${results.noRoleInMap}`,
    `Role missing in Discord: ${results.noDiscordRole}`,
    `Errors: ${results.errors}`
  ].join(' | ');

  await message.reply(`Done. ${summary}`);
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (message.channel.id !== CONFIG.SOURCE_CHANNEL_ID) return;
  if (!message.content.includes(',')) return;
  await processDump(message);
});

client.login(process.env.BOT_TOKEN);
