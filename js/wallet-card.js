/* Home money card as a bank-style wallet card (draft A, 30 Oct 2026).
 * One card: chip, contactless mark, card name, •••• last 4 (decoration only),
 * money left this month, today / per day, and the profile photo in a frame.
 * The ✏️ opens "Design my card": frame (ring / ID / polaroid / stamp / hex / full),
 * card colour, name, last 4, own photo, hide amount. Saved in
 * appData.profile.walletCard (synced like every other profile setting).
 * Styles: css/wallet-card.css. Used by HomeV2.money(). */
const WalletCard = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const SKINS = [
    { id: "blue", km: "ខៀវ", en: "Blue" },
    { id: "green", km: "បៃតង", en: "Green" },
    { id: "pink", km: "ផ្កាឈូក", en: "Pink" },
    { id: "black", km: "ខ្មៅ", en: "Black" },
    { id: "rose", km: "មាស", en: "Rose gold" }
  ];
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
      skin: SKINS.some(s => s.id === c.skin) ? c.skin : (dark() ? "green" : "blue"),
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
    const face = src ? `<img src="${escapeAttr(src)}" alt="">` : `<span>${initial()}</span>`;
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
      <article class="wc-card wc-skin-${c.skin}${c.frame === "full" ? " has-full" : ""}${c.frame === "none" ? " no-photo" : ""}" aria-label="${escapeAttr(L(`នៅសល់ខែ${monthName}`, `Left in ${monthName}`))}">
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
        <div class="wc-skins">${SKINS.map(s => `<button type="button" class="wc-skin wc-skin-${s.id}" data-wc-skin="${s.id}" aria-label="${escapeAttr(km() ? s.km : s.en)}"></button>`).join("")}</div>
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
    };
    form.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => Modal.close()));
    form.addEventListener("click", event => {
      const fr = event.target.closest("[data-wc-frame]");
      if (fr) { draft.frame = fr.dataset.wcFrame; paint(); }
      const sk = event.target.closest("[data-wc-skin]");
      if (sk) { draft.skin = sk.dataset.wcSkin; paint(); }
      if (event.target.closest("[data-wc-use-profile]")) { draft.photo = ""; paint(); }
    });
    form.elements.wcName.addEventListener("input", e => { draft.name = e.target.value.trim() || c.name; paint(); });
    form.elements.wcLast4.addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); if (e.target.value.length === 4) { draft.last4 = e.target.value; paint(); } });
    form.elements.wcHide.addEventListener("change", e => { draft.hide = e.target.checked; paint(); });
    form.elements.wcPhoto.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try { draft.photo = await readFile(file); paint(); } catch (error) { Toast.show(L("មិនអាចបើករូបបានទេ", "Could not open that photo"), "warning"); }
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const next = { skin: draft.skin, frame: draft.frame, name: draft.name, last4: draft.last4, photo: draft.photo || "", hide: !!draft.hide };
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
