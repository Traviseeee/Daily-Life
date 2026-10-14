const moneyTabs = [
  ["overview", "overview", "chart"],
  ["income", "income", "salary"],
  ["expenses", "expenses", "expense"],
  ["savings", "savings", "savings"],
  ["loans", "loans", "loan"],
  ["bills", "bills", "bill"],
  ["budget", "budget", "budget"],
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
const expenseCategories = ["Food", "Home", "Family", "Transport", "Shopping", "Bills", "Education", "Health", "Entertainment", "Other"];
const expenseCategoryColors = {
  Food: "#fb7185",
  Home: "#f59e0b",
  Family: "#f472b6",
  Transport: "#60a5fa",
  Shopping: "#a78bfa",
  Bills: "#f97316",
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
  Education: "graduation",
  Health: "heart",
  Entertainment: "memory",
  Other: "chart"
};
let financeReportMonth = "";
let financeReportCanvas = null;
let financeReportCanvasMonth = "";

function renderMoney(tab = "overview") {
  const stats = Store.calculate();
  return `
    <section class="page">
      <div class="page-header financial-header">
        <div class="financial-header-main">
          <div class="financial-header-copy">
            <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.money()}</span>${t("money")}</h1>
            <p class="page-subtitle">${t("moneySubtitle")}</p>
          </div>
          <div class="financial-nav-dock">
            <button class="financial-nav-toggle" type="button" data-open-financial-nav aria-label="${t("money")} sections" title="${t("money")} sections"><span class="financial-nav-toggle-lines" aria-hidden="true"><i></i><i></i><i></i></span></button>
            <dialog class="financial-sidebar" aria-label="${t("money")} sections">
              <div class="financial-sidebar-handle" aria-hidden="true"><span></span></div>
              <div class="financial-sidebar-heading"><div class="financial-sidebar-heading-copy"><strong>${t("money")} ${t("sections")}</strong><span>${t("financialSectionsSubtitle")}</span></div><button class="icon-button" type="button" data-close-financial-nav aria-label="${t("close")}">${Icons.close()}</button></div>
              <nav class="financial-sidebar-nav" aria-label="${t("money")} sections">
              ${moneyTabs.map(([id, label, icon]) => `<a class="financial-nav-item ${tab === id ? "active" : ""}" href="#money/${id}"><span class="financial-nav-icon">${Icons[icon]()}</span><span class="financial-nav-copy"><strong>${t(label)}</strong><small>${t(`financialSection${id[0].toUpperCase()}${id.slice(1)}`)}</small></span>${Icons.chevron()}</a>`).join("")}
              </nav>
            </dialog>
          </div>
        </div>
        <button class="button financial-create-button" type="button" data-action="add-expense">${Icons.plus()} ${t("addExpense")}</button>
      </div>
      <div class="financial-layout">
        <div class="financial-content">
          ${renderMoneyTab(tab, stats)}
        </div>
      </div>
    </section>
  `;
}

function renderMoneyCards(stats) {
  return `<div class="summary-grid financial-metric-grid grid" role="region" aria-label="${escapeAttr(t("overview"))}" tabindex="0">
    ${summaryCard("Income", t("totalIncome"), money(stats.totalIncome), `${appData.income.length} ${t("income")}`, Icons.salary(), "green", "income")}
    ${summaryCard("Expenses", t("totalExpenses"), money(stats.totalExpenses), `${appData.expenses.length} ${t("expenses")}`, Icons.expense(), "", "expenses")}
    ${summaryCard("Savings", t("totalSavings"), money(stats.totalSavings), `${money(stats.monthlySavings)} ${t("monthlyContribution")}`, Icons.savings(), "blue", "savings")}
    ${summaryCard("Available", t("available"), money(stats.available), t("availableMoney"), Icons.wallet(), "purple", "budget")}
  </div>`;
}

function renderCategoryOverview() {
  const categories = expenseCategories.map(category => ({
    category,
    amount: sumMoney(appData.expenses.filter(expense => expense.category === category), "amount"),
    color: expenseCategoryColors[category]
  })).filter(item => item.amount > 0).sort((left, right) => right.amount - left.amount);
  const total = categories.reduce((sum, item) => sum + item.amount, 0);

  return `<article class="glass-card card-pad financial-panel financial-category-overview">
    <div class="financial-panel-heading">
      <div><span class="eyebrow">${t("overview")}</span><h2 class="section-title">${t("spendingByCategory")}</h2></div>
      <div class="financial-category-total"><span>${t("totalExpenses")}</span><strong>${money(total)}</strong></div>
    </div>
    ${categories.length ? `<div class="financial-category-layout">
      <div class="financial-category-chart" role="img" aria-label="${t("spendingByCategory")}">
        ${Charts.donut(categories.map(item => ({ value: item.amount, color: item.color })))}
        <div class="financial-category-chart-center"><strong>${money(total)}</strong><span>${t("expenses")}</span></div>
      </div>
      <div class="financial-category-list">
        ${categories.map(item => {
          const share = Math.round((item.amount / total) * 100);
          return `<div class="financial-category-item" style="--category-color:${item.color};--category-share:${share}%">
            <span class="financial-category-icon" aria-hidden="true">${Icons[expenseCategoryIcons[item.category]]()}</span>
            <div class="financial-category-copy"><div class="financial-category-label"><span>${optionLabel(item.category)}</span><strong>${money(item.amount)}</strong></div><div class="financial-category-track"><span></span></div></div>
            <span class="financial-category-share">${share}%</span>
          </div>`;
        }).join("")}
      </div>
    </div>` : `<div class="financial-category-empty">
      <div class="financial-category-swatches" aria-hidden="true">${expenseCategories.slice(0, 6).map(category => `<span style="--category-color:${expenseCategoryColors[category]}"></span>`).join("")}</div>
      <div><strong>${t("noExpensesYet")}</strong><p>${t("noExpensesBody")}</p></div>
      <button class="button" type="button" data-action="add-expense">${Icons.plus()} ${t("addExpense")}</button>
    </div>`}
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
  if (tab === "income") return renderIncome();
  if (tab === "expenses") return renderExpenses();
  if (tab === "savings") return renderSavings();
  if (tab === "loans") return renderLoans();
  if (tab === "bills") return renderBills();
  if (tab === "budget") return renderBudget();
  if (tab === "reports") return renderReports(stats);
  return `
    ${renderMoneyCards(stats)}
    ${renderCategoryOverview()}
    <div class="grid two-col financial-overview-grid">
      <article class="glass-card card-pad financial-panel">
        <div class="financial-panel-heading">
          <div>
            <span class="eyebrow">${t("overview")}</span>
            <h2 class="section-title">${t("incomeVsExpenses")}</h2>
          </div>
          <span class="icon-badge blue">${Icons.chart()}</span>
        </div>
        ${stats.totalIncome || stats.totalExpenses || stats.monthlySavings || stats.monthlyLoanPayments ? `<div class="financial-chart-bars">${Charts.bars([
          { label: t("income"), value: stats.totalIncome, color: "linear-gradient(90deg,#9dff6e,#64f4d2)" },
          { label: t("expenses"), value: stats.totalExpenses, color: "linear-gradient(90deg,#ff6f9c,#9b6dff)" },
          { label: t("monthlyContribution"), value: stats.monthlySavings, color: "linear-gradient(90deg,#64f4d2,#b8ff5a)" },
          { label: t("monthlyPayment"), value: stats.monthlyLoanPayments, color: "linear-gradient(90deg,#9b6dff,#b8ff5a)" }
        ])}</div>` : moneyEmptyCard()}
      </article>
      <article class="glass-card card-pad financial-panel">
        <div class="financial-panel-heading">
          <div>
            <span class="eyebrow">${t("expenses")}</span>
            <h2 class="section-title">${t("recentTransactions")}</h2>
          </div>
          <span class="pill">${appData.expenses.length} ${t("expenses")}</span>
        </div>
        ${expenseLedger(appData.expenses.slice(0, 5))}
      </article>
    </div>
  `;
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
  return `<div class="list-row financial-row"><span class="icon-badge green">${Icons.salary()}</span><div class="financial-row-main"><strong>${escapeHtml(item.name)}</strong><span class="secondary">${optionLabel(item.category || "Other")}</span></div><span class="financial-row-amount success">${money(item.amount, item.currency)}</span><span class="pill">${optionLabel(item.frequency)}</span><div class="financial-row-actions"><button class="icon-button" data-edit-income="${item.id}" aria-label="${t("editIncome")}">${Icons.edit()}</button><button class="icon-button" data-delete-income="${item.id}" aria-label="${t("delete")}">${Icons.trash()}</button></div></div>`;
}

function renderExpenses() {
  return `<article class="glass-card card-pad financial-panel"><div class="between"><h2 class="section-title">${t("expenses")}</h2><button class="button" data-action="add-expense">${Icons.plus()} ${t("addExpense")}</button></div>${expenseLedger(appData.expenses)}</article>`;
}

function expenseLedger(items) {
  if (!items.length) return emptyState(t("noExpensesYet"), t("noExpensesBody"), t("addExpense"), "add-expense");
  return `
    <div class="financial-ledger-table">
      <div class="financial-ledger-head" aria-hidden="true">
        <span>${t("expense")}</span>
        <span>${t("category")}</span>
        <span>${t("amount")}</span>
        <span>${t("date")}</span>
        <span></span>
      </div>
      <div class="list financial-ledger">${items.map(expenseRow).join("")}</div>
    </div>
  `;
}

function expenseRow(item) {
  return `<div class="list-row financial-row financial-expense-row"><div class="financial-row-main"><strong>${escapeHtml(item.description)}</strong></div><span class="pill financial-category-pill">${optionLabel(item.category)}</span><span class="financial-row-amount danger">-${money(item.amount, item.currency)}</span><span class="financial-row-date">${formatDate(item.date, { month: "short", day: "numeric" })}</span><div class="financial-row-actions"><button class="icon-button" data-edit-expense="${item.id}" aria-label="${t("edit")}">${Icons.edit()}</button><button class="icon-button" data-delete-expense="${item.id}" aria-label="${t("delete")}">${Icons.trash()}</button></div></div>`;
}

function renderSavings() {
  return `<article class="glass-card card-pad financial-panel"><div class="between"><h2 class="section-title">${t("savings")}</h2><button class="button" data-action="add-savings">${Icons.plus()} ${t("addSavings")}</button></div>${appData.savings.length ? `<div class="grid three-col financial-card-grid">${appData.savings.map(savingCard).join("")}</div>` : emptyState(t("noSavingsYet"), t("noSavingsBody"), t("addSavings"), "add-savings")}</article>`;
}

function getSavingsContributionMonth() {
  return new Date().toISOString().slice(0, 7);
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

  return `<div class="goal-item financial-mini-card"><div class="between"><strong>${escapeHtml(item.name)}</strong><span class="pill">${pct(item.currentAmount, item.targetAmount)}%</span></div><div class="financial-card-amount">${money(item.currentAmount, item.currency)} / ${money(item.targetAmount, item.currency)}</div><div class="progress-track"><div class="progress-fill" style="--progress:${pct(item.currentAmount, item.targetAmount)}%"></div></div><div class="financial-meta-line"><span>${t("deadline")}</span><strong>${formatDate(item.deadline)}</strong></div><div class="financial-meta-line"><span>${t("monthlyContribution")}</span><strong>${money(monthlyAmount, item.currency)}</strong></div><div class="savings-smart-panel"><div class="between"><strong>${t("thisMonth")}</strong><span class="pill ${isPaidThisMonth ? "success" : ""}">${isPaidThisMonth ? t("saved") : t("pending")}</span></div><label class="payment-schedule-row ${isPaidThisMonth ? "paid" : ""}"><input class="check" type="checkbox" data-savings-contribution="${item.id}" data-savings-month="${monthKey}" ${isPaidThisMonth ? "checked" : ""}><span><strong>${formatSavingsMonth(monthKey)}</strong><small>${money(monthlyAmount, item.currency)}</small></span></label>${recentHistory ? `<div class="savings-history-list">${recentHistory}</div>` : ""}</div><div class="action-row"><button class="button ghost-button" data-edit-savings="${item.id}">${Icons.edit()} ${t("edit")}</button><button class="icon-button" data-delete-savings="${item.id}" aria-label="${t("delete")}">${Icons.trash()}</button></div></div>`;
}

function renderLoans() {
  return `<article class="glass-card card-pad financial-panel"><div class="between"><h2 class="section-title">${t("loans")}</h2><button class="button" data-action="add-loan">${Icons.plus()} ${t("addLoan")}</button></div>${appData.loans.length ? `<div class="grid loan-list">${appData.loans.map(loanCard).join("")}</div>` : emptyState(t("noLoansYet"), t("noLoansBody"))}</article>`;
}

function loanCard(loan) {
  const remaining = loanRemaining(loan);
  const paid = loanPaid(loan);
  const totalPayable = loanPayoffAmount(loan);
  const totalInterest = Math.max(0, totalPayable - Number(loan.originalAmount || 0));
  const progressTarget = totalPayable || Number(loan.originalAmount || 0);
  const paymentDay = loanDisplayPaymentDay(loan);
  return `<div class="loan-card"><div class="loan-card-header"><div><h3>${escapeHtml(loan.name)}</h3><p>${loan.durationMonths ? `${loan.durationMonths} ${t("months")}` : optionLabel(loan.paymentFrequency || "Monthly")} · ${t("interest")} ${loan.interestRate || 0}% · ${t("paymentDay")} ${paymentDay ? formatPaymentDay(paymentDay) : t("notSet")}</p></div><span class="icon-badge blue">${Icons.loan()}</span></div><div class="loan-metrics"><div><span>${t("remaining")}</span><strong>${money(remaining, loan.currency)}</strong></div><div><span>${t("monthlyPayment")}</span><strong>${money(loan.monthlyPayment, loan.currency)}</strong></div><div><span>${t("nextPaymentDate")}</span><strong>${formatDate(nextLoanPaymentDate(loan), { month: "short", day: "numeric" })}</strong></div><div><span>${t("dueDate")}</span><strong>${formatDate(loan.dueDate, { month: "short", year: "numeric" })}</strong></div></div><div><div class="progress-track"><div class="progress-fill" style="--progress:${pct(paid, progressTarget)}%"></div></div><p class="trend">${pct(paid, progressTarget)}% ${t("paid")} · ${money(paid, loan.currency)} / ${money(progressTarget, loan.currency)}</p></div><div class="loan-meta"><span>${t("original")}: <strong>${money(loan.originalAmount, loan.currency)}</strong></span><span>${t("firstPaymentDate")}: <strong>${formatDate(loan.firstPaymentDate || loan.startDate)}</strong></span><span>${t("totalInterest")}: <strong>${money(totalInterest, loan.currency)}</strong></span></div>${renderLoanPaymentSchedule(loan)}<div class="action-row"><button class="button" data-payment-loan="${loan.id}">${Icons.plus()} ${t("makePayment")}</button><button class="button ghost-button" data-edit-loan="${loan.id}">${Icons.edit()} ${t("edit")}</button><button class="icon-button" data-delete-loan="${loan.id}" aria-label="${t("delete")}">${Icons.trash()}</button></div></div>`;
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
  return `<div class="goal-item financial-mini-card"><div class="between"><span class="icon-badge blue">${Icons.bill()}</span><span class="pill ${bill.status === "Paid" ? "success" : ""}">${optionLabel(bill.status || "Upcoming")}</span></div><h3>${escapeHtml(bill.name)}</h3><div class="metric compact-metric">${money(bill.amount, bill.currency)}</div><div class="financial-meta-line"><span>${t("dueDate")}</span><strong>${formatDate(bill.due)}</strong></div><p class="secondary">${optionLabel(bill.frequency)} · ${optionLabel(bill.category)}</p><div class="action-row"><button class="button ghost-button" data-edit-bill="${bill.id}">${Icons.edit()} ${t("edit")}</button><button class="icon-button" data-delete-bill="${bill.id}" aria-label="${t("delete")}">${Icons.trash()}</button></div></div>`;
}

function renderBudget() {
  const categories = [...new Set(appData.expenses.map(expense => expense.category))];
  return `<article class="glass-card card-pad financial-panel"><h2 class="section-title">${t("spendingByCategory")}</h2><div class="grid financial-card-grid">${categories.map(category => {
    const spent = sumMoney(appData.expenses.filter(e => e.category === category), "amount");
    const max = Math.max(...categories.map(cat => sumMoney(appData.expenses.filter(e => e.category === cat), "amount")), 1);
    return `<div class="goal-item financial-mini-card"><div class="between"><strong>${optionLabel(category)}</strong><span class="financial-row-amount">${money(spent)}</span></div><div class="progress-track"><div class="progress-fill" style="--progress:${(spent / max) * 100}%"></div></div></div>`;
  }).join("") || emptyState(t("noBudgetYet"), t("noBudgetBody"), t("addExpense"), "add-expense")}</div></article>`;
}

function renderReports() {
  const month = financeReportMonth || new Date().toISOString().slice(0, 7);
  const report = buildMonthlyFinanceReport(month);
  return `<article class="glass-card card-pad financial-panel financial-report-panel">
    <div class="financial-report-toolbar">
      <div><span class="eyebrow">${t("reports")}</span><h2 class="section-title">${t("monthlyReport")}</h2></div>
      <label class="field financial-report-month"><span>${t("reportMonth")}</span><input type="month" value="${escapeAttr(month)}" data-finance-report-month></label>
      <div class="financial-report-export-actions">
        <button class="button" type="button" data-finance-report-export="excel">${Icons.arrowDown()} ${t("exportExcel")}</button>
        <button class="button ghost-button" type="button" data-finance-report-export="word">${Icons.arrowDown()} ${t("exportWord")}</button>
        <button class="button ghost-button" type="button" data-finance-report-preview>${Icons.memory()} ${t("previewJpg")}</button>
      </div>
    </div>
    <div class="financial-report-metadata">
      <div><span>${t("reportOwner")}</span><strong>${escapeHtml(report.ownerName)}</strong></div>
      <div><span>${t("reportMonth")}</span><strong>${escapeHtml(report.monthLabel)}</strong></div>
      <div><span>${t("reportCurrency")}</span><strong>${escapeHtml(report.currency)}</strong></div>
      <div><span>${t("generatedOn")}</span><strong>${escapeHtml(report.generatedOn)}</strong></div>
    </div>
    <div class="financial-report-summary">
      <div class="financial-report-metric"><span>${t("monthlyIncome")}</span><strong>${money(report.incomeTotal)}</strong></div>
      <div class="financial-report-metric"><span>${t("monthlyExpenses")}</span><strong>${money(report.expenseTotal)}</strong></div>
      <div class="financial-report-metric"><span>${t("monthlyPayment")}</span><strong>${money(report.loanPaymentTotal)}</strong></div>
      <div class="financial-report-metric"><span>${t("netCashFlow")}</span><strong>${money(report.netCashFlow)}</strong></div>
    </div>
    <div class="financial-report-table-wrap">
      <table class="financial-report-table">
        <thead><tr><th>${t("type")}</th><th>${t("description")}</th><th>${t("category")}</th><th>${t("date")} / ${t("frequency")}</th><th>${t("amount")}</th></tr></thead>
        <tbody>${report.rows.length ? report.rows.map(row => `<tr><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.description)}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.period)}</td><td class="${row.amount < 0 ? "financial-report-outflow" : ""}">${money(row.amount)}</td></tr>`).join("") : `<tr><td class="financial-report-empty" colspan="5">${t("noMonthlyTransactions")}</td></tr>`}</tbody>
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

    const monthlyFactor = recurring
      ? ({ Weekly: 52 / 12, Quarterly: 1 / 3, Yearly: 1 / 12 }[frequency] || 1)
      : 1;
    const amount = toProfileCurrency(Number(item.amount || 0) * monthlyFactor, item.currency);
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
  const paymentRows = (appData.loans || []).flatMap(loan => (loan.payments || [])
    .filter(payment => String(payment.date || "").slice(0, 7) === month)
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
    rows: [...incomeRows, ...outflowRows]
  };
}

function monthlyFinanceReportHtml(report) {
  const headers = [t("type"), t("description"), t("category"), `${t("date")} / ${t("frequency")}`, t("amount")];
  const summary = [
    [t("monthlyIncome"), formatPlainMoney(report.incomeTotal)],
    [t("monthlyExpenses"), formatPlainMoney(report.expenseTotal)],
    [t("monthlyPayment"), formatPlainMoney(report.loanPaymentTotal)],
    [t("netCashFlow"), formatPlainMoney(report.netCashFlow)]
  ];
  const details = [
    [t("reportOwner"), report.ownerName],
    [t("reportMonth"), report.monthLabel],
    [t("reportCurrency"), report.currency],
    [t("generatedOn"), report.generatedOn]
  ];
  const rows = report.rows.map(row => [row.type, row.description, row.category, row.period, formatPlainMoney(row.amount)]);
  const fontStack = '"Noto Sans Khmer","Khmer OS System","Leelawadee UI",Calibri,Arial,sans-serif';
  const table = (data, widths) => `<table style="width:100%;table-layout:fixed;border-collapse:collapse;margin:12px 0 24px;font-family:${fontStack};font-size:11pt"><colgroup>${widths.map(width => `<col style="width:${width}%">`).join("")}</colgroup><thead><tr>${data[0].map((cell, index) => `<th style="border:1px solid #aebc9f;padding:9px 10px;background:#c5ff60;color:#182313;font-family:${fontStack};font-size:10pt;font-weight:bold;text-align:${index === data[0].length - 1 ? "right" : "left"};vertical-align:top">${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${data.slice(1).map((row, rowIndex) => `<tr>${row.map((cell, index) => `<td style="border:1px solid #d5ddcc;padding:8px 10px;background:${rowIndex % 2 ? "#f4f7ef" : "#ffffff"};color:#20251b;font-family:${fontStack};font-size:11pt;text-align:${index === row.length - 1 ? "right" : "left"};vertical-align:top;word-wrap:break-word">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const transactionRows = rows.length ? rows : [[t("noMonthlyTransactions"), "", "", "", ""]];
  const detailTable = `<table style="width:100%;border-collapse:collapse;margin:12px 0 24px;font-family:${fontStack};font-size:11pt"><tbody>${details.map(([label, value]) => `<tr><th style="width:30%;border:1px solid #d5ddcc;padding:8px 10px;background:#f4f7ef;color:#35491b;font-family:${fontStack};text-align:left">${escapeHtml(label)}</th><td style="border:1px solid #d5ddcc;padding:8px 10px;background:#ffffff;color:#20251b;font-family:${fontStack}">${escapeHtml(value)}</td></tr>`).join("")}</tbody></table>`;
  const inlineFont = `font-family:${fontStack};`;
  return `<html><head><meta charset="utf-8"><style>body{${inlineFont}margin:28px 36px;color:#20251b}h1{font-size:22pt;color:#202c18;margin:0 0 6px}h2{font-size:14pt;color:#35491b;margin:24px 0 8px}p{font-size:11pt;color:#59634f;margin:0 0 18px}</style></head><body style="${inlineFont}margin:28px 36px;color:#20251b"><h1 style="${inlineFont}font-size:22pt;color:#202c18;margin:0 0 6px">${escapeHtml(t("monthlyReport"))}</h1>${detailTable}<h2 style="${inlineFont}font-size:14pt;color:#35491b;margin:24px 0 8px">${escapeHtml(t("financialAnalytics"))}</h2>${table([[t("summary"), t("amount")], ...summary], [58, 42])}<h2 style="${inlineFont}font-size:14pt;color:#35491b;margin:24px 0 8px">${escapeHtml(t("recentTransactions"))}</h2>${table([headers, ...transactionRows], [14, 25, 17, 25, 19])}</body></html>`;
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
  const fontStack = '"Noto Sans Khmer","Khmer OS System","Leelawadee UI",Calibri,Arial,sans-serif';
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
    [t("netCashFlow"), formatPlainMoney(report.netCashFlow)]
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
  financeReportCanvas = await createMonthlyFinanceReportCanvas(buildMonthlyFinanceReport(month));
  financeReportCanvasMonth = month;
  return financeReportCanvas;
}

async function previewMonthlyFinanceReport() {
  const month = document.querySelector("[data-finance-report-month]")?.value || financeReportMonth || new Date().toISOString().slice(0, 7);
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
  const month = document.querySelector("[data-finance-report-month]")?.value || financeReportMonth || new Date().toISOString().slice(0, 7);
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
  const month = document.querySelector("[data-finance-report-month]")?.value || financeReportMonth || new Date().toISOString().slice(0, 7);
  const report = buildMonthlyFinanceReport(month);
  const isWord = format === "word";
  const extension = isWord ? "doc" : "xls";
  const mimeType = isWord ? "application/msword" : "application/vnd.ms-excel";
  downloadFile(`mylife-financial-report-${month}.${extension}`, mimeType, monthlyFinanceReportHtml(report));
  Toast.show(t("financialReportExported"));
}

function bindMoney() {
  bindNavigationSheetGestures();
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
  document.querySelectorAll('[data-action="add-loan"]').forEach(button => button.addEventListener("click", () => openLoanModal()));
  document.querySelectorAll('[data-action="add-bill"]').forEach(button => button.addEventListener("click", () => openBillModal()));
  bindCollectionActions("income", openIncomeModal);
  bindCollectionActions("expense", openExpenseModal);
  bindCollectionActions("savings", openSavingsModal, "savings");
  bindCollectionActions("loan", openLoanModal);
  bindCollectionActions("bill", openBillModal);
  document.querySelectorAll("[data-payment-loan]").forEach(button => button.addEventListener("click", () => openLoanPaymentModal(appData.loans.find(loan => loan.id === button.dataset.paymentLoan))));
  document.querySelectorAll("[data-loan-schedule]").forEach(input => input.addEventListener("change", () => toggleLoanScheduledPayment(input)));
  document.querySelectorAll("[data-savings-contribution]").forEach(input => input.addEventListener("change", () => toggleSavingsContribution(input)));
}

function toggleSavingsContribution(input) {
  const saving = appData.savings.find(item => item.id === input.dataset.savingsContribution);
  if (!saving) return;

  const monthKey = input.dataset.savingsMonth || getSavingsContributionMonth();
  const contributionAmount = Number(saving.monthlyContribution || 0);
  const contributions = Array.isArray(saving.contributions) ? saving.contributions.slice() : [];
  const existingIndex = contributions.findIndex(entry => entry && entry.month === monthKey);
  const wasPaid = existingIndex >= 0 ? Boolean(contributions[existingIndex].paid) : false;

  if (input.checked && !wasPaid) {
    if (existingIndex >= 0) {
      contributions[existingIndex] = { ...contributions[existingIndex], month: monthKey, amount: contributionAmount, paid: true };
    } else {
      contributions.unshift({ month: monthKey, amount: contributionAmount, paid: true });
    }
    saving.currentAmount = Number(saving.currentAmount || 0) + contributionAmount;
  } else if (!input.checked && wasPaid) {
    if (existingIndex >= 0) {
      const previousAmount = Number(contributions[existingIndex].amount || contributionAmount);
      contributions.splice(existingIndex, 1);
      saving.currentAmount = Math.max(0, Number(saving.currentAmount || 0) - previousAmount);
    }
  }

  saving.contributions = contributions;
  Store.save();
  Toast.show(input.checked ? t("savingsAdded") : t("savingsRemoved"));
  App.render();
}

function toggleLoanScheduledPayment(input) {
  const loan = appData.loans.find(item => item.id === input.dataset.loanSchedule);
  if (!loan) return;
  const paymentDate = input.dataset.paymentDate;
  loan.payments = loan.payments || [];
  const existingIndex = loan.payments.findIndex(payment => payment.date === paymentDate);
  if (input.checked) {
    if (existingIndex === -1) {
      loan.payments.unshift({ amount: Number(loan.monthlyPayment || 0), date: paymentDate, scheduled: true });
    }
  } else if (existingIndex > -1) {
    loan.payments.splice(existingIndex, 1);
  }
  Store.save();
  Toast.show(input.checked ? t("paymentMarkedPaid") : t("paymentMarkedUnpaid"));
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
    { name: "frequency", label: t("frequency"), type: "select", options: ["Once", "Weekly", "Monthly", "Yearly"], value: item?.frequency || "Monthly" },
    { name: "nextPaymentDate", label: t("nextPaymentDate"), type: "date", value: item?.nextPaymentDate },
    { name: "recurring", label: t("recurring"), type: "checkbox", value: item?.recurring ?? true },
    { name: "notes", label: t("notes"), type: "textarea", value: item?.notes }
  ], onSubmit(data) { const record = { ...data, amount: Number(data.amount || 0), currency: data.currency || appData.profile.currency || "USD" }; item ? Store.edit("income", item.id, record) : Store.add("income", record); Toast.show(item ? t("incomeSaved") : t("incomeAdded")); } });
}

function openExpenseModal(item) {
  Modal.open({ title: item ? `${t("edit")} ${t("expense")}` : t("addExpense"), submitText: item ? `${t("save")} ${t("expense")}` : t("addExpense"), fields: [
    { name: "description", label: t("description"), value: item?.description, required: true },
    { name: "amount", label: t("amount"), type: "number", value: item?.amount, required: true },
    { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: item?.currency || appData.profile.currency || "USD" },
    { name: "category", label: t("category"), type: "select", options: expenseCategories, value: item?.category || "Food" },
    { name: "date", label: t("date"), type: "date", value: item?.date || new Date().toISOString().slice(0, 10) },
    { name: "method", label: t("paymentMethod"), value: item?.method },
    { name: "notes", label: t("notes"), type: "textarea", value: item?.notes }
  ], onSubmit(data) { const record = { ...data, amount: Number(data.amount || 0), currency: data.currency || appData.profile.currency || "USD" }; item ? Store.edit("expenses", item.id, record) : Store.add("expenses", record); Toast.show(item ? t("expenseSaved") : t("expenseAdded")); } });
}

function openSavingsModal(item) {
  Modal.open({ title: item ? t("editSavings") : t("addSavings"), submitText: item ? t("saveSavings") : t("addSavings"), fields: [
    { name: "name", label: t("savingsName"), value: item?.name, required: true },
    { name: "targetAmount", label: t("targetAmount"), type: "number", value: item?.targetAmount, required: true },
    { name: "currentAmount", label: t("currentAmount"), type: "number", value: item?.currentAmount || 0, required: true },
    { name: "monthlyContribution", label: t("monthlyContribution"), type: "number", value: item?.monthlyContribution || 0 },
    { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: item?.currency || appData.profile.currency || "USD" },
    { name: "deadline", label: t("deadline"), type: "date", value: item?.deadline },
    { name: "notes", label: t("notes"), type: "textarea", value: item?.notes }
  ], onSubmit(data) { const record = { ...data, targetAmount: Number(data.targetAmount || 0), currentAmount: Number(data.currentAmount || 0), monthlyContribution: Number(data.monthlyContribution || 0), currency: data.currency || appData.profile.currency || "USD" }; item ? Store.edit("savings", item.id, record) : Store.add("savings", record); Toast.show(item ? t("savingsSaved") : t("savingsAdded")); } });
}

function openLoanModal(item) {
  Modal.open({ title: item ? t("editLoan") : t("addLoan"), submitText: item ? t("saveLoan") : t("addLoan"), fields: [
    { name: "name", label: t("loanName"), value: item?.name, required: true },
    { name: "originalAmount", label: t("originalAmount"), type: "number", value: item?.originalAmount, required: true },
    { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: item?.currency || appData.profile.currency || "USD" },
    { name: "interestRate", label: t("interestRate"), type: "number", value: item?.interestRate || "" },
    { name: "durationMonths", label: t("loanDurationMonths"), type: "number", value: item?.durationMonths || "" },
    { name: "monthlyPayment", label: t("monthlyPayment"), type: "number", value: item?.monthlyPayment || 0 },
    { name: "firstPaymentDate", label: t("firstPaymentDate"), type: "date", value: normalizeLoanPaymentDate(item?.firstPaymentDate || item?.startDate) },
    { name: "paymentDay", label: t("paymentDay"), type: "number", value: item ? (item.paymentDay || loanPaymentDay(item)) : "" },
    { name: "dueDate", label: t("dueDate"), type: "date", value: item?.dueDate },
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
    <span>${t("smartFillNeedDates")}</span>
    <button class="button ghost-button" type="button" disabled>${Icons.plus()} ${t("applySuggestion")}</button>
  `;
  paymentField.appendChild(helper);

  const message = helper.querySelector("span");
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function openBillModal(item) {
  Modal.open({ title: item ? t("editBill") : t("addBill"), submitText: item ? t("saveBill") : t("addBill"), fields: [
    { name: "name", label: t("billName"), value: item?.name, required: true },
    { name: "amount", label: t("amount"), type: "number", value: item?.amount, required: true },
    { name: "currency", label: t("currency"), type: "select", options: ["USD", "KHR"], value: item?.currency || appData.profile.currency || "USD" },
    { name: "frequency", label: t("frequency"), type: "select", options: ["Weekly", "Monthly", "Quarterly", "Yearly"], value: item?.frequency || "Monthly" },
    { name: "due", label: t("dueDateDay"), type: "date", value: item?.due },
    { name: "category", label: t("category"), value: item?.category },
    { name: "reminder", label: t("reminder"), type: "checkbox", value: item?.reminder ?? true },
    { name: "status", label: t("status"), type: "select", options: ["Upcoming", "Paid", "Overdue"], value: item?.status || "Upcoming" },
    { name: "notes", label: t("notes"), type: "textarea", value: item?.notes }
  ], onSubmit(data) { const record = { ...data, amount: Number(data.amount || 0), currency: data.currency || appData.profile.currency || "USD" }; item ? Store.edit("bills", item.id, record) : Store.add("bills", record); Toast.show(item ? t("billSaved") : t("billAdded")); } });
}

function openLoanPaymentModal(loan) {
  Modal.open({ title: t("makePayment"), submitText: t("savePayment"), fields: [
    { name: "amount", label: t("amount"), type: "number", value: loan.monthlyPayment || "", required: true },
    { name: "date", label: t("date"), type: "date", value: new Date().toISOString().slice(0, 10), required: true }
  ], onSubmit(data) { loan.payments = [{ amount: Number(data.amount || 0), date: data.date }, ...(loan.payments || [])]; Store.save(); Toast.show(t("paymentSaved")); App.render(); } });
}
