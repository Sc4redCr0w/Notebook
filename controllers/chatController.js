const ragService = require("../services/ragService");

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

module.exports = {
  chat,
};
