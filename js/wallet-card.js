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
    if (c.skin === "custom" && /^#[0-9a-f]{6}$/i.test(c.c1 || "")) return /^#[0-9a-f]{6}$/i.test(c.c2 || "") ? `linear-gradient(135deg,${c.c1},${c.c2})` : c.c1;
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
      c1: c.c1 || "#6d5dfc", c2: c.c2 === undefined ? "#00c6a7" : c.c2,
      amount: ["gold", "silver", "white"].includes(c.amount) ? c.amount : "gold",
      px: Number.isFinite(c.px) ? c.px : 50, py: Number.isFinite(c.py) ? c.py : 50, zoom: Number.isFinite(c.zoom) ? c.zoom : 100,
      tint: Number.isFinite(c.tint) ? c.tint : 60,
      frame: FRAMES.some(f => f.id === c.frame) ? c.frame : "ring",
      name: (c.name || `${name} · MYLIFE`).slice(0, 22),
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
      <article class="wc-card wc-amt-${c.amount}${c.frame === "full" ? " has-full" : ""}${c.frame === "none" ? " no-photo" : ""}" style="--wc-bg:${escapeAttr(bgOf(c))};--wc-tint:${c.tint / 100}" aria-label="${escapeAttr(L(`នៅសល់ខែ${monthName}`, `Left in ${monthName}`))}">
        ${frameHtml(c)}
        <div class="wc-top">
          <span class="wc-left"><span class="wc-chip" aria-hidden="true"></span>${ICON.nfc}</span>
          <span class="wc-right"><b class="wc-name">${escapeHtml(c.name)}</b><button type="button" class="wc-edit" data-wc-edit aria-label="${escapeAttr(L("រចនាកាត", "Design card"))}">${ICON.pen}</button></span>
        </div>
        <div class="wc-num" aria-hidden="true">•••• ${escapeHtml(c.last4)}</div>
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

  /* ---------- "Design my card" sheet ---------- */
  function open() {
    const root = document.getElementById("modalRoot");
    if (!root) return;
    if (typeof Modal !== "undefined" && Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    const c = conf();
    let draft = { ...c };
    const preview = () => `<div class="wc-preview">${render({ left: typeof moneyMonthNumbers === "function" ? moneyMonthNumbers().left : 0, income: 0, expenses: 0 }, localDateInput()).replace(/<div class="wc-mini">[\s\S]*?<\/div>\s*<\/section>/, "</section>")}</div>`;
    root.innerHTML = `
      <form class="modal glass-card wc-sheet" id="modalForm" novalidate>
        <div class="between">
          <h2 class="section-title">🎨 ${escapeHtml(L("រចនាកាតរបស់ខ្ញុំ", "Design my card"))}</h2>
          <button class="icon-button" type="button" data-close aria-label="${escapeAttr(t("close"))}">${Icons.close()}</button>
        </div>
        <div data-wc-preview></div>
        <p class="wc-lbl">${escapeHtml(L("ស៊ុមរូប profile", "Photo frame"))}</p>
        <div class="wc-frames">${FRAMES.map(f => `<button type="button" class="wc-fr" data-wc-frame="${f.id}">${f.id === "none" ? '<span class="wc-fr-none">∅</span>' : frameHtml({ ...c, frame: f.id }, "is-mini")}<span>${escapeHtml(km() ? f.km : f.en)}</span></button>`).join("")}</div>
        <p class="wc-lbl">${escapeHtml(L("ពណ៌កាត", "Card colour"))}</p>
        <div class="wc-tabs" role="tablist">
          <button type="button" data-wc-tab="grad">${escapeHtml(L("ពណ៌ចម្រុះ", "Gradient"))}</button>
          <button type="button" data-wc-tab="solid">${escapeHtml(L("ពណ៌ដិត", "Solid"))}</button>
          <button type="button" data-wc-tab="custom">＋ ${escapeHtml(L("ពណ៌ខ្លួនឯង", "Custom"))}</button>
        </div>
        <div class="wc-skins" data-wc-set="grad">${GRADS.map(([id, bg]) => `<button type="button" class="wc-skin" data-wc-skin="${id}" style="background:${escapeAttr(bg)}" aria-label="${id}"></button>`).join("")}</div>
        <div class="wc-skins" data-wc-set="solid">${SOLIDS.map(([id, bg]) => `<button type="button" class="wc-skin" data-wc-skin="${id}" style="background:${bg}" aria-label="${id}"></button>`).join("")}</div>
        <div class="wc-custom" data-wc-set="custom">
          <label><span>${escapeHtml(L("ពណ៌ 1", "Colour 1"))}</span><input type="color" name="wcC1" value="${escapeAttr(c.c1)}"></label>
          <label><span>${escapeHtml(L("ពណ៌ 2", "Colour 2"))}</span><input type="color" name="wcC2" value="${escapeAttr(c.c2 || "#00c6a7")}"></label>
          <label class="wc-check"><input type="checkbox" name="wcSolid" ${c.c2 ? "" : "checked"}><span>${escapeHtml(L("ពណ៌តែមួយ", "One colour"))}</span></label>
        </div>
        <p class="wc-lbl">${escapeHtml(L("ពណ៌លេខលុយ", "Amount colour"))}</p>
        <div class="wc-amts">${[["gold", L("មាស", "Gold")], ["silver", L("ប្រាក់", "Silver")], ["white", L("ស", "White")]].map(([id, label]) => `<button type="button" class="wc-amt-btn wc-amt-${id}" data-wc-amt="${id}"><b>$</b>${escapeHtml(label)}</button>`).join("")}</div>
        <div class="wc-adjust" data-wc-adjust>
          <p class="wc-lbl">${escapeHtml(L("កែរូប · អូសរូបលើកាតដើម្បីផ្លាស់ទី", "Adjust photo · drag the photo on the card"))}</p>
          <label class="wc-range"><span>🔍 ${escapeHtml(L("ពង្រីក", "Zoom"))}</span><input type="range" name="wcZoom" min="100" max="300" step="5" value="${c.zoom}"></label>
          <label class="wc-range" data-wc-tint-row><span>🎨 ${escapeHtml(L("ពណ៌លើរូប", "Colour on photo"))}</span><input type="range" name="wcTint" min="0" max="90" step="5" value="${c.tint}"></label>
          <button type="button" class="wc-reset" data-wc-reset>↺ ${escapeHtml(L("ដាក់កណ្តាលវិញ", "Re-centre"))}</button>
        </div>
        <label class="wc-field"><span>${escapeHtml(L("ឈ្មោះលើកាត", "Name on card"))}</span><input type="text" maxlength="22" name="wcName" value="${escapeAttr(c.name)}"></label>
        <label class="wc-field"><span>${escapeHtml(L("លេខ 4 ខ្ទង់ (តុបតែងប៉ុណ្ណោះ)", "4 digits (decoration only)"))}</span><input type="text" inputmode="numeric" maxlength="4" name="wcLast4" value="${escapeAttr(c.last4)}"></label>
        <div class="wc-photo-row">
          <span>${escapeHtml(L("រូប profile", "Photo"))}</span>
          <label class="button ghost-button wc-pick">${escapeHtml(L("ជ្រើសរូប", "Choose"))}<input type="file" accept="image/*" name="wcPhoto" hidden></label>
          <button type="button" class="button ghost-button" data-wc-use-profile>${escapeHtml(L("រូបគណនី", "Account photo"))}</button>
        </div>
        <label class="wc-toggle"><span>${escapeHtml(L("លាក់ចំនួនលុយលើកាត", "Hide amounts on the card"))}</span><input type="checkbox" name="wcHide" ${c.hide ? "checked" : ""}></label>
        <div class="wc-actions"><button class="button wc-save" type="submit">${escapeHtml(L("រក្សាទុក", "Save"))}</button></div>
      </form>`;
    root.classList.add("open");
    if (typeof Modal !== "undefined") {
      Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
      document.addEventListener("keydown", Modal.escapeHandler);
    }
    const form = root.querySelector("#modalForm");
    const paint = () => {
      const saved = appData.profile.walletCard;
      appData.profile.walletCard = draft; // preview only, restored below
      form.querySelector("[data-wc-preview]").innerHTML = preview();
      appData.profile.walletCard = saved;
      form.querySelectorAll("[data-wc-frame]").forEach(b => b.classList.toggle("on", b.dataset.wcFrame === draft.frame));
      form.querySelectorAll("[data-wc-skin]").forEach(b => b.classList.toggle("on", b.dataset.wcSkin === draft.skin));
      form.querySelectorAll("[data-wc-amt]").forEach(b => b.classList.toggle("on", b.dataset.wcAmt === draft.amount));
      form.querySelectorAll("[data-wc-tab]").forEach(b => b.classList.toggle("on", b.dataset.wcTab === tab));
      form.querySelectorAll("[data-wc-set]").forEach(el => { el.hidden = el.dataset.wcSet !== tab; });
      const hasPhoto = draft.frame !== "none" && !!photoOf(draft);
      form.querySelector("[data-wc-adjust]").hidden = !hasPhoto;
      form.querySelector("[data-wc-tint-row]").hidden = draft.frame !== "full";
    };
    let tab = draft.skin === "custom" ? "custom" : draft.skin.startsWith("s-") ? "solid" : "grad";
    const setCustom = () => {
      draft.skin = "custom";
      draft.c1 = form.elements.wcC1.value;
      draft.c2 = form.elements.wcSolid.checked ? "" : form.elements.wcC2.value;
      form.elements.wcC2.disabled = form.elements.wcSolid.checked;
      paint();
    };
    // drag the photo on the preview card (pointer events, works with touch)
    const img = () => form.querySelector("[data-wc-preview] .wc-face img");
    const place = () => {
      const el = img();
      if (!el) return;
      el.style.objectPosition = `${draft.px}% ${draft.py}%`;
      el.style.transformOrigin = `${draft.px}% ${draft.py}%`;
      el.style.transform = `scale(${draft.zoom / 100})`;
    };
    let drag = null;
    const host = form.querySelector("[data-wc-preview]");
    host.addEventListener("pointerdown", event => {
      const face = event.target.closest(".wc-face") || event.target.closest(".wc-card.has-full")?.querySelector(".wc-f-full .wc-face");
      if (!face || !img()) return;
      event.preventDefault();
      const box = face.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, px: draft.px, py: draft.py, w: box.width, h: box.height };
      face.setPointerCapture?.(event.pointerId);
      face.classList.add("is-drag");
    });
    host.addEventListener("pointermove", event => {
      if (!drag || event.pointerId !== drag.id) return;
      const k = 100 / (draft.zoom / 100);
      draft.px = Math.round(Math.min(100, Math.max(0, drag.px - (event.clientX - drag.x) / drag.w * k)));
      draft.py = Math.round(Math.min(100, Math.max(0, drag.py - (event.clientY - drag.y) / drag.h * k)));
      place();
    });
    const endDrag = () => { drag = null; host.querySelector(".wc-face.is-drag")?.classList.remove("is-drag"); };
    host.addEventListener("pointerup", endDrag);
    host.addEventListener("pointercancel", endDrag);
    form.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => Modal.close()));
    form.addEventListener("click", event => {
      const fr = event.target.closest("[data-wc-frame]");
      if (fr) { draft.frame = fr.dataset.wcFrame; paint(); }
      const sk = event.target.closest("[data-wc-skin]");
      if (sk) { draft.skin = sk.dataset.wcSkin; paint(); }
      const tb = event.target.closest("[data-wc-tab]");
      if (tb) { tab = tb.dataset.wcTab; if (tab === "custom") setCustom(); else paint(); }
      const am = event.target.closest("[data-wc-amt]");
      if (am) { draft.amount = am.dataset.wcAmt; paint(); }
      if (event.target.closest("[data-wc-reset]")) { draft.px = 50; draft.py = 50; draft.zoom = 100; form.elements.wcZoom.value = 100; paint(); }
      if (event.target.closest("[data-wc-use-profile]")) { draft.photo = ""; paint(); }
    });
    form.elements.wcName.addEventListener("input", e => { draft.name = e.target.value.trim() || c.name; paint(); });
    form.elements.wcLast4.addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); if (e.target.value.length === 4) { draft.last4 = e.target.value; paint(); } });
    ["wcC1", "wcC2", "wcSolid"].forEach(n => form.elements[n].addEventListener("input", setCustom));
    form.elements.wcSolid.addEventListener("change", setCustom);
    form.elements.wcC2.disabled = form.elements.wcSolid.checked;
    form.elements.wcZoom.addEventListener("input", e => { draft.zoom = Number(e.target.value); place(); });
    form.elements.wcTint.addEventListener("input", e => { draft.tint = Number(e.target.value); form.querySelector("[data-wc-preview] .wc-card")?.style.setProperty("--wc-tint", draft.tint / 100); });
    form.elements.wcHide.addEventListener("change", e => { draft.hide = e.target.checked; paint(); });
    form.elements.wcPhoto.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try { draft.photo = await readFile(file); draft.px = 50; draft.py = 50; draft.zoom = 100; form.elements.wcZoom.value = 100; paint(); } catch (error) { Toast.show(L("មិនអាចបើករូបបានទេ", "Could not open that photo"), "warning"); }
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const next = { skin: draft.skin, c1: draft.c1, c2: draft.c2, amount: draft.amount, frame: draft.frame, name: draft.name, last4: draft.last4, photo: draft.photo || "", px: draft.px, py: draft.py, zoom: draft.zoom, tint: draft.tint, hide: !!draft.hide };
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
