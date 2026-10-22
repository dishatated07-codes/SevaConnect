const db = require("../config/db");

const listMyNotifications = async (req, res) => {
    try {
        const [notifications] = await db.promise().query(
            `SELECT Notification_ID AS notificationId, Notification_Type AS type, Message AS message,
                    Related_Entity_Type AS relatedEntityType, Related_Entity_ID AS relatedEntityId,
                    Read_Status AS readStatus, Created_Date AS createdDate
             FROM NOTIFICATIONS WHERE Recipient_User_ID = ?
             ORDER BY Created_Date DESC, Notification_ID DESC LIMIT 50`,
            [req.user.userId]
        );
        return res.json({ success: true, notifications });
    } catch (error) {
        console.error("Notification list failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load notifications." });
    }
};

const markNotificationRead = async (req, res) => {
    const notificationId = Number(req.params.notificationId);
    if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
        return res.status(400).json({ success: false, message: "A valid notification ID is required." });
    }
    try {
        const [result] = await db.promise().query(
            `UPDATE NOTIFICATIONS SET Read_Status = 'Read', Read_Date = CURRENT_TIMESTAMP
             WHERE Notification_ID = ? AND Recipient_User_ID = ?`,
            [notificationId, req.user.userId]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: "Notification not found." });
        return res.json({ success: true, message: "Notification marked as read." });
    } catch (error) {
        console.error("Notification update failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to update the notification." });
    }
};

module.exports = { listMyNotifications, markNotificationRead };
