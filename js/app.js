const App = {
  route: "home",
  param: "",
  shellClockTimer: null,
  dueReminderTimer: null,
  dueReminderInterval: null,
  quickActionCloseTimer: null,
  welcomePosterStartupTimer: null,
  welcomePosterTimer: null,
  interactionSoundBound: false,
  init() {
    Store.load();
    // Retry scheduling starts before the first network call, so a change that never
    // reached the cloud is pushed as soon as the app can reach the network even if
    // the pull below fails.
    Store.startSyncRetry();
    Login.showIfNeeded();
    renderNavigation();
    this.bindChrome();
    this.bindInteractionSounds();
    this.startShellClock();
    if (typeof TopbarWeather !== "undefined") TopbarWeather.init();
    window.addEventListener("hashchange", () => this.render());
    window.addEventListener("popstate", () => this.render());
    this.render();
    this.syncWithCloud();
    this.startWelcomePosterOnOpen();
    this.checkUpcomingAlerts();
    this.startDueReminderWatcher();
    setTimeout(() => NotificationManager.sync(), 1200);
  },
  startWelcomePosterOnOpen() {
    let attempts = 0;
    this.welcomePosterStartupTimer = window.setInterval(() => {
      attempts += 1;
      const modalRoot = document.getElementById("modalRoot");
      if (Login.isOpen || modalRoot?.querySelector("#loginModal")) {
        if (attempts >= 120) window.clearInterval(this.welcomePosterStartupTimer);
        return;
      }
      if (appData.profile.name && (Login.authenticated || Login.guestMode || Login.getRememberedSession())) {
        window.clearInterval(this.welcomePosterStartupTimer);
        this.welcomePosterStartupTimer = null;
        this.openWelcomePoster();
        return;
      }
      if (attempts >= 120) window.clearInterval(this.welcomePosterStartupTimer);
    }, 500);
  },
  getWelcomePoster() {
    try {
      return localStorage.getItem("mylife:welcome-poster:v1") || "";
    } catch (error) {
      console.warn("MYLIFE could not read the welcome poster.", error);
      return "";
    }
  },
  getTodayWelcomeItems() {
    const today = calendarDateInput(new Date());
    const items = [];
    const add = item => items.push(item);

    appData.calendarEvents.forEach(event => {
      if (event.date !== today) return;
      add({ type: "event", title: event.title || t("calendarEvent"), detail: event.time ? fmtClock(event.time) : event.category || "", href: "#calendar" });
    });
    appData.reminders.forEach(reminder => {
      if (reminder.done || reminder.date !== today) return;
      add({ type: "reminder", title: reminder.title || t("reminder"), detail: reminder.time ? fmtClock(reminder.time) : reminder.category || "", href: "#daily" });
    });
    appData.bills.forEach(bill => {
      if (bill.reminder === false || bill.status === "Paid" || !bill.due) return;
      const dueToday = typeof recurringDatesInMonth === "function"
        ? recurringDatesInMonth(bill.due, bill.frequency || "Monthly", new Date()).includes(today)
        : bill.due === today;
      if (!dueToday || (typeof billPaidCurrentCycle === "function" && billPaidCurrentCycle(bill))) return;
      add({
        type: "bill",
        title: bill.name || t("bill"),
        detail: bill.amount ? formatPlainMoney(bill.amount, bill.currency) : bill.category || "",
        href: "#money/bills"
      });
    });
    appData.loans.forEach(loan => {
      if (typeof nextLoanPaymentDate !== "function" || nextLoanPaymentDate(loan) !== today) return;
      if ((loan.payments || []).some(payment => payment.date === today)) return;
      add({
        type: "loan",
        title: loan.name || t("loan"),
        detail: loan.monthlyPayment ? formatPlainMoney(loan.monthlyPayment, loan.currency) : "",
        href: "#money/loans"
      });
    });

    const typeLabels = { event: t("calendarEvent"), reminder: t("reminder"), bill: t("bill"), loan: t("loan") };
    return items
      .sort((left, right) => `${left.type} ${left.title}`.localeCompare(`${right.type} ${right.title}`))
      .map(item => ({ ...item, typeLabel: typeLabels[item.type] }));
  },
  welcomePosterImageContent(image) {
    const imageContent = image
      ? `<img class="welcome-poster-image" data-welcome-poster-image src="${escapeAttr(image)}" alt="${escapeAttr(t("familyPoster"))}">`
      : `<span class="welcome-poster-placeholder"><span aria-hidden="true">♡</span><strong>${t("addPosterPrompt")}</strong></span>`;
    return `${imageContent}<span class="welcome-poster-photo-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h3l1.25-2h4.5l1.25 2h3A1.5 1.5 0 0 1 20 7.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-10Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12.5" r="3.25" stroke="currentColor" stroke-width="1.7"/></svg></span>`;
  },
  openWelcomePoster() {
    if (!appData.profile.name || Login.isOpen || document.getElementById("modalRoot")?.querySelector("#loginModal")) return;
    if (!Login.authenticated && !Login.guestMode && !Login.getRememberedSession()) return;
    // Settings → welcome photo: once a day (default) / every time / off
    const posterMode = appData.profile.welcomePosterMode || "daily";
    if (posterMode === "off") return;
    if (posterMode === "daily") {
      try {
        const shownKey = "mylife:welcome-poster:shown";
        if (localStorage.getItem(shownKey) === localDateInput()) return;
        localStorage.setItem(shownKey, localDateInput());
      } catch (error) { /* storage blocked: show it */ }
    }

    const root = document.getElementById("modalRoot");
    const poster = this.getWelcomePoster();
    const todayItems = this.getTodayWelcomeItems();
    root.innerHTML = `
      <section class="welcome-poster-card ${todayItems.length ? "has-agenda" : ""}" role="dialog" aria-modal="true" aria-labelledby="welcomePosterTitle">
        <button class="welcome-poster-image-wrap" type="button" data-welcome-poster-choose aria-label="${escapeAttr(poster ? t("changePoster") : t("uploadPoster"))}">
          ${this.welcomePosterImageContent(poster)}
        </button>
        <div class="welcome-poster-copy">
          <span class="eyebrow">MYLIFE</span>
          <h2 id="welcomePosterTitle">${t("welcomePosterTitle")}</h2>
          <p>${t("welcomePosterMessage")}</p>
        </div>
        <section class="welcome-poster-agenda" aria-labelledby="welcomePosterAgendaTitle">
          <h3 id="welcomePosterAgendaTitle">${t("todayAgenda")}</h3>
          ${todayItems.length ? `<div class="welcome-poster-agenda-items">${todayItems.map(item => `
            <a class="welcome-poster-agenda-item" href="${escapeAttr(item.href)}" data-welcome-agenda-route="${escapeAttr(item.href)}">
              <span class="welcome-poster-agenda-kind">${escapeHtml(item.typeLabel)}</span>
              <span class="welcome-poster-agenda-title">${escapeHtml(item.title)}</span>
              ${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}
              ${Icons.chevron()}
            </a>
          `).join("")}</div>` : `<p class="welcome-poster-agenda-empty">${t("todayAgendaEmpty")}</p>`}
        </section>
        <div class="welcome-poster-actions">
          <input class="sr-only" data-welcome-poster-input type="file" accept="image/*">
          <span class="welcome-poster-auto-close" data-welcome-poster-countdown role="timer" aria-live="polite">${t("autoCloseInSeconds", { seconds: 4 })}</span>
        </div>
      </section>
    `;
    root.classList.add("open", "welcome-poster-modal");

    const close = () => {
      window.clearInterval(this.welcomePosterTimer);
      this.welcomePosterTimer = null;
      root.classList.remove("open", "welcome-poster-modal");
      root.innerHTML = "";
    };
    const input = root.querySelector("[data-welcome-poster-input]");
    const countdown = root.querySelector("[data-welcome-poster-countdown]");
    const stopAutoClose = () => {
      window.clearInterval(this.welcomePosterTimer);
      this.welcomePosterTimer = null;
    };
    const startAutoClose = () => {
      stopAutoClose();
      const deadline = Date.now() + 4000;
      this.welcomePosterTimer = window.setInterval(() => {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        if (remaining > 0) {
          countdown.textContent = t("autoCloseInSeconds", { seconds: remaining });
          return;
        }
        close();
      }, 100);
    };
    root.addEventListener("click", event => {
      if (root.classList.contains("welcome-poster-modal") && !event.target.closest(".welcome-poster-card")) close();
    });
    root.querySelector("[data-welcome-poster-choose]")?.addEventListener("click", () => {
      stopAutoClose();
      countdown.textContent = t("posterChooseHint");
      input?.click();
    });
    root.querySelectorAll("[data-welcome-agenda-route]").forEach(link => link.addEventListener("click", event => {
      event.preventDefault();
      const route = link.dataset.welcomeAgendaRoute;
      close();
      location.hash = route;
    }));
    input?.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      const image = await this.saveWelcomePoster(file);
      if (image) {
        const imageWrap = root.querySelector("[data-welcome-poster-choose]");
        if (imageWrap) {
          imageWrap.setAttribute("aria-label", t("changePoster"));
          imageWrap.innerHTML = this.welcomePosterImageContent(image);
        }
      }
      startAutoClose();
    });

    input?.addEventListener("cancel", startAutoClose);
    startAutoClose();
    root.querySelector("[data-welcome-poster-choose]")?.focus({ preventScroll: true });
  },
  async saveWelcomePoster(file) {
    if (!file) return "";
    if (!file.type?.startsWith("image/")) {
      Toast.show(t("posterImageError"), "warning");
      return "";
    }
    if (file.size > 15 * 1024 * 1024) {
      Toast.show(t("posterSizeError"), "warning");
      return "";
    }
    try {
      const image = await prepareWelcomePoster(file);
      localStorage.setItem("mylife:welcome-poster:v1", image);
      this.updateWelcomePosterPreview(image);
      Toast.show(t("posterSaved"), "success");
      return image;
    } catch (error) {
      console.warn("MYLIFE could not save the welcome poster.", error);
      Toast.show(t("posterSaveError"), "warning");
      return "";
    }
  },
  removeWelcomePoster() {
    try {
      localStorage.removeItem("mylife:welcome-poster:v1");
      this.updateWelcomePosterPreview("");
      Toast.show(t("posterRemoved"), "success");
    } catch (error) {
      console.warn("MYLIFE could not remove the welcome poster.", error);
      Toast.show(t("posterRemoveError"), "warning");
    }
  },
  updateWelcomePosterPreview(image) {
    const preview = document.querySelector("[data-welcome-poster-preview]");
    if (preview) {
      preview.innerHTML = image
        ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(t("familyPoster"))}">`
        : `<span>${t("noPoster")}</span>`;
    }
    const removeButton = document.querySelector("[data-action='remove-welcome-poster']");
    if (removeButton) removeButton.hidden = !image;
    const uploadButton = document.querySelector("[data-action='upload-welcome-poster']");
    if (uploadButton) uploadButton.textContent = t(image ? "changePoster" : "uploadPoster");
  },
  /**
   * Reconciles with the cloud once the shell has already rendered.
   *
   * Deliberately not awaited: the UI must never wait on the network. Running the
   * pull late is safe now because it is tombstone-aware and can no longer bring a
   * deleted record back. It only re-renders when the user has not navigated away
   * in the meantime.
   */
  // Pull changes made elsewhere (Telegram buttons and messages, another device)
  // while the app stays open. Re-renders only when something actually changed
  // and the user isn't typing or using a form.
  bindLiveCloudSync() {
    if (this.liveCloudSyncBound) return;
    this.liveCloudSyncBound = true;
    let lastPull = Date.now();
    const busy = () => document.getElementById("modalRoot")?.classList.contains("open")
      || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    const pull = async (force = false) => {
      if (document.visibilityState !== "visible" || (!force && Date.now() - lastPull < 45000)) return;
      if (typeof SyncState !== "undefined" && SyncState.isPending?.()) return;
      lastPull = Date.now();
      const before = JSON.stringify(appData);
      const applied = await Store.syncFromSupabase().catch(() => false);
      if (applied && JSON.stringify(appData) !== before && !busy()) this.render();
    };
    document.addEventListener("visibilitychange", () => pull(true));
    window.addEventListener("focus", () => pull());
    window.setInterval(() => pull(), 60000);
    window.addEventListener("mylife:cloud-merged", () => {
      if (!busy()) this.render();
    });
  },
  syncWithCloud() {
    this.bindLiveCloudSync();
    const routeAtStart = this.route;
    Promise.resolve(Store.syncFromSupabase())
      .then(applied => {
        if (!applied || this.route !== routeAtStart) return;
        this.render();
      })
      .catch(error => console.warn("MYLIFE could not reconcile with the cloud at startup.", error));
  },
  parseRoute() {
    const [route = "home", param = ""] = location.hash.replace("#", "").split("?")[0].split("/");
    this.route = route || "home";
    this.param = param;
  },
  render() {
    this.parseRoute();
    if (typeof syncLinkedGoals === "function") syncLinkedGoals();
    const app = document.getElementById("app");
    const route = this.route;
    document.documentElement.lang = languageCode();
    this.renderTheme();
    this.renderQuickActions();
    renderNavigation();
    setActiveNav(route);
    this.renderProfile();
    this.renderMoneyPrivacy();
    this.renderSmartAssistant();
    document.body.classList.remove("nav-open");
    document.body.classList.toggle("launcher-page-open", route === "launcher");
    document.body.classList.toggle("topbar-home", route === "home");
    if (typeof TopbarWeather !== "undefined") TopbarWeather.render();

    if (route === "launcher") app.innerHTML = renderLauncher();
    else if (route === "summary") app.innerHTML = renderSummary();
    else if (route === "family") app.innerHTML = renderFamily();
    else if (route === "goals") app.innerHTML = renderGoals(this.param);
    else if (route === "money") app.innerHTML = renderMoney(this.param || "overview");
    else if (route === "calendar") app.innerHTML = renderCalendar(this.param || "month");
    else if (route === "daily") app.innerHTML = renderDaily();
    else if (route === "today" && typeof renderToday === "function") app.innerHTML = renderToday();
    else if (route === "memories") app.innerHTML = renderMemories();
    else if (route === "tips") {
      const renderTipsContent = typeof renderTips === "function"
        ? renderTips
        : (typeof renderLegacyTips === "function" ? renderLegacyTips : () => `<section class="page"><article class="glass-card card-pad"><h1 class="page-title">Tips</h1><p class="page-subtitle">This section is loading. Please refresh if it stays unavailable.</p></article></section>`);
      app.innerHTML = renderTipsContent();
    }
    else if (route === "settings") app.innerHTML = renderSettings();
    else if (route === "notifications" && typeof NotifyCenter !== "undefined") app.innerHTML = NotifyCenter.renderPage();
    else if (route === "scan" && typeof SmartScanPage !== "undefined") app.innerHTML = SmartScanPage.render();
    else if (route === "help") app.innerHTML = renderHelp();
    else app.innerHTML = renderHome();

    if (!appData.profile.name) {
      Login.showIfNeeded();
    }

    this.bindPage(route);
    this.bindScrollReveal();
    this.checkUpcomingAlerts();
    this.scheduleDueReminderAlerts();
    // (home suggestion toast removed — the mood / reflection / focus cards are on Home already)
    this.renderNotificationBadge();
    app.focus({ preventScroll: true });
  },
  renderNotificationBadge() {
    NotificationCenter.renderBadge();
  },
  openNotificationsPanel() {
    NotificationCenter.open();
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

    const todayIso = localDateInput();
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

    // No toast on open — the bell badge shows the count.
    void label;
    NotificationManager.sync();
    this.renderNotificationBadge();
  },
  startDueReminderWatcher() {
    this.scheduleDueReminderAlerts();
    if (this.dueReminderInterval) return;
    this.dueReminderInterval = window.setInterval(() => {
      this.checkDueReminderAlerts();
      this.scheduleDueReminderAlerts();
      this.renderNotificationBadge();
    }, 15000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.checkDueReminderAlerts();
        this.scheduleDueReminderAlerts();
      }
    });
  },
  alertDateTime(item) {
    if (!item?.date) return null;
    const date = new Date(`${item.date}T${item.time || "09:00"}:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  },
  dueReminderKey(item) {
    return [item.kind || "alert", item.id || item.title || "item", item.date || "", item.time || "09:00"].join("|");
  },
  hasSentDueReminder(item) {
    try {
      const sent = JSON.parse(localStorage.getItem("mylife:due-reminder-alerts") || "{}");
      return Boolean(sent[this.dueReminderKey(item)]);
    } catch (error) {
      return false;
    }
  },
  markDueReminderSent(item) {
    try {
      const key = this.dueReminderKey(item);
      const sent = JSON.parse(localStorage.getItem("mylife:due-reminder-alerts") || "{}");
      sent[key] = new Date().toISOString();
      const entries = Object.entries(sent).slice(-100);
      localStorage.setItem("mylife:due-reminder-alerts", JSON.stringify(Object.fromEntries(entries)));
    } catch (error) {
      console.warn("MYLIFE could not record reminder alert state.", error);
    }
  },
  dueReminderPayload(item) {
    return {
      title: item.title || "MYLIFE alert",
      body: item.body || item.notes || item.category || "It is time.",
      url: item.url || "/#daily"
    };
  },
  async showDueReminder(item) {
    const payload = this.dueReminderPayload(item);
    Toast.show(`${payload.title}: ${payload.body}`, "warning", { duration: 6000, sound: "notify" });
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    try {
      const registration = await navigator.serviceWorker?.ready;
      // When this device has a Web Push subscription the server already sends
      // the same alert, so only show the in-app toast to avoid a duplicate.
      const pushSubscription = await registration?.pushManager?.getSubscription?.();
      if (pushSubscription) return;
      await registration?.showNotification(payload.title, {
        body: payload.body,
        icon: "/assets/icons/mylife-icon-192.png",
        badge: "/assets/icons/mylife-icon-192.png",
        data: { url: payload.url }
      });
    } catch (error) {
      console.warn("MYLIFE could not display the reminder notification.", error);
    }
  },
  collectDueAlertItems() {
    const items = [];
    const add = item => {
      if (!item?.date || !item.title) return;
      items.push({ time: "09:00", ...item });
    };

    appData.reminders.forEach(reminder => {
      if (reminder.done) return;
      add({
        kind: "reminder",
        id: reminder.id,
        title: reminder.title || "MYLIFE reminder",
        body: reminder.notes || reminder.category || "Reminder time",
        date: reminder.date,
        time: reminder.time || "09:00",
        url: "/#daily"
      });
    });

    appData.calendarEvents.forEach(event => {
      if (event.reminder === false) return;
      add({
        kind: "calendar",
        id: event.id,
        title: event.title || "MYLIFE event",
        body: event.notes || event.category || "Upcoming event",
        date: event.date,
        time: event.time || "09:00",
        url: "/#calendar"
      });
    });

    const todayIso = localDateInput();
    appData.bills.forEach(bill => {
      if (bill.reminder === false || !bill.due) return;
      // cycles up to 3 days ahead so the "N days before" stages can fire; a paid
      // current cycle is skipped (same rule as the server)
      const dates = new Set(billCycleDates(bill, todayIso, shiftIsoDate(todayIso, 3)).filter(date => !(bill.status === "Paid" && date === bill.due)));
      if (bill.status !== "Paid") dates.add(bill.due);
      dates.forEach(date => add({
        kind: "bill",
        id: bill.id,
        title: bill.name || "Bill due",
        body: bill.amount ? `${optionLabel(bill.category || "Bill")} - ${typeof formatPlainMoney === "function" ? formatPlainMoney(bill.amount, bill.currency) : bill.amount}` : (bill.notes || "Bill payment is due"),
        date,
        url: "/#money/bills"
      }));
    });

    appData.family.forEach(member => {
      if (member.dateReminder === false) return;
      [["birthday", member.birthday], ["anniversary", member.anniversaryDate]].forEach(([type, value]) => {
        // today and the next 3 days, so the "N days before" stages can fire
        [0, 1, 2, 3].forEach(offset => {
          const dayIso = shiftIsoDate(todayIso, offset);
          const date = typeof yearlyDateInMonth === "function" && value ? yearlyDateInMonth(value, parseAppDate(dayIso)) : "";
          if (date !== dayIso || value > dayIso) return;
          add({
            kind: type,
            id: `${member.id}-${type}`,
            title: `${t(type)}: ${member.name}`,
            body: member.relationshipNote || "",
            date,
            url: "/#family"
          });
        });
      });
    });

    appData.loans.forEach(loan => {
      const nextPayment = typeof nextLoanPaymentDate === "function" ? nextLoanPaymentDate(loan) : "";
      if (!nextPayment) return;
      const alreadyPaid = (loan.payments || []).some(payment => payment.date === nextPayment);
      if (alreadyPaid) return;
      add({
        kind: "loan",
        id: loan.id,
        title: loan.name || "Loan payment due",
        body: loan.monthlyPayment ? `${t("monthlyPayment")}: ${typeof formatPlainMoney === "function" ? formatPlainMoney(loan.monthlyPayment, loan.currency) : loan.monthlyPayment}` : "Loan payment is due",
        date: nextPayment,
        url: "/#money/loans"
      });
    });

    const currentMonth = localDateInput().slice(0, 7);
    appData.savings.forEach(saving => {
      const monthlyAmount = Number(saving.monthlyContribution || 0);
      const contribution = typeof getSavingsContribution === "function" ? getSavingsContribution(saving, currentMonth) : null;
      if (monthlyAmount && !contribution?.paid) {
        add({
          kind: "savings-contribution",
          id: `${saving.id || saving.name}-${currentMonth}`,
          title: saving.name || "Savings contribution",
          body: `${t("monthlyContribution")}: ${typeof formatPlainMoney === "function" ? formatPlainMoney(monthlyAmount, saving.currency) : monthlyAmount}`,
          date: `${currentMonth}-01`,
          url: "/#money/savings"
        });
      }
      const reached = Number(saving.targetAmount || 0) > 0 && Number(saving.currentAmount || 0) >= Number(saving.targetAmount || 0);
      if (saving.deadline && saving.deadline >= todayIso && !reached) {
        add({
          kind: "savings-deadline",
          id: `${saving.id || saving.name}-deadline`,
          title: saving.name || "Savings deadline",
          body: saving.notes || t("deadline"),
          date: saving.deadline,
          url: "/#money/savings"
        });
      }
    });

    if (typeof NotifyPrefs === "undefined") return items;
    // notification center: 3 / 2 / 1 days before + on the day (same stages as Telegram),
    // then the App channel / tool switches
    const km = languageCode() === "km";
    const staged = [];
    items.forEach(item => {
      const tool = NotifyPrefs.toolOf(item.kind);
      if (!NotifyPrefs.STAGE_TOOLS.includes(tool) || item.kind === "savings-contribution") {
        staged.push(item);
        return;
      }
      const stages = NotifyPrefs.stagesFor(appData.profile, tool);
      if (stages.includes(0)) staged.push(item);
      stages.filter(days => days > 0).forEach(days => {
        const left = km ? `នៅសល់ ${days} ថ្ងៃទៀត` : `${days} day${days === 1 ? "" : "s"} to go`;
        staged.push({ ...item, id: `${item.id}-before-${days * 1440}`, date: shiftIsoDate(item.date, -days), dueDate: item.date, early: days * 1440, body: item.body ? `⏳ ${left} · ${item.body}` : `⏳ ${left}` });
      });
    });
    return staged.filter(item => NotifyPrefs.allows(appData.profile, item.kind, "app"));
  },
  checkDueReminderAlerts() {
    if (appData.profile?.notificationsEnabled === false) return;
    const now = new Date();
    // Background tabs throttle timers, so allow alerts that came due while the
    // tab was hidden to still show when the person comes back.
    const graceMs = 15 * 60 * 1000;
    this.collectDueAlertItems().forEach(item => {
      if (this.hasSentDueReminder(item)) return;
      const dueAt = this.alertDateTime(item);
      if (!dueAt) return;
      const delta = now - dueAt;
      if (delta < 0 || delta > graceMs) return;
      this.markDueReminderSent(item);
      this.showDueReminder(item);
    });
  },
  scheduleDueReminderAlerts() {
    window.clearTimeout(this.dueReminderTimer);
    this.dueReminderTimer = null;
    if (appData.profile?.notificationsEnabled === false) return;

    const now = new Date();
    const next = this.collectDueAlertItems()
      .filter(item => !this.hasSentDueReminder(item))
      .map(item => ({ item, dueAt: this.alertDateTime(item) }))
      .filter(item => item.dueAt && item.dueAt >= now)
      .sort((a, b) => a.dueAt - b.dueAt)[0];

    if (!next) return;
    const delay = Math.max(0, Math.min(next.dueAt - now, 2147483647));
    this.dueReminderTimer = window.setTimeout(() => {
      this.checkDueReminderAlerts();
      this.scheduleDueReminderAlerts();
    }, delay);
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
  renderMoneyPrivacy() {
    const hidden = !!appData.profile.moneyHidden;
    document.body.classList.toggle("money-hidden", hidden);
  },
  renderTheme() {
    const theme = appData.profile.theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
  },
  renderSmartAssistant() {
    const button = document.getElementById("smartAssistantButton");
    if (!button) return;
    button.innerHTML = Icons.spark();
    button.setAttribute("aria-label", t("smartAssistant"));
    button.setAttribute("title", t("smartAssistant"));
  },
  renderQuickActions() {
    const menu = document.getElementById("quickActionMenu");
    const toggle = document.getElementById("quickActionToggle");
    if (!menu || !toggle) return;

    const actions = quickActionList();
    const saved = Array.isArray(appData.profile.quickActions) ? appData.profile.quickActions : [];
    const oldDefault = saved.length === 3 && ["smart-assistant", "add-event", "add-goal"].every(id => saved.includes(id));
    const selected = saved.length && !oldDefault ? saved : QUICK_ACTION_DEFAULTS;

    toggle.innerHTML = Icons.plus();
    menu.innerHTML = actions
      .filter(([id]) => selected.includes(id))
      .map(([id, icon, label]) => `<button type="button" class="quick-action-item" data-quick-action="${id}" title="${escapeAttr(label)}"><span>${icon}</span><strong>${escapeHtml(label)}</strong></button>`)
      .join("");
    menu.hidden = true;
    toggle.disabled = !menu.children.length;
    toggle.setAttribute("aria-label", t("quickActions"));
    toggle.setAttribute("title", t("quickActions"));
  },
  startShellClock() {
    this.updateShellClock();
    this.shellClockTimer = setInterval(() => this.updateShellClock(), 1000);
  },
  updateShellClock() {
    const clock = document.getElementById("topbarClock");
    const locale = languageCode() === "km" ? "km-KH" : "en-US";
    const now = new Date();
    if (!clock) return;
    void locale;
    clock.textContent = fmtClockDate(now);
  },
  bindPage(route) {
    if (route === "launcher" && typeof bindLauncher === "function") bindLauncher();
    if (route === "home" && typeof bindHome === "function") bindHome();
    if (route === "summary" && typeof bindHomeActions === "function") bindHomeActions({ bindProfile: false });
    if (route === "family" && typeof bindFamily === "function") bindFamily();
    if (route === "goals" && typeof bindGoals === "function") bindGoals(this.param);
    if (route === "money" && typeof bindMoney === "function") bindMoney();
    if (route === "calendar" && typeof bindCalendar === "function") bindCalendar();
    if (route === "daily" && typeof bindDaily === "function") bindDaily();
    if (route === "today" && typeof bindToday === "function") bindToday();
    if (route === "memories" && typeof bindMemories === "function") bindMemories();
    if (route === "tips") {
      if (typeof bindTips === "function") bindTips();
      else if (typeof bindLegacyTips === "function") bindLegacyTips();
    }
    if (route === "settings" && typeof bindSettings === "function") bindSettings();
    if (route === "notifications" && typeof NotifyCenter !== "undefined") NotifyCenter.bindPage();
    if (route === "scan" && typeof SmartScanPage !== "undefined") SmartScanPage.bind();
  },
  bindInteractionSounds() {
    if (this.interactionSoundBound) return;
    this.interactionSoundBound = true;

    document.addEventListener("click", event => {
      const moodButton = event.target.closest("[data-mood]");
      if (moodButton) {
        const moodMap = {
          happy: { label: t("moodHappy"), robot: t("moodCheerful") },
          calm: { label: t("moodCalm"), robot: t("moodBalanced") },
          tired: { label: t("moodTired"), robot: t("moodLowEnergy") },
          stressed: { label: t("moodStressed"), robot: t("moodNeedsEase") },
          excited: { label: t("moodExcited"), robot: t("moodMotivated") }
        };
        const choice = moodMap[moodButton.dataset.mood];
        if (choice) Store.updateMood({ value: moodButton.dataset.mood, ...choice });
      }

      const target = event.target.closest("button, a, input, textarea, select, .mood-option, .home-action, .suggestion-button");
      if (!target || target.closest(".toast")) return;
      if (target.matches("input[type='checkbox'], input[type='radio']")) return;
      Sound.play("tap");
    }, { passive: true });
  },
  bindChrome() {
    const menuToggle = document.getElementById("menuToggle");
    const backToTop = document.getElementById("backToTop");
    const quickActionMenu = document.getElementById("quickActionMenu");
    const quickActionToggle = document.getElementById("quickActionToggle");
    const quickActionDock = quickActionToggle?.closest(".quick-action-dock");
    let quickActionDrag = null;
    let suppressQuickActionClick = false;
    document.addEventListener("click", event => {
      if (!suppressQuickActionClick) return;
      suppressQuickActionClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    const positionQuickActionDock = (left, top) => {
      if (!quickActionDock) return;
      const bounds = quickActionDock.getBoundingClientRect();
      const mobileNav = document.getElementById("mobileNav");
      const navVisible = mobileNav && getComputedStyle(mobileNav).display !== "none";
      const navTop = navVisible ? mobileNav.getBoundingClientRect().top : window.innerHeight;
      const maxLeft = Math.max(8, window.innerWidth - bounds.width - 8);
      const maxTop = Math.max(8, Math.min(window.innerHeight - bounds.height - 8, navTop - bounds.height - (navVisible ? 14 : 8)));
      const nextLeft = Math.min(maxLeft, Math.max(8, left));
      const nextTop = Math.min(maxTop, Math.max(8, top));
      quickActionDock.style.left = `${nextLeft}px`;
      quickActionDock.style.top = `${nextTop}px`;
      quickActionDock.style.right = "auto";
      quickActionDock.style.bottom = "auto";
    };
    if (quickActionDock) {
      try {
        const savedPosition = JSON.parse(localStorage.getItem("mylife:quick-action-position") || "null");
        if (Number.isFinite(savedPosition?.left) && Number.isFinite(savedPosition?.top)) {
          positionQuickActionDock(savedPosition.left, savedPosition.top);
        }
      } catch (error) {
        localStorage.removeItem("mylife:quick-action-position");
      }
      window.addEventListener("resize", () => {
        if (quickActionDock.style.left) positionQuickActionDock(quickActionDock.offsetLeft, quickActionDock.offsetTop);
      }, { passive: true });
      quickActionToggle?.addEventListener("pointerdown", event => {
        if (!event.isPrimary || event.button !== 0) return;
        const bounds = quickActionDock.getBoundingClientRect();
        quickActionDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: bounds.left, top: bounds.top, moved: false };
        quickActionToggle.setPointerCapture(event.pointerId);
      });
      quickActionToggle?.addEventListener("pointermove", event => {
        if (!quickActionDrag || quickActionDrag.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - quickActionDrag.startX;
        const deltaY = event.clientY - quickActionDrag.startY;
        if (Math.abs(deltaX) + Math.abs(deltaY) < 6 && !quickActionDrag.moved) return;
        quickActionDrag.moved = true;
        quickActionDock.classList.add("is-dragging");
        positionQuickActionDock(quickActionDrag.left + deltaX, quickActionDrag.top + deltaY);
      });
      const finishQuickActionDrag = event => {
        if (!quickActionDrag || quickActionDrag.pointerId !== event.pointerId) return;
        if (quickActionDrag.moved) {
          const bounds = quickActionDock.getBoundingClientRect();
          try {
            localStorage.setItem("mylife:quick-action-position", JSON.stringify({ left: bounds.left, top: bounds.top }));
          } catch (error) {
            // Keep dragging usable when browser storage is unavailable.
          }
          suppressQuickActionClick = true;
        }
        quickActionDrag = null;
        quickActionDock.classList.remove("is-dragging");
      };
      quickActionToggle?.addEventListener("pointerup", finishQuickActionDrag);
      quickActionToggle?.addEventListener("pointercancel", finishQuickActionDrag);
    }
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
    quickActionToggle?.addEventListener("click", event => {
      event.stopPropagation();
      const open = quickActionMenu?.hidden === false;
      window.clearTimeout(this.quickActionCloseTimer);
      if (quickActionMenu) quickActionMenu.hidden = open;
      quickActionToggle.setAttribute("aria-expanded", String(!open));
      quickActionToggle.closest(".quick-action-dock")?.classList.toggle("is-open", !open);
      if (!open) {
        this.quickActionCloseTimer = window.setTimeout(() => {
          if (!quickActionMenu) return;
          quickActionMenu.hidden = true;
          quickActionToggle.setAttribute("aria-expanded", "false");
          quickActionToggle.closest(".quick-action-dock")?.classList.remove("is-open");
        }, 5000);
      }
    });
    quickActionMenu?.addEventListener("click", event => {
      const button = event.target.closest("[data-quick-action]");
      if (!button) return;
      window.clearTimeout(this.quickActionCloseTimer);
      quickActionMenu.hidden = true;
      quickActionToggle?.setAttribute("aria-expanded", "false");
      quickActionToggle?.closest(".quick-action-dock")?.classList.remove("is-open");
      const action = button.dataset.quickAction;
      runQuickAction(action);
    });
    document.addEventListener("click", event => {
      if (event.target.closest(".quick-action-dock")) return;
      if (!quickActionMenu || quickActionMenu.hidden) return;
      window.clearTimeout(this.quickActionCloseTimer);
      quickActionMenu.hidden = true;
      quickActionToggle?.setAttribute("aria-expanded", "false");
      quickActionToggle?.closest(".quick-action-dock")?.classList.remove("is-open");
    });
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
    document.getElementById("bellButton").addEventListener("click", () => NotificationCenter.toggle());
    document.getElementById("smartAssistantButton").addEventListener("click", () => SmartAssistant.open());
    document.getElementById("profileButton").addEventListener("click", () => {
      openProfileModal();
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
    if (typeof EventForm !== "undefined") return EventForm.open(event || {});
    Modal.open({
      title: event.id ? t("editEvent") : t("addEvent"),
      submitText: event.id ? t("saveEvent") : t("addEvent"),
      fields: [
        { name: "title", label: t("eventTitle"), value: event.title, required: true },
        { name: "date", label: t("date"), type: "date", value: event.date || localDateInput(), required: true },
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
  },
  openHobbyModal(hobby = {}) {
    if (typeof HobbyForm !== "undefined") return HobbyForm.open(hobby);
    Modal.open({
      title: hobby.id ? t("editHobby") : t("recordHobbyTitle"),
      submitText: hobby.id ? t("saveRecord") : t("recordHobby"),
      fields: [
        { name: "title", label: t("hobby"), value: hobby.title || "", required: true },
        { name: "date", label: t("date"), type: "date", value: hobby.date || localDateInput(), required: true },
        { name: "minutes", label: t("minutes"), type: "number", value: hobby.minutes || "", min: 1 },
        { name: "category", label: t("category"), type: "select", options: ["Work", "Personal", "Love", "Family", "Health", "Learning"], value: hobby.category || "Personal" },
        { name: "mood", label: t("moodAfter"), value: hobby.mood || "" },
        { name: "notes", label: t("notes"), type: "textarea", value: hobby.notes || "" }
      ],
      onSubmit(data) {
        if (hobby.id) Store.edit("hobbyLogs", hobby.id, data);
        else Store.add("hobbyLogs", data);
        Toast.show(hobby.id ? t("hobbyRecordSaved") : t("hobbyRecorded"));
      }
    });
  },
  openReminderModal(reminder = {}) {
    // New reminders are calendar events with a Telegram alert (one tool, shown on the calendar).
    if (!reminder.id && typeof EventForm !== "undefined") return EventForm.open({ date: reminder.date || localDateInput(), category: reminder.category || "" });
    Modal.open({
      title: reminder.id ? t("editReminder") : t("addReminderTitle"),
      submitText: reminder.id ? t("saveReminder") : t("addReminder"),
      fields: [
        { name: "title", label: t("reminder"), value: reminder.title || "", required: true },
        { name: "date", label: t("date"), type: "date", value: reminder.date || localDateInput(), required: true },
        { name: "time", label: t("time"), type: "time", value: reminder.time || "" },
        { name: "category", label: t("category"), type: "select", options: ["Work", "Personal", "Love", "Family", "Health", "Learning"], value: reminder.category || "Personal" },
        { name: "notes", label: t("notes"), type: "textarea", value: reminder.notes || "" }
      ],
      onSubmit(data) {
        if (reminder.id) Store.edit("reminders", reminder.id, data);
        else Store.add("reminders", { ...data, done: false });
        Toast.show(reminder.id ? t("reminderSaved") : t("reminderAdded"));
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
    const profileKey = key === "family-photo" ? "familyPhotoPosition" : "tipsCoupleImagePosition";
    Store.updateProfile({ [profileKey]: position });
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
        ${actionLabel ? `<button class="button" type="button" data-action="${action}">${Icons.plus()} ${escapeHtml(actionLabel)}</button>` : ""}
      </div>
    </div>
  `;
}

function prepareWelcomePoster(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const targetRatio = 4 / 5;
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = image.naturalWidth;
        let sourceHeight = image.naturalHeight;
        if (sourceWidth / sourceHeight > targetRatio) {
          sourceWidth = sourceHeight * targetRatio;
          sourceX = (image.naturalWidth - sourceWidth) / 2;
        } else {
          sourceHeight = sourceWidth / targetRatio;
          sourceY = (image.naturalHeight - sourceHeight) / 2;
        }

        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 800;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare the welcome poster image.");
        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected welcome poster image could not be loaded."));
    };
    image.src = objectUrl;
  });
}

