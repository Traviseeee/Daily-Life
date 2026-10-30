/* Home money card as a bank-style wallet card (draft A, 30 Oct 2026).
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
    const c = appData.profile?.walletCard || {};
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
      hide: !!c.hide
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
    return `<section class="hv2-money wc-wrap">
      <article class="wc-card wc-amt-${c.amount}${c.shine ? "" : " no-shine"}${c.upper ? " is-upper" : ""}${c.frame === "full" ? " has-full" : ""}${c.frame === "none" ? " no-photo" : ""}" style="--wc-bg:${escapeAttr(bgOf(c))};--wc-tint:${c.tint / 100}" aria-label="${escapeAttr(L(`នៅសល់ខែ${monthName}`, `Left in ${monthName}`))}">
        ${frameHtml(c)}
        <div class="wc-top">
          <span class="wc-left"><span class="wc-chip" aria-hidden="true"></span>${ICON.nfc}<span class="wc-num" aria-hidden="true">•••• ${escapeHtml(c.last4)}</span></span>
          <span class="wc-right"><b class="wc-name">${escapeHtml(c.name)}</b><button type="button" class="wc-edit" data-wc-edit aria-label="${escapeAttr(L("រចនាកាត", "Design card"))}">${ICON.pen}</button></span>
        </div>
        <small class="wc-label">${escapeHtml(L(`នៅសល់សម្រាប់ចាយ · ${monthName}`, `Left to spend · ${monthName}`))}</small>
        <a class="wc-amount money-value${m.left < 0 ? " is-neg" : ""}${hideCls}" href="#money">${escapeHtml(money(m.left))}</a>
        <div class="wc-foot">
          <span>${escapeHtml(L("ថ្ងៃនេះ", "Today"))}<b class="money-value${hideCls}">${escapeHtml(money(spentToday))}</b></span>
          <span>${escapeHtml(L("ចាយបាន/ថ្ងៃ", "Per day"))}<b class="money-value${hideCls}">${escapeHtml(money(perDay))}</b></span>
        </div>
        <span class="wc-logo" aria-hidden="true"><i></i><i></i></span>
      </article>
      <div class="wc-mini">
        <a href="#money/income" class="wc-io is-in"><i>${ICON.down}</i><span><small>${escapeHtml(L("ចំណូល", "Income"))}</small><b class="money-value${hideCls}">${escapeHtml(money(m.income))}</b></span></a>
        <a href="#money/expenses" class="wc-io is-out"><i>${ICON.up}</i><span><small>${escapeHtml(L("ចាយ", "Spent"))}</small><b class="money-value${hideCls}">${escapeHtml(money(m.expenses))}</b></span></a>
      </div>
      ${dueHtml}
    </section>`;
  }

  /* ---------- "Design my card" sheet: card stays on top, 4 tabs, save bar at the bottom ---------- */
  const SOLID_IDS = SOLIDS.map(([id]) => id);
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
    let tab = "photo";
    let colorSet = c.skin === "custom" ? "custom" : SOLID_IDS.includes(c.skin) ? "solid" : "grad";
    const left = typeof moneyMonthNumbers === "function" ? moneyMonthNumbers().left : 0;
    const swatch = (id, bg) => `<button type="button" class="wc-sw" data-wc-skin="${id}" style="background:${escapeAttr(bg)}" aria-label="${id}"></button>`;
    const TABS = [["photo", "📷", L("រូប", "Photo")], ["color", "🎨", L("ពណ៌", "Colour")], ["amount", "💲", L("លេខលុយ", "Amount")], ["text", "✏️", L("អក្សរ", "Text")]];
    root.innerHTML = `
      <form class="modal glass-card wc-sheet" id="modalForm" novalidate>
        <div class="wc-sh-head"><h2 class="section-title">🎨 ${escapeHtml(L("រចនាកាតរបស់ខ្ញុំ", "Design my card"))}</h2>
          <button class="icon-button" type="button" data-close aria-label="${escapeAttr(t("close"))}">${Icons.close()}</button></div>
        <div class="wc-stage"><div class="wc-preview" data-wc-preview></div>
          <span class="wc-hint" data-wc-hint>✋ ${escapeHtml(L("អូសរូបដើម្បីផ្លាស់ទី · ចាប់ពីរម្រាមដើម្បីពង្រីក", "Drag the photo to move · pinch to zoom"))}</span></div>
        <div class="wc-tabbar" role="tablist">${TABS.map(([id, icon, label]) => `<button type="button" role="tab" data-wc-tab="${id}"><span aria-hidden="true">${icon}</span>${escapeHtml(label)}</button>`).join("")}</div>
        <div class="wc-panels">
          <section data-wc-panel="photo">
            <p class="wc-lbl"><span>${escapeHtml(L("ស៊ុមរូប", "Frame"))}</span><small>${escapeHtml(L("⇠ អូសមើលបន្ថែម", "⇠ swipe for more"))}</small></p>
            <div class="wc-frames">${FRAMES.map(f => `<button type="button" class="wc-fr" data-wc-frame="${f.id}"><span class="wc-fr-box">${f.id === "none" ? '<span class="wc-fr-none">∅</span>' : frameHtml({ ...c, px: 50, py: 50, zoom: 100, frame: f.id }, "is-mini")}</span><span>${escapeHtml(km() ? f.km : f.en)}</span></button>`).join("")}</div>
            <div data-wc-adjust>
              <p class="wc-lbl"><span>${escapeHtml(L("កែរូប", "Adjust photo"))}</span></p>
              <label class="wc-sl"><span aria-hidden="true">🔍</span><input type="range" name="wcZoom" min="100" max="300" step="5" value="${c.zoom}" aria-label="${escapeAttr(L("ពង្រីក", "Zoom"))}"><b data-wc-zoom-val>${c.zoom}%</b></label>
              <label class="wc-sl" data-wc-tint-row><span aria-hidden="true">🌗</span><input type="range" name="wcTint" min="0" max="90" step="5" value="${c.tint}" aria-label="${escapeAttr(L("ពណ៌លើរូប", "Colour on photo"))}"><b data-wc-tint-val>${c.tint}%</b></label>
            </div>
            <div class="wc-btns">
              <label class="wc-bt"><span aria-hidden="true">🖼️</span>${escapeHtml(L("ជ្រើសរូបថ្មី", "New photo"))}<input type="file" accept="image/*" name="wcPhoto" hidden></label>
              <button type="button" class="wc-bt" data-wc-use-profile><span aria-hidden="true">👤</span>${escapeHtml(L("រូបគណនី", "Account photo"))}</button>
              <button type="button" class="wc-bt" data-wc-center><span aria-hidden="true">🎯</span>${escapeHtml(L("ដាក់កណ្តាល", "Re-centre"))}</button>
            </div>
          </section>
          <section data-wc-panel="color">
            <div class="wc-seg">${[["grad", L("ចម្រុះ", "Gradient")], ["solid", L("ដិត", "Solid")], ["custom", L("ខ្លួនឯង", "Custom")]].map(([id, label]) => `<button type="button" data-wc-set-btn="${id}">${escapeHtml(label)}</button>`).join("")}</div>
            <div class="wc-sws" data-wc-set="grad">${GRADS.map(([id, bg]) => swatch(id, bg)).join("")}<button type="button" class="wc-sw wc-sw-plus" data-wc-set-btn="custom" aria-label="${escapeAttr(L("ពណ៌ខ្លួនឯង", "Custom colour"))}">+</button></div>
            <div class="wc-sws" data-wc-set="solid">${SOLIDS.map(([id, bg]) => swatch(id, bg)).join("")}</div>
            <div data-wc-set="custom">
              <div class="wc-pick2">
                <label class="wc-pk"><input type="color" name="wcC1" value="${escapeAttr(c.c1)}"><span>${escapeHtml(L("ពណ៌ 1", "Colour 1"))}<b data-wc-hex1>${escapeHtml(c.c1.toUpperCase())}</b></span></label>
                <span aria-hidden="true">→</span>
                <label class="wc-pk" data-wc-c2-row><input type="color" name="wcC2" value="${escapeAttr(c.c2 || "#00c6a7")}"><span>${escapeHtml(L("ពណ៌ 2", "Colour 2"))}<b data-wc-hex2>${escapeHtml((c.c2 || "#00c6a7").toUpperCase())}</b></span></label>
              </div>
              <div class="wc-dirs">${DIRS.map(([id, k, e]) => `<button type="button" data-wc-dir="${id}">${escapeHtml(km() ? k : e)}</button>`).join("")}</div>
            </div>
            <div class="wc-recent" data-wc-recent></div>
          </section>
          <section data-wc-panel="amount">
            <p class="wc-lbl"><span>${escapeHtml(L("ពណ៌លេខលុយធំ", "Main amount colour"))}</span><small>${escapeHtml(L("លេខផ្សេងនៅពណ៌ស", "Other numbers stay white"))}</small></p>
            <div class="wc-amts" data-wc-amts>${[["gold", L("មាស", "Gold")], ["silver", L("ប្រាក់", "Silver")], ["white", L("ស", "White")]].map(([id, label]) => `<button type="button" class="wc-am wc-amt-${id}" data-wc-amt="${id}"><b class="wc-amount">$${Math.round(Math.abs(left))}</b><span>${escapeHtml(label)}</span></button>`).join("")}</div>
            <p class="wc-lbl"><span>${escapeHtml(L("ភាពឯកជន និងចលនា", "Privacy & motion"))}</span></p>
            <label class="wc-tg"><span>🙈 ${escapeHtml(L("លាក់ចំនួនលុយលើកាត", "Hide amounts on the card"))}</span><input type="checkbox" name="wcHide" ${c.hide ? "checked" : ""}></label>
            <label class="wc-tg"><span>✨ ${escapeHtml(L("ពន្លឺរត់លើកាត", "Shine on the card"))}</span><input type="checkbox" name="wcShine" ${c.shine ? "checked" : ""}></label>
          </section>
          <section data-wc-panel="text">
            <label class="wc-fd"><span>${escapeHtml(L("ឈ្មោះលើកាត", "Name on card"))}</span><span class="wc-in"><input type="text" maxlength="22" name="wcName" value="${escapeAttr(c.name)}"><small data-wc-count>${c.name.length}/22</small></span></label>
            <label class="wc-fd"><span>${escapeHtml(L("លេខ 4 ខ្ទង់", "4 digits"))} <small>${escapeHtml(L("តុបតែងប៉ុណ្ណោះ មិនមែនលេខកាតពិត", "decoration only, not a real card number"))}</small></span><span class="wc-in"><em aria-hidden="true">••••</em><input type="text" inputmode="numeric" maxlength="4" name="wcLast4" value="${escapeAttr(c.last4)}"></span></label>
            <label class="wc-tg"><span>🔤 ${escapeHtml(L("អក្សរធំទាំងអស់", "All capitals"))}</span><input type="checkbox" name="wcUpper" ${c.upper ? "checked" : ""}></label>
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
    const paint = () => {
      paintCard();
      form.querySelectorAll("[data-wc-tab]").forEach(b => { const on = b.dataset.wcTab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      form.querySelectorAll("[data-wc-panel]").forEach(p => { p.hidden = p.dataset.wcPanel !== tab; });
      form.querySelectorAll("[data-wc-frame]").forEach(b => b.classList.toggle("on", b.dataset.wcFrame === draft.frame));
      form.querySelectorAll("[data-wc-skin]").forEach(b => b.classList.toggle("on", b.dataset.wcSkin === draft.skin));
      form.querySelectorAll(".wc-seg [data-wc-set-btn]").forEach(b => b.classList.toggle("on", b.dataset.wcSetBtn === colorSet));
      form.querySelectorAll("[data-wc-set]").forEach(el => { el.hidden = el.dataset.wcSet !== colorSet; });
      form.querySelectorAll("[data-wc-dir]").forEach(b => b.classList.toggle("on", b.dataset.wcDir === draft.dir));
      $("[data-wc-c2-row]").classList.toggle("is-off", draft.dir === "solid");
      form.querySelectorAll("[data-wc-amt]").forEach(b => b.classList.toggle("on", b.dataset.wcAmt === draft.amount));
      $("[data-wc-amts]").style.setProperty("--wc-bg", bgOf(draft));
      $("[data-wc-adjust]").hidden = !hasPhoto();
      $("[data-wc-tint-row]").hidden = draft.frame !== "full";
      form.querySelector("[data-wc-center]").disabled = !hasPhoto();
      $("[data-wc-hint]").hidden = !(tab === "photo" && hasPhoto());
      const recent = (draft.recent || []).filter(r => !sameLook(r, draft)).slice(0, 4);
      $("[data-wc-recent]").innerHTML = recent.length ? `<span>${escapeHtml(L("ប្រើថ្មីៗ", "Recent"))}</span>${recent.map((r, i) => `<button type="button" data-wc-recent-i="${i}" style="background:${escapeAttr(bgOf({ ...c, ...r }))}" aria-label="recent ${i + 1}"></button>`).join("")}` : "";
      $("[data-wc-recent]")._list = recent;
    };
    const setLook = next => { // remember the look we leave, for "Recent"
      if (!sameLook(next, draft)) draft.recent = [look(draft), ...(draft.recent || []).filter(r => !sameLook(r, draft))].slice(0, 5);
      Object.assign(draft, next);
      paint();
    };
    const setCustom = () => setLook({ skin: "custom", c1: form.elements.wcC1.value, c2: form.elements.wcC2.value, dir: draft.dir || "diag" });

    // photo: live position / zoom without re-rendering
    const place = () => {
      const img = host.querySelector(".wc-face img");
      if (img) { img.style.objectPosition = `${draft.px}% ${draft.py}%`; img.style.transformOrigin = `${draft.px}% ${draft.py}%`; img.style.transform = `scale(${draft.zoom / 100})`; }
      form.elements.wcZoom.value = draft.zoom;
      $("[data-wc-zoom-val]").textContent = `${draft.zoom}%`;
    };
    const pts = new Map();
    let drag = null, pinch = null;
    const faceOf = target => target.closest(".wc-face") || target.closest(".wc-card.has-full")?.querySelector(".wc-f-full .wc-face");
    host.addEventListener("pointerdown", event => {
      const face = faceOf(event.target);
      if (!face || !face.querySelector("img")) return;
      event.preventDefault();
      try { face.setPointerCapture(event.pointerId); } catch (error) { /* older browsers */ }
      pts.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const box = face.getBoundingClientRect();
      if (pts.size === 1) drag = { x: event.clientX, y: event.clientY, px: draft.px, py: draft.py, w: box.width, h: box.height };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: draft.zoom }; drag = null; }
      host.classList.add("is-drag");
    });
    host.addEventListener("pointermove", event => {
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
    const up = event => { pts.delete(event.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { drag = null; host.classList.remove("is-drag"); } };
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);

    form.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => Modal.close()));
    form.addEventListener("click", event => {
      const el = event.target.closest("button");
      if (!el || el.type === "submit") return;
      if (el.dataset.wcTab) { tab = el.dataset.wcTab; paint(); $(".wc-panels").scrollTop = 0; }
      else if (el.dataset.wcFrame) { draft.frame = el.dataset.wcFrame; paint(); }
      else if (el.dataset.wcSkin) setLook({ skin: el.dataset.wcSkin });
      else if (el.dataset.wcSetBtn) { colorSet = el.dataset.wcSetBtn; if (colorSet === "custom") setCustom(); else paint(); }
      else if (el.dataset.wcDir) { draft.dir = el.dataset.wcDir; setCustom(); }
      else if (el.dataset.wcRecentI !== undefined) { const r = $("[data-wc-recent]")._list[Number(el.dataset.wcRecentI)]; if (r) { colorSet = r.skin === "custom" ? "custom" : SOLID_IDS.includes(r.skin) ? "solid" : "grad"; if (r.c1) form.elements.wcC1.value = r.c1; if (r.c2) form.elements.wcC2.value = r.c2; setLook({ ...r }); } }
      else if (el.dataset.wcAmt) { draft.amount = el.dataset.wcAmt; paint(); }
      else if (el.hasAttribute("data-wc-use-profile")) { draft.photo = ""; draft.px = 50; draft.py = 50; draft.zoom = 100; paint(); place(); }
      else if (el.hasAttribute("data-wc-center")) { draft.px = 50; draft.py = 50; draft.zoom = 100; place(); }
      else if (el.hasAttribute("data-wc-reset")) {
        const saved = appData.profile.walletCard;
        appData.profile.walletCard = { photo: draft.photo, recent: draft.recent };
        const base = conf();
        appData.profile.walletCard = saved;
        draft = { ...base, recent: draft.recent };
        colorSet = SOLID_IDS.includes(draft.skin) ? "solid" : "grad";
        form.elements.wcName.value = draft.name; form.elements.wcLast4.value = draft.last4;
        form.elements.wcHide.checked = draft.hide; form.elements.wcShine.checked = draft.shine; form.elements.wcUpper.checked = draft.upper;
        form.elements.wcTint.value = draft.tint; $("[data-wc-tint-val]").textContent = `${draft.tint}%`;
        $("[data-wc-count]").textContent = `${draft.name.length}/22`;
        paint(); place();
      }
    });
    const hex = (input, sel) => { $(sel).textContent = input.value.toUpperCase(); };
    form.elements.wcC1.addEventListener("input", e => { hex(e.target, "[data-wc-hex1]"); setCustom(); });
    form.elements.wcC2.addEventListener("input", e => { hex(e.target, "[data-wc-hex2]"); if (draft.dir === "solid") draft.dir = "diag"; setCustom(); });
    form.elements.wcZoom.addEventListener("input", e => { draft.zoom = Number(e.target.value); place(); });
    form.elements.wcTint.addEventListener("input", e => { draft.tint = Number(e.target.value); $("[data-wc-tint-val]").textContent = `${draft.tint}%`; host.querySelector(".wc-card")?.style.setProperty("--wc-tint", draft.tint / 100); });
    form.elements.wcName.addEventListener("input", e => { draft.name = e.target.value.trim() || c.name; $("[data-wc-count]").textContent = `${e.target.value.length}/22`; paint(); });
    form.elements.wcLast4.addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); if (e.target.value.length === 4) { draft.last4 = e.target.value; paint(); } });
    form.elements.wcHide.addEventListener("change", e => { draft.hide = e.target.checked; paint(); });
    form.elements.wcShine.addEventListener("change", e => { draft.shine = e.target.checked; paint(); });
    form.elements.wcUpper.addEventListener("change", e => { draft.upper = e.target.checked; paint(); });
    form.elements.wcPhoto.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        draft.photo = await readFile(file); draft.px = 50; draft.py = 50; draft.zoom = 100;
        if (draft.frame === "none") draft.frame = "ring";
        paint(); place();
      } catch (error) { Toast.show(L("មិនអាចបើករូបបានទេ", "Could not open that photo"), "warning"); }
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const next = { skin: draft.skin, c1: draft.c1, c2: draft.c2, dir: draft.dir, amount: draft.amount, frame: draft.frame, name: draft.name, last4: draft.last4, photo: draft.photo || "", px: draft.px, py: draft.py, zoom: draft.zoom, tint: draft.tint, hide: !!draft.hide, shine: !!draft.shine, upper: !!draft.upper, recent: (draft.recent || []).filter(r => !sameLook(r, draft)).slice(0, 4) };
      Modal.close();
      Store.updateProfile({ walletCard: next });
      Toast.show(L("បានរក្សាទុកកាត", "Card saved"), "success");
    });
    paint();
  }

  document.addEventListener("click", event => {
    if (event.target.closest(".wc-card [data-wc-edit]")) { event.preventDefault(); open(); }
  });

  return { render, open };
})();

if (typeof window !== "undefined") window.WalletCard = WalletCard;
