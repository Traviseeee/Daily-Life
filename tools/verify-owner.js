/**
 * Regression harness for QC finding B2: the server must only use the owner's
 * Telegram group for the owner account.
 *
 * Runs the real api/dispatch.js, api/report-send.js and api/telegram-webhook.js
 * against in-memory fakes of Supabase, Upstash Redis, web push and the Telegram
 * Bot API (no network, no production data). Two accounts exist: OWNER and a
 * STRANGER who signed up. Checks:
 *  - scheduled alerts, auto-pay and report sends reach Telegram for OWNER only,
 *  - the stranger still gets their own web push,
 *  - with no way to tell the owner (several accounts, nothing linked), nothing is posted,
 *  - a Telegram button can never switch or act for another account.
 *
 * Run with: node tools/verify-owner.js
 */

const Module = require("module");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const OWNER = "owner-0000";
const STRANGER = "stranger-9999";
const clone = value => JSON.parse(JSON.stringify(value));

/* ---------------- fakes ---------------- */

const tokens = { "token-owner": OWNER, "token-stranger": STRANGER };
let db = new Map();
let kv = {};
let sets = {};
let telegram = [];
let pushes = [];

class Query {
  constructor() { this.filters = []; this.op = "select"; this.lim = null; this.rng = null; this.patch = null; }
  select() { return this; }
  update(patch) { this.op = "update"; this.patch = patch; return this; }
  eq(key, value) { this.filters.push([key, value]); return this; }
  is(key, value) { this.filters.push([key, value]); return this; }
  order() { return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  rows() {
    let rows = [...db.entries()].map(([user_id, row]) => ({ user_id, ...row }));
    for (const [key, value] of this.filters) rows = rows.filter(row => row[key] === value);
    return rows;
  }
  async maybeSingle() { const rows = this.rows(); return { data: rows[0] ? clone(rows[0]) : null, error: null }; }
  async exec() {
    if (this.op === "update") {
      const rows = this.rows();
      rows.forEach(row => Object.assign(db.get(row.user_id), clone(this.patch)));
      return { data: rows.map(row => ({ user_id: row.user_id })), error: null };
    }
    let rows = this.rows();
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim) rows = rows.slice(0, this.lim);
    return { data: clone(rows), error: null };
  }
  then(resolve, reject) { return this.exec().then(resolve, reject); }
}
const supabase = {
  auth: { async getUser(token) { return tokens[token] ? { data: { user: { id: tokens[token] } }, error: null } : { data: { user: null }, error: { message: "bad token" } }; } },
  from() { return new Query(); }
};
const redis = {
  get: async key => kv[key] ?? null,
  set: async (key, value, options) => { if (options && options.nx && kv[key] !== undefined) return null; kv[key] = value; return "OK"; },
  del: async key => { delete kv[key]; return 1; },
  expire: async () => 1, lrem: async () => 0, lpush: async () => 1, ltrim: async () => "OK",
  smembers: async key => [...(sets[key] || [])],
  sadd: async (key, value) => { (sets[key] = sets[key] || new Set()).add(value); return 1; },
  srem: async (key, value) => (sets[key] && sets[key].delete(value) ? 1 : 0),
  hgetall: async () => ({})
};

const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === "@supabase/supabase-js") return { createClient: () => supabase };
  if (/lib[\\/]push$|\.\.\/lib\/push$/.test(request)) {
    return {
      getRedis: () => redis,
      getUserSubscriptions: async userId => [{ subscription: { endpoint: `https://push.example/${userId}` } }],
      sendToSubscription: async (userId, subscription, payload) => { pushes.push({ userId, title: payload.title }); return "sent"; },
      sendToUser: async userId => { pushes.push({ userId, title: "added" }); return { attempted: 1, sent: 1 }; },
      configureWebPush() {}, isValidTimeZone: () => true
    };
  }
  return originalLoad.call(this, request, parent, ...rest);
};
global.fetch = async (url, options = {}) => {
  const method = String(url).split("/").pop();
  let body = {};
  if (options.body instanceof FormData) body = { caption: options.body.get("caption"), file: (options.body.get("photo") || options.body.get("document"))?.name };
  else if (options.body) { try { body = JSON.parse(options.body); } catch (error) { body = { raw: String(options.body) }; } }
  telegram.push({ method, body });
  const result = method === "getWebhookInfo" ? { url: "https://daily-life-2.vercel.app/api/telegram-webhook" } : {};
  return { ok: true, json: async () => ({ ok: true, result }) };
};

