const db = require("../config/db");

const parseId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const requireRole = (req, res, role) => {
    if (req.user.userType === role) return true;
    res.status(403).json({ success: false, message: `${role} access is required.` });
    return false;
};

const listMyReviews = async (req, res) => {
    if (!requireRole(req, res, "Volunteer")) return;
    try {
        const [reviews] = await db.promise().query(
            `SELECT h.Event_ID AS eventId, h.Application_ID AS applicationId,
                    e.Event_Title AS eventTitle, n.Organization_Name AS ngoName,
                    MAX(h.Completion_Date) AS completionDate,
                    r.Review_ID AS reviewId, r.Rating AS rating, r.Comments AS comments,
                    r.Created_At AS reviewedAt
             FROM VOLUNTEER_HISTORY h
             JOIN EVENTS e ON e.Event_ID = h.Event_ID
             JOIN NGOS n ON n.NGO_ID = e.NGO_ID
             LEFT JOIN VOLUNTEER_REVIEWS r ON r.Event_ID = h.Event_ID AND r.Volunteer_ID = h.Volunteer_ID
             LEFT JOIN EVENT_APPLICATIONS a ON a.Application_ID = h.Application_ID
             WHERE h.Volunteer_ID = (
                 SELECT Volunteer_ID FROM VOLUNTEERS WHERE User_ID = ? LIMIT 1
             ) AND h.Completion_Status = 'Attended'
               AND (h.Application_ID IS NULL OR a.Status = 'Approved')
             GROUP BY h.Event_ID, h.Application_ID, e.Event_Title, n.Organization_Name,
                      r.Review_ID, r.Rating, r.Comments, r.Created_At
             ORDER BY MAX(h.Completion_Date) DESC, h.Event_ID DESC`,
            [req.user.userId]
        );
        return res.json({ success: true, reviews });
    } catch (error) {
        console.error("Volunteer review list failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load your feedback." });
    }
};

const submitReview = async (req, res) => {
    if (!requireRole(req, res, "Volunteer")) return;
    const eventId = parseId(req.params.eventId);
    const rating = req.body?.rating;
    const comments = req.body?.comments == null ? "" : req.body.comments;
    if (!eventId) return res.status(400).json({ success: false, message: "A valid event ID is required." });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: "Rating must be a whole number from 1 to 5." });
    }
    if (typeof comments !== "string" || comments.trim().length > 1000) {
        return res.status(400).json({ success: false, message: "Feedback must be 1000 characters or fewer." });
    }
    let connection;
    try {
        const [volunteers] = await db.promise().query(
            "SELECT Volunteer_ID FROM VOLUNTEERS WHERE User_ID = ? LIMIT 1", [req.user.userId]
        );
        if (!volunteers.length) return res.status(404).json({ success: false, message: "Volunteer profile not found." });
        const volunteerId = volunteers[0].Volunteer_ID;
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [completed] = await connection.query(
            `SELECT h.Application_ID
             FROM VOLUNTEER_HISTORY h
             LEFT JOIN EVENT_APPLICATIONS a ON a.Application_ID = h.Application_ID
             WHERE h.Event_ID = ? AND h.Volunteer_ID = ? AND h.Completion_Status = 'Attended'
               AND (h.Application_ID IS NULL OR a.Status = 'Approved')
             ORDER BY h.History_ID DESC LIMIT 1 FOR UPDATE`,
            [eventId, volunteerId]
        );
        if (!completed.length) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: "Feedback is available only for an event you completed." });
        }
        await connection.query(
            `INSERT INTO VOLUNTEER_REVIEWS (Event_ID, Volunteer_ID, Application_ID, Rating, Comments)
             VALUES (?, ?, ?, ?, ?)`,
            [eventId, volunteerId, completed[0].Application_ID, rating, comments.trim() || null]
        );
        const [[summary]] = await connection.query(
            "SELECT COUNT(*) AS reviewCount, ROUND(AVG(Rating), 1) AS averageRating FROM VOLUNTEER_REVIEWS WHERE Event_ID = ?",
            [eventId]
        );
        await connection.commit();
        return res.status(201).json({
            success: true, message: "Thank you. Your feedback was submitted.",
            summary: { reviewCount: Number(summary.reviewCount), averageRating: Number(summary.averageRating) }
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, message: "You have already reviewed this event." });
        console.error("Volunteer review submission failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to submit your feedback." });
    } finally {
        connection?.release();
    }
};

const getNgoEventReviews = async (req, res) => {
    if (!requireRole(req, res, "NGO")) return;
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, message: "A valid event ID is required." });
    try {
        const [events] = await db.promise().query(
            `SELECT Event_ID AS eventId, Event_Title AS eventTitle
             FROM EVENTS WHERE Event_ID = ? AND NGO_ID = (
                 SELECT NGO_ID FROM NGOS WHERE User_ID = ? LIMIT 1
             ) LIMIT 1`,
            [eventId, req.user.userId]
        );
        if (!events.length) return res.status(404).json({ success: false, message: "Event not found." });
        const [[summary]] = await db.promise().query(
            `SELECT COUNT(*) AS reviewCount, ROUND(AVG(Rating), 1) AS averageRating
             FROM VOLUNTEER_REVIEWS WHERE Event_ID = ?`, [eventId]
        );
        const [reviews] = await db.promise().query(
            `SELECT Rating AS rating, Comments AS comments, Created_At AS reviewedAt
             FROM VOLUNTEER_REVIEWS WHERE Event_ID = ? ORDER BY Created_At DESC, Review_ID DESC`,
            [eventId]
        );
        return res.json({
            success: true, event: events[0],
            summary: { reviewCount: Number(summary.reviewCount), averageRating: summary.averageRating == null ? null : Number(summary.averageRating) },
            reviews
        });
    } catch (error) {
        console.error("NGO event reviews failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load event feedback." });
    }
};

module.exports = { listMyReviews, submitReview, getNgoEventReviews };
