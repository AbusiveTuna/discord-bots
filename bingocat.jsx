require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const CHANNEL_ID = "1342285708420710451";

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== CHANNEL_ID) return;

    let nickname = message.content.trim();

    if (!nickname) {
        message.channel.send("❌ Please enter a valid nickname!");
        return;
    }

    if (nickname.length > 32) {
        message.channel.send("❌ Nickname too long! Must be 32 characters or less.");
        return;
    }

    try {
        await message.member.setNickname(nickname);
        await message.channel.send(`✅ Nickname updated to: **${nickname}**`);

        setTimeout(() => message.delete().catch(console.error), 2000);
    } catch (error) {
        console.error("Failed to change nickname:", error);
        message.channel.send("❌ I don't have permission to change nicknames!");
    }
});

// Log in to Discord
client.login(process.env.TOKEN);
