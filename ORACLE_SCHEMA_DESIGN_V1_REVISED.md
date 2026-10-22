# SevaConnect NGO & Volunteer Management System
## Oracle Relational Schema Design - Version 1 (REVISED)

**Status:** Revised Schema - Ready for SQL Generation  
**Database:** Oracle Database  
**Date:** September 1, 2026  
**Revision:** Removed denormalized fields, simplified timestamps, FK corrections

---

## Overview

This document defines the revised Oracle relational schema for SevaConnect Version 1, comprising 10 core tables designed for a college project. All calculated fields have been removed; values will be computed via SQL queries when needed.

---

## TABLE SCHEMAS - FINAL VERSION

### 1. USERS
**Purpose:** Multi-role authentication and user account management

| Column | Data Type | Constraint | Default | Purpose |
|--------|-----------|-----------|---------|---------|
| User_ID | NUMBER(10) | PK, GENERATED ALWAYS AS IDENTITY | AUTO | System-generated unique identifier |
| Email | VARCHAR2(100) | UNIQUE, NOT NULL | | Login credential, must be globally unique |
| Password_Hash | VARCHAR2(255) | NOT NULL | | Hashed password (bcrypt/PBKDF2) |
| User_Type | VARCHAR2(20) | NOT NULL, CHECK (User_Type IN ('Volunteer','NGO','Admin')) | | Role determines system access |
| Account_Status | VARCHAR2(20) | CHECK (Account_Status IN ('Active','Inactive','Suspended')) | 'Active' | Controls account eligibility |
| Created_Date | TIMESTAMP | NOT NULL | SYSTIMESTAMP | Account creation datetime |
| Last_Login | TIMESTAMP | | NULL | Most recent successful login |

**Primary Key:** User_ID  
**Unique Constraints:** Email  
**Check Constraints:** User_Type IN ('Volunteer', 'NGO', 'Admin'), Account_Status IN ('Active', 'Inactive', 'Suspended')

**Notes:**
- Single table for all user types simplifies authentication
- Email is globally unique across all users
- Account_Status allows admins to disable accounts without deletion
- Last_Login tracks user activity

---

### 2. VOLUNTEERS
**Purpose:** Volunteer-specific profile information (1:1 extends Users)

| Column | Data Type | Constraint | Default | Purpose |
|--------|-----------|-----------|---------|---------|
| Volunteer_ID | NUMBER(10) | PK, GENERATED ALWAYS AS IDENTITY | AUTO | Unique volunteer identifier |
| User_ID | NUMBER(10) | UNIQUE, NOT NULL, FK→USERS(User_ID) ON DELETE CASCADE | | Links to user account |
| Full_Name | VARCHAR2(100) | NOT NULL | | Volunteer's full name |
| Phone_Number | VARCHAR2(20) | NOT NULL | | Contact phone number |
| City | VARCHAR2(50) | NOT NULL | | Location for event matching |
| Profile_Photo_URL | VARCHAR2(500) | | NULL | Optional profile picture URL |
| Bio | VARCHAR2(1000) | | NULL | Optional volunteer biography |
| Joined_Date | DATE | NOT NULL | SYSDATE | Registration date |

**Primary Key:** Volunteer_ID  
**Foreign Keys:** 
- User_ID → USERS(User_ID) ON DELETE CASCADE
- Referential Integrity: Deleting a User cascades to delete Volunteer

**Unique Constraints:** User_ID (enforces 1:1 relationship)

**Notes:**
- No calculated fields; Hours and event counts computed via queries
- Volunteer_Hours = SUM(VOLUNTEER_HISTORY.Hours_Volunteered WHERE Volunteer_ID = X AND Completion_Status = 'Attended')
- Total_Events_Completed = COUNT(VOLUNTEER_HISTORY WHERE Volunteer_ID = X AND Completion_Status IN ('Attended', 'No-show'))

---

### 3. NGOS
**Purpose:** NGO organization profile information (1:1 extends Users)

