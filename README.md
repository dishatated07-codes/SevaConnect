# SEVAconnect

SEVAconnect connects volunteers with NGO events. This repository currently uses HTML, CSS, and JavaScript in `frontend/`, with an Express API and MySQL database in `backend/`.

## Start the backend

1. Make sure MySQL is running and the existing `sevaconnect` database is configured.
2. Configure the variables shown in `backend/.env.example` in the local `backend/.env` file. Keep `.env` private and do not commit it.
3. In a terminal, run:

   ```powershell
   cd backend
   npm install
   npm start
   ```

   The API uses port `5000` unless `PORT` is set. Visit `http://localhost:5000/api/health` to check that it started and connected to MySQL.

## Open the frontend

In a second terminal, run:

```powershell
cd frontend
python -m http.server 5500
```

Open `http://localhost:5500/index.html` in a browser. The current frontend sends API requests to `http://localhost:5000/api`.

## Available flows

- Volunteers register through `register.html`, select Volunteer at `login.html`, browse events, apply, and view application status and completed volunteering history.
- NGOs register through `register.html` by selecting NGO, sign in at `login.html`, and can create events immediately. Each organization can manage its own events and applications from `ngo-dashboard.html`. Legacy NGO URLs redirect to the shared pages.
- NGO event and application actions require an authenticated NGO account and enforce event ownership on the backend.

## API route groups

- `/api/auth`: sign in and retrieve the authenticated profile.
- `/api/volunteers`: volunteer registration, the active skill catalogue, and authenticated self-service profile and skill management.
- `/api/ngos`: NGO registration.
- `/api/events`: browse events, apply, manage an NGO's events, review applications, and record completed participation.
- `/api/dashboard`: role-specific dashboard data.
- `/api/notifications`: list the signed-in user's notifications and mark them read.
- Attendance and volunteer service tracking: NGOs can record attendance and service outcomes for their own approved event applicants; volunteers can read their own completed service history.
- Volunteer feedback and NGO event ratings: volunteers may submit one star rating and optional comment for each completed event; owning NGOs can view anonymous event reviews and summaries.

## Event search and filters

`GET /api/events` supports `search`, `category`, `city`, `startDate`, `endDate`, `availability`, `sort`, `notApplied`, `limit`, and `offset`. Search checks event title, description, category, city, and location. Category and city choices are returned from current open event data. The default sort is soonest first; other sorts are `latest` and `title`. Pages return at most 100 events and include `pagination.nextOffset` when more results are available.

Date filters use `YYYY-MM-DD` calendar dates against `Start_Date_Time`. Date-only boundaries are interpreted in the MySQL connection session timezone (the live database currently uses `SYSTEM`), and `endDate` includes that full calendar day by filtering before the following midnight. Event timestamps are displayed in the browser locale. Guests can browse; `notApplied=true` requires an authenticated volunteer and uses only that volunteer's own profile and applications.

The `npm test` script is still the starter placeholder; it does not run a project test suite. Use the reported syntax checks and manual workflow steps until automated tests are added.

## Volunteer profiles and skills

After signing in as a volunteer, open `volunteer-profile.html` from the dashboard. The profile endpoints use the authenticated volunteer identity; update requests accept name, phone, city, availability, and bio only. Email and account role cannot be changed through this API. Availability follows the existing database check constraint: `Weekdays`, `Weekends`, or `Both`. Skill assignments use the existing `SKILLS` and `VOLUNTEER_SKILLS` tables. The catalogue is loaded from active database rows. Proficiency values accepted by the application are `Beginner`, `Intermediate`, and `Advanced` (the existing `Proficiency_Level` column is `VARCHAR(20)` and did not define a database enum).

## Required skills for events

The live schema did not contain an event-to-skill relationship. The migration in `database/20261019_event_skills.sql` was applied to the configured `sevaconnect` database for this project. For another database, apply it before using event-skill management or event browsing. In MySQL Workbench, select the `sevaconnect` schema, open the migration file, review it, and execute it once. It creates only `EVENT_SKILLS`, with a composite primary key and foreign keys to `EVENTS` and `SKILLS`; existing event and application rows are not changed. Verify it with:

```sql
SHOW CREATE TABLE EVENT_SKILLS;
SELECT COUNT(*) AS existing_events FROM EVENTS;
SELECT COUNT(*) AS existing_applications FROM EVENT_APPLICATIONS;
```

