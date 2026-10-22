const db = require("../config/db");
const { toCsv } = require("../utils/csv");

const parseDateRange = (query) => {
    const range = {};
    for (const key of ["startDate", "endDate"]) {
        const value = query[key];
        if (value == null || value === "") continue;
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return { error: `${key} must be a valid date in YYYY-MM-DD format.` };
        }
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
            return { error: `${key} must be a valid date in YYYY-MM-DD format.` };
        }
        range[key] = value;
    }
    if (range.startDate && range.endDate && range.startDate > range.endDate) {
        return { error: "startDate must be on or before endDate." };
    }
    return { range };
};

const eventDateScope = (alias, range) => {
    const clauses = [];
    const params = [];
    if (range.startDate) {
        clauses.push(`${alias}.Start_Date_Time >= ?`);
        params.push(`${range.startDate} 00:00:00`);
    }
    if (range.endDate) {
        clauses.push(`${alias}.Start_Date_Time < DATE_ADD(?, INTERVAL 1 DAY)`);
        params.push(`${range.endDate} 00:00:00`);
    }
    return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
};

const isRole = (req, res, role) => {
    if (req.user.userType === role) return true;
    res.status(403).json({ success: false, message: `${role} access is required.` });
    return false;
};

const getNgoId = async (userId) => {
    const [rows] = await db.promise().query("SELECT NGO_ID FROM NGOS WHERE User_ID = ? LIMIT 1", [userId]);
    return rows[0]?.NGO_ID || null;
};

const getVolunteerId = async (userId) => {
    const [rows] = await db.promise().query("SELECT Volunteer_ID FROM VOLUNTEERS WHERE User_ID = ? LIMIT 1", [userId]);
    return rows[0]?.Volunteer_ID || null;
};

const tableExists = async (tableName) => {
    const [rows] = await db.promise().query(
        "SELECT COUNT(*) AS tableCount FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        [tableName]
    );
    return Number(rows[0]?.tableCount || 0) > 0;
};

