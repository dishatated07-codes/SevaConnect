const db = require("../config/db");

const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const AVAILABILITY_VALUES = ["Weekdays", "Weekends", "Both"];
const parseId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const getVolunteerId = async (userId, executor = db.promise()) => {
    const [rows] = await executor.query(
        "SELECT Volunteer_ID FROM VOLUNTEERS WHERE User_ID = ? LIMIT 1", [userId]
    );
    return rows[0]?.Volunteer_ID || null;
};

const requireVolunteer = async (req, res) => {
    if (req.user.userType !== "Volunteer") {
        res.status(403).json({ success: false, message: "Volunteer access is required." });
        return null;
    }
    const volunteerId = await getVolunteerId(req.user.userId);
    if (!volunteerId) {
        res.status(404).json({ success: false, message: "Volunteer profile not found." });
        return null;
    }
    return volunteerId;
};

const getMyProfile = async (req, res) => {
    try {
        const volunteerId = await requireVolunteer(req, res);
        if (!volunteerId) return;
        const [rows] = await db.promise().query(
            `SELECT v.Full_Name AS fullName, u.Email AS email, v.Phone_Number AS phoneNumber,
                    v.City AS city, v.Availability AS availability, v.Bio AS bio,
                    v.Profile_Photo_URL AS profilePhotoUrl
             FROM VOLUNTEERS v JOIN USERS u ON u.User_ID = v.User_ID
             WHERE v.Volunteer_ID = ? AND u.User_ID = ? LIMIT 1`,
            [volunteerId, req.user.userId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: "Volunteer profile not found." });
        const [skills] = await db.promise().query(
            `SELECT s.Skill_ID AS skillId, s.Skill_Name AS name, s.Active AS active,
                    vs.Proficiency_Level AS proficiencyLevel
             FROM VOLUNTEER_SKILLS vs JOIN SKILLS s ON s.Skill_ID = vs.Skill_ID
             WHERE vs.Volunteer_ID = ? ORDER BY s.Skill_Name`, [volunteerId]
        );
        return res.json({ success: true, profile: { ...rows[0], skills } });
    } catch (error) {
        console.error("Volunteer profile lookup failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load your profile." });
    }
};

const updateMyProfile = async (req, res) => {
    const body = req.body || {};
    const allowed = ["fullName", "phoneNumber", "city", "availability", "bio"];
    if (Object.keys(body).some((key) => !allowed.includes(key))) {
        return res.status(400).json({ success: false, message: "Only name, phone, city, availability, and bio can be updated here." });
    }
    const fields = [
        ["fullName", 100, "Full name", true], ["phoneNumber", 20, "Phone number", true],
        ["city", 50, "City", true], ["availability", 20, "Availability", true], ["bio", 1000, "Bio", false]
    ];
    for (const [key, max, label, required] of fields) {
        const value = body[key];
        if (required && (typeof value !== "string" || !value.trim())) {
            return res.status(400).json({ success: false, message: `${label} is required.` });
        }
        if (value != null && (typeof value !== "string" || value.trim().length > max)) {
            return res.status(400).json({ success: false, message: `${label} must be ${max} characters or fewer.` });
        }
    }
    if (!AVAILABILITY_VALUES.includes(body.availability)) {
        return res.status(400).json({ success: false, message: `Availability must be one of: ${AVAILABILITY_VALUES.join(", ")}.` });
    }
    const phone = body.phoneNumber.trim();
    const digits = phone.replace(/\D/g, "");
    if (!/^\+?[0-9][0-9\s().-]*$/.test(phone) || digits.length < 7 || digits.length > 15) {
        return res.status(400).json({ success: false, message: "Enter a valid phone number with 7 to 15 digits." });
    }
    try {
        const volunteerId = await requireVolunteer(req, res);
        if (!volunteerId) return;
        await db.promise().query(
            `UPDATE VOLUNTEERS SET Full_Name = ?, Phone_Number = ?, City = ?, Availability = ?, Bio = ?
             WHERE Volunteer_ID = ? AND User_ID = ?`,
            [body.fullName.trim(), phone, body.city.trim(), body.availability.trim(),
                typeof body.bio === "string" && body.bio.trim() ? body.bio.trim() : null,
                volunteerId, req.user.userId]
        );
        return getMyProfile(req, res);
    } catch (error) {
        console.error("Volunteer profile update failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to save your profile." });
    }
};

