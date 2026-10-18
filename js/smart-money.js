/* MYLIFE smart money helpers
 * - category budgets (profile.categoryBudgets) with a this-month view
 * - quick expense: one tap on a category + amount
 * - pace for savings and goals: "save $X / month to make it on time"
 * - goals linked to a savings item update themselves
 * Loaded after money.js (uses its category lists and helpers).
 */

const KM_MONTH_NAMES = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];

const SmartMoney = (() => {
  const km = () => languageCode() === "km";
  const monthKey = () => localDateInput().slice(0, 7);
  const profileCurrency = () => appData.profile.currency || "USD";

  /* ---------------- budgets ---------------- */
  function budgets() {
    const value = appData.profile.categoryBudgets;
    return value && typeof value === "object" ? value : {};
  }

  function spentThisMonth(category) {
    return sumMoney(appData.expenses.filter(item => item.category === category && String(item.date || "").startsWith(monthKey())), "amount");
  }

  function budgetLevel(percent) {
    return percent >= 100 ? "over" : percent >= 80 ? "warn" : "ok";
  }

  function budgetStatus(category) {
    const budget = Number(budgets()[category] || 0);
    const spent = spentThisMonth(category);
    const percent = budget ? Math.round((spent / budget) * 100) : 0;
    return { budget, spent, percent, left: budget - spent, level: budgetLevel(percent) };
  }

  function monthLabel() {
    const [y, m] = monthKey().split("-").map(Number);
    if (km()) return `ខែ${KM_MONTH_NAMES[m - 1]} ${y}`;
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function renderBudgetTab() {
    const rows = expenseCategories.map(category => ({ category, ...budgetStatus(category) }))
      .sort((a, b) => (b.budget ? 1 : 0) - (a.budget ? 1 : 0) || b.spent - a.spent);
    const withBudget = rows.filter(row => row.budget);
    const totalBudget = withBudget.reduce((sum, row) => sum + row.budget, 0);
    const totalSpent = withBudget.reduce((sum, row) => sum + row.spent, 0);
    const totalPct = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const warnings = withBudget.filter(row => row.percent >= 80).length;
    const alertsOn = appData.profile.budgetAlerts !== false;

    return `<article class="glass-card card-pad financial-panel bud-panel">
      <div class="financial-panel-heading">
        <div><span class="eyebrow">${t("budget")} · ${escapeHtml(monthLabel())}</span><h2 class="section-title">${km() ? "ថវិកាតាមប្រភេទ" : "Budgets by category"}</h2></div>
        <span class="icon-badge blue">${Icons.budget()}</span>
      </div>
      <div class="bud-summary bud-${budgetLevel(totalPct)}">
        <div class="bud-summary-main">
          <span>${km() ? "ចាយខែនេះ (ប្រភេទមានថវិកា)" : "Spent this month (budgeted)"}</span>
          <strong>${money(totalSpent)} <small>/ ${totalBudget ? money(totalBudget) : (km() ? "មិនទាន់កំណត់" : "not set")}</small></strong>
          <div class="bud-track"><i style="width:${Math.min(100, totalPct)}%"></i></div>
        </div>
        <div class="bud-summary-side">
          <b>${totalBudget ? `${totalPct}%` : "–"}</b>
          <small>${warnings ? `⚠️ ${warnings} ${km() ? "ប្រភេទជិតអស់" : "near limit"}` : (km() ? "✓ ល្អ" : "✓ On track")}</small>
        </div>
      </div>
      <label class="bud-alert-toggle">
        <input type="checkbox" data-budget-alerts ${alertsOn ? "checked" : ""}>
        <span>📲 ${km() ? "ព្រមានតាម Telegram ពេលចាយដល់ 80% និង 100%" : "Telegram alert at 80% and 100%"}</span>
      </label>
      <div class="bud-grid">
        ${rows.map(row => {
          const color = expenseCategoryColors[row.category];
          const iconName = expenseCategoryIcons[row.category] || "expense";
          const status = row.budget
            ? (row.left >= 0 ? `${km() ? "នៅសល់" : "Left"} ${money(row.left)}` : `${km() ? "លើស" : "Over by"} ${money(-row.left)}`)
            : (km() ? "មិនទាន់កំណត់ថវិកា" : "No budget yet");
          return `<div class="bud-card bud-${row.budget ? row.level : "none"}" style="--cat:${color}">
            <div class="bud-head">
              <span class="bud-icon">${Icons[iconName]()}</span>
              <strong>${escapeHtml(optionLabel(row.category))}</strong>
              ${row.budget ? `<em>${row.percent}%</em>` : ""}
            </div>
            <div class="bud-amounts"><b>${money(row.spent)}</b><span>${status}</span></div>
            <div class="bud-track"><i style="width:${row.budget ? Math.min(100, row.percent) : 0}%"></i></div>
            <label class="bud-input">
              <span>${km() ? "ថវិកា/ខែ" : "Budget / mo"}</span>
              <input type="number" min="0" step="any" inputmode="decimal" placeholder="${km() ? "កំណត់" : "Set"}" value="${row.budget || ""}" data-budget-category="${escapeAttr(row.category)}">
              <small>${escapeHtml(profileCurrency())}</small>
            </label>
          </div>`;
        }).join("")}
      </div>
    </article>`;
  }

  function bindBudgetTab() {
    document.querySelectorAll("[data-budget-category]").forEach(input => {
      const save = () => {
        const value = Number(input.value || 0);
        const current = Number(budgets()[input.dataset.budgetCategory] || 0);
        if (value === current) return;
        const next = { ...budgets() };
        // 0 rather than deleting the key, so "no budget" also syncs to other devices.
        next[input.dataset.budgetCategory] = value > 0 ? value : 0;
        Store.updateProfile({ categoryBudgets: next });
        Toast.show(km() ? "បានរក្សាទុកថវិកា" : "Budget saved");
      };
      input.addEventListener("change", save);
      input.addEventListener("keydown", event => {
        if (event.key === "Enter") input.blur();
      });
    });
    document.querySelector("[data-budget-alerts]")?.addEventListener("change", event => {
      Store.updateProfile({ budgetAlerts: event.target.checked });
    });
  }

  /* ---------------- quick expense ---------------- */
  function topCategories() {
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceIso = localDateInput(since);
    const counts = {};
    appData.expenses.forEach(item => {
      if (String(item.date || "") >= sinceIso) counts[item.category] = (counts[item.category] || 0) + 1;
    });
    const defaults = ["Food", "Transport", "Shopping", "Home", "Bills"];
    const rank = category => (defaults.includes(category) ? defaults.indexOf(category) : 99);
    return [...expenseCategories].sort((a, b) => (counts[b] || 0) - (counts[a] || 0) || rank(a) - rank(b));
  }

  const FREQ_ICON = { Food: "🍜", Transport: "🚗", Shopping: "🛍", Home: "🏠", Bills: "🧾", Family: "👨‍👩‍👧", Health: "💊", Education: "📚", Entertainment: "🎬", Other: "📦" };
  // expenses logged 3+ times in 60 days → one-tap buttons
  const frequentList = () => (typeof MoneyInsights !== "undefined" ? MoneyInsights.frequentExpenses(appData, localDateInput(), 4) : []);
  const freqAmount = entry => (entry.currency === "KHR" ? `${Number(entry.amount).toLocaleString("en-US")}៛` : `$${Number(entry.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`);

  function renderQuickExpense(extraClass = "") {
    const frequent = frequentList();
    const categories = topCategories();
    const first = categories[0];
    const currency = profileCurrency();
    return `<article class="glass-card card-pad qx-card ${extraClass}">
      <form class="qx-form" data-quick-expense novalidate>
        <div class="qx-head">
          <span class="qx-bolt">⚡</span>
          <div><strong>${km() ? "កត់ចំណាយរហ័ស" : "Quick expense"}</strong><small data-qx-hint></small></div>
          <button class="qx-more" type="button" data-qx-details>${Icons.plus()}${km() ? "លម្អិត" : "Details"}</button>
        </div>
        ${frequent.length ? `<div class="qx-frequent" aria-label="${escapeAttr(km() ? "ចំណាយញឹកញាប់" : "Frequent expenses")}">
          <span class="qx-frequent-label">⭐ ${km() ? "ចុចមួយដង" : "One tap"}</span>
          ${frequent.map((entry, index) => `<button type="button" class="qx-fav" data-qx-fav="${index}" title="${escapeAttr(`${entry.count}×`)}">${FREQ_ICON[entry.category] || "📦"} ${escapeHtml(entry.description)} <b>${escapeHtml(freqAmount(entry))}</b></button>`).join("")}
        </div>` : ""}
        <div class="qx-cats" role="radiogroup">
          ${categories.map((category, index) => `<label class="qx-cat" style="--cat:${expenseCategoryColors[category]}">
            <input type="radio" name="qxCategory" value="${escapeAttr(category)}" ${index === 0 ? "checked" : ""}>
            <i>${Icons[expenseCategoryIcons[category] || "expense"]()}</i><b>${escapeHtml(optionLabel(category))}</b>
          </label>`).join("")}
        </div>
        <div class="qx-row">
          <div class="qx-amount">
            <button type="button" class="qx-currency" data-qx-currency="${currency}">${currency === "KHR" ? "៛" : "$"}</button>
            <input type="number" name="qxAmount" min="0" step="any" inputmode="decimal" placeholder="0" aria-label="${escapeAttr(t("amount"))}">
          </div>
          <input class="qx-note" type="text" name="qxNote" maxlength="80" placeholder="${km() ? "កំណត់ចំណាំ (មិនចាំបាច់)" : "Note (optional)"}">
          <button class="button qx-add" type="submit">${Icons.plus()} ${km() ? "កត់" : "Add"}</button>
        </div>
      </form>
    </article>`;
  }

  function bindQuickExpense() {
    document.querySelectorAll("[data-quick-expense]").forEach(form => {
      const hint = form.querySelector("[data-qx-hint]");
      form.querySelector("[data-qx-details]")?.addEventListener("click", () => {
        const category = form.querySelector('input[name="qxCategory"]:checked')?.value;
        const amount = Number(form.elements.qxAmount.value || 0);
        openExpenseModal(amount || form.elements.qxNote.value ? { category, amount: amount || "", description: form.elements.qxNote.value.trim(), currency: form.querySelector("[data-qx-currency]").dataset.qxCurrency } : { category });
      });
      form.querySelectorAll("[data-qx-fav]").forEach(button => button.addEventListener("click", () => {
        const entry = frequentList()[Number(button.dataset.qxFav)];
        if (!entry) return;
        button.disabled = true;
        Store.add("expenses", { description: entry.description, amount: entry.amount, currency: entry.currency, category: entry.category, date: localDateInput(), method: "", notes: "" });
        Toast.show(`${km() ? "បានកត់" : "Added"} ${FREQ_ICON[entry.category] || ""} ${escapeHtml(entry.description)} ${escapeHtml(freqAmount(entry))}`, "success", { sound: "coin" });
      }));
      const currencyButton = form.querySelector("[data-qx-currency]");
      const update = () => {
        const category = form.querySelector('input[name="qxCategory"]:checked')?.value;
        const status = budgetStatus(category);
        hint.textContent = status.budget
          ? `${optionLabel(category)}: ${km() ? "នៅសល់" : "left"} ${rielText(new Intl.NumberFormat("en-US", { style: "currency", currency: profileCurrency(), maximumFractionDigits: 0 }).format(Math.max(0, status.left)))} (${status.percent}%)`
          : `${optionLabel(category)} · ${km() ? "ថ្ងៃនេះ" : "today"}`;
        hint.dataset.level = status.budget ? status.level : "";
      };
      form.querySelectorAll('input[name="qxCategory"]').forEach(input => input.addEventListener("change", () => {
        update();
        form.elements.qxAmount.focus();
      }));
      currencyButton.addEventListener("click", () => {
        const next = currencyButton.dataset.qxCurrency === "KHR" ? "USD" : "KHR";
        currencyButton.dataset.qxCurrency = next;
        currencyButton.textContent = next === "KHR" ? "៛" : "$";
      });
      form.addEventListener("submit", event => {
        event.preventDefault();
        const amount = Number(form.elements.qxAmount.value || 0);
        if (!amount || amount < 0) {
          form.elements.qxAmount.focus();
          form.querySelector(".qx-amount").classList.add("qx-error");
          setTimeout(() => form.querySelector(".qx-amount")?.classList.remove("qx-error"), 900);
          return;
        }
        const category = form.querySelector('input[name="qxCategory"]:checked')?.value || "Other";
        const note = form.elements.qxNote.value.trim();
        const currency = currencyButton.dataset.qxCurrency;
        Store.add("expenses", { description: note || optionLabel(category), amount, currency, category, date: localDateInput(), method: "", notes: "" });
        const status = budgetStatus(category);
        const left = status.budget ? ` · ${km() ? "នៅសល់" : "left"} ${rielText(new Intl.NumberFormat("en-US", { style: "currency", currency: profileCurrency(), maximumFractionDigits: 0 }).format(status.left))}` : "";
        Toast.show(`${km() ? "បានកត់" : "Added"} ${optionLabel(category)}${left}`);
      });
      update();
    });
  }

  /* ---------------- pace ---------------- */
  function monthsUntil(deadline) {
    if (!deadline) return null;
    const end = new Date(`${deadline}T00:00:00`);
    if (Number.isNaN(end.getTime())) return null;
    const days = (end - new Date(`${localDateInput()}T00:00:00`)) / 86400000;
    return days / 30.44;
  }

  function monthName(offsetMonths) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() + Math.max(0, Math.ceil(offsetMonths)));
    if (km()) return `${KM_MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  /**
   * @param {{current:number, target:number, deadline?:string, monthly?:number, currency?:string}} input
   */
  function paceHtml({ current, target, deadline, monthly = 0, currency }) {
    const remaining = Number(target || 0) - Number(current || 0);
    if (!Number(target)) return "";
    const fmt = value => money(Math.ceil(value), currency);
    if (remaining <= 0) return `<div class="pace pace-done">🎉 ${km() ? "ដល់គោលដៅហើយ!" : "Goal reached!"}</div>`;
    const months = monthsUntil(deadline);
    if (months !== null && months <= 0) {
      return `<div class="pace pace-late">⏰ ${km() ? "ហួសថ្ងៃកំណត់ — នៅខ្វះ" : "Past deadline — still need"} ${fmt(remaining)}</div>`;
    }
    if (months === null) {
      if (!monthly) return "";
      const need = remaining / monthly;
      return `<div class="pace pace-info">📅 ${km() ? `ដល់គោលដៅប្រហែល ${monthName(need)}` : `Reach it around ${monthName(need)}`} <small>(${Math.ceil(need)} ${km() ? "ខែ" : "mo"})</small></div>`;
    }
    const perMonth = remaining / Math.max(1, months);
    if (monthly && monthly >= perMonth * 0.98) {
      return `<div class="pace pace-ok">✓ ${km() ? "ទាន់ពេល" : "On track"} — ${km() ? `ដល់ប្រហែល ${monthName(remaining / monthly)}` : `done around ${monthName(remaining / monthly)}`}</div>`;
    }
    const lateBy = monthly ? Math.ceil(remaining / monthly - months) : 0;
    return `<div class="pace ${monthly ? "pace-late" : "pace-info"}">${monthly ? `⚠️ ${km() ? `យឺត ${lateBy} ខែ` : `${lateBy} mo late`} · ` : "💡 "}${km() ? "ត្រូវសន្សំ" : "Save"} <b>${fmt(perMonth)}</b>/${km() ? "ខែ ដើម្បីទាន់ពេល" : "month to make it"}</div>`;
  }

  function savingsPace(item) {
    return paceHtml({
      current: Number(item.currentAmount || 0),
      target: Number(item.targetAmount || 0),
      deadline: item.deadline,
      monthly: Number(item.monthlyContribution || 0),
      currency: item.currency
    });
  }

  function goalMonthlyRate(goal) {
    const linked = linkedSaving(goal);
    if (linked) return toProfileCurrency(linked.monthlyContribution, linked.currency);
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceIso = localDateInput(since);
    const recent = (goal.contributions || []).filter(entry => String(entry.date || "") >= sinceIso);
    return recent.length ? sum(recent, "amount") / 3 : 0;
  }

  function goalPace(goal) {
    return paceHtml({
      current: Number(goal.currentAmount || 0),
      target: Number(goal.targetAmount || 0),
      deadline: goal.deadline,
      monthly: goalMonthlyRate(goal)
    });
  }

  /* ---------------- goals linked to savings ---------------- */
  function linkedSaving(goal) {
    if (!goal?.linkedSavingsId) return null;
    return appData.savings.find(item => item.id === goal.linkedSavingsId) || null;
  }

  // Keeps each linked goal's amount equal to its savings balance.
  function syncLinkedGoals() {
    let changed = false;
    (appData.goals || []).forEach(goal => {
      const saving = linkedSaving(goal);
      if (!saving) return;
      const amount = Math.round(toProfileCurrency(saving.currentAmount, saving.currency) * 100) / 100;
      if (Number(goal.currentAmount || 0) !== amount) {
        goal.currentAmount = amount;
        goal.updatedAt = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) Store.save();
    return changed;
  }

  function linkedBadge(goal) {
    const saving = linkedSaving(goal);
    return saving ? `<div class="pace pace-link">🔗 ${km() ? "ភ្ជាប់ជាមួយការសន្សំ" : "Linked to savings"}: <b>${escapeHtml(saving.name)}</b></div>` : "";
  }

  return {
    budgets,
    budgetStatus,
    renderBudgetTab,
    bindBudgetTab,
    renderQuickExpense,
    bindQuickExpense,
    savingsPace,
    goalPace,
    linkedSaving,
    linkedBadge,
    syncLinkedGoals,
    paceHtml
  };
})();

function syncLinkedGoals() {
  return SmartMoney.syncLinkedGoals();
}
