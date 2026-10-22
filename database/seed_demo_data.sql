-- Repeatable demo seed for SEVAconnect. Use only in a local/demo database.
-- Creates five demo NGO accounts and nineteen future Open events.
-- It never updates or deletes existing rows and creates no applications,
-- attendance, volunteer history, hours, skills, notifications, or reviews.
USE sevaconnect;
START TRANSACTION;

-- The shared demo password is DemoSeva!2026. This bcrypt hash was generated
-- with the project's existing bcrypt implementation (cost 10); no plaintext
-- password is stored in Password_Hash.
SET @demo_password_hash = '$2b$10$09alOSqcNyeElRPfiVWo2.G7ltqIMamHh0ZHaloGK9mDQkFJUkS4m';

-- Stable reserved .invalid email addresses act as user seed keys. Existing
-- accounts are never updated; NGO profiles are only attached to a matching
-- account with this exact seed hash and the NGO role.
INSERT INTO USERS (Email, Password_Hash, User_Type, Account_Status)
SELECT demo.email, @demo_password_hash, 'NGO', 'Active'
FROM (
    SELECT 'demo-ngo-01@sevaconnect-demo.invalid' AS email
    UNION ALL SELECT 'demo-ngo-02@sevaconnect-demo.invalid'
    UNION ALL SELECT 'demo-ngo-03@sevaconnect-demo.invalid'
    UNION ALL SELECT 'demo-ngo-04@sevaconnect-demo.invalid'
    UNION ALL SELECT 'demo-ngo-05@sevaconnect-demo.invalid'
) AS demo
WHERE NOT EXISTS (SELECT 1 FROM USERS u WHERE u.Email = demo.email);

INSERT INTO NGOS
    (User_ID, Organization_Name, Phone_Number, Contact_Person_Name, Address, City, Description, Verification_Status)
SELECT u.User_ID, demo.organization_name, demo.phone, demo.contact_name, demo.address, demo.city,
       CONCAT(demo.description, ' [SEVACONNECT-DEMO-NGO-', demo.seed_key, ']'),
       'Verified'
FROM (
    SELECT '01' AS seed_key, 'demo-ngo-01@sevaconnect-demo.invalid' AS email,
           'Vidya Setu Foundation' AS organization_name, '+91-90000-10001' AS phone,
           'Ananya Kulkarni' AS contact_name, '14 Deccan Gymkhana Road' AS address, 'Pune' AS city,
           'Community-led learning support, reading programs, and digital literacy for children.' AS description
    UNION ALL SELECT '02', 'demo-ngo-02@sevaconnect-demo.invalid', 'GreenRoots Collective', '+91-90000-10002',
           'Rohan Mehta', '22 Bandra Reclamation', 'Mumbai',
           'Local environmental action through cleanups, urban gardens, and waste reduction.'
    UNION ALL SELECT '03', 'demo-ngo-03@sevaconnect-demo.invalid', 'Annadaan Community Trust', '+91-90000-10003',
           'Meera Patil', '7 College Road', 'Nashik',
           'Volunteer-powered meal distribution and food access initiatives for local communities.'
    UNION ALL SELECT '04', 'demo-ngo-04@sevaconnect-demo.invalid', 'Paws and Care India', '+91-90000-10004',
           'Kabir Shah', '31 Aundh Road', 'Pune',
           'Animal welfare outreach supporting rescue, responsible care, and adoption.'
    UNION ALL SELECT '05', 'demo-ngo-05@sevaconnect-demo.invalid', 'Aarogya Outreach Network', '+91-90000-10005',
           'Nisha Rao', '18 Navrangpura Main Road', 'Ahmedabad',
           'Community health awareness and practical access to preventive health information.'
) AS demo
JOIN USERS u ON u.Email = demo.email
             AND u.User_Type = 'NGO'
             AND u.Password_Hash = @demo_password_hash COLLATE utf8mb4_0900_ai_ci
