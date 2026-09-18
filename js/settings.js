function renderSettings() {
  const stats = Store.calculate();
  return `
    <section class="page settings-page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.settings()}</span>${t("settings")}</h1>
          <p class="page-subtitle">${t("manageSettings")}</p>
        </div>
        <button class="button ghost-button settings-edit-profile-button" data-action="edit-profile">${Icons.edit()} ${t("editUserData")}</button>
      </div>
      <div class="settings-layout settings-layout-single">
        <div class="settings-content" data-settings-view="account">
          <nav class="settings-category-tabs" aria-label="${t("settingsCategories")}">
            <button type="button" class="settings-category-tab active" data-settings-category="account">${Icons.user()} ${t("accountCategory")}</button>
            <button type="button" class="settings-category-tab" data-settings-category="preferences">${Icons.settings()} ${t("preferences")}</button>
            <button type="button" class="settings-category-tab" data-settings-category="data">${Icons.wallet()} ${t("data")}</button>
            <button type="button" class="settings-category-tab" data-settings-category="finance">${Icons.money()} ${t("financialCalculations")}</button>
          </nav>
          <div class="settings-section-grid" data-settings-panel="account">
            <article class="glass-card card-pad settings-profile-card" data-settings-section="account">
              <div class="settings-profile-header">
                <div>
                  <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.user()}</span>${t("profile")}</h2>
                </div>
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
                <label class="settings-preference-row"><span><strong>${t("theme")}</strong><small>${t("themeHelp")}</small></span><select data-preference="theme"><option value="dark" ${appData.profile.theme !== "light" ? "selected" : ""}>${t("darkTheme")}</option><option value="light" ${appData.profile.theme === "light" ? "selected" : ""}>${t("lightTheme")}</option></select></label>
                <label class="settings-preference-row"><span><strong>${t("language")}</strong><small>${t("languageHelp")}</small></span><select data-preference="language"><option value="English" ${appData.profile.language !== "Khmer" ? "selected" : ""}>English</option><option value="Khmer" ${appData.profile.language === "Khmer" ? "selected" : ""}>ខ្មែរ</option></select></label>
                <label class="settings-preference-row"><span><strong>${t("moneyPrivacy")}</strong><small>${t("moneyPrivacyHelp")}</small></span><input type="checkbox" data-preference="moneyHidden" ${appData.profile.moneyHidden ? "checked" : ""}></label>
                <label class="settings-preference-row"><span><strong>${t("clockFormat")}</strong><small>${t("clockFormatHelp")}</small></span><select data-preference="clockFormat"><option value="12-hour" ${appData.profile.clockFormat !== "24-hour" ? "selected" : ""}>12-hour</option><option value="24-hour" ${appData.profile.clockFormat === "24-hour" ? "selected" : ""}>24-hour</option></select></label>
                <label class="settings-preference-row"><span><strong>${t("soundEnabled")}</strong><small>${t("soundEnabledHelp")}</small></span><input type="checkbox" data-preference="soundEnabled" ${appData.profile.soundEnabled !== false ? "checked" : ""}></label>
                <label class="settings-preference-row"><span><strong>${t("notificationsEnabled")}</strong><small>${t("notificationsEnabledHelp")}</small></span><input type="checkbox" data-preference="notificationsEnabled" ${appData.profile.notificationsEnabled !== false ? "checked" : ""}></label>
              </div>
            </article>
          </div>
          <div class="settings-section-heading" data-settings-section="data"><span class="eyebrow">${t("data")}</span><h2>${t("backupAndRestore")}</h2></div>
          <div class="settings-section-grid settings-data-grid" data-settings-panel="data">
            <article class="glass-card card-pad settings-data-card" data-settings-section="data">
              <div class="between"><div><h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.wallet()}</span>${t("backupAndRestore")}</h2><p class="secondary">${t("backupAndRestoreHelp")}</p></div><span class="icon-badge">${Icons.wallet()}</span></div>
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
            ], Icons.chart(), "data")}
          </div>
          <div class="settings-finance-panel" data-settings-panel="finance">
            ${settingsCard(t("financialCalculations"), [
              [t("availableMoney"), money(stats.available)],
              [t("totalIncome"), money(stats.totalIncome)],
              [t("totalExpenses"), money(stats.totalExpenses)],
              [t("totalSavings"), money(stats.totalSavings)],
              [t("loanBalance"), money(stats.loanBalance)]
            ], Icons.money(), "finance")}
          </div>
          <article class="glass-card card-pad settings-danger-zone settings-danger-card">
            <div><strong>${t("dangerZone")}</strong><span>${t("clearDataHelp")}</span></div>
            <div class="action-row"><button class="button ghost-button" data-action="logout">${Icons.arrowUp()} ${t("logout")}</button><button class="button danger-button" data-action="clear-data">${Icons.trash()} ${t("clearData")}</button></div>
          </article>
        </div>
        <input class="sr-only" id="importJsonInput" type="file" accept="application/json,.json">
      </div>
    </section>
  `;
}

function settingsCard(title, rows, icon, section = "data") {
  return `
    <article class="glass-card card-pad settings-compact-card" data-settings-section="${section}">
      <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${icon}</span>${title}</h2>
      <div class="settings-stat-grid">
        ${rows.map(row => `
          <div class="settings-stat-item">
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
    if (key === "notificationsEnabled" && value) NotificationManager.requestPermission().then(() => NotificationManager.sync());
    Toast.show(t("preferenceSaved"));
  }));
  document.querySelectorAll("[data-quick-action-preference]").forEach(control => control.addEventListener("change", () => {
    const quickActions = [...document.querySelectorAll("[data-quick-action-preference]:checked")].map(item => item.dataset.quickActionPreference);
    Store.updateProfile({ quickActions });
    Toast.show(t("preferenceSaved"));
  }));
  bindSettingsAction("edit-profile", openEditUserDataModal);
  bindSettingsAction("edit-footer", () => {
    sessionStorage.setItem("mylife:open-footer-editor", "1");
    location.hash = "#launcher";
  });
  bindSettingsAction("create-user", openCreateUserModal);
  bindSettingsAction("export-json", exportJsonData);
  bindSettingsAction("export-excel", exportExcelData);
  bindSettingsAction("import-json", () => document.getElementById("importJsonInput")?.click());
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
  return new Date().toISOString().slice(0, 10);
}

function renderHelp() {
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.help()}</span>${t("help")}</h1>
          <p class="page-subtitle">${t("helpSubtitle")}</p>
        </div>
      </div>
      <article class="glass-card card-pad">
        <div class="grid three-col">
          <div class="goal-item"><span class="icon-badge">${Icons.search()}</span><h2>${t("search")}</h2><p class="secondary">${t("searchHelp")}</p></div>
          <div class="goal-item"><span class="icon-badge green">${Icons.plus()}</span><h2>${t("add")}</h2><p class="secondary">${t("addHelp")}</p></div>
          <div class="goal-item"><span class="icon-badge blue">${Icons.chart()}</span><h2>${t("review")}</h2><p class="secondary">${t("reviewHelp")}</p></div>
        </div>
      </article>
    </section>
  `;
}
