const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const impact = require("../controllers/impactController");

const router = express.Router();
router.get("/ngo/events.csv", authenticateToken, impact.exportNgoEvents);
router.get("/volunteer/impact.csv", authenticateToken, impact.exportVolunteerImpact);

module.exports = router;
