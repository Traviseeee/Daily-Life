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

  const state = { status: "idle", family: null, members: [], invites: [], requests: [], profiles: {}, v2: false, me: null, mePhoto: "", error: "" };
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
      let sessionUser = null;
      try {
        const { data } = await client().auth.getSession();
        sessionUser = data?.session?.user || null;
      } catch (error) { /* Continue with initials if auth metadata is unavailable. */ }
      const uid = sessionUser?.id || await myId();
      if (!uid) { state.status = "signedout"; return state; }
      state.me = uid;
      const metadata = sessionUser?.user_metadata || {};
      state.mePhoto = String(metadata.avatar_url || metadata.picture || metadata.photo_url || metadata.avatar || "");
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
      state.requests = [];
      // v2 (20261106_invite_v2_profiles.sql): everyone's profile in one call; missing function = old database
      const profiles = await client().rpc("family_profiles", { p_family: row.family_id });
      state.v2 = !profiles.error;
      state.profiles = {};
      (profiles.data || []).forEach(entry => { state.profiles[entry.user_id] = entry; });
      if (row.role === "admin") { // links (RLS: admin only)
        const invites = await client().from("family_invites").select("*").eq("family_id", row.family_id);
        const now = Date.now();
        const list = invites.data || [];
        if (state.v2) {
          const tokens = list.map(entry => entry.token);
          const uses = tokens.length ? await client().from("family_invite_uses").select("*").in("token", tokens) : { data: [] };
          const useRows = uses.data || [];
          list.forEach(entry => { entry.status = inviteStatus(entry, now); entry.uses = useRows.filter(use => use.token === entry.token); });
          state.requests = useRows.filter(use => use.status === "pending").map(use => ({ ...use, invite: list.find(entry => entry.token === use.token) }));
          linkCards(list);
          // only links that still work; used / expired / cancelled ones stay in Supabase (history), not on screen
          state.invites = list.filter(entry => entry.status === "ok").sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        } else {
          state.invites = list.filter(entry => !entry.used_at && Date.parse(entry.expires_at) > now).map(entry => ({ ...entry, status: "ok" })).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        }
      }
      state.status = "ready";
      // my photo for the family to see (once; js/member-profile.js)
      if (state.v2 && typeof MemberProfile !== "undefined" && MemberProfile.ensureMyPhoto) setTimeout(() => MemberProfile.ensureMyPhoto(), 1500);
      return state;
    })().finally(() => { loading = null; });
    return loading;
  }

  function inviteStatus(entry, now = Date.now()) {
    if (entry.cancelled_at) return "cancelled";
    if (entry.expires_at && Date.parse(entry.expires_at) < now) return "expired";
    if ((entry.max_uses || 1) <= 1 ? Boolean(entry.used_by) : Number(entry.use_count || 0) >= Number(entry.max_uses || 1)) return "used";
    return "ok";
  }
  // an invite made "for Lychee" links her family card to her account once she joins
  function linkCards(list) {
    let changed = false;
    list.forEach(entry => {
      if (!entry.member_card_id) return;
      const joined = (entry.uses || []).find(use => use.status === "joined");
      const card = (appData.family || []).find(person => person.id === entry.member_card_id);
      if (!joined || !card || card.userId === joined.user_id) return;
      if ((appData.family || []).some(person => person.userId === joined.user_id)) return;
      card.userId = joined.user_id;
      changed = true;
    });
    if (changed) { try { Store.save(); } catch (error) { /* next save picks it up */ } }
  }
  const profileOf = userId => state.profiles?.[userId] || null;
  const meRow = () => state.members.find(member => member.user_id === state.me) || null;
  const isAdmin = () => meRow()?.role === "admin";
  const isOwner = member => state.family && member.user_id === state.family.owner_id;
  function nameOf(member) {
    if (profileOf(member.user_id)?.display_name) return profileOf(member.user_id).display_name;
    if (member.display_name) return member.display_name;
    if (member.user_id === state.me) return appData.profile?.name || L("អ្នក", "You");
    return L("សមាជិក", "Member");
  }
  function familyDisplayName() { // the full name ("គ្រួសារ Tra"), not just "Tra" (6 Nov)
    const raw = String(state.family?.name || "").trim();
    return raw || L("មិនទាន់ដាក់ឈ្មោះ", "Unnamed group");
  }
  const initials = name => String(name || "?").trim().split(/\s+/).map(part => Array.from(part)[0] || "").join("").slice(0, 2).toUpperCase() || "?";
  const TONES = ["#d9ff7b", "#ffc7e1", "#bfe0ff", "#ffd28a", "#c9b8ff", "#9df0d2"];
  const toneOf = id => TONES[Array.from(String(id)).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TONES.length];
  const avatar = (member, size = "") => {
    const isSelf = member.user_id === state.me;
    const localPhotoIsCurrent = isSelf && typeof SyncState !== "undefined" && SyncState.getAccountId() === state.me;
    const profilePhoto = localPhotoIsCurrent ? (appData.profile?.photo || state.mePhoto) : (isSelf ? state.mePhoto : "");
    const usesLocalPhoto = localPhotoIsCurrent && Boolean(appData.profile?.photo);
    const position = usesLocalPhoto && typeof imagePosition === "function" ? imagePosition(appData.profile?.photoPosition) : { x: 0, y: 0 };
    const sharedPhoto = profileOf(member.user_id)?.photo || "";
    const face = sharedPhoto ? `<img src="${escapeAttr(sharedPhoto)}" alt="">` : profilePhoto
      ? `<img src="${escapeAttr(profilePhoto)}" alt="" style="--image-position-x:${position.x}%;--image-position-y:${position.y}%">`
      : escapeHtml(member.avatar || initials(nameOf(member)));
    return `<span class="fg-avatar ${size}" style="--fg-tone:${toneOf(member.user_id)}">${face}</span>`;
  };
  const rolePill = role => `<span class="fg-role is-${role}">${escapeHtml(L(...ROLE[role]))}</span>`;
  function seesText(member) {
    if (member.role === "admin") return "";
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
      <div class="fg-head"><div><h2>${escapeHtml(familyDisplayName())}</h2><small>${escapeHtml(L(`សមាជិក ${state.members.length} នាក់`, `${state.members.length} members`))}</small></div></div>
      <div class="fg-list">${state.members.map(member => {
        const detail = seesText(member);
        return `<button type="button" class="fg-row" data-fg-member="${escapeAttr(member.user_id)}" ${state.v2 || admin || member.user_id === state.me ? "" : "disabled"}>
        ${avatar(member)}
        <span class="fg-row-text"><strong>${escapeHtml(nameOf(member))}${member.user_id === state.me ? ` <em>(${escapeHtml(L("អ្នក", "you"))})</em>` : ""}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</span>
        ${member.role !== "admin" && member.permissions?.money ? `<span class="fg-money-on" title="${escapeAttr(L("មើលលុយបាន", "Can view money"))}">${IC.unlock()}</span>` : ""}
        ${rolePill(member.role)}
      </button>`;
      }).join("")}</div>
      ${admin && state.requests?.length ? `<div class="fg-invites fg-requests"><h3 class="fg-label">${escapeHtml(L(`សុំចូលរួម (${state.requests.length})`, `Asking to join (${state.requests.length})`))}</h3>${state.requests.map(req => `<div class="fg-invite-row fg-req"><span class="fg-avatar" style="--fg-tone:${toneOf(req.user_id)}">${escapeHtml(initials(req.display_name || "?"))}</span><span class="fg-row-text"><strong>${escapeHtml(req.display_name || L("អ្នកថ្មី", "Someone"))}</strong><small>${escapeHtml(L(`តាម ${req.invite?.label || "link"}`, `Via ${req.invite?.label || "link"}`))}</small></span><button type="button" class="fg-mini is-yes" data-fg-decide="${escapeAttr(`${req.token}|${req.user_id}`)}" data-fg-yes="1">${escapeHtml(L("យល់ព្រម", "Approve"))}</button><button type="button" class="fg-mini is-no" data-fg-decide="${escapeAttr(`${req.token}|${req.user_id}`)}">${escapeHtml(L("បដិសេធ", "Decline"))}</button></div>`).join("")}</div>` : ""}
      ${admin && state.invites?.length ? `<div class="fg-invites"><h3 class="fg-label">${escapeHtml(L("Link អញ្ជើញ", "Invite links"))}</h3>${state.invites.map(inviteRow).join("")}</div>` : ""}
      ${admin ? `<button type="button" class="fg-primary" data-fg-invite>${IC.userPlus()}<span>${escapeHtml(L("អញ្ជើញសមាជិក", "Invite a member"))}</span></button>` : ""}
      <p class="fg-note">${moneyTo.length ? `${IC.unlock()}<span>${escapeHtml(L(`${moneyTo.join(", ")} មើលលុយបាន (មើលប៉ុណ្ណោះ)`, `${moneyTo.join(", ")} can view money (view only)`))}</span>` : `${IC.lock()}<span>${escapeHtml(L("លុយ និងកម្ចី មិនចែករំលែកទេ", "Money and loans are not shared"))}</span>`}</p>
    </article>`;
  }

  const STATUS = { ok: ["កំពុងប្រើបាន", "Active"], used: ["បានប្រើ", "Used"], expired: ["ផុតកំណត់", "Expired"], cancelled: ["បានបោះបង់", "Cancelled"] };
  function inviteMeta(entry) {
    const bits = [];
    if (entry.status === "ok") bits.push(entry.expires_at ? L(`ដល់ ${formatDate(String(entry.expires_at).slice(0, 10))}`, `Until ${formatDate(String(entry.expires_at).slice(0, 10))}`) : L("គ្មានផុតកំណត់", "No expiry"));
    if ((entry.max_uses || 1) > 1) bits.push(L(`ប្រើ ${entry.use_count || 0}/${entry.max_uses}`, `Used ${entry.use_count || 0}/${entry.max_uses}`));
    const joined = (entry.uses || []).filter(use => use.status === "joined").map(use => use.display_name).filter(Boolean);
    if (joined.length) bits.push(L(`ចូល: ${joined.join(", ")}`, `Joined: ${joined.join(", ")}`));
    if (entry.needs_approval && entry.status === "ok") bits.push(L("ត្រូវយល់ព្រម", "Needs approval"));
    return bits.join(" · ");
  }
  function inviteRow(entry) {
    const card = entry.member_card_id ? (appData.family || []).find(person => person.id === entry.member_card_id) : null;
    const title = entry.label || card?.name || L((entry.max_uses || 1) > 1 ? "Link គ្រួសារ" : "Link អញ្ជើញ", (entry.max_uses || 1) > 1 ? "Family link" : "Invite link");
    return `<div class="fg-invite-row is-${entry.status}">
      <button type="button" class="fg-link-open" data-fg-link-open="${escapeAttr(entry.token)}" ${entry.status === "ok" && entry.code ? "" : "disabled"}>
        <span class="fg-link-ic">${(entry.max_uses || 1) > 1 ? "👪" : "✉️"}</span>
        <span class="fg-row-text"><strong>${escapeHtml(title)}${entry.code && entry.status === "ok" ? ` <em class="fg-code-mini">${escapeHtml(entry.code)}</em>` : ""}</strong><small>${escapeHtml([L(...ROLE[entry.role]), inviteMeta(entry)].filter(Boolean).join(" · "))}</small></span>
      </button>
      <span class="fg-st is-${entry.status}">${escapeHtml(L(...STATUS[entry.status]))}</span>
      ${entry.status === "ok" ? `<button type="button" class="fg-mini is-ghost" data-fg-cancel="${escapeAttr(entry.token)}">${escapeHtml(L("បោះបង់", "Cancel"))}</button>` : ""}
    </div>`;
  }

  function paint() {
    document.querySelectorAll("[data-family-group]").forEach(slot => {
      slot.innerHTML = cardHtml();
      const card = slot.querySelector(".fg-card");
      if (card) {
        const title = document.createElement("div");
        title.className = "fg-section-title";
        title.innerHTML = `${icon("family")}<span>${escapeHtml(L("ក្រុមគ្រួសារ", "Family group"))}</span>`;
        card.prepend(title);
      }
      slot.querySelector("[data-fg-retry]")?.addEventListener("click", () => refresh(true));
      slot.querySelector("[data-fg-create]")?.addEventListener("click", createFamily);
      slot.querySelector("[data-fg-invite]")?.addEventListener("click", openInvite);
      slot.querySelectorAll("[data-fg-member]").forEach(button => button.addEventListener("click", () => {
        if (state.v2) location.hash = `#profile/${button.dataset.fgMember}`;
        else openMember(button.dataset.fgMember);
      }));
      slot.querySelectorAll("[data-fg-decide]").forEach(button => button.addEventListener("click", async () => {
        const [token, user] = button.dataset.fgDecide.split("|");
        const approve = button.dataset.fgYes === "1";
        button.disabled = true;
        const { error } = await client().rpc("decide_family_join", { p_token: token, p_user: user, p_approve: approve });
        Toast.show(error ? `⚠️ ${error.message}` : approve ? L("✅ បានយល់ព្រម · ចូលរួមហើយ", "✅ Approved · they are in") : L("បានបដិសេធ", "Declined"));
        refresh(true);
      }));
      slot.querySelectorAll("[data-fg-link-open]").forEach(button => button.addEventListener("click", () => openLink(button.dataset.fgLinkOpen)));
      slot.querySelectorAll("[data-fg-cancel]").forEach(button => button.addEventListener("click", async () => {
        if (button.dataset.armed !== "1") { button.dataset.armed = "1"; button.textContent = L("ចុចម្តងទៀត", "Tap again"); setTimeout(() => { button.dataset.armed = ""; button.textContent = L("បោះបង់", "Cancel"); }, 4000); return; }
        button.disabled = true;
        const { error } = state.v2
          ? await client().rpc("cancel_family_invite", { p_token: button.dataset.fgCancel })
          : await client().from("family_invites").delete().eq("token", button.dataset.fgCancel);
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
    // a new member's empty Family page can now show the group's people (js/family-v2.js)
    if (document.querySelector(".family-empty-page") && typeof FamilyV2 !== "undefined" && FamilyV2.canShowGroup?.() && typeof App !== "undefined" && App.route === "family") App.render();
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

  function openInviteV1() {
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

  /* ---------- 3b. invite v2: for whom · how long · how many · code ---------- */
  const DAYS = [[1, ["1 ថ្ងៃ", "1 day"]], [7, ["7 ថ្ងៃ", "7 days"]], [30, ["30 ថ្ងៃ", "30 days"]], [null, ["គ្មានផុតកំណត់", "No expiry"]]];
  function shareHtml() {
    return `<div class="fg-share-v2">
      <div class="fg-share-who" data-fg-share-who></div>
      <div class="fg-share-grid"><div class="fg-qr" data-fg-qr></div><div><span class="fg-code" data-fg-code></span><small>${escapeHtml(L("លេខកូដចូលរួម · វាយនៅទំព័រ login បាន ដោយមិនចាំបាច់ចុច link", "Join code · type it on the login page, no link needed"))}</small></div></div>
      <input class="fg-link" data-fg-link readonly aria-label="Invite link">
      <div class="fg-share fg-share3">
        <button type="button" class="fg-primary" data-fg-copy>${IC.copy()}<span>${escapeHtml(L("ចម្លង link", "Copy link"))}</span></button>
        <a class="fg-secondary" data-fg-tg target="_blank" rel="noopener">${IC.send()}<span>Telegram</span></a>
        <button type="button" class="fg-secondary" data-fg-copycode>${escapeHtml(L("ចម្លងកូដ", "Copy code"))}</button>
      </div></div>`;
  }
  async function fillShare(node, entry) {
    const url = joinUrl(entry.token);
    node.querySelector("[data-fg-link]").value = url;
    node.querySelector("[data-fg-code]").textContent = entry.code || "";
    node.querySelector("[data-fg-share-who]").innerHTML = `<strong>${escapeHtml(entry.label || L("Link អញ្ជើញ", "Invite link"))}</strong><small>${escapeHtml([L(...ROLE[entry.role]), inviteMeta({ ...entry, status: "ok" })].filter(Boolean).join(" · "))}</small>`;
    const text = L(`អញ្ជើញចូលគ្រួសារ ${state.family.name} ក្នុង MYLIFE · លេខកូដ ${entry.code}`, `Join ${state.family.name} on MYLIFE · code ${entry.code}`);
    node.querySelector("[data-fg-tg]").href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    const copy = async (value, done) => {
      try { await navigator.clipboard.writeText(value); } catch (error) { const input = node.querySelector("[data-fg-link]"); input.value = value; input.select(); try { document.execCommand("copy"); } catch (copyError) { /* select is enough */ } input.value = url; }
      Toast.show(done);
    };
    node.querySelector("[data-fg-copy]").addEventListener("click", () => copy(url, L("✅ បានចម្លង link", "✅ Link copied")));
    node.querySelector("[data-fg-copycode]").addEventListener("click", () => copy(entry.code || "", L("✅ បានចម្លងកូដ", "✅ Code copied")));
    try {
      const qrcode = await loadQr();
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      node.querySelector("[data-fg-qr]").innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    } catch (qrError) { node.querySelector("[data-fg-qr]").hidden = true; }
  }
  function openLink(token) {
    const entry = state.invites.find(item => item.token === token);
    if (!entry || !state.family) return;
    const node = sheet(`<div class="fg-sheet-title"><strong>${escapeHtml(L("ចែក link អញ្ជើញ", "Share invite"))}</strong><button type="button" class="fg-icon-btn" data-fg-close aria-label="Close">${icon("close")}</button></div>${shareHtml()}`);
    fillShare(node, entry);
  }

  function openInvite() {
    if (!isAdmin() || !state.family) return;
    if (!state.v2) { openInviteV1(); return; }
    let role = "member", days = 7, many = false, cardId = "";
    const perms = { ...DEFAULT_PERMS };
    const cards = (appData.family || []).filter(person => person && person.id && person.relationship !== "Me" && !person.userId);
    const face = person => person.photo ? `<img src="${escapeAttr(person.photo)}" alt="">` : escapeHtml(initials(person.name));
    const chips = () => PERMS.map(perm => {
      const locked = perm.group === "private";
      const on = Boolean(perms[perm.key]);
      return `<button type="button" class="fg-chip ${on ? "is-on" : ""} ${locked ? "is-private" : ""}" data-fg-chip="${perm.key}" aria-pressed="${on}">${on ? icon("check") : locked ? IC.lock() : ""}<span>${escapeHtml(L(...perm.short))}</span></button>`;
    }).join("");
    const node = sheet(`
      <div class="fg-sheet-title"><strong>${escapeHtml(L("អញ្ជើញសមាជិកថ្មី", "Invite a new member"))}</strong><button type="button" class="fg-icon-btn" data-fg-close aria-label="Close">${icon("close")}</button></div>
      <div data-fg-step="choose">
        <h3 class="fg-label">${escapeHtml(L("សម្រាប់អ្នកណា?", "Who is it for?"))}</h3>
        <div class="fg-who" data-fg-who>
          ${cards.map(person => `<button type="button" class="fg-who-btn" data-fg-card="${escapeAttr(person.id)}"><span class="fg-who-face" style="--fg-tone:${toneOf(person.id)}">${face(person)}</span><span>${escapeHtml(String(person.name || "").split(/\s+/)[0])}</span></button>`).join("")}
          <button type="button" class="fg-who-btn is-on" data-fg-card=""><span class="fg-who-face is-new">＋</span><span>${escapeHtml(L("មនុស្សថ្មី", "Someone new"))}</span></button>
        </div>
        <h3 class="fg-label">${escapeHtml(L("តួនាទី", "Role"))}</h3>
        <div class="fg-pills">${["member", "viewer"].map(entry => `<button type="button" class="fg-pill ${entry === role ? "is-on" : ""}" data-fg-irole="${entry}">${escapeHtml(L(...ROLE[entry]))}<small>${escapeHtml(entry === "member" ? L("post, ❤️, បញ្ចេញមតិ", "post, ❤️, comment") : L("មើល និង ❤️ ប៉ុណ្ណោះ", "view and ❤️ only"))}</small></button>`).join("")}</div>
        <h3 class="fg-label">${escapeHtml(L("Link ប្រើបានរយៈពេល", "Link works for"))}</h3>
        <div class="fg-seg" data-fg-days>${DAYS.map(([value, label]) => `<button type="button" class="${value === days ? "is-on" : ""}" data-fg-day="${value === null ? "" : value}">${escapeHtml(L(...label))}</button>`).join("")}</div>
        <h3 class="fg-label">${escapeHtml(L("ចំនួនអ្នកប្រើ", "How many people"))}</h3>
        <div class="fg-seg" data-fg-many><button type="button" class="is-on" data-fg-uses="1">${escapeHtml(L("1 នាក់", "1 person"))}</button><button type="button" data-fg-uses="10">${escapeHtml(L("ច្រើននាក់ (Link គ្រួសារ)", "Several (family link)"))}</button></div>
        <p class="fg-approve" data-fg-approve hidden>🛡️ <span>${escapeHtml(L("Link គ្មានផុតកំណត់ ឬច្រើននាក់៖ អ្នកណាចុច ត្រូវរង់ចាំអ្នកយល់ព្រមសិន ទើបចូលបាន។", "No-expiry or several-people links: whoever opens it waits for your approval first."))}</span></p>
        <h3 class="fg-label">${escapeHtml(L("ឲ្យមើលអ្វីខ្លះ៖", "What they can see:"))}</h3>
        <div class="fg-chips" data-fg-chips>${chips()}</div>
        <button type="button" class="fg-primary" data-fg-make>${IC.userPlus()}<span>${escapeHtml(L("បង្កើត link អញ្ជើញ", "Create invite link"))}</span></button>
      </div>
      <div data-fg-step="share" hidden>${shareHtml()}</div>`, () => refresh(true));

    const sync = () => {
      node.querySelectorAll("[data-fg-card]").forEach(button => button.classList.toggle("is-on", button.dataset.fgCard === cardId));
      node.querySelectorAll("[data-fg-day]").forEach(button => button.classList.toggle("is-on", (button.dataset.fgDay === "" ? null : Number(button.dataset.fgDay)) === days));
      node.querySelectorAll("[data-fg-uses]").forEach(button => button.classList.toggle("is-on", (button.dataset.fgUses !== "1") === many));
      node.querySelector("[data-fg-approve]").hidden = !(days === null || many);
    };
    node.querySelector("[data-fg-who]").addEventListener("click", event => { const b = event.target.closest("[data-fg-card]"); if (!b) return; cardId = b.dataset.fgCard; if (cardId) many = false; sync(); });
    node.querySelector("[data-fg-days]").addEventListener("click", event => { const b = event.target.closest("[data-fg-day]"); if (!b) return; days = b.dataset.fgDay === "" ? null : Number(b.dataset.fgDay); sync(); });
    node.querySelector("[data-fg-many]").addEventListener("click", event => { const b = event.target.closest("[data-fg-uses]"); if (!b) return; many = b.dataset.fgUses !== "1"; if (many) cardId = ""; sync(); });
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
      const card = cards.find(person => person.id === cardId);
      const label = card?.name || (many ? L("Link គ្រួសារ", "Family link") : null);
      const { data, error } = await client().rpc("create_family_invite_v2", { p_family: state.family.id, p_role: role, p_permissions: perms, p_days: days, p_max_uses: many ? 10 : 1, p_label: label, p_card_id: card ? card.id : null });
      const made = Array.isArray(data) ? data[0] : data;
      if (error || !made?.token) { Toast.show(`⚠️ ${error?.message || "invite failed"}`); button.disabled = false; return; }
      node.querySelector("[data-fg-step=choose]").hidden = true;
      node.querySelector("[data-fg-step=share]").hidden = false;
      fillShare(node, { token: made.token, code: made.code, role, label, expires_at: days === null ? null : new Date(Date.now() + days * 864e5).toISOString(), max_uses: many ? 10 : 1, use_count: 0, needs_approval: days === null || many });
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
    const v2 = await client().rpc("family_invite_preview_v2", { p_key: token });
    if (!v2.error) { joinV2(token, Array.isArray(v2.data) ? v2.data[0] : v2.data); return; }
    if (!missingTable(v2.error)) { joinShown = false; Toast.show(`⚠️ ${v2.error.message}`); return; }
    if (!/^[0-9a-f]{32,}$/i.test(token)) { clearJoin(); joinShown = false; Toast.show(L("⚠️ លេខកូដមិនទាន់ប្រើបាន", "⚠️ Codes are not set up yet")); return; }
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

  /* ---------- joining v2: welcome → (wait for approval) → profile → what you can see → family ---------- */
  const buddy = mood => (typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy(mood) : "🐱");
  const steps = n => `<div class="fg-steps">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? "is-on" : ""}"></i>`).join("")}</div>`;
  function joinV2(key, info) {
    if (!info) { clearJoin(); joinShown = false; Toast.show(L("⚠️ Link ឬលេខកូដមិនត្រឹមត្រូវ", "⚠️ Invite link or code not valid")); return; }
    const inviter = info.inviter || L("គ្រួសារ", "The family");
    if (info.my_status === "member") { clearJoin(); joinShown = false; welcomeAfterJoin(info, true); return; }
    if (info.my_status === "pending") { joinShown = false; Toast.show(L(`⏳ កំពុងរង់ចាំ ${inviter} យល់ព្រម`, `⏳ Waiting for ${inviter} to approve`)); return; }
    if (info.my_status === "rejected") { clearJoin(); joinShown = false; Toast.show(L("សំណើចូលរួមត្រូវបានបដិសេធ", "Your request was declined")); return; }
    if (info.status !== "ok") {
      clearJoin(); joinShown = false;
      Toast.show(info.status === "used" ? L("⚠️ Link នេះបានប្រើរួចហើយ — សុំ link ថ្មី", "⚠️ This link was already used — ask for a new one")
        : info.status === "cancelled" ? L("⚠️ Link នេះត្រូវបានបោះបង់ — សុំ link ថ្មី", "⚠️ This link was cancelled — ask for a new one")
        : L("⚠️ Link ផុតកំណត់ — សុំ link ថ្មី", "⚠️ This link expired — ask for a new one"));
      return;
    }
    const node = sheet(`<div class="fg-welcome">${steps(1)}
        <span class="fg-welcome-nomi">${buddy("wink")}</span>
        <strong>${escapeHtml(L(`${inviter} បានអញ្ជើញអ្នក 💜`, `${inviter} invited you 💜`))}</strong>
        <p>${escapeHtml(L(`ចូលរួម «${familyName(info.family_name)}» ក្នុង MYLIFE · សមាជិក ${info.member_count} នាក់`, `Join “${familyName(info.family_name)}” on MYLIFE · ${info.member_count} members`))}</p>
        <p class="fg-welcome-role">${escapeHtml(L(`ជា ${ROLE[info.role][0]} · លុយ និងកំណត់ត្រាផ្ទាល់ខ្លួនរបស់អ្នក នៅតែជារបស់អ្នក`, `As ${ROLE[info.role][1]} · your own money and notes stay yours`))}</p>
        ${info.needs_approval ? `<p class="fg-approve">🛡️ <span>${escapeHtml(L(`${inviter} នឹងយល់ព្រមមុន ទើបអ្នកចូលបាន`, `${inviter} approves before you get in`))}</span></p>` : ""}
        <button type="button" class="fg-primary" data-fg-accept>${escapeHtml(info.needs_approval ? L("ផ្ញើសំណើចូលរួម", "Ask to join") : L("ចូលរួម", "Join"))}</button>
        <button type="button" class="fg-text-btn" data-fg-close>${escapeHtml(L("ពេលក្រោយ", "Not now"))}</button>
      </div>`, () => { joinShown = false; });
    node.querySelector("[data-fg-accept]").addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      const { data, error } = await client().rpc("accept_family_invite_v2", { p_key: key, p_display_name: appData.profile?.name || null });
      const result = Array.isArray(data) ? data[0] : data;
      if (error) { clearJoin(); closeSheet(); joinShown = false; Toast.show(`⚠️ ${error.message}`); return; }
      if (result?.status === "pending") {
        node.querySelector(".fg-panel").innerHTML = `<div class="fg-welcome">${steps(1)}<span class="fg-welcome-nomi">${buddy("love")}</span>
          <strong>${escapeHtml(L("បានផ្ញើសំណើហើយ ✓", "Request sent ✓"))}</strong>
          <p>${escapeHtml(L(`រង់ចាំ ${inviter} យល់ព្រម។ ពេលយល់ព្រមហើយ បើក app ម្តងទៀត ដើម្បីបន្ត។`, `Waiting for ${inviter}. Once approved, open the app again to continue.`))}</p>
          <button type="button" class="fg-primary" data-fg-close>${escapeHtml(L("យល់ហើយ", "OK"))}</button></div>`;
        window.familyAlert?.("join");
        return;
      }
      clearJoin();
      window.familyAlert?.("join");
      await load(true);
      welcomeAfterJoin(info, false, node);
    });
  }
  const familyName = raw => String(raw || "").trim() || L("គ្រួសារ", "Family");
  async function welcomeAfterJoin(info, approvedLater, node) {
    if (approvedLater) {
      if (typeof MemberProfile !== "undefined" && MemberProfile.hasMine && await MemberProfile.hasMine()) return; // already set up
      await load(true);
    }
    const panel = node ? node.querySelector(".fg-panel") : sheet("", () => { joinShown = false; refresh(true); }).querySelector(".fg-panel");
    // step 2: my profile
    panel.innerHTML = `<div class="fg-welcome">${steps(2)}
      ${approvedLater ? `<span class="fg-welcome-nomi">${buddy("love")}</span><strong>${escapeHtml(L("🎉 អ្នកបានចូលរួមហើយ!", "🎉 You're in!"))}</strong>` : ""}
      <strong>${escapeHtml(L("រៀបចំ Profile របស់អ្នក", "Set up your profile"))}</strong><p>${escapeHtml(L("គ្រួសារនឹងឃើញព័ត៌មាននេះ", "Your family will see this"))}</p>
      <div data-fg-setup></div></div>`;
    const done = () => {
      // step 3: what I can see
      const me = meRow();
      const perms = me?.permissions || {};
      panel.innerHTML = `<div class="fg-welcome">${steps(3)}
        <strong>${escapeHtml(L("អ្វីដែលអ្នកអាចមើល", "What you can see"))}</strong><p>${escapeHtml(L(`${info.inviter || "Admin"} បានកំណត់សិទ្ធិទាំងនេះ`, `${info.inviter || "The admin"} set these`))}</p>
        <div class="fg-can">${PERMS.map(perm => `<div class="${perms[perm.key] ? "" : "is-off"}">${perm.icon()}<span>${escapeHtml(L(perm.km, perm.en))}</span><b>${perms[perm.key] ? "✓" : escapeHtml(L("មិនបង្ហាញ", "Hidden"))}</b></div>`).join("")}</div>
        <p class="fg-welcome-role">🔒 ${escapeHtml(L("លុយ និងកំណត់ត្រាផ្ទាល់ខ្លួនរបស់អ្នក ជារបស់អ្នកម្នាក់ឯង", "Your own money and notes are only yours"))}</p>
        <button type="button" class="fg-primary" data-fg-go>${escapeHtml(L("ចូលទៅគ្រួសារ 🎉", "Go to the family 🎉"))}</button></div>`;
      panel.querySelector("[data-fg-go]").addEventListener("click", () => {
        closeSheet(); joinShown = false;
        location.hash = "#family";
        refresh(true);
        if (typeof DoneFeed !== "undefined") DoneFeed.celebrate({ mood: "love", title: L("🎉 ស្វាគមន៍មកកាន់គ្រួសារ!", "🎉 Welcome to the family!"), sub: familyName(info.family_name) });
      });
    };
    if (typeof MemberProfile !== "undefined" && MemberProfile.mountSetup) MemberProfile.mountSetup(panel.querySelector("[data-fg-setup]"), done);
    else done();
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

  return { mount, refresh, load, state, openInvite, openMember, tryJoin, PERMS, DEFAULT_PERMS, ROLE, isAdmin, profileOf, nameOf, isOwner };
})();
