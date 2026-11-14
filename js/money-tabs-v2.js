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
  function more(kind, item, name, extra = "") {
    const Kind = kind;
    return `<details class="mt-more"><summary aria-label="${escapeAttr(L("ជម្រើស", "Options"))}">⋯</summary><div class="mt-menu">${extra}
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
  // saving-card art (14 Nov): a piggy / jar that fills with the progress, a small pig for the total
  const svPig = (p, id) => { const y = Math.round(69 - 50 * Math.max(4, Math.min(100, p)) / 100); return `<svg class="sv-art" width="84" height="78" viewBox="0 0 84 78" aria-hidden="true"><defs><clipPath id="svpc${id}"><ellipse cx="40" cy="44" rx="32" ry="25"/></clipPath><linearGradient id="svpg${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9ec6"/><stop offset="1" stop-color="#e0488f"/></linearGradient></defs><ellipse cx="42" cy="73" rx="30" ry="3.5" fill="#e0488f" opacity=".18"/><ellipse cx="40" cy="44" rx="32" ry="25" fill="#e0488f" fill-opacity=".12"/><g clip-path="url(#svpc${id})"><g class="sv-fill"><rect x="0" y="${y}" width="84" height="50" fill="url(#svpg${id})"/><path class="sv-wave" d="M-40 ${y} q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V${y + 8} H-40Z" fill="#ff9ec6"/>${[[24, 15], [40, 12], [56, 16], [32, 25], [50, 27]].map(([cx, dy], k) => `<circle class="sv-cn c${k % 3}" cx="${cx}" cy="${y + dy}" r="6" fill="#ffd36b" stroke="#e0951f" stroke-width="1.4"/>`).join("")}</g></g><ellipse cx="40" cy="44" rx="32" ry="25" fill="none" stroke="#e0488f" stroke-opacity=".6" stroke-width="3"/><circle cx="68" cy="42" r="7" fill="#ff8fb0" stroke="#e0488f" stroke-opacity=".6" stroke-width="2"/><path d="M20 24l4 8 8-4z" fill="#ff8fb0"/><circle cx="54" cy="36" r="2.6" fill="#4a2a55"/><rect x="30" y="17" width="16" height="4" rx="2" fill="#4a2a55" opacity=".6"/><g class="sv-drop"><circle cx="40" cy="12" r="12" fill="#ffd36b" stroke="#e0951f" stroke-width="1.8"/><ellipse cx="40" cy="12" rx="6" ry="6" fill="none" stroke="#e0951f" stroke-width="1.6" opacity=".7"/></g></svg>`; };
  const svJar = (p, id) => { const y = Math.round(78 - 64 * Math.max(4, Math.min(100, p)) / 100); return `<svg class="sv-art" width="60" height="82" viewBox="0 0 60 82" aria-hidden="true"><defs><clipPath id="svjc${id}"><rect x="6" y="14" width="48" height="64" rx="12"/></clipPath></defs><rect x="14" y="4" width="32" height="9" rx="4" fill="#1f9d73" opacity=".55"/><rect x="6" y="14" width="48" height="64" rx="12" fill="#1f9d73" fill-opacity=".1"/><g clip-path="url(#svjc${id})"><g class="sv-fill"><rect x="0" y="${y}" width="60" height="70" fill="#34c79a"/><path class="sv-wave" d="M-40 ${y} q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V${y + 8} H-40Z" fill="#7fe3bf"/>${[[20, 12], [38, 10], [28, 24], [44, 26]].map(([cx, dy], k) => `<circle class="sv-cn c${k % 3}" cx="${cx}" cy="${y + dy}" r="6" fill="#ffd36b" stroke="#e0951f" stroke-width="1.4"/>`).join("")}</g></g><rect x="6" y="14" width="48" height="64" rx="12" fill="none" stroke="#1f9d73" stroke-opacity=".6" stroke-width="3"/><g class="sv-drop"><circle cx="30" cy="-2" r="6" fill="#ffd36b" stroke="#e0951f" stroke-width="1.4"/></g></svg>`; };
  const svTotalPig = '<svg class="sv-art" width="64" height="58" viewBox="0 0 64 58" aria-hidden="true"><ellipse cx="32" cy="54" rx="24" ry="3.5" fill="#000" opacity=".15"/><ellipse cx="32" cy="32" rx="25" ry="20" fill="#ffb3c8"/><circle cx="52" cy="30" r="6" fill="#ff8fb0"/><path d="M16 16l4 6 6-3z" fill="#ff8fb0"/><circle cx="42" cy="26" r="2.4" fill="#4a2a55"/><rect x="24" y="12" width="14" height="3.5" rx="1.7" fill="#4a2a55" opacity=".6"/><circle cx="32" cy="6" r="6" fill="#ffd36b" stroke="#e0951f" stroke-width="1.5"/></svg>';
  function savings() {
    const items = appData.savings || [];
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
    const totalPct = target > 0 ? Math.round(Math.min(100, total / target * 100)) : null;
    const head = items.length ? `<section class="sv-total">
      <div class="sv-trow">${svTotalPig}<div class="sv-tmain"><small>${escapeHtml(L(`សន្សំសរុប · ${items.length} គណនី`, `Saved in total · ${items.length} account${items.length === 1 ? "" : "s"}`))}${totalPct === null ? "" : ` · ${totalPct}%`}</small>
      <b class="sv-big">${money(total)}${target ? `<em> / ${money(target)}</em>` : ""}</b></div></div>
      ${planned ? `<div class="sv-month"><span>${escapeHtml(L("ខែនេះ", "This month"))}</span><span class="sv-month-bar"><i style="width:${Math.min(100, Math.round(doneAmount / planned * 100))}%"></i></span><b>${money(doneAmount)} / ${money(planned)}</b></div>` : ""}
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
      // joint account: me + partner each tick their own deposit (I tap both)
      const jointMember = item.jointWith ? (appData.family || []).find(member => member.id === item.jointWith) : null;
      const joint = Boolean(item.jointWith && (jointMember || item.jointName));
      const partnerName = joint ? String((jointMember?.name || item.jointName || "").trim().split(/\s+/)[0] || L("ដៃគូ", "Partner")) : "";
      const partnerMonthly = joint ? Number(item.partnerContribution || 0) : 0;
      const partnerPaid = Boolean(joint && contribution && contribution.partnerPaid);
      const partnerSaved = joint ? (Array.isArray(item.contributions) ? item.contributions : []).reduce((sum, entry) => sum + (entry && entry.partnerPaid ? Number(entry.partnerAmount || partnerMonthly || 0) : 0), 0) : 0;
      const meSaved = Math.max(0, Number(item.currentAmount || 0) - partnerSaved);
      const plain = value => String(money(value, item.currency)).replace(/<[^>]*>/g, "");
      const goldChi = transactions.filter(entry => ["gold", "gold-sale"].includes(entry.type)).reduce((sum, entry) => sum + Math.max(0, Number(entry.goldWeightGrams || 0)) * (entry.type === "gold-sale" ? -1 : 1) / 3.75, 0);
      const transactionHistory = transactions.slice(0, 5).map(entry => {
        const action = entry.type === "gold" ? L("ទិញមាស", "Gold purchase") : entry.type === "gold-sale" ? L("លក់មាស", "Gold sale") : entry.type === "investment" ? L("វិនិយោគ", "Investment / other use") : L("ចំណាយ", "Spending");
        const weightLabel = ["gold", "gold-sale"].includes(entry.type) ? (entry.goldChi && entry.goldChi !== "custom" ? `${numberForSavings(entry.goldChi, 2)} ជី` : entry.goldWeightGrams ? `${numberForSavings(entry.goldWeightGrams / 3.75, 2)} ជី` : "") : "";
        const detail = [entry.date || "", weightLabel, ["gold", "gold-sale"].includes(entry.type) ? entry.goldPurity || "24K" : entry.type === "spend" && entry.category ? optionLabel(entry.category) : "", entry.note || ""].filter(Boolean).join(" · ");
        const historyAmount = entry.type === "gold-sale" ? Number(entry.netProceeds ?? (Number(entry.amount || 0) - Number(entry.fees || 0))) : Number(entry.totalDebit ?? (Number(entry.amount || 0) + Number(entry.fees || 0)));
        return `<div class="sv-use-history-row"><span><b>${escapeHtml(action)}</b><small>${escapeHtml(detail)}</small></span><strong class="${entry.type === "gold-sale" ? "is-credit" : ""}">${entry.type === "gold-sale" ? "+" : "−"}${money(historyAmount, entry.currency || item.currency)}</strong>${entry.type === "gold" ? `<button type="button" class="sv-tx-delete" data-remove-gold-purchase="${escapeAttr(entry.id)}" data-saving-id="${escapeAttr(item.id)}" aria-label="${escapeAttr(L("លុបការទិញមាស", "Remove gold purchase"))}" title="${escapeAttr(L("លុបការទិញសាកល្បង", "Remove test purchase"))}">×</button>` : ""}</div>`;
      }).join("");
      const behind = !reached && !late && typeof SmartMoney !== "undefined" && SmartMoney.savingsBehind && SmartMoney.savingsBehind(item);
      const status = reached ? ["is-ok", L("សម្រេចហើយ 🎉", "Reached 🎉")] : late ? ["is-late", L("ហួសថ្ងៃ", "Overdue")] : behind ? ["is-behind", L("យឺតបន្តិច", "Behind")] : ["is-ok", L("ទាន់ពេល", "On track")];
      return `<section class="mt-card sv-card sv-has-art${joint ? " is-joint" : ""}${late ? " is-late" : ""}" data-mt-row>
        <div class="mt-head"><span class="mt-ic" style="--c:${color}">${jar}</span><span class="sv-title"><b>${escapeHtml(item.name || t("savings"))}</b></span><span class="sv-status ${status[0]}">${escapeHtml(status[1])}</span>${more("savings", item, "", `<button type="button" data-sv-hist aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg><span>${escapeHtml(L("ប្រវត្តិ", "History"))}</span></button>`)}</div>
        ${item.notes ? `<p class="sv-note">${escapeHtml(item.notes)}</p>` : ""}
        <div class="sv-artrow">${joint ? svJar(p, index) : svPig(p, index)}<div class="sv-amt"><b>${money(item.currentAmount, item.currency)}</b>${Number(item.targetAmount || 0) ? `<span>/ ${money(item.targetAmount, item.currency)}</span>` : ""}</div></div>
        ${Number(item.targetAmount || 0) ? (joint ? `<div class="sv-bar sv-bar-joint"><i style="width:${Math.min(100, meSaved / Number(item.targetAmount) * 100)}%"></i><i class="is-pt" style="width:${Math.min(100, partnerSaved / Number(item.targetAmount) * 100)}%"></i></div>` : `<div class="sv-bar"><i style="width:${Math.max(p, 2)}%"></i></div>`) : ""}
        <div class="sv-info${joint ? " is-joint" : ""}">${joint ? `<div><small>${escapeHtml(L("ខ្ញុំ", "Me"))} · ${escapeHtml(plain(monthly))}${escapeHtml(L("/ខែ", "/mo"))}</small><b>${money(meSaved, item.currency)}</b></div><div><small>${escapeHtml(partnerName)} · ${escapeHtml(plain(partnerMonthly))}${escapeHtml(L("/ខែ", "/mo"))}</small><b>${money(partnerSaved, item.currency)}</b></div>` : `${item.deadline ? `<div><small>${escapeHtml(L("ថ្ងៃកំណត់", "Deadline"))}</small><b>${escapeHtml(dayLabel(item.deadline, true))}</b></div>` : ""}<div><small>${escapeHtml(L("សន្សំ/ខែ", "Per month"))}</small><b>${escapeHtml(plain(monthly))}</b></div>${goldChi ? `<div><small>${escapeHtml(L("មាស", "Gold"))}</small><b>${numberForSavings(goldChi, 2)} ${escapeHtml(L("ជី", "Chi"))}</b></div>` : ""}`}</div>
        ${reserve ? `<p class="sv-reserve">${escapeHtml(L("អាចប្រើ", "Available"))} <b>${money(available, item.currency)}</b> · ${escapeHtml(L("បម្រុង", "Reserved"))} ${money(reserve, item.currency)}</p>` : ""}
        ${(() => { const need = !reached && (late || behind) && typeof SmartMoney !== "undefined" && SmartMoney.savingsNeed ? SmartMoney.savingsNeed(item) : null; return late ? `<p class="sv-tip is-late">${escapeHtml(L("ហួសថ្ងៃ · កែថ្ងៃ ឬដាក់បន្ថែម", "Past the deadline · edit the date or add more"))}</p>` : need ? `<p class="sv-tip">${escapeHtml(L(`ត្រូវ ${String(money(need, item.currency)).replace(/<[^>]*>/g, "")}/ខែ ទើបទាន់`, `Save ${String(money(need, item.currency)).replace(/<[^>]*>/g, "")}/mo to make it`))}</p>` : ""; })()}
        <div class="sv-actions">
          ${joint ? `<label class="sv-save sv-pay${paid ? " is-done" : ""}"><input type="checkbox" data-savings-contribution="${escapeAttr(item.id)}" data-savings-joint="1" data-savings-month="${escapeAttr(month)}" ${paid ? "checked" : ""}><span><i class="sv-pav">${appData.profile?.photo ? `<img src="${escapeAttr(appData.profile.photo)}" alt="">` : escapeHtml(String(appData.profile?.name || L("ខ", "M")).trim().slice(0, 1).toUpperCase())}</i>${paid ? `✓ ${escapeHtml(L("ខ្ញុំ", "Me"))} ${escapeHtml(plain(Number(contribution.amount || 0)))}` : `＋ ${escapeHtml(L("ខ្ញុំ", "Me"))}`}</span></label>
          <label class="sv-save sv-pay is-pt${partnerPaid ? " is-done" : ""}"><input type="checkbox" data-savings-contribution="${escapeAttr(item.id)}" data-savings-who="partner" data-savings-joint="1" data-savings-month="${escapeAttr(month)}" ${partnerPaid ? "checked" : ""}><span><i class="sv-pav">${jointMember?.photo ? `<img src="${escapeAttr(jointMember.photo)}" alt="">` : escapeHtml(partnerName.slice(0, 1).toUpperCase())}</i>${partnerPaid ? `✓ ${escapeHtml(partnerName)} ${escapeHtml(plain(Number(contribution.partnerAmount || 0)))}` : `＋ ${escapeHtml(partnerName)}`}</span></label>` : `<label class="sv-save${paid ? " is-done" : ""}"><input type="checkbox" data-savings-contribution="${escapeAttr(item.id)}" data-savings-month="${escapeAttr(month)}" ${paid ? "checked" : ""}><span>${paid ? `✓ ${escapeHtml(L(`ខែនេះរួច`, `Saved for ${monthLabel(month)}`))}` : `＋ ${escapeHtml(L(`ដាក់ ${String(money(monthly, item.currency)).replace(/<[^>]*>/g, "")}`, `Save ${String(money(monthly, item.currency)).replace(/<[^>]*>/g, "")} this month`))}`}</span></label>`}
          <button type="button" class="sv-use-btn" data-use-savings="${escapeAttr(item.id)}" title="${escapeAttr(L("ប្រើប្រាក់ ឬទិញមាស", "Use savings or buy gold"))}" ${available <= 0 ? "disabled" : ""}>${escapeHtml(L("ប្រើប្រាក់", "Use"))}</button>
        </div>
        <div class="sv-hist" hidden>${history.length ? `<small class="sv-hist-label">${escapeHtml(L("ប្រចាំខែ", "Monthly savings"))}</small>${history.map(entry => joint ? `<div class="sv-hist-joint"><span>${escapeHtml(monthLabel(entry.month))}</span><span class="sv-jchips"><i class="${entry.paid ? "ok" : ""}">${escapeHtml(L("ខ្ញុំ", "Me"))} ${entry.paid ? `✓ ${escapeHtml(plain(Number(entry.amount || monthly || 0)))}` : "—"}</i><i class="${entry.partnerPaid ? "ok" : ""}">${escapeHtml(partnerName)} ${entry.partnerPaid ? `✓ ${escapeHtml(plain(Number(entry.partnerAmount || partnerMonthly || 0)))}` : "—"}</i></span></div>` : `<div class="${entry.paid ? "is-paid" : ""}"><span>${escapeHtml(monthLabel(entry.month))}</span><b>${entry.paid ? "✓ " : ""}${money(Number(entry.amount || item.monthlyContribution || 0), item.currency)}</b></div>`).join("")}` : ""}${transactionHistory ? `<small class="sv-hist-label">${escapeHtml(L("បានប្រើ", "Savings used"))}</small>${transactionHistory}` : ""}${!history.length && !transactionHistory ? `<p>${escapeHtml(L("គ្មានប្រវត្តិ", "No history yet"))}</p>` : ""}</div>
      </section>`;
    }).join("");
    const goldBuys = goldTransactions.filter(tx => tx.type === "gold");
    const lastBuy = goldBuys.map(tx => tx.date || "").filter(Boolean).sort().at(-1) || "";
    const goldPct = goldProfitLoss !== null && totalInvested > 0 ? goldProfitLoss / totalInvested * 100 : null;
    const goldTrend = typeof SavingsMarket !== "undefined" && SavingsMarket.trend ? SavingsMarket.trend(30) : null;
    const goldMood = goldProfitLoss === null ? "calm" : goldProfitLoss >= 0 ? "proud" : "worry";
    const goldSay = goldProfitLoss === null ? L("កំពុងមើលតម្លៃមាស… 🪙", "Checking the gold price… one sec 🪙")
      : goldProfitLoss >= 0 ? (goldTrend !== null && goldTrend > 0 ? L(`មាសឡើង ${numberForSavings(goldTrend, 1)}% ✨ ចំណេញ ${plainMoney(goldProfitLoss)}!`, `Gold is up ${numberForSavings(goldTrend, 1)}% in 30 days ✨ You're ${plainMoney(goldProfitLoss)} ahead!`) : L(`ចំណេញ ${plainMoney(goldProfitLoss)} ✨ ល្អណាស់!`, `Your gold is ${plainMoney(goldProfitLoss)} ahead ✨ Nice keep!`))
      : L(`ធ្លាក់ ${plainMoney(Math.abs(goldProfitLoss))} · មាសទុកយូរ កុំបារម្ភ 💜`, `Price dipped a little (${plainMoney(Math.abs(goldProfitLoss))}) · gold is a long-term keep 💜`);
    const GI = {
      up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16l6-6 4 4 6-6"/></svg>',
      down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8l6 6 4-4 6 6"/></svg>',
      plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
      swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
      bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/></svg>',
      list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>'
    };
    const goldNomi = typeof HomeV2 !== "undefined" && HomeV2.buddy ? `<span class="svg-nomi" data-nomi data-mood="${goldMood}" role="button" tabindex="0" aria-label="Nomi">${HomeV2.role ? HomeV2.role("save", goldMood) : HomeV2.buddy(goldMood)}<i class="svg-coin" aria-hidden="true"></i></span>` : "";
    const goldPortfolio = typeof SavingsMarket !== "undefined" && SavingsMarket.line ? `<section class="sv-gold-portfolio svg-hero" data-gold-hero>
      <div class="svg-row">${goldNomi}<div class="svg-main"><small>${escapeHtml(L("មាសរបស់ខ្ញុំ", "My gold"))}</small><strong class="is-worth">${goldTransactions.length ? (currentInvestmentValue === null ? "—" : money(currentInvestmentValue)) : `${numberForSavings(Math.max(0, ownedGoldChi), 2)} <span>${escapeHtml(L("ជី", "Chi"))}</span>`}</strong>${goldTransactions.length ? `<small class="svg-chi">${numberForSavings(Math.max(0, ownedGoldChi), 2)} ${escapeHtml(L("ជី", "Chi"))}</small>` : ""}</div>${goldTransactions.length ? `<div class="svg-worth">${goldProfitLoss === null ? "" : `<em class="svg-gain ${goldProfitLoss < 0 ? "is-down" : "is-up"}">${goldProfitLoss < 0 ? "−" : "+"}${money(Math.abs(goldProfitLoss))}${goldPct === null ? "" : ` · ${numberForSavings(Math.abs(goldPct), 1)}%`}</em>`}</div>` : `<div class="svg-worth"><small>${escapeHtml(L("មិនទាន់មានមាស", "No gold yet"))}</small></div>`}<p class="svg-say" data-gold-say>${escapeHtml(goldSay)}</p></div>
      ${SavingsMarket.line()}
      <div class="svg-acts"><button type="button" class="svg-btn is-primary" data-buy-gold>${GI.plus}${escapeHtml(L("ទិញ", "Buy"))}</button>${ownedGoldChi > 0 ? `<button type="button" class="svg-btn" data-sell-gold>${GI.swap}${escapeHtml(L("លក់", "Sell"))}</button>` : ""}${goldTransactions.length ? `<button type="button" class="svg-btn is-icon" data-gold-hist aria-expanded="false" aria-label="${escapeAttr(L("ប្រវត្តិមាស", "Gold history"))}">${GI.list}</button>` : ""}<button type="button" class="svg-btn is-icon" data-gold-alerts aria-label="${escapeAttr(L("ជូនដំណឹងតម្លៃ", "Price alerts"))}">${GI.bell}</button></div>
      ${goldTransactions.length ? `<div class="svg-hist" hidden><div class="svg-tiles"><div><small>${escapeHtml(L("ដើមទុន", "Paid"))}</small><b>${money(totalInvested)}</b></div><div><small>${escapeHtml(L("ទិញចុងក្រោយ", "Last buy"))}</small><b>${lastBuy ? escapeHtml(dayLabel(lastBuy, false)) : "—"}</b></div></div><div class="sv-holding-list">${holdingRows}</div><small class="sv-gold-source">${escapeHtml(L("តម្លៃប៉ាន់ស្មាន · ហាងអាចខុស", "Spot estimate · shop prices may differ"))}</small></div>` : ""}
    </section>` : "";
    return `${head}${goldPortfolio}${sec(L("គណនីសន្សំ", "Savings accounts"), items.length, "add-savings")}${items.length ? cards : empty(t("noSavingsYet"), t("noSavingsBody"), "add-savings", t("addSavings"))}`;
  }
  const plainMoney = value => String(money(value)).replace(/<[^>]*>/g, "");
  document.addEventListener("click", event => {
    const goldHist = event.target.closest("[data-gold-hist]");
    if (goldHist) {
      const panel = goldHist.closest("[data-gold-hero]")?.querySelector(".svg-hist");
      if (panel) { panel.hidden = !panel.hidden; goldHist.setAttribute("aria-expanded", String(!panel.hidden)); goldHist.classList.toggle("on", !panel.hidden); }
      return;
    }
    const goldNomi = event.target.closest("[data-gold-hero] [data-nomi]");
    if (goldNomi) { goldNomi.closest("[data-gold-hero]").classList.toggle("is-talk"); return; }
    const button = event.target.closest("[data-sv-hist]");
    if (!button) return;
    button.closest("details.mt-more")?.removeAttribute("open");
    const panel = button.closest(".sv-card")?.querySelector(".sv-hist");
    if (!panel) return;
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    button.classList.toggle("on", !panel.hidden);
  });

  /* ---------- loans ---------- */
  // every month of the loan: past months from the schedule, then the months still to pay
  function loanMonths(loan, schedule, remaining) {
    const list = schedule.map(item => ({ ...item }));
    const monthly = Number(loan.monthlyPayment || 0);
    const first = parseAppDate(loan.firstPaymentDate || loan.startDate);
    if (!monthly || Number.isNaN(first.getTime())) return list;
    const unpaidPast = list.filter(item => !item.paid).length;
    const totalMonths = Number(loan.durationMonths || 0) || (list.length + Math.max(0, Math.ceil(remaining / monthly) - unpaidPast));
    for (let index = list.length; index < Math.min(totalMonths, 600); index += 1) {
      list.push({ date: toDateInput(addMonths(first, index)), amount: monthly, paid: false, future: true });
    }
    return list;
  }
  function dots(months, next) {
    const step = Math.ceil(months.length / 120);
    let html = "";
    for (let index = 0; index < months.length; index += step) {
      const group = months.slice(index, index + step);
      const cls = group.every(item => item.paid) ? "on" : group.some(item => item.date === next) ? "now" : group.some(item => !item.paid && !item.future && item.date < today()) ? "late" : "";
      html += `<i class="${cls}"></i>`;
    }
    return html;
  }

  // 📋 payment schedule as a bottom sheet (same tick = same toggleLoanScheduledPayment as before)
  let sheetTab = "all";
  function sheetHtml(loan) {
    const remaining = loanRemaining(loan);
    const schedule = loanPaymentScheduleToCurrent(loan);
    const months = loanMonths(loan, schedule, remaining);
    const next = nextLoanPaymentDate(loan);
    const cur = loan.currency;
    const paidRows = months.filter(item => item.paid);
    const late = months.filter(item => !item.paid && !item.future && item.date < today() && item.date !== next);
    const nextRow = next && remaining > 0 ? (months.find(item => item.date === next) || { date: next, amount: Number(loan.monthlyPayment || 0) }) : null;
    const future = months.filter(item => item.future && item.date !== next);
    const sum = list => list.reduce((total, item) => total + Number(item.amount || 0), 0);
    const nd = daysUntil(next);
    const canTick = item => daysUntil(item.date) <= 1; // the tick shows from 1 day before the payment day (no paying far ahead)
    const row = (item, kind) => {
      const tick = kind === "paid" || kind === "late" || (kind === "next" && canTick(item));
      const d = daysUntil(item.date);
      const sub = kind === "paid" ? L("បានបង់", "Paid") : kind === "next" ? `${L("បង់លើកក្រោយ", "Next payment")}${d != null && d >= 0 ? ` · ${inDays(d)}` : ""}${tick ? L(" · ចុច ✓ ពេលបង់រួច", " · tick when paid") : ""}` : kind === "late" ? L(`ហួស ${-d} ថ្ងៃ · ចុច ✓ ពេលបង់រួច`, `${-d} days late · tick when paid`) : L("មិនទាន់ដល់", "Not yet due");
      const [y, m, dd] = item.date.split("-").map(Number);
      const tile = `<i class="lb-st"><b>${kind === "late" ? "!" : dd}</b><small>${escapeHtml(km() ? KM_M[m - 1] : new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" }))}</small></i>`;
      return `<div class="lb-row is-${kind}">${tile}<span class="lb-t"><b>${escapeHtml(dayLabel(item.date, true))}</b><small>${escapeHtml(sub)}</small></span><b class="lb-amt">${money(item.amount, cur)}</b>${tick ? `<label class="lb-ck" aria-label="${escapeAttr(L("បានបង់", "Paid"))}"><input type="checkbox" data-lb-tick="${escapeAttr(loan.id)}" data-payment-date="${escapeAttr(item.date)}" ${item.paid ? "checked" : ""}><span></span></label>` : ""}</div>`;
    };
    const section = (title, icon, kind, list, limit, open) => {
      if (!list.length) return "";
      const years = [];
      list.forEach(item => { const yr = item.date.slice(0, 4); let g = years.find(x => x.y === yr); if (!g) years.push(g = { y: yr, items: [] }); g.items.push(item); });
      let shown = 0;
      const inner = years.map(g => {
        const hideYear = shown >= limit;
        const rows = g.items.map(item => `<div class="lb-wrap${shown++ >= limit ? " lb-hide" : ""}">${row(item, kind)}</div>`).join("");
        return `${years.length > 1 || kind !== "late" ? `<div class="lb-yr lb-wrap${hideYear ? " lb-hide" : ""}"><b>${g.y}</b><span>${g.items.length} ${escapeHtml(L("ដង", "×"))} · ${money(sum(g.items), cur)}</span></div>` : ""}${rows}`;
      }).join("");
      const more = list.length > limit ? `<button type="button" class="lb-more" data-lb-more>${escapeHtml(L(`មើល ${list.length - limit} ទៀត ▾`, `Show ${list.length - limit} more ▾`))}</button>` : "";
      return `<section class="lb-sec is-${kind}"><div class="lb-h"><span>${icon} ${escapeHtml(title)}</span><em>${list.length} · ${money(sum(list), cur)}</em></div><div class="lb-box">${inner}${more}</div></section>`;
    };
    const show = kind => sheetTab === "all" || (sheetTab === "paid" ? kind === "paid" : kind !== "paid");
    const ended = !nextRow && !future.length && remaining > 0;
    const body = [
      show("late") && late.length ? section(L("ហួសថ្ងៃ", "Late"), "⚠️", "late", late.slice().reverse(), 99) : "",
      show("next") && nextRow ? `<section class="lb-sec is-next"><div class="lb-h"><span>📅 ${escapeHtml(L("បង់លើកក្រោយ", "Next payment"))}</span></div><div class="lb-box">${row(nextRow, "next")}</div></section>` : "",
      show("paid") && paidRows.length ? section(L("បានបង់", "Paid"), "✅", "paid", paidRows.slice().reverse(), 3) : "",
      show("soon") && future.length ? section(L("ខាងមុខ", "Coming up"), "🗓️", "soon", future, 3) : ""
    ].join("") || `<p class="lb-empty">${escapeHtml(L("មិនមានអ្វីនៅទីនេះទេ", "Nothing here"))}</p>`;
    return `<div class="modal lb-sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(t("paymentSchedule"))}">
      <div class="lb-grab" aria-hidden="true"></div>
      <div class="lb-top"><span><b>📋 ${escapeHtml(t("paymentSchedule"))}</b><small>${escapeHtml(loan.name || "")} · ${money(loan.monthlyPayment, cur)} / ${escapeHtml(L("ខែ", "month"))}</small></span><button type="button" class="icon-button" data-close aria-label="Close">${Icons.close()}</button></div>
      <div class="lb-sum"><div><small>${escapeHtml(L("បានបង់", "Paid"))}</small><b>${paidRows.length} ${escapeHtml(L("ដង", "times"))}</b><span>${money(loanPaid(loan), cur)}</span></div><div><small>${escapeHtml(t("remaining"))}</small><b>${months.length - paidRows.length} ${escapeHtml(L("ដង", "times"))}</b><span>${money(remaining, cur)}</span></div></div>
      ${ended ? `<p class="lb-warn">⚠️ ${escapeHtml(L(`រយៈពេលកម្ចីចប់ហើយ តែនៅសល់ ${money(remaining, cur)}។ សូមពិនិត្យ រយៈពេល/ថ្ងៃកំណត់ ក្នុង "កែកម្ចី"។`, `The loan term has ended but ${money(remaining, cur)} is left. Check the months / due date in Edit loan.`))}</p>` : ""}
      <div class="lb-tabs">${[["all", L("ទាំងអស់", "All")], ["todo", L("មិនទាន់បង់", "Unpaid")], ["paid", L("បានបង់", "Paid")]].map(([key, label]) => `<button type="button" data-lb-tab="${key}" class="${sheetTab === key ? "on" : ""}">${escapeHtml(label)}</button>`).join("")}</div>
      <div class="lb-list">${body}</div>
    </div>`;
  }
  function openSheet(id) {
    const loan = (appData.loans || []).find(item => item.id === id);
    const root = document.getElementById("modalRoot");
    if (!loan || !root) return;
    const paint = () => {
      const fresh = (appData.loans || []).find(item => item.id === id);
      if (!fresh) return Modal.close();
      const scroll = root.querySelector(".lb-list")?.scrollTop || 0;
      root.innerHTML = sheetHtml(fresh);
      const list = root.querySelector(".lb-list");
      if (list) list.scrollTop = scroll;
      root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));
      root.querySelectorAll("[data-lb-tab]").forEach(button => button.addEventListener("click", () => { sheetTab = button.dataset.lbTab; paint(); }));
      root.querySelectorAll("[data-lb-more]").forEach(button => button.addEventListener("click", () => {
        button.closest(".lb-box")?.querySelectorAll(".lb-hide").forEach(el => el.classList.remove("lb-hide"));
        button.remove();
      }));
      root.querySelectorAll("[data-lb-tick]").forEach(input => input.addEventListener("change", () => {
        input.dataset.loanSchedule = input.dataset.lbTick;
        toggleLoanScheduledPayment(input);
        paint();
      }));
    };
    sheetTab = "all";
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.className = "modal-root open";
    paint();
  }
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
      const paidCount = schedule.filter(item => item.paid).length;
      const months = loanMonths(loan, schedule, remaining);
      const left = Math.max(0, months.length - paidCount);
      const payDay = loanDisplayPaymentDay(loan);
      const interest = Math.max(0, loanPayoffAmount(loan) - Number(loan.originalAmount || 0));
      const ended = loan.dueDate && loan.dueDate < today() && remaining > 0;
      const sub = [loan.durationMonths ? `${loan.durationMonths} ${t("months")}` : L("កម្ចីប្រចាំខែ", "Monthly loan"), payDay ? L(`បង់ថ្ងៃទី ${payDay}`, `pays on day ${payDay}`) : ""].filter(Boolean).join(" · ");
      // F · "road home": Nimo walks the paid share of the loan; next payment is a ticket with the pay button
      const walk = Math.min(94, Math.max(6, p));
      const [ny, nm, nd2] = (next || "").split("-").map(Number);
      const startLabel = monthLabel(loan.firstPaymentDate || loan.startDate);
      const nextBlock = next && remaining > 0
        ? `<div class="mt-lf-tk"><span class="mt-lf-cal"><small>${escapeHtml(km() ? KM_M[nm - 1] : new Date(ny, nm - 1, 1).toLocaleDateString("en-US", { month: "short" }))}</small><b>${nd2}</b></span><span class="mt-lf-t"><b>${money(loan.monthlyPayment, loan.currency)}</b><small>${escapeHtml(L("បង់លើកក្រោយ", "Next payment"))}${nextDays != null && nextDays >= 0 ? ` · ${escapeHtml(inDays(nextDays))}` : ""}</small></span><button type="button" class="mt-lf-pay" data-payment-loan="${escapeAttr(loan.id)}">＋ ${escapeHtml(L("បង់", "Pay"))}</button></div>`
        : `<div class="mt-lf-tk"><span class="mt-lf-cal is-done"><small>✓</small><b>🏠</b></span><span class="mt-lf-t"><b>${escapeHtml(remaining > 0 ? L("គ្មានថ្ងៃបង់ខាងមុខ", "No payment scheduled") : L("បង់រួចហើយ!", "Paid off!"))}</b><small>${escapeHtml(remaining > 0 ? L("ពិនិត្យរយៈពេលក្នុង “កែកម្ចី”", "Check the months in Edit loan") : L("អបអរសាទរ 🎉", "Congrats 🎉"))}</small></span><button type="button" class="mt-lf-pay" data-payment-loan="${escapeAttr(loan.id)}">＋ ${escapeHtml(L("បង់", "Pay"))}</button></div>`;
      return `<section class="mt-card mt-loan mt-lf" data-mt-row>
        <div class="mt-lf-top">
          <div class="mt-head"><span class="mt-ic" style="--c:#7b68ee">🏦</span><span class="mt-lb-name"><b>${escapeHtml(loan.name || t("loan"))}</b><small>${escapeHtml(sub)}</small></span>${more("loan", loan)}</div>
          <small class="mt-lf-k">${escapeHtml(t("remaining"))}</small>
          <div class="mt-lf-amt">${money(remaining, loan.currency)}</div>
          <small class="mt-lf-of">${L(`បានបង់ ${money(paid, loan.currency)} ក្នុងចំណោម ${money(total, loan.currency)}`, `Paid ${money(paid, loan.currency)} of ${money(total, loan.currency)}`)}</small>
          <div class="mt-lf-road" aria-label="${escapeAttr(`${p}% ${t("paid")}`)}">
            <i class="mt-lf-track"></i><i class="mt-lf-done" style="width:${p}%"></i>
            <span class="mt-lf-cat" style="left:${walk}%"><em>🐱 ${p}%</em><i></i></span>
            <span class="mt-lf-home">🏠</span>
          </div>
          <div class="mt-lf-lbl"><span>${escapeHtml(startLabel || "")}</span><span>${months.length ? escapeHtml(L(`${paidCount} / ${months.length} ខែ`, `${paidCount} / ${months.length} months`)) : ""}</span><span>${escapeHtml(L("បង់រួច", "Paid off"))}</span></div>
          <div class="mt-lf-facts">
            <div><small>${escapeHtml(L("ប្រចាំខែ", "Monthly"))}</small><b>${money(loan.monthlyPayment, loan.currency)}</b></div>
            <div><small>${escapeHtml(t("interest"))}</small><b>${Number(loan.interestRate || 0)}%</b></div>
            <div class="${ended ? "is-warn" : ""}"><small>${escapeHtml(L("បញ្ចប់", "Ends"))}</small><b>${loan.dueDate ? `${ended ? "⚠️ " : ""}${escapeHtml(monthLabel(loan.dueDate))}` : "—"}</b></div>
          </div>
        </div>
        <div class="mt-lf-ticket">
          ${nextBlock}
          <div class="mt-lf-foot">
            <button type="button" data-lb-info="${escapeAttr(loan.id)}" aria-expanded="false">ⓘ ${escapeHtml(L("ព័ត៌មាន", "Details"))}</button>
            <button type="button" data-lb-sheet="${escapeAttr(loan.id)}">📋 ${escapeHtml(L("បញ្ជីបង់", "Schedule"))}${schedule.length ? ` <em>${paidCount}/${schedule.length}</em>` : ""}</button>
          </div>
          <div class="mt-kv mt-lb-info" hidden>
            <div><small>${escapeHtml(t("original"))}</small><b>${money(loan.originalAmount, loan.currency)}</b></div>
            <div><small>${escapeHtml(t("firstPaymentDate"))}</small><b>${escapeHtml(dayLabel(loan.firstPaymentDate || loan.startDate, true) || "—")}</b></div>
            <div><small>${escapeHtml(t("totalInterest"))}</small><b>${money(interest, loan.currency)}</b></div>
            <div><small>${escapeHtml(t("dueDate"))}</small><b>${escapeHtml(dayLabel(loan.dueDate, true) || "—")}</b></div>
          </div>
        </div>
      </section>`;
    }).join("");
    const nomiSay = L("ខ្ញុំនៅទីនេះជួយអ្នកតាមដានកម្ចី 🐾", "I’m here to help you keep loans on track 🐾");
    const intro = typeof HomeV2 !== "undefined" && HomeV2.buddy ? `<div class="mt-loan-talk"><span class="mt-loan-nomi" data-nomi data-mood="happy" role="button" tabindex="0" aria-label="Nomi">${HomeV2.role ? HomeV2.role("bill") : HomeV2.buddy("happy")}</span><span class="mt-loan-say" data-nomi-say>${escapeHtml(nomiSay)}</span></div>` : "";
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
    const sheetButton = event.target.closest(".fv2-page [data-lb-sheet]");
    if (sheetButton) { openSheet(sheetButton.dataset.lbSheet); return; }
    const infoButton = event.target.closest(".fv2-page [data-lb-info]");
    if (infoButton) {
      const panel = infoButton.closest("[data-mt-row]")?.querySelector(".mt-lb-info");
      if (panel) { panel.hidden = !panel.hidden; infoButton.setAttribute("aria-expanded", String(!panel.hidden)); infoButton.classList.toggle("on", !panel.hidden); }
      return;
    }
    const open = event.target.closest(".mt-more");
    document.querySelectorAll(".mt-more[open]").forEach(menu => { if (menu !== open) menu.open = false; });
    const row = event.target.closest(".fv2-page [data-mt-row]");
    if (!row || event.target.closest("button, a, input, label, summary, details, .mt-menu")) return;
    row.querySelector(".mt-menu [data-edit-income], .mt-menu [data-edit-savings], .mt-menu [data-edit-loan], .mt-menu [data-edit-bill]")?.click();
  });

  return { render, openSheet };
})();
