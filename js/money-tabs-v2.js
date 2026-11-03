/* MYLIFE Finance tabs V2 (draft 24 Oct 2026): Income, Savings, Loans and Bills get new
 * markup; Expenses / Budget / Reports keep theirs and are restyled in css/money-tabs-v2.css.
 * Rules: a small "＋ Add" pill above each list, clean rows (coloured icon + amount),
 * edit / delete inside ⋯ (tap a row to edit). Every old hook stays, so bindMoney()
 * binds everything like before: data-action="add-*", data-edit-*, data-delete-*,
 * data-payment-loan, data-loan-schedule, data-savings-contribution, data-finance-toggle-bill. */
const MoneyTabsV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const numberForSavings = (value, digits = 0) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: digits });
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
  const nomiSticker = () => `<span class="mt-nomi-sticker" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><ellipse cx="32" cy="58" rx="18" ry="3" fill="#a99ae0" opacity=".22"/><path d="M12 28 17 7l16 14L48 7l5 21" fill="#bba9ff"/><path d="m18 19 2-8 8 8m11 0 8-8 2 8" fill="#e4dcff"/><circle cx="32" cy="37" r="23" fill="#cbbdff"/><path d="M20 37l3-4 3 4-3 4zm18 0 3-4 3 4-3 4z" fill="#ffd34e" stroke="#5546a8" stroke-width="1.4"/><path d="M27 43q5 6 10 0" fill="none" stroke="#5546a8" stroke-width="2.2" stroke-linecap="round"/><circle cx="19" cy="43" r="2.5" fill="#ff9db3"/><circle cx="45" cy="43" r="2.5" fill="#ff9db3"/><path d="M51 44c7-2 7 5 2 7-2 1-4 0-5-2" fill="none" stroke="#cbbdff" stroke-width="4" stroke-linecap="round"/></svg></span>`;

  /* ---------- income ---------- */
  function income() {
    const items = appData.income || [];
    const cats = incomeCategories.map(category => ({ category, amount: sumMoney(items.filter(item => (item.category || "Other") === category), "amount"), color: incomeCategoryColors[category] }));
    const total = cats.reduce((sum, item) => sum + item.amount, 0);
    const used = cats.filter(item => item.amount > 0);
    const head = `<section class="mt-card mt-total">
      ${nomiSticker()}<small>${escapeHtml(t("totalIncome"))}</small><b class="mt-big">${money(total)}</b>
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
    return `<div class="mt-finance-group mt-income-group">${head}${sec(t("incomeSources"), items.length, "add-income")}
      ${items.length ? `<section class="mt-card mt-list">${rows}</section>` : empty(t("noIncomeYet"), t("noIncomeBody"), "add-income", t("addIncome"))}</div>`;
  }

  /* ---------- savings (draft 24 Oct): total card + one card per account ---------- */
  const JARS = [["🐷", "#ff7aa8"], ["🏦", "#3b82f6"], ["🎯", "#f59e0b"], ["💰", "#22c55e"]];
  function savings() {
    const items = appData.savings || [];
    const market = typeof SavingsMarket !== "undefined" ? SavingsMarket.render() : "";
    const month = getSavingsContributionMonth();
    const mine = (value, currency) => (typeof toProfileCurrency === "function" ? toProfileCurrency(value, currency) : Number(value || 0));
    const todayIso = today();
    const total = items.reduce((sum, item) => sum + mine(item.currentAmount, item.currency), 0);
    const goldTransactions = items.flatMap(item => (Array.isArray(item.transactions) ? item.transactions : []).filter(tx => ["gold", "gold-sale"].includes(tx.type)).map(tx => ({ ...tx, savingId: item.id, savingName: item.name || t("savings"), currency: tx.currency || item.currency || appData.profile.currency || "USD" }))).sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
    const marketQuote = typeof SavingsMarket !== "undefined" ? SavingsMarket.quote() : {};
    const totalInvested = goldTransactions.reduce((sum, tx) => sum + (tx.type === "gold-sale" ? -mine(Math.max(0, Number(tx.netProceeds ?? (Number(tx.amount || 0) - Number(tx.fees || 0)))), tx.currency) : mine(Number(tx.purchaseValue ?? tx.amount ?? 0) + Number(tx.fees || 0), tx.currency)), 0);
    const fxAvailable = Number(marketQuote.usdKhr) > 0;
    const currentInvestmentValue = Number(marketQuote.goldUsdPerGram) > 0 && (!goldTransactions.some(tx => tx.currency === "KHR") || fxAvailable) ? goldTransactions.reduce((sum, tx) => {
      const purity = Math.min(24, Math.max(1, Number(String(tx.goldPurity || "24K").match(/\d+/)?.[0] || 24)));
      const grams = Math.max(0, Number(tx.goldWeightGrams || 0)) * (tx.type === "gold-sale" ? -1 : 1);
      const usd = grams * Number(marketQuote.goldUsdPerGram) * purity / 24;
      const value = tx.currency === "KHR" ? usd * Number(marketQuote.usdKhr || 0) : usd;
      return sum + mine(value, tx.currency);
    }, 0) : null;
    const goldProfitLoss = currentInvestmentValue === null ? null : currentInvestmentValue - totalInvested;
    const ownedGoldChi = goldTransactions.reduce((sum, tx) => sum + Math.max(0, Number(tx.goldWeightGrams || 0)) * (tx.type === "gold-sale" ? -1 : 1) / 3.75, 0);
    const holdingRows = goldTransactions.map(tx => {
      const grams = Math.max(0, Number(tx.goldWeightGrams || 0));
      const isSale = tx.type === "gold-sale";
      const value = isSale ? Math.max(0, Number(tx.netProceeds ?? (Number(tx.amount || 0) - Number(tx.fees || 0)))) : Number(tx.purchaseValue ?? tx.amount ?? 0) + Number(tx.fees || 0);
      return `<article class="sv-holding-row"><span class="sv-holding-coin">${isSale ? "💱" : "🪙"}</span><span class="sv-holding-info"><b>${numberForSavings(grams / 3.75, 2)} ${escapeHtml(L("ជី", "Chi"))} · ${escapeHtml(tx.goldPurity || "24K")}</b><small>${escapeHtml(tx.savingName)} · ${escapeHtml(tx.date || "")}</small><small>${escapeHtml(isSale ? L("លក់បាន", "Sold for") : L("ទិញ", "Bought"))}: ${money(value, tx.currency)}</small></span><span class="sv-holding-value"><b class="${isSale ? "is-up" : ""}">${isSale ? "+" : "−"}${money(value, tx.currency)}</b></span>${!isSale ? `<button type="button" class="sv-tx-delete" data-remove-gold-purchase="${escapeAttr(tx.id)}" data-saving-id="${escapeAttr(tx.savingId)}" aria-label="${escapeAttr(L("លុបការទិញមាស", "Remove gold purchase"))}" title="${escapeAttr(L("លុបការទិញមាស", "Remove gold purchase"))}">×</button>` : ""}</article>`;
    }).join("");
    const target = items.reduce((sum, item) => sum + mine(item.targetAmount, item.currency), 0);
    const planned = items.reduce((sum, item) => sum + mine(item.monthlyContribution, item.currency), 0);
    const doneItems = items.filter(item => getSavingsContribution(item, month)?.paid);
    const doneAmount = doneItems.reduce((sum, item) => sum + mine(getSavingsContribution(item, month).amount || item.monthlyContribution, item.currency), 0);
    const head = items.length ? `<section class="sv-total">
      <small>${escapeHtml(L(`សន្សំសរុប · ${items.length} គណនី`, `Saved in total · ${items.length} account${items.length === 1 ? "" : "s"}`))}</small>
      <b class="sv-big">${money(total)}${target ? `<em> / ${money(target)}</em>` : ""}</b>
      <div class="sv-tiles">
        <div><small>${escapeHtml(L("ខែនេះត្រូវដាក់", "To save this month"))}</small><b>${money(planned)}</b></div>
        <div><small>${escapeHtml(L("ដាក់រួច", "Saved"))}</small><b>${money(doneAmount)} · ${doneItems.length}/${items.length}</b></div>
        <div><small>${escapeHtml(L("ខែក្រោយ", "Next month"))}</small><b>${money(planned)}</b></div>
      </div>
    </section>` : "";
    const cards = items.map((item, index) => {
      const p = pct(item.currentAmount, item.targetAmount);
      const contribution = getSavingsContribution(item, month);
      const paid = Boolean(contribution && contribution.paid);
      const monthly = Number(item.monthlyContribution || 0);
      const reached = Number(item.targetAmount || 0) > 0 && Number(item.currentAmount || 0) >= Number(item.targetAmount || 0);
      const late = !reached && /^\d{4}-\d{2}-\d{2}$/.test(item.deadline || "") && item.deadline < todayIso;
      const [jar, color] = JARS[index % JARS.length];
      const history = (Array.isArray(item.contributions) ? item.contributions : []).slice(0, 12);
      const transactions = (Array.isArray(item.transactions) ? item.transactions : []).slice().sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
      const reserve = Math.min(Math.max(0, Number(item.reserveAmount || 0)), Math.max(0, Number(item.currentAmount || 0)));
      const available = Math.max(0, Number(item.currentAmount || 0) - reserve);
      const goldChi = transactions.filter(entry => ["gold", "gold-sale"].includes(entry.type)).reduce((sum, entry) => sum + Math.max(0, Number(entry.goldWeightGrams || 0)) * (entry.type === "gold-sale" ? -1 : 1) / 3.75, 0);
      const transactionHistory = transactions.slice(0, 5).map(entry => {
        const action = entry.type === "gold" ? L("ទិញមាស", "Gold purchase") : entry.type === "gold-sale" ? L("លក់មាស", "Gold sale") : entry.type === "investment" ? L("វិនិយោគ/ប្រើផ្សេងៗ", "Investment / other use") : L("ចំណាយ", "Spending");
        const weightLabel = ["gold", "gold-sale"].includes(entry.type) ? (entry.goldChi && entry.goldChi !== "custom" ? `${numberForSavings(entry.goldChi, 2)} ជី` : entry.goldWeightGrams ? `${numberForSavings(entry.goldWeightGrams / 3.75, 2)} ជី` : "") : "";
        const detail = [entry.date || "", weightLabel, ["gold", "gold-sale"].includes(entry.type) ? entry.goldPurity || "24K" : entry.type === "spend" && entry.category ? optionLabel(entry.category) : "", entry.note || ""].filter(Boolean).join(" · ");
        const historyAmount = entry.type === "gold-sale" ? Number(entry.netProceeds ?? (Number(entry.amount || 0) - Number(entry.fees || 0))) : Number(entry.totalDebit ?? (Number(entry.amount || 0) + Number(entry.fees || 0)));
        return `<div class="sv-use-history-row"><span><b>${escapeHtml(action)}</b><small>${escapeHtml(detail)}</small></span><strong class="${entry.type === "gold-sale" ? "is-credit" : ""}">${entry.type === "gold-sale" ? "+" : "−"}${money(historyAmount, entry.currency || item.currency)}</strong>${entry.type === "gold" ? `<button type="button" class="sv-tx-delete" data-remove-gold-purchase="${escapeAttr(entry.id)}" data-saving-id="${escapeAttr(item.id)}" aria-label="${escapeAttr(L("លុបការទិញមាស", "Remove gold purchase"))}" title="${escapeAttr(L("លុបការទិញសាកល្បង", "Remove test purchase"))}">×</button>` : ""}</div>`;
      }).join("");
      const status = reached ? ["is-ok", L("សម្រេចហើយ 🎉", "Reached 🎉")] : late ? ["is-late", L("ហួសថ្ងៃ", "Overdue")] : ["is-ok", L("ទាន់ពេល", "On track")];
      return `<section class="mt-card sv-card${late ? " is-late" : ""}" data-mt-row>
        <div class="mt-head"><span class="mt-ic" style="--c:${color}">${jar}</span><b>${escapeHtml(item.name || t("savings"))}</b><span class="sv-status ${status[0]}">${escapeHtml(status[1])}</span>${more("savings", item)}</div>
        ${item.notes ? `<p class="sv-note">${escapeHtml(item.notes)}</p>` : ""}
        <div class="sv-amt"><b>${money(item.currentAmount, item.currency)}</b>${Number(item.targetAmount || 0) ? `<span>/ ${money(item.targetAmount, item.currency)}</span><em>${p}%</em>` : ""}</div>
        ${Number(item.targetAmount || 0) ? `<div class="sv-bar"><i style="width:${Math.max(p, 2)}%"></i></div>` : ""}
        <div class="sv-account-info">
          <div class="sv-available"><span>${escapeHtml(L("អាចប្រើបាន", "Available"))}</span><b>${money(available, item.currency)}</b>${reserve ? `<small>${escapeHtml(L(`បម្រុង ${String(money(reserve, item.currency)).replace(/<[^>]*>/g, "")}`, `Reserved ${String(money(reserve, item.currency)).replace(/<[^>]*>/g, "")}`))}</small>` : ""}</div>
          <div class="sv-chips"><span>📅 ${money(monthly, item.currency)}${escapeHtml(L("/ខែ", "/mo"))}</span>${item.deadline ? `<span>🏁 ${escapeHtml(dayLabel(item.deadline, true))}</span>` : ""}${goldChi ? `<span>🪙 ${numberForSavings(goldChi, 2)} ជី ${escapeHtml(L("មាស", "gold"))}</span>` : ""}</div>
          ${typeof SmartMoney !== "undefined" && !reached ? `<div class="sv-pace${late ? " is-late" : ""}">${SmartMoney.savingsPace(item)}</div>` : ""}
        </div>
        <div class="sv-actions">
          <label class="sv-save${paid ? " is-done" : ""}"><input type="checkbox" data-savings-contribution="${escapeAttr(item.id)}" data-savings-month="${escapeAttr(month)}" ${paid ? "checked" : ""}><span>${paid ? `✓ ${escapeHtml(L(`ដាក់ខែ${monthLabel(month).split(" ")[0]}រួច`, `Saved for ${monthLabel(month)}`))}` : `＋ ${escapeHtml(L(`ដាក់ ${String(money(monthly, item.currency)).replace(/<[^>]*>/g, "")} ខែនេះ`, `Save ${String(money(monthly, item.currency)).replace(/<[^>]*>/g, "")} this month`))}`}</span></label>
          <button type="button" class="sv-use-btn" data-use-savings="${escapeAttr(item.id)}" title="${escapeAttr(L("ប្រើប្រាក់ ឬទិញមាស", "Use savings or buy gold"))}" ${available <= 0 ? "disabled" : ""}>${escapeHtml(L("ប្រើប្រាក់", "Use"))}</button>
          <button type="button" class="sv-hist-btn" data-sv-hist aria-expanded="false" aria-label="${escapeAttr(L("ប្រវត្តិ", "History"))}">📋</button>
        </div>
        <div class="sv-hist" hidden>${history.length ? `<small class="sv-hist-label">${escapeHtml(L("ដាក់សន្សំប្រចាំខែ", "Monthly savings"))}</small>${history.map(entry => `<div class="${entry.paid ? "is-paid" : ""}"><span>${escapeHtml(monthLabel(entry.month))}</span><b>${entry.paid ? "✓ " : ""}${money(Number(entry.amount || item.monthlyContribution || 0), item.currency)}</b></div>`).join("")}` : ""}${transactionHistory ? `<small class="sv-hist-label">${escapeHtml(L("ប្រើប្រាក់សន្សំ", "Savings used"))}</small>${transactionHistory}` : ""}${!history.length && !transactionHistory ? `<p>${escapeHtml(L("មិនទាន់មានប្រវត្តិ", "No history yet"))}</p>` : ""}</div>
      </section>`;
    }).join("");
    const goldPortfolio = goldTransactions.length ? `<section class="sv-gold-portfolio"><header><span class="sv-gold-portfolio-icon">🪙</span><span class="sv-gold-portfolio-title"><small>${escapeHtml(L("មាសសរុប", "Gold owned"))}</small><strong>${numberForSavings(Math.max(0, ownedGoldChi), 2)} ${escapeHtml(L("ជី មាស", "Chi gold"))}</strong></span><span class="sv-gold-value"><small>${escapeHtml(L("តម្លៃប៉ាន់ស្មាន", "Est. value"))}</small><b>${currentInvestmentValue === null ? "—" : money(currentInvestmentValue)}</b></span>${ownedGoldChi > 0 ? `<button type="button" class="sv-gold-sell" data-sell-gold>${escapeHtml(L("លក់មាស", "Sell gold"))}</button>` : ""}</header><details class="sv-gold-details"><summary>📋 ${escapeHtml(L("ប្រវត្តិ និងដើមទុនសុទ្ធ", "History & net cost"))}</summary><div class="sv-gold-portfolio-total"><span><small>${escapeHtml(L("ដើមទុនសុទ្ធ", "Net invested"))}</small><b>${money(totalInvested)}</b></span><span><small>${escapeHtml(L("ចំណេញ/ខាត", "Gain/loss"))}</small><b>${goldProfitLoss === null ? "—" : `${goldProfitLoss >= 0 ? "+" : "−"}${money(Math.abs(goldProfitLoss))}`}</b></span></div><div class="sv-holding-list">${holdingRows}</div><small class="sv-gold-source">${escapeHtml(L("តម្លៃ Spot ប៉ាន់ស្មាន · តម្លៃហាងអាចខុស", "Spot estimate · shop prices may differ"))}</small></details></section>` : "";
    return `${market}${goldPortfolio}${head}${sec(L("គណនីសន្សំ", "Savings accounts"), items.length, "add-savings")}${items.length ? cards : empty(t("noSavingsYet"), t("noSavingsBody"), "add-savings", t("addSavings"))}`;
  }
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-sv-hist]");
    if (!button) return;
    const panel = button.closest(".sv-card")?.querySelector(".sv-hist");
    if (!panel) return;
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    button.classList.toggle("on", !panel.hidden);
  });

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
        <div class="mt-loan-progress"><div class="mt-hero">${ring(p, t("paid"))}<div><small>${escapeHtml(t("remaining"))}</small><span class="mt-big">${money(remaining, loan.currency)}</span><em>${money(paid, loan.currency)} / ${money(total, loan.currency)}</em></div></div>
          <div class="mt-minis is-3"><div><small>${escapeHtml(t("monthlyPayment"))}</small><b>${money(loan.monthlyPayment, loan.currency)}</b></div><div><small>${escapeHtml(t("nextPaymentDate"))}</small><b>${next ? escapeHtml(dayLabel(next)) : "—"}</b></div><div><small>${escapeHtml(t("dueDate"))}</small><b>${loan.dueDate ? escapeHtml(monthLabel(loan.dueDate)) : "—"}</b></div></div>
        </div>
        <div class="mt-loan-payment">${next && remaining > 0 ? `<div class="mt-next"><span>📅</span><span><b>${escapeHtml(L("បង់លើកក្រោយ", "Next payment"))} · ${money(loan.monthlyPayment, loan.currency)}</b><small>${escapeHtml(dayLabel(next, true))}${nextDays != null && nextDays >= 0 ? ` · ${escapeHtml(inDays(nextDays))}` : ""}</small></span></div>` : ""}
          <button type="button" class="mt-btn is-main is-wide" data-payment-loan="${escapeAttr(loan.id)}">＋ ${escapeHtml(t("makePayment"))}</button>
        </div>
        <div class="mt-loan-more"><details class="mt-acc"><summary>ⓘ ${escapeHtml(t("loanDetails"))}<span>›</span></summary><div class="mt-kv">
          <div><small>${escapeHtml(t("original"))}</small><b>${money(loan.originalAmount, loan.currency)}</b></div>
          <div><small>${escapeHtml(t("firstPaymentDate"))}</small><b>${escapeHtml(dayLabel(loan.firstPaymentDate || loan.startDate, true) || "—")}</b></div>
          <div><small>${escapeHtml(t("totalInterest"))}</small><b>${money(interest, loan.currency)}</b></div>
        </div></details>
        ${schedule.length ? `<details class="mt-acc"><summary>📋 ${escapeHtml(t("paymentSchedule"))} · ${schedule.filter(item => item.paid).length}/${schedule.length}<span>›</span></summary><div class="mt-sched">${schedule.slice().reverse().map(item => `<label class="mt-check is-sm${item.paid ? " is-on" : ""}"><input type="checkbox" data-loan-schedule="${escapeAttr(loan.id)}" data-payment-date="${escapeAttr(item.date)}" ${item.paid ? "checked" : ""}><span class="mt-box">${Icons.check()}</span><span><b>${escapeHtml(dayLabel(item.date, true))}</b><small>${money(item.amount, loan.currency)}</small></span></label>`).join("")}</div></details>` : ""}</div>
      </section>`;
    }).join("");
    const nomiSay = L("ខ្ញុំនៅទីនេះជួយអ្នកតាមដានកម្ចី 🐾", "I’m here to help you keep loans on track 🐾");
    const intro = typeof HomeV2 !== "undefined" && HomeV2.buddy ? `<div class="mt-loan-talk"><span class="mt-loan-nomi" data-nomi data-mood="happy" role="button" tabindex="0" aria-label="Nomi">${HomeV2.buddy("happy")}</span><span class="mt-loan-say" data-nomi-say>${escapeHtml(nomiSay)}</span></div>` : "";
    return `<div class="mt-finance-group mt-loans-group">${sec(t("loans"), items.length, "add-loan")}${intro}${typeof renderLoanDoubleCheck === "function" ? renderLoanDoubleCheck() : ""}${items.length ? cards : empty(t("noLoansYet"), t("noLoansBody"), "add-loan", t("addLoan"))}</div>`;
  }

  /* ---------- bills ---------- */
  function bills() {
    const items = (appData.bills || []).slice();
    const todayIso = today();
    const month = todayIso.slice(0, 7);
    const toMine = bill => (typeof toProfileCurrency === "function" ? toProfileCurrency(bill.amount, bill.currency) : Number(bill.amount || 0));
    const state = bill => {
      const paid = billPaidCurrentCycle(bill);
      const due = typeof BillPay !== "undefined" && BillPay.effectiveDueDate ? BillPay.effectiveDueDate(bill, todayIso) : bill.due;
      const days = daysUntil(due);
      return { paid, days, due, late: !paid && days != null && days < 0 };
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
    const rows = rowsData.map(({ bill, paid, days, due, late: isLate }) => {
      const emoji = BILL_EMOJI[bill.category] || BILL_EMOJI[bill.name] || "🧾";
      const tag = paid ? `✓ ${L("បង់ហើយ", "Paid")}` : isLate ? L(`ហួស ${-days} ថ្ងៃ`, `${-days}d late`) : days == null ? L("កត់ថាបង់", "Mark paid") : days === 0 ? L("ថ្ងៃនេះ", "Today") : L(`${days} ថ្ងៃ`, `${days}d`);
      const tone = paid ? "is-paid" : isLate ? "is-late" : days != null && days <= 3 ? "is-soon" : "is-due";
      const sub = paid && bill.lastPaidAt ? L(`បង់ ${dayLabel(bill.lastPaidAt)}`, `Paid ${dayLabel(bill.lastPaidAt)}`) : `${due ? dayLabel(due) : t("dueDate")} · ${optionLabel(bill.frequency || "Monthly")}`;
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
