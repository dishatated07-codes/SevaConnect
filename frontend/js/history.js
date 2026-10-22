(() => {
  const body = document.querySelector("[data-volunteer-service-history]");
  if (!body) return;
  const summary = document.querySelector("[data-history-summary]");
  const api = "http://localhost:5000/api";
  const render = async () => {
    try {
      const response = await fetch(`${api}/volunteers/me/history`, { headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` } });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to load history.");
      summary.textContent = `${Number(data.totals.totalHours)} total hours · ${data.totals.completedEvents} completed events`;
      if (!data.history.length) { const row = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 6; td.textContent = "No completed volunteering history yet. Your completed service will appear here."; row.append(td); body.replaceChildren(row); return; }
      body.replaceChildren(...data.history.map((item) => {
        const row = document.createElement("tr");
        [item.eventTitle, item.ngoName, new Date(item.completionDate).toLocaleDateString(), item.attendanceStatus || "Not recorded", String(item.hoursVolunteered), item.feedback || "—"].forEach((value) => { const td = document.createElement("td"); td.textContent = value; row.append(td); });
        return row;
      }));
    } catch (error) { summary.textContent = error.message; }
  };
  render();
})();
