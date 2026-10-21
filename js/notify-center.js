/*
 * Notification center page (#notifications) — like iPhone Settings → Notifications.
 * - Allow notifications (master switch)
 * - Channels: Telegram / MYLIFE app
 * - Manage by tool: one row per tool with its own switch; tap the row to
 *   expand (collapse) its details — bill reminder days, budget alerts, reports…
 * Settings live in appData.profile.notify (rules in js/notify-prefs.js). The
 * older switches (budgetAlerts, morningDigest, per-bill reminder…) are reused,
 * not duplicated, and a tool switched off keeps working — only its alerts stop.
 */
const NotifyCenter = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  let openTool = "";

  const svg = paths => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    bell: () => Icons.bell(),
    telegram: () => svg('<path d="M21.5 3.5 2.8 10.7c-.9.4-.9 1.6 0 1.9l4.7 1.6 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.8 3.5c.7.5 1.7.1 1.9-.7l3-15.2c.2-1-.8-1.8-1.9-1.4Z"/><path d="m7.5 14.2 9.9-7.3-7.6 8.3"/>'),
    app: () => svg('<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/>'),
    bills: () => Icons.bill(),
    expenses: () => Icons.wallet(),
    loans: () => svg('<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>'),
    savings: () => svg('<path d="M19 9.5c.9.4 1.5 1.2 1.5 2.5v1.5h-1.6a6.6 6.6 0 0 1-2.4 3V20h-3v-2.3a8 8 0 0 1-3 0V20h-3v-3.4A6 6 0 0 1 4 12c0-3.6 3.4-6.5 7.5-6.5 1.4 0 2.7.3 3.8.9L17.5 5v3.2c.6.4 1.1.8 1.5 1.3Z"/><path d="M15 10.5h.01"/>'),
    calendar: () => Icons.calendar(),
    family: () => Icons.cake(),
    reports: () => Icons.chart(),
    backup: () => svg('<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5"/><path d="M12 12v8M9 15l3-3 3 3"/>'),
    chevron: () => svg('<path d="m6 9 6 6 6-6"/>'),
    arrow: () => svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    info: () => Icons.info()
  };

  const TOOL_META = {
    bills: { km: "វិក្កយបត្រ & ទឹកភ្លើង", en: "Bills & utilities", dkm: "ថ្ងៃផុតកំណត់, បង់ស្វ័យប្រវត្តិ, PPWSA / EDC", den: "Due dates, auto-pay, PPWSA / EDC", href: "#money/bills" },
    expenses: { km: "ចំណាយ & ថវិកា", en: "Expenses & budget", dkm: "ព្រមានថវិកា, ចាយមិនធម្មតា, សួរពេលយប់", den: "Budget alerts, unusual spending, evening check", href: "#money/expenses" },
    loans: { km: "ប្រាក់កម្ចី", en: "Loans", dkm: "រំលឹកថ្ងៃបង់ប្រាក់", den: "Payment-day reminders", href: "#money/loans" },
    savings: { km: "សន្សំ & គោលដៅ", en: "Savings & goals", dkm: "ដាក់សន្សំប្រចាំខែ, ថ្ងៃកំណត់គោលដៅ", den: "Monthly saving, goal deadlines", href: "#money/savings" },
    calendar: { km: "ប្រតិទិន & ការរំលឹក", en: "Calendar & reminders", dkm: "ព្រឹត្តិការណ៍ និងការរំលឹក", den: "Events and reminders", href: "#calendar" },
    family: { km: "គ្រួសារ", en: "Family", dkm: "ថ្ងៃកំណើត និងខួប", den: "Birthdays and anniversaries", href: "#family" },
    reports: { km: "របាយការណ៍", en: "Reports", dkm: "សង្ខេបព្រឹក, របាយការណ៍សប្តាហ៍ & ខែ", den: "Morning digest, weekly & monthly reports", href: "#money/reports" },
    backup: { km: "Backup", en: "Backup", dkm: "ឯកសារ JSON ទៅ Telegram រៀងរាល់សប្តាហ៍", den: "Weekly JSON file to Telegram", href: "#settings" }
  };

  const STAGE_LABEL = { 3: ["3 ថ្ងៃមុន", "3 days before"], 2: ["2 ថ្ងៃមុន", "2 days before"], 1: ["1 ថ្ងៃមុន", "1 day before"], 0: ["ថ្ងៃផុតកំណត់", "On the due date"] };
  // what "on the day" means for each tool that has dates
  const DAY_LABEL = {
    bills: ["ថ្ងៃផុតកំណត់", "On the due date"],
    loans: ["ថ្ងៃបង់ប្រាក់", "On the payment day"],
    savings: ["ថ្ងៃកំណត់", "On the deadline"],
    calendar: ["ថ្ងៃព្រឹត្តិការណ៍", "On the day"],
    family: ["ថ្ងៃនោះ", "On the day"]
  };
  const stageLabel = (tool, days) => L(...(days === 0 ? DAY_LABEL[tool] || STAGE_LABEL[0] : STAGE_LABEL[days]));
  const STAGE_NOTE = {
    bills: ["វិក្កយបត្រនីមួយៗ នៅតែអាចបិទការរំលឹកក្នុង form របស់វា។ ឈប់រំលឹកពេលបង់រួច។ Auto-pay នៅតែបង់ ហើយសារ PPWSA / EDC នៅតែត្រូវកត់។", "Each bill can still be muted in its own form. Reminders stop once it's paid. Auto-pay still pays, and PPWSA / EDC messages are always recorded."],
    loans: ["សម្រាប់ការបង់ប្រចាំខែនីមួយៗ ម៉ោង 9:00 AM។ ឈប់រំលឹកពេលកត់ការបង់ខែនោះរួច។", "For each monthly payment, at 9:00 AM. Stops once that month's payment is recorded."],
    savings: ["សម្រាប់ថ្ងៃកំណត់សន្សំ និងគោលដៅ។ ការដាក់សន្សំប្រចាំខែ រំលឹកនៅថ្ងៃទី 1។ គោលដៅនីមួយៗ នៅមានការរំលឹកក្នុង form របស់វា។", "For savings and goal deadlines. Monthly saving is reminded on the 1st. Each goal keeps its own reminder in its form."],
    calendar: ["បន្ថែមលើ “រំលឹកមុន” ក្នុង form ព្រឹត្តិការណ៍នីមួយៗ។", "Adds to each event's own “remind before” option."],
    family: ["សម្រាប់ថ្ងៃកំណើត និងខួប។ បន្ថែមលើ “រំលឹកមុន” ក្នុង form សមាជិក។", "For birthdays and anniversaries. Adds to each member's own “days before” option."]
  };

  const prefs = () => NotifyPrefs.prefs(appData.profile);
  const masterOn = () => appData.profile.notificationsEnabled !== false;

  // save, re-render the page, keep the scroll position
  function keep(work) {
    const y = window.scrollY;
    work();
    window.requestAnimationFrame(() => window.scrollTo(0, y));
  }
  function save(changes) {
    const current = prefs();
    keep(() => Store.updateProfile({ notify: { ...current, ...changes, tools: { ...current.tools, ...(changes.tools || {}) } } }));
  }
  const saveProfile = changes => keep(() => Store.updateProfile(changes));

  const toggle = (attrs, on, label) => `<label class="nfc-switch" aria-label="${escapeAttr(label)}"><input type="checkbox" ${attrs} ${on ? "checked" : ""}><span></span></label>`;
  const tile = (name, tone) => `<span class="nfc-tile nfc-tone-${tone}">${ICON[name]()}</span>`;
  const TONE = { bills: "amber", expenses: "rose", loans: "blue", savings: "green", calendar: "violet", family: "pink", reports: "teal", backup: "slate" };

  function summary() {
    const p = prefs();
    if (!masterOn()) return { text: L("ការជូនដំណឹងទាំងអស់បិទ", "All notifications are off"), tone: "off" };
    const onTools = NotifyPrefs.TOOLS.filter(tool => p.tools[tool]).length;
    const channels = [p.telegram ? "Telegram" : "", p.app ? "App" : ""].filter(Boolean).join(" + ") || L("គ្មានផ្លូវផ្ញើ", "No channel");
    return { text: `${channels} · ${onTools}/${NotifyPrefs.TOOLS.length} ${L("Tool បើក", "tools on")}`, tone: p.telegram || p.app ? "on" : "off" };
  }

  /* ---------- page ---------- */
  function renderPage() {
    const p = prefs();
    const off = !masterOn();
    const sum = summary();
    return `
      <section class="page nfc-page">
        <div class="page-header">
          <div>
            <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${ICON.bell()}</span>${L("ការជូនដំណឹង", "Notifications")}</h1>
            <p class="page-subtitle">${L("គ្រប់គ្រងការជូនដំណឹងរបស់ Tool នីមួយៗ ក្នុងកន្លែងតែមួយ", "Manage notifications for every MYLIFE tool in one place")}</p>
          </div>
        </div>

        <div class="nfc-stack">
          <div class="nfc-group">
            <div class="nfc-row nfc-master">
              ${tile("bell", off ? "slate" : "green")}
              <span class="nfc-copy"><strong>${L("អនុញ្ញាតការជូនដំណឹង", "Allow notifications")}</strong><small class="nfc-sum is-${sum.tone}">${escapeHtml(sum.text)}</small></span>
              ${toggle("data-nfc-master", !off, L("អនុញ្ញាតការជូនដំណឹង", "Allow notifications"))}
            </div>
          </div>

          <div>
            <h2 class="nfc-label">${L("ផ្លូវផ្ញើ", "Notification channels")}</h2>
            <div class="nfc-group ${off ? "is-disabled" : ""}">
              ${channelRow("telegram", p.telegram, "telegram", "blue", "Telegram", L("សារពី bot ក្នុងក្រុម", "Bot messages in your group"), off)}
              ${channelRow("app", p.app, "app", "violet", "MYLIFE App", L("Pop-up, bell, push លើទូរស័ព្ទ", "Pop-ups, bell, phone push"), off)}
            </div>
          </div>

          <div>
            <h2 class="nfc-label">${L("តាម Tool", "Manage by tool")}</h2>
            <p class="nfc-hint">${L("បើក/បិទ ហើយចុចលើ Tool ដើម្បីបើកការកំណត់លម្អិត", "Switch on/off, and tap a tool to open its details")}</p>
            <div class="nfc-group nfc-acc-list ${off ? "is-disabled" : ""}">
              ${NotifyPrefs.TOOLS.map(tool => toolItem(tool, p, off)).join("")}
            </div>
          </div>

          <p class="nfc-foot">${ICON.info()}<span>${L("បិទការជូនដំណឹង មិនបិទ Tool ទេ — ការកត់ទិន្នន័យ និង Telegram bot នៅដំណើរការធម្មតា។", "Turning notifications off never turns a tool off — recording data and the Telegram bot keep working.")}</span></p>
        </div>
      </section>`;
  }

  function channelRow(channel, on, icon, tone, title, sub, disabled) {
    return `<div class="nfc-row ${on && !disabled ? "" : "is-off"}">
      ${tile(icon, tone)}
      <span class="nfc-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></span>
      ${toggle(`data-nfc-channel="${channel}" ${disabled ? "disabled" : ""}`, on, title)}
    </div>`;
  }

  function toolItem(tool, p, off) {
    const meta = TOOL_META[tool];
    const open = openTool === tool;
    const on = p.tools[tool];
    return `<div class="nfc-acc ${open ? "is-open" : ""} ${on ? "" : "is-off"}" data-nfc-acc="${tool}">
      <div class="nfc-row nfc-acc-head">
        <button class="nfc-acc-toggle" type="button" data-nfc-expand="${tool}" aria-expanded="${open}" aria-controls="nfc-body-${tool}">
          ${tile(tool, TONE[tool])}
          <span class="nfc-copy"><strong>${escapeHtml(L(meta.km, meta.en))}</strong><small>${escapeHtml(toolSub(tool, p))}</small></span>
          <span class="nfc-caret">${ICON.chevron()}</span>
        </button>
        ${toggle(`data-nfc-tool-switch="${tool}" ${off ? "disabled" : ""}`, on, L(meta.km, meta.en))}
      </div>
      <div class="nfc-acc-body" id="nfc-body-${tool}" ${open ? "" : "hidden"}>
        <div class="nfc-acc-inner ${on && !off ? "" : "is-disabled"}">
          ${on && !off ? "" : `<p class="nfc-locked">${ICON.info()}<span>${off ? L("បើក “អនុញ្ញាតការជូនដំណឹង” ខាងលើ ដើម្បីកែការកំណត់នេះ", "Turn on “Allow notifications” above to change these settings") : L("បើក switch របស់ Tool នេះ ដើម្បីកែការកំណត់", "Turn this tool's switch on to change its settings")}</span></p>`}
          ${toolDetails(tool, p, off || !on)}
          <a class="nfc-go" href="${meta.href}">${L("បើក", "Open")} ${escapeHtml(L(meta.km, meta.en))} ${ICON.arrow()}</a>
        </div>
      </div>
    </div>`;
  }

  // the line under each tool: its description, or the current bill reminder days
  function toolSub(tool, p) {
    if (!p.tools[tool]) return L("បិទ — Tool នៅដំណើរការ", "Off — the tool still works");
    if (NotifyPrefs.STAGE_TOOLS.includes(tool)) return stageSummary(tool, p.stages[tool]);
    return L(TOOL_META[tool].dkm, TOOL_META[tool].den);
  }

  let lockedNow = false; // set while rendering a tool that is switched off (or everything off)
  function flagRow(key, title, sub, timeKey, timeDefault) {
    const p = appData.profile;
    const on = p[key] !== false;
    const lock = lockedNow ? "disabled" : "";
    return `<div class="nfc-row nfc-sub ${on ? "" : "is-off"}">
      <span class="nfc-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></span>
      ${timeKey ? `<input class="nfc-time" type="time" value="${escapeAttr(p[timeKey] || timeDefault)}" data-nfc-time="${timeKey}" ${on && !lockedNow ? "" : "disabled"} aria-label="${escapeAttr(title)}">` : ""}
      ${toggle(`data-nfc-flag="${key}" ${lock}`, on, title)}
    </div>`;
  }

  const note = text => `<p class="nfc-note">${ICON.info()}<span>${text}</span></p>`;

  // 3 / 2 / 1 days before + on the day — every tool whose items have a date
  function stagePicker(tool, p, locked) {
    const chosen = p.stages[tool] || [];
    const lock = locked ? "disabled" : "";
    const next = locked ? null : nextReminder(tool);
    return `
      <p class="nfc-sublabel">${L("រំលឹកខ្ញុំ", "Remind me")}</p>
      <div class="nfc-stages" data-nfc-stages="${tool}">
        ${NotifyPrefs.STAGES.map(days => `<label class="nfc-stage ${chosen.includes(days) ? "is-on" : ""}"><input type="checkbox" data-nfc-stage="${days}" ${chosen.includes(days) ? "checked" : ""} ${lock}><span>${escapeHtml(stageLabel(tool, days))}</span></label>`).join("")}
      </div>
      ${chosen.length ? "" : `<p class="nfc-warn">⚠️ ${L("គ្មានថ្ងៃណាត្រូវបានជ្រើស — Tool នេះនឹងមិនរំលឹកតាមថ្ងៃទេ", "No day chosen — this tool won't send date reminders")}</p>`}
      ${next ? `<p class="nfc-next">🔔 <span>${L("បន្ទាប់", "Next")}: <b>${escapeHtml(next.title)}</b> · ${escapeHtml(next.when)}</span></p>` : ""}
      ${locked ? "" : `<button class="nfc-test" type="button" data-nfc-test="${tool}">${ICON.telegram()}<span>${L("ផ្ញើសារសាកល្បងទៅ Telegram", "Send a test to Telegram")}</span></button>`}`;
  }

  /* ---------- next reminder + test message ---------- */
  const dayFmt = iso => {
    try { return parseAppDate(iso).toLocaleDateString(km() ? "km-KH" : "en-US", { weekday: "short", day: "numeric", month: "short" }); }
    catch (error) { return iso; }
  };

  // this tool's alerts (the same list the App uses, any channel), soonest first
  function upcoming(tool) {
    if (typeof App === "undefined" || typeof App.collectDueAlertItems !== "function") return [];
    const now = new Date();
    return App.collectDueAlertItems({ anyChannel: true })
      .filter(item => NotifyPrefs.toolOf(item.kind) === tool && item.kind !== "savings-contribution")
      .map(item => ({ item, at: App.alertDateTime(item) }))
      .filter(entry => entry.at && entry.at >= now)
      .sort((a, b) => a.at - b.at);
  }

  // birthdays/anniversaries in the App list are "Birthday: Mom" → "Mom"
  const cleanTitle = item => (["birthday", "anniversary"].includes(item.kind) ? String(item.title || "").replace(/^[^:]{1,20}:\s*/, "") : String(item.title || ""));

  function nextReminder(tool) {
    const first = upcoming(tool)[0];
    if (!first) return null;
    const { item } = first;
    const days = item.early ? Math.round(item.early / 1440) : 0;
    const title = cleanTitle(item);
    return { title, when: `${dayFmt(item.date)}${days ? ` (${stageLabel(tool, days)})` : ""}` };
  }

  const SAMPLE = {
    bills: { kind: "bill", title: "EDC", body: "ត្រូវបង់ · Due: 150,000៛" },
    loans: { kind: "loan", title: "Car loan", body: "ត្រូវបង់ប្រចាំខែ · Monthly payment: $250" },
    savings: { kind: "savings-deadline", title: "Trip fund", body: "" },
    calendar: { kind: "calendar", title: "Dinner", body: "" },
    family: { kind: "birthday", title: "Mom", body: "" }
  };

  // a real upcoming item of this tool (or a sample), shown the way Telegram will show it
  function testPayload(tool) {
    const stages = prefs().stages[tool] || [0];
    const early = Math.max(0, ...stages) * 1440;
    const real = upcoming(tool).map(entry => entry.item).find(item => !item.early) || upcoming(tool)[0]?.item;
    if (real) {
      const date = real.dueDate || real.date;
      return { kind: real.kind, title: cleanTitle(real), body: real.body || "", date, time: real.time || "09:00", hasTime: !!real.time && real.time !== "09:00", early };
    }
    const sample = SAMPLE[tool];
    const date = localDateInput(new Date(Date.now() + 3 * 864e5));
    return { ...sample, title: `${sample.title} (${L("ឧទាហរណ៍", "sample")})`, date, time: "09:00", hasTime: false, early };
  }

  async function sendTest(button) {
    const tool = button.dataset.nfcTest;
    const label = button.innerHTML;
    button.disabled = true;
    button.querySelector("span").textContent = L("កំពុងផ្ញើ…", "Sending…");
    try {
      const token = typeof ReportTelegram !== "undefined" ? await ReportTelegram.accessToken() : "";
      if (!token) throw new Error("not_signed_in");
      const response = await fetch("/api/report-send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ test: testPayload(tool) })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || `send_${response.status}`);
      Toast.show(L("🧪 បានផ្ញើសារសាកល្បងទៅ Telegram", "🧪 Test sent to Telegram"), "success", { sound: "notify" });
    } catch (error) {
      const message = error.message === "not_signed_in"
        ? L("សូម login សិន ដើម្បីផ្ញើទៅ Telegram", "Sign in first to send to Telegram")
        : error.message === "wait"
          ? L("ទើបផ្ញើរួច សូមរង់ចាំ 10 វិនាទី", "Just sent — wait 10 seconds")
          : L("ផ្ញើមិនបាន សូមសាកម្ដងទៀត", "Couldn't send, try again");
      Toast.show(message, "warning");
    } finally {
      button.disabled = false;
      button.innerHTML = label;
    }
  }

  function toolDetails(tool, p, locked = false) {
    lockedNow = locked;
    if (NotifyPrefs.STAGE_TOOLS.includes(tool)) {
      return `${stagePicker(tool, p, locked)}${note(L(...STAGE_NOTE[tool]))}`;
    }
    if (tool === "expenses") {
      return `<div class="nfc-subgroup">
        ${flagRow("budgetAlerts", L("ព្រមានថវិកា", "Budget alerts"), L("ពេលចាយដល់ 80% និង 100%", "At 80% and 100% of a budget"))}
        ${flagRow("unusualAlert", L("ចាយមិនធម្មតា", "Unusual spending"), L("ពេលថ្ងៃនេះចាយច្រើនជាងធម្មតា", "When today is much higher than usual"))}
        ${flagRow("eveningCheck", L("សួរពេលយប់", "Evening check"), L("“មានចាយអ្វីទៀតទេ?”", "“Anything else spent today?”"), "eveningCheckTime", "21:00")}
      </div>`;
    }
    if (tool === "reports") {
      return `<div class="nfc-subgroup">
        ${flagRow("morningDigest", L("សង្ខេបពេលព្រឹក", "Morning digest"), L("កាលវិភាគថ្ងៃនេះ", "Today's plan"), "digestTime", "07:00")}
        ${flagRow("weeklyReport", L("របាយការណ៍សប្តាហ៍", "Weekly report"), L("សង្ខេបលុយ 7 ថ្ងៃ", "7-day money summary"), "weeklyReportTime", "19:00")}
        ${flagRow("weeklyImage", L("រូបរបាយការណ៍សប្តាហ៍", "Weekly picture"), L("រូបភាពរបាយការណ៍", "Report image"))}
        ${flagRow("monthlyImage", L("រូបរបាយការណ៍ខែ", "Monthly picture"), L("ថ្ងៃទី 1 នៃខែ", "On the 1st of the month"))}
        ${flagRow("reportAutoSend", L("របាយការណ៍ខែ (JPG + Excel)", "Monthly report (JPG + Excel)"), L("ផ្ញើដោយស្វ័យប្រវត្តិ", "Sent automatically"))}
      </div>`;
    }
    if (tool === "backup") {
      return `<div class="nfc-subgroup">${flagRow("telegramBackup", L("Backup ទៅ Telegram", "Backup to Telegram"), L("ឯកសារ JSON រៀងរាល់សប្តាហ៍", "Weekly JSON file"))}</div>
        ${note(L("Backup ក្នុង Cloud នៅរក្សាទុកជានិច្ច។", "Cloud backups are always kept."))}`;
    }
    return "";
  }

  function stageSummary(tool, stages) {
    if (!stages || !stages.length) return L("គ្មានការរំលឹកតាមថ្ងៃ", "No day reminders");
    return L("រំលឹក៖ ", "Remind: ") + stages.map(days => stageLabel(tool, days)).join(" · ");
  }

  /* ---------- binding ---------- */
  function bindPage() {
    const page = document.querySelector(".nfc-page");
    if (!page) return;
    page.querySelector("[data-nfc-master]")?.addEventListener("change", event => saveProfile({ notificationsEnabled: event.target.checked }));
    page.querySelectorAll("[data-nfc-channel]").forEach(input => input.addEventListener("change", () => save({ [input.dataset.nfcChannel]: input.checked })));
    page.querySelectorAll("[data-nfc-tool-switch]").forEach(input => input.addEventListener("change", () => save({ tools: { [input.dataset.nfcToolSwitch]: input.checked } })));
    page.querySelectorAll("[data-nfc-expand]").forEach(button => button.addEventListener("click", () => {
      const tool = button.dataset.nfcExpand;
      openTool = openTool === tool ? "" : tool;
      // open/close in place (no re-render) so it animates and keeps focus
      page.querySelectorAll("[data-nfc-acc]").forEach(item => {
        const isOpen = item.dataset.nfcAcc === openTool;
        item.classList.toggle("is-open", isOpen);
        item.querySelector("[data-nfc-expand]").setAttribute("aria-expanded", String(isOpen));
        item.querySelector(".nfc-acc-body").hidden = !isOpen;
      });
      if (typeof Sound !== "undefined") Sound.play(openTool ? "open" : "close");
    }));
    page.querySelectorAll("[data-nfc-stages]").forEach(group => group.querySelectorAll("[data-nfc-stage]").forEach(input => input.addEventListener("change", () => {
      const tool = group.dataset.nfcStages;
      const chosen = [...group.querySelectorAll("[data-nfc-stage]")].filter(item => item.checked).map(item => Number(item.dataset.nfcStage));
      const stages = { ...prefs().stages, [tool]: chosen };
      // billStages kept in step for older copies of the app / server
      save({ stages, billStages: stages.bills });
    })));
    page.querySelectorAll("[data-nfc-test]").forEach(button => button.addEventListener("click", () => sendTest(button)));
    page.querySelectorAll("[data-nfc-flag]").forEach(input => input.addEventListener("change", () => saveProfile({ [input.dataset.nfcFlag]: input.checked })));
    page.querySelectorAll("[data-nfc-time]").forEach(input => input.addEventListener("change", () => {
      if (/^\d{2}:\d{2}$/.test(input.value)) saveProfile({ [input.dataset.nfcTime]: input.value });
    }));
  }

  // from Settings, the bell panel, etc.: go to the page (optionally with a tool open)
  function open(tool = "") {
    openTool = TOOL_META[tool] ? tool : openTool;
    if (location.hash === "#notifications") App.render();
    else location.hash = "#notifications";
  }

  return { renderPage, bindPage, open };
})();