const getNgoImpact = async (req, res) => {
    if (!isRole(req, res, "NGO")) return;
    const parsed = parseDateRange(req.query || {});
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    try {
        const ngoId = await getNgoId(req.user.userId);
        if (!ngoId) return res.status(404).json({ success: false, message: "NGO profile not found." });
        const range = parsed.range;
        const eventScope = eventDateScope("e", range);
        const attendanceScope = eventDateScope("e", range);
        const historyScope = eventDateScope("e", range);
        const appScope = eventDateScope("e", range);
        const [eventRows, applicationRows, historyRows, attendanceRows, categories] = await Promise.all([
            db.promise().query(
                `SELECT COUNT(*) AS totalEvents,
                        SUM(CASE WHEN e.Status IN ('Open','Upcoming')
                                  AND e.Start_Date_Time >= CURRENT_TIMESTAMP
                                  AND e.End_Date_Time >= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS upcomingOpenEvents
                 FROM EVENTS e WHERE e.NGO_ID = ?${eventScope.sql}`,
                [ngoId, ...eventScope.params]
            ),
            db.promise().query(
                `SELECT COUNT(*) AS approvedApplications,
                        COUNT(DISTINCT a.Volunteer_ID) AS uniqueVolunteers
                 FROM EVENT_APPLICATIONS a JOIN EVENTS e ON e.Event_ID = a.Event_ID
                 WHERE e.NGO_ID = ? AND a.Status = 'Approved'${appScope.sql}`,
                [ngoId, ...appScope.params]
            ),
            db.promise().query(
                `SELECT COUNT(DISTINCT h.Event_ID) AS completedEvents,
                        COALESCE(SUM(h.Hours_Volunteered), 0) AS completedHours
                 FROM VOLUNTEER_HISTORY h JOIN EVENTS e ON e.Event_ID = h.Event_ID
                 WHERE e.NGO_ID = ? AND h.Completion_Status = 'Attended'${historyScope.sql}`,
                [ngoId, ...historyScope.params]
            ),
            db.promise().query(
                `SELECT SUM(CASE WHEN at.Status = 'Present' THEN 1 ELSE 0 END) AS presentCount,
                        SUM(CASE WHEN at.Status = 'Absent' THEN 1 ELSE 0 END) AS absentCount
                 FROM EVENT_ATTENDANCE at
                 JOIN EVENT_APPLICATIONS a ON a.Application_ID = at.Application_ID
                 JOIN EVENTS e ON e.Event_ID = at.Event_ID
                 WHERE e.NGO_ID = ? AND a.Event_ID = e.Event_ID
                   AND a.Volunteer_ID = at.Volunteer_ID AND a.Status = 'Approved'${attendanceScope.sql}`,
                [ngoId, ...attendanceScope.params]
            ),
            db.promise().query(
                `SELECT e.Category AS category, COUNT(*) AS eventCount
                 FROM EVENTS e WHERE e.NGO_ID = ?${eventScope.sql}
                 GROUP BY e.Category ORDER BY eventCount DESC, e.Category ASC`,
                [ngoId, ...eventScope.params]
            )
        ]);
        let ratingSummary = { reviewCount: 0, averageRating: null, reviewsAvailable: false };
        if (await tableExists("VOLUNTEER_REVIEWS")) {
            const [[ratings]] = await db.promise().query(
                `SELECT COUNT(*) AS reviewCount, ROUND(AVG(r.Rating), 1) AS averageRating
                 FROM VOLUNTEER_REVIEWS r JOIN EVENTS e ON e.Event_ID = r.Event_ID
                 WHERE e.NGO_ID = ?${eventDateScope("e", range).sql}`,
                [ngoId, ...eventDateScope("e", range).params]
            );
            ratingSummary = {
                reviewCount: Number(ratings.reviewCount),
                averageRating: ratings.averageRating == null ? null : Number(ratings.averageRating),
                reviewsAvailable: true
            };
        }
        const events = eventRows[0][0];
        const applications = applicationRows[0][0];
        const history = historyRows[0][0];
        const attendance = attendanceRows[0][0];
        const present = Number(attendance.presentCount || 0);
        const absent = Number(attendance.absentCount || 0);
        const recorded = present + absent;
        return res.json({
            success: true,
            dateRange: range,
            stats: {
                totalEvents: Number(events.totalEvents || 0),
                upcomingOpenEvents: Number(events.upcomingOpenEvents || 0),
                completedEvents: Number(history.completedEvents || 0),
                approvedApplications: Number(applications.approvedApplications || 0),
                uniqueVolunteersEngaged: Number(applications.uniqueVolunteers || 0),
                presentAttendance: present,
                absentAttendance: absent,
                attendanceRate: recorded ? Number((present * 100 / recorded).toFixed(1)) : null,
                totalCompletedHours: Number(Number(history.completedHours || 0).toFixed(2)),
                ...ratingSummary
            },
            categories: categories[0].map((row) => ({ category: row.category, eventCount: Number(row.eventCount) }))
        });
    } catch (error) {
        console.error("NGO impact analytics failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load NGO impact analytics." });
    }
};

