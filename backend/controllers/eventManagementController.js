const db = require("../config/db");

const EVENT_STATUSES = { OPEN: "Open", CANCELLED: "Cancelled" };
const APPLICATION_STATUSES = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };

const parseId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const parseRequiredSkillIds = (value) => {
    if (value == null) return { ids: [] };
    if (!Array.isArray(value) || value.length > 100) return { error: "requiredSkillIds must be a list of up to 100 skill IDs." };
    const ids = [];
    const seen = new Set();
    for (const valueId of value) {
        const id = parseId(valueId);
        if (!id) return { error: "Each required skill must have a valid ID." };
        if (seen.has(id)) return { error: "A required skill can only be selected once." };
        seen.add(id);
        ids.push(id);
    }
    return { ids };
};

const saveEventSkills = async (connection, eventId, skillIds) => {
    if (skillIds.length) {
        const [skills] = await connection.query("SELECT Skill_ID FROM SKILLS WHERE Active = 'Y' AND Skill_ID IN (?)", [skillIds]);
        if (skills.length !== skillIds.length) {
            const error = new Error("One or more required skills are unavailable. Reload the skill list and try again.");
            error.statusCode = 400;
            throw error;
        }
    }
    await connection.query("DELETE FROM EVENT_SKILLS WHERE Event_ID = ?", [eventId]);
    if (skillIds.length) {
        await connection.query("INSERT INTO EVENT_SKILLS (Event_ID, Skill_ID) VALUES ?", [skillIds.map((skillId) => [eventId, skillId])]);
    }
};

const addEventSkillsToEvents = async (events) => {
    if (!events.length) return events;
    const [skills] = await db.promise().query(
        `SELECT es.Event_ID AS eventId, s.Skill_ID AS skillId, s.Skill_Name AS name
         FROM EVENT_SKILLS es JOIN SKILLS s ON s.Skill_ID = es.Skill_ID
         WHERE es.Event_ID IN (?) ORDER BY s.Skill_Name`, [events.map((event) => event.eventId)]
    );
    const byEvent = new Map(events.map((event) => [Number(event.eventId), []]));
    skills.forEach((skill) => byEvent.get(Number(skill.eventId))?.push({ skillId: Number(skill.skillId), name: skill.name }));
    return events.map((event) => ({ ...event, requiredSkills: byEvent.get(Number(event.eventId)) || [] }));
};

const requireNgo = (req, res) => {
    if (req.user.userType === "NGO") return true;
    res.status(403).json({ success: false, message: "NGO access is required." });
    return false;
};

const getNgoId = async (userId) => {
    const [rows] = await db.promise().query(
        "SELECT NGO_ID FROM NGOS WHERE User_ID = ? LIMIT 1", [userId]
    );
    return rows[0]?.NGO_ID || null;
};

