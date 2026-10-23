/* MYLIFE Finance V2 — new overview tab of the money page (both themes).
 * Reuses the existing hooks so nothing else changes: data-money-period /
 * data-money-shift / data-money-pick (renderMoneyPeriodBar + bindMoney),
 * data-ma-home (MoneyAsk.askNow), data-action="add-expense", SmartMoney quick
 * expense and renderRecentExpenses(). Old overview stays in money.js as fallback. */
const MoneyV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);

  function daysBetween(fromIso, toIso) {
    return Math.round((new Date(`${toIso}T00:00:00`) - new Date(`${fromIso}T00:00:00`)) / 86400000);
  }

  function inDaysText(days) {
    if (days < 0) return L(`ហួស ${-days} ថ្ងៃ`, `${-days}d overdue`);
    if (days === 0) return L("ថ្ងៃនេះ", "today");
    if (days === 1) return L("ស្អែក", "tomorrow");
    return L(`ក្នុង ${days} ថ្ងៃ`, `in ${days} days`);
  }

  // big card: money left to spend
  function hero(stats, range) {
    const m = moneyMonthNumbers(range.month);
    const today = localDateInput();
    let left = m.left;
    let income = m.income;
    let spent = m.expenses + m.loans;
    let label = L("នៅសល់សម្រាប់ចាយ", "Left to spend");
    let perDay = "";
    if (range.kind === "year") {
      const thisMonth = today.slice(0, 7);
      const months = Array.from({ length: 12 }, (_, i) => `${range.anchor.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`)
        .filter(key => key <= thisMonth).map(key => moneyMonthNumbers(key));
      income = months.reduce((t, x) => t + x.income, 0);
      spent = months.reduce((t, x) => t + x.expenses + x.loans, 0);
      left = months.reduce((t, x) => t + x.income - x.expenses - x.loans, 0);
      label = `${L("នៅសល់", "Left")} · ${range.label}`;
    } else if (range.kind === "all") {
      const loansAll = moneyLoanPaymentsIn({ start: "0000-01-01", end: "9999-12-31" }).reduce((t, p) => t + p.amount, 0);
      income = stats.totalIncome;
      spent = stats.totalExpenses + loansAll;
      left = income - spent;
      label = `${L("នៅសល់", "Left")} · ${range.label}`;
    } else {
      const monthRange = moneyPeriodRange({ kind: "month", anchor: range.anchor });
      if (monthRange.isCurrent) {
        const daysLeft = Math.max(1, daysBetween(today, monthRange.end) + 1);
        label += ` · ${L(`${daysLeft} ថ្ងៃទៀតដល់ចុងខែ`, `${daysLeft} days to month end`)}`;
        if (left > 0) perDay = `≈ ${money(left / daysLeft)} / ${L("ថ្ងៃ", "day")}`;
      } else {
        label += ` · ${monthRange.label}`;
      }
    }
    const pct = income ? Math.min(100, Math.round((spent / income) * 100)) : 0;
    const short = left < 0;
    return `<a class="fv2-hero ${short ? "is-short" : ""}" href="#money/budget">
      <small>${escapeHtml(label)}</small>
      <strong class="fv2-hero-value">${short ? "−" : ""}${money(Math.abs(left))}</strong>
      ${short ? `<span class="fv2-hero-warn">⚠ ${escapeHtml(L("ចាយលើសចំណូល", "Spent more than income"))}</span>` : ""}
      <span class="fv2-hero-bar"><i style="width:${Math.max(3, pct)}%"></i></span>
      <span class="fv2-hero-foot"><span>${escapeHtml(L("ចាយ", "Spent"))} <b>${money(spent)}</b> / ${money(income)}</span>${perDay ? `<b>${perDay}</b>` : ""}</span>
    </a>`;
  }

  function mini({ tone, href, icon, label, value, sub }) {
    return `<a class="fv2-mini fv2-${tone}" href="${href}">
      <span class="fv2-mini-icon" aria-hidden="true">${icon}</span>
      <small>${escapeHtml(label)}</small>
      <strong>${value}</strong>
      <span class="fv2-mini-sub">${sub}</span>
    </a>`;
  }

  function miniGrid(stats, range, waiting) {
    const m = moneyMonthNumbers(range.month);
    const spentItems = moneyExpensesIn(range);
    const loanPays = moneyLoanPaymentsIn(range);
    const spent = spentItems.reduce((t, e) => t + toProfileCurrency(e.amount, e.currency), 0) + loanPays.reduce((t, p) => t + p.amount, 0);
    const income = range.kind === "month" || range.kind === "day" || range.kind === "week" ? m.income : null;
    const incomeWaiting = waiting.some(item => item.kind === "income");
    const incomeSub = income === null
      ? escapeHtml(L(`${(appData.income || []).length} ចំណូល`, `${(appData.income || []).length} income`))
      : incomeWaiting ? `⏳ ${escapeHtml(L("រង់ចាំទទួល", "Waiting"))}` : income > 0 ? `✓ ${escapeHtml(L("ទទួលហើយ", "Received"))}` : escapeHtml(L("មិនទាន់មាន", "None yet"));
    const spentSub = range.kind === "month" && m.income
      ? escapeHtml(L(`${Math.round((spent / m.income) * 100)}% នៃចំណូល`, `${Math.round((spent / m.income) * 100)}% of income`))
      : escapeHtml(L(`${spentItems.length} ដង · ${range.label}`, `${spentItems.length} items · ${range.label}`));
    const savedThisMonth = m.saved;
    const loans = (appData.loans || []).filter(loan => loanRemaining(loan) > 0);
    const loanLeft = loans.reduce((t, loan) => t + toProfileCurrency(loanRemaining(loan), loan.currency), 0);
    const monthsLeft = loans.reduce((max, loan) => Math.max(max, loan.monthlyPayment ? Math.ceil(loanRemaining(loan) / Number(loan.monthlyPayment)) : 0), 0);
    return `<div class="fv2-grid">
      ${mini({ tone: "in", href: "#money/income", icon: Icons.arrowDown(), label: L("ចំណូល", "Income"), value: money(income === null ? stats.totalIncome : income), sub: incomeSub })}
      ${mini({ tone: "out", href: "#money/expenses", icon: Icons.arrowUp(), label: L("ចំណាយ", "Spent"), value: money(spent), sub: spentSub })}
      ${mini({ tone: "save", href: "#money/savings", icon: Icons.savings(), label: L("សន្សំ", "Savings"), value: money(stats.totalSavings), sub: savedThisMonth > 0 ? `+${money(savedThisMonth)} ${escapeHtml(L("ខែនេះ", "this month"))}` : m.plannedSavings > 0 ? `${money(m.plannedSavings)} / ${escapeHtml(L("ខែ", "mo"))}` : escapeHtml(L("មិនទាន់មានគោលដៅ", "No goal yet")) })}
      ${mini({ tone: "loan", href: "#money/loans", icon: Icons.loan(), label: L("កម្ចី", "Loans"), value: money(loanLeft), sub: loans.length ? escapeHtml(L(`នៅសល់ ${monthsLeft} ខែ`, `${monthsLeft} months left`)) : `✓ ${escapeHtml(L("គ្មានកម្ចី", "No loans"))}` })}
    </div>`;
  }

  function section(title, href, body, count = "") {
    return `<section class="fv2-section">
      <div class="fv2-section-head"><h2>${escapeHtml(title)}${count}</h2>${href ? `<a href="${href}">${escapeHtml(L("ទាំងអស់", "All"))} ›</a>` : ""}</div>
      <div class="fv2-card">${body}</div>
    </section>`;
  }

  function waitingList(waiting) {
    if (!waiting.length) return "";
    const plain = item => (item.amount > 0 ? money(item.amount, item.currency || undefined) : "");
    const when = item => (item.overdueDays <= 0 ? L("ថ្ងៃនេះ", "today") : item.overdueDays === 1 ? L("ម្សិលមិញ", "yesterday") : L(`${item.overdueDays} ថ្ងៃមុន`, `${item.overdueDays} days ago`));
    const rows = waiting.slice(0, 4).map(item => `<div class="fv2-item">
      <span class="fv2-ico fv2-ico-${item.kind}" aria-hidden="true">${item.kind === "income" ? Icons.salary() : item.kind === "loan" ? Icons.loan() : Icons.bill()}</span>
      <span class="fv2-item-text"><b>${escapeHtml(item.title)}</b><small>${plain(item)}${plain(item) ? " · " : ""}${escapeHtml(when(item))}</small></span>
      <button type="button" class="fv2-answer" data-ma-home>${escapeHtml(item.kind === "income" ? L("ទទួលហើយ", "Got it") : L("បង់ហើយ", "Paid"))}</button>
    </div>`).join("");
    const more = waiting.length > 4 ? `<button type="button" class="fv2-more" data-ma-home>+${waiting.length - 4} ${escapeHtml(L("ទៀត", "more"))}</button>` : "";
    return section(L("រង់ចាំឆ្លើយ", "Waiting for you"), "", rows + more, ` <span class="fv2-badge">${waiting.length}</span>`);
  }

  function categories(range) {
    const items = moneyExpensesIn(range);
    const loanPays = moneyLoanPaymentsIn(range);
    const list = expenseCategories.map(category => {
      const own = items.filter(e => e.category === category);
      const amount = sumMoney(own, "amount") + (category === "Loan" ? loanPays.reduce((t, p) => t + p.amount, 0) : 0);
      return { category, amount, color: expenseCategoryColors[category] };
    }).filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount);
    const total = list.reduce((t, x) => t + x.amount, 0);
    const body = list.length
      ? list.slice(0, 5).map(x => {
        const share = Math.round((x.amount / total) * 100);
        return `<a class="fv2-cat" href="#money/expenses" style="--c:${x.color};--w:${Math.max(share, 2)}%">
          <span class="fv2-ico fv2-ico-cat" aria-hidden="true">${Icons[expenseCategoryIcons[x.category]] ? Icons[expenseCategoryIcons[x.category]]() : Icons.chart()}</span>
          <span class="fv2-cat-main"><b>${escapeHtml(optionLabel(x.category))}</b><span class="fv2-cat-track"><i></i></span></span>
          <span class="fv2-cat-num"><b>${money(x.amount)}</b><small>${share}%</small></span>
        </a>`;
      }).join("")
      : `<div class="fv2-empty"><span>${escapeHtml(L(`មិនទាន់មានចំណាយ · ${range.label}`, `No spending · ${range.label}`))}</span><button type="button" class="fv2-answer" data-action="add-expense">+ ${escapeHtml(L("ចំណាយ", "Expense"))}</button></div>`;
    return section(L("ចាយលើអ្វីខ្លះ", "Where it went"), "#money/expenses", body);
  }

  function upcoming() {
    const today = localDateInput();
    const bills = (appData.bills || [])
      .filter(bill => bill.status !== "Paid" && !billPaidCurrentCycle(bill) && bill.due)
      .map(bill => ({
        title: bill.name || t("bill"), date: bill.due, amount: money(bill.amount, bill.currency || undefined), href: "#money/bills", icon: Icons.bill(), kind: "bill",
        tag: bill.autoPay ? L("ស្វ័យប្រវត្តិ", "Auto-pay") : optionLabel(bill.frequency || "Monthly"), tagTone: bill.autoPay ? "ok" : "warn"
      }));
    const loans = (appData.loans || []).filter(loan => loanRemaining(loan) > 0).map(loan => {
      const due = nextLoanPaymentDate(loan);
      if (!due) return null;
      const total = Number(loan.durationMonths || 0);
      const paidCount = total && loan.monthlyPayment ? Math.round(loanPaid(loan) / Number(loan.monthlyPayment)) : 0;
      return {
        title: loan.name || t("loan"), date: due, amount: money(loan.monthlyPayment, loan.currency || undefined), href: "#money/loans", icon: Icons.loan(), kind: "loan",
        tag: total ? `${paidCount}/${total}` : "", tagTone: "loan"
      };
    }).filter(Boolean);
    const list = [...bills, ...loans].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 4);
    if (!list.length) return "";
    const body = list.map(item => {
      const days = daysBetween(today, item.date);
      return `<a class="fv2-item ${days < 0 ? "is-late" : ""}" href="${item.href}">
        <span class="fv2-ico fv2-ico-${item.kind}" aria-hidden="true">${item.icon}</span>
        <span class="fv2-item-text"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(formatDate(item.date))} · ${escapeHtml(inDaysText(days))}</small></span>
        <span class="fv2-item-num"><b>${item.amount}</b>${item.tag ? `<small class="fv2-tag-${days < 0 ? "late" : item.tagTone}">${escapeHtml(item.tag)}</small>` : ""}</span>
      </a>`;
    }).join("");
    return section(L("វិក្កយបត្រខាងមុខ", "Coming up"), "#money/bills", body);
  }

  function goals() {
    const list = (appData.savings || []).filter(item => Number(item.targetAmount) > 0).slice(0, 3);
    if (!list.length) return "";
    const body = list.map(item => {
      const pct = Math.min(100, Math.round((Number(item.currentAmount || 0) / Number(item.targetAmount)) * 100));
      const paid = getSavingsContribution(item)?.paid;
      const sub = item.monthlyContribution
        ? `${money(item.monthlyContribution, item.currency || undefined)} / ${escapeHtml(L("ខែ", "mo"))} · ${paid ? `✓ ${escapeHtml(L("ខែនេះ", "this month"))}` : escapeHtml(L("មិនទាន់ដាក់", "not yet"))}`
        : escapeHtml(L("គ្មានចំនួនប្រចាំខែ", "No monthly amount"));
      return `<a class="fv2-item" href="#money/savings">
        <span class="fv2-ring" style="--p:${pct}" aria-label="${pct}%"><span>${pct}%</span></span>
        <span class="fv2-item-text"><b>${escapeHtml(item.name || t("savings"))}</b><small>${sub}</small></span>
        <span class="fv2-item-num"><b>${money(item.currentAmount, item.currency || undefined)}</b><small>/ ${money(item.targetAmount, item.currency || undefined)}</small></span>
      </a>`;
    }).join("");
    return section(L("គោលដៅសន្សំ", "Savings goals"), "#money/savings", body);
  }

  function overview(stats) {
    const range = moneyPeriodRange();
    const waiting = typeof MoneyAsk !== "undefined" ? MoneyAsk.items() : [];
    return `<div class="fv2">
      ${renderMoneyPeriodBar(range)}
      ${hero(stats, range)}
      ${miniGrid(stats, range, waiting)}
      ${waitingList(waiting)}
      ${categories(range)}
      ${upcoming()}
      ${goals()}
      ${typeof SmartMoney !== "undefined" ? SmartMoney.renderQuickExpense() : ""}
      ${section(t("recentTransactions"), "#money/expenses", renderRecentExpenses())}
    </div>`;
  }

  return { overview };
})();
