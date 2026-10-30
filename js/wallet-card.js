/* Home money card. Layout: "Ticket" (31 Oct 2026): blue top (card colour) with name, money left,
 * % spent + bar; dashed tear line; white stub with spent / today / per day. Older note:
 * Home money card as a bank-style wallet card (draft A, 30 Oct 2026).
 * One card: chip, contactless mark, card name, •••• last 4 (decoration only),
 * money left this month, today / per day, and the profile photo in a frame.
 * The ✏️ opens "Design my card": frame (ring / ID / polaroid / stamp / hex / full),
 * card colour (gradient / solid / custom), amount colour (gold / silver / white),
 * name, last 4, own photo (drag to move, zoom, colour on photo), hide amount. Saved in
 * appData.profile.walletCard (synced like every other profile setting).
 * Styles: css/wallet-card.css. Used by HomeV2.money(). */
const WalletCard = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  // gradients and solid colours; "custom" uses walletCard.c1 / c2 (solid when c2 is empty)
  const GRADS = [
    ["blue", "radial-gradient(120% 90% at 100% 0,#6d5dfc 0,transparent 55%),linear-gradient(135deg,#1b2b6b,#2e4bdc 60%,#1e8fff)"],
    ["green", "radial-gradient(110% 80% at 100% 0,rgba(197,255,96,.85) 0,transparent 50%),linear-gradient(135deg,#0f3326,#15513a 60%,#2a7a4a)"],
    ["pink", "radial-gradient(110% 80% at 0 0,#ffd0e0 0,transparent 55%),linear-gradient(135deg,#ff7a9c,#ff9d6b)"],
    ["black", "linear-gradient(135deg,#232323,#3d3d3d 60%,#111)"],
    ["rose", "radial-gradient(90% 70% at 85% 10%,rgba(255,255,255,.22) 0,transparent 60%),linear-gradient(135deg,#f6b38c,#c97aa5)"],
    ["violet", "linear-gradient(135deg,#6d5dfc,#c86dd7)"],
    ["ocean", "linear-gradient(135deg,#00c6a7,#1e8fff)"],
    ["sunset", "linear-gradient(135deg,#ffd25e,#ff8a3d)"],
    ["wine", "linear-gradient(135deg,#7a0f2e,#d6336c)"],
    ["gold", "linear-gradient(135deg,#d4af37,#7a5a12)"],
    ["silver", "linear-gradient(135deg,#c0c8d2,#6b7785)"]
  ];
  const SOLIDS = [["s-navy", "#1b2b6b"], ["s-blue", "#1e7cf0"], ["s-green", "#15513a"], ["s-lime", "#5f8f1e"], ["s-teal", "#0f8a8a"], ["s-purple", "#5b3fd1"], ["s-pink", "#e2557d"], ["s-red", "#c62a30"], ["s-orange", "#e0701f"], ["s-brown", "#7a4a2a"], ["s-grey", "#4a5563"], ["s-black", "#141414"]];
  const SKINS = [...GRADS, ...SOLIDS].map(([id, bg]) => ({ id, bg }));
  const bgOf = c => {
    if (c.skin === "custom" && /^#[0-9a-f]{6}$/i.test(c.c1 || "")) {
      const two = /^#[0-9a-f]{6}$/i.test(c.c2 || "") && c.dir !== "solid";
      if (!two) return c.c1;
      if (c.dir === "down") return `linear-gradient(180deg,${c.c1},${c.c2})`;
      if (c.dir === "radial") return `radial-gradient(circle at 25% 15%,${c.c1},${c.c2} 85%)`;
      return `linear-gradient(135deg,${c.c1},${c.c2})`;
    }
    return (SKINS.find(s => s.id === c.skin) || SKINS[0]).bg;
  };
  const FRAMES = [
    { id: "ring", km: "រង្វង់ពណ៌", en: "Ring" },
    { id: "id", km: "កាត ID", en: "ID card" },
    { id: "pola", km: "Polaroid", en: "Polaroid" },
    { id: "stamp", km: "តែម", en: "Stamp" },
    { id: "hex", km: "ប្រាំមួយជ្រុង", en: "Badge" },
    { id: "full", km: "ពេញកាត", en: "Full card" },
    { id: "none", km: "គ្មានរូប", en: "No photo" }
  ];
  const dark = () => document.documentElement.dataset.theme !== "light";
  const conf = () => {
    // colour can differ per theme: walletCard.light / walletCard.dark = { skin, c1, c2, dir } (31 Oct)
    const raw = appData.profile?.walletCard || {};
    const c = { ...raw, ...(raw[dark() ? "dark" : "light"] || {}) };
    const name = String(appData.profile?.name || "MYLIFE").split(/\s+/)[0].toUpperCase();
    return {
      skin: c.skin === "custom" || SKINS.some(s => s.id === c.skin) ? c.skin : (dark() ? "green" : "blue"),
      c1: c.c1 || "#6d5dfc", c2: c.c2 || "#00c6a7",
      dir: ["solid", "diag", "down", "radial"].includes(c.dir) ? c.dir : (c.c2 === "" ? "solid" : "diag"),
      shine: c.shine !== false, upper: c.upper !== false,
      amount: ["gold", "silver", "white"].includes(c.amount) ? c.amount : "gold",
      px: Number.isFinite(c.px) ? c.px : 50, py: Number.isFinite(c.py) ? c.py : 50, zoom: Number.isFinite(c.zoom) ? c.zoom : 100,
      tint: Number.isFinite(c.tint) ? c.tint : 60,
      frame: FRAMES.some(f => f.id === c.frame) ? c.frame : "ring",
      name: String(c.name || `${name} · MYLIFE`).slice(0, 22),
      last4: /^\d{4}$/.test(c.last4 || "") ? c.last4 : String(new Date().getFullYear()),
      photo: c.photo || "",
      hide: !!c.hide,
      // ticket card (31 Oct): title = name shown big (default first name), caps = all capitals
      title: String(c.title || String(appData.profile?.name || "MYLIFE").split(/\s+/)[0]).slice(0, 22),
      caps: c.caps === true
    };
  };
  const photoOf = c => c.photo || appData.profile?.photo || "";
  const money = v => (typeof formatPlainMoney === "function" ? formatPlainMoney(Number(v) || 0, appData.profile.currency || "USD") : `$${(Number(v) || 0).toFixed(2)}`);
  const initial = () => escapeHtml((String(appData.profile?.name || "M").trim()[0] || "M").toUpperCase());

  const ICON = {
    nfc: '<svg class="wc-nfc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 8a6 6 0 0 1 0 8M12 5a10 10 0 0 1 0 14M16 3a13 13 0 0 1 0 18"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16Z"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" opacity=".18"/><path d="M12 7v9m-4-4 4 4 4-4" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" opacity=".18"/><path d="M12 17V8m-4 4 4-4 4 4" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function frameHtml(c, extraClass = "") {
    if (c.frame === "none") return "";
    const src = photoOf(c);
    const face = src ? `<img src="${escapeAttr(src)}" alt="" draggable="false" style="object-position:${c.px}% ${c.py}%;transform:scale(${c.zoom / 100});transform-origin:${c.px}% ${c.py}%">` : `<span>${initial()}</span>`;
    const first = escapeHtml(String(appData.profile?.name || "").split(/\s+/)[0] || "");
    return `<span class="wc-pf wc-f-${c.frame} ${extraClass}"><span class="wc-face">${face}</span>${c.frame === "pola" ? `<b>${first} ♡</b>` : ""}</span>`;
  }

  // m = moneyMonthNumbers(); due = MoneyAsk items (optional "waiting" row)
  function render(m, todayIso, dueHtml = "") {
    const c = conf();
    const now = new Date();
    const monthName = km() ? KM_MONTHS[now.getMonth()] : now.toLocaleDateString("en-US", { month: "long" });
    const spentToday = (appData.expenses || []).filter(item => item.date === todayIso).reduce((t, item) => t + toProfileCurrency(item.amount, item.currency), 0);
    const daysLeft = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1);
    const perDay = Math.max(0, m.left) / daysLeft;
    const hideCls = c.hide ? " is-hidden" : "";
    const spentPct = m.income > 0 ? Math.round((m.expenses / m.income) * 100) : 0;
    return `<section class="hv2-money wc-wrap">
      <article class="wc-card wc-tk${c.frame === "none" ? " no-photo" : ""}${c.caps ? " is-caps" : ""}${c.shine ? "" : " no-shine"}" style="--wc-bg:${escapeAttr(bgOf(c))};--wc-tint:${c.tint / 100}" aria-label="${escapeAttr(L(`នៅសល់ខែ${monthName}`, `Left in ${monthName}`))}">
        <div class="wc-tk-top">
          <div class="wc-tk-head">
            ${frameHtml(c.frame === "none" ? c : { ...c, frame: "ring" }, "wc-tk-pf")}
            <span class="wc-tk-who"><b>${escapeHtml(c.title)}</b><small>${escapeHtml(L(`នៅសល់ខែ${monthName} · ${daysLeft} ថ្ងៃទៀត`, `${monthName} · ${daysLeft} days left`))}</small></span>
            <button type="button" class="wc-edit wc-tk-edit" data-wc-edit aria-label="${escapeAttr(L("រចនាកាត", "Design card"))}">${ICON.pen}<span>${escapeHtml(L("កែ", "Edit"))}</span></button>
          </div>
          <div class="wc-tk-amt">
            <div><small class="wc-label">${escapeHtml(L("នៅសល់សម្រាប់ចាយ", "Left to spend"))}</small><a class="wc-amount money-value${m.left < 0 ? " is-neg" : ""}${hideCls}" href="#money">${escapeHtml(money(m.left))}</a></div>
            <span class="wc-tk-pct">${escapeHtml(L("ចាយរួច", "Spent"))}<b>${spentPct}%</b></span>
          </div>
          <div class="wc-tk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${spentPct}"><i style="width:${Math.min(100, spentPct)}%"></i></div>
          <div class="wc-tk-scale"><span>${escapeHtml(L("ចាយ", "Spent"))} <b class="money-value${hideCls}">${escapeHtml(money(m.expenses))}</b></span><span>${escapeHtml(L("ថវិកា", "Budget"))} <b class="money-value${hideCls}">${escapeHtml(money(m.income))}</b></span></div>
        </div>
        <div class="wc-tk-bot">
          <span><i class="is-out">↑</i>${escapeHtml(L("ចាយ", "Spent"))}<b class="money-value${hideCls}">${escapeHtml(money(m.expenses))}</b></span>
          <span><i class="is-today">●</i>${escapeHtml(L("ថ្ងៃនេះ", "Today"))}<b class="money-value${hideCls}">${escapeHtml(money(spentToday))}</b></span>
          <span><i class="is-ok">✓</i>${escapeHtml(L("ចាយបាន/ថ្ងៃ", "Per day"))}<b class="money-value${hideCls}">${escapeHtml(money(perDay))}</b></span>
        </div>
      </article>
      <div class="wc-mini">
        <a href="#money/income" class="wc-io is-in"><i>${ICON.down}</i><span><small>${escapeHtml(L("ចំណូល", "Income"))}</small><b class="money-value${hideCls}">${escapeHtml(money(m.income))}</b></span></a>
        <a href="#money/expenses" class="wc-io is-out"><i>${ICON.up}</i><span><small>${escapeHtml(L("ចាយ", "Spent"))}</small><b class="money-value${hideCls}">${escapeHtml(money(m.expenses))}</b></span></a>
      </div>
      ${dueHtml}
    </section>`;
  }

  /* ---------- "Design my card" sheet (31 Oct): card on top, 3 tabs (colour · photo · more), save bar ---------- */
    const DIRS = [["solid", "ពណ៌តែមួយ", "One colour"], ["diag", "↘ ទ្រេត", "↘ Diagonal"], ["down", "↓ ចុះ", "↓ Down"], ["radial", "◎ រង្វង់", "◎ Radial"]];
  const look = d => ({ skin: d.skin, c1: d.c1, c2: d.c2, dir: d.dir });
  const sameLook = (a, b) => a.skin === b.skin && (a.skin !== "custom" || (a.c1 === b.c1 && a.c2 === b.c2 && a.dir === b.dir));

  function open() {
    const root = document.getElementById("modalRoot");
    if (!root) return;
    if (typeof Modal !== "undefined" && Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    const c = conf();
    const start = { ...c, recent: Array.isArray(appData.profile?.walletCard?.recent) ? appData.profile.walletCard.recent.slice(0, 4) : [] };
    let draft = { ...start };
    let tab = "color";
    const left = typeof moneyMonthNumbers === "function" ? moneyMonthNumbers().left : 0;
    const swatch = (id, bg) => `<button type="button" class="wc-sw" data-wc-skin="${id}" style="background:${escapeAttr(bg)}" aria-label="${id}"></button>`;
    const TABS = [["color", "🎨", L("ពណ៌", "Colour")], ["photo", "📷", L("រូប", "Photo")], ["more", "⚙️", L("ផ្សេងៗ", "More")]];
    root.innerHTML = `
      <form class="modal glass-card wc-sheet" id="modalForm" novalidate>
        <div class="wc-sh-head"><h2 class="section-title">🎨 ${escapeHtml(L("រចនាកាតរបស់ខ្ញុំ", "Design my card"))}</h2>
          <button class="icon-button" type="button" data-close aria-label="${escapeAttr(t("close"))}">${Icons.close()}</button></div>
        <div class="wc-stage"><div class="wc-preview" data-wc-preview></div></div>
        <div class="wc-tabbar" role="tablist">${TABS.map(([id, icon, label]) => `<button type="button" role="tab" data-wc-tab="${id}"><span aria-hidden="true">${icon}</span>${escapeHtml(label)}</button>`).join("")}</div>
        <div class="wc-panels">
          <section data-wc-panel="color">
            <p class="wc-lbl"><span>${escapeHtml(L("ពណ៌កាត", "Card colour"))}</span><small>${escapeHtml(dark() ? L("សម្រាប់ 🌙 Dark", "for 🌙 Dark") : L("សម្រាប់ ☀️ Light", "for ☀️ Light"))}</small></p>
            <div class="wc-sws">${SKINS.map(k => swatch(k.id, k.bg)).join("")}</div>
            <div class="wc-recent" data-wc-recent></div>
            <p class="wc-lbl"><span>${escapeHtml(L("ពណ៌ខ្លួនឯង", "Your own colours"))}</span></p>
            <div class="wc-pick2">
              <label class="wc-pk"><input type="color" name="wcC1" value="${escapeAttr(c.c1)}"><span>${escapeHtml(L("ពណ៌ 1", "Colour 1"))}<b data-wc-hex1>${escapeHtml(c.c1.toUpperCase())}</b></span></label>
              <span aria-hidden="true">→</span>
              <label class="wc-pk" data-wc-c2-row><input type="color" name="wcC2" value="${escapeAttr(c.c2 || "#00c6a7")}"><span>${escapeHtml(L("ពណ៌ 2", "Colour 2"))}<b data-wc-hex2>${escapeHtml((c.c2 || "#00c6a7").toUpperCase())}</b></span></label>
            </div>
            <div class="wc-dirs">${DIRS.map(([id, k, e]) => `<button type="button" data-wc-dir="${id}">${escapeHtml(km() ? k : e)}</button>`).join("")}</div>
          </section>
          <section data-wc-panel="photo">
            <div class="wc-crop" data-wc-crop></div>
            <label class="wc-sl" data-wc-adjust><span aria-hidden="true">🔍</span><input type="range" name="wcZoom" min="100" max="300" step="5" value="${c.zoom}" aria-label="${escapeAttr(L("ពង្រីក", "Zoom"))}"><b data-wc-zoom-val>${c.zoom}%</b></label>
            <div class="wc-btns">
              <label class="wc-bt"><span aria-hidden="true">🖼️</span>${escapeHtml(L("ជ្រើសរូបថ្មី", "New photo"))}<input type="file" accept="image/*" name="wcPhoto" hidden></label>
              <button type="button" class="wc-bt" data-wc-use-profile><span aria-hidden="true">👤</span>${escapeHtml(L("រូបគណនី", "Account photo"))}</button>
              <button type="button" class="wc-bt" data-wc-no-photo><span aria-hidden="true">🚫</span>${escapeHtml(L("គ្មានរូប", "No photo"))}</button>
            </div>
          </section>
          <section data-wc-panel="more">
            <label class="wc-fd"><span>${escapeHtml(L("ឈ្មោះលើកាត", "Name on card"))}</span><span class="wc-in"><input type="text" maxlength="22" name="wcName" value="${escapeAttr(c.title)}"><small data-wc-count>${c.title.length}/22</small></span></label>
            <label class="wc-tg"><span>🙈 ${escapeHtml(L("លាក់ចំនួនលុយលើកាត", "Hide amounts on the card"))}</span><input type="checkbox" name="wcHide" ${c.hide ? "checked" : ""}></label>
            <label class="wc-tg"><span>🔠 ${escapeHtml(L("ឈ្មោះអក្សរធំ", "Name in capitals"))}</span><input type="checkbox" name="wcUpper" ${c.caps ? "checked" : ""}></label>
            <label class="wc-tg"><span>✨ ${escapeHtml(L("ពន្លឺរត់លើកាត", "Shine on the card"))}</span><input type="checkbox" name="wcShine" ${c.shine ? "checked" : ""}></label>
          </section>
        </div>
        <div class="wc-foot-bar"><button type="button" class="wc-rs" data-wc-reset>↺ ${escapeHtml(L("ដើមវិញ", "Reset"))}</button><button class="wc-save" type="submit">${escapeHtml(L("រក្សាទុក", "Save"))}</button></div>
      </form>`;
    root.classList.add("open");
    if (typeof Modal !== "undefined") {
      Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
      document.addEventListener("keydown", Modal.escapeHandler);
    }
    const form = root.querySelector("#modalForm");
    const host = form.querySelector("[data-wc-preview]");
    const $ = sel => form.querySelector(sel);
    const hasPhoto = () => draft.frame !== "none" && !!photoOf(draft);

    const paintCard = () => {
      const saved = appData.profile.walletCard;
      appData.profile.walletCard = draft; // preview only, restored right after
      host.innerHTML = render({ left, income: 0, expenses: 0 }, localDateInput()).replace(/<div class="wc-mini">[\s\S]*?<\/div>\s*<\/section>/, "</section>");
      appData.profile.walletCard = saved;
    };
    const cropPaint = () => {
      const src = photoOf(draft);
      $("[data-wc-crop]").innerHTML = hasPhoto() ? `<img src="${escapeAttr(src)}" alt="" draggable="false"><em>✋ ${escapeHtml(L("អូសដើម្បីផ្លាស់ទី", "Drag to move"))}</em>` : `<span>${draft.frame === "none" ? "🚫" : initial()}</span>`;
    };
    const paint = () => {
      paintCard();
      cropPaint();
      form.querySelectorAll("[data-wc-tab]").forEach(b => { const on = b.dataset.wcTab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      form.querySelectorAll("[data-wc-panel]").forEach(p => { p.hidden = p.dataset.wcPanel !== tab; });
      form.querySelectorAll("[data-wc-skin]").forEach(b => b.classList.toggle("on", b.dataset.wcSkin === draft.skin));
      form.querySelectorAll("[data-wc-dir]").forEach(b => b.classList.toggle("on", draft.skin === "custom" && b.dataset.wcDir === draft.dir));
      $("[data-wc-c2-row]").classList.toggle("is-off", draft.dir === "solid");
      $("[data-wc-adjust]").hidden = !hasPhoto();
      form.querySelector("[data-wc-no-photo]").classList.toggle("on", draft.frame === "none");
      const recent = (draft.recent || []).filter(r => !sameLook(r, draft)).slice(0, 4);
      $("[data-wc-recent]").innerHTML = recent.length ? `<span>${escapeHtml(L("ប្រើថ្មីៗ", "Recent"))}</span>${recent.map((r, i) => `<button type="button" data-wc-recent-i="${i}" style="background:${escapeAttr(bgOf({ ...c, ...r }))}" aria-label="recent ${i + 1}"></button>`).join("")}` : "";
      $("[data-wc-recent]")._list = recent;
      place();
    };
    const setLook = next => { // remember the look we leave, for "Recent"
      if (!sameLook(next, draft)) draft.recent = [look(draft), ...(draft.recent || []).filter(r => !sameLook(r, draft))].slice(0, 5);
      Object.assign(draft, next);
      paint();
    };
    const setCustom = () => setLook({ skin: "custom", c1: form.elements.wcC1.value, c2: form.elements.wcC2.value, dir: draft.dir || "diag" });

    // photo: live position / zoom without re-rendering
    const place = () => {
      form.querySelectorAll(".wc-preview .wc-face img, [data-wc-crop] img").forEach(img => { img.style.objectPosition = `${draft.px}% ${draft.py}%`; img.style.transformOrigin = `${draft.px}% ${draft.py}%`; img.style.transform = `scale(${draft.zoom / 100})`; });
      form.elements.wcZoom.value = draft.zoom;
      $("[data-wc-zoom-val]").textContent = `${draft.zoom}%`;
    };
    const pts = new Map();
    let drag = null, pinch = null;
    const crop = form.querySelector("[data-wc-crop]");
    const faceOf = target => target.closest("[data-wc-crop]");
    crop.addEventListener("pointerdown", event => {
      const face = faceOf(event.target);
      if (!face || !face.querySelector("img")) return;
      event.preventDefault();
      try { face.setPointerCapture(event.pointerId); } catch (error) { /* older browsers */ }
      pts.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const box = face.getBoundingClientRect();
      if (pts.size === 1) drag = { x: event.clientX, y: event.clientY, px: draft.px, py: draft.py, w: box.width, h: box.height };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: draft.zoom }; drag = null; }
      crop.classList.add("is-drag");
    });
    crop.addEventListener("pointermove", event => {
      if (!pts.has(event.pointerId)) return;
      pts.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        draft.zoom = Math.round(Math.min(300, Math.max(100, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)) / 5) * 5;
      } else if (drag) {
        const k = 100 / (draft.zoom / 100);
        draft.px = Math.round(Math.min(100, Math.max(0, drag.px - (event.clientX - drag.x) / drag.w * k)));
        draft.py = Math.round(Math.min(100, Math.max(0, drag.py - (event.clientY - drag.y) / drag.h * k)));
      }
      place();
    });
    const up = event => { pts.delete(event.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { drag = null; crop.classList.remove("is-drag"); } };
    crop.addEventListener("pointerup", up);
    crop.addEventListener("pointercancel", up);

    form.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => Modal.close()));
    form.addEventListener("click", event => {
      const el = event.target.closest("button");
      if (!el || el.type === "submit") return;
      if (el.dataset.wcTab) { tab = el.dataset.wcTab; paint(); $(".wc-panels").scrollTop = 0; }
      else if (el.dataset.wcSkin) setLook({ skin: el.dataset.wcSkin });
      else if (el.dataset.wcDir) { draft.dir = el.dataset.wcDir; setCustom(); }
      else if (el.dataset.wcRecentI !== undefined) { const r = $("[data-wc-recent]")._list[Number(el.dataset.wcRecentI)]; if (r) { if (r.c1) form.elements.wcC1.value = r.c1; if (r.c2) form.elements.wcC2.value = r.c2; setLook({ ...r }); } }
      else if (el.hasAttribute("data-wc-use-profile")) { draft.photo = ""; draft.px = 50; draft.py = 50; draft.zoom = 100; if (draft.frame === "none") draft.frame = "ring"; paint(); }
      else if (el.hasAttribute("data-wc-no-photo")) { draft.frame = "none"; paint(); }
      else if (el.hasAttribute("data-wc-reset")) {
        const saved = appData.profile.walletCard;
        appData.profile.walletCard = { photo: draft.photo, recent: draft.recent };
        const base = conf();
        appData.profile.walletCard = saved;
        draft = { ...base, recent: draft.recent };
        form.elements.wcName.value = draft.title;
        form.elements.wcHide.checked = draft.hide; form.elements.wcShine.checked = draft.shine; form.elements.wcUpper.checked = draft.caps;
        $("[data-wc-count]").textContent = `${draft.title.length}/22`;
        paint();
      }
    });
    const hex = (input, sel) => { $(sel).textContent = input.value.toUpperCase(); };
    form.elements.wcC1.addEventListener("input", e => { hex(e.target, "[data-wc-hex1]"); setCustom(); });
    form.elements.wcC2.addEventListener("input", e => { hex(e.target, "[data-wc-hex2]"); if (draft.dir === "solid") draft.dir = "diag"; setCustom(); });
    form.elements.wcZoom.addEventListener("input", e => { draft.zoom = Number(e.target.value); place(); });
    form.elements.wcName.addEventListener("input", e => { draft.titleSet = e.target.value.trim(); draft.title = draft.titleSet || String(appData.profile?.name || "MYLIFE").split(/\s+/)[0]; $("[data-wc-count]").textContent = `${e.target.value.length}/22`; paintCard(); place(); });
    form.elements.wcHide.addEventListener("change", e => { draft.hide = e.target.checked; paint(); });
    form.elements.wcShine.addEventListener("change", e => { draft.shine = e.target.checked; paint(); });
    form.elements.wcUpper.addEventListener("change", e => { draft.caps = e.target.checked; paint(); });
    form.elements.wcPhoto.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        draft.photo = await readFile(file); draft.px = 50; draft.py = 50; draft.zoom = 100;
        if (draft.frame === "none") draft.frame = "ring";
        paint();
      } catch (error) { Toast.show(L("មិនអាចបើករូបបានទេ", "Could not open that photo"), "warning"); }
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      // the colour is saved for the current theme only; the other theme keeps its own (or the old shared one)
      const raw = appData.profile.walletCard || {};
      const themeKey = dark() ? "dark" : "light";
      const next = { skin: raw.skin, c1: raw.c1, c2: raw.c2, dir: raw.dir, light: raw.light, dark: raw.dark, [themeKey]: { skin: draft.skin, c1: draft.c1, c2: draft.c2, dir: draft.dir }, amount: draft.amount, frame: draft.frame, name: draft.name, last4: draft.last4, photo: draft.photo || "", px: draft.px, py: draft.py, zoom: draft.zoom, tint: draft.tint, hide: !!draft.hide, shine: !!draft.shine, upper: !!draft.upper, title: draft.titleSet !== undefined ? draft.titleSet : (appData.profile?.walletCard?.title || ""), caps: !!draft.caps, recent: (draft.recent || []).filter(r => !sameLook(r, draft)).slice(0, 4) };
      Modal.close();
      Store.updateProfile({ walletCard: next });
      Toast.show(L("បានរក្សាទុកកាត", "Card saved"), "success");
    });
    paint();
  }

  document.addEventListener("click", event => {
    if (event.target.closest(".wc-card [data-wc-edit]")) { event.preventDefault(); open(); }
  });

  // card colour for other places (Money hero uses the same colour as the Home card)
  const bg = () => bgOf(conf());
  return { render, open, bg };
})();

if (typeof window !== "undefined") window.WalletCard = WalletCard;
