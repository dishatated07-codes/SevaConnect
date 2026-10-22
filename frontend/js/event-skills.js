document.addEventListener("DOMContentLoaded", () => {
  const apiBase = "http://localhost:5000/api";
  const isVolunteer = () => localStorage.getItem("userType") === "Volunteer" && Boolean(localStorage.getItem("authToken"));
  const textElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  };
  const addMatch = (event, card) => {
    if (!isVolunteer() || !event.skillMatch || card.querySelector("[data-skill-match-card]")) return;
    const match = event.skillMatch;
    const indicator = document.createElement("div");
    indicator.className = "skill-match";
    indicator.dataset.skillMatchCard = "true";
    if (match.percentage == null) {
      indicator.textContent = match.message || "No specific skills required";
    } else {
      indicator.append(document.createTextNode(`Skill match: ${match.percentage}%`));
      const matched = (match.matchedSkills || []).map((skill) => skill.name);
      const missing = (match.missingSkills || []).map((skill) => skill.name);
      const detail = document.createElement("p");
      detail.className = "skill-match-list";
      detail.textContent = `Matched: ${matched.length ? matched.join(", ") : "none"}. Missing: ${missing.length ? missing.join(", ") : "none"}.`;
      indicator.append(detail);
    }
    const footer = card.querySelector(".event-footer");
    if (footer) footer.before(indicator);
    else card.append(indicator);
  };

  const updateCards = () => {
    document.querySelectorAll("[data-event-list] .event-card").forEach((card) => {
      const detailsButton = card.querySelector("[data-show-event-details]");
      if (!detailsButton) return;
      try { addMatch(JSON.parse(detailsButton.dataset.event), card); } catch { /* Ignore malformed card data. */ }
    });
  };
  document.querySelectorAll("[data-event-list]").forEach((container) => {
    new MutationObserver(updateCards).observe(container, { childList: true, subtree: true });
  });
  updateCards();

  const eventSkillOptions = document.querySelector("[data-event-skill-options]");
  if (eventSkillOptions) {
    fetch(`${apiBase}/volunteers/skills`)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok || !data.success || !Array.isArray(data.skills)) throw new Error(data.message || "Skills could not be loaded.");
        if (!data.skills.length) {
          eventSkillOptions.textContent = "No active skills are available.";
          return;
        }
        eventSkillOptions.replaceChildren(...data.skills.map((skill) => {
          const label = document.createElement("label");
          label.className = "check-option";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.value = String(skill.skillId);
          checkbox.dataset.eventRequiredSkill = "true";
          label.append(checkbox, document.createTextNode(skill.name));
          return label;
        }));
      })
      .catch((error) => { eventSkillOptions.textContent = error.message || "Skills could not be loaded."; });
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = String(init.method || "GET").toUpperCase();
    if (url.includes("/api/events") && ["POST", "PUT"].includes(method) && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body);
        body.requiredSkillIds = Array.from(document.querySelectorAll("[data-event-required-skill]:checked"), (checkbox) => Number(checkbox.value));
        init = { ...init, body: JSON.stringify(body) };
      } catch { /* Leave an unrelated request unchanged. */ }
    }
    return originalFetch(input, init);
  };
  document.addEventListener("click", (click) => {
    const editButton = click.target.closest("[data-edit-event]");
    if (!editButton) return;
    try {
      const event = JSON.parse(editButton.dataset.event);
      const selected = new Set((event.requiredSkills || []).map((skill) => Number(skill.skillId)));
      document.querySelectorAll("[data-event-required-skill]").forEach((checkbox) => { checkbox.checked = selected.has(Number(checkbox.value)); });
    } catch { /* Ignore malformed event data. */ }
  });

  const detailsDialog = document.querySelector("[data-event-details-dialog]");
  document.addEventListener("click", (click) => {
    const button = click.target.closest("[data-show-event-details]");
    if (!button || !detailsDialog || !isVolunteer()) return;
    try {
      const event = JSON.parse(button.dataset.event);
      const target = detailsDialog.querySelector("[data-event-details-skills]");
      if (!target) return;
      target.replaceChildren();
      const match = event.skillMatch;
      if (!match || match.percentage == null) {
        target.textContent = `${match?.message || "No specific skills required"}.`;
      } else {
        target.textContent = `Skill match: ${match.percentage}%. Matched: ${(match.matchedSkills || []).map((skill) => skill.name).join(", ") || "none"}. Missing: ${(match.missingSkills || []).map((skill) => skill.name).join(", ") || "none"}.`;
      }
    } catch { /* Ignore malformed event data. */ }
  });

  const applicationRows = document.querySelector("[data-ngo-applications]");
  const addApplicantDetails = () => {
    if (!applicationRows) return;
    const rows = [...applicationRows.querySelectorAll("tr")];
    rows.forEach((row, index) => {
      if (row.cells?.length < 2) return;
      if (!row.__sevaApplication && window.__sevaApplicantApplications?.[index]) row.__sevaApplication = window.__sevaApplicantApplications[index];
      const cell = row.cells?.[0];
      const application = row.__sevaApplication;
      if (!cell || !application || cell.dataset.profileDetailsRendered) return;
      cell.dataset.profileDetailsRendered = "true";
      const profile = document.createElement("div");
      profile.className = "applicant-profile";
      if (application.volunteerBio) profile.append(textElement("p", "", `Bio: ${application.volunteerBio}`));
      const skills = application.volunteerSkills || [];
      profile.append(textElement("p", "", `Skills: ${skills.length ? skills.map((skill) => `${skill.name}${skill.proficiencyLevel ? ` (${skill.proficiencyLevel})` : ""}`).join(", ") : "None listed"}`));
      if (application.volunteerPhone) profile.append(textElement("p", "", `Contact: ${application.volunteerPhone}`));
      const match = application.skillMatch;
      if (match?.percentage == null) {
        profile.append(textElement("p", "", "No specific skills required for this event."));
      } else {
        profile.append(textElement("p", "", `Required skills match: ${match.percentage}%`));
        profile.append(textElement("p", "", `Matched: ${(match.matchedSkills || []).map((skill) => skill.name).join(", ") || "none"}; missing: ${(match.missingSkills || []).map((skill) => skill.name).join(", ") || "none"}.`));
      }
      cell.append(profile);
    });
  };
  if (applicationRows) {
    const originalFetchForApplications = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const result = await originalFetchForApplications(input, init);
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/events/ngo/applications") && result.ok) {
        const clone = result.clone();
        clone.json().then((data) => {
          if (!data.success || !Array.isArray(data.applications)) return;
          window.__sevaApplicantApplications = data.applications;
          addApplicantDetails();
        }).catch(() => {});
      }
      return result;
    };
    new MutationObserver(addApplicantDetails).observe(applicationRows, { childList: true, subtree: true });
  }
});