const getVolunteerImpact = async (req, res) => {
    if (!isRole(req, res, "Volunteer")) return;
    const parsed = parseDateRange(req.query || {});
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    try {
        const volunteerId = await getVolunteerId(req.user.userId);
        if (!volunteerId) return res.status(404).json({ success: false, message: "Volunteer profile not found." });
        const range = parsed.range;
        const historyScope = eventDateScope("e", range);
        const attendanceScope = eventDateScope("e", range);
        const monthlyScope = eventDateScope("e", range);
        const recordScope = eventDateScope("e", range);
        const [historyStats, attendanceStats, monthlyRows, attendanceRows, recentRows] = await Promise.all([
            db.promise().query(
                `SELECT COUNT(DISTINCT h.Event_ID) AS completedEvents,
                        COALESCE(SUM(h.Hours_Volunteered), 0) AS totalCompletedHours
                 FROM VOLUNTEER_HISTORY h JOIN EVENTS e ON e.Event_ID = h.Event_ID
                 WHERE h.Volunteer_ID = ? AND h.Completion_Status = 'Attended'${historyScope.sql}`,
                [volunteerId, ...historyScope.params]
            ),
            db.promise().query(
                `SELECT COUNT(*) AS recordedAttendance,
                        SUM(CASE WHEN at.Status = 'Present' THEN 1 ELSE 0 END) AS presentCount,
                        SUM(CASE WHEN at.Status = 'Absent' THEN 1 ELSE 0 END) AS absentCount,
                        COUNT(DISTINCT CASE WHEN at.Status = 'Present' THEN e.Event_ID END) AS eventsAttended
                 FROM EVENT_ATTENDANCE at
                 JOIN EVENT_APPLICATIONS a ON a.Application_ID = at.Application_ID
                 JOIN EVENTS e ON e.Event_ID = at.Event_ID
                 WHERE a.Volunteer_ID = ? AND a.Status = 'Approved'
                   AND a.Event_ID = e.Event_ID AND at.Volunteer_ID = a.Volunteer_ID${attendanceScope.sql}`,
                [volunteerId, ...attendanceScope.params]
            ),
            db.promise().query(
                `SELECT DATE_FORMAT(h.Completion_Date, '%Y-%m') AS month,
                        SUM(h.Hours_Volunteered) AS hours
                 FROM VOLUNTEER_HISTORY h JOIN EVENTS e ON e.Event_ID = h.Event_ID
                 WHERE h.Volunteer_ID = ? AND h.Completion_Status = 'Attended'
                   AND h.Completion_Date >= DATE_SUB(CURRENT_DATE, INTERVAL 11 MONTH)${monthlyScope.sql}
                 GROUP BY DATE_FORMAT(h.Completion_Date, '%Y-%m')
                 ORDER BY month ASC`,
                [volunteerId, ...monthlyScope.params]
            ),
            db.promise().query(
                `SELECT e.Event_Title AS eventTitle, e.Category AS category, n.Organization_Name AS ngoName,
                        at.Status AS attendanceStatus, at.Recorded_At AS recordedAt,
                        h.Completion_Date AS completionDate, h.Hours_Volunteered AS hoursVolunteered
                 FROM EVENT_ATTENDANCE at
                 JOIN EVENT_APPLICATIONS a ON a.Application_ID = at.Application_ID
                 JOIN EVENTS e ON e.Event_ID = at.Event_ID
                 JOIN NGOS n ON n.NGO_ID = e.NGO_ID
                 LEFT JOIN (
                     SELECT Application_ID, Event_ID, Volunteer_ID, MAX(Completion_Date) AS Completion_Date,
                            SUM(Hours_Volunteered) AS Hours_Volunteered
                     FROM VOLUNTEER_HISTORY WHERE Completion_Status = 'Attended'
                     GROUP BY Application_ID, Event_ID, Volunteer_ID
                 ) h ON h.Application_ID = a.Application_ID AND h.Event_ID = e.Event_ID AND h.Volunteer_ID = a.Volunteer_ID
                 WHERE a.Volunteer_ID = ? AND a.Status = 'Approved'
                   AND a.Event_ID = e.Event_ID AND at.Volunteer_ID = a.Volunteer_ID${recordScope.sql}
                 ORDER BY at.Recorded_At DESC LIMIT 50`,
                [volunteerId, ...recordScope.params]
            ),
            db.promise().query(
                `SELECT e.Event_Title AS eventTitle, e.Category AS category, n.Organization_Name AS ngoName,
                        MAX(h.Completion_Date) AS completionDate, SUM(h.Hours_Volunteered) AS hoursVolunteered
                 FROM VOLUNTEER_HISTORY h JOIN EVENTS e ON e.Event_ID = h.Event_ID
                 JOIN NGOS n ON n.NGO_ID = e.NGO_ID
                 WHERE h.Volunteer_ID = ? AND h.Completion_Status = 'Attended'${eventDateScope("e", range).sql}
                 GROUP BY e.Event_ID, e.Event_Title, e.Category, n.Organization_Name
                 ORDER BY MAX(h.Completion_Date) DESC LIMIT 10`,
                [volunteerId, ...eventDateScope("e", range).params]
            )
        ]);
        const hs = historyStats[0][0];
        const as = attendanceStats[0][0];
        const present = Number(as.presentCount || 0);
        const absent = Number(as.absentCount || 0);
        const recorded = Number(as.recordedAttendance || 0);
        return res.json({
            success: true,
            dateRange: range,
            stats: {
                completedEvents: Number(hs.completedEvents || 0),
                totalCompletedHours: Number(Number(hs.totalCompletedHours || 0).toFixed(2)),
                eventsAttended: Number(as.eventsAttended || 0),
                presentAttendance: present,
                absentAttendance: absent,
                attendanceRate: recorded ? Number((present * 100 / recorded).toFixed(1)) : null
            },
            monthlyHours: monthlyRows[0].map((row) => ({ month: row.month, hours: Number(row.hours) })),
            attendanceHistory: attendanceRows[0],
            recentActivities: recentRows[0]
        });
    } catch (error) {
        console.error("Volunteer impact analytics failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load your impact analytics." });
    }
};

