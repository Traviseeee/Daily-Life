// Loans, bills, expenses: one real payment is counted once.
// Uses the shared rules (js/loan-pay.js, js/bill-pay.js) that the app, auto-pay
// and the Telegram ✅ button all call. Made-up data only.
// Run: node tools/verify-loan-bill.js
const path = require("path");
const LoanPay = require(path.join(__dirname, "../js/loan-pay.js"));
const { payBill } = require(path.join(__dirname, "../js/bill-pay.js"));

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log(`FAIL ${name}`, extra); } };
const clone = v => JSON.parse(JSON.stringify(v));

// what the money summary subtracts for a month: expenses + loan payments without an expense
const monthOut = (p, month) =>
  (p.expenses || []).filter(e => String(e.date).startsWith(month)).reduce((t, e) => t + Number(e.amount), 0) +
  (p.loans || []).flatMap(l => LoanPay.standaloneLoanPayments(l)).filter(x => String(x.date).startsWith(month)).reduce((t, x) => t + Number(x.amount), 0);

const base = () => ({
  profile: { currency: "USD" },
  loans: [{ id: "loan-car", name: "Car loan", originalAmount: 12000, monthlyPayment: 344.84, currency: "USD", durationMonths: 36, firstPaymentDate: "2026-09-25", payments: [] }],
  bills: [],
  expenses: []
});

/* unpaid bill: nothing spent */
let p = base();
p.bills.push({ id: "bill-1", name: "Car loan", amount: 344.84, currency: "USD", due: "2026-10-25", frequency: "Monthly", status: "Upcoming" });
check("unpaid bill → no expense", p.expenses.length === 0 && monthOut(p, "2026-10") === 0);

/* paid bill (not linked) → one Bills expense, Paid twice → still one */
p = base();
p.bills.push({ id: "bill-1", name: "Wi-Fi", amount: 20, currency: "USD", due: "2026-10-21", frequency: "Monthly", status: "Upcoming" });
check("paid bill → updated", payBill(p, p.bills[0], "2026-10-21", "App") === "updated");
check("paid bill → 1 expense (Bills)", p.expenses.length === 1 && p.expenses[0].category === "Bills" && p.expenses[0].amount === 20);
check("Paid again → already, still 1 expense", payBill(p, p.bills[0], "2026-10-21", "Telegram") === "already" && p.expenses.length === 1);

/* loan payment from the schedule / Telegram ✅ → 1 payment + 1 Loan expense; repeat → already */
p = base();
let r = LoanPay.recordLoanPayment(p, p.loans[0], "2026-10-25", { today: "2026-10-25" });
check("loan ✓ → payment + expense", r.result === "updated" && p.loans[0].payments.length === 1 && p.expenses.length === 1);
check("loan expense is category Loan, $344.84, linked", p.expenses[0].category === "Loan" && p.expenses[0].amount === 344.84 && p.expenses[0].loanId === "loan-car" && p.loans[0].payments[0].expenseId === p.expenses[0].id);
check("loan ✓ again (double click / Telegram retry) → already", LoanPay.recordLoanPayment(p, p.loans[0], "2026-10-25").result === "already" && p.expenses.length === 1 && p.loans[0].payments.length === 1);
check("month summary counts $344.84 once", Math.abs(monthOut(p, "2026-10") - 344.84) < 0.001, monthOut(p, "2026-10"));
r = LoanPay.removeLoanPayment(p, p.loans[0], "2026-10-25");
check("untick → payment and its expense removed", r.removedExpenseId && p.expenses.length === 0 && p.loans[0].payments.length === 0);

/* paying early: expense on the day money left, payment on the schedule date */
p = base();
LoanPay.recordLoanPayment(p, p.loans[0], "2026-10-25", { today: "2026-10-20" });
check("early payment: expense dated today, schedule date kept", p.expenses[0].date === "2026-10-20" && p.loans[0].payments[0].date === "2026-10-25");

/* partial payments: two different days → two payments, two expenses, both counted once */
p = base();
LoanPay.recordLoanPayment(p, p.loans[0], "2026-10-10", { amount: 100, scheduled: false });
LoanPay.recordLoanPayment(p, p.loans[0], "2026-10-20", { amount: 244.84, scheduled: false });
check("partial payments → 2 expenses", p.expenses.length === 2 && p.loans[0].payments.length === 2);
check("partial payments → month counts 344.84", Math.abs(monthOut(p, "2026-10") - 344.84) < 0.001);

