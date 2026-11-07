const moneyTabs = [
  ["overview", "overview", "chart"],
  ["income", "income", "salary"],
  ["expenses", "expenses", "expense"],
  ["savings", "savings", "savings"],
  ["loans", "loans", "loan"],
  ["bills", "bills", "bill"],
  ["reports", "reports", "chart"]
];
const incomeCategories = ["Salary", "Business", "Freelance", "Bonus", "Other"];
const incomeCategoryColors = {
  Salary: "#34d399",
  Business: "#60a5fa",
  Freelance: "#a78bfa",
  Bonus: "#fb923c",
  Other: "#94a3b8"
};
const expenseCategories = ["Food", "Home", "Family", "Transport", "Shopping", "Bills", "Loan", "Education", "Health", "Entertainment", "Other"];
const expenseCategoryColors = {
  Food: "#fb7185",
  Home: "#f59e0b",
  Family: "#f472b6",
  Transport: "#60a5fa",
  Shopping: "#a78bfa",
  Bills: "#f97316",
  Loan: "#d946ef",
  Education: "#2dd4bf",
  Health: "#34d399",
  Entertainment: "#818cf8",
  Other: "#94a3b8"
};
const expenseCategoryIcons = {
  Food: "food",
  Home: "home",
  Family: "family",
  Transport: "plane",
  Shopping: "wallet",
  Bills: "bill",
  Loan: "loan",
  Education: "graduation",
  Health: "heart",
  Entertainment: "memory",
  Other: "chart"
};
let financeReportMonth = "";
let moneyBudgetOpen = false;
let financeReportCanvas = null;
let financeReportCanvasMonth = "";

/* ---------- Overview period: day / week / month / year / all ---------- */
const MONEY_PERIOD_KEY = "mylife:money-period";
function moneyPeriod() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(MONEY_PERIOD_KEY) || "null");
    if (saved && ["day", "week", "month", "year", "all"].includes(saved.kind) && /^\d{4}-\d{2}-\d{2}$/.test(saved.anchor)) return saved;
  } catch (error) { /* ignore */ }
  const preferred = appData.profile.moneyDefaultPeriod;
  return { kind: ["day", "week", "month", "year", "all"].includes(preferred) ? preferred : "month", anchor: localDateInput() };
}
function setMoneyPeriod(next) {
  try { sessionStorage.setItem(MONEY_PERIOD_KEY, JSON.stringify(next)); } catch (error) { /* ignore */ }
  App.render();
}
function moneyIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function moneyPeriodRange(period = moneyPeriod()) {
  const isKm = languageCode() === "km";
  const KM = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const monthName = (y, m) => (isKm ? `ខែ${KM[m]} ${y}` : new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }));
  const short = d => (isKm ? `${d.getDate()} ${KM[d.getMonth()]}` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  const a = new Date(`${period.anchor}T00:00:00`);
  const today = localDateInput();
  let start;
  let end;
  let label;
  if (period.kind === "day") {
    start = end = period.anchor;
    label = period.anchor === today ? (isKm ? "ថ្ងៃនេះ" : "Today") : formatDate(period.anchor);
  } else if (period.kind === "week") {
    const s0 = new Date(a);
    s0.setDate(a.getDate() - ((a.getDay() + 6) % 7));
    const e0 = new Date(s0);
    e0.setDate(s0.getDate() + 6);
    start = moneyIso(s0);
    end = moneyIso(e0);
    label = today >= start && today <= end ? (isKm ? "សប្តាហ៍នេះ" : "This week") : `${short(s0)} – ${short(e0)}`;
  } else if (period.kind === "year") {
    start = `${a.getFullYear()}-01-01`;
    end = `${a.getFullYear()}-12-31`;
    label = String(a.getFullYear());
  } else if (period.kind === "all") {
    start = "0000-01-01";
    end = "9999-12-31";
    label = isKm ? "គ្រប់ពេល" : "All time";
  } else {
    start = `${period.anchor.slice(0, 7)}-01`;
    end = moneyIso(new Date(a.getFullYear(), a.getMonth() + 1, 0));
    label = monthName(a.getFullYear(), a.getMonth());
  }
  const days = Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1;
  return { ...period, start, end, label, days, month: period.anchor.slice(0, 7), isCurrent: today >= start && today <= end };
}
function shiftMoneyPeriod(period, step) {
  const a = new Date(`${period.anchor}T00:00:00`);
  if (period.kind === "day") a.setDate(a.getDate() + step);
  if (period.kind === "week") a.setDate(a.getDate() + step * 7);
  if (period.kind === "month") { a.setDate(1); a.setMonth(a.getMonth() + step); }
  if (period.kind === "year") a.setFullYear(a.getFullYear() + step);
  return { kind: period.kind, anchor: moneyIso(a) };
}
function moneyExpensesIn(range) {
  return (appData.expenses || []).filter(item => {
    const date = String(item.date || "");
    return date >= range.start && date <= range.end;
  });
}
// Loan payments made on the Loans page with no expense of their own. A payment
// with an expenseId is already an expense (category Loan), so it is never added twice.
function moneyLoanPaymentsIn(range) {
  return (appData.loans || []).flatMap(loan => (loan.payments || [])
    .filter(payment => !payment.expenseId && String(payment.date || "") >= range.start && String(payment.date || "") <= range.end)
    .map(payment => ({ name: loan.name || t("loan"), date: payment.date, amount: toProfileCurrency(payment.amount || loan.monthlyPayment, payment.currency || loan.currency) })));
}
function renderMoneyPeriodBar(range) {
  const isKm = languageCode() === "km";
  const kinds = [["day", isKm ? "ថ្ងៃ" : "Day"], ["week", isKm ? "សប្តាហ៍" : "Week"], ["month", isKm ? "ខែ" : "Month"], ["year", isKm ? "ឆ្នាំ" : "Year"], ["all", isKm ? "ទាំងអស់" : "All"]];
  const pickerType = range.kind === "month" ? "month" : "date";
  const pickerValue = range.kind === "month" ? range.anchor.slice(0, 7) : range.anchor;
  return `<div class="money-period" role="group" aria-label="${isKm ? "ជ្រើសពេល" : "Choose period"}">
    <div class="money-period-kinds">${kinds.map(([kind, label]) => `<button type="button" class="money-period-kind ${range.kind === kind ? "active" : ""}" data-money-period="${kind}" aria-pressed="${range.kind === kind}">${label}</button>`).join("")}</div>
    ${range.kind === "all" ? "" : `<div class="money-period-nav">
      <button type="button" class="icon-button" data-money-shift="-1" aria-label="${isKm ? "មុន" : "Previous"}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <label class="money-period-label">${Icons.calendar()}<strong>${escapeHtml(range.label)}</strong>${range.kind === "year" ? "" : `<input type="${pickerType}" value="${pickerValue}" data-money-pick aria-label="${isKm ? "ជ្រើសថ្ងៃ" : "Pick a date"}">`}</label>
      <button type="button" class="icon-button" data-money-shift="1" aria-label="${isKm ? "បន្ទាប់" : "Next"}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
      ${range.isCurrent ? "" : `<button type="button" class="money-period-today" data-money-today>${isKm ? "ថ្ងៃនេះ" : "Today"}</button>`}
    </div>`}
  </div>`;
}

function renderMoney(tab = "overview") {
  // Budget lives inside Expenses now; old #money/budget links land there with budgets open
  moneyBudgetOpen = tab === "budget" || moneyBudgetOpen === "keep";
  if (tab === "budget") tab = "expenses";
  const stats = Store.calculate();
  return `
    <section class="page${typeof MoneyV2 !== "undefined" ? " fv2-page" : ""}">
      <div class="page-header financial-header">
        <div class="financial-header-main">
          <div class="financial-header-copy">
            <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.money()}</span>${t("money")}</h1>
            <p class="page-subtitle">${typeof MoneyV2 !== "undefined" ? (languageCode() === "km" ? "ចំណូល · ចំណាយ" : "Income · Expenses") : t("moneySubtitle")}</p>
            <a class="ms-scan-link" href="#scan">${Icons.scan()}<span>${t("smartScan")}</span></a>
          </div>
          <div class="financial-nav-dock">
            <button class="financial-nav-toggle" type="button" data-open-financial-nav aria-label="${t("money")} sections" title="${t("money")} sections"><span class="financial-nav-toggle-lines" aria-hidden="true"><i></i><i></i><i></i></span></button>
            <dialog class="financial-sidebar" aria-label="${t("money")} sections">
              <div class="financial-sidebar-handle" aria-hidden="true"><span></span></div>
              <div class="financial-sidebar-heading"><div class="financial-sidebar-heading-copy"><strong>${t("money")} ${t("sections")}</strong><span>${t("financialSectionsSubtitle")}</span><div class="financial-nav-welcome"><span class="financial-nav-nomi" aria-hidden="true">${HomeV2.role ? HomeV2.role("money") : HomeV2.buddy("happy")}</span><span class="financial-nav-say">${escapeHtml(languageCode() === "km" ? "តោះមើលផ្នែកហិរញ្ញវត្ថុដែលអ្នកចង់បាន 🐾" : "Pick a money section to explore 🐾")}</span></div></div><button class="icon-button" type="button" data-close-financial-nav aria-label="${t("close")}">${Icons.close()}</button></div>
              <nav class="financial-sidebar-nav" aria-label="${t("money")} sections">
              ${moneyTabs.map(([id, label, icon]) => `<a class="financial-nav-item ${tab === id ? "active" : ""}" href="#money/${id}"><span class="financial-nav-icon">${Icons[icon]()}</span><span class="financial-nav-copy"><strong>${t(label)}</strong><small>${t(`financialSection${id[0].toUpperCase()}${id.slice(1)}`)}</small></span>${Icons.chevron()}</a>`).join("")}
              </nav>
            </dialog>
          </div>
        </div>
        ${typeof MoneyV2 !== "undefined" && typeof HomeV2 !== "undefined" && typeof HomeV2.buddy === "function" ? `<div class="fv2-header-talk"><span class="fv2-header-nomi" data-nomi data-mood="happy" role="button" tabindex="0" aria-label="Nomi">${HomeV2.role ? HomeV2.role("money") : HomeV2.buddy("happy")}</span><span class="fv2-header-say" data-nomi-say>${escapeHtml(languageCode() === "km" ? "មើលលុយយើង 💸" : "Let’s check your money picture 💸")}</span></div>` : ""}
      </div>
      <nav class="financial-shortcuts" aria-label="${t("money")} ${t("sections")}">
        ${moneyTabs.map(([id, label, icon]) => `<a class="financial-shortcut ${tab === id ? "active" : ""}" href="#money/${id}" ${tab === id ? 'aria-current="page"' : ""}><span class="financial-shortcut-icon" aria-hidden="true">${Icons[icon]()}</span><span>${t(label)}</span></a>`).join("")}
      </nav>
      <div class="financial-layout">
        <div class="financial-content">
          ${renderMoneyTab(tab, stats)}
        </div>
      </div>
    </section>
  `;
}

