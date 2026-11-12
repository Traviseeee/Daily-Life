/*
 * MYLIFE vehicle care — shared rules for the app and the server (12 Nov 2026).
 * appData.vehicles = [{ id, name, kind, plate, odometer, odoLog[{date,km}], services[{key,everyKm,everyMonths,lastKm,lastDate}], log[] }]
 *
 * - kmPerDay: average km a day from the km readings of the last ~6 months
 * - status(vehicle, svc, today): how far along a service is (0..1+), when it falls due
 * - alerts(vehicles, today, opts): today's reminders — "soon" (3 days before), "due" (on the day),
 *   "again" (every 3 days after, until it is logged)
 * - logService / setOdometer: what ✓ Done and the km answer write (used by the Telegram buttons)
 */
(function (root) {
  const DAY = 864e5;
  const NAMES = { oil: ["ប្តូរប្រេង", "Oil change"], tires: ["កង់ / សំបក", "Tires"], battery: ["អាគុយ", "Battery"], insurance: ["ពន្ធ / ធានារ៉ាប់រង", "Tax / insurance"], other: ["ជួសជុល", "Repair"] };
  const EMOJI = { oil: "🛢️", tires: "🛞", battery: "🔋", insurance: "📄", other: "🔧" };

  const toTime = iso => Date.parse(`${iso}T00:00:00Z`);
  const daysBetween = (a, b) => Math.round((toTime(b) - toTime(a)) / DAY);
  const addDays = (iso, n) => new Date(toTime(iso) + n * DAY).toISOString().slice(0, 10);
  function addMonths(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
  }
  function monthsBetween(from, to) {
    const [ay, am, ad] = from.split("-").map(Number);
    const [by, bm, bd] = to.split("-").map(Number);
    return (by - ay) * 12 + (bm - am) + (bd - ad) / 30;
  }

  function points(v) {
    return [...(v.odoLog || []), ...(v.log || []).filter(item => item.km != null && item.km !== "").map(item => ({ date: item.date, km: item.km }))]
      .map(pt => ({ date: String(pt.date || ""), km: Number(pt.km) }))
      .filter(pt => /^\d{4}-\d{2}-\d{2}$/.test(pt.date) && pt.km > 0)
      .sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
  }
  function kmPerDay(v) {
    const pts = points(v);
    if (pts.length < 2) return null;
    const last = pts[pts.length - 1];
    const from = pts.find(pt => daysBetween(pt.date, last.date) <= 183) || pts[0];
    const days = daysBetween(from.date, last.date);
    if (days < 3 || last.km <= from.km) return null;
    return (last.km - from.km) / days;
  }
  function estimateKm(v, today) {
    const pts = points(v);
    const last = pts[pts.length - 1];
    const base = Math.max(Number(v.odometer || 0), last ? last.km : 0);
    const rate = kmPerDay(v);
    if (!rate || !last) return base;
    return Math.round((base + rate * Math.max(0, daysBetween(last.date, today))) / 10) * 10;
  }

  // { p, kmLeft, dueDate } — dueDate: the day it falls due (by months, or by km at the usual pace)
  function status(v, svc, today) {
    const est = Math.max(Number(v.odometer || 0), estimateKm(v, today));
    const rate = kmPerDay(v);
    const hasKm = svc.everyKm && svc.lastKm != null && svc.lastKm !== "";
    const kmUsed = hasKm ? est - Number(svc.lastKm) : null;
    const moUsed = svc.everyMonths && svc.lastDate ? monthsBetween(svc.lastDate, today) : null;
    const parts = [];
    if (kmUsed != null) parts.push(kmUsed / svc.everyKm);
    if (moUsed != null) parts.push(moUsed / svc.everyMonths);
    if (!parts.length) return { p: null };
    const kmLeft = kmUsed != null ? svc.everyKm - kmUsed : null;
    const dates = [];
    if (moUsed != null) dates.push(addMonths(svc.lastDate, svc.everyMonths));
    if (kmLeft != null && rate) dates.push(addDays(today, Math.ceil(kmLeft / rate)));
    // over by km with no pace known: count from the last service day
    if (kmLeft != null && kmLeft <= 0 && !rate && !dates.length) dates.push(svc.lastDate || today);
    const dueDate = dates.length ? dates.sort()[0] : null;
    return { p: Math.max(...parts), kmLeft, dueDate, rate, est };
  }

  // today's reminders; opts: { soon: true, repeat: true }
  function alerts(vehicles, today, opts = {}) {
    const out = [];
    (Array.isArray(vehicles) ? vehicles : []).forEach(v => {
      (v.services || []).forEach(svc => {
        const st = status(v, svc, today);
        if (st.p == null || !st.dueDate) return;
        const gap = daysBetween(today, st.dueDate); // >0 days to go, 0 today, <0 late
        let stage = "";
        if (gap === 3 && opts.soon !== false) stage = "soon";
        else if (gap === 0) stage = "due";
        else if (gap < 0 && st.p >= 1 && opts.repeat !== false && -gap % 3 === 0) stage = "again";
        if (!stage) return;
        out.push({ vehicle: v, svc, stage, gap, ...st });
      });
    });
    return out;
  }

  const last = (v, key) => (v.log || []).filter(item => item.service === key).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
  const name = (key, km = true) => (NAMES[key] || NAMES.other)[km ? 0 : 1];

  function odoEntry(v, km, date) {
    const log = (v.odoLog || []).filter(pt => pt.date !== date);
    return [...log, { date, km: Number(km) }].sort((a, b) => a.date.localeCompare(b.date)).slice(-40);
  }

  // ✓ Done from Telegram: one log line (last price / shop), service reset, one Transport expense
  function logService(payload, vehicleId, key, o = {}) {
    const v = (payload.vehicles || []).find(item => item.id === vehicleId);
    if (!v) return { result: "missing" };
    const today = o.today;
    const svc = (v.services || []).find(item => item.key === key);
    if (svc && svc.lastDate === today) return { result: "already", vehicle: v };
    const prev = last(v, key);
    const km = o.km != null ? Number(o.km) : estimateKm(v, today);
    const cost = o.cost != null ? Number(o.cost) : Number(prev?.cost || 0);
    const currency = o.currency || prev?.currency || (payload.profile || {}).currency || "USD";
    const now = new Date().toISOString();
    const entry = { id: o.makeId ? o.makeId("vlog") : `vlog-${Date.now().toString(36)}`, date: today, service: key, title: name(key), km: km || null, cost, currency, shop: prev?.shop || "", via: o.via || "Telegram" };
    if (cost > 0 && o.expense !== false) {
      payload.expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
      const expense = { id: o.makeId ? o.makeId("expenses") : `exp-${Date.now().toString(36)}`, description: `${v.kind === "car" ? "🚗" : "🏍️"} ${v.name} · ${name(key)}`, amount: cost, currency, category: "Transport", date: today, notes: entry.shop, source: "telegram", createdAt: now, updatedAt: now };
      payload.expenses.push(expense);
      entry.expenseId = expense.id;
    }
    v.log = [...(v.log || []), entry];
    v.services = (v.services || []).map(item => (item.key === key ? { ...item, lastDate: today, lastKm: km || item.lastKm } : item));
    if (km) { v.odometer = Math.max(Number(v.odometer || 0), km); v.odoLog = odoEntry(v, km, today); }
    v.updatedAt = now;
    return { result: "updated", vehicle: v, entry };
  }

  function setOdometer(payload, vehicleId, km, today) {
    const v = (payload.vehicles || []).find(item => item.id === vehicleId);
    if (!v) return "missing";
    if (!(Number(km) > 0)) return "missing";
    v.odometer = Number(km);
    v.odoLog = odoEntry(v, km, today);
    v.updatedAt = new Date().toISOString();
    return "updated";
  }

  /* ⛽ fuel (12 Nov): the same record the app's fill-up form writes (js/vehicle-tool.js) */
  const RATE = 4100;
  const conv = (value, from, to) => (from === to ? value : from === "KHR" ? value / RATE : value * RATE);
  const FUEL_PRICE = { USD: 1.25, KHR: 5000 };
  const fuelList = v => (Array.isArray(v.fuel) ? v.fuel : []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.km || 0) - Number(b.km || 0));
  function fuelPrice(v, currency) {
    const lastFill = fuelList(v).reverse().find(item => Number(item.liters) > 0 && Number(item.cost) > 0);
    return lastFill ? conv(Number(lastFill.cost) / Number(lastFill.liters), lastFill.currency || "USD", currency) : FUEL_PRICE[currency] || FUEL_PRICE.USD;
  }
  // this month's spend (in `currency`) and km a litre
  function fuelStats(v, today, currency = "USD") {
    const list = fuelList(v);
    const spent = list.filter(item => String(item.date).startsWith(String(today).slice(0, 7))).reduce((t, item) => t + conv(Number(item.cost || 0), item.currency || "USD", currency), 0);
    const withKm = list.filter(item => Number(item.km) > 0 && !item.kmGuessed); // a guessed km would skew km/L
    if (withKm.length < 2) return { spent, kmL: null };
    const span = Number(withKm[withKm.length - 1].km) - Number(withKm[0].km);
    const liters = withKm.slice(0, -1).reduce((t, item) => t + Number(item.liters || 0), 0);
    return { spent, kmL: span > 0 && liters > 0 ? span / liters : null };
  }
  function logFuel(payload, vehicleId, o = {}) {
    const v = (payload.vehicles || []).find(item => item.id === vehicleId);
    if (!v) return { result: "missing" };
    const cost = Number(o.cost || 0);
    if (!(cost > 0)) return { result: "missing" };
    const currency = o.currency || (payload.profile || {}).currency || "USD";
    const liters = Number(o.liters || 0) || Math.round(cost / fuelPrice(v, currency) * 10) / 10;
    const typed = o.km != null && Number(o.km) > 0;
    const km = typed ? Number(o.km) : estimateKm(v, o.today) || null;
    const now = new Date().toISOString();
    const entry = { id: o.makeId ? o.makeId("fuel") : `fuel-${Date.now().toString(36)}`, date: o.today, cost, currency, liters, km, kmGuessed: !typed, via: o.via || "Telegram" };
    if (o.expense !== false) {
      payload.expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
      const expense = { id: o.makeId ? o.makeId("expenses") : `exp-${Date.now().toString(36)}`, description: `⛽ ${v.name} · សាំង`, amount: cost, currency, category: "Transport", date: o.today, notes: `${liters} L`, source: "telegram", createdAt: now, updatedAt: now };
      payload.expenses.push(expense);
      entry.expenseId = expense.id;
    }
    v.fuel = [...(Array.isArray(v.fuel) ? v.fuel : []), entry].slice(-200);
    if (typed) { v.odometer = Math.max(Number(v.odometer || 0), km); v.odoLog = odoEntry(v, km, o.today); }
    v.updatedAt = now;
    return { result: "updated", vehicle: v, entry };
  }

  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  // "2027-01-12" → "12 មករា 2027" (year only when not this year)
  function kmDate(iso, today) {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-").map(Number);
    return `${d} ${KM_M[m - 1]}${today && String(today).slice(0, 4) === String(y) ? "" : ` ${y}`}`;
  }

  const api = { fuelPrice, fuelStats, logFuel, kmDate, NAMES, EMOJI, name, points, kmPerDay, estimateKm, status, alerts, last, logService, setOdometer, addDays, daysBetween };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VehicleDue = api;
})(typeof window !== "undefined" ? window : globalThis);
