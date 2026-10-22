-- Additive SEVAconnect review storage. Apply once to sevaconnect.
-- VOLUNTEER_HISTORY.Feedback remains NGO-to-volunteer feedback.
CREATE TABLE IF NOT EXISTS VOLUNTEER_REVIEWS (
    Review_ID INT NOT NULL AUTO_INCREMENT,
    Event_ID INT NOT NULL,
    Volunteer_ID INT NOT NULL,
    Application_ID INT NULL,
    Rating TINYINT NOT NULL,
    Comments VARCHAR(1000) NULL,
    Created_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (Review_ID),
    UNIQUE KEY uq_volunteer_reviews_application (Application_ID),
    UNIQUE KEY uq_volunteer_reviews_volunteer_event (Volunteer_ID, Event_ID),
    KEY idx_volunteer_reviews_event (Event_ID),
    KEY idx_volunteer_reviews_volunteer (Volunteer_ID),
    CONSTRAINT fk_volunteer_reviews_event FOREIGN KEY (Event_ID) REFERENCES EVENTS (Event_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_volunteer_reviews_volunteer FOREIGN KEY (Volunteer_ID) REFERENCES VOLUNTEERS (Volunteer_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_volunteer_reviews_application FOREIGN KEY (Application_ID) REFERENCES EVENT_APPLICATIONS (Application_ID) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_volunteer_reviews_rating CHECK (Rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;
