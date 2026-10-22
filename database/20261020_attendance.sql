-- Additive SEVAconnect attendance storage. Apply once to sevaconnect.
-- Existing events, applications, profiles, and volunteer history are preserved.
CREATE TABLE IF NOT EXISTS EVENT_ATTENDANCE (
    Attendance_ID INT NOT NULL AUTO_INCREMENT,
    Event_ID INT NOT NULL,
    Volunteer_ID INT NOT NULL,
    Application_ID INT NOT NULL,
    Status ENUM('Present', 'Absent') NOT NULL,
    Recorded_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (Attendance_ID),
    UNIQUE KEY uq_event_attendance_application (Application_ID),
    KEY idx_event_attendance_event_status (Event_ID, Status),
    KEY idx_event_attendance_volunteer (Volunteer_ID),
    CONSTRAINT fk_event_attendance_event FOREIGN KEY (Event_ID) REFERENCES EVENTS (Event_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_event_attendance_volunteer FOREIGN KEY (Volunteer_ID) REFERENCES VOLUNTEERS (Volunteer_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_event_attendance_application FOREIGN KEY (Application_ID) REFERENCES EVENT_APPLICATIONS (Application_ID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
