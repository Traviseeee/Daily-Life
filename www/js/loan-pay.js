/*
 * Loan payments, shared by the app (window.LoanPay) and the server
 * (require("../js/loan-pay.js")): Telegram ✅, bills linked to a loan.
 *
 * Rule: money that really left is recorded ONCE, as one expense (category
 * "Loan"). The loan keeps its own payments[] entry for the schedule and the
 * balance, pointing to that expense with expenseId. Summaries count the
 * expense and skip loan payments that have an expenseId, so nothing is
 * counted twice. Older payments (no expenseId) keep counting as before.
 */
(function (root) {
const round2 = value => Math.round(Number(value || 0) * 100) / 100;

function findPayment(loan, date) {
  return (loan.payments || []).find(payment => payment.date === date) || null;
}

/**
 * Records one payment for a loan on a date. Same loan + same date twice
 * (double click, Telegram retry, bill + loan schedule) → "already".
 * opts: { amount, via, billId, expenseId (reuse an existing expense), makeId, today }
 * Returns { result: "updated" | "already", payment, expense }
 */
function recordLoanPayment(payload, loan, date, opts = {}) {
  if (!loan || !date) return { result: "missing" };
  loan.payments = Array.isArray(loan.payments) ? loan.payments : [];
  const existing = findPayment(loan, date);
  if (existing) return { result: "already", payment: existing };

  const amount = round2(Number(opts.amount) > 0 ? opts.amount : loan.monthlyPayment);
  if (!(amount > 0)) return { result: "missing" };
  const currency = opts.currency || loan.currency || payload.profile?.currency || "USD";
  const now = new Date().toISOString();
  payload.expenses = Array.isArray(payload.expenses) ? payload.expenses : [];

  let expense = opts.expenseId ? payload.expenses.find(entry => entry.id === opts.expenseId) : null;
  if (!expense) {
    // one expense per loan + date, even if an earlier attempt half-finished
    expense = payload.expenses.find(entry => entry.loanId === loan.id && entry.loanPaymentDate === date) || null;
  }
  if (expense) {
    Object.assign(expense, { loanId: loan.id, loanPaymentDate: date, updatedAt: now });
  } else {
    const makeId = opts.makeId || (() => `expenses-loan-${loan.id}-${date}-${Date.now()}`);
    expense = {
      id: makeId("expenses"),
      createdAt: now,
      updatedAt: now,
      description: loan.name || "Loan",
      amount,
      currency,
      date: opts.today && opts.today < date ? opts.today : date,
      category: "Loan",
      method: opts.via || "",
      notes: opts.notes || "",
      loanId: loan.id,
      loanPaymentDate: date,
      ...(opts.billId ? { billId: opts.billId } : {}),
      ...(opts.source ? { source: opts.source } : {})
    };
    payload.expenses.push(expense);
  }
  const payment = { amount, date, expenseId: expense.id, ...(opts.scheduled !== false ? { scheduled: true } : {}), ...(opts.billId ? { billId: opts.billId } : {}) };
  loan.payments.unshift(payment);
  loan.updatedAt = now;
  return { result: "updated", payment, expense };
}

/**
 * Removes the payment of a loan on a date and the expense it created.
 * Returns { result, removedExpenseId } — the app must leave a delete tombstone
 * for removedExpenseId so sync does not bring it back.
 */
function removeLoanPayment(payload, loan, date) {
  if (!loan) return { result: "missing" };
  const payments = Array.isArray(loan.payments) ? loan.payments : [];
  const index = payments.findIndex(payment => payment.date === date);
  if (index === -1) return { result: "missing" };
  const [payment] = payments.splice(index, 1);
  loan.updatedAt = new Date().toISOString();
  let removedExpenseId = "";
  const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
  const expense = expenses.find(entry => (payment.expenseId && entry.id === payment.expenseId) || (entry.loanId === loan.id && entry.loanPaymentDate === date));
  // only an expense made for this loan payment, never one the user typed
  if (expense && expense.loanId === loan.id && !expense.billId) {
    payload.expenses = expenses.filter(entry => entry !== expense);
    removedExpenseId = expense.id;
  } else if (expense) {
    delete expense.loanId;
    delete expense.loanPaymentDate;
  }
  return { result: "updated", removedExpenseId };
}

// The loan's scheduled payment date in the same month as a bill's due date,
// so a linked bill ticks the right row of the loan schedule. Falls back to the
// bill's own date when the loan has no schedule (no first payment date).
function scheduleDateFor(loan, isoDate) {
  const first = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(loan.firstPaymentDate || loan.startDate || ""));
  const target = /^(\d{4})-(\d{2})/.exec(String(isoDate || ""));
  if (!first || !target) return isoDate;
  if (`${target[1]}-${target[2]}` < `${first[1]}-${first[2]}`) return isoDate;
  const day = Number(loan.paymentDay || 0) || Number(first[3]);
  const lastDay = new Date(Number(target[1]), Number(target[2]), 0).getDate();
  return `${target[1]}-${target[2]}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

// Loan payments still counted on their own (made before this change, or typed
// with no expense). New payments are counted through their expense instead.
function standaloneLoanPayments(loan) {
  return (loan.payments || []).filter(payment => !payment.expenseId);
}

/**
 * Read-only check for amounts that may be counted twice. Changes nothing.
 * Returns [{ type, loanId, loanName, billId, billName, month, amount, currency, message }]
 */
function findDoubleCounts(payload) {
  const loans = Array.isArray(payload.loans) ? payload.loans : [];
  const bills = Array.isArray(payload.bills) ? payload.bills : [];
  const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
  const same = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.01;
  const found = [];
  loans.forEach(loan => {
    if (!(Number(loan.monthlyPayment) > 0)) return;
    bills.filter(bill => !bill.loanId && same(bill.amount, loan.monthlyPayment) && (bill.currency || "") === (loan.currency || bill.currency || "")).forEach(bill => {
      found.push({ type: "bill-looks-like-loan", loanId: loan.id, loanName: loan.name, billId: bill.id, billName: bill.name, amount: Number(loan.monthlyPayment), currency: loan.currency || bill.currency });
      // months where the bill expense AND a standalone loan payment both exist
      const billMonths = new Set(expenses.filter(entry => entry.billId === bill.id).map(entry => String(entry.date || "").slice(0, 7)));
      standaloneLoanPayments(loan).forEach(payment => {
        const month = String(payment.date || "").slice(0, 7);
        if (billMonths.has(month) && same(payment.amount, bill.amount)) {
          found.push({ type: "counted-twice", loanId: loan.id, loanName: loan.name, billId: bill.id, billName: bill.name, month, amount: Number(payment.amount), currency: loan.currency || bill.currency });
        }
      });
    });
    // an expense typed by hand (not from a bill, not linked) with the same amount in a
    // month where the loan also has its own payment → the same money counted twice
    const cur = loan.currency || "";
    expenses
      .filter(entry => !entry.loanId && !entry.billId && same(entry.amount, loan.monthlyPayment) && (!cur || !entry.currency || entry.currency === cur))
      .forEach(entry => {
        const month = String(entry.date || "").slice(0, 7);
        const payment = standaloneLoanPayments(loan).find(item => String(item.date || "").slice(0, 7) === month && same(item.amount || loan.monthlyPayment, entry.amount));
        if (!payment) return;
        found.push({ type: "expense-counted-twice", loanId: loan.id, loanName: loan.name, expenseId: entry.id, expenseName: entry.description || entry.category || "", month, date: payment.date, amount: Number(entry.amount), currency: entry.currency || cur });
      });
  });
  return found;
}

/**
 * Links a typed expense to the loan payment of that month, so the money is counted
 * once (as the expense). Nothing is deleted. Returns { expense, payment } or null.
 */
function linkExpenseToPayment(payload, loanId, expenseId, date) {
  const loan = (payload.loans || []).find(item => item.id === loanId);
  const expense = (payload.expenses || []).find(item => item.id === expenseId);
  const payment = loan && findPayment(loan, date);
  if (!loan || !expense || !payment) return null;
  Object.assign(expense, { loanId: loan.id, loanPaymentDate: date, category: "Loan" });
  payment.expenseId = expense.id;
  return { expense, payment, loan };
}

const api = { recordLoanPayment, removeLoanPayment, scheduleDateFor, standaloneLoanPayments, findDoubleCounts, findPayment, linkExpenseToPayment };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.LoanPay = api;
})(typeof window !== "undefined" ? window : globalThis);