function renderMoneyCards(stats, range = moneyPeriodRange()) {
  const isKm = languageCode() === "km";
  const m = moneyMonthNumbers(range.month);
  // spent in the chosen period (day / week / month / year / all)
  const periodExpenses = moneyExpensesIn(range);
  const periodSpent = periodExpenses.reduce((total, expense) => total + toProfileCurrency(expense.amount, expense.currency), 0);
  // the Spent card also shows loan payments, so money out = spending + loans
  const periodLoans = moneyLoanPaymentsIn(range);
  const periodLoanTotal = periodLoans.reduce((total, payment) => total + payment.amount, 0);
  const allLoanTotal = moneyLoanPaymentsIn({ start: "0000-01-01", end: "9999-12-31" }).reduce((total, payment) => total + payment.amount, 0);
  let periodIncome = m.income;
  let periodLeft = m.left;
  if (range.kind === "year") {
    // only months that have started (no guessing the future)
    const thisMonthKey = localDateInput().slice(0, 7);
    const months = Array.from({ length: 12 }, (_, i) => `${range.anchor.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`)
      .filter(key => key <= thisMonthKey)
      .map(key => moneyMonthNumbers(key));
    periodIncome = months.reduce((total, item) => total + item.income, 0);
    periodLeft = months.reduce((total, item) => total + item.income - item.expenses - item.loans, 0);
  }
  if (range.kind === "all") {
    periodIncome = stats.totalIncome;
    periodLeft = stats.totalIncome - stats.totalExpenses - allLoanTotal;
  }
  // day / week: how much you can still spend, spread over the days left in the month
  let allowance = null;
  if (range.kind === "day" || range.kind === "week") {
    const [y, mo] = range.month.split("-").map(Number);
    const lastDay = new Date(y, mo, 0).getDate();
    const today = localDateInput();
    const fromDay = today.slice(0, 7) === range.month ? Number(today.slice(8, 10)) : 1;
    const daysLeft = Math.max(1, lastDay - fromDay + 1);
    // money still free from today on = what's left + what was already spent from today
    const spentBefore = (appData.expenses || []).filter(item => String(item.date || "").slice(0, 7) === range.month && String(item.date) < `${range.month}-${String(fromDay).padStart(2, "0")}`).reduce((total, item) => total + toProfileCurrency(item.amount, item.currency), 0);
    allowance = (m.left + (m.expenses - spentBefore)) / daysLeft;
    allowance = Math.max(0, allowance) * (range.kind === "week" ? 7 : 1);
  }
  const periodWord = range.kind === "month" ? (isKm ? "ខែនេះ" : "this month") : range.label;
  const savingsTarget = sumMoney(appData.savings, "targetAmount");
  const savingsPct = savingsTarget ? Math.min(100, Math.round((stats.totalSavings / savingsTarget) * 100)) : 0;
  const spentPct = m.income ? Math.round(((m.expenses + m.loans) / m.income) * 100) : 0;
  const committed = m.expenses + m.loans + Math.max(m.saved, m.plannedSavings);
  const usedPct = m.income ? Math.round((committed / m.income) * 100) : 0;
  const short = m.left < 0;
  const level = pct => (pct >= 90 ? "bad" : pct >= 70 ? "warn" : "good");
  const allTime = value => `<span class="mm-foot-label">${isKm ? "សរុបទាំងអស់" : "All time"}</span><strong>${money(value)}</strong>`;

  return `<div class="summary-grid financial-metric-grid grid mm-grid" role="region" aria-label="${escapeAttr(t("overview"))}" tabindex="0">
    ${moneyMetricCard({
      tone: "income", section: "income", icon: Icons.salary(), title: isKm ? `ចំណូល · ${range.kind === "day" || range.kind === "week" ? moneyPeriodRange({ kind: "month", anchor: range.anchor }).label : range.label}` : `Income · ${range.kind === "day" || range.kind === "week" ? moneyPeriodRange({ kind: "month", anchor: range.anchor }).label : range.label}`, value: money(periodIncome),
      pill: `${appData.income.length} ${escapeHtml(t("income"))}`,
      foot: allTime(stats.totalIncome)
    })}
    ${moneyMetricCard({
      tone: "expense", section: "expenses", icon: Icons.expense(), title: isKm ? `ចំណាយ · ${range.label}` : `Spent · ${range.label}`, value: money(periodSpent + periodLoanTotal),
      pill: `${periodExpenses.length} ${escapeHtml(t("expenses"))}${periodLoans.length ? ` · ${isKm ? "កម្ចី" : "loan"} ${money(periodLoanTotal)}` : ""}`,
      bar: range.kind === "month" && m.income ? { pct: spentPct, level: level(spentPct), label: isKm ? `ប្រើ ${spentPct}% នៃចំណូល${periodWord}` : `${spentPct}% of ${periodWord}'s income` } : allowance !== null && allowance > 0 ? { pct: Math.round((periodSpent / allowance) * 100), level: level(Math.round((periodSpent / allowance) * 100)), label: isKm ? `ប្រើ ${Math.round((periodSpent / allowance) * 100)}% នៃលុយអាចចាយ` : `${Math.round((periodSpent / allowance) * 100)}% of what you can spend` } : null,
      foot: allTime(stats.totalExpenses + allLoanTotal)
    })}
    ${moneyMetricCard({
      tone: "savings", section: "savings", icon: Icons.savings(), title: t("totalSavings"), value: money(stats.totalSavings),
      pill: `+${money(stats.monthlySavings)} / ${isKm ? "ខែ" : "mo"}`,
      bar: savingsTarget ? { pct: savingsPct, level: "good", label: isKm ? `${savingsPct}% នៃគោលដៅ ${money(savingsTarget)}` : `${savingsPct}% of ${money(savingsTarget)} goal` } : null
    })}
    ${moneyMetricCard({
      ...(allowance !== null ? {
        tone: periodSpent > allowance ? "short" : "available", section: "budget", icon: Icons.wallet(),
        title: isKm ? (range.kind === "day" ? "អាចចាយក្នុងមួយថ្ងៃ" : "អាចចាយក្នុងមួយសប្តាហ៍") : (range.kind === "day" ? "You can spend / day" : "You can spend / week"),
        value: money(allowance),
        pill: allowance <= 0 ? `⚠ ${isKm ? "ថវិកាខែនេះអស់ហើយ" : "No money left this month"}` : periodSpent > allowance ? `⚠ ${isKm ? "ចាយលើស" : "Over by"} ${money(periodSpent - allowance)}` : `✓ ${isKm ? "នៅសល់" : "Left"} ${money(allowance - periodSpent)}`,
        note: isKm ? "លុយនៅសល់ខែនេះ ÷ ថ្ងៃដែលនៅសល់" : "Money left this month ÷ days left"
      } : range.kind === "year" || range.kind === "all" ? {
        tone: periodLeft < 0 ? "short" : "available", section: "budget", icon: Icons.wallet(),
        title: isKm ? `នៅសល់ · ${range.label}` : `Left · ${range.label}`, value: money(periodLeft),
        pill: periodLeft < 0 ? `⚠ ${isKm ? "ខ្វះ" : "Short by"} ${money(Math.abs(periodLeft))}` : `✓ ${isKm ? "ចំណូល − ចំណាយ − កម្ចី" : "Income − spent − loans"}`
      } : {
      tone: short ? "short" : "available", section: "budget", icon: Icons.wallet(), title: isKm ? `នៅសល់ · ${range.label}` : `Left · ${range.label}`, value: money(m.left),
      pill: short ? `⚠ ${isKm ? "ខ្វះ" : "Short by"} ${money(Math.abs(m.left))}` : `✓ ${isKm ? "នៅសល់សម្រាប់ចាយ" : "Left to spend"}`,
      bar: m.income ? { pct: Math.min(usedPct, 100), level: level(usedPct), label: isKm ? `បានប្រើ ${usedPct}% នៃចំណូល` : `${usedPct}% of income used` } : null,
      // how the number is made: income − spent − loans − savings (parts that are 0 are left out)
      calc: [
        money(m.income),
        ...[[isKm ? "ចំណាយ" : "spent", m.expenses], [isKm ? "កម្ចី" : "loans", m.loans], [isKm ? "សន្សំ" : "savings", Math.max(m.saved, m.plannedSavings)]]
          .filter(([, value]) => value > 0)
          .map(([label, value]) => `<span>− ${label} ${money(value)}</span>`)
      ].join(" ")
      })
    })}
  </div>`;
}

// Money overview card: tone colour, quick status pill and an optional progress bar.
function moneyMetricCard({ tone, section, icon, title, value, pill = "", bar = null, foot = "", note = "", calc = "" }) {
  return `
    <article class="glass-card card-pad financial-metric-card mm-card mm-${tone}">
      <a class="financial-metric-card-link" href="#money/${section}" aria-label="${escapeAttr(title)}"></a>
      <span class="financial-metric-watermark" aria-hidden="true">${icon}</span>
      <div class="mm-top">
        <span class="mm-icon">${icon}</span>
        <span class="mm-title">${escapeHtml(title)}</span>
        <span class="mm-arrow" aria-hidden="true">${Icons.chevron()}</span>
      </div>
      <div class="metric mm-value">${value}</div>
      ${pill ? `<div class="mm-pill">${pill}</div>` : ""}
      ${calc ? `<div class="mm-calc">${calc}</div>` : ""}
      ${bar ? `<div class="mm-bar mm-${bar.level}" ><div class="mm-track"><i style="width:${Math.max(3, Math.min(100, bar.pct))}%"></i></div><small>${bar.label}</small></div>` : ""}
      ${foot ? `<div class="mm-foot">${foot}</div>` : ""}
      ${note ? `<div class="mm-note">${escapeHtml(note)}</div>` : ""}
    </article>
  `;
}

function renderCategoryOverview(range = moneyPeriodRange()) {
  const isKm = languageCode() === "km";
  const inRange = moneyExpensesIn(range);
  // loan payments with no expense of their own join the "Loan" slice (never twice)
  const loanPays = moneyLoanPaymentsIn(range);
  const loanPaid = payments => payments.reduce((sum, payment) => sum + payment.amount, 0);
  const categories = expenseCategories.map(category => {
    const items = inRange.filter(expense => expense.category === category);
    const extra = category === "Loan" ? loanPays : [];
    return { category, count: items.length + extra.length, amount: sumMoney(items, "amount") + loanPaid(extra), color: expenseCategoryColors[category] };
  }).filter(item => item.amount > 0).sort((left, right) => right.amount - left.amount);
  const total = categories.reduce((sum, item) => sum + item.amount, 0);
  const count = inRange.length + loanPays.length;

  // this period vs the one before
  const prevRange = range.kind === "all" ? null : moneyPeriodRange(shiftMoneyPeriod(range, -1));
  const thisMonth = total;
  const lastMonth = prevRange ? sumMoney(moneyExpensesIn(prevRange), "amount") + loanPaid(moneyLoanPaymentsIn(prevRange)) : 0;
  const unitWord = { day: isKm ? "ម្សិលមិញ" : "yesterday", week: isKm ? "សប្តាហ៍មុន" : "last week", month: isKm ? "ខែមុន" : "last month", year: isKm ? "ឆ្នាំមុន" : "last year" }[range.kind] || "";
  const peak = Math.max(thisMonth, lastMonth, 1);
  const change = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  const changeText = change === null
    ? (isKm ? `មិនមានទិន្នន័យ${unitWord}` : `No data for ${unitWord}`)
    : change === 0
      ? (isKm ? `ស្មើ${unitWord}` : `Same as ${unitWord}`)
      : `${change > 0 ? "▲" : "▼"} ${Math.abs(change)}% ${isKm ? (change > 0 ? `ច្រើនជាង${unitWord}` : `តិចជាង${unitWord}`) : (change > 0 ? `more than ${unitWord}` : `less than ${unitWord}`)}`;
  const top = categories[0];

  return `<article class="glass-card card-pad financial-panel financial-category-overview cat-v2">
    <div class="financial-panel-heading">
      <div><span class="eyebrow">${t("overview")} · ${escapeHtml(range.label)}</span><h2 class="section-title">${t("spendingByCategory")}</h2></div>
      <div class="financial-category-total"><span>${t("totalExpenses")}</span><strong>${money(total)}</strong></div>
    </div>
    ${categories.length ? `
    <div class="cat-stats">
      <div class="cat-stat"><span>${isKm ? "ចំនួនចំណាយ" : "Expenses"}</span><strong>${count}</strong></div>
      <div class="cat-stat" style="--category-color:${top.color}"><span>${isKm ? "ចាយច្រើនបំផុត" : "Top category"}</span><strong><i></i>${escapeHtml(optionLabel(top.category))}</strong></div>
      <div class="cat-stat"><span>${isKm ? "មធ្យមក្នុងមួយដង" : "Average each"}</span><strong>${money(count ? total / count : 0)}</strong></div>
    </div>
    <div class="cat-body">
      <div class="financial-category-chart" role="img" aria-label="${t("spendingByCategory")}">
        ${Charts.donut(categories.map(item => ({ value: item.amount, color: item.color })))}
        <div class="financial-category-chart-center"><strong>${money(total)}</strong><span>${categories.length} ${isKm ? "ប្រភេទ" : categories.length === 1 ? "category" : "categories"}</span></div>
      </div>
      <div class="cat-list">
        ${categories.map(item => {
          const share = Math.round((item.amount / total) * 100);
          return `<div class="cat-item" style="--category-color:${item.color};--category-share:${Math.max(share, 2)}%">
            <span class="cat-icon" aria-hidden="true">${Icons[expenseCategoryIcons[item.category]]()}</span>
            <div class="cat-copy">
              <div class="cat-row"><b>${escapeHtml(optionLabel(item.category))}</b><small>${item.count} ${isKm ? "ដង" : item.count === 1 ? "time" : "times"}</small><strong>${money(item.amount)}</strong></div>
              <div class="cat-track"><span></span></div>
            </div>
            <span class="cat-share">${share}%</span>
          </div>`;
        }).join("")}
      </div>
      ${prevRange ? `<div class="cat-compare">
        <span class="cat-compare-title">${escapeHtml(range.label)} ${isKm ? "ធៀប" : "vs"} ${escapeHtml(unitWord)}</span>
        <div class="cat-bars">
          <div class="cat-bar is-last"><strong>${money(lastMonth)}</strong><i style="height:${Math.max(4, Math.round((lastMonth / peak) * 100))}%"></i><span>${escapeHtml(prevRange.label)}</span></div>
          <div class="cat-bar is-this"><strong>${money(thisMonth)}</strong><i style="height:${Math.max(4, Math.round((thisMonth / peak) * 100))}%"></i><span>${escapeHtml(range.label)}</span></div>
        </div>
        <small class="cat-change ${change > 0 ? "is-up" : change < 0 ? "is-down" : ""}">${changeText}</small>
      </div>` : ""}
    </div>` : `<div class="financial-category-empty">
      <div class="financial-category-swatches" aria-hidden="true">${expenseCategories.slice(0, 6).map(category => `<span style="--category-color:${expenseCategoryColors[category]}"></span>`).join("")}</div>
      <div><strong>${t("noExpensesYet")}</strong><p>${t("noExpensesBody")}</p></div>
      <button class="button" type="button" data-action="add-expense">${Icons.plus()} ${t("addExpense")}</button>
    </div>`}
  </article>`;
}

// "If you keep spending like this…" — only for the current month
function renderMoneyForecast(range) {
  if (typeof MoneyInsights === "undefined" || range.kind !== "month" || !range.isCurrent) return "";
  const today = localDateInput();
  const f = MoneyInsights.monthForecast(appData, today, { leftNow: moneyMonthNumbers().left });
  if (!f.spent && !f.income) return "";
  const isKm = languageCode() === "km";
  const short = f.left < 0;
  const budgets = f.budgets.slice(0, 2).map(entry => `<li class="${entry.over ? "is-over" : "is-near"}">${entry.over
    ? (isKm ? `ថវិកា${escapeHtml(optionLabel(entry.category))} លើសហើយ` : `${escapeHtml(optionLabel(entry.category))} budget is over`)
    : (isKm ? `ថវិកា${escapeHtml(optionLabel(entry.category))} នឹងអស់ប្រហែលថ្ងៃទី ${entry.day}` : `${escapeHtml(optionLabel(entry.category))} budget runs out around day ${entry.day}`)}</li>`).join("");
  return `<article class="glass-card card-pad money-forecast ${short ? "is-short" : "is-ok"}">
    <span class="money-forecast-icon" aria-hidden="true">🔮</span>
    <div class="money-forecast-copy">
      <small>${isKm ? "ព្យាករណ៍ចុងខែ" : "Month-end forecast"}</small>
      <strong>${short
        ? (isKm ? `បើចាយបែបនេះ នឹងខ្វះ ${money(Math.abs(f.left))}` : `At this pace you'll be short ${money(Math.abs(f.left))}`)
        : (isKm ? `បើចាយបែបនេះ នឹងនៅសល់ ${money(f.left)}` : `At this pace you'll have ${money(f.left)} left`)}</strong>
      ${f.daysLeft > 0 ? `<span>${isKm ? `អាចចាយបាន ${money(f.perDay)} / ថ្ងៃ · ${f.daysLeft} ថ្ងៃទៀត` : `You can spend ${money(f.perDay)} / day · ${f.daysLeft} days left`}</span>` : ""}
      ${budgets ? `<ul>${budgets}</ul>` : ""}
    </div>
  </article>`;
}

function summaryCard(label, title, value, trend, icon, tone, section) {
  return `
    <article class="glass-card card-pad financial-metric-card">
      <a class="financial-metric-card-link" href="#money/${section}" aria-label="${escapeAttr(title)}"></a>
      <span class="financial-metric-watermark" aria-hidden="true">${icon}</span>
      <div class="card-title-row">
        <span class="icon-badge ${tone}">${icon}</span>
        <span class="secondary">${escapeHtml(title)}</span>
      </div>
      <div class="metric">${value}</div>
      <div class="secondary">${trend}</div>
    </article>
  `;
}

function renderMoneyTab(tab, stats) {
  if (typeof MoneyTabsV2 !== "undefined") { const v2 = MoneyTabsV2.render(tab, stats); if (v2) return v2; }
  if (tab === "income") return renderIncome();
  if (tab === "expenses") return renderExpenses();
  if (tab === "savings") return renderSavings();
  if (tab === "loans") return renderLoans();
  if (tab === "bills") return renderBills();
  if (tab === "budget") return renderBudget();
  if (tab === "reports") return renderReports(stats);
  // Finance V2 (js/money-v2.js); the old overview below stays as a fallback
  if (typeof MoneyV2 !== "undefined") return MoneyV2.overview(stats);
  const range = moneyPeriodRange();
  const periodExpenses = moneyExpensesIn(range).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return `
    ${renderMoneyPeriodBar(range)}
    ${renderMoneyCards(stats, range)}
    ${renderMoneyForecast(range)}
    ${typeof SmartMoney !== "undefined" ? SmartMoney.renderQuickExpense() : ""}
    ${renderCategoryOverview(range)}
    <div class="grid two-col financial-overview-grid">
      ${renderMoneySmartOverview()}
      <article class="glass-card card-pad financial-panel">
        <div class="financial-panel-heading">
          <div>
            <span class="eyebrow">${t("expenses")}</span>
            <h2 class="section-title">${t("recentTransactions")}</h2>
          </div>
          <a class="pill xl-see-all" href="#money/expenses">${languageCode() === "km" ? "មើលទាំងអស់" : "See all"} ›</a>
        </div>
        ${renderRecentExpenses()}
      </article>
    </div>
  `;
}

// This month's real numbers (recurring income included), shared by the
// overview cards so they and the reports agree.
function moneyMonthNumbers(month = localDateInput().slice(0, 7)) {
  const report = buildMonthlyFinanceReport(month);
  const expenses = (appData.expenses || [])
    .filter(expense => String(expense.date || "").slice(0, 7) === month)
    .reduce((total, expense) => total + toProfileCurrency(expense.amount, expense.currency), 0);
  const saved = (appData.savings || []).reduce((total, saving) => {
    const contribution = getSavingsContribution(saving, month);
    return total + (contribution?.paid ? toProfileCurrency(contribution.amount || saving.monthlyContribution, saving.currency) : 0);
  }, 0);
  const plannedSavings = sumMoney(appData.savings || [], "monthlyContribution");
  const income = report.incomeTotal;
  const loans = report.loanPaymentTotal;
  // Available cash follows the user's actual flow: no income = zero, and only
  // recorded expenses, paid loan installments, and completed savings reduce it.
  const left = income > 0 ? income - expenses - loans - saved : 0;
  return { month, monthLabel: report.monthLabel, income, expenses, saved, plannedSavings, loans, left };
}

function renderMoneySmartOverview() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toDateInput(today);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndIso = toDateInput(weekEnd);
  const dueBills = (appData.bills || [])
    .filter(bill => bill.status !== "Paid" && !billPaidCurrentCycle(bill) && bill.due && bill.due <= weekEndIso)
    .sort((left, right) => String(left.due).localeCompare(String(right.due)));
  const dueLoans = (appData.loans || []).flatMap(loan => {
    const due = nextLoanPaymentDate(loan);
    if (!due || due < todayIso || due > weekEndIso) return [];
    const paid = loanMonthPaid(loan, due);
    return paid ? [] : [{ title: loan.name || t("loan"), date: due, amount: loan.monthlyPayment, currency: loan.currency, href: "#money/loans" }];
  });
  const overdueLoanPayments = (appData.loans || []).flatMap(loan => {
    if (!loan.payments?.length || loanRemaining(loan) <= 0) return [];
    const overdueDate = loanPaymentScheduleToCurrent(loan)
      .filter(payment => !payment.paid && payment.date < todayIso)
      .map(payment => payment.date)
      .sort()
      .slice(-1)[0];
    return overdueDate
      ? [{ title: loan.name || t("loan"), date: overdueDate, amount: loan.monthlyPayment, currency: loan.currency, href: "#money/loans", overdue: true }]
      : [];
  });
  const billAlerts = dueBills.map(bill => ({
    billId: bill.id,
    title: bill.name || t("bill"),
    date: bill.due,
    amount: bill.amount,
    currency: bill.currency,
    href: "#money/bills",
    overdue: bill.due < todayIso
  }));
  const attentionItems = [...billAlerts, ...overdueLoanPayments, ...dueLoans]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 5);
  const month = `${todayIso.slice(0, 7)}`;
  const report = buildMonthlyFinanceReport(month);
  const monthlyExpenses = (appData.expenses || [])
    .filter(expense => String(expense.date || "").slice(0, 7) === month)
    .reduce((total, expense) => total + toProfileCurrency(expense.amount, expense.currency), 0);
  const savingsMonth = month;
  const savedThisMonth = (appData.savings || []).reduce((total, saving) => {
    const contribution = getSavingsContribution(saving, savingsMonth);
    return total + (contribution?.paid ? toProfileCurrency(contribution.amount || saving.monthlyContribution, saving.currency) : 0);
  }, 0);
  const remaining = report.incomeTotal - monthlyExpenses - report.loanPaymentTotal - savedThisMonth;
  const monthStart = `${month}-01`;
  const previousMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const comparisonDay = Math.min(today.getDate(), new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1, 0).getDate());
  const previousCutoff = `${previousMonth}-${String(comparisonDay).padStart(2, "0")}`;
  const previousStart = `${previousMonth}-01`;
  const currentExpensesByCategory = new Map();
  const previousExpensesByCategory = new Map();
  (appData.expenses || []).forEach(expense => {
    if (!expense.date) return;
    const amount = toProfileCurrency(expense.amount, expense.currency);
    if (expense.date >= monthStart && expense.date <= todayIso) {
      const category = expense.category || "Other";
      currentExpensesByCategory.set(category, (currentExpensesByCategory.get(category) || 0) + amount);
    } else if (expense.date >= previousStart && expense.date <= previousCutoff) {
      const category = expense.category || "Other";
      previousExpensesByCategory.set(category, (previousExpensesByCategory.get(category) || 0) + amount);
    }
  });
  const spendingChanges = [...currentExpensesByCategory.entries()]
    .map(([category, current]) => ({ category, current, previous: previousExpensesByCategory.get(category) || 0, change: current - (previousExpensesByCategory.get(category) || 0) }))
    .filter(item => item.change > 0)
    .sort((left, right) => right.change - left.change)
    .slice(0, 4);
  const attentionMarkup = attentionItems.length
    ? `<div class="money-smart-rows">${attentionItems.map(item => `<div class="money-smart-row"><a class="money-smart-row-copy" href="${escapeAttr(item.href)}"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.overdue ? t("overdue") : formatDate(item.date, { month: "short", day: "numeric" }))}</small></a><strong class="money-smart-row-amount${item.overdue ? " is-overdue" : ""}">${money(item.amount, item.currency)}</strong>${item.billId ? `<button class="money-smart-bill-state is-unpaid" type="button" data-finance-mark-bill="${escapeAttr(item.billId)}" aria-pressed="false">${escapeHtml(t("billUnpaidLabel"))}</button>` : ""}</div>`).join("")}</div>`
    : `<p class="money-smart-empty">${escapeHtml(t("allCaughtUp"))}</p>`;
  const changesMarkup = spendingChanges.length
    ? `<div class="money-smart-rows">${spendingChanges.map(item => `<a class="money-smart-row" href="#money/expenses"><span class="money-smart-row-copy"><strong>${escapeHtml(optionLabel(item.category))}</strong></span><strong class="money-smart-change">+${money(item.change)}</strong></a>`).join("")}</div>`
    : `<p class="money-smart-empty">${escapeHtml(t("noSpendingIncreaseShort"))}</p>`;
  return `<article class="glass-card card-pad financial-panel money-due-card">
    <div class="financial-panel-heading">
      <div><span class="eyebrow">${escapeHtml(t("comingUp"))}</span><h2 class="section-title">${escapeHtml(languageCode() === "km" ? "ត្រូវបង់ក្នុង ៧ ថ្ងៃ" : "Due in the next 7 days")}</h2></div>
      <span class="pill ${attentionItems.some(item => item.overdue) ? "danger" : ""}">${attentionItems.length}</span>
    </div>
    ${attentionMarkup}
  </article>`;
}

function moneyEmptyCard() {
  return `
    <div class="image-empty-card money-empty-card">
      <img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=78" alt="" loading="lazy">
      <div class="image-empty-content">
        <span class="icon-badge orange">${Icons.money()}</span>
        <h2>${escapeHtml(t("noMoneyYet"))}</h2>
        <p class="secondary">${escapeHtml(t("noMoneyBody"))}</p>
        <button class="button" data-action="add-income">${Icons.plus()} ${t("addIncome")}</button>
      </div>
    </div>
  `;
}

function renderIncome() {
  const categories = incomeCategories.map(category => ({
    category,
    amount: sumMoney(appData.income.filter(item => item.category === category), "amount"),
    color: incomeCategoryColors[category]
  }));
  const total = categories.reduce((sum, item) => sum + item.amount, 0);

  return `<div class="financial-income-layout">
    <aside class="glass-card card-pad financial-panel financial-income-sidebar" aria-label="${t("incomeCategories")}">
      <div class="financial-income-sidebar-heading"><span class="eyebrow">${t("overview")}</span><h2 class="section-title">${t("incomeCategories")}</h2></div>
      <div class="financial-income-category-list">${categories.map(item => {
        const share = total ? Math.round((item.amount / total) * 100) : 0;
        return `<div class="financial-income-category" style="--category-color:${item.color};--category-share:${share}%">
          <span class="financial-income-category-dot" aria-hidden="true"></span>
          <div class="financial-income-category-content"><div class="financial-income-category-line"><span>${optionLabel(item.category)}</span><strong>${money(item.amount)}</strong></div><div class="financial-income-category-track"><span></span></div></div>
        </div>`;
      }).join("")}</div>
      <div class="financial-income-total"><span>${t("totalIncome")}</span><strong>${money(total)}</strong></div>
    </aside>
    <article class="glass-card card-pad financial-panel financial-income-main"><div class="between"><h2 class="section-title">${t("incomeSources")}</h2><button class="button" data-action="add-income">${Icons.plus()} ${t("addIncome")}</button></div><div class="list financial-ledger">${appData.income.map(incomeRow).join("") || emptyState(t("noIncomeYet"), t("noIncomeBody"), t("addIncome"), "add-income")}</div></article>
  </div>`;
}

function incomeRow(item) {
  return `<div class="financial-record-card">
    <span class="financial-record-icon green">${Icons.salary()}</span>
    <div class="financial-record-copy"><strong>${escapeHtml(item.name)}</strong><span>${optionLabel(item.category || "Other")}</span></div>
    <strong class="financial-record-value success">${money(item.amount, item.currency)}</strong>
    <span class="pill financial-record-period">${optionLabel(item.frequency)}</span>
    <div class="financial-record-actions">
      <button class="icon-button" data-edit-income="${escapeAttr(item.id)}" aria-label="${escapeAttr(`${t("editIncome")} ${item.name}`)}" title="${escapeAttr(t("edit"))}">${Icons.edit()}</button>
      <button class="icon-button" data-delete-income="${escapeAttr(item.id)}" aria-label="${escapeAttr(`${t("delete")} ${item.name}`)}" title="${escapeAttr(t("delete"))}">${Icons.trash()}</button>
    </div>
  </div>`;
}

// Expenses page: a month filter, then one group per category (header with count and
// total, compact one-line rows inside). Items saved as "Other" are grouped by what
// their name says (fuel → Transport) — display only, nothing is changed.
let expenseMonthFilter = "";

function expenseGroupOf(item) {
  const category = item.category || "Other";
  if (category !== "Other" || typeof SmartParse === "undefined") return category;
  const guess = SmartParse.categorizeExpense(item.description || "");
  return guess && expenseCategories.includes(guess) ? guess : "Other";
}

function expenseMethodChip(method) {
  const value = String(method || "").trim();
  // only real ways of paying — "Telegram" / "Scan" say where it was recorded, not how it was paid
  if (!value || /^(telegram|scan|smart scan|bot|app|mylife)$/i.test(value)) return "";
  const km = languageCode() === "km";
  const label = /^cash$/i.test(value) ? (km ? "សាច់ប្រាក់" : "Cash") : /^card$/i.test(value) ? (km ? "កាត" : "Card") : /khqr|^qr$/i.test(value) ? "KHQR" : value;
  const icon = /^cash$/i.test(value) ? "💵" : /^card$/i.test(value) ? "💳" : "📱";
  return `<span class="xl-method">${icon} ${escapeHtml(label)}</span>`;
}

function renderExpenses() {
  if (typeof ExpensesV2 !== "undefined") return ExpensesV2.render();
  const km = languageCode() === "km";
  const all = appData.expenses || [];
  const months = [...new Set(all.map(item => String(item.date || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const current = localDateInput().slice(0, 7);
  if (!months.includes(current)) months.unshift(current);
  if (expenseMonthFilter && expenseMonthFilter !== "all" && !months.includes(expenseMonthFilter)) expenseMonthFilter = "";
  const month = expenseMonthFilter || current;
  const items = month === "all" ? all : all.filter(item => String(item.date || "").startsWith(month));
  const monthName = key => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(km ? "km-KH" : "en-US", { month: "long", year: "numeric" });
  };
  const filter = `<label class="xl-month"><span class="sr-only">${km ? "ខែ" : "Month"}</span><select data-expense-month>
      ${months.map(key => `<option value="${key}" ${key === month ? "selected" : ""}>${escapeHtml(monthName(key))}</option>`).join("")}
      <option value="all" ${month === "all" ? "selected" : ""}>${km ? "ទាំងអស់" : "All time"}</option>
    </select></label>`;
  const withBudget = month === current && typeof SmartMoney !== "undefined" && SmartMoney.renderExpenseBudget;
  const spentByGroup = {};
  if (withBudget) items.forEach(item => { const key = expenseGroupOf(item); spentByGroup[key] = (spentByGroup[key] || 0) + Number(item.amount || 0); });
  return `${typeof SmartMoney !== "undefined" ? SmartMoney.renderQuickExpense() : ""}${withBudget ? SmartMoney.renderExpenseBudget(spentByGroup, { open: Boolean(moneyBudgetOpen) }) : ""}<article class="glass-card card-pad financial-panel">
    <div class="between xl-head"><h2 class="section-title">${t("expenses")}</h2><button class="button" data-action="add-expense">${Icons.plus()} ${t("addExpense")}</button></div>
    <div class="xl-toolbar">${filter}<span class="xl-total">${items.length} · <b>${money(sumMoney(items, "amount"))}</b></span></div>
    ${items.length ? expenseGroups(items, { budget: Boolean(withBudget) }) : emptyState(t("noExpensesYet"), t("noExpensesBody"), t("addExpense"), "add-expense")}
  </article>`;
}

// Money overview: only the last 3 days, grouped by category; tap a row to edit it
// a forwarded ABA Pay request saved with the whole message shows only the name
function expenseName(item) {
  const text = item.description || "";
  return typeof SmartParse !== "undefined" && SmartParse.cleanPayText ? SmartParse.cleanPayText(text) : text;
}

function renderRecentExpenses() {
  const km = languageCode() === "km";
  const today = localDateInput();
  const from = new Date(`${today}T00:00:00`);
  from.setDate(from.getDate() - 2);
  const fromIso = localDateInput(from);
  const items = (appData.expenses || []).filter(item => item.date && item.date >= fromIso && item.date <= today);
  const head = `<p class="xl-recent-note">${km ? "៣ ថ្ងៃចុងក្រោយ" : "Last 3 days"} · ${items.length} · <b>-${money(sumMoney(items, "amount"))}</b></p>`;
  if (!items.length) return `${head}<p class="secondary money-period-empty">${km ? "មិនមានចំណាយក្នុង ៣ ថ្ងៃចុងក្រោយទេ" : "No expenses in the last 3 days"}</p>`;
  return head + expenseGroups(items, { actions: false });
}

function expenseGroups(items, { actions = true, budget = false } = {}) {
  const groups = new Map();
  items.forEach(item => {
    const key = expenseGroupOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return `<div class="xl-groups">${[...groups.entries()]
    .map(([category, list]) => ({ category, list: list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))), total: sumMoney(list, "amount") }))
    .sort((a, b) => b.total - a.total)
    .map(({ category, list, total }) => `<details class="xl-group" open style="--cat:${expenseCategoryColors[category] || "#8a94a6"}">
      <summary><span class="xl-group-icon">${Icons[expenseCategoryIcons[category] || "expense"]()}</span><strong>${escapeHtml(optionLabel(category))}</strong><em>${list.length}</em><b>-${money(total)}</b>${Icons.chevron()}</summary>
      ${budget ? SmartMoney.budgetLine(category, total) : ""}<div class="xl-rows">${list.map(item => expenseRow(item, { compact: true, actions })).join("")}</div>
    </details>`).join("")}</div>`;
}

function expenseLedger(items) {
  if (!items.length) return emptyState(t("noExpensesYet"), t("noExpensesBody"), t("addExpense"), "add-expense");
  return `<div class="xl-rows xl-rows-plain">${items.map(item => expenseRow(item, { compact: true, showCategory: true })).join("")}</div>`;
}

function expenseRow(item, { compact = false, showCategory = false, actions = true } = {}) {
  const category = item.category || "Other";
  const group = expenseGroupOf(item);
  const date = formatDate(item.date, { month: "short", day: "numeric" });
  if (compact && !actions) {
    // whole row opens the edit form (no small buttons → calmer list)
    return `<button type="button" class="xl-row xl-row-tap" data-edit-expense="${escapeAttr(item.id)}" style="--cat:${expenseCategoryColors[group] || "#8a94a6"}">
      <div class="xl-row-copy"><strong>${escapeHtml(expenseName(item) || optionLabel(category))}</strong><span>${escapeHtml(date)}${expenseMethodChip(item.method)}</span></div>
      <strong class="xl-row-amount">-${money(item.amount, item.currency)}</strong>
    </button>`;
  }
  if (compact) {
    return `<div class="xl-row" style="--cat:${expenseCategoryColors[group] || "#8a94a6"}">
      ${showCategory ? `<span class="xl-row-icon">${Icons[expenseCategoryIcons[group] || "expense"]()}</span>` : ""}
      <div class="xl-row-copy"><strong>${escapeHtml(expenseName(item) || optionLabel(category))}</strong><span>${showCategory ? `${escapeHtml(optionLabel(group))} · ` : ""}${escapeHtml(date)}${expenseMethodChip(item.method)}</span></div>
      <strong class="xl-row-amount">-${money(item.amount, item.currency)}</strong>
      <div class="xl-row-actions">
        <button class="icon-button" data-edit-expense="${escapeAttr(item.id)}" aria-label="${escapeAttr(`${t("edit")} ${item.description}`)}" title="${escapeAttr(t("edit"))}">${Icons.edit()}</button>
        <button class="icon-button" data-delete-expense="${escapeAttr(item.id)}" aria-label="${escapeAttr(`${t("delete")} ${item.description}`)}" title="${escapeAttr(t("delete"))}">${Icons.trash()}</button>
      </div>
    </div>`;
  }
  return `<div class="financial-record-card">
    <span class="financial-record-icon expense">${Icons[expenseCategoryIcons[category] || "expense"]()}</span>
    <div class="financial-record-copy"><strong>${escapeHtml(expenseName(item))}</strong><span>${optionLabel(category)} · ${date}</span></div>
    <strong class="financial-record-value danger">-${money(item.amount, item.currency)}</strong>
    <div class="financial-record-actions">
      <button class="icon-button" data-edit-expense="${escapeAttr(item.id)}" aria-label="${escapeAttr(`${t("edit")} ${item.description}`)}" title="${escapeAttr(t("edit"))}">${Icons.edit()}</button>
      <button class="icon-button" data-delete-expense="${escapeAttr(item.id)}" aria-label="${escapeAttr(`${t("delete")} ${item.description}`)}" title="${escapeAttr(t("delete"))}">${Icons.trash()}</button>
    </div>
  </div>`;
}

function renderSavings() {
  return `<article class="glass-card card-pad financial-panel"><div class="between"><h2 class="section-title">${t("savings")}</h2><button class="button" data-action="add-savings">${Icons.plus()} ${t("addSavings")}</button></div>${appData.savings.length ? `<div class="grid three-col financial-card-grid">${appData.savings.map(savingCard).join("")}</div>` : emptyState(t("noSavingsYet"), t("noSavingsBody"), t("addSavings"), "add-savings")}</article>`;
}

function getSavingsContributionMonth() {
  return localDateInput().slice(0, 7);
}

function formatSavingsMonth(monthKey) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { month: "short", year: "numeric" });
}

function getSavingsContribution(item, monthKey = getSavingsContributionMonth()) {
  const contributions = Array.isArray(item.contributions) ? item.contributions : [];
  return contributions.find(entry => entry && entry.month === monthKey) || null;
}

function savingCard(item) {
  const monthKey = getSavingsContributionMonth();
  const contribution = getSavingsContribution(item, monthKey);
  const isPaidThisMonth = Boolean(contribution && contribution.paid);
  const monthlyAmount = Number(item.monthlyContribution || 0);
  const recentHistory = (Array.isArray(item.contributions) ? item.contributions : [])
    .slice(0, 4)
    .map(entry => `<div class="savings-history-row ${entry.paid ? "paid" : ""}"><span>${formatSavingsMonth(entry.month)}</span><strong>${money(Number(entry.amount || item.monthlyContribution || 0), item.currency)}</strong></div>`)
    .join("");
  const progress = pct(item.currentAmount, item.targetAmount);

  return `<div class="financial-savings-card">
    <div class="financial-savings-header">
      <span class="financial-record-icon savings">${Icons.savings()}</span>
      <div class="financial-savings-title"><strong>${escapeHtml(item.name)}</strong><span>${t("savings")}</span></div>
      <span class="pill financial-savings-progress">${progress}%</span>
    </div>
    <div class="financial-savings-balance"><strong>${money(item.currentAmount, item.currency)}</strong><span>/ ${money(item.targetAmount, item.currency)}</span></div>
    <div class="progress-track"><div class="progress-fill" style="--progress:${progress}%"></div></div>
    ${typeof SmartMoney !== "undefined" ? SmartMoney.savingsPace(item) : ""}
    <div class="financial-savings-metrics">
      <div><span>${Icons.calendar()}${t("deadline")}</span><strong>${formatDate(item.deadline)}</strong></div>
      <div><span>${Icons.salary()}${t("monthlyContribution")}</span><strong>${money(monthlyAmount, item.currency)}</strong></div>
    </div>
    <section class="savings-smart-panel">
      <div class="savings-smart-heading"><strong>${t("thisMonth")}</strong><span class="pill ${isPaidThisMonth ? "success" : ""}">${isPaidThisMonth ? t("saved") : t("pending")}</span></div>
      <label class="payment-schedule-row ${isPaidThisMonth ? "paid" : ""}"><input class="check" type="checkbox" data-savings-contribution="${escapeAttr(item.id)}" data-savings-month="${escapeAttr(monthKey)}" ${isPaidThisMonth ? "checked" : ""}><span><strong>${formatSavingsMonth(monthKey)}</strong><small>${money(monthlyAmount, item.currency)}</small></span></label>
      ${recentHistory ? `<details class="savings-history-details"><summary>${t("recentTransactions")}</summary><div class="savings-history-list">${recentHistory}</div></details>` : ""}
    </section>
    <div class="financial-record-actions financial-savings-actions">
      <button class="icon-button" data-edit-savings="${escapeAttr(item.id)}" aria-label="${escapeAttr(`${t("edit")} ${item.name}`)}" title="${escapeAttr(t("edit"))}">${Icons.edit()}</button>
      <button class="icon-button" data-delete-savings="${escapeAttr(item.id)}" aria-label="${escapeAttr(`${t("delete")} ${item.name}`)}" title="${escapeAttr(t("delete"))}">${Icons.trash()}</button>
    </div>
  </div>`;
}

// Read-only: bills that look like a loan payment, and months that may be counted
// twice. Nothing is changed until the user links the bill (or deletes it).
function renderLoanDoubleCheck() {
  if (typeof LoanPay === "undefined") return "";
  const found = LoanPay.findDoubleCounts(appData);
  if (!found.length) return "";
  const km = languageCode() === "km";
  const rows = found.map(entry => entry.type === "expense-counted-twice"
    ? `<div class="loan-check-row"><span>⚠️ ${escapeHtml(entry.month)} · ${km ? "ចំណាយ" : "Expense"} <b>${escapeHtml(entry.expenseName)}</b> ${km ? "និង" : "and"} <b>${escapeHtml(entry.loanName || "")}</b> · ${money(entry.amount, entry.currency)} ${km ? "ជាការបង់តែមួយ ប៉ុន្តែរាប់ ២ ដង" : "are one payment but counted twice"}</span><button class="button ghost-button" type="button" data-link-expense="${escapeAttr(entry.expenseId)}" data-link-loan="${escapeAttr(entry.loanId)}" data-link-date="${escapeAttr(entry.date)}">${km ? "ភ្ជាប់" : "Link"}</button></div>`
    : entry.type === "counted-twice"
    ? `<div class="loan-check-row"><span>⚠️ ${escapeHtml(entry.month)} · ${escapeHtml(entry.billName || "")} + ${escapeHtml(entry.loanName || "")} · ${money(entry.amount, entry.currency)} ${km ? "ប្រហែលជារាប់ ២ ដង" : "may be counted twice"}</span></div>`
    : `<div class="loan-check-row"><span>🔗 ${km ? "វិក្កយបត្រ" : "Bill"} <b>${escapeHtml(entry.billName || "")}</b> ${km ? "ដូចការបង់កម្ចី" : "looks like the payment of"} <b>${escapeHtml(entry.loanName || "")}</b> (${money(entry.amount, entry.currency)})</span><button class="button ghost-button" type="button" data-link-bill="${escapeAttr(entry.billId)}">${km ? "ភ្ជាប់" : "Link"}</button></div>`).join("");
  return `<div class="loan-check-card"><h3>${km ? "ពិនិត្យការរាប់ស្ទួន" : "Check for double counting"}</h3><p>${km ? "ចុច “ភ្ជាប់” ដើម្បីឲ្យការបង់តែមួយ រាប់តែម្តង។ មិនលុបអ្វីទេ ហើយមិនប្តូរអ្វីដោយខ្លួនឯងទេ។" : "Tap “Link” so one payment is counted once. Nothing is deleted, and nothing changes on its own."}</p>${rows}</div>`;
}

function renderLoans() {
  return `<article class="glass-card card-pad financial-panel"><div class="between"><h2 class="section-title">${t("loans")}</h2><button class="button" data-action="add-loan">${Icons.plus()} ${t("addLoan")}</button></div>${renderLoanDoubleCheck()}${appData.loans.length ? `<div class="grid loan-list">${appData.loans.map(loanCard).join("")}</div>` : emptyState(t("noLoansYet"), t("noLoansBody"))}</article>`;
}

function loanCard(loan) {
  const remaining = loanRemaining(loan);
  const paid = loanPaid(loan);
  const totalPayable = loanPayoffAmount(loan);
  const totalInterest = Math.max(0, totalPayable - Number(loan.originalAmount || 0));
  const progressTarget = totalPayable || Number(loan.originalAmount || 0);
  const progress = pct(paid, progressTarget);
  const paymentDay = loanDisplayPaymentDay(loan);
  return `<div class="loan-card">
    <div class="loan-card-header">
      <div class="loan-card-title"><h3>${escapeHtml(loan.name)}</h3><div class="loan-summary-tags">
        <span>${Icons.calendar()}${loan.durationMonths ? `${loan.durationMonths} ${t("months")}` : optionLabel(loan.paymentFrequency || "Monthly")}</span>
        <span>${Icons.chart()}${t("interest")} ${loan.interestRate || 0}%</span>
        <span>${Icons.calendar()}${t("paymentDay")} ${paymentDay ? formatPaymentDay(paymentDay) : t("notSet")}</span>
      </div></div>
      <span class="icon-badge blue">${Icons.loan()}</span>
    </div>
    <div class="loan-metrics">
      <div class="loan-metric loan-metric-primary"><span class="loan-metric-label">${Icons.wallet()}${t("remaining")}</span><strong>${money(remaining, loan.currency)}</strong></div>
      <div class="loan-metric"><span class="loan-metric-label">${Icons.salary()}${t("monthlyPayment")}</span><strong>${money(loan.monthlyPayment, loan.currency)}</strong></div>
      <div class="loan-metric"><span class="loan-metric-label">${Icons.calendar()}${t("nextPaymentDate")}</span><strong>${formatDate(nextLoanPaymentDate(loan), { month: "short", day: "numeric" })}</strong></div>
      <div class="loan-metric"><span class="loan-metric-label">${Icons.calendar()}${t("dueDate")}</span><strong>${formatDate(loan.dueDate, { month: "short", year: "numeric" })}</strong></div>
    </div>
    <div class="loan-progress-panel">
      <div class="loan-progress-heading"><span>${t("paid")}</span><strong>${progress}%</strong></div>
      <div class="progress-track"><div class="progress-fill" style="--progress:${progress}%"></div></div>
      <div class="loan-progress-amount"><strong>${money(paid, loan.currency)}</strong><span>/</span><span>${money(progressTarget, loan.currency)}</span></div>
    </div>
    <details class="loan-details">
      <summary>${Icons.info()}<span>${t("loanDetails")}</span></summary>
      <div class="loan-meta">
        <div><span>${t("original")}</span><strong>${money(loan.originalAmount, loan.currency)}</strong></div>
        <div><span>${t("firstPaymentDate")}</span><strong>${formatDate(loan.firstPaymentDate || loan.startDate)}</strong></div>
        <div><span>${t("totalInterest")}</span><strong>${money(totalInterest, loan.currency)}</strong></div>
      </div>
    </details>
    ${renderLoanPaymentSchedule(loan)}
    <div class="loan-card-actions">
      <button class="button" data-payment-loan="${escapeAttr(loan.id)}">${Icons.plus()} ${t("makePayment")}</button>
      <button class="icon-button loan-action-icon" data-edit-loan="${escapeAttr(loan.id)}" aria-label="${escapeAttr(`${t("edit")} ${loan.name}`)}" title="${escapeAttr(t("edit"))}">${Icons.edit()}</button>
      <button class="icon-button loan-action-icon" data-delete-loan="${escapeAttr(loan.id)}" aria-label="${escapeAttr(`${t("delete")} ${loan.name}`)}" title="${escapeAttr(t("delete"))}">${Icons.trash()}</button>
    </div>
  </div>`;
}

function renderLoanPaymentSchedule(loan) {
  const schedule = loanPaymentScheduleToCurrent(loan);
  if (!schedule.length) return "";
  return `<details class="payment-schedule"><summary><span>${t("paymentSchedule")}</span><span class="pill">${schedule.filter(item => item.paid).length}/${schedule.length}</span></summary><div class="payment-schedule-list">${schedule.map(item => `<label class="payment-schedule-row ${item.paid ? "paid" : ""}"><input class="check" type="checkbox" data-loan-schedule="${loan.id}" data-payment-date="${item.date}" ${item.paid ? "checked" : ""}><span><strong>${formatDate(item.date)}</strong><small>${money(item.amount, loan.currency)}</small></span></label>`).join("")}</div></details>`;
}

function loanDisplayPaymentDay(loan) {
  const firstPaymentDate = loan.firstPaymentDate || loan.startDate;
  if (!firstPaymentDate) return loanPaymentDay(loan);
  const first = parseAppDate(firstPaymentDate);
  return Number.isNaN(first.getTime()) ? loanPaymentDay(loan) : first.getDate();
}

function formatPaymentDay(day) {
  const value = Number(day || 0);
  if (!value) return t("notSet");
  if (languageCode() === "km") return String(value);
  const suffix = value % 10 === 1 && value % 100 !== 11 ? "st" : value % 10 === 2 && value % 100 !== 12 ? "nd" : value % 10 === 3 && value % 100 !== 13 ? "rd" : "th";
  return `${value}${suffix}`;
}

function renderBills() {
  return `<article class="glass-card card-pad financial-panel"><div class="between"><h2 class="section-title">${t("bills")}</h2><button class="button" data-action="add-bill">${Icons.plus()} ${t("addBill")}</button></div>${appData.bills.length ? `<div class="grid four-col financial-card-grid">${appData.bills.map(billCard).join("")}</div>` : emptyState(t("noBillsYet"), t("noBillsBody"), t("addBill"), "add-bill")}</article>`;
}

function billCard(bill) {
  const paid = billPaidCurrentCycle(bill);
  const statusLabel = paid ? `${Icons.check()}${escapeHtml(t("billPaidLabel"))}` : `⏳ ${escapeHtml(t("billUnpaidLabel"))}`;
  return `<div class="financial-bill-card">
    <div class="financial-bill-header"><span class="financial-record-icon bill">${Icons.bill()}</span><span class="pill bill-status ${paid ? "is-paid" : "is-unpaid"}">${statusLabel}</span></div>
    <h3>${escapeHtml(bill.name)}</h3>
    <strong class="financial-bill-amount">${!(Number(bill.amount) > 0) && bill.invoiceUrl ? (languageCode() === "km" ? "— មើលវិក្កយបត្រ" : "— see invoice") : money(bill.amount, bill.currency)}</strong>
    <div class="financial-bill-meta"><span>${Icons.calendar()}${t("dueDate")}</span><strong>${formatDate(bill.due)}</strong></div>
    <div class="financial-bill-tags"><span>${optionLabel(bill.frequency)}</span><span>${optionLabel(bill.category)}</span>${bill.autoPay ? `<span class="bill-autopay-tag">🔁 ${languageCode() === "km" ? "ស្វ័យប្រវត្តិ" : "Auto-pay"}</span>` : ""}${!paid && bill.invoiceAt && Date.now() - Date.parse(bill.invoiceAt) < 20 * 86400000 ? `<span class="bill-invoice-tag">🆕 ${languageCode() === "km" ? "វិក្កយបត្រថ្មី" : "New invoice"}</span>` : ""}</div>
    ${/^https:\/\//.test(bill.invoiceUrl || "") ? `<a class="bill-invoice-link" href="${escapeAttr(bill.invoiceUrl)}" target="_blank" rel="noopener">🔗 ${languageCode() === "km" ? "មើលវិក្កយបត្រ" : "View invoice"}</a>` : ""}
    <div class="financial-bill-actions">
      ${paid
        ? `<button class="button ghost-button bill-payment-action bill-act-undo" data-finance-toggle-bill="${escapeAttr(bill.id)}" aria-pressed="true" title="${escapeAttr(languageCode() === "km" ? "ប្តូរទៅជាមិនទាន់បង់" : "Mark as not paid")}">↺ ${languageCode() === "km" ? "មិនទាន់បង់" : "Not paid"}</button>`
        : `<button class="button bill-payment-action bill-act-pay" data-finance-toggle-bill="${escapeAttr(bill.id)}" aria-pressed="false">${Icons.check()}${languageCode() === "km" ? "កត់ថាបង់រួច" : "Mark paid"}</button>`}
      <button class="icon-button" data-edit-bill="${escapeAttr(bill.id)}" aria-label="${escapeAttr(`${t("edit")} ${bill.name}`)}" title="${escapeAttr(t("edit"))}">${Icons.edit()}</button>
      <button class="icon-button" data-delete-bill="${escapeAttr(bill.id)}" aria-label="${escapeAttr(`${t("delete")} ${bill.name}`)}" title="${escapeAttr(t("delete"))}">${Icons.trash()}</button>
    </div>
  </div>`;
}

function renderBudget() {
  if (typeof SmartMoney !== "undefined") return SmartMoney.renderBudgetTab();
  const categories = [...new Set(appData.expenses.map(expense => expense.category))];
  return `<article class="glass-card card-pad financial-panel"><div class="financial-panel-heading"><div><span class="eyebrow">${t("budget")}</span><h2 class="section-title">${t("spendingByCategory")}</h2></div><span class="icon-badge blue">${Icons.budget()}</span></div><div class="grid financial-card-grid financial-budget-grid">${categories.map(category => {
    const spent = sumMoney(appData.expenses.filter(e => e.category === category), "amount");
    const max = Math.max(...categories.map(cat => sumMoney(appData.expenses.filter(e => e.category === cat), "amount")), 1);
    const progress = pct(spent, max);
    return `<div class="financial-budget-card"><div class="financial-budget-heading"><span class="financial-record-icon expense">${Icons[expenseCategoryIcons[category] || "expense"]()}</span><strong>${optionLabel(category)}</strong></div><strong class="financial-budget-amount">${money(spent)}</strong><div class="progress-track"><div class="progress-fill" style="--progress:${progress}%"></div></div><span class="financial-budget-share">${progress}%</span></div>`;
  }).join("") || emptyState(t("noBudgetYet"), t("noBudgetBody"), t("addExpense"), "add-expense")}</div></article>`;
}

function renderReports() {
  const month = financeReportMonth || localDateInput().slice(0, 7);
  // Report Center is the whole page now; insights, Word and Excel live in its viewer
  if (typeof ReportCenter !== "undefined") return ReportCenter.render();
  const report = buildMonthlyFinanceReport(month);
  return `<article class="glass-card card-pad financial-panel financial-report-panel">
    <div class="financial-report-toolbar">
      <div class="financial-report-heading"><span class="icon-badge blue">${Icons.chart()}</span><div><span class="eyebrow">${t("reports")}</span><h2 class="section-title">${t("monthlyReport")}</h2></div></div>
      <label class="field financial-report-month"><span>${t("reportMonth")}</span><input type="month" value="${escapeAttr(month)}" data-finance-report-month></label>
      <div class="financial-report-export-actions">
        <button class="button" type="button" data-finance-report-export="excel">${Icons.arrowDown()} ${t("exportExcel")}</button>
        <button class="button ghost-button" type="button" data-finance-report-export="word">${Icons.arrowDown()} ${t("exportWord")}</button>
        <button class="button ghost-button" type="button" data-finance-report-preview>${Icons.memory()} ${t("previewJpg")}</button>
        <button class="button finance-report-telegram" type="button" data-finance-report-telegram><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg> ${languageCode() === "km" ? "ផ្ញើ JPG + Excel ទៅ Telegram" : "Send JPG + Excel to Telegram"}</button>
      </div>
    </div>
    <div class="financial-report-metadata">
      <div><span>${t("reportOwner")}</span><strong>${escapeHtml(report.ownerName)}</strong></div>
      <div><span>${t("reportMonth")}</span><strong>${escapeHtml(report.monthLabel)}</strong></div>
      <div><span>${t("reportCurrency")}</span><strong>${escapeHtml(report.currency)}</strong></div>
      <div><span>${t("generatedOn")}</span><strong>${escapeHtml(report.generatedOn)}</strong></div>
    </div>
    <div class="financial-report-summary">
      <div class="financial-report-metric income"><span>${t("monthlyIncome")}</span><strong>${money(report.incomeTotal)}</strong></div>
      <div class="financial-report-metric expenses"><span>${t("monthlyExpenses")}</span><strong>${money(report.expenseTotal)}</strong></div>
      <div class="financial-report-metric payments"><span>${t("monthlyPayment")}</span><strong>${money(report.loanPaymentTotal)}</strong></div>
      <div class="financial-report-metric cash-flow"><span>${t("netCashFlow")}</span><strong>${money(report.netCashFlow)}</strong></div>
    </div>
    ${report.savingsGoalCount ? `<p class="financial-report-saved"><span>${Icons.savings()}</span>${escapeHtml(languageCode() === "km" ? "ដាក់សន្សំខែនេះ" : "Saved this month")} <strong>${money(report.savedTotal)}</strong><small>${report.savedCount}/${report.savingsGoalCount}</small></p>` : ""}
    ${typeof ReportInsights !== "undefined" ? (() => {
      const info = ReportInsights.build(month);
      return `<div class="financial-report-insights">
        <div class="fri-col"><h3>💡 ${languageCode() === "km" ? "ការយល់ដឹង" : "Insights"}</h3><ul>${info.insights.map(item => `<li class="fri-${item.tone}">${escapeHtml(item.text)}</li>`).join("")}</ul></div>
        ${info.categories.length ? `<div class="fri-col"><h3>${t("spendingByCategory")}</h3>${info.categories.slice(0, 6).map(item => `<div class="fri-bar"><span>${escapeHtml(item.label)}</span><i><b style="width:${Math.max(4, Math.round(item.share * 100))}%;background:${item.color}"></b></i><em>${Math.round(item.share * 100)}%</em></div>`).join("")}</div>` : ""}
      </div>`;
    })() : ""}
    <div class="financial-report-table-wrap">
      <table class="financial-report-table">
        <thead><tr><th>${t("type")}</th><th>${t("description")}</th><th>${t("category")}</th><th>${t("date")} / ${t("frequency")}</th><th>${t("amount")}</th></tr></thead>
        <tbody>${report.rows.length ? report.rows.map(row => `<tr><td data-label="${escapeAttr(t("type"))}">${escapeHtml(row.type)}</td><td data-label="${escapeAttr(t("description"))}">${escapeHtml(row.description)}</td><td data-label="${escapeAttr(t("category"))}">${escapeHtml(row.category)}</td><td data-label="${escapeAttr(`${t("date")} / ${t("frequency")}`)}">${escapeHtml(row.period)}</td><td data-label="${escapeAttr(t("amount"))}" class="${row.amount < 0 ? "financial-report-outflow" : ""}">${money(row.amount)}</td></tr>`).join("") : `<tr><td class="financial-report-empty" colspan="5">${t("noMonthlyTransactions")}</td></tr>`}</tbody>
      </table>
    </div>
    <dialog class="financial-report-preview-dialog" data-finance-report-preview-dialog aria-labelledby="financialReportPreviewTitle">
      <div class="financial-report-preview-content">
        <header class="financial-report-preview-header">
          <div><h2 id="financialReportPreviewTitle">${t("monthlyReport")}</h2><span data-finance-report-preview-month></span></div>
          <button class="icon-button" type="button" data-close-finance-report-preview aria-label="${t("close")}">${Icons.close()}</button>
        </header>
        <div class="financial-report-preview-stage"><img data-finance-report-preview-image alt="${escapeAttr(t("monthlyReport"))}"></div>
        <footer class="financial-report-preview-footer">
          <button class="button" type="button" data-finance-report-download-jpg>${Icons.arrowDown()} ${t("downloadJpg")}</button>
        </footer>
      </div>
    </dialog>
  </article>`;
}

function buildMonthlyFinanceReport(month) {
  const incomeRows = (appData.income || []).flatMap(item => {
    const frequency = item.frequency || "Monthly";
    const recurring = item.recurring !== false && frequency !== "Once";
    const date = item.nextPaymentDate || String(item.createdAt || "").slice(0, 10);
    if (!recurring && date.slice(0, 7) !== month) return [];

    // Recurring income is only spendable after it is marked received for this month.
    const received = item.received && typeof item.received === "object" ? item.received[month] : null;
    if (recurring && !(Number(received?.amount) > 0)) return [];
    const amount = received && Number(received.amount) > 0
      ? toProfileCurrency(Number(received.amount), received.currency || item.currency)
      : toProfileCurrency(Number(item.amount || 0), item.currency);
    return [{
      type: t("income"),
      description: item.name || t("income"),
      category: optionLabel(item.category || "Other"),
      period: recurring ? `${optionLabel(frequency)} · ${t("monthlyEquivalent")}` : (date ? formatDate(date) : ""),
      amount
    }];
  });
  const monthExpenses = (appData.expenses || []).filter(item => String(item.date || "").slice(0, 7) === month);
  const expenseRows = monthExpenses.map(item => ({
    type: t("expense"),
    description: item.description || t("expense"),
    category: optionLabel(item.category || "Other"),
    period: formatDate(item.date),
    amount: -Math.abs(toProfileCurrency(item.amount, item.currency))
  }));
  // payments with an expenseId are already in expenseRows (category Loan): count them once
  const paymentRows = (appData.loans || []).flatMap(loan => (loan.payments || [])
    .filter(payment => !payment.expenseId && String(payment.date || "").slice(0, 7) === month)
    .map(payment => ({
      type: t("loan"),
      description: loan.name || t("loan"),
      category: t("paid"),
      period: formatDate(payment.date),
      amount: -Math.abs(toProfileCurrency(payment.amount, payment.currency || loan.currency))
    })));
  const outflowRows = [...expenseRows, ...paymentRows].sort((left, right) => left.period.localeCompare(right.period));
  const incomeTotal = incomeRows.reduce((total, row) => total + row.amount, 0);
  const expenseTotal = sumMoney(monthExpenses, "amount");
  const loanPaymentTotal = paymentRows.reduce((total, row) => total - row.amount, 0);
  // money put into savings this month (ticked on the card, the pop-up after salary, or Telegram ✅)
  const savingGoals = (appData.savings || []).filter(saving => Number(saving.monthlyContribution) > 0);
  const savedEntries = (appData.savings || []).map(saving => ({ saving, entry: getSavingsContribution(saving, month) })).filter(({ entry }) => entry && entry.paid);
  const savedTotal = savedEntries.reduce((total, { saving, entry }) => total + toProfileCurrency(Number(entry.amount || saving.monthlyContribution || 0), saving.currency), 0);

  return {
    month,
    monthLabel: new Date(`${month}-01T00:00:00`).toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { month: "long", year: "numeric" }),
    ownerName: String(appData.profile.name || "").trim() || t("yourName"),
    currency: appData.profile.currency || "USD",
    generatedOn: new Intl.DateTimeFormat(languageCode() === "km" ? "km-KH" : "en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date()),
    incomeTotal,
    expenseTotal,
    loanPaymentTotal,
    netCashFlow: incomeTotal - expenseTotal - loanPaymentTotal,
    savedTotal,
    savedCount: savedEntries.length,
    savingsGoalCount: savingGoals.length,
    rows: [...incomeRows, ...outflowRows]
  };
}

function monthlyFinanceReportHtml(report) {
  const headers = [t("type"), t("description"), t("category"), `${t("date")} / ${t("frequency")}`, t("amount")];
  const summary = [
    [t("monthlyIncome"), formatPlainMoney(report.incomeTotal)],
    [t("monthlyExpenses"), formatPlainMoney(report.expenseTotal)],
    [t("monthlyPayment"), formatPlainMoney(report.loanPaymentTotal)],
    [t("netCashFlow"), formatPlainMoney(report.netCashFlow)],
    ...(report.savingsGoalCount ? [[languageCode() === "km" ? "ដាក់សន្សំ" : "Saved", formatPlainMoney(report.savedTotal)]] : [])
  ];
  const details = [
    [t("reportOwner"), report.ownerName],
    [t("reportMonth"), report.monthLabel],
    [t("reportCurrency"), report.currency],
    [t("generatedOn"), report.generatedOn]
  ];
  const rows = report.rows.map(row => [row.type, row.description, row.category, row.period, formatPlainMoney(row.amount)]);
  const fontStack = '"Kantumruy Pro","Khmer OS System","Leelawadee UI",Calibri,Arial,sans-serif';
  const table = (data, widths) => `<table style="width:100%;table-layout:fixed;border-collapse:collapse;margin:12px 0 24px;font-family:${fontStack};font-size:11pt"><colgroup>${widths.map(width => `<col style="width:${width}%">`).join("")}</colgroup><thead><tr>${data[0].map((cell, index) => `<th style="border:1px solid #aebc9f;padding:9px 10px;background:#c5ff60;color:#182313;font-family:${fontStack};font-size:10pt;font-weight:bold;text-align:${index === data[0].length - 1 ? "right" : "left"};vertical-align:top">${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${data.slice(1).map((row, rowIndex) => `<tr>${row.map((cell, index) => `<td style="border:1px solid #d5ddcc;padding:8px 10px;background:${rowIndex % 2 ? "#f4f7ef" : "#ffffff"};color:#20251b;font-family:${fontStack};font-size:11pt;text-align:${index === row.length - 1 ? "right" : "left"};vertical-align:top;word-wrap:break-word">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const transactionRows = rows.length ? rows : [[t("noMonthlyTransactions"), "", "", "", ""]];
  const detailTable = `<table style="width:100%;border-collapse:collapse;margin:12px 0 24px;font-family:${fontStack};font-size:11pt"><tbody>${details.map(([label, value]) => `<tr><th style="width:30%;border:1px solid #d5ddcc;padding:8px 10px;background:#f4f7ef;color:#35491b;font-family:${fontStack};text-align:left">${escapeHtml(label)}</th><td style="border:1px solid #d5ddcc;padding:8px 10px;background:#ffffff;color:#20251b;font-family:${fontStack}">${escapeHtml(value)}</td></tr>`).join("")}</tbody></table>`;
  const inlineFont = `font-family:${fontStack};`;
  return `<html><head><meta charset="utf-8"><style>body{${inlineFont}margin:28px 36px;color:#20251b}h1{font-size:22pt;color:#202c18;margin:0 0 6px}h2{font-size:14pt;color:#35491b;margin:24px 0 8px}p{font-size:11pt;color:#59634f;margin:0 0 18px}</style></head><body style="${inlineFont}margin:28px 36px;color:#20251b"><h1 style="${inlineFont}font-size:22pt;color:#202c18;margin:0 0 6px">${escapeHtml(t("monthlyReport"))}</h1>${detailTable}<h2 style="${inlineFont}font-size:14pt;color:#35491b;margin:24px 0 8px">${escapeHtml(t("financialAnalytics"))}</h2>${table([[t("summary"), t("amount")], ...summary], [58, 42])}${report.insights ? `<h2 style="${inlineFont}font-size:14pt;color:#35491b;margin:24px 0 8px">💡 ${escapeHtml(languageCode() === "km" ? "ការយល់ដឹង" : "Insights")}</h2><ul style="${inlineFont}font-size:11pt;color:#20251b;margin:8px 0 18px">${report.insights.map(item => `<li style="margin:4px 0;color:${item.tone === "warn" ? "#b42339" : item.tone === "good" ? "#1b7a35" : "#20251b"}">${escapeHtml(item.text)}</li>`).join("")}</ul>` : ""}${report.categories?.length ? `<h2 style="${inlineFont}font-size:14pt;color:#35491b;margin:24px 0 8px">${escapeHtml(t("spendingByCategory"))}</h2>${table([[t("category"), t("amount"), "%"], ...report.categories.map(item => [item.label, formatPlainMoney(item.amount), `${Math.round(item.share * 100)}%`])], [50, 30, 20])}` : ""}<h2 style="${inlineFont}font-size:14pt;color:#35491b;margin:24px 0 8px">${escapeHtml(t("recentTransactions"))}</h2>${table([headers, ...transactionRows], [14, 25, 17, 25, 19])}</body></html>`;
}

function wrapFinanceCanvasText(context, value, maxWidth, font) {
  context.font = font;
  const words = String(value || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = "";
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

async function createMonthlyFinanceReportCanvas(report) {
  if (document.fonts?.ready) await document.fonts.ready;
  const fontStack = '"Kantumruy Pro","Khmer OS System","Leelawadee UI",Calibri,Arial,sans-serif';
  const regularFont = `500 16px ${fontStack}`;
  const boldFont = `700 16px ${fontStack}`;
  const width = 1240;
  const a5Height = 1754;
  const margin = 56;
  const columnWidths = [106, 292, 168, 346, 216];
  const metadata = [
    [t("reportOwner"), report.ownerName],
    [t("reportMonth"), report.monthLabel],
    [t("reportCurrency"), report.currency],
    [t("generatedOn"), report.generatedOn]
  ];
  const headers = [t("type"), t("description"), t("category"), `${t("date")} / ${t("frequency")}`, t("amount")];
  const rows = report.rows.length
    ? report.rows.map(row => [row.type, row.description, row.category, row.period, formatPlainMoney(row.amount)])
    : [[t("noMonthlyTransactions"), "", "", "", ""]];
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  const lineHeight = 26;
  const horizontalCellPadding = 20;
  const rowLines = rows.map(row => row.map((cell, index) => wrapFinanceCanvasText(measureContext, cell, columnWidths[index] - horizontalCellPadding, regularFont)));
  const rowHeights = rowLines.map(lines => Math.max(1, ...lines.map(cellLines => cellLines.length)) * lineHeight + 22);
  const metadataCellWidth = (width - margin * 2 - 12) / 2;
  const metadataValueFont = `500 16px ${fontStack}`;
  const metadataValueLines = metadata.map(([, value]) => wrapFinanceCanvasText(measureContext, value, metadataCellWidth - 28, metadataValueFont));
  const metadataRows = [[0, 1], [2, 3]];
  const metadataRowHeights = metadataRows.map(indices => Math.max(...indices.map(index => metadataValueLines[index].length)) * 22 + 44);
  const metadataTop = 112;
  const metadataBottom = metadataTop + metadataRowHeights.reduce((total, rowHeight) => total + rowHeight, 0);
  const summaryTop = metadataBottom + 20;
  const transactionTitleTop = summaryTop + 150;
  const tableTop = transactionTitleTop + 46;
  const headerHeight = 56;
  const height = Math.max(a5Height, tableTop + headerHeight + rowHeights.reduce((total, rowHeight) => total + rowHeight, 0) + 64);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.textBaseline = "top";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#c5ff60";
  context.fillRect(0, 0, width, 18);

  context.fillStyle = "#202c18";
  context.font = `700 34px ${fontStack}`;
  context.fillText(t("monthlyReport"), margin, 54);

  let metadataY = metadataTop;
  metadataRows.forEach((indices, rowIndex) => {
    const rowHeight = metadataRowHeights[rowIndex];
    indices.forEach((index, columnIndex) => {
      const x = margin + columnIndex * (metadataCellWidth + 12);
      const [label] = metadata[index];
      context.fillStyle = "#f4f7ef";
      context.fillRect(x, metadataY, metadataCellWidth, rowHeight - 6);
      context.fillStyle = "#66715e";
      context.font = `600 14px ${fontStack}`;
      context.fillText(label, x + 14, metadataY + 9, metadataCellWidth - 28);
      context.fillStyle = "#202c18";
      context.font = metadataValueFont;
      metadataValueLines[index].forEach((line, lineIndex) => {
        context.fillText(line, x + 14, metadataY + 29 + lineIndex * 22, metadataCellWidth - 28);
      });
    });
    metadataY += rowHeight;
  });

  const summary = [
    [t("monthlyIncome"), formatPlainMoney(report.incomeTotal)],
    [t("monthlyExpenses"), formatPlainMoney(report.expenseTotal)],
    [t("monthlyPayment"), formatPlainMoney(report.loanPaymentTotal)],
    [t("netCashFlow"), formatPlainMoney(report.netCashFlow)],
    ...(report.savingsGoalCount ? [[languageCode() === "km" ? "ដាក់សន្សំ" : "Saved", formatPlainMoney(report.savedTotal)]] : [])
  ];
  const summaryWidth = (width - margin * 2) / summary.length;
  summary.forEach(([label, value], index) => {
    const x = margin + summaryWidth * index;
    context.fillStyle = "#eef5e4";
    context.fillRect(x, summaryTop, summaryWidth - 12, 112);
    context.fillStyle = "#66715e";
    context.font = `600 15px ${fontStack}`;
    context.fillText(label, x + 16, summaryTop + 16, summaryWidth - 40);
    context.fillStyle = "#1f2a19";
    context.font = `700 22px ${fontStack}`;
    context.fillText(value, x + 16, summaryTop + 58, summaryWidth - 40);
  });

  context.fillStyle = "#202c18";
  context.font = `700 22px ${fontStack}`;
  context.fillText(t("recentTransactions"), margin, transactionTitleTop);

  let y = tableTop;
  context.fillStyle = "#c5ff60";
  context.fillRect(margin, y, width - margin * 2, headerHeight);
  context.font = boldFont;
  context.fillStyle = "#202c18";
  let x = margin;
  headers.forEach((header, index) => {
    const lines = wrapFinanceCanvasText(context, header, columnWidths[index] - horizontalCellPadding, boldFont);
    lines.forEach((line, lineIndex) => context.fillText(line, x + 12, y + 15 + lineIndex * lineHeight, columnWidths[index] - horizontalCellPadding));
    x += columnWidths[index];
  });
  y += headerHeight;

  rows.forEach((row, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];
    context.fillStyle = rowIndex % 2 ? "#f4f7ef" : "#ffffff";
    context.fillRect(margin, y, width - margin * 2, rowHeight);
    context.strokeStyle = "#d5ddcc";
    context.lineWidth = 1;
    context.strokeRect(margin, y, width - margin * 2, rowHeight);
    x = margin;
    rowLines[rowIndex].forEach((lines, index) => {
      context.font = regularFont;
      context.fillStyle = index === row.length - 1 && String(row[index]).startsWith("-") ? "#c93d58" : "#273022";
      lines.forEach((line, lineIndex) => context.fillText(line, x + 12, y + 12 + lineIndex * lineHeight, columnWidths[index] - horizontalCellPadding));
      x += columnWidths[index];
    });
    y += rowHeight;
  });

  return canvas;
}

async function getMonthlyFinanceReportCanvas(month) {
  if (financeReportCanvas && financeReportCanvasMonth === month) return financeReportCanvas;
  financeReportCanvas = typeof ReportCanvas !== "undefined" ? await ReportCanvas.draw(month) : await createMonthlyFinanceReportCanvas(buildMonthlyFinanceReport(month));
  financeReportCanvasMonth = month;
  return financeReportCanvas;
}

async function previewMonthlyFinanceReport() {
  const month = document.querySelector("[data-finance-report-month]")?.value || financeReportMonth || localDateInput().slice(0, 7);
  try {
    const canvas = await getMonthlyFinanceReportCanvas(month);
    const dialog = document.querySelector("[data-finance-report-preview-dialog]");
    const image = dialog?.querySelector("[data-finance-report-preview-image]");
    if (!dialog || !image) return;
    image.src = canvas.toDataURL("image/jpeg", 0.94);
    image.alt = `${t("monthlyReport")} ${buildMonthlyFinanceReport(month).monthLabel}`;
    dialog.querySelector("[data-finance-report-preview-month]").textContent = buildMonthlyFinanceReport(month).monthLabel;
    dialog.showModal();
  } catch (error) {
    Toast.show(t("imageExportFailed"), "warning");
  }
}

async function downloadMonthlyFinanceReportJpg() {
  const month = document.querySelector("[data-finance-report-month]")?.value || financeReportMonth || localDateInput().slice(0, 7);
  try {
    const canvas = await getMonthlyFinanceReportCanvas(month);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!blob) throw new Error("JPG conversion failed");
    downloadFile(`mylife-financial-report-${month}.jpg`, "image/jpeg", blob);
    Toast.show(t("jpgExported"));
  } catch (error) {
    Toast.show(t("imageExportFailed"), "warning");
  }
}

function exportMonthlyFinanceReport(format) {
  const month = document.querySelector("[data-finance-report-month]")?.value || financeReportMonth || localDateInput().slice(0, 7);
  if (format === "excel" && typeof ReportXlsx !== "undefined") {
    ReportXlsx.download(month);
    Toast.show(t("financialReportExported"));
    return;
  }
  const report = typeof ReportInsights !== "undefined" ? ReportInsights.build(month) : buildMonthlyFinanceReport(month);
  const isWord = format === "word";
  const extension = isWord ? "doc" : "xls";
  const mimeType = isWord ? "application/msword" : "application/vnd.ms-excel";
  downloadFile(`mylife-financial-report-${month}.${extension}`, mimeType, monthlyFinanceReportHtml(report));
  Toast.show(t("financialReportExported"));
}

function bindMoney() {
  if (typeof SmartMoney !== "undefined") {
    SmartMoney.bindQuickExpense();
    SmartMoney.bindBudgetTab();
  }
  const shortcutNav = document.querySelector(".financial-shortcuts");
  const activeShortcut = shortcutNav?.querySelector(".financial-shortcut.active");
  if (shortcutNav && activeShortcut) {
    const activeOffset = activeShortcut.getBoundingClientRect().left - shortcutNav.getBoundingClientRect().left + shortcutNav.scrollLeft;
    shortcutNav.scrollLeft = activeOffset - (shortcutNav.clientWidth - activeShortcut.clientWidth) / 2;
  }
  bindNavigationSheetGestures();
  document.querySelectorAll("[data-money-smart-tab]").forEach(button => {
    button.addEventListener("click", () => selectMoneySmartTab(button));
    button.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...document.querySelectorAll("[data-money-smart-tab]")];
      const currentIndex = tabs.indexOf(button);
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? tabs.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
      selectMoneySmartTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  });
  document.querySelectorAll("[data-money-period]").forEach(button => button.addEventListener("click", () => {
    const current = moneyPeriod();
    setMoneyPeriod({ kind: button.dataset.moneyPeriod, anchor: current.anchor });
  }));
  document.querySelectorAll("[data-money-shift]").forEach(button => button.addEventListener("click", () => {
    setMoneyPeriod(shiftMoneyPeriod(moneyPeriod(), Number(button.dataset.moneyShift)));
  }));
  document.querySelectorAll("[data-money-today]").forEach(button => button.addEventListener("click", () => {
    setMoneyPeriod({ kind: moneyPeriod().kind, anchor: localDateInput() });
  }));
  document.querySelectorAll("[data-money-pick]").forEach(input => {
    input.closest("label")?.addEventListener("click", event => {
      if (event.target !== input) { event.preventDefault(); try { input.showPicker(); } catch (error) { input.focus(); } }
    });
    input.addEventListener("change", () => {
      if (!input.value) return;
      const anchor = input.type === "month" ? `${input.value}-01` : input.value;
      setMoneyPeriod({ kind: moneyPeriod().kind, anchor });
    });
  });
  document.querySelectorAll("[data-finance-report-month]").forEach(input => input.addEventListener("change", () => {
    financeReportMonth = input.value;
    financeReportCanvas = null;
    financeReportCanvasMonth = "";
    App.render();
  }));
  document.querySelectorAll("[data-finance-report-export]").forEach(button => button.addEventListener("click", () => {
    exportMonthlyFinanceReport(button.dataset.financeReportExport);
  }));
  document.querySelectorAll("[data-finance-report-preview]").forEach(button => button.addEventListener("click", () => {
    previewMonthlyFinanceReport();
  }));
  document.querySelectorAll("[data-finance-report-download-jpg]").forEach(button => button.addEventListener("click", () => {
    downloadMonthlyFinanceReportJpg();
  }));
  document.querySelectorAll("[data-close-finance-report-preview]").forEach(button => button.addEventListener("click", () => {
    button.closest("dialog")?.close();
  }));
  document.querySelectorAll("[data-finance-report-preview-dialog]").forEach(dialog => dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  }));
  document.querySelectorAll("[data-open-financial-nav]").forEach(button => button.addEventListener("click", () => {
    button.closest(".financial-nav-dock")?.querySelector(".financial-sidebar")?.showModal();
  }));
  document.querySelectorAll("[data-close-financial-nav]").forEach(button => button.addEventListener("click", () => {
    button.closest(".financial-sidebar")?.close();
  }));
  document.querySelectorAll(".financial-sidebar").forEach(dialog => dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  }));
  document.querySelectorAll('[data-action="add-income"]').forEach(button => button.addEventListener("click", () => openIncomeModal()));
  document.querySelectorAll('[data-action="add-expense"]').forEach(button => button.addEventListener("click", () => openExpenseModal()));
  document.querySelectorAll('[data-action="add-savings"]').forEach(button => button.addEventListener("click", () => openSavingsModal()));
  document.querySelectorAll("[data-use-savings]").forEach(button => button.addEventListener("click", () => {
    const saving = appData.savings.find(item => item.id === button.dataset.useSavings);
    if (saving) openSavingsUseModal(saving);
  }));
  document.querySelectorAll("[data-sell-gold]").forEach(button => button.addEventListener("click", openGoldSaleModal));
  document.querySelectorAll("[data-buy-gold]").forEach(button => button.addEventListener("click", () => {
    const list = appData.savings || [];
    const saving = list.find(item => item.id === button.dataset.buyGold) || list.find(item => Number(item.currentAmount || 0) > Number(item.reserveAmount || 0)) || list[0];
    if (saving) openSavingsUseModal(saving, "gold");
  }));
  document.querySelectorAll("[data-remove-gold-purchase]").forEach(button => button.addEventListener("click", () => removeGoldPurchase(button.dataset.savingId, button.dataset.removeGoldPurchase)));
  document.querySelectorAll("[data-sv-market-refresh]").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    button.classList.add("is-loading");
    try { await SavingsMarket.refresh(true); }
    finally { button.disabled = false; button.classList.remove("is-loading"); }
  }));
  document.querySelectorAll('[data-action="add-loan"]').forEach(button => button.addEventListener("click", () => openLoanModal()));
  document.querySelectorAll('[data-action="add-bill"]').forEach(button => button.addEventListener("click", () => openBillModal()));
  document.querySelectorAll("[data-finance-mark-bill]").forEach(button => button.addEventListener("click", () => markBillPaid(button.dataset.financeMarkBill)));
  document.querySelectorAll("[data-finance-toggle-bill]").forEach(button => button.addEventListener("click", () => toggleFinanceBillPayment(button.dataset.financeToggleBill)));
  bindCollectionActions("income", openIncomeModal);
  bindCollectionActions("expense", openExpenseModal);
  bindCollectionActions("savings", openSavingsModal, "savings");
  bindCollectionActions("loan", openLoanModal);
  bindCollectionActions("bill", openBillModal);
  document.querySelectorAll("[data-payment-loan]").forEach(button => button.addEventListener("click", () => openLoanPaymentModal(appData.loans.find(loan => loan.id === button.dataset.paymentLoan))));
  document.querySelectorAll("[data-loan-schedule]").forEach(input => input.addEventListener("change", () => toggleLoanScheduledPayment(input)));
  document.querySelectorAll("[data-link-bill]").forEach(button => button.addEventListener("click", () => {
    const bill = appData.bills.find(item => item.id === button.dataset.linkBill);
    if (bill) openBillModal(bill);
  }));
  document.querySelector("[data-expense-month]")?.addEventListener("change", event => {
    expenseMonthFilter = event.target.value;
    App.render();
  });
  document.querySelectorAll("[data-link-expense]").forEach(button => button.addEventListener("click", () => {
    if (typeof LoanPay === "undefined") return;
    const { linkExpense, linkLoan, linkDate } = button.dataset;
    const loan = appData.loans.find(item => item.id === linkLoan);
    const expense = appData.expenses.find(item => item.id === linkExpense);
    if (!loan || !expense) return;
    if (typeof saveDataBackup === "function") saveDataBackup("before-link-loan-expense");
    const payments = (loan.payments || []).map(payment => (payment.date === linkDate ? { ...payment, expenseId: expense.id } : payment));
    Store.edit("expenses", expense.id, { loanId: loan.id, loanPaymentDate: linkDate, category: "Loan" });
    Store.edit("loans", loan.id, { payments });
    Toast.show(languageCode() === "km" ? "បានភ្ជាប់ — ឥឡូវរាប់តែម្តង" : "Linked — counted once now", "success");
  }));
  document.querySelectorAll("[data-savings-contribution]").forEach(input => input.addEventListener("change", () => toggleSavingsContribution(input)));
}

