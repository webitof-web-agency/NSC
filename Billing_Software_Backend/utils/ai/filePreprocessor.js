const fs = require("fs/promises");

const prepareInlineFile = async (file) => {
  if (!file?.path) {
    throw new Error("Uploaded file not found");
  }

  const buffer = await fs.readFile(file.path);
  return {
    mimeType: file.mimetype,
    data: buffer.toString("base64"),
    fileName: file.originalname,
  };
};

module.exports = {
  prepareInlineFile,
};
