const db = require("../config/db");
const bcrypt = require("bcrypt");

const registerVolunteer = async (req, res) => {
    const {
        fullName,
        email,
        phone,
        password,
        city,
        skills,
        availability
    } = req.body;

    // Check required fields
    if (!fullName || !email || !phone || !password || !city || !availability) {
        return res.status(400).json({
            success: false,
            message: "Please fill in all required fields."
        });
    }

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 100 ||
        typeof fullName !== "string" || fullName.trim().length > 100 ||
        typeof phone !== "string" || phone.trim().length > 20 || typeof city !== "string" || city.trim().length > 50 ||
        typeof password !== "string" || password.length < 8 || password.length > 72 ||
        typeof availability !== "string" || availability.length > 50 ||
        !Array.isArray(skills || [])) {
        return res.status(400).json({ success: false, message: "Please check the registration details and try again." });
    }

    let connection;
    try {
        // Check if email already exists
        const [existingUsers] = await db.promise().query(
            "SELECT User_ID FROM USERS WHERE Email = ?",
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // 1. Insert into USERS
        const [userResult] = await connection.query(
            `INSERT INTO USERS
            (Email, Password_Hash, User_Type)
            VALUES (?, ?, ?)`,
            [
                email,
                passwordHash,
                "Volunteer"
            ]
        );

        const userId = userResult.insertId;

        // 2. Insert into VOLUNTEERS
        const [volunteerResult] = await connection.query(
            `INSERT INTO VOLUNTEERS
            (User_ID, Full_Name, Phone_Number, City, Availability)
            VALUES (?, ?, ?, ?, ?)`,
            [
                userId,
                fullName,
                phone,
                city,
                availability
            ]
        );

        const volunteerId = volunteerResult.insertId;

        // 3. Insert selected skills
        if (skills && Array.isArray(skills) && skills.length > 0) {

            const [skillRows] = await connection.query(
                `SELECT Skill_ID, Skill_Name
                 FROM SKILLS
                 WHERE Skill_Name IN (?)`,
                [skills]
            );

            if (skillRows.length > 0) {

                const skillValues = skillRows.map((skill) => [
                    volunteerId,
                    skill.Skill_ID
                ]);

                await connection.query(
                    `INSERT INTO VOLUNTEER_SKILLS
                    (Volunteer_ID, Skill_ID)
                    VALUES ?`,
                    [skillValues]
                );
            }
        }

        // 4. Commit everything
        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Volunteer registered successfully!"
        });

    } catch (error) {

        // Rollback if something goes wrong
        if (connection) await connection.rollback().catch(() => {});

        console.error("Volunteer registration failed:", error.message);

        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, message: "An account with this email already exists." });
        return res.status(500).json({
            success: false,
            message: "Registration failed. Please try again."
        });
    } finally {
        connection?.release();
    }
};

module.exports = {
    registerVolunteer
};
