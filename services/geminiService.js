const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables.");
} else if (!apiKey.startsWith("AIzaSy")) {
  console.warn("WARNING: GEMINI_API_KEY does not start with the standard 'AIzaSy' prefix. This key is likely invalid for Google AI Studio.");
}

const genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");

/**
 * Generates an answer using the Gemini API based strictly on the provided context chunks.
 * @param {string} question - User's chat question
 * @param {string[]} chunks - Context snippets retrieved from ChromaDB
 * @returns {Promise<string>} - The generated response text
 */
async function generateAnswer(question, chunks) {
  if (!apiKey || !apiKey.startsWith("AIzaSy")) {
    throw new Error("GEMINI_API_KEY is missing or invalid. Google AI Studio API keys must start with the prefix 'AIzaSy'. Please generate one at aistudio.google.com and update your .env file.");
  }
  if (!question) {
    throw new Error("Question is required for answer generation");
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Format chunks context
    const context = chunks && chunks.length > 0
      ? chunks.map((c, i) => `[Notes Excerpt ${i + 1}]:\n${c}`).join("\n\n")
      : "No notes excerpts found.";

    const systemInstruction = `You are an educational assistant.

Answer only from the supplied notes.

If the answer is not exist in the notes, reply exactly:
"I could not find that information in the uploaded notes."

Do not hallucinate.`;

    const prompt = `${systemInstruction}

Supplied Notes:
${context}

User Question: ${question}

Response:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Gemini QA Generation error:", error.message);
    throw new Error(`Failed to generate answer from model: ${error.message}`);
  }
}

module.exports = {
  generateAnswer,
};