const requireNgoProfile = async (userId, res) => {
    const ngoId = await getNgoId(userId);
    if (!ngoId) {
        res.status(404).json({ success: false, message: "NGO profile not found." });
        return null;
    }
    return ngoId;
};
const validateEventInput = (body) => {
    const required = ["title", "category", "location", "city", "startDateTime", "endDateTime"];
    const values = {};
    for (const field of required) {
        if (typeof body[field] !== "string" || !body[field].trim()) return { error: `${field} is required.` };
        values[field] = body[field].trim();
    }
    for (const [field, limit] of Object.entries({ title: 200, category: 50, location: 200, city: 50 })) {
        if (values[field].length > limit) return { error: `${field} must be ${limit} characters or fewer.` };
    }
    if (body.description != null && typeof body.description !== "string") return { error: "description must be text." };
    values.description = String(body.description || "").trim();
    if (values.description.length > 2000) return { error: "description must be 2000 characters or fewer." };
    const start = new Date(values.startDateTime);
    const end = new Date(values.endDateTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { error: "Enter valid event dates and times." };
    if (start <= new Date()) return { error: "The event must start in the future." };
    if (end <= start) return { error: "The end time must be after the start time." };
    const capacity = Number(body.totalCapacity);
    if (!Number.isSafeInteger(capacity) || capacity <= 0 || capacity > 2147483647) return { error: "Capacity must be a positive whole number." };
    return { values: { ...values, startDateTime: start, endDateTime: end, totalCapacity: capacity } };
};

const listNgoEvents = async (req, res) => {
    if (!requireNgo(req, res)) return;
    try {
        const ngoId = await getNgoId(req.user.userId);
        if (!ngoId) return res.status(404).json({ success: false, message: "NGO profile not found." });
        const [events] = await db.promise().query(
            `SELECT e.Event_ID AS eventId, e.Event_Title AS title, e.Description AS description,
                    e.Category AS category, e.Location AS location, e.City AS city,
                    e.Start_Date_Time AS startDateTime, e.End_Date_Time AS endDateTime,
                    e.Total_Capacity AS totalCapacity, e.Status AS status,
                    COUNT(DISTINCT CASE WHEN a.Status = 'Approved' THEN a.Volunteer_ID END) AS approvedVolunteers
             FROM EVENTS e LEFT JOIN EVENT_APPLICATIONS a ON a.Event_ID = e.Event_ID
             WHERE e.NGO_ID = ?
             GROUP BY e.Event_ID, e.Event_Title, e.Description, e.Category, e.Location, e.City,
                      e.Start_Date_Time, e.End_Date_Time, e.Total_Capacity, e.Status
             ORDER BY e.Created_Date DESC, e.Event_ID DESC`, [ngoId]
        );
        return res.json({ success: true, events: await addEventSkillsToEvents(events) });
    } catch (error) {
        console.error("NGO event list failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load your events." });
    }
};

const createEvent = async (req, res) => {
    if (!requireNgo(req, res)) return;
    const validation = validateEventInput(req.body || {});
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });
    const requiredSkills = parseRequiredSkillIds(req.body?.requiredSkillIds);
    if (requiredSkills.error) return res.status(400).json({ success: false, message: requiredSkills.error });
    let connection;
    try {
        const ngoId = await requireNgoProfile(req.user.userId, res);
        if (!ngoId) return;
        const value = validation.values;
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO EVENTS (NGO_ID, Event_Title, Description, Category, Location, City,
                                 Start_Date_Time, End_Date_Time, Total_Capacity, Status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ngoId, value.title, value.description || null, value.category, value.location,
                value.city, value.startDateTime, value.endDateTime, value.totalCapacity, EVENT_STATUSES.OPEN]
        );
        await saveEventSkills(connection, result.insertId, requiredSkills.ids);
        await connection.commit();
        return res.status(201).json({ success: true, message: "Event created.", eventId: result.insertId });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Event creation failed:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Unable to create the event." });
    } finally {
        connection?.release();
    }
};

const updateNgoEvent = async (req, res) => {
    if (!requireNgo(req, res)) return;
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, message: "A valid event ID is required." });
    const validation = validateEventInput(req.body || {});
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });
    const requiredSkills = parseRequiredSkillIds(req.body?.requiredSkillIds);
    if (requiredSkills.error) return res.status(400).json({ success: false, message: requiredSkills.error });
    let connection;
    try {
        const ngoId = await requireNgoProfile(req.user.userId, res);
        if (!ngoId) return;
        const value = validation.values;
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [result] = await connection.query(
            `UPDATE EVENTS SET Event_Title = ?, Description = ?, Category = ?, Location = ?, City = ?,
                Start_Date_Time = ?, End_Date_Time = ?, Total_Capacity = ?, Updated_Date = CURRENT_TIMESTAMP
             WHERE Event_ID = ? AND NGO_ID = ? AND Status <> ?
               AND ? >= (SELECT COUNT(DISTINCT a.Volunteer_ID) FROM EVENT_APPLICATIONS a
                        WHERE a.Event_ID = EVENTS.Event_ID AND a.Status IN ('Pending', 'Approved'))`,
            [value.title, value.description || null, value.category, value.location, value.city,
                value.startDateTime, value.endDateTime, value.totalCapacity, eventId, ngoId,
                EVENT_STATUSES.CANCELLED, value.totalCapacity]
        );
        if (!result.affectedRows) {
            const [owned] = await connection.query(
                `SELECT e.Event_ID, COUNT(DISTINCT a.Volunteer_ID) AS reserved
                 FROM EVENTS e LEFT JOIN EVENT_APPLICATIONS a ON a.Event_ID = e.Event_ID AND a.Status IN ('Pending', 'Approved')
                 WHERE e.Event_ID = ? AND e.NGO_ID = ? AND e.Status <> ?
                 GROUP BY e.Event_ID`, [eventId, ngoId, EVENT_STATUSES.CANCELLED]
            );
            if (!owned.length) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: "Event not found, not yours, or already cancelled." });
            }
            if (value.totalCapacity < Number(owned[0].reserved)) {
                await connection.rollback();
                return res.status(409).json({ success: false, message: "Capacity cannot be lower than the number of pending and approved applications." });
            }
        }
        await saveEventSkills(connection, eventId, requiredSkills.ids);
        await connection.commit();
        return res.json({ success: true, message: "Event updated." });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Event update failed:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Unable to update the event." });
    } finally {
        connection?.release();
    }
};

