-- SEVAconnect demo event reviews (safe, additive, repeatable).
-- Run only against a local/demo sevaconnect database in MySQL Workbench.
-- This inserts reviews only for confirmed demo volunteers with valid approved,
-- attended participation at a marked demo event owned by a marked demo NGO.
-- It creates no prerequisites and never updates existing rows.
-- Missing prerequisites are skipped. Current demo events are future dated.
USE sevaconnect;
START TRANSACTION;

INSERT INTO VOLUNTEER_REVIEWS
    (Event_ID, Volunteer_ID, Application_ID, Rating, Comments)
SELECT eligible.Event_ID,
       eligible.Volunteer_ID,
       eligible.Application_ID,
       CASE WHEN MOD(eligible.review_number, 2) = 1 THEN 5 ELSE 4 END,
       CASE WHEN MOD(eligible.review_number, 2) = 1
            THEN 'Well organized and welcoming. The team made it easy to contribute meaningfully.'
            ELSE 'A rewarding activity with clear coordination and a positive community impact.'
       END
FROM (
    SELECT ranked.Event_ID,
           ranked.Volunteer_ID,
           ranked.Application_ID,
           ROW_NUMBER() OVER (ORDER BY ranked.NGO_ID, ranked.Event_ID, ranked.Volunteer_ID) AS review_number
    FROM (
        SELECT candidates.*,
               ROW_NUMBER() OVER (
                   PARTITION BY candidates.Event_ID, candidates.Volunteer_ID
                   ORDER BY candidates.History_ID DESC
               ) AS history_choice
        FROM (
            SELECT h.History_ID,
                   h.Event_ID,
                   h.Volunteer_ID,
                   h.Application_ID,
                   e.NGO_ID
            FROM VOLUNTEER_HISTORY h
            JOIN EVENTS e ON e.Event_ID = h.Event_ID
            JOIN NGOS n ON n.NGO_ID = e.NGO_ID
            JOIN EVENT_APPLICATIONS a
              ON a.Application_ID = h.Application_ID
             AND a.Event_ID = h.Event_ID
             AND a.Volunteer_ID = h.Volunteer_ID
             AND a.Status = 'Approved'
            JOIN VOLUNTEERS v ON v.Volunteer_ID = h.Volunteer_ID
            JOIN USERS u ON u.User_ID = v.User_ID
            WHERE h.Completion_Status = 'Attended'
              AND h.Application_ID IS NOT NULL
              AND u.Email LIKE 'demo-volunteer-%@sevaconnect-demo.invalid'
              AND n.Description LIKE '%[SEVACONNECT-DEMO-NGO-%'
              AND e.Description LIKE '%[SEVACONNECT-DEMO-EVENT-%'
        ) AS candidates
    ) AS ranked
    WHERE ranked.history_choice = 1
) AS eligible
LEFT JOIN VOLUNTEER_REVIEWS existing_event_review
  ON existing_event_review.Event_ID = eligible.Event_ID
 AND existing_event_review.Volunteer_ID = eligible.Volunteer_ID
LEFT JOIN VOLUNTEER_REVIEWS existing_application_review
  ON existing_application_review.Application_ID = eligible.Application_ID
WHERE existing_event_review.Review_ID IS NULL
  AND existing_application_review.Review_ID IS NULL;

COMMIT;

-- Verify reviews and their averages for marked demo events and owning demo NGOs.
SELECT e.Event_ID, e.Event_Title, n.Organization_Name,
       COUNT(r.Review_ID) AS review_count,
       ROUND(AVG(r.Rating), 1) AS average_rating
FROM EVENTS e
JOIN NGOS n ON n.NGO_ID = e.NGO_ID
LEFT JOIN VOLUNTEER_REVIEWS r ON r.Event_ID = e.Event_ID
WHERE e.Description LIKE '%[SEVACONNECT-DEMO-EVENT-%'
  AND n.Description LIKE '%[SEVACONNECT-DEMO-NGO-%'
GROUP BY e.Event_ID, e.Event_Title, n.Organization_Name
HAVING COUNT(r.Review_ID) > 0
ORDER BY e.Event_ID;