The migration is `CREATE TABLE IF NOT EXISTS`, so a repeated run does not recreate the table. If the table already exists, inspect its definition before running the migration. Keep a normal database backup before schema changes.

NGOs choose active required skills in the event form, and only the owning NGO can read or update that event's required-skill list. Existing events with no rows in `EVENT_SKILLS` remain valid. Volunteer match is `matched required skills / total required skills * 100`, rounded to the nearest whole percent. Events with no requirements display “No specific skills required”; incomplete skill matches never block applications. Applicant profile details are returned only with applications for the authenticated NGO's own events, and phone contact is shown only after approval.

### New endpoints

- `GET /api/volunteers/me/profile` and `PUT /api/volunteers/me/profile`: read or update the signed-in volunteer's own profile.
- `GET /api/volunteers/skills`: list active skill options.
- `GET /api/volunteers/me/skills` and `PUT /api/volunteers/me/skills`: read and transactionally replace the signed-in volunteer's skill assignments.
- `GET /api/events/:eventId/skills` and `PUT /api/events/:eventId/skills`: read or update required skills for an event owned by the signed-in NGO. Event creation and editing also save required skills.

## Attendance and volunteer completion

Apply `database/20261020_attendance.sql` once to the configured `sevaconnect` MySQL database after backing it up. In MySQL Workbench, select `sevaconnect`, open the migration, review it, and execute it. The migration adds only `EVENT_ATTENDANCE`, with one row per application and foreign keys to its event, volunteer, and application; it preserves existing records. Verify with `SHOW CREATE TABLE EVENT_ATTENDANCE;`.

NGOs open **Attendance and Service Outcomes** on `ngo-dashboard.html`, choose one of their events, and mark approved applicants Present or Absent. The page shows the event's approved, present, and absent totals. Once the event has ended, the NGO can record a Present volunteer as Completed with positive hours (up to 24 per person per event, two decimal places), or record an Absent outcome without hours. The completion endpoint checks ownership, approval, event end time, and the saved attendance status in a transaction. Corrections update the existing `VOLUNTEER_HISTORY` row; an absence is represented by attendance and does not receive service hours. The existing history convention (`Attended` / `No-show`) remains intact.

Volunteers see completed event, NGO, date, attendance, hours, feedback, total hours, and completed-event count under **My volunteering history**. Identity is derived from the JWT, and only completed service appears in history. Completion notifications use the existing `NOTIFICATIONS` table and are written in the same transaction as the history update.

### Attendance and history endpoints

- `GET /api/events/attendance/:eventId`: approved applicants and attendance summary for an event owned by the authenticated NGO.
- `PUT /api/events/:eventId/applications/:applicationId/attendance`: create or correct `Present` / `Absent` attendance for an approved application belonging to that NGO event.
- `PATCH /api/events/applications/:applicationId/completion`: record/correct `{ outcome: "Completed" | "Absent", hoursVolunteered, feedback }` after the event ends. Completed hours must be positive; absent outcomes earn none.
- `GET /api/volunteers/me/history`: the authenticated volunteer's completed history and totals.

The NGO dashboard includes database-derived counts for events awaiting attendance, present volunteers, and completed volunteer hours. To manually check the feature, apply the migration, create an event, approve a volunteer application, mark attendance as Present, then after the event end time record Completed with hours and verify the volunteer's history and notification. Repeat with Absent and confirm no service hours are credited. Try the event and application endpoints using another NGO token and verify they reject the request. The backend's `npm test` remains an unconfigured placeholder; see the final task report for checks run.

## Volunteer feedback and NGO ratings

The existing `VOLUNTEER_HISTORY.Feedback` field stores NGO feedback about volunteers, so volunteer-authored event reviews are stored separately in `VOLUNTEER_REVIEWS`. Apply `database/20261020_volunteer_reviews.sql` once to `sevaconnect`; back up the database first and check `information_schema.TABLES` to ensure the table does not already exist. In MySQL Workbench, select the `sevaconnect` schema, open the migration file, and execute it once. From the MySQL command-line client, connect with `mysql --host=YOUR_DB_HOST --user=YOUR_DB_USER -p sevaconnect`, enter the password at its prompt, and run:

```sql
SOURCE "D:/NGO-VOLUNTEER MANAGEMENT/database/20261020_volunteer_reviews.sql";
SHOW CREATE TABLE VOLUNTEER_REVIEWS;
```

The migration is additive: it creates a review table with a 1–5 rating check, foreign keys, an application uniqueness key, and a unique volunteer/event key. It does not change existing history or other records. A review may have a null application reference for legacy completed-history rows with no application ID; the unique volunteer/event key still prevents duplicate event reviews.

Volunteers open **My Feedback** from `volunteer-dashboard.html`. The list includes only completed service. Select one to five stars and optionally add a comment of up to 1,000 characters. A review cannot be edited or submitted twice. NGOs choose one of their events in **Event Ratings and Feedback** on `ngo-dashboard.html`; the page shows the real average to one decimal place, review count, and anonymous ratings/comments.

### Feedback endpoints

- `GET /api/volunteers/me/feedback`: completed events for the authenticated volunteer, with review state and their own submitted rating/comments.
- `POST /api/events/:eventId/feedback`: submit `{ rating, comments }` for a completed event. Rating must be an integer from 1 to 5; comments are optional and limited to 1,000 characters.
- `GET /api/events/:eventId/feedback`: event review cards and calculated summary for the authenticated owning NGO only.

To manually check the feature, complete an event as an NGO, sign in as that volunteer and submit a star rating with and without a comment. Refresh to confirm the review is retained and cannot be submitted again. Sign in as the owning NGO and confirm the average and count match the review, comments appear without volunteer identity, and an event with no reviews shows **No ratings yet**. Try retrieving another NGO's event review endpoint and confirm it is denied. The test script remains a starter placeholder, so these manual API/browser checks are still needed.

## Seed local demo NGOs and events

The repeatable seed script is `database/seed_demo_data.sql`. It inserts five demo NGO accounts and nineteen future `Open` events across education, environment, food distribution, animal welfare, healthcare awareness, and community service. Event dates are calculated from `CURRENT_DATE` when the script runs. It creates no applications, skills, attendance, volunteer history, hours, notifications, or reviews.

Run it only in a local/demo `sevaconnect` database. In MySQL Workbench:

1. Connect to the intended local MySQL server and select the `sevaconnect` schema as the default schema.
2. Optionally check for existing seed markers with the verification queries below. The script is safe to rerun: it skips existing demo accounts, profiles, and marked events, and can add any missing demo rows.
3. Open `database/seed_demo_data.sql` in a SQL Editor tab and confirm its `USE sevaconnect;` line.
4. Execute the complete script once, then confirm the transaction completed successfully in the Action Output panel.
5. Run the verification queries below and compare the returned demo counts.

The five demo accounts are active and can sign in through the regular NGO login flow. Their local-only credentials are:

| Email | Password |
|---|---|
| `demo-ngo-01@sevaconnect-demo.invalid` | `DemoSeva!2026` |
| `demo-ngo-02@sevaconnect-demo.invalid` | `DemoSeva!2026` |
| `demo-ngo-03@sevaconnect-demo.invalid` | `DemoSeva!2026` |
| `demo-ngo-04@sevaconnect-demo.invalid` | `DemoSeva!2026` |
| `demo-ngo-05@sevaconnect-demo.invalid` | `DemoSeva!2026` |

The seed stores only a bcrypt hash produced with the backend's existing `bcrypt` implementation. These shared credentials are for local demonstration only; do not use or seed them in a public or production database. Existing accounts are never updated. Reserved `.invalid` email addresses and exact demo marker checks protect the inserts. NGO descriptions include a `[SEVACONNECT-DEMO-NGO-##]` marker, and each event description contains a `[SEVACONNECT-DEMO-EVENT-KEY]` marker. The latter makes event insertion repeatable without relying on titles and visibly distinguishes seeded events in event details.

Verify demo rows in Workbench:

```sql
SELECT Email, User_Type, Account_Status
FROM USERS
WHERE Email LIKE 'demo-ngo-%@sevaconnect-demo.invalid'
ORDER BY Email;

SELECT n.Organization_Name, n.City, COUNT(e.Event_ID) AS demo_events
FROM NGOS n
JOIN USERS u ON u.User_ID = n.User_ID
LEFT JOIN EVENTS e ON e.NGO_ID = n.NGO_ID
                  AND e.Description LIKE '%[SEVACONNECT-DEMO-EVENT-%'
WHERE n.Description LIKE '%[SEVACONNECT-DEMO-NGO-%'
GROUP BY n.NGO_ID, n.Organization_Name, n.City
ORDER BY n.Organization_Name;

SELECT Event_Title, Category, City, Start_Date_Time, Status
FROM EVENTS
WHERE Description LIKE '%[SEVACONNECT-DEMO-EVENT-%'
ORDER BY Start_Date_Time;
```

