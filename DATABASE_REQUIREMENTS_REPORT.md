# SevaConnect NGO & Volunteer Management System
## Database Requirements Analysis Report

**Prepared:** September 1, 2026  
**Project:** SevaConnect - NGO & Volunteer Management System  
**Technology:** Oracle Database  
**Status:** Frontend Analysis Complete - Ready for Schema Design

---

## Executive Summary

Based on comprehensive analysis of the frontend (index.html, login.html, register.html, volunteer-dashboard.html, ngo-dashboard.html, and script.js), the SevaConnect system requires a relational database with 7 core entities and supporting tables to manage volunteers, NGOs, events, applications, and user activities.

---

## 1. IDENTIFIED ENTITIES & TABLES

### 1.1 USERS (Core Entity - Multi-role)
**Purpose:** Store authentication and basic information for all users (Volunteers, NGOs, Admins)

**Attributes:**
- User ID (Primary Key)
- Email Address
- Password Hash
- User Type (Volunteer | NGO | Admin)
- Created Date
- Updated Date
- Account Status (Active | Inactive | Suspended)
- Last Login

### 1.2 VOLUNTEERS (Extends Users)
**Purpose:** Store volunteer-specific profile information

**Attributes:**
- Volunteer ID (Primary Key)
- User ID (Foreign Key → Users)
- Full Name
- Phone Number
- City
- Profile Photo URL (optional)
- Bio/Description (optional)
- Joined Date
- Volunteer Hours (Accumulated)
- Total Events Completed
- Rating/Reviews (optional)

### 1.3 NGOS (Extends Users)
**Purpose:** Store NGO organization information

**Attributes:**
- NGO ID (Primary Key)
- User ID (Foreign Key → Users)
- Organization Name
- Phone Number
- Contact Person Name
- Address
- City
- Description/Mission
- Logo URL (optional)
- Registration Date
- Verification Status (Verified | Pending | Rejected)
- Total Events Created
- Website URL (optional)

### 1.4 ADMINS (Extends Users)
**Purpose:** Store admin user information

**Attributes:**
- Admin ID (Primary Key)
- User ID (Foreign Key → Users)
- Admin Name
- Role/Permission Level
- Department
- Created Date
- Status (Active | Inactive)

### 1.5 SKILLS (Lookup Table)
**Purpose:** Maintain predefined list of volunteer skills

**Attributes:**
- Skill ID (Primary Key)
- Skill Name (Teaching, Event Management, Fundraising, Social Media, Content Writing, Healthcare, Photography, Other)
- Description
- Active (Y/N)

### 1.6 VOLUNTEER_SKILLS (Junction Table)
**Purpose:** Track many-to-many relationship between volunteers and their skills

**Attributes:**
- Volunteer ID (Foreign Key → Volunteers)
- Skill ID (Foreign Key → Skills)
- Proficiency Level (Beginner | Intermediate | Advanced) - *optional*
- Added Date

### 1.7 AVAILABILITY (Lookup Table)
**Purpose:** Store availability types

**Attributes:**
- Availability ID (Primary Key)
- Availability Type (Weekdays | Weekends | Both)
- Description

### 1.8 VOLUNTEER_AVAILABILITY (Junction Table)
**Purpose:** Track volunteer availability preferences

**Attributes:**
- Volunteer ID (Foreign Key → Volunteers)
- Availability ID (Foreign Key → Availability)

### 1.9 EVENTS
**Purpose:** Store event information created by NGOs

**Attributes:**
- Event ID (Primary Key)
- NGO ID (Foreign Key → NGOs)
- Event Title/Name
- Description
- Category/Type (Environment, Education, Health, Relief, Cleanliness, etc.)
- Location
- City
- Start Date
- Start Time
- End Time
- Event Date
- Total Capacity (e.g., 50 volunteers)
- Volunteers Enrolled (Current count)
- Status (Open | Active | Upcoming | Completed | Cancelled)
- Created Date
- Updated Date
- Created By (Admin ID or NGO ID)

### 1.10 EVENT_APPLICATIONS
**Purpose:** Track volunteer applications for events

**Attributes:**
- Application ID (Primary Key)
- Event ID (Foreign Key → Events)
- Volunteer ID (Foreign Key → Volunteers)
- Application Date
- Application Time
- Status (Pending | Approved | Rejected | Withdrawn)
- Approved/Rejected By (Admin ID or NGO ID)
- Approval Date (nullable)
- Rejection Reason (nullable)
- Notes (optional)

### 1.11 VOLUNTEER_HISTORY
**Purpose:** Track completed volunteer participation

**Attributes:**
- History ID (Primary Key)
- Volunteer ID (Foreign Key → Volunteers)
- Event ID (Foreign Key → Events)
- Application ID (Foreign Key → Event_Applications)
- Hours Volunteered
- Completion Status (Attended | No-show | Withdrew)
- Completion Date
- Feedback/Notes (optional)
- Hours Logged Date