const cancelNgoEvent = async (req, res) => {
    if (!requireNgo(req, res)) return;
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, message: "A valid event ID is required." });
    try {
        const ngoId = await requireNgoProfile(req.user.userId, res);
        if (!ngoId) return;
        const [result] = await db.promise().query(
            "UPDATE EVENTS SET Status = ?, Updated_Date = CURRENT_TIMESTAMP WHERE Event_ID = ? AND NGO_ID = ? AND Status <> ?",
            [EVENT_STATUSES.CANCELLED, eventId, ngoId, EVENT_STATUSES.CANCELLED]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: "Event not found, not yours, or already cancelled." });
        return res.json({ success: true, message: "Event cancelled." });
    } catch (error) {
        console.error("Event cancellation failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to cancel the event." });
    }
};

const getNgoEventSkills = async (req, res) => {
    if (!requireNgo(req, res)) return;
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, message: "A valid event ID is required." });
    try {
        const ngoId = await requireNgoProfile(req.user.userId, res);
        if (!ngoId) return;
        const [events] = await db.promise().query("SELECT Event_ID FROM EVENTS WHERE Event_ID = ? AND NGO_ID = ?", [eventId, ngoId]);
        if (!events.length) return res.status(404).json({ success: false, message: "Event not found." });
        const [skills] = await db.promise().query(
            `SELECT s.Skill_ID AS skillId, s.Skill_Name AS name
             FROM EVENT_SKILLS es JOIN SKILLS s ON s.Skill_ID = es.Skill_ID
             WHERE es.Event_ID = ? ORDER BY s.Skill_Name`, [eventId]
        );
        return res.json({ success: true, requiredSkills: skills });
    } catch (error) {
        console.error("NGO event skills lookup failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load event skills." });
    }
};

const updateNgoEventSkills = async (req, res) => {
    if (!requireNgo(req, res)) return;
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, message: "A valid event ID is required." });
    const parsed = parseRequiredSkillIds(req.body?.requiredSkillIds);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    let connection;
    try {
        const ngoId = await requireNgoProfile(req.user.userId, res);
        if (!ngoId) return;
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [events] = await connection.query(
            "SELECT Event_ID FROM EVENTS WHERE Event_ID = ? AND NGO_ID = ? AND Status <> ? FOR UPDATE",
            [eventId, ngoId, EVENT_STATUSES.CANCELLED]
        );
        if (!events.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Event not found, not yours, or already cancelled." });
        }
        await saveEventSkills(connection, eventId, parsed.ids);
        await connection.commit();
        return res.json({ success: true, message: "Required skills updated." });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("NGO event skills update failed:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Unable to update event skills." });
    } finally {
        connection?.release();
    }
};

