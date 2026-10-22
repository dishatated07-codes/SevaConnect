const db = require("../config/db");

const getVolunteerDashboard = async (req, res) => {
    if (req.user.userType !== "Volunteer") {
        return res.status(403).json({ success: false, message: "Volunteer access is required." });
    }

    try {
        const [profiles] = await db.promise().query(
            "SELECT Volunteer_ID FROM VOLUNTEERS WHERE User_ID = ? LIMIT 1",
            [req.user.userId]
        );

        if (profiles.length === 0) {
            return res.status(404).json({ success: false, message: "Volunteer profile not found." });
        }

        const volunteerId = profiles[0].Volunteer_ID;
        const [[stats]] = await db.promise().query(
            `SELECT
                COUNT(a.Application_ID) AS appliedEvents,
                COUNT(CASE WHEN a.Status = 'Approved' THEN 1 END) AS approvedApplications,
                COUNT(CASE WHEN a.Status = 'Approved' AND e.Status IN ('Open', 'Upcoming') AND e.Start_Date_Time >= CURRENT_TIMESTAMP THEN 1 END) AS upcomingEvents,
                COALESCE((
                    SELECT SUM(h.Hours_Volunteered)
                    FROM VOLUNTEER_HISTORY h
                    WHERE h.Volunteer_ID = ? AND h.Completion_Status = 'Attended'
                ), 0) AS volunteerHours
             FROM EVENT_APPLICATIONS a
             JOIN EVENTS e ON e.Event_ID = a.Event_ID
             WHERE a.Volunteer_ID = ?`,
            [volunteerId, volunteerId]
        );
        const [recentApplications] = await db.promise().query(
            `SELECT
                a.Application_ID AS applicationId,
                e.Event_ID AS eventId,
                e.Event_Title AS eventTitle,
                e.Location AS location,
                e.City AS city,
                e.Status AS eventStatus,
                e.Start_Date_Time AS eventStartDateTime,
                e.End_Date_Time AS eventEndDateTime,
                a.Status AS status,
                a.Application_Date AS applicationDate,
                EXISTS(SELECT 1 FROM VOLUNTEER_HISTORY h WHERE h.Application_ID = a.Application_ID) AS isCompleted
             FROM EVENT_APPLICATIONS a
             JOIN EVENTS e ON e.Event_ID = a.Event_ID
             WHERE a.Volunteer_ID = ?
             ORDER BY a.Application_Date DESC`,
            [volunteerId]
        );

        const [history] = await db.promise().query(
            `SELECT h.History_ID AS historyId, e.Event_Title AS eventTitle, e.City AS city,
                    n.Organization_Name AS ngoName, at.Status AS attendanceStatus,
                    h.Hours_Volunteered AS hoursVolunteered, h.Completion_Status AS completionStatus,
                    h.Completion_Date AS completionDate, h.Feedback AS feedback
             FROM VOLUNTEER_HISTORY h JOIN EVENTS e ON e.Event_ID = h.Event_ID
             JOIN NGOS n ON n.NGO_ID = e.NGO_ID
             LEFT JOIN EVENT_ATTENDANCE at ON at.Application_ID = h.Application_ID
             WHERE h.Volunteer_ID = ? AND h.Completion_Status = 'Attended' ORDER BY h.Completion_Date DESC, h.History_ID DESC`,
            [volunteerId]
        );
        return res.status(200).json({ success: true, stats, recentApplications, history });
    } catch (error) {
        console.error("Volunteer dashboard load failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load your dashboard right now." });
    }
};

