/* MYLIFE Finance tabs V2 (draft 24 Oct 2026): Income, Savings, Loans and Bills get new
 * markup; Expenses / Budget / Reports keep theirs and are restyled in css/money-tabs-v2.css.
 * Rules: a small "＋ Add" pill above each list, clean rows (coloured icon + amount),
 * edit / delete inside ⋯ (tap a row to edit). Every old hook stays, so bindMoney()
 * binds everything like before: data-action="add-*", data-edit-*, data-delete-*,
 * data-payment-loan, data-loan-schedule, data-savings-contribution, data-finance-toggle-bill. */
const MoneyTabsV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const INCOME_EMOJI = { Salary: "💼", Business: "🏪", Freelance: "🧑‍💻", Bonus: "🎁", Other: "💵" };
  const BILL_EMOJI = { Utilities: "⚡", Electricity: "⚡", Water: "💧", Internet: "📶", Phone: "📱", Rent: "🏠", Home: "🏠", Insurance: "🛡️", Subscription: "🔁", Education: "📚", Transport: "🚗", Health: "💊" };

  const today = () => localDateInput();
  function daysUntil(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
    return Math.round((new Date(`${iso}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000);
  }
  function dayLabel(iso, withYear = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (km()) return `${d} ${KM_M[m - 1]}${withYear ? ` ${y}` : ""}`;
    return new Date(y, m - 1, d).toLocaleDateString("en-US", withYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  }
  function monthLabel(iso) {
    if (!/^\d{4}-\d{2}/.test(iso || "")) return "";
    const [y, m] = iso.split("-").map(Number);
    return km() ? `${KM_M[m - 1]} ${y}` : new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  const inDays = days => (days === 0 ? L("ថ្ងៃនេះ", "today") : days === 1 ? L("ស្អែក", "tomorrow") : L(`${days} ថ្ងៃទៀត`, `in ${days} days`));

  const sec = (title, count, action, label) => `<div class="mt-sec"><b>${escapeHtml(title)}${count != null ? ` · ${count}` : ""}</b>${action ? `<button type="button" class="mt-add" data-action="${action}">＋ ${escapeHtml(label || L("បន្ថែម", "Add"))}</button>` : ""}</div>`;
  // ⋯ menu with the old edit / delete buttons (same data attributes)
  function more(kind, item, name) {
    const Kind = kind;
    return `<details class="mt-more"><summary aria-label="${escapeAttr(L("ជម្រើស", "Options"))}">⋯</summary><div class="mt-menu">
      <button type="button" data-edit-${Kind}="${escapeAttr(item.id)}">${Icons.edit()}<span>${escapeHtml(t("edit"))}</span></button>
      <button type="button" class="is-danger" data-delete-${Kind}="${escapeAttr(item.id)}">${Icons.trash()}<span>${escapeHtml(t("delete"))}</span></button>
    </div></details>`;
  }
  const empty = (title, body, action, label) => `<section class="mt-card mt-empty"><span>🗂️</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p>${action ? `<button type="button" class="mt-btn is-main" data-action="${action}">＋ ${escapeHtml(label)}</button>` : ""}</section>`;
  const ring = (p, label) => `<span class="mt-ring" style="--p:${p}"><b>${p}%${label ? `<small>${escapeHtml(label)}</small>` : ""}</b></span>`;

  /* ---------- income ---------- */
  function income() {
    const items = appData.income || [];
    const cats = incomeCategories.map(category => ({ category, amount: sumMoney(items.filter(item => (item.category || "Other") === category), "amount"), color: incomeCategoryColors[category] }));
    const total = cats.reduce((sum, item) => sum + item.amount, 0);
    const used = cats.filter(item => item.amount > 0);
    const head = `<section class="mt-card mt-total">
      <small>${escapeHtml(t("totalIncome"))}</small><b class="mt-big">${money(total)}</b>
      ${used.length ? `<div class="mt-stack">${used.map(item => `<i style="flex:${item.amount};background:${item.color}"></i>`).join("")}</div>
      <div class="mt-legend">${used.map(item => `<span><i style="background:${item.color}"></i>${escapeHtml(optionLabel(item.category))} <b>${money(item.amount)}</b></span>`).join("")}</div>` : ""}
    </section>`;
    const rows = items.map(item => {
      const category = item.category || "Other";
      const day = /^\d{4}-\d{2}-\d{2}$/.test(item.date || "") ? L(`ថ្ងៃទី ${Number(item.date.slice(8))}`, `Day ${Number(item.date.slice(8))}`) : "";
      return `<div class="mt-row" data-mt-row>
        <span class="mt-ic" style="--c:${incomeCategoryColors[category] || "#94a3b8"}">${INCOME_EMOJI[category] || "💵"}</span>
        <span class="mt-tx"><b>${escapeHtml(item.name || optionLabel(category))}</b><small>${escapeHtml(optionLabel(category))}${item.frequency ? `<em class="mt-chip">${escapeHtml(optionLabel(item.frequency))}</em>` : ""}</small></span>
        <span class="mt-am"><b class="is-in">+${money(item.amount, item.currency)}</b>${day ? `<small>${escapeHtml(day)}</small>` : ""}</span>
        ${more("income", item)}
      </div>`;
    }).join("");
    return `${head}${sec(t("incomeSources"), items.length, "add-income")}
      ${items.length ? `<section class="mt-card mt-list">${rows}</section>` : empty(t("noIncomeYet"), t("noIncomeBody"), "add-income", t("addIncome"))}`;
  }

  /* ---------- savings ---------- */
  function savings() {
    const items = appData.savings || [];
    const month = getSavingsContributionMonth();
    const cards = items.map(item => {
      const p = pct(item.currentAmount, item.targetAmount);
      const contribution = getSavingsContribution(item, month);
      const paid = Boolean(contribution && contribution.paid);
      const monthly = Number(item.monthlyContribution || 0);
      const history = (Array.isArray(item.contributions) ? item.contributions : []).slice(0, 6);
      return `<section class="mt-card mt-save" data-mt-row>
        <div class="mt-head"><span class="mt-ic" style="--c:#f59e0b">🐷</span><b>${escapeHtml(item.name || t("savings"))}</b>${more("savings", item)}</div>
        <div class="mt-hero">${ring(p)}<div><small>${escapeHtml(L("សន្សំបាន", "Saved"))}</small><span class="mt-big">${money(item.currentAmount, item.currency)}</span><em>/ ${money(item.targetAmount, item.currency)}</em></div></div>
        ${typeof SmartMoney !== "undefined" ? SmartMoney.savingsPace(item) : ""}
        <div class="mt-minis"><div><small>${escapeHtml(t("monthlyContribution"))}</small><b>${money(monthly, item.currency)}</b></div><div><small>${escapeHtml(t("deadline"))}</small><b>${item.deadline ? escapeHtml(dayLabel(item.deadline, true)) : "—"}</b></div></div>
        <label class="mt-check${paid ? " is-on" : ""}"><input type="checkbox" data-savings-contribution="${escapeAttr(item.id)}" data-savings-month="${escapeAttr(month)}" ${paid ? "checked" : ""}><span class="mt-box">${Icons.check()}</span><span><b>${escapeHtml(L(`ដាក់សន្សំខែ${monthLabel(month)}`, `Saved for ${monthLabel(month)}`))}</b><small>${money(monthly, item.currency)} · ${escapeHtml(paid ? t("saved") : t("pending"))}</small></span></label>
        ${history.length ? `<details class="mt-acc"><summary>📋 ${escapeHtml(L("ប្រវត្តិ", "History"))} · ${history.length}<span>›</span></summary><div class="mt-hist">${history.map(entry => `<div class="${entry.paid ? "is-paid" : ""}"><span>${escapeHtml(monthLabel(entry.month))}</span><b>${entry.paid ? "✓ " : ""}${money(Number(entry.amount || item.monthlyContribution || 0), item.currency)}</b></div>`).join("")}</div></details>` : ""}
      </section>`;
    }).join("");
    return `${sec(t("savings"), items.length, "add-savings")}${items.length ? cards : empty(t("noSavingsYet"), t("noSavingsBody"), "add-savings", t("addSavings"))}`;
  }

  /* ---------- loans ---------- */
  function loans() {
    const items = appData.loans || [];
    const cards = items.map(loan => {
      const remaining = loanRemaining(loan);
      const paid = loanPaid(loan);
      const total = loanPayoffAmount(loan) || Number(loan.originalAmount || 0);
      const p = pct(paid, total);
      const next = nextLoanPaymentDate(loan);
      const nextDays = daysUntil(next);
      const schedule = loanPaymentScheduleToCurrent(loan);
      const payDay = loanDisplayPaymentDay(loan);
      const interest = Math.max(0, loanPayoffAmount(loan) - Number(loan.originalAmount || 0));
      return `<section class="mt-card mt-loan" data-mt-row>
        <div class="mt-head"><span class="mt-ic" style="--c:#3b82f6">🏦</span><b>${escapeHtml(loan.name || t("loan"))}</b>${more("loan", loan)}</div>
        <div class="mt-tags"><span>${escapeHtml(loan.durationMonths ? `${loan.durationMonths} ${t("months")}` : optionLabel(loan.paymentFrequency || "Monthly"))}</span><span>${escapeHtml(t("interest"))} ${loan.interestRate || 0}%</span>${payDay ? `<span>${escapeHtml(L(`បង់ថ្ងៃទី ${payDay}`, `Pays on day ${payDay}`))}</span>` : ""}</div>
        <div class="mt-hero">${ring(p, t("paid"))}<div><small>${escapeHtml(t("remaining"))}</small><span class="mt-big">${money(remaining, loan.currency)}</span><em>${money(paid, loan.currency)} / ${money(total, loan.currency)}</em></div></div>
        <div class="mt-minis is-3"><div><small>${escapeHtml(t("monthlyPayment"))}</small><b>${money(loan.monthlyPayment, loan.currency)}</b></div><div><small>${escapeHtml(t("nextPaymentDate"))}</small><b>${next ? escapeHtml(dayLabel(next)) : "—"}</b></div><div><small>${escapeHtml(t("dueDate"))}</small><b>${loan.dueDate ? escapeHtml(monthLabel(loan.dueDate)) : "—"}</b></div></div>
        ${next && remaining > 0 ? `<div class="mt-next"><span>📅</span><span><b>${escapeHtml(L("បង់លើកក្រោយ", "Next payment"))} · ${money(loan.monthlyPayment, loan.currency)}</b><small>${escapeHtml(dayLabel(next, true))}${nextDays != null && nextDays >= 0 ? ` · ${escapeHtml(inDays(nextDays))}` : ""}</small></span></div>` : ""}
        <button type="button" class="mt-btn is-main is-wide" data-payment-loan="${escapeAttr(loan.id)}">＋ ${escapeHtml(t("makePayment"))}</button>
        <details class="mt-acc"><summary>ⓘ ${escapeHtml(t("loanDetails"))}<span>›</span></summary><div class="mt-kv">
          <div><small>${escapeHtml(t("original"))}</small><b>${money(loan.originalAmount, loan.currency)}</b></div>
          <div><small>${escapeHtml(t("firstPaymentDate"))}</small><b>${escapeHtml(dayLabel(loan.firstPaymentDate || loan.startDate, true) || "—")}</b></div>
          <div><small>${escapeHtml(t("totalInterest"))}</small><b>${money(interest, loan.currency)}</b></div>
        </div></details>
        ${schedule.length ? `<details class="mt-acc"><summary>📋 ${escapeHtml(t("paymentSchedule"))} · ${schedule.filter(item => item.paid).length}/${schedule.length}<span>›</span></summary><div class="mt-sched">${schedule.slice().reverse().map(item => `<label class="mt-check is-sm${item.paid ? " is-on" : ""}"><input type="checkbox" data-loan-schedule="${escapeAttr(loan.id)}" data-payment-date="${escapeAttr(item.date)}" ${item.paid ? "checked" : ""}><span class="mt-box">${Icons.check()}</span><span><b>${escapeHtml(dayLabel(item.date, true))}</b><small>${money(item.amount, loan.currency)}</small></span></label>`).join("")}</div></details>` : ""}
      </section>`;
    }).join("");
    return `${sec(t("loans"), items.length, "add-loan")}${typeof renderLoanDoubleCheck === "function" ? renderLoanDoubleCheck() : ""}${items.length ? cards : empty(t("noLoansYet"), t("noLoansBody"), "add-loan", t("addLoan"))}`;
  }

  /* ---------- bills ---------- */
  function bills() {
    const items = (appData.bills || []).slice();
    const todayIso = today();
    const month = todayIso.slice(0, 7);
    const toMine = bill => (typeof toProfileCurrency === "function" ? toProfileCurrency(bill.amount, bill.currency) : Number(bill.amount || 0));
    const state = bill => {
      const paid = billPaidCurrentCycle(bill);
      const days = daysUntil(bill.due);
      return { paid, days, late: !paid && days != null && days < 0 };
    };
    const rowsData = items.map(bill => ({ bill, ...state(bill) }))
      .sort((a, b) => Number(a.paid) - Number(b.paid) || String(a.bill.due || "9999").localeCompare(String(b.bill.due || "9999")));
    const dueMonth = rowsData.filter(row => !row.paid && String(row.bill.due || "").slice(0, 7) <= month).reduce((sum, row) => sum + toMine(row.bill), 0);
    const paidMonth = rowsData.filter(row => row.paid && String(row.bill.lastPaidAt || "").slice(0, 7) === month).reduce((sum, row) => sum + Number(row.bill.lastPaidAmount || 0 || toMine(row.bill)), 0);
    const late = rowsData.filter(row => row.late).length;
    const head = items.length ? `<div class="mt-tiles">
      <div><small>${escapeHtml(L("ត្រូវបង់ខែនេះ", "To pay this month"))}</small><b>${money(dueMonth)}</b></div>
      <div><small>${escapeHtml(L("បង់ហើយ", "Paid"))}</small><b class="is-in">${money(paidMonth)}</b></div>
      <div><small>${escapeHtml(L("ហួសកំណត់", "Overdue"))}</small><b class="${late ? "is-out" : ""}">${late}</b></div>
    </div>` : "";
    const rows = rowsData.map(({ bill, paid, days, late: isLate }) => {
      const emoji = BILL_EMOJI[bill.category] || BILL_EMOJI[bill.name] || "🧾";
      const tag = paid ? `✓ ${L("បង់ហើយ", "Paid")}` : isLate ? L(`ហួស ${-days} ថ្ងៃ`, `${-days}d late`) : days == null ? L("កត់ថាបង់", "Mark paid") : days === 0 ? L("ថ្ងៃនេះ", "Today") : L(`${days} ថ្ងៃ`, `${days}d`);
      const tone = paid ? "is-paid" : isLate ? "is-late" : days != null && days <= 3 ? "is-soon" : "is-due";
      const sub = paid && bill.lastPaidAt ? L(`បង់ ${dayLabel(bill.lastPaidAt)}`, `Paid ${dayLabel(bill.lastPaidAt)}`) : `${bill.due ? dayLabel(bill.due) : t("dueDate")} · ${optionLabel(bill.frequency || "Monthly")}`;
      const amount = !(Number(bill.amount) > 0) && bill.invoiceUrl ? escapeHtml(L("មើលវិក្កយបត្រ", "See invoice")) : money(bill.amount, bill.currency);
      const extra = [
        bill.autoPay ? `<em class="mt-chip">🔁 ${escapeHtml(L("ស្វ័យប្រវត្តិ", "Auto-pay"))}</em>` : "",
        !paid && bill.invoiceAt && Date.now() - Date.parse(bill.invoiceAt) < 20 * 86400000 ? `<em class="mt-chip is-new">🆕 ${escapeHtml(L("វិក្កយបត្រថ្មី", "New invoice"))}</em>` : "",
        /^https:\/\//.test(bill.invoiceUrl || "") ? `<a class="mt-chip is-link" href="${escapeAttr(bill.invoiceUrl)}" target="_blank" rel="noopener">🔗 ${escapeHtml(L("វិក្កយបត្រ", "Invoice"))}</a>` : ""
      ].join("");
      return `<div class="mt-row" data-mt-row>
        <span class="mt-ic" style="--c:${paid ? "#22c55e" : isLate ? "#e5484d" : "#f59e0b"}">${emoji}</span>
        <span class="mt-tx"><b>${escapeHtml(bill.name || t("bill"))}</b><small>${escapeHtml(sub)}</small>${extra ? `<span class="mt-extra">${extra}</span>` : ""}</span>
        <span class="mt-am"><b>${amount}</b></span>
        <button type="button" class="mt-status ${tone}" data-finance-toggle-bill="${escapeAttr(bill.id)}" aria-pressed="${paid}" title="${escapeAttr(paid ? L("ប្តូរទៅជាមិនទាន់បង់", "Mark as not paid") : L("កត់ថាបង់រួច", "Mark paid"))}">${escapeHtml(tag)}</button>
        ${more("bill", bill)}
      </div>`;
    }).join("");
    return `${head}${sec(t("bills"), items.length, "add-bill")}
      ${items.length ? `<section class="mt-card mt-list">${rows}</section><p class="mt-hint">${escapeHtml(L("ចុចលើស្លាក ដើម្បីកត់ថាបង់ហើយ · ចុចលើជួរ ដើម្បីកែ", "Tap the tag to mark paid · tap a row to edit"))}</p>` : empty(t("noBillsYet"), t("noBillsBody"), "add-bill", t("addBill"))}`;
  }

  function render(tab) {
    if (tab === "income") return income();
    if (tab === "savings") return savings();
    if (tab === "loans") return loans();
    if (tab === "bills") return bills();
    return "";
  }

  // tap a row (not a button / link / checkbox) = edit it; close other ⋯ menus
  document.addEventListener("click", event => {
    const open = event.target.closest(".mt-more");
    document.querySelectorAll(".mt-more[open]").forEach(menu => { if (menu !== open) menu.open = false; });
    const row = event.target.closest(".fv2-page [data-mt-row]");
    if (!row || event.target.closest("button, a, input, label, summary, details, .mt-menu")) return;
    row.querySelector(".mt-menu [data-edit-income], .mt-menu [data-edit-savings], .mt-menu [data-edit-loan], .mt-menu [data-edit-bill]")?.click();
  });

  return { render };
})();
