const OpenAI = require("openai");

const apiKey = process.env.GROQ_API_KEY;
console.log("Groq key loaded:", !!apiKey);

const client = new OpenAI({
  apiKey: apiKey || "DUMMY_KEY",
  baseURL: "https://api.groq.com/openai/v1"
});

/**
 * Generates an answer using the Groq API based strictly on the provided context chunks.
 * @param {string} question - User's chat question
 * @param {string[]} chunks - Context snippets retrieved from ChromaDB
 * @returns {Promise<string>} - The generated response text
 */
async function generateAnswer(question, chunks) {
  if (!question) {
    throw new Error("Question is required for answer generation");
  }

  const currentApiKey = process.env.GROQ_API_KEY;
  if (!currentApiKey || currentApiKey.trim() === "") {
    throw new Error("GROQ_API_KEY is missing or empty.");
  }

  try {
    // Format chunks context
    const context = chunks && chunks.length > 0
      ? chunks.map((c, i) => `[Notes Excerpt ${i + 1}]:\n${c}`).join("\n\n")
      : "No notes excerpts found.";

    const systemInstruction = `You are an intelligent educational assistant.

Answer the user's question directly and naturally.

Instructions:

1. Use the supplied notes whenever they are relevant to the user's question.
2. If the supplied notes are partially relevant, combine information from the notes with your own knowledge.
3. If the supplied notes are irrelevant, incomplete, or missing information needed to answer the question, answer using your own knowledge without mentioning the notes.
4. Never say:

   * "The supplied notes do not contain information about..."
   * "The provided notes are insufficient..."
   * "The notes do not mention..."
   * "I cannot answer because the notes do not contain..."
5. Do not explain whether information came from the notes or from your own knowledge unless explicitly asked.
6. Always provide the most helpful, complete, and accurate answer possible.
7. For greetings, casual conversation, coding questions, current affairs, general knowledge, and questions unrelated to the notes, answer normally.
8. Treat the supplied notes as optional supporting context, not a mandatory source.
9. dont mention wether the notes contain the answer or not

Supplied Notes:
{context}

User Question:
{question}`;


    const prompt = `${systemInstruction}

Supplied Notes:
${context}

User Question: ${question}

Response:`;

    console.log(`[Groq RAG] Submitting completions request with ${chunks.length} context chunks...`);
    const chatCompletion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "user", content: prompt }
      ]
    });

    if (chatCompletion && chatCompletion.choices && chatCompletion.choices[0] && chatCompletion.choices[0].message) {
      console.log("[Groq RAG] Received answer generation response successfully");
      return chatCompletion.choices[0].message.content.trim();
    } else {
      throw new Error("Groq API returned an empty response.");
    }
  } catch (error) {
    console.error("Groq QA Generation error:", error.message);
    throw error;
  }
}

/**
 * A direct wrapper to test the raw Groq API content generation without context constraints.
 * @param {string} promptText
 * @returns {Promise<string>}
 */
async function generateTestResponse(promptText) {
  const currentApiKey = process.env.GROQ_API_KEY;
  if (!currentApiKey || currentApiKey.trim() === "") {
    throw new Error("GROQ_API_KEY is missing or empty.");
  }

  try {
    console.log("[Groq API] Submitting raw completions test request...");
    const chatCompletion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "user", content: promptText }
      ]
    });

    if (chatCompletion && chatCompletion.choices && chatCompletion.choices[0] && chatCompletion.choices[0].message) {
      console.log("[Groq API] Received completions test response successfully");
      return chatCompletion.choices[0].message.content.trim();
    } else {
      throw new Error("Groq API returned an empty response.");
    }
  } catch (error) {
    console.error("Groq direct generation error:", error.message);
    throw error;
  }
}

module.exports = {
  generateAnswer,
  generateTestResponse,
};
