// Family permissions on this device (Invite feature fix).
// A person who joined someone else's family as Member / Viewer only gets the
// app sections the admin turned on for them. Admins (and people with no family)
// see everything. Supabase RLS already guards the shared rows; this hides the
// pages too, and re-checks the role when the app comes back to the front, so a
// change the admin makes applies within ~30 s instead of after a reload.
const FamilyAccess = (() => {
  const KEY = "mylife:family-access";
  // section → permission it needs
  const RULES = [
    { perm: "calendar", match: route => route === "calendar" },
    { perm: "bills", match: (route, param) => route === "money" && ["bills", "loans"].includes(param) },
    { perm: "savings", match: (route, param) => route === "goals" || (route === "money" && param === "savings") },
    { perm: "money", match: (route, param) => route === "summary" || route === "reports" || (route === "money" && !["bills", "loans", "savings"].includes(param)) }
  ];
  const km = () => (typeof languageCode === "function" ? languageCode() : "km") === "km";
  let access = read();
  let lastCheck = 0;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (error) { return null; }
  }
  function save(value) {
    try { value ? localStorage.setItem(KEY, JSON.stringify(value)) : localStorage.removeItem(KEY); } catch (error) { /* private mode */ }
  }
  const limited = () => Boolean(access && access.role && access.role !== "admin");
  const has = perm => !limited() || Boolean(access.perms?.[perm]);

  function allows(route, param = "") {
    if (!limited()) return true;
    const rule = RULES.find(entry => entry.match(route, param));
    return !rule || has(rule.perm);
  }
  function applyBody() {
    const body = document.body;
    if (!body) return;
    ["calendar", "money", "bills", "savings", "memories"].forEach(perm => body.classList.toggle(`fa-no-${perm}`, !has(perm)));
    body.classList.toggle("fa-viewer", limited() && access.role === "viewer");
  }
  function lockedHtml(route) {
    const role = access?.role === "viewer" ? (km() ? "អ្នកមើល" : "Viewer") : (km() ? "សមាជិក" : "Member");
    return `<section class="page fa-locked"><article class="fa-card">
      <span class="fa-icon" aria-hidden="true">🔒</span>
      <h1>${km() ? "ផ្នែកនេះត្រូវបានបិទ" : "This section is turned off"}</h1>
      <p>${km() ? `អ្នកជា <b>${role}</b> ក្នុងគ្រួសារ «${escapeHtml(access?.family || "")}»។ អ្នកគ្រប់គ្រងមិនទាន់បើកសិទ្ធិផ្នែកនេះឱ្យអ្នកទេ។` : `You're a <b>${role}</b> in “${escapeHtml(access?.family || "")}”. The admin hasn't turned this section on for you.`}</p>
      <a class="fa-btn" href="#home">${km() ? "ត្រឡប់ទៅ Home" : "Back to Home"}</a>
    </article></section>`;
  }
  // reads my role + permissions; returns true when something changed
  async function check(force = false) {
    if (typeof FamilyGroup === "undefined" || !navigator.onLine) return false;
    if (!force && Date.now() - lastCheck < 30000) return false;
    lastCheck = Date.now();
    try {
      const state = await FamilyGroup.load(true);
      if (!["ready", "none", "signedout"].includes(state.status)) return false;
      const me = (state.members || []).find(member => member.user_id === state.me);
      const next = state.status === "ready" && me && state.family?.owner_id !== state.me
        ? { role: me.role, perms: me.permissions || {}, family: state.family?.name || "" }
        : null;
      const changed = JSON.stringify(next) !== JSON.stringify(access);
      access = next;
      save(next);
      applyBody();
      if (changed) {
        if (typeof FamilyPosts !== "undefined") FamilyPosts.load(true).catch(() => null);
        if (typeof Toast !== "undefined" && lastCheck && document.visibilityState === "visible") {
          Toast.show(km() ? "សិទ្ធិគ្រួសាររបស់អ្នកត្រូវបានធ្វើបច្ចុប្បន្នភាព" : "Your family permissions were updated", "success");
        }
        if (typeof App !== "undefined") App.render();
      }
      return changed;
    } catch (error) { return false; }
  }
  function init() {
    applyBody();
    setTimeout(() => check(true), 1500);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    window.addEventListener("focus", () => check());
    setInterval(() => { if (document.visibilityState === "visible") check(); }, 60000);
  }
  return { init, allows, has, check, lockedHtml, limited, get state() { return access; } };
})();
document.addEventListener("DOMContentLoaded", () => FamilyAccess.init());