| Column | Data Type | Constraint | Default | Purpose |
|--------|-----------|-----------|---------|---------|
| NGO_ID | NUMBER(10) | PK, GENERATED ALWAYS AS IDENTITY | AUTO | Unique NGO identifier |
| User_ID | NUMBER(10) | UNIQUE, NOT NULL, FK→USERS(User_ID) ON DELETE CASCADE | | Links to user account |
| Organization_Name | VARCHAR2(150) | NOT NULL | | Official organization name |
| Phone_Number | VARCHAR2(20) | NOT NULL | | Organization contact number |
| Contact_Person_Name | VARCHAR2(100) | | NULL | Name of primary contact person |
| Address | VARCHAR2(200) | | NULL | Physical address |
| City | VARCHAR2(50) | NOT NULL | | City for operations and event creation |
| Description | VARCHAR2(1000) | | NULL | NGO mission statement/description |
| Logo_URL | VARCHAR2(500) | | NULL | Organization logo URL |
| Registration_Date | DATE | NOT NULL | SYSDATE | Organization registration date |
| Verification_Status | VARCHAR2(20) | CHECK (Verification_Status IN ('Verified','Pending','Rejected')) | 'Pending' | Admin approval status |

**Primary Key:** NGO_ID  
**Foreign Keys:**
- User_ID → USERS(User_ID) ON DELETE CASCADE
- Referential Integrity: Deleting a User cascades to delete NGO and associated Events

**Unique Constraints:** User_ID (enforces 1:1 relationship)

**Check Constraints:** Verification_Status IN ('Verified', 'Pending', 'Rejected')

**Notes:**
- No calculated field; Total_Events_Created computed via: COUNT(EVENTS WHERE NGO_ID = X)
- Business Rule (application enforced): Only Verified NGOs can create events

---

### 4. ADMINS
**Purpose:** Administrative user accounts (1:1 extends Users)

| Column | Data Type | Constraint | Default | Purpose |
|--------|-----------|-----------|---------|---------|
| Admin_ID | NUMBER(10) | PK, GENERATED ALWAYS AS IDENTITY | AUTO | Unique admin identifier |
| User_ID | NUMBER(10) | UNIQUE, NOT NULL, FK→USERS(User_ID) ON DELETE CASCADE | | Links to user account |
| Admin_Name | VARCHAR2(100) | NOT NULL | | Administrator's full name |
| Role | VARCHAR2(50) | NOT NULL | | Admin role/position (e.g., 'System Administrator', 'NGO Manager') |
| Department | VARCHAR2(100) | | NULL | Department assignment |
| Created_Date | DATE | NOT NULL | SYSDATE | Admin account creation date |
| Status | VARCHAR2(20) | CHECK (Status IN ('Active','Inactive')) | 'Active' | Admin account status |

**Primary Key:** Admin_ID  
**Foreign Keys:**
- User_ID → USERS(User_ID) ON DELETE CASCADE
- Referential Integrity: Deleting a User cascades to delete Admin

**Unique Constraints:** User_ID (enforces 1:1 relationship)

**Check Constraints:** Status IN ('Active', 'Inactive')

**Notes:**
- Admins can approve/reject NGO registrations and volunteer applications
- Admin_ID can approve/reject applications (referenced via USERS table)

---

### 5. SKILLS
**Purpose:** Predefined volunteer skills reference lookup table

| Column | Data Type | Constraint | Default | Purpose |
|--------|-----------|-----------|---------|---------|
| Skill_ID | NUMBER(5) | PK, GENERATED ALWAYS AS IDENTITY | AUTO | Unique skill identifier |
| Skill_Name | VARCHAR2(50) | UNIQUE, NOT NULL | | Skill name |
| Description | VARCHAR2(300) | | NULL | Skill description |
| Active | CHAR(1) | CHECK (Active IN ('Y','N')) | 'Y' | Skill active status |

**Primary Key:** Skill_ID  
**Unique Constraints:** Skill_Name

**Check Constraints:** Active IN ('Y', 'N')

**Predefined Reference Data (to be inserted):**
1. Teaching
2. Event Management
3. Fundraising
4. Social Media
5. Content Writing
6. Healthcare
7. Photography
8. Other

**Notes:**
- Static reference table
- Active flag allows deprecating skills without deleting historical associations
- Cannot be deleted if VOLUNTEER_SKILLS records reference it (RESTRICT on FK)

---

### 6. VOLUNTEER_SKILLS
**Purpose:** Many-to-many relationship between volunteers and their skills