### 1.12 NOTIFICATIONS
**Purpose:** Store system notifications for users

**Attributes:**
- Notification ID (Primary Key)
- Recipient User ID (Foreign Key → Users)
- Notification Type (Event | Application | System | Message)
- Message
- Related Entity Type (Event | Application | Volunteer | NGO)
- Related Entity ID
- Read Status (Read | Unread)
- Created Date
- Read Date (nullable)
- Expires Date (nullable)

### 1.13 ACTIVITY_LOG
**Purpose:** Track user activities for audit and analytics

**Attributes:**
- Activity ID (Primary Key)
- User ID (Foreign Key → Users)
- Activity Type (Application Submitted | Application Approved | Application Rejected | Event Created | Event Updated | Event Cancelled | Profile Updated | Login | Logout)
- Description
- Related Entity Type (Event | Application | Volunteer | NGO)
- Related Entity ID
- Activity Date
- Activity Time
- IP Address (optional)
- Status (Success | Failed)

### 1.14 REVIEWS_RATINGS (Optional Future Enhancement)
**Purpose:** Store volunteer reviews and ratings

**Attributes:**
- Review ID (Primary Key)
- Volunteer ID (Foreign Key → Volunteers)
- Event ID (Foreign Key → Events)
- Rated By (NGO ID) (Foreign Key → NGOs)
- Rating (1-5 stars)
- Review Text (optional)
- Created Date

---

## 2. PRIMARY KEYS

| Table | Primary Key | Type | Auto-Increment |
|-------|-------------|------|-----------------|
| USERS | User_ID | NUMBER | Yes |
| VOLUNTEERS | Volunteer_ID | NUMBER | Yes |
| NGOS | NGO_ID | NUMBER | Yes |
| ADMINS | Admin_ID | NUMBER | Yes |
| SKILLS | Skill_ID | NUMBER | Yes |
| VOLUNTEER_SKILLS | Volunteer_ID + Skill_ID | Composite | No |
| AVAILABILITY | Availability_ID | NUMBER | Yes |
| VOLUNTEER_AVAILABILITY | Volunteer_ID + Availability_ID | Composite | No |
| EVENTS | Event_ID | NUMBER | Yes |
| EVENT_APPLICATIONS | Application_ID | NUMBER | Yes |
| VOLUNTEER_HISTORY | History_ID | NUMBER | Yes |
| NOTIFICATIONS | Notification_ID | NUMBER | Yes |
| ACTIVITY_LOG | Activity_ID | NUMBER | Yes |
| REVIEWS_RATINGS | Review_ID | NUMBER | Yes |

---

## 3. FOREIGN KEYS

| Table | Foreign Key | References | On Delete | On Update |
|-------|-------------|-----------|-----------|-----------|
| VOLUNTEERS | User_ID | USERS.User_ID | CASCADE | CASCADE |
| NGOS | User_ID | USERS.User_ID | CASCADE | CASCADE |
| ADMINS | User_ID | USERS.User_ID | CASCADE | CASCADE |
| VOLUNTEER_SKILLS | Volunteer_ID | VOLUNTEERS.Volunteer_ID | CASCADE | CASCADE |
| VOLUNTEER_SKILLS | Skill_ID | SKILLS.Skill_ID | RESTRICT | CASCADE |
| VOLUNTEER_AVAILABILITY | Volunteer_ID | VOLUNTEERS.Volunteer_ID | CASCADE | CASCADE |
| VOLUNTEER_AVAILABILITY | Availability_ID | AVAILABILITY.Availability_ID | RESTRICT | CASCADE |
| EVENTS | NGO_ID | NGOS.NGO_ID | CASCADE | CASCADE |
| EVENT_APPLICATIONS | Event_ID | EVENTS.Event_ID | CASCADE | CASCADE |
| EVENT_APPLICATIONS | Volunteer_ID | VOLUNTEERS.Volunteer_ID | CASCADE | CASCADE |
| VOLUNTEER_HISTORY | Volunteer_ID | VOLUNTEERS.Volunteer_ID | CASCADE | CASCADE |
| VOLUNTEER_HISTORY | Event_ID | EVENTS.Event_ID | CASCADE | CASCADE |
| VOLUNTEER_HISTORY | Application_ID | EVENT_APPLICATIONS.Application_ID | SET NULL | CASCADE |
| NOTIFICATIONS | Recipient_User_ID | USERS.User_ID | CASCADE | CASCADE |
| ACTIVITY_LOG | User_ID | USERS.User_ID | CASCADE | CASCADE |
| REVIEWS_RATINGS | Volunteer_ID | VOLUNTEERS.Volunteer_ID | CASCADE | CASCADE |
| REVIEWS_RATINGS | Event_ID | EVENTS.Event_ID | CASCADE | CASCADE |
| REVIEWS_RATINGS | Rated_By (NGO_ID) | NGOS.NGO_ID | CASCADE | CASCADE |

---

