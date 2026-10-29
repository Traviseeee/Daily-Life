/* MYLIFE Expenses V2 (#money/expenses, draft 29 Oct 2026): minimal and easy to check.
 *  - top card: month, total / budget, what's left, one stacked bar by category
 *  - tabs: "By category" (default; one line per category with its budget bar,
 *    tap = that category's list by day) and "By day" (a bank-statement list with
 *    category chips to filter)
 *  - riel amounts show "≈ $" under them; no ✎ 🗑 buttons — tap a row to edit,
 *    delete is inside ⋯. Budgets stay in profile.categoryBudgets (SmartMoney binds the inputs).
 * Hooks kept for bindMoney(): data-expense-month, data-action="add-expense",
 * data-edit-expense, data-delete-expense, data-budget-category, data-budget-alerts. */
const ExpensesV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const state = { view: "cat", cat: "", chip: "" };
  const cur = () => appData.profile.currency || "USD";
  const amt = item => toProfileCurrency(item.amount, item.currency);
  const colorOf = c => expenseCategoryColors[c] || "#8a94a6";
  const icon = c => Icons[expenseCategoryIcons[c] || "expense"]();
  const budgets = () => (appData.profile.categoryBudgets && typeof appData.profile.categoryBudgets === "object" ? appData.profile.categoryBudgets : {});

  function monthName(key) {
    const [y, m] = key.split("-").map(Number);
    return km() ? `${KM_M[m - 1]} ${y}` : new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  function dayName(iso) {
    const today = localDateInput();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const [, m, d] = iso.split("-").map(Number);
    const base = km() ? `${d} ${KM_M[m - 1]}` : new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short" });
    if (iso === today) return `${L("ថ្ងៃនេះ", "Today")} · ${base}`;
    if (iso === localDateInput(y)) return `${L("ម្សិលមិញ", "Yesterday")} · ${base}`;
    return base;
  }
  // "-9,900៛" with "≈ $2.48" under it when it isn't the profile currency
  function amountHtml(item) {
    const own = item.currency && item.currency !== cur();
    return `<span class="ev-am"><b>-${money(item.amount, item.currency || cur())}</b>${own ? `<small>≈ ${money(amt(item))}</small>` : ""}</span>`;
  }
  function row(item, withIcon) {
    const group = expenseGroupOf(item);
    const name = expenseName(item) || optionLabel(item.category || "Other");
    const method = String(item.method || "").trim();
    return `<div class="ev-row" data-ev-row style="--cat:${colorOf(group)}">
      ${withIcon ? `<span class="ev-ic">${icon(group)}</span>` : `<span class="ev-dot"></span>`}
      <span class="ev-tx"><b>${escapeHtml(name)}</b>${method ? `<small>${escapeHtml(method)}</small>` : ""}</span>
      ${amountHtml(item)}
      <details class="mt-more ev-more"><summary aria-label="${escapeAttr(L("ជម្រើស", "Options"))}">⋯</summary><div class="mt-menu">
        <button type="button" data-edit-expense="${escapeAttr(item.id)}">${Icons.edit()}<span>${escapeHtml(t("edit"))}</span></button>
        <button type="button" class="is-danger" data-delete-expense="${escapeAttr(item.id)}">${Icons.trash()}<span>${escapeHtml(t("delete"))}</span></button>
      </div></details>
    </div>`;
  }
  function byDay(items, withIcon) {
    const days = new Map();
    items.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .forEach(item => { const key = item.date || ""; if (!days.has(key)) days.set(key, []); days.get(key).push(item); });
    return [...days.entries()].map(([day, list]) => `<div class="ev-day"><span>${escapeHtml(day ? dayName(day) : "—")}</span><span>-${money(list.reduce((s, i) => s + amt(i), 0))}</span></div>
      <section class="ev-card ev-list">${list.map(item => row(item, withIcon)).join("")}</section>`).join("");
  }

  function render() {
    const all = appData.expenses || [];
    const current = localDateInput().slice(0, 7);
    const months = [...new Set(all.map(item => String(item.date || "").slice(0, 7)).filter(Boolean))].sort().reverse();
    if (!months.includes(current)) months.unshift(current);
    if (expenseMonthFilter && expenseMonthFilter !== "all" && !months.includes(expenseMonthFilter)) expenseMonthFilter = "";
    const month = expenseMonthFilter || current;
    const items = month === "all" ? all : all.filter(item => String(item.date || "").startsWith(month));
    const isNow = month === current;
    const total = items.reduce((s, i) => s + amt(i), 0);

    const cats = {};
    items.forEach(item => { const c = expenseGroupOf(item); (cats[c] = cats[c] || { c, total: 0, n: 0 }); cats[c].total += amt(item); cats[c].n += 1; });
    const b = budgets();
    if (isNow) expenseCategories.forEach(c => { if (Number(b[c]) > 0 && !cats[c]) cats[c] = { c, total: 0, n: 0 }; });
    const list = Object.values(cats).sort((x, y) => y.total - x.total);
    const budgetTotal = isNow ? expenseCategories.reduce((s, c) => s + (Number(b[c]) || 0), 0) : 0;
    if (state.cat && !cats[state.cat]) state.cat = "";
    if (state.chip && !cats[state.chip]) state.chip = "";

    const daysLeft = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate(); })();
    const sub = [
      `${items.length} ${L("ចំណាយ", "expenses")}`,
      budgetTotal ? (budgetTotal - total >= 0 ? `${L("នៅសល់", "left")} ${money(budgetTotal - total)}` : `${L("លើស", "over")} ${money(total - budgetTotal)}`) : "",
      isNow ? (daysLeft ? `${daysLeft} ${L("ថ្ងៃទៀតដល់ចុងខែ", "days to month end")}` : L("ថ្ងៃចុងខែ", "last day of the month")) : ""
    ].filter(Boolean).join(" · ");
    const scale = Math.max(budgetTotal, total, 0.0001);
    const stack = list.filter(x => x.total > 0).map(x => `<i style="flex:${x.total / scale};background:${colorOf(x.c)}"></i>`).join("")
      + (budgetTotal > total ? `<i class="ev-rest" style="flex:${(budgetTotal - total) / scale}"></i>` : "");
    const level = budgetTotal ? (total >= budgetTotal ? "over" : total >= budgetTotal * 0.8 ? "warn" : "ok") : "ok";

    const top = `<section class="ev-card ev-top xb-card ev-${level}">
      <div class="ev-head">
        <label class="ev-month"><span class="sr-only">${L("ខែ", "Month")}</span><select data-expense-month>
          ${months.map(key => `<option value="${key}" ${key === month ? "selected" : ""}>${escapeHtml(monthName(key))}</option>`).join("")}
          <option value="all" ${month === "all" ? "selected" : ""}>${L("ទាំងអស់", "All time")}</option>
        </select></label>
        <button type="button" class="ev-add" data-action="add-expense">＋ ${L("ចំណាយ", "Expense")}</button>
      </div>
      <div class="ev-big">${money(total)}${budgetTotal ? ` <small>/ ${money(budgetTotal)} ${L("ថវិកា", "budget")}</small>` : ""}</div>
      <p class="ev-sub">${sub}</p>
      ${list.length ? `<div class="ev-stack">${stack}</div>` : ""}
      ${isNow ? `<details class="xb-all" ${moneyBudgetOpen ? "open" : ""}><summary>${L("កែថវិកា · ការព្រមាន", "Budgets · alerts")}</summary>
        <label class="bud-alert-toggle"><input type="checkbox" data-budget-alerts ${appData.profile.budgetAlerts !== false ? "checked" : ""}>
          <span>📲 ${L("ព្រមានតាម Telegram ពេលចាយដល់ 80% និង 100%", "Telegram alert at 80% and 100%")}</span></label>
        <div class="xb-all-list">${expenseCategories.map(c => `<label class="xb-all-row" style="--cat:${colorOf(c)}">
          <span class="xb-all-icon">${icon(c)}</span><strong>${escapeHtml(optionLabel(c))}</strong>
          <input type="number" min="0" step="any" inputmode="decimal" placeholder="${L("កំណត់", "Set")}" value="${Number(b[c]) || ""}" data-budget-category="${escapeAttr(c)}">
          <small>${escapeHtml(cur())}</small></label>`).join("")}</div>
      </details>` : ""}
    </section>`;

    if (!items.length && !list.length) {
      return `<div class="ev">${top}${emptyState(t("noExpensesYet"), t("noExpensesBody"), t("addExpense"), "add-expense")}</div>`;
    }

    // one category opened (from "By category")
    if (state.view === "cat" && state.cat) {
      const x = cats[state.cat];
      const budget = isNow ? Number(b[state.cat]) || 0 : 0;
      const pct = budget ? Math.round((x.total / budget) * 100) : 0;
      const lvl = budget ? (pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok") : "ok";
      const days = month === "all" ? 0 : (isNow ? new Date().getDate() : Number(new Date(...month.split("-").map(Number), 0).getDate()));
      const own = items.filter(item => expenseGroupOf(item) === state.cat);
      return `<div class="ev">
        <section class="ev-card ev-detail xb-card ev-${lvl}" style="--cat:${colorOf(state.cat)}">
          <div class="ev-head"><button type="button" class="ev-back" data-ev-back>‹</button><span class="ev-ic">${icon(state.cat)}</span><b class="ev-title">${escapeHtml(optionLabel(state.cat))}</b>
            ${budget ? `<span class="ev-pill">${lvl !== "ok" ? "⚠️ " : ""}${pct}% · ${budget - x.total >= 0 ? `${L("នៅ", "left")} ${money(budget - x.total)}` : `${L("លើស", "over")} ${money(x.total - budget)}`}</span>` : ""}</div>
          ${budget ? `<div class="ev-bar"><i style="width:${Math.min(100, pct)}%"></i></div>` : ""}
          <p class="ev-sub">${money(x.total)}${budget ? ` / ${money(budget)}` : ""} · ${x.n} ${L("ចំណាយ", "expenses")}${days ? ` · ${L("ជាមធ្យម", "avg")} ${money(x.total / days)}/${L("ថ្ងៃ", "day")}` : ""}</p>
          ${isNow ? `<label class="bud-input xb-input"><span>${L("ថវិកា/ខែ", "Budget / mo")}</span><input type="number" min="0" step="any" inputmode="decimal" placeholder="${L("កំណត់", "Set")}" value="${budget || ""}" data-budget-category="${escapeAttr(state.cat)}"><small>${escapeHtml(cur())}</small></label>` : ""}
        </section>
        ${own.length ? byDay(own, false) : `<p class="ev-hint">${L("មិនទាន់មានចំណាយក្នុងប្រភេទនេះ", "No expenses in this category yet")}</p>`}
        <p class="ev-hint">${L("ចុចជួរ = កែ · ⋯ = លុប", "Tap a row to edit · ⋯ to delete")}</p>
      </div>`;
    }

    const tabs = `<div class="ev-seg" role="tablist">
      <button type="button" role="tab" class="${state.view === "cat" ? "is-on" : ""}" aria-selected="${state.view === "cat"}" data-ev-view="cat">${L("តាមប្រភេទ", "By category")}</button>
      <button type="button" role="tab" class="${state.view === "day" ? "is-on" : ""}" aria-selected="${state.view === "day"}" data-ev-view="day">${L("តាមថ្ងៃ", "By day")}</button>
    </div>`;

    if (state.view === "day") {
      const shown = state.chip ? items.filter(item => expenseGroupOf(item) === state.chip) : items;
      const chips = `<div class="ev-chips">
        <button type="button" class="ev-chip ${state.chip ? "" : "is-on"}" data-ev-chip="">${L("ទាំងអស់", "All")}</button>
        ${list.filter(x => x.n).map(x => `<button type="button" class="ev-chip ${state.chip === x.c ? "is-on" : ""}" data-ev-chip="${escapeAttr(x.c)}" style="--cat:${colorOf(x.c)}">${icon(x.c)}${money(x.total)}</button>`).join("")}
      </div>`;
      return `<div class="ev">${top}${tabs}${chips}${byDay(shown, true)}<p class="ev-hint">${L("ចុចជួរ = កែ · ⋯ = លុប", "Tap a row to edit · ⋯ to delete")}</p></div>`;
    }

    const maxTotal = Math.max(...list.map(x => x.total), 0.0001);
    const lines = list.map(x => {
      const budget = isNow ? Number(b[x.c]) || 0 : 0;
      const pct = budget ? Math.round((x.total / budget) * 100) : 0;
      const lvl = budget ? (pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok") : "none";
      const width = budget ? Math.min(100, pct) : Math.round((x.total / maxTotal) * 100);
      return `<button type="button" class="ev-cat is-${lvl}" data-ev-cat="${escapeAttr(x.c)}" style="--cat:${colorOf(x.c)}">
        <span class="ev-ic">${icon(x.c)}</span>
        <span class="ev-cx"><span class="ev-cn"><b>${escapeHtml(optionLabel(x.c))}</b>${lvl === "warn" || lvl === "over" ? `<em>⚠️ ${pct}%</em>` : ""}</span><span class="ev-mb ${budget ? "" : "is-share"}"><i style="width:${width}%"></i></span></span>
        <span class="ev-ca"><b>${money(x.total)}</b><small>${x.n}${budget ? ` · /${money(budget)}` : isNow ? ` · ＋${L("ថវិកា", "budget")}` : ""}</small></span>
      </button>`;
    }).join("");
    return `<div class="ev">${top}${tabs}<section class="ev-card ev-cats">${lines}</section><p class="ev-hint">${L("ចុចប្រភេទ → មើលចំណាយ", "Tap a category to see its expenses")}</p></div>`;
  }

  document.addEventListener("click", event => {
    const view = event.target.closest("[data-ev-view]");
    const cat = event.target.closest("[data-ev-cat]");
    const back = event.target.closest("[data-ev-back]");
    const chip = event.target.closest("[data-ev-chip]");
    if (view) { state.view = view.dataset.evView; state.cat = ""; }
    else if (cat) { state.cat = cat.dataset.evCat; }
    else if (back) { state.cat = ""; }
    else if (chip) { state.chip = chip.dataset.evChip; }
    else {
      // tap a row (not its ⋯ menu) = edit
      const rowEl = event.target.closest("[data-ev-row]");
      if (rowEl && !event.target.closest("details, button, a, input")) rowEl.querySelector("[data-edit-expense]")?.click();
      return;
    }
    App.render();
    if (cat || back) window.scrollTo({ top: Math.max(0, (document.querySelector(".ev")?.getBoundingClientRect().top || 0) + window.scrollY - 80), behavior: "instant" });
  });

  return { render, state };
})();
