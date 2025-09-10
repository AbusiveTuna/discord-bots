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
"Veryx shot Osama Bin Laden",
"Goose world lives in Brampton",
"Chkn isnt actually a chicken",
"F aladorable isn't a real friend",
"Jinx is a UK native",
"James uses a stepping stool to reach his cupboards.",
"ChatGPT wrote the did I compost plugin",
"Purple sweets can be used in the Inferno",
"2 star mods are just 1 star mods with bigger egos",
"A q p",
"Jinx has never won a game of runelink (0-18)",
"Reddy B would smoke Rikarisu in any human endeavour",
"Astra's still mining sandstone to this day",
"Shaharrav didn't really go to the vet",
"Tuna lost his hardcore to a guard dog",
"CR Minecraft server Chernobyl was an inside job",
"ABORT GOATS ABORT GOATS ABORT GOATS",
"!alligators",
"Bozo Loop was a teak tree bot test gone wrong"
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
