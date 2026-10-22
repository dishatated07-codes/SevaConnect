const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const impact = require("../controllers/impactController");
const {
    getVolunteerDashboard,
    getNgoDashboard
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/volunteer", authenticateToken, getVolunteerDashboard);
router.get("/ngo", authenticateToken, getNgoDashboard);
router.get("/ngo/impact", authenticateToken, impact.getNgoImpact);
router.get("/volunteer/impact", authenticateToken, impact.getVolunteerImpact);

module.exports = router;