const listSkills = async (req, res) => {
    try {
        const [skills] = await db.promise().query(
            "SELECT Skill_ID AS skillId, Skill_Name AS name, Description AS description FROM SKILLS WHERE Active = 'Y' ORDER BY Skill_Name"
        );
        return res.json({ success: true, skills, proficiencyLevels: PROFICIENCY_LEVELS });
    } catch (error) {
        console.error("Skill catalogue lookup failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load available skills." });
    }
};

const getMySkills = async (req, res) => {
    try {
        const volunteerId = await requireVolunteer(req, res);
        if (!volunteerId) return;
        const [availableSkills] = await db.promise().query(
            "SELECT Skill_ID AS skillId, Skill_Name AS name, Description AS description FROM SKILLS WHERE Active = 'Y' ORDER BY Skill_Name"
        );
        const [mySkills] = await db.promise().query(
            `SELECT s.Skill_ID AS skillId, s.Skill_Name AS name, s.Active AS active,
                    vs.Proficiency_Level AS proficiencyLevel
             FROM VOLUNTEER_SKILLS vs JOIN SKILLS s ON s.Skill_ID = vs.Skill_ID
             WHERE vs.Volunteer_ID = ? ORDER BY s.Skill_Name`, [volunteerId]
        );
        return res.json({ success: true, availableSkills, skills: mySkills, proficiencyLevels: PROFICIENCY_LEVELS });
    } catch (error) {
        console.error("Volunteer skills lookup failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load your skills." });
    }
};

const updateMySkills = async (req, res) => {
    const assignments = req.body?.skills;
    if (!Array.isArray(assignments) || assignments.length > 100) {
        return res.status(400).json({ success: false, message: "Skills must be provided as a list of up to 100 assignments." });
    }
    const normalized = [];
    const seen = new Set();
    for (const assignment of assignments) {
        const skillId = parseId(assignment?.skillId);
        const proficiencyLevel = assignment?.proficiencyLevel;
        if (!skillId) return res.status(400).json({ success: false, message: "Each skill must have a valid skill ID." });
        if (seen.has(skillId)) return res.status(400).json({ success: false, message: "A skill can only be selected once." });
        if (!PROFICIENCY_LEVELS.includes(proficiencyLevel)) {
            return res.status(400).json({ success: false, message: `Proficiency must be one of: ${PROFICIENCY_LEVELS.join(", ")}.` });
        }
        seen.add(skillId);
        normalized.push({ skillId, proficiencyLevel });
    }
    let connection;
    try {
        const volunteerId = await requireVolunteer(req, res);
        if (!volunteerId) return;
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [available] = await connection.query(
            `SELECT s.Skill_ID, s.Active,
                    EXISTS(SELECT 1 FROM VOLUNTEER_SKILLS vs WHERE vs.Volunteer_ID = ? AND vs.Skill_ID = s.Skill_ID) AS alreadyAssigned
             FROM SKILLS s WHERE s.Skill_ID IN (?) FOR UPDATE`,
            [volunteerId, normalized.map((item) => item.skillId).length ? normalized.map((item) => item.skillId) : [0]]
        );
        if (available.length !== normalized.length || available.some((skill) => skill.Active !== "Y" && !skill.alreadyAssigned)) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "One or more selected skills are unavailable. Reload the skill list and try again." });
        }
        await connection.query("DELETE FROM VOLUNTEER_SKILLS WHERE Volunteer_ID = ?", [volunteerId]);
        if (normalized.length) {
            const values = normalized.map((item) => [volunteerId, item.skillId, item.proficiencyLevel]);
            await connection.query(
                "INSERT INTO VOLUNTEER_SKILLS (Volunteer_ID, Skill_ID, Proficiency_Level) VALUES ?", [values]
            );
        }
        await connection.commit();
        const [skills] = await db.promise().query(
            `SELECT s.Skill_ID AS skillId, s.Skill_Name AS name, s.Active AS active,
                    vs.Proficiency_Level AS proficiencyLevel
             FROM VOLUNTEER_SKILLS vs JOIN SKILLS s ON s.Skill_ID = vs.Skill_ID
             WHERE vs.Volunteer_ID = ? ORDER BY s.Skill_Name`, [volunteerId]
        );
        return res.json({ success: true, message: "Your skills have been saved.", skills });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Volunteer skills update failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to save your skills." });
    } finally {
        connection?.release();
    }
};

module.exports = { getMyProfile, updateMyProfile, listSkills, getMySkills, updateMySkills, PROFICIENCY_LEVELS };