| Column | Data Type | Constraint | Default | Purpose |
|--------|-----------|-----------|---------|---------|
| Volunteer_ID | NUMBER(10) | PK, FK→VOLUNTEERS(Volunteer_ID) ON DELETE CASCADE | | Identifies volunteer |
| Skill_ID | NUMBER(5) | PK, FK→SKILLS(Skill_ID) ON DELETE RESTRICT | | Identifies skill |
| Proficiency_Level | VARCHAR2(20) | CHECK (Proficiency_Level IN ('Beginner','Intermediate','Advanced')) | NULL | Optional skill proficiency |
| Added_Date | DATE | NOT NULL | SYSDATE | When skill was added to profile |

**Primary Key:** (Volunteer_ID, Skill_ID) - Composite Key

**Foreign Keys:**
- Volunteer_ID → VOLUNTEERS(Volunteer_ID) ON DELETE CASCADE
- Skill_ID → SKILLS(Skill_ID) ON DELETE RESTRICT

**Check Constraints:** Proficiency_Level IN ('Beginner', 'Intermediate', 'Advanced')

**Cascade Behavior:**
- DELETE Volunteer → DELETE all VOLUNTEER_SKILLS records
- Cannot DELETE Skill if it has VOLUNTEER_SKILLS associations

**Relationship Type:** Many-to-Many (N Volunteers : M Skills)

**Notes:**
- Composite PK naturally enforces one-skill-per-volunteer uniqueness
- Proficiency_Level is optional (can be NULL)

---

### 7. EVENTS
**Purpose:** Event information created and managed by NGOs

| Column | Data Type | Constraint | Default | Purpose |
|--------|-----------|-----------|---------|---------|
| Event_ID | NUMBER(10) | PK, GENERATED ALWAYS AS IDENTITY | AUTO | Unique event identifier |
| NGO_ID | NUMBER(10) | NOT NULL, FK→NGOS(NGO_ID) ON DELETE CASCADE | | Creating organization |
| Event_Title | VARCHAR2(200) | NOT NULL | | Event name/title |
| Description | VARCHAR2(2000) | | NULL | Event details/description |
| Category | VARCHAR2(50) | NOT NULL | | Event type/category |
| Location | VARCHAR2(200) | NOT NULL | | Physical location/venue |
| City | VARCHAR2(50) | NOT NULL | | City (for searching/filtering) |
| Start_Date_Time | TIMESTAMP | NOT NULL | | Event start date and time |
| End_Date_Time | TIMESTAMP | NOT NULL | | Event end date and time |
| Total_Capacity | NUMBER(4) | NOT NULL, CHECK (Total_Capacity > 0) | | Maximum volunteer slots |
| Status | VARCHAR2(20) | CHECK (Status IN ('Open','Active','Upcoming','Completed','Cancelled')) | 'Open' | Event lifecycle status |
| Created_Date | TIMESTAMP | NOT NULL | SYSTIMESTAMP | Event creation datetime |
| Updated_Date | TIMESTAMP | | NULL | Last modification datetime |

**Primary Key:** Event_ID  
**Foreign Keys:**
- NGO_ID → NGOS(NGO_ID) ON DELETE CASCADE

**Check Constraints:** 
- Total_Capacity > 0
- Status IN ('Open', 'Active', 'Upcoming', 'Completed', 'Cancelled')

**Notes:**
- No Volunteers_Enrolled field; calculated via: COUNT(EVENT_APPLICATIONS WHERE Event_ID = X AND Status = 'Approved')
- Start_Date_Time and End_Date_Time use TIMESTAMP for precision
- Business Rule (application enforced): Event.End_Date_Time must be > Event.Start_Date_Time
- Business Rule (application enforced): Only Verified NGOs can create events
- Business Rule (application enforced): Approved applications should not exceed Total_Capacity

---

### 8. EVENT_APPLICATIONS
**Purpose:** Track volunteer applications to events with approval workflow

| Column | Data Type | Constraint | Default | Purpose |
|--------|-----------|-----------|---------|---------|
| Application_ID | NUMBER(10) | PK, GENERATED ALWAYS AS IDENTITY | AUTO | Unique application identifier |
| Event_ID | NUMBER(10) | NOT NULL, FK→EVENTS(Event_ID) ON DELETE CASCADE | | Event being applied for |
| Volunteer_ID | NUMBER(10) | NOT NULL, FK→VOLUNTEERS(Volunteer_ID) ON DELETE CASCADE | | Volunteer applying |
| Application_Date | TIMESTAMP | NOT NULL | SYSTIMESTAMP | Application submission datetime |
| Status | VARCHAR2(20) | NOT NULL, CHECK (Status IN ('Pending','Approved','Rejected','Withdrawn')) | 'Pending' | Application status |
| Reviewed_By_User_ID | NUMBER(10) | | NULL, FK→USERS(User_ID) ON DELETE SET NULL | User who approved/rejected (Admin or NGO) |
| Approval_Date | DATE | | NULL | Date decision was made |
| Rejection_Reason | VARCHAR2(500) | | NULL | Reason if status is Rejected |
| Notes | VARCHAR2(500) | | NULL | Additional notes |