const getNgoDashboard = async (req, res) => {
    if (req.user.userType !== "NGO") {
        return res.status(403).json({ success: false, message: "NGO access is required." });
    }

    try {
        const [profiles] = await db.promise().query(
            "SELECT NGO_ID FROM NGOS WHERE User_ID = ? LIMIT 1",
            [req.user.userId]
        );

        if (profiles.length === 0) {
            return res.status(404).json({ success: false, message: "NGO profile not found." });
        }

        const ngoId = profiles[0].NGO_ID;
        const [[stats]] = await db.promise().query(
            `SELECT
                COUNT(DISTINCT e.Event_ID) AS totalEvents,
                COUNT(DISTINCT CASE WHEN e.Status IN ('Open', 'Upcoming') AND e.Start_Date_Time >= CURRENT_TIMESTAMP THEN e.Event_ID END) AS activeEvents,
                COUNT(DISTINCT a.Application_ID) AS totalApplications,
                COUNT(DISTINCT CASE WHEN a.Status = 'Pending' THEN a.Application_ID END) AS pendingApplications,
                COUNT(DISTINCT CASE WHEN a.Status = 'Approved' THEN a.Volunteer_ID END) AS approvedVolunteers,
                (SELECT COUNT(DISTINCT ev.Event_ID) FROM EVENTS ev JOIN EVENT_APPLICATIONS ea ON ea.Event_ID = ev.Event_ID
                 LEFT JOIN EVENT_ATTENDANCE att ON att.Application_ID = ea.Application_ID
                 WHERE ev.NGO_ID = ? AND ea.Status = 'Approved' AND ev.End_Date_Time < CURRENT_TIMESTAMP AND att.Application_ID IS NULL) AS eventsAwaitingAttendance,
                (SELECT COUNT(*) FROM EVENT_ATTENDANCE att JOIN EVENTS ev ON ev.Event_ID = att.Event_ID
                 WHERE ev.NGO_ID = ? AND att.Status = 'Present') AS volunteersPresent,
                (SELECT COALESCE(SUM(h.Hours_Volunteered), 0) FROM VOLUNTEER_HISTORY h JOIN EVENTS ev ON ev.Event_ID = h.Event_ID
                 WHERE ev.NGO_ID = ? AND h.Completion_Status = 'Attended') AS completedVolunteerHours
             FROM NGOS n
             LEFT JOIN EVENTS e ON e.NGO_ID = n.NGO_ID
             LEFT JOIN EVENT_APPLICATIONS a ON a.Event_ID = e.Event_ID
             WHERE n.NGO_ID = ?
             GROUP BY n.NGO_ID`,
            [ngoId, ngoId, ngoId, ngoId]
        );
        const [events] = await db.promise().query(
            `SELECT
                e.Event_ID AS eventId,
                e.Event_Title AS title,
                e.Category AS category,
                e.City AS city,
                e.Start_Date_Time AS startDateTime,
                e.Total_Capacity AS totalCapacity,
                COUNT(DISTINCT CASE WHEN a.Status = 'Approved' THEN a.Volunteer_ID END) AS approvedVolunteers
             FROM EVENTS e
             LEFT JOIN EVENT_APPLICATIONS a ON a.Event_ID = e.Event_ID
             WHERE e.NGO_ID = ?
               AND e.Status IN ('Open', 'Upcoming')
               AND e.Start_Date_Time >= CURRENT_TIMESTAMP
             GROUP BY e.Event_ID, e.Event_Title, e.Category, e.City, e.Start_Date_Time, e.Total_Capacity
             ORDER BY e.Start_Date_Time ASC
             LIMIT 5`,
            [ngoId]
        );
        const [recentApplications] = await db.promise().query(
            `SELECT
                a.Application_ID AS applicationId,
                v.Full_Name AS volunteerName,
                e.Event_Title AS eventTitle,
                a.Application_Date AS applicationDate,
                a.Status AS status
             FROM EVENT_APPLICATIONS a
             JOIN EVENTS e ON e.Event_ID = a.Event_ID
             JOIN VOLUNTEERS v ON v.Volunteer_ID = a.Volunteer_ID
             WHERE e.NGO_ID = ?
             ORDER BY a.Application_Date DESC
             LIMIT 10`,
            [ngoId]
        );

        return res.status(200).json({ success: true, stats, events, recentApplications });
    } catch (error) {
        console.error("NGO dashboard load failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load your dashboard right now." });
    }
};

module.exports = {
    getVolunteerDashboard,
    getNgoDashboard
};
