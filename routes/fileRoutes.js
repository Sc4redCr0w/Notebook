const express = require("express");
const auth = require("../middleware/auth");
const fileController = require("../controllers/fileController");

const router = express.Router();

router.get("/files", auth, fileController.getFiles);

module.exports = router;
