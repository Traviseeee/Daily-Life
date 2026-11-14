/* MYLIFE Invoice maker (#invoice, 12 Nov 2026 · draft 3B): brand-colour header, items,
 * KHQR / pay note, PAID stamp. Save as PNG (drawn on a canvas) or PDF (the phone's print →
 * Save as PDF). "✅ Paid" marks it paid and adds one income (Freelance, once).
 * Data: appData.invoices = [{ id, number, client, clientNote, date, due, currency, items[{ desc, qty, price }],
 *   note, status: "unpaid" | "paid", paidAt, incomeId }]
 * Brand: appData.profile.invoiceBrand = { name, tagline, color, logo, qr, pay } (logo / qr = small data URLs). */
const InvoiceTool = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const COLORS = ["#6a58e0", "#e0559e", "#1f8fd6", "#1f9d6a", "#e8742a", "#1c1838"];
  const list = () => (Array.isArray(appData.invoices) ? appData.invoices : []);
  const today = () => localDateInput();
  const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return localDateInput(d); };
  const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 864e5);
  const cash = (v, cur) => String(money(v, cur)).replace(/<[^>]*>/g, "");
  const total = inv => (inv.items || []).reduce((t, item) => t + Number(item.qty || 0) * Number(item.price || 0), 0);
  const dayLabel = (iso, year = true) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return km() ? `${d} ${KM_M[m - 1]}${year ? ` ${y}` : ""}` : new Date(y, m - 1, d).toLocaleDateString("en-US", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }); };
  // the invoice itself stays in English dates (it goes to clients)
  const enDate = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  const initials = name => String(name || "?").trim().split(/\s+/).map(part => Array.from(part)[0] || "").join("").slice(0, 2).toUpperCase() || "?";

  function brand() {
    const b = appData.profile?.invoiceBrand || {};
    return { name: b.name || appData.profile?.name || "MYLIFE", tagline: b.tagline || "", color: b.color || COLORS[0], logo: b.logo || "", qr: b.qr || "", pay: b.pay || "" };
  }
  function nextNumber() {
    const max = list().reduce((m, inv) => Math.max(m, Number(String(inv.number || "").replace(/\D/g, "")) || 0), 0);
    return `INV-${String(max + 1).padStart(4, "0")}`;
  }
  function state(inv) {
    if (inv.status === "paid") return "paid";
    return inv.due && inv.due < today() ? "late" : "wait";
  }
  const clients = () => [...new Set(list().slice().reverse().map(inv => inv.client).filter(Boolean))].slice(0, 6);

  /* ---------- the invoice paper (draft 3B) ---------- */
  function paper(inv) {
    const b = brand();
    const cur = inv.currency || "USD";
    const logo = b.logo ? `<img src="${escapeAttr(b.logo)}" alt="">` : escapeHtml(initials(b.name));
    return `<div class="iv-paper" style="--iv-c:${escapeAttr(b.color)}">
      <div class="iv-band"><div class="iv-who"><span class="iv-logo">${logo}</span><span><b>${escapeHtml(b.name)}</b>${b.tagline ? `<small>${escapeHtml(b.tagline)}</small>` : ""}</span></div><div class="iv-no"><b>INVOICE</b><small>#${escapeHtml(inv.number || "")}</small></div></div>
      <div class="iv-meta"><div><small>Bill to</small><b>${escapeHtml(inv.client || "")}</b>${inv.clientNote ? `<small>${escapeHtml(inv.clientNote)}</small>` : ""}</div><div class="iv-r"><small>Date · Due</small><b>${escapeHtml(enDate(inv.date))}</b>${inv.due ? `<small>Due ${escapeHtml(enDate(inv.due))}</small>` : ""}</div></div>
      <table class="iv-items"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>
        ${(inv.items || []).map(item => `<tr><td>${escapeHtml(item.desc || "")}</td><td>${Number(item.qty || 0)}</td><td>${escapeHtml(cash(item.price, cur))}</td><td>${escapeHtml(cash(Number(item.qty || 0) * Number(item.price || 0), cur))}</td></tr>`).join("")}
      </tbody></table>
      <div class="iv-total"><span>Total</span><b>${escapeHtml(cash(total(inv), cur))}</b></div>
      ${b.qr || b.pay || inv.note ? `<div class="iv-pay">${b.qr ? `<img src="${escapeAttr(b.qr)}" alt="QR">` : ""}<span>${b.pay ? `<b>${escapeHtml(b.pay)}</b>` : ""}${inv.note ? `<small>${escapeHtml(inv.note)}</small>` : ""}</span></div>` : ""}
      ${inv.status === "paid" ? `<div class="iv-stamp">PAID</div>` : `<p class="iv-thanks">Thank you!</p>`}
    </div>`;
  }

  /* ---------- page ---------- */
  function render() {
    const all = list().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.number).localeCompare(String(a.number)));
    const month = today().slice(0, 7);
    const monthTotal = all.filter(inv => String(inv.date).startsWith(month)).reduce((t, inv) => t + toProfileCurrency(total(inv), inv.currency || "USD"), 0);
    const owed = all.filter(inv => inv.status !== "paid").reduce((t, inv) => t + toProfileCurrency(total(inv), inv.currency || "USD"), 0);
    const paid = all.filter(inv => inv.status === "paid" && String(inv.paidAt || "").startsWith(month)).reduce((t, inv) => t + toProfileCurrency(total(inv), inv.currency || "USD"), 0);
    const row = inv => {
      const st = state(inv);
      const cur = inv.currency || "USD";
      const late = st === "late" ? daysBetween(inv.due, today()) : 0;
      const sub = st === "paid" ? L(`បង់ ${dayLabel(String(inv.paidAt || "").slice(0, 10), false)} → ចំណូល`, `paid ${dayLabel(String(inv.paidAt || "").slice(0, 10), false)} → income`)
        : st === "late" ? L(`ហួស ${late} ថ្ងៃ`, `${late} day${late > 1 ? "s" : ""} late`)
        : inv.due ? L(`ផុតកំណត់ ${dayLabel(inv.due, false)}`, `due ${dayLabel(inv.due, false)}`) : "";
      return `<div class="iv-row is-${st}">
        <button type="button" class="iv-open" data-iv-open="${escapeAttr(inv.id)}"><span class="iv-ic" aria-hidden="true">${st === "paid" ? "✅" : st === "late" ? "⚠️" : "⏳"}</span><span class="iv-tx"><b>${escapeHtml(inv.client || "—")} · ${escapeHtml(cash(total(inv), cur))}</b><small>#${escapeHtml(String(inv.number || "").replace(/^INV-/, ""))} · ${escapeHtml(sub)}</small></span></button>
        ${st === "paid" ? `<span class="iv-pill is-paid">PAID</span>` : `<button type="button" class="iv-paid" data-iv-paid="${escapeAttr(inv.id)}">✅ ${L("បានបង់", "Paid")}</button>`}
      </div>`;
    };
    return `<section class="page ct-page iv-page">
      <header class="ct-hero"><a class="ct-back" href="#launcher" aria-label="${escapeAttr(L("ត្រឡប់", "Back"))}">‹</a><span class="ct-hi"><span class="ct-ic" aria-hidden="true">🧾</span><span><b>${L("Invoice", "Invoices")}</b><small>${L("ចេញ PDF / រូបភាព · បង់ → ចំណូល", "PDF / image · paid → income")}</small></span></span></header>
      <div class="ct-panel">
        ${all.length ? `<div class="vt-box vt-trio iv-sum"><div><small>${L("ចេញខែនេះ", "Billed this month")}</small><b>${cash(monthTotal)}</b></div><div><small>${L("នៅជំពាក់", "Still owed")}</small><b class="${owed > 0 ? "is-owed" : ""}">${cash(owed)}</b></div><div><small>${L("ទទួលខែនេះ", "Received")}</small><b>${cash(paid)}</b></div></div>
        <div class="vt-box"><div class="vt-box-h">🧾 Invoice<span>${all.length}</span></div>${all.slice(0, 30).map(row).join("")}</div>`
        : `<div class="vt-empty"><span aria-hidden="true">🧾</span><b>${L("មិនទាន់មាន invoice", "No invoices yet")}</b><small>${L("បង្កើត invoice សម្រាប់ការងារ ផ្ញើជារូបភាព ឬ PDF ហើយចុច «បានបង់» ពេលភ្ញៀវបង់", "Make an invoice for a job, send it as an image or PDF, then tap “Paid” when the client pays")}</small></div>`}
        <button type="button" class="vt-main" data-iv-new>＋ ${L("Invoice ថ្មី", "New invoice")}</button>
        <div class="vt-more"><button type="button" data-iv-brand>🎨 ${L("Logo · ពណ៌ · ការបង់", "Logo · colour · payment")}</button></div>
      </div>
    </section>`;
  }

  /* ---------- pop-ups (same shell as the vehicle forms) ---------- */
  function openShell(html, onSubmit) {
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = html;
    root.classList.add("open");
    Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));
    const form = root.querySelector("form");
    if (form && onSubmit) form.addEventListener("submit", event => { event.preventDefault(); onSubmit(form, root); });
    return { form, root };
  }
  const head = (icon, title) => `<div class="ev-head"><div class="ev-head-icon xp-head-icon">${icon}</div><h2 class="section-title">${escapeHtml(title)}</h2><button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button></div>`;
  const foot = label => `<div class="ev-foot"><button class="button ghost-button" type="button" data-close>${t("cancel")}</button><button class="button ev-submit" type="submit">${Icons.check()}${escapeHtml(label)}</button></div>`;
  const box = (name, label, value, attrs = "") => `<div class="field lf-box"><label for="iv-${name}">${escapeHtml(label)}</label><input id="iv-${name}" name="${name}" value="${escapeAttr(value ?? "")}" ${attrs}></div>`;

  function itemRow(item = {}) {
    return `<div class="iv-it"><input name="desc" autocomplete="off" placeholder="${escapeAttr(L("ការងារ ឧ. Banner 6 ផ្ទាំង", "Work e.g. Banner set"))}" value="${escapeAttr(item.desc || "")}"><input name="qty" type="number" min="0" step="any" inputmode="decimal" value="${escapeAttr(item.qty ?? 1)}" aria-label="Qty"><input name="price" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${escapeAttr(item.price ?? "")}" aria-label="${escapeAttr(L("តម្លៃ", "Price"))}"><button type="button" class="iv-x" data-iv-x aria-label="${escapeAttr(L("ដកចេញ", "Remove"))}">×</button></div>`;
  }

  function invoiceForm(inv) {
    inv = inv || {};
    const editing = Boolean(inv.id);
    const cur0 = inv.currency || appData.profile.currency || "USD";
    const date0 = inv.date || today();
    const dueDays = inv.due ? daysBetween(date0, inv.due) : 7;
    const { form, root } = openShell(`<form class="modal glass-card event-modal expense-modal loan-modal vt-modal iv-modal" id="modalForm" novalidate>
      ${head("🧾", editing ? L(`កែ ${inv.number}`, `Edit ${inv.number}`) : L(`Invoice ថ្មី · ${nextNumber()}`, `New invoice · ${nextNumber()}`))}
      <section class="ev-section">
        ${box("client", L("ភ្ញៀវ / ក្រុមហ៊ុន", "Client"), inv.client, `autocomplete="off" placeholder="${escapeAttr(L("ឧ. Food Co.", "e.g. Food Co."))}"`)}
        ${clients().length ? `<div class="ev-row iv-clients">${clients().map(name => `<button type="button" class="ev-chip" data-iv-client="${escapeAttr(name)}">👤 ${escapeHtml(name)}</button>`).join("")}</div>` : ""}
        <div class="field-error" data-error="client"></div>
        ${box("clientNote", L("អាសយដ្ឋាន / ទូរស័ព្ទ (មិនចាំបាច់)", "Address / phone (optional)"), inv.clientNote, 'autocomplete="off"')}
      </section>
      <section class="ev-section"><div class="ev-label">🛠️<strong>${L("ការងារ", "Work")}</strong><button type="button" class="iv-cur" data-iv-cur="${escapeAttr(cur0)}">${cur0 === "KHR" ? "៛ KHR" : "$ USD"}</button></div>
        <div class="iv-it iv-it-h"><small>${L("ការងារ", "Item")}</small><small>${L("ចំនួន", "Qty")}</small><small>${L("តម្លៃ", "Price")}</small><span></span></div>
        <div data-iv-items>${(inv.items && inv.items.length ? inv.items : [{}]).map(itemRow).join("")}</div>
        <button type="button" class="iv-add" data-iv-additem>＋ ${L("បន្ថែមការងារ", "Add a line")}</button>
        <div class="iv-live"><span>${L("សរុប", "Total")}</span><b data-iv-total>—</b></div>
        <div class="field-error" data-error="items"></div>
      </section>
      <section class="ev-section"><div class="lf-grid">${box("date", t("date"), date0, 'type="date"')}${box("due", L("ផុតកំណត់", "Due"), inv.due || addDays(date0, 7), 'type="date"')}</div>
        <div class="ev-row iv-due">${[[0, L("ថ្ងៃនេះ", "Today")], [7, L("7 ថ្ងៃ", "7 days")], [14, L("14 ថ្ងៃ", "14 days")], [30, L("30 ថ្ងៃ", "30 days")]].map(([n, label]) => `<button type="button" class="ev-chip${n === dueDays ? " active" : ""}" data-iv-due="${n}">${escapeHtml(label)}</button>`).join("")}</div>
        ${box("note", L("កំណត់ចំណាំលើ invoice (មិនចាំបាច់)", "Note on the invoice (optional)"), inv.note, `autocomplete="off" placeholder="${escapeAttr(L("ឧ. បង់តាម ABA", "e.g. Pay by ABA"))}"`)}
      </section>
      ${foot(editing ? L("រក្សាទុក", "Save") : L("បង្កើត", "Create"))}
    </form>`, (form, root2) => {
      const client = form.elements.client.value.trim();
      if (!client) { root.querySelector('[data-error="client"]').textContent = t("required"); form.elements.client.focus(); return; }
      const items = readItems(root);
      if (!items.length) { root.querySelector('[data-error="items"]').textContent = L("បញ្ចូលការងារ និងតម្លៃ យ៉ាងតិច 1", "Add at least one line with a price"); return; }
      const record = { client, clientNote: form.elements.clientNote.value.trim(), date: form.elements.date.value || today(), due: form.elements.due.value || "", currency: root.querySelector("[data-iv-cur]").dataset.ivCur, items, note: form.elements.note.value.trim() };
      if (!Array.isArray(appData.invoices)) appData.invoices = [];
      let id = inv.id;
      if (editing) Store.edit("invoices", inv.id, record);
      else {
        Store.add("invoices", { ...record, number: nextNumber(), status: "unpaid" });
        id = list()[list().length - 1]?.id;
        Toast.show(L("🧾 បានបង្កើត invoice", "🧾 Invoice created"), "success");
      }
      Modal.close();
      if (id) setTimeout(() => preview(id), 160);
    });
    const recalc = () => {
      const items = readItems(root);
      const cur = root.querySelector("[data-iv-cur]").dataset.ivCur;
      root.querySelector("[data-iv-total]").textContent = items.length ? cash(items.reduce((t, item) => t + item.qty * item.price, 0), cur) : "—";
      root.querySelector('[data-error="items"]').textContent = "";
    };
    root.addEventListener("input", event => { if (event.target.closest("[data-iv-items]")) recalc(); if (event.target.name === "client") root.querySelector('[data-error="client"]').textContent = ""; });
    root.addEventListener("click", event => {
      const b = sel => event.target.closest(sel);
      if (b("[data-iv-additem]")) { root.querySelector("[data-iv-items]").insertAdjacentHTML("beforeend", itemRow({})); root.querySelector("[data-iv-items] .iv-it:last-child input")?.focus(); return; }
      if (b("[data-iv-x]")) { const rows = root.querySelectorAll("[data-iv-items] .iv-it"); if (rows.length > 1) b("[data-iv-x]").closest(".iv-it").remove(); else rows[0].querySelectorAll("input").forEach(input => { input.value = input.name === "qty" ? 1 : ""; }); recalc(); return; }
      if (b("[data-iv-client]")) {
        const name = b("[data-iv-client]").dataset.ivClient;
        form.elements.client.value = name;
        const prev = list().slice().reverse().find(item => item.client === name);
        if (prev && !form.elements.clientNote.value) form.elements.clientNote.value = prev.clientNote || "";
        root.querySelector('[data-error="client"]').textContent = "";
        return;
      }
      if (b("[data-iv-cur]")) { const el = b("[data-iv-cur]"); const next = el.dataset.ivCur === "KHR" ? "USD" : "KHR"; el.dataset.ivCur = next; el.textContent = next === "KHR" ? "៛ KHR" : "$ USD"; recalc(); return; }
      if (b("[data-iv-due]")) {
        const n = Number(b("[data-iv-due]").dataset.ivDue);
        form.elements.due.value = addDays(form.elements.date.value || today(), n);
        root.querySelectorAll("[data-iv-due]").forEach(c => c.classList.toggle("active", c === b("[data-iv-due]")));
      }
    });
    recalc();
    setTimeout(() => form.elements.client.focus(), 60);
  }
  function readItems(root) {
    return [...root.querySelectorAll("[data-iv-items] .iv-it")].map(row => ({
      desc: row.querySelector('[name="desc"]').value.trim(),
      qty: Number(row.querySelector('[name="qty"]').value || 0),
      price: Number(row.querySelector('[name="price"]').value || 0)
    })).filter(item => item.desc && item.qty > 0 && item.price > 0);
  }

  function preview(id) {
    const inv = list().find(item => item.id === id);
    if (!inv) return;
    const st = state(inv);
    const { root } = openShell(`<div class="modal glass-card event-modal vt-modal iv-modal iv-view">
      ${head("🧾", `${inv.number} · ${inv.client || ""}`)}
      <div class="iv-paper-wrap">${paper(inv)}</div>
      <div class="iv-acts"><button type="button" class="button ghost-button" data-iv-png>🖼️ ${L("រូបភាព", "Image")}</button><button type="button" class="button ghost-button" data-iv-pdf>📄 PDF</button></div>
      ${st === "paid" ? "" : `<button type="button" class="button ev-submit iv-paid-big" data-iv-paid="${escapeAttr(inv.id)}">✅ ${L(`ភ្ញៀវបានបង់ ${cash(total(inv), inv.currency || "USD")}`, `Client paid ${cash(total(inv), inv.currency || "USD")}`)}</button>`}
      <div class="vt-more">${st === "paid" ? "" : `<button type="button" data-iv-edit="${escapeAttr(inv.id)}">✏️ ${L("កែ", "Edit")}</button>`}<button type="button" data-iv-copy="${escapeAttr(inv.id)}">📑 ${L("ចម្លងជាថ្មី", "Copy as new")}</button><button type="button" class="is-danger" data-iv-del="${escapeAttr(inv.id)}">🗑 ${L("លុប", "Delete")}</button></div>
    </div>`);
    root.querySelector(".iv-view").addEventListener("click", event => {
      const b = sel => event.target.closest(sel);
      if (b("[data-iv-png]")) { savePng(inv); return; }
      if (b("[data-iv-pdf]")) { printPdf(inv); return; }
      if (b("[data-iv-paid]")) { markPaid(inv.id); Modal.close(); return; }
      if (b("[data-iv-edit]")) { Modal.close(); setTimeout(() => invoiceForm(inv), 160); return; }
      if (b("[data-iv-copy]")) { Modal.close(); setTimeout(() => invoiceForm({ client: inv.client, clientNote: inv.clientNote, currency: inv.currency, items: inv.items, note: inv.note }), 160); return; }
      if (b("[data-iv-del]")) { Modal.close(); setTimeout(() => Modal.confirm({ title: L("លុប invoice?", "Delete invoice?"), message: L(`លុប ${inv.number}? (ចំណូលដែលបានកត់ នៅដដែល)`, `Delete ${inv.number}? (any income it added stays)`), confirmText: L("លុប", "Delete"), onConfirm: () => { Store.delete("invoices", inv.id); } }), 160); return; }
    });
  }

  function markPaid(id) {
    const inv = list().find(item => item.id === id);
    if (!inv || inv.status === "paid") return;
    const amount = total(inv);
    Store.add("income", { name: `🧾 ${inv.client} · ${inv.number}`, amount, currency: inv.currency || "USD", category: "Freelance", accountType: "unspecified", frequency: "Once", recurring: false, ask: false, nextPaymentDate: today(), notes: inv.number });
    const incomeId = appData.income?.[appData.income.length - 1]?.id || "";
    Store.edit("invoices", id, { status: "paid", paidAt: new Date().toISOString(), incomeId });
    if (typeof Sound !== "undefined") { try { Sound.play("nomiHop"); } catch (error) { /* quiet */ } }
    Toast.show(L(`✅ ${inv.client} បានបង់ ${cash(amount, inv.currency || "USD")} · កត់ជាចំណូល`, `✅ ${inv.client} paid ${cash(amount, inv.currency || "USD")} · added to income`), "success");
  }

  function brandForm() {
    const b = brand();
    let logo = b.logo, qr = b.qr, color = b.color;
    const { form, root } = openShell(`<form class="modal glass-card event-modal expense-modal loan-modal vt-modal iv-modal" id="modalForm" novalidate>
      ${head("🎨", L("Logo · ពណ៌ · ការបង់", "Logo · colour · payment"))}
      <section class="ev-section"><div class="iv-brand-top"><button type="button" class="iv-logo-pick" data-iv-logo>${logo ? `<img src="${escapeAttr(logo)}" alt="">` : escapeHtml(initials(b.name))}</button><small>${L("ចុចដើម្បីដាក់ logo", "Tap to add a logo")}</small></div>
        ${box("name", L("ឈ្មោះលើ invoice", "Name on the invoice"), b.name, 'autocomplete="off"')}
        ${box("tagline", L("ការងារ (ឧ. Graphic Design)", "What you do (e.g. Graphic Design)"), b.tagline, 'autocomplete="off"')}
      </section>
      <section class="ev-section"><div class="ev-label">🎨<strong>${L("ពណ៌ក្បាល", "Header colour")}</strong></div>
        <div class="ev-row iv-colors">${COLORS.map(c => `<button type="button" class="iv-color${c === color ? " is-on" : ""}" style="--c:${c}" data-iv-color="${c}" aria-label="${c}"></button>`).join("")}<label class="iv-color is-custom" aria-label="${escapeAttr(L("ពណ៌ផ្សេង", "Other colour"))}"><input type="color" value="${escapeAttr(color)}" data-iv-colorpick>＋</label></div></section>
      <section class="ev-section"><div class="ev-label">💳<strong>${L("ការបង់ប្រាក់", "Payment")}</strong></div>
        ${box("pay", L("ឧ. ABA · CHIN CHETRA", "e.g. ABA · CHIN CHETRA"), b.pay, 'autocomplete="off"')}
        <div class="iv-qr-row"><button type="button" class="iv-qr-pick" data-iv-qr>${qr ? `<img src="${escapeAttr(qr)}" alt="QR">` : "＋ QR"}</button><small>${L("ដាក់រូប KHQR (screenshot ពី app ធនាគារ)", "Add your KHQR (screenshot from the bank app)")}</small>${qr ? `<button type="button" class="iv-x" data-iv-qrx aria-label="x">×</button>` : ""}</div>
      </section>
      <input type="file" accept="image/*" data-iv-file hidden>
      ${foot(L("រក្សាទុក", "Save"))}
    </form>`, form => {
      Store.updateProfile({ invoiceBrand: { name: form.elements.name.value.trim(), tagline: form.elements.tagline.value.trim(), color, logo, qr, pay: form.elements.pay.value.trim() } });
      Toast.show(L("🎨 បានរក្សាទុក", "🎨 Saved"), "success");
      Modal.close();
    });
    let target = "";
    const file = root.querySelector("[data-iv-file]");
    root.addEventListener("click", event => {
      const b2 = sel => event.target.closest(sel);
      if (b2("[data-iv-logo]")) { target = "logo"; file.click(); return; }
      if (b2("[data-iv-qr]")) { target = "qr"; file.click(); return; }
      if (b2("[data-iv-qrx]")) { qr = ""; root.querySelector("[data-iv-qr]").innerHTML = "＋ QR"; b2("[data-iv-qrx]").remove(); return; }
      if (b2("[data-iv-color]")) { color = b2("[data-iv-color]").dataset.ivColor; root.querySelectorAll(".iv-color").forEach(c => c.classList.toggle("is-on", c.dataset.ivColor === color)); }
    });
    root.querySelector("[data-iv-colorpick]").addEventListener("input", event => { color = event.target.value; root.querySelectorAll(".iv-color").forEach(c => c.classList.toggle("is-on", c.classList.contains("is-custom"))); });
    file.addEventListener("change", async () => {
      const picked = file.files && file.files[0];
      file.value = "";
      if (!picked) return;
      try {
        const url = await shrink(picked, target === "qr" ? 420 : 240);
        if (target === "qr") { qr = url; root.querySelector("[data-iv-qr]").innerHTML = `<img src="${escapeAttr(url)}" alt="QR">`; }
        else { logo = url; root.querySelector("[data-iv-logo]").innerHTML = `<img src="${escapeAttr(url)}" alt="">`; }
      } catch (error) { Toast.show(L("មិនអាចអានរូបនេះបាន", "Couldn't read that image"), "error"); }
    });
  }
  // small JPEG/PNG data URL so the profile stays light
  function shrink(fileObj, max) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.86));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(fileObj);
    });
  }

  /* ---------- export ---------- */
  const loadImg = src => new Promise(resolve => { if (!src) { resolve(null); return; } const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src; });
  async function drawPng(inv) {
    const b = brand();
    const cur = inv.currency || "USD";
    const W = 1080, P = 72;
    const font = (w, s) => `${w} ${s}px "Kantumruy Pro", system-ui, sans-serif`;
    const items = inv.items || [];
    const [logo, qr] = await Promise.all([loadImg(b.logo), loadImg(b.qr)]);
    const H = 560 + items.length * 76 + (qr || b.pay || inv.note ? 230 : 0) + 160;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext("2d");
    const round = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, W, H);
    // band
    c.fillStyle = b.color; c.fillRect(0, 0, W, 220);
    c.fillStyle = "#ffffff"; round(P, 56, 108, 108, 28); c.fill();
    if (logo) { c.save(); round(P, 56, 108, 108, 28); c.clip(); c.drawImage(logo, P, 56, 108, 108); c.restore(); }
    else { c.fillStyle = b.color; c.font = font(700, 44); c.textAlign = "center"; c.fillText(initials(b.name), P + 54, 126); }
    c.textAlign = "left"; c.fillStyle = "#ffffff";
    c.font = font(700, 40); c.fillText(b.name, P + 136, b.tagline ? 104 : 122);
    if (b.tagline) { c.globalAlpha = .85; c.font = font(500, 28); c.fillText(b.tagline, P + 136, 146); c.globalAlpha = 1; }
    c.textAlign = "right"; c.font = font(700, 40); c.fillText("INVOICE", W - P, 104);
    c.globalAlpha = .85; c.font = font(500, 28); c.fillText(`#${inv.number}`, W - P, 146); c.globalAlpha = 1;
    // meta
    let y = 296;
    c.textAlign = "left"; c.fillStyle = "#7a7598"; c.font = font(500, 26); c.fillText("Bill to", P, y);
    c.textAlign = "right"; c.fillText("Date · Due", W - P, y);
    y += 44; c.fillStyle = "#1c1838"; c.font = font(700, 34);
    c.textAlign = "left"; c.fillText(inv.client || "", P, y);
    c.textAlign = "right"; c.fillText(enDate(inv.date), W - P, y);
    y += 38; c.fillStyle = "#7a7598"; c.font = font(500, 26);
    c.textAlign = "left"; if (inv.clientNote) c.fillText(inv.clientNote, P, y);
    c.textAlign = "right"; if (inv.due) c.fillText(`Due ${enDate(inv.due)}`, W - P, y);
    // table
    y += 64;
    const cols = [P, 640, 790, W - P];
    c.font = font(600, 24); c.fillStyle = "#7a7598";
    c.textAlign = "left"; c.fillText("ITEM", cols[0], y);
    c.textAlign = "right"; c.fillText("QTY", cols[1] + 40, y); c.fillText("PRICE", cols[2] + 90, y); c.fillText("AMOUNT", cols[3], y);
    y += 22; c.fillStyle = "#ebe6fb"; c.fillRect(P, y, W - P * 2, 2);
    items.forEach(item => {
      y += 54;
      c.fillStyle = "#1c1838"; c.font = font(500, 30); c.textAlign = "left";
      let desc = String(item.desc || ""); while (c.measureText(desc).width > 520 && desc.length > 4) desc = `${desc.slice(0, -2)}…`.replace(/……$/, "…");
      c.fillText(desc, cols[0], y);
      c.textAlign = "right"; c.fillText(String(Number(item.qty || 0)), cols[1] + 40, y); c.fillText(cash(item.price, cur), cols[2] + 90, y);
      c.font = font(600, 30); c.fillText(cash(Number(item.qty || 0) * Number(item.price || 0), cur), cols[3], y);
      y += 22; c.fillStyle = "#f1eef9"; c.fillRect(P, y, W - P * 2, 2);
    });
    y += 72;
    c.fillStyle = "#1c1838"; c.font = font(700, 38); c.textAlign = "left"; c.fillText("Total", P, y);
    c.fillStyle = b.color; c.textAlign = "right"; c.font = font(700, 46); c.fillText(cash(total(inv), cur), W - P, y);
    if (qr || b.pay || inv.note) {
      y += 50;
      c.strokeStyle = "#d8d0f5"; c.lineWidth = 3; c.setLineDash([10, 8]); round(P, y, W - P * 2, 190, 24); c.stroke(); c.setLineDash([]);
      let x = P + 26;
      if (qr) { c.drawImage(qr, x, y + 20, 150, 150); x += 176; }
      c.textAlign = "left"; c.fillStyle = "#1c1838"; c.font = font(600, 30);
      if (b.pay) c.fillText(b.pay, x, y + (inv.note ? 82 : 104));
      if (inv.note) { c.fillStyle = "#7a7598"; c.font = font(500, 26); c.fillText(inv.note, x, y + (b.pay ? 126 : 104)); }
      y += 190;
    }
    y += 80;
    if (inv.status === "paid") {
      c.save(); c.translate(W / 2, y); c.rotate(-0.14);
      c.strokeStyle = "#1f9d6a"; c.lineWidth = 6; round(-130, -50, 260, 84, 18); c.stroke();
      c.fillStyle = "#1f9d6a"; c.font = font(800, 54); c.textAlign = "center"; c.fillText("PAID", 0, 14); c.restore();
    } else { c.fillStyle = "#7a7598"; c.textAlign = "center"; c.font = font(500, 28); c.fillText("Thank you!", W / 2, y); }
    return canvas;
  }
  async function savePng(inv) {
    try {
      if (document.fonts?.load) { try { await document.fonts.load('600 30px "Kantumruy Pro"'); } catch (error) { /* system font is fine */ } }
      const canvas = await drawPng(inv);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      const name = `${inv.number}-${String(inv.client || "").replace(/[^\p{L}\p{N}]+/gu, "-")}.png`;
      const fileObj = new File([blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [fileObj] })) { await navigator.share({ files: [fileObj], title: inv.number }); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (error) {
      if (error?.name !== "AbortError") Toast.show(L("មិនអាចរក្សាទុករូបបាន", "Couldn't save the image"), "error");
    }
  }
  // PDF: print only the invoice; the phone / browser offers "Save as PDF"
  function printPdf(inv) {
    document.querySelector(".iv-print")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="iv-print">${paper(inv)}</div>`);
    document.body.classList.add("iv-printing");
    const done = () => { document.body.classList.remove("iv-printing"); document.querySelector(".iv-print")?.remove(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); setTimeout(done, 1500); }, 60);
  }

  function bind() {
    const page = document.querySelector(".iv-page");
    if (!page || page.dataset.bound) return;
    page.dataset.bound = "1";
    page.addEventListener("click", event => {
      const b = sel => event.target.closest(sel);
      if (b("[data-iv-new]")) { invoiceForm(null); return; }
      if (b("[data-iv-brand]")) { brandForm(); return; }
      if (b("[data-iv-paid]")) { markPaid(b("[data-iv-paid]").dataset.ivPaid); return; }
      if (b("[data-iv-open]")) preview(b("[data-iv-open]").dataset.ivOpen);
    });
  }

  // launcher tile: "$200 owed" / "3 invoices"
  function badge() {
    const open = list().filter(inv => inv.status !== "paid");
    if (!list().length) return null;
    if (!open.length) return { text: L(`${list().length} invoice`, `${list().length} invoice${list().length > 1 ? "s" : ""}`), tone: "muted" };
    const owed = open.reduce((t, inv) => t + toProfileCurrency(total(inv), inv.currency || "USD"), 0);
    const late = open.some(inv => state(inv) === "late");
    return { text: L(`${cash(owed)} នៅជំពាក់`, `${cash(owed)} owed`), tone: late ? "red" : "amber" };
  }
  // for the Home "due soon" box: unpaid invoices due within `days` (or late)
  function dueSoon(days = 3) {
    const limit = addDays(today(), days);
    return list().filter(inv => inv.status !== "paid" && inv.due && inv.due <= limit).map(inv => ({ id: inv.id, client: inv.client, number: inv.number, amount: total(inv), currency: inv.currency || "USD", due: inv.due, late: inv.due < today() }));
  }

  return { render, bind, badge, dueSoon, preview, markPaid, total };
})();