const sendCsv = (res, filename, headers, rows) => {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(`\uFEFF${toCsv(headers, rows)}`);
};

const exportNgoEvents = async (req, res) => {
    if (!isRole(req, res, "NGO")) return;
    const parsed = parseDateRange(req.query || {});
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    try {
        const ngoId = await getNgoId(req.user.userId);
        if (!ngoId) return res.status(404).json({ success: false, message: "NGO profile not found." });
        const range = parsed.range;
        const scope = eventDateScope("e", range);
        const reviewsAvailable = await tableExists("VOLUNTEER_REVIEWS");
        const reviewFields = reviewsAvailable
            ? `(SELECT ROUND(AVG(r.Rating),1) FROM VOLUNTEER_REVIEWS r WHERE r.Event_ID=e.Event_ID) AS averageRating,
               (SELECT COUNT(*) FROM VOLUNTEER_REVIEWS r WHERE r.Event_ID=e.Event_ID) AS reviewCount`
            : "NULL AS averageRating, 0 AS reviewCount";
        const [rows] = await db.promise().query(
            `SELECT e.Event_Title AS eventTitle, e.Category AS category, e.City AS city,
                    e.Location AS location, e.Start_Date_Time AS startDateTime, e.End_Date_Time AS endDateTime,
                    e.Status AS status, e.Total_Capacity AS capacity,
                    (SELECT COUNT(*) FROM EVENT_APPLICATIONS a WHERE a.Event_ID=e.Event_ID AND a.Status='Approved') AS approvedApplications,
                    (SELECT COUNT(DISTINCT a.Volunteer_ID) FROM EVENT_APPLICATIONS a WHERE a.Event_ID=e.Event_ID AND a.Status='Approved') AS approvedVolunteers,
                    (SELECT COUNT(*) FROM EVENT_ATTENDANCE at
                     JOIN EVENT_APPLICATIONS a ON a.Application_ID=at.Application_ID
                     WHERE at.Event_ID=e.Event_ID AND at.Status='Present' AND a.Status='Approved'
                       AND a.Event_ID=e.Event_ID AND at.Volunteer_ID=a.Volunteer_ID) AS presentAttendance,
                    (SELECT COUNT(*) FROM EVENT_ATTENDANCE at
                     JOIN EVENT_APPLICATIONS a ON a.Application_ID=at.Application_ID
                     WHERE at.Event_ID=e.Event_ID AND at.Status='Absent' AND a.Status='Approved'
                       AND a.Event_ID=e.Event_ID AND at.Volunteer_ID=a.Volunteer_ID) AS absentAttendance,
                    (SELECT COALESCE(SUM(h.Hours_Volunteered),0) FROM VOLUNTEER_HISTORY h
                     WHERE h.Event_ID=e.Event_ID AND h.Completion_Status='Attended') AS completedHours,
                    ${reviewFields}
             FROM EVENTS e WHERE e.NGO_ID=?${scope.sql}
             ORDER BY e.Start_Date_Time ASC, e.Event_ID ASC`,
            [ngoId, ...scope.params]
        );
        const headers = ["Event", "Category", "City", "Location", "Start", "End", "Status", "Capacity",
            "Approved Applications", "Unique Approved Volunteers", "Present", "Absent", "Completed Hours",
            "Average Rating", "Review Count"];
        return sendCsv(res, "ngo-impact-events.csv", headers, rows.map((row) => [
            row.eventTitle, row.category, row.city, row.location, row.startDateTime, row.endDateTime, row.status,
            row.capacity, row.approvedApplications, row.approvedVolunteers, row.presentAttendance, row.absentAttendance,
            row.completedHours, row.averageRating, row.reviewCount
        ]));
    } catch (error) {
        console.error("NGO impact CSV failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to export your event report." });
    }
};