**Primary Key:** Application_ID  
**Foreign Keys:**
- Event_ID → EVENTS(Event_ID) ON DELETE CASCADE
- Volunteer_ID → VOLUNTEERS(Volunteer_ID) ON DELETE CASCADE
- Reviewed_By_User_ID → USERS(User_ID) ON DELETE SET NULL

**Unique Constraints:** UNIQUE(Event_ID, Volunteer_ID) - One application per volunteer per event

**Check Constraints:** Status IN ('Pending', 'Approved', 'Rejected', 'Withdrawn')

**Cascade Behavior:**
- DELETE Event → DELETE all applications for that event
- DELETE Volunteer → DELETE all applications from that volunteer
- DELETE User → SET Reviewed_By_User_ID to NULL (preserves application record)

**Relationship Type:** Many-to-Many (N Volunteers : M Events) with additional attributes

**Business Rules (application enforced):**
- A volunteer cannot apply twice to the same event (enforced by UNIQUE constraint)
- Application_Date should be ≤ Event.Start_Date_Time
- Status transitions: Pending → Approved | Rejected | Withdrawn
- If Status = 'Approved', Approval_Date must be populated
- If Status = 'Rejected', Rejection_Reason should be populated
- Reviewed_By_User_ID must be either an ADMIN or the NGO owning the event
- NGO can only review applications for its own events

**Notes:**
- Reviewed_By_User_ID references USERS table (stores both Admin and NGO users)
- Application logic enforces that reviewer is either Admin or owning NGO

---

### 9. VOLUNTEER_HISTORY
**Purpose:** Track completed volunteer participation in events

| Column | Data Type | Constraint | Default | Purpose |
|--------|-----------|-----------|---------|---------|
| History_ID | NUMBER(10) | PK, GENERATED ALWAYS AS IDENTITY | AUTO | Unique history record ID |
| Volunteer_ID | NUMBER(10) | NOT NULL, FK→VOLUNTEERS(Volunteer_ID) ON DELETE CASCADE | | Volunteer participating |
| Event_ID | NUMBER(10) | NOT NULL, FK→EVENTS(Event_ID) ON DELETE CASCADE | | Event participated in |
| Application_ID | NUMBER(10) | | NULL, FK→EVENT_APPLICATIONS(Application_ID) ON DELETE SET NULL | Reference to application record |
| Hours_Volunteered | NUMBER(5,2) | NOT NULL, CHECK (Hours_Volunteered > 0) | | Hours contributed |
| Completion_Status | VARCHAR2(20) | NOT NULL, CHECK (Completion_Status IN ('Attended','No-show','Withdrew')) | | Participation outcome |
| Completion_Date | DATE | NOT NULL | | Date of participation/event |
| Feedback | VARCHAR2(1000) | | NULL | NGO feedback on volunteer performance |
| Hours_Logged_Date | DATE | NOT NULL | SYSDATE | When hours were logged in system |

**Primary Key:** History_ID  
**Foreign Keys:**
- Volunteer_ID → VOLUNTEERS(Volunteer_ID) ON DELETE CASCADE
- Event_ID → EVENTS(Event_ID) ON DELETE CASCADE
- Application_ID → EVENT_APPLICATIONS(Application_ID) ON DELETE SET NULL

**Check Constraints:**
- Hours_Volunteered > 0
- Completion_Status IN ('Attended', 'No-show', 'Withdrew')

**Cascade Behavior:**
- DELETE Volunteer → DELETE all history records
- DELETE Event → DELETE all history records for that event
- DELETE Application → SET Application_ID to NULL

**Business Rules (application enforced):**
- Hours_Volunteered must be positive
- Completion_Date must be ≥ Event.Start_Date_Time
- Completion_Status = 'Attended' records count toward Volunteer_Hours
- Completion_Status = 'No-show' or 'Withdrew' do NOT count toward Volunteer_Hours

**Calculated Values (via queries):**
- VOLUNTEERS.Volunteer_Hours = SUM(Hours_Volunteered WHERE Completion_Status = 'Attended')
- VOLUNTEERS.Total_Events_Completed = COUNT(History records WHERE Completion_Status IN ('Attended', 'No-show'))

**Notes:**
- Used to calculate volunteer hours and event completion statistics
- Application logic filters by Completion_Status when calculating hours

---

### 10. NOTIFICATIONS
**Purpose:** System notifications sent to users

| Column | Data Type | Constraint | Default | Purpose |
|--------|-----------|-----------|---------|---------|
| Notification_ID | NUMBER(10) | PK, GENERATED ALWAYS AS IDENTITY | AUTO | Unique notification ID |
| Recipient_User_ID | NUMBER(10) | NOT NULL, FK→USERS(User_ID) ON DELETE CASCADE | | User receiving notification |
| Notification_Type | VARCHAR2(50) | NOT NULL | | Type of notification |
| Message | VARCHAR2(1000) | NOT NULL | | Notification message content |
| Related_Entity_Type | VARCHAR2(50) | | NULL | Type of related entity |
| Related_Entity_ID | NUMBER(10) | | NULL | ID of related entity |
| Read_Status | VARCHAR2(20) | NOT NULL, CHECK (Read_Status IN ('Read','Unread')) | 'Unread' | Notification read status |
| Created_Date | TIMESTAMP | NOT NULL | SYSTIMESTAMP | Notification creation datetime |
| Read_Date | TIMESTAMP | | NULL | When notification was read |
| Expires_Date | TIMESTAMP | | NULL | Optional expiration datetime |

**Primary Key:** Notification_ID  
**Foreign Keys:**
- Recipient_User_ID → USERS(User_ID) ON DELETE CASCADE

**Check Constraints:** Read_Status IN ('Read', 'Unread')

**Cascade Behavior:**
- DELETE User → DELETE all notifications for that user

**Business Rules (application enforced):**
- Notification_Type should be from predefined list (Event, Application, System, Message)
- If Read_Status = 'Read', Read_Date must be populated
- If Read_Status = 'Unread', Read_Date should be NULL
- Expires_Date (if provided) should be > Created_Date
- Related_Entity_Type and Related_Entity_ID should be consistent

**Notification Types:**
- Event (new event created, event cancelled, etc.)
- Application (application submitted, approved, rejected, etc.)
- System (system announcements, maintenance notices, etc.)
- Message (inter-user messages)

**Notes:**
- Supports flexible notification types via string Notification_Type
- Read_Date tracks when user marked notification as read
- Expires_Date allows automatic notification cleanup

---

## SUMMARY: 10 CORE TABLES

| Table | PK | FKs | Relationships | Rows |
|-------|----|----|---------------|------|
| USERS | User_ID | None | Parent: VOLUNTEERS, NGOS, ADMINS, NOTIFICATIONS | 5,500+ |
| VOLUNTEERS | Volunteer_ID | User_ID | Parent: VOLUNTEER_SKILLS, EVENT_APPLICATIONS, VOLUNTEER_HISTORY | 5,000+ |
| NGOS | NGO_ID | User_ID | Parent: EVENTS | 120+ |
| ADMINS | Admin_ID | User_ID | Can review applications | 20-50 |
| SKILLS | Skill_ID | None | Parent: VOLUNTEER_SKILLS | 8 |
| VOLUNTEER_SKILLS | (Vol_ID, Skill_ID) | Volunteer_ID, Skill_ID | M:M VOLUNTEERS ↔ SKILLS | 40,000+ |
| EVENTS | Event_ID | NGO_ID | Parent: EVENT_APPLICATIONS, VOLUNTEER_HISTORY | 2,000+ |
| EVENT_APPLICATIONS | Application_ID | Event_ID, Volunteer_ID, Reviewed_By_User_ID | M:M bridge with status | 50,000+ |
| VOLUNTEER_HISTORY | History_ID | Volunteer_ID, Event_ID, Application_ID | Participation tracking | 40,000+ |
| NOTIFICATIONS | Notification_ID | Recipient_User_ID | User notifications | 100,000+ |

---

## RELATIONSHIPS SUMMARY

### One-to-One (1:1) Relationships

1. **USER ↔ VOLUNTEER**
   - PK: VOLUNTEERS.User_ID (UNIQUE, FK)
   - Cardinality: 1 User : 1 Volunteer
   - Cascade: DELETE User → DELETE Volunteer

