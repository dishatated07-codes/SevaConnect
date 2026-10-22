-- TRANSACTION SAFETY (MySQL Workbench): use a fresh dedicated connection and
-- enable Query > Stop Script Execution On Errors (or disable the preference
-- "Continue on SQL script execution on errors") before running this script.
-- This is a normal SQL script; it does not use a stored-program exception
-- handler, and intentionally has no automatic COMMIT.
-- All INSERTs and verification SELECTs run in one open transaction. After the
-- script finishes, inspect Workbench's output and verification results. If all
-- statements succeeded and results are expected, run COMMIT; manually in this
-- same connection. If any statement failed or results are unexpected, run
-- ROLLBACK; immediately in this same connection. Stop-on-error halts later
-- statements but does not roll back the open transaction. Resolve the
-- transaction before rerunning the script.
-- Repeatable SEVAconnect demo volunteer and completed-event seed.
-- Run only in a local/demo sevaconnect database in MySQL Workbench.
-- Adds four marked volunteers, three past marked events owned by demo NGOs
-- 01-03, eight approved demo applications, eight Present attendance rows,
-- eight Attended history rows with demo NGO feedback, and eight event reviews.
-- The script stores only a bcrypt hash. It never updates or deletes existing rows.
-- Every inserted ID is resolved through the account/event/application relationships.
USE sevaconnect;
START TRANSACTION;

-- Password used by the volunteer demo accounts: DemoVolunteer!2026
-- This bcrypt cost-10 hash was generated with the backend's bcrypt package.
SET @demo_volunteer_password_hash = '$2b$10$JWDexgVQ47q.us7bgAyF3.xriGq0lQpcvrE.pFAPdwb2tWjPpDCe.';

-- Account keys are reserved demo emails. Existing accounts are not changed.
INSERT INTO USERS (Email, Password_Hash, User_Type, Account_Status)
SELECT demo.Email, @demo_volunteer_password_hash, 'Volunteer', 'Active'
FROM (
    SELECT 'demo-volunteer-01@sevaconnect-demo.invalid' AS Email
    UNION ALL SELECT 'demo-volunteer-02@sevaconnect-demo.invalid'
    UNION ALL SELECT 'demo-volunteer-03@sevaconnect-demo.invalid'
    UNION ALL SELECT 'demo-volunteer-04@sevaconnect-demo.invalid'
) AS demo
WHERE NOT EXISTS (SELECT 1 FROM USERS u WHERE u.Email = demo.Email);

-- Profile fields follow the volunteer registration controller's columns and
-- the VOLUNTEERS availability check. Bio contains a per-account demo marker.
INSERT INTO VOLUNTEERS (User_ID, Full_Name, Phone_Number, City, Availability, Bio)
SELECT u.User_ID, demo.Full_Name, demo.Phone_Number, demo.City, 'Weekends', demo.Bio
FROM (
    SELECT '01' AS volunteer_key, 'demo-volunteer-01@sevaconnect-demo.invalid' AS Email,
           'Aarav Kulkarni' AS Full_Name, '+91-90000-20001' AS Phone_Number, 'Pune' AS City,
           'Demo volunteer profile for presentation use. [SEVACONNECT-DEMO-VOLUNTEER-01]' AS Bio
    UNION ALL SELECT '02', 'demo-volunteer-02@sevaconnect-demo.invalid',
           'Meera Joshi', '+91-90000-20002', 'Pune',
           'Demo volunteer profile for presentation use. [SEVACONNECT-DEMO-VOLUNTEER-02]'
    UNION ALL SELECT '03', 'demo-volunteer-03@sevaconnect-demo.invalid',
           'Kabir Shah', '+91-90000-20003', 'Mumbai',
           'Demo volunteer profile for presentation use. [SEVACONNECT-DEMO-VOLUNTEER-03]'
    UNION ALL SELECT '04', 'demo-volunteer-04@sevaconnect-demo.invalid',
           'Nisha Rao', '+91-90000-20004', 'Nashik',
           'Demo volunteer profile for presentation use. [SEVACONNECT-DEMO-VOLUNTEER-04]'
) AS demo
JOIN USERS u ON u.Email = demo.Email
            AND u.User_Type = 'Volunteer'
            AND u.Password_Hash = @demo_volunteer_password_hash
LEFT JOIN VOLUNTEERS existing_profile ON existing_profile.User_ID = u.User_ID
WHERE existing_profile.Volunteer_ID IS NULL;

-- These are separate historical records. The existing 19 future demo events
-- are not selected or changed. All three events are dated in the past at run time.
INSERT INTO EVENTS
    (NGO_ID, Event_Title, Description, Category, Location, City,
     Start_Date_Time, End_Date_Time, Total_Capacity, Status)