function selectMoneySmartTab(button) {
  const selectedId = button.dataset.moneySmartTab;
  document.querySelectorAll("[data-money-smart-tab]").forEach(tab => {
    const selected = tab === button;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll("[data-money-smart-panel]").forEach(panel => {
    panel.hidden = panel.dataset.moneySmartPanel !== selectedId;
  });
}

function toggleFinanceBillPayment(billId) {
  const bill = appData.bills.find(item => item.id === billId);
  if (!bill) return;
  if (!billPaidCurrentCycle(bill)) {
    markBillPaid(billId);
    return;
  }
  markBillUnpaid(billId);
}

// joint account: tapping ＋ asks how much this time (prefilled with the usual amount, quick chips)
function askSavingsDepositAmount(input, saving) {
  const km = languageCode() === "km";
  const partner = input.dataset.savingsWho === "partner";
  const member = partner ? (appData.family || []).find(person => person.id === saving.jointWith) : null;
  const who = partner ? String(member?.name || saving.jointName || (km ? "ដៃគូ" : "Partner")).trim().split(/\s+/)[0] : (km ? "ខ្ញុំ" : "Me");
  const usual = Number(partner ? saving.partnerContribution : saving.monthlyContribution) || 0;
  input.checked = false;
  Modal.open({ title: km ? `${who} ដាក់ប៉ុន្មាន?` : `How much did ${partner ? who : "I"} put in?`, submitText: km ? "ដាក់ចូល" : "Add", fields: [
    { name: "depositAmount", label: `${km ? "ចំនួន" : "Amount"} (${saving.currency || appData.profile.currency || "USD"})`, type: "number", value: usual || "", required: true }
  ], onSubmit(data) {
    const amount = Number(data.depositAmount || 0);
    if (amount > 0) applySavingsDeposit(saving, input, amount);
  } });
  const field = document.querySelector("#modalRoot #depositAmount");
  if (!field) return;
  field.setAttribute("inputmode", "decimal");
  field.setAttribute("step", "any");
  const chips = [...new Set([usual, 10, 25, 50, 100].filter(value => value > 0))].sort((x, y) => x - y);
  const row = document.createElement("div");
  row.className = "sv-amount-chips";
  row.innerHTML = chips.map(value => `<button type="button" class="${value === usual ? "on" : ""}" data-amount="${value}">${escapeHtml(String(money(value, saving.currency)).replace(/<[^>]*>/g, ""))}</button>`).join("");
  row.addEventListener("click", event => {
    const chip = event.target.closest("[data-amount]");
    if (!chip) return;
    field.value = chip.dataset.amount;
    row.querySelectorAll("button").forEach(button => button.classList.toggle("on", button === chip));
  });
  (field.closest(".field") || field.parentElement).appendChild(row);
  field.addEventListener("input", () => row.querySelectorAll("button").forEach(button => button.classList.toggle("on", Number(button.dataset.amount) === Number(field.value))));
  setTimeout(() => { field.focus(); field.select?.(); }, 60);
}

function applySavingsDeposit(saving, input, amount) {
  const monthKey = input.dataset.savingsMonth || getSavingsContributionMonth();
  const contributions = Array.isArray(saving.contributions) ? saving.contributions.slice() : [];
  const index = contributions.findIndex(entry => entry && entry.month === monthKey);
  const entry = index >= 0 ? contributions[index] : null;
  const partner = input.dataset.savingsWho === "partner";
  if (partner ? entry?.partnerPaid : entry?.paid) return;
  const next = partner
    ? { ...(entry || { month: monthKey, amount: Number(saving.monthlyContribution || 0), paid: false }), partnerPaid: true, partnerAmount: amount, partnerAt: new Date().toISOString() }
    : { ...(entry || {}), month: monthKey, amount, paid: true, at: new Date().toISOString() };
  if (index >= 0) contributions[index] = next; else contributions.unshift(next);
  saving.contributions = contributions;
  saving.currentAmount = Number(saving.currentAmount || 0) + amount;
  Store.save();
  if (typeof DoneFeed !== "undefined") {
    const member = partner ? (appData.family || []).find(person => person.id === saving.jointWith) : null;
    DoneFeed.afterSave(saving, partner ? String(member?.name || saving.jointName || "").trim().split(/\s+/)[0] : (saving.jointWith ? (languageCode() === "km" ? "ខ្ញុំ" : "I") : ""), amount);
  } else Toast.show(t("savingsAdded"));
  App.render();
}

function toggleSavingsContribution(input) {
  const saving = appData.savings.find(item => item.id === input.dataset.savingsContribution);
  if (!saving) return;
  if (input.checked && input.dataset.savingsJoint) {
    const current = getSavingsContribution(saving, input.dataset.savingsMonth || getSavingsContributionMonth());
    if (!(input.dataset.savingsWho === "partner" ? current?.partnerPaid : current?.paid)) return askSavingsDepositAmount(input, saving);
  }

  const monthKey = input.dataset.savingsMonth || getSavingsContributionMonth();
  const contributionAmount = Number(saving.monthlyContribution || 0);
  const contributions = Array.isArray(saving.contributions) ? saving.contributions.slice() : [];
  const existingIndex = contributions.findIndex(entry => entry && entry.month === monthKey);
  const wasPaid = existingIndex >= 0 ? Boolean(contributions[existingIndex].paid) : false;

  // joint account: the partner's deposit lives on the same month entry (partnerPaid / partnerAmount)
  if (input.dataset.savingsWho === "partner") {
    const partnerAmount = Number(saving.partnerContribution || 0);
    const entry = existingIndex >= 0 ? contributions[existingIndex] : null;
    const partnerWasPaid = Boolean(entry && entry.partnerPaid);
    if (input.checked && !partnerWasPaid) {
      if (entry) contributions[existingIndex] = { ...entry, partnerPaid: true, partnerAmount };
      else contributions.unshift({ month: monthKey, amount: contributionAmount, paid: false, partnerPaid: true, partnerAmount });
      saving.currentAmount = Number(saving.currentAmount || 0) + partnerAmount;
    } else if (!input.checked && partnerWasPaid) {
      const previous = Number(entry.partnerAmount || partnerAmount);
      if (entry.paid) contributions[existingIndex] = { ...entry, partnerPaid: false, partnerAmount: 0 };
      else contributions.splice(existingIndex, 1);
      saving.currentAmount = Math.max(0, Number(saving.currentAmount || 0) - previous);
    }
    saving.contributions = contributions;
    Store.save();
    Toast.show(input.checked ? t("savingsAdded") : t("savingsRemoved"));
    App.render();
    return;
  }

  if (input.checked && !wasPaid) {
    if (existingIndex >= 0) {
      contributions[existingIndex] = { ...contributions[existingIndex], month: monthKey, amount: contributionAmount, paid: true, at: new Date().toISOString() };
    } else {
      contributions.unshift({ month: monthKey, amount: contributionAmount, paid: true, at: new Date().toISOString() });
    }
    saving.currentAmount = Number(saving.currentAmount || 0) + contributionAmount;
  } else if (!input.checked && wasPaid) {
    if (existingIndex >= 0) {
      const previousAmount = Number(contributions[existingIndex].amount || contributionAmount);
      if (contributions[existingIndex].partnerPaid) contributions[existingIndex] = { ...contributions[existingIndex], paid: false };
      else contributions.splice(existingIndex, 1);
      saving.currentAmount = Math.max(0, Number(saving.currentAmount || 0) - previousAmount);
    }
  }

  saving.contributions = contributions;
  Store.save();
  if (input.checked && !wasPaid && typeof DoneFeed !== "undefined") DoneFeed.afterSave(saving, "", contributionAmount);
  else Toast.show(input.checked ? t("savingsAdded") : t("savingsRemoved"));
  App.render();
}

function toggleLoanScheduledPayment(input) {
  const loan = appData.loans.find(item => item.id === input.dataset.loanSchedule);
  if (!loan) return;
  const paymentDate = input.dataset.paymentDate;
  loan.payments = loan.payments || [];
  const existingIndex = loan.payments.findIndex(payment => payment.date === paymentDate);
  if (input.checked) {
    // one payment + one expense (category Loan); ticking again changes nothing
    if (existingIndex === -1) LoanPay.recordLoanPayment(appData, loan, paymentDate, { amount: loan.monthlyPayment, today: localDateInput(), paymentType: loan.paymentType });
  } else if (existingIndex > -1) {
    const done = LoanPay.removeLoanPayment(appData, loan, paymentDate);
    if (done.removedExpenseId) SyncState.record(appData, "expenses", done.removedExpenseId);
  }
  Store.save();
  if (input.checked && typeof DoneFeed !== "undefined") DoneFeed.afterLoanPay(loan, paymentDate);
  else Toast.show(input.checked ? t("paymentMarkedPaid") : t("paymentMarkedUnpaid"));
  App.render();
}

function bindCollectionActions(name, modalFn, collection = {
  income: "income",
  expense: "expenses",
  savings: "savings",
  loan: "loans",
  bill: "bills"
}[name] || `${name}s`) {
  document.querySelectorAll(`[data-edit-${name}]`).forEach(button => button.addEventListener("click", () => modalFn(appData[collection].find(item => item.id === button.dataset[`edit${name[0].toUpperCase()}${name.slice(1)}`]))));
  document.querySelectorAll(`[data-delete-${name}]`).forEach(button => button.addEventListener("click", () => {
    Modal.confirm({ title: `${t("delete")} ${t(name)}`, message: t("deleteRecordMessage"), confirmText: t("delete"), onConfirm: () => {
      Store.delete(collection, button.dataset[`delete${name[0].toUpperCase()}${name.slice(1)}`]);
      Toast.show(t("recordDeleted"));
    }});
  }));
}

function openIncomeModal(item) {
  Modal.open({ title: item ? t("editIncome") : t("addIncome"), submitText: item ? t("saveIncome") : t("addIncome"), fields: [
    { name: "name", label: t("incomeName"), value: item?.name, required: true },
    { name: "amount", label: t("amount"), type: "number", value: item?.amount, required: true },
    { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: item?.currency || appData.profile.currency || "USD" },
    { name: "category", label: t("category"), type: "select", options: incomeCategories, value: item?.category || "Salary" },
    { name: "accountType", label: languageCode() === "km" ? "គណនីទទួលប្រាក់" : "Deposit to", type: "select", options: ["unspecified", "cash", "bank"], optionLabels: [languageCode() === "km" ? "មិនបានបញ្ជាក់" : "Unspecified", languageCode() === "km" ? "សាច់ប្រាក់" : "Cash", languageCode() === "km" ? "ធនាគារ" : "Bank"], value: item?.accountType || "unspecified" },
    { name: "frequency", label: t("frequency"), type: "select", options: ["Once", "Weekly", "Monthly", "Yearly"], value: item?.frequency || "Monthly" },
    { name: "nextPaymentDate", label: t("nextPaymentDate"), type: "date", value: item?.nextPaymentDate },
    { name: "recurring", label: t("recurring"), type: "checkbox", value: item?.recurring ?? true },
    { name: "ask", label: languageCode() === "km" ? "💸 សួរ “បានទទួលហើយឬនៅ?” ពេលដល់ថ្ងៃ" : "💸 Ask “got it yet?” on the day", type: "checkbox", value: item?.ask ?? true },
    { name: "notes", label: t("notes"), type: "textarea", value: item?.notes }
  ], onSubmit(data) { const record = { ...data, amount: Number(data.amount || 0), currency: data.currency || appData.profile.currency || "USD" }; item ? Store.edit("income", item.id, record) : Store.add("income", record); Toast.show(item ? t("incomeSaved") : t("incomeAdded")); } });
}

function openExpenseModal(item) {
  if (typeof ExpenseForm !== "undefined") return ExpenseForm.open(item);
  Modal.open({ title: item ? `${t("edit")} ${t("expense")}` : t("addExpense"), submitText: item ? `${t("save")} ${t("expense")}` : t("addExpense"), fields: [
    { name: "description", label: t("description"), value: item?.description, required: true },
    { name: "amount", label: t("amount"), type: "number", value: item?.amount, required: true },
    { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: item?.currency || appData.profile.currency || "USD" },
    { name: "category", label: t("category"), type: "select", options: expenseCategories, value: item?.category || "Food" },
    { name: "date", label: t("date"), type: "date", value: item?.date || localDateInput() },
    { name: "method", label: t("paymentMethod"), value: item?.method },
    { name: "notes", label: t("notes"), type: "textarea", value: item?.notes }
  ], onSubmit(data) { const record = { ...data, amount: Number(data.amount || 0), currency: data.currency || appData.profile.currency || "USD" }; item ? Store.edit("expenses", item.id, record) : Store.add("expenses", record); Toast.show(item ? t("expenseSaved") : t("expenseAdded")); } });
}

// joint account (6 Nov 2026): pick a partner from family; each person has their own monthly amount
function savingsJointFields(item) {
  const km = languageCode() === "km";
  const people = (appData.family || []).filter(member => member && member.id && member.relationship !== "Me");
  if (!people.length && !item?.jointWith) return [];
  const ids = people.map(member => member.id);
  if (item?.jointWith && !ids.includes(item.jointWith)) { ids.push(item.jointWith); people.push({ id: item.jointWith, name: item.jointName || "?" }); }
  return [
    { name: "jointWith", label: km ? "👫 គណនីរួម · ដៃគូ" : "👫 Joint account · partner", type: "select", options: ["", ...ids], optionLabels: [km ? "គ្មាន (ខ្ញុំម្នាក់)" : "None (just me)", ...people.map(member => member.name || "?")], value: item?.jointWith || "" },
    { name: "partnerContribution", label: km ? "ដៃគូដាក់ /ខែ" : "Partner puts in / month", type: "number", value: item?.partnerContribution || 0 }
  ];
}

function savingsJointRecord(data) {
  if (!("jointWith" in data)) return {};
  const member = (appData.family || []).find(person => person.id === data.jointWith);
  return data.jointWith
    ? { jointWith: data.jointWith, jointName: member?.name || data.jointName || "", partnerContribution: Number(data.partnerContribution || 0) }
    : { jointWith: "", partnerContribution: Number(data.partnerContribution || 0) };
}

function openSavingsModal(item) {
  Modal.open({ title: item ? t("editSavings") : t("addSavings"), submitText: item ? t("saveSavings") : t("addSavings"), fields: [
    { name: "name", label: t("savingsName"), value: item?.name, required: true },
    { name: "targetAmount", label: t("targetAmount"), type: "number", value: item?.targetAmount, required: true },
    { name: "currentAmount", label: t("currentAmount"), type: "number", value: item?.currentAmount || 0, required: true },
    { name: "reserveAmount", label: languageCode() === "km" ? "ប្រាក់បម្រុង" : "Protected reserve (keep aside)", type: "number", value: item?.reserveAmount || 0 },
    { name: "monthlyContribution", label: t("monthlyContribution"), type: "number", value: item?.monthlyContribution || 0 },
    ...savingsJointFields(item),
    { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: item?.currency || appData.profile.currency || "USD" },
    { name: "deadline", label: t("deadline"), type: "date", value: item?.deadline },
    { name: "notes", label: t("notes"), type: "textarea", value: item?.notes }
  ], onSubmit(data) { const record = { ...data, targetAmount: Number(data.targetAmount || 0), currentAmount: Number(data.currentAmount || 0), reserveAmount: Number(data.reserveAmount || 0), monthlyContribution: Number(data.monthlyContribution || 0), currency: data.currency || appData.profile.currency || "USD", ...savingsJointRecord(data) }; item ? Store.edit("savings", item.id, record) : Store.add("savings", record); Toast.show(item ? t("savingsSaved") : t("savingsAdded")); } });
}

function openSavingsUseModal(saving, preset = "") {
  const startingBalance = Math.max(0, Number(saving.currentAmount || 0));
  const reserve = Math.min(startingBalance, Math.max(0, Number(saving.reserveAmount || 0)));
  const available = Math.max(0, startingBalance - reserve);
  const isKm = languageCode() === "km";
  const L = (km, en) => isKm ? km : en;
  const useOptions = ["spend", "gold", "investment"];
  Modal.open({ title: L("ប្រើប្រាក់សន្សំ", "Use savings"), submitText: L("បញ្ជាក់", "Confirm use"), fields: [
    { name: "useType", label: L("ប្រើសម្រាប់", "Use for"), type: "select", options: useOptions, optionLabels: [L("ចំណាយ", "Spending"), L("ទិញមាស 24K", "Buy 24K gold"), L("វិនិយោគ / ផ្សេងៗ", "Other investment or use")], value: preset === "gold" ? "gold" : "spend" },
    { name: "amount", label: `${L("ចំនួនទឹកប្រាក់", "Amount")} · ${money(available, saving.currency)}`, type: "number", value: available, required: true },
    { name: "fees", label: L("ថ្លៃសេវា", "Purchase fees (optional)"), type: "number", value: "0" },
    { name: "category", label: t("category"), type: "select", options: expenseCategories, value: "Shopping" },
    { name: "goldChi", label: L("ចំនួនជី", "Gold quantity"), type: "select", options: ["1", "2", "custom"], optionLabels: [L("១ ជី · 3.75 ក្រាម", "1 Chi / ជី · 3.75 g"), L("២ ជី · 7.50 ក្រាម", "2 Chi / ជី · 7.50 g"), L("ទម្ងន់ផ្សេង", "Custom weight")], value: "1" },
    { name: "goldWeightGrams", label: L("ទម្ងន់ (ក្រាម)", "Gold weight (grams) · optional"), type: "number", value: "" },
    { name: "goldPurity", label: L("កម្រិតមាស", "Gold purity"), type: "select", options: ["24K", "22K", "18K"], value: "24K" },
    { name: "note", label: L("ចំណាំ / ហាង", "Note / shop"), value: "" }
  ], onSubmit(data) {
    const amount = Number(data.amount);
    const currentSaving = appData.savings.find(item => item.id === saving.id);
    if (!currentSaving) return;
    const liveBalance = Math.max(0, Number(currentSaving.currentAmount || 0));
    const liveReserve = Math.min(liveBalance, Math.max(0, Number(currentSaving.reserveAmount || 0)));
    const liveAvailable = Math.max(0, liveBalance - liveReserve);
    const fees = data.useType === "gold" ? Math.max(0, Number(data.fees || 0)) : 0;
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(fees) || amount + fees > liveAvailable) {
      Toast.show(L(`អាចប្រើបានត្រឹម ${money(liveAvailable, saving.currency)}`, `You can use up to ${money(liveAvailable, saving.currency)}`));
      return;
    }
    const totalDebit = amount + fees;
    const previous = structuredClone(appData);
    const timestamp = new Date().toISOString();
    const date = localDateInput();
    const quote = typeof SavingsMarket !== "undefined" ? SavingsMarket.quote() : {};
    const isGold = data.useType === "gold";
    const transaction = {
      id: id("saving-use"), createdAt: timestamp, date,
      type: data.useType, amount, currency: saving.currency || appData.profile.currency || "USD", fees, totalDebit,
      note: String(data.note || "").trim(),
      ...(isGold ? {
        goldWeightGrams: data.goldChi === "custom" ? Number(data.goldWeightGrams || 0) : Number(data.goldChi || 1) * 3.75,
        goldChi: data.goldChi === "custom" ? "custom" : Number(data.goldChi || 1), goldPurity: data.goldPurity || "24K", purchaseValue: amount,
        marketGoldUsdPerGram: Number(quote.goldUsdPerGram || 0), marketGoldUsdPerChi: Number(quote.goldUsdPerChi || 0), marketUsdKhr: Number(quote.usdKhr || 0), marketCheckedAt: quote.updatedAtLocal || ""
      } : data.useType === "spend" ? { category: data.category || "Shopping" } : {})
    };
    currentSaving.currentAmount = liveBalance - totalDebit;
    currentSaving.transactions = Array.isArray(currentSaving.transactions) ? currentSaving.transactions : [];
    currentSaving.transactions.unshift(transaction);
    if (data.useType === "spend") {
      if (!Array.isArray(appData.expenses)) appData.expenses = [];
      appData.expenses.push({ id: id("expense"), createdAt: timestamp, description: transaction.note || L("ចំណាយពីប្រាក់សន្សំ", "Savings spending"), amount, currency: transaction.currency, category: transaction.category, date, method: L("ប្រាក់សន្សំ", "Savings"), notes: `${saving.name || t("savings")}${transaction.note ? ` · ${transaction.note}` : ""}`, savingsTransactionId: transaction.id });
    }
    if (!Store.save()) { restoreData(previous); return; }
    Toast.show(isGold ? L("បានកត់ត្រាការទិញមាស", "Gold purchase recorded") : data.useType === "investment" ? L("បានកត់ត្រា ✓", "Savings use recorded") : L("បានកត់ត្រាចំណាយ", "Spending recorded"));
    App.render();
    {
      const monthSummary = savingsUseMonthSummary(date.slice(0, 7));
      const alert = buildSavingsUseAlert(transaction, currentSaving, monthSummary, date.slice(0, 7));
      NotificationCenter.refresh?.();
      const alertKind = transaction.type === "gold" || transaction.type === "investment" ? "investment-purchase" : "savings-use";
      if (typeof NotifyPrefs === "undefined" || NotifyPrefs.allows(appData.profile, alertKind, "app")) showSavingsUseAppAlert(alert, transaction.id);
      if (typeof NotifyPrefs === "undefined" || NotifyPrefs.allows(appData.profile, alertKind, "telegram")) sendSavingsUseTelegramAlert(transaction, currentSaving, monthSummary).catch(error => {
        console.warn("MYLIFE could not send the savings-use Telegram alert.", error);
        Toast.show(L("រក្សាទុករួច · Telegram មិនបាន", "Saved in the app, but Telegram alert couldn't be sent"), "warning");
      });
    }
  } });

  const form = document.getElementById("modalForm");
  const type = form?.elements.useType;
  const amount = form?.elements.amount;
  const feesInput = form?.elements.fees;
  const noteInput = form?.elements.note;
  const noteLabel = form?.querySelector('label[for="note"]');
  const feesField = feesInput?.closest(".field");
  const chi = form?.elements.goldChi;
  const grams = form?.elements.goldWeightGrams;
  const purity = form?.elements.goldPurity;
  const categoryField = form?.querySelector('[name="category"]')?.closest(".field");
  const chiField = form?.querySelector('[name="goldChi"]')?.closest(".field");
  const weightField = form?.querySelector('[name="goldWeightGrams"]')?.closest(".field");
  const purityField = form?.querySelector('[name="goldPurity"]')?.closest(".field");
  const estimateHint = document.createElement("small");
  estimateHint.className = "sv-gold-estimate-hint";
  estimateHint.textContent = L("តម្លៃប៉ាន់ស្មាន · កែតាមបង្កាន់ដៃ", "Estimated from 24K gold spot; adjust the amount to match the shop receipt.");
  amount?.closest(".field")?.append(estimateHint);
  const setGoldWeight = () => {
    if (grams && chi && chi.value !== "custom") grams.value = String(Number(chi.value || 1) * 3.75);
  };
  const suggestGoldAmount = () => {
    if (type?.value !== "gold" || !amount) return;
    const quote = typeof SavingsMarket !== "undefined" ? SavingsMarket.quote() : {};
    const weight = chi?.value === "custom" ? Number(grams?.value || 0) : Number(chi?.value || 1) * 3.75;
    const purityK = Number(String(purity?.value || "24K").match(/\d+/)?.[0] || 24);
    const usdPerGram = Number(quote.goldUsdPerGram || 0);
    const usdKhr = Number(quote.usdKhr || 0);
    if (!(weight > 0 && usdPerGram > 0)) return;
    const usdEstimate = weight * usdPerGram * Math.min(24, purityK) / 24;
    const estimate = (saving.currency || appData.profile.currency) === "KHR" ? (usdKhr > 0 ? usdEstimate * usdKhr : 0) : usdEstimate;
    if (!(estimate > 0)) return;
    amount.value = (saving.currency || appData.profile.currency) === "KHR" ? String(Math.round(estimate)) : estimate.toFixed(2);
  };
  const syncFields = () => {
    const gold = type?.value === "gold";
    const spending = type?.value === "spend";
    if (categoryField) categoryField.hidden = !spending;
    if (chiField) chiField.hidden = !gold;
    if (weightField) weightField.hidden = !gold || chi?.value !== "custom";
    if (purityField) purityField.hidden = !gold;
    if (feesField) feesField.hidden = !gold;
    if (noteLabel) noteLabel.textContent = type?.value === "investment" ? L("ប្រើសម្រាប់", "Investment / what was it for") : L("ចំណាំ / ហាង", "Note / shop");
    if (gold && chi?.value !== "custom") setGoldWeight();
    suggestGoldAmount();
  };
  type?.addEventListener("change", () => {
    if (amount) amount.value = type.value === "gold" ? "" : String(available);
    syncFields();
  });
  chi?.addEventListener("change", syncFields);
  purity?.addEventListener("change", suggestGoldAmount);
  grams?.addEventListener("input", suggestGoldAmount);
  syncFields();
  form?.addEventListener("submit", event => {
    const value = Number(amount?.value);
    const goldWeight = chi?.value === "custom" ? Number(grams?.value || 0) : Number(chi?.value || 0) * 3.75;
    if (type?.value === "investment" && !String(noteInput?.value || "").trim()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const error = form.querySelector('[data-error="note"]');
      if (error) error.textContent = L("សូមបញ្ជាក់ការវិនិយោគ ឬការប្រើប្រាស់", "Describe the investment or use");
      noteInput?.focus();
      return;
    }
    if (type?.value === "gold" && !(goldWeight > 0)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const error = form.querySelector('[data-error="goldWeightGrams"]');
      if (error) error.textContent = L("សូមបញ្ចូលទម្ងន់មាស", "Enter the gold weight");
      (chi?.value === "custom" ? grams : chi)?.focus();
      return;
    }
    const fees = type?.value === "gold" ? Math.max(0, Number(feesInput?.value || 0)) : 0;
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(fees) || value + fees > available) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const error = form.querySelector('[data-error="amount"]');
      if (error) error.textContent = L(`ចំនួនត្រូវនៅចន្លោះ 0 និង ${money(available, saving.currency)}`, `Enter an amount from 0 to ${money(available, saving.currency)}`);
      amount?.focus();
    }
  }, true);
}