## 4. DATA RELATIONSHIPS

### 4.1 ONE-TO-ONE (1:1) RELATIONSHIPS

1. **USER ↔ VOLUNTEER**
   - One user account can be associated with one volunteer profile
   - When a volunteer user registers, a corresponding VOLUNTEER record is created

2. **USER ↔ NGO**
   - One user account can be associated with one NGO profile
   - When an NGO registers, a corresponding NGO record is created

3. **USER ↔ ADMIN**
   - One user account can be associated with one admin profile
   - Admin accounts are created by system administrators

---

### 4.2 ONE-TO-MANY (1:N) RELATIONSHIPS

1. **NGO → EVENTS** (1:Many)
   - One NGO creates multiple events
   - One event belongs to exactly one NGO
   - Cardinality: 1 NGO : N Events
   - Implementation: NGO_ID as Foreign Key in EVENTS

2. **EVENT → EVENT_APPLICATIONS** (1:Many)
   - One event has multiple volunteer applications
   - One application is for exactly one event
   - Cardinality: 1 Event : N Applications
   - Implementation: Event_ID as Foreign Key in EVENT_APPLICATIONS

3. **VOLUNTEER → EVENT_APPLICATIONS** (1:Many)
   - One volunteer can apply for multiple events
   - One application is from exactly one volunteer
   - Cardinality: 1 Volunteer : N Applications
   - Implementation: Volunteer_ID as Foreign Key in EVENT_APPLICATIONS

4. **VOLUNTEER → VOLUNTEER_HISTORY** (1:Many)
   - One volunteer has multiple history records
   - One history record belongs to exactly one volunteer
   - Cardinality: 1 Volunteer : N History Records

5. **EVENT → VOLUNTEER_HISTORY** (1:Many)
   - One event has multiple volunteer participation records
   - One history record is for exactly one event

6. **USER → NOTIFICATIONS** (1:Many)
   - One user receives multiple notifications
   - One notification is sent to exactly one user
   - Cardinality: 1 User : N Notifications
   - Implementation: Recipient_User_ID as Foreign Key in NOTIFICATIONS

7. **USER → ACTIVITY_LOG** (1:Many)
   - One user generates multiple activity records
   - One activity record is from exactly one user

8. **NGO → REVIEWS_RATINGS** (1:Many)
   - One NGO can give multiple reviews
   - Implementation: Rated_By (NGO_ID) in REVIEWS_RATINGS

---

### 4.3 MANY-TO-MANY (M:N) RELATIONSHIPS

1. **VOLUNTEER ↔ SKILLS** (Many:Many)
   - A volunteer can have multiple skills
   - A skill can be possessed by multiple volunteers
   - Junction Table: VOLUNTEER_SKILLS
   - Cardinality: N Volunteers : M Skills
   - Composite Primary Key: (Volunteer_ID, Skill_ID)

2. **VOLUNTEER ↔ AVAILABILITY** (Many:Many)
   - A volunteer can have multiple availability preferences
   - An availability type can apply to many volunteers
   - Junction Table: VOLUNTEER_AVAILABILITY
   - Cardinality: N Volunteers : M Availability Types
   - Composite Primary Key: (Volunteer_ID, Availability_ID)
   - Note: Given the frontend structure, a volunteer typically selects one availability (Weekdays | Weekends | Both), but database designed for potential future multi-select

3. **VOLUNTEER ↔ EVENTS** (Many:Many)
   - A volunteer can apply for multiple events
   - An event can have multiple volunteer applications
   - Junction Table: EVENT_APPLICATIONS (with additional attributes: Status, Date, etc.)
   - This is a bridge/join table with extra attributes beyond just the relationship
   - Cardinality: N Volunteers : M Events

4. **VOLUNTEER ↔ EVENTS (Historical)** (Many:Many)
   - A volunteer participates in multiple events
   - An event has multiple volunteers participating
   - Junction Table: VOLUNTEER_HISTORY
   - Cardinality: N Volunteers : M Events

---

## 5. UNIQUE CONSTRAINTS

| Table | Column(s) | Reason |
|-------|-----------|--------|
| USERS | Email | Each user must have unique email for login |
| SKILLS | Skill_Name | Prevent duplicate skill entries |
| AVAILABILITY | Availability_Type | Prevent duplicate availability types |
| VOLUNTEER_SKILLS | Volunteer_ID + Skill_ID | A volunteer should not have same skill listed twice |
| VOLUNTEER_AVAILABILITY | Volunteer_ID + Availability_ID | A volunteer should not have same availability listed twice |
| NGOS | User_ID | Each NGO account maps to one unique user |
| VOLUNTEERS | User_ID | Each volunteer account maps to one unique user |
| ADMINS | User_ID | Each admin account maps to one unique user |
| EVENT_APPLICATIONS | Event_ID + Volunteer_ID | A volunteer can only apply once per event |
| REVIEWS_RATINGS | Volunteer_ID + Event_ID + Rated_By | One review per volunteer per event per rater |

