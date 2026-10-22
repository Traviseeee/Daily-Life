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

/* per item "don't ask" */
p = base();
p.income[0].ask = false; p.bills[0].reminder = false; p.loans[0].ask = false;
check("ask off on salary / bill reminder off / loan ask off → nothing asked", MoneyDue.dueToday(p, "2026-10-06").length === 0, kinds(MoneyDue.dueToday(p, "2026-10-06")));

/* old data (no received field) still works */
const old = { profile: {}, income: [{ id: "x", name: "Old salary", amount: 500, nextPaymentDate: "2025-01-05" }] };
check("old income without frequency = monthly", MoneyDue.dueToday(old, "2026-10-05").length === 1);

/* audit 2026-10-22: one-off income logged after the fact is not asked */
p = base();
p.income[1].createdAt = "2026-10-20T08:00:00Z";
check("one-off income logged on its day → not asked", !MoneyDue.dueToday(p, "2026-10-20").some(item => item.title === "Freelance"));
p.income[1].createdAt = "2026-10-01T08:00:00Z";
check("one-off income planned earlier → asked on its day", MoneyDue.dueToday(p, "2026-10-20").some(item => item.title === "Freelance"));

/* reports use the real received amount (server image = app report) */
const MoneyInsights = require(path.join(__dirname, "../js/money-insights.js"));
p = base(); p.income = [p.income[0]];
check("income this month = planned before answer", MoneyInsights.incomeThisMonth(p, "2026-10") === 800);
MoneyDue.recordIncomeReceived(p.income[0], "2026-10", { amount: 760, date: "2026-10-05" });
check("income this month = received 760 after answer", MoneyInsights.incomeThisMonth(p, "2026-10") === 760);
check("weekly income counts the received day", MoneyInsights.incomeBetween(p, "2026-10-01", "2026-10-07") === 760 && MoneyInsights.incomeBetween(p, "2026-10-08", "2026-10-14") === 0);

/* Telegram loan alert follows the app rules (ask off / linked bill) */
const Module = require("module");
const realLoad = Module._load;
Module._load = function (request, ...rest) { // dispatch needs these only for sending
  if (/^@supabase|^@upstash|web-push/.test(request)) return {};
  return realLoad.call(this, request, ...rest);
};
let dispatch = null;
try { dispatch = require(path.join(__dirname, "../api/dispatch.js")); } catch (error) { console.log("skip dispatch:", error.message); }
Module._load = realLoad;
if (dispatch && dispatch.notificationItems) {
  const loanAlerts = payload => dispatch.notificationItems(payload).filter(item => item.kind === "loan");
  const today = dispatch.zonedTodayInput();
  const lp = () => ({ profile: {}, bills: [], income: [], loans: [{ id: "car", name: "Car loan", monthlyPayment: 100, currency: "USD", firstPaymentDate: today, durationMonths: 12, payments: [] }] });
  check("Telegram: loan alert normally sent", loanAlerts(lp()).length > 0);
  const off = lp(); off.loans[0].ask = false;
  check("Telegram: loan ask off → no alert", loanAlerts(off).length === 0);
  const linkedP = lp(); linkedP.bills.push({ id: "b", name: "Car bill", amount: 100, due: today, loanId: "car" });
  check("Telegram: loan with linked bill → only the bill alerts", loanAlerts(linkedP).length === 0 && dispatch.notificationItems(linkedP).some(item => item.kind === "bill"));
}

/* savings reminder on salary day */
p = base();
check("savings day = salary day 5", MoneyDue.savingsDayInMonth(p, "2026-10") === "2026-10-05");
check("savings day = 1st with no salary", MoneyDue.savingsDayInMonth({ income: [] }, "2026-10") === "2026-10-01");
if (dispatch && dispatch.digestItem) {
  const today = dispatch.zonedTodayInput();
  const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 3);
  const late = d.toISOString().slice(0, 10);
  const dg = dispatch.digestItem({ profile: {}, income: [], bills: [{ id: "b", name: "Water", amount: 5, due: late, status: "Upcoming" }, { id: "n", name: "Netflix", amount: 9, due: late, status: "Upcoming", autoPay: true }], loans: [{ id: "l", name: "Car", monthlyPayment: 100, firstPaymentDate: late, durationMonths: 12, payments: [] }] }, today);
  const kindsOpen = dg.digest.overdue.map(e => `${e.kind}:${e.title}`).join(",");
  check("digest 'still open' = late bill + late loan, not auto-pay", kindsOpen === "bill:Water,loan:Car", kindsOpen);
}

console.log(`\n${pass}/${pass + fail} money-ask checks passed`);
process.exit(fail ? 1 : 0);