const exportVolunteerImpact = async (req, res) => {
    if (!isRole(req, res, "Volunteer")) return;
    const parsed = parseDateRange(req.query || {});
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    try {
        const volunteerId = await getVolunteerId(req.user.userId);
        if (!volunteerId) return res.status(404).json({ success: false, message: "Volunteer profile not found." });
        const range = parsed.range;
        const attendanceScope = eventDateScope("e", range);
        const historyScope = eventDateScope("e", range);
        const [rows] = await db.promise().query(
            `SELECT 'Attendance' AS recordType, e.Event_Title AS eventTitle, n.Organization_Name AS ngoName,
                    e.Start_Date_Time AS eventDate, at.Status AS attendanceStatus,
                    h.Completion_Date AS completionDate, 'Attended' AS completionStatus,
                    h.Hours_Volunteered AS hoursVolunteered
             FROM EVENT_ATTENDANCE at
             JOIN EVENT_APPLICATIONS a ON a.Application_ID=at.Application_ID
             JOIN EVENTS e ON e.Event_ID=at.Event_ID
             JOIN NGOS n ON n.NGO_ID=e.NGO_ID
             LEFT JOIN (
                 SELECT Application_ID, Event_ID, Volunteer_ID, MAX(Completion_Date) AS Completion_Date,
                        SUM(Hours_Volunteered) AS Hours_Volunteered
                 FROM VOLUNTEER_HISTORY WHERE Completion_Status='Attended'
                 GROUP BY Application_ID, Event_ID, Volunteer_ID
             ) h ON h.Application_ID=a.Application_ID AND h.Event_ID=e.Event_ID AND h.Volunteer_ID=a.Volunteer_ID
             WHERE a.Volunteer_ID=? AND a.Status='Approved' AND a.Event_ID=e.Event_ID
               AND at.Volunteer_ID=a.Volunteer_ID${attendanceScope.sql}
             UNION ALL
             SELECT 'Completed service', e.Event_Title, n.Organization_Name, e.Start_Date_Time,
                    NULL, h.Completion_Date, h.Completion_Status, h.Hours_Volunteered
             FROM VOLUNTEER_HISTORY h
             JOIN EVENTS e ON e.Event_ID=h.Event_ID
             JOIN NGOS n ON n.NGO_ID=e.NGO_ID
             LEFT JOIN EVENT_ATTENDANCE at ON at.Application_ID=h.Application_ID
                 AND at.Event_ID=h.Event_ID AND at.Volunteer_ID=h.Volunteer_ID
             WHERE h.Volunteer_ID=? AND h.Completion_Status='Attended'
               AND at.Attendance_ID IS NULL${historyScope.sql}
             ORDER BY eventDate DESC, eventTitle ASC`,
            [volunteerId, ...attendanceScope.params, volunteerId, ...historyScope.params]
        );
        const headers = ["Record Type", "Event", "NGO", "Event Date", "Attendance", "Completion Date", "Completion Status", "Hours"];
        return sendCsv(res, "volunteer-impact-history.csv", headers, rows.map((row) => [
            row.recordType, row.eventTitle, row.ngoName, row.eventDate, row.attendanceStatus,
            row.completionDate, row.completionStatus, row.hoursVolunteered
        ]));
    } catch (error) {
        console.error("Volunteer impact CSV failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to export your volunteering report." });
    }
};

module.exports = { getNgoImpact, getVolunteerImpact, exportNgoEvents, exportVolunteerImpact, parseDateRange };