---

## 6. NOT NULL CONSTRAINTS

| Table | Column | Reason |
|-------|--------|--------|
| USERS | Email | Required for authentication |
| USERS | Password_Hash | Required for authentication |
| USERS | User_Type | Must specify user type |
| USERS | Created_Date | Track creation |
| VOLUNTEERS | User_ID | Must link to user account |
| VOLUNTEERS | Full_Name | Required for identification |
| VOLUNTEERS | Phone_Number | Required for contact |
| VOLUNTEERS | City | Required for location-based matching |
| NGOS | User_ID | Must link to user account |
| NGOS | Organization_Name | Required identification |
| NGOS | Phone_Number | Required for contact |
| NGOS | City | Required for location |
| EVENTS | NGO_ID | Must be created by an NGO |
| EVENTS | Event_Title | Required |
| EVENTS | Location | Required |
| EVENTS | City | Required for searching |
| EVENTS | Start_Date | Required |
| EVENTS | Total_Capacity | Required |
| EVENTS | Status | Required |
| EVENTS | Created_Date | Required |
| EVENT_APPLICATIONS | Event_ID | Required |
| EVENT_APPLICATIONS | Volunteer_ID | Required |
| EVENT_APPLICATIONS | Application_Date | Required |
| EVENT_APPLICATIONS | Status | Required |
| NOTIFICATIONS | Recipient_User_ID | Must have recipient |
| NOTIFICATIONS | Message | Must have message content |
| NOTIFICATIONS | Created_Date | Required |
| ACTIVITY_LOG | User_ID | Must have actor |
| ACTIVITY_LOG | Activity_Type | Required |
| ACTIVITY_LOG | Activity_Date | Required |
| VOLUNTEER_SKILLS | Volunteer_ID | Required |
| VOLUNTEER_SKILLS | Skill_ID | Required |

---

## 7. DATA TYPES & FIELD SPECIFICATIONS

### Authentication & User Management
```
USERS Table:
- User_ID: NUMBER(10) PRIMARY KEY AUTO_INCREMENT
- Email: VARCHAR2(100) UNIQUE NOT NULL
- Password_Hash: VARCHAR2(255) NOT NULL
- User_Type: VARCHAR2(20) NOT NULL (CHECK: Volunteer, NGO, Admin)
- Created_Date: TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
- Updated_Date: TIMESTAMP
- Account_Status: VARCHAR2(20) DEFAULT 'Active' (Active, Inactive, Suspended)
- Last_Login: TIMESTAMP
```

### Volunteer Profile
```
VOLUNTEERS Table:
- Volunteer_ID: NUMBER(10) PRIMARY KEY AUTO_INCREMENT
- User_ID: NUMBER(10) UNIQUE NOT NULL FOREIGN KEY
- Full_Name: VARCHAR2(100) NOT NULL
- Phone_Number: VARCHAR2(20) NOT NULL
- City: VARCHAR2(50) NOT NULL
- Profile_Photo_URL: VARCHAR2(500)
- Bio: VARCHAR2(1000)
- Joined_Date: DATE DEFAULT SYSDATE NOT NULL
- Volunteer_Hours: NUMBER(8,2) DEFAULT 0
- Total_Events_Completed: NUMBER(5) DEFAULT 0
- Rating: NUMBER(3,2) (1.00 to 5.00)
```

### NGO Profile
```
NGOS Table:
- NGO_ID: NUMBER(10) PRIMARY KEY AUTO_INCREMENT
- User_ID: NUMBER(10) UNIQUE NOT NULL FOREIGN KEY
- Organization_Name: VARCHAR2(150) NOT NULL
- Phone_Number: VARCHAR2(20) NOT NULL
- Contact_Person_Name: VARCHAR2(100)
- Address: VARCHAR2(200)
- City: VARCHAR2(50) NOT NULL
- Description: VARCHAR2(1000)
- Logo_URL: VARCHAR2(500)
- Registration_Date: DATE DEFAULT SYSDATE NOT NULL
- Verification_Status: VARCHAR2(20) DEFAULT 'Pending' (Verified, Pending, Rejected)
- Total_Events_Created: NUMBER(5) DEFAULT 0
- Website_URL: VARCHAR2(500)
```

### Events
```
EVENTS Table:
- Event_ID: NUMBER(10) PRIMARY KEY AUTO_INCREMENT
- NGO_ID: NUMBER(10) NOT NULL FOREIGN KEY
- Event_Title: VARCHAR2(200) NOT NULL
- Description: VARCHAR2(2000)
- Category: VARCHAR2(50) NOT NULL (Environment, Education, Health, Relief, Cleanliness, etc.)
- Location: VARCHAR2(200) NOT NULL
- City: VARCHAR2(50) NOT NULL
- Start_Date: DATE NOT NULL
- Start_Time: VARCHAR2(8) (HH:MM AM/PM format)
- End_Time: VARCHAR2(8)
- Total_Capacity: NUMBER(4) NOT NULL
- Volunteers_Enrolled: NUMBER(4) DEFAULT 0
- Status: VARCHAR2(20) DEFAULT 'Open' (Open, Active, Upcoming, Completed, Cancelled)
- Created_Date: TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
- Updated_Date: TIMESTAMP
- Created_By: NUMBER(10)
```

