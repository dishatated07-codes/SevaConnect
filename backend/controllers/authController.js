const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const loginUser = async (req, res) => {
    const { email, password, selectedRole } = req.body || {};
    if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
        return res.status(400).json({ success: false, message: "Please enter email and password." });
    }
    const allowedRoles = ["Volunteer", "NGO"];
    if (selectedRole && !allowedRoles.includes(selectedRole)) {
        return res.status(400).json({ success: false, message: "Choose Volunteer or NGO." });
    }
    try {
        const [users] = await db.promise().query(
            `SELECT u.User_ID, u.Email, u.Password_Hash, u.User_Type, u.Account_Status,
                    CASE WHEN u.User_Type = 'Volunteer' THEN v.Full_Name
                         WHEN u.User_Type = 'NGO' THEN n.Organization_Name
                         ELSE u.Email END AS Display_Name
             FROM USERS u
             LEFT JOIN VOLUNTEERS v ON v.User_ID = u.User_ID
             LEFT JOIN NGOS n ON n.User_ID = u.User_ID
             WHERE u.Email = ? LIMIT 1`, [email.trim()]
        );
        if (!users.length) return res.status(401).json({ success: false, message: "Invalid email or password." });
        const user = users[0];
        if (!allowedRoles.includes(user.User_Type)) {
            return res.status(403).json({ success: false, message: "This account type cannot sign in through the volunteer or NGO portal." });
        }
        if (selectedRole && selectedRole !== user.User_Type) {
            return res.status(403).json({ success: false, code: "ROLE_MISMATCH", message: `This account is registered as ${user.User_Type}. Select ${user.User_Type} to sign in.` });
        }
        if (user.Account_Status !== "Active") {
            return res.status(403).json({ success: false, message: "Your account is not active." });
        }
        if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
        const passwordMatch = await bcrypt.compare(password, user.Password_Hash);
        if (!passwordMatch) return res.status(401).json({ success: false, message: "Invalid email or password." });
        const token = jwt.sign({ userId: user.User_ID, email: user.Email, userType: user.User_Type }, process.env.JWT_SECRET, { expiresIn: "2h" });
        await db.promise().query("UPDATE USERS SET Last_Login = CURRENT_TIMESTAMP WHERE User_ID = ?", [user.User_ID]);
        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            user: { userId: user.User_ID, email: user.Email, userType: user.User_Type, displayName: user.Display_Name }
        });
    } catch (error) {
        console.error("Login error:", error.message);
        return res.status(500).json({ success: false, message: "Login failed. Please try again." });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const [users] = await db.promise().query(
            `SELECT u.User_ID AS userId, u.Email AS email, u.User_Type AS userType,
                    CASE WHEN u.User_Type = 'Volunteer' THEN v.Full_Name
                         WHEN u.User_Type = 'NGO' THEN n.Organization_Name
                         ELSE u.Email END AS displayName,
                    v.City AS volunteerCity, v.Availability AS volunteerAvailability,
                    v.Phone_Number AS volunteerPhone, n.City AS ngoCity
             FROM USERS u
             LEFT JOIN VOLUNTEERS v ON v.User_ID = u.User_ID
             LEFT JOIN NGOS n ON n.User_ID = u.User_ID
             WHERE u.User_ID = ? AND u.Account_Status = 'Active' LIMIT 1`, [req.user.userId]
        );
        if (!users.length) return res.status(401).json({ success: false, message: "User account is unavailable. Please log in again." });
        const profile = users[0];
        if (profile.userType === "Volunteer") {
            const [skills] = await db.promise().query(
                `SELECT s.Skill_Name AS name FROM VOLUNTEER_SKILLS vs
                 JOIN VOLUNTEERS v ON v.Volunteer_ID = vs.Volunteer_ID
                 JOIN SKILLS s ON s.Skill_ID = vs.Skill_ID
                 WHERE v.User_ID = ? ORDER BY s.Skill_Name`, [req.user.userId]
            );
            profile.skills = skills.map((skill) => skill.name);
        }
        return res.status(200).json({ success: true, user: profile });
    } catch (error) {
        console.error("Current-user lookup failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load your profile right now." });
    }
};

module.exports = { loginUser, getCurrentUser };