Object.assign(process.env, {
  CRON_SECRET: "test-cron", SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service",
  TELEGRAM_BOT_TOKEN: "bot", TELEGRAM_CHAT_ID: "100", UPSTASH_REDIS_REST_URL: "r", UPSTASH_REDIS_REST_TOKEN: "r",
  VAPID_PUBLIC_KEY: "x", VAPID_PRIVATE_KEY: "y"
});
delete process.env.MAKE_WEBHOOK_URL;

const dispatch = require(path.join(root, "api/dispatch.js"));
const reportSend = require(path.join(root, "api/report-send.js"));
const webhook = require(path.join(root, "api/telegram-webhook.js"));
const { webhookSecret, saveAction } = require(path.join(root, "lib/telegram.js"));

/* ---------------- data ---------------- */

const zone = "Asia/Phnom_Penh";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date());
const justNow = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(Date.now() - 60000));
const localHour = Number(justNow.slice(0, 2));

const account = (who, secret) => ({
  payload: {
    profile: { name: who, currency: "USD", notify: { telegram: true, app: true } },
    reminders: [{ id: `rem-${who}`, title: `${secret} reminder`, date: today, time: justNow, done: false }],
    bills: [{ id: `bill-${who}`, name: `${secret} streaming`, amount: 9.99, currency: "USD", due: today, frequency: "Monthly", status: "Upcoming", autoPay: true }],
    expenses: [], income: [], calendarEvents: [], family: []
  },
  updated_at: "2026-10-21T00:00:00.000Z"
});

const reset = ({ accounts = [OWNER, STRANGER], envOwner = null, linked = null } = {}) => {
  db = new Map();
  if (accounts.includes(OWNER)) db.set(OWNER, account("Tra", "OWNER-SECRET"));
  if (accounts.includes(STRANGER)) db.set(STRANGER, account("Stranger", "STRANGER-SECRET"));
  kv = {}; sets = {}; telegram = []; pushes = [];
  if (linked) kv["mylife:tg:owner"] = linked;
  if (envOwner) process.env.MYLIFE_OWNER_USER_ID = envOwner; else delete process.env.MYLIFE_OWNER_USER_ID;
};

const call = (handler, req) => new Promise((resolve, reject) => {
  const res = { setHeader() {}, status(code) { return { json: body => resolve({ code, body }) }; } };
  Promise.resolve(handler(req, res)).catch(reject);
});
const runDispatch = () => call(dispatch, { method: "GET", headers: { authorization: "Bearer test-cron" } });
const telegramText = () => JSON.stringify(telegram);
const sentAlerts = () => telegram.filter(entry => ["sendMessage", "sendPhoto", "sendDocument"].includes(entry.method));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* ---------------- dispatch ---------------- */

const assertOwnerOnly = async label => {
  const { code, body } = await runDispatch();
  assert.strictEqual(code, 200, `${label}: dispatch ran`);
  assert.strictEqual(body.owner, "known", `${label}: owner resolved`);
  assert.ok(telegramText().includes("OWNER-SECRET reminder"), `${label}: the owner's reminder reaches Telegram`);
  assert.ok(!telegramText().includes("STRANGER-SECRET"), `${label}: nothing of the stranger reaches Telegram`);
  assert.strictEqual(body.otherAccounts, 1, `${label}: the stranger is counted as another account`);
  assert.ok(pushes.some(entry => entry.userId === STRANGER), `${label}: the stranger still gets their own web push`);
  assert.strictEqual(db.get(STRANGER).payload.bills[0].status, "Upcoming", `${label}: no auto-pay on the stranger's bill`);
  assert.strictEqual(db.get(STRANGER).payload.expenses.length, 0, `${label}: no auto-pay expense for the stranger`);
  if (localHour >= 7) assert.ok(db.get(OWNER).payload.expenses.some(e => e.billId === "bill-Tra"), `${label}: the owner's auto-pay still works`);
};

test("dispatch with MYLIFE_OWNER_USER_ID: Telegram + auto-pay for the owner only", async () => {
  reset({ envOwner: OWNER });
  await assertOwnerOnly("env owner");
});

test("dispatch with the owner linked in Redis (no env): owner only", async () => {
  reset({ linked: OWNER });
  await assertOwnerOnly("linked owner");
});

test("env owner wins over a wrong Redis link", async () => {
  reset({ envOwner: OWNER, linked: STRANGER });
  await assertOwnerOnly("env beats redis");
});

test("several accounts and no owner known: nothing is posted to Telegram (fail closed)", async () => {
  reset();
  const { code, body } = await runDispatch();
  assert.strictEqual(code, 200);
  assert.strictEqual(body.owner, "unknown");
  assert.strictEqual(sentAlerts().length, 0, `no Telegram alerts: ${telegramText().slice(0, 200)}`);
  assert.strictEqual(body.autopay.paid + body.autopay.skipped + body.autopay.duplicate + body.autopay.failed, 0, "no auto-pay runs");
  assert.ok(pushes.some(entry => entry.userId === OWNER) && pushes.some(entry => entry.userId === STRANGER), "web push still works for each account");
});