document.addEventListener("DOMContentLoaded", () => Promise.resolve(window.__cssReady).then(() => App.init()));

// The one "+" menu for the whole app (Settings chooses which buttons show).
const QUICK_ACTION_DEFAULTS = ["add-event", "add-expense", "add-hobby", "add-memory", "add-goal"];
function quickActionList() {
  return [
    ["add-event", Icons.calendar(), t("addEvent")],
    ["add-expense", Icons.expense(), t("addExpense")],
    ["add-hobby", Icons.spark(), t("recordHobby")],
    ["add-memory", Icons.memory(), t("addMemory")],
    ["add-goal", Icons.goal(), t("createGoal")],
    ["add-bill", Icons.bill(), t("addBill")],
    ["add-family", Icons.family(), t("addFamilyMember")],
    ["smart-assistant", Icons.spark(), t("smartAssistant")]
  ];
}
function runQuickAction(action) {
  if (action === "smart-assistant") SmartAssistant.open();
  if (action === "add-event") App.openEventModal();
  if (action === "add-goal") openGoalModal();
  if (action === "add-expense") openExpenseModal();
  if (action === "add-hobby") App.openHobbyModal();
  if (action === "add-memory" && typeof openMemoryModal === "function") openMemoryModal();
  if (action === "add-bill" && typeof openBillModal === "function") openBillModal();
  if (action === "add-family" && typeof openFamilyModal === "function") openFamilyModal();
}

// The "+" button slides away while scrolling down and comes back when scrolling up,
// so it never sits on top of what you are reading.
(() => {
  let lastY = window.scrollY;
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const dock = document.querySelector(".quick-action-dock");
      if (dock && !dock.classList.contains("is-open")) {
        const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 40;
        dock.classList.toggle("fab-away", (y > lastY + 4 && y > 120) || nearBottom);
        if (y < lastY - 4 && !nearBottom) dock.classList.remove("fab-away");
      }
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
  window.addEventListener("hashchange", () => document.querySelector(".quick-action-dock")?.classList.remove("fab-away"));
})();

// "2026-10-21" ± days → "2026-10-24" (local calendar days)
function shiftIsoDate(iso, days) {
  const date = parseAppDate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  date.setDate(date.getDate() + Number(days || 0));
  return localDateInput(date);
}
