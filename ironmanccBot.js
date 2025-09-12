// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const axios = require('axios');

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
    'Sergeant' : '2200+ Total Lvl',
    'Corporal'  : '2000+ Total Lvl',
    'Recruit'   : '1750+ Total Lvl',
    'Champion'  : '<1750 Total Lvl'
  },
  RATE_DELAY_MS: 600,
  SUMMARY_TTL_SEC: 30, // auto-delete summary after 30s
  TEMPLE_GROUP_ID: process.env.TEMPLE_GROUP_ID || '2176',
  TEMPLE_KEY: process.env.TEMPLE_KEY || 'sXhAFwmhDN44O74PRn7xBj7Iu',
  TEMPLE_ADD_URL: 'https://templeosrs.com/api/add_group_member.php',
  TEMPLE_MEMBERS_URL: (id) => `https://templeosrs.com/api/groupmembers.php?id=${id}`,
  TEMPLE_BATCH_SIZE: 200
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
const normalizeTempleName = s => (s || '').toLowerCase().replace(/\s/g, '');

async function fetchTempleMembers() {
  try {
    const url = CONFIG.TEMPLE_MEMBERS_URL(CONFIG.TEMPLE_GROUP_ID);
    const res = await axios.get(url, { timeout: 20000 });
    const data = res.data;

    // Handle various formats defensively
    if (Array.isArray(data)) return data.map(String);
    if (typeof data === 'string') {
      return data
        .split(/\r?\n|,/)
        .map(x => x.trim())
        .filter(Boolean);
    }
    if (data && Array.isArray(data.members)) return data.members.map(String);
    return [];
  } catch {
    return [];
  }
}

async function addTempleMembers(players) {
  if (!players.length) return { added: 0, errors: 0 };

  // normalize underscores to spaces
  const normalizedPlayers = players.map(p => p.replace(/_/g, ' '));

  let added = 0, errors = 0;
  for (let i = 0; i < normalizedPlayers.length; i += CONFIG.TEMPLE_BATCH_SIZE) {
    const batch = normalizedPlayers.slice(i, i + CONFIG.TEMPLE_BATCH_SIZE);
    try {
      const form = new URLSearchParams({
        id: CONFIG.TEMPLE_GROUP_ID,
        key: CONFIG.TEMPLE_KEY,
        players: batch.join(',')
      });
      await axios.post(CONFIG.TEMPLE_ADD_URL, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000
      });
      added += batch.length;
    } catch {
      errors += batch.length;
    }
    await delay(500);
  }
  return { added, errors };
}


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

  const stats = {
    total: rows.length,
    updated: 0,
    baseAdded: 0,
    noMember: 0,
    noRoleInMap: 0,
    noDiscordRole: 0,
    errors: 0,
    skippedAlreadyCorrect: 0
  };

  const progressMsg = await message.reply(`Processing ${stats.total} rows...`);

  // Collect unique names for Temple
  const uniqueNames = new Set();
  for (const { name, dumpRole } of rows) {
    uniqueNames.add(name.trim());

    const discordRoleName = CONFIG.ROLE_MAP[dumpRole];
    if (!discordRoleName) { stats.noRoleInMap++; continue; }

    const member = memberIndex.get(name.toLowerCase());
    if (!member) { stats.noMember++; continue; }

    const targetRole = managedRoles.get(discordRoleName);
    if (!targetRole) { stats.noDiscordRole++; continue; }

    try {
      // Ensure base role
      if (!member.roles.cache.has(baseRole.id)) {
        await member.roles.add(baseRole);
        stats.baseAdded++;
        await delay(CONFIG.RATE_DELAY_MS);
      }

      // Idempotent managed-role update
      const currentManaged = member.roles.cache.filter(r => managedRoleIds.has(r.id));
      const hasTarget = currentManaged.has(targetRole.id);
      const extraManaged = currentManaged.filter(r => r.id !== targetRole.id);

      if (hasTarget && extraManaged.size === 0) {
        // already correct – no change
        stats.skippedAlreadyCorrect++;
        continue;
      }

      // Remove other managed roles if any
      if (extraManaged.size > 0) {
        await member.roles.remove(extraManaged);
        await delay(CONFIG.RATE_DELAY_MS);
      }

      // Add target if missing
      if (!hasTarget) {
        await member.roles.add(targetRole);
        stats.updated++;
        await delay(CONFIG.RATE_DELAY_MS);
      } else {
        // had target + extras (removed above), count as updated
        stats.updated++;
      }
    } catch {
      stats.errors++;
      await delay(CONFIG.RATE_DELAY_MS);
    }
  }

  // Temple: add only missing
  const currentTemple = await fetchTempleMembers();
  const currentIdx = new Set(currentTemple.map(normalizeTempleName));
  const templeCandidates = [...uniqueNames]
    .map(n => n.trim())
    .filter(n => n && !currentIdx.has(normalizeTempleName(n)));

  const { added: templeAdded, errors: templeErrors } = await addTempleMembers(templeCandidates);

  // Prepare a compact list of added names (cap to avoid massive message)
  const MAX_SHOW = 25;
  const addedPreview = templeCandidates.slice(0, MAX_SHOW);
  const moreCount = Math.max(0, templeCandidates.length - addedPreview.length);

  const summaryLines = [
    `Updated: ${stats.updated}`,
    `Base added: ${stats.baseAdded}`,
    `Skipped (already correct): ${stats.skippedAlreadyCorrect}`,
    `No member: ${stats.noMember}`,
    `Unmapped role: ${stats.noRoleInMap}`,
    `Role missing in Discord: ${stats.noDiscordRole}`,
    `Errors: ${stats.errors}`,
    `Temple added: ${templeAdded} (errors: ${templeErrors})`,
    templeCandidates.length
      ? `Temple new members: ${addedPreview.join(', ')}${moreCount ? `, +${moreCount} more...` : ''}`
      : `Temple new members: none`
  ];

  const summaryMsg = await progressMsg.edit(`Done.\n${summaryLines.join(' | ')}`);

  // Delete original dump
  try { await message.delete(); } catch {}

  // Auto-delete summary after TTL
  if (CONFIG.SUMMARY_TTL_SEC > 0) {
    setTimeout(async () => { try { await summaryMsg.delete(); } catch {} }, CONFIG.SUMMARY_TTL_SEC * 1000);
  }
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
