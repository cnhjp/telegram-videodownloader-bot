const dotenv = require("dotenv");
const TelegramBot = require("node-telegram-bot-api");

dotenv.config();

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

console.log(token);

// 处理 /start命令
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Hello! I'm your bot. Type /help to see available commands."
  );
});

// 处理 /help 命令
bot.onText(/\/help/, (msg) => {
  const helpText = `
/start - Start the bot
/help - Show available commands
/weather <city> - Get the current weather for a city
`;
  bot.sendMessage(msg.chat.id, helpText);
});

// 回复用户发送的消息
bot.on("message", (msg) => {
  if (!msg.text.startsWith("/")) {
    bot.sendMessage(msg.chat.id, msg.text);
  }
});
