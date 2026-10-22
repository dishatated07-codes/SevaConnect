const db = require("../config/db");

const attachRequiredSkills = async (events, volunteerId, volunteerAccount = false) => {
    if (!events.length) return events;
    const eventIds = events.map((event) => event.eventId);
    const [required] = await db.promise().query(
        `SELECT es.Event_ID AS eventId, s.Skill_ID AS skillId, s.Skill_Name AS name
         FROM EVENT_SKILLS es JOIN SKILLS s ON s.Skill_ID = es.Skill_ID
         WHERE es.Event_ID IN (?) ORDER BY s.Skill_Name`, [eventIds]
    );
    const requiredByEvent = new Map(events.map((event) => [Number(event.eventId), []]));
    required.forEach((skill) => requiredByEvent.get(Number(skill.eventId))?.push({ skillId: Number(skill.skillId), name: skill.name }));
    let ownedIds = new Set();
    if (volunteerId) {
        const [owned] = await db.promise().query(
            "SELECT Skill_ID AS skillId FROM VOLUNTEER_SKILLS WHERE Volunteer_ID = ?", [volunteerId]
        );
        ownedIds = new Set(owned.map((skill) => Number(skill.skillId)));
    }
    return events.map((event) => {
        const requiredSkills = requiredByEvent.get(Number(event.eventId)) || [];
        const matchedSkills = requiredSkills.filter((skill) => ownedIds.has(skill.skillId));
        const missingSkills = requiredSkills.filter((skill) => !ownedIds.has(skill.skillId));
        return {
            ...event,
            requiredSkills,
            ...(volunteerAccount ? {
                skillMatch: {
                    percentage: !requiredSkills.length || !volunteerId ? null : Math.round(matchedSkills.length * 100 / requiredSkills.length),
                    matchedSkills,
                    missingSkills,
                    message: !volunteerId && requiredSkills.length
                        ? "Complete your volunteer profile to see skill matches"
                        : (requiredSkills.length ? null : "No specific skills required")
                }
            } : {})
        };
    });
};

const isValidDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const listOpenEvents = async (req, res) => {
    const query = req.query || {};
    const search = typeof query.search === "string" ? query.search.trim().replace(/\s+/g, " ") : "";
    const category = typeof query.category === "string" ? query.category.trim() : "";
    const city = typeof query.city === "string" ? query.city.trim() : "";
    const startDate = typeof query.startDate === "string" ? query.startDate.trim() : "";
    const endDate = typeof query.endDate === "string" ? query.endDate.trim() : "";
    const availability = query.availability == null || query.availability === "" ? "all" : query.availability;
    const sort = query.sort == null || query.sort === "" ? "soonest" : query.sort;
    const notApplied = query.notApplied === "true";

    for (const key of ["search", "category", "city", "startDate", "endDate", "availability", "sort", "notApplied"]) {
        if (query[key] != null && typeof query[key] !== "string") {
            return res.status(400).json({ success: false, message: `${key} must be a single text value.` });
        }
    }
    if (search.length > 120 || category.length > 50 || city.length > 50) {
        return res.status(400).json({ success: false, message: "Search, category, and city filters exceed their allowed length." });
    }
    if ((startDate && !isValidDate(startDate)) || (endDate && !isValidDate(endDate))) {
        return res.status(400).json({ success: false, message: "Dates must use a valid YYYY-MM-DD value." });
    }
    if (startDate && endDate && startDate > endDate) {
        return res.status(400).json({ success: false, message: "The end date must be on or after the start date." });
    }
    if (!["all", "available"].includes(availability)) {
        return res.status(400).json({ success: false, message: "Availability must be all or available." });
    }
    const orderBy = {
        soonest: "e.Start_Date_Time ASC, e.Event_ID ASC",
        latest: "e.Start_Date_Time DESC, e.Event_ID DESC",
        title: "LOWER(e.Event_Title) ASC, e.Event_ID ASC"
    }[sort];
    if (!orderBy) return res.status(400).json({ success: false, message: "Sort must be soonest, latest, or title." });
    if (query.notApplied != null && !["true", "false"].includes(query.notApplied)) {
        return res.status(400).json({ success: false, message: "notApplied must be true or false." });
    }
    if (notApplied && !req.user) {
        return res.status(401).json({ success: false, message: "Sign in as a volunteer to filter events you have not applied to." });
    }
    if (notApplied && req.user.userType !== "Volunteer") {
        return res.status(403).json({ success: false, message: "This filter is available to volunteers only." });
    }

    const limitValue = query.limit == null ? 20 : Number(query.limit);
    const offsetValue = query.offset == null ? 0 : Number(query.offset);
    if (!Number.isSafeInteger(limitValue) || limitValue < 1 || limitValue > 100 ||
        !Number.isSafeInteger(offsetValue) || offsetValue < 0 || offsetValue > 100000) {
        return res.status(400).json({ success: false, message: "Limit must be 1-100 and offset must be 0-100000." });
    }

    try {
        let volunteerId = null;
        if (req.user?.userType === "Volunteer") {
            const [volunteers] = await db.promise().query(
                "SELECT Volunteer_ID FROM VOLUNTEERS WHERE User_ID = ? LIMIT 1", [req.user.userId]
            );
            volunteerId = volunteers[0]?.Volunteer_ID || null;
            if (notApplied && !volunteerId) {
                return res.status(403).json({ success: false, message: "A volunteer profile is required for this filter." });
            }
        }

        const where = [
            "e.Status IN ('Open', 'Upcoming')",
            "e.Start_Date_Time > CURRENT_TIMESTAMP",
            "e.End_Date_Time > CURRENT_TIMESTAMP"
        ];
        const params = [];
        if (search) {
            const escaped = search.replace(/[!%_]/g, "!$&");
            const pattern = `%${escaped}%`;
            where.push(`(LOWER(COALESCE(e.Event_Title, '')) LIKE LOWER(?) ESCAPE '!' OR
                         LOWER(COALESCE(e.Description, '')) LIKE LOWER(?) ESCAPE '!' OR
                         LOWER(COALESCE(e.Category, '')) LIKE LOWER(?) ESCAPE '!' OR
                         LOWER(COALESCE(e.City, '')) LIKE LOWER(?) ESCAPE '!' OR
                         LOWER(COALESCE(e.Location, '')) LIKE LOWER(?) ESCAPE '!')`);
            params.push(pattern, pattern, pattern, pattern, pattern);
        }
        if (category) { where.push("LOWER(e.Category) = LOWER(?)"); params.push(category); }
        if (city) { where.push("LOWER(e.City) = LOWER(?)"); params.push(city); }
        if (startDate) { where.push("e.Start_Date_Time >= ?"); params.push(`${startDate} 00:00:00`); }
        if (endDate) { where.push("e.Start_Date_Time < DATE_ADD(?, INTERVAL 1 DAY)"); params.push(`${endDate} 00:00:00`); }

        const joins = ["JOIN NGOS n ON n.NGO_ID = e.NGO_ID", "LEFT JOIN EVENT_APPLICATIONS a ON a.Event_ID = e.Event_ID"];
        let applicationStatusSelect = "NULL AS applicationStatus";
        if (volunteerId) {
            joins.push("LEFT JOIN EVENT_APPLICATIONS viewerApp ON viewerApp.Event_ID = e.Event_ID AND viewerApp.Volunteer_ID = ?");
            params.unshift(volunteerId);
            applicationStatusSelect = "MAX(viewerApp.Status) AS applicationStatus";
            if (notApplied) where.push("viewerApp.Application_ID IS NULL");
        }
        const having = availability === "available" ? "HAVING slotsRemaining > 0" : "";
        const [rows] = await db.promise().query(
            `SELECT e.Event_ID AS eventId, e.Event_Title AS title, e.Description AS description,
                    e.Category AS category, e.Location AS location, e.City AS city,
                    e.Start_Date_Time AS startDateTime, e.End_Date_Time AS endDateTime,
                    e.Total_Capacity AS totalCapacity, e.Status AS status,
                    n.Organization_Name AS ngoName,
                    COUNT(DISTINCT CASE WHEN a.Status IN ('Pending', 'Approved') THEN a.Volunteer_ID END) AS reservedPlaces,
                    COUNT(DISTINCT CASE WHEN a.Status = 'Approved' THEN a.Volunteer_ID END) AS approvedVolunteers,
                    GREATEST(e.Total_Capacity - COUNT(DISTINCT CASE WHEN a.Status IN ('Pending', 'Approved') THEN a.Volunteer_ID END), 0) AS slotsRemaining,
                    ${applicationStatusSelect}
             FROM EVENTS e ${joins.join(" ")}
             WHERE ${where.join(" AND ")}
             GROUP BY e.Event_ID, e.Event_Title, e.Description, e.Category, e.Location, e.City,
                      e.Start_Date_Time, e.End_Date_Time, e.Total_Capacity, e.Status, n.Organization_Name
             ${having}
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`, [...params, limitValue + 1, offsetValue]
        );
        const hasMore = rows.length > limitValue;
        let events = hasMore ? rows.slice(0, limitValue) : rows;
        events = await attachRequiredSkills(events, volunteerId, req.user?.userType === "Volunteer");
        const [categoryResult, cityResult] = await Promise.all([
            db.promise().query(
                "SELECT DISTINCT Category AS value FROM EVENTS WHERE Status IN ('Open','Upcoming') AND Start_Date_Time > CURRENT_TIMESTAMP AND End_Date_Time > CURRENT_TIMESTAMP AND Category IS NOT NULL AND TRIM(Category) <> '' ORDER BY Category"
            ),
            db.promise().query(
                "SELECT DISTINCT City AS value FROM EVENTS WHERE Status IN ('Open','Upcoming') AND Start_Date_Time > CURRENT_TIMESTAMP AND End_Date_Time > CURRENT_TIMESTAMP AND City IS NOT NULL AND TRIM(City) <> '' ORDER BY City"
            )
        ]);
        return res.status(200).json({
            success: true,
            events,
            filters: { categories: categoryResult[0].map((row) => row.value), cities: cityResult[0].map((row) => row.value) },
            pagination: { limit: limitValue, offset: offsetValue, hasMore, nextOffset: hasMore ? offsetValue + limitValue : null }
        });
    } catch (error) {
        console.error("Event listing failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load events right now." });
    }
};
const applyToEvent = async (req, res) => {
    if (req.user.userType !== "Volunteer") {
        return res.status(403).json({
            success: false,
            message: "Only volunteers can apply to events."
        });
    }

    const eventId = Number(req.params.eventId);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) {
        return res.status(400).json({
            success: false,
            message: "A valid event ID is required."
        });
    }

    const notes = req.body?.notes == null ? "" : req.body.notes;
    if (typeof notes !== "string" || notes.length > 500) {
        return res.status(400).json({ success: false, message: "Application notes must be 500 characters or fewer." });
    }
    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [volunteers] = await connection.query(
            "SELECT Volunteer_ID FROM VOLUNTEERS WHERE User_ID = ? LIMIT 1", [req.user.userId]
        );
        if (!volunteers.length) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: "A volunteer profile is required to apply." });
        }
        const volunteerId = volunteers[0].Volunteer_ID;
        const [events] = await connection.query(
            "SELECT Event_ID, NGO_ID, Total_Capacity FROM EVENTS WHERE Event_ID = ? AND Status IN ('Open','Upcoming') AND Start_Date_Time > CURRENT_TIMESTAMP AND End_Date_Time > CURRENT_TIMESTAMP FOR UPDATE",
            [eventId]
        );
        if (!events.length) {
            await connection.rollback();
            return res.status(409).json({ success: false, code: "EVENT_NOT_OPEN", message: "This event is no longer accepting applications." });
        }
        const [[capacity]] = await connection.query(
            "SELECT COUNT(DISTINCT Volunteer_ID) AS reserved FROM EVENT_APPLICATIONS WHERE Event_ID = ? AND Status IN ('Pending','Approved')",
            [eventId]
        );
        if (Number(capacity.reserved) >= Number(events[0].Total_Capacity)) {
            await connection.rollback();
            return res.status(409).json({ success: false, code: "EVENT_FULL", message: "This event has reached its volunteer capacity." });
        }
        const [result] = await connection.query(
            "INSERT INTO EVENT_APPLICATIONS (Event_ID, Volunteer_ID, Notes) VALUES (?, ?, ?)",
            [eventId, volunteerId, notes.trim() || null]
        );
        const [[ngoUser]] = await connection.query("SELECT User_ID FROM NGOS WHERE NGO_ID = ?", [events[0].NGO_ID]);
        if (ngoUser) await connection.query(
            `INSERT INTO NOTIFICATIONS (Recipient_User_ID, Notification_Type, Message, Related_Entity_Type, Related_Entity_ID)
             VALUES (?, 'NewApplication', 'A volunteer applied to one of your events.', 'Application', ?)`,
            [ngoUser.User_ID, result.insertId]
        );
        await connection.commit();
        return res.status(201).json({ success: true, message: "Your application was submitted.", application: { applicationId: result.insertId, eventId, status: "Pending" } });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                code: "DUPLICATE_APPLICATION",
                message: "You have already applied to this event."
            });
        }

        console.error("Event application failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to submit your application right now."
        });
    } finally {
        connection?.release();
    }
};

module.exports = {
    listOpenEvents,
    applyToEvent
};
