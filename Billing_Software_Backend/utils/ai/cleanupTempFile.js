const fs = require("fs/promises");

const cleanupTempFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("AI temp file cleanup error:", error.message);
    }
  }
};

module.exports = cleanupTempFile;