2. **USER ↔ NGO**
   - PK: NGOS.User_ID (UNIQUE, FK)
   - Cardinality: 1 User : 1 NGO
   - Cascade: DELETE User → DELETE NGO

3. **USER ↔ ADMIN**
   - PK: ADMINS.User_ID (UNIQUE, FK)
   - Cardinality: 1 User : 1 Admin
   - Cascade: DELETE User → DELETE Admin

---

### One-to-Many (1:N) Relationships

1. **NGOS → EVENTS** (1:N)
   - FK: EVENTS.NGO_ID → NGOS.NGO_ID
   - Cardinality: 1 NGO : N Events
   - Cascade: DELETE NGO → DELETE all Events

2. **EVENTS → EVENT_APPLICATIONS** (1:N)
   - FK: EVENT_APPLICATIONS.Event_ID → EVENTS.Event_ID
   - Cardinality: 1 Event : N Applications
   - Cascade: DELETE Event → DELETE all Applications

3. **VOLUNTEERS → EVENT_APPLICATIONS** (1:N)
   - FK: EVENT_APPLICATIONS.Volunteer_ID → VOLUNTEERS.Volunteer_ID
   - Cardinality: 1 Volunteer : N Applications
   - Cascade: DELETE Volunteer → DELETE all Applications

4. **VOLUNTEERS → VOLUNTEER_HISTORY** (1:N)
   - FK: VOLUNTEER_HISTORY.Volunteer_ID → VOLUNTEERS.Volunteer_ID
   - Cardinality: 1 Volunteer : N History Records
   - Cascade: DELETE Volunteer → DELETE all History

5. **EVENTS → VOLUNTEER_HISTORY** (1:N)
   - FK: VOLUNTEER_HISTORY.Event_ID → EVENTS.Event_ID
   - Cardinality: 1 Event : N History Records
   - Cascade: DELETE Event → DELETE all History

6. **VOLUNTEERS → VOLUNTEER_SKILLS** (1:N)
   - FK: VOLUNTEER_SKILLS.Volunteer_ID → VOLUNTEERS.Volunteer_ID
   - Cardinality: 1 Volunteer : N Skills
   - Cascade: DELETE Volunteer → DELETE all Skills

7. **SKILLS → VOLUNTEER_SKILLS** (1:N)
   - FK: VOLUNTEER_SKILLS.Skill_ID → SKILLS.Skill_ID
   - Cardinality: 1 Skill : N Volunteer Associations
   - Cascade: Cannot DELETE Skill if associated (RESTRICT)

8. **USERS → NOTIFICATIONS** (1:N)
   - FK: NOTIFICATIONS.Recipient_User_ID → USERS.User_ID
   - Cardinality: 1 User : N Notifications
   - Cascade: DELETE User → DELETE all Notifications

9. **USERS → EVENT_APPLICATIONS (Reviewer)** (1:N)
   - FK: EVENT_APPLICATIONS.Reviewed_By_User_ID → USERS.User_ID
   - Cardinality: 1 User (Admin or NGO) : N Reviews
   - Cascade: DELETE User → SET Reviewed_By_User_ID to NULL

---

### Many-to-Many (M:N) Relationships

1. **VOLUNTEERS ↔ SKILLS** (Many:Many)
   - Junction Table: VOLUNTEER_SKILLS
   - Composite PK: (Volunteer_ID, Skill_ID)
   - Cardinality: N Volunteers : M Skills
   - Example: Volunteer 1 has [Teaching, Event Management]; Volunteer 2 has [Healthcare, Teaching]

2. **VOLUNTEERS ↔ EVENTS (Applications)** (Many:Many)
   - Junction Table: EVENT_APPLICATIONS
   - PK: Application_ID
   - Cardinality: N Volunteers : M Events
   - Example: Volunteer 1 applies to [Event A, Event B]; Volunteer 2,3 apply to Event A

3. **VOLUNTEERS ↔ EVENTS (History)** (Many:Many)
   - Junction Table: VOLUNTEER_HISTORY
   - PK: History_ID
   - Cardinality: N Volunteers : M Events
   - Example: Volunteer 1 participated in [Event A, Event B]; Volunteer 2,3 participated in Event A

---

## FIELDS NOT STORED (CALCULATED VIA QUERIES)

