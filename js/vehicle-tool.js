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

  function picked() {
    const all = list();
    let id = "";
    try { id = localStorage.getItem(PICK_KEY) || ""; } catch (error) { /* ignore */ }
    return all.find(v => v.id === id) || all[0] || null;
  }

  // how far along a service is: 0..1+ (by km or by months, whichever is closer)
  function status(vehicle, svc) {
    const odo = Number(vehicle.odometer || 0);
    const kmUsed = svc.everyKm && svc.lastKm != null && svc.lastKm !== "" ? odo - Number(svc.lastKm) : null;
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
        <button type="button" class="vt-odo" data-vt-odo="${escapeAttr(v.id)}"><b>${n0(v.odometer)}</b><small>km · ${L("កែ", "edit")}</small></button></div>
      ${worst ? `<div class="vt-alert"><span class="vt-alert-ic" aria-hidden="true">${EMOJI[worst.svc.key] || "🔧"}</span><span class="vt-alert-tx"><b>${escapeHtml(L(`ដល់ពេល${names[worst.svc.key] || worst.svc.label}ហើយ`, `${names[worst.svc.key] || worst.svc.label} is due`))}</b><small>${escapeHtml(worst.st.text)}${worst.svc.lastDate ? ` · ${L("ចុងក្រោយ", "last")} ${dayLabel(worst.svc.lastDate)}` : ""}</small></span><button type="button" class="vt-done" data-vt-log="${escapeAttr(v.id)}" data-vt-svc="${escapeAttr(worst.svc.key)}">✓ ${L("ធ្វើរួច", "Done")}</button></div>` : ""}
      <div class="vt-box">
        <div class="vt-box-h">🔧 ${L("ការថែទាំ", "Service")}<span>${svcs.length} ${L("មុខ", "items")}</span></div>
        ${svcs.map(({ svc, st }) => `<button type="button" class="vt-svc" data-vt-log="${escapeAttr(v.id)}" data-vt-svc="${escapeAttr(svc.key)}">
          <span class="vt-svc-e" aria-hidden="true">${EMOJI[svc.key] || "🔧"}</span>
          <span class="vt-svc-n"><b>${escapeHtml(names[svc.key] || svc.label || "")}</b><span class="vt-bar"><i class="is-${st.tone}" style="width:${st.p == null ? 0 : Math.min(100, Math.round(st.p * 100))}%"></i></span><small>${escapeHtml(st.text)}</small></span>
          ${pill(st.tone)}
        </button>`).join("")}
      </div>
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
    const kind = v.kind || "moto";
    const { form, root } = openShell(`<form class="modal glass-card event-modal expense-modal loan-modal vt-modal" id="modalForm" novalidate>
      ${head("🏍️", v.id ? L("កែយានយន្ត", "Edit vehicle") : L("បន្ថែមយានយន្ត", "Add a vehicle"))}
      <div class="ev-row vt-kinds"><button type="button" class="ev-chip${kind === "moto" ? " active" : ""}" data-vt-kind="moto">🏍️ ${L("ម៉ូតូ", "Motorbike")}</button><button type="button" class="ev-chip${kind === "car" ? " active" : ""}" data-vt-kind="car">🚗 ${L("ឡាន", "Car")}</button></div>
      <input type="hidden" name="kind" value="${escapeAttr(kind)}">
      <div class="ev-title-wrap"><input class="ev-title xp-desc" name="name" autocomplete="off" placeholder="${escapeAttr(L("ឧ. Honda Dream", "e.g. Honda Dream"))}" value="${escapeAttr(v.name || "")}"></div>
      <div class="field-error" data-error="name"></div>
      <section class="ev-section"><div class="lf-grid">
        ${box("plate", L("ស្លាកលេខ", "Plate"), v.plate, 'autocomplete="off" placeholder="1AB-2345"')}
        ${box("year", L("ឆ្នាំ", "Year"), v.year, 'type="number" inputmode="numeric" placeholder="2019"')}
      </div>
      ${box("odometer", L("គីឡូម៉ែត្រឥឡូវ (km)", "Odometer now (km)"), v.odometer, 'type="number" inputmode="numeric" min="0" placeholder="24850"')}
      ${v.id ? "" : `<small class="vt-hint">${L("ប្តូរប្រេងរៀងរាល់ 2,000 km ឬ 2 ខែ (ម៉ូតូ) · 5,000 km ឬ 6 ខែ (ឡាន) — កត់ការប្តូរចុងក្រោយ ទើបរំលឹកត្រឹមត្រូវ", "Oil every 2,000 km or 2 months (motorbike) · 5,000 km or 6 months (car) — log the last change so reminders are right")}</small>`}
      </section>
      ${foot(v.id ? L("រក្សាទុក", "Save") : L("បន្ថែម", "Add"))}
    </form>`, form => {
      const name = form.elements.name.value.trim();
      if (!name) { root.querySelector('[data-error="name"]').textContent = t("required"); form.elements.name.focus(); return; }
      const data = { name, kind: form.elements.kind.value, plate: form.elements.plate.value.trim(), year: form.elements.year.value.trim(), odometer: Number(form.elements.odometer.value || 0) };
      if (!Array.isArray(appData.vehicles)) appData.vehicles = [];
      if (v.id) Store.edit("vehicles", v.id, data);
      else {
        const services = SERVICES[data.kind].map(([key, , everyKm, everyMonths]) => ({ key, everyKm, everyMonths, lastKm: null, lastDate: "" }));
        Store.add("vehicles", { ...data, services, log: [] });
        const added = list()[list().length - 1];
        if (added) { try { localStorage.setItem(PICK_KEY, added.id); } catch (error) { /* ignore */ } }
        Toast.show(L("🏍️ បានបន្ថែមយានយន្ត", "🏍️ Vehicle added"), "success");
        App.render();
      }
      Modal.close();
    });
    root.querySelectorAll("[data-vt-kind]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.kind.value = chip.dataset.vtKind;
      root.querySelectorAll("[data-vt-kind]").forEach(c => c.classList.toggle("active", c === chip));
    }));
    setTimeout(() => form.elements.name.focus(), 60);
  }

  function odoForm(v) {
    const { form, root } = openShell(`<form class="modal glass-card event-modal expense-modal loan-modal vt-modal" id="modalForm" novalidate>
      ${head("🧭", L("គីឡូម៉ែត្រឥឡូវ", "Odometer now"))}
      <div class="xp-amount-card"><span class="xp-currency" aria-hidden="true">km</span><input class="xp-amount" name="odometer" type="number" inputmode="numeric" min="0" value="${escapeAttr(v.odometer || "")}" placeholder="0"></div>
      <div class="field-error" data-error="odometer"></div>
      <small class="vt-hint">${L(`ចុងក្រោយ ${n0(v.odometer)} km`, `Last ${n0(v.odometer)} km`)}</small>
      ${foot(L("រក្សាទុក", "Save"))}
    </form>`, form => {
      const value = Number(form.elements.odometer.value || 0);
      if (!(value >= 0)) return;
      Store.edit("vehicles", v.id, { odometer: value });
      Modal.close();
    });
    setTimeout(() => { form.elements.odometer.focus(); form.elements.odometer.select?.(); }, 60);
    return root;
  }

  function logForm(v, svcKey) {
    const names = NAMES();
    const keys = ["oil", "tires", "battery", "insurance", "other"];
    let key = svcKey || "oil";
    const cur = appData.profile.currency || "USD";
    const { form, root } = openShell(`<form class="modal glass-card event-modal expense-modal loan-modal vt-modal" id="modalForm" novalidate>
      ${head(EMOJI[key] || "🔧", L("កត់ការថែទាំ", "Log a service"))}
      <div class="ev-row vt-svcs">${keys.map(k => `<button type="button" class="ev-chip${k === key ? " active" : ""}" data-vt-k="${k}">${EMOJI[k]} ${escapeHtml(names[k])}</button>`).join("")}</div>
      <div class="xp-amount-card">
        <button type="button" class="xp-currency" data-xp-currency="${escapeAttr(cur)}">${cur === "KHR" ? "៛" : "$"}</button>
        <input class="xp-amount" name="cost" type="number" min="0" step="any" inputmode="decimal" placeholder="0" aria-label="${escapeAttr(L("តម្លៃ", "Cost"))}">
        <span class="xp-currency-name" data-xp-currency-name>${escapeHtml(cur)}</span>
      </div>
      <section class="ev-section"><div class="lf-grid">
        ${box("date", t("date"), today(), 'type="date"')}
        ${box("km", L("km ពេលនោះ", "km at the time"), v.odometer || "", 'type="number" inputmode="numeric" min="0"')}
      </div>
      ${box("shop", L("ហាង / កំណត់ចំណាំ", "Shop / note"), "", `autocomplete="off" placeholder="${escapeAttr(L("ឧ. ហាងបងសុខ", "e.g. corner garage"))}"`)}
      </section>
      <section class="ev-section if-switches"><label class="if-switch"><span><b>${L("កត់ជាចំណាយផង", "Also log as an expense")}</b><small>${L("ប្រភេទ ធ្វើដំណើរ", "Category: Transport")}</small></span><input type="checkbox" name="expense" checked><i aria-hidden="true"></i></label></section>
      ${foot(L("រក្សាទុក", "Save"))}
    </form>`, form => {
      const cost = Number(form.elements.cost.value || 0);
      const currency = root.querySelector("[data-xp-currency]").dataset.xpCurrency || cur;
      const date = form.elements.date.value || today();
      const atKm = form.elements.km.value === "" ? null : Number(form.elements.km.value);
      const fresh = list().find(item => item.id === v.id);
      if (!fresh) return Modal.close();
      const title = names[key];
      const entry = { id: `vlog-${Date.now().toString(36)}`, date, service: key, title, km: atKm, cost, currency, shop: form.elements.shop.value.trim() };
      if (form.elements.expense.checked && cost > 0) {
        Store.add("expenses", { description: `${fresh.kind === "car" ? "🚗" : "🏍️"} ${fresh.name} · ${title}`, amount: cost, currency, category: "Transport", date, notes: entry.shop });
        entry.expenseId = appData.expenses[appData.expenses.length - 1]?.id || "";
      }
      const services = (fresh.services || []).map(svc => (svc.key === key && (!svc.lastDate || date >= svc.lastDate) ? { ...svc, lastDate: date, lastKm: atKm != null ? atKm : svc.lastKm } : svc));
      Store.edit("vehicles", fresh.id, { log: [...(fresh.log || []), entry], services, odometer: Math.max(Number(fresh.odometer || 0), atKm || 0) });
      Toast.show(L(`✓ បានកត់ ${title}`, `✓ ${title} logged`), "success");
      Modal.close();
    });
    root.querySelectorAll("[data-vt-k]").forEach(chip => chip.addEventListener("click", () => {
      key = chip.dataset.vtK;
      root.querySelectorAll("[data-vt-k]").forEach(c => c.classList.toggle("active", c === chip));
      root.querySelector(".ev-head-icon").textContent = EMOJI[key] || "🔧";
    }));
    root.querySelector("[data-xp-currency]").addEventListener("click", event => {
      const b = event.currentTarget;
      const next = b.dataset.xpCurrency === "KHR" ? "USD" : "KHR";
      b.dataset.xpCurrency = next;
      b.textContent = next === "KHR" ? "៛" : "$";
      root.querySelector("[data-xp-currency-name]").textContent = next;
    });
    setTimeout(() => form.elements.cost.focus(), 60);
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

  return { render, bind, badge, status };
})();