const listNgoApplications = async (req, res) => {
    if (!requireNgo(req, res)) return;
    try {
        const ngoId = await getNgoId(req.user.userId);
        if (!ngoId) return res.status(404).json({ success: false, message: "NGO profile not found." });
        const [applications] = await db.promise().query(
            `SELECT a.Application_ID AS applicationId, a.Event_ID AS eventId,
                    a.Volunteer_ID AS volunteerId,
                    a.Status AS status, a.Application_Date AS applicationDate,
                    a.Rejection_Reason AS rejectionReason, a.Notes AS notes, v.Full_Name AS volunteerName,
                    v.City AS volunteerCity, v.Bio AS volunteerBio,
                    CASE WHEN a.Status = 'Approved' THEN v.Phone_Number ELSE NULL END AS volunteerPhone,
                    e.Event_Title AS eventTitle,
                    e.Start_Date_Time AS eventStartDateTime, e.End_Date_Time AS eventEndDateTime,
                    (SELECT h.Hours_Volunteered FROM VOLUNTEER_HISTORY h WHERE h.Application_ID = a.Application_ID ORDER BY h.History_ID LIMIT 1) AS hoursVolunteered,
                    (SELECT at.Status FROM EVENT_ATTENDANCE at WHERE at.Application_ID = a.Application_ID LIMIT 1) AS attendanceStatus
             FROM EVENT_APPLICATIONS a JOIN EVENTS e ON e.Event_ID = a.Event_ID
             JOIN VOLUNTEERS v ON v.Volunteer_ID = a.Volunteer_ID
             WHERE e.NGO_ID = ? ORDER BY a.Application_Date DESC, a.Application_ID DESC`, [ngoId]
        );
        if (!applications.length) return res.json({ success: true, applications });
        const volunteerIds = [...new Set(applications.map((application) => Number(application.volunteerId)))];
        const eventIds = [...new Set(applications.map((application) => Number(application.eventId)))];
        const [[volunteerSkills], [requiredSkills]] = await Promise.all([
            db.promise().query(
                `SELECT vs.Volunteer_ID AS volunteerId, s.Skill_ID AS skillId, s.Skill_Name AS name,
                        vs.Proficiency_Level AS proficiencyLevel
                 FROM VOLUNTEER_SKILLS vs JOIN SKILLS s ON s.Skill_ID = vs.Skill_ID
                 WHERE vs.Volunteer_ID IN (?) ORDER BY s.Skill_Name`, [volunteerIds]
            ),
            db.promise().query(
                `SELECT es.Event_ID AS eventId, s.Skill_ID AS skillId, s.Skill_Name AS name
                 FROM EVENT_SKILLS es JOIN SKILLS s ON s.Skill_ID = es.Skill_ID
                 WHERE es.Event_ID IN (?) ORDER BY s.Skill_Name`, [eventIds]
            )
        ]);
        const byVolunteer = new Map(volunteerIds.map((id) => [id, []]));
        const byEvent = new Map(eventIds.map((id) => [id, []]));
        volunteerSkills.forEach((skill) => byVolunteer.get(Number(skill.volunteerId))?.push({
            skillId: Number(skill.skillId), name: skill.name, proficiencyLevel: skill.proficiencyLevel
        }));
        requiredSkills.forEach((skill) => byEvent.get(Number(skill.eventId))?.push({ skillId: Number(skill.skillId), name: skill.name }));
        for (const application of applications) {
            const ownedSkills = byVolunteer.get(Number(application.volunteerId)) || [];
            const required = byEvent.get(Number(application.eventId)) || [];
            const ownedIds = new Set(ownedSkills.map((skill) => skill.skillId));
            const matchedSkills = required.filter((skill) => ownedIds.has(skill.skillId));
            const missingSkills = required.filter((skill) => !ownedIds.has(skill.skillId));
            application.volunteerSkills = ownedSkills;
            application.requiredSkills = required;
            application.skillMatch = {
                percentage: required.length ? Math.round(matchedSkills.length * 100 / required.length) : null,
                matchedSkills,
                missingSkills,
                message: required.length ? null : "No specific skills required"
            };
        }
        return res.json({ success: true, applications });
    } catch (error) {
        console.error("NGO application list failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load applications." });
    }
};

