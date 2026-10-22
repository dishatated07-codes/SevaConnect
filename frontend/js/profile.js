document.addEventListener("DOMContentLoaded", () => {
  const page = document.querySelector("[data-volunteer-profile-page]");
  if (!page) return;
  const apiBase = "http://localhost:5000/api";
  const token = localStorage.getItem("authToken");
  const profileForm = page.querySelector("[data-profile-form]");
  const profileMessage = page.querySelector("[data-profile-message]");
  const skillsForm = page.querySelector("[data-skills-form]");
  const skillsMessage = page.querySelector("[data-skills-message]");
  const skillsContainer = page.querySelector("[data-profile-skills]");
  const editButton = page.querySelector("[data-profile-edit]");
  const profileSave = page.querySelector("[data-profile-save]");
  const profileCancel = page.querySelector("[data-profile-cancel]");
  let savedProfile = null;

  if (!token) {
    window.location.replace("login.html?role=Volunteer");
    return;
  }

  const request = async (path, options = {}) => {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      ["authToken", "sevaConnectUser", "userId", "userType", "userEmail"].forEach((key) => localStorage.removeItem(key));
      window.location.replace("login.html?role=Volunteer");
    }
    if (!response.ok || !data.success) throw new Error(data.message || "The request could not be completed.");
    return data;
  };

  const textElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  };

  const fillProfile = (profile) => {
    savedProfile = profile;
    ["fullName", "email", "phoneNumber", "city", "availability", "bio"].forEach((key) => {
      profileForm.elements[key].value = profile[key] || "";
    });
  };

  const setEditing = (editing) => {
    profileForm.querySelectorAll("input:not([readonly]), textarea").forEach((field) => { field.disabled = !editing; });
    editButton.hidden = editing;
    profileSave.hidden = !editing;
    profileCancel.hidden = !editing;
  };

  const renderSkills = (availableSkills, currentSkills, proficiencyLevels) => {
    const currentById = new Map(currentSkills.map((skill) => [Number(skill.skillId), skill]));
    const options = new Map(availableSkills.map((skill) => [Number(skill.skillId), { ...skill, active: true }]));
    currentSkills.forEach((skill) => options.set(Number(skill.skillId), { ...skill, active: skill.active === "Y" }));
    const skills = [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (!skills.length) {
      skillsContainer.replaceChildren(textElement("p", "", "No active skills are available yet."));
      return;
    }
    skillsContainer.replaceChildren(...skills.map((skill) => {
      const current = currentById.get(Number(skill.skillId));
      const row = textElement("div", "profile-skill-row");
      const label = textElement("label", "profile-skill-choice");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.skillId = String(skill.skillId);
      checkbox.checked = Boolean(current);
      const name = textElement("span", "", `${skill.name}${skill.active ? "" : " (currently unavailable)"}`);
      label.append(checkbox, name);
      const select = document.createElement("select");
      select.dataset.proficiencyFor = String(skill.skillId);
      select.setAttribute("aria-label", `${skill.name} proficiency`);
      proficiencyLevels.forEach((level) => select.add(new Option(level, level)));
      select.value = proficiencyLevels.includes(current?.proficiencyLevel) ? current.proficiencyLevel : (proficiencyLevels[0] || "Beginner");
      select.disabled = !current;
      checkbox.addEventListener("change", () => { select.disabled = !checkbox.checked; });
      row.append(label, select);
      return row;
    }));
  };

  const load = async () => {
    profileMessage.textContent = "Loading your profile...";
    skillsMessage.textContent = "Loading available skills...";
    try {
      const [profileData, skillsData] = await Promise.all([
        request("/volunteers/me/profile"), request("/volunteers/me/skills")
      ]);
      fillProfile(profileData.profile);
      setEditing(false);
      renderSkills(skillsData.availableSkills || [], skillsData.skills || [], skillsData.proficiencyLevels || []);
      profileMessage.textContent = "Your profile is up to date.";
      skillsMessage.textContent = skillsData.availableSkills?.length ? "Select your skills and proficiency levels." : "There are no active skills to choose from.";
    } catch (error) {
      profileMessage.textContent = error.message || "Your profile could not be loaded.";
      skillsMessage.textContent = error.message || "Your skills could not be loaded.";
    }
  };

  editButton.addEventListener("click", () => {
    setEditing(true);
    profileMessage.textContent = "Edit your profile, then save your changes.";
    profileForm.elements.fullName.focus();
  });
  profileCancel.addEventListener("click", () => {
    if (savedProfile) fillProfile(savedProfile);
    setEditing(false);
    profileMessage.textContent = "Changes discarded.";
  });
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!profileForm.reportValidity()) return;
    const phoneNumber = profileForm.elements.phoneNumber.value.trim();
    const digits = phoneNumber.replace(/\D/g, "");
    if (!/^\+?[0-9][0-9\s().-]*$/.test(phoneNumber) || digits.length < 7 || digits.length > 15) {
      profileMessage.textContent = "Enter a valid phone number with 7 to 15 digits.";
      return;
    }
    profileSave.disabled = true;
    profileMessage.textContent = "Saving your profile...";
    try {
      const body = Object.fromEntries(["fullName", "phoneNumber", "city", "availability", "bio"].map((key) => [key, profileForm.elements[key].value.trim()]));
      const data = await request("/volunteers/me/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      fillProfile(data.profile);
      setEditing(false);
      profileMessage.textContent = "Profile saved successfully.";
    } catch (error) {
      profileMessage.textContent = error.message || "Your profile could not be saved.";
    } finally {
      profileSave.disabled = false;
    }
  });
  skillsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const assignments = [...skillsContainer.querySelectorAll("input[type=checkbox][data-skill-id]:checked")].map((checkbox) => ({
      skillId: Number(checkbox.dataset.skillId),
      proficiencyLevel: skillsContainer.querySelector(`[data-proficiency-for="${checkbox.dataset.skillId}"]`)?.value
    }));
    const saveButton = page.querySelector("[data-skills-save]");
    saveButton.disabled = true;
    skillsMessage.textContent = "Saving your skills...";
    try {
      const [saved, catalogue] = await Promise.all([
        request("/volunteers/me/skills", {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skills: assignments })
        }),
        request("/volunteers/skills")
      ]);
      renderSkills(catalogue.skills || [], saved.skills || [], catalogue.proficiencyLevels || []);
      skillsMessage.textContent = saved.message || "Your skills have been saved.";
    } catch (error) {
      skillsMessage.textContent = error.message || "Your skills could not be saved.";
    } finally {
      saveButton.disabled = false;
    }
  });

  load();
});