function goldBalanceGrams(saving, purity) {
  return (Array.isArray(saving?.transactions) ? saving.transactions : []).reduce((total, transaction) => {
    if (String(transaction.goldPurity || "24K") !== purity) return total;
    const grams = Math.max(0, Number(transaction.goldWeightGrams || 0));
    if (transaction.type === "gold") return total + grams;
    if (transaction.type === "gold-sale") return total - grams;
    return total;
  }, 0);
}

function removeGoldPurchase(savingId, transactionId) {
  const isKm = languageCode() === "km";
  const L = (km, en) => isKm ? km : en;
  const saving = (appData.savings || []).find(item => item.id === savingId);
  const transaction = saving?.transactions?.find(entry => entry.id === transactionId && entry.type === "gold");
  if (!saving || !transaction) return;
  Modal.confirm({
    title: L("លុបការទិញមាសនេះ?", "Remove this gold purchase?"),
    message: L("មាសនឹងត្រូវដកចេញពីសរុប ហើយប្រាក់ដែលបានកាត់នឹងត្រឡប់ទៅគណនីសន្សំវិញ។", "This removes the gold from your total and refunds the amount to this savings account."),
    confirmText: L("លុប និងសងប្រាក់", "Remove & refund"),
    onConfirm: () => {
      const grams = Math.max(0, Number(transaction.goldWeightGrams || 0));
      const remaining = goldBalanceGrams(saving, transaction.goldPurity || "24K") - grams;
      if (remaining < -1e-8) {
        Toast.show(L("មិនអាចលុបបានទេ ព្រោះមាសនេះមានការលក់រួចហើយ។", "Can't remove this purchase because some of this gold has already been sold."), "warning");
        return;
      }
      const previous = structuredClone(appData);
      const refund = Math.max(0, Number(transaction.totalDebit ?? (Number(transaction.amount || 0) + Number(transaction.fees || 0))));
      saving.currentAmount = Number(saving.currentAmount || 0) + refund;
      saving.transactions = saving.transactions.filter(entry => entry.id !== transactionId);
      // remember the removal so a sync with an older cloud copy can't bring it (or the old balance) back
      SyncState.record(appData, "savingTransactions", transactionId);
      saving.updatedAt = new Date().toISOString();
      if (!Store.save()) { restoreData(previous); return; }
      Toast.show(L("បានលុបការទិញ ហើយសងប្រាក់ទៅសន្សំវិញ", "Purchase removed and savings refunded"));
      App.render();
    }
  });
}

