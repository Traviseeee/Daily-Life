function renderSettings() {
  const stats = Store.calculate();
  const welcomePoster = App.getWelcomePoster();
  const settingsSections = [
    ["account", "accountCategory", "settingsAccountSubtitle", "user"],
    ["preferences", "preferences", "settingsPreferencesSubtitle", "settings"],
    ["data", "data", "settingsDataSubtitle", "database"],
    ["finance", "financialCalculations", "settingsFinanceSubtitle", "calculator"],
    ["appearance", "appearance", "settingsAppearanceSubtitle", "palette"],
    ["privacy", "privacySecurity", "settingsPrivacySubtitle", "shield"],
    ["about", "about", "settingsAboutSubtitle", "info"]
  ];
  return `
    <section class="page settings-page">
      <div class="page-header settings-header">
        <div class="settings-header-main">
          <div>
            <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.settings()}</span>${t("settings")}</h1>
            <p class="page-subtitle">${t("manageSettings")}</p>
          </div>
          <div class="financial-nav-dock settings-nav-dock">
            <button class="financial-nav-toggle settings-nav-toggle" type="button" data-open-settings-nav aria-label="${t("settingsCategories")}" title="${t("settingsCategories")}"><span class="financial-nav-toggle-lines" aria-hidden="true"><i></i><i></i><i></i></span></button>
            <dialog class="financial-sidebar settings-sidebar" aria-label="${t("settingsCategories")}">
              <div class="settings-sidebar-handle financial-sidebar-handle" aria-hidden="true"><span></span></div>
              <div class="financial-sidebar-heading"><div class="financial-sidebar-heading-copy"><strong>${t("settingsCategories")}</strong><span>${t("manageSettings")}</span></div><button class="icon-button" type="button" data-close-settings-nav aria-label="${t("close")}">${Icons.close()}</button></div>
              <nav class="settings-sidebar-nav" aria-label="${t("settingsCategories")}">
                ${settingsSections.map(([id, label, subtitle, icon]) => `<button class="financial-nav-item settings-nav-item" type="button" data-settings-jump="${id}"><span class="financial-nav-icon">${Icons[icon]()}</span><span class="financial-nav-copy"><strong>${t(label)}</strong><small>${t(subtitle)}</small></span>${Icons.chevron()}</button>`).join("")}
              </nav>
            </dialog>
          </div>
        </div>
      </div>
      <div class="settings-layout settings-layout-single">
        <div class="settings-content" data-settings-view="all">
          ${Login.guestMode ? `<button class="settings-guest-preview" type="button" data-action="connect-guest"><span class="settings-guest-avatar">${initials(t("guestPreview"))}</span><span class="settings-guest-copy"><strong>${t("guestPreview")}</strong><small>${t("guestSaveWarning")}</small></span>${Icons.chevron()}</button>` : ""}
          <div class="settings-accordion-list">
          <details class="settings-accordion" id="settings-section-account" open>
            ${settingsAccordionSummary("account", t("accountCategory"), t("settingsAccountSubtitle"), Icons.user())}
            <div class="settings-accordion-body">
              <div class="settings-section-grid" data-settings-panel="account">
            <article class="glass-card card-pad settings-profile-card" data-settings-section="account">
              <div class="settings-profile-header">
                <div>
                  <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.user()}</span>${t("profile")}</h2>
                </div>
                <button class="button ghost-button settings-edit-profile-button" type="button" data-action="edit-profile">${Icons.edit()} ${t("editUserData")}</button>
                <span class="thumb">${appData.profile.photo ? `<img src="${appData.profile.photo}" style="--image-position-x: ${imagePosition(appData.profile.photoPosition).x}%; --image-position-y: ${imagePosition(appData.profile.photoPosition).y}%;" alt="">` : initials(appData.profile.name)}</span>
              </div>
              <div class="settings-profile-name">${escapeHtml(appData.profile.name || "Not set")}</div>
              <div class="settings-profile-grid">
                <div class="settings-meta-item"><span>${t("currency")}</span><strong>${appData.profile.currency}</strong></div>
                <div class="settings-meta-item"><span>${t("language")}</span><strong>${optionLabel(appData.profile.language)}</strong></div>
                <div class="settings-meta-item"><span>${t("dateFormat")}</span><strong>${appData.profile.dateFormat}</strong></div>
                <div class="settings-meta-item"><span>${t("name")}</span><strong>${escapeHtml(appData.profile.name || "Not set")}</strong></div>
              </div>
            </article>
              </div>
            </div>
          </details>
          <details class="settings-accordion" id="settings-section-preferences">
            ${settingsAccordionSummary("preferences", t("preferences"), t("settingsPreferencesSubtitle"), Icons.settings())}
            <div class="settings-accordion-body">
            <article class="glass-card card-pad settings-preferences-card" data-settings-section="preferences">
              <div class="between">
                <div>
                  <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.settings()}</span>${t("preferences")}</h2>
                  <p class="secondary">${t("preferencesHelp")}</p>
                </div>
                <span class="icon-badge green">${Icons.bell()}</span>
              </div>
              <div class="settings-preference-list">
                <label class="settings-preference-row"><span><strong>${t("quickActions")}</strong><small>${t("quickActionsHelp")}</small></span></label>
                ${[
                  ["smart-assistant", t("smartAssistant")],
                  ["add-event", t("addEvent")],
                  ["add-goal", t("createGoal")],
                  ["add-expense", t("addExpense")]
                ].map(([id, label]) => `<label class="settings-preference-row settings-quick-action-row"><span><strong>${label}</strong><small>${t("showInQuickActions")}</small></span><input type="checkbox" data-quick-action-preference="${id}" ${((appData.profile.quickActions || ["smart-assistant", "add-event", "add-goal"]).includes(id)) ? "checked" : ""}></label>`).join("")}
                <label class="settings-preference-row"><span><strong>${t("language")}</strong><small>${t("languageHelp")}</small></span><select data-preference="language"><option value="English" ${appData.profile.language !== "Khmer" ? "selected" : ""}>English</option><option value="Khmer" ${appData.profile.language === "Khmer" ? "selected" : ""}>ខ្មែរ</option></select></label>
                <label class="settings-preference-row"><span><strong>${t("clockFormat")}</strong><small>${t("clockFormatHelp")}</small></span><select data-preference="clockFormat"><option value="12-hour" ${appData.profile.clockFormat !== "24-hour" ? "selected" : ""}>12-hour</option><option value="24-hour" ${appData.profile.clockFormat === "24-hour" ? "selected" : ""}>24-hour</option></select></label>
                <label class="settings-preference-row"><span><strong>${t("soundEnabled")}</strong><small>${t("soundEnabledHelp")}</small></span><input type="checkbox" data-preference="soundEnabled" ${appData.profile.soundEnabled !== false ? "checked" : ""}></label>
                <label class="settings-preference-row"><span><strong>${t("notificationsEnabled")}</strong><small>${t("notificationsEnabledHelp")}</small></span><input type="checkbox" data-preference="notificationsEnabled" ${appData.profile.notificationsEnabled !== false ? "checked" : ""}></label>
              </div>
            </article>
            ${renderAlertStatusCard()}
            ${typeof renderAutomationCard === "function" ? renderAutomationCard() : ""}
            </div>
          </details>
          <details class="settings-accordion" id="settings-section-data">
            ${settingsAccordionSummary("data", t("data"), t("settingsDataSubtitle"), Icons.database())}
            <div class="settings-accordion-body">
          <div class="settings-section-grid settings-data-grid" data-settings-panel="data">
            <article class="glass-card card-pad settings-data-card" data-settings-section="data">
              <div class="between"><div><h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.database()}</span>${t("backupAndRestore")}</h2><p class="secondary">${t("backupAndRestoreHelp")}</p></div><span class="icon-badge">${Icons.database()}</span></div>
              <div class="settings-action-grid">
                ${settingsAction("export-json", Icons.arrowDown(), t("exportJson"), t("backupJsonHelp"))}
                ${settingsAction("import-json", Icons.arrowUp(), t("importJson"), t("importJsonHelp"))}
                ${settingsAction("export-excel", Icons.chart(), t("exportExcel"), t("excelExportHelp"))}
              </div>
            </article>
            ${settingsCard(t("database"), [
              [t("familyMembersCount"), appData.family.length],
              [t("goals"), appData.goals.length],
              [t("incomeSourcesCount"), appData.income.length],
              [t("expenses"), appData.expenses.length],
              [t("savings"), appData.savings.length],
              [t("loans"), appData.loans.length],
              [t("bills"), appData.bills.length],
              [t("calendarEvents"), appData.calendarEvents.length],
              [t("memories"), appData.memories.length]
            ], Icons.database(), "data")}
          </div>
            </div>
          </details>
          <details class="settings-accordion" id="settings-section-finance">
            ${settingsAccordionSummary("finance", t("financialCalculations"), t("settingsFinanceSubtitle"), Icons.calculator())}
            <div class="settings-accordion-body settings-finance-panel" data-settings-panel="finance">
            ${settingsCard(t("financialCalculations"), [
              [t("availableMoney"), money(stats.available)],
              [t("totalIncome"), money(stats.totalIncome)],
              [t("totalExpenses"), money(stats.totalExpenses)],
              [t("totalSavings"), money(stats.totalSavings)],
              [t("loanBalance"), money(stats.loanBalance)]
            ], Icons.calculator(), "finance")}
            </div>
          </details>
          <details class="settings-accordion" id="settings-section-appearance">
            ${settingsAccordionSummary("appearance", t("appearance"), t("settingsAppearanceSubtitle"), Icons.palette())}
            <div class="settings-accordion-body">
              <div class="settings-preference-list settings-preference-list-standalone">
                <label class="settings-preference-row"><span><strong>${t("theme")}</strong><small>${t("themeHelp")}</small></span><select data-preference="theme"><option value="dark" ${appData.profile.theme !== "light" ? "selected" : ""}>${t("darkTheme")}</option><option value="light" ${appData.profile.theme === "light" ? "selected" : ""}>${t("lightTheme")}</option></select></label>
              </div>
              <article class="welcome-poster-settings">
                <div class="welcome-poster-settings-copy">
                  <h3>${t("familyPoster")}</h3>
                  <p>${t("familyPosterHelp")}</p>
                </div>
                <div class="welcome-poster-settings-preview" data-welcome-poster-preview>
                  ${welcomePoster ? `<img src="${escapeAttr(welcomePoster)}" alt="${escapeAttr(t("familyPoster"))}">` : `<span>${t("noPoster")}</span>`}
                </div>
                <input class="sr-only" id="welcomePosterSettingsInput" type="file" accept="image/*">
                <div class="welcome-poster-settings-actions">
                  <button class="button ghost-button" type="button" data-action="upload-welcome-poster">${welcomePoster ? t("changePoster") : t("uploadPoster")}</button>
                  <button class="button ghost-button" type="button" data-action="remove-welcome-poster" ${welcomePoster ? "" : "hidden"}>${t("removePoster")}</button>
                </div>
              </article>
            </div>
          </details>
          <details class="settings-accordion" id="settings-section-privacy">
            ${settingsAccordionSummary("privacy", t("privacySecurity"), t("settingsPrivacySubtitle"), Icons.shield())}
            <div class="settings-accordion-body">
              <div class="settings-preference-list settings-preference-list-standalone">
                <label class="settings-preference-row"><span><strong>${t("moneyPrivacy")}</strong><small>${t("moneyPrivacyHelp")}</small></span><input type="checkbox" data-preference="moneyHidden" ${appData.profile.moneyHidden ? "checked" : ""}></label>
              </div>
            </div>
          </details>
          <details class="settings-accordion" id="settings-section-about">
            ${settingsAccordionSummary("about", t("about"), t("settingsAboutSubtitle"), Icons.info())}
            <div class="settings-accordion-body settings-about-body">
              <section class="settings-about-story" aria-labelledby="settingsAboutTitle">
                <div class="settings-about-story-heading">
                  <span class="settings-about-brand">MYLIFE</span>
                  <span class="settings-about-version">Version 1.0.0</span>
                </div>
                <h3 id="settingsAboutTitle">${t("aboutMylifeTitle")}</h3>
                <p class="settings-about-tagline">${t("aboutMylifeTagline")}</p>
                <div class="settings-about-copy">
                  <p>${t("aboutMylifeIntro")}</p>
                  <p>${t("aboutMylifePurpose")}</p>
                  <p>${t("aboutMylifeProject")}</p>
                </div>
                <p class="settings-about-closing">${t("aboutMylifeClosing")}</p>
                <p class="settings-about-storage">${t("localStorageNote")}</p>
              </section>
            </div>
          </details>
          </div>
          <article class="glass-card card-pad settings-danger-zone settings-danger-card" aria-labelledby="settingsDangerTitle">
            <div class="settings-danger-heading">
              <span class="settings-danger-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 2.8 19a1.3 1.3 0 0 0 1.1 2h16.2a1.3 1.3 0 0 0 1.1-2L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v5m0 3h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
              <div class="settings-danger-title"><strong id="settingsDangerTitle">${t("dangerZone")}</strong><span>${t("clearDataHelp")}</span></div>
            </div>
            <div class="settings-danger-copy"><small>${t("dangerZoneWarning")}</small></div>
            <div class="action-row settings-danger-actions"><button class="button ghost-button" data-action="logout">${Icons.arrowUp()} ${t("logout")}</button><button class="button danger-button" data-action="clear-data">${Icons.trash()} ${t("clearData")}</button></div>
          </article>
        </div>
        <input class="sr-only" id="importJsonInput" type="file" accept="application/json,.json">
      </div>
    </section>
  `;
}

