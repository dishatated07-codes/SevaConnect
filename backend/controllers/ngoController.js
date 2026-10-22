const db = require("../config/db");
const bcrypt = require("bcrypt");

const registerNgo = async (req, res) => {
    const { organizationName, contactPerson, email, phone, password, city, address = "", description = "" } = req.body || {};
    const fields = { organizationName, email, phone, password, city };
    for (const [name, value] of Object.entries(fields)) {
        if (typeof value !== "string" || !value.trim()) {
            return res.status(400).json({ success: false, message: `${name} is required.` });
        }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 100) {
        return res.status(400).json({ success: false, message: "Enter a valid email address (100 characters or fewer)." });
    }
    if (password.length < 8 || password.length > 72) {
        return res.status(400).json({ success: false, message: "Password must contain 8 to 72 characters." });
    }
    const lengths = [[organizationName, 150, "Organization name"], [contactPerson || "", 100, "Contact person"],
        [phone, 20, "Phone number"], [city, 50, "City"], [address, 200, "Address"], [description, 1000, "Description"]];
    for (const [value, max, label] of lengths) {
        if (typeof value !== "string" || value.trim().length > max) {
            return res.status(400).json({ success: false, message: `${label} must be ${max} characters or fewer.` });
        }
    }

    let connection;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [userResult] = await connection.query(
            "INSERT INTO USERS (Email, Password_Hash, User_Type) VALUES (?, ?, 'NGO')",
            [email.trim().toLowerCase(), passwordHash]
        );
        await connection.query(
            `INSERT INTO NGOS (User_ID, Organization_Name, Phone_Number, Contact_Person_Name,
                Address, City, Description, Verification_Status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Verified')`,
            [userResult.insertId, organizationName.trim(), phone.trim(), contactPerson?.trim() || null,
                address.trim() || null, city.trim(), description.trim() || null]
        );
        await connection.commit();
        return res.status(201).json({ success: true, message: "Organization registered. You can sign in and create events now." });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }
        console.error("NGO registration failed:", error.message);
        return res.status(500).json({ success: false, message: "Registration failed. Please try again." });
    } finally {
        connection?.release();
    }
};

module.exports = { registerNgo };
