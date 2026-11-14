/* Smart daily spending (14 Nov): small daily spends ($3–5) get forgotten, so
 *  1) Home asks once an evening — one tap logs the usual amount (or $0 / more / own number);
 *  2) a day with nothing logged gets an "estimate" expense next morning (flag estimated:true, source "smart-est");
 *  3) at month end the user types the real ABA balance and the gap becomes one
 *     "unlogged spending" expense (source "reconcile"), so the numbers match the bank.
 * Setting: appData.profile.smartSpend = { on, daily, pay, start, filledTo }.
 * Estimates and reconcile entries are plain expenses (paymentType bank/cash) so
 * AccountBalances, reports and the Telegram digest keep working unchanged. */
const SmartSpend = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const prof = () => appData.profile || (appData.profile = {});
  const cfg = () => (prof().smartSpend && typeof prof().smartSpend === "object" ? prof().smartSpend : null);
  const on = () => !!(cfg() && cfg().on);
  const cur = () => prof().currency || "USD";
  const money = n => formatPlainMoney(Number(n) || 0, cur());
  const iso = d => localDateInput(d);
  const amt = e => toProfileCurrency(Number(e.amount) || 0, e.currency) || 0; // always in the profile currency (៛ rows too)
  const isSmart = e => e && (e.source === "smart" || e.source === "smart-est");
  const mine = e => e && (isSmart(e) || e.source === "reconcile");

  // the usual = average of the small daily spends you really logged in the last 7 days
  // (single items ≤ 15, no bills/loans/home; days you tapped "none" count as 0; estimates never feed themselves)
  const BIG = new Set(["Bills", "Loan", "Home"]);
  function recent(days = 7) {
    const byDay = {};
    const from = new Date(); from.setDate(from.getDate() - days);
    const f = iso(from), today = iso(new Date());
    (appData.expenses || []).forEach(e => {
      if (!e.date || e.date < f || e.date >= today || e.source === "smart-est" || e.source === "reconcile") return;
      if (e.source !== "smart" && (BIG.has(e.category) || amt(e) > 15)) return;
      byDay[e.date] = (byDay[e.date] || 0) + amt(e);
    });
    return Object.values(byDay);
  }
  function suggest() {
    let list = recent(7);
    if (list.length < 3) list = recent(30);
    if (list.length < 3) return 4;
    const avg = list.reduce((s, v) => s + v, 0) / list.length;
    return Math.max(0.5, Math.round(avg * 2) / 2);
  }
  const auto = () => cfg()?.mode !== "manual";
  const daily = () => (auto() ? suggest() : Number(cfg()?.daily) > 0 ? Number(cfg().daily) : suggest());

  function entry(date, amount, estimated) {
    const now = new Date().toISOString();
    return { id: id("expense"), createdAt: now, updatedAt: now, description: estimated ? L("ចំណាយប្រចាំថ្ងៃ · ប៉ាន់ស្មាន", "Daily spending · estimate") : L("ចំណាយប្រចាំថ្ងៃ", "Daily spending"), amount: Number(amount) || 0, currency: cur(), date, category: "Other", paymentType: cfg()?.pay || "bank", method: "Smart", notes: "", source: estimated ? "smart-est" : "smart", estimated: !!estimated };
  }

  // days with nothing logged at all → estimate (runs once a day)
  function fill() {
    const c = cfg();
    if (!c || !c.on || !Array.isArray(appData.expenses)) return;
    const today = iso(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    const last = iso(y);
    let cursor = c.filledTo ? new Date(`${c.filledTo}T00:00:00`) : new Date(`${c.start}T00:00:00`);
    if (c.filledTo) cursor.setDate(cursor.getDate() + 1);
    if (iso(cursor) > last) return;
    const amount = daily();
    let added = 0, guard = 0;
    for (; iso(cursor) <= last && guard < 62; cursor.setDate(cursor.getDate() + 1), guard++) {
      const d = iso(cursor);
      if (d >= today || d < c.start) continue;
      if (appData.expenses.some(e => e.date === d)) continue;
      appData.expenses.push(entry(d, amount, true));
      added++;
    }
    c.filledTo = last;
    Store.save();
    if (added && typeof Toast !== "undefined") Toast.show(L(`ប៉ាន់ស្មានចំណាយ ${added} ថ្ងៃដែលភ្លេចកត់`, `Estimated ${added} unlogged day(s)`));
  }

  const todayEntry = () => (appData.expenses || []).find(e => isSmart(e) && e.date === iso(new Date()));

  function logToday(amount) {
    const previous = structuredClone(appData);
    const today = iso(new Date());
    appData.expenses = (appData.expenses || []).filter(e => !(isSmart(e) && e.date === today));
    appData.expenses.push(entry(today, amount, false));
    if (!Store.save()) { restoreData(previous); return; }
    Toast.show(L(`កត់ថ្ងៃនេះ ${money(amount)} ✓`, `Logged today ${money(amount)} ✓`));
    App.render();
  }

  function amountModal(title, value, submit) {
    Modal.open({ title, submitText: L("រក្សាទុក", "Save"), fields: [{ name: "amount", label: L(`ចំនួន (${cur()})`, `Amount (${cur()})`), type: "number", value, required: true }], onSubmit(data) { const n = Number(data.amount); if (!(n >= 0)) return; Modal.close(); submit(n); } });
  }

  function setup() {
    const c = cfg() || {};
    Modal.open({
      title: L("ចំណាយប្រចាំថ្ងៃឆ្លាត", "Smart daily spending"), submitText: L("បើក", "Turn on"),
      fields: [
        { name: "mode", label: L("ចំនួនប៉ាន់ស្មាន", "Estimate"), type: "select", options: ["auto", "manual"], optionLabels: [L(`ស្វ័យប្រវត្តិ · មធ្យម 7 ថ្ងៃចុងក្រោយ (ឥឡូវ ${money(suggest())})`, `Auto · average of your last 7 days (now ${money(suggest())})`), L("កំណត់ខ្លួនឯង", "Set myself")], value: c.mode === "manual" ? "manual" : "auto" },
        { name: "daily", label: L(`បើកំណត់ខ្លួនឯង៖ ចំណាយក្នុងមួយថ្ងៃ (${cur()})`, `If set myself: spend per day (${cur()})`), type: "number", value: c.daily || suggest() },
        { name: "pay", label: L("ចាយតាមអ្វីជាធម្មតា", "Usually paid by"), type: "select", options: ["bank", "cash"], optionLabels: [L("ធនាគារ / QR (ABA)", "Bank / QR (ABA)"), L("សាច់ប្រាក់", "Cash")], value: c.pay || "bank" }
      ],
      onSubmit(data) {
        const previous = structuredClone(appData);
        const today = iso(new Date());
        prof().smartSpend = { on: true, mode: data.mode === "manual" ? "manual" : "auto", daily: Math.max(0.5, Number(data.daily) || suggest()), pay: data.pay === "cash" ? "cash" : "bank", start: c.start || today, filledTo: c.filledTo || "" };
        if (!Store.save()) { restoreData(previous); return; }
        Modal.close(); Toast.show(L("បើកហើយ ✓", "Turned on ✓")); App.render();
      }
    });
  }

  function turnOff() {
    const previous = structuredClone(appData);
    if (cfg()) { cfg().on = false; cfg().filledTo = ""; }
    if (!Store.save()) { restoreData(previous); return; }
    Toast.show(L("បានបិទ (ទិន្នន័យចាស់នៅដដែល)", "Turned off (old entries kept)")); App.render();
  }

  function reconcile() {
    const bal = typeof AccountBalances !== "undefined" ? AccountBalances.calculate() : null;
    if (!bal) return;
    Modal.open({
      title: L(`ផ្ទៀងផ្ទាត់ ABA · app គិតថា ${money(bal.bank)}`, `Match ABA · app says ${money(bal.bank)}`), submitText: L("កត់ភាពខុសគ្នា", "Record the gap"),
      fields: [{ name: "real", label: L(`សមតុល្យពិតក្នុង ABA ថ្ងៃនេះ (${cur()})`, `Real ABA balance today (${cur()})`), type: "number", value: "", required: true }],
      onSubmit(data) {
        const real = Number(data.real);
        if (!Number.isFinite(real)) return;
        const gap = Math.round((bal.bank - real) * 100) / 100;
        if (gap <= 0.004) { Modal.close(); Toast.show(gap < -0.004 ? L(`ABA ច្រើនជាង app ${money(-gap)} · ប្រហែលមានចំណូលមិនទាន់កត់`, `ABA is ${money(-gap)} above the app · maybe unlogged income`) : L("ត្រូវគ្នាបេះបិទ ✓", "Matches exactly ✓"), "success"); return; }
        const previous = structuredClone(appData);
        const now = new Date().toISOString();
        appData.expenses.push({ id: id("expense"), createdAt: now, updatedAt: now, description: L("ចំណាយមិនបានកត់ (ផ្ទៀងផ្ទាត់ ABA)", "Unlogged spending (ABA match)"), amount: gap, currency: cur(), date: iso(new Date()), category: "Other", paymentType: "bank", method: "ABA", notes: "", source: "reconcile" });
        if (!Store.save()) { restoreData(previous); return; }
        Modal.close(); Toast.show(L(`បានកត់ចំណាយមិនបានកត់ ${money(gap)} ✓`, `Recorded ${money(gap)} unlogged ✓`)); App.render();
      }
    });
  }

  const todayTotal = () => (appData.expenses || []).filter(e => e.date === iso(new Date())).reduce((t, e) => t + amt(e), 0);

  function monthSummary() {
    const ym = iso(new Date()).slice(0, 7);
    const list = (appData.expenses || []).filter(e => String(e.date).startsWith(ym));
    const sum = f => list.filter(f).reduce((s, e) => s + amt(e), 0);
    const est = sum(e => e.source === "smart-est"), miss = sum(e => e.source === "reconcile");
    const real = sum(e => !(e.source === "smart-est" || e.source === "reconcile"));
    return { real, est, miss, total: real + est + miss };
  }


  // Home slider slide (J1, 14 Nov): small wallet + big daily number, 3 stats, one-tap chips
  const WALLET = `<svg class="hs-wallet" width="132" height="150" viewBox="0 0 150 170" aria-hidden="true"><defs><linearGradient id="hs-wl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a48fff"/><stop offset="1" stop-color="#6c5ce7"/></linearGradient><linearGradient id="hs-cn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f0a530"/><stop offset=".5" stop-color="#ffe08a"/><stop offset="1" stop-color="#f0a530"/></linearGradient></defs><ellipse cx="75" cy="160" rx="54" ry="8" fill="#7b68ee" opacity=".16"/><g class="hs-coinfall"><ellipse cx="64" cy="30" rx="15" ry="15" fill="url(#hs-cn)" stroke="#e0951f" stroke-width="2"/><text x="64" y="36" font-size="16" text-anchor="middle" fill="#a8680f" font-weight="800">$</text></g><g class="hs-coinfall c2"><ellipse cx="96" cy="26" rx="12" ry="12" fill="url(#hs-cn)" stroke="#e0951f" stroke-width="2"/><text x="96" y="31" font-size="13" text-anchor="middle" fill="#a8680f" font-weight="800">$</text></g><g class="hs-wob"><rect x="18" y="62" width="114" height="88" rx="22" fill="url(#hs-wl)"/><path d="M18 84H132" stroke="#fff" stroke-opacity=".25" stroke-width="2"/><rect x="88" y="94" width="52" height="34" rx="14" fill="#5b49d6"/><circle cx="106" cy="111" r="6" fill="#ffe08a"/><path d="M34 62 Q75 38 116 62" fill="none" stroke="#c9bdff" stroke-width="6" stroke-linecap="round"/><path d="M30 76 q-4 30 2 56" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/></g></svg>`;
  function slide() {
    if (!on()) return "";
    fill();
    const d = daily(), t = todayEntry(), s = monthSummary();
    const stat = (k, v) => `<span><small>${escapeHtml(k)}</small><b>${escapeHtml(v)}</b></span>`;
    const stats = `<span class="hs-stats">${stat(L("ថ្ងៃនេះ", "Today"), money(todayTotal()))}${stat(L("ខែនេះ", "This month"), money(s.total))}${stat(L("កត់ពិត", "Logged"), `${s.total ? Math.round((s.real / s.total) * 100) : 100}%`)}</span>`;
    const act = t
      ? `<span class="hs-done"><b>${escapeHtml(L(`ថ្ងៃនេះកត់ ${money(t.amount)} ✓`, `Today logged ${money(t.amount)} ✓`))}</b><button type="button" class="hs-chip" data-ss="edit-today">${escapeHtml(L("កែ", "Edit"))}</button></span>`
      : `<span class="hs-chips"><button type="button" class="hs-chip is-main" data-ss="pick" data-v="${d}">${escapeHtml(L("ធម្មតា", "Usual"))} ${escapeHtml(money(d))}</button><button type="button" class="hs-chip" data-ss="pick" data-v="0">${escapeHtml(L("មិនបានចាយ", "None"))}</button><button type="button" class="hs-chip" data-ss="custom">${escapeHtml(L("ផ្សេង", "Other"))}</button></span>`;
    return `<div class="hs-slide hs-info hs-tone-spend hs-spendj" data-hs-kind="spend">
      <span class="hs-deco" aria-hidden="true"><i>🪙</i><i>✨</i><i>💸</i></span><span class="hs-top"><span class="hs-lab">💸 ${escapeHtml(L("ចំណាយប្រចាំថ្ងៃ", "Daily spend"))}</span></span>
      <span class="hs-row">${WALLET}<span class="hs-main"><span class="hs-sub">${escapeHtml(auto() ? L("មធ្យម 7 ថ្ងៃចុងក្រោយ", "7-day average") : L("កំណត់ដោយខ្លួនឯង", "Set by you"))}</span><b class="hs-big">${escapeHtml(money(d))}<small>${escapeHtml(L("/ថ្ងៃ", "/day"))}</small></b></span></span>
      ${stats}${act}
    </div>`;
  }

  function card() {
    if (!on()) return "";
    fill();
    const t = todayEntry();
    const nomi = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy("happy") : "🐱";
    if (t) return `<section class="ss ss-done"><span class="ss-cat" aria-hidden="true">${nomi}</span><span class="ss-tx"><b>${escapeHtml(L(`ថ្ងៃនេះកត់ ${money(t.amount)} ✓`, `Today logged ${money(t.amount)} ✓`))}</b></span><button type="button" class="ss-link" data-ss="edit-today">${escapeHtml(L("កែ", "Edit"))}</button></section>`;
    const d = daily();
    return `<section class="ss"><div class="ss-top"><span class="ss-cat" aria-hidden="true">${nomi}</span><span class="ss-tx"><b>${escapeHtml(L("ថ្ងៃនេះចាយប៉ុន្មាន?", "How much did you spend today?"))}</b><small>${escapeHtml(L(`ធម្មតាប្រហែល ${money(d)}/ថ្ងៃ${auto() ? " (ពី 7 ថ្ងៃចុងក្រោយ)" : ""}`, `Usually about ${money(d)}/day${auto() ? " (last 7 days)" : ""}`))}</small></span></div>
      <div class="ss-chips"><button type="button" class="ss-chip is-main" data-ss="pick" data-v="${d}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><path d="M5 13l4 4L19 7"/></svg>${escapeHtml(L("ធម្មតា", "Usual"))} ${escapeHtml(money(d))}</button><button type="button" class="ss-chip" data-ss="pick" data-v="0">${escapeHtml(L("មិនបានចាយ", "None"))}</button><button type="button" class="ss-chip" data-ss="pick" data-v="${Math.round(d * 2 * 2) / 2}">${escapeHtml(L("ច្រើនជាង", "More"))} ${escapeHtml(money(Math.round(d * 2 * 2) / 2))}</button><button type="button" class="ss-chip" data-ss="custom" aria-label="${escapeAttr(L("វាយចំនួនខ្លួនឯង", "Type an amount"))}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button></div></section>`;
  }

  function section() {
    const nomi = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy("happy") : "🐱";
    if (!on()) return `<section class="fv2-section ss ss-sec"><div class="ss-top"><span class="ss-cat" aria-hidden="true">${nomi}</span><span class="ss-tx"><b>${escapeHtml(L("ចំណាយប្រចាំថ្ងៃឆ្លាត", "Smart daily spending"))}</b><small>${escapeHtml(L("ភ្លេចកត់ $3–5 រាល់ថ្ងៃ? app ប៉ាន់ស្មានឱ្យ ហើយចុងខែផ្ទៀងនឹង ABA", "Forget small daily spends? The app estimates them and you match ABA at month end"))}</small></span></div><button type="button" class="ss-go" data-ss="setup">${escapeHtml(L("បើកដំណើរការ", "Turn on"))}</button></section>`;
    fill();
    const s = monthSummary();
    const pct = s.total ? Math.round((s.real / s.total) * 100) : 100;
    const bar = [["real", s.real], ["est", s.est], ["miss", s.miss]].filter(p => p[1] > 0).map(p => `<i class="ss-b-${p[0]}" style="width:${(p[1] / s.total) * 100}%"></i>`).join("");
    const pill = (cls, text) => `<span class="ss-pill"><i class="ss-b-${cls}"></i>${escapeHtml(text)}</span>`;
    return `<section class="fv2-section ss ss-sec"><div class="ss-top"><span class="ss-cat" aria-hidden="true">${nomi}</span><span class="ss-tx"><b>${escapeHtml(L("ចំណាយប្រចាំថ្ងៃឆ្លាត", "Smart daily spending"))}</b><small>${escapeHtml(L(`ប៉ាន់ស្មានថ្ងៃភ្លេចកត់ · ${cfg().pay === "cash" ? "សាច់ប្រាក់" : "ABA"}`, `Estimates forgotten days · ${cfg().pay === "cash" ? "cash" : "ABA"}`))}</small></span></div>
      <div class="ss-total"><small>${escapeHtml(auto() ? L("ចំណាយប្រចាំថ្ងៃ · មធ្យម 7 ថ្ងៃចុងក្រោយ", "Daily spend · 7-day average") : L("ចំណាយប្រចាំថ្ងៃ · កំណត់ដោយខ្លួនឯង", "Daily spend · set by you"))}</small><strong>${escapeHtml(money(daily()))}<em>${escapeHtml(L("/ថ្ងៃ", "/day"))}</em></strong></div>
      <div class="ss-two"><div><small>${escapeHtml(L("ថ្ងៃនេះ", "Today"))}</small><b>${escapeHtml(money(todayTotal()))}</b></div><div><small>${escapeHtml(L("ខែនេះ", "This month"))}</small><b>${escapeHtml(money(s.total))}</b></div></div>
      <div class="ss-bar">${bar}</div>
      <div class="ss-pills">${pill("real", L(`កត់ពិត ${pct}%`, `Logged ${pct}%`))}${s.est > 0 ? pill("est", L(`ប៉ាន់ស្មាន ${money(s.est)}`, `Estimated ${money(s.est)}`)) : ""}${s.miss > 0 ? pill("miss", L(`មិនបានកត់ ${money(s.miss)}`, `Unlogged ${money(s.miss)}`)) : ""}</div>
      <button type="button" class="ss-go ss-wide" data-ss="recon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18"/></svg><span>${escapeHtml(L("ផ្ទៀងផ្ទាត់ ABA ចុងខែ", "Match ABA (month end)"))}</span></button>
      <div class="ss-sub"><button type="button" class="ss-sbtn" data-ss="setup"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg><span>${escapeHtml(L("កំណត់", "Settings"))}</span></button><button type="button" class="ss-sbtn is-off" data-ss="off"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 11-12.8 0"/></svg><span>${escapeHtml(L("បិទ", "Turn off"))}</span></button></div></section>`;
  }

  document.addEventListener("click", event => {
    const el = event.target.closest("[data-ss]");
    if (!el) return;
    const act = el.dataset.ss;
    if (act === "pick") logToday(Number(el.dataset.v) || 0);
    else if (act === "custom") amountModal(L("ចំណាយថ្ងៃនេះ", "Today's spending"), "", logToday);
    else if (act === "edit-today") amountModal(L("កែចំណាយថ្ងៃនេះ", "Edit today"), todayEntry()?.amount || 0, logToday);
    else if (act === "setup") setup();
    else if (act === "off") turnOff();
    else if (act === "recon") reconcile();
  });

  return { card, slide, section, fill, suggest, monthSummary };
})();