SELECT n.NGO_ID,
       demo.Event_Title,
       CONCAT(demo.Event_Description, ' [SEVACONNECT-DEMO-HISTORICAL-EVENT-', demo.event_key, ']'),
       demo.Category, demo.Location, demo.City,
       demo.Start_Date_Time, demo.End_Date_Time, 20, 'Completed'
FROM (
    SELECT '01' AS ngo_key, 'demo-ngo-01@sevaconnect-demo.invalid' AS ngo_email,
           'EDU-01' AS event_key, 'Demo: Community Reading Circle' AS Event_Title,
           'A demo session supporting guided reading and small-group learning for local students.' AS Event_Description,
           'Education' AS Category, 'Vidya Setu Learning Room' AS Location, 'Pune' AS City,
           TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 21 DAY), '09:00:00') AS Start_Date_Time,
           TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 21 DAY), '12:00:00') AS End_Date_Time
    UNION ALL SELECT '02', 'demo-ngo-02@sevaconnect-demo.invalid',
           'ENV-01', 'Demo: Neighborhood Cleanup',
           'A demo community cleanup with supervised litter collection and waste sorting.',
           'Environment', 'GreenRoots Community Garden', 'Mumbai',
           TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY), '08:00:00'),
           TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY), '11:00:00')
    UNION ALL SELECT '03', 'demo-ngo-03@sevaconnect-demo.invalid',
           'FOOD-01', 'Demo: Community Meal Packing',
           'A demo meal-packing session following the partner kitchen food-safety briefing.',
           'Food Distribution', 'Annadaan Community Kitchen', 'Nashik',
           TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY), '08:00:00'),
           TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY), '11:00:00')
) AS demo
JOIN USERS ngo_user ON ngo_user.Email = demo.ngo_email
                   AND ngo_user.User_Type = 'NGO'
                   AND ngo_user.Account_Status = 'Active'
JOIN NGOS n ON n.User_ID = ngo_user.User_ID
           AND n.Verification_Status = 'Verified'
           AND LOCATE(CONCAT('[SEVACONNECT-DEMO-NGO-', demo.ngo_key, ']'), n.Description) > 0
WHERE NOT EXISTS (
    SELECT 1 FROM EVENTS e
    WHERE e.NGO_ID = n.NGO_ID
      AND LOCATE(CONCAT('[SEVACONNECT-DEMO-HISTORICAL-EVENT-', demo.event_key, ']'), e.Description) > 0
);

-- Create approved applications only for the explicitly listed demo pairings.
-- The owning demo NGO is recorded as the reviewer; application/approval dates
-- precede the event, matching the application's approval flow and date rule.
INSERT INTO EVENT_APPLICATIONS
    (Event_ID, Volunteer_ID, Application_Date, Status,
     Reviewed_By_User_ID, Approval_Date, Notes)
SELECT e.Event_ID,
       v.Volunteer_ID,
       DATE_SUB(e.Start_Date_Time, INTERVAL 7 DAY),
       'Approved',
       ngo_user.User_ID,
       DATE_SUB(DATE(e.Start_Date_Time), INTERVAL 5 DAY),
       CONCAT('[SEVACONNECT-DEMO-APPLICATION-', demo.event_key, '-VOL-', demo.volunteer_key, ']')
FROM (
    SELECT '01' AS volunteer_key, 'EDU-01' AS event_key
    UNION ALL SELECT '02', 'EDU-01'
    UNION ALL SELECT '03', 'EDU-01'
    UNION ALL SELECT '02', 'ENV-01'
    UNION ALL SELECT '03', 'ENV-01'
    UNION ALL SELECT '04', 'ENV-01'
    UNION ALL SELECT '01', 'FOOD-01'
    UNION ALL SELECT '04', 'FOOD-01'
) AS demo
JOIN USERS volunteer_user
  ON volunteer_user.Email = CONCAT('demo-volunteer-', demo.volunteer_key, '@sevaconnect-demo.invalid')
 AND volunteer_user.User_Type = 'Volunteer'
JOIN VOLUNTEERS v ON v.User_ID = volunteer_user.User_ID
                 AND LOCATE(CONCAT('[SEVACONNECT-DEMO-VOLUNTEER-', demo.volunteer_key, ']'), v.Bio) > 0
JOIN EVENTS e
  ON LOCATE(CONCAT('[SEVACONNECT-DEMO-HISTORICAL-EVENT-', demo.event_key, ']'), e.Description) > 0
JOIN NGOS n ON n.NGO_ID = e.NGO_ID
JOIN USERS ngo_user ON ngo_user.User_ID = n.User_ID
WHERE NOT EXISTS (
    SELECT 1 FROM EVENT_APPLICATIONS existing_application
    WHERE existing_application.Event_ID = e.Event_ID
      AND existing_application.Volunteer_ID = v.Volunteer_ID
);

