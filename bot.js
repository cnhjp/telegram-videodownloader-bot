const dotenv = require("dotenv");
const TelegramBot = require("node-telegram-bot-api");
const { spawn, exec } = require("child_process");

dotenv.config();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Handle /ytb command
bot.onText(/\/ytb (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
    return bot.sendMessage(chatId, "Please provide a valid YouTube URL.");
  }

  bot.sendMessage(chatId, "Checking video size...");

  // Get video info using yt-dlp to check the size
  exec(`yt-dlp -f best --print-json ${url}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error retrieving video info: ${error.message}`);
      return bot.sendMessage(chatId, "Failed to retrieve video information.");
    }

    // Parse the JSON output to get file size
    const videoInfo = JSON.parse(stdout);
    const fileSize = videoInfo.filesize || videoInfo.filesize_approx || 0;

    // Convert file size from bytes to MB
    const fileSizeMB = fileSize / (1024 * 1024);
    
    // Check if the file size exceeds the Telegram limit
    const fileLimit = 50; // 50 MB for standard Telegram users
    if (fileSizeMB > fileLimit) {
      return bot.sendMessage(chatId, `The video is too large (${fileSizeMB.toFixed(2)} MB). Try a shorter video or use a lower quality.`);
    }

    bot.sendMessage(chatId, "Starting video download...");

    // Spawn yt-dlp process with output to pipe
    const ytProcess = spawn("yt-dlp", ["-f", "best", "-o", "-", url]);

    let lastProgressSent = 0;

    // Track download progress
    ytProcess.stderr.on("data", (data) => {
      const output = data.toString();
      const match = output.match(/(\d+\.\d+)%/);
      if (match) {
        const progress = parseFloat(match[1]);
        if (progress - lastProgressSent >= 10) {
          bot.sendMessage(chatId, `Download progress: ${progress.toFixed(0)}%`);
          lastProgressSent = progress;
        }
      }
    });

    // Send video as a stream
    bot.sendVideo(chatId, ytProcess.stdout).catch((err) => {
      console.error(`Error sending video: ${err.message}`);
      bot.sendMessage(chatId, "Failed to send video. The file may be too large.");
    });

    ytProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`yt-dlp exited with code ${code}`);
        bot.sendMessage(chatId, "Failed to download video.");
      }
    });
  });
});
