// Money numbers computed on the server for Telegram: category budget alerts
// and the Sunday weekly report. Mirrors js/data.js conversion (1 USD = 4100 KHR).

const KHR_PER_USD = 4100;
const { monthForecast } = require("./money-insights");

const CATEGORY_KM = {
  Food: "អាហារ",
  Home: "ផ្ទះ",
  Family: "គ្រួសារ",
  Transport: "ធ្វើដំណើរ",
  Shopping: "ទិញទំនិញ",
  Bills: "វិក្កយបត្រ",
  Education: "ការសិក្សា",
  Health: "សុខភាព",
  Entertainment: "កម្សាន្ត",
  Other: "ផ្សេងៗ"
};

function convert(amount, from = "USD", to = "USD") {
  const value = Number(amount || 0);
  if ((from || "USD") === (to || "USD")) return value;
  if (from === "KHR" && to === "USD") return value / KHR_PER_USD;
  if (from === "USD" && to === "KHR") return value * KHR_PER_USD;
  return value;
}

function formatMoney(amount, currency = "USD") {
  const value = Math.round(Number(amount || 0) * (currency === "USD" ? 100 : 1)) / (currency === "USD" ? 100 : 1);
  return currency === "KHR" ? `${value.toLocaleString("en-US")} ៛` : `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function profileCurrency(payload) {
  return payload?.profile?.currency || "USD";
}

function sumIn(items, currency, key = "amount") {
  return items.reduce((total, item) => total + convert(item[key], item.currency || currency, currency), 0);
}

function inRange(item, from, to) {
  const date = String(item.date || "");
  return date >= from && date <= to;
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Spent this month per category, in profile currency. */
function monthSpending(payload, monthKey) {
  const currency = profileCurrency(payload);
  const totals = {};
  (payload.expenses || []).forEach(expense => {
    if (!String(expense.date || "").startsWith(monthKey)) return;
    const category = expense.category || "Other";
    totals[category] = (totals[category] || 0) + convert(expense.amount, expense.currency || currency, currency);
  });
  return totals;
}

/**
 * Budget alerts for the month: one per category per threshold (80% / 100%).
 * Ids carry month + level so each alert is sent once.
 */
function budgetAlerts(payload, today) {
  const profile = payload.profile || {};
  if (profile.budgetAlerts === false) return [];
  const budgets = profile.categoryBudgets || {};
  const currency = profileCurrency(payload);
  const monthKey = today.slice(0, 7);
  const spent = monthSpending(payload, monthKey);
  const alerts = [];
  Object.entries(budgets).forEach(([category, rawBudget]) => {
    const budget = Number(rawBudget || 0);
    if (!budget) return;
    const used = spent[category] || 0;
    const percent = Math.round((used / budget) * 100);
    const level = percent >= 100 ? 100 : percent >= 80 ? 80 : 0;
    if (!level) return;
    const km = CATEGORY_KM[category] || category;
    const left = budget - used;
    alerts.push({
      kind: "budget",
      id: `budget-${category}-${monthKey}-${level}`,
      title: `${km} · ${category}`,
      body: [
        `ចាយ ${formatMoney(used, currency)} / ${formatMoney(budget, currency)} (${percent}%)`,
        level === 100
          ? `លើសថវិកា ${formatMoney(-left, currency)} · Over budget`
          : `នៅសល់ ${formatMoney(left, currency)} · ${formatMoney(left, currency)} left`
      ].join("\n"),
      level,
      percent,
      date: today,
      sendNow: true,
      url: "/#money/budget"
    });
  });
  return alerts;
}

/** Sunday report: this week (last 7 days) vs the 7 days before. */
function weeklyReport(payload, today) {
  const currency = profileCurrency(payload);
  const thisFrom = addDays(today, -6);
  const lastFrom = addDays(today, -13);
  const lastTo = addDays(today, -7);
  const expenses = payload.expenses || [];
  const thisWeek = expenses.filter(item => inRange(item, thisFrom, today));
  const lastWeek = expenses.filter(item => inRange(item, lastFrom, lastTo));
  const spent = sumIn(thisWeek, currency);
  const before = sumIn(lastWeek, currency);
  const income = sumIn((payload.income || []).filter(item => inRange(item, thisFrom, today)), currency);

  const byCategory = {};
  thisWeek.forEach(item => {
    const category = item.category || "Other";
    byCategory[category] = (byCategory[category] || 0) + convert(item.amount, item.currency || currency, currency);
  });
  const top = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, km: CATEGORY_KM[category] || category, amount: formatMoney(amount, currency), share: spent ? Math.round((amount / spent) * 100) : 0 }));

  const nextWeekEnd = addDays(today, 7);
  const billsNext = (payload.bills || []).filter(bill => bill.status !== "Paid" && bill.due && bill.due > today && bill.due <= nextWeekEnd).length;

  const budgets = (payload.profile || {}).categoryBudgets || {};
  const monthSpent = monthSpending(payload, today.slice(0, 7));
  const budgetLines = Object.entries(budgets)
    .filter(([, value]) => Number(value) > 0)
    .map(([category, value]) => ({ km: CATEGORY_KM[category] || category, percent: Math.round(((monthSpent[category] || 0) / Number(value)) * 100) }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 4);

  const forecast = monthForecast(payload, today);
  return {
    forecast: {
      projected: formatMoney(forecast.projected, currency),
      left: formatMoney(Math.abs(forecast.left), currency),
      short: forecast.left < 0,
      perDay: forecast.daysLeft > 0 ? formatMoney(forecast.perDay, currency) : "",
      runOut: forecast.budgets.slice(0, 3).map(entry => ({ km: CATEGORY_KM[entry.category] || entry.category, day: entry.day, over: entry.over }))
    },
    from: thisFrom,
    to: today,
    spent: formatMoney(spent, currency),
    before: formatMoney(before, currency),
    change: before ? Math.round(((spent - before) / before) * 100) : null,
    count: thisWeek.length,
    income: income ? formatMoney(income, currency) : "",
    top,
    billsNext,
    budgets: budgetLines
  };
}

module.exports = { budgetAlerts, weeklyReport, monthSpending, formatMoney, convert, CATEGORY_KM };
