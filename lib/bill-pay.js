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

// Same rules as markBillPaid() in js/dashboard.js.
function markBillPaid(bill, today) {
  if (bill.status === "Paid") return "already";
  if (bill.lastPaidAt && bill.due && bill.due > today) return "already";
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
function payBill(payload, bill, today, method = "Telegram") {
  const result = markBillPaid(bill, today);
  if (result === "updated" && Number(bill.amount) > 0) {
    payload.expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
    const existing = payload.expenses.find(entry => entry.billId === bill.id && entry.date === today);
    const expenseId = existing?.id || `expenses-bill-${bill.id}-${Date.now()}`;
    if (!existing) {
      const now = new Date().toISOString();
      payload.expenses.push({ id: expenseId, createdAt: now, updatedAt: now, description: bill.name || "Bill", amount: Number(bill.amount), currency: bill.currency || payload.profile?.currency || "USD", date: today, category: "Bills", method, notes: "Bill", billId: bill.id, source: "telegram" });
    }
    bill.lastPaidExpenseId = expenseId;
  }
  return result;
}

module.exports = { markBillPaid, payBill, parseDate, dateInput };
