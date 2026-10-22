const db = require("../config/db");

const parseId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const getEventAttendance = async (req, res) => {
    if (req.user.userType !== "NGO") return res.status(403).json({ success: false, message: "NGO access is required." });
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, message: "A valid event ID is required." });
    try {
        const [events] = await db.promise().query(
            "SELECT Event_ID FROM EVENTS WHERE Event_ID = ? AND NGO_ID = (SELECT NGO_ID FROM NGOS WHERE User_ID = ?) LIMIT 1",
            [eventId, req.user.userId]
        );
        if (!events.length) return res.status(404).json({ success: false, message: "Event not found." });
        const [volunteers] = await db.promise().query(
            `SELECT a.Application_ID AS applicationId, a.Status AS applicationStatus,
                    v.Full_Name AS volunteerName, at.Status AS attendanceStatus,
                    h.Hours_Volunteered AS hoursVolunteered,
                    CASE h.Completion_Status WHEN 'Attended' THEN 'Completed' WHEN 'No-show' THEN 'Absent' ELSE NULL END AS outcome
             FROM EVENT_APPLICATIONS a JOIN VOLUNTEERS v ON v.Volunteer_ID = a.Volunteer_ID
             LEFT JOIN EVENT_ATTENDANCE at ON at.Application_ID = a.Application_ID
             LEFT JOIN VOLUNTEER_HISTORY h ON h.Application_ID = a.Application_ID
             WHERE a.Event_ID = ? AND a.Status = 'Approved' ORDER BY v.Full_Name`, [eventId]
        );
        const present = volunteers.filter((row) => row.attendanceStatus === "Present").length;
        const absent = volunteers.filter((row) => row.attendanceStatus === "Absent").length;
        return res.json({ success: true, volunteers, summary: { approved: volunteers.length, present, absent } });
    } catch (error) {
        console.error("Attendance retrieval failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load attendance." });
    }
};

const saveAttendance = async (req, res) => {
    if (req.user.userType !== "NGO") return res.status(403).json({ success: false, message: "NGO access is required." });
    const eventId = parseId(req.params.eventId);
    const applicationId = parseId(req.params.applicationId);
    const status = req.body?.status;
    if (!eventId || !applicationId) return res.status(400).json({ success: false, message: "Valid event and application IDs are required." });
    if (!["Present", "Absent"].includes(status)) return res.status(400).json({ success: false, message: "Status must be Present or Absent." });
    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query(
            `SELECT a.Application_ID FROM EVENT_APPLICATIONS a JOIN EVENTS e ON e.Event_ID = a.Event_ID
             WHERE a.Application_ID = ? AND a.Event_ID = ? AND a.Status = 'Approved'
               AND e.NGO_ID = (SELECT NGO_ID FROM NGOS WHERE User_ID = ?) FOR UPDATE`,
            [applicationId, eventId, req.user.userId]
        );
        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Approved application not found for your event." });
        }
        await connection.query(
            `INSERT INTO EVENT_ATTENDANCE (Event_ID, Volunteer_ID, Application_ID, Status)
             SELECT a.Event_ID, a.Volunteer_ID, a.Application_ID, ? FROM EVENT_APPLICATIONS a WHERE a.Application_ID = ?
             ON DUPLICATE KEY UPDATE Status = VALUES(Status), Updated_At = CURRENT_TIMESTAMP`,
            [status, applicationId]
        );
        await connection.commit();
        return res.json({ success: true, message: `Attendance saved as ${status}.` });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Attendance update failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to save attendance." });
    } finally {
        connection?.release();
    }
};

const getMyHistory = async (req, res) => {
    if (req.user.userType !== "Volunteer") return res.status(403).json({ success: false, message: "Volunteer access is required." });
    try {
        const [rows] = await db.promise().query(
            `SELECT e.Event_Title AS eventTitle, n.Organization_Name AS ngoName,
                    h.Completion_Date AS completionDate, h.Hours_Volunteered AS hoursVolunteered,
                    at.Status AS attendanceStatus, h.Feedback AS feedback
             FROM VOLUNTEER_HISTORY h JOIN EVENTS e ON e.Event_ID = h.Event_ID
             JOIN NGOS n ON n.NGO_ID = e.NGO_ID
             JOIN VOLUNTEERS v ON v.Volunteer_ID = h.Volunteer_ID
             LEFT JOIN EVENT_ATTENDANCE at ON at.Application_ID = h.Application_ID
             WHERE v.User_ID = ? AND h.Completion_Status = 'Attended'
             ORDER BY h.Completion_Date DESC, h.History_ID DESC`, [req.user.userId]
        );
        const [[totals]] = await db.promise().query(
            `SELECT COALESCE(SUM(Hours_Volunteered), 0) AS totalHours, COUNT(*) AS completedEvents
             FROM VOLUNTEER_HISTORY h JOIN VOLUNTEERS v ON v.Volunteer_ID = h.Volunteer_ID
             WHERE v.User_ID = ? AND h.Completion_Status = 'Attended'`, [req.user.userId]
        );
        return res.json({ success: true, history: rows, totals });
    } catch (error) {
        console.error("Volunteer history retrieval failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load your service history." });
    }
};

module.exports = { getEventAttendance, saveAttendance, getMyHistory };
