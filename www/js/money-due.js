/*
 * Money due today: salary / income to receive, bills and loans to pay.
 * Shared by the app's "did you get / pay it?" pop-up (js/money-ask.js) and the
 * server (api/dispatch.js alerts, api/telegram-webhook.js ✅ buttons), so both
 * ask about the same things and record an answer only once.
 * Node: require("../js/money-due.js") · browser: window.MoneyDue
 *
 * Income "received" is kept on the income record, one entry per month:
 *   income.received = { "2026-10": { amount, currency, date, via, at } }
 */
(function (root) {
const LoanPay = typeof module !== "undefined" && module.exports ? require("./loan-pay.js") : root.LoanPay;

const pad = n => String(n).padStart(2, "0");
const lastDay = (y, m) => new Date(y, m, 0).getDate();

// the date this income is due in a month (YYYY-MM), or "" when it is not due that month
function incomeDateInMonth(income, month) {
  const start = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(income.nextPaymentDate || ""));
  const target = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!start || !target || !(Number(income.amount) > 0)) return "";
  const frequency = income.frequency || "Monthly";
  const recurring = income.recurring !== false && frequency !== "Once";
  const startMonth = `${start[1]}-${start[2]}`;
  if (!recurring || frequency === "Once") return startMonth === month ? start[0] : "";
  if (frequency === "Yearly") return start[2] === target[2] && month >= startMonth ? `${month}-${pad(Math.min(Number(start[3]), lastDay(Number(target[1]), Number(target[2]))))}` : "";
  if (frequency !== "Monthly") return ""; // weekly pay: not asked (would ask every week)
  if (month < startMonth) return "";
  return `${month}-${pad(Math.min(Number(start[3]), lastDay(Number(target[1]), Number(target[2]))))}`;
}

function incomeReceived(income, month) {
  const entry = income && income.received && typeof income.received === "object" ? income.received[month] : null;
  return entry || null;
}

// "updated" the first time, "already" after (double tap, Telegram retry, app + bot)
function recordIncomeReceived(income, month, opts = {}) {
  if (!income || !month) return "missing";
  if (incomeReceived(income, month)) return "already";
  const amount = Number(opts.amount) > 0 ? Number(opts.amount) : Number(income.amount || 0);
  income.received = income.received && typeof income.received === "object" ? income.received : {};
  income.received[month] = {
    amount: Math.round(amount * 100) / 100,
    currency: opts.currency || income.currency || "",
    date: opts.date || "",
    via: opts.via || "",
    at: new Date().toISOString()
  };
  income.updatedAt = new Date().toISOString();
  return "updated";
}

function billPaidThisCycle(bill, today) {
  if (bill.status === "Paid") return true;
  return Boolean(bill.lastPaidAt && bill.due && bill.due > today);
}

/**
 * What to ask about today: [{ kind: "income" | "bill" | "loan", id, key, title,
 * amount, currency, date, month, overdueDays }]. Only things whose day has come
 * (date ≤ today) and that are not answered yet. A bill linked to a loan is asked
 * once, as the bill (the loan is skipped).
 */
function dueToday(payload, today) {
  const month = String(today).slice(0, 7);
  const days = date => Math.round((new Date(`${today}T00:00:00`) - new Date(`${date}T00:00:00`)) / 86400000);
  const out = [];

  // each item can say "don't ask me" (income/loan: ask = false · bill: reminder off)
  (payload.income || []).forEach(income => {
    if (income.ask === false) return;
    const date = incomeDateInMonth(income, month);
    if (!date || date > today || incomeReceived(income, month)) return;
    out.push({ kind: "income", id: income.id, key: `income:${income.id}:${month}`, title: income.name || "Income", amount: Number(income.amount || 0), currency: income.currency || "", date, month, overdueDays: days(date) });
  });

  const bills = payload.bills || [];
  bills.forEach(bill => {
    if (!bill.due || bill.due > today || billPaidThisCycle(bill, today) || bill.autoPay || bill.reminder === false) return;
    out.push({ kind: "bill", id: bill.id, key: `bill:${bill.id}:${bill.due}`, title: bill.name || "Bill", amount: Number(bill.amount || 0), currency: bill.currency || "", date: bill.due, month, overdueDays: days(bill.due), loanId: bill.loanId || "" });
  });

  (payload.loans || []).forEach(loan => {
    if (loan.ask === false || !(Number(loan.monthlyPayment) > 0) || !(loan.firstPaymentDate || loan.startDate)) return;
    if (bills.some(bill => bill.loanId === loan.id)) return; // asked through its bill
    const date = LoanPay ? LoanPay.scheduleDateFor(loan, today) : "";
    if (!date || date > today) return;
    if (String(loan.firstPaymentDate || loan.startDate) > date) return;
    if (loan.dueDate && date > loan.dueDate) return; // finished
    if ((loan.payments || []).some(payment => payment.date === date)) return;
    out.push({ kind: "loan", id: loan.id, key: `loan:${loan.id}:${date}`, title: loan.name || "Loan", amount: Number(loan.monthlyPayment || 0), currency: loan.currency || "", date, month, overdueDays: days(date) });
  });

  const order = { income: 0, bill: 1, loan: 2 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.date.localeCompare(b.date));
}

const api = { incomeDateInMonth, incomeReceived, recordIncomeReceived, billPaidThisCycle, dueToday };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.MoneyDue = api;
})(typeof window !== "undefined" ? window : globalThis);
