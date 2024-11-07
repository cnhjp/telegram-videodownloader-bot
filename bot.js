const dotenv = require("dotenv");
const TelegramBot = require("node-telegram-bot-api");
const { spawn, exec } = require("child_process");

dotenv.config();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Map to store quality selection for each user
const userQualitySelections = {};

bot.onText(/\/ytb (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
    return bot.sendMessage(chatId, "Please provide a valid YouTube URL.");
  }

  bot.sendMessage(chatId, "Fetching available video qualities...");

  // Get available video formats with yt-dlp
  exec(`yt-dlp -F ${url}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error retrieving formats: ${error.message}`);
      return bot.sendMessage(chatId, "Failed to retrieve video formats.");
    }

    // Send the available formats to the user
    const formats = stdout.match(/(\d+)\s+\S+\s+(\d+x\d+|\d+p)\s+.+/g);
    if (!formats) {
      return bot.sendMessage(chatId, "No formats found for this video.");
    }

    let formatOptions = "Available video qualities:\n";
    formats.forEach((format, index) => {
      formatOptions += `${format}\n`;
    });

    bot.sendMessage(chatId, formatOptions + "\nReply with the format code to select a quality.");

    // Store available formats for the user session
    userQualitySelections[chatId] = formats;
  });
});

// Listen for user reply with format code
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Check if the user has format options available
  if (userQualitySelections[chatId]) {
    const selectedFormat = text.trim();

    // Check if the user’s response matches one of the format codes
    const selectedOption = userQualitySelections[chatId].find(format => format.startsWith(selectedFormat));
    if (!selectedOption) {
      return bot.sendMessage(chatId, "Invalid format code. Please enter a valid code from the list.");
    }

    // Clear selection after choosing format to avoid re-processing
    delete userQualitySelections[chatId];

    // Start the download in the chosen format
    bot.sendMessage(chatId, `Downloading video in format ${selectedFormat}...`);

    const ytProcess = spawn("yt-dlp", ["-f", selectedFormat, "-o", "-", url]);

    // Stream video directly to Telegram
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
  }
});
