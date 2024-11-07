const dotenv = require("dotenv");
const TelegramBot = require("node-telegram-bot-api");
const { spawn, exec } = require("child_process");

dotenv.config();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Track user quality selections
const userQualitySelections = {};

// Enhanced error logging for polling errors
bot.on("polling_error", (error) => {
  console.error(`[polling_error] ${error.message}`);
});

// Handle /ytb command to fetch formats
bot.onText(/\/ytb (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
    return bot.sendMessage(chatId, "Please provide a valid YouTube URL.");
  }

  bot.sendMessage(chatId, "Fetching available video qualities...");

  // Execute yt-dlp to get available formats
  exec(`yt-dlp -F ${url}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error retrieving formats: ${error.message}`);
      return bot.sendMessage(chatId, "Failed to retrieve video formats.");
    }

    // Parse available formats
    const formats = stdout.match(/(\d+)\s+\S+\s+(\d+x\d+|\d+p)\s+.+/g);
    if (!formats) {
      return bot.sendMessage(chatId, "No formats found for this video.");
    }

    let formatOptions = "Available video qualities:\n";
    formats.forEach((format) => {
      formatOptions += `${format}\n`;
    });

    bot.sendMessage(chatId, formatOptions + "\nReply with the format code to select a quality.");

    // Store formats for the user session
    userQualitySelections[chatId] = formats.map(format => format.split(" ")[0]); // Store only format codes
  });
});

// Handle user reply for format code selection
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ensure this chat has a format selection active
  if (userQualitySelections[chatId]) {
    const selectedFormatCode = text.trim();

    // Validate the format code
    if (!userQualitySelections[chatId].includes(selectedFormatCode)) {
      return bot.sendMessage(chatId, "Invalid format code. Please enter a valid code from the list.");
    }

    // Clear the format selection for this chat
    delete userQualitySelections[chatId];

    // Download video in the chosen format
    bot.sendMessage(chatId, `Downloading video in format ${selectedFormatCode}...`);

    const ytProcess = spawn("yt-dlp", ["-f", selectedFormatCode, "-o", "-", url]);

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
