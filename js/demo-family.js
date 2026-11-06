/* MYLIFE family demo (6 Nov 2026) — LOCALHOST ONLY, never on the live site.
 * Open http://localhost:5500/?demo=family to click through invite links v2,
 * approvals, the join welcome and profiles with 3 pretend people (Tra, Lychee, Sophy)
 * without real accounts. A fake Supabase (kept in localStorage "mylife:demo-db")
 * replaces the real one; nothing is sent to Supabase. Each person's app data sits in
 * its fake "app_data" row. Runs on the localhost origin only (127.0.0.1 is sent to
 * localhost so your normal local test data there is never touched). Leave with "✕". */
(() => {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (!local) return;
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "off") { try { sessionStorage.removeItem("demo:on"); } catch (error) { /* ignore */ } return; }
  const on = params.get("demo") === "family" || sessionStorage.getItem("demo:on") === "family";
  if (!on) return;
  if (location.hostname === "127.0.0.1") { location.replace(`${location.protocol}//localhost:${location.port}${location.pathname}?demo=family${location.hash}`); return; }
  sessionStorage.setItem("demo:on", "family");

  const PEOPLE_KEYS_OK = key => ["tra", "lychee", "sophy"].includes(key);
  const PEOPLE = {
    tra: { id: "11111111-1111-1111-1111-111111111111", name: "Tra", email: "tra@demo" },
    lychee: { id: "22222222-2222-2222-2222-222222222222", name: "Lychee", email: "lychee@demo" },
    sophy: { id: "33333333-3333-3333-3333-333333333333", name: "Sophy", email: "sophy@demo" }
  };
  // ?who=lychee opens the demo as that person (ready-made links below)
  if (PEOPLE_KEYS_OK(params.get("who"))) sessionStorage.setItem("demo:who", params.get("who"));
  const who = PEOPLE[sessionStorage.getItem("demo:who")] ? sessionStorage.getItem("demo:who") : "tra";
  const me = PEOPLE[who];
  const DATA_KEY = "mylife:user-data:v1";
  const DB_KEY = "mylife:demo-db";

  /* ---------- each person's own app data ---------- */
  const today = new Date().toISOString().slice(0, 10);
  const seedData = key => {
    const base = { profile: { name: PEOPLE[key].name, language: "Khmer", currency: "USD", theme: "light", moneyAsk: false }, expenses: [], income: [], bills: [], loans: [], savings: [], goals: [], events: [], memories: [], family: [] };
    if (key === "tra") base.family = [
      { id: "card-tra", name: "Tra", relationship: "Me" },
      { id: "card-ly", name: "Lychee", relationship: "Girlfriend", birthday: "1999-09-12" },
      { id: "card-mom", name: "Mom", relationship: "Mother", birthday: "1970-03-02" }
    ];
    return base;
  };
  try {
    localStorage.setItem("mylife:login-session:v1", JSON.stringify({ email: me.email, expiresAt: Date.now() + 864e5 }));
    localStorage.setItem("mylife:nomi-intro-seen:v1", "1");
    localStorage.setItem("mylife:nomi-hi", "1");
  } catch (error) { /* storage blocked: demo still runs in memory */ }
  try { // give this person back the join code they typed earlier
    const mine = localStorage.getItem(`mylife:demo-join:${who}`);
    if (mine) { localStorage.setItem("mylife:family-join", mine); localStorage.removeItem(`mylife:demo-join:${who}`); }
  } catch (error) { /* ignore */ }
  // each person's app data lives in the fake "app_data" table, like the real cloud sync

  /* ---------- the fake database (shared by the 3 people) ---------- */
  const fresh = () => ({
    families: [{ id: "fam-demo", name: "គ្រួសារ Tra", owner_id: PEOPLE.tra.id, created_at: new Date().toISOString() }],
    family_members: [{ family_id: "fam-demo", user_id: PEOPLE.tra.id, role: "admin", permissions: {}, display_name: "Tra", joined_at: new Date().toISOString() }],
    family_invites: [], family_invite_uses: [],
    member_profiles: [{ user_id: PEOPLE.tra.id, display_name: "Tra", bio: "ស្រលាញ់គ្រួសារ 💜", hidden: { phone: true }, updated_at: new Date().toISOString() }],
    app_data: Object.keys(PEOPLE).map(key => ({ user_id: PEOPLE[key].id, payload: seedData(key), updated_at: new Date().toISOString() }))
  });
  let db;
  try { db = JSON.parse(localStorage.getItem(DB_KEY) || "null") || fresh(); } catch (error) { db = fresh(); }
  // two ready-made links, so the demo works straight from a URL:
  //   ?demo=family&who=lychee&join=LYCHEE  (for Lychee, 30 days, joins at once)
  //   ?demo=family&who=sophy&join=FAMILY   (family link, Tra approves)
  const READY = [
    { code: "LYCHEE", role: "member", permissions: { memories: true, calendar: true, shopping: true }, days: 30, max_uses: 1, label: "Lychee", member_card_id: "card-ly", needs_approval: false },
    { code: "FAMILY", role: "viewer", permissions: { memories: true, calendar: true }, days: null, max_uses: 10, label: "Link គ្រួសារ", member_card_id: null, needs_approval: true }
  ];
  READY.forEach(r => {
    if (db.family_invites.some(i => i.code === r.code)) return;
    db.family_invites.push({ token: `demo-${r.code.toLowerCase()}-${"0".repeat(40)}`, code: r.code, family_id: "fam-demo", role: r.role, permissions: r.permissions,
      created_by: "11111111-1111-1111-1111-111111111111", created_at: new Date().toISOString(), expires_at: r.days ? new Date(Date.now() + r.days * 864e5).toISOString() : null,
      max_uses: r.max_uses, use_count: 0, label: r.label, member_card_id: r.member_card_id, needs_approval: r.needs_approval, used_by: null, used_at: null, cancelled_at: null });
  });
  const keep = () => { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (error) { /* ignore */ } };
  keep();
  const ok = data => Promise.resolve({ data, error: null });
  const fail = message => Promise.resolve({ data: null, error: { message, code: "P0001" } });
  const now = () => new Date().toISOString();
  const isMember = fid => db.family_members.some(m => m.family_id === fid && m.user_id === me.id);
  const isAdmin = fid => db.family_members.some(m => m.family_id === fid && m.user_id === me.id && m.role === "admin");
  const PERM_KEYS = ["memories", "calendar", "shopping", "myEvents", "money", "bills", "savings"];
  const clean = p => Object.fromEntries(PERM_KEYS.filter(k => p && k in p).map(k => [k, Boolean(p[k])]));
  const find = key => db.family_invites.find(i => i.token === key || (String(key).length === 6 && i.code === String(key).toUpperCase()));
  const status = i => i.cancelled_at ? "cancelled" : i.expires_at && Date.parse(i.expires_at) < Date.now() ? "expired" : (i.max_uses <= 1 ? i.used_by : i.use_count >= i.max_uses) ? "used" : "ok";
  const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  // table reads follow the same rules as the real RLS
  const visible = {
    families: r => isMember(r.id),
    family_members: r => isMember(r.family_id),
    family_invites: r => isAdmin(r.family_id),
    family_invite_uses: r => r.user_id === me.id || db.family_invites.some(i => i.token === r.token && isAdmin(i.family_id)),
    member_profiles: r => r.user_id === me.id,
    app_data: r => r.user_id === me.id
  };
  function from(table) {
    const st = { filters: [], op: "select", payload: null, lim: null, single: false };
    const rows = () => (db[table] || []).filter(r => (!visible[table] || visible[table](r)) && st.filters.every(f => f(r)));
    const run = () => {
      if (!db[table]) return { data: st.single ? null : [], error: null };
      if (st.op === "update") {
        const hit = rows().filter(r => table !== "family_members" || isAdmin(r.family_id) || r.user_id === me.id);
        hit.forEach(r => Object.assign(r, st.payload)); keep();
        return { data: hit, error: null };
      }
      if (st.op === "delete") {
        const hit = rows().filter(r => table === "family_members" ? (isAdmin(r.family_id) || r.user_id === me.id) && r.user_id !== db.families[0].owner_id : isAdmin(r.family_id));
        db[table] = db[table].filter(r => !hit.includes(r)); keep();
        return { data: hit, error: null };
      }
      let data = rows();
      if (st.lim) data = data.slice(0, st.lim);
      return { data: st.single ? data[0] || null : JSON.parse(JSON.stringify(data)), error: null };
    };
    const api = new Proxy({}, {
      get(target, name) {
        if (name === "then") return (res, rej) => Promise.resolve(run()).then(res, rej);
        if (name === "eq") return (k, v) => { st.filters.push(r => r[k] === v); return api; };
        if (name === "in") return (k, vs) => { st.filters.push(r => vs.includes(r[k])); return api; };
        if (name === "limit") return n => { st.lim = n; return api; };
        if (name === "maybeSingle" || name === "single") return () => { st.single = true; return api; };
        if (name === "update") return p => { st.op = "update"; st.payload = p; return api; };
        if (name === "delete") return () => { st.op = "delete"; return api; };
        if (name === "upsert") return row => {
          if (table === "member_profiles" || table === "app_data") {
            if (row.user_id !== me.id) return fail("new row violates row-level security policy");
            const i = db[table].findIndex(r => r.user_id === row.user_id);
            if (i >= 0) db[table][i] = { ...db[table][i], ...row }; else db[table].push(row);
            keep();
          }
          return ok([row]);
        };
        if (name === "insert") return row => ok([row]);
        return () => api; // select, order, gte, … : ignored
      }
    });
    return api;
  }

  const rpc = async (name, a = {}) => {
    const fam = db.families[0];
    switch (name) {
      case "family_profiles": {
        if (!isMember(a.p_family)) return ok([]);
        return ok(db.family_members.filter(m => m.family_id === a.p_family).map(m => {
          const p = db.member_profiles.find(x => x.user_id === m.user_id) || {};
          const mine = m.user_id === me.id, h = p.hidden || {};
          const show = k => (mine || !h[k] ? p[k] ?? null : null);
          return { user_id: m.user_id, role: m.role, joined_at: m.joined_at, display_name: p.display_name || m.display_name, photo: p.photo || null, cover: p.cover || null,
            bio: show("bio"), birthday: show("birthday"), relation: show("relation"), phone: show("phone"), telegram: show("telegram"), hidden: mine ? h : {}, updated_at: p.updated_at || null };
        }));
      }
      case "create_family_invite_v2": {
        if (!isAdmin(a.p_family)) return fail("only an admin can invite");
        let code; do { code = Array.from({ length: 6 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join(""); } while (db.family_invites.some(i => i.code === code));
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
        const max = a.p_max_uses || 1;
        db.family_invites.push({ token, code, family_id: a.p_family, role: a.p_role, permissions: clean(a.p_permissions), created_by: me.id, created_at: now(),
          expires_at: a.p_days ? new Date(Date.now() + a.p_days * 864e5).toISOString() : null, max_uses: max, use_count: 0, label: a.p_label || null,
          member_card_id: a.p_card_id || null, needs_approval: !a.p_days || max > 1, used_by: null, used_at: null, cancelled_at: null });
        keep();
        return ok([{ token, code }]);
      }
      case "family_invite_preview_v2": {
        const i = find(a.p_key);
        if (!i) return ok([]);
        const use = db.family_invite_uses.find(u => u.token === i.token && u.user_id === me.id);
        const inviter = db.member_profiles.find(p => p.user_id === i.created_by)?.display_name || "Tra";
        return ok([{ token: i.token, family_name: fam.name, role: i.role, expires_at: i.expires_at, status: status(i), needs_approval: i.needs_approval, inviter,
          member_count: db.family_members.filter(m => m.family_id === i.family_id).length, my_status: isMember(i.family_id) ? "member" : use?.status || null }]);
      }
      case "accept_family_invite_v2": {
        const i = find(a.p_key);
        if (!i) return fail("invite not found");
        if (isMember(i.family_id)) return ok([{ family_id: i.family_id, status: "joined" }]);
        const use = db.family_invite_uses.find(u => u.token === i.token && u.user_id === me.id);
        if (use?.status === "pending") return ok([{ family_id: i.family_id, status: "pending" }]);
        if (use?.status === "rejected") return fail("request declined");
        if (status(i) !== "ok") return fail(`invite ${status(i)}`);
        if (i.needs_approval) { db.family_invite_uses.push({ token: i.token, user_id: me.id, status: "pending", display_name: a.p_display_name || me.name, created_at: now() }); keep(); return ok([{ family_id: i.family_id, status: "pending" }]); }
        db.family_members.push({ family_id: i.family_id, user_id: me.id, role: i.role, permissions: i.permissions, display_name: a.p_display_name || me.name, joined_at: now() });
        db.family_invite_uses.push({ token: i.token, user_id: me.id, status: "joined", display_name: a.p_display_name || me.name, created_at: now(), decided_at: now() });
        i.use_count += 1; if (i.max_uses <= 1) { i.used_by = me.id; i.used_at = now(); }
        keep();
        return ok([{ family_id: i.family_id, status: "joined" }]);
      }
      case "decide_family_join": {
        const i = db.family_invites.find(x => x.token === a.p_token);
        if (!i || !isAdmin(i.family_id)) return fail("only an admin can decide");
        const u = db.family_invite_uses.find(x => x.token === a.p_token && x.user_id === a.p_user && x.status === "pending");
        if (!u) return fail("no waiting request");
        u.decided_at = now();
        if (!a.p_approve) { u.status = "rejected"; keep(); return ok("rejected"); }
        if (i.cancelled_at || i.use_count >= i.max_uses) return fail("link is cancelled or full");
        if (!db.family_members.some(m => m.family_id === i.family_id && m.user_id === a.p_user)) db.family_members.push({ family_id: i.family_id, user_id: a.p_user, role: i.role, permissions: i.permissions, display_name: u.display_name, joined_at: now() });
        u.status = "joined"; i.use_count += 1; keep();
        return ok("joined");
      }
      case "cancel_family_invite": {
        const i = db.family_invites.find(x => x.token === a.p_token);
        if (!i || !isAdmin(i.family_id)) return fail("only an admin can cancel");
        i.cancelled_at = i.cancelled_at || now(); keep();
        return ok(null);
      }
      case "create_family": return ok(fam.id);
      default: return ok(null);
    }
  };

  const session = { user: { id: me.id, email: me.email, user_metadata: { full_name: me.name } }, access_token: "demo", expires_at: Math.floor(Date.now() / 1000) + 86400 };
  const client = {
    from, rpc,
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session.user }, error: null }),
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: { session }, error: null }), signUp: async () => ({ data: { session }, error: null })
    },
    storage: { from() { return { createSignedUrl: async () => ({ data: null, error: null }), createSignedUrls: async () => ({ data: [], error: null }), upload: async () => ({ data: null, error: null }), remove: async () => ({ data: null, error: null }) }; } },
    channel() { return { on() { return this; }, subscribe() { return this; }, unsubscribe() {} }; },
    removeChannel() {}, functions: { invoke: async () => ({ data: null, error: null }) }
  };
  Object.defineProperty(window, "supabaseClient", { get() { return client; }, set() {}, configurable: true });
  let cfg = {};
  Object.defineProperty(window, "MYLIFE_SUPABASE", { get() { return { ...cfg, enabled: true }; }, set(value) { cfg = value || {}; }, configurable: true });
  window.familyAlert = () => {}; // no Telegram in the demo

  /* ---------- the demo bar: who am I · switch person · type a code · reset · leave ---------- */
  function bar() {
    const el = document.createElement("div");
    el.className = "demo-bar";
    el.innerHTML = `<b>🧪</b>
      <span class="demo-who">${Object.entries(PEOPLE).map(([key, p]) => `<button type="button" class="${key === who ? "on" : ""}" data-demo-who="${key}">${p.name}</button>`).join("")}</span>
      <button type="button" data-demo-code title="វាយលេខកូដចូលរួម">🔑</button>
      <button type="button" data-demo-reset title="ចាប់ផ្តើម demo ម្តងទៀត">↺</button>
      <button type="button" data-demo-off title="ចេញពី demo">✕</button>
      <span class="demo-codebox" hidden><input maxlength="6" placeholder="CODE" autocapitalize="characters"><button type="button" data-demo-join>ចូល</button></span>`;
    document.body.appendChild(el);
    const css = document.createElement("style");
    css.textContent = `.demo-bar{position:fixed;left:8px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:99999;display:flex;flex-wrap:wrap;align-items:center;gap:4px;max-width:calc(100vw - 80px);padding:5px 6px;border-radius:16px;font:500 12px "Kantumruy Pro",Inter,sans-serif;color:#fff;background:rgba(20,18,50,.88);box-shadow:0 8px 24px rgba(0,0,0,.25)}
      .demo-bar button{padding:5px 9px;border:0;border-radius:10px;font:inherit;color:#fff;background:rgba(255,255,255,.14);cursor:pointer}.demo-bar .on{background:#8b7cf6}
      .demo-who{display:flex;gap:4px}.demo-codebox{display:flex;gap:4px}.demo-codebox[hidden]{display:none}.demo-codebox input{width:76px;padding:5px 8px;border:0;border-radius:10px;font:600 12px Inter,monospace;letter-spacing:.1em;text-transform:uppercase}`;
    document.head.appendChild(css);
    el.addEventListener("click", event => {
      const t = event.target;
      const go = (hash = "#family") => { location.href = `${location.pathname}?demo=family&t=${Date.now()}${hash}`; }; // new query = real reload
      if (t.dataset.demoWho && t.dataset.demoWho !== who) {
        sessionStorage.setItem("demo:who", t.dataset.demoWho);
        // a join code belongs to the person who typed it (real life: their own phone)
        try {
          const pending = sessionStorage.getItem("mylife:family-join") || localStorage.getItem("mylife:family-join");
          if (pending) localStorage.setItem(`mylife:demo-join:${who}`, pending);
          localStorage.removeItem("mylife:family-join"); sessionStorage.removeItem("mylife:family-join");
        } catch (error) { /* ignore */ }
        go();
      } else if (t.matches("[data-demo-code]")) { const box = el.querySelector(".demo-codebox"); box.hidden = !box.hidden; box.querySelector("input").focus(); }
      else if (t.matches("[data-demo-join]")) {
        const code = el.querySelector(".demo-codebox input").value.trim().toUpperCase();
        if (!/^[A-Z2-9]{6}$/.test(code)) return;
        localStorage.setItem("mylife:family-join", code); sessionStorage.setItem("mylife:family-join", code);
        go("#home");
      } else if (t.matches("[data-demo-reset]")) {
        if (t.dataset.armed !== "1") { t.dataset.armed = "1"; t.textContent = "↺ ម្តងទៀត?"; setTimeout(() => { t.dataset.armed = ""; t.textContent = "↺"; }, 3000); return; }
        Object.keys(localStorage).filter(k => k.startsWith("mylife:demo-") || k === DB_KEY).forEach(k => localStorage.removeItem(k));
        localStorage.removeItem(DATA_KEY); sessionStorage.setItem("demo:who", "tra");
        go();
      } else if (t.matches("[data-demo-off]")) {
        sessionStorage.removeItem("demo:on");
        location.href = `${location.pathname}?demo=off&t=${Date.now()}#home`;
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bar); else bar();
})();
