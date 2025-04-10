require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const TOKEN = process.env.SPOON_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User]
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Failed to fetch reaction:', error);
            return;
        }
    }

    const spoonEmojis = ['🥄', 'spoon', 'bowl_with_spoon'];
    const emojiName = reaction.emoji.name;

    if (!spoonEmojis.includes(emojiName) || user.id === client.user.id) return;

    let member;
    try {
        member = await reaction.message.guild.members.fetch(user.id);
    } catch (err) {
        console.error('Failed to fetch member:', err);
        return;
    }

    const nameToCheck = [
        member.nickname,
        user.username
    ].filter(Boolean).join(' ').toLowerCase();

    if (nameToCheck.includes('snp')) {
        try {
            await reaction.users.remove(user.id);
        } catch (error) {
            if (error.code === 50013) {
                console.log('Missing permissions to remove reactions.');
            } else {
                console.log('Failed to remove reaction:', error);
            }
        }
    }
});

client.login(TOKEN);
