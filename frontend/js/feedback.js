(() => {
  const API = "http://localhost:5000/api";
  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` });
  const request = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "The request could not be completed.");
    return data;
  };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const volunteerPanel = document.querySelector("[data-volunteer-feedback-panel]");
  if (volunteerPanel) {
    const list = volunteerPanel.querySelector("[data-volunteer-feedback-list]");
    const message = volunteerPanel.querySelector("[data-feedback-message]");
    let reviews = [];
    const render = () => {
      if (!reviews.length) {
        list.replaceChildren(element("p", "", "No completed events are available for feedback yet."));
        return;
      }
      list.replaceChildren(...reviews.map((review) => {
        const card = element("article", "feedback-card");
        card.append(element("h3", "", review.eventTitle));
        card.append(element("p", "", `${review.ngoName} · Completed ${new Date(review.completionDate).toLocaleDateString()}`));
        if (review.reviewId) {
          card.append(element("p", "feedback-rating", `${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))} · ${review.rating}/5`));
          card.append(element("p", "feedback-comment", review.comments || "No written comment."));
          card.append(element("p", "form-hint", "Feedback submitted."));
        } else {
          const form = element("form", "feedback-form");
          const fieldset = element("fieldset", "feedback-stars");
          const legend = element("legend", "", "Your rating (required)");
          fieldset.append(legend);
          for (let value = 1; value <= 5; value += 1) {
            const id = `review-${review.eventId}-rating-${value}`;
            const label = element("label", "", `${value} ${"★".repeat(value)}${"☆".repeat(5 - value)}`);
            const input = document.createElement("input");
            input.type = "radio"; input.name = `rating-${review.eventId}`; input.value = String(value); input.id = id; input.required = true;
            label.prepend(input); fieldset.append(label);
          }
          const commentLabel = element("label", "", "Optional comment");
          const commentId = `review-${review.eventId}-comments`;
          commentLabel.htmlFor = commentId;
          const textarea = element("textarea", "form-control");
          textarea.id = commentId; textarea.name = "comments"; textarea.maxLength = 1000;
          textarea.placeholder = "Share what went well or what could improve.";
          const submit = element("button", "btn btn-primary btn-small", "Submit feedback");
          submit.type = "submit";
          const error = element("p", "form-success"); error.setAttribute("role", "alert");
          form.append(fieldset, commentLabel, textarea, submit, error);
          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const selected = form.querySelector(`input[name="rating-${review.eventId}"]:checked`);
            if (!selected) { error.textContent = "Choose a star rating from 1 to 5."; return; }
            submit.disabled = true; error.textContent = "";
            try {
              const result = await request(`/events/${encodeURIComponent(review.eventId)}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating: Number(selected.value), comments: textarea.value })
              });
              message.textContent = `${result.message} This event now has ${result.summary.averageRating.toFixed(1)} / 5 from ${result.summary.reviewCount} ${result.summary.reviewCount === 1 ? "review" : "reviews"}.`;
              await load();
            } catch (err) { error.textContent = err.message; submit.disabled = false; }
          });
          card.append(form);
        }
        return card;
      }));
    };
    const load = async () => {
      list.replaceChildren(element("p", "", "Loading your feedback..."));
      try { const data = await request("/volunteers/me/feedback"); reviews = data.reviews || []; render(); }
      catch (error) { list.replaceChildren(element("p", "", error.message)); }
    };
    load();
  }

  const ngoPanel = document.querySelector("[data-ngo-reviews-panel]");
  if (ngoPanel) {
    const select = ngoPanel.querySelector("[data-review-event-select]");
    const list = ngoPanel.querySelector("[data-ngo-review-list]");
    const summary = ngoPanel.querySelector("[data-review-summary]");
    const message = ngoPanel.querySelector("[data-ngo-reviews-message]");
    const loadReviews = async () => {
      list.replaceChildren(element("p", "", "Loading event feedback..."));
      summary.textContent = "";
      if (!select.value) { list.replaceChildren(element("p", "", "Select an event to view its reviews.")); return; }
      try {
        const data = await request(`/events/${encodeURIComponent(select.value)}/feedback`);
        const { reviewCount, averageRating } = data.summary;
        summary.textContent = reviewCount
          ? `${averageRating.toFixed(1)} / 5 average · ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`
          : "No ratings yet";
        if (!data.reviews.length) { list.replaceChildren(element("p", "", "No written feedback has been submitted for this event yet.")); return; }
        list.replaceChildren(...data.reviews.map((review) => {
          const card = element("article", "feedback-card");
          card.append(element("h3", "feedback-rating", `${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))} · ${review.rating}/5`));
          card.append(element("p", "feedback-comment", review.comments || "No written comment."));
          card.append(element("p", "form-hint", new Date(review.reviewedAt).toLocaleDateString()));
          return card;
        }));
      } catch (error) { list.replaceChildren(element("p", "", error.message)); }
    };
    select.addEventListener("change", loadReviews);
    request("/events/mine").then(({ events }) => {
      select.replaceChildren();
      const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Choose an event"; select.append(placeholder);
      events.forEach((event) => { const option = document.createElement("option"); option.value = event.eventId; option.textContent = event.title; select.append(option); });
      message.textContent = "";
    }).catch((error) => {
      select.replaceChildren();
      const option = document.createElement("option"); option.value = ""; option.textContent = "Unable to load events"; select.append(option);
      message.textContent = error.message;
    });
  }
})();
