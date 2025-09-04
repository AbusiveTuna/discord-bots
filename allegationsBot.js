require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const ALLEGATIONS = [
  "Jinx was on the client list.",
  "No one knows where Goose World was on Jan 6th",
  "Zero Rangers opens clues on Entrana.",
  "Tuna can't spell",
  "Tj's mom used to date Sean. She fucked around on him with some dirt bag and that guy dies a dozen years later. Sean still had resentment and I stood up for him. It causes a crazy argument and everybody turned on each other poor advice (Sean) hasn't played since. Tyrone Gilberg retaliated by taking the account that I spent thousands of hours on.",
"Veryx isnt actually a vet.",
"Noble didnt fall for the Camelot teletab scam", 
"Veryx shot Osama Bin Laden"
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