WHERE NOT EXISTS (SELECT 1 FROM NGOS n WHERE n.User_ID = u.User_ID);

-- Event descriptions end in a stable, visible demo marker. The marker plus
-- owning demo NGO marker (not the title) makes repeated runs idempotent.
INSERT INTO EVENTS
    (NGO_ID, Event_Title, Description, Category, Location, City,
     Start_Date_Time, End_Date_Time, Total_Capacity, Status)
SELECT n.NGO_ID, demo.title,
       CONCAT(demo.description, '\n\n[SEVACONNECT-DEMO-EVENT-', demo.seed_key, ']'),
       demo.category, demo.location, demo.city,
       TIMESTAMP(DATE_ADD(CURRENT_DATE, INTERVAL demo.start_days DAY), demo.start_time),
       TIMESTAMP(DATE_ADD(CURRENT_DATE, INTERVAL demo.end_days DAY), demo.end_time),
       demo.capacity, 'Open'
FROM (
    SELECT '01' AS ngo_key, 'EDU-01' AS seed_key, 'Saturday Reading Circle for Young Learners' AS title,
           'Education' AS category, 'Volunteer Learning Room, Deccan Library' AS location, 'Pune' AS city,
           14 AS start_days, 14 AS end_days, '09:30:00' AS start_time, '12:30:00' AS end_time, 18 AS capacity,
           'Help children build confidence in reading through small-group stories, guided practice, and creative activities.' AS description
    UNION ALL SELECT '01','EDU-02','Digital Basics for First-Time Learners','Education','Community Computer Lab, Shivajinagar','Pune',19,19,'10:00:00','13:00:00',12,
           'Support adults learning essential computer and internet skills in a friendly, hands-on session.'
    UNION ALL SELECT '01','EDU-03','Build a Take-Home Science Activity Kit','Education','Vidya Setu Centre, Kothrud','Pune',27,27,'09:00:00','12:00:00',16,
           'Prepare simple, reusable science activity kits and help facilitators test the instructions.'
    UNION ALL SELECT '01','EDU-04','Homework Mentoring Morning','Education','Municipal School Hall, Erandwane','Pune',35,35,'09:30:00','12:30:00',20,
           'Offer one-to-one encouragement with mathematics and language practice for middle-school students.'

    UNION ALL SELECT '02','ENV-01','Mithi Riverbank Community Cleanup','Environment','Powai Garden Riverside Entrance','Mumbai',16,16,'07:30:00','10:30:00',30,
           'Join residents for a supervised litter pickup and waste sorting activity along an accessible riverbank stretch.'
    UNION ALL SELECT '02','ENV-02','Native Sapling Care and Watering','Environment','Bandra East Urban Garden','Mumbai',23,23,'08:00:00','11:00:00',22,
           'Help mulch, water, and label native saplings planted by neighborhood volunteers.'
    UNION ALL SELECT '02','ENV-03','Repair and Reuse Community Workshop','Environment','GreenRoots Workshop, Andheri West','Mumbai',31,31,'10:00:00','14:00:00',15,
           'Assist local repair mentors with tool setup, item intake, and practical reuse demonstrations.'
    UNION ALL SELECT '02','ENV-04','Household Waste Sorting Awareness Walk','Environment','Community Hall, Chembur','Mumbai',42,42,'09:00:00','12:00:00',24,
           'Share clear, practical waste sorting guidance with households and distribute reusable information cards.'

    UNION ALL SELECT '03','FOOD-01','Weekend Community Meal Packing','Food Distribution','Annadaan Kitchen, College Road','Nashik',15,15,'08:00:00','11:00:00',28,
           'Pack prepared meals for partner community kitchens while following the food safety briefing.'
    UNION ALL SELECT '03','FOOD-02','Fresh Produce Distribution Morning','Food Distribution','Mahatma Nagar Community Centre','Nashik',22,22,'07:30:00','10:30:00',20,
           'Help organize produce boxes and guide residents through an orderly neighborhood distribution.'
    UNION ALL SELECT '03','FOOD-03','Community Pantry Stock and Sort','Food Distribution','Panchavati Pantry Hub','Nashik',30,30,'09:00:00','12:00:00',16,
           'Sort shelf-stable donations by date and category, and prepare pantry shelves for the week.'
    UNION ALL SELECT '03','FOOD-04','Festival Meal Service Support','Food Distribution','Satpur Community Hall','Nashik',45,45,'10:00:00','14:00:00',32,
           'Support meal service setup, welcoming, and clean-up for a community gathering.'

    UNION ALL SELECT '04','ANIMAL-01','Street Dog Wellness and Water Station Day','Animal Welfare','Aundh Community Park','Pune',18,18,'08:00:00','11:00:00',14,
           'Assist animal care volunteers with hydration stations, information materials, and humane community outreach.'
    UNION ALL SELECT '04','ANIMAL-02','Shelter Enrichment and Supply Sorting','Animal Welfare','Paws and Care Shelter, Baner','Pune',29,29,'09:00:00','12:00:00',12,
           'Prepare enrichment items and sort donated supplies under the shelter team’s guidance.'
    UNION ALL SELECT '04','ANIMAL-03','Responsible Pet Care Awareness Booth','Animal Welfare','Balewadi Neighborhood Market','Pune',40,40,'09:30:00','13:00:00',10,
           'Welcome visitors and share shelter-approved information on adoption and responsible pet care.'

    UNION ALL SELECT '05','HEALTH-01','Healthy Habits Community Information Day','Healthcare Awareness','Navrangpura Community Centre','Ahmedabad',17,17,'09:00:00','12:00:00',20,
           'Help set up a health information space and guide visitors to qualified community health workers.'
    UNION ALL SELECT '05','HEALTH-02','Family Nutrition and Hydration Workshop','Healthcare Awareness','Paldi Public Hall','Ahmedabad',28,28,'10:00:00','13:00:00',18,
           'Support a facilitator-led session with registration, materials, and participant questions.'
    UNION ALL SELECT '05','COMM-01','Neighborhood Accessibility Mapping Walk','Community Service','Ellis Bridge Ward Office','Ahmedabad',38,38,'08:30:00','11:30:00',16,
           'Walk a planned neighborhood route and record public accessibility observations for a community report.'
    UNION ALL SELECT '05','COMM-02','Community Resource Directory Update','Community Service','Aarogya Outreach Office, Navrangpura','Ahmedabad',50,50,'09:30:00','12:30:00',12,
           'Help verify public service contact details and organize a printed community resource directory.'
) AS demo
JOIN USERS u ON u.Email = CASE demo.ngo_key
    WHEN '01' THEN 'demo-ngo-01@sevaconnect-demo.invalid'
    WHEN '02' THEN 'demo-ngo-02@sevaconnect-demo.invalid'
    WHEN '03' THEN 'demo-ngo-03@sevaconnect-demo.invalid'
    WHEN '04' THEN 'demo-ngo-04@sevaconnect-demo.invalid'
    WHEN '05' THEN 'demo-ngo-05@sevaconnect-demo.invalid'
END
             AND u.User_Type = 'NGO'
             AND u.Password_Hash = @demo_password_hash COLLATE utf8mb4_0900_ai_ci
JOIN NGOS n ON n.User_ID = u.User_ID
           AND LOCATE(CONCAT('[SEVACONNECT-DEMO-NGO-', demo.ngo_key, ']'), n.Description) > 0
WHERE NOT EXISTS (
    SELECT 1 FROM EVENTS e
    WHERE e.NGO_ID = n.NGO_ID
      AND LOCATE(CONCAT('[SEVACONNECT-DEMO-EVENT-', demo.seed_key, ']'), e.Description) > 0
);

COMMIT;
