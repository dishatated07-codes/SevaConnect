const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const { listMyNotifications, markNotificationRead } = require("../controllers/notificationController");

const router = express.Router();
router.get("/", authenticateToken, listMyNotifications);
router.patch("/:notificationId/read", authenticateToken, markNotificationRead);

module.exports = router;
