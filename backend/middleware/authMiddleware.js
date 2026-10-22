const jwt = require("jsonwebtoken");
const db = require("../config/db");

const authenticateToken = async (req, res, next) => {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ success: false, message: "Please log in to continue." });

    let tokenUser;
    try {
        tokenUser = jwt.verify(match[1].trim(), process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ success: false, message: "Your session is invalid or expired. Please log in again." });
    }
    if (!Number.isSafeInteger(Number(tokenUser.userId)) || Number(tokenUser.userId) <= 0) {
        return res.status(401).json({ success: false, message: "Your session is invalid. Please log in again." });
    }

    try {
        const [users] = await db.promise().query(
            "SELECT User_ID, Email, User_Type, Account_Status FROM USERS WHERE User_ID = ? LIMIT 1",
            [Number(tokenUser.userId)]
        );
        if (!users.length || users[0].Account_Status !== "Active") {
            return res.status(401).json({ success: false, message: "Your account is unavailable. Please sign in again." });
        }
        const user = users[0];
        if (!["Volunteer", "NGO"].includes(user.User_Type)) {
            return res.status(403).json({ success: false, message: "This account type cannot access the volunteer or NGO portal." });
        }
        if (tokenUser.userType !== user.User_Type) {
            return res.status(401).json({ success: false, message: "Your account role has changed. Please sign in again." });
        }
        req.user = { userId: user.User_ID, email: user.Email, userType: user.User_Type };
        return next();
    } catch (error) {
        console.error("Authenticated account lookup failed:", error.message);
        return res.status(503).json({ success: false, message: "Account verification is temporarily unavailable." });
    }
};

const optionalAuthenticateToken = (req, res, next) => {
    if (!req.get("authorization")) return next();
    return authenticateToken(req, res, next);
};

authenticateToken.optional = optionalAuthenticateToken;

module.exports = authenticateToken;
