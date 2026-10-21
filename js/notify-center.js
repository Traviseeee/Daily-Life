/*
 * Notification control center (like iPhone Settings → Notifications).
 * - Today page card: channel switches + tool chips, "Manage" opens the center.
 * - Center sheet: channels (Telegram / MYLIFE app), then every tool with its own
 *   switch; tap a tool for its details (bill reminder days, budget alerts, reports…).
 * Settings live in appData.profile.notify (rules in js/notify-prefs.js). The
 * older switches (budgetAlerts, morningDigest, per-bill reminder…) are reused,
 * not duplicated, and a tool switched off keeps working — only its alerts stop.
 */
const NotifyCenter = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  let view = "home";

  const TOOL_META = {
    bills: { icon: "🧾", km: "វិក្កយបត្រ & ទឹកភ្លើង", en: "Bills & utilities", dkm: "ថ្ងៃផុតកំណត់, បង់ស្វ័យប្រវត្តិ, PPWSA / EDC", den: "Due dates, auto-pay, PPWSA / EDC", href: "#money/bills" },
    expenses: { icon: "💸", km: "ចំណាយ & ថវិកា", en: "Expenses & budget", dkm: "ព្រមានថវិកា, ចាយមិនធម្មតា, សួរពេលយប់", den: "Budget alerts, unusual spending, evening check", href: "#money/expenses" },
    loans: { icon: "🏦", km: "ប្រាក់កម្ចី", en: "Loans", dkm: "រំលឹកថ្ងៃបង់ប្រាក់", den: "Payment-day reminders", href: "#money/loans" },
    savings: { icon: "💰", km: "សន្សំ & គោលដៅ", en: "Savings & goals", dkm: "ដាក់សន្សំប្រចាំខែ, ថ្ងៃកំណត់គោលដៅ", den: "Monthly saving, goal deadlines", href: "#money/savings" },
    calendar: { icon: "📅", km: "ប្រតិទិន & ការរំលឹក", en: "Calendar & reminders", dkm: "ព្រឹត្តិការណ៍ និងការរំលឹក", den: "Events and reminders", href: "#calendar" },
    family: { icon: "🎂", km: "គ្រួសារ", en: "Family", dkm: "ថ្ងៃកំណើត និងខួប", den: "Birthdays and anniversaries", href: "#family" },
    reports: { icon: "📊", km: "របាយការណ៍", en: "Reports", dkm: "សង្ខេបព្រឹក, របាយការណ៍សប្តាហ៍ & ខែ", den: "Morning digest, weekly & monthly reports", href: "#money/reports" },
    backup: { icon: "💾", km: "Backup", en: "Backup", dkm: "ឯកសារ JSON ទៅ Telegram រៀងរាល់សប្តាហ៍", den: "Weekly JSON file to Telegram", href: "#settings" }
  };

  const STAGE_LABEL = { 3: ["3 ថ្ងៃមុន", "3 days before"], 2: ["2 ថ្ងៃមុន", "2 days before"], 1: ["1 ថ្ងៃមុន", "1 day before"], 0: ["ថ្ងៃផុតកំណត់", "On the due date"] };

  const prefs = () => NotifyPrefs.prefs(appData.profile);
  const masterOn = () => appData.profile.notificationsEnabled !== false;

  function save(changes) {
    const current = prefs();
    const next = { ...current, ...changes, tools: { ...current.tools, ...(changes.tools || {}) } };
    const y = window.scrollY;
    Store.updateProfile({ notify: next });
    window.scrollTo(0, y);
    refreshSheet();
  }

  function saveProfile(changes) {
    const y = window.scrollY;
    Store.updateProfile(changes);
    window.scrollTo(0, y);
    refreshSheet();
  }

  const toggle = (attrs, on, label) => `<label class="nfc-switch" aria-label="${escapeAttr(label)}"><input type="checkbox" ${attrs} ${on ? "checked" : ""}><span></span></label>`;

  function statusLine() {
    const p = prefs();
    if (!masterOn()) return L("ការជូនដំណឹងទាំងអស់បិទ", "All notifications are off");
    const onTools = NotifyPrefs.TOOLS.filter(tool => p.tools[tool]).length;
    return `${p.telegram ? "✅" : "⛔"} Telegram · ${p.app ? "✅" : "⛔"} App · ${onTools}/${NotifyPrefs.TOOLS.length} ${L("tools", "tools on")}`;
  }

  /* ---------- Today page card ---------- */
  function renderTodayCard() {
    const p = prefs();
    const off = !masterOn();
    return `
      <article class="glass-card card-pad td-card nfc-today ${off ? "is-off" : ""}">
        <div class="td-card-head">
          <h2 class="section-title">🔔 ${L("ការជូនដំណឹង", "Notifications")}</h2>
          <button class="td-link nfc-open" type="button" data-nfc-open>${L("គ្រប់គ្រង", "Manage")} ${Icons.chevron()}</button>
        </div>
        <p class="nfc-status">${escapeHtml(statusLine())}</p>
        <div class="nfc-channels nfc-channels-compact">
          ${channelRow("telegram", p.telegram, "✈️", "Telegram", L("សារពី bot", "Bot messages"), off)}
          ${channelRow("app", p.app, "📱", "MYLIFE App", L("Pop-up, bell, push", "Pop-ups, bell, push"), off)}
        </div>
        <div class="nfc-chips">
          ${NotifyPrefs.TOOLS.map(tool => `<button class="nfc-chip ${p.tools[tool] && !off ? "" : "is-off"}" type="button" data-nfc-open="${tool}" title="${escapeAttr(L(TOOL_META[tool].km, TOOL_META[tool].en))}"><span>${TOOL_META[tool].icon}</span>${escapeHtml(L(TOOL_META[tool].km, TOOL_META[tool].en))}</button>`).join("")}
        </div>
      </article>`;
  }

  function channelRow(channel, on, icon, title, sub, disabled) {
    return `<div class="nfc-row nfc-channel ${on && !disabled ? "" : "is-off"}">
      <span class="nfc-icon">${icon}</span>
      <span class="nfc-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></span>
      ${toggle(`data-nfc-channel="${channel}" ${disabled ? "disabled" : ""}`, on, title)}
    </div>`;
  }

  /* ---------- center sheet ---------- */
  function homeView() {
    const p = prefs();
    const off = !masterOn();
    return `
      <div class="nfc-sheet-head">
        <div><h2 id="nfcTitle">${L("ការជូនដំណឹង", "Notifications")}</h2><p>${L("គ្រប់គ្រងការជូនដំណឹងរបស់ Tool នីមួយៗ", "Manage notifications for each MYLIFE tool")}</p></div>
        <button class="icon-button" type="button" data-nfc-close aria-label="${L("បិទ", "Close")}">${Icons.close()}</button>
      </div>
      <div class="nfc-group">
        <div class="nfc-row nfc-master">
          <span class="nfc-icon">🔔</span>
          <span class="nfc-copy"><strong>${L("អនុញ្ញាតការជូនដំណឹង", "Allow notifications")}</strong><small>${L("បិទ = ស្ងាត់ទាំងអស់ (ទិន្នន័យនៅកត់ធម្មតា)", "Off = everything quiet (data still saves)")}</small></span>
          ${toggle("data-nfc-master", !off, L("អនុញ្ញាតការជូនដំណឹង", "Allow notifications"))}
        </div>
      </div>
      <h3 class="nfc-label">${L("ផ្លូវផ្ញើ", "Notification channels")}</h3>
      <div class="nfc-group ${off ? "is-disabled" : ""}">
        ${channelRow("telegram", p.telegram, "✈️", "Telegram", L("សារពី bot ក្នុងក្រុម", "Bot messages in your group"), off)}
        ${channelRow("app", p.app, "📱", "MYLIFE App", L("Pop-up, bell 🔔, push លើទូរស័ព្ទ", "Pop-ups, bell 🔔, phone push"), off)}
      </div>
      <h3 class="nfc-label">${L("តាម Tool", "Manage by tool")}</h3>
      <p class="nfc-hint">${L("បើក/បិទ ឬចុចលើ Tool ដើម្បីកំណត់លម្អិត", "Switch on/off, or tap a tool for details")}</p>
      <div class="nfc-group ${off ? "is-disabled" : ""}">
        ${NotifyPrefs.TOOLS.map(tool => `
          <div class="nfc-row nfc-tool ${p.tools[tool] ? "" : "is-off"}">
            <button class="nfc-tool-open" type="button" data-nfc-tool="${tool}">
              <span class="nfc-icon">${TOOL_META[tool].icon}</span>
              <span class="nfc-copy"><strong>${escapeHtml(L(TOOL_META[tool].km, TOOL_META[tool].en))}</strong><small>${escapeHtml(L(TOOL_META[tool].dkm, TOOL_META[tool].den))}</small></span>
              <span class="nfc-chevron">${Icons.chevron()}</span>
            </button>
            ${toggle(`data-nfc-tool-switch="${tool}" ${off ? "disabled" : ""}`, p.tools[tool], L(TOOL_META[tool].km, TOOL_META[tool].en))}
          </div>`).join("")}
      </div>
      <p class="nfc-foot">${L("បិទការជូនដំណឹង មិនបិទ Tool ទេ — ការកត់ទិន្នន័យ និង bot នៅដំណើរការធម្មតា។", "Turning notifications off never turns a tool off — recording data and the bot keep working.")}</p>`;
  }

  function flagRow(key, title, sub, timeKey, timeDefault) {
    const p = appData.profile;
    const on = p[key] !== false;
    return `<div class="nfc-row ${on ? "" : "is-off"}">
      <span class="nfc-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></span>
      ${timeKey ? `<input class="nfc-time" type="time" value="${escapeAttr(p[timeKey] || timeDefault)}" data-nfc-time="${timeKey}" ${on ? "" : "disabled"}>` : ""}
      ${toggle(`data-nfc-flag="${key}"`, on, title)}
    </div>`;
  }

  function toolDetails(tool) {
    const p = prefs();
    if (tool === "bills") {
      return `
        <h3 class="nfc-label">${L("រំលឹកមុនថ្ងៃផុតកំណត់", "Remind me")}</h3>
        <div class="nfc-stages">
          ${NotifyPrefs.BILL_STAGES.map(days => `<label class="nfc-stage ${p.billStages.includes(days) ? "is-on" : ""}"><input type="checkbox" data-nfc-stage="${days}" ${p.billStages.includes(days) ? "checked" : ""}><span>${escapeHtml(L(...STAGE_LABEL[days]))}</span></label>`).join("")}
        </div>
        <p class="nfc-hint">${escapeHtml(stageSummary(p.billStages))}</p>
        <ul class="nfc-notes">
          <li>${L("វិក្កយបត្រនីមួយៗ នៅតែអាចបិទការរំលឹកក្នុង form របស់វា (☑ Reminder)។", "Each bill can still be muted in its own form (☑ Reminder).")}</li>
          <li>${L("Auto-pay នៅតែបង់ — មានតែសារប៉ុណ្ណោះដែលធ្វើតាមការកំណត់នេះ។", "Auto-pay still pays — only its message follows this setting.")}</li>
          <li>${L("សារ PPWSA / EDC នៅតែត្រូវកត់ក្នុង app ជានិច្ច។", "PPWSA / EDC messages are always recorded in the app.")}</li>
        </ul>`;
    }
    if (tool === "expenses") {
      return `<div class="nfc-group">
        ${flagRow("budgetAlerts", L("📊 ព្រមានថវិកា", "📊 Budget alerts"), L("ពេលចាយដល់ 80% និង 100%", "At 80% and 100% of a budget"))}
        ${flagRow("unusualAlert", L("⚠️ ចាយមិនធម្មតា", "⚠️ Unusual spending"), L("ពេលថ្ងៃនេះចាយច្រើនជាងធម្មតា", "When today is much higher than usual"))}
        ${flagRow("eveningCheck", L("🌙 សួរពេលយប់", "🌙 Evening check"), L("“មានចាយអ្វីទៀតទេ?”", "“Anything else spent today?”"), "eveningCheckTime", "21:00")}
      </div>`;
    }
    if (tool === "reports") {
      return `<div class="nfc-group">
        ${flagRow("morningDigest", L("☀️ សង្ខេបពេលព្រឹក", "☀️ Morning digest"), L("កាលវិភាគថ្ងៃនេះ", "Today's plan"), "digestTime", "07:00")}
        ${flagRow("weeklyReport", L("📈 របាយការណ៍សប្តាហ៍", "📈 Weekly report"), L("សង្ខេបលុយ 7 ថ្ងៃ", "7-day money summary"), "weeklyReportTime", "19:00")}
        ${flagRow("weeklyImage", L("🖼️ រូបរបាយការណ៍សប្តាហ៍", "🖼️ Weekly picture"), L("រូបភាពរបាយការណ៍", "Report image"))}
        ${flagRow("monthlyImage", L("🗓️ រូបរបាយការណ៍ខែ", "🗓️ Monthly picture"), L("ថ្ងៃទី 1 នៃខែ", "On the 1st of the month"))}
        ${flagRow("reportAutoSend", L("📤 របាយការណ៍ខែ (JPG + Excel)", "📤 Monthly report (JPG + Excel)"), L("ផ្ញើដោយស្វ័យប្រវត្តិ", "Sent automatically"))}
      </div>`;
    }
    if (tool === "backup") {
      return `<div class="nfc-group">${flagRow("telegramBackup", L("💾 Backup ទៅ Telegram", "💾 Backup to Telegram"), L("ឯកសារ JSON រៀងរាល់សប្តាហ៍", "Weekly JSON file"))}</div>
        <ul class="nfc-notes"><li>${L("Backup ក្នុង Cloud នៅរក្សាទុកជានិច្ច។", "Cloud backups are always kept.")}</li></ul>`;
    }
    const info = {
      calendar: L("ព្រឹត្តិការណ៍នីមួយៗ មានជម្រើស “រំលឹកមុន” ផ្ទាល់ខ្លួនក្នុង form។", "Each event has its own “remind before” option in its form."),
      family: L("សមាជិកនីមួយៗ កំណត់ “រំលឹកមុនប៉ុន្មានថ្ងៃ” ក្នុង form គ្រួសារ។", "Each member sets “remind days before” in the family form."),
      savings: L("គោលដៅនីមួយៗ កំណត់ការរំលឹកក្នុង form គោលដៅ។", "Each goal sets its reminders in the goal form."),
      loans: L("រំលឹកនៅថ្ងៃបង់ប្រាក់ម៉ោង 9:00 AM។", "Reminds on the payment day at 9:00 AM.")
    };
    return `<ul class="nfc-notes"><li>${info[tool] || ""}</li></ul>`;
  }

  function stageSummary(stages) {
    if (!stages.length) return L("គ្មានការរំលឹកវិក្កយបត្រទេ", "No bill reminders");
    return L("រំលឹក៖ ", "Reminds: ") + stages.map(days => L(...STAGE_LABEL[days])).join(" · ");
  }

  function toolView(tool) {
    const p = prefs();
    const meta = TOOL_META[tool];
    return `
      <div class="nfc-sheet-head">
        <button class="icon-button nfc-back" type="button" data-nfc-back aria-label="${L("ត្រឡប់", "Back")}">‹</button>
        <div><h2 id="nfcTitle">${meta.icon} ${escapeHtml(L(meta.km, meta.en))}</h2><p>${escapeHtml(L(meta.dkm, meta.den))}</p></div>
        <button class="icon-button" type="button" data-nfc-close aria-label="${L("បិទ", "Close")}">${Icons.close()}</button>
      </div>
      <div class="nfc-group">
        <div class="nfc-row nfc-master">
          <span class="nfc-copy"><strong>${L("ការជូនដំណឹងរបស់ Tool នេះ", "Notifications for this tool")}</strong><small>${L("Tool នៅដំណើរការ ទោះបិទ", "The tool keeps working when off")}</small></span>
          ${toggle(`data-nfc-tool-switch="${tool}"`, p.tools[tool], L(meta.km, meta.en))}
        </div>
      </div>
      <div class="nfc-detail ${p.tools[tool] ? "" : "is-disabled"}">${toolDetails(tool)}</div>
      <a class="nfc-go" href="${meta.href}" data-nfc-go>${L("បើក", "Open")} ${escapeHtml(L(meta.km, meta.en))} ${Icons.chevron()}</a>`;
  }

  function sheetHtml() {
    return view === "home" ? homeView() : toolView(view);
  }

  function open(tool = "") {
    view = tool && TOOL_META[tool] ? tool : "home";
    close(true);
    const node = document.createElement("div");
    node.className = "nfc-overlay";
    node.id = "notifyCenter";
    node.innerHTML = `<section class="nfc-sheet" role="dialog" aria-modal="true" aria-labelledby="nfcTitle"><span class="nfc-grip" aria-hidden="true"></span><div data-nfc-body>${sheetHtml()}</div></section>`;
    document.body.appendChild(node);
    document.body.classList.add("nfc-lock");
    requestAnimationFrame(() => node.classList.add("open"));
    node.addEventListener("click", event => { if (event.target === node) close(); });
    bindSheet(node);
    document.addEventListener("keydown", onEsc);
  }

  function onEsc(event) {
    if (event.key === "Escape") close();
  }

  function close(instant = false) {
    const node = document.getElementById("notifyCenter");
    document.removeEventListener("keydown", onEsc);
    document.body.classList.remove("nfc-lock");
    if (!node) return;
    if (instant) return node.remove();
    node.classList.remove("open");
    setTimeout(() => node.remove(), 220);
  }

  function refreshSheet() {
    const node = document.getElementById("notifyCenter");
    if (!node) return;
    const body = node.querySelector("[data-nfc-body]");
    const scroll = node.querySelector(".nfc-sheet").scrollTop;
    body.innerHTML = sheetHtml();
    node.querySelector(".nfc-sheet").scrollTop = scroll;
    bindSheet(node);
  }

  function bindControls(root) {
    root.querySelectorAll("[data-nfc-channel]").forEach(input => input.addEventListener("change", () => {
      save({ [input.dataset.nfcChannel]: input.checked });
    }));
    root.querySelectorAll("[data-nfc-tool-switch]").forEach(input => input.addEventListener("change", () => {
      save({ tools: { [input.dataset.nfcToolSwitch]: input.checked } });
    }));
  }

  function bindSheet(node) {
    bindControls(node);
    node.querySelectorAll("[data-nfc-close]").forEach(button => button.addEventListener("click", () => close()));
    node.querySelector("[data-nfc-back]")?.addEventListener("click", () => { view = "home"; refreshSheet(); });
    node.querySelectorAll("[data-nfc-tool]").forEach(button => button.addEventListener("click", () => { view = button.dataset.nfcTool; refreshSheet(); node.querySelector(".nfc-sheet").scrollTop = 0; }));
    node.querySelector("[data-nfc-go]")?.addEventListener("click", () => close());
    node.querySelector("[data-nfc-master]")?.addEventListener("change", event => {
      saveProfile({ notificationsEnabled: event.target.checked });
    });
    node.querySelectorAll("[data-nfc-stage]").forEach(input => input.addEventListener("change", () => {
      const stages = [...node.querySelectorAll("[data-nfc-stage]")].filter(item => item.checked).map(item => Number(item.dataset.nfcStage));
      save({ billStages: stages });
    }));
    node.querySelectorAll("[data-nfc-flag]").forEach(input => input.addEventListener("change", () => {
      saveProfile({ [input.dataset.nfcFlag]: input.checked });
    }));
    node.querySelectorAll("[data-nfc-time]").forEach(input => input.addEventListener("change", () => {
      if (!/^\d{2}:\d{2}$/.test(input.value)) return;
      saveProfile({ [input.dataset.nfcTime]: input.value });
    }));
  }

  // Today card (and anything else that renders [data-nfc-open] buttons)
  function bindPage(root = document) {
    bindControls(root.querySelector(".nfc-today") || document.createElement("div"));
    root.querySelectorAll("[data-nfc-open]").forEach(button => button.addEventListener("click", () => open(button.dataset.nfcOpen || "")));
  }

  window.addEventListener("hashchange", () => close());

  return { renderTodayCard, open, close, bindPage };
})();
