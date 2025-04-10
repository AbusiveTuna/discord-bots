require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const TOKEN = process.env.SPOON_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
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

    if (
        spoonEmojis.includes(emojiName) &&
        user.id !== client.user.id &&
        user.username.toLowerCase().includes('snp')
    ) {
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
