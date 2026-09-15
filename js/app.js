const App = {
  route: "home",
  param: "",
  shellClockTimer: null,
  interactionSoundBound: false,
  init() {
    Store.load();
    Login.showIfNeeded();
    renderNavigation();
    this.bindChrome();
    this.bindInteractionSounds();
    this.startShellClock();
    window.addEventListener("hashchange", () => this.render());
    window.addEventListener("popstate", () => this.render());
    this.render();
    this.checkUpcomingAlerts();
  },
  parseRoute() {
    const [route = "home", param = ""] = location.hash.replace("#", "").split("/");
    this.route = route || "home";
    this.param = param;
  },
  render() {
    this.parseRoute();
    const app = document.getElementById("app");
    const route = this.route;
    document.documentElement.lang = languageCode();
    renderNavigation();
    setActiveNav(route);
    this.renderProfile();
    this.renderLanguageSwitch();
    this.renderMoneyPrivacy();
    this.renderSmartAssistant();
    document.body.classList.remove("nav-open");
    document.body.classList.toggle("launcher-page-open", route === "launcher");

    if (route === "launcher") app.innerHTML = renderLauncher();
    else if (route === "family") app.innerHTML = renderFamily();
    else if (route === "goals") app.innerHTML = renderGoals(this.param);
    else if (route === "money") app.innerHTML = renderMoney(this.param || "overview");
    else if (route === "calendar") app.innerHTML = renderCalendar(this.param || "month");
    else if (route === "memories") app.innerHTML = renderMemories();
    else if (route === "tips") app.innerHTML = renderTips();
    else if (route === "settings") app.innerHTML = renderSettings();
    else if (route === "help") app.innerHTML = renderHelp();
    else app.innerHTML = renderHome();

    if (!appData.profile.name) {
      Login.showIfNeeded();
    }

    this.bindPage(route);
    this.bindScrollReveal();
    this.checkUpcomingAlerts();
    this.checkHomeSuggestions();
    this.renderNotificationBadge();
    app.focus({ preventScroll: true });
  },
  renderNotificationBadge() {
    const bell = document.getElementById("bellButton");
    if (!bell) return;

    const alerts = getUpcomingNotifications(7);
    const count = alerts.length;
    let badge = bell.querySelector(".notification-badge");

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "notification-badge";
      badge.setAttribute("aria-hidden", "true");
      bell.appendChild(badge);
    }

    const label = count > 0 ? `${count} notifications` : "Notifications";
    badge.textContent = count > 99 ? "99+" : String(count || "");
    badge.hidden = count === 0;
    bell.classList.toggle("has-notifications", count > 0);
    bell.setAttribute("aria-label", label);
    bell.setAttribute("title", label);
  },
  openNotificationsPanel() {
    const root = document.getElementById("modalRoot");
    const alerts = getUpcomingNotifications(7);

    root.classList.add("open");
    root.innerHTML = `
      <div class="notification-backdrop" data-close-notification>
        <div class="notification-panel glass-card" role="dialog" aria-modal="true" aria-labelledby="notificationTitle">
          <div class="between notification-header">
            <div>
              <span class="eyebrow">${t("upcoming")}</span>
              <h2 id="notificationTitle">${alerts.length ? (languageCode() === "km" ? "ការជូនដំណឹង" : "Notifications") : (languageCode() === "km" ? "គ្មានការជូនដំណឹង" : "No notifications")}</h2>
            </div>
            <button class="icon-button" type="button" data-close-notification aria-label="${t("close")}">${Icons.close()}</button>
          </div>

          ${alerts.length ? `
            <div class="notification-list">
              ${alerts.map(item => `
                <div class="notification-item">
                  <div class="notification-icon ${item.kind === "bill" ? "bill" : "event"}">${item.kind === "bill" ? Icons.bill() : Icons.calendar()}</div>
                  <div class="notification-copy">
                    <strong>${escapeHtml(item.title)}</strong>
                    <small>${new Date(`${item.date}T00:00:00`).toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { month: "short", day: "numeric" })}</small>
                    <span>${item.daysLeft === 0 ? (languageCode() === "km" ? "ថ្ងៃនេះ" : "Today") : item.daysLeft === 1 ? (languageCode() === "km" ? "ក្នុង 1 ថ្ងៃ" : "In 1 day") : (languageCode() === "km" ? `ក្នុង ${item.daysLeft} ថ្ងៃ` : `In ${item.daysLeft} days`)}</span>
                  </div>
                  <button class="button ghost-button notification-view" type="button" data-view-notification="${escapeAttr(item.id)}">${languageCode() === "km" ? "មើល" : "View"}</button>
                </div>
              `).join("")}
            </div>
          ` : `
            <div class="notification-empty">
              <div class="notification-empty-icon">${Icons.bell()}</div>
              <p>${languageCode() === "km" ? "អ្នកមិនមានការជូនដំណឹងក្នុង 7 ថ្ងៃទេ" : "You have no reminders in the next 7 days."}</p>
            </div>
          `}

          <div class="notification-actions">
            <button class="button ghost-button" type="button" data-close-notification>${t("close")}</button>
          </div>
        </div>
      </div>
    `;

    const closeButtons = root.querySelectorAll("[data-close-notification]");
    closeButtons.forEach(button => button.addEventListener("click", () => {
      root.classList.remove("open");
      root.innerHTML = "";
    }));

    const backdrop = root.querySelector(".notification-backdrop");
    backdrop?.addEventListener("click", event => {
      if (event.target === backdrop) {
        root.classList.remove("open");
        root.innerHTML = "";
      }
    });

    root.querySelectorAll("[data-view-notification]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.viewNotification;
        const item = alerts.find(alert => alert.id === id);
        if (!item) return;

        root.classList.remove("open");
        root.innerHTML = "";
        location.hash = "#calendar";

        setTimeout(() => {
          const event = appData.calendarEvents.find(entry => entry.id === item.id);
          if (event) {
            App.openNotificationDetail(event, item);
          }
        }, 200);
      });
    });
  },
  openNotificationDetail(record, item) {
    const root = document.getElementById("modalRoot");
    const isKhmer = languageCode() === "km";
    const dateLabel = new Date(`${item.date}T00:00:00`).toLocaleDateString(isKhmer ? "km-KH" : "en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    const timeLabel = record.time || (isKhmer ? "មិនបានកំណត់" : "Not set");
    const categoryLabel = optionLabel(record.category || (isKhmer ? "ព្រឹត្តិការណ៍" : "Event"));

    root.classList.add("open");
    root.innerHTML = `
      <div class="notification-backdrop" data-close-notification>
        <div class="notification-panel glass-card notification-detail" role="dialog" aria-modal="true" aria-labelledby="notificationDetailTitle">
          <div class="between notification-header">
            <div>
              <span class="eyebrow">${isKhmer ? "ព័ត៌មានលម្អិត" : "Event details"}</span>
              <h2 id="notificationDetailTitle">${escapeHtml(record.title || item.title)}</h2>
            </div>
            <button class="icon-button" type="button" data-close-notification aria-label="${t("close")}">${Icons.close()}</button>
          </div>
          <div class="notification-detail-grid">
            <div><small>${isKhmer ? "កាលបរិច្ឆេទ" : "Date"}</small><strong>${escapeHtml(dateLabel)}</strong></div>
            <div><small>${isKhmer ? "ពេលវេលា" : "Time"}</small><strong>${escapeHtml(timeLabel)}</strong></div>
            <div><small>${isKhmer ? "ប្រភេទ" : "Category"}</small><strong>${escapeHtml(categoryLabel)}</strong></div>
            ${record.notes ? `<div><small>${t("notes")}</small><strong>${escapeHtml(record.notes)}</strong></div>` : ""}
          </div>
          <div class="notification-actions">
            <button class="button ghost-button" type="button" data-close-notification>${t("close")}</button>
          </div>
        </div>
      </div>
    `;

    root.querySelectorAll("[data-close-notification]").forEach(button => button.addEventListener("click", () => {
      root.classList.remove("open");
      root.innerHTML = "";
    }));
  },
  checkHomeSuggestions() {
    if (this.route !== "home") return;

    const todayIso = new Date().toISOString().slice(0, 10);
    const moodMissing = !appData.mood || appData.mood.date !== todayIso;
    const reflectionMissing = !appData.dailyReflection || appData.dailyReflection.date !== todayIso || !(appData.dailyReflection.text || "").trim();
    const focusMissing = !appData.dailyFocus || appData.dailyFocus.date !== todayIso || !Array.isArray(appData.dailyFocus.items) || !appData.dailyFocus.items.length || appData.dailyFocus.items.every(item => !item.done);

    if (!moodMissing && !reflectionMissing && !focusMissing) return;

    const isKhmer = languageCode() === "km";
    const suggestions = [];
    if (moodMissing) suggestions.push(isKhmer ? "កត់សម្គាល់អារម្មណ៍ថ្ងៃនេះ" : "Check in with your mood");
    if (reflectionMissing) suggestions.push(isKhmer ? "សរសេរបានផ្លឹមពីថ្ងៃនេះ" : "Write one good thing today");
    if (focusMissing) suggestions.push(isKhmer ? "ជ្រើសរើស ៣ កិច្ចការតូចៗ" : "Pick 3 tiny wins");

    const message = suggestions.slice(0, 2).join(" • ");
    setTimeout(() => Toast.show(message, "warning", { duration: 3600, icon: Icons.spark() }), 450);
  },
  checkUpcomingAlerts() {
    const alerts = getUpcomingNotifications(7);
    if (!alerts.length) return;

    const signature = alerts.map(item => `${item.type}:${item.date}`).join("|");
    const lastViewed = sessionStorage.getItem("mylife:upcoming-alerts");
    if (lastViewed === signature) return;

    sessionStorage.setItem("mylife:upcoming-alerts", signature);

    const first = alerts[0];
    const label = first.daysLeft === 0
      ? `${first.title} is today`
      : `${first.title} in ${first.daysLeft} day${first.daysLeft === 1 ? "" : "s"}`;

    Toast.show(alerts.length > 1 ? `${alerts.length} reminders are coming soon` : label, "warning", { duration: 3200 });
    this.renderNotificationBadge();
  },
  bindScrollReveal() {
    const elements = document.querySelectorAll(".page > *:not(.home-hero), .tool-launcher-item");
    if (!elements.length) return;

    elements.forEach((element, index) => {
      element.classList.add("reveal-on-scroll");
      element.style.setProperty("--reveal-delay", `${Math.min(index * 55, 330)}ms`);
    });

    if (!("IntersectionObserver" in window)) {
      elements.forEach(element => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8%" });

    elements.forEach(element => observer.observe(element));
  },
  renderProfile() {
    const avatar = document.getElementById("profileAvatar");
    const name = document.getElementById("profileName");
    if (!avatar || !name) return;
    name.textContent = appData.profile.name || t("setupProfile");
    const position = imagePosition(appData.profile.photoPosition);
    avatar.innerHTML = appData.profile.photo ? `<img data-image-position="profile" style="--image-position-x: ${position.x}%; --image-position-y: ${position.y}%;" src="${appData.profile.photo}" alt="">` : initials(appData.profile.name);
    document.querySelector("#profileButton small").textContent = t("personalAccount");
  },
  renderLanguageSwitch() {
    document.querySelectorAll("#languageSwitch [data-language]").forEach(button => {
      button.classList.toggle("active", button.dataset.language === (appData.profile.language || "English"));
    });
  },
  renderMoneyPrivacy() {
    const button = document.getElementById("moneyPrivacyButton");
    const hidden = !!appData.profile.moneyHidden;
    document.body.classList.toggle("money-hidden", hidden);
    if (!button) return;
    button.innerHTML = hidden ? Icons.eyeOff() : Icons.eye();
    button.classList.toggle("active", hidden);
    button.setAttribute("aria-label", hidden ? t("showMoney") : t("hideMoney"));
    button.setAttribute("title", hidden ? t("showMoney") : t("hideMoney"));
  },
  renderSmartAssistant() {
    const button = document.getElementById("smartAssistantButton");
    if (!button) return;
    button.innerHTML = Icons.spark();
    button.setAttribute("aria-label", t("smartAssistant"));
    button.setAttribute("title", t("smartAssistant"));
  },
  startShellClock() {
    this.updateShellClock();
    this.shellClockTimer = setInterval(() => this.updateShellClock(), 1000);
  },
  updateShellClock() {
    const clock = document.getElementById("topbarClock");
    if (!clock) return;
    clock.textContent = new Date().toLocaleTimeString(languageCode() === "km" ? "km-KH" : "en-US", {
      hour: "2-digit",
      minute: "2-digit"
    });
  },
  bindPage(route) {
    if (route === "launcher") bindLauncher();
    if (route === "home") bindHome();
    if (route === "family") bindFamily();
    if (route === "goals") bindGoals(this.param);
    if (route === "money") bindMoney();
    if (route === "calendar") bindCalendar();
    if (route === "memories") bindMemories();
    if (route === "tips") bindTips();
    if (route === "settings") bindSettings();
  },
  bindInteractionSounds() {
    if (this.interactionSoundBound) return;
    this.interactionSoundBound = true;

    document.addEventListener("click", event => {
      const target = event.target.closest("button, a, input, textarea, select, .mood-option, .home-action, .suggestion-button");
      if (!target || target.closest(".toast")) return;
      if (target.matches("input[type='checkbox'], input[type='radio']")) return;
      Sound.play("tap");
    }, { passive: true });
  },
  bindChrome() {
    const menuToggle = document.getElementById("menuToggle");
    const backToTop = document.getElementById("backToTop");
    const closeLauncher = () => {
      document.body.classList.remove("nav-open");
      menuToggle.setAttribute("aria-expanded", "false");
    };

    if (backToTop) {
      backToTop.innerHTML = Icons.arrowUp();

      const updateBackToTop = () => {
        const scrollThreshold = window.innerWidth <= 768 ? 480 : 420;
        const visible = window.scrollY > scrollThreshold;
        backToTop.classList.toggle("is-visible", visible);
      };

      updateBackToTop();
      window.addEventListener("scroll", updateBackToTop, { passive: true });
      backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    const openLauncher = () => {
      document.body.classList.add("nav-open");
      menuToggle.setAttribute("aria-expanded", "true");
    };

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.addEventListener("click", () => {
      location.hash = this.route === "launcher" ? "#home" : "#launcher";
    });
    
    // Close nav when clicking outside the sidebar
    document.addEventListener("click", event => {
      const isNavOpen = document.body.classList.contains("nav-open");
      if (!isNavOpen) return;
      
      const clickedInSidebar = event.target.closest(".sidebar");
      const clickedOnMenuToggle = event.target.closest(".menu-toggle");
      
      // Close only if clicked outside sidebar and not on menu toggle
      if (!clickedInSidebar && !clickedOnMenuToggle) {
        closeLauncher();
      }
    });
    
    // Handle nav-item clicks to navigate and close sidebar
    document.addEventListener("click", event => {
      const navItem = event.target.closest(".nav-item");
      if (!navItem || (!navItem.closest(".sidebar") && !navItem.closest(".mobile-nav"))) return;
      
      const href = navItem.getAttribute("href");
      if (href?.startsWith("#")) {
        event.preventDefault();
        closeLauncher();
        if (location.hash !== href) {
          location.hash = href;
        }
      }
    });
    document.addEventListener("click", event => {
      const financialItem = event.target.closest(".financial-nav-item");
      if (!financialItem) return;

      const href = financialItem.getAttribute("href");
      if (!href?.startsWith("#")) return;
      event.preventDefault();
      if (location.hash === href) return;
      history.pushState({}, "", href);
      this.render();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
        closeLauncher();
        menuToggle.focus();
      }
    });
    document.getElementById("bellButton").addEventListener("click", () => {
      const alerts = getUpcomingNotifications(7);
      if (!alerts.length) {
        this.openNotificationsPanel();
        return;
      }
      this.openNotificationsPanel();
    });
    document.getElementById("smartAssistantButton").addEventListener("click", () => SmartAssistant.open());
    document.addEventListener("click", event => {
      const pinButton = event.target.closest("[data-pin-footer]");
      if (!pinButton) return;
      if (event.__footerPinHandled) return;
      event.__footerPinHandled = true;
      event.preventDefault();
      event.stopPropagation();
      const routeId = pinButton.dataset.pinFooter;
      const selected = footerRoutes().map(route => route.id);
      if (routeId === "home") return;
      const next = selected.includes(routeId)
        ? selected.filter(id => id !== routeId)
        : ["home", ...selected.filter(id => id !== "home"), routeId].slice(0, 5);
      localStorage.setItem(FOOTER_ROUTES_KEY, JSON.stringify(next));
      renderNavigation();
      document.querySelectorAll("[data-pin-footer]").forEach(button => {
        const active = next.includes(button.dataset.pinFooter);
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    });
    document.getElementById("moneyPrivacyButton").addEventListener("click", () => {
      Store.updateProfile({ moneyHidden: !appData.profile.moneyHidden });
      Toast.show(appData.profile.moneyHidden ? t("moneyHidden") : t("moneyVisible"));
    });
    document.getElementById("profileButton").addEventListener("click", () => {
      openProfileModal();
    });
    document.querySelectorAll("#languageSwitch [data-language]").forEach(button => {
      button.addEventListener("click", () => {
        const language = button.dataset.language;
        if (appData.profile.language === language) return;
        Store.updateProfile({ language });
        this.updateShellClock();
        Toast.show(t("languageSwitched"));
      });
    });
    document.getElementById("globalSearch").addEventListener("input", event => this.search(event.target.value));
    document.addEventListener("click", event => {
      if (!event.target.closest(".search-wrap")) document.getElementById("searchResults").hidden = true;
    });
  },
  search(query) {
    const panel = document.getElementById("searchResults");
    const q = query.trim();
    if (!q) {
      panel.hidden = true;
      return;
    }
    const html = Store.search(q).map(([title, items]) => {
      if (!items.length) return "";
      return `<div style="margin-bottom:12px"><strong class="eyebrow">${title}</strong>${items.slice(0, 4).map(item => `<a class="list-row" href="${item.href}"><span>${escapeHtml(item.label)}</span><span class="pill">${item.type}</span></a>`).join("")}</div>`;
    }).join("");
    panel.innerHTML = html || emptyState(t("noResultsFound"), t("searchSavedData"));
    panel.hidden = false;
  },
  openEventModal(event = {}) {
    Modal.open({
      title: event.id ? t("editEvent") : t("addEvent"),
      submitText: event.id ? t("saveEvent") : t("addEvent"),
      fields: [
        { name: "title", label: t("eventTitle"), value: event.title, required: true },
        { name: "date", label: t("date"), type: "date", value: event.date || new Date().toISOString().slice(0, 10), required: true },
        { name: "time", label: t("time"), type: "time", value: event.time },
        { name: "category", label: t("category"), type: "select", options: ["Personal", "Family", "Goal", "Bill", "Loan", "Reminder"], value: event.category || "Personal" },
        { name: "familyMember", label: t("familyMemberName"), type: "select", options: ["", ...appData.family.map(member => member.name)], value: event.familyMember || "" },
        { name: "reminder", label: t("reminder"), type: "checkbox", value: event.reminder ?? true },
        { name: "notes", label: t("notes"), type: "textarea", value: event.notes }
      ],
      onSubmit(data) {
        if (event.id) Store.edit("calendarEvents", event.id, data);
        else Store.add("calendarEvents", data);
        Toast.show(event.id ? t("eventSaved") : t("eventAdded"));
      }
    });
  }
};

function imagePosition(value) {
  return {
    x: clamp(Number(value?.x) || 0, -50, 50),
    y: clamp(Number(value?.y) || 0, -50, 50)
  };
}

function createImagePositionEditor({ src, key, onSave, onCancel, title = "Drag to adjust" }) {
  const wrapper = document.createElement("div");
  wrapper.className = "image-position-preview";
  wrapper.innerHTML = `
    <div class="image-position-frame" data-image-position-frame>
      <img data-image-position="${escapeAttr(key)}" class="draggable-image" src="${escapeAttr(src)}" alt="" style="--image-position-x: 0%; --image-position-y: 0%;">
    </div>
    <div class="image-position-hint">${escapeHtml(title)}</div>
    <div class="action-row">
      <button type="button" class="button ghost-button" data-image-position-cancel>${languageCode() === "km" ? "បោះបង់" : "Cancel"}</button>
      <button type="button" class="button" data-image-position-save>${languageCode() === "km" ? "រក្សាទុក" : "Save"}</button>
    </div>
  `;

  const previewImage = wrapper.querySelector("img");
  const frame = wrapper.querySelector(".image-position-frame");
  let dragStart = null;

  const updatePosition = (clientX, clientY) => {
    const bounds = frame.getBoundingClientRect();
    const x = clamp((Number.parseFloat(previewImage.style.getPropertyValue("--image-position-x")) || 0) + ((clientX - dragStart.x) / bounds.width) * 100, -50, 50);
    const y = clamp((Number.parseFloat(previewImage.style.getPropertyValue("--image-position-y")) || 0) + ((clientY - dragStart.y) / bounds.height) * 100, -50, 50);
    previewImage.style.setProperty("--image-position-x", `${x}%`);
    previewImage.style.setProperty("--image-position-y", `${y}%`);
  };

  previewImage.addEventListener("pointerdown", event => {
    event.preventDefault();
    previewImage.setPointerCapture(event.pointerId);
    dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    previewImage.classList.add("is-image-dragging");
  });

  previewImage.addEventListener("pointermove", event => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    updatePosition(event.clientX, event.clientY);
    dragStart = { ...dragStart, x: event.clientX, y: event.clientY };
  });

  const finishDrag = () => {
    dragStart = null;
    previewImage.classList.remove("is-image-dragging");
  };

  previewImage.addEventListener("pointerup", finishDrag);
  previewImage.addEventListener("pointercancel", finishDrag);

  wrapper.querySelector("[data-image-position-cancel]")?.addEventListener("click", () => {
    onCancel?.();
    wrapper.remove();
  });

  wrapper.querySelector("[data-image-position-save]")?.addEventListener("click", () => {
    const position = imagePosition({
      x: Number.parseFloat(previewImage.style.getPropertyValue("--image-position-x")),
      y: Number.parseFloat(previewImage.style.getPropertyValue("--image-position-y"))
    });
    onSave?.(position);
    wrapper.remove();
  });

  return wrapper;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function bindImagePositioning() {
  document.querySelectorAll("[data-image-position]").forEach(image => {
    let dragStart;
    image.addEventListener("pointerdown", event => {
      event.preventDefault();
      image.setPointerCapture(event.pointerId);
      dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, position: imagePosition({
        x: Number.parseFloat(image.style.getPropertyValue("--image-position-x")),
        y: Number.parseFloat(image.style.getPropertyValue("--image-position-y"))
      }) };
      image.classList.add("is-image-dragging");
    });
    image.addEventListener("pointermove", event => {
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;
      const bounds = image.closest("[data-image-position-frame]")?.getBoundingClientRect() || image.getBoundingClientRect();
      const x = clamp(dragStart.position.x + ((event.clientX - dragStart.x) / bounds.width) * 100, -50, 50);
      const y = clamp(dragStart.position.y + ((event.clientY - dragStart.y) / bounds.height) * 100, -50, 50);
      image.style.setProperty("--image-position-x", `${x}%`);
      image.style.setProperty("--image-position-y", `${y}%`);
    });
    const finish = event => {
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;
      const position = imagePosition({
        x: Number.parseFloat(image.style.getPropertyValue("--image-position-x")),
        y: Number.parseFloat(image.style.getPropertyValue("--image-position-y"))
      });
      dragStart = null;
      image.classList.remove("is-image-dragging");
      saveImagePosition(image.dataset.imagePosition, position);
    };
    image.addEventListener("pointerup", finish);
    image.addEventListener("pointercancel", finish);
  });
}

function saveImagePosition(key, position) {
  if (key === "profile") Store.updateProfile({ photoPosition: position });
  else if (key.startsWith("family-member:")) Store.edit("family", key.slice(14), { photoPosition: position });
  else if (key.startsWith("memory:")) Store.edit("memories", key.slice(7), { photoPosition: position });
  else if (key === "family-photo" || key === "tips-couple") {
    const storageKey = key === "family-photo" ? "mylife:family-photo-position" : "mylife:tips-couple-image-position";
    localStorage.setItem(storageKey, JSON.stringify(position));
  }
}

function storedImagePosition(key) {
  try {
    return imagePosition(JSON.parse(localStorage.getItem(key) || "null"));
  } catch (error) {
    return imagePosition();
  }
}

function emptyState(title, body, actionLabel = "", action = "") {
  return `
    <div class="empty-card">
      <div>
        <span class="icon-badge">${Icons.plus()}</span>
        <h2>${escapeHtml(title)}</h2>
        <p class="secondary">${escapeHtml(body)}</p>
        ${actionLabel ? `<button class="button" data-action="${action}">${Icons.plus()} ${escapeHtml(actionLabel)}</button>` : ""}
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => App.init());
