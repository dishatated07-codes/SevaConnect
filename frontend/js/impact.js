(() => {
  const panel = document.querySelector("[data-impact-dashboard]");
  if (!panel) return;
  const kind = panel.dataset.impactDashboard;
  const api = "http://localhost:5000/api";
  const statsNode = panel.querySelector("[data-impact-stats]");
  const message = panel.querySelector("[data-impact-message]");
  const form = panel.querySelector("[data-impact-filters]");
  const params = () => new URLSearchParams(new FormData(form));
  const request = async (path) => {
    const response = await fetch(`${api}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "Could not load impact data.");
    return data;
  };
  const stat = (label, value) => {
    const card = document.createElement("article"); card.className = "impact-stat";
    const title = document.createElement("span"); title.textContent = label;
    const number = document.createElement("strong"); number.textContent = value == null ? "—" : String(value);
    card.append(title, number); return card;
  };
  const setBars = (node, rows, labelKey, valueKey) => {
    node.replaceChildren();
    if (!rows?.length) { node.textContent = "No recorded data for this period."; return; }
    const max = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0));
    rows.forEach((row) => {
      const item = document.createElement("div"); item.className = "impact-bar-row";
      const label = document.createElement("span"); label.textContent = row[labelKey] || "Uncategorized";
      const track = document.createElement("div"); track.className = "impact-bar-track";
      const bar = document.createElement("div"); bar.className = "impact-bar"; bar.style.width = `${Math.max(0, (Number(row[valueKey]) || 0) * 100 / max)}%`;
      track.append(bar); const value = document.createElement("strong"); value.textContent = String(row[valueKey]); item.append(label, track, value); node.append(item);
    });
  };
  const cell = (row, value) => { const td = document.createElement("td"); td.textContent = value == null ? "—" : String(value); row.append(td); };
  const load = async () => {
    message.textContent = "Loading impact data…";
    try {
      const data = await request(`/dashboard/${kind}/impact?${params()}`);
      const s = data.stats;
      statsNode.replaceChildren(...(kind === "ngo"
        ? [stat("Events", s.totalEvents), stat("Upcoming open", s.upcomingOpenEvents), stat("Completed events", s.completedEvents), stat("Approved applications", s.approvedApplications), stat("Unique volunteers", s.uniqueVolunteersEngaged), stat("Attendance rate", s.attendanceRate == null ? null : `${s.attendanceRate}%`), stat("Completed hours", s.totalCompletedHours), stat("Average rating", data.stats.reviewsAvailable ? (s.averageRating == null ? "No reviews" : `${s.averageRating} / 5 (${s.reviewCount})`) : "Reviews unavailable")]
        : [stat("Completed events", s.completedEvents), stat("Completed hours", s.totalCompletedHours), stat("Events attended", s.eventsAttended), stat("Present", s.presentAttendance), stat("Absent", s.absentAttendance), stat("Attendance rate", s.attendanceRate == null ? null : `${s.attendanceRate}%`)]));
      if (kind === "ngo") setBars(panel.querySelector("[data-impact-categories]"), data.categories, "category", "eventCount");
      else {
        setBars(panel.querySelector("[data-impact-months]"), data.monthlyHours, "month", "hours");
        const activities = panel.querySelector("[data-impact-activities]"); activities.replaceChildren();
        if (!data.recentActivities.length) activities.textContent = "No completed activities in this period.";
        data.recentActivities.forEach((activity) => { const p = document.createElement("p"); p.textContent = `${activity.eventTitle} · ${activity.ngoName} · ${activity.hoursVolunteered} hours`; activities.append(p); });
        const tbody = panel.querySelector("[data-impact-attendance]"); tbody.replaceChildren();
        if (!data.attendanceHistory.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 5; td.textContent = "No attendance records in this period."; tr.append(td); tbody.append(tr); }
        data.attendanceHistory.forEach((item) => { const tr = document.createElement("tr"); cell(tr, item.eventTitle); cell(tr, item.ngoName); cell(tr, item.category); cell(tr, item.attendanceStatus); cell(tr, item.hoursVolunteered); tbody.append(tr); });
      }
      message.textContent = data.stats.reviewsAvailable === false ? "Impact reflects recorded applications, attendance, and completed service. Ratings are unavailable until the reviews table is installed." : "Impact reflects recorded applications, attendance, and completed service.";
    } catch (error) { message.textContent = error.message; statsNode.replaceChildren(); }
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); load(); });
  panel.querySelector("[data-impact-export]").addEventListener("click", async () => {
    const endpoint = kind === "ngo" ? "/reports/ngo/events.csv" : "/reports/volunteer/impact.csv";
    try {
      const response = await fetch(`${api}${endpoint}?${params()}`, { headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` } });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "Export failed."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = kind === "ngo" ? "ngo-impact-events.csv" : "volunteer-impact-history.csv"; link.click(); URL.revokeObjectURL(url);
      message.textContent = "CSV report downloaded.";
    } catch (error) { message.textContent = error.message; }
  });
  load();
})();