### Event Applications
```
EVENT_APPLICATIONS Table:
- Application_ID: NUMBER(10) PRIMARY KEY AUTO_INCREMENT
- Event_ID: NUMBER(10) NOT NULL FOREIGN KEY
- Volunteer_ID: NUMBER(10) NOT NULL FOREIGN KEY
- Application_Date: DATE NOT NULL
- Application_Time: VARCHAR2(8)
- Status: VARCHAR2(20) NOT NULL DEFAULT 'Pending' (Pending, Approved, Rejected, Withdrawn)
- Approved_Rejected_By: NUMBER(10)
- Approval_Date: DATE
- Rejection_Reason: VARCHAR2(500)
- Notes: VARCHAR2(500)
- UNIQUE(Event_ID, Volunteer_ID)
```

### Volunteer History
```
VOLUNTEER_HISTORY Table:
- History_ID: NUMBER(10) PRIMARY KEY AUTO_INCREMENT
- Volunteer_ID: NUMBER(10) NOT NULL FOREIGN KEY
- Event_ID: NUMBER(10) NOT NULL FOREIGN KEY
- Application_ID: NUMBER(10) FOREIGN KEY
- Hours_Volunteered: NUMBER(5,2) NOT NULL
- Completion_Status: VARCHAR2(20) NOT NULL (Attended, No-show, Withdrew)
- Completion_Date: DATE NOT NULL
- Feedback: VARCHAR2(1000)
- Hours_Logged_Date: DATE DEFAULT SYSDATE NOT NULL
```

### Skills & Availability
```
SKILLS Table:
- Skill_ID: NUMBER(5) PRIMARY KEY AUTO_INCREMENT
- Skill_Name: VARCHAR2(50) UNIQUE NOT NULL
- Description: VARCHAR2(300)
- Active: CHAR(1) DEFAULT 'Y'

VOLUNTEER_SKILLS Table:
- Volunteer_ID: NUMBER(10) NOT NULL FOREIGN KEY
- Skill_ID: NUMBER(5) NOT NULL FOREIGN KEY
- Proficiency_Level: VARCHAR2(20) (Beginner, Intermediate, Advanced)
- Added_Date: DATE DEFAULT SYSDATE
- PRIMARY KEY (Volunteer_ID, Skill_ID)

AVAILABILITY Table:
- Availability_ID: NUMBER(5) PRIMARY KEY
- Availability_Type: VARCHAR2(50) UNIQUE NOT NULL
- Description: VARCHAR2(200)

VOLUNTEER_AVAILABILITY Table:
- Volunteer_ID: NUMBER(10) NOT NULL FOREIGN KEY
- Availability_ID: NUMBER(5) NOT NULL FOREIGN KEY
- PRIMARY KEY (Volunteer_ID, Availability_ID)
```

### Notifications & Audit
```
NOTIFICATIONS Table:
- Notification_ID: NUMBER(10) PRIMARY KEY AUTO_INCREMENT
- Recipient_User_ID: NUMBER(10) NOT NULL FOREIGN KEY
- Notification_Type: VARCHAR2(50) NOT NULL
- Message: VARCHAR2(1000) NOT NULL
- Related_Entity_Type: VARCHAR2(50)
- Related_Entity_ID: NUMBER(10)
- Read_Status: VARCHAR2(20) DEFAULT 'Unread' (Read, Unread)
- Created_Date: TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
- Read_Date: TIMESTAMP
- Expires_Date: TIMESTAMP

ACTIVITY_LOG Table:
- Activity_ID: NUMBER(10) PRIMARY KEY AUTO_INCREMENT
- User_ID: NUMBER(10) NOT NULL FOREIGN KEY
- Activity_Type: VARCHAR2(50) NOT NULL
- Description: VARCHAR2(500)
- Related_Entity_Type: VARCHAR2(50)
- Related_Entity_ID: NUMBER(10)
- Activity_Date: DATE DEFAULT SYSDATE NOT NULL
- Activity_Time: VARCHAR2(8)
- IP_Address: VARCHAR2(45)
- Status: VARCHAR2(20) DEFAULT 'Success' (Success, Failed)
```

---

## 8. PROPOSED RELATIONAL DATABASE STRUCTURE

