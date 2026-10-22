const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");

const { registerVolunteer } = require("../controllers/volunteerController");
const profile = require("../controllers/volunteerProfileController");
const attendance = require("../controllers/attendanceController");
const feedback = require("../controllers/feedbackController");

const router = express.Router();

// Test volunteer route
router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Volunteer route is working"
    });
});

// Register volunteer route
router.post("/register", registerVolunteer);
router.get("/skills", profile.listSkills);
router.get("/me/profile", authenticateToken, profile.getMyProfile);
router.put("/me/profile", authenticateToken, profile.updateMyProfile);
router.get("/me/skills", authenticateToken, profile.getMySkills);
router.put("/me/skills", authenticateToken, profile.updateMySkills);
router.get("/me/history", authenticateToken, attendance.getMyHistory);
router.get("/me/feedback", authenticateToken, feedback.listMyReviews);

module.exports = router;
