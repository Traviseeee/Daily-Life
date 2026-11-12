/* MYLIFE Vehicle care (#vehicle, 8 Nov 2026 · draft A): one purple card per motorbike / car
 * (name, plate, km), service bars that fill up by km or by months (amber = soon, red = due),
 * a "due now" card with ✓ Done, this year's cost and a short history.
 * Data: appData.vehicles = [{ id, name, kind, plate, year, odometer, services[], log[] }],
 * synced with the rest of the payload. Logging a service can also add an expense (Transport). */
const VehicleTool = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const PICK_KEY = "mylife:vehicle-picked";
  const SERVICES = {
    moto: [["oil", "🛢️", 2000, 2], ["tires", "🛞", 10000, 0], ["battery", "🔋", 0, 24], ["insurance", "📄", 0, 12]],
    car: [["oil", "🛢️", 5000, 6], ["tires", "🛞", 40000, 0], ["battery", "🔋", 0, 36], ["insurance", "📄", 0, 12]]
  };
  const NAMES = () => ({ oil: L("ប្តូរប្រេង", "Oil change"), tires: L("កង់ / សំបក", "Tires"), battery: L("អាគុយ", "Battery"), insurance: L("ពន្ធ / ធានារ៉ាប់រង", "Tax / insurance"), other: L("ជួសជុលផ្សេងៗ", "Other repair") });
  const EMOJI = { oil: "🛢️", tires: "🛞", battery: "🔋", insurance: "📄", other: "🔧" };

  const list = () => (Array.isArray(appData.vehicles) ? appData.vehicles : []);
  const today = () => localDateInput();
  const monthsBetween = (from, to) => {
    if (!from) return null;
    const a = new Date(`${from}T00:00:00`), b = new Date(`${to}T00:00:00`);
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30;
  };
  const addMonths = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setMonth(d.getMonth() + n); return localDateInput(d); };
  const dayLabel = (iso, year = false) => { if (!iso) return "—"; const [y, m, d] = iso.split("-").map(Number); return km() ? `${d} ${KM_M[m - 1]}${year ? ` ${y}` : ""}` : new Date(y, m - 1, d).toLocaleDateString("en-US", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }); };
  const n0 = v => Number(v || 0).toLocaleString("en-US");
  const cash = (v, cur) => String(money(v, cur)).replace(/<[^>]*>/g, "");

  /* ---------- smart bits (8 Nov): km/day from the km history, predictions, one-line parser ---------- */
  const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 864e5);
  function points(v) {
    const pts = [...(v.odoLog || []), ...(v.log || []).filter(item => item.km != null && item.km !== "").map(item => ({ date: item.date, km: Number(item.km) }))]
      .filter(pt => pt.date && Number.isFinite(Number(pt.km)) && Number(pt.km) > 0)
      .map(pt => ({ date: pt.date, km: Number(pt.km) }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
    return pts;
  }
  // average km a day over the last ~6 months of readings (needs 2 readings ≥ 3 days apart)
  function kmPerDay(v) {
    const pts = points(v);
    if (pts.length < 2) return null;
    const last = pts[pts.length - 1];
    const from = pts.find(pt => daysBetween(pt.date, last.date) <= 183) || pts[0];
    const days = daysBetween(from.date, last.date);
    if (days < 3 || last.km <= from.km) return null;
    return (last.km - from.km) / days;
  }
  function lastReading(v) {
    const pts = points(v);
    return pts[pts.length - 1] || null;
  }
  // today's km, guessed from the last reading + km/day
  function estimateKm(v) {
    const rate = kmPerDay(v);
    const last = lastReading(v);
    const base = Math.max(Number(v.odometer || 0), last?.km || 0);
    if (!rate || !last) return base;
    const days = Math.max(0, daysBetween(last.date, today()));
    return Math.round((base + rate * days) / 10) * 10;
  }
  function odoEntry(v, km, date = today()) {
    const log = (v.odoLog || []).filter(pt => pt.date !== date);
    return [...log, { date, km: Number(km) }].sort((a, b) => a.date.localeCompare(b.date)).slice(-40);
  }
  const KIND_WORDS = { car: /prius|camry|lexus|rx ?\d|highlander|corolla|civic|accord|ranger|hilux|fortuner|cr-?v|tucson|santa ?fe|kia|hyundai|bmw|benz|mercedes|audi|tesla|byd|land ?cruiser|ឡាន|car/i, moto: /dream|scoopy|click|wave|beat|vario|pcx|zoomer|nmax|fino|spark|jupiter|vespa|yamaha|suzuki|ម៉ូតូ|moto|bike/i };
  const guessKind = name => (KIND_WORDS.car.test(name) ? "car" : KIND_WORDS.moto.test(name) ? "moto" : "");
  const SVC_WORDS = [["oil", /ប្រេង|oil|engine ?oil/i], ["tires", /កង់|សំបក|tire|tyre|wheel/i], ["battery", /អាគុយ|battery|ថ្ម/i], ["insurance", /ពន្ធ|ធានា|insurance|tax|ស្លាក/i], ["other", /ជួស|ហ្វ្រាំង|brake|repair|fix|ខ្សែ|chain|ភ្លើង|light/i]];
  // "ប្តូរប្រេង 8$ 24900km បងសុខ" → { service, cost, currency, km, shop }
  function parseLine(text, v) {
    const out = {};
    let rest = ` ${String(text || "")} `;
    for (const [key, re] of SVC_WORDS) { if (re.test(rest)) { out.service = key; break; } }
    rest = rest.replace(/(\d[\d,]*(?:\.\d+)?)\s*(km|គម)/gi, (m, n) => { out.km = Number(n.replace(/,/g, "")); return " "; });
    rest = rest.replace(/\$\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(\$|usd|ដុល្លារ)/gi, (m, a, b) => { out.cost = Number(String(a || b).replace(/,/g, "")); out.currency = "USD"; return " "; });
    rest = rest.replace(/៛\s*(\d[\d,]*)|(\d[\d,]*)\s*(៛|រៀល|khr|riel|r\b)/gi, (m, a, b) => { out.cost = Number(String(a || b).replace(/,/g, "")); out.currency = "KHR"; return " "; });
    rest = rest.replace(/(?:^|\s)(\d[\d,]*(?:\.\d+)?)(?=\s)/g, (m, n) => {
      const value = Number(n.replace(/,/g, ""));
      if (/^(19|20)\d\d$/.test(n)) return " ";
      const guess = v ? estimateKm(v) || Number(v.odometer || 0) : 0;
      if (out.km == null && value >= 1000 && guess && Math.abs(value - guess) <= Math.max(3000, guess * 0.3)) out.km = value;
      else if (out.cost == null) { out.cost = value; out.currency = value >= 1000 ? "KHR" : "USD"; }
      return " ";
    });
    const words = SVC_WORDS.reduce((text2, [, re]) => text2.replace(new RegExp(re.source, "gi"), " "), rest)
      .replace(/ប្តូរ|ថ្មី|change|new|ចាក់|ទិញ|ដូរ/gi, " ").replace(/\s+/g, " ").trim();
    if (words) out.shop = words;
    return out;
  }
  const lastFor = (v, key) => (v.log || []).filter(item => item.service === key).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
  function typicalCost(v, key, currency) {
    const list2 = (v.log || []).filter(item => item.service === key && Number(item.cost) > 0).map(item => convertCurrency(Number(item.cost), item.currency || "USD", currency)).sort((a, b) => a - b);
    return list2.length ? list2[Math.floor(list2.length / 2)] : null;
  }
  function inDays(n) { return n <= 0 ? L("ថ្ងៃនេះ", "today") : n === 1 ? L("ស្អែក", "tomorrow") : L(`${n} ថ្ងៃ`, `${n} days`); }

  function picked() {
    const all = list();
    let id = "";
    try { id = localStorage.getItem(PICK_KEY) || ""; } catch (error) { /* ignore */ }
    return all.find(v => v.id === id) || all[0] || null;
  }

  // how far along a service is: 0..1+ (by km or by months, whichever is closer)
  function status(vehicle, svc) {
    const odo = Number(vehicle.odometer || 0);
    const est = Math.max(odo, estimateKm(vehicle));
    const rate = kmPerDay(vehicle);
    const kmUsed = svc.everyKm && svc.lastKm != null && svc.lastKm !== "" ? est - Number(svc.lastKm) : null;
    const moUsed = svc.everyMonths && svc.lastDate ? monthsBetween(svc.lastDate, today()) : null;
    const parts = [];
    if (kmUsed != null) parts.push(kmUsed / svc.everyKm);
    if (moUsed != null) parts.push(moUsed / svc.everyMonths);
    if (!parts.length) return { p: null, tone: "none", text: L("មិនទាន់កត់ · ចុចដើម្បីកត់", "Not logged yet · tap to log") };
    const p = Math.max(...parts);
    const kmLeft = kmUsed != null ? svc.everyKm - kmUsed : null;
    const dueDate = moUsed != null ? addMonths(svc.lastDate, svc.everyMonths) : null;
    let text;
    if (p >= 1) text = kmLeft != null && kmLeft < 0 ? L(`ហួស ${n0(-kmLeft)} km`, `${n0(-kmLeft)} km over`) : L(`ហួសតាំងពី ${dayLabel(dueDate)}`, `Due since ${dayLabel(dueDate)}`);
    else {
      const bits = [];
      if (kmLeft != null) bits.push(L(`នៅ ${n0(kmLeft)} km`, `${n0(kmLeft)} km left`));
      // the smart part: when will that be, from how much you ride a day
      if (kmLeft != null && rate) {
        const days = Math.ceil(kmLeft / rate);
        const byKm = localDateInput(new Date(Date.now() + days * 864e5));
        if (!dueDate || byKm < dueDate) { bits.push(L(`ប្រហែល ${dayLabel(byKm)} (${inDays(days)})`, `about ${dayLabel(byKm)} (${inDays(days)})`)); return { p: Math.max(...parts), tone: Math.max(...parts) >= 0.8 ? "soon" : "ok", text: bits.join(" · "), when: byKm }; }
      }
      if (dueDate) bits.push(svc.key === "insurance" ? L(`ផុត ${dayLabel(dueDate, true)}`, `due ${dayLabel(dueDate, true)}`) : L(`ឬ ${dayLabel(dueDate, true)}`, `or ${dayLabel(dueDate, true)}`));
      text = bits.join(" · ");
    }
    return { p, tone: p >= 1 ? "late" : p >= 0.8 ? "soon" : "ok", text };
  }

  const pill = tone => tone === "late" ? `<span class="vt-pill is-late">${L("ហួស", "Due")}</span>` : tone === "soon" ? `<span class="vt-pill is-soon">${L("ជិតដល់", "Soon")}</span>` : tone === "ok" ? `<span class="vt-pill">${L("ល្អ", "OK")}</span>` : `<span class="vt-pill is-none">—</span>`;

  function vehicleCard(v) {
    const names = NAMES();
    const svcs = (v.services || []).map(svc => ({ svc, st: status(v, svc) }));
    const worst = svcs.filter(x => x.st.tone === "late").sort((a, b) => b.st.p - a.st.p)[0];
    const year = today().slice(0, 4);
    const logs = (v.log || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const yearLogs = logs.filter(item => String(item.date).startsWith(year));
    const spent = yearLogs.reduce((t, item) => t + toProfileCurrency(Number(item.cost || 0), item.currency || "USD"), 0);
    return `
      <div class="vt-car"><span class="vt-em" aria-hidden="true">${v.kind === "car" ? "🚗" : "🏍️"}</span><span class="vt-car-tx"><b>${escapeHtml(v.name || L("យានយន្ត", "Vehicle"))}</b><small>${escapeHtml([v.plate, v.year].filter(Boolean).join(" · ") || L("មិនទាន់មានស្លាកលេខ", "No plate yet"))}</small></span>
        <button type="button" class="vt-odo" data-vt-odo="${escapeAttr(v.id)}"><b>${n0(v.odometer)}</b><small>${kmPerDay(v) && estimateKm(v) > Number(v.odometer || 0) + 20 ? L(`≈ ${n0(estimateKm(v))} ឥឡូវ · កែ`, `≈ ${n0(estimateKm(v))} now · edit`) : `km · ${L("កែ", "edit")}`}</small></button></div>
      ${worst ? `<div class="vt-alert"><span class="vt-alert-ic" aria-hidden="true">${EMOJI[worst.svc.key] || "🔧"}</span><span class="vt-alert-tx"><b>${escapeHtml(L(`ដល់ពេល${names[worst.svc.key] || worst.svc.label}ហើយ`, `${names[worst.svc.key] || worst.svc.label} is due`))}</b><small>${escapeHtml(worst.st.text)}${worst.svc.lastDate ? ` · ${L("ចុងក្រោយ", "last")} ${dayLabel(worst.svc.lastDate)}` : ""}</small></span><button type="button" class="vt-done" data-vt-log="${escapeAttr(v.id)}" data-vt-svc="${escapeAttr(worst.svc.key)}">✓ ${L("ធ្វើរួច", "Done")}</button></div>` : ""}
      <div class="vt-box">
        <div class="vt-box-h">🔧 ${L("ការថែទាំ", "Service")}<span>${svcs.length} ${L("មុខ", "items")}</span></div>
        ${svcs.map(({ svc, st }) => `<button type="button" class="vt-svc" data-vt-log="${escapeAttr(v.id)}" data-vt-svc="${escapeAttr(svc.key)}">
          <span class="vt-svc-e" aria-hidden="true">${EMOJI[svc.key] || "🔧"}</span>
          <span class="vt-svc-n"><b>${escapeHtml(names[svc.key] || svc.label || "")}</b><span class="vt-bar"><i class="is-${st.tone}" style="width:${st.p == null ? 0 : Math.min(100, Math.round(st.p * 100))}%"></i></span><small>${escapeHtml(st.text)}</small></span>
          ${pill(st.tone)}
        </button>`).join("")}
      </div>
      ${(() => {
        const rate = kmPerDay(v);
        if (!rate) return `<p class="vt-learn">🧠 ${L("កែ km ម្តងម្កាល (ឧ. រៀងរាល់សប្តាហ៍) — app នឹងរៀនថាអ្នកជិះប៉ុន្មាន km/ថ្ងៃ ហើយទាយថ្ងៃប្តូរប្រេងឱ្យ", "Update the km now and then (e.g. weekly) — the app learns your km a day and predicts the oil-change date")}</p>`;
        const pts = points(v);
        const span = pts.length > 1 ? pts[pts.length - 1].km - pts[0].km : 0;
        const allCost = (v.log || []).reduce((t, item) => t + toProfileCurrency(Number(item.cost || 0), item.currency || "USD"), 0);
        const dayOfYear = daysBetween(`${year}-01-01`, today()) + 1;
        const projected = dayOfYear > 30 && yearLogs.length >= 2 ? spent / dayOfYear * 365 : null;
        return `<div class="vt-box"><div class="vt-box-h">🧠 ${L("ការទាយ", "Predictions")}<span>${L(`ពី ${pts.length} ដង km`, `from ${pts.length} readings`)}</span></div>
          <div class="vt-trio is-inner"><div><small>${L("ជិះជាមធ្យម", "Average")}</small><b>${n0(Math.round(rate))} km/${L("ថ្ងៃ", "day")}</b></div><div><small>${L("ចំណាយ/km", "Cost / km")}</small><b>${span > 0 && allCost > 0 ? cash(allCost / span) : "—"}</b></div><div><small>${L("ទាយឆ្នាំនេះ", "This year ≈")}</small><b>${projected ? `~${cash(projected)}` : "—"}</b></div></div></div>`;
      })()}
      <div class="vt-box vt-trio">
        <div><small>${L("ចំណាយឆ្នាំនេះ", "Spent this year")}</small><b>${cash(spent)}</b></div>
        <div><small>${L("ដងថែទាំ", "Services")}</small><b>${yearLogs.length}</b></div>
        <div><small>${L("ចុងក្រោយ", "Last")}</small><b>${logs[0] ? escapeHtml(dayLabel(logs[0].date)) : "—"}</b></div>
      </div>
      ${logs.length ? `<div class="vt-box">
        <div class="vt-box-h">📒 ${L("ប្រវត្តិ", "History")}<span>${logs.length}</span></div>
        ${logs.slice(0, 5).map(item => { const [, m, d] = String(item.date).split("-").map(Number); return `<div class="vt-tl"><span class="vt-cal"><small>${escapeHtml(km() ? KM_M[m - 1] : new Date(2000, m - 1, 1).toLocaleDateString("en-US", { month: "short" }))}</small><b>${d}</b></span><span class="vt-tl-n"><b>${EMOJI[item.service] || "🔧"} ${escapeHtml(item.title || names[item.service] || "")}</b><small>${[item.km ? `${n0(item.km)} km` : "", item.shop || ""].filter(Boolean).map(escapeHtml).join(" · ")}</small></span>${Number(item.cost) ? `<em>-${cash(item.cost, item.currency || "USD")}</em>` : ""}</div>`; }).join("")}
      </div>` : ""}
      <button type="button" class="vt-main" data-vt-log="${escapeAttr(v.id)}">＋ ${L("កត់ការថែទាំ", "Log a service")}</button>
      <div class="vt-more"><button type="button" data-vt-edit="${escapeAttr(v.id)}">✏️ ${L("កែយានយន្ត", "Edit vehicle")}</button><button type="button" class="is-danger" data-vt-del="${escapeAttr(v.id)}">🗑 ${L("ដកចេញ", "Remove")}</button></div>`;
  }

  function render() {
    const all = list();
    const v = picked();
    return `<section class="page vt-page">
      <header class="ct-hero"><a class="ct-back" href="#launcher" aria-label="${escapeAttr(L("ត្រឡប់", "Back"))}">‹</a><span class="ct-hi"><span class="ct-ic" aria-hidden="true">🏍️</span><span><b>${L("ម៉ូតូ / ឡាន", "Vehicle care")}</b><small>${L("រំលឹកប្តូរប្រេង · កត់ការថែទាំ", "Oil reminders · service log")}</small></span></span></header>
      <div class="vt-panel">
        ${all.length ? `<div class="vt-tabs">${all.map(item => `<button type="button" class="vt-tab${item === v ? " is-on" : ""}" data-vt-pick="${escapeAttr(item.id)}">${item.kind === "car" ? "🚗" : "🏍️"} ${escapeHtml(item.name || "")}</button>`).join("")}<button type="button" class="vt-tab is-add" data-vt-add>＋ ${L("បន្ថែម", "Add")}</button></div>
        ${vehicleCard(v)}` : `<div class="vt-empty"><span aria-hidden="true">🏍️🚗</span><b>${L("មិនទាន់មានម៉ូតូ ឬឡាន", "No vehicle yet")}</b><small>${L("បន្ថែមម៉ូតូ ឬឡាន ដើម្បីទទួលការរំលឹកប្តូរប្រេង និងកត់ការថែទាំ", "Add a motorbike or car to get oil-change reminders and keep a service log")}</small><button type="button" class="vt-main" data-vt-add>＋ ${L("បន្ថែមយានយន្ត", "Add a vehicle")}</button></div>`}
      </div>
    </section>`;
  }

  /* ---------- forms (same look as the other pop-ups) ---------- */
  function openShell(html, onSubmit) {
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = html;
    root.classList.add("open");
    Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));
    const form = root.querySelector("form");
    form.addEventListener("submit", event => { event.preventDefault(); onSubmit(form, root); });
    return { form, root };
  }
  const head = (icon, title) => `<div class="ev-head"><div class="ev-head-icon xp-head-icon">${icon}</div><h2 class="section-title">${escapeHtml(title)}</h2><button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button></div>`;
  const foot = label => `<div class="ev-foot"><button class="button ghost-button" type="button" data-close>${t("cancel")}</button><button class="button ev-submit" type="submit">${Icons.check()}${escapeHtml(label)}</button></div>`;
  const box = (name, label, value, attrs = "") => `<div class="field lf-box"><label for="vt-${name}">${escapeHtml(label)}</label><input id="vt-${name}" name="${name}" value="${escapeAttr(value ?? "")}" ${attrs}></div>`;

  function vehicleForm(v) {
    v = v || {};
    let kind = v.kind || "moto";
    let kindTouched = Boolean(v.id);
    const { form, root } = openShell(`<form class="modal glass-card event-modal expense-modal loan-modal vt-modal" id="modalForm" novalidate>
      ${head("🏍️", v.id ? L("កែយានយន្ត", "Edit vehicle") : L("បន្ថែមយានយន្ត", "Add a vehicle"))}
      <div class="ev-title-wrap"><input class="ev-title xp-desc" name="name" autocomplete="off" placeholder="${escapeAttr(L("ឧ. Honda Dream ឬ Prius", "e.g. Honda Dream or Prius"))}" value="${escapeAttr(v.name || "")}"></div>
      <div class="field-error" data-error="name"></div>
      <div class="ev-row vt-kinds"><button type="button" class="ev-chip${kind === "moto" ? " active" : ""}" data-vt-kind="moto">🏍️ ${L("ម៉ូតូ", "Motorbike")}</button><button type="button" class="ev-chip${kind === "car" ? " active" : ""}" data-vt-kind="car">🚗 ${L("ឡាន", "Car")}</button><small class="vt-ai" data-vt-kindhint hidden>✨ ${L("ស្គាល់ពីឈ្មោះ", "from the name")}</small></div>
      <input type="hidden" name="kind" value="${escapeAttr(kind)}">
      <section class="ev-section"><div class="lf-grid">
        ${box("plate", L("ស្លាកលេខ", "Plate"), v.plate, 'autocomplete="off" placeholder="1AB-2345"')}
        ${box("year", L("ឆ្នាំ", "Year"), v.year, 'type="number" inputmode="numeric" placeholder="2019"')}
      </div>
      ${box("odometer", L("គីឡូម៉ែត្រឥឡូវ (km)", "Odometer now (km)"), v.odometer, 'type="number" inputmode="numeric" min="0" placeholder="24850"')}
      </section>
      ${v.id ? "" : `<section class="ev-section"><div class="ev-label">🛢️<strong>${L("ប្តូរប្រេងចុងក្រោយ ពេលណា?", "Last oil change?")}</strong></div>
        <div class="ev-row vt-lastoil">${[["0", L("ទើបប្តូរ", "Just now")], ["1", L("~1 ខែមុន", "~1 month ago")], ["2", L("~2 ខែមុន", "~2 months ago")], ["", L("មិនដឹង", "Not sure")]].map(([m, label], i) => `<button type="button" class="ev-chip${i === 3 ? " active" : ""}" data-vt-oil="${m}">${escapeHtml(label)}</button>`).join("")}</div>
        <input type="hidden" name="lastOil" value="">
        <small class="vt-hint">${L("សួរម្តង ដើម្បីរំលឹកត្រឹមត្រូវភ្លាម", "Asked once so reminders are right from day one")}</small></section>`}
      ${foot(v.id ? L("រក្សាទុក", "Save") : L("បន្ថែម", "Add"))}
    </form>`, form => {
      const name = form.elements.name.value.trim();
      if (!name) { root.querySelector('[data-error="name"]').textContent = t("required"); form.elements.name.focus(); return; }
      const odometer = Number(form.elements.odometer.value || 0);
      const data = { name, kind: form.elements.kind.value, plate: form.elements.plate.value.trim(), year: form.elements.year.value.trim(), odometer };
      if (!Array.isArray(appData.vehicles)) appData.vehicles = [];
      if (v.id) {
        if (odometer && odometer !== Number(v.odometer || 0)) data.odoLog = odoEntry(v, odometer);
        Store.edit("vehicles", v.id, data);
      } else {
        const lastOil = form.elements.lastOil.value;
        const services = SERVICES[data.kind].map(([key, , everyKm, everyMonths]) => {
          const svc = { key, everyKm, everyMonths, lastKm: null, lastDate: "" };
          if (key === "oil" && lastOil !== "") {
            svc.lastDate = addMonths(today(), -Number(lastOil));
            if (lastOil === "0") svc.lastKm = odometer || null;
          }
          return svc;
        });
        Store.add("vehicles", { ...data, services, log: [], odoLog: odometer ? [{ date: today(), km: odometer }] : [] });
        const added = list()[list().length - 1];
        if (added) { try { localStorage.setItem(PICK_KEY, added.id); } catch (error) { /* ignore */ } }
        Toast.show(L("🏍️ បានបន្ថែមយានយន្ត", "🏍️ Vehicle added"), "success");
        App.render();
      }
      Modal.close();
    });
    const setKind = (next, fromName) => {
      kind = next;
      form.elements.kind.value = next;
      root.querySelectorAll("[data-vt-kind]").forEach(c => c.classList.toggle("active", c.dataset.vtKind === next));
      root.querySelector("[data-vt-kindhint]").hidden = !fromName;
    };
    root.querySelectorAll("[data-vt-kind]").forEach(chip => chip.addEventListener("click", () => { kindTouched = true; setKind(chip.dataset.vtKind, false); }));
    form.elements.name.addEventListener("input", () => {
      root.querySelector('[data-error="name"]').textContent = "";
      if (kindTouched) return;
      const g = guessKind(form.elements.name.value);
      if (g) setKind(g, true);
    });
    root.querySelectorAll("[data-vt-oil]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.lastOil.value = chip.dataset.vtOil;
      root.querySelectorAll("[data-vt-oil]").forEach(c => c.classList.toggle("active", c === chip));
    }));
    setTimeout(() => form.elements.name.focus(), 60);
  }

  function odoForm(v) {
    const est = estimateKm(v);
    const rate = kmPerDay(v);
    const { form, root } = openShell(`<form class="modal glass-card event-modal expense-modal loan-modal vt-modal" id="modalForm" novalidate>
      ${head("🧭", L("គីឡូម៉ែត្រឥឡូវ", "Odometer now"))}
      <div class="xp-amount-card"><span class="xp-currency" aria-hidden="true">km</span><input class="xp-amount" name="odometer" type="number" inputmode="numeric" min="0" value="" placeholder="${escapeAttr(String(est || v.odometer || 0))}"></div>
      <div class="vt-warn" data-vt-warn hidden></div>
      <small class="vt-hint">${escapeHtml(L(`ចុងក្រោយ ${n0(v.odometer)} km`, `Last ${n0(v.odometer)} km`))}${rate ? ` · ✨ ${escapeHtml(L(`ទាយឥឡូវ ≈ ${n0(est)} km (${n0(Math.round(rate))} km/ថ្ងៃ)`, `now ≈ ${n0(est)} km (${n0(Math.round(rate))} km/day)`))}` : ""}</small>
      ${foot(L("រក្សាទុក", "Save"))}
    </form>`, form => {
      const raw = form.elements.odometer.value;
      const value = raw === "" ? est : Number(raw);
      if (!(value > 0)) return;
      const warn = root.querySelector("[data-vt-warn]");
      if (value < Number(v.odometer || 0) && !form.dataset.sure) {
        form.dataset.sure = "1";
        warn.hidden = false;
        warn.textContent = L(`⚠️ ${n0(value)} km តិចជាងលើកមុន (${n0(v.odometer)}) — ចុចរក្សាទុកម្តងទៀត បើត្រឹមត្រូវ`, `⚠️ ${n0(value)} km is less than last time (${n0(v.odometer)}) — tap Save again if that's right`);
        return;
      }
      Store.edit("vehicles", v.id, { odometer: value, odoLog: odoEntry(v, value) });
      Modal.close();
    });
    setTimeout(() => form.elements.odometer.focus(), 60);
    return root;
  }

  function logForm(v, svcKey) {
    const names = NAMES();
    const keys = ["oil", "tires", "battery", "insurance", "other"];
    let key = svcKey || "oil";
    const cur = appData.profile.currency || "USD";
    const est = estimateKm(v) || Number(v.odometer || 0);
    const shops = [...new Set((v.log || []).slice().reverse().map(item => item.shop).filter(Boolean))].slice(0, 3);
    const touched = new Set();
    const { form, root } = openShell(`<form class="modal glass-card event-modal expense-modal loan-modal vt-modal" id="modalForm" novalidate>
      ${head(EMOJI[key] || "🔧", L("កត់ការថែទាំ", "Log a service"))}
      <div class="ev-title-wrap"><input class="ev-title xp-desc" name="smart" autocomplete="off" placeholder="${escapeAttr(L("ឧ. ប្តូរប្រេង 8$ 24900km បងសុខ", "e.g. oil change 8$ 24900km corner garage"))}"></div>
      <div class="vt-parsed" data-vt-parsed hidden></div>
      <div class="ev-row vt-svcs">${keys.map(k => `<button type="button" class="ev-chip${k === key ? " active" : ""}" data-vt-k="${k}">${EMOJI[k]} ${escapeHtml(names[k])}</button>`).join("")}</div>
      <div class="xp-amount-card">
        <button type="button" class="xp-currency" data-xp-currency="${escapeAttr(cur)}">${cur === "KHR" ? "៛" : "$"}</button>
        <input class="xp-amount" name="cost" type="number" min="0" step="any" inputmode="decimal" placeholder="0" aria-label="${escapeAttr(L("តម្លៃ", "Cost"))}">
        <span class="xp-currency-name" data-xp-currency-name>${escapeHtml(cur)}</span>
      </div>
      <div class="vt-last" data-vt-last></div>
      <section class="ev-section"><div class="lf-grid">
        ${box("date", t("date"), today(), 'type="date"')}
        ${box("km", L("km ពេលនោះ", "km at the time"), est || "", 'type="number" inputmode="numeric" min="0"')}
      </div>
      ${kmPerDay(v) ? `<small class="vt-hint vt-ai">✨ ${escapeHtml(L(`km ទាយ៖ ${n0(v.odometer)} + ${n0(Math.round(kmPerDay(v)))} km/ថ្ងៃ`, `km guessed: ${n0(v.odometer)} + ${n0(Math.round(kmPerDay(v)))} km/day`))}</small>` : ""}
      ${box("shop", L("ហាង / កំណត់ចំណាំ", "Shop / note"), "", `autocomplete="off" placeholder="${escapeAttr(L("ឧ. ហាងបងសុខ", "e.g. corner garage"))}"`)}
      ${shops.length ? `<div class="ev-row vt-shops">${shops.map(shop => `<button type="button" class="ev-chip" data-vt-shop="${escapeAttr(shop)}">🏪 ${escapeHtml(shop)}</button>`).join("")}</div>` : ""}
      </section>
      <div class="vt-warn" data-vt-warn hidden></div>
      <section class="ev-section if-switches"><label class="if-switch"><span><b>${L("កត់ជាចំណាយផង", "Also log as an expense")}</b><small>${L("ប្រភេទ ធ្វើដំណើរ", "Category: Transport")}</small></span><input type="checkbox" name="expense" checked><i aria-hidden="true"></i></label></section>
      ${foot(L("រក្សាទុក", "Save"))}
    </form>`, (form, root2) => {
      const cost = Number(form.elements.cost.value || 0);
      const currency = root.querySelector("[data-xp-currency]").dataset.xpCurrency || cur;
      const date = form.elements.date.value || today();
      const atKm = form.elements.km.value === "" ? null : Number(form.elements.km.value);
      const fresh = list().find(item => item.id === v.id);
      if (!fresh) return Modal.close();
      // sanity checks: ask once, then save on the second tap
      const warns = checks(fresh, key, cost, currency, atKm, date);
      const warnBox = root.querySelector("[data-vt-warn]");
      if (warns.length && form.dataset.sure !== warns.join("|")) {
        form.dataset.sure = warns.join("|");
        warnBox.hidden = false;
        warnBox.innerHTML = `${warns.map(w => `<span>${escapeHtml(w)}</span>`).join("")}<small>${escapeHtml(L("ចុចរក្សាទុកម្តងទៀត បើត្រឹមត្រូវ", "Tap Save again if that's right"))}</small>`;
        return;
      }
      const title = names[key];
      const entry = { id: `vlog-${Date.now().toString(36)}`, date, service: key, title, km: atKm, cost, currency, shop: form.elements.shop.value.trim() };
      if (form.elements.expense.checked && cost > 0) {
        Store.add("expenses", { description: `${fresh.kind === "car" ? "🚗" : "🏍️"} ${fresh.name} · ${title}`, amount: cost, currency, category: "Transport", date, notes: entry.shop });
        entry.expenseId = appData.expenses[appData.expenses.length - 1]?.id || "";
      }
      const services = (fresh.services || []).map(svc => (svc.key === key && (!svc.lastDate || date >= svc.lastDate) ? { ...svc, lastDate: date, lastKm: atKm != null ? atKm : svc.lastKm } : svc));
      const changes = { log: [...(fresh.log || []), entry], services, odometer: Math.max(Number(fresh.odometer || 0), atKm || 0) };
      if (atKm) changes.odoLog = odoEntry(fresh, atKm, date);
      Store.edit("vehicles", fresh.id, changes);
      Toast.show(L(`✓ បានកត់ ${title}`, `✓ ${title} logged`), "success");
      Modal.close();
    });
    const setCur = next => {
      const b = root.querySelector("[data-xp-currency]");
      b.dataset.xpCurrency = next;
      b.textContent = next === "KHR" ? "៛" : "$";
      root.querySelector("[data-xp-currency-name]").textContent = next;
    };
    const setKey = next => {
      key = next;
      root.querySelectorAll("[data-vt-k]").forEach(c => c.classList.toggle("active", c.dataset.vtK === next));
      root.querySelector(".ev-head-icon").textContent = EMOJI[key] || "🔧";
      showLast();
    };
    // "last time: $8 · tap to use"
    function showLast() {
      const last = lastFor(v, key);
      const box2 = root.querySelector("[data-vt-last]");
      if (!last || !Number(last.cost)) { box2.innerHTML = ""; return; }
      box2.innerHTML = `<span class="vt-ai">✨ ${escapeHtml(L(`លើកមុន ${dayLabel(last.date)}${last.shop ? ` · ${last.shop}` : ""}`, `Last time ${dayLabel(last.date)}${last.shop ? ` · ${last.shop}` : ""}`))}</span><button type="button" class="vt-use" data-vt-use>${escapeHtml(L("ប្រើ", "Use"))} ${escapeHtml(cash(last.cost, last.currency || "USD"))}</button>`;
      box2.querySelector("[data-vt-use]").addEventListener("click", () => {
        form.elements.cost.value = last.cost;
        setCur(last.currency || "USD");
        if (last.shop && !form.elements.shop.value) form.elements.shop.value = last.shop;
        touched.add("cost");
      });
    }
    root.querySelectorAll("[data-vt-k]").forEach(chip => chip.addEventListener("click", () => { touched.add("service"); setKey(chip.dataset.vtK); }));
    root.querySelector("[data-xp-currency]").addEventListener("click", event => { touched.add("currency"); setCur(event.currentTarget.dataset.xpCurrency === "KHR" ? "USD" : "KHR"); });
    ["cost", "km", "shop"].forEach(name => form.elements[name].addEventListener("input", () => { touched.add(name); form.dataset.sure = ""; root.querySelector("[data-vt-warn]").hidden = true; }));
    root.querySelectorAll("[data-vt-shop]").forEach(chip => chip.addEventListener("click", () => { form.elements.shop.value = chip.dataset.vtShop; touched.add("shop"); }));
    // the one-line box fills the fields the user hasn't typed into
    form.elements.smart.addEventListener("input", () => {
      const got = parseLine(form.elements.smart.value, v);
      const chips = [];
      if (got.service) { if (!touched.has("service")) setKey(got.service); chips.push(`${EMOJI[got.service]} ${names[got.service]}`); }
      if (got.cost != null) { if (!touched.has("cost")) form.elements.cost.value = got.cost; if (!touched.has("currency")) setCur(got.currency || cur); chips.push(`💵 ${cash(got.cost, got.currency || cur)}`); }
      if (got.km != null) { if (!touched.has("km")) form.elements.km.value = got.km; chips.push(`🧭 ${n0(got.km)} km`); }
      if (got.shop) { if (!touched.has("shop")) form.elements.shop.value = got.shop; chips.push(`🏪 ${got.shop}`); }
      const box2 = root.querySelector("[data-vt-parsed]");
      box2.hidden = !chips.length;
      box2.innerHTML = chips.length ? `<small>✨ ${escapeHtml(L("app យល់ថា៖", "Understood:"))}</small>${chips.map(c => `<span>${escapeHtml(c)}</span>`).join("")}` : "";
    });
    showLast();
    setTimeout(() => form.elements.smart.focus(), 60);
  }

  // things that look wrong (km going backwards, a price far above the usual one)
  function checks(v, key, cost, currency, atKm, date) {
    const out = [];
    const before = points(v).filter(pt => pt.date <= date);
    const prevKm = before.length ? before[before.length - 1].km : 0;
    if (atKm != null && prevKm && atKm < prevKm) out.push(L(`⚠️ ${n0(atKm)} km តិចជាងលើកមុន (${n0(prevKm)})`, `⚠️ ${n0(atKm)} km is less than before (${n0(prevKm)})`));
    const rate = kmPerDay(v);
    if (atKm != null && prevKm && rate && before.length) {
      const days = Math.max(1, daysBetween(before[before.length - 1].date, date));
      if (atKm - prevKm > Math.max(1500, rate * days * 4)) out.push(L(`🤔 ${n0(atKm - prevKm)} km ក្នុង ${days} ថ្ងៃ ច្រើនខុសធម្មតា`, `🤔 ${n0(atKm - prevKm)} km in ${days} days is unusually high`));
    }
    const usual = typicalCost(v, key, currency);
    if (cost > 0 && usual && cost > usual * 3) out.push(L(`🤔 ${cash(cost, currency)} ខ្ពស់ជាងធម្មតា (${cash(usual, currency)})`, `🤔 ${cash(cost, currency)} is higher than usual (${cash(usual, currency)})`));
    return out;
  }

  function bind() {
    const page = document.querySelector(".vt-page");
    if (!page || page.dataset.bound) return;
    page.dataset.bound = "1";
    page.addEventListener("click", event => {
      const b = sel => event.target.closest(sel);
      const find = id => list().find(item => item.id === id);
      if (b("[data-vt-pick]")) { try { localStorage.setItem(PICK_KEY, b("[data-vt-pick]").dataset.vtPick); } catch (error) { /* ignore */ } App.render(); return; }
      if (b("[data-vt-add]")) { vehicleForm(null); return; }
      if (b("[data-vt-edit]")) { vehicleForm(find(b("[data-vt-edit]").dataset.vtEdit)); return; }
      if (b("[data-vt-odo]")) { const v = find(b("[data-vt-odo]").dataset.vtOdo); if (v) odoForm(v); return; }
      if (b("[data-vt-log]")) { const el = b("[data-vt-log]"); const v = find(el.dataset.vtLog); if (v) logForm(v, el.dataset.vtSvc); return; }
      if (b("[data-vt-del]")) {
        const v = find(b("[data-vt-del]").dataset.vtDel);
        if (v && window.confirm(L(`ដក "${v.name}" ចេញ? ប្រវត្តិថែទាំរបស់វានឹងបាត់ (ចំណាយដែលបានកត់ នៅដដែល)`, `Remove "${v.name}"? Its service log goes too (logged expenses stay).`))) Store.delete("vehicles", v.id);
      }
    });
  }

  // for the launcher tile: the most urgent thing, e.g. "⚠️ ប្តូរប្រេង"
  function badge() {
    const names = NAMES();
    let worst = null;
    list().forEach(v => (v.services || []).forEach(svc => { const st = status(v, svc); if (st.p != null && st.p >= 0.8 && (!worst || st.p > worst.p)) worst = { p: st.p, key: svc.key }; }));
    if (!worst) return list().length ? { text: L(`${list().length} យានយន្ត`, `${list().length} vehicle${list().length > 1 ? "s" : ""}`), tone: "muted" } : null;
    return { text: `${worst.p >= 1 ? "⚠️" : "⏰"} ${names[worst.key]}`, tone: worst.p >= 1 ? "red" : "amber" };
  }

  function openLog(vehicleId, key) { const v = list().find(item => item.id === vehicleId); if (v) logForm(v, key); }

  return { render, bind, badge, status, openLog };
})();