### Visual Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CORE ENTITIES                               │
└─────────────────────────────────────────────────────────────────────┘

                              ┌──────────┐
                              │  USERS   │
                              │──────────│
                              │User_ID(PK)
                              │Email(UNIQUE)
                              │Password_Hash
                              │User_Type
                              │Created_Date
                              │Account_Status
                              └──────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
                ▼                 ▼                 ▼
           ┌────────────┐   ┌──────────┐   ┌────────────┐
           │VOLUNTEERS  │   │NGOS      │   │ADMINS      │
           │────────────│   │──────────│   │────────────│
           │Volunteer_ID│   │NGO_ID    │   │Admin_ID    │
           │User_ID(FK) │   │User_ID(FK)   │User_ID(FK) │
           │Full_Name   │   │Org_Name  │   │Admin_Name  │
           │Phone       │   │Phone     │   │Role        │
           │City        │   │City      │   │Department  │
           │Hours       │   │Desc      │   │Status      │
           │Rating      │   │Status    │   │Created_Date│
           │Joined_Date │   │Website   │   │            │
           └────────────┘   └──────────┘   └────────────┘
                │                  │
                │                  │
                │         ┌────────┘
                │         │
                │         ▼
                │    ┌──────────┐
                │    │ EVENTS   │
                │    │──────────│
                │    │Event_ID(PK)
                │    │NGO_ID(FK)
                │    │Title
                │    │Description
                │    │Category
                │    │Location
                │    │City
                │    │Start_Date
                │    │Start_Time
                │    │End_Time
                │    │Capacity
                │    │Enrolled
                │    │Status
                │    │Created_Date
                │    └──────────┘
                │         │
                │         │
                │         ▼
                │    ┌────────────────────┐
                │    │EVENT_APPLICATIONS  │
                │    │────────────────────│
                │    │Application_ID(PK)
                │    │Event_ID(FK)
                ├───→│Volunteer_ID(FK)
                │    │Application_Date
                │    │Status
                │    │Approval_Date
                │    │Rejection_Reason
                │    └────────────────────┘
                │         │
                │         │
                │         ▼
                │    ┌────────────────────┐
                │    │VOLUNTEER_HISTORY   │
                │    │────────────────────│
                │    │History_ID(PK)
                │    │Volunteer_ID(FK)
                │    │Event_ID(FK)
                │    │Application_ID(FK)
                │    │Hours_Volunteered
                │    │Completion_Status
                │    │Completion_Date
                │    │Feedback
                │    └────────────────────┘
                │
                ├─────────────────────────────────┐
                │                                 │
                ▼                                 ▼
           ┌────────────────┐          ┌────────────────────┐
           │ VOLUNTEER_SKILLS│         │VOLUNTEER_AVAILABILITY
           │────────────────│          │────────────────────│
           │Volunteer_ID(FK)│          │Volunteer_ID(FK)
           │Skill_ID(FK)    │          │Availability_ID(FK)
           │Proficiency     │          │Added_Date
           │Added_Date      │          └────────────────────┘
           └────────────────┘                   ▲
                    │                           │
                    ▼                      ┌────────────┐
              ┌──────────┐                │AVAILABILITY
              │SKILLS    │                │────────────│
              │──────────│                │Availability_ID
              │Skill_ID  │                │Availability_Type
              │Skill_Name│                │Description
              │Desc      │                └────────────┘
              │Active    │
              └──────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    SUPPORTING ENTITIES                               │
└──────────────────────────────────────────────────────────────────────┘

        ┌────────────────┐              ┌─────────────────┐
        │ NOTIFICATIONS  │              │  ACTIVITY_LOG   │
        │────────────────│              │─────────────────│
        │Notification_ID │              │Activity_ID      │
        │Recipient_User_(FK)            │User_ID(FK)      │
        │Notification_Type              │Activity_Type    │
        │Message         │              │Description     │
        │Related_Entity  │              │Related_Entity   │
        │Read_Status     │              │Activity_Date    │
        │Created_Date    │              │Status           │
        │Read_Date       │              └─────────────────┘
        │Expires_Date    │
        └────────────────┘

        ┌──────────────────────┐
        │ REVIEWS_RATINGS      │
        │──────────────────────│
        │Review_ID(PK)
        │Volunteer_ID(FK)
        │Event_ID(FK)
        │Rated_By(NGO_ID)(FK)
        │Rating (1-5)
        │Review_Text
        │Created_Date
        └──────────────────────┘
