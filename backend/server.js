// Import required packages
const express = require('express');
const cors = require('cors');

require('dotenv').config();

const db = require('./config/db');

const volunteerRoutes = require('./routes/volunteerRoutes');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Create Express application
const app = express();

// Enable JSON request parsing
app.use(express.json());

// Enable CORS
app.use(cors());

app.use('/api/volunteers', volunteerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

// Get PORT from environment variables (default to 5000)
const PORT = process.env.PORT || 5000;

// GET endpoint for health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SevaConnect API is running'
  });
});

// Start the server only after MySQL confirms the connection.
db.ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SevaConnect API server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed; API server was not started.", error.message);
    process.exitCode = 1;
  });