test("a single account is the owner automatically (existing behaviour)", async () => {
  reset({ accounts: [OWNER] });
  const { body } = await runDispatch();
  assert.strictEqual(body.owner, "known");
  assert.ok(telegramText().includes("OWNER-SECRET reminder"));
  assert.strictEqual(kv["mylife:tg:owner"], OWNER, "the owner is remembered");
});

test("a second run sends nothing again (dedupe unchanged)", async () => {
  reset({ envOwner: OWNER });
  await runDispatch();
  telegram = [];
  await runDispatch();
  assert.strictEqual(sentAlerts().length, 0);
});

/* ---------------- report-send ---------------- */

const reportReq = (token, body) => ({ method: "POST", headers: { authorization: `Bearer ${token}` }, body });
const tinyJpg = Buffer.from("fake-jpg").toString("base64");

test("report-send: the stranger gets 403 and nothing is posted (report and test message)", async () => {
  reset({ envOwner: OWNER });
  const report = await call(reportSend, reportReq("token-stranger", { month: "2026-10", jpg: tinyJpg, caption: "STRANGER-SECRET report" }));
  const probe = await call(reportSend, reportReq("token-stranger", { test: { kind: "bill", date: today } }));
  assert.strictEqual(report.code, 403);
  assert.strictEqual(probe.code, 403);
  assert.strictEqual(sentAlerts().length, 0);
});

test("report-send: the owner can still send", async () => {
  reset({ envOwner: OWNER });
  const report = await call(reportSend, reportReq("token-owner", { month: "2026-10", jpg: tinyJpg, caption: "OWNER report" }));
  assert.strictEqual(report.code, 200, JSON.stringify(report.body));
  assert.ok(sentAlerts().some(entry => entry.method === "sendPhoto"));
});

test("report-send with no owner known: refused", async () => {
  reset();
  const report = await call(reportSend, reportReq("token-owner", { month: "2026-10", jpg: tinyJpg }));
  assert.strictEqual(report.code, 403);
  assert.strictEqual(sentAlerts().length, 0);
});

/* ---------------- webhook buttons ---------------- */

const press = async (token, verb = "paid") => call(webhook, {
  method: "POST",
  headers: { "x-telegram-bot-api-secret-token": webhookSecret() },
  body: { callback_query: { id: "q1", data: `${verb}|${token}`, message: { message_id: 7, chat: { id: 100 } } } }
});

test("a button made for another account cannot act or replace the owner", async () => {
  reset({ linked: OWNER });
  const token = await saveAction(redis, { userId: STRANGER, item: { kind: "bill", id: "bill-Stranger", sourceId: "bill-Stranger", title: "x", url: "/#money/bills" } });
  await press(token);
  assert.strictEqual(kv["mylife:tg:owner"], OWNER, "the linked owner is unchanged");
  assert.strictEqual(db.get(STRANGER).payload.bills[0].status, "Upcoming", "the stranger's bill was not touched");
  assert.ok(telegram.some(entry => entry.method === "answerCallbackQuery" && /Not allowed/.test(entry.body.text || "")), "the press is refused");
});

test("the owner's own button still works", async () => {
  reset({ linked: OWNER });
  const token = await saveAction(redis, { userId: OWNER, item: { kind: "bill", id: "bill-Tra", sourceId: "bill-Tra", title: "x", url: "/#money/bills" } });
  await press(token);
  const bill = db.get(OWNER).payload.bills[0];
  assert.ok(bill.lastPaidAt, "the owner's bill is marked paid");
});

test("a chat message is saved to the owner's data, never the stranger's", async () => {
  reset({ envOwner: OWNER, linked: STRANGER });
  await call(webhook, { method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret() }, body: { update_id: 1, message: { message_id: 1, chat: { id: 100 }, from: { id: 1, is_bot: false, first_name: "Tra" }, text: "-3$ coffee" } } });
  assert.strictEqual(db.get(OWNER).payload.expenses.length, 1, "owner got the expense");
  assert.strictEqual(db.get(STRANGER).payload.expenses.length, 0, "stranger untouched");
});

/* ------------------------------------------------------------------------ */

(async () => {
  const quiet = console.warn;
  console.warn = () => {};
  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok   ${name}`);
    } catch (error) {
      failures += 1;
      console.log(`  FAIL ${name}\n       ${error.message}`);
    }
  }
  console.warn = quiet;
  console.log(`\n${tests.length - failures}/${tests.length} owner checks passed`);
  process.exit(failures ? 1 : 0);
})();
