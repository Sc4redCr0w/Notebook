const express = require("express");
const auth = require("../middleware/auth");
const chatController = require("../controllers/chatController");

const router = express.Router();

// Protected chat RAG endpoint
router.post("/chat", auth, chatController.chat);

module.exports = router;
