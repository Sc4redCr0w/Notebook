const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables.");
} else if (!apiKey.startsWith("AIzaSy")) {
  console.warn("WARNING: GEMINI_API_KEY does not start with the standard 'AIzaSy' prefix. This key is likely invalid for Google AI Studio.");
}

const genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");

/**
 * Generate embedding vector using Gemini Embedding API (text-embedding-004)
 * @param {string} text - The input text content to embed
 * @returns {Promise<number[]>} - The vector representation of the text
 */
async function generateEmbedding(text) {
  if (!apiKey || !apiKey.startsWith("AIzaSy")) {
    throw new Error("GEMINI_API_KEY is missing or invalid. Google AI Studio API keys must start with the prefix 'AIzaSy'. Please generate one at aistudio.google.com and update your .env file.");
  }

  if (!text || typeof text !== "string") {
    throw new Error("Text content must be a non-empty string to generate embeddings");
  }

  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    
    if (result && result.embedding && result.embedding.values) {
      return result.embedding.values;
    } else {
      throw new Error("Embed API returned an empty or invalid structure");
    }
  } catch (error) {
    console.error("Gemini Embedding generation error:", error.message);
    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
}

module.exports = {
  generateEmbedding,
};