-- Each seeded application is marked Present. IDs are resolved from its event
-- and volunteer pair; the attendance table's unique Application_ID is respected.
INSERT INTO EVENT_ATTENDANCE (Event_ID, Volunteer_ID, Application_ID, Status)
SELECT a.Event_ID, a.Volunteer_ID, a.Application_ID, 'Present'
FROM EVENT_APPLICATIONS a
JOIN EVENTS e ON e.Event_ID = a.Event_ID
WHERE a.Status = 'Approved'
  AND a.Notes LIKE '[SEVACONNECT-DEMO-APPLICATION-%'
  AND e.Description LIKE '%[SEVACONNECT-DEMO-HISTORICAL-EVENT-%'
  AND NOT EXISTS (
      SELECT 1 FROM EVENT_ATTENDANCE existing_attendance
      WHERE existing_attendance.Application_ID = a.Application_ID
  );

-- Record the completed service and NGO-to-volunteer text feedback.
-- Feedback is clearly marked as demo content and is not a numeric rating.
INSERT INTO VOLUNTEER_HISTORY
    (Volunteer_ID, Event_ID, Application_ID, Hours_Volunteered,
     Completion_Status, Completion_Date, Feedback)
SELECT v.Volunteer_ID, e.Event_ID, a.Application_ID,
       demo.Hours_Volunteered, 'Attended', DATE(e.End_Date_Time), demo.Feedback
FROM (
    SELECT '01' AS volunteer_key, 'EDU-01' AS event_key, 2.50 AS Hours_Volunteered,
           '[DEMO FEEDBACK] Aarav was punctual and guided the reading group with patience.' AS Feedback
    UNION ALL SELECT '02', 'EDU-01', 3.00,
           '[DEMO FEEDBACK] Meera prepared clear learning materials and encouraged participation.'
    UNION ALL SELECT '03', 'EDU-01', 2.75,
           '[DEMO FEEDBACK] Kabir reliably supported learners and communicated well with the team.'
    UNION ALL SELECT '02', 'ENV-01', 3.00,
           '[DEMO FEEDBACK] Meera followed safety guidance and helped the team sort collected waste.'
    UNION ALL SELECT '03', 'ENV-01', 2.50,
           '[DEMO FEEDBACK] Kabir worked steadily and helped keep the cleanup area organized.'
    UNION ALL SELECT '04', 'ENV-01', 3.00,
           '[DEMO FEEDBACK] Nisha was considerate with residents and dependable throughout the activity.'
    UNION ALL SELECT '01', 'FOOD-01', 2.50,
           '[DEMO FEEDBACK] Aarav followed food-safety instructions and kept packing stations tidy.'
    UNION ALL SELECT '04', 'FOOD-01', 3.00,
           '[DEMO FEEDBACK] Nisha coordinated calmly and helped the meal-packing team stay on schedule.'
) AS demo
JOIN USERS volunteer_user
  ON volunteer_user.Email = CONCAT('demo-volunteer-', demo.volunteer_key, '@sevaconnect-demo.invalid')
 AND volunteer_user.User_Type = 'Volunteer'
JOIN VOLUNTEERS v ON v.User_ID = volunteer_user.User_ID
                 AND LOCATE(CONCAT('[SEVACONNECT-DEMO-VOLUNTEER-', demo.volunteer_key, ']'), v.Bio) > 0
JOIN EVENTS e
  ON LOCATE(CONCAT('[SEVACONNECT-DEMO-HISTORICAL-EVENT-', demo.event_key, ']'), e.Description) > 0
JOIN EVENT_APPLICATIONS a
  ON a.Event_ID = e.Event_ID
 AND a.Volunteer_ID = v.Volunteer_ID
 AND a.Status = 'Approved'
 AND a.Notes = CONCAT('[SEVACONNECT-DEMO-APPLICATION-', demo.event_key, '-VOL-', demo.volunteer_key, ']')
JOIN EVENT_ATTENDANCE at
  ON at.Application_ID = a.Application_ID
 AND at.Event_ID = e.Event_ID
 AND at.Volunteer_ID = v.Volunteer_ID
 AND at.Status = 'Present'
LEFT JOIN VOLUNTEER_HISTORY existing_history ON existing_history.Application_ID = a.Application_ID
WHERE existing_history.History_ID IS NULL;