const reviewNgoApplication = async (req, res) => {
    if (!requireNgo(req, res)) return;
    const applicationId = parseId(req.params.applicationId);
    const { status, rejectionReason = "" } = req.body || {};
    if (!applicationId) return res.status(400).json({ success: false, message: "A valid application ID is required." });
    if (![APPLICATION_STATUSES.APPROVED, APPLICATION_STATUSES.REJECTED].includes(status)) return res.status(400).json({ success: false, message: "Status must be Approved or Rejected." });
    if (typeof rejectionReason !== "string" || rejectionReason.length > 500) return res.status(400).json({ success: false, message: "Rejection reason must be 500 characters or fewer." });
    let connection;
    try {
        const ngoId = await requireNgoProfile(req.user.userId, res);
        if (!ngoId) return;
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query(
            `SELECT a.Application_ID, a.Status, a.Volunteer_ID, e.NGO_ID, u.User_ID AS volunteerUserId
             FROM EVENT_APPLICATIONS a JOIN EVENTS e ON e.Event_ID = a.Event_ID
             JOIN VOLUNTEERS v ON v.Volunteer_ID = a.Volunteer_ID
             JOIN USERS u ON u.User_ID = v.User_ID
             WHERE a.Application_ID = ? FOR UPDATE`, [applicationId]
        );
        if (!rows.length || rows[0].NGO_ID !== ngoId) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Application not found." });
        }
        if (rows[0].Status !== APPLICATION_STATUSES.PENDING) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: `This application has already been ${rows[0].Status.toLowerCase()}.` });
        }
        await connection.query(
            `UPDATE EVENT_APPLICATIONS SET Status = ?, Reviewed_By_User_ID = ?,
                Approval_Date = CASE WHEN ? = 'Approved' THEN CURRENT_DATE ELSE NULL END,
                Rejection_Reason = CASE WHEN ? = 'Rejected' THEN ? ELSE NULL END
             WHERE Application_ID = ?`,
            [status, req.user.userId, status, status, rejectionReason.trim() || null, applicationId]
        );
        await connection.query(
            `INSERT INTO NOTIFICATIONS (Recipient_User_ID, Notification_Type, Message, Related_Entity_Type, Related_Entity_ID)
             VALUES (?, 'ApplicationStatus', ?, 'Application', ?)`,
            [rows[0].volunteerUserId, `Your application was ${status.toLowerCase()}.`, applicationId]
        );
        await connection.commit();
        return res.json({ success: true, message: `Application ${status.toLowerCase()}.`, status });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Application review failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to review the application." });
    } finally {
        connection?.release();
    }
};