```

---

## 9. KEY RELATIONSHIPS SUMMARY

### Critical Paths

1. **Volunteer Registration & Event Application Flow**
   - USERS → VOLUNTEERS → (VOLUNTEER_SKILLS + SKILLS) → (VOLUNTEER_AVAILABILITY + AVAILABILITY) → EVENT_APPLICATIONS → EVENTS

2. **NGO Event Management Flow**
   - USERS → NGOS → EVENTS → EVENT_APPLICATIONS → VOLUNTEERS

3. **Application Approval Flow**
   - EVENT_APPLICATIONS → (Approved_Rejected_By = ADMINS/NGOS) → VOLUNTEER_HISTORY

4. **Volunteer Experience Tracking**
   - VOLUNTEERS → VOLUNTEER_HISTORY → EVENTS → REVIEWS_RATINGS (NGO rating)

5. **Notification & Activity Flow**
   - USERS ← NOTIFICATIONS (1:N)
   - USERS → ACTIVITY_LOG (1:N)

---

## 10. INDEXING STRATEGY

**High-Priority Indexes (for frequent queries):**

1. **Authentication & Login**
   - `USERS(Email)` - UNIQUE INDEX for login queries
   - `USERS(User_Type)` - Search by user type

2. **Event Discovery**
   - `EVENTS(City, Status)` - Filter events by city and status
   - `EVENTS(Category)` - Filter by category
   - `EVENTS(Start_Date)` - Timeline queries
   - `EVENTS(NGO_ID)` - NGO's events

3. **Volunteer Matching**
   - `VOLUNTEER_SKILLS(Volunteer_ID)` - Retrieve volunteer skills
   - `VOLUNTEER_SKILLS(Skill_ID)` - Find volunteers with specific skill
   - `VOLUNTEER_AVAILABILITY(Volunteer_ID)` - Retrieve availability

4. **Application Queries**
   - `EVENT_APPLICATIONS(Event_ID)` - Applications for an event
   - `EVENT_APPLICATIONS(Volunteer_ID)` - Volunteer's applications
   - `EVENT_APPLICATIONS(Status)` - Filter by status
   - `EVENT_APPLICATIONS(Application_Date)` - Recent applications

5. **Notifications & Activity**
   - `NOTIFICATIONS(Recipient_User_ID, Read_Status)` - Unread notifications
   - `ACTIVITY_LOG(User_ID, Activity_Date)` - User activity timeline

6. **History & Completion**
   - `VOLUNTEER_HISTORY(Volunteer_ID)` - Volunteer's history
   - `VOLUNTEER_HISTORY(Event_ID)` - Event participants
   - `VOLUNTEER_HISTORY(Completion_Date)` - Recent completions

---

## 11. DATA INTEGRITY CONSTRAINTS

### Business Rules to Enforce

1. **User Validation**
   - Email must be unique across USERS table
   - User_Type must be one of: Volunteer, NGO, Admin
   - Account_Status must be Active to login

2. **Volunteer Constraints**
   - Phone number format validation (if applicable)
   - City must not be empty
   - Volunteer_Hours should be non-negative (default 0)
   - Total_Events_Completed should be non-negative
   - Rating should be between 1.00 and 5.00 (if populated)

3. **NGO Constraints**
   - Organization_Name must be unique
   - Verification_Status must be one of: Verified, Pending, Rejected
   - Can only create/manage EVENTS if Verification_Status = 'Verified'

4. **Event Constraints**
   - Start_Date cannot be in the past (for new events)
   - Start_Time and End_Time must be valid times
   - Total_Capacity must be > 0
   - Volunteers_Enrolled cannot exceed Total_Capacity
   - Status must follow valid transitions:
     - Open → Active → Completed
     - Any → Cancelled
   - Category must match predefined list

5. **Application Constraints**
   - A volunteer can only apply once per event (UNIQUE constraint)
   - Application_Date must be ≤ Event Start_Date
   - Status must be one of: Pending, Approved, Rejected, Withdrawn
   - If Status = Approved, Approval_Date must be populated
   - If Status = Rejected, Rejection_Reason should be populated

6. **Volunteer History Constraints**
   - Hours_Volunteered must be positive (> 0)
   - Completion_Date must be ≥ Event Start_Date
   - Completion_Status must be one of: Attended, No-show, Withdrew
   - Only completed/attended records should update Volunteer.Volunteer_Hours

7. **Notification Constraints**
   - Notification_Type must match predefined types
   - Created_Date must not be null
   - If Read_Status = 'Read', Read_Date must be populated
   - Expires_Date (if set) must be > Created_Date

8. **Activity Log Constraints**
   - Activity_Type must match predefined activity types
   - Status must be one of: Success, Failed
   - Activity_Date should be ≤ current date

9. **Referential Integrity**
   - Deleting a VOLUNTEER cascades to VOLUNTEER_SKILLS, VOLUNTEER_AVAILABILITY, EVENT_APPLICATIONS, VOLUNTEER_HISTORY
   - Deleting an NGO cascades to EVENTS and applications
   - Deleting an EVENT cascades to EVENT_APPLICATIONS and VOLUNTEER_HISTORY

---

## 12. LOOKUP/REFERENCE DATA

Data to be populated during system initialization:

### SKILLS (8 predefined skills from frontend)
1. Teaching
2. Event Management
3. Fundraising
4. Social Media
5. Content Writing
6. Healthcare
7. Photography
8. Other

### AVAILABILITY (3 options from frontend)
1. Weekdays
2. Weekends
3. Both

### EVENT_CATEGORIES (Observed from dashboard)
1. Environment
2. Education
3. Health
4. Relief
5. Cleanliness
6. (Extensible for future categories)

### USER_TYPES
1. Volunteer
2. NGO
3. Admin

### ACCOUNT_STATUS
1. Active
2. Inactive
3. Suspended

### NGO_VERIFICATION_STATUS
1. Verified
2. Pending
3. Rejected

### EVENT_STATUS
1. Open
2. Active
3. Upcoming
4. Completed
5. Cancelled

### APPLICATION_STATUS
1. Pending
2. Approved
3. Rejected
4. Withdrawn

### COMPLETION_STATUS
1. Attended
2. No-show
3. Withdrew

---

## 13. ESTIMATED DATA VOLUME & SCALABILITY

Based on frontend indicators showing:
- "120+ NGOs" (trust badges)
- "5,000+ volunteers" (trust badges)
- "2,500+ active volunteers" (dashboard badge)
- "180+ events this month" (dashboard badge)

**Estimated Record Counts:**

| Table | Estimated Rows | Growth Rate |
|-------|-----------------|------------|
| USERS | 5,500+ | High (new registrations) |
| VOLUNTEERS | 5,000+ | High |
| NGOS | 120+ | Medium |
| ADMINS | 20-50 | Low |
| EVENTS | 2,000+ | High (monthly growth) |
| EVENT_APPLICATIONS | 50,000+ | Very High |
| VOLUNTEER_HISTORY | 40,000+ | High |
| VOLUNTEER_SKILLS | 40,000+ | Medium |
| NOTIFICATIONS | 100,000+ | Very High |
| ACTIVITY_LOG | 500,000+ | Very High |

**Recommendation:** Use table partitioning for high-volume tables (EVENT_APPLICATIONS, VOLUNTEER_HISTORY, NOTIFICATIONS, ACTIVITY_LOG) by date/month for optimal query performance.

---

## 14. SECURITY & PRIVACY CONSIDERATIONS

1. **Password Storage**
   - Passwords must be hashed using bcrypt/PBKDF2 (minimum 8 characters)
   - Never store plain-text passwords

2. **Sensitive Data**
   - Phone numbers should be encrypted at rest
   - Email addresses should be encrypted if PII regulations apply

3. **Access Control**
   - NGOs can only view/manage their own events
   - Volunteers can only view/manage their own applications
   - Admins have full visibility

4. **Audit Trail**
   - All modifications tracked in ACTIVITY_LOG
   - Approval/rejection actions logged with operator ID

5. **Data Retention**
   - Implement soft deletes (archive vs. hard delete)
   - Comply with data retention policies for inactive users

---

## 15. SPECIAL NOTES

### Volunteer Hours Calculation
- `Volunteer.Volunteer_Hours` = SUM(VOLUNTEER_HISTORY.Hours_Volunteered WHERE Completion_Status = 'Attended')
- Consider materializing as a view or cached value for performance

### Application Cascade Logic
- When Volunteer applies for Event: Create EVENT_APPLICATION record
- When Application approved: Increment Event.Volunteers_Enrolled
- When Volunteer marks as attended: Create VOLUNTEER_HISTORY, increment Volunteer.Volunteer_Hours
- When Event completed: Update Event.Status, archive old records

### Future Enhancements (Not in current frontend)
- REVIEWS_RATINGS table structure included for future 5-star review system
- Messaging system (not yet visible in frontend)
- Group memberships (mentioned "joined volunteer group for education outreach" in activity log)
- Volunteer certifications/credentials
- Event completion reports and statistics

---

## 16. SUMMARY CHECKLIST

✅ **Identified Entities:** 14 tables (7 core + 7 supporting)  
✅ **Primary Keys:** Defined for all tables  
✅ **Foreign Keys:** Specified with referential integrity  
✅ **Relationships:** 
- 3 One-to-One (User↔Volunteer, User↔NGO, User↔Admin)
- 8 One-to-Many (NGO→Events, Event→Applications, etc.)
- 4 Many-to-Many (Volunteer↔Skills, Volunteer↔Availability, Volunteer↔Events)

✅ **Unique Constraints:** Applied to 9 fields/combinations  
✅ **NOT NULL Constraints:** Defined for 25+ critical fields  
✅ **Indexing Strategy:** High-priority indexes identified  
✅ **Data Integrity Rules:** 9 categories of business rules  
✅ **Lookup Data:** Predefined values for 7 reference tables  
✅ **Scalability:** Partitioning recommendations included  
✅ **Security:** Privacy and audit trail considerations noted  

---

## NEXT STEPS

1. ✅ Database requirements analysis complete
2. ⏳ **NEXT:** Review and approve database schema design
3. ⏳ Create Oracle CREATE TABLE statements
4. ⏳ Set up indexes and constraints
5. ⏳ Create views for common queries
6. ⏳ Populate reference/lookup data
7. ⏳ Create backend APIs for all operations
8. ⏳ Connect frontend to backend APIs

---

**Report Generated:** September 1, 2026  
**Analysis Status:** Complete - Ready for DB Schema Design Review  
**Recommendation:** Proceed to Oracle implementation phase