function renderAlertStatusCard() {
  const notificationsOn = appData.profile.notificationsEnabled !== false;
  const pushSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const permission = typeof Notification !== "undefined" ? Notification.permission : "default";
  const backups = typeof Store.listBackups === "function" ? Store.listBackups() : [];
  const pendingSync = typeof SyncState !== "undefined" && SyncState.isPending?.();
  return `
    <article class="glass-card card-pad settings-preferences-card" data-settings-section="preferences">
      <div class="between">
        <div>
          <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.bell()}</span>${t("alertStatus")}</h2>
          <p class="secondary">${t("alertStatusHelp")}</p>
        </div>
        <span class="pill ${notificationsOn ? "success" : ""}">${notificationsOn ? t("on") : t("off")}</span>
      </div>
      <div class="settings-preference-list">
        <div class="settings-preference-row"><span><strong>${t("inAppAlerts")}</strong><small>${t("inAppAlertsHelp")}</small></span><span class="pill success">${t("ready")}</span></div>
        <div class="settings-preference-row"><span><strong>${t("lockScreenPush")}</strong><small>${t("lockScreenPushHelp")}</small></span><span class="pill">${pushSupported && permission === "granted" ? t("enabled") : t("needsSetup")}</span></div>
        <div class="settings-preference-row"><span><strong>${t("cloudSync")}</strong><small>${t("cloudSyncHelp")}</small></span><span class="pill ${pendingSync ? "" : "success"}">${pendingSync ? t("pending") : t("synced")}</span></div>
        <div class="settings-preference-row"><span><strong>${t("localBackups")}</strong><small>${t("localBackupsHelp")}</small></span><span class="pill ${backups.length ? "success" : ""}">${backups.length}</span></div>
      </div>
      <div class="settings-action-grid">
        ${settingsAction("enable-alerts", Icons.bell(), t("enableAlerts"), t("enableAlertsHelp"))}
        ${settingsAction("test-alert", Icons.spark(), t("sendTestAlert"), t("sendTestAlertHelp"))}
        ${settingsAction("show-backups", Icons.database(), t("restoreLocalBackup"), t("restoreLocalBackupHelp"))}
      </div>
    </article>
  `;
}

