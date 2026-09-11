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
const expenseCategories = ["Food", "Home", "Family", "Transport", "Shopping", "Bills", "Education", "Health", "Entertainment", "Other"];

function renderMoney(tab = "overview") {
  const stats = Store.calculate();
  return `
    <section class="page">
      <div class="page-header financial-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.money()}</span>${t("money")}</h1>
          <p class="page-subtitle">${t("moneySubtitle")}</p>
        </div>
        <button class="button" data-action="add-expense">${Icons.plus()} ${t("addExpense")}</button>
      </div>
      <div class="financial-layout">
        <aside class="financial-sidebar" aria-label="${t("money")} sections">
          ${moneyTabs.map(([id, label, icon]) => `<a class="financial-nav-item ${tab === id ? "active" : ""}" href="#money/${id}">${Icons[icon]()}<span>${t(label)}</span></a>`).join("")}
        </aside>
        <div class="financial-content">
          ${renderMoneyTab(tab, stats)}
        </div>
      </div>
    </section>
  `;
}

function renderMoneyCards(stats) {
  return `<div class="summary-grid grid">
    ${summaryCard("Income", t("totalIncome"), money(stats.totalIncome), `${appData.income.length} ${t("income")}`, Icons.salary(), "green")}
    ${summaryCard("Expenses", t("totalExpenses"), money(stats.totalExpenses), `${appData.expenses.length} ${t("expenses")}`, Icons.expense(), "")}
    ${summaryCard("Savings", t("totalSavings"), money(stats.totalSavings), `${money(stats.monthlySavings)} ${t("monthlyContribution")}`, Icons.savings(), "blue")}
    ${summaryCard("Available", t("available"), money(stats.available), t("availableMoney"), Icons.wallet(), "purple")}
  </div>`;
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
    <div class="grid two-col financial-overview-grid">
      <article class="glass-card card-pad">
        <h2 class="section-title">${t("incomeVsExpenses")}</h2>
        ${stats.totalIncome || stats.totalExpenses || stats.monthlySavings || stats.monthlyLoanPayments ? Charts.bars([
          { label: t("income"), value: stats.totalIncome, color: "linear-gradient(90deg,#9dff6e,#64f4d2)" },
          { label: t("expenses"), value: stats.totalExpenses, color: "linear-gradient(90deg,#ff6f9c,#9b6dff)" },
          { label: t("monthlyContribution"), value: stats.monthlySavings, color: "linear-gradient(90deg,#64f4d2,#b8ff5a)" },
          { label: t("monthlyPayment"), value: stats.monthlyLoanPayments, color: "linear-gradient(90deg,#9b6dff,#b8ff5a)" }
        ]) : emptyState(t("noMoneyYet"), t("noMoneyBody"), t("addIncome"), "add-income")}
      </article>
      <article class="glass-card card-pad">
        <h2 class="section-title">${t("recentTransactions")}</h2>
        <div class="list">${appData.expenses.slice(0, 5).map(expenseRow).join("") || emptyState(t("noExpensesYet"), t("noExpensesBody"), t("addExpense"), "add-expense")}</div>
      </article>
    </div>
  `;
}

function renderIncome() {
  return `<div class="grid two-col">
    <article class="glass-card card-pad"><div class="between"><h2 class="section-title">${t("incomeSources")}</h2><button class="button" data-action="add-income">${Icons.plus()} ${t("addIncome")}</button></div><div class="list">${appData.income.map(incomeRow).join("") || emptyState(t("noIncomeYet"), t("noIncomeBody"), t("addIncome"), "add-income")}</div></article>
    <article class="glass-card card-pad"><h2 class="section-title">${t("incomeCategories")}</h2><div class="kv">${incomeCategories.map(cat => `<div><span>${optionLabel(cat)}</span><strong>${money(sumMoney(appData.income.filter(i => i.category === cat), "amount"))}</strong></div>`).join("")}</div></article>
  </div>`;
}

function incomeRow(item) {
  return `<div class="list-row"><span class="icon-badge green">${Icons.salary()}</span><strong>${escapeHtml(item.name)}</strong><span>${money(item.amount, item.currency)}</span><span class="pill">${optionLabel(item.frequency)}</span><button class="icon-button" data-edit-income="${item.id}" aria-label="${t("editIncome")}">${Icons.edit()}</button><button class="icon-button" data-delete-income="${item.id}" aria-label="${t("delete")}">${Icons.trash()}</button></div>`;
}

function renderExpenses() {
  return `<article class="glass-card card-pad"><div class="between"><h2 class="section-title">${t("expenses")}</h2><button class="button" data-action="add-expense">${Icons.plus()} ${t("addExpense")}</button></div><div class="list">${appData.expenses.map(expenseRow).join("") || emptyState(t("noExpensesYet"), t("noExpensesBody"), t("addExpense"), "add-expense")}</div></article>`;
}

function expenseRow(item) {
  return `<div class="list-row"><span class="icon-badge">${Icons.expense()}</span><strong>${escapeHtml(item.description)}</strong><span class="secondary">${optionLabel(item.category)}</span><span class="danger">-${money(item.amount, item.currency)}</span><button class="icon-button" data-edit-expense="${item.id}" aria-label="${t("edit")}">${Icons.edit()}</button><button class="icon-button" data-delete-expense="${item.id}" aria-label="${t("delete")}">${Icons.trash()}</button></div>`;
}

function renderSavings() {
  return `<article class="glass-card card-pad"><div class="between"><h2 class="section-title">${t("savings")}</h2><button class="button" data-action="add-savings">${Icons.plus()} ${t("addSavings")}</button></div>${appData.savings.length ? `<div class="grid three-col">${appData.savings.map(savingCard).join("")}</div>` : emptyState(t("noSavingsYet"), t("noSavingsBody"), t("addSavings"), "add-savings")}</article>`;
}

function savingCard(item) {
  return `<div class="goal-item"><div class="between"><strong>${escapeHtml(item.name)}</strong><span class="pill">${pct(item.currentAmount, item.targetAmount)}%</span></div><div class="secondary">${money(item.currentAmount, item.currency)} / ${money(item.targetAmount, item.currency)}</div><div class="progress-track"><div class="progress-fill" style="--progress:${pct(item.currentAmount, item.targetAmount)}%"></div></div><div class="secondary">${t("deadline")} ${formatDate(item.deadline)}</div><div class="action-row"><button class="button ghost-button" data-edit-savings="${item.id}">${Icons.edit()} ${t("edit")}</button><button class="icon-button" data-delete-savings="${item.id}" aria-label="${t("delete")}">${Icons.trash()}</button></div></div>`;
}

function renderLoans() {
  return `<article class="glass-card card-pad"><div class="between"><h2 class="section-title">${t("loans")}</h2><button class="button" data-action="add-loan">${Icons.plus()} ${t("addLoan")}</button></div>${appData.loans.length ? `<div class="grid loan-list">${appData.loans.map(loanCard).join("")}</div>` : emptyState(t("noLoansYet"), t("noLoansBody"))}</article>`;
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
  return `<article class="glass-card card-pad"><div class="between"><h2 class="section-title">${t("bills")}</h2><button class="button" data-action="add-bill">${Icons.plus()} ${t("addBill")}</button></div>${appData.bills.length ? `<div class="grid four-col">${appData.bills.map(billCard).join("")}</div>` : emptyState(t("noBillsYet"), t("noBillsBody"), t("addBill"), "add-bill")}</article>`;
}

function billCard(bill) {
  return `<div class="goal-item"><div class="between"><span class="icon-badge blue">${Icons.bill()}</span><span class="pill ${bill.status === "Paid" ? "success" : ""}">${optionLabel(bill.status || "Upcoming")}</span></div><h3>${escapeHtml(bill.name)}</h3><div class="metric">${money(bill.amount, bill.currency)}</div><p class="secondary">${t("dueDate")} ${formatDate(bill.due)}</p><p class="secondary">${optionLabel(bill.frequency)} · ${optionLabel(bill.category)}</p><div class="action-row"><button class="button ghost-button" data-edit-bill="${bill.id}">${Icons.edit()} ${t("edit")}</button><button class="icon-button" data-delete-bill="${bill.id}" aria-label="${t("delete")}">${Icons.trash()}</button></div></div>`;
}

function renderBudget() {
  const categories = [...new Set(appData.expenses.map(expense => expense.category))];
  return `<article class="glass-card card-pad"><h2 class="section-title">${t("spendingByCategory")}</h2><div class="grid">${categories.map(category => {
    const spent = sumMoney(appData.expenses.filter(e => e.category === category), "amount");
    const max = Math.max(...categories.map(cat => sumMoney(appData.expenses.filter(e => e.category === cat), "amount")), 1);
    return `<div class="goal-item"><div class="between"><strong>${optionLabel(category)}</strong><span>${money(spent)}</span></div><div class="progress-track"><div class="progress-fill" style="--progress:${(spent / max) * 100}%"></div></div></div>`;
  }).join("") || emptyState(t("noBudgetYet"), t("noBudgetBody"), t("addExpense"), "add-expense")}</div></article>`;
}

function renderReports(stats) {
  return `<div class="grid">${renderMoneyCards(stats)}<article class="glass-card card-pad"><h2 class="section-title">${t("financialAnalytics")}</h2><div class="kv"><div><span>${t("monthlyIncome")}</span><strong>${money(stats.totalIncome)}</strong></div><div><span>${t("monthlyExpenses")}</span><strong>${money(stats.totalExpenses)}</strong></div><div><span>${t("totalSavings")}</span><strong>${money(stats.totalSavings)}</strong></div><div><span>${t("savingsRate")}</span><strong>${stats.savingsRate}%</strong></div><div><span>${t("loanBalance")}</span><strong>${money(stats.loanBalance)}</strong></div></div></article></div>`;
}

function bindMoney() {
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

function bindCollectionActions(name, modalFn, collection = `${name}s`) {
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