-- Insert volunteer-authored event reviews only for the matching demo volunteer,
-- approved application, Present attendance, and Attended history.
-- The review foreign keys and both unique keys are checked by matching this chain.
INSERT INTO VOLUNTEER_REVIEWS (Event_ID, Volunteer_ID, Application_ID, Rating, Comments)
SELECT e.Event_ID, v.Volunteer_ID, a.Application_ID, demo.Rating, demo.Comments
FROM (
    SELECT '01' AS volunteer_key, 'EDU-01' AS event_key, 5 AS Rating,
           '[DEMO REVIEW] The reading session was well organized and engaging for the learners.' AS Comments
    UNION ALL SELECT '02', 'EDU-01', 4,
           '[DEMO REVIEW] A welcoming session with useful activities and clear coordination.'
    UNION ALL SELECT '03', 'EDU-01', 5,
           '[DEMO REVIEW] I enjoyed helping learners build confidence in reading.'
    UNION ALL SELECT '02', 'ENV-01', 5,
           '[DEMO REVIEW] The cleanup was organized, safe, and had a visible community impact.'
    UNION ALL SELECT '03', 'ENV-01', 4,
           '[DEMO REVIEW] Good teamwork and clear instructions throughout the cleanup.'
    UNION ALL SELECT '04', 'ENV-01', 5,
           '[DEMO REVIEW] A positive, well-run activity with practical environmental impact.'
    UNION ALL SELECT '01', 'FOOD-01', 5,
           '[DEMO REVIEW] The team made food-safety steps clear and the work meaningful.'
    UNION ALL SELECT '04', 'FOOD-01', 4,
           '[DEMO REVIEW] A rewarding activity with thoughtful coordination at the kitchen.'
) AS demo
JOIN USERS volunteer_user
  ON volunteer_user.Email = CONCAT('demo-volunteer-', demo.volunteer_key, '@sevaconnect-demo.invalid')
 AND volunteer_user.User_Type = 'Volunteer'
JOIN VOLUNTEERS v ON v.User_ID = volunteer_user.User_ID
                 AND LOCATE(CONCAT('[SEVACONNECT-DEMO-VOLUNTEER-', demo.volunteer_key, ']'), v.Bio) > 0
JOIN EVENTS e
  ON LOCATE(CONCAT('[SEVACONNECT-DEMO-HISTORICAL-EVENT-', demo.event_key, ']'), e.Description) > 0
JOIN EVENT_APPLICATIONS a
  ON a.Event_ID = e.Event_ID
 AND a.Volunteer_ID = v.Volunteer_ID
 AND a.Status = 'Approved'
 AND a.Notes = CONCAT('[SEVACONNECT-DEMO-APPLICATION-', demo.event_key, '-VOL-', demo.volunteer_key, ']')
JOIN EVENT_ATTENDANCE at
  ON at.Application_ID = a.Application_ID
 AND at.Event_ID = e.Event_ID
 AND at.Volunteer_ID = v.Volunteer_ID
 AND at.Status = 'Present'
JOIN VOLUNTEER_HISTORY h
  ON h.Application_ID = a.Application_ID
 AND h.Event_ID = e.Event_ID
 AND h.Volunteer_ID = v.Volunteer_ID
 AND h.Completion_Status = 'Attended'
LEFT JOIN VOLUNTEER_REVIEWS existing_event_review
  ON existing_event_review.Event_ID = e.Event_ID
 AND existing_event_review.Volunteer_ID = v.Volunteer_ID
LEFT JOIN VOLUNTEER_REVIEWS existing_application_review
  ON existing_application_review.Application_ID = a.Application_ID
WHERE existing_event_review.Review_ID IS NULL
  AND existing_application_review.Review_ID IS NULL;


-- Verification: demo volunteer service history and NGO text feedback.
SELECT u.Email, v.Full_Name, e.Event_Title, h.Completion_Date,
       h.Hours_Volunteered, h.Completion_Status, h.Feedback
FROM VOLUNTEER_HISTORY h
JOIN VOLUNTEERS v ON v.Volunteer_ID = h.Volunteer_ID
JOIN USERS u ON u.User_ID = v.User_ID
JOIN EVENTS e ON e.Event_ID = h.Event_ID
WHERE u.Email LIKE 'demo-volunteer-%@sevaconnect-demo.invalid'
  AND v.Bio LIKE '%[SEVACONNECT-DEMO-VOLUNTEER-%'
ORDER BY u.Email, h.Completion_Date;

-- Verification: anonymous volunteer event reviews and event-level averages.
SELECT e.Event_ID, e.Event_Title, n.Organization_Name,
       COUNT(r.Review_ID) AS review_count,
       ROUND(AVG(r.Rating), 1) AS average_rating
FROM EVENTS e
JOIN NGOS n ON n.NGO_ID = e.NGO_ID
LEFT JOIN VOLUNTEER_REVIEWS r ON r.Event_ID = e.Event_ID
WHERE e.Description LIKE '%[SEVACONNECT-DEMO-HISTORICAL-EVENT-%'
GROUP BY e.Event_ID, e.Event_Title, n.Organization_Name
HAVING COUNT(r.Review_ID) > 0
ORDER BY e.Event_ID;

-- No COMMIT is included by design. Follow the manual COMMIT/ROLLBACK steps above.