function settingsAccordionSummary(id, title, subtitle, icon) {
  return `<summary class="settings-accordion-summary" data-settings-tone="${id}"><span class="settings-accordion-icon">${icon}</span><span class="settings-accordion-copy"><strong>${title}</strong><small>${subtitle}</small></span><span class="settings-accordion-chevron">${Icons.chevron()}</span></summary>`;
}

function settingsCard(title, rows, icon, section = "data") {
  return `
    <article class="glass-card card-pad settings-compact-card" data-settings-section="${section}">
      <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${icon}</span>${title}</h2>
      <div class="settings-stat-grid ${section === "data" ? "settings-database-grid" : ""}">
        ${rows.map(row => `
          <div class="settings-stat-item ${section === "data" ? "settings-database-stat" : ""}">
            <span>${row[0]}</span>
            <strong>${row[1]}</strong>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function settingsAction(action, icon, title, description) {
  return `
    <button class="settings-action" data-action="${action}">
      <span class="icon-badge">${icon}</span>
      <span>
        <strong>${title}</strong>
        <small>${description}</small>
      </span>
    </button>
  `;
}

function openProfileModal() {
  Modal.open({
    title: t("editProfile"),
    submitText: t("editProfile"),
    fields: [
      { name: "name", label: t("name"), value: appData.profile.name, required: true },
      { name: "photo", label: t("profilePhoto"), type: "file", value: appData.profile.photo },
      { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR", "EUR", "GBP", "AUD", "CAD", "JPY"], value: appData.profile.currency || "USD" },
      { name: "language", label: t("language"), type: "select", options: ["English", "Khmer"], value: appData.profile.language || "English" },
      { name: "dateFormat", label: t("dateFormat"), type: "select", options: ["MMM d, yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"], value: appData.profile.dateFormat || "MMM d, yyyy" },
      { name: "clockFormat", label: t("clockFormat"), type: "select", options: ["12-hour", "24-hour"], value: appData.profile.clockFormat || "12-hour" },
      { name: "soundEnabled", label: t("soundEnabled"), type: "checkbox", value: appData.profile.soundEnabled !== false },
      { name: "notificationsEnabled", label: t("notificationsEnabled"), type: "checkbox", value: appData.profile.notificationsEnabled !== false }
    ],
    onSubmit(data) {
      Store.updateProfile(data);
      Toast.show(t("profileSaved"));
    }
  });

  const modalForm = document.getElementById("modalForm");
  const footer = modalForm?.querySelector(".between");
  if (!modalForm || !footer || footer.dataset.accountActionsInserted === "true") return;

  const accountRow = document.createElement("div");
  accountRow.className = "account-action-row";

  const connectButton = document.createElement("button");
  connectButton.type = "button";
  connectButton.className = "button ghost-button account-connect-button";
  connectButton.dataset.connectAccount = "true";
  connectButton.textContent = "Connect account";
  connectButton.addEventListener("click", () => {
    Modal.close();
    Login.open("login");
  });

  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.className = "button ghost-button account-logout-button";
  logoutButton.dataset.logoutProfile = "true";
  logoutButton.textContent = "Log out";
  logoutButton.addEventListener("click", async () => {
    Modal.close();
    await Login.logout();
    App.render();
  });

  accountRow.appendChild(connectButton);
  accountRow.appendChild(logoutButton);
  footer.innerHTML = "";
  footer.appendChild(accountRow);
  footer.dataset.accountActionsInserted = "true";
}

function firstRecord(collection) {
  return appData[collection]?.[0] || {};
}

function sectionToggle(name, enabled) {
  return { name: `${name}Enabled`, label: t("showSection"), type: "checkbox", value: enabled };
}

function buildUserDataFields(mode = "create") {
  const isEdit = mode === "edit";
  const family = firstRecord("family");
  const relationshipOptions = ["Me", "Wife", "Husband", "Girlfriend", "Boyfriend", "Mother", "Father", "Daughter", "Son", "Sister", "Brother", "Grandmother", "Grandfather", "Friend", "Other"];
  appData.family.slice(0, 10).forEach(member => {
    if (member.relationship && !relationshipOptions.includes(member.relationship)) relationshipOptions.unshift(member.relationship);
  });
  const goal = firstRecord("goals");
  const income = firstRecord("income");
  const expense = firstRecord("expenses");
  const savings = firstRecord("savings");
  const loan = firstRecord("loans");
  const bill = firstRecord("bills");
  const event = firstRecord("calendarEvents");
  const memory = firstRecord("memories");

  return [
    { type: "heading", label: t("userProfile"), icon: Icons.user(), description: isEdit ? t("editUserDataHelp") : t("userProfileHelp") },
    { name: "name", label: t("name"), value: isEdit ? appData.profile.name : "", required: true },
    { name: "photo", label: t("profilePhoto"), type: "file", value: isEdit ? appData.profile.photo : "" },
    { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR", "EUR", "GBP", "AUD", "CAD", "JPY"], value: appData.profile.currency || "USD" },
    { name: "language", label: t("language"), type: "select", options: ["English", "Khmer"], value: appData.profile.language || "English" },
    { name: "dateFormat", label: t("dateFormat"), type: "select", options: ["MMM d, yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"], value: appData.profile.dateFormat || "MMM d, yyyy" },

    { type: "heading", label: t("family"), icon: Icons.family() },
    ...(isEdit ? [sectionToggle("family", appData.family.length > 0)] : []),
    ...(isEdit && appData.family.length ? [{ name: "familyName", label: t("familyMemberName"), type: "select", options: appData.family.map(item => item.id), optionLabels: appData.family.map(item => item.name), value: family.id }] : [{ name: "familyName", label: t("familyMemberName"), value: family.name }]),
    { name: "familyRelationship", label: t("relationship"), type: "select", options: relationshipOptions, value: family.relationship },
    { name: "familyCharacterMood", label: t("characterMood"), value: family.characterMood },
    { name: "familyBirthday", label: t("birthday"), type: "date", value: family.birthday },
    { name: "familyZodiacSign", label: t("zodiacSign"), type: "select", options: ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"], value: family.zodiacSign },
    { name: "familyAnniversaryDate", label: t("anniversary"), type: "date", value: family.anniversaryDate },
    { name: "familyPhone", label: t("phone"), value: family.phone },
    { name: "familyFavorite", label: t("favorite"), value: family.favorite },
    { name: "familyRelationshipNote", label: t("relationshipNote"), type: "textarea", value: family.relationshipNote },
    { name: "familyNotes", label: t("notes"), type: "textarea", value: family.notes },

    { type: "heading", label: t("goal"), icon: Icons.goal() },
    ...(isEdit ? [sectionToggle("goal", appData.goals.length > 0)] : []),
    { name: "goalName", label: t("goalName"), value: goal.name },
    { name: "goalCategory", label: t("category"), type: "select", options: goalCategories, value: goal.category || "Personal" },
    { name: "goalTargetAmount", label: t("targetAmount"), type: "number", value: goal.targetAmount },
    { name: "goalCurrentAmount", label: t("currentAmount"), type: "number", value: goal.currentAmount },
    { name: "goalDeadline", label: t("deadline"), type: "date", value: goal.deadline },
    { name: "goalDescription", label: t("description"), type: "textarea", value: goal.description },

    { type: "heading", label: t("income"), icon: Icons.salary() },
    ...(isEdit ? [sectionToggle("income", appData.income.length > 0)] : []),
    { name: "incomeName", label: t("incomeName"), value: income.name },
    { name: "incomeAmount", label: t("amount"), type: "number", value: income.amount },
    { name: "incomeCurrency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: income.currency || appData.profile.currency || "USD" },
    { name: "incomeCategory", label: t("category"), type: "select", options: incomeCategories, value: income.category || "Salary" },
    { name: "incomeFrequency", label: t("frequency"), type: "select", options: ["Once", "Weekly", "Monthly", "Yearly"], value: income.frequency || "Monthly" },
    { name: "incomeNextPaymentDate", label: t("nextPaymentDate"), type: "date", value: income.nextPaymentDate },
    { name: "incomeRecurring", label: t("recurring"), type: "checkbox", value: income.recurring ?? true },
    { name: "incomeNotes", label: t("notes"), type: "textarea", value: income.notes },

    { type: "heading", label: t("expense"), icon: Icons.expense() },
    ...(isEdit ? [sectionToggle("expense", appData.expenses.length > 0)] : []),
    { name: "expenseDescription", label: t("description"), value: expense.description },
    { name: "expenseAmount", label: t("amount"), type: "number", value: expense.amount },
    { name: "expenseCurrency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: expense.currency || appData.profile.currency || "USD" },
    { name: "expenseCategory", label: t("category"), type: "select", options: expenseCategories, value: expense.category || "Food" },
    { name: "expenseDate", label: t("date"), type: "date", value: expense.date },
    { name: "expenseMethod", label: t("paymentMethod"), value: expense.method },
    { name: "expenseNotes", label: t("notes"), type: "textarea", value: expense.notes },

    { type: "heading", label: t("savings"), icon: Icons.savings() },
    ...(isEdit ? [sectionToggle("savings", appData.savings.length > 0)] : []),
    { name: "savingsName", label: t("savingsName"), value: savings.name },
    { name: "savingsTargetAmount", label: t("targetAmount"), type: "number", value: savings.targetAmount },
    { name: "savingsCurrentAmount", label: t("currentAmount"), type: "number", value: savings.currentAmount },
    { name: "savingsMonthlyContribution", label: t("monthlyContribution"), type: "number", value: savings.monthlyContribution },
    { name: "savingsCurrency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: savings.currency || appData.profile.currency || "USD" },
    { name: "savingsDeadline", label: t("deadline"), type: "date", value: savings.deadline },
    { name: "savingsNotes", label: t("notes"), type: "textarea", value: savings.notes },

    { type: "heading", label: t("loan"), icon: Icons.loan() },
    ...(isEdit ? [sectionToggle("loan", appData.loans.length > 0)] : []),
    { name: "loanName", label: t("loanName"), value: loan.name },
    { name: "loanOriginalAmount", label: t("originalAmount"), type: "number", value: loan.originalAmount },
    { name: "loanCurrency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: loan.currency || appData.profile.currency || "USD" },
    { name: "loanInterestRate", label: t("interestRate"), type: "number", value: loan.interestRate },
    { name: "loanMonthlyPayment", label: t("paymentAmount"), type: "number", value: loan.monthlyPayment },
    { name: "loanPaymentFrequency", label: t("paymentFrequency"), type: "select", options: ["Daily", "Weekly", "Monthly", "Yearly"], value: loan.paymentFrequency || "Monthly" },
    { name: "loanStartDate", label: t("startDate"), type: "date", value: loan.startDate },
    { name: "loanDueDate", label: t("dueDate"), type: "date", value: loan.dueDate },
    { name: "loanNotes", label: t("notes"), type: "textarea", value: loan.notes },

    { type: "heading", label: t("bill"), icon: Icons.bill() },
    ...(isEdit ? [sectionToggle("bill", appData.bills.length > 0)] : []),
    { name: "billName", label: t("billName"), value: bill.name },
    { name: "billAmount", label: t("amount"), type: "number", value: bill.amount },
    { name: "billCurrency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: bill.currency || appData.profile.currency || "USD" },
    { name: "billFrequency", label: t("frequency"), type: "select", options: ["Weekly", "Monthly", "Quarterly", "Yearly"], value: bill.frequency || "Monthly" },
    { name: "billDue", label: t("dueDateDay"), type: "date", value: bill.due },
    { name: "billCategory", label: t("category"), value: bill.category },
    { name: "billReminder", label: t("reminder"), type: "checkbox", value: bill.reminder ?? true },
    { name: "billStatus", label: t("status"), type: "select", options: ["Upcoming", "Paid", "Overdue"], value: bill.status || "Upcoming" },
    { name: "billNotes", label: t("notes"), type: "textarea", value: bill.notes },

    { type: "heading", label: t("calendarEvent"), icon: Icons.calendar() },
    ...(isEdit ? [sectionToggle("event", appData.calendarEvents.length > 0)] : []),
    { name: "eventTitle", label: t("eventTitle"), value: event.title },
    { name: "eventDate", label: t("date"), type: "date", value: event.date },
    { name: "eventTime", label: t("time"), type: "time", value: event.time },
    { name: "eventCategory", label: t("category"), type: "select", options: ["Personal", "Family", "Goal", "Bill", "Loan", "Reminder"], value: event.category || "Personal" },
    { name: "eventFamilyMember", label: t("familyMemberName"), value: event.familyMember },
    { name: "eventReminder", label: t("reminder"), type: "checkbox", value: event.reminder ?? true },
    { name: "eventNotes", label: t("notes"), type: "textarea", value: event.notes },

    { type: "heading", label: t("memory"), icon: Icons.memory() },
    ...(isEdit ? [sectionToggle("memory", appData.memories.length > 0)] : []),
    { name: "memoryTitle", label: t("title"), value: memory.title },
    { name: "memoryDate", label: t("date"), type: "date", value: memory.date },
    { name: "memoryLocation", label: t("location"), value: memory.location },
    { name: "memoryDescription", label: t("description"), type: "textarea", value: memory.description },
    { name: "memoryFamilyMembers", label: t("familyMembers"), value: memory.familyMembers },
    { name: "memoryTags", label: t("tags"), value: memory.tags }
  ];
}

function openCreateUserModal() {
  const hasExistingData = Boolean(appData.profile.name || ["family", "goals", "income", "expenses", "savings", "loans", "bills", "calendarEvents", "memories"].some(key => appData[key].length));
  if (hasExistingData) {
    openEditUserDataModal();
    return;
  }
  Modal.open({
    title: t("createUser"),
    submitText: t("createUser"),
    wide: true,
    grouped: true,
    fields: buildUserDataFields("create"),
    onSubmit(data) {
      Store.createUser(data);
      location.hash = "#home";
      Toast.show(t("newUserCreated"));
    }
  });
}

function openEditUserDataModal() {
  Modal.open({
    title: t("editUserData"),
    submitText: t("saveUserData"),
    wide: true,
    grouped: true,
    fields: buildUserDataFields("edit"),
    onSubmit(data) {
      const selectedMember = appData.family.find(item => item.id === data.familyName);
      if (selectedMember) {
        data.familyMemberId = selectedMember.id;
        data.familyName = selectedMember.name;
      }
      Store.updateUserData(data);
      Toast.show(t("userDataSaved"));
    }
  });
  const familyNameInput = document.querySelector("#familyName");
  familyNameInput?.addEventListener("change", () => {
    const selected = appData.family.find(item => item.id === familyNameInput.value);
    if (!selected) return;
    const fields = {
      familyCharacterMood: selected.characterMood,
      familyBirthday: selected.birthday,
      familyZodiacSign: selected.zodiacSign,
      familyAnniversaryDate: selected.anniversaryDate,
      familyPhone: selected.phone,
      familyFavorite: selected.favorite,
      familyRelationshipNote: selected.relationshipNote,
      familyNotes: selected.notes
    };
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.querySelector(`#${name}`);
      if (input) input.value = value || "";
    });
    const relationshipInput = document.querySelector("#familyRelationship");
    if (relationshipInput) relationshipInput.value = selected.relationship || "";
  });
}

function bindSettings() {
  bindNavigationSheetGestures();
  if (typeof bindAutomationCard === "function") bindAutomationCard();
  document.querySelectorAll("[data-open-settings-nav]").forEach(button => button.addEventListener("click", () => {
    button.closest(".settings-nav-dock")?.querySelector(".settings-sidebar")?.showModal();
  }));
  document.querySelectorAll("[data-close-settings-nav]").forEach(button => button.addEventListener("click", () => {
    button.closest(".settings-sidebar")?.close();
  }));
  document.querySelectorAll(".settings-sidebar").forEach(dialog => dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  }));
  document.querySelectorAll("[data-settings-jump]").forEach(button => button.addEventListener("click", () => {
    const section = document.getElementById(`settings-section-${button.dataset.settingsJump}`);
    if (!section) return;
    section.open = true;
    button.closest(".settings-sidebar")?.close();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  const settingsContent = document.querySelector(".settings-content");
  document.querySelectorAll("[data-settings-category]").forEach(tab => tab.addEventListener("click", () => {
    const category = tab.dataset.settingsCategory;
    settingsContent?.setAttribute("data-settings-view", category);
    document.querySelectorAll("[data-settings-category]").forEach(item => item.classList.toggle("active", item === tab));
  }));
  document.querySelectorAll("[data-preference]").forEach(control => control.addEventListener("change", () => {
    const key = control.dataset.preference;
    const value = control.type === "checkbox" ? control.checked : control.value;
    Store.updateProfile({ [key]: value });
    if (key === "notificationsEnabled" && value) {
      if (NotificationManager.getPlugin()) NotificationManager.requestPermission().then(() => NotificationManager.sync());
      else window.PushNotifications?.enable();
    } else if (key === "notificationsEnabled" && !value && !NotificationManager.getPlugin()) {
      window.PushNotifications?.disable();
    }
    Toast.show(t("preferenceSaved"));
  }));
  document.querySelectorAll("[data-quick-action-preference]").forEach(control => control.addEventListener("change", () => {
    const quickActions = [...document.querySelectorAll("[data-quick-action-preference]:checked")].map(item => item.dataset.quickActionPreference);
    Store.updateProfile({ quickActions });
    Toast.show(t("preferenceSaved"));
  }));
  bindSettingsAction("edit-profile", openEditUserDataModal);
  bindSettingsAction("upload-welcome-poster", () => document.getElementById("welcomePosterSettingsInput")?.click());
  bindSettingsAction("remove-welcome-poster", () => App.removeWelcomePoster());
  document.getElementById("welcomePosterSettingsInput")?.addEventListener("change", async event => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    await App.saveWelcomePoster(file);
  });
  bindSettingsAction("connect-guest", () => Login.open("signup"));
  bindSettingsAction("edit-footer", () => {
    sessionStorage.setItem("mylife:open-footer-editor", "1");
    location.hash = "#launcher";
  });
  bindSettingsAction("create-user", openCreateUserModal);
  bindSettingsAction("export-json", exportJsonData);
  bindSettingsAction("export-excel", exportExcelData);
  bindSettingsAction("import-json", () => document.getElementById("importJsonInput")?.click());
  bindSettingsAction("enable-alerts", async () => {
    if (NotificationManager.getPlugin()) {
      const permission = await NotificationManager.requestPermission();
      Toast.show(permission === "granted" ? t("alertsEnabled") : t("alertsRemainOff"), permission === "granted" ? "success" : "warning");
      if (permission === "granted") NotificationManager.sync();
      App.render();
      return;
    }
    await window.PushNotifications?.enable();
    App.render();
  });
  bindSettingsAction("test-alert", sendLocalTestAlert);
  bindSettingsAction("show-backups", openLocalBackupsModal);
  document.getElementById("importJsonInput")?.addEventListener("change", importJsonData);
  bindSettingsAction("load-demo", () => {
    Modal.confirm({ title: t("loadDemoTitle"), message: t("loadDemoMessage"), confirmText: t("loadDemo"), onConfirm: () => {
      Store.loadDemoData();
      Toast.show(t("demoLoaded"));
    }});
  });
  bindSettingsAction("logout", async () => {
    Modal.confirm({
      title: "Log out",
      message: "Log out of your Supabase account and return to the login screen?",
      confirmText: "Log out",
      onConfirm: async () => {
        await Login.logout();
        Toast.show("Logged out");
      }
    });
  });
  bindSettingsAction("clear-data", () => {
    Modal.confirm({ title: t("clearData"), message: t("clearDataMessage"), confirmText: t("clearData"), onConfirm: () => {
      Store.clear();
      Toast.show(t("allDataCleared"));
    }});
  });
}

function bindSettingsAction(action, handler) {
  document.querySelectorAll(`[data-action="${action}"]`).forEach(button => {
    button.addEventListener("click", handler);
  });
}

async function sendLocalTestAlert() {
  const title = "MYLIFE test";
  const body = t("sendTestAlertBody");
  Toast.show(body, "success");
  if (!("Notification" in window) || Notification.permission !== "granted") {
    Toast.show(t("enableAlertsFirst"), "warning");
    return;
  }
  try {
    const registration = await navigator.serviceWorker?.ready;
    await registration?.showNotification(title, {
      body,
      icon: "/assets/icons/mylife-icon-192.png",
      badge: "/assets/icons/mylife-icon-192.png",
      data: { url: "/#settings" }
    });
  } catch (error) {
    console.warn("MYLIFE could not show a local test alert.", error);
    Toast.show(t("pushEnableFailed"), "warning");
  }
}

function openLocalBackupsModal() {
  const backups = typeof Store.listBackups === "function" ? Store.listBackups() : [];
  const root = document.getElementById("modalRoot");
  root.classList.add("open");
  root.innerHTML = `
    <div class="modal glass-card" aria-modal="true" role="dialog" aria-labelledby="localBackupsTitle">
      <div class="between">
        <div>
          <h2 id="localBackupsTitle">${t("restoreLocalBackup")}</h2>
          <p class="secondary">${t("restoreLocalBackupHelp")}</p>
        </div>
        <button class="icon-button" type="button" data-close aria-label="${t("close")}">${Icons.close()}</button>
      </div>
      <div class="settings-preference-list">
        ${backups.length ? backups.map(backup => `
          <div class="settings-preference-row">
            <span><strong>${escapeHtml(backup.profile || t("backup"))}</strong><small>${escapeHtml(backup.createdAt)} · ${backup.counts} ${t("records")}</small></span>
            <button class="button ghost-button" type="button" data-restore-backup="${escapeAttr(backup.key)}">${t("restore")}</button>
          </div>
        `).join("") : `<p class="secondary">${t("noLocalBackups")}</p>`}
      </div>
      <div class="between"><button class="button ghost-button" type="button" data-close>${t("close")}</button></div>
    </div>
  `;

  root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
    root.classList.remove("open");
    root.innerHTML = "";
  }));
  root.querySelectorAll("[data-restore-backup]").forEach(button => button.addEventListener("click", () => {
    Modal.confirm({
      title: t("restoreLocalBackup"),
      message: t("restoreLocalBackupConfirm"),
      confirmText: t("restore"),
      onConfirm: () => {
        const restored = Store.restoreBackup(button.dataset.restoreBackup);
        root.classList.remove("open");
        root.innerHTML = "";
        Toast.show(restored ? t("backupRestored") : t("restoreFailed"), restored ? "success" : "warning");
      }
    });
  }));
}

function exportJsonData() {
  downloadFile(`mylife-backup-${backupDate()}.json`, "application/json", JSON.stringify(appData, null, 2));
  Toast.show(t("jsonExported"));
}

function importJsonData(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || typeof imported !== "object" || !imported.profile) throw new Error("Invalid MYLIFE backup");
      Modal.confirm({
        title: t("importJson"),
        message: t("importJsonMessage"),
        confirmText: t("importJson"),
        onConfirm: () => {
          Object.assign(appData, structuredClone(emptyData), imported);
          appData.profile = { ...emptyData.profile, ...(appData.profile || {}) };
          // A restore replaces everything, so the cloud copy is replaced rather than
          // merged — merging would keep records the backup deliberately omits, and
          // any tombstone carried by the backup still applies to its own contents.
          SyncState.prune(appData);
          Store.save({ mode: "replace", reason: "import" });
          App.render();
          Toast.show(t("jsonImported"));
        }
      });
    } catch (error) {
      Toast.show(t("importFailed"));
    }
  };
  reader.readAsText(file);
}

function exportExcelData() {
  const sections = ["profile", "family", "goals", "income", "expenses", "savings", "loans", "bills", "calendarEvents", "memories"];
  const html = `
    <html>
      <head><meta charset="utf-8"><style>table{border-collapse:collapse;margin-bottom:24px}td,th{border:1px solid #999;padding:6px 8px}th{background:#d9ff8c}</style></head>
      <body>
        <h1>MYLIFE Export ${backupDate()}</h1>
        ${sections.map(section => excelTable(section, section === "profile" ? [appData.profile] : appData[section])).join("")}
      </body>
    </html>
  `;
  downloadFile(`mylife-excel-${backupDate()}.xls`, "application/vnd.ms-excel", html);
  Toast.show(t("excelExported"));
}

function excelTable(title, rows = []) {
  const normalized = rows.length ? rows : [{}];
  const keys = [...new Set(normalized.flatMap(row => Object.keys(row || {})))];
  return `
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr>${keys.map(key => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead>
      <tbody>${normalized.map(row => `<tr>${keys.map(key => `<td>${escapeHtml(formatCell(row?.[key]))}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function formatCell(value) {
  if (Array.isArray(value)) return value.map(item => typeof item === "object" ? JSON.stringify(item) : item).join("; ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? "";
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function backupDate() {
  return localDateInput();
}

function renderHelp() {
  const helpSteps = [
    { icon: Icons.search(), title: t("search"), description: t("searchHelp"), tone: "search" },
    { icon: Icons.plus(), title: t("add"), description: t("addHelp"), tone: "add" },
    { icon: Icons.chart(), title: t("review"), description: t("reviewHelp"), tone: "review" },
    { icon: Icons.family(), title: t("family"), description: t("helpFamily"), tone: "family" },
    { icon: Icons.goal(), title: t("goals"), description: t("helpGoals"), tone: "goals" },
    { icon: Icons.money(), title: t("money"), description: t("helpMoney"), tone: "money" },
    { icon: Icons.spark(), title: t("daily"), description: t("helpDaily"), tone: "daily" },
    { icon: Icons.heart(), title: t("memories"), description: t("helpMemories"), tone: "memories" },
    { icon: Icons.database(), title: t("backupAndRestore"), description: t("helpBackup"), tone: "backup" }
  ];

  return `
    <section class="page help-page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.help()}</span>${t("help")}</h1>
          <p class="page-subtitle">${t("helpSubtitle")}</p>
        </div>
      </div>
      <div class="help-grid">
        ${helpSteps.map(step => `<article class="help-card ${step.tone}"><span class="help-card-icon">${step.icon}</span><h2>${step.title}</h2><p>${step.description}</p></article>`).join("")}
      </div>
    </section>
  `;
}
