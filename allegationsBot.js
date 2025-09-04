require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const ALLEGATIONS = [
  "Jinx was on the client list.",
  "No one knows where Goose World was on Jan 6th",
  "Zero Rangers opens clues on Entrana.",
  "Tuna can't spell"
];

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  if (message.content.trim().toLowerCase() === "!allegations") {
    const random = ALLEGATIONS[Math.floor(Math.random() * ALLEGATIONS.length)];
    message.channel.send(random);
  }
});

client.login(process.env.ALLEGATIONS_TOKEN);
