const dotenv = require("dotenv");
const TelegramBot = require("node-telegram-bot-api");
const { spawn } = require("child_process");

dotenv.config();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

console.log(token);

// Handle /start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Hello! I'm your bot. Type /help to see available commands."
  );
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  const helpText = `
/start - Start the bot
/help - Show available commands
/ytb <YouTube URL> - Download a YouTube video
`;
  bot.sendMessage(msg.chat.id, helpText);
});

// Download and send YouTube video with progress
bot.onText(/\/ytb (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
    return bot.sendMessage(chatId, "Please provide a valid YouTube URL.");
  }

  bot.sendMessage(chatId, "Starting video download...");

  // Spawn yt-dlp process with output to pipe
  const ytProcess = spawn("yt-dlp", ["-f", "best", "-o", "-", url]);

  // Track progress and send updates
  ytProcess.stderr.on("data", (data) => {
    const output = data.toString();
    const match = output.match(/(\d+\.\d+)%/);
    if (match) {
      const progress = match[1];
      bot.sendMessage(chatId, `Download progress: ${progress}%`);
    }
  });

  // Send video as a stream to Telegram
  bot.sendVideo(chatId, ytProcess.stdout).catch((err) => {
    console.error(`Error sending video: ${err.message}`);
    bot.sendMessage(chatId, "Failed to send video.");
  });

  ytProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`yt-dlp exited with code ${code}`);
      bot.sendMessage(chatId, "Failed to download video.");
    }
  });
});

// Reply to non-command messages
bot.on("message", (msg) => {
  if (!msg.text.startsWith("/")) {
    bot.sendMessage(msg.chat.id, msg.text);
  }
});
