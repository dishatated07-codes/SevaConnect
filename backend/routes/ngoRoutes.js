const express = require("express");
const { registerNgo } = require("../controllers/ngoController");

const router = express.Router();
router.post("/register", registerNgo);

module.exports = router;