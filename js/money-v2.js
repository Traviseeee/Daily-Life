/* MYLIFE Finance V2 — new overview tab of the money page (both themes).
 * Reuses the existing hooks so nothing else changes: data-money-period /
 * data-money-shift / data-money-pick (renderMoneyPeriodBar + bindMoney),
 * data-ma-home (MoneyAsk.askNow), data-action="add-expense", SmartMoney quick
 * expense and renderRecentExpenses(). Old overview stays in money.js as fallback. */
const MoneyV2 = (() => {
  let periodOpen = false;
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);

  // amounts with cents, like the draft ($1,700.00); still hidden by the privacy switch
  const full = (value, currency) => `<span class="money-value" data-private-money>${escapeHtml(formatPlainMoney(Number(value) || 0, currency || appData.profile.currency || "USD"))}</span>`;
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  // "ថ្ងៃ 25" in this month, "ថ្ងៃ 6 វិច្ឆិកា" in another month
  function dayText(isoDate, withMonth) {
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    const month = km() ? KM_M[date.getMonth()] : date.toLocaleDateString("en-US", { month: "short" });
    return withMonth ? L(`ថ្ងៃ ${date.getDate()} ${month}`, `${month} ${date.getDate()}`) : L(`ថ្ងៃ ${date.getDate()}`, `Day ${date.getDate()}`);
  }
  // drawn icons: EmojiIcons swaps these emoji for the app's own flat drawings
  const CAT_EMOJI = { Food: "🍜", Home: "🏠", Family: "👨‍👩‍👧", Transport: "🚗", Shopping: "🛍️", Bills: "🧾", Loan: "🏦", Education: "📚", Health: "💊", Entertainment: "🎬", Other: "📦" };
  function billEmoji(name = "", category = "") {
    const text = `${name} ${category}`.toLowerCase();
    if (/wi-?fi|internet|អ៊ីនធឺណិត/.test(text)) return "📶";
    if (/water|ppwsa|ទឹក/.test(text)) return "💧";
    if (/edc|electric|ភ្លើង/.test(text)) return "⚡";
    if (/phone|mobile|smart|cellcard|metfone|ទូរស័ព្ទ/.test(text)) return "📱";
    if (/rent|house|ផ្ទះ/.test(text)) return "🏠";
    if (/car|ឡាន|moto|ម៉ូតូ/.test(text)) return "🚘";
    if (/netflix|spotify|youtube|tv/.test(text)) return "🎬";
    return "🧾";
  }
  const ARROW_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
  const ARROW_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';

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
    // current month: same ticket card as Home (31 Oct); other periods keep the summary hero below
    if (range.kind === "month" && moneyPeriodRange({ kind: "month", anchor: range.anchor }).isCurrent && typeof WalletCard !== "undefined") {
      const chip = `<button type="button" class="fv2-period-chip wc-tk-period" data-fv2-period aria-expanded="${periodOpen}">${escapeHtml(range.label)} ▾</button>`;
      // light phone (31 Oct): the same white card as Home, period chip on top
      if (typeof HomeV2 !== "undefined" && HomeV2.softArticle && HomeV2.lav && HomeV2.lav()) {
        return `<section class="hv2-money wc-wrap fv2-soft">${HomeV2.softArticle(today, { ...m, left, income, expenses: spent }, `<div class="hv2-soft-top">${chip}</div>`)}</section>`;
      }
      return WalletCard.render({ ...m, left, income, expenses: spent }, today)
        .replace(/<div class="wc-mini">[\s\S]*?<\/div>\s*<\/section>/, "</section>")
        .replace('<section class="hv2-money wc-wrap">', '<section class="hv2-money wc-wrap fv2-ticket">')
        .replace('<button type="button" class="wc-edit wc-tk-edit"', `${chip}<button type="button" class="wc-edit wc-tk-edit"`);
    }
    const pct = income ? Math.min(100, Math.round((spent / income) * 100)) : 0;
    const short = left < 0;
    const third = perDay
      ? `<span class="fv2-t3-item"><small>${escapeHtml(L("ក្នុងមួយថ្ងៃ", "Per day"))}</small><b>${money(left / Math.max(1, daysBetween(today, moneyPeriodRange({ kind: "month", anchor: range.anchor }).end) + 1))}</b></span>`
      : `<span class="fv2-t3-item"><small>${escapeHtml(L("នៃចំណូល", "Of income"))}</small><b>${income ? `${Math.round((spent / income) * 100)}%` : "–"}</b></span>`;
    const cardBg = typeof WalletCard !== "undefined" && WalletCard.bg ? WalletCard.bg() : "";
    return `<section class="fv2-hero ${short ? "is-short" : ""}${cardBg ? " has-card-bg" : ""}"${cardBg ? ` style="--wc-bg:${escapeAttr(cardBg)}"` : ""}>
      <div class="fv2-hero-top"><small>${escapeHtml(label)}</small><button type="button" class="fv2-period-chip" data-fv2-period aria-expanded="${periodOpen}">${escapeHtml(range.label)} ▾</button></div>
      <strong class="fv2-hero-value">${short ? "−" : ""}${full(Math.abs(left))}</strong>
      ${short ? `<span class="fv2-hero-warn">⚠ ${escapeHtml(L("ចាយលើសចំណូល", "Spent more than income"))}</span>` : ""}
      <span class="fv2-hero-bar"><i style="width:${Math.max(3, pct)}%"></i></span>
      <div class="fv2-t3">
        <a class="fv2-t3-item" href="#money/income"><small>${escapeHtml(L("ចំណូល", "Income"))}</small><b>${money(income)}</b></a>
        <a class="fv2-t3-item" href="#money/expenses"><small>${escapeHtml(L("ចំណាយ", "Spent"))}</small><b>${money(spent)}</b></a>
        ${third}
      </div>
    </section>`;
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
    const goalsCount = (appData.savings || []).filter(item => Number(item.targetAmount) > 0).length;
    return `<div class="fv2-two">
      <a class="fv2-two-card" href="#money/savings"><small>🐷 ${escapeHtml(L("សន្សំ", "Savings"))}</small><strong>${money(stats.totalSavings)}</strong><span>${savedThisMonth > 0 ? `+${money(savedThisMonth)} ${escapeHtml(L("ខែនេះ", "this month"))}` : m.plannedSavings > 0 ? `${money(m.plannedSavings)} / ${escapeHtml(L("ខែ", "mo"))}` : escapeHtml(L("មិនទាន់មានគោលដៅ", "No goal yet"))}${goalsCount ? ` · ${goalsCount} ${escapeHtml(L("គោលដៅ", goalsCount === 1 ? "goal" : "goals"))}` : ""}</span></a>
      <a class="fv2-two-card" href="#money/loans"><small>🏦 ${escapeHtml(L("កម្ចី", "Loans"))}</small><strong>${money(loanLeft)}</strong><span>${loans.length ? escapeHtml(L(`នៅ ${monthsLeft} ខែ`, `${monthsLeft} months left`)) : `✓ ${escapeHtml(L("គ្មានកម្ចី", "No loans"))}`}</span></a>
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
      <span class="fv2-ico fv2-icon fv2-ico-${item.kind}" aria-hidden="true">${item.kind === "income" ? "$" : item.kind === "loan" ? "🏦" : billEmoji(item.title)}</span>
      <span class="fv2-item-text"><b>${escapeHtml(item.title)}</b><small>${item.kind === "income" || !plain(item) ? escapeHtml(dayText(item.date)) : plain(item)} · ${escapeHtml(when(item))}</small></span>
      <button type="button" class="fv2-answer" data-ma-home>${escapeHtml(item.kind === "income" ? L("ទទួលហើយ", "Got it") : L("បង់ហើយ", "Paid"))}</button>
    </div>`).join("");
    const more = waiting.length > 4 ? `<button type="button" class="fv2-more" data-ma-home>+${waiting.length - 4} ${escapeHtml(L("ទៀត", "more"))}</button>` : "";
    return section(L("រង់ចាំឆ្លើយ", "Waiting for you"), "", rows + more, ` <span class="fv2-badge">${waiting.length}</span>`);
  }

  // where the money went: one stacked bar + the top 2 categories and "N more" (3 rows max)
  function categories(range) {
    const items = moneyExpensesIn(range);
    const loanPays = moneyLoanPaymentsIn(range);
    const list = expenseCategories.map(category => {
      const own = items.filter(e => e.category === category);
      const amount = sumMoney(own, "amount") + (category === "Loan" ? loanPays.reduce((t, p) => t + p.amount, 0) : 0);
      return { category, amount, color: expenseCategoryColors[category] };
    }).filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount);
    if (!list.length) {
      return section(L("ចាយលើអ្វីខ្លះ", "Where it went"), "#money/expenses", `<div class="fv2-empty"><span>${escapeHtml(L(`មិនទាន់មានចំណាយ · ${range.label}`, `No spending · ${range.label}`))}</span><button type="button" class="fv2-answer" data-action="add-expense">+ ${escapeHtml(L("ចំណាយ", "Expense"))}</button></div>`);
    }
    const total = list.reduce((t, x) => t + x.amount, 0);
    const rows = list.length > 3
      ? [...list.slice(0, 2).map(x => ({ ...x, name: optionLabel(x.category) })), { other: true, name: L(`ផ្សេងៗ ${list.length - 2} ប្រភេទ`, `${list.length - 2} more`), amount: list.slice(2).reduce((t, x) => t + x.amount, 0), color: "#94a3b8" }]
      : list.map(x => ({ ...x, name: optionLabel(x.category) }));
    const EMOJI = { Food: "🍜", Home: "🏠", Family: "👨‍👩‍👧", Transport: "🚗", Shopping: "🛍️", Bills: "🧾", Loan: "🏦", Education: "🎓", Health: "💊", Entertainment: "🎬", Other: "✨" };
    if (typeof HomeV2 !== "undefined" && HomeV2.lav && HomeV2.lav()) {
      const lavRows = rows.map(x => {
        const pct = Math.round((x.amount / total) * 100);
        const on = Math.max(1, Math.round(pct / 10));
        return `<a class="fv2-cat3" href="#money/expenses" style="--c:${x.color}"><span class="fv2-cat3-ic" aria-hidden="true">${x.other ? "✨" : (EMOJI[x.category] || "✨")}</span><span class="fv2-cat3-m"><b>${escapeHtml(x.name)}</b><em>${money(x.amount)}</em><span class="fv2-cat3-seg">${Array.from({ length: 10 }, (_, i) => `<i class="${i < on ? "on" : ""}"></i>`).join("")}</span></span><small>${pct}%</small></a>`;
      }).join("");
      return section(L("ចាយលើអ្វីខ្លះ", "Where it went"), "#money/expenses", lavRows);
    }
    const body = `<div class="fv2-stack">${list.map(x => `<i style="flex:${x.amount};background:${x.color}"></i>`).join("")}</div>`
      + rows.map(x => `<a class="fv2-cat2" href="#money/expenses" style="--c:${x.color}"><span class="fv2-dot"></span><span class="fv2-cat2-name">${escapeHtml(x.name)}</span><b>${money(x.amount)}</b><small>${Math.round((x.amount / total) * 100)}%</small></a>`).join("");
    return section(L("ចាយលើអ្វីខ្លះ", "Where it went"), "#money/expenses", body);
  }

  function upcoming() {
    const today = localDateInput();
    const bills = (appData.bills || [])
      .filter(bill => bill.status !== "Paid" && !billPaidCurrentCycle(bill) && bill.due)
      .map(bill => ({
        title: bill.name || t("bill"), date: bill.due, amount: full(bill.amount, bill.currency), href: "#money/bills", icon: billEmoji(bill.name, bill.category), kind: "bill",
        tag: bill.autoPay ? L("ស្វ័យប្រវត្តិ", "Auto-pay") : daysBetween(today, bill.due) <= 3 ? L("ឆាប់ៗ", "Soon") : "", tagTone: bill.autoPay ? "ok" : "warn"
      }));
    const loans = (appData.loans || []).filter(loan => loanRemaining(loan) > 0).map(loan => {
      const due = nextLoanPaymentDate(loan);
      if (!due) return null;
      const total = Number(loan.durationMonths || 0);
      const paidCount = total && loan.monthlyPayment ? Math.round(loanPaid(loan) / Number(loan.monthlyPayment)) : 0;
      return {
        title: loan.name || t("loan"), date: due, amount: full(loan.monthlyPayment, loan.currency), href: "#money/loans", icon: /car|ឡាន|moto|ម៉ូតូ/i.test(loan.name || "") ? "🚘" : "🏦", kind: "loan",
        tag: total ? `${paidCount}/${total}` : "", tagTone: "loan"
      };
    }).filter(Boolean);
    // savings goals with a monthly amount not put in yet this month
    const saves = (appData.savings || []).filter(item => Number(item.monthlyContribution) > 0 && !getSavingsContribution(item)?.paid).map(item => ({
      title: item.name || t("savings"), date: today, amount: full(item.monthlyContribution, item.currency), href: "#money/savings", icon: "🎯", kind: "save",
      tag: L("មិនទាន់ដាក់", "Not yet"), tagTone: "warn", noDate: true
    }));
    const list = [...bills, ...loans].sort((a, b) => String(a.date).localeCompare(String(b.date))).concat(saves).slice(0, 3);
    if (!list.length) return "";
    const body = list.map(item => {
      const days = daysBetween(today, item.date);
      return `<a class="fv2-item ${days < 0 ? "is-late" : ""}" href="${item.href}">
        <span class="fv2-ico fv2-icon fv2-ico-${item.kind}" aria-hidden="true">${item.icon}</span>
        <span class="fv2-item-text"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.noDate ? L("សន្សំខែនេះ", "This month's saving") : item.date.slice(0, 7) === today.slice(0, 7) || days < 0 ? `${dayText(item.date)} · ${inDaysText(days)}` : dayText(item.date, true))}</small></span>
        <span class="fv2-item-num"><b>${item.amount}</b>${days < 0 ? `<small class="fv2-tag-late">${escapeHtml(L("ហួសកំណត់", "Overdue"))}</small>` : item.tag ? `<small class="fv2-tag-${item.tagTone}">${escapeHtml(item.tag)}</small>` : ""}</span>
      </a>`;
    }).join("");
    return section(L("ខាងមុខ", "Coming up"), "#money/bills", body);
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

  // last 3 days: one flat list (5 rows), riel shows ≈ $, tap = edit
  function recent() {
    const today = localDateInput();
    const from = new Date(`${today}T00:00:00`);
    from.setDate(from.getDate() - 2);
    const fromIso = localDateInput(from);
    const yesterday = new Date(`${today}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const yIso = localDateInput(yesterday);
    const items = (appData.expenses || []).filter(item => item.date && item.date >= fromIso && item.date <= today)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    const totalNow = items.reduce((t, item) => t + toProfileCurrency(item.amount, item.currency), 0);
    const head = `<p class="fv2-recent-note">${escapeHtml(L("៣ ថ្ងៃចុងក្រោយ", "Last 3 days"))} · ${items.length} · -${money(totalNow)}</p>`;
    if (!items.length) return section(t("recentTransactions"), "#money/expenses", `${head}<p class="fv2-recent-empty">${escapeHtml(L("មិនមានចំណាយក្នុង ៣ ថ្ងៃចុងក្រោយទេ", "No expenses in the last 3 days"))}</p>`);
    const cur = appData.profile.currency || "USD";
    const rows = items.slice(0, 5).map(item => {
      const group = typeof expenseGroupOf === "function" ? expenseGroupOf(item) : (item.category || "Other");
      const name = (typeof expenseName === "function" ? expenseName(item) : item.description) || optionLabel(group);
      const when = item.date === today ? L("ថ្ងៃនេះ", "Today") : item.date === yIso ? L("ម្សិលមិញ", "Yesterday") : dayText(item.date);
      const method = String(item.method || "").trim();
      const other = item.currency && item.currency !== cur;
      return `<button type="button" class="fv2-tx" data-edit-expense="${escapeAttr(item.id)}">
        <span class="fv2-ico fv2-icon fv2-ico-cat" aria-hidden="true">${CAT_EMOJI[group] || "📦"}</span>
        <span class="fv2-item-text"><b>${escapeHtml(name)}</b><small>${escapeHtml(when)}${method ? ` <span class="fv2-meth">${escapeHtml(method)}</span>` : ""}</small></span>
        <span class="fv2-item-num"><b>-${money(item.amount, item.currency || cur)}</b>${other ? `<small>≈ ${money(toProfileCurrency(item.amount, item.currency))}</small>` : ""}</span>
      </button>`;
    }).join("");
    const more = items.length > 5 ? `<a class="fv2-more" href="#money/expenses">+${items.length - 5} ${escapeHtml(L("ទៀត · មើលទាំងអស់", "more · see all"))} ›</a>` : "";
    return section(L("ថ្មីៗ", "Recent"), "#money/expenses", head + rows + more);
  }

  function overview(stats) {
    const range = moneyPeriodRange();
    const waiting = typeof MoneyAsk !== "undefined" ? MoneyAsk.items() : [];
    // the Day / Week / Month / Year bar opens from the chip on the hero (still the same controls)
    return `<div class="fv2${periodOpen ? " show-period" : ""}">
      ${renderMoneyPeriodBar(range).replace("<strong>ខែ", "<strong>")}
      ${hero(stats, range)}
      ${miniGrid(stats, range, waiting)}
      ${waitingList(waiting)}
      ${categories(range)}
      ${upcoming()}
      ${typeof SmartMoney !== "undefined" ? `<section class="fv2-section"><div class="fv2-section-head"><h2>${escapeHtml(L("កត់ចំណាយរហ័ស", "Quick expense"))}</h2></div>${SmartMoney.renderQuickExpense("qx-compact")}</section>` : ""}
      ${recent()}
    </div>`;
  }

  document.addEventListener("click", event => {
    const chip = event.target.closest("[data-fv2-period]");
    if (!chip) return;
    periodOpen = !periodOpen;
    chip.closest(".fv2")?.classList.toggle("show-period", periodOpen);
    chip.setAttribute("aria-expanded", String(periodOpen));
  });

  return { overview };
})();