const completeNgoApplication = async (req, res) => {
    if (!requireNgo(req, res)) return;
    const applicationId = parseId(req.params.applicationId);
    const outcome = req.body?.outcome || "Completed";
    const hours = Number(req.body?.hoursVolunteered);
    const feedback = req.body?.feedback == null ? "" : req.body.feedback;
    if (!applicationId) return res.status(400).json({ success: false, message: "A valid application ID is required." });
    if (!["Completed", "Absent"].includes(outcome)) return res.status(400).json({ success: false, message: "Outcome must be Completed or Absent." });
    if (outcome === "Completed" && (!Number.isFinite(hours) || hours <= 0 || hours > 24 || Math.round(hours * 100) !== hours * 100)) return res.status(400).json({ success: false, message: "Completed hours must be greater than zero and at most 24, with at most two decimal places." });
    if (typeof feedback !== "string" || feedback.length > 1000) {
        return res.status(400).json({ success: false, message: "Feedback must be 1000 characters or fewer." });
    }
    let connection;
    try {
        const ngoId = await requireNgoProfile(req.user.userId, res);
        if (!ngoId) return;
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query(
            `SELECT a.Application_ID, a.Event_ID, a.Volunteer_ID, a.Status, e.NGO_ID, e.Event_Title, e.End_Date_Time, v.User_ID AS volunteerUserId
             FROM EVENT_APPLICATIONS a JOIN EVENTS e ON e.Event_ID = a.Event_ID
             JOIN VOLUNTEERS v ON v.Volunteer_ID = a.Volunteer_ID
             WHERE a.Application_ID = ? FOR UPDATE`, [applicationId]
        );
        if (!rows.length || rows[0].NGO_ID !== ngoId) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Application not found." });
        }
        const application = rows[0];
        if (application.Status !== "Approved") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Only approved applications can be marked complete." });
        }
        if (new Date(application.End_Date_Time) > new Date()) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "The event must have ended before recording volunteer hours." });
        }
        const [attendance] = await connection.query("SELECT Status FROM EVENT_ATTENDANCE WHERE Application_ID = ? FOR UPDATE", [applicationId]);
        if (attendance.length && ((outcome === "Completed" && attendance[0].Status !== "Present") || (outcome === "Absent" && attendance[0].Status !== "Absent"))) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: `Record attendance as ${outcome === "Completed" ? "Present" : "Absent"} before saving this outcome.` });
        }
        if (!attendance.length) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Record attendance before saving the service outcome." });
        }
        const [history] = await connection.query(
            "SELECT History_ID, Hours_Volunteered, Completion_Status, Feedback FROM VOLUNTEER_HISTORY WHERE Application_ID = ? ORDER BY History_ID LIMIT 1 FOR UPDATE", [applicationId]
        );
        const wasSame = outcome === "Completed"
            ? Boolean(history.length && history[0].Completion_Status === "Attended" && Number(history[0].Hours_Volunteered) === hours && (history[0].Feedback || "") === feedback.trim())
            : Boolean(!history.length && attendance[0].Status === "Absent");
        if (outcome === "Absent") {
            if (history.length) await connection.query("DELETE FROM VOLUNTEER_HISTORY WHERE History_ID = ?", [history[0].History_ID]);
        } else if (history.length) {
            await connection.query(
                `UPDATE VOLUNTEER_HISTORY SET Hours_Volunteered = ?, Completion_Status = ?,
                    Completion_Date = DATE(?), Feedback = ?, Hours_Logged_Date = CURRENT_DATE WHERE History_ID = ?`,
                [outcome === "Completed" ? hours : 0, outcome === "Completed" ? "Attended" : "No-show", application.End_Date_Time, feedback.trim() || null, history[0].History_ID]
            );
        } else if (outcome === "Completed") {
            await connection.query(
                `INSERT INTO VOLUNTEER_HISTORY (Volunteer_ID, Event_ID, Application_ID, Hours_Volunteered,
                    Completion_Status, Completion_Date, Feedback)
                 SELECT a.Volunteer_ID, a.Event_ID, a.Application_ID, ?, ?, DATE(e.End_Date_Time), ?
                 FROM EVENT_APPLICATIONS a JOIN EVENTS e ON e.Event_ID = a.Event_ID WHERE a.Application_ID = ?`,
                [outcome === "Completed" ? hours : 0, outcome === "Completed" ? "Attended" : "No-show", feedback.trim() || null, applicationId]
            );
        }
        if (!wasSame) await connection.query(
            `INSERT INTO NOTIFICATIONS (Recipient_User_ID, Notification_Type, Message, Related_Entity_Type, Related_Entity_ID)
             VALUES (?, 'Event', ?, 'Event', ?)` ,
            [application.volunteerUserId, outcome === "Completed" ? `Your service at ${application.Event_Title} was marked completed. ${hours} hours were recorded.` : `Your attendance at ${application.Event_Title} was marked absent.`, application.Event_ID]
        );
        await connection.commit();
        return res.json({ success: true, message: outcome === "Completed" ? "Volunteer hours and completion were recorded." : "Volunteer absence was recorded." });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Volunteer completion failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to record volunteer completion." });
    } finally {
        connection?.release();
    }
};

module.exports = { listNgoEvents, createEvent, updateNgoEvent, cancelNgoEvent, getNgoEventSkills, updateNgoEventSkills, listNgoApplications, reviewNgoApplication, completeNgoApplication };
