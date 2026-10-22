document.addEventListener("DOMContentLoaded", () => {
  // =========================================
  // SEVACONNECT API CONFIGURATION
  // =========================================
  const API_BASE_URL = "http://localhost:5000/api";

  const clearAuthenticationState = () => {
    ["authToken", "sevaConnectUser", "userId", "userType", "userEmail"].forEach((key) => {
      localStorage.removeItem(key);
    });
  };

  // =========================================
  // DASHBOARD DROPDOWN
  // =========================================
  const dashboardTrigger = document.querySelector(".dashboard-trigger");
  const dashboardMenu = document.querySelector(".dashboard-menu");

  if (dashboardTrigger && dashboardMenu) {
    dashboardTrigger.addEventListener("click", (event) => {
      event.stopPropagation();

      const isOpen = dashboardMenu.classList.contains("show");

      dashboardMenu.classList.toggle("show", !isOpen);
      dashboardTrigger.setAttribute(
        "aria-expanded",
        String(!isOpen)
      );
    });

    document.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        !dashboardTrigger.contains(target) &&
        !dashboardMenu.contains(target)
      ) {
        dashboardMenu.classList.remove("show");
        dashboardTrigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  // =========================================
  // MOBILE DASHBOARD SIDEBAR
  // =========================================
  const dashboardShell =
    document.querySelector(".dashboard-shell");

  const sidebarToggle =
    document.querySelector(".sidebar-toggle");

  if (dashboardShell && sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      const isOpen =
        dashboardShell.classList.contains("sidebar-open");

      dashboardShell.classList.toggle(
        "sidebar-open",
        !isOpen
      );

      sidebarToggle.setAttribute(
        "aria-expanded",
        String(!isOpen)
      );
    });

    document.addEventListener("click", (event) => {
      const target = event.target;

      if (
        target instanceof Node &&
        !dashboardShell.contains(target)
      ) {
        dashboardShell.classList.remove("sidebar-open");

        sidebarToggle.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });
  }

  // =========================================
  // FORM REFERENCES
  // =========================================
  const loginForm = document.querySelector(".login-form");

  const registerForm =
    document.querySelector(".register-form");

  // =========================================
  // LOGIN FORM
  // =========================================
  if (loginForm) {
    const roleFromUrl = new URLSearchParams(window.location.search).get("role");
    if (["Volunteer", "NGO"].includes(roleFromUrl)) {
      const roleOption = loginForm.querySelector(`input[name="userType"][value="${roleFromUrl}"]`);
      if (roleOption) roleOption.checked = true;
    }
    const emailInput =
      document.getElementById("email");

    const passwordInput =
      document.getElementById("password");

    const togglePasswordButton =
      document.querySelector(".toggle-password");

    const successMessage =
      document.getElementById("form-success");

    if (
      emailInput &&
      passwordInput &&
      togglePasswordButton
    ) {
      const showError = (input, message) => {
        const errorElement =
          document.getElementById(
            `${input.id}-error`
          );

        input.classList.add("input-error");

        input.setAttribute(
          "aria-invalid",
          "true"
        );

        if (errorElement) {
          errorElement.textContent = message;
        }
      };

      const clearError = (input) => {
        const errorElement =
          document.getElementById(
            `${input.id}-error`
          );

        input.classList.remove("input-error");

        input.setAttribute(
          "aria-invalid",
          "false"
        );

        if (errorElement) {
          errorElement.textContent = "";
        }
      };

      // Clear errors while typing
      [emailInput, passwordInput].forEach(
        (input) => {
          input.addEventListener("input", () => {
            clearError(input);

            if (successMessage) {
              successMessage.textContent = "";
            }
          });
        }
      );

      // =========================================
      // SHOW / HIDE PASSWORD
      // =========================================
      togglePasswordButton.addEventListener(
        "click",
        () => {
          const isPassword =
            passwordInput.type === "password";

          passwordInput.type =
            isPassword ? "text" : "password";

          togglePasswordButton.textContent =
            isPassword ? "Hide" : "Show";

          togglePasswordButton.setAttribute(
            "aria-label",
            isPassword
              ? "Hide password"
              : "Show password"
          );
        }
      );

      // =========================================
      // LOGIN SUBMIT
      // =========================================
      loginForm.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();

          let isValid = true;

          const emailValue =
            emailInput.value.trim();

          const passwordValue =
            passwordInput.value;

          clearError(emailInput);
          clearError(passwordInput);

          // =========================================
          // EMAIL VALIDATION
          // =========================================
          if (!emailValue) {
            showError(
              emailInput,
              "Email is required."
            );

            isValid = false;
          } else {
            const emailPattern =
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(emailValue)) {
              showError(
                emailInput,
                "Please enter a valid email address."
              );

              isValid = false;
            }
          }

          // =========================================
          // PASSWORD VALIDATION
          // =========================================
          if (!passwordValue) {
            showError(
              passwordInput,
              "Password is required."
            );

            isValid = false;
          }

          // Stop if frontend validation fails
          if (!isValid) {
            if (successMessage) {
              successMessage.textContent = "";
            }

            return;
          }

          // =========================================
          // LOGIN BUTTON
          // =========================================
          const loginButton =
            loginForm.querySelector(
              'button[type="submit"]'
            );

          const originalButtonText =
            loginButton
              ? loginButton.textContent
              : "Login";

          if (loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = "Logging in...";
          }

          if (successMessage) {
            successMessage.textContent =
              "Checking your account...";
          }

          // =========================================
          // CALL LOGIN API
          // =========================================
          try {
            const response = await fetch(
              `${API_BASE_URL}/auth/login`,
              {
                method: "POST",

                headers: {
                  "Content-Type": "application/json"
                },

                body: JSON.stringify({
                  email: emailValue,
                  password: passwordValue,
                  selectedRole: loginForm.querySelector('input[name="userType"]:checked')?.value
                })
              }
            );

            const data =
              await response.json();

            // =========================================
            // LOGIN FAILED
            // =========================================
            if (
              !response.ok ||
              !data.success
            ) {
              if (data.code === "ROLE_MISMATCH") clearAuthenticationState();
              if (successMessage) {
                successMessage.textContent =
                  data.message ||
                  "Login failed. Please check your credentials.";
              }

              console.error(
                "Login failed:",
                data.message
              );

              return;
            }

            // =========================================
            // SAVE USER INFORMATION
            // =========================================
            if (data.user && data.token) {
              clearAuthenticationState();
              localStorage.setItem("authToken", data.token);
              localStorage.setItem(
                "sevaConnectUser",
                JSON.stringify(data.user)
              );

              localStorage.setItem(
                "userId",
                String(data.user.userId)
              );

              localStorage.setItem(
                "userType",
                data.user.userType
              );

              localStorage.setItem(
                "userEmail",
                data.user.email
              );
            }

            // =========================================
            // REDIRECT BASED ON USER TYPE
            // =========================================
            const userType =
              String(
                data.user?.userType || ""
              )
                .trim()
                .toLowerCase();

            const destinations = {
              ngo: "ngo-dashboard.html",
              volunteer: "volunteer-dashboard.html",
            };
            const dashboardPage = destinations[userType];

            if (!dashboardPage) {
              clearAuthenticationState();
              if (successMessage) {
                successMessage.textContent = "Login succeeded, but this account has an unsupported role. Contact the project support team.";
              }
              return;
            }

            if (successMessage) successMessage.textContent = "Login successful! Redirecting...";

            // Give success message a moment to display
            setTimeout(() => {
              window.location.href =
                dashboardPage;
            }, 500);

          } catch (error) {
            console.error(
              "Login request error:",
              error
            );

            if (successMessage) {
              successMessage.textContent =
                "Unable to connect to the SevaConnect server. Please make sure the backend is running.";
            }

          } finally {
            if (loginButton) {
              loginButton.disabled = false;
              loginButton.textContent =
                originalButtonText;
            }
          }
        }
      );
    }
  }

  // =========================================
  // UNIFIED VOLUNTEER AND NGO REGISTRATION
  if (registerForm) {
    const roleOptions = registerForm.querySelectorAll('input[name="registrationRole"]');
    const submitButton = registerForm.querySelector('button[type="submit"]');
    const message = document.getElementById("register-success");
    const roleFromUrl = new URLSearchParams(window.location.search).get("role");
    if (["Volunteer", "NGO"].includes(roleFromUrl)) {
      const option = registerForm.querySelector(`input[name="registrationRole"][value="${roleFromUrl}"]`);
      if (option) option.checked = true;
    }

    const selectedRole = () => registerForm.querySelector('input[name="registrationRole"]:checked')?.value || "Volunteer";
    const refreshRoleFields = () => {
      const role = selectedRole();
      registerForm.querySelectorAll("[data-registration-fields]").forEach((section) => {
        const visible = section.dataset.registrationFields === role;
        section.hidden = !visible;
        section.querySelectorAll("input, textarea").forEach((control) => { control.disabled = !visible; });
      });
      if (submitButton) submitButton.textContent = role === "NGO" ? "Create NGO Account" : "Create Volunteer Account";
      registerForm.querySelectorAll(".input-error").forEach((input) => input.classList.remove("input-error"));
      registerForm.querySelectorAll("[aria-invalid='true']").forEach((input) => input.setAttribute("aria-invalid", "false"));
      registerForm.querySelectorAll(".error-message").forEach((item) => { item.textContent = ""; });
      if (message) message.textContent = "";
    };
    roleOptions.forEach((option) => option.addEventListener("change", refreshRoleFields));
    refreshRoleFields();

    const showRegistrationError = (input, text) => {
      if (!input) return;
      input.classList.add("input-error");
      input.setAttribute("aria-invalid", "true");
      const error = document.getElementById(`${input.id}-error`);
      if (error) error.textContent = text;
    };

    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const role = selectedRole();
      const email = registerForm.elements.email.value.trim();
      const phone = registerForm.elements.phone.value.trim();
      const password = registerForm.elements.password.value;
      const confirmPassword = registerForm.elements.confirmPassword.value;
      const city = registerForm.elements.city.value.trim();
      let valid = true;
      registerForm.querySelectorAll(".error-message").forEach((item) => { item.textContent = ""; });
      registerForm.querySelectorAll(".input-error").forEach((input) => input.classList.remove("input-error"));

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email) || email.length > 100) { showRegistrationError(registerForm.elements.email, "Enter a valid email address (100 characters or fewer)."); valid = false; }
      if (!/^\+?[0-9][0-9\s()-]{6,19}$/.test(phone)) { showRegistrationError(registerForm.elements.phone, "Enter a valid phone number (up to 20 characters)."); valid = false; }
      if (password.length < 8 || password.length > 72) { showRegistrationError(registerForm.elements.password, "Password must contain 8 to 72 characters."); valid = false; }
      if (confirmPassword !== password) { showRegistrationError(registerForm.elements.confirmPassword, "Passwords do not match."); valid = false; }
      if (!city || city.length > 50) { showRegistrationError(registerForm.elements.city, "City is required and must be 50 characters or fewer."); valid = false; }

      let registrationData;
      let route;
      if (role === "Volunteer") {
        const fullName = registerForm.elements.fullName.value.trim();
        const skills = Array.from(registerForm.querySelectorAll('input[name="skills"]:checked')).map((input) => input.value);
        const availability = registerForm.querySelector('input[name="availability"]:checked')?.value;
        if (!fullName || fullName.length > 100) { showRegistrationError(registerForm.elements.fullName, "Name is required and must be 100 characters or fewer."); valid = false; }
        if (!skills.length) { document.getElementById("skills-error").textContent = "Select at least one skill."; valid = false; }
        if (!availability) { document.getElementById("availability-error").textContent = "Select your availability."; valid = false; }
        registrationData = { fullName, email, phone, password, city, skills, availability };
        route = "/volunteers/register";
      } else {
        const organizationName = registerForm.elements.organizationName.value.trim();
        const contactPerson = registerForm.elements.contactPerson.value.trim();
        const address = registerForm.elements.address.value.trim();
        const description = registerForm.elements.description.value.trim();
        if (!organizationName || organizationName.length > 150) { showRegistrationError(registerForm.elements.organizationName, "Organization name is required and must be 150 characters or fewer."); valid = false; }
        if (contactPerson.length > 100) { showRegistrationError(registerForm.elements.contactPerson, "Contact name must be 100 characters or fewer."); valid = false; }
        if (address.length > 200 || description.length > 1000) { message.textContent = "Address must be 200 characters or fewer and description 1000 characters or fewer."; valid = false; }
        registrationData = { organizationName, contactPerson, email, phone, password, city, address, description };
        route = "/ngos/register";
      }
      if (!valid) { if (message && !message.textContent) message.textContent = "Please correct the highlighted fields."; return; }

      const oldLabel = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = "Creating account...";
      message.textContent = "Submitting your registration...";
      try {
        const response = await fetch(`${API_BASE_URL}${route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(registrationData)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.message || "Registration failed.");
        registerForm.reset();
        message.textContent = `${data.message || "Registration successful."} Redirecting to sign in...`;
        window.setTimeout(() => { window.location.href = `login.html?role=${encodeURIComponent(role)}`; }, 1200);
      } catch (error) {
        message.textContent = error.message || "Unable to reach the registration service.";
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = oldLabel;
      }
    });
  }
  // GENERIC BUTTON HANDLERS
  // =========================================
  document
    .querySelectorAll(
      "[data-demo-action]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const message =
            button.dataset.demoAction ||
            "This functionality will be connected soon.";

          alert(message);
        }
      );
    });

  // =========================================
  // LOGOUT HANDLER
  // =========================================
  document
    .querySelectorAll(
      "[data-logout]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          clearAuthenticationState();

          window.location.href =
            "login.html";
        }
      );
    });

  // =========================================
  // Load identity from the authenticated account, never from a browser-supplied user ID.
  const dashboardPage = document.querySelector(".dashboard-page");

  if (dashboardPage) {
    const authToken = localStorage.getItem("authToken");

    if (!authToken) {
      window.location.replace("login.html");
      return;
    }

    const nameElements = document.querySelectorAll("[data-user-name]");
    nameElements.forEach((element) => {
      element.textContent = "Loading profile...";
    });

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
          clearAuthenticationState();
          window.location.replace("login.html");
          return null;
        }

        if (!response.ok || !data.success || !data.user) {
          throw new Error(data.message || "Profile request failed.");
        }

        const role = String(data.user.userType || "").toLowerCase();
        const expectedRole = dashboardPage.classList.contains("ngo-dashboard-page")
          ? "ngo"
          : "volunteer";
        if (role !== expectedRole) {
          if (role === "ngo" || role === "volunteer") {
            window.location.replace(role === "ngo" ? "ngo-dashboard.html" : "volunteer-dashboard.html");
          } else {
            clearAuthenticationState();
            window.location.replace("login.html");
          }
          return null;
        }

        return data.user;
      })
      .then((user) => {
        if (!user) {
          return;
        }

        nameElements.forEach((element) => {
          element.textContent = user.displayName || user.email || "User";
        });
        loadNotifications();

        document.querySelectorAll("[data-user-email]").forEach((element) => {
          element.textContent = user.email || "";
        });

        document.querySelectorAll("[data-user-type]").forEach((element) => {
          element.textContent = user.userType || "";
        });
        document.querySelectorAll("[data-user-city]").forEach((element) => {
          element.textContent = user.userType === "NGO" ? (user.ngoCity || "Not provided") : (user.volunteerCity || "Not provided");
        });
        document.querySelectorAll("[data-user-availability]").forEach((element) => {
          element.textContent = user.volunteerAvailability || "Not provided";
        });
        if (user.userType === "NGO") {
          loadNgoEvents();
          loadNgoApplications();
        }
      })
      .catch((error) => {
        console.error("Unable to load the current user profile:", error.message);
        nameElements.forEach((element) => {
          element.textContent = "Profile unavailable";
        });
      });
  }
  // Load real event data on the event browser and volunteer dashboard.
  const eventContainers = Array.from(document.querySelectorAll("[data-event-list]"));
  const eventMessage = document.querySelector("[data-events-message]");
  const applicationDialog = document.querySelector("[data-application-dialog]");
  const applicationForm = document.querySelector("[data-application-form]");

  const formatEventDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date to be confirmed"
      : date.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short"
        });
  };

  const makeEventElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    element.textContent = text;
    return element;
  };

  const loadNotifications = async () => {
    const list = document.querySelector("[data-notification-list]");
    const token = localStorage.getItem("authToken");
    if (!list || !token) return;
    list.replaceChildren(makeEventElement("li", "", "Loading notifications..."));
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearAuthenticationState();
        window.location.replace("login.html");
        return;
      }
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to load notifications.");
      if (!data.notifications.length) {
        list.replaceChildren(makeEventElement("li", "", "You have no notifications."));
        return;
      }
      list.replaceChildren(...data.notifications.map((notification) => {
        const item = makeEventElement("li", "");
        const content = makeEventElement("div", "");
        content.append(makeEventElement("strong", "", notification.message));
        content.append(makeEventElement("p", "", `${notification.readStatus} · ${formatEventDate(notification.createdDate)}`));
        item.append(content);
        if (notification.readStatus !== "Read") {
          const markRead = makeEventElement("button", "action-btn approve", "Mark read");
          markRead.type = "button";
          markRead.addEventListener("click", async () => {
            markRead.disabled = true;
            try {
              const update = await fetch(`${API_BASE_URL}/notifications/${encodeURIComponent(notification.notificationId)}/read`, {
                method: "PATCH", headers: { Authorization: `Bearer ${token}` }
              });
              const result = await update.json().catch(() => ({}));
              if (!update.ok || !result.success) throw new Error(result.message || "Could not update notification.");
              await loadNotifications();
            } catch (error) {
              markRead.disabled = false;
              content.append(makeEventElement("p", "error-message", error.message));
            }
          });
          item.append(markRead);
        }
        return item;
      }));
    } catch (error) {
      list.replaceChildren(makeEventElement("li", "", error.message || "Notifications could not be loaded."));
    }
  };

  const renderEvent = (event) => {
    const card = makeEventElement("article", "event-card");
    const meta = makeEventElement("div", "event-meta");
    meta.append(makeEventElement("span", "tag tag-green", event.category || "Community"));
    meta.append(makeEventElement("span", "date-pill", event.status || "Open"));
    card.append(meta);
    card.append(makeEventElement("h3", "", event.title || "Untitled event"));
    card.append(makeEventElement("p", "event-ngo", event.ngoName || "Community organization"));
    if (event.description) {
      const preview = event.description.length > 180 ? `${event.description.slice(0, 180).trimEnd()}…` : event.description;
      card.append(makeEventElement("p", "event-card-description", preview));
    }
    const details = makeEventElement("ul", "event-details");
    details.append(makeEventElement("li", "", `${event.location || "Location to be confirmed"}, ${event.city || "City to be confirmed"}`));
    details.append(makeEventElement("li", "", `${formatEventDate(event.startDateTime)} – ${formatEventDate(event.endDateTime)}`));
    card.append(details);
    const footer = makeEventElement("div", "event-footer");
    footer.append(makeEventElement("span", "", `${event.reservedPlaces} of ${event.totalCapacity} places reserved · ${event.slotsRemaining} available`));
    const actions = makeEventElement("div", "event-card-actions");
    if (eventDetailsDialog) {
      const detailsButton = makeEventElement("button", "btn btn-secondary btn-small", "Details");
      detailsButton.type = "button";
      detailsButton.dataset.showEventDetails = "true";
      detailsButton.dataset.event = JSON.stringify(event);
      actions.append(detailsButton);
    }
    const appliedStatus = event.applicationStatus;
    const isFull = Number(event.slotsRemaining) <= 0;
    const signedInRole = localStorage.getItem("userType");
    if (applicationForm && applicationDialog && signedInRole && signedInRole !== "Volunteer") {
      actions.append(makeEventElement("span", "form-hint", "Volunteer applications only"));
    } else if (applicationForm && applicationDialog) {
      const applyLabel = appliedStatus ? `Applied · ${appliedStatus}` : (isFull ? "Full" : "Apply");
      const applyButton = makeEventElement("button", "btn btn-primary btn-small", applyLabel);
      applyButton.type = "button";
      applyButton.dataset.applyEvent = "true";
      applyButton.dataset.eventId = String(event.eventId);
      applyButton.dataset.eventTitle = event.title || "Volunteer event";
      applyButton.disabled = isFull || Boolean(appliedStatus);
      if (appliedStatus) applyButton.classList.add("event-application-status");
      actions.append(applyButton);
    } else if (appliedStatus) {
      actions.append(makeEventElement("span", "event-application-status", `Applied · ${appliedStatus}`));
    } else {
      const browseLink = makeEventElement("a", "btn btn-primary btn-small", "View and apply");
      browseLink.href = "events.html";
      actions.append(browseLink);
    }
    footer.append(actions);
    card.append(footer);
    return card;
  };

  const eventFilterForm = document.querySelector("[data-event-filters]");
  const eventDetailsDialog = document.querySelector("[data-event-details-dialog]");
  const loadMoreEventsButton = document.querySelector("[data-load-more-events]");
  const notAppliedFilter = document.querySelector("[data-not-applied-filter]");
  const notAppliedHint = document.querySelector("[data-not-applied-hint]");
  let eventRequestController = null;
  let eventOffset = 0;
  let eventNextOffset = null;
  let eventSearchTimer = null;
  let eventLoading = false;

  const refreshEventFilterOptions = (select, options, allLabel) => {
    if (!select) return;
    const selectedValue = select.value;
    const signature = options.join("\u0000");
    if (select.dataset.optionsSignature === signature) return;
    select.replaceChildren(new Option(allLabel, ""));
    options.forEach((value) => select.add(new Option(value, value)));
    select.dataset.optionsSignature = signature;
    if (options.includes(selectedValue)) select.value = selectedValue;
  };

  const loadBrowseEvents = async ({ reset = true } = {}) => {
    if (!eventContainers.length || eventLoading && !reset) return;
    if (reset) {
      eventRequestController?.abort();
      eventOffset = 0;
      eventNextOffset = null;
    }
    const controller = new AbortController();
    eventRequestController = controller;
    eventLoading = true;
    if (loadMoreEventsButton) loadMoreEventsButton.disabled = true;
    if (reset) eventContainers.forEach((container) => container.replaceChildren(makeEventElement("p", "", "Loading events…")));
    if (eventMessage) eventMessage.textContent = "";

    const params = new URLSearchParams();
    const values = eventFilterForm ? new FormData(eventFilterForm) : null;
    for (const key of ["search", "category", "city", "startDate", "endDate", "availability", "sort"]) {
      const value = String(values?.get(key) || "").trim();
      if (value) params.set(key, value);
    }
    params.set("limit", "20");
    params.set("offset", String(eventOffset));
    if (notAppliedFilter?.checked) params.set("notApplied", "true");
    const token = localStorage.getItem("authToken");
    const shouldUseVolunteerToken = localStorage.getItem("userType") === "Volunteer";
    const headers = token && shouldUseVolunteerToken ? { Authorization: `Bearer ${token}` } : {};
    try {
      const response = await fetch(`${API_BASE_URL}/events?${params}`, { headers, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 && token) {
        clearAuthenticationState();
        if (notAppliedFilter) notAppliedFilter.checked = false;
      }
      if (!response.ok || !data.success || !Array.isArray(data.events)) throw new Error(data.message || "Events could not be loaded.");
      refreshEventFilterOptions(eventFilterForm?.elements.category, data.filters?.categories || [], "All categories");
      refreshEventFilterOptions(eventFilterForm?.elements.city, data.filters?.cities || [], "All cities");
      eventContainers.forEach((container) => {
        const cards = data.events.map(renderEvent);
        if (reset) container.replaceChildren(...cards);
        else container.append(...cards);
        if (reset && cards.length === 0) container.replaceChildren(makeEventElement("p", "", "No events match these filters. Try changing or resetting your filters."));
      });
      eventNextOffset = data.pagination?.nextOffset ?? null;
      if (loadMoreEventsButton) loadMoreEventsButton.hidden = eventNextOffset == null;
      eventOffset = data.pagination?.offset ?? eventOffset;
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Unable to load events:", error.message);
      if (eventMessage) eventMessage.textContent = error.message || "The event service is unavailable. Check that the backend is running and try again.";
      if (reset) eventContainers.forEach((container) => container.replaceChildren(makeEventElement("p", "", "Events could not be loaded. Please try again.")));
      if (loadMoreEventsButton) loadMoreEventsButton.hidden = true;
    } finally {
      if (eventRequestController === controller) {
        eventLoading = false;
        if (loadMoreEventsButton) loadMoreEventsButton.disabled = false;
      }
    }
  };

  if (notAppliedFilter) {
    const isVolunteer = localStorage.getItem("userType") === "Volunteer" && Boolean(localStorage.getItem("authToken"));
    notAppliedFilter.disabled = !isVolunteer;
    if (notAppliedHint && !isVolunteer) notAppliedHint.textContent = "Sign in as a volunteer to use this filter.";
  }
  if (eventFilterForm) {
    eventFilterForm.addEventListener("submit", (event) => {
      event.preventDefault();
      window.clearTimeout(eventSearchTimer);
      loadBrowseEvents({ reset: true });
    });
    eventFilterForm.addEventListener("change", (event) => {
      if (event.target.name === "search") return;
      loadBrowseEvents({ reset: true });
    });
    eventFilterForm.querySelector('[name="search"]')?.addEventListener("input", () => {
      window.clearTimeout(eventSearchTimer);
      eventSearchTimer = window.setTimeout(() => loadBrowseEvents({ reset: true }), 300);
    });
    eventFilterForm.addEventListener("reset", () => {
      window.clearTimeout(eventSearchTimer);
      window.setTimeout(() => loadBrowseEvents({ reset: true }), 0);
    });
    eventFilterForm.querySelector("[data-clear-search]")?.addEventListener("click", () => {
      window.clearTimeout(eventSearchTimer);
      eventFilterForm.elements.search.value = "";
      loadBrowseEvents({ reset: true });
    });
  }
  loadMoreEventsButton?.addEventListener("click", () => {
    if (eventNextOffset == null || eventLoading) return;
    eventOffset = eventNextOffset;
    loadBrowseEvents({ reset: false });
  });
  document.querySelector("[data-close-event-details]")?.addEventListener("click", () => eventDetailsDialog?.close());
  eventDetailsDialog?.addEventListener("click", (event) => { if (event.target === eventDetailsDialog) eventDetailsDialog.close(); });

  const showEventDetails = (event) => {
    eventDetailsDialog.querySelector("[data-event-details-title]").textContent = event.title || "Event details";
    eventDetailsDialog.querySelector("[data-event-details-ngo]").textContent = event.ngoName || "Community organization";
    eventDetailsDialog.querySelector("[data-event-details-category]").textContent = `Category: ${event.category || "Community"}`;
    eventDetailsDialog.querySelector("[data-event-details-description]").textContent = event.description || "No description was provided.";
    const meta = eventDetailsDialog.querySelector("[data-event-details-meta]");
    meta.replaceChildren(
      makeEventElement("li", "", `Location: ${event.location || "Not provided"}, ${event.city || "Not provided"}`),
      makeEventElement("li", "", `Starts: ${formatEventDate(event.startDateTime)}`),
      makeEventElement("li", "", `Ends: ${formatEventDate(event.endDateTime)}`)
    );
    eventDetailsDialog.querySelector("[data-event-details-capacity]").textContent = `${event.reservedPlaces} of ${event.totalCapacity} places reserved; ${event.slotsRemaining} available.`;
    eventDetailsDialog.querySelector("[data-event-details-status]").textContent = `Status: ${event.status || "Open"}`;
    eventDetailsDialog.showModal();
  };
  const ngoEventsContainer = document.querySelector("[data-ngo-events]");
  const ngoApplicationsContainer = document.querySelector("[data-ngo-applications]");
  const ngoMessage = document.querySelector("[data-ngo-events-message]");
  const eventForm = document.querySelector("[data-event-form]");
  const eventFormMessage = document.querySelector("[data-event-form-message]");
  let editingEventId = null;

  const ngoRequest = async (path, options = {}) => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      window.location.replace("login.html");
      throw new Error("Please log in again.");
    }
    const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) };
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearAuthenticationState();
      window.location.replace("login.html");
      throw new Error("Your session expired. Please log in again.");
    }
    if (!response.ok || !data.success) throw new Error(data.message || "The request could not be completed.");
    return data;
  };

  const localDateTimeInput = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const loadNgoEvents = async () => {
    if (!ngoEventsContainer) return;
    ngoEventsContainer.replaceChildren(makeEventElement("p", "", "Loading your events..."));
    try {
      const data = await ngoRequest("/events/mine");
      const totalElement = document.querySelector('[data-dashboard-stat="totalEvents"]');
      const activeElement = document.querySelector('[data-dashboard-stat="activeEvents"]');
      const totalDetail = document.querySelector('[data-dashboard-detail="totalEvents"]');
      const activeDetail = document.querySelector('[data-dashboard-detail="activeEvents"]');
      const activeCount = data.events.filter((event) => ["Open", "Upcoming"].includes(event.status) && new Date(event.startDateTime) >= new Date()).length;
      if (totalElement) totalElement.textContent = String(data.events.length);
      if (activeElement) activeElement.textContent = String(activeCount);
      if (totalDetail) totalDetail.textContent = `${data.events.length} created`;
      if (activeDetail) activeDetail.textContent = `${activeCount} currently open`;
      if (!data.events.length) {
        ngoEventsContainer.replaceChildren(makeEventElement("p", "", "You have not created any events yet."));
        return;
      }
      ngoEventsContainer.replaceChildren(...data.events.map((event) => {
        const card = makeEventElement("article", "event-card");
        const meta = makeEventElement("div", "event-meta");
        meta.append(makeEventElement("span", "tag tag-green", event.category));
        meta.append(makeEventElement("span", "date-pill", event.status));
        card.append(meta, makeEventElement("h3", "", event.title));
        card.append(makeEventElement("p", "event-ngo", `${event.location}, ${event.city}`));
        if (event.description) card.append(makeEventElement("p", "", event.description));
        card.append(makeEventElement("p", "", `${formatEventDate(event.startDateTime)} – ${formatEventDate(event.endDateTime)} · ${event.approvedVolunteers}/${event.totalCapacity} approved`));
        const actions = makeEventElement("div", "event-actions");
        if (event.status !== "Cancelled") {
          const edit = makeEventElement("button", "btn btn-secondary btn-small", "Edit");
          edit.type = "button";
          edit.dataset.editEvent = String(event.eventId);
          edit.dataset.event = JSON.stringify(event);
          actions.append(edit);
          const cancel = makeEventElement("button", "action-btn reject", "Cancel event");
          cancel.type = "button";
          cancel.dataset.cancelEvent = String(event.eventId);
          actions.append(cancel);
        }
        card.append(actions);
        return card;
      }));
    } catch (error) {
      ngoEventsContainer.replaceChildren(makeEventElement("p", "", error.message || "Events could not be loaded."));
    }
  };

  const loadNgoApplications = async () => {
    if (!ngoApplicationsContainer) return;
    ngoApplicationsContainer.replaceChildren(makeEventElement("tr", ""));
    ngoApplicationsContainer.firstElementChild.append(makeEventElement("td", "", "Loading applications..."));
    ngoApplicationsContainer.firstElementChild.firstElementChild.colSpan = 5;
    try {
      const data = await ngoRequest("/events/ngo/applications");
      const pendingCount = data.applications.filter((application) => application.status === "Pending").length;
      const approvedVolunteerCount = new Set(data.applications.filter((application) => application.status === "Approved").map((application) => application.volunteerId)).size;
      const pendingStat = document.querySelector('[data-dashboard-stat="pendingApplications"]');
      const pendingDetail = document.querySelector('[data-dashboard-detail="pendingApplications"]');
      const approvedStat = document.querySelector('[data-dashboard-stat="approvedVolunteers"]');
      const approvedDetail = document.querySelector('[data-dashboard-detail="approvedVolunteers"]');
      if (pendingStat) pendingStat.textContent = String(pendingCount);
      if (pendingDetail) pendingDetail.textContent = `${pendingCount} pending`;
      if (approvedStat) approvedStat.textContent = String(approvedVolunteerCount);
      if (approvedDetail) approvedDetail.textContent = `${approvedVolunteerCount} approved`;
      if (!data.applications.length) {
        const row = makeEventElement("tr", "");
        const cell = makeEventElement("td", "", "No applications received yet.");
        cell.colSpan = 5;
        row.append(cell);
        ngoApplicationsContainer.replaceChildren(row);
        return;
      }
      ngoApplicationsContainer.replaceChildren(...data.applications.map((application) => {
        const row = makeEventElement("tr", "");
        const volunteerCell = makeEventElement("td", "", `${application.volunteerName} (${application.volunteerCity})`);
        if (application.notes) volunteerCell.append(makeEventElement("p", "", `Message: ${application.notes}`));
        row.append(volunteerCell);
        row.append(makeEventElement("td", "", `${application.eventTitle} · ${formatEventDate(application.eventStartDateTime)}`));
        row.append(makeEventElement("td", "", formatEventDate(application.applicationDate)));
        const statusCell = makeEventElement("td", "");
        const statusClass = String(application.status).toLowerCase().replace(/[^a-z-]/g, "");
        statusCell.append(makeEventElement("span", `status-badge ${statusClass}`, application.status));
        if (application.rejectionReason) statusCell.append(makeEventElement("p", "", application.rejectionReason));
        row.append(statusCell);
        const actionCell = makeEventElement("td", "");
        if (application.status === "Pending") {
          const actions = makeEventElement("div", "action-group");
          const approve = makeEventElement("button", "action-btn approve", "Approve");
          approve.type = "button";
          approve.dataset.reviewApplication = String(application.applicationId);
          approve.dataset.reviewStatus = "Approved";
          const reject = makeEventElement("button", "action-btn reject", "Reject");
          reject.type = "button";
          reject.dataset.reviewApplication = String(application.applicationId);
          reject.dataset.reviewStatus = "Rejected";
          actions.append(approve, reject);
          actionCell.append(actions);
        } else if (application.status === "Approved" && new Date(application.eventEndDateTime) <= new Date() && application.hoursVolunteered == null) {
          const complete = makeEventElement("button", "action-btn approve", "Record completion");
          complete.type = "button";
          complete.dataset.completeApplication = String(application.applicationId);
          actionCell.append(complete);
        } else if (application.status === "Approved" && application.hoursVolunteered != null) {
          actionCell.append(makeEventElement("p", "", `${application.hoursVolunteered} hours recorded`));
          if (new Date(application.eventEndDateTime) <= new Date()) {
            const correct = makeEventElement("button", "action-btn approve", "Correct hours");
            correct.type = "button";
            correct.dataset.completeApplication = String(application.applicationId);
            correct.dataset.currentHours = String(application.hoursVolunteered);
            actionCell.append(correct);
          }
        } else {
          actionCell.textContent = "Reviewed";
        }
        row.append(actionCell);
        return row;
      }));
      const activity = document.querySelector("[data-ngo-activity]");
      if (activity) {
        const recent = data.applications.slice(0, 5);
        activity.replaceChildren(...(recent.length ? recent.map((application) => {
          const item = makeEventElement("li", "");
          const content = makeEventElement("div", "");
          content.append(makeEventElement("strong", "", `${application.volunteerName} applied to ${application.eventTitle}`));
          content.append(makeEventElement("p", "", `${application.status} · ${formatEventDate(application.applicationDate)}`));
          item.append(content);
          return item;
        }) : [makeEventElement("li", "", "No recent applications.")]));
      }
    } catch (error) {
      const row = makeEventElement("tr", "");
      const cell = makeEventElement("td", "", error.message || "Applications could not be loaded.");
      cell.colSpan = 5;
      row.append(cell);
      ngoApplicationsContainer.replaceChildren(row);
    }
  };

  const resetEventForm = () => {
    if (!eventForm) return;
    editingEventId = null;
    eventForm.reset();
    document.querySelector("#event-form-title")?.replaceChildren("Create an Event");
    const submit = document.querySelector("[data-event-submit]");
    if (submit) submit.textContent = "Create Event";
    const cancelEdit = document.querySelector("[data-event-cancel-edit]");
    if (cancelEdit) cancelEdit.hidden = true;
    if (eventFormMessage) eventFormMessage.textContent = "";
  };

  document.querySelectorAll("[data-open-event-form]").forEach((link) => {
    link.addEventListener("click", () => window.setTimeout(() => eventForm?.querySelector("[name=title]")?.focus(), 0));
  });
  document.querySelector("[data-event-cancel-edit]")?.addEventListener("click", resetEventForm);

  if (eventForm) {
    eventForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!eventForm.reportValidity()) return;
      const values = Object.fromEntries(new FormData(eventForm).entries());
      values.requiredSkillIds = Array.from(eventForm.querySelectorAll("[data-event-required-skill]:checked"), (input) => Number(input.value));
      values.totalCapacity = Number(values.totalCapacity);
      if (new Date(values.startDateTime) <= new Date()) {
        eventFormMessage.textContent = "The event must start in the future.";
        return;
      }
      if (new Date(values.endDateTime) <= new Date(values.startDateTime)) {
        eventFormMessage.textContent = "The end time must be after the start time.";
        return;
      }
      const submit = document.querySelector("[data-event-submit]");
      const oldLabel = submit.textContent;
      submit.disabled = true;
      submit.textContent = editingEventId ? "Saving..." : "Creating...";
      eventFormMessage.textContent = "Saving event...";
      try {
        const path = editingEventId ? `/events/${encodeURIComponent(editingEventId)}` : "/events";
        const result = await ngoRequest(path, {
          method: editingEventId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values)
        });
        eventFormMessage.textContent = result.message;
        resetEventForm();
        if (eventFormMessage) eventFormMessage.textContent = result.message;
        await loadNgoEvents();
      } catch (error) {
        eventFormMessage.textContent = error.message || "The event could not be saved.";
      } finally {
        submit.disabled = false;
        submit.textContent = editingEventId ? oldLabel : "Create Event";
      }
    });
  }

  ngoEventsContainer?.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-event]");
    const cancel = event.target.closest("[data-cancel-event]");
    if (edit) {
      const details = JSON.parse(edit.dataset.event);
      editingEventId = details.eventId;
      for (const field of ["title", "description", "category", "location", "city", "totalCapacity"]) {
        eventForm.elements[field].value = details[field] ?? "";
      }
      eventForm.elements.startDateTime.value = localDateTimeInput(details.startDateTime);
      eventForm.elements.endDateTime.value = localDateTimeInput(details.endDateTime);
      eventForm.querySelectorAll("[data-event-required-skill]").forEach((input) => { input.checked = (details.requiredSkills || []).some((skill) => Number(skill.skillId) === Number(input.value)); });
      document.querySelector("#event-form-title").textContent = "Edit Event";
      document.querySelector("[data-event-submit]").textContent = "Save Changes";
      document.querySelector("[data-event-cancel-edit]").hidden = false;
      document.querySelector("#event-form").scrollIntoView({ behavior: "smooth" });
      eventForm.elements.title.focus();
      return;
    }
    if (cancel) {
      if (!window.confirm("Cancel this event? Volunteers will no longer be able to apply.")) return;
      cancel.disabled = true;
      try {
        const result = await ngoRequest(`/events/${encodeURIComponent(cancel.dataset.cancelEvent)}/cancel`, { method: "PATCH" });
        if (ngoMessage) ngoMessage.textContent = result.message;
        await loadNgoEvents();
      } catch (error) {
        if (ngoMessage) ngoMessage.textContent = error.message;
        cancel.disabled = false;
      }
    }
  });

  ngoApplicationsContainer?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-review-application]");
    const completionButton = event.target.closest("[data-complete-application]");
    if (completionButton) {
      const hoursText = window.prompt("How many volunteer hours did this person complete? (0 to 999.99)", completionButton.dataset.currentHours || "0");
      if (hoursText === null) return;
      const hours = Number(hoursText);
      if (!hoursText.trim() || !Number.isFinite(hours) || hours < 0 || hours > 999.99 || Math.round(hours * 100) !== hours * 100) {
        if (ngoMessage) ngoMessage.textContent = "Enter hours between 0 and 999.99 with at most two decimal places.";
        return;
      }
      const feedback = window.prompt("Optional feedback for this volunteer (up to 1000 characters):", "");
      if (feedback === null) return;
      completionButton.disabled = true;
      try {
        const result = await ngoRequest(`/events/applications/${encodeURIComponent(completionButton.dataset.completeApplication)}/completion`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hoursVolunteered: hours, feedback })
        });
        if (ngoMessage) ngoMessage.textContent = result.message;
        await loadNgoApplications();
      } catch (error) {
        if (ngoMessage) ngoMessage.textContent = error.message;
        completionButton.disabled = false;
      }
      return;
    }
    if (!button) return;
    let rejectionReason = "";
    if (button.dataset.reviewStatus === "Rejected") {
      const reason = window.prompt("Optional rejection reason:", "");
      if (reason === null) return;
      rejectionReason = reason;
    }
    button.disabled = true;
    try {
      const result = await ngoRequest(`/events/applications/${encodeURIComponent(button.dataset.reviewApplication)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: button.dataset.reviewStatus, rejectionReason })
      });
      if (ngoMessage) ngoMessage.textContent = result.message;
      await loadNgoApplications();
    } catch (error) {
      if (ngoMessage) ngoMessage.textContent = error.message;
      button.disabled = false;
    }
  });

  if (eventContainers.length > 0) {
    loadBrowseEvents({ reset: true });
    eventContainers.forEach((container) => {
      container.addEventListener("click", async (clickEvent) => {
        const detailsButton = clickEvent.target.closest("[data-show-event-details]");
        if (detailsButton && container.contains(detailsButton)) {
          try { showEventDetails(JSON.parse(detailsButton.dataset.event)); }
          catch (error) { if (eventMessage) eventMessage.textContent = "These event details could not be opened."; }
          return;
        }
        const button = clickEvent.target.closest("[data-apply-event]");
        if (!button || !container.contains(button)) {
          return;
        }
        const token = localStorage.getItem("authToken");
        if (!token) {
          if (eventMessage) eventMessage.textContent = "Please sign in as a volunteer before applying.";
          window.setTimeout(() => { window.location.href = "login.html"; }, 700);
          return;
        }
        try {
          const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await response.json().catch(() => ({}));
          if (response.status === 401) {
            clearAuthenticationState();
            window.location.replace("login.html");
            return;
          }
          if (!response.ok || !data.success) throw new Error(data.message || "Your profile could not be loaded.");
          if (data.user.userType !== "Volunteer") throw new Error("Only volunteer accounts can apply to events.");
          applicationForm.reset();
          applicationForm.dataset.eventId = button.dataset.eventId;
          applicationDialog.querySelector("[data-application-event]").textContent = `${button.dataset.eventTitle} · ${button.closest(".event-card")?.querySelector(".event-details")?.textContent || ""}`;
          const skillText = data.user.skills?.length ? ` Skills: ${data.user.skills.join(", ")}.` : " No skills are listed on your profile yet.";
          const phone = data.user.volunteerPhone ? ` · ${data.user.volunteerPhone}` : "";
          const availability = data.user.volunteerAvailability ? ` · Availability: ${data.user.volunteerAvailability}` : "";
          applicationDialog.querySelector("[data-application-profile]").textContent = `${data.user.displayName || "Volunteer"} · ${data.user.email}${phone}${availability}.${skillText}`;
          applicationDialog.querySelector("[data-application-message]").textContent = "";
          applicationDialog.showModal();
        } catch (error) {
          if (eventMessage) eventMessage.textContent = error.message || "Your application form could not be opened.";
        }
      });
    });
  }

  document.querySelector("[data-close-application]")?.addEventListener("click", () => applicationDialog?.close());
  applicationDialog?.addEventListener("click", (event) => {
    if (event.target === applicationDialog) applicationDialog.close();
  });
  applicationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!applicationForm.reportValidity()) return;
    const submit = applicationForm.querySelector("[data-submit-application]");
    const message = applicationForm.querySelector("[data-application-message]");
    submit.disabled = true;
    submit.textContent = "Submitting...";
    message.textContent = "Submitting your application...";
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(applicationForm.dataset.eventId)}/applications`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: applicationForm.elements.notes.value.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearAuthenticationState();
        window.location.replace("login.html");
        return;
      }
      if (!response.ok || !data.success) throw new Error(data.message || "Your application could not be submitted.");
      await loadBrowseEvents({ reset: true });
      message.textContent = "Application submitted. You can follow its status from your dashboard.";
      window.setTimeout(() => applicationDialog.close(), 1000);
    } catch (error) {
      message.textContent = error.message || "Unable to submit the application.";
    } finally {
      submit.disabled = false;
      submit.textContent = "Submit application";
    }
  });
  // Load dashboard aggregates using the authenticated account; the API scopes every query to its JWT identity.
  const volunteerDashboard = document.querySelector(".volunteer-dashboard-page");
  const ngoDashboard = document.querySelector(".ngo-dashboard-page");

  if (ngoDashboard) {
    const events = document.querySelector("[data-ngo-events]");
    if (events) events.replaceChildren(makeEventElement("p", "", "Loading your organization events..."));
  }

  if (volunteerDashboard || ngoDashboard) {
    const token = localStorage.getItem("authToken");

    if (!token) {
      window.location.replace("login.html");
      return;
    }

    const dashboardEndpoint = volunteerDashboard
      ? `${API_BASE_URL}/dashboard/volunteer`
      : `${API_BASE_URL}/dashboard/ngo`;

    fetch(dashboardEndpoint, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          clearAuthenticationState();
          window.location.replace("login.html");
          return null;
        }
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Dashboard request failed.");
        }
        return data;
      })
      .then((data) => {
        if (!data) {
          return;
        }

        const stats = data.stats || {};
        document.querySelectorAll("[data-dashboard-stat]").forEach((element) => {
          const value = Number(stats[element.dataset.dashboardStat]);
          element.textContent = Number.isFinite(value) ? String(value) : "0";
        });

        const details = volunteerDashboard
          ? {
              appliedEvents: (value) => `${value} total`,
              approvedApplications: (value) => `${value} accepted`,
              upcomingEvents: (value) => `${value} scheduled`,
              volunteerHours: (value) => `${value} hours`
            }
          : {
              totalEvents: (value) => `${value} created`,
              activeEvents: (value) => `${value} currently open`,
              totalApplications: (value) => `${value} received`,
              pendingApplications: (value) => `${value} pending`,
              approvedVolunteers: (value) => `${value} approved`
            };

        document.querySelectorAll("[data-dashboard-detail]").forEach((element) => {
          const key = element.dataset.dashboardDetail;
          const value = Number(stats[key]) || 0;
          element.textContent = details[key] ? details[key](value) : "";
        });

        if (volunteerDashboard) {
          const activity = document.querySelector("[data-volunteer-activity]");
          if (activity) {
            const applications = data.recentApplications || [];
            if (applications.length === 0) {
              activity.replaceChildren(makeEventElement("li", "", "No applications yet."));
            } else {
              activity.replaceChildren(...applications.map((application) => {
                const item = makeEventElement("li", "");
                const content = makeEventElement("div", "");
                const activityStatus = application.eventStatus === "Cancelled"
                  ? "Event cancelled"
                  : (application.isCompleted ? "Completed" : application.status);
                content.append(makeEventElement("strong", "", `${application.eventTitle}: ${activityStatus}`));
                content.append(makeEventElement("p", "", `${application.city} · ${formatEventDate(application.applicationDate)}`));
                item.append(content);
                return item;
              }));
            }
          }
          const historyBody = document.querySelector("[data-volunteer-history]");
          if (historyBody) {
            const history = data.history || [];
            if (!history.length) {
              const row = makeEventElement("tr", "");
              const cell = makeEventElement("td", "", "No completed volunteering history yet.");
              cell.colSpan = 4;
              row.append(cell);
              historyBody.replaceChildren(row);
            } else {
              historyBody.replaceChildren(...history.map((record) => {
                const row = makeEventElement("tr", "");
                row.append(makeEventElement("td", "", `${record.eventTitle} · ${record.city}`));
                row.append(makeEventElement("td", "", `${record.completionStatus} · ${formatEventDate(record.completionDate)}`));
                row.append(makeEventElement("td", "", String(record.hoursVolunteered)));
                row.append(makeEventElement("td", "", record.feedback || "—"));
                return row;
              }));
            }
          }
        }

      })
      .catch((error) => {
        console.error("Unable to load dashboard data:", error.message);
        document.querySelectorAll("[data-dashboard-stat]").forEach((element) => {
          element.textContent = "—";
        });
        document.querySelectorAll("[data-dashboard-detail]").forEach((element) => {
          element.textContent = "Data unavailable";
        });
      });
  }
});



