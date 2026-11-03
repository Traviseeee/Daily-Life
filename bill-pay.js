/*
 * Bill payment rules shared by the server (Telegram ✅, auto-pay, utility receipts)
 * and the app (Smart Scan). Node: require("../js/bill-pay.js"); browser: window.BillPay.
 */
(function (root) {
const LoanPay = typeof module !== "undefined" && module.exports ? require("./loan-pay.js") : root.LoanPay;
// Marking a bill paid on the server (Telegram ✅ and auto-pay subscriptions).
// Same rules as markBillPaid() in js/dashboard.js: the bill moves to its next
// cycle and the payment is recorded as an expense (category Bills).

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

// Display the bill's date for its current recurring cycle. Older records can
// still point at the date they were created; when there is no recent payment
// date, keep the latest scheduled occurrence so overdue days do not accumulate
// across several missed cycles. A recent payment starts the next cycle.
function effectiveDueDate(bill, today) {
  const due = parseDate(bill?.due);
  const now = parseDate(today);
  if (!due || !now || (bill.frequency || "Monthly") === "Once") return bill?.due || "";
  const frequency = bill.frequency || "Monthly";
  const step = date => {
    if (frequency === "Daily") date.setDate(date.getDate() + 1);
    else if (frequency === "Weekly") date.setDate(date.getDate() + 7);
    else {
      const months = frequency === "Quarterly" ? 3 : frequency === "Yearly" ? 12 : 1;
      const day = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + months);
      date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    }
  };
  const lastPaid = parseDate(bill.lastPaidAt);
  if (lastPaid && lastPaid >= due) {
    while (due <= lastPaid) step(due);
    return dateInput(due);
  }
  if (due > now) return dateInput(due);
  while (due <= now) step(due);
  // due is now the next date; return the occurrence that just passed.
  const previous = new Date(due);
  if (frequency === "Daily") previous.setDate(previous.getDate() - 1);
  else if (frequency === "Weekly") previous.setDate(previous.getDate() - 7);
  else {
    const months = frequency === "Quarterly" ? 3 : frequency === "Yearly" ? 12 : 1;
    const day = previous.getDate();
    previous.setDate(1);
    previous.setMonth(previous.getMonth() - months);
    previous.setDate(Math.min(day, new Date(previous.getFullYear(), previous.getMonth() + 1, 0).getDate()));
  }
  return dateInput(previous);
}

// Same rules as markBillPaid() in js/dashboard.js.
// force: a real receipt says it was paid (the next cycle's due may still be ahead)
function markBillPaid(bill, today, force = false) {
  if (bill.status === "Paid") return "already";
  if (!force && bill.lastPaidAt && bill.due && bill.due > today) return "already";
  const frequency = bill.frequency || "Monthly";
  const changes = { status: "Paid", lastPaidAt: today, lastPaidDue: bill.due || "", lastPaidStatus: bill.status || "Upcoming" };
  const due = parseDate(bill.due);
  if (frequency !== "Once" && due) {
    const todayDate = parseDate(today);
    do {
      if (frequency === "Daily") due.setDate(due.getDate() + 1);
      else if (frequency === "Weekly") due.setDate(due.getDate() + 7);
      else {
        const months = frequency === "Quarterly" ? 3 : frequency === "Yearly" ? 12 : 1;
        const day = due.getDate();
        due.setDate(1);
        due.setMonth(due.getMonth() + months);
        due.setDate(Math.min(day, new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate()));
      }
    } while (due <= todayDate);
    changes.due = dateInput(due);
    changes.status = "Upcoming";
  }
  Object.assign(bill, changes, { updatedAt: new Date().toISOString() });
  return "updated";
}

// Marks paid and records the expense. Returns "updated", "already".
// paid: the real receipt ({ amount, currency, notes }) when it differs from the bill
function payBill(payload, bill, today, method = "Telegram", paid = {}) {
  const amount = Number(paid.amount) > 0 ? Number(paid.amount) : Number(bill.amount);
  const currency = paid.currency || bill.currency || payload.profile?.currency || "USD";
  const paymentType = paid.paymentType || bill.paymentType || "unspecified";
  const paymentLabel = ({ cash: "Cash", bank: "Bank Transfer", qr: "QR Payment", other: "Other" })[paymentType] || "";
  const result = markBillPaid(bill, today, Boolean(paid.force));
  const loan = bill.loanId ? (payload.loans || []).find(entry => entry.id === bill.loanId) : null;
  if (result === "updated" && amount > 0 && loan && LoanPay) {
    // a bill linked to a loan: ONE expense (category Loan) + the loan's payment for that due date
    const date = LoanPay.scheduleDateFor(loan, bill.lastPaidDue || today);
    const done = LoanPay.recordLoanPayment(payload, loan, date, { amount, currency, via: method, billId: bill.id, today, notes: paid.notes || "Bill", source: "telegram", paymentType, paymentMethod: paymentLabel });
    bill.lastPaidExpenseId = done.expense?.id || done.payment?.expenseId || "";
  } else if (result === "updated" && amount > 0) {
    payload.expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
    const existing = payload.expenses.find(entry => entry.billId === bill.id && entry.date === today);
    const expenseId = existing?.id || `expenses-bill-${bill.id}-${Date.now()}`;
    if (!existing) {
      const now = new Date().toISOString();
      payload.expenses.push({ id: expenseId, createdAt: now, updatedAt: now, description: bill.name || "Bill", amount, currency, date: today, category: "Bills", method: paymentLabel || method, paymentType, notes: paid.notes || "Bill", billId: bill.id, source: "telegram" });
    }
    bill.lastPaidExpenseId = expenseId;
  }
  // lets the app say "paid from Telegram" (the app's own ✓ never sets this)
  if (result === "updated") Object.assign(bill, { paidAt: new Date().toISOString(), paidVia: method });
  return result;
}

const api = { markBillPaid, payBill, parseDate, dateInput, effectiveDueDate };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.BillPay = api;
})(typeof window !== "undefined" ? window : globalThis);
