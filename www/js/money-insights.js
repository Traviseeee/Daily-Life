/* Money insights shared by the app (window.MoneyInsights) and the server
 * (api/ via lib/money-insights.js): frequent expenses, unusual-day check and
 * the month-end forecast. Pure functions over the app payload, no dependencies.
 * 1 USD = 4100 KHR, same as js/data.js and lib/money-report.js. */
(function (root) {
  const KHR_PER_USD = 4100;

  function convert(amount, from = "USD", to = "USD") {
    const value = Number(amount || 0);
    if ((from || "USD") === (to || "USD")) return value;
    if (from === "KHR" && to === "USD") return value / KHR_PER_USD;
    if (from === "USD" && to === "KHR") return value * KHR_PER_USD;
    return value;
  }

  function addDays(iso, days) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  }

  const daysInMonth = iso => {
    const [y, m] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  };

  const currencyOf = payload => (payload && payload.profile && payload.profile.currency) || "USD";
  const list = (payload, key) => (Array.isArray(payload && payload[key]) ? payload[key] : []);

  /**
   * Expenses you log again and again ("coffee $2" bought 3+ times in 60 days).
   * @returns [{ description, amount, currency, category, count, last }]
   */
  function frequentExpenses(payload, today, limit = 4) {
    const from = addDays(today, -60);
    const groups = new Map();
    list(payload, "expenses").forEach(item => {
      const date = String(item.date || "");
      if (!date || date < from || date > today || item.billId) return;
      const description = String(item.description || "").trim();
      if (!description) return;
      const amount = Number(item.amount || 0);
      if (!(amount > 0)) return;
      const currency = item.currency || currencyOf(payload);
      const key = `${description.toLowerCase()}|${amount}|${currency}`;
      const entry = groups.get(key) || { description, amount, currency, category: item.category || "Other", count: 0, last: "" };
      entry.count += 1;
      if (date >= entry.last) {
        entry.last = date;
        entry.category = item.category || entry.category;
      }
      groups.set(key, entry);
    });
    return [...groups.values()]
      .filter(entry => entry.count >= 3)
      .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
      .slice(0, limit);
  }

  function dailyTotals(payload, from, to) {
    const currency = currencyOf(payload);
    const totals = {};
    list(payload, "expenses").forEach(item => {
      const date = String(item.date || "");
      if (!date || date < from || date > to || item.billId) return;
      totals[date] = (totals[date] || 0) + convert(item.amount, item.currency || currency, currency);
    });
    return totals;
  }

  /**
   * Today vs a normal day (average of the 30 days before, bills left out).
   * @returns { today, average, ratio, unusual } in the profile currency
   */
  function unusualToday(payload, today) {
    const currency = currencyOf(payload);
    const before = dailyTotals(payload, addDays(today, -30), addDays(today, -1));
    const activeDays = Object.keys(before).length;
    const average = Object.values(before).reduce((sum, value) => sum + value, 0) / 30;
    const spent = dailyTotals(payload, today, today)[today] || 0;
    const ratio = average > 0 ? spent / average : 0;
    const minimum = currency === "KHR" ? 40000 : 10;
    return {
      today: spent,
      average,
      ratio,
      unusual: activeDays >= 7 && spent >= minimum && ratio >= 3
    };
  }

  function incomeThisMonth(payload, month) {
    const currency = currencyOf(payload);
    return list(payload, "income").reduce((sum, item) => {
      const frequency = item.frequency || "Monthly";
      const recurring = item.recurring !== false && frequency !== "Once";
      const date = String(item.nextPaymentDate || item.createdAt || "").slice(0, 10);
      if (!recurring && date.slice(0, 7) !== month) return sum;
      const factor = recurring ? ({ Weekly: 52 / 12, Quarterly: 1 / 3, Yearly: 1 / 12 }[frequency] || 1) : 1;
      return sum + convert(Number(item.amount || 0) * factor, item.currency || currency, currency);
    }, 0);
  }

  // unpaid recurring bills still due later this month
  function billsLeftThisMonth(payload, today) {
    const currency = currencyOf(payload);
    const monthEnd = `${today.slice(0, 7)}-${String(daysInMonth(today)).padStart(2, "0")}`;
    return list(payload, "bills").reduce((sum, bill) => {
      if (!bill.due || bill.status === "Paid") return sum;
      if (bill.due > today && bill.due <= monthEnd) return sum + convert(bill.amount, bill.currency || currency, currency);
      return sum;
    }, 0);
  }

  /**
   * "If you keep spending like this…": projected month total, money left and
   * the day each budget would run out.
   * @returns { spent, projected, income, left, daysLeft, perDay, budgets: [{ category, budget, spent, projected, day }] }
   */
  // monthly loan payments + planned saving (what the app subtracts for "left")
  function commitments(payload) {
    const currency = currencyOf(payload);
    const loans = list(payload, "loans").reduce((sum, loan) => {
      const remaining = Number(loan.remaining ?? loan.balance ?? loan.amount ?? 0);
      return remaining > 0 || loan.remaining === undefined ? sum + convert(loan.monthlyPayment || 0, loan.currency || currency, currency) : sum;
    }, 0);
    const savings = list(payload, "savings").reduce((sum, saving) => sum + convert(saving.monthlyContribution || 0, saving.currency || currency, currency), 0);
    return loans + savings;
  }

  /** options.leftNow: the app's exact "left this month" (income − spent − loans − saving) */
  function monthForecast(payload, today, options = {}) {
    const currency = currencyOf(payload);
    const month = today.slice(0, 7);
    const day = Number(today.slice(8, 10));
    const total = daysInMonth(today);
    let spent = 0;
    let variable = 0;
    const byCategory = {};
    list(payload, "expenses").forEach(item => {
      if (!String(item.date || "").startsWith(month) || item.date > today) return;
      const value = convert(item.amount, item.currency || currency, currency);
      spent += value;
      if (!item.billId) variable += value;
      const category = item.category || "Other";
      byCategory[category] = (byCategory[category] || 0) + value;
    });
    const projectedVariable = day ? (variable / day) * total : variable;
    const projected = spent - variable + projectedVariable + billsLeftThisMonth(payload, today);
    const income = incomeThisMonth(payload, month);
    const budgets = Object.entries((payload.profile && payload.profile.categoryBudgets) || {})
      .filter(([, value]) => Number(value) > 0)
      .map(([category, value]) => {
        const budget = Number(value);
        const used = byCategory[category] || 0;
        const rate = day ? used / day : 0;
        const projectedUse = rate * total;
        const over = used >= budget;
        const runOut = rate > 0 ? Math.max(day + 1, Math.ceil(budget / rate)) : null;
        return { category, budget, spent: used, projected: projectedUse, over, day: over ? day : runOut && runOut <= total ? runOut : null };
      })
      .filter(entry => entry.day)
      .sort((a, b) => a.day - b.day);
    const daysLeft = total - day;
    const leftNow = Number.isFinite(options.leftNow) ? options.leftNow : income - spent - commitments(payload);
    // still to come this month: the same daily pace for the days left + unpaid bills
    const extra = projected - spent;
    return {
      spent,
      projected,
      income,
      leftNow,
      left: leftNow - extra,
      daysLeft,
      perDay: daysLeft > 0 ? Math.max(0, leftNow) / daysLeft : 0,
      budgets
    };
  }

  const api = { frequentExpenses, unusualToday, monthForecast, incomeThisMonth, convert };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MoneyInsights = api;
})(typeof window !== "undefined" ? window : globalThis);
