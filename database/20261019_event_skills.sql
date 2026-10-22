-- SEVAconnect additive migration: required skills for events.
-- Run once against the configured sevaconnect database after backing it up.
-- This only creates a join table; existing events and applications are untouched.
CREATE TABLE IF NOT EXISTS EVENT_SKILLS (
    Event_ID INT NOT NULL,
    Skill_ID INT NOT NULL,
    PRIMARY KEY (Event_ID, Skill_ID),
    KEY idx_event_skills_skill (Skill_ID),
    CONSTRAINT fk_event_skills_event
        FOREIGN KEY (Event_ID) REFERENCES EVENTS (Event_ID)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_event_skills_skill
        FOREIGN KEY (Skill_ID) REFERENCES SKILLS (Skill_ID)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;
