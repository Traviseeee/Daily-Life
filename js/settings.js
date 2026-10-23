// Which sections are open survives re-renders: switching anything saves the profile and
// re-draws the page, which used to fold everything back to the first section.
const settingsOpenSections = new Set(["account"]);

function renderSettings() {
  // #settings/ai (from the bot or the chat) opens that section
  if (typeof App !== "undefined" && /^[a-z]+$/.test(String(App.param || ""))) settingsOpenSections.add(App.param);
  return renderSettingsPage().replace(/<details class="settings-accordion" id="settings-section-([a-z]+)"( open)?>/g,
    (match, id) => `<details class="settings-accordion" id="settings-section-${id}"${settingsOpenSections.has(id) ? " open" : ""}>`);
}

function renderSettingsPage() {
  const stats = Store.calculate();
  const welcomePoster = App.getWelcomePoster();
  const isKm = languageCode() === "km";
  const L = (km, en) => (isKm ? km : en);
  // 6 groups, like phone settings: account · look & language · money · notifications · data & privacy · about
  const settingsSections = [
    ["account", "accountCategory", "settingsAccountSubtitle", "user"],
    ["appearance", L("រូបរាង & ភាសា", "Look & language"), L("ពណ៌, ភាសា, ម៉ោង, សំឡេង, ប៊ូតុងរហ័ស", "Theme, language, clock, sound, quick buttons"), "palette"],
    ["money", L("លុយ", "Money"), L("ទំព័រលុយ, ថវិកា, ការគណនា", "Money page, budgets, totals"), "calculator"],
    ["notifications", L("ការជូនដំណឹង", "Notifications"), L("Telegram, App, ការរំលឹក, bot", "Telegram, app, reminders, bot"), "bell"],
    ["ai", "AI · Gemini", L("សួរ AI, ដំបូន្មានលុយ, ជួយអានសារ", "Ask AI, money advice, hard messages"), "spark"],
    ["data", L("ទិន្នន័យ & ឯកជនភាព", "Data & privacy"), L("Backup, Sync, Export, លាក់លុយ", "Backup, sync, export, hide money"), "shield"],
    ["about", "about", "settingsAboutSubtitle", "info"]
  ];
  const label = text => (/^[a-zA-Z]+$/.test(text) ? t(text) : text);
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
                ${settingsSections.map(([id, title, subtitle, icon]) => `<button class="financial-nav-item settings-nav-item" type="button" data-settings-jump="${id}"><span class="financial-nav-icon">${Icons[icon]()}</span><span class="financial-nav-copy"><strong>${label(title)}</strong><small>${label(subtitle)}</small></span>${Icons.chevron()}</button>`).join("")}
              </nav>
            </dialog>
          </div>
        </div>
      </div>
      <div class="settings-layout settings-layout-single">
        <div class="settings-content" data-settings-view="all">
          ${Login.guestMode ? `<button class="settings-guest-preview" type="button" data-action="connect-guest"><span class="settings-guest-avatar">${initials(t("guestPreview"))}</span><span class="settings-guest-copy"><strong>${t("guestPreview")}</strong><small>${t("guestSaveWarning")}</small></span>${Icons.chevron()}</button>` : ""}
          ${renderSettingsSummary()}
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
          <details class="settings-accordion" id="settings-section-appearance">
            ${settingsAccordionSummary("appearance", label(settingsSections[1][1]), label(settingsSections[1][2]), Icons.palette())}
            <div class="settings-accordion-body">
              <div class="settings-preference-list settings-preference-list-standalone">
                <label class="settings-preference-row"><span><strong>${t("theme")}</strong><small>${t("themeHelp")}</small></span><select data-preference="theme"><option value="dark" ${appData.profile.theme !== "light" ? "selected" : ""}>${t("darkTheme")}</option><option value="light" ${appData.profile.theme === "light" ? "selected" : ""}>${t("lightTheme")}</option></select></label>
                <label class="settings-preference-row"><span><strong>${t("language")}</strong><small>${t("languageHelp")}</small></span><select data-preference="language"><option value="English" ${appData.profile.language !== "Khmer" ? "selected" : ""}>English</option><option value="Khmer" ${appData.profile.language === "Khmer" ? "selected" : ""}>ខ្មែរ</option></select></label>
                <label class="settings-preference-row"><span><strong>${t("clockFormat")}</strong><small>${t("clockFormatHelp")}</small></span><select data-preference="clockFormat"><option value="12-hour" ${appData.profile.clockFormat !== "24-hour" ? "selected" : ""}>12-hour</option><option value="24-hour" ${appData.profile.clockFormat === "24-hour" ? "selected" : ""}>24-hour</option></select></label>
                <label class="settings-preference-row"><span><strong>${t("soundEnabled")}</strong><small>${t("soundEnabledHelp")}</small></span><input type="checkbox" data-preference="soundEnabled" ${appData.profile.soundEnabled !== false ? "checked" : ""}></label>
                <div class="settings-preference-row settings-sound-row"><span><strong>${languageCode() === "km" ? "កម្រិតសំឡេង" : "Sound volume"}</strong><small>${languageCode() === "km" ? "សំឡេងពេលចុច កត់លុយ ជូនដំណឹង និងសម្រេចគោលដៅ" : "Taps, money, alerts and goal celebrations"}</small></span><div class="settings-sound-controls"><input type="range" min="0" max="100" step="5" value="${Number.isFinite(Number(appData.profile.soundVolume)) ? Number(appData.profile.soundVolume) : 70}" data-sound-volume aria-label="Volume"><button type="button" class="button ghost-button" data-sound-preview>▶ ${languageCode() === "km" ? "សាក" : "Try"}</button></div></div>
                <label class="settings-preference-row"><span><strong>${languageCode() === "km" ? "ញ័រទូរស័ព្ទ" : "Vibration"}</strong><small>${languageCode() === "km" ? "ញ័រតិចៗពេល save ការរំលឹក និងអបអរ (ទូរស័ព្ទ)" : "Small buzz on save, reminders and celebrations (phones)"}</small></span><input type="checkbox" data-preference="haptics" ${appData.profile.haptics !== false ? "checked" : ""}></label>
                <label class="settings-preference-row"><span><strong>${languageCode() === "km" ? "រូបស្វាគមន៍ពេលបើក app" : "Welcome photo on open"}</strong><small>${languageCode() === "km" ? "រូបគ្រួសារ និងកិច្ចការថ្ងៃនេះ ពេលបើក app" : "Family photo and today's plan when the app opens"}</small></span><select data-preference="welcomePosterMode">${[["daily", languageCode() === "km" ? "ម្ដងក្នុងមួយថ្ងៃ" : "Once a day"], ["always", languageCode() === "km" ? "រាល់ពេលបើក" : "Every time"], ["off", languageCode() === "km" ? "បិទ" : "Off"]].map(([v, l]) => `<option value="${v}" ${(appData.profile.welcomePosterMode || "daily") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
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
              <article class="glass-card card-pad settings-preferences-card" data-settings-section="appearance">
                <div class="settings-preference-list">
                <label class="settings-preference-row"><span><strong>${t("quickActions")}</strong><small>${t("quickActionsHelp")}</small></span></label>
                ${(() => {
                  const saved = Array.isArray(appData.profile.quickActions) ? appData.profile.quickActions : [];
                  const oldDefault = saved.length === 3 && ["smart-assistant", "add-event", "add-goal"].every(id => saved.includes(id));
                  const selected = saved.length && !oldDefault ? saved : QUICK_ACTION_DEFAULTS;
                  return quickActionList().map(([id, , label]) => `<label class="settings-preference-row settings-quick-action-row"><span><strong>${label}</strong><small>${t("showInQuickActions")}</small></span><input type="checkbox" data-quick-action-preference="${id}" ${selected.includes(id) ? "checked" : ""}></label>`).join("");
                })()}
                <div class="settings-preference-row settings-link-row"><span><strong>${languageCode() === "km" ? "Footer និងថវិកា" : "Footer and budgets"}</strong><small>${languageCode() === "km" ? "រៀបលំដាប់ footer ឬកំណត់ថវិកាតាមប្រភេទចំណាយ" : "Arrange the footer or set spending budgets"}</small></span><div class="settings-link-buttons"><button type="button" class="button ghost-button" data-open-footer-editor>${languageCode() === "km" ? "រៀបចំ footer" : "Arrange footer"}</button></div></div>
                </div>
              </article>
            </div>
          </details>
          <details class="settings-accordion" id="settings-section-money">
            ${settingsAccordionSummary("money", label(settingsSections[2][1]), label(settingsSections[2][2]), Icons.calculator())}
            <div class="settings-accordion-body settings-finance-panel" data-settings-panel="finance">
              <div class="settings-preference-list settings-preference-list-standalone">
                <label class="settings-preference-row"><span><strong>${languageCode() === "km" ? "ទំព័រលុយ បង្ហាញដំបូង" : "Money page opens on"}</strong><small>${languageCode() === "km" ? "ពេលដែលទំព័រលុយបង្ហាញមុនគេ" : "The period the Money page shows first"}</small></span><select data-preference="moneyDefaultPeriod">${[["day", languageCode() === "km" ? "ថ្ងៃ" : "Day"], ["week", languageCode() === "km" ? "សប្តាហ៍" : "Week"], ["month", languageCode() === "km" ? "ខែ" : "Month"], ["year", languageCode() === "km" ? "ឆ្នាំ" : "Year"]].map(([v, l]) => `<option value="${v}" ${(appData.profile.moneyDefaultPeriod || "month") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
                <div class="settings-preference-row settings-link-row"><span><strong>${L("ថវិកា", "Budgets")}</strong><small>${L("កំណត់ថវិកាតាមប្រភេទចំណាយ", "Set spending budgets by category")}</small></span><a class="button ghost-button" href="#money/budget">${L("កំណត់", "Set")}</a></div>
              </div>
            ${settingsCard(t("financialCalculations"), [
              [t("availableMoney"), money(stats.available)],
              [t("totalIncome"), money(stats.totalIncome)],
              [t("totalExpenses"), money(stats.totalExpenses)],
              [t("totalSavings"), money(stats.totalSavings)],
              [t("loanBalance"), money(stats.loanBalance)]
            ], Icons.calculator(), "finance")}
            </div>
          </details>
          <details class="settings-accordion" id="settings-section-notifications">
            ${settingsAccordionSummary("notifications", label(settingsSections[3][1]), label(settingsSections[3][2]), Icons.bell())}
            <div class="settings-accordion-body">
              <div class="settings-preference-list settings-preference-list-standalone">
                <div class="settings-preference-row settings-link-row settings-nfc-link"><span><strong>🔔 ${L("កំណត់ការជូនដំណឹង", "Notification settings")}</strong><small>${escapeHtml(settingsNotifySummary())}</small></span><button class="button" type="button" data-nfc-open>${L("បើក", "Open")} ${Icons.chevron()}</button></div>
              </div>
              ${renderAlertStatusCard()}
              ${typeof renderBotHelpCard === "function" ? renderBotHelpCard() : ""}
            </div>
          </details>
          ${typeof renderAiSettingsSection === "function" && typeof AiAssist !== "undefined" ? renderAiSettingsSection() : ""}
          <details class="settings-accordion" id="settings-section-data">
            ${settingsAccordionSummary("data", label(settingsSections[5][1]), label(settingsSections[5][2]), Icons.shield())}
            <div class="settings-accordion-body">
              <div class="settings-preference-list settings-preference-list-standalone">
                <label class="settings-preference-row"><span><strong>${t("moneyPrivacy")}</strong><small>${t("moneyPrivacyHelp")}</small></span><input type="checkbox" data-preference="moneyHidden" ${appData.profile.moneyHidden ? "checked" : ""}></label>
                ${typeof AppLock !== "undefined" ? AppLock.settingsRows() : ""}
              </div>
          <div class="settings-section-grid settings-data-grid" data-settings-panel="data">
            <article class="glass-card card-pad settings-data-card" data-settings-section="data">
              <div class="between"><div><h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.database()}</span>${t("backupAndRestore")}</h2><p class="secondary">${t("backupAndRestoreHelp")}</p></div><span class="icon-badge">${Icons.database()}</span></div>
              <div class="settings-action-grid">
                ${settingsAction("export-json", Icons.arrowDown(), t("exportJson"), t("backupJsonHelp"))}
                ${settingsAction("import-json", Icons.arrowUp(), t("importJson"), t("importJsonHelp"))}
                ${settingsAction("export-excel", Icons.chart(), t("exportExcel"), t("excelExportHelp"))}
              </div>
            </article>
            ${renderLocalBackupCard()}
            ${typeof renderCloudBackupsCard === "function" ? renderCloudBackupsCard() : ""}
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
          <details class="settings-accordion" id="settings-section-about">
            ${settingsAccordionSummary("about", t("about"), t("settingsAboutSubtitle"), Icons.info())}
            <div class="settings-accordion-body settings-about-body">
              <section class="settings-about-story" aria-labelledby="settingsAboutTitle">
                <div class="settings-about-story-heading">
                  <span class="settings-about-brand">MYLIFE</span>
                  <span class="settings-about-version">Version ${APP_VERSION}${settingsAppBuild() ? ` · ${escapeHtml(settingsAppBuild())}` : ""}</span>
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
              ${renderReleaseNotes()}
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

// one line under the title: who · theme · language · currency · cloud sync · last backup
function renderSettingsSummary() {
  const isKm = languageCode() === "km";
  const L = (km, en) => (isKm ? km : en);
  const p = appData.profile;
  const pending = typeof SyncState !== "undefined" && SyncState.isPending?.();
  const backups = typeof Store.listBackups === "function" ? Store.listBackups() : [];
  const last = backups[0]?.createdAt ? new Date(backups[0].createdAt) : null;
  const days = last && !Number.isNaN(last.getTime()) ? Math.floor((Date.now() - last.getTime()) / 864e5) : null;
  const backupText = days === null ? L("មិនទាន់មាន backup", "No backup yet") : days === 0 ? L("Backup ថ្ងៃនេះ", "Backed up today") : L(`Backup ${days} ថ្ងៃមុន`, `Backup ${days}d ago`);
  const photo = p.photo ? `<img src="${escapeAttr(p.photo)}" alt="">` : escapeHtml(initials(p.name));
  return `<div class="settings-summary">
    <span class="settings-summary-avatar">${photo}</span>
    <div class="settings-summary-copy">
      <strong>${escapeHtml(p.name || L("មិនទាន់ដាក់ឈ្មោះ", "No name yet"))}</strong>
      <div class="settings-summary-chips">
        <span>${p.theme === "light" ? "☀️ Light" : "🌙 Dark"}</span>
        <span>${p.language === "Khmer" ? "ខ្មែរ" : "English"}</span>
        <span>${escapeHtml(p.currency || "USD")}</span>
        <span class="${pending ? "is-warn" : "is-ok"}">☁️ ${pending ? L("រង់ចាំ Sync", "Sync pending") : L("Sync រួច", "Synced")}</span>
        <span class="${days === null || days > 7 ? "is-warn" : ""}">💾 ${escapeHtml(backupText)}</span>
      </div>
    </div>
    <button class="icon-button settings-summary-sync" type="button" data-settings-sync aria-label="${escapeAttr(L("Sync ឥឡូវ", "Sync now"))}" title="${escapeAttr(L("Sync ឥឡូវ", "Sync now"))}">⟳</button>
  </div>`;
}

function settingsNotifySummary() {
  const isKm = languageCode() === "km";
  if (appData.profile.notificationsEnabled === false) return isKm ? "បិទទាំងអស់" : "All off";
  if (typeof NotifyPrefs === "undefined") return isKm ? "Telegram, App និងការរំលឹក" : "Telegram, app and reminders";
  const p = NotifyPrefs.prefs(appData.profile);
  const channels = [p.telegram ? "Telegram" : "", p.app ? "App" : ""].filter(Boolean).join(" + ") || (isKm ? "គ្មានកន្លែងផ្ញើ" : "No channel");
  const on = NotifyPrefs.TOOLS.filter(tool => p.tools[tool]).length;
  return `${channels} · ${on}/${NotifyPrefs.TOOLS.length} ${isKm ? "បើក" : "on"}`;
}

// shown in Settings → About; newest first
const APP_VERSION = "2.0.2";
const RELEASE_NOTES = [
  {
    version: "2.0.2",
    date: "2026-10-23",
    items: [
      ["🎨 Light mode ថ្មី ពណ៌ខៀវមេឃ — ផ្ទៃភ្លឺ card ស ប៊ូតុង និង menu ខៀវ", "New sky-blue light mode — bright background, white cards, blue buttons and menu"],
      ["💳 Card លុយ pop-up និង card គ្រួសារ មិនងងឹតទៀតក្នុង Light mode", "Money cards, pop-ups and the family card are no longer dark in light mode"],
      ["🌙 Dark mode រក្សាបៃតង + lime ដដែល", "Dark mode keeps its green + lime look"]
    ]
  },
  {
    version: "2.0.1",
    date: "2026-10-23",
    items: [
      ["📸 Memories ថ្មី — post រូប/វីដេអូ, reels, ❤️, រក្សាទុកឯកជន", "New Memories — photo/video posts, reels, ❤️, private storage"],
      ["💰 សួរលុយពេលដល់ថ្ងៃ — ប្រាក់ខែ វិក្កយបត្រ កម្ចី (app + Telegram) មិនកត់ស្ទួន", "Money check-in on the day — salary, bills, loans (app + Telegram), never saved twice"],
      ["🏠 Card «រង់ចាំឆ្លើយ» លើ Home · ✏️ ចំនួនផ្សេងសម្រាប់វិក្កយបត្រ", "Home “waiting” card · ✏️ other amount for bills"],
      ["🐷 ទទួលប្រាក់ខែ → សួរដាក់សន្សំ · រំលឹកសន្សំនៅថ្ងៃបើកប្រាក់ខែ", "Salary received → put savings in · saving reminder on salary day"],
      ["🔔 Notification Center ថ្មី — tab ហិរញ្ញវត្ថុ / ថ្ងៃសំខាន់ / របាយការណ៍ · ការរំលឹកបន្ទាប់", "New Notification Center — Money / Dates / Reports tabs · coming up next"],
      ["✈️ Telegram — ✏️ ចំនួនផ្សេង · សង្ខេបពេលព្រឹកបង្ហាញអ្វីដែលនៅរង់ចាំ", "Telegram — ✏️ other amount · morning digest lists what is still open"],
      ["📊 របាយការណ៍ប្រើប្រាក់ខែពិតដែលទទួល + ដាក់សន្សំខែនេះ", "Reports use the salary really received + savings this month"],
      ["👨‍👩‍👧 គ្រួសារ — បង្កើតគ្រួសារ អញ្ជើញតាម link/QR តួនាទី និងសិទ្ធិម្នាក់ៗ", "Family group — invite by link/QR, roles and per-member access"],
      ["⚡ Update លឿនជាងមុន — ទូរស័ព្ទទាញតែឯកសារដែលប្តូរ", "Faster updates — phones only download what changed"],
      ["⏳ មកដល់ឆាប់ៗ — Login ដោយ Google · Feed/Calendar គ្រួសាររួមគ្នា", "Coming soon — Google login · shared family feed & calendar"]
    ]
  }
];

function renderReleaseNotes() {
  const isKm = languageCode() === "km";
  return `<section class="settings-release" aria-label="${escapeAttr(isKm ? "អ្វីថ្មី" : "What's new")}">
    ${RELEASE_NOTES.map((note, index) => `<details class="settings-release-item" ${index === 0 ? "open" : ""}>
      <summary><strong>${escapeHtml(isKm ? "អ្វីថ្មី" : "What's new")} · V${escapeHtml(note.version)}</strong><small>${escapeHtml(formatDate(note.date))}</small></summary>
      <ul>${note.items.map(([km, en]) => `<li>${escapeHtml(isKm ? km : en)}</li>`).join("")}</ul>
    </details>`).join("")}
  </section>`;
}

function settingsAppBuild() {
  return window.__MYLIFE_BUILD || "";
}

// local backups (this device): count + restore, moved here from the alert card
function renderLocalBackupCard() {
  const backups = typeof Store.listBackups === "function" ? Store.listBackups() : [];
  const pendingSync = typeof SyncState !== "undefined" && SyncState.isPending?.();
  return `
    <article class="glass-card card-pad settings-preferences-card" data-settings-section="data">
      <div class="settings-preference-list">
        <div class="settings-preference-row"><span><strong>${t("cloudSync")}</strong><small>${t("cloudSyncHelp")}</small></span><span class="pill ${pendingSync ? "" : "success"}">${pendingSync ? t("pending") : t("synced")}</span></div>
        <div class="settings-preference-row"><span><strong>${t("localBackups")}</strong><small>${t("localBackupsHelp")}</small></span><span class="pill ${backups.length ? "success" : ""}">${backups.length}</span></div>
      </div>
      <div class="settings-action-grid">
        ${settingsAction("show-backups", Icons.database(), t("restoreLocalBackup"), t("restoreLocalBackupHelp"))}
      </div>
    </article>`;
}

function renderAlertStatusCard() {
  const notificationsOn = appData.profile.notificationsEnabled !== false;
  const pushSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const permission = typeof Notification !== "undefined" ? Notification.permission : "default";
  const backups = typeof Store.listBackups === "function" ? Store.listBackups() : [];
  const pendingSync = typeof SyncState !== "undefined" && SyncState.isPending?.();
  return `
    <article class="glass-card card-pad settings-preferences-card" data-settings-section="notifications">
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
      </div>
      <div class="settings-action-grid">
        ${settingsAction("enable-alerts", Icons.bell(), t("enableAlerts"), t("enableAlertsHelp"))}
        ${settingsAction("test-alert", Icons.spark(), t("sendTestAlert"), t("sendTestAlertHelp"))}
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
  const km = typeof languageCode === "function" && languageCode() === "km";
  const L = (en, kh) => (km ? kh : en);
  Modal.open({
    title: t("editProfile"),
    submitText: t("save"),
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
      Toast.show(t("profileSaved"), "success");
    }
  });

  const modalForm = document.getElementById("modalForm");
  if (!modalForm || modalForm.dataset.profileEnhanced === "true") return;
  modalForm.dataset.profileEnhanced = "true";
  modalForm.classList.add("profile-modal");

  // account card under the title: who is signed in + connect / log out
  // (before, this row replaced the title bar, so the sheet had no title and no ✕)
  const header = modalForm.querySelector(".between");
  const name = String(appData.profile.name || "").trim();
  const initial = (name.match(/\S/u)?.[0] || "M").toUpperCase();
  const card = document.createElement("section");
  card.className = "profile-account-card";
  card.innerHTML = `
    <span class="profile-account-avatar">${appData.profile.photo ? `<img src="${escapeHtml(appData.profile.photo)}" alt="">` : escapeHtml(initial)}</span>
    <span class="profile-account-copy">
      <strong>${escapeHtml(name || L("Guest", "ភ្ញៀវ"))}</strong>
      <small data-profile-email>${escapeHtml(L("Checking account…", "កំពុងពិនិត្យគណនី…"))}</small>
    </span>
    <span class="profile-account-badge" data-profile-badge hidden></span>
    <div class="profile-account-actions">
      <button type="button" class="button profile-connect-button" data-connect-account="true" hidden>${escapeHtml(L("Connect account", "ភ្ជាប់គណនី"))}</button>
      <button type="button" class="button ghost-button profile-logout-button" data-logout-profile="true">${escapeHtml(t("logout"))}</button>
    </div>`;
  header?.after(card);

  const connectButton = card.querySelector("[data-connect-account]");
  const logoutButton = card.querySelector("[data-logout-profile]");
  connectButton.addEventListener("click", () => {
    Modal.close();
    Login.open("login");
  });
  logoutButton.addEventListener("click", () => {
    if (logoutButton.dataset.armed !== "1") {
      // one more tap to confirm, so a slip of the thumb does not sign you out
      logoutButton.dataset.armed = "1";
      logoutButton.classList.add("is-armed");
      logoutButton.textContent = L("Tap again to log out", "ចុចម្ដងទៀតដើម្បីចាកចេញ");
      setTimeout(() => {
        if (!logoutButton.isConnected) return;
        logoutButton.dataset.armed = "";
        logoutButton.classList.remove("is-armed");
        logoutButton.textContent = t("logout");
      }, 3500);
      return;
    }
    Modal.close();
    Promise.resolve(Login.logout()).finally(() => App.render());
  });

  const emailEl = card.querySelector("[data-profile-email]");
  const badgeEl = card.querySelector("[data-profile-badge]");
  const showGuest = () => {
    emailEl.textContent = L("Not connected — data stays on this phone", "មិនទាន់ភ្ជាប់ — ទិន្នន័យនៅលើទូរសព្ទនេះប៉ុណ្ណោះ");
    connectButton.hidden = false;
    logoutButton.hidden = true;
    card.classList.add("is-guest");
  };
  const api = window.MYLIFE_SUPABASE_API;
  if (!window.MYLIFE_SUPABASE?.enabled || !api?.getSession) { showGuest(); }
  else {
    Promise.resolve(api.getSession()).then(result => {
      const user = result?.data?.session?.user;
      if (!user || !card.isConnected) return showGuest();
      emailEl.textContent = user.email || L("Signed in", "បានចូលគណនី");
      const providers = user.app_metadata?.providers || [user.app_metadata?.provider].filter(Boolean);
      const google = providers.includes("google");
      badgeEl.hidden = false;
      badgeEl.textContent = google ? "Google" : "Email";
      badgeEl.classList.toggle("is-google", google);
      connectButton.hidden = true;
    }).catch(showGuest);
  }

  // small section labels so the long form reads in groups
  const group = (fieldName, label) => {
    const control = modalForm.querySelector(`[name="${fieldName}"]`);
    const wrap = control?.closest(".field, label, .form-field, .modern-field") || control?.parentElement;
    if (!wrap || !wrap.parentElement) return;
    const head = document.createElement("p");
    head.className = "profile-group-label";
    head.textContent = label;
    wrap.parentElement.insertBefore(head, wrap);
  };
  group("currency", L("App settings", "ការកំណត់ App"));
  group("soundEnabled", L("Sound & alerts", "សំឡេង និងការជូនដំណឹង"));
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
  document.querySelectorAll("details.settings-accordion[id^='settings-section-']").forEach(section => section.addEventListener("toggle", () => {
    const id = section.id.replace("settings-section-", "");
    if (section.open) settingsOpenSections.add(id);
    else settingsOpenSections.delete(id);
  }));
  document.querySelector("[data-settings-sync]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    const isKm = languageCode() === "km";
    button.disabled = true;
    button.classList.add("is-busy");
    try {
      if (navigator.onLine === false) throw new Error("offline");
      const session = await window.MYLIFE_SUPABASE_API?.getSession?.();
      if (!session?.data?.session) {
        Toast.show(isKm ? "សូម login សិន ដើម្បី Sync" : "Sign in first to sync", "warning");
        button.disabled = false;
        button.classList.remove("is-busy");
        return;
      }
      if (typeof Store.flushPendingSync === "function") await Store.flushPendingSync();
      await Store.syncFromSupabase();
      const pending = typeof SyncState !== "undefined" && SyncState.isPending?.();
      Toast.show(pending ? (isKm ? "Sync មិនទាន់ចប់ — នឹងសាកម្តងទៀតដោយខ្លួនឯង" : "Not synced yet — it will retry by itself") : (isKm ? "☁️ Sync រួចរាល់" : "☁️ Synced"), pending ? "warning" : "success");
      App.render();
    } catch (error) {
      Toast.show(isKm ? "Sync មិនបាន — សូមពិនិត្យអ៊ីនធឺណិត" : "Couldn't sync — check your connection", "warning");
      button.disabled = false;
      button.classList.remove("is-busy");
    }
  });
  if (typeof NotifyCenter !== "undefined") document.querySelectorAll("[data-nfc-open]").forEach(button => button.addEventListener("click", () => NotifyCenter.open(button.dataset.nfcOpen || "")));
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
  document.querySelectorAll("[data-sound-volume]").forEach(range => {
    range.addEventListener("input", () => { appData.profile.soundVolume = Number(range.value); });
    range.addEventListener("change", () => {
      Store.updateProfile({ soundVolume: Number(range.value) });
      Sound.play("success", { force: true });
    });
  });
  document.querySelectorAll("[data-sound-preview]").forEach(button => button.addEventListener("click", () => Sound.preview()));
  document.querySelectorAll("[data-open-footer-editor]").forEach(button => button.addEventListener("click", () => {
    try { sessionStorage.setItem("mylife:open-footer-editor", String(Date.now())); } catch (error) { /* ignore */ }
    location.hash = "#launcher";
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
    sessionStorage.setItem("mylife:open-footer-editor", String(Date.now()));
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
  downloadFile(`mylife-backup-${backupDate()}.json`, "application/json", JSON.stringify(typeof AiAssist !== "undefined" ? AiAssist.withoutSecrets(appData) : appData, null, 2));
  Toast.show(t("jsonExported"));
}

function importJsonData(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const km = languageCode() === "km";
  const reader = new FileReader();
  reader.onload = () => {
    let imported;
    try {
      imported = JSON.parse(reader.result);
    } catch (error) {
      Toast.show(km ? "នាំចូលមិនបាន៖ ឯកសារនេះមិនមែនជា JSON ត្រឹមត្រូវទេ។ ទិន្នន័យរបស់អ្នកមិនបានប្ដូរទេ។" : "Import failed: this file is not valid JSON. Your data was not changed.", "warning");
      return;
    }
    // Check the whole structure before asking — a bad file never reaches the data.
    const check = validateAppDataImport(imported);
    if (!check.ok) {
      const detail = check.errors.slice(0, 2).join("; ") + (check.errors.length > 2 ? ` (+${check.errors.length - 2})` : "");
      Toast.show(km ? `នាំចូលមិនបាន៖ ឯកសារបម្រុងខូច (${detail})។ ទិន្នន័យរបស់អ្នកមិនបានប្ដូរទេ។` : `Import failed: the backup is damaged (${detail}). Your data was not changed.`, "warning");
      return;
    }
    Modal.confirm({
      title: t("importJson"),
      message: t("importJsonMessage"),
      confirmText: t("importJson"),
      onConfirm: () => {
        const keepAi = appData.profile?.aiSettings ? { ...appData.profile.aiSettings } : null; // backups never hold the AI key
        const result = Store.importData(imported);
        if (result.ok && keepAi?.apiKey && !appData.profile?.aiSettings?.apiKey) {
          appData.profile.aiSettings = { ...(appData.profile.aiSettings || {}), apiKey: keepAi.apiKey };
          Store.save?.();
        }
        if (!result.ok) {
          const reason = result.errors[0] === "backup_failed"
            ? (km ? "មិនអាចបង្កើតច្បាប់ចម្លងបម្រុងនៃទិន្នន័យបច្ចុប្បន្នបានទេ (ទំហំផ្ទុកពេញ?)" : "could not back up your current data first (storage full?)")
            : result.errors.join("; ");
          Toast.show(km ? `នាំចូលមិនបាន៖ ${reason}។ ទិន្នន័យរបស់អ្នកមិនបានប្ដូរទេ។` : `Import failed: ${reason}. Your data was not changed.`, "warning");
          return;
        }
        App.render();
        const kmNow = languageCode() === "km"; // the backup may switch the language
        Toast.show(result.backupKey
          ? (kmNow ? `${t("jsonImported")} · ទិន្នន័យចាស់ត្រូវបានរក្សាទុកជាច្បាប់ចម្លងបម្រុងក្នុងឧបករណ៍នេះ (before-import)` : `${t("jsonImported")} · Your previous data was saved as a local backup on this device (before-import)`)
          : t("jsonImported"));
      }
    });
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
        ${sections.map(section => excelTable(section, section === "profile" ? [(({ aiSettings, ...rest }) => rest)(appData.profile)] : appData[section])).join("")}
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
      ${renderSmartHelp()}
    </section>
  `;
}

// "Use it smart" guide: the newer features, with examples to copy.
function renderSmartHelp() {
  const km = languageCode() === "km";
  const tips = km ? [
    { icon: Icons.spark(), title: "MYLIFE Chat (ប៊ូតុង ✨ លើ header)", body: "សួរ ឬបញ្ជាជាភាសាខ្មែរ — ឆ្លើយពីទិន្នន័យរបស់អ្នក ឯកជន មិនប្រើ internet។", examples: ["ថ្ងៃនេះមានអ្វី?", "ខែនេះចាយប៉ុន្មាន?", "នៅសល់ប៉ុន្មាន?", "ចាយ Grab 15k", "បង់ EDC រួច"] },
    { icon: Icons.calendar(), title: "Form ឆ្លាត", body: "វាយមួយបន្ទាត់ ហើយ app បំពេញឱ្យ។", examples: ["ជួបម៉ាក់ ស្អែក 9 ព្រឹក", "Grab 15k", "Gym 45 នាទី", "សន្សំ $2000 ទិញម៉ូតូ 1 ឆ្នាំ"] },
    { icon: Icons.bell(), title: "Telegram bot", body: "ផ្ញើសារទៅ bot ដើម្បីកត់ ឬមើលភ្លាម។", examples: ["/today", "/help", "ចាយ 5$ អាហារ", "ស្អែក 7 យប់ ញ៉ាំបាយ"] },
    { icon: Icons.money(), title: "មើលលុយតាមពេល", body: "ទំព័រលុយ → ជ្រើស ថ្ងៃ · សប្តាហ៍ · ខែ · ឆ្នាំ ហើយចុច ‹ › ដើម្បីទៅមុន ឬក្រោយ។ ថ្ងៃ/សប្តាហ៍ ប្រាប់ថាអាចចាយបានប៉ុន្មានទៀត។", examples: [] },
    { icon: Icons.chart(), title: "របាយការណ៍", body: "លុយ → របាយការណ៍៖ នាំចេញ Excel (មានរូបមន្ត) · Word · JPG ដែលមានការយល់ដឹងសរសេរឱ្យ។", examples: [] },
    { icon: Icons.menu(), title: "☰ និង footer", body: "☰ ដូចអេក្រង់ទូរស័ព្ទ៖ លេខក្រហម = រឿងត្រូវធ្វើ។ ចុច ▦ ដើម្បីរៀប footer (‹ › × +)។", examples: [] },
    { icon: Icons.spark(), title: "ប៊ូតុង + និងសំឡេង", body: "ប៊ូតុង + ពណ៌ទឹកក្រូច បន្ថែមអ្វីៗរហ័ស (ជ្រើសក្នុង Settings)។ សំឡេង និងការញ័រ កែបានក្នុង Settings។", examples: [] }
  ] : [
    { icon: Icons.spark(), title: "MYLIFE Chat (✨ button in the header)", body: "Ask or give commands — answers come from your own data, private, works offline.", examples: ["What's on today?", "How much did I spend this month?", "How much is left?", "spent Grab 15k", "paid EDC"] },
    { icon: Icons.calendar(), title: "Smart forms", body: "Type one line and the app fills the rest.", examples: ["Meet mom tomorrow 9am", "Grab 15k", "Gym 45 min", "Save $2000 for a motorbike in 1 year"] },
    { icon: Icons.bell(), title: "Telegram bot", body: "Message the bot to log or check things fast.", examples: ["/today", "/help", "spent 5$ food", "tomorrow 7pm dinner"] },
    { icon: Icons.money(), title: "Money by period", body: "Money → pick Day · Week · Month · Year and use ‹ › to move. Day/Week shows what you can still spend.", examples: [] },
    { icon: Icons.chart(), title: "Reports", body: "Money → Reports: export Excel (with formulas), Word or a JPG with written insights.", examples: [] },
    { icon: Icons.menu(), title: "☰ and footer", body: "☰ works like a phone home screen: red numbers need you. Tap ▦ to arrange the footer (‹ › × +).", examples: [] },
    { icon: Icons.spark(), title: "+ button and sounds", body: "The orange + adds things fast (choose them in Settings). Sounds and vibration are in Settings.", examples: [] }
  ];
  return `<section class="smart-help">
    <h2 class="smart-help-title">${km ? "✨ ប្រើឱ្យឆ្លាត" : "✨ Use it smart"}</h2>
    <div class="smart-help-grid">
      ${tips.map(tip => `<article class="smart-help-card"><span class="smart-help-icon">${tip.icon}</span><div><h3>${escapeHtml(tip.title)}</h3><p>${escapeHtml(tip.body)}</p>${tip.examples.length ? `<div class="smart-help-examples">${tip.examples.map(ex => `<code>${escapeHtml(ex)}</code>`).join("")}</div>` : ""}</div></article>`).join("")}
    </div>
  </section>`;
}
