(() => {
  const panel = document.querySelector("[data-attendance-panel]");
  if (!panel) return;
  const select = panel.querySelector("[data-attendance-event-select]");
  const rows = panel.querySelector("[data-attendance-rows]");
  const message = panel.querySelector("[data-attendance-message]");
  const summary = panel.querySelector("[data-attendance-summary]");
  const api = "http://localhost:5000/api";
  const request = async (path, options = {}) => {
    const response = await fetch(`${api}${path}`, { ...options, headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}`, ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "Request failed.");
    return data;
  };
  const cell = (row, text) => { const td = document.createElement("td"); td.textContent = text; row.append(td); return td; };
  const load = async () => {
    rows.replaceChildren(); summary.textContent = "";
    if (!select.value) { cell(document.createElement("tr"), "Select an event to load attendance.").colSpan = 4; return; }
    rows.append(Object.assign(document.createElement("tr"), { innerHTML: "<td colspan='4'>Loading attendance...</td>" }));
    try {
      const data = await request(`/events/attendance/${encodeURIComponent(select.value)}`);
      summary.textContent = `${data.summary.approved} approved · ${data.summary.present} present · ${data.summary.absent} absent`;
      if (!data.volunteers.length) { rows.replaceChildren(); const r = document.createElement("tr"); cell(r, "No approved volunteers for this event.").colSpan = 4; rows.append(r); return; }
      rows.replaceChildren(...data.volunteers.map((person) => {
        const row = document.createElement("tr");
        cell(row, person.volunteerName); cell(row, person.applicationStatus);
        const attendanceCell = cell(row, "");
        const attendance = document.createElement("select"); attendance.setAttribute("aria-label", `Attendance for ${person.volunteerName}`);
        [["", "Choose attendance"], ["Present", "Present"], ["Absent", "Absent"]].forEach(([value, label]) => { const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = value === (person.attendanceStatus || ""); attendance.append(option); });
        const save = document.createElement("button"); save.type = "button"; save.className = "action-btn approve"; save.textContent = "Save";
        save.addEventListener("click", async () => {
          if (!attendance.value) { message.textContent = "Choose Present or Absent."; return; }
          save.disabled = true;
          try { const result = await request(`/events/${encodeURIComponent(select.value)}/applications/${encodeURIComponent(person.applicationId)}/attendance`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: attendance.value }) }); message.textContent = result.message; await load(); }
          catch (error) { message.textContent = error.message; save.disabled = false; }
        });
        attendanceCell.append(attendance, save);
        const outcomeCell = cell(row, "");
        if (person.attendanceStatus && new Date(select.selectedOptions[0]?.dataset.end || 0) <= new Date()) {
          const outcome = document.createElement("select"); [["", "Record outcome"], ["Completed", "Completed"], ["Absent", "Absent"]].forEach(([value, label]) => { const o = document.createElement("option"); o.value = value; o.textContent = label; outcome.append(o); });
          const hours = document.createElement("input"); hours.type = "number"; hours.min = "0.01"; hours.max = "24"; hours.step = "0.01"; hours.placeholder = "Hours"; hours.value = person.hoursVolunteered || ""; hours.hidden = person.attendanceStatus === "Absent";
          outcome.addEventListener("change", () => { hours.hidden = outcome.value !== "Completed"; });
          const saveOutcome = document.createElement("button"); saveOutcome.type = "button"; saveOutcome.className = "action-btn approve"; saveOutcome.textContent = "Save";
          saveOutcome.addEventListener("click", async () => {
            if (!outcome.value) { message.textContent = "Choose Completed or Absent."; return; }
            saveOutcome.disabled = true;
            try { const result = await request(`/events/applications/${encodeURIComponent(person.applicationId)}/completion`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: outcome.value, hoursVolunteered: hours.value || 0 }) }); message.textContent = result.message; await load(); }
            catch (error) { message.textContent = error.message; saveOutcome.disabled = false; }
          });
          outcomeCell.append(outcome, hours, saveOutcome);
        } else outcomeCell.textContent = person.outcome ? `${person.outcome}${person.hoursVolunteered ? ` · ${person.hoursVolunteered} hours` : ""}` : "Available after event ends";
        return row;
      }));
    } catch (error) { rows.replaceChildren(); const r = document.createElement("tr"); cell(r, error.message).colSpan = 4; rows.append(r); }
  };
  select.addEventListener("change", load);
  request("/events/mine").then(({ events }) => {
    select.replaceChildren(); const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Choose an event"; select.append(placeholder);
    events.forEach((event) => { const option = document.createElement("option"); option.value = event.eventId; option.textContent = event.title; option.dataset.end = event.endDateTime; select.append(option); });
    message.textContent = "";
  }).catch((error) => { select.replaceChildren(); const option = document.createElement("option"); option.textContent = error.message; select.append(option); });
})();
