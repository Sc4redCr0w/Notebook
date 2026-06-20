const ragService = require("../services/ragService");
const embeddingService = require("../services/embeddingService");
const chromaService = require("../services/chromaService");

/**
 * Handle POST /chat requests
 */
async function chat(req, res) {
  try {
    const { question, scope } = req.body;
    const userId = req.user.userId;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        success: false,
        error: "question is required and must be a string",
      });
    }

    // Default scope is "all" if not specified or invalid
    const targetScope = scope === "mine" ? "mine" : "all";

    const result = await ragService.getRAGAnswer(question, userId, targetScope);

    return res.json(result);
  } catch (error) {
    console.error("Chat controller error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to process chat query due to server error",
    });
  }
}

/**
 * Handle POST /debug-search requests
 */
async function debugSearch(req, res) {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        success: false,
        error: "question is required and must be a string",
      });
    }

    console.log(`[Debug Search] Generating embedding for question: "${question}"...`);
    const embedding = await embeddingService.generateEmbedding(question);

    console.log(`[Debug Search] Querying database for top 5 matches...`);
    const results = await chromaService.queryCollection(embedding, 5);

    const chunks = (results.documents && results.documents[0]) || [];
    const distances = (results.distances && results.distances[0]) || [];

    const retrievedChunks = chunks.map((text, index) => {
      const distance = distances[index] !== undefined ? distances[index] : 0;
      // Cosine distance = 1 - similarity. So similarity = 1 - distance.
      const similarityScore = Math.max(0, Math.min(1, 1 - distance));
      return {
        score: parseFloat(similarityScore.toFixed(4)),
        text: text,
      };
    });

    console.log(`[Debug Search] Found ${retrievedChunks.length} chunks. Returning scores.`);
    return res.json({
      retrievedChunks,
    });
  } catch (error) {
    console.error("Debug search error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to query vector store",
    });
  }
}

module.exports = {
  chat,
  debugSearch,
};
