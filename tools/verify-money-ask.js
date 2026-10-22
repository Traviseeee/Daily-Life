// "Did you get / pay it?" rules (js/money-due.js): what is asked, and that an
// answer is saved once (app pop-up, Telegram ✅, both). Made-up data only.
// Run: node tools/verify-money-ask.js
const path = require("path");
const MoneyDue = require(path.join(__dirname, "../js/money-due.js"));
const LoanPay = require(path.join(__dirname, "../js/loan-pay.js"));
const { payBill } = require(path.join(__dirname, "../js/bill-pay.js"));

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log(`FAIL ${name}`, extra); } };
const kinds = list => list.map(item => `${item.kind}:${item.title}`).join(",");

const base = () => ({
  profile: { currency: "USD" },
  income: [
    { id: "sal", name: "Salary", amount: 800, currency: "USD", frequency: "Monthly", recurring: true, nextPaymentDate: "2026-08-05" },
    { id: "free", name: "Freelance", amount: 120, currency: "USD", frequency: "Once", recurring: false, nextPaymentDate: "2026-10-20" },
    { id: "wk", name: "Weekly tips", amount: 10, currency: "USD", frequency: "Weekly", nextPaymentDate: "2026-10-01" }
  ],
  bills: [
    { id: "edc", name: "EDC", amount: 40000, currency: "KHR", due: "2026-10-06", frequency: "Monthly", status: "Upcoming" },
    { id: "netflix", name: "Netflix", amount: 9.99, currency: "USD", due: "2026-10-06", frequency: "Monthly", status: "Upcoming", autoPay: true },
    { id: "wifi", name: "Wi-Fi", amount: 20, currency: "USD", due: "2026-10-25", frequency: "Monthly", status: "Upcoming" }
  ],
  loans: [{ id: "car", name: "Car loan", monthlyPayment: 344.84, currency: "USD", firstPaymentDate: "2026-01-06", durationMonths: 36, payments: [] }],
  expenses: []
});

/* before the day: nothing */
let p = base();
check("day 4: nothing to ask", MoneyDue.dueToday(p, "2026-10-04").length === 0, kinds(MoneyDue.dueToday(p, "2026-10-04")));

/* salary day 5 */
check("day 5: salary asked", kinds(MoneyDue.dueToday(p, "2026-10-05")) === "income:Salary");
/* day 6: salary still open + bill + loan (auto-pay bill not asked) */
const day6 = MoneyDue.dueToday(p, "2026-10-06");
check("day 6: salary, EDC bill, car loan (not Netflix auto-pay, not Wi-Fi later)", kinds(day6) === "income:Salary,bill:EDC,loan:Car loan", kinds(day6));
check("weekly income is not asked", !day6.some(item => item.title === "Weekly tips"));
check("once income asked only on/after its own day", kinds(MoneyDue.dueToday(p, "2026-10-20")).includes("Freelance") && !kinds(MoneyDue.dueToday(p, "2026-11-20")).includes("Freelance"));

/* salary: received once */
const sal = p.income[0];
check("salary received → updated", MoneyDue.recordIncomeReceived(sal, "2026-10", { date: "2026-10-05", via: "App" }) === "updated");
check("received again (double tap / Telegram) → already", MoneyDue.recordIncomeReceived(sal, "2026-10", { via: "Telegram" }) === "already");
check("received amount kept", sal.received["2026-10"].amount === 800 && sal.received["2026-10"].via === "App");
check("salary no longer asked this month", !MoneyDue.dueToday(p, "2026-10-06").some(item => item.kind === "income"));
check("salary asked again next month on day 5", MoneyDue.dueToday(p, "2026-11-05").some(item => item.kind === "income"));
/* other amount */
const other = base().income[0];
MoneyDue.recordIncomeReceived(other, "2026-10", { amount: 760 });
check("other amount saved", other.received["2026-10"].amount === 760);
/* short month: day 31 salary in February → 28th */
check("salary on 31st → Feb 28", MoneyDue.incomeDateInMonth({ amount: 1, nextPaymentDate: "2026-01-31", frequency: "Monthly" }, "2026-02") === "2026-02-28");
check("not before the first month", MoneyDue.incomeDateInMonth(sal, "2026-07") === "");

/* bill paid (app or Telegram) → not asked; paid twice → one expense */
p = base();
payBill(p, p.bills[0], "2026-10-06", "Telegram");
check("bill paid on Telegram → app does not ask it", !MoneyDue.dueToday(p, "2026-10-06").some(item => item.kind === "bill"));
check("pay again → already, 1 expense", payBill(p, p.bills[0], "2026-10-06", "App") === "already" && p.expenses.length === 1);

/* loan paid → not asked; twice → once */
p = base();
LoanPay.recordLoanPayment(p, p.loans[0], "2026-10-06", { today: "2026-10-06" });
check("loan paid → not asked", !MoneyDue.dueToday(p, "2026-10-06").some(item => item.kind === "loan"));
check("loan paid again → already", LoanPay.recordLoanPayment(p, p.loans[0], "2026-10-06").result === "already" && p.expenses.length === 1);

/* bill linked to the loan → asked once (as the bill) */
p = base();
p.bills.push({ id: "carbill", name: "Car loan bill", amount: 344.84, currency: "USD", due: "2026-10-06", frequency: "Monthly", status: "Upcoming", loanId: "car" });
const linked = MoneyDue.dueToday(p, "2026-10-06");
check("linked bill + loan → asked once", linked.filter(item => item.title.startsWith("Car")).length === 1 && linked.some(item => item.id === "carbill"), kinds(linked));

/* overdue keeps asking; finished loan not asked */
p = base();
check("EDC still asked 3 days late", MoneyDue.dueToday(p, "2026-10-09").find(item => item.id === "edc")?.overdueDays === 3);
p.loans[0].dueDate = "2026-09-06";
check("finished loan not asked", !MoneyDue.dueToday(p, "2026-10-06").some(item => item.kind === "loan"));

/* old data (no received field) still works */
const old = { profile: {}, income: [{ id: "x", name: "Old salary", amount: 500, nextPaymentDate: "2025-01-05" }] };
check("old income without frequency = monthly", MoneyDue.dueToday(old, "2026-10-05").length === 1);

console.log(`\n${pass}/${pass + fail} money-ask checks passed`);
process.exit(fail ? 1 : 0);
