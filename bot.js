const dotenv = require("dotenv");
const TelegramBot = require("node-telegram-bot-api");
const { spawn, exec } = require("child_process");

dotenv.config();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Store format options and URL for each user session
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

    // Store URL and formats for the user session
    userQualitySelections[chatId] = { url, formats: formats.map(format => format.split(" ")[0]) };
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
    if (!userQualitySelections[chatId].formats.includes(selectedFormatCode)) {
      return bot.sendMessage(chatId, "Invalid format code. Please enter a valid code from the list.");
    }

    // Retrieve the URL and clear the format selection for this chat
    const { url } = userQualitySelections[chatId];
    delete userQualitySelections[chatId];

    // Start downloading the video in the chosen format
    bot.sendMessage(chatId, `Downloading video in format ${selectedFormatCode}...`);

    const ytProcess = spawn("yt-dlp", ["-f", selectedFormatCode, "-o", "-", url]);

    let lastProgressSent = 0;

    // Track download progress from stderr
    ytProcess.stderr.on("data", (data) => {
      const output = data.toString();

      // Match the download progress percentage
      const match = output.match(/(\d+\.\d+)%/);
      if (match) {
        const progress = parseFloat(match[1]);

        // Send progress updates at 5% intervals
        if (progress - lastProgressSent >= 5) {
          bot.sendMessage(chatId, `Download progress: ${progress.toFixed(0)}%`);
          lastProgressSent = progress;
        }
      }
    });

    // Send the video once the download completes
    ytProcess.on("close", (code) => {
      if (code === 0) {
        bot.sendVideo(chatId, ytProcess.stdout).catch((err) => {
          console.error(`Error sending video: ${err.message}`);
          bot.sendMessage(chatId, "Failed to send video. The file may be too large.");
        });
      } else {
        console.error(`yt-dlp exited with code ${code}`);
        bot.sendMessage(chatId, "Failed to download video.");
      }
    });

    // Handle any error that occurs in the yt-dlp process
    ytProcess.on("error", (err) => {
      console.error(`Error executing yt-dlp: ${err.message}`);
      bot.sendMessage(chatId, "An error occurred during the download.");
    });
  }
});
