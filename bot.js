const dotenv = require("dotenv");
const TelegramBot = require("node-telegram-bot-api");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

dotenv.config();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

console.log(token);

// 处理 /start 命令
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
/ytb <YouTube URL> - Download a YouTube video
`;
  bot.sendMessage(msg.chat.id, helpText);
});

// 下载并发送 YouTube 视频
bot.onText(/\/ytb (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  // Check if the URL looks like a YouTube link
  if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
    return bot.sendMessage(chatId, "Please provide a valid YouTube URL.");
  }

  // Inform the user that the download has started
  bot.sendMessage(chatId, "Downloading your video, please wait...");

  // Download the video using yt-dlp
  const outputPath = path.join(__dirname, `video-${Date.now()}.mp4`);
  exec(`yt-dlp -f best -o "${outputPath}" ${url}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error downloading video: ${error.message}`);
      return bot.sendMessage(chatId, "Failed to download video.");
    }

    // Send the video file to the user
    bot.sendVideo(chatId, outputPath).then(() => {
      // Delete the video file after sending
      fs.unlinkSync(outputPath);
    }).catch(err => {
      console.error(`Error sending video: ${err.message}`);
      bot.sendMessage(chatId, "Failed to send video.");
    });
  });
});

// 回复用户发送的普通消息
bot.on("message", (msg) => {
  if (!msg.text.startsWith("/")) {
    bot.sendMessage(msg.chat.id, msg.text);
  }
});
