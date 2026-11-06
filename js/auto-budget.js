/* MYLIFE Auto budget (6 Nov 2026)
 * "✨ Budget from my salary": real income this month (or the 3-month average)
 * − bills − loan payments − my monthly savings = money left to spend.
 * 90 % of it is split over the spending categories by the last 3 months' habit
 * (or a starter template), 10 % stays as a cushion. A preview sheet lets the user
 * edit every number; "Use this budget" writes profile.categoryBudgets (the same
 * field the manual inputs use). Budgets the user typed by hand are kept unless
 * they choose otherwise. When a new salary arrives in a later month Nomi offers
 * to work it out again. Nothing is deleted. */
const AutoBudget = (() => {
  const km = () => (typeof languageCode === "function" ? languageCode() : "en") === "km";
  const L = (k, e) => (km() ? k : e);
  const esc = value => (typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? ""));
  const conv = (value, currency) => (typeof toProfileCurrency === "function" ? toProfileCurrency(value, currency) : Number(value || 0));
  const fmt = value => String(typeof money === "function" ? money(value) : value).replace(/<[^>]*>/g, "");
  const monthKey = (offset = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const monthName = key => { const [y, m] = key.split("-").map(Number); return km() ? `ខែ${KM_MONTHS[m - 1]}` : new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" }); };

  const FIXED = ["Bills", "Loan"];
  const TEMPLATE = { Food: 0.35, Transport: 0.12, Home: 0.10, Family: 0.10, Shopping: 0.10, Entertainment: 0.08, Health: 0.05, Other: 0.10 };
  const RESERVE = 0.10;
  const cats = () => (typeof expenseCategories !== "undefined" ? expenseCategories : Object.keys(TEMPLATE)).filter(cat => !FIXED.includes(cat));
  const round = value => {
    const cur = appData.profile?.currency || "USD";
    const step = cur === "KHR" ? 1000 : 1;
    return Math.max(0, Math.round(value / step) * step);
  };

  /* ---------- the numbers ---------- */
  function incomeFor(month) {
    try { return typeof moneyMonthNumbers === "function" ? Number(moneyMonthNumbers(month).income || 0) : 0; } catch (error) { return 0; }
  }

  // monthly share of one bill (skip bills that belong to a loan: the loan counts them)
  function billMonthly(bill, month) {
    if (!bill || bill.loanId) return 0;
    const amount = conv(Number(bill.lastPaidAmount || bill.amount || 0), bill.currency);
    const freq = bill.frequency || "Monthly";
    if (freq === "Once") return String(bill.due || "").slice(0, 7) === month ? amount : 0;
    return amount * ({ Daily: 30, Weekly: 52 / 12, Monthly: 1, Quarterly: 1 / 3, Yearly: 1 / 12 }[freq] ?? 1);
  }

  function compute() {
    const month = monthKey();
    let income = incomeFor(month), incomeNote = L("ប្រាក់ចំណូលខែនេះ", "Income this month");
    if (!(income > 0)) {
      const past = [-1, -2, -3].map(offset => incomeFor(monthKey(offset))).filter(value => value > 0);
      income = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0;
      incomeNote = L(`មធ្យមភាគ ${past.length} ខែមុន`, `Average of the last ${past.length} months`);
    }
    // bills / loans: what was really paid this month, or the planned amount if it is more (not paid yet)
    const spentIn = cat => (appData.expenses || []).filter(item => item.category === cat && String(item.date || "").slice(0, 7) === month).reduce((sum, item) => sum + conv(item.amount, item.currency), 0);
    const bills = (appData.bills || []).filter(bill => billMonthly(bill, month) > 0);
    const billPlan = bills.reduce((sum, bill) => sum + billMonthly(bill, month), 0);
    const billTotal = Math.max(billPlan, spentIn("Bills"));
    const loans = (appData.loans || []).filter(loan => Number(loan.monthlyPayment || 0) > 0 && (typeof loanRemaining !== "function" || loanRemaining(loan) > 0));
    const loanPlan = loans.reduce((sum, loan) => sum + conv(loan.monthlyPayment, loan.currency), 0);
    const loanTotal = Math.max(loanPlan, spentIn("Loan"));
    const saves = (appData.savings || []).filter(item => Number(item.monthlyContribution || 0) > 0);
    const saveTotal = saves.reduce((sum, item) => sum + conv(item.monthlyContribution, item.currency), 0);
    const free = Math.max(0, income - billTotal - loanTotal - saveTotal);
    const spendable = free * (1 - RESERVE);

    // habit: the last 3 full months by category
    const hist = {}; let histTotal = 0; let histCount = 0;
    const from = monthKey(-3), to = monthKey(-1);
    (appData.expenses || []).forEach(item => {
      const m = String(item.date || "").slice(0, 7);
      if (m < from || m > to || FIXED.includes(item.category) || item.loanId || item.billId) return;
      const value = conv(item.amount, item.currency);
      const cat = cats().includes(item.category) ? item.category : "Other";
      hist[cat] = (hist[cat] || 0) + value; histTotal += value; histCount += 1;
    });
    const months = new Set((appData.expenses || []).map(item => String(item.date || "").slice(0, 7)).filter(m => m >= from && m <= to)).size || 1;
    const hasHabit = histCount >= 10 && histTotal > 0;
    return { month, income, incomeNote, bills: bills.length, billTotal, loans: loans.length, loanTotal, saves: saves.length, saveTotal, free, spendable, reserve: free - spendable, hist, histTotal, months, hasHabit };
  }

  function split(info, source) {
    const share = {};
    if (source === "habit" && info.hasHabit) cats().forEach(cat => { share[cat] = (info.hist[cat] || 0) / info.histTotal; });
    else cats().forEach(cat => { share[cat] = TEMPLATE[cat] || 0; });
    const out = {};
    cats().forEach(cat => { out[cat] = round(info.spendable * share[cat]); });
    return { out, share };
  }

  /* ---------- the sheet ---------- */
  let current = null;
  function rowsHtml() {
    const { info, source } = current;
    const { out, share } = split(info, source);
    const budgets = appData.profile?.categoryBudgets || {};
    const autoKeys = appData.profile?.autoBudgetKeys || [];
    return cats().filter(cat => out[cat] > 0 || share[cat] > 0 || Number(budgets[cat] || 0) > 0).map(cat => {
      const manual = Number(budgets[cat] || 0) > 0 && !autoKeys.includes(cat);
      const value = current.keep && manual ? Number(budgets[cat]) : out[cat];
      const color = (typeof expenseCategoryColors !== "undefined" && expenseCategoryColors[cat]) || "#8a94a6";
      const icon = typeof Icons !== "undefined" && typeof expenseCategoryIcons !== "undefined" && Icons[expenseCategoryIcons[cat]] ? Icons[expenseCategoryIcons[cat]]() : "•";
      const sub = current.keep && manual ? L("ដាក់ដោយដៃ · រក្សាទុក", "Set by you · kept")
        : source === "habit" && info.hasHabit ? L(`មធ្យម ${fmt((info.hist[cat] || 0) / info.months)}/ខែ`, `Avg ${fmt((info.hist[cat] || 0) / info.months)}/mo`)
        : `${Math.round(share[cat] * 100)}%`;
      return `<label class="ab-cat${current.keep && manual ? " is-kept" : ""}" style="--c:${color}"><span class="ab-ic">${icon}</span><span class="ab-nm"><b>${esc(typeof optionLabel === "function" ? optionLabel(cat) : cat)}</b><small>${esc(sub)}</small><span class="ab-bar"><i style="width:${Math.min(100, Math.round(share[cat] * 250))}%"></i></span></span><input type="number" min="0" step="any" inputmode="decimal" value="${value}" data-ab-cat="${cat}"></label>`;
    }).join("") + `<div class="ab-cat is-res" style="--c:#1f9d74"><span class="ab-ic">🛟</span><span class="ab-nm"><b>${esc(L("លុយបម្រុង", "Cushion"))}</b><small>${esc(L("10% · មិនចែកឲ្យប្រភេទណាទេ", "10% · not given to any category"))}</small></span><b class="ab-res">${esc(fmt(info.reserve))}</b></div>`;
  }

  function sheetHtml() {
    const { info, source } = current;
    const nomi = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy(info.free > 0 ? "happy" : "worry") : "🐱";
    const line = (icon, label, value, minus) => `<div class="${minus ? "is-minus" : ""}"><span>${icon} ${esc(label)}</span><b>${minus ? "− " : ""}${esc(fmt(value))}</b></div>`;
    const empty = !(info.income > 0);
    return `<div class="ab" role="dialog" aria-modal="true" aria-label="${esc(L("ថវិកាស្វ័យប្រវត្តិ", "Auto budget"))}">
      <div class="ab-scrim" data-ab-close></div>
      <div class="ab-sheet"><span class="ab-grab"></span><button type="button" class="ab-x" data-ab-close aria-label="${esc(L("បិទ", "Close"))}">✕</button>
        <div class="ab-head"><span class="ab-nomi">${nomi}</span><div><b>${esc(L(`ថវិកា${monthName(info.month)}`, `${monthName(info.month)} budget`))}</b><small>${esc(L("គណនាពីប្រាក់ខែពិតរបស់អ្នក", "Worked out from your real pay"))}</small></div></div>
        ${empty ? `<p class="ab-empty">${esc(L("មិនទាន់មានប្រាក់ចំណូលទេ។ កត់ប្រាក់ខែជាមុនសិន ទើប Nomi អាចគណនាបាន។", "No income yet. Add your salary first so Nomi can work it out."))}</p><div class="ab-btns is-one"><button type="button" class="ab-yes" data-ab-income>${esc(L("＋ កត់ប្រាក់ខែ", "＋ Add salary"))}</button></div>` : `
        <div class="ab-flow">
          ${line("💰", info.incomeNote, info.income)}
          ${info.billTotal ? line("🧾", L(`វិក្កយបត្រ (${info.bills})`, `Bills (${info.bills})`), info.billTotal, true) : ""}
          ${info.loanTotal ? line("🏦", L(`កម្ចី (${info.loans})`, `Loans (${info.loans})`), info.loanTotal, true) : ""}
          ${info.saveTotal ? line("🐷", L("សន្សំ (ផ្នែកខ្ញុំ)", "Savings (my part)"), info.saveTotal, true) : ""}
          <div class="is-total"><span>${esc(L("នៅសល់សម្រាប់ចាយ", "Left to spend"))}</span><b>${esc(fmt(info.free))}</b></div>
        </div>
        ${info.free > 0 ? `<small class="ab-lbl">${esc(L("ចែកតាម", "Split by"))}</small>
        <div class="ab-src"><button type="button" class="${source === "habit" ? "on" : ""}" data-ab-src="habit" ${info.hasHabit ? "" : "disabled"}>${esc(L("ទម្លាប់ 3 ខែមុន", "Last 3 months"))}</button><button type="button" class="${source === "tpl" ? "on" : ""}" data-ab-src="tpl">${esc(L("ភាគរយគំរូ", "Starter template"))}</button></div>
        ${info.hasHabit ? "" : `<small class="ab-hint">${esc(L("ប្រវត្តិចំណាយមិនទាន់គ្រប់ ដូច្នេះប្រើភាគរយគំរូសិន", "Not enough spending history yet, so the template is used"))}</small>`}
        <div class="ab-cats" data-ab-rows>${rowsHtml()}</div>
        <label class="ab-keep"><input type="checkbox" data-ab-keep ${current.keep ? "checked" : ""}> ${esc(L("រក្សាថវិកាដែលខ្ញុំកំណត់ដោយដៃរួចហើយ", "Keep the budgets I set by hand"))}</label>
        <div class="ab-btns"><button type="button" class="ab-no" data-ab-close>${esc(L("បោះបង់", "Cancel"))}</button><button type="button" class="ab-yes" data-ab-apply>${esc(L("ប្រើថវិកានេះ", "Use this budget"))}</button></div>`
        : `<p class="ab-empty">${esc(L("ចំណាយថេរលើសប្រាក់ចំណូលហើយ។ ពិនិត្យវិក្កយបត្រ កម្ចី ឬការសន្សំម្តងទៀត។", "Fixed costs are more than your income. Check bills, loans or savings."))}</p>`}`}
      </div></div>`;
  }

  function open() {
    const info = compute();
    current = { info, source: info.hasHabit ? "habit" : "tpl", keep: true };
    document.querySelector(".ab")?.remove();
    document.body.insertAdjacentHTML("beforeend", sheetHtml());
    document.body.classList.add("ab-open");
    requestAnimationFrame(() => document.querySelector(".ab")?.classList.add("is-in"));
  }
  function close() {
    document.querySelector(".ab")?.remove();
    document.body.classList.remove("ab-open");
  }

  function apply() {
    const next = { ...(appData.profile?.categoryBudgets || {}) };
    const keys = [];
    document.querySelectorAll(".ab [data-ab-cat]").forEach(input => {
      const cat = input.dataset.abCat;
      const value = Number(input.value || 0);
      if (input.closest(".is-kept")) return; // kept as the user set it
      next[cat] = value > 0 ? value : 0;
      keys.push(cat);
    });
    Store.updateProfile({ categoryBudgets: next, autoBudgetKeys: keys, autoBudgetMonth: current.info.month });
    close();
    const total = Object.values(next).reduce((sum, value) => sum + Number(value || 0), 0);
    if (typeof DoneFeed !== "undefined") DoneFeed.celebrate({ mood: "cheer", title: L("✓ កំណត់ថវិការួច!", "✓ Budget set!"), sub: L(`សរុប ${fmt(total)} · ព្រមានពេលចាយដល់ 80%`, `Total ${fmt(total)} · alert at 80%`) });
    else if (typeof Toast !== "undefined") Toast.show(L("បានរក្សាទុកថវិកា", "Budget saved"));
    if (typeof App !== "undefined") App.render();
  }

  if (typeof document !== "undefined") {
    document.addEventListener("click", event => {
      const t = event.target;
      if (!t.closest(".ab")) return;
      if (t.closest("[data-ab-close]")) { close(); return; }
      const src = t.closest("[data-ab-src]");
      if (src && !src.disabled) { current.source = src.dataset.abSrc; document.querySelectorAll(".ab [data-ab-src]").forEach(b => b.classList.toggle("on", b === src)); document.querySelector(".ab [data-ab-rows]").innerHTML = rowsHtml(); return; }
      if (t.closest("[data-ab-apply]")) { apply(); return; }
      if (t.closest("[data-ab-income]")) { close(); if (typeof openIncomeModal === "function") openIncomeModal(); else location.hash = "#money/income"; }
    });
    // capture: some pages stop clicks from bubbling up
    document.addEventListener("click", event => {
      if (!event.target.closest("[data-ab-open]")) return;
      event.preventDefault();
      open();
    }, true);
    document.addEventListener("change", event => {
      if (!event.target.matches(".ab [data-ab-keep]")) return;
      current.keep = event.target.checked;
      document.querySelector(".ab [data-ab-rows]").innerHTML = rowsHtml();
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && document.querySelector(".ab")) close(); });
  }

  /* ---------- the button on the budget card + the monthly offer ---------- */
  function buttonHtml() {
    const done = appData.profile?.autoBudgetMonth === monthKey();
    return `<button type="button" class="ab-open-btn" data-ab-open><span>✨</span><span><b>${esc(done ? L("គណនាថវិកាម្តងទៀត", "Work out the budget again") : L("គណនាថវិកាពីប្រាក់ខែ", "Budget from my salary"))}</b><small>${esc(L("Nomi ចែកលុយឲ្យតាមប្រភេទ · កែបានមុនប្រើ", "Nomi splits it by category · edit before using"))}</small></span></button>`;
  }

  // a new month with a salary already in, and auto budget used before → offer once
  function offerHtml() {
    const p = appData.profile || {};
    const month = monthKey();
    if (!p.autoBudgetMonth || p.autoBudgetMonth === month || !(incomeFor(month) > 0)) return "";
    try { if (localStorage.getItem("mylife:ab-offer") === month) return ""; } catch (error) { /* show it */ }
    const nomi = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy("cheer") : "🐱";
    return `<div class="ab-offer"><span class="ab-offer-nomi">${nomi}</span><span class="ab-offer-tx"><b>${esc(L("ប្រាក់ខែចូលហើយ 🎉", "Payday 🎉"))}</b><small>${esc(L(`គណនាថវិកា${monthName(month)}ឡើងវិញទេ?`, `Work out the ${monthName(month)} budget?`))}</small></span><button type="button" data-ab-open data-ab-seen>${esc(L("គណនា", "Go"))}</button><button type="button" class="ab-offer-x" data-ab-skip aria-label="${esc(L("លើកក្រោយ", "Later"))}">✕</button></div>`;
  }
  if (typeof document !== "undefined") {
    document.addEventListener("click", event => {
      if (!event.target.closest("[data-ab-seen], [data-ab-skip]")) return;
      try { localStorage.setItem("mylife:ab-offer", monthKey()); } catch (error) { /* fine */ }
      if (event.target.closest("[data-ab-skip]")) event.target.closest(".ab-offer")?.remove();
    }, true);
  }

  return { open, compute, buttonHtml, offerHtml };
})();
