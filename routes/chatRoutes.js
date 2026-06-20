const express = require("express");
const auth = require("../middleware/auth");
const chatController = require("../controllers/chatController");
const geminiService = require("../services/geminiService");

const router = express.Router();

// Protected chat RAG endpoint
router.post("/chat", auth, chatController.chat);

// Protected debug-search endpoint
router.post("/debug-search", auth, chatController.debugSearch);

// Minimal public Gemini test endpoint
router.get("/test-gemini", async (req, res) => {
  try {
    const promptText = req.query.prompt || "Hello Gemini";
    const response = await geminiService.generateTestResponse(promptText);
    res.json({
      success: true,
      prompt: promptText,
      response: response
    });
  } catch (error) {
    console.error("Test Gemini endpoint error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
