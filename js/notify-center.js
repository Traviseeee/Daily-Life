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
    bills: { km: "វិក្កយបត្រ & ទឹកភ្លើង", en: "Bills & utilities", dkm: "ថ្ងៃផុតកំណត់ ការបង់ស្វ័យប្រវត្តិ PPWSA / EDC", den: "Due dates, auto-pay, PPWSA / EDC", href: "#money/bills" },
    expenses: { km: "ចំណាយ & ថវិកា", en: "Expenses & budget", dkm: "ព្រមានថវិកា ចាយច្រើនខុសធម្មតា សួរពេលយប់", den: "Budget alerts, unusual spending, evening check", href: "#money/expenses" },
    loans: { km: "ប្រាក់កម្ចី", en: "Loans", dkm: "រំលឹកថ្ងៃបង់ប្រាក់", den: "Payment-day reminders", href: "#money/loans" },
    savings: { km: "សន្សំ & គោលដៅ", en: "Savings & goals", dkm: "ដាក់សន្សំប្រចាំខែ, ថ្ងៃកំណត់គោលដៅ", den: "Monthly saving, goal deadlines", href: "#money/savings" },
    calendar: { km: "ប្រតិទិន & ការរំលឹក", en: "Calendar & reminders", dkm: "ព្រឹត្តិការណ៍ និងការរំលឹក", den: "Events and reminders", href: "#calendar" },
    family: { km: "គ្រួសារ", en: "Family", dkm: "ថ្ងៃកំណើត និងខួប", den: "Birthdays and anniversaries", href: "#family" },
    reports: { km: "របាយការណ៍", en: "Reports", dkm: "សង្ខេបព្រឹក, របាយការណ៍សប្តាហ៍ & ខែ", den: "Morning digest, weekly & monthly reports", href: "#money/reports" },
    backup: { km: "Backup", en: "Backup", dkm: "ផ្ញើឯកសារបម្រុងទុកទៅ Telegram រៀងរាល់សប្តាហ៍", den: "Weekly JSON file to Telegram", href: "#settings" }
  };

  const STAGE_LABEL = { 3: ["3 ថ្ងៃមុន", "3 days before"], 2: ["2 ថ្ងៃមុន", "2 days before"], 1: ["1 ថ្ងៃមុន", "1 day before"], 0: ["ថ្ងៃផុតកំណត់", "On the due date"] };
  // what "on the day" means for each tool that has dates
  const DAY_LABEL = {
    bills: ["ថ្ងៃផុតកំណត់", "On the due date"],
    loans: ["ថ្ងៃបង់ប្រាក់", "On the payment day"],
    savings: ["ថ្ងៃកំណត់", "On the deadline"],
    calendar: ["ថ្ងៃព្រឹត្តិការណ៍", "On the day"],
    family: ["ថ្ងៃនោះផ្ទាល់", "On the day"]
  };
  const stageLabel = (tool, days) => L(...(days === 0 ? DAY_LABEL[tool] || STAGE_LABEL[0] : STAGE_LABEL[days]));
  const STAGE_NOTE = {
    bills: ["អាចបិទការរំលឹកវិក្កយបត្រណាមួយ ពេលកែវិក្កយបត្រនោះ។ បង់រួច វាឈប់រំលឹកដោយខ្លួនឯង។ ការបង់ស្វ័យប្រវត្តិ និងសារពី PPWSA / EDC នៅដំណើរការដដែល។", "Each bill can still be muted in its own form. Reminders stop once it's paid. Auto-pay still pays, and PPWSA / EDC messages are always recorded."],
    loans: ["រំលឹកម៉ោង 9 ព្រឹក សម្រាប់ការបង់ប្រចាំខែ។ ពេលកត់ថាបង់រួច វាឈប់រំលឹកខែនោះ។", "For each monthly payment, at 9:00 AM. Stops once that month's payment is recorded."],
    savings: ["សម្រាប់ថ្ងៃកំណត់នៃការសន្សំ និងគោលដៅ។ ការដាក់សន្សំប្រចាំខែ រំលឹកនៅថ្ងៃបើកប្រាក់ខែ (ឬថ្ងៃទី 1 បើគ្មានប្រាក់ខែ)។ គោលដៅនីមួយៗ អាចកំណត់ការរំលឹកបន្ថែមបានទៀត។", "For savings and goal deadlines. Monthly saving is reminded on salary day (or the 1st with no salary). Each goal keeps its own reminder in its form."],
    calendar: ["ប្រើរួមជាមួយ “រំលឹកមុន” ដែលអ្នកកំណត់ក្នុងព្រឹត្តិការណ៍នីមួយៗ។", "Adds to each event's own “remind before” option."],
    family: ["សម្រាប់ថ្ងៃកំណើត និងខួប។ ប្រើរួមជាមួយ “រំលឹកមុន” ដែលកំណត់ក្នុងព័ត៌មានសមាជិកនីមួយៗ។", "For birthdays and anniversaries. Adds to each member's own “days before” option."]
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
    const channels = [p.telegram ? "Telegram" : "", p.app ? "App" : ""].filter(Boolean).join(" + ") || L("មិនទាន់ជ្រើសកន្លែងផ្ញើ", "No channel");
    return { text: `${channels} · ${onTools}/${NotifyPrefs.TOOLS.length} ${L("បើក", "tools on")}`, tone: p.telegram || p.app ? "on" : "off" };
  }

  /* ---------- page ---------- */
  // tabs keep the page short: money tools · dated things · reports & backup
  const TABS = [
    { id: "money", km: "ហិរញ្ញវត្ថុ", en: "Money", tools: ["bills", "expenses", "loans", "savings"] },
    { id: "days", km: "ថ្ងៃសំខាន់", en: "Dates", tools: ["calendar", "family"] },
    { id: "reports", km: "របាយការណ៍", en: "Reports", tools: ["reports", "backup"] }
  ];
  let tab = "money";
  const tabOf = tool => (TABS.find(entry => entry.tools.includes(tool)) || TABS[0]).id;

  // next 7 days of alerts across every tool (+ salary days), soonest first
  function nextAlerts(limit = 4) {
    const now = new Date();
    const until = new Date(now.getTime() + 7 * 86400000);
    const list = [];
    if (typeof App !== "undefined" && typeof App.collectDueAlertItems === "function") {
      App.collectDueAlertItems({ anyChannel: true }).forEach(item => {
        const at = App.alertDateTime(item);
        const tool = NotifyPrefs.toolOf(item.kind);
        if (!at || at < now || at > until || item.early || (tool && !prefs().tools[tool])) return;
        list.push({ at, tool: tool || "calendar", title: cleanTitle(item), time: item.time || "09:00" });
      });
    }
    if (typeof MoneyDue !== "undefined" && appData.profile.moneyAsk !== false) {
      for (let i = 0; i <= 7; i += 1) {
        const d = new Date(`${localDateInput()}T00:00:00`);
        d.setDate(d.getDate() + i);
        const day = localDateInput(d);
        MoneyDue.dueToday(appData, day).filter(item => item.kind === "income" && item.date === day).forEach(item => {
          const at = new Date(`${day}T09:00:00`);
          if (at >= now) list.push({ at, tool: "income", title: item.title, time: "09:00" });
        });
      }
    }
    const seen = new Set();
    return list.sort((a, b) => a.at - b.at).filter(entry => { const key = `${entry.title}|${entry.at.toDateString()}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, limit);
  }

  function whenLabel(at, time) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(at); day.setHours(0, 0, 0, 0);
    const diff = Math.round((day - today) / 86400000);
    const label = diff === 0 ? L("ថ្ងៃនេះ", "Today") : diff === 1 ? L("ស្អែក", "Tomorrow") : formatDate(localDateInput(at), { month: "short", day: "numeric" });
    return { text: `${label} · ${time}`, soon: diff <= 1 };
  }

  function renderPage() {
    const p = prefs();
    const off = !masterOn();
    const sum = summary();
    const next = off ? [] : nextAlerts();
    const via = `${p.telegram ? `<i title="Telegram">${ICON.telegram()}</i>` : ""}${p.app ? `<i title="App">${ICON.app()}</i>` : ""}`;
    const toolIcon = tool => (tool === "income" ? Icons.salary() : ICON[tool] ? ICON[tool]() : Icons.bell());
    const toolTone = tool => (tool === "income" ? "green" : TONE[tool] || "slate");
    const current = TABS.find(entry => entry.id === tab) || TABS[0];
    const onCount = entry => entry.tools.filter(tool => p.tools[tool]).length;
    return `
      <section class="page nfc-page">
        <div class="page-header">
          <div>
            <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${ICON.bell()}</span>${L("ការជូនដំណឹង", "Notifications")}</h1>
          </div>
        </div>

        <div class="nfc-stack">
          <div class="nfc-group nfc-top">
            <div class="nfc-row nfc-master">
              ${tile("bell", off ? "slate" : "green")}
              <span class="nfc-copy"><strong>${L("ការជូនដំណឹង", "Notifications")}</strong><small class="nfc-sum is-${sum.tone}">${escapeHtml(sum.text)}</small></span>
              ${toggle("data-nfc-master", !off, L("អនុញ្ញាតការជូនដំណឹង", "Allow notifications"))}
            </div>
            <div class="nfc-chips ${off ? "is-disabled" : ""}">
              ${[["telegram", "Telegram"], ["app", "App"]].map(([channel, label]) => `<label class="nfc-chip ${p[channel] && !off ? "is-on" : ""}"><input type="checkbox" data-nfc-channel="${channel}" ${p[channel] ? "checked" : ""} ${off ? "disabled" : ""}>${ICON[channel]()}<span>${label}</span></label>`).join("")}
            </div>
          </div>

          ${off ? "" : `<div class="nfc-group nfc-next-card">
            <div class="nfc-next-head"><b>${L("ការរំលឹកបន្ទាប់", "Coming up")}</b><span>${L("7 ថ្ងៃខាងមុខ", "Next 7 days")}</span></div>
            ${next.length ? next.map(entry => { const w = whenLabel(entry.at, entry.time); return `<div class="nfc-next-row">
              <span class="nfc-tile nfc-tone-${toolTone(entry.tool)} nfc-tile-sm">${toolIcon(entry.tool)}</span>
              <span class="nfc-copy"><strong>${escapeHtml(entry.title)}</strong><small class="${w.soon ? "is-soon" : ""}">${escapeHtml(w.text)}</small></span>
              <span class="nfc-via">${via}</span>
            </div>`; }).join("") : `<p class="nfc-next-empty">${L("7 ថ្ងៃខាងមុខ គ្មានការរំលឹក", "Nothing in the next 7 days")}</p>`}
          </div>`}

          <div class="nfc-tabs" role="tablist">
            ${TABS.map(entry => `<button type="button" role="tab" class="nfc-tab ${entry.id === current.id ? "is-on" : ""}" data-nfc-tab="${entry.id}" aria-selected="${entry.id === current.id}">${L(entry.km, entry.en)}${onCount(entry) < entry.tools.length ? ` <em>${onCount(entry)}/${entry.tools.length}</em>` : ""}</button>`).join("")}
          </div>

          ${current.id === "money" ? moneyAskGroup(off) : ""}

          <div>
            ${current.id === "money" ? `<h2 class="nfc-label">${L("មុខងារ", "Tools")}</h2>` : ""}
            <div class="nfc-group nfc-acc-list ${off ? "is-disabled" : ""}">
              ${current.tools.map(tool => toolItem(tool, p, off)).join("")}
            </div>
          </div>

          <p class="nfc-foot">${ICON.info()}<span>${L("បិទការរំលឹក មិនបិទមុខងារទេ — កត់ទិន្នន័យ និង bot នៅប្រើបាន។", "Turning alerts off never turns a tool off.")}</span></p>
        </div>
      </section>`;
  }

  // "did you get / pay it?" (js/money-ask.js): one switch, what waits today, then every
  // salary / loan / bill as one short row: icon · name + amount · day · state pill · switch
  function moneyAskGroup(off) {
    if (typeof MoneyDue === "undefined") return "";
    const on = appData.profile.moneyAsk !== false;
    const locked = off || !on;
    const today = localDateInput();
    const month = today.slice(0, 7);
    const plain = (value, currency) => { try { return formatPlainMoney(Number(value), currency || appData.profile.currency || "USD"); } catch (error) { return String(value); } };
    const short = date => formatDate(date, { month: "short", day: "numeric" });
    const later = typeof MoneyAsk !== "undefined" ? new Set(MoneyAsk.laterKeys()) : new Set();
    const waiting = MoneyDue.dueToday(appData, today);
    const waitingKeys = new Set(waiting.map(item => `${item.kind}:${item.id}`));
    const nextMonth = (() => { const d = new Date(`${month}-01T00:00:00`); d.setMonth(d.getMonth() + 1); return localDateInput(d).slice(0, 7); })();
    const pill = (tone, text) => `<span class="nfc-ma-pill is-${tone}">${text}</span>`;
    const dayEvery = day => L(`ថ្ងៃ ${day} រាល់ខែ`, `Day ${day} monthly`);

    const row = ({ kind, id, icon, tone, name, amount, currency, meta, status, switchOn, switchable, warn }) => `
      <div class="nfc-row nfc-sub nfc-ma-item ${switchable && !switchOn ? "is-off" : ""}">
        <span class="nfc-ma-icon is-${tone}">${icon}</span>
        <button type="button" class="nfc-ma-open" data-nfc-ma-edit="${kind}:${escapeAttr(id)}">
          <strong>${escapeHtml(name)}</strong>
          <small>${amount > 0 ? `<b>${escapeHtml(plain(amount, currency))}</b> · ` : ""}${meta}</small>
        </button>
        ${warn ? `<button type="button" class="nfc-ma-pill is-fix" data-nfc-ma-edit="${kind}:${escapeAttr(id)}">${escapeHtml(L("កំណត់ថ្ងៃ", "Set day"))}</button>` : status}
        ${switchable ? toggle(`data-nfc-ma-item="${kind}:${escapeAttr(id)}" ${locked ? "disabled" : ""}`, switchOn, name) : ""}
      </div>`;

    const waitPill = key => (later.has(key) ? pill("later", `${Icons.bell()}${L("ស្អែក", "Tmrw")}`) : pill("wait", `<i class="nfc-ma-dot"></i>${L("រង់ចាំ", "Waiting")}`));

    const incomes = (appData.income || []).map(income => {
      const date = MoneyDue.incomeDateInMonth(income, month);
      const got = MoneyDue.incomeReceived(income, month);
      const freq = income.frequency || "Monthly";
      const day = Number(/^\d{4}-\d{2}-(\d{2})/.exec(String(income.nextPaymentDate || ""))?.[1] || 0);
      const meta = !income.nextPaymentDate ? `<span class="nfc-ma-warn">${L("គ្មានថ្ងៃ", "No day")}</span>` : freq === "Monthly" ? dayEvery(day) : freq === "Weekly" ? L("ប្រចាំសប្តាហ៍", "Weekly") : short(income.nextPaymentDate);
      let status = "";
      if (got) status = pill("ok", `${Icons.check()}${L("បានទទួល", "Got it")}`);
      else if (date && waitingKeys.has(`income:${income.id}`)) status = waitPill(`income:${income.id}:${month}`);
      else if (date && date > today) status = pill("soon", short(date));
      else if (income.nextPaymentDate) { const nd = MoneyDue.incomeDateInMonth(income, nextMonth); if (nd) status = pill("soon", short(nd)); }
      return row({ kind: "income", id: income.id, icon: Icons.salary(), tone: "income", name: income.name || L("ចំណូល", "Income"), amount: Number(income.amount || 0), currency: income.currency, meta, status, switchOn: income.ask !== false, switchable: true, warn: !income.nextPaymentDate });
    });

    const loans = (appData.loans || []).map(loan => {
      const first = loan.firstPaymentDate || loan.startDate;
      const date = first && typeof LoanPay !== "undefined" ? LoanPay.scheduleDateFor(loan, today) : "";
      const day = Number(loan.paymentDay || 0) || Number(/^\d{4}-\d{2}-(\d{2})/.exec(String(first || ""))?.[1] || 0);
      const finished = loan.dueDate && loan.dueDate < `${month}-01`;
      const paid = date && (loan.payments || []).some(payment => payment.date === date);
      const linked = (appData.bills || []).some(bill => bill.loanId === loan.id);
      const meta = !first ? `<span class="nfc-ma-warn">${L("គ្មានថ្ងៃ", "No day")}</span>` : finished ? L("បង់អស់ហើយ", "Finished") : `${dayEvery(day)}${linked ? ` · ${L("ភ្ជាប់វិក្កយបត្រ", "linked bill")}` : ""}`;
      let status = "";
      if (first && !finished) {
        if (paid) status = pill("ok", `${Icons.check()}${L("បានបង់", "Paid")}`);
        else if (waitingKeys.has(`loan:${loan.id}`)) status = waitPill(`loan:${loan.id}:${date}`);
        else if (date && date > today) status = pill("soon", short(date));
      }
      return row({ kind: "loan", id: loan.id, icon: Icons.loan(), tone: "loan", name: loan.name || L("កម្ចី", "Loan"), amount: Number(loan.monthlyPayment || 0), currency: loan.currency, meta, status, switchOn: loan.ask !== false, switchable: true, warn: !first });
    });

    const bills = (appData.bills || []).slice().sort((a, b) => String(a.due || "9").localeCompare(String(b.due || "9"))).map(bill => {
      const paid = MoneyDue.billPaidThisCycle(bill, today);
      const meta = !bill.due ? `<span class="nfc-ma-warn">${L("គ្មានថ្ងៃ", "No day")}</span>` : `${optionLabel(bill.frequency || "Monthly")}${bill.autoPay ? ` · ${L("ស្វ័យប្រវត្តិ", "Auto")}` : ""}${bill.loanId ? ` · ${L("ភ្ជាប់កម្ចី", "linked loan")}` : ""}`;
      let status = "";
      if (paid && bill.lastPaidAt) status = pill("ok", `${Icons.check()}${L("បានបង់", "Paid")}`);
      else if (waitingKeys.has(`bill:${bill.id}`)) status = waitPill(`bill:${bill.id}:${bill.due}`);
      else if (bill.due && bill.due > today) status = pill("soon", short(bill.due));
      return row({ kind: "bill", id: bill.id, icon: Icons.bill(), tone: "bill", name: bill.name || L("វិក្កយបត្រ", "Bill"), amount: Number(bill.amount || 0), currency: bill.currency, meta, status, switchOn: bill.reminder !== false, switchable: !bill.autoPay, warn: !bill.due });
    });

    const all = [...incomes, ...loans, ...bills];
    return `<div>
      <h2 class="nfc-label">${L("សួរលុយចូល · លុយចេញ", "Money check-in")}</h2>
      <div class="nfc-group nfc-ma-group ${off ? "is-disabled" : ""}">
        <div class="nfc-row ${on && !off ? "" : "is-off"}">
          <span class="nfc-ma-icon nfc-ma-main">${Icons.wallet()}</span>
          <span class="nfc-copy"><strong>${L("សួរពេលដល់ថ្ងៃ", "Ask on the day")}</strong><small>${L("App + Telegram", "App + Telegram")}</small></span>
          ${waiting.length ? `<button type="button" class="nfc-ma-now" data-nfc-ask-now ${locked ? "disabled" : ""}>${L("សួរឥឡូវ", "Ask now")} <b>${waiting.length}</b></button>` : ""}
          ${toggle(`data-nfc-money-ask ${off ? "disabled" : ""}`, on && !off, L("សួរពេលដល់ថ្ងៃ", "Ask on the day"))}
        </div>
        ${all.length ? all.join("") : `<div class="nfc-row nfc-sub"><span class="nfc-copy"><small>${L("មិនទាន់មានប្រាក់ខែ កម្ចី ឬវិក្កយបត្រ", "No salary, loans or bills yet")}</small></span></div>`}
      </div>
    </div>`;
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
          ${on && !off ? "" : `<p class="nfc-locked">${ICON.info()}<span>${off ? L("សូមបើក “អនុញ្ញាតការជូនដំណឹង” ខាងលើសិន ទើបកែបាន", "Turn on “Allow notifications” above to change these settings") : L("សូមបើកប៊ូតុងខាងស្តាំសិន ទើបកែបាន", "Turn this tool's switch on to change its settings")}</span></p>`}
          ${toolDetails(tool, p, off || !on)}
          <a class="nfc-go" href="${meta.href}">${L("បើក", "Open")} ${escapeHtml(L(meta.km, meta.en))} ${ICON.arrow()}</a>
        </div>
      </div>
    </div>`;
  }

  // the line under each tool: its description, or the current bill reminder days
  function toolSub(tool, p) {
    if (!p.tools[tool]) return L("បិទការរំលឹក (នៅប្រើបានធម្មតា)", "Off — the tool still works");
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
      <p class="nfc-sublabel">${L("រំលឹកនៅ", "Remind me")}</p>
      <div class="nfc-stages" data-nfc-stages="${tool}">
        ${NotifyPrefs.STAGES.map(days => `<label class="nfc-stage ${chosen.includes(days) ? "is-on" : ""}"><input type="checkbox" data-nfc-stage="${days}" ${chosen.includes(days) ? "checked" : ""} ${lock}><span>${escapeHtml(stageLabel(tool, days))}</span></label>`).join("")}
      </div>
      ${chosen.length ? "" : `<p class="nfc-warn">⚠️ ${L("មិនទាន់ជ្រើសថ្ងៃណាទេ — ដូច្នេះនឹងមិនមានការរំលឹកទេ", "No day chosen — this tool won't send date reminders")}</p>`}
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
        ${flagRow("budgetAlerts", L("ព្រមានថវិកា", "Budget alerts"), L("ពេលចាយដល់ 80% និង 100% នៃថវិកា", "At 80% and 100% of a budget"))}
        ${flagRow("unusualAlert", L("ចាយច្រើនខុសធម្មតា", "Unusual spending"), L("ពេលថ្ងៃនេះចាយច្រើនជាងរាល់ដង", "When today is much higher than usual"))}
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
      return `<div class="nfc-subgroup">${flagRow("telegramBackup", L("បម្រុងទុកទៅ Telegram", "Backup to Telegram"), L("រៀងរាល់សប្តាហ៍ (ឯកសារ JSON)", "Weekly JSON file"))}</div>
        ${note(L("ទិន្នន័យនៅតែបម្រុងទុកក្នុង Cloud ជានិច្ច។", "Cloud backups are always kept."))}`;
    }
    return "";
  }

  function stageSummary(tool, stages) {
    if (!stages || !stages.length) return L("មិនរំលឹកទេ", "No day reminders");
    return L("រំលឹក៖ ", "Remind: ") + stages.map(days => stageLabel(tool, days)).join(" · ");
  }

  /* ---------- binding ---------- */
  function bindPage() {
    const page = document.querySelector(".nfc-page");
    if (!page) return;
    page.querySelector("[data-nfc-master]")?.addEventListener("change", event => {
      const on = event.target.checked;
      saveProfile({ notificationsEnabled: on });
      // same phone push setup the old Settings switch did (it now lives only here)
      try {
        const plugin = typeof NotificationManager !== "undefined" && NotificationManager.getPlugin?.();
        if (on) {
          if (plugin) NotificationManager.requestPermission().then(() => NotificationManager.sync());
          else window.PushNotifications?.enable?.();
        } else if (!plugin) {
          window.PushNotifications?.disable?.();
        }
      } catch (error) { console.warn("MYLIFE push setup failed.", error); }
    });
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
    page.querySelectorAll("[data-nfc-tab]").forEach(button => button.addEventListener("click", () => {
      if (tab === button.dataset.nfcTab) return;
      tab = button.dataset.nfcTab;
      if (typeof Sound !== "undefined") Sound.play("open");
      keep(() => App.render());
    }));
    page.querySelector("[data-nfc-money-ask]")?.addEventListener("change", event => saveProfile({ moneyAsk: event.target.checked }));
    page.querySelector("[data-nfc-ask-now]")?.addEventListener("click", () => { if (typeof MoneyAsk !== "undefined") MoneyAsk.askNow(); });
    // per item switch = the same switch as in its own form (income/loan "ask", bill "reminder")
    page.querySelectorAll("[data-nfc-ma-item]").forEach(input => input.addEventListener("change", () => {
      const [kind, id] = input.dataset.nfcMaItem.split(":");
      const collection = kind === "income" ? "income" : kind === "loan" ? "loans" : "bills";
      keep(() => Store.edit(collection, id, kind === "bill" ? { reminder: input.checked } : { ask: input.checked }));
    }));
    page.querySelectorAll("[data-nfc-ma-edit]").forEach(button => button.addEventListener("click", () => {
      const [kind, id] = button.dataset.nfcMaEdit.split(":");
      const collection = kind === "income" ? "income" : kind === "loan" ? "loans" : "bills";
      const record = (appData[collection] || []).find(item => item.id === id);
      if (!record) return;
      if (kind === "income" && typeof openIncomeModal === "function") openIncomeModal(record);
      else if (kind === "loan" && typeof openLoanModal === "function") openLoanModal(record);
      else if (kind === "bill" && typeof openBillModal === "function") openBillModal(record);
    }));
    page.querySelectorAll("[data-nfc-flag]").forEach(input => input.addEventListener("change", () => saveProfile({ [input.dataset.nfcFlag]: input.checked })));
    page.querySelectorAll("[data-nfc-time]").forEach(input => input.addEventListener("change", () => {
      if (/^\d{2}:\d{2}$/.test(input.value)) saveProfile({ [input.dataset.nfcTime]: input.value });
    }));
  }

  // from Settings, the bell panel, etc.: go to the page (optionally with a tool open)
  function open(tool = "") {
    openTool = TOOL_META[tool] ? tool : openTool;
    if (TOOL_META[tool]) tab = tabOf(tool);
    if (location.hash === "#notifications") App.render();
    else location.hash = "#notifications";
  }

  return { renderPage, bindPage, open };
})();