function openGoldSaleModal() {
  const isKm = languageCode() === "km";
  const L = (km, en) => isKm ? km : en;
  const accounts = (appData.savings || []).filter(saving => ["24K", "22K", "18K"].some(purity => goldBalanceGrams(saving, purity) > 1e-8));
  if (!accounts.length) { Toast.show(L("មិនទាន់មានមាសសម្រាប់លក់ទេ", "There is no gold available to sell")); return; }
  const accountOptions = accounts.map(saving => saving.id);
  const accountLabels = accounts.map(saving => saving.name || t("savings"));
  const purities = ["24K", "22K", "18K"];
  Modal.open({ title: L("លក់មាស", "Sell gold"), submitText: L("កត់ត្រាការលក់", "Record sale"), fields: [
    { name: "savingId", label: L("គណនីមាស", "Gold account"), type: "select", options: accountOptions, optionLabels: accountLabels, value: accountOptions[0] },
    { name: "goldPurity", label: L("កម្រិតមាស", "Gold purity"), type: "select", options: purities, value: "24K" },
    { name: "goldChi", label: L("ចំនួនជីដែលលក់ (ជី)", "Amount sold (Chi / ជី)"), type: "number", value: "1", required: true },
    { name: "amount", label: L("ប្រាក់លក់", "Sale proceeds"), type: "number", value: "", required: true },
    { name: "fees", label: L("ថ្លៃសេវាលក់ (ស្រេចចិត្ត)", "Selling fees (optional)"), type: "number", value: "0" },
    { name: "note", label: L("ចំណាំ / ហាង", "Note / shop"), value: "" }
  ], onSubmit(data) {
    const saving = (appData.savings || []).find(item => item.id === data.savingId);
    if (!saving) return;
    const chi = Number(data.goldChi);
    const weight = chi * 3.75;
    const gross = Number(data.amount);
    const fees = Math.max(0, Number(data.fees || 0));
    const available = Math.max(0, goldBalanceGrams(saving, data.goldPurity));
    if (!(weight > 0) || weight > available + 1e-8 || !(gross > 0) || !Number.isFinite(fees) || fees >= gross) {
      const availableChi = (available / 3.75).toLocaleString("en-US", { maximumFractionDigits: 2 });
      Toast.show(L(`ពិនិត្យចំនួនជី និងប្រាក់លក់។ មាន ${availableChi} ជី`, `Check the Chi amount and sale proceeds. Available: ${availableChi} Chi`), "warning");
      return;
    }
    const previous = structuredClone(appData);
    const timestamp = new Date().toISOString();
    const date = localDateInput();
    const netProceeds = gross - fees;
    const transaction = {
      id: id("gold-sale"), createdAt: timestamp, date, type: "gold-sale", amount: gross,
      currency: saving.currency || appData.profile.currency || "USD", fees, netProceeds,
      goldWeightGrams: weight, goldChi: chi, goldPurity: data.goldPurity || "24K",
      note: String(data.note || "").trim()
    };
    saving.currentAmount = Number(saving.currentAmount || 0) + netProceeds;
    saving.transactions = Array.isArray(saving.transactions) ? saving.transactions : [];
    saving.transactions.unshift(transaction);
    if (!Store.save()) { restoreData(previous); return; }
    const chiLabel = chi.toLocaleString("en-US", { maximumFractionDigits: 2 });
    Toast.show(L(`បានកត់ត្រាលក់ ${chiLabel} ជីមាស`, `Recorded sale of ${chiLabel} Chi gold`));
    App.render();
    NotificationCenter.refresh?.();
  } });

  const form = document.getElementById("modalForm");
  form?.addEventListener("submit", event => {
    const saving = (appData.savings || []).find(item => item.id === form.elements.savingId?.value);
    const purity = form.elements.goldPurity?.value || "24K";
    const chi = Number(form.elements.goldChi?.value);
    const weight = chi * 3.75;
    const gross = Number(form.elements.amount?.value);
    const fees = Number(form.elements.fees?.value || 0);
    const available = goldBalanceGrams(saving, purity);
    if (!saving || !Number.isFinite(weight) || weight <= 0 || weight > available + 1e-8 || !Number.isFinite(gross) || gross <= 0 || !Number.isFinite(fees) || fees < 0 || fees >= gross) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const availableChi = (Math.max(0, available) / 3.75).toLocaleString("en-US", { maximumFractionDigits: 2 });
      Toast.show(L(`អាចលក់បានត្រឹម ${availableChi} ជី ហើយប្រាក់លក់ត្រូវធំជាងថ្លៃសេវា`, `Enter up to ${availableChi} Chi; proceeds must exceed fees`), "warning");
    }
  }, true);
}

