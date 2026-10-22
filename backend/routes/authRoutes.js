const express = require("express");

const {
    loginUser,
    getCurrentUser
} = require("../controllers/authController");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", loginUser);
router.get("/me", authenticateToken, getCurrentUser);

module.exports = router;
