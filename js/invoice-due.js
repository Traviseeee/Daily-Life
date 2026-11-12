/*
 * MYLIFE invoices — shared rules for the app and the server (12 Nov 2026).
 * appData.invoices = [{ id, number, client, date, due, currency, items[{ desc, qty, price }], status, paidAt, incomeId }]
 *
 * - total(inv)
 * - alerts(invoices, today, opts): unpaid ones on the due day ("due") and every 3 days after ("late")
 * - markPaid(payload, id, o): status paid + one income (Freelance, once) — what the Telegram ✅ button writes
 */
(function (root) {
  const DAY = 864e5;
  const toTime = iso => Date.parse(`${iso}T00:00:00Z`);
  const daysBetween = (a, b) => Math.round((toTime(b) - toTime(a)) / DAY);
  const total = inv => (inv?.items || []).reduce((t, item) => t + Number(item.qty || 0) * Number(item.price || 0), 0);

  function alerts(invoices, today, opts = {}) {
    const out = [];
    (Array.isArray(invoices) ? invoices : []).forEach(inv => {
      if (!inv || inv.status === "paid" || !/^\d{4}-\d{2}-\d{2}$/.test(String(inv.due || ""))) return;
      if (!(total(inv) > 0)) return;
      const gap = daysBetween(today, inv.due); // >0 to go, 0 today, <0 late
      let stage = "";
      if (gap === 0) stage = "due";
      else if (gap < 0 && opts.repeat !== false && -gap % 3 === 0) stage = "late";
      if (stage) out.push({ invoice: inv, stage, gap, amount: total(inv) });
    });
    return out;
  }

  function markPaid(payload, id, o = {}) {
    const inv = (payload.invoices || []).find(item => item.id === id);
    if (!inv) return { result: "missing" };
    if (inv.status === "paid") return { result: "already", invoice: inv };
    const now = new Date().toISOString();
    const amount = total(inv);
    payload.income = Array.isArray(payload.income) ? payload.income : [];
    const income = { id: o.makeId ? o.makeId("income") : `income-${Date.now().toString(36)}`, name: `🧾 ${inv.client || ""} · ${inv.number || ""}`.trim(), amount, currency: inv.currency || "USD", category: "Freelance", accountType: "unspecified", frequency: "Once", recurring: false, ask: false, nextPaymentDate: o.today, notes: inv.number || "", source: o.via === "Telegram" ? "telegram" : "", createdAt: now, updatedAt: now };
    payload.income.push(income);
    Object.assign(inv, { status: "paid", paidAt: now, incomeId: income.id, updatedAt: now });
    return { result: "updated", invoice: inv, income };
  }

  const api = { total, alerts, markPaid, daysBetween };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.InvoiceDue = api;
})(typeof window !== "undefined" ? window : globalThis);
