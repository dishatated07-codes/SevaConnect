const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const {
    listOpenEvents,
    applyToEvent
} = require("../controllers/eventController");

const router = express.Router();

router.get("/", authenticateToken.optional, listOpenEvents);
router.post("/:eventId/applications", authenticateToken, applyToEvent);

const management = require("../controllers/eventManagementController");
const feedback = require("../controllers/feedbackController");
router.post("/:eventId/feedback", authenticateToken, feedback.submitReview);
router.get("/:eventId/feedback", authenticateToken, feedback.getNgoEventReviews);
const attendance = require("../controllers/attendanceController");
router.get("/attendance/:eventId", authenticateToken, attendance.getEventAttendance);
router.put("/:eventId/applications/:applicationId/attendance", authenticateToken, attendance.saveAttendance);
router.get("/mine", authenticateToken, management.listNgoEvents);
router.get("/:eventId/skills", authenticateToken, management.getNgoEventSkills);
router.put("/:eventId/skills", authenticateToken, management.updateNgoEventSkills);
router.post("/", authenticateToken, management.createEvent);
router.put("/:eventId", authenticateToken, management.updateNgoEvent);
router.patch("/:eventId/cancel", authenticateToken, management.cancelNgoEvent);
router.get("/ngo/applications", authenticateToken, management.listNgoApplications);
router.patch("/applications/:applicationId", authenticateToken, management.reviewNgoApplication);
router.patch("/applications/:applicationId/completion", authenticateToken, management.completeNgoApplication);

module.exports = router;