function savingsUseMonthSummary(month) {
  const totals = {};
  const byType = { gold: {}, spend: {}, investment: {} };
  let chiTotal = 0;
  (appData.savings || []).forEach(saving => (saving.transactions || []).forEach(entry => {
    if (!["gold", "spend", "investment"].includes(entry.type) || !String(entry.date || "").startsWith(month)) return;
    const currency = entry.currency || saving.currency || appData.profile.currency || "USD";
    const totalUse = Number(entry.totalDebit ?? (Number(entry.amount || 0) + Number(entry.fees || 0)));
    totals[currency] = (totals[currency] || 0) + totalUse;
    byType[entry.type][currency] = (byType[entry.type][currency] || 0) + totalUse;
    if (entry.type === "gold") chiTotal += Math.max(0, Number(entry.goldWeightGrams || 0)) / 3.75;
  }));
  return { totals, byType, chiTotal };
}

function buildSavingsUseAlert(transaction, saving, summary, month) {
  const isKm = languageCode() === "km";
  const L = (km, en) => isKm ? km : en;
  const plainMoney = (amount, currency) => String(money(amount, currency)).replace(/<[^>]*>/g, "");
  const monthParts = month.split("-").map(Number);
  const kmMonths = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const monthName = isKm ? `ខែ${kmMonths[monthParts[1] - 1]} ${monthParts[0]}` : new Date(monthParts[0], monthParts[1] - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currency = transaction.currency || saving.currency || appData.profile.currency || "USD";
  const chi = transaction.goldChi === "custom" ? Number(transaction.goldWeightGrams || 0) / 3.75 : Number(transaction.goldChi || 0);
  const monthTotals = Object.entries(summary.totals).map(([code, value]) => plainMoney(value, code)).join(" + ");
  const detail = [transaction.type === "spend" ? transaction.category : "", transaction.note].filter(Boolean).join(" · ");
  const action = transaction.type === "gold"
    ? L(`ទិញមាស ${chi.toLocaleString("en-US", { maximumFractionDigits: 2 })} ជី ${transaction.goldPurity || "24K"}`, `Bought ${chi.toLocaleString("en-US", { maximumFractionDigits: 2 })} Chi gold`)
    : transaction.type === "investment"
      ? L(`វិនិយោគ/ប្រើផ្សេងៗ ${detail}`, `Investment / other use: ${detail}`)
      : L(`ចំណាយ ${detail || ""}`, `Spent on ${detail || "an item"}`);
  const title = L("បានប្រើប្រាក់ពីសន្សំ", "Savings money used");
  const body = L(`${plainMoney(transaction.totalDebit ?? transaction.amount, currency)} · ${action} · សរុបខែនេះ ${monthTotals}`, `${plainMoney(transaction.totalDebit ?? transaction.amount, currency)} · ${action} · ${monthTotals} used this month`);
  return { title: `${title} · ${monthName}`, body };
}

async function showSavingsUseAppAlert(alert, transactionId) {
  try {
    const plugin = typeof NotificationManager !== "undefined" ? NotificationManager.getPlugin?.() : null;
    if (plugin) {
      const permission = await plugin.checkPermissions();
      if (permission.display === "granted") {
        await plugin.schedule({ notifications: [{ id: Math.floor(Date.now() % 2147483000), title: alert.title, body: alert.body, schedule: { at: new Date(Date.now() + 1200) }, sound: "default", extra: { url: "/#money/savings", transactionId } }] });
        return;
      }
    }
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const options = { body: alert.body, icon: "/assets/icons/mylife-icon-192.png", tag: `savings-use-${transactionId}`, data: { url: "/#money/savings" } };
    const registration = await navigator.serviceWorker?.ready.catch(() => null);
    if (registration?.showNotification) await registration.showNotification(alert.title, options);
    else new Notification(alert.title, options);
  } catch (error) {
    console.warn("MYLIFE could not show the savings-use app notification.", error);
  }
}

async function sendSavingsUseTelegramAlert(transaction, saving, summary) {
  const token = await ReportTelegram.accessToken();
  if (!token) throw new Error("not_signed_in");
  const response = await fetch("/api/savings-use-alert", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      language: languageCode() === "km" ? "km" : "en",
      monthlyTotals: summary.totals,
      monthlyBreakdown: summary.byType,
      use: {
        id: transaction.id, date: transaction.date, type: transaction.type, amount: transaction.amount, currency: transaction.currency,
        goldChi: transaction.goldChi, goldWeightGrams: transaction.goldWeightGrams, goldPurity: transaction.goldPurity,
        category: transaction.category, note: transaction.note, savingName: saving.name, balanceAfter: saving.currentAmount
      }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `telegram_send_${response.status}`);
  return result;
}

function openLoanModal(item) {
  Modal.open({ title: item ? t("editLoan") : t("addLoan"), submitText: item ? t("saveLoan") : t("addLoan"), sectioned: true, fields: [
    { type: "heading", label: languageCode() === "km" ? "ព័ត៌មានកម្ចី" : "Loan details", description: languageCode() === "km" ? "បញ្ចូលឈ្មោះ និងចំនួនប្រាក់កម្ចី។" : "Enter the loan name and amount.", icon: Icons.money(), tone: "blue" },
    { name: "name", label: t("loanName"), value: item?.name, required: true },
    { name: "originalAmount", label: t("originalAmount"), type: "number", value: item?.originalAmount, required: true },
    { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: item?.currency || appData.profile.currency || "USD" },
    { type: "heading", label: languageCode() === "km" ? "ផែនការសងប្រាក់" : "Repayment plan", description: languageCode() === "km" ? "កំណត់ការប្រាក់ រយៈពេល និងចំនួនបង់ប្រចាំខែ។" : "Set the interest rate, term, and monthly payment.", icon: Icons.chart(), tone: "violet" },
    { name: "interestRate", label: t("interestRate"), type: "number", value: item?.interestRate || "" },
    { name: "durationMonths", label: t("loanDurationMonths"), type: "number", value: item?.durationMonths || "" },
    { name: "monthlyPayment", label: t("monthlyPayment"), type: "number", value: item?.monthlyPayment || 0 },
    { name: "paymentType", label: languageCode() === "km" ? "វិធីបង់កម្ចី" : "Repayment method", type: "select", options: ["unspecified", "cash", "bank", "qr", "other"], optionLabels: languageCode() === "km" ? ["មិនបានបញ្ជាក់", "សាច់ប្រាក់", "ផ្ទេរធនាគារ", "បង់ QR", "ផ្សេងៗ"] : ["Unspecified", "Cash", "Bank Transfer", "QR Payment", "Other"], value: item?.paymentType || "unspecified" },
    { type: "heading", label: languageCode() === "km" ? "កាលបរិច្ឆេទ និងការរំលឹក" : "Dates & reminders", description: languageCode() === "km" ? "ជ្រើសថ្ងៃបង់លើកដំបូង និងកាលបរិច្ឆេទបញ្ចប់។" : "Choose the first payment and final due date.", icon: Icons.calendar(), tone: "blue" },
    { name: "firstPaymentDate", label: t("firstPaymentDate"), type: "date", value: normalizeLoanPaymentDate(item?.firstPaymentDate || item?.startDate) },
    { name: "paymentDay", label: t("paymentDay"), type: "number", value: item ? (item.paymentDay || loanPaymentDay(item)) : "" },
    { name: "dueDate", label: t("dueDate"), type: "date", value: item?.dueDate },
    { name: "ask", label: languageCode() === "km" ? "💸 សួរ “បានបង់ហើយឬនៅ?” ពេលដល់ថ្ងៃ" : "💸 Ask “paid yet?” on the day", type: "checkbox", value: item?.ask ?? true },
    { type: "heading", label: languageCode() === "km" ? "កំណត់ចំណាំ" : "Notes", description: languageCode() === "km" ? "ព័ត៌មានបន្ថែមអំពីកម្ចីនេះ (ស្រេចចិត្ត)។" : "Add any extra details about this loan (optional).", icon: Icons.edit(), tone: "amber" },
    { name: "notes", label: t("notes"), type: "textarea", value: item?.notes }
  ], onSubmit(data) {
    const rawFirstPaymentDate = normalizeLoanPaymentDate(data.firstPaymentDate || data.startDate || "");
    const paymentDayValue = Number(data.paymentDay || 0) || loanPaymentDay({ firstPaymentDate: rawFirstPaymentDate });
    const firstPaymentDate = applyLoanPaymentDay(rawFirstPaymentDate, paymentDayValue);
    const durationMonths = Number(data.durationMonths || 0) || inferLoanDurationMonths(firstPaymentDate, data.dueDate);
    const calculatedRate = calculateLoanRate(data.originalAmount, data.monthlyPayment, durationMonths);
    const interestRate = Number(data.interestRate || 0) || calculatedRate;
    const calculatedPayment = calculateLoanPayment(data.originalAmount, interestRate, durationMonths);
    const monthlyPayment = Number(data.monthlyPayment || 0) || calculatedPayment;
    const dueDate = data.dueDate || calculateLoanDueDate(firstPaymentDate, durationMonths);
    const record = {
      ...item,
      ...data,
      originalAmount: Number(data.originalAmount || 0),
      currency: data.currency || appData.profile.currency || "USD",
      interestRate,
      durationMonths,
      monthlyPayment,
      paymentFrequency: "Monthly",
      firstPaymentDate,
      startDate: firstPaymentDate,
      paymentDay: paymentDayValue,
      dueDate,
      payments: item?.payments || []
    };
    item ? Store.edit("loans", item.id, record) : Store.add("loans", record);
    Toast.show(item ? t("loanSaved") : t("loanAdded"));
  } });
  bindLoanSmartFill();
}

function bindLoanSmartFill() {
  const form = document.getElementById("modalForm");
  if (!form) return;
  const amount = form.elements.originalAmount;
  const interest = form.elements.interestRate;
  const duration = form.elements.durationMonths;
  const payment = form.elements.monthlyPayment;
  const paymentDay = form.elements.paymentDay;
  const currency = form.elements.currency;
  const firstPaymentDate = form.elements.firstPaymentDate;
  const dueDate = form.elements.dueDate;
  if (!amount || !interest || !duration || !payment) return;

  const paymentField = payment.closest(".field");
  const helper = document.createElement("div");
  helper.className = "smart-fill";
  helper.innerHTML = `
    <div class="smart-fill-copy"><span class="smart-fill-icon" aria-hidden="true">${Icons.spark()}</span><span class="smart-fill-message">${t("smartFillNeedDates")}</span></div>
    <button class="button ghost-button" type="button" disabled>${Icons.plus()} ${t("applySuggestion")}</button>
  `;
  paymentField.appendChild(helper);

  const message = helper.querySelector(".smart-fill-message");
  const button = helper.querySelector("button");
  const updateSuggestion = () => {
    const autoRate = interest.dataset.smartRate || "";
    const manualInterestRate = interest.value && interest.value !== autoRate ? interest.value : "";
    const suggestion = suggestLoanPayment({
      originalAmount: amount.value,
      interestRate: manualInterestRate,
      durationMonths: duration.value,
      monthlyPayment: payment.value,
      paymentDay: paymentDay?.value,
      dueDate: dueDate?.value,
      firstPaymentDate: firstPaymentDate?.value
    });
    if (!suggestion) {
      message.textContent = t("smartFillNeedDates");
      button.disabled = true;
      button.dataset.value = "";
      return;
    }
    if (suggestion.type === "rate") {
      message.textContent = `${t("suggestedRate")} ${suggestion.interestRate}% (${suggestion.count} ${t("months")}, ${t("totalInterest").toLowerCase()} ${formatPlainMoney(suggestion.totalInterest, currency?.value)})`;
      interest.value = suggestion.interestRate;
      interest.dataset.smartRate = suggestion.interestRate;
    } else {
      message.textContent = `${t("suggestedPayment")} ${formatPlainMoney(suggestion.amount, currency?.value)} ${t("monthlyPayment").toLowerCase()} (${suggestion.count} ${t("months")}, ${t("totalInterest").toLowerCase()} ${formatPlainMoney(suggestion.totalInterest, currency?.value)})`;
    }
    button.disabled = false;
    button.dataset.type = suggestion.type;
    button.dataset.value = suggestion.amount;
    button.dataset.rate = suggestion.interestRate || "";
    button.dataset.durationMonths = suggestion.count || "";
    button.textContent = suggestion.type === "rate" ? t("applyRate") : t("applySuggestion");
    button.dataset.dueDate = suggestion.dueDate || "";
    if (dueDate && suggestion.dueDate && (!dueDate.value || dueDate.value === dueDate.dataset.smartDueDate)) {
      dueDate.value = suggestion.dueDate;
      dueDate.dataset.smartDueDate = suggestion.dueDate;
    }
    if (paymentDay && firstPaymentDate?.value && (!Number(paymentDay.value || 0) || paymentDay.value === paymentDay.dataset.smartPaymentDay)) {
      paymentDay.value = String(parseLoanDate(firstPaymentDate.value).getDate());
      paymentDay.dataset.smartPaymentDay = paymentDay.value;
    }
  };

  [amount, interest, duration, payment, paymentDay, currency, firstPaymentDate, dueDate].filter(Boolean).forEach(input => input.addEventListener("input", updateSuggestion));
  interest.addEventListener("input", () => {
    if (interest.value !== interest.dataset.smartRate) interest.dataset.smartRate = "";
  });
  dueDate?.addEventListener("input", () => {
    if (dueDate.value !== dueDate.dataset.smartDueDate) dueDate.dataset.smartDueDate = "";
  });
  paymentDay?.addEventListener("input", () => {
    if (paymentDay.value !== paymentDay.dataset.smartPaymentDay) paymentDay.dataset.smartPaymentDay = "";
  });
  [currency, firstPaymentDate, dueDate].filter(Boolean).forEach(input => input.addEventListener("change", updateSuggestion));
  button.addEventListener("click", () => {
    if (button.dataset.type === "rate") {
      if (!button.dataset.rate) return;
      interest.value = button.dataset.rate;
      interest.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      if (!button.dataset.value) return;
      payment.value = button.dataset.value;
      payment.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (duration && !duration.value && button.dataset.durationMonths) duration.value = button.dataset.durationMonths;
    if (dueDate && !dueDate.value && button.dataset.dueDate) dueDate.value = button.dataset.dueDate;
    Toast.show(t("smartFilled"));
  });
  updateSuggestion();
}

function suggestLoanPayment({ originalAmount, interestRate, durationMonths, monthlyPayment, paymentDay, firstPaymentDate, dueDate }) {
  const total = Number(originalAmount || 0);
  const effectiveFirstPaymentDate = applyLoanPaymentDay(firstPaymentDate, paymentDay);
  const count = Math.round(Number(durationMonths || 0)) || inferLoanDurationMonths(effectiveFirstPaymentDate, dueDate);
  if (!total || !count || count < 1) return null;
  const enteredPayment = Number(monthlyPayment || 0);
  const enteredRate = Number(interestRate || 0);
  if (enteredPayment && !enteredRate) {
    const calculatedRate = calculateLoanRate(total, enteredPayment, count);
    const totalPayable = enteredPayment * count;
    return {
      type: "rate",
      amount: enteredPayment.toFixed(2),
      interestRate: calculatedRate.toFixed(2),
      count,
      dueDate: calculateLoanDueDate(effectiveFirstPaymentDate, count),
      totalInterest: Math.max(0, totalPayable - total)
    };
  }
  const amount = calculateLoanPayment(total, enteredRate, count);
  const totalPayable = amount * count;
  return {
    type: "payment",
    amount: amount.toFixed(2),
    count,
    dueDate: calculateLoanDueDate(effectiveFirstPaymentDate, count),
    totalInterest: Math.max(0, totalPayable - total)
  };
}

function calculateLoanRate(originalAmount, monthlyPayment, durationMonths) {
  const principal = Number(originalAmount || 0);
  const payment = Number(monthlyPayment || 0);
  const months = Math.round(Number(durationMonths || 0));
  if (!principal || !payment || !months) return 0;
  if (payment <= principal / months) return 0;

  let low = 0;
  let high = 1;
  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const estimated = principal * mid / (1 - Math.pow(1 + mid, -months));
    if (estimated > payment) high = mid;
    else low = mid;
  }
  return roundRate(((low + high) / 2) * 12 * 100);
}

function calculateLoanPayment(originalAmount, interestRate, durationMonths) {
  const principal = Number(originalAmount || 0);
  const months = Math.round(Number(durationMonths || 0));
  const monthlyRate = Number(interestRate || 0) / 100 / 12;
  if (!principal || !months) return 0;
  if (!monthlyRate) return roundMoney(principal / months);
  return roundMoney(principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
}

function inferLoanDurationMonths(firstPaymentDate, dueDate) {
  if (!firstPaymentDate || !dueDate) return 0;
  const first = parseLoanDate(firstPaymentDate);
  const due = parseLoanDate(dueDate);
  if (Number.isNaN(first.getTime()) || Number.isNaN(due.getTime()) || due < first) return 0;
  const monthDiff = (due.getFullYear() - first.getFullYear()) * 12 + due.getMonth() - first.getMonth();
  return Math.max(1, monthDiff + (due.getDate() >= first.getDate() ? 1 : 0));
}

function calculateLoanDueDate(firstPaymentDate, durationMonths) {
  const months = Math.round(Number(durationMonths || 0));
  if (!firstPaymentDate || !months) return "";
  const first = parseLoanDate(firstPaymentDate);
  if (Number.isNaN(first.getTime())) return "";
  return toDateInput(addMonths(first, months - 1));
}

function parseLoanDate(value) {
  const normalized = normalizeLoanPaymentDate(value);
  return new Date(`${normalized}T00:00:00`);
}

function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function toDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function roundRate(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatPlainMoney(value, currency = appData.profile.currency || "USD") {
  return rielText(new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "KHR" ? 0 : 2 }).format(Number(value || 0)));
}

function openBillModal(item) {
  if (typeof BillForm !== "undefined") return BillForm.open(item);
  Modal.open({ title: item ? t("editBill") : t("addBill"), submitText: item ? t("saveBill") : t("addBill"), fields: [
    { name: "name", label: t("billName"), value: item?.name, required: true },
    { name: "amount", label: t("amount"), type: "number", value: item?.amount, required: true },
    { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: item?.currency || appData.profile.currency || "USD" },
    { name: "frequency", label: t("frequency"), type: "select", options: ["Weekly", "Monthly", "Quarterly", "Yearly"], value: item?.frequency || "Monthly" },
    { name: "due", label: t("dueDateDay"), type: "date", value: item?.due },
    { name: "category", label: t("category"), value: item?.category },
    { name: "paymentType", label: languageCode() === "km" ? "វិធីបង់ប្រាក់" : "Payment method", type: "select", options: ["unspecified", "cash", "bank", "qr", "other"], optionLabels: languageCode() === "km" ? ["មិនបានបញ្ជាក់", "សាច់ប្រាក់", "ផ្ទេរធនាគារ", "បង់ QR", "ផ្សេងៗ"] : ["Unspecified", "Cash", "Bank Transfer", "QR Payment", "Other"], value: item?.paymentType || "unspecified" },
    { name: "reminder", label: t("reminder"), type: "checkbox", value: item?.reminder ?? true },
    { name: "autoPay", label: languageCode() === "km" ? "🔁 បង់ស្វ័យប្រវត្តិ (Netflix, Wi-Fi…) — កត់ជាចំណាយដោយខ្លួនឯងនៅថ្ងៃបង់" : "🔁 Auto-pay (subscriptions) — logged as an expense on the due date", type: "checkbox", value: item?.autoPay ?? false },
    { name: "status", label: t("status"), type: "select", options: ["Upcoming", "Paid", "Overdue"], value: item?.status || "Upcoming" },
    { name: "notes", label: t("notes"), type: "textarea", value: item?.notes }
  ], onSubmit(data) { const record = { ...data, amount: Number(data.amount || 0), currency: data.currency || appData.profile.currency || "USD" }; item ? Store.edit("bills", item.id, record) : Store.add("bills", record); Toast.show(item ? t("billSaved") : t("billAdded")); } });
}

function openLoanPaymentModal(loan) {
  Modal.open({ title: t("makePayment"), submitText: t("savePayment"), fields: [
    { name: "amount", label: t("amount"), type: "number", value: loan.monthlyPayment || "", required: true },
    { name: "date", label: t("date"), type: "date", value: localDateInput(), required: true },
    { name: "paymentType", label: languageCode() === "km" ? "វិធីបង់ប្រាក់" : "Payment method", type: "select", options: ["unspecified", "cash", "bank", "qr", "other"], optionLabels: languageCode() === "km" ? ["មិនបានបញ្ជាក់", "សាច់ប្រាក់", "ផ្ទេរធនាគារ", "បង់ QR", "ផ្សេងៗ"] : ["Unspecified", "Cash", "Bank Transfer", "QR Payment", "Other"], value: "unspecified", required: true }
  ], onSubmit(data) {
    const amount = Number(data.amount || 0);
    if (LoanPay.findPayment(loan, data.date)) {
      // a second (partial) payment on the same day: its own expense, still counted once
      const payment = { amount, date: data.date, scheduled: false };
      const id = `expenses-loan-${loan.id}-${data.date}-${Date.now()}`;
      appData.expenses.push({ id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), description: loan.name || t("loan"), amount, currency: loan.currency || appData.profile.currency || "USD", date: data.date, category: "Loan", method: ({ cash: "Cash", bank: "Bank Transfer", qr: "QR Payment", other: "Other" })[data.paymentType] || "Other", paymentType: data.paymentType || "other", notes: "", loanId: loan.id, loanPaymentDate: `${data.date}#${Date.now()}` });
      payment.expenseId = id;
      loan.payments = [payment, ...(loan.payments || [])];
      loan.updatedAt = new Date().toISOString();
    } else {
      LoanPay.recordLoanPayment(appData, loan, data.date, { amount, scheduled: false, today: localDateInput(), paymentType: data.paymentType, paymentMethod: ({ cash: "Cash", bank: "Bank Transfer", qr: "QR Payment", other: "Other" })[data.paymentType] });
    }
    Store.save();
    if (typeof DoneFeed !== "undefined") DoneFeed.afterLoanPay(loan, data.date); else Toast.show(t("paymentSaved"));
    App.render();
  } });
}
