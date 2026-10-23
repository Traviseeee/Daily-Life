// Checks api/family-alert.js with fake Supabase, Redis and Telegram (no network).
// Usage: node tools/verify-family-alert.js
const Module = require("module");
const path = require("path");
const root = path.resolve(__dirname, "..");

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.TELEGRAM_CHAT_ID = "-100";
process.env.TELEGRAM_BOT_TOKEN = "bot";

const OWNER = "owner-1", MAK = "mak-2", STRANGER = "x-3", OTHERFAM = "y-4";
const users = {
  "tok-owner": { id: OWNER, email: "chinchetra107@gmail.com", identities: [{ provider: "email" }, { provider: "google" }] },
  "tok-mak": { id: MAK, email: "mak@gmail.com", identities: [{ provider: "google" }], user_metadata: { full_name: "Mak" } },
  "tok-stranger": { id: STRANGER, email: "spam@gmail.com", identities: [{ provider: "google" }], user_metadata: { full_name: "Spam" } },
  "tok-other": { id: OTHERFAM, email: "other@gmail.com", identities: [{ provider: "email" }] }
};
const tables = {
  family_members: [{ family_id: "F1", user_id: OWNER, role: "admin", display_name: "Tra" }, { family_id: "F1", user_id: MAK, role: "member", display_name: "ម៉ាក់" }, { family_id: "F2", user_id: OTHERFAM, role: "admin", display_name: "Other" }],
  families: [{ id: "F1", name: "គ្រួសារ Tra", owner_id: OWNER }, { id: "F2", name: "Other", owner_id: OTHERFAM }]
};
function query(table) {
  const f = [];
  const b = { select() { return b; }, eq(k, v) { f.push(r => r[k] === v); return b; }, limit() { return b; }, maybeSingle() { b.one = true; return b; },
    then(res) { const rows = (tables[table] || []).filter(r => f.every(x => x(r))); return Promise.resolve({ data: b.one ? rows[0] || null : rows, error: null }).then(res); } };
  return b;
}
const fakeSupabase = { createClient: () => ({ from: query, auth: { getUser: async token => (users[token] ? { data: { user: users[token] }, error: null } : { data: {}, error: { message: "bad" } }) } }) };
const store = new Map();
const fakeRedis = { set: async (k, v, o) => { if (o?.nx && store.has(k)) return null; store.set(k, v); return "OK"; }, get: async k => store.get(k) ?? null, incr: async k => { const n = Number(store.get(k) || 0) + 1; store.set(k, n); return n; }, expire: async () => 1 };
const sent = [];
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@supabase/supabase-js") return fakeSupabase;
  if (request.endsWith("/lib/push")) return { getRedis: () => fakeRedis };
  if (request.endsWith("/lib/telegram")) return { botConfigured: () => true, tgCall: async (method, body) => { sent.push(body.text); return {}; } };
  if (request.endsWith("/lib/owner")) return { resolveOwner: async () => OWNER };
  return load.apply(this, arguments);
};
const handler = require(path.join(root, "api/family-alert.js"));

async function call(token, event) {
  let status = 0, json = null;
  const res = { setHeader() {}, status(code) { status = code; return { json(body) { json = body; return body; } }; } };
  await handler({ method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: { event } }, res);
  return { status, json };
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log(`FAIL ${name} ${extra}`); } };

(async () => {
  let r = await call("", "login");
  check("no token → 401", r.status === 401);
  r = await call("tok-fake", "login");
  check("fake token → 401", r.status === 401);
  r = await call("tok-mak", "hack");
  check("unknown event → 400", r.status === 400);

  r = await call("tok-mak", "join");
  check("member joins → alert sent", r.json.sent === true && /សមាជិកថ្មី/.test(sent.at(-1)) && /ម៉ាក់/.test(sent.at(-1)) && /m…@gmail\.com/.test(sent.at(-1)), sent.at(-1));
  r = await call("tok-mak", "join");
  check("join alert only once", r.json.sent === false && sent.length === 1);
  r = await call("tok-mak", "login");
  check("member login → alert with name, role, Google", r.json.sent === true && /បានចូល MYLIFE/.test(sent.at(-1)) && /សមាជិក/.test(sent.at(-1)) && /Google/.test(sent.at(-1)), sent.at(-1));
  r = await call("tok-mak", "login");
  check("second login within 6h → no alert", r.json.sent === false && r.json.reason === "limited");
  check("email is masked, never in full", !sent.some(text => /mak@gmail\.com/.test(text)));

  r = await call("tok-owner", "login");
  check("owner's own login → no alert", r.json.sent === false && r.json.reason === "owner");
  r = await call("tok-other", "login");
  check("someone from another family → no alert", r.json.sent === false && r.json.reason === "not_member");
  r = await call("tok-mak", "blocked");
  check("a member can't send a 'blocked' alert", r.json.sent === false && r.json.reason === "is_member");

  r = await call("tok-stranger", "blocked");
  check("stranger turned away → warning alert", r.json.sent === true && /គណនីចម្លែក/.test(sent.at(-1)) && /sp…@gmail\.com/.test(sent.at(-1)), sent.at(-1));
  r = await call("tok-stranger", "blocked");
  check("stranger alert once a day", r.json.sent === false);
  r = await call("tok-stranger", "login");
  check("stranger can't send a member 'login' alert", r.json.sent === false && r.json.reason === "not_member");

  console.log(`\n${pass}/${pass + fail} family alert checks passed`);
  process.exit(fail ? 1 : 0);
})();
