/* Family sharing (11 Nov 2026) — makes the switches in "Role & access" real.
 *
 * Admin side:  a read-only COPY of each section some member may see is saved to
 *              Supabase (table family_shares, via family_share_put). The admin's own
 *              data is never changed by this.
 * Member side: Calendar shows the admin's events next to mine. On the Money / Savings /
 *              Bills / Goals pages the SAME screens can show the admin's numbers
 *              ("viewing Tra's"). While viewing, nothing is saved or synced, so the two
 *              people's data can never mix.
 * Needs supabase/migrations/20261111_family_shares.sql; without it nothing happens.
 */
const FamilyShare = (() => {
  const FINANCE = ["income", "expenses", "savings", "goals", "loans", "bills"];
  const SECTIONS = ["calendar", "myEvents", "money", "bills", "savings"];
  const MODE_KEY = "mylife:fs-mode";
  const MAX_BYTES = 900000;
  const L = (km, en) => ((typeof languageCode === "function" ? languageCode() : "km") === "km" ? km : en);
  const fg = () => (typeof FamilyGroup !== "undefined" ? FamilyGroup.state : null);
  const client = () => (typeof getSupabaseClient === "function" ? getSupabaseClient() : null);
  const ready = () => { const s = fg(); return Boolean(s && s.status === "ready" && s.family && s.me && client()); };
  const myRow = () => (fg()?.members || []).find(member => member.user_id === fg().me) || null;
  const amAdmin = () => myRow()?.role === "admin";

  const state = { rows: {}, owner: "", loadedAt: 0, missing: false, peeking: false };
  let stash = null;      // my own finance data while I look at the admin's
  let pubTimer = null;
  let loading = null;

  /* ---------- small helpers ---------- */
  // no photos / receipts / long blobs in a copy
  const slim = value => {
    if (Array.isArray(value)) return value.map(slim);
    if (!value || typeof value !== "object") return typeof value === "string" && (value.startsWith("data:") || value.length > 4000) ? "" : value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, slim(item)]));
  };
  const hash = text => { let h = 5381; for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0; return `${text.length}:${h}`; };
  const monthsAgo = count => { const d = new Date(); d.setMonth(d.getMonth() - count); return d.toISOString().slice(0, 10); };
  const pubKey = () => `mylife:fs-pub:${fg()?.family?.id || ""}`;
  const readPub = () => { try { return JSON.parse(localStorage.getItem(pubKey()) || "{}") || {}; } catch (error) { return {}; } };
  const writePub = value => { try { localStorage.setItem(pubKey(), JSON.stringify(value)); } catch (error) { /* private mode */ } };

  /* ---------- admin: publish the copies ---------- */
  function build(section) {
    const events = (appData.calendarEvents || []).filter(event => event && event.date);
    if (section === "calendar") return { events: events.filter(event => event.category === "Family") };
    if (section === "myEvents") return { events: events.filter(event => event.category !== "Family") };
    if (section === "bills") return { bills: appData.bills || [], loans: appData.loans || [] };
    if (section === "savings") return { savings: appData.savings || [], goals: appData.goals || [] };
    const profile = appData.profile || {};
    return { income: appData.income || [], expenses: appData.expenses || [], profile: { currency: profile.currency, categoryBudgets: profile.categoryBudgets, budgetAlerts: profile.budgetAlerts } };
  }
  function payload(section) {
    let data = slim(build(section));
    if (section !== "money") return data;
    for (const months of [12, 6, 3, 1]) { // keep the copy small: newest spending first
      const since = monthsAgo(months);
      data = { ...data, expenses: data.expenses.filter(item => !item.date || item.date >= since), months };
      if (JSON.stringify(data).length <= MAX_BYTES) break;
    }
    return data;
  }
  async function publish() {
    if (!ready() || !amAdmin() || state.missing || state.peeking) return;
    const others = fg().members.filter(member => member.user_id !== fg().me && member.role !== "admin");
    const done = readPub();
    let changed = false;
    for (const section of SECTIONS) {
      const wanted = others.some(member => member.permissions?.[section]);
      if (!wanted && !done[section]) continue;                 // nothing shared, nothing to clear
      const data = wanted ? payload(section) : {};
      const text = JSON.stringify(data);
      if (text.length > MAX_BYTES) continue;
      const mark = wanted ? hash(text) : "empty";
      if (done[section] === mark) continue;
      const { error } = await client().rpc("family_share_put", { p_family: fg().family.id, p_section: section, p_data: data });
      if (error) { if (/family_share_put|schema cache|does not exist|PGRST202|404/i.test(`${error.message} ${error.code}`)) state.missing = true; return; }
      if (wanted) done[section] = mark; else delete done[section];
      changed = true;
    }
    // joint savings accounts: the partner on the account sees it even with "Savings" off
    for (const member of others) {
      const card = (appData.family || []).find(person => person && person.userId === member.user_id);
      const joint = card ? (appData.savings || []).filter(saving => saving && saving.jointWith === card.id) : [];
      const section = `joint:${member.user_id}`;
      if (!joint.length && !done[section]) continue;
      const data = joint.length ? slim({ savings: joint }) : {};
      const mark = joint.length ? hash(JSON.stringify(data)) : "empty";
      if (done[section] === mark) continue;
      const { error } = await client().rpc("family_share_put", { p_family: fg().family.id, p_section: section, p_data: data });
      if (error) break; // older SQL without joint sections: the rest still works
      if (joint.length) done[section] = mark; else delete done[section];
      changed = true;
    }
    if (changed) writePub(done);
  }
  const publishSoon = (delay = 4000) => { clearTimeout(pubTimer); pubTimer = setTimeout(() => publish().catch(() => {}), delay); };

  /* ---------- member: read the copies ---------- */
  async function load(force) {
    if (!ready() || state.missing) return false;
    if (amAdmin()) { if (force || Date.now() - state.loadedAt > 15000) { state.loadedAt = Date.now(); publishSoon(1500); } return false; }
    if (!force && Date.now() - state.loadedAt < 60000) return false;
    if (loading) return loading;
    loading = (async () => {
      const { data, error } = await client().from("family_shares").select("owner_id, section, data, updated_at").eq("family_id", fg().family.id);
      loading = null;
      if (error) { state.missing = true; return false; }
      state.loadedAt = Date.now();
      const admins = fg().members.filter(member => member.role === "admin").map(member => member.user_id);
      const mine = (data || []).filter(row => row.owner_id !== fg().me && admins.includes(row.owner_id) && row.data && Object.keys(row.data).length);
      const owner = mine.find(row => row.owner_id === fg().family.owner_id)?.owner_id || mine[0]?.owner_id || "";
      const rows = {};
      mine.filter(row => row.owner_id === owner).forEach(row => { rows[row.section.startsWith("joint:") ? "joint" : row.section] = row; });
      const before = JSON.stringify([state.owner, Object.keys(state.rows).map(key => state.rows[key].updated_at)]);
      state.rows = rows; state.owner = owner;
      const after = JSON.stringify([owner, Object.keys(rows).map(key => rows[key].updated_at)]);
      if (before === after) return false;
      if (state.peeking) swapIn();            // newer numbers while I am looking
      if (typeof FamilyAccess !== "undefined" && FamilyAccess.refresh) FamilyAccess.refresh(); // a joint account opens the Savings tab
      if (typeof App !== "undefined" && App.render && !document.querySelector("#modalRoot.open, .mp-sheet, .fl-sheet-wrap, .nd-pop, .nms")) App.render();
      return true;
    })();
    return loading;
  }

  const ownerName = () => { const member = (fg()?.members || []).find(item => item.user_id === state.owner); return member ? (FamilyGroup.nameOf ? FamilyGroup.nameOf(member) : member.display_name) || L("គ្រួសារ", "Family") : L("គ្រួសារ", "Family"); };
  const has = section => Boolean(state.rows[section]);
  const canPeek = () => !amAdmin() && Boolean(state.owner) && (has("money") || has("bills") || has("savings") || has("joint"));
  const ownEmpty = () => { const src = stash || appData; return FINANCE.every(key => !(src[key] || []).length); };
  function mode() {
    let saved = "";
    try { saved = localStorage.getItem(MODE_KEY) || ""; } catch (error) { saved = ""; }
    return saved === "own" || saved === "peek" ? saved : (ownEmpty() ? "peek" : "own");
  }
  function setMode(value) { try { localStorage.setItem(MODE_KEY, value); } catch (error) { /* private mode */ } if (typeof App !== "undefined") App.render(); }

  /* ---------- member: calendar ---------- */
  // the admin's events, as read-only items for my calendar
  function events() {
    if (amAdmin() || !state.owner) return [];
    const name = ownerName();
    return ["calendar", "myEvents"].flatMap(section => state.rows[section]?.data?.events || [])
      .map(event => ({ ...event, id: `shared-${event.id}`, title: `${event.title || ""} · ${name}`, shared: true, sharedBy: name }));
  }

  /* ---------- member: the same money screens, with the admin's numbers ---------- */
  function swapIn() {
    if (!stash) { stash = { profile: appData.profile }; FINANCE.forEach(key => { stash[key] = appData[key]; }); }
    // "Savings" off but we hold a joint account together: only that account shows
    const money = state.rows.money?.data || {}, bills = state.rows.bills?.data || {}, savings = state.rows.savings?.data || state.rows.joint?.data || {};
    const copy = value => structuredClone(Array.isArray(value) ? value : []);
    appData.income = copy(money.income); appData.expenses = copy(money.expenses);
    appData.bills = copy(bills.bills); appData.loans = copy(bills.loans);
    appData.savings = copy(savings.savings); appData.goals = copy(savings.goals);
    const shared = money.profile || {};
    appData.profile = { ...stash.profile, ...Object.fromEntries(Object.entries(shared).filter(([, value]) => value !== undefined && value !== null)) };
    state.peeking = true;
    document.body.classList.add("fs-peek");
  }
  function swapOut() {
    if (stash) { FINANCE.forEach(key => { appData[key] = stash[key]; }); appData.profile = stash.profile; }
    stash = null; state.peeking = false;
    document.body.classList.remove("fs-peek");
  }
  const isFinance = route => route === "money" || route === "goals";
  // called at the start of every App.render
  function apply(route, param) {
    // Finance opens on the overview; when that is off for me but Savings is open, go there
    if (route === "money" && !param && typeof FamilyAccess !== "undefined" && !FamilyAccess.allows("money", "") && FamilyAccess.allows("money", "savings")) {
      history.replaceState(null, "", "#money/savings");
      if (typeof App !== "undefined") { App.param = "savings"; }
    }
    const want = isFinance(route) && ready() && canPeek() && mode() === "peek";
    if (want && !state.peeking) swapIn();
    else if (!want && state.peeking) swapOut();
    if (ready()) load(false);
    setTimeout(() => bar(route), 0);
  }
  function bar(route) {
    document.querySelector(".fs-bar")?.remove();
    if (!isFinance(route) || !ready() || !canPeek()) return;
    const host = document.getElementById("app");
    if (!host || host.querySelector(".fa-locked")) return;
    const name = typeof escapeHtml === "function" ? escapeHtml(ownerName()) : ownerName();
    const node = document.createElement("div");
    node.className = `fs-bar${state.peeking ? " is-peek" : ""}`;
    node.innerHTML = state.peeking
      ? `<span class="fs-bar-tx">👀 <b>${L(`កំពុងមើលរបស់ ${name}`, `Viewing ${name}'s`)}</b><small>${L("មើលបានប៉ុណ្ណោះ", "View only")}</small></span><button type="button" data-fs-mode="own">${L("របស់ខ្ញុំ", "Mine")}</button>`
      : `<span class="fs-bar-tx">👤 <b>${L("ទិន្នន័យរបស់ខ្ញុំ", "My own data")}</b></span><button type="button" data-fs-mode="peek">👀 ${L(`មើលរបស់ ${name}`, `View ${name}'s`)}</button>`;
    node.querySelector("[data-fs-mode]").addEventListener("click", event => setMode(event.currentTarget.dataset.fsMode));
    host.prepend(node);
  }

  /* ---------- guards: while viewing, nothing is saved or synced ---------- */
  function guard() {
    if (typeof Store === "undefined" || Store.fsGuarded) return;
    Store.fsGuarded = true;
    const save = Store.save, up = Store.syncToSupabase, down = Store.syncFromSupabase;
    Store.save = function guardedSave(options) {
      if (state.peeking) { if (typeof Toast !== "undefined") Toast.show(L(`👀 មើលបានប៉ុណ្ណោះ · នេះជាទិន្នន័យរបស់ ${ownerName()}`, `👀 View only · this is ${ownerName()}'s data`)); return false; }
      const ok = save.call(this, options);
      if (ok) publishSoon();
      return ok;
    };
    Store.syncToSupabase = function guardedUp(...args) { return state.peeking ? Promise.resolve(false) : up.apply(this, args); };
    Store.syncFromSupabase = function guardedDown(...args) { return state.peeking ? Promise.resolve(false) : down.apply(this, args); };
  }

  function init() {
    guard();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (state.peeking) load(true); else if (ready() && amAdmin()) publishSoon(1500); } });
    setTimeout(() => load(true), 2500);
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  }

  return { state, apply, events, load, publish, canPeek, has, ownerName, setMode, mode };
})();
if (typeof window !== "undefined") window.FamilyShare = FamilyShare;
