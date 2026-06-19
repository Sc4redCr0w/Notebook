const pdf = require("pdf-parse");

/**
 * Extracts plain text from a raw PDF file buffer.
 * @param {Buffer} pdfBuffer - Binary buffer of the PDF file
 * @returns {Promise<string>} - Extracted text contents
 */
async function extractText(pdfBuffer) {
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new Error("Invalid PDF buffer provided");
  }

  try {
    const data = await pdf(pdfBuffer);
    return data.text || "";
  } catch (error) {
    console.error("Failed to parse PDF buffer:", error);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
}

module.exports = {
  extractText,
};