| Field | Table | Query |
|-------|-------|-------|
| Volunteer_Hours | VOLUNTEERS | `SUM(VOLUNTEER_HISTORY.Hours_Volunteered WHERE Volunteer_ID = X AND Completion_Status = 'Attended')` |
| Total_Events_Completed | VOLUNTEERS | `COUNT(VOLUNTEER_HISTORY WHERE Volunteer_ID = X AND Completion_Status IN ('Attended', 'No-show'))` |
| Total_Events_Created | NGOS | `COUNT(EVENTS WHERE NGO_ID = X)` |
| Volunteers_Enrolled | EVENTS | `COUNT(EVENT_APPLICATIONS WHERE Event_ID = X AND Status = 'Approved')` |

**Rationale:** Denormalization removed to simplify schema. These aggregate values can be calculated via efficient SQL queries when needed. Storing them would require triggers/views to keep consistent.

---

## BUSINESS RULES (APPLICATION LOGIC)

Rules that CANNOT be enforced by database constraints alone and must be handled by backend:

1. **NGO Verification**
   - Only NGOs with Verification_Status = 'Verified' can create events
   - Admins approve NGO registrations

2. **Application Uniqueness**
   - A volunteer cannot apply twice to the same event
   - (Enforced by UNIQUE constraint on (Event_ID, Volunteer_ID))

3. **Application Review**
   - Only an ADMIN or the NGO that owns the event can review/approve/reject an application
   - Reviewed_By_User_ID must reference a User that is either:
     - An ADMIN (User_ID exists in ADMINS table), or
     - An NGO owning the event (User_ID exists in NGOS, and NGOS.NGO_ID owns the Event)

4. **Capacity Constraints**
   - Approved applications should not exceed Event.Total_Capacity
   - Application logic must check: COUNT(Approved applications) < Total_Capacity before approving

5. **Application Workflow**
   - Application Status: Pending → Approved | Rejected | Withdrawn
   - If Status = 'Approved': Approval_Date must be populated
   - If Status = 'Rejected': Rejection_Reason should be populated

6. **Notification Management**
   - If Read_Status = 'Read': Read_Date must be populated
   - If Read_Status = 'Unread': Read_Date should be NULL

7. **Event Date Validation**
   - End_Date_Time must be > Start_Date_Time
   - Application_Date should be ≤ Event.Start_Date_Time

8. **Volunteer Hours Calculation**
   - Only VOLUNTEER_HISTORY records with Completion_Status = 'Attended' count toward Volunteer_Hours
   - Records with 'No-show' or 'Withdrew' do not accumulate hours

---

## ENTITY RELATIONSHIP DIAGRAM - FINAL

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          USERS (Auth Hub)                               │
│ ┌────────────────────────────────────────────────────────────────────┐  │
│ │ User_ID (PK) │ Email (UNIQUE) │ Password │ User_Type │ Status    │  │
│ └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
         │
    ┌────┼────┬─────────────────┐
    │    │    │                 │
 1:1│ 1:1│ 1:1│                 │1:N
    │    │    │                 │
    ▼    ▼    ▼                 ▼
┌────────┐ ┌─────┐ ┌────────┐ ┌─────────────────┐
│VOLUNTEERS│ │NGOS │ │ADMINS │ │ NOTIFICATIONS   │
└────────┘ └─────┘ └────────┘ └─────────────────┘
    │         │        │
    │ 1:N     │ 1:N    │
    │         │        │
    │     ┌───┘        │
    │     │            │
    │     ▼            │
    │  ┌──────────┐    │
    │  │ EVENTS   │    │
    │  └──────────┘    │
    │     │            │
    │     │ 1:N        │
    │     │            │
    │  ┌──────────────────┐
    │  │EVENT_APPLICATIONS │◄────┐
    │  └──────────────────┘      │
    │     │     │                │
    │     │ 1:N │ 1:N            │ M:M bridge
    │     │     │                │ with Status
    │  ┌──────────────────┐      │
    │  │ VOLUNTEER_HISTORY│──────┘
    │  └──────────────────┘
    │
    │ 1:N
    ▼
┌────────────────────┐
│ VOLUNTEER_SKILLS   │
│ (Composite PK)     │ M:M
└────────────────────┘
    │
    │ FK
    ▼
┌────────────────┐
│ SKILLS         │
│ (Reference)    │
└────────────────┘


DETAILED RELATIONSHIPS:

USERS (Multi-role Hub)
├── 1:1 ──> VOLUNTEERS (User_ID FK, UNIQUE, CASCADE)
├── 1:1 ──> NGOS (User_ID FK, UNIQUE, CASCADE)
├── 1:1 ──> ADMINS (User_ID FK, UNIQUE, CASCADE)
└── 1:N ──> NOTIFICATIONS (Recipient_User_ID FK, CASCADE)

VOLUNTEERS
├── 1:N ──> VOLUNTEER_SKILLS (Volunteer_ID FK, CASCADE)
└── 1:N ──> EVENT_APPLICATIONS (Volunteer_ID FK, CASCADE)

NGOS
└── 1:N ──> EVENTS (NGO_ID FK, CASCADE)

EVENTS
└── 1:N ──> EVENT_APPLICATIONS (Event_ID FK, CASCADE)
└── 1:N ──> VOLUNTEER_HISTORY (Event_ID FK, CASCADE)

EVENT_APPLICATIONS
├── FK ──> EVENTS (Event_ID, CASCADE)
├── FK ──> VOLUNTEERS (Volunteer_ID, CASCADE)
└── FK ──> USERS (Reviewed_By_User_ID, SET NULL) [Admin or NGO reviewer]

VOLUNTEER_HISTORY
├── FK ──> VOLUNTEERS (Volunteer_ID, CASCADE)
├── FK ──> EVENTS (Event_ID, CASCADE)
└── FK ──> EVENT_APPLICATIONS (Application_ID, SET NULL)

VOLUNTEER_SKILLS
├── FK ──> VOLUNTEERS (Volunteer_ID, CASCADE)
└── FK ──> SKILLS (Skill_ID, RESTRICT)

SKILLS
└── Referenced by VOLUNTEER_SKILLS (cannot delete if in use)
```

---

## ORACLE DATA TYPE REFERENCE

| Data Type | Usage | Example |
|-----------|-------|---------|
| NUMBER(10) GENERATED ALWAYS AS IDENTITY | Auto-increment primary keys | User_ID, Event_ID |
| NUMBER(5) GENERATED ALWAYS AS IDENTITY | Auto-increment for small tables | Skill_ID |
| NUMBER(10) | Foreign keys to 10-digit tables | FK references |
| NUMBER(4) | Small integers (capacity, counts) | Total_Capacity |
| NUMBER(5,2) | Decimal with 2 places (hours) | Hours_Volunteered |
| VARCHAR2(n) | Variable-length strings | Names, descriptions, URLs |
| CHAR(1) | Single character flags | Active flag (Y/N) |
| DATE | Date only (no time) | Joined_Date, Completion_Date |
| TIMESTAMP | Date and time with milliseconds | Created_Date, Start_Date_Time |

---

## ORACLE CONSTRAINTS USED

| Constraint | Usage | Examples |
|-----------|-------|----------|
| PRIMARY KEY | Unique row identifier | GENERATED ALWAYS AS IDENTITY |
| UNIQUE | Enforce unique values | Email, Skill_Name, (Event_ID, Volunteer_ID) |
| FOREIGN KEY | Referential integrity | User_ID → USERS, NGO_ID → NGOS |
| NOT NULL | Mandatory fields | Email, Password_Hash, Full_Name |
| CHECK | Valid value ranges | User_Type IN ('Volunteer','NGO','Admin') |
| DEFAULT | Auto-assign values | SYSTIMESTAMP, SYSDATE, 'Active' |
| ON DELETE CASCADE | Child records deleted | VOLUNTEERS when USERS deleted |
| ON DELETE SET NULL | Clear FK, keep record | Reviewed_By_User_ID set NULL |
| ON DELETE RESTRICT | Prevent deletion | Cannot delete SKILLS in use |

---

## NEXT STEPS

✅ Revised schema design complete (10 tables, no denormalization)  
✅ Calculated fields removed  
✅ Timestamps simplified (Start_Date_Time, End_Date_Time, Application_Date)  
✅ FK corrected (Reviewed_By_User_ID instead of Approved_Rejected_By)  
✅ All Oracle data types and constraints specified  
✅ Business rules documented  

⏳ **AWAITING:** User approval of revised schema  
⏳ Generate Oracle CREATE TABLE statements  
⏳ Create indexes and constraints  
⏳ Populate reference data (SKILLS table)  
⏳ Create supporting views/functions for calculated fields  
⏳ Connect to Oracle database  