/* bill LINKED to the loan → one Loan expense + the loan payment, never twice */
p = base();
p.bills.push({ id: "bill-1", name: "Car loan", amount: 344.84, currency: "USD", due: "2026-10-25", frequency: "Monthly", status: "Upcoming", loanId: "loan-car" });
check("linked bill Paid → updated", payBill(p, p.bills[0], "2026-10-25", "Telegram") === "updated");
check("linked bill → 1 expense (Loan) + 1 loan payment", p.expenses.length === 1 && p.expenses[0].category === "Loan" && p.loans[0].payments.length === 1 && p.loans[0].payments[0].date === "2026-10-25");
check("linked bill → bill remembers the expense", p.bills[0].lastPaidExpenseId === p.expenses[0].id && p.bills[0].due === "2026-11-25");
check("linked bill + loan ✓ same date → already", LoanPay.recordLoanPayment(p, p.loans[0], "2026-10-25").result === "already" && p.expenses.length === 1);
check("linked bill → month counts $344.84 once (was 689.68)", Math.abs(monthOut(p, "2026-10") - 344.84) < 0.001, monthOut(p, "2026-10"));

/* linked bill due on another day of the month → ticks the loan's own schedule date */
p = base();
p.bills.push({ id: "bill-1", name: "Car loan", amount: 344.84, currency: "USD", due: "2026-10-28", frequency: "Monthly", status: "Upcoming", loanId: "loan-car" });
payBill(p, p.bills[0], "2026-10-28", "App");
check("linked bill (due 28th) → loan payment on schedule date 25th", p.loans[0].payments[0]?.date === "2026-10-25", JSON.stringify(p.loans[0].payments));
check("scheduleDateFor: short month keeps last day", LoanPay.scheduleDateFor({ firstPaymentDate: "2026-01-31" }, "2026-02-10") === "2026-02-28");
check("scheduleDateFor: no schedule → bill date", LoanPay.scheduleDateFor({}, "2026-10-28") === "2026-10-28");

/* loan already ticked (old way, no expense) then the linked bill is paid → still once */
p = base();
p.loans[0].payments.push({ amount: 344.84, date: "2026-10-25", scheduled: true });
p.bills.push({ id: "bill-1", name: "Car loan", amount: 344.84, currency: "USD", due: "2026-10-25", frequency: "Monthly", status: "Upcoming", loanId: "loan-car" });
payBill(p, p.bills[0], "2026-10-25", "App");
check("old loan payment + linked bill → counted once", p.expenses.length === 0 && Math.abs(monthOut(p, "2026-10") - 344.84) < 0.001, monthOut(p, "2026-10"));

/* existing data stays the same: old payments (no expenseId) still count */
p = base();
p.loans[0].payments.push({ amount: 344.84, date: "2026-09-25", scheduled: true });
const before = clone(p);
check("old payments keep counting in the summary", Math.abs(monthOut(p, "2026-09") - 344.84) < 0.001);
check("reading old data changes nothing", JSON.stringify(p) === JSON.stringify(before));

/* read-only double-count check */
p = base();
p.loans[0].payments.push({ amount: 344.84, date: "2026-10-25", scheduled: true });
p.bills.push({ id: "bill-1", name: "Car loan bill", amount: 344.84, currency: "USD", due: "2026-11-25", status: "Upcoming", lastPaidAt: "2026-10-25" });
p.expenses.push({ id: "e1", amount: 344.84, currency: "USD", date: "2026-10-25", category: "Bills", billId: "bill-1" });
const snapshot = JSON.stringify(p);
const found = LoanPay.findDoubleCounts(p);
check("check finds the bill that looks like the loan", found.some(x => x.type === "bill-looks-like-loan" && x.billId === "bill-1"));
check("check finds the month counted twice", found.some(x => x.type === "counted-twice" && x.month === "2026-10"));
check("check changes nothing", JSON.stringify(p) === snapshot);
p.bills[0].loanId = "loan-car";
check("after linking, the bill is no longer flagged", !LoanPay.findDoubleCounts(p).some(x => x.billId === "bill-1"));
check("unrelated bill is not flagged", LoanPay.findDoubleCounts({ ...base(), bills: [{ id: "b", name: "Wi-Fi", amount: 20 }] }).length === 0);

/* JSON round trip (export → import) keeps the links */
p = base();
LoanPay.recordLoanPayment(p, p.loans[0], "2026-10-25");
const back = JSON.parse(JSON.stringify(p));
check("JSON export/import keeps payment ↔ expense link", back.loans[0].payments[0].expenseId === back.expenses[0].id && LoanPay.recordLoanPayment(back, back.loans[0], "2026-10-25").result === "already");

console.log(`\n${pass}/${pass + fail} loan/bill checks passed`);
process.exit(fail ? 1 : 0);