Expected totals on the first successful run are five demo NGO profiles and nineteen marked events. The existing event-list API returns future `Open` events, and its search, category/city filters, pagination, and details use these standard event columns. The seed file was checked against the live table definitions; it has not been executed against the database.

## Impact analytics and CSV reports

Both dashboards include a date-filtered impact panel. Dates are inclusive and filter by the event start date; leaving both blank includes all matching records. NGO reports are restricted to the signed-in NGO profile, and volunteer reports use only the signed-in volunteer profile.

The analytics use existing recorded data:

- **NGO events and upcoming events:** event rows owned by that NGO; upcoming means status `Open` or `Upcoming` and both start and end have not passed.
- **Completed events and hours:** `VOLUNTEER_HISTORY` rows marked `Attended`; events are counted distinctly and hours are summed from those completion rows.
- **Approved applications and unique volunteers:** approved applications for the NGO's selected events; volunteers are distinct by volunteer ID.
- **Attendance rate:** valid `Present` records divided by valid `Present` plus `Absent` records. A record counts only when its attendance, application, volunteer, and event agree and the application is approved. No records displays no rate.
- **Volunteer monthly hours:** the prior 12 calendar-month window, grouped by the recorded completion date. The date filter still scopes by event start date.
- **Average rating:** average and count from `VOLUNTEER_REVIEWS`. If that optional table is not installed, the NGO panel reports ratings unavailable; apply `database/20261020_volunteer_reviews.sql` once if ratings are needed.

CSV export endpoints are `GET /api/reports/ngo/events.csv` and `GET /api/reports/volunteer/impact.csv`; analytics endpoints are `GET /api/dashboard/ngo/impact` and `GET /api/dashboard/volunteer/impact`. All require the existing bearer token. Optional `startDate` and `endDate` query parameters use `YYYY-MM-DD`. CSV cells are quoted and escaped, with spreadsheet formula prefixes neutralized. Exports include the authenticated user's own records only.

To use the reports, start the backend and frontend as described above, sign in to the corresponding dashboard, optionally choose a start/end date, then select **Apply** or **Export CSV**. Analytics are read-only and do not create or alter attendance, completion history, applications, or reviews. A volunteer's download contains recorded attendance and completed-history records (including a completed service record when no attendance row is present).

### Impact analytics verification

Check the APIs while authenticated as the relevant account. A user of the wrong role should receive HTTP 403; a missing profile receives 404. To inspect stored source data in MySQL Workbench, use read-only queries such as:

```sql
SELECT Status, COUNT(*) AS application_count
FROM EVENT_APPLICATIONS GROUP BY Status;

SELECT Status, COUNT(*) AS attendance_count
FROM EVENT_ATTENDANCE GROUP BY Status;

SELECT Completion_Status, COUNT(*) AS history_rows,
       ROUND(SUM(Hours_Volunteered), 2) AS hours
FROM VOLUNTEER_HISTORY GROUP BY Completion_Status;

SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'volunteer_reviews';
```

The API calculates its metrics from these existing rows and does not synthesize dashboard activity. The analytics and both CSV exports were exercised read-only against the configured `sevaconnect` database. In that database the optional `VOLUNTEER_REVIEWS` table is not installed, so ratings correctly report unavailable until its migration is applied.

## Manual profile and matching check

Run the backend and frontend using the commands above, sign in as a volunteer, and use **My Profile & Skills** to edit profile fields and skill levels. Refresh the page and sign in again to confirm persistence. Sign in as an NGO, create an event with two required skills, then open event browsing as the volunteer: if the volunteer has one required skill the card should show `50%`, the matched skill, and the missing skill. Remove all requirements from an event and confirm it says “No specific skills required.” Apply anyway to confirm missing skills do not block the application. In the NGO dashboard, confirm applicant details and matching are visible only for that NGO's applications; phone contact should appear only after approval.
