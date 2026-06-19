/**
 * Splits input text into smaller overlapping chunks.
 * @param {string} text - The input plain text
 * @param {number} size - Maximum characters per chunk (default 1000)
 * @param {number} overlap - Overlapping characters between consecutive chunks (default 200)
 * @returns {string[]} - Array of text chunks
 */
function chunkText(text, size = 1000, overlap = 200) {
  if (!text || typeof text !== "string") {
    return [];
  }

  // Normalize all whitespaces and newlines
  const cleanedText = text.replace(/\s+/g, " ").trim();

  const chunks = [];
  let index = 0;

  while (index < cleanedText.length) {
    // Slice a block of text of the specified size
    const chunk = cleanedText.substring(index, index + size);
    chunks.push(chunk);

    // Slide window forward by (size - overlap)
    index += (size - overlap);
  }

  return chunks;
}

module.exports = chunkText;
