const mysql = require("mysql2");

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.ready = new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
        if (err) {
            reject(err);
            return;
        }
        connection.release();
        console.log("MySQL database connected successfully!");
        resolve();
    });
});

module.exports = db;
