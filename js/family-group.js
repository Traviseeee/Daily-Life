/* MYLIFE Part 2A: family group — members, roles, permissions, invites.
 * Data lives in Supabase tables families / family_members / family_invites
 * (supabase/migrations/20261023_family_core.sql). RLS decides who sees what;
 * this file only draws it:
 *   1. card on the Family page: members, role pills, "+ invite"
 *   2. member sheet (admin): role, what they can see, remove
 *   3. invite sheet: role + what they can see → single-use link (7 days), QR, Copy, Telegram
 *   + joining: /?join=<token> → sign in → "join this family?"
 * Money, AI key and PIN stay in the owner's app_data, which members can never read.
 */
const FamilyGroup = (() => {
  const km = () => languageCode() === "km";
  const L = (kmText, enText) => (km() ? kmText : enText);
  const JOIN_KEY = "mylife:family-join";
  const svg = paths => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const IC = {
    lock: () => svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    unlock: () => svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
    cart: () => svg('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.4 11h11l2-8H6.2"/>'),
    copy: () => svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    send: () => svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
    userPlus: () => svg('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/>'),
    back: () => svg('<path d="m15 18-6-6 6-6"/>')
  };
  const icon = name => (Icons[name] ? Icons[name]() : "");

  // what a member may see; shared ones on by default, private ones off
  const PERMS = [
    { key: "memories", group: "shared", km: "Memories (post និង reels)", en: "Memories (posts & reels)", short: ["Memories", "Memories"], icon: () => icon("memory") },
    { key: "calendar", group: "shared", km: "Calendar គ្រួសារ", en: "Family calendar", short: ["Calendar", "Calendar"], icon: () => icon("calendar") },
    { key: "shopping", group: "shared", km: "បញ្ជីទិញឥវ៉ាន់", en: "Shopping list", short: ["ទិញឥវ៉ាន់", "Shopping"], icon: IC.cart },
    { key: "myEvents", group: "private", km: "ព្រឹត្តិការណ៍ផ្ទាល់ខ្លួនខ្ញុំ", en: "My own events", short: ["ព្រឹត្តិការណ៍ខ្ញុំ", "My events"], icon: () => icon("calendar") },
    { key: "money", group: "private", km: "លុយ និងចំណាយ", en: "Money & spending", sub: ["មើលបានប៉ុណ្ណោះ មិនអាចកែ", "View only, can't edit"], short: ["លុយ", "Money"], icon: () => icon("wallet") },
    { key: "bills", group: "private", km: "វិក្កយបត្រ និងកម្ចី", en: "Bills & loans", sub: ["មើលបានប៉ុណ្ណោះ", "View only"], short: ["វិក្កយបត្រ", "Bills"], icon: () => icon("bill") },
    { key: "savings", group: "private", km: "គោលដៅសន្សំ", en: "Savings goals", sub: ["មើលបានប៉ុណ្ណោះ", "View only"], short: ["សន្សំ", "Savings"], icon: () => icon("target") }
  ];
  const DEFAULT_PERMS = { memories: true, calendar: true, shopping: true };
  const ROLE = { admin: ["អ្នកគ្រប់គ្រង", "Admin"], member: ["សមាជិក", "Member"], viewer: ["អ្នកមើល", "Viewer"] };

  const state = { status: "idle", family: null, members: [], invites: [], me: null, error: "" };
  let loading = null;

  const client = () => (typeof window !== "undefined" ? window.supabaseClient : null);
  async function myId() {
    try { const { data } = await client().auth.getSession(); return data?.session?.user?.id || null; } catch (error) { return null; }
  }
  const missingTable = error => /does not exist|schema cache|PGRST205|42P01|42883|could not find the function/i.test(`${error?.code || ""} ${error?.message || ""}`);

  async function load(force = false) {
    if (loading && !force) return loading;
    loading = (async () => {
      if (!client()?.from) { state.status = "offline"; return state; }
      const uid = await myId();
      if (!uid) { state.status = "signedout"; return state; }
      state.me = uid;
      const mine = await client().from("family_members").select("family_id, role").eq("user_id", uid).limit(1);
      if (mine.error) { state.status = missingTable(mine.error) ? "notsetup" : "error"; state.error = mine.error.message; return state; }
      const row = (mine.data || [])[0];
      if (!row) { state.status = "none"; state.family = null; state.members = []; return state; }
      const [family, members] = await Promise.all([
        client().from("families").select("*").eq("id", row.family_id).limit(1),
        client().from("family_members").select("*").eq("family_id", row.family_id)
      ]);
      if (family.error || members.error) { state.status = "error"; state.error = (family.error || members.error).message; return state; }
      state.family = (family.data || [])[0] || null;
      const order = { admin: 0, member: 1, viewer: 2 };
      state.members = (members.data || []).sort((a, b) => (order[a.role] - order[b.role]) || String(a.joined_at).localeCompare(String(b.joined_at)));
      state.invites = [];
      if (row.role === "admin") { // links not used yet and not expired (RLS: admin only)
        const invites = await client().from("family_invites").select("token, role, created_at, expires_at, used_at").eq("family_id", row.family_id);
        const now = Date.now();
        state.invites = (invites.data || []).filter(entry => !entry.used_at && Date.parse(entry.expires_at) > now).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      }
      state.status = "ready";
      return state;
    })().finally(() => { loading = null; });
    return loading;
  }

  const meRow = () => state.members.find(member => member.user_id === state.me) || null;
  const isAdmin = () => meRow()?.role === "admin";
  const isOwner = member => state.family && member.user_id === state.family.owner_id;
  function nameOf(member) {
    if (member.display_name) return member.display_name;
    if (member.user_id === state.me) return appData.profile?.name || L("អ្នក", "You");
    return L("សមាជិក", "Member");
  }
  const initials = name => String(name || "?").trim().split(/\s+/).map(part => Array.from(part)[0] || "").join("").slice(0, 2).toUpperCase() || "?";
  const TONES = ["#d9ff7b", "#ffc7e1", "#bfe0ff", "#ffd28a", "#c9b8ff", "#9df0d2"];
  const toneOf = id => TONES[Array.from(String(id)).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TONES.length];
  const avatar = (member, size = "") => `<span class="fg-avatar ${size}" style="--fg-tone:${toneOf(member.user_id)}">${escapeHtml(member.avatar || initials(nameOf(member)))}</span>`;
  const rolePill = role => `<span class="fg-role is-${role}">${escapeHtml(L(...ROLE[role]))}</span>`;
  function seesText(member) {
    if (member.role === "admin") return isOwner(member) ? L("ម្ចាស់គ្រួសារ", "Family owner") : L("អ្នកគ្រប់គ្រង", "Admin");
    const list = PERMS.filter(perm => member.permissions?.[perm.key]).map(perm => L(...perm.short));
    const text = list.join(" · ") || L("មិនទាន់ឲ្យមើលអ្វីទេ", "Nothing shared yet");
    return member.role === "viewer" ? `${L("មើលប៉ុណ្ណោះ", "View only")} · ${text}` : text;
  }

  /* ---------- 1. card on the Family page ---------- */
  function cardHtml() {
    if (state.status === "idle" || state.status === "loading") return `<article class="fg-card is-loading"><span class="fg-skel"></span><span class="fg-skel short"></span></article>`;
    if (state.status === "signedout" || state.status === "offline") return `<article class="fg-card fg-soft"><div class="fg-soft-row"><span class="fg-soft-icon">${icon("family")}</span><div><strong>${escapeHtml(L("គ្រួសាររបស់ខ្ញុំ", "My family group"))}</strong><small>${escapeHtml(state.status === "offline" ? L("ត្រូវ online ដើម្បីមើលសមាជិក", "Go online to see members") : L("Login ដើម្បីអញ្ជើញគ្រួសារមកប្រើជាមួយ", "Log in to invite your family"))}</small></div></div></article>`;
    if (state.status === "notsetup") return `<article class="fg-card fg-soft"><div class="fg-soft-row"><span class="fg-soft-icon">${IC.lock()}</span><div><strong>${escapeHtml(L("Family group មិនទាន់ setup", "Family group not set up yet"))}</strong><small>${escapeHtml(L("ត្រូវ run SQL 20261023_family_core.sql ក្នុង Supabase ម្តង", "Run 20261023_family_core.sql in Supabase once"))}</small></div></div></article>`;
    if (state.status === "error") return `<article class="fg-card fg-soft"><div class="fg-soft-row"><span class="fg-soft-icon">${IC.lock()}</span><div><strong>${escapeHtml(L("មិនអាចផ្ទុកគ្រួសារបាន", "Couldn't load family"))}</strong><small>${escapeHtml(state.error || "")}</small></div><button type="button" class="fg-mini" data-fg-retry>${escapeHtml(L("ម្តងទៀត", "Retry"))}</button></div></article>`;
    if (state.status === "none") return `<article class="fg-card">
      <div class="fg-head"><div><h2>${escapeHtml(L("គ្រួសាររបស់ខ្ញុំ", "My family group"))}</h2><small>${escapeHtml(L("ចែក Memories និង Calendar ជាមួយគ្រួសារ — លុយនៅតែជារបស់អ្នក", "Share memories & calendar — your money stays yours"))}</small></div></div>
      <button type="button" class="fg-primary" data-fg-create>${IC.userPlus()}<span>${escapeHtml(L("បង្កើតគ្រួសារ", "Create family group"))}</span></button>
    </article>`;
    const admin = isAdmin();
    const moneyTo = state.members.filter(member => member.role !== "admin" && member.permissions?.money).map(nameOf);
    return `<article class="fg-card">
      <div class="fg-head"><div><h2>${escapeHtml(state.family?.name || L("គ្រួសារខ្ញុំ", "My family"))}</h2><small>${escapeHtml(L(`សមាជិក ${state.members.length} នាក់`, `${state.members.length} members`))}</small></div>${rolePill(meRow()?.role || "member")}</div>
      <div class="fg-list">${state.members.map(member => `<button type="button" class="fg-row" data-fg-member="${escapeAttr(member.user_id)}" ${admin || member.user_id === state.me ? "" : "disabled"}>
        ${avatar(member)}
        <span class="fg-row-text"><strong>${escapeHtml(nameOf(member))}${member.user_id === state.me ? ` <em>(${escapeHtml(L("អ្នក", "you"))})</em>` : ""}</strong><small>${escapeHtml(seesText(member))}</small></span>
        ${member.role !== "admin" && member.permissions?.money ? `<span class="fg-money-on" title="${escapeAttr(L("មើលលុយបាន", "Can view money"))}">${IC.unlock()}</span>` : ""}
        ${rolePill(member.role)}
      </button>`).join("")}</div>
      ${admin && state.invites?.length ? `<div class="fg-invites"><h3 class="fg-label">${escapeHtml(L(`Link អញ្ជើញកំពុងរង់ចាំ (${state.invites.length})`, `Pending invite links (${state.invites.length})`))}</h3>${state.invites.map(entry => `<div class="fg-invite-row">${rolePill(entry.role)}<small>${escapeHtml(L("ផុតកំណត់", "Expires"))} ${escapeHtml(formatDate(String(entry.expires_at).slice(0, 10)))}</small><button type="button" class="fg-mini is-ghost" data-fg-cancel="${escapeAttr(entry.token)}">${escapeHtml(L("បោះបង់", "Cancel"))}</button></div>`).join("")}</div>` : ""}
      ${admin ? `<button type="button" class="fg-primary" data-fg-invite>${IC.userPlus()}<span>${escapeHtml(L("អញ្ជើញសមាជិក", "Invite a member"))}</span></button>` : ""}
      <p class="fg-note">${moneyTo.length ? `${IC.unlock()}<span>${escapeHtml(L(`${moneyTo.join(", ")} មើលលុយបាន (មើលប៉ុណ្ណោះ)`, `${moneyTo.join(", ")} can view money (view only)`))}</span>` : `${IC.lock()}<span>${escapeHtml(L("លុយ និងកម្ចី មិនចែករំលែកទេ", "Money and loans are not shared"))}</span>`}</p>
    </article>`;
  }

  function paint() {
    document.querySelectorAll("[data-family-group]").forEach(slot => {
      slot.innerHTML = cardHtml();
      slot.querySelector("[data-fg-retry]")?.addEventListener("click", () => refresh(true));
      slot.querySelector("[data-fg-create]")?.addEventListener("click", createFamily);
      slot.querySelector("[data-fg-invite]")?.addEventListener("click", openInvite);
      slot.querySelectorAll("[data-fg-member]").forEach(button => button.addEventListener("click", () => openMember(button.dataset.fgMember)));
      slot.querySelectorAll("[data-fg-cancel]").forEach(button => button.addEventListener("click", async () => {
        if (button.dataset.armed !== "1") { button.dataset.armed = "1"; button.textContent = L("ចុចម្តងទៀត", "Tap again"); setTimeout(() => { button.dataset.armed = ""; button.textContent = L("បោះបង់", "Cancel"); }, 4000); return; }
        button.disabled = true;
        const { error } = await client().from("family_invites").delete().eq("token", button.dataset.fgCancel);
        Toast.show(error ? `⚠️ ${error.message}` : L("បានបោះបង់ link — ប្រើលែងបាន", "Link cancelled — it no longer works"));
        refresh(true);
      }));
    });
  }

  async function refresh(force = false) {
    if (state.status === "idle") state.status = "loading";
    paint();
    try { await load(force); } catch (error) { state.status = "error"; state.error = error.message; }
    paint();
  }
  // called after the Family page renders
  function mount() { paint(); refresh(true); }

  async function createFamily(event) {
    const button = event.currentTarget;
    button.disabled = true;
    const name = appData.profile?.name ? L(`គ្រួសារ ${appData.profile.name.split(/\s+/)[0]}`, `${appData.profile.name.split(/\s+/)[0]}'s family`) : L("គ្រួសារខ្ញុំ", "My family");
    const { error } = await client().rpc("create_family", { p_name: name, p_display_name: appData.profile?.name || null });
    if (error) { Toast.show(`⚠️ ${error.message}`); button.disabled = false; return; }
    Toast.show(L("✅ បានបង្កើតគ្រួសារ", "✅ Family group created"));
    refresh(true);
  }

  /* ---------- sheet shell ---------- */
  function sheet(html, onClose) {
    closeSheet();
    const node = document.createElement("div");
    node.className = "fg-sheet";
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-modal", "true");
    node.innerHTML = `<div class="fg-panel">${html}</div>`;
    document.body.appendChild(node);
    const close = () => { closeSheet(); if (onClose) onClose(); };
    node.addEventListener("click", event => { if (event.target === node || event.target.closest("[data-fg-close]")) close(); });
    node._esc = event => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", node._esc);
    return node;
  }
  function closeSheet() {
    document.querySelectorAll(".fg-sheet").forEach(node => { document.removeEventListener("keydown", node._esc); node.remove(); });
  }
  const toggle = (attrs, on, label) => `<label class="fg-switch"><input type="checkbox" ${attrs} ${on ? "checked" : ""} aria-label="${escapeAttr(label)}"><span></span></label>`;
  const permRow = (perm, on, attrs) => `<div class="fg-perm"><span class="fg-perm-icon">${perm.icon()}</span><span class="fg-perm-text"><strong>${escapeHtml(L(perm.km, perm.en))}</strong>${perm.sub ? `<small>${escapeHtml(L(...perm.sub))}</small>` : ""}</span>${toggle(`${attrs}="${perm.key}"`, on, L(perm.km, perm.en))}</div>`;
  const LATER_NOTE = () => `<p class="fg-later">${escapeHtml(L("Calendar, ទិញឥវ៉ាន់ និងលុយ ចាប់ផ្តើមចែកនៅជំហានបន្ទាប់ — ការកំណត់នេះរក្សាទុកសិន", "Calendar, shopping and money sharing turn on in the next step — these settings are saved now"))}</p>`;

  /* ---------- 2. member sheet ---------- */
  function openMember(userId) {
    const member = state.members.find(entry => entry.user_id === userId);
    if (!member) return;
    const admin = isAdmin();
    const self = member.user_id === state.me;
    if (!admin && !self) return;
    const editable = admin && !isOwner(member);
    const perms = { ...(member.permissions || {}) };
    const node = sheet(`
      <div class="fg-sheet-head"><button type="button" class="fg-icon-btn" data-fg-close aria-label="${escapeAttr(L("ត្រឡប់", "Back"))}">${IC.back()}</button>${avatar(member, "is-lg")}<div><strong>${escapeHtml(editable ? L(`សិទ្ធិរបស់ ${nameOf(member)}`, `${nameOf(member)}'s access`) : nameOf(member))}</strong><small>${escapeHtml(seesText(member))}</small></div></div>
      ${self ? `<form class="fg-rename" data-fg-rename><input maxlength="40" value="${escapeAttr(member.display_name || nameOf(member))}" aria-label="${escapeAttr(L("ឈ្មោះក្នុងគ្រួសារ", "Name in the family"))}"><button type="submit">${escapeHtml(L("រក្សាទុក", "Save"))}</button></form>` : ""}
      ${editable ? `
        <h3 class="fg-label">${escapeHtml(L("តួនាទី", "Role"))}</h3>
        <div class="fg-pills">${["member", "viewer"].map(role => `<button type="button" class="fg-pill ${member.role === role ? "is-on" : ""}" data-fg-role="${role}">${escapeHtml(L(...ROLE[role]))}<small>${escapeHtml(role === "member" ? L("post, ❤️, បញ្ចេញមតិ", "post, ❤️, comment") : L("មើល និង ❤️ ប៉ុណ្ណោះ", "view and ❤️ only"))}</small></button>`).join("")}</div>
        <h3 class="fg-label">${escapeHtml(L("ឲ្យមើល និងប្រើ", "Can see and use"))}</h3>
        ${PERMS.filter(perm => perm.group === "shared").map(perm => permRow(perm, perms[perm.key], "data-fg-perm")).join("")}
        <h3 class="fg-label">${escapeHtml(L("ឯកជន (បិទជាស្រេច)", "Private (off by default)"))}</h3>
        ${PERMS.filter(perm => perm.group === "private").map(perm => permRow(perm, perms[perm.key], "data-fg-perm")).join("")}
        ${LATER_NOTE()}
        <button type="button" class="fg-danger" data-fg-remove>${escapeHtml(L("ដកចេញពីគ្រួសារ", "Remove from family"))}</button>` : ""}
      ${self && !isOwner(member) ? `<button type="button" class="fg-danger" data-fg-leave>${escapeHtml(L("ចាកចេញពីគ្រួសារ", "Leave this family"))}</button>` : ""}
      <p class="fg-saved" data-fg-saved hidden></p>`, () => refresh(true));

    const saved = text => { const out = node.querySelector("[data-fg-saved]"); out.hidden = false; out.textContent = text; };
    async function save(changes) {
      const { error } = await client().from("family_members").update(changes).eq("family_id", member.family_id).eq("user_id", member.user_id);
      if (error) { saved(`⚠️ ${error.message}`); return false; }
      Object.assign(member, changes);
      const head = node.querySelector(".fg-sheet-head small");
      if (head) head.textContent = seesText(member);
      saved(L("✅ បានរក្សាទុក", "✅ Saved"));
      return true;
    }
    node.querySelectorAll("[data-fg-role]").forEach(button => button.addEventListener("click", async () => {
      if (await save({ role: button.dataset.fgRole })) node.querySelectorAll("[data-fg-role]").forEach(entry => entry.classList.toggle("is-on", entry === button));
    }));
    node.querySelectorAll("[data-fg-perm]").forEach(input => input.addEventListener("change", async () => {
      const next = { ...(member.permissions || {}), [input.dataset.fgPerm]: input.checked };
      if (!(await save({ permissions: next }))) input.checked = !input.checked;
    }));
    node.querySelector("[data-fg-rename]")?.addEventListener("submit", async event => {
      event.preventDefault();
      const value = event.currentTarget.querySelector("input").value.trim().slice(0, 40);
      if (value) await save({ display_name: value });
    });
    // remove / leave: second tap confirms (no browser dialogs)
    const confirmTwice = (button, label, action) => button?.addEventListener("click", async () => {
      if (!button.dataset.label) button.dataset.label = button.textContent;
      if (button.dataset.armed !== "1") {
        button.dataset.armed = "1"; button.textContent = label;
        clearTimeout(button._t);
        button._t = setTimeout(() => { button.dataset.armed = ""; button.textContent = button.dataset.label; }, 5000); // label goes back too (31 Oct)
        return;
      }
      clearTimeout(button._t);
      button.disabled = true;
      button.textContent = L("កំពុងដំណើរការ…", "Working…");
      // .select() returns the deleted rows: 0 rows means nothing was removed (no error from RLS)
      const { data: gone, error } = await client().from("family_members").delete().eq("family_id", member.family_id).eq("user_id", member.user_id).select("user_id");
      if (error || !gone?.length) {
        saved(`⚠️ ${error?.message || L("មិនបានដកចេញទេ — សូមព្យាយាមម្តងទៀត", "Nothing was removed — try again")}`);
        button.disabled = false; button.dataset.armed = ""; button.textContent = button.dataset.label;
        return;
      }
      Toast.show(action);
      closeSheet();
      refresh(true);
    });
    confirmTwice(node.querySelector("[data-fg-remove]"), L("ចុចម្តងទៀត ដើម្បីដកចេញ", "Tap again to remove"), L("បានដកចេញពីគ្រួសារ", "Removed from family"));
    confirmTwice(node.querySelector("[data-fg-leave]"), L("ចុចម្តងទៀត ដើម្បីចាកចេញ", "Tap again to leave"), L("បានចាកចេញពីគ្រួសារ", "You left the family"));
  }

  /* ---------- 3. invite sheet ---------- */
  function loadQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "js/vendor/qrcode.js?v=1";
      script.onload = () => resolve(window.qrcode);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  // the link is opened on someone else's phone: never localhost / a LAN address
  const APP_URL = "https://daily-life-2.vercel.app/";
  const publicBase = () => (/^https:$/.test(location.protocol) && !/^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(location.hostname) ? `${location.origin}${location.pathname.replace(/index\.html$/, "")}` : APP_URL);
  const joinUrl = token => `${publicBase()}?join=${encodeURIComponent(token)}`;

  function openInvite() {
    if (!isAdmin() || !state.family) return;
    let role = "member";
    const perms = { ...DEFAULT_PERMS };
    const chips = () => PERMS.map(perm => {
      const locked = perm.group === "private";
      const on = Boolean(perms[perm.key]);
      return `<button type="button" class="fg-chip ${on ? "is-on" : ""} ${locked ? "is-private" : ""}" data-fg-chip="${perm.key}" aria-pressed="${on}">${on ? icon("check") : locked ? IC.lock() : ""}<span>${escapeHtml(L(...perm.short))}</span></button>`;
    }).join("");
    const node = sheet(`
      <div class="fg-sheet-title"><strong>${escapeHtml(L("អញ្ជើញសមាជិកថ្មី", "Invite a new member"))}</strong><button type="button" class="fg-icon-btn" data-fg-close aria-label="Close">${icon("close")}</button></div>
      <div data-fg-step="choose">
        <h3 class="fg-label">${escapeHtml(L("ជ្រើសតួនាទី", "Choose a role"))}</h3>
        <div class="fg-pills">${["member", "viewer"].map(entry => `<button type="button" class="fg-pill ${entry === role ? "is-on" : ""}" data-fg-irole="${entry}">${escapeHtml(L(...ROLE[entry]))}<small>${escapeHtml(entry === "member" ? L("post, ❤️, បញ្ចេញមតិ", "post, ❤️, comment") : L("មើល និង ❤️ ប៉ុណ្ណោះ", "view and ❤️ only"))}</small></button>`).join("")}</div>
        <h3 class="fg-label">${escapeHtml(L("ឲ្យមើលអ្វីខ្លះ៖", "What they can see:"))}</h3>
        <div class="fg-chips" data-fg-chips>${chips()}</div>
        ${LATER_NOTE()}
        <button type="button" class="fg-primary" data-fg-make>${IC.userPlus()}<span>${escapeHtml(L("បង្កើត link អញ្ជើញ", "Create invite link"))}</span></button>
      </div>
      <div data-fg-step="share" hidden>
        <div class="fg-qr" data-fg-qr></div>
        <p class="fg-qr-note">${escapeHtml(L("ស្កេន ឬផ្ញើ link · ប្រើបានម្តង · ផុតកំណត់ក្នុង 7 ថ្ងៃ", "Scan or send the link · single use · expires in 7 days"))}</p>
        <input class="fg-link" data-fg-link readonly aria-label="Invite link">
        <div class="fg-share">
          <button type="button" class="fg-primary" data-fg-copy>${IC.copy()}<span>Copy link</span></button>
          <a class="fg-secondary" data-fg-tg target="_blank" rel="noopener">${IC.send()}<span>Telegram</span></a>
        </div>
      </div>`, () => refresh(true));

    node.querySelectorAll("[data-fg-irole]").forEach(button => button.addEventListener("click", () => {
      role = button.dataset.fgIrole;
      node.querySelectorAll("[data-fg-irole]").forEach(entry => entry.classList.toggle("is-on", entry === button));
    }));
    const bindChips = () => node.querySelectorAll("[data-fg-chip]").forEach(button => button.addEventListener("click", () => {
      perms[button.dataset.fgChip] = !perms[button.dataset.fgChip];
      node.querySelector("[data-fg-chips]").innerHTML = chips();
      bindChips();
    }));
    bindChips();
    node.querySelector("[data-fg-make]").addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      const { data: token, error } = await client().rpc("create_family_invite", { p_family: state.family.id, p_role: role, p_permissions: perms });
      if (error || !token) { Toast.show(`⚠️ ${error?.message || "invite failed"}`); button.disabled = false; return; }
      const url = joinUrl(token);
      node.querySelector("[data-fg-step=choose]").hidden = true;
      node.querySelector("[data-fg-step=share]").hidden = false;
      node.querySelector("[data-fg-link]").value = url;
      const text = L(`អញ្ជើញចូលគ្រួសារ ${state.family.name} ក្នុង MYLIFE`, `Join ${state.family.name} on MYLIFE`);
      node.querySelector("[data-fg-tg]").href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
      try {
        const qrcode = await loadQr();
        const qr = qrcode(0, "M");
        qr.addData(url);
        qr.make();
        node.querySelector("[data-fg-qr]").innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
      } catch (qrError) { node.querySelector("[data-fg-qr]").hidden = true; }
    });
    node.querySelector("[data-fg-copy]").addEventListener("click", async () => {
      const input = node.querySelector("[data-fg-link]");
      try { await navigator.clipboard.writeText(input.value); } catch (error) { input.select(); try { document.execCommand("copy"); } catch (copyError) { /* select is enough */ } }
      Toast.show(L("✅ បាន copy link", "✅ Link copied"));
    });
  }

  /* ---------- joining with /?join=<token> ---------- */
  function rememberJoin() {
    try {
      const params = new URLSearchParams(location.search);
      const token = params.get("join");
      if (!token) return;
      sessionStorage.setItem(JOIN_KEY, token);
      localStorage.setItem(JOIN_KEY, token); // survives the sign-up email round trip on this device
      params.delete("join");
      history.replaceState(null, "", `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`);
    } catch (error) { /* ignore */ }
  }
  const pendingJoin = () => { try { return sessionStorage.getItem(JOIN_KEY) || localStorage.getItem(JOIN_KEY) || ""; } catch (error) { return ""; } };
  const clearJoin = () => { try { sessionStorage.removeItem(JOIN_KEY); localStorage.removeItem(JOIN_KEY); } catch (error) { /* ignore */ } };

  let joinShown = false;
  async function tryJoin() {
    const token = pendingJoin();
    if (!token || joinShown || !client()?.rpc) return;
    if (!(await myId())) return; // after login (onAuthStateChange calls again)
    joinShown = true;
    const { data, error } = await client().rpc("family_invite_preview", { p_token: token });
    const info = Array.isArray(data) ? data[0] : data;
    if (error || !info) { clearJoin(); joinShown = false; Toast.show(L("⚠️ Link អញ្ជើញមិនត្រឹមត្រូវ", "⚠️ Invite link not valid")); return; }
    if (info.status !== "ok") {
      clearJoin(); joinShown = false;
      Toast.show(info.status === "used" ? L("⚠️ Link នេះបានប្រើរួចហើយ — សុំ link ថ្មី", "⚠️ This link was already used — ask for a new one") : L("⚠️ Link ផុតកំណត់ — សុំ link ថ្មី", "⚠️ This link expired — ask for a new one"));
      return;
    }
    const node = sheet(`
      <div class="fg-join">
        <span class="fg-join-icon">${icon("family")}</span>
        <strong>${escapeHtml(L(`ចូលរួមគ្រួសារ «${info.family_name}»?`, `Join “${info.family_name}”?`))}</strong>
        <p>${escapeHtml(L(`ជា ${ROLE[info.role][0]} · លុយ និងការងាររបស់អ្នក នៅតែជារបស់អ្នក`, `As ${ROLE[info.role][1]} · your own money and tasks stay yours`))}</p>
        <button type="button" class="fg-primary" data-fg-accept>${escapeHtml(L("ចូលរួម", "Join"))}</button>
        <button type="button" class="fg-text-btn" data-fg-close>${escapeHtml(L("ពេលក្រោយ", "Not now"))}</button>
      </div>`, () => { joinShown = false; });
    node.querySelector("[data-fg-accept]").addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      const { error: joinError } = await client().rpc("accept_family_invite", { p_token: token, p_display_name: appData.profile?.name || null });
      clearJoin();
      closeSheet();
      if (joinError) { Toast.show(`⚠️ ${joinError.message}`); joinShown = false; return; }
      Toast.show(L("🎉 បានចូលរួមគ្រួសារ", "🎉 You joined the family"));
      window.familyAlert?.("join");
      location.hash = "#family";
      refresh(true);
    });
  }

  rememberJoin();
  if (typeof window !== "undefined") {
    // a family member (not the owner) opened MYLIFE: let the owner know, at most every 6 hours
    const LOGIN_KEY = "mylife:family-login-alert";
    const loginAlert = async () => {
      try {
        if (Date.now() - Number(localStorage.getItem(LOGIN_KEY) || 0) < 6 * 3600 * 1000) return;
        const group = await load();
        if (group.status !== "ready" || !group.family || group.family.owner_id === group.me) return;
        localStorage.setItem(LOGIN_KEY, String(Date.now()));
        window.familyAlert?.("login");
      } catch (error) { /* ignore */ }
    };
    const start = () => {
      tryJoin();
      loginAlert();
      try { client()?.auth?.onAuthStateChange?.(event => { setTimeout(tryJoin, 400); if (event === "SIGNED_IN") setTimeout(loginAlert, 1500); if (document.querySelector("[data-family-group]")) refresh(true); }); } catch (error) { /* ignore */ }
    };
    if (document.readyState === "complete") setTimeout(start, 1500); else window.addEventListener("load", () => setTimeout(start, 1500));
  }

  return { mount, refresh, load, state, openInvite, openMember, tryJoin, PERMS, DEFAULT_PERMS };
})();
