# SEVAconnect — NGO & Volunteer Management System

## About the Project
SEVAconnect is a web-based platform that connects NGOs with volunteers. It helps NGOs organize volunteering events and manage applications, while volunteers can discover opportunities, track their contributions, and share feedback.

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Authentication:** JWT and bcrypt

## Features

- **User Authentication:** Register and log in as a volunteer or NGO.
- **Event Management:** NGOs can create, edit, and cancel volunteering events.
- **Event Discovery:** Volunteers can search, filter, sort, and apply for events.
- **Application Management:** NGOs can review applications and approve or reject volunteers.
- **Volunteer Profiles:** Manage personal details, skills, availability, and proficiency.
- **Attendance Tracking:** NGOs can mark attendance for approved volunteers.
- **Volunteer History:** Track completed events, volunteering hours, and NGO feedback.
- **Ratings & Reviews:** Volunteers can rate completed events and share comments.
- **Impact Analytics:** View volunteering statistics and export reports as CSV.
- **Demo Data:** SQL seed scripts provide sample NGOs, volunteers, events, and reviews for testing.

## Project Structure

```text
SEVAconnect/
├── backend/       # Express server, APIs, authentication
├── frontend/      # HTML, CSS, JavaScript interface
├── database/      # SQL migrations and demo seed scripts
├── README.md
└── .gitignore
```

## Run Locally

1. Install [Node.js](https://nodejs.org/) and MySQL.
2. Create the `sevaconnect` database in MySQL Workbench.
3. Apply the required SQL migrations from the `database/` folder in the documented order.
4. In `backend/`, install dependencies:

   ```bash
   npm install
   ```

5. Copy `.env.example` to `.env` inside `backend/` and configure your local database credentials.
6. Start the backend:

   ```bash
   npm start
   ```

7. Open `frontend/index.html` using VS Code Live Server.

**Note:** Keep your `.env` file private. Never upload real database credentials to GitHub.