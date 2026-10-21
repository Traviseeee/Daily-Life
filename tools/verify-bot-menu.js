/**
 * Telegram bot menu: /bills, /scan, /words, the menu buttons and the "/" command
 * list. Runs the real api/telegram-webhook.js against in-memory fakes (no network,
 * no production data). Run with: node tools/verify-bot-menu.js
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

const sendTexts = () => telegram.filter(entry => entry.method === "sendMessage").map(entry => entry.body);
const say = text => call(webhook, { method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret() }, body: { update_id: Math.floor(Math.random() * 1e9), message: { message_id: 1, chat: { id: 100 }, from: { id: 1, is_bot: false, first_name: "Tra" }, text } } });
const press = key => call(webhook, { method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret() }, body: { callback_query: { id: "q1", data: `m|${key}`, message: { message_id: 7, chat: { id: 100 } } } } });
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log(`FAIL ${name} ${extra}`); } };

(async () => {
  const future = d => { const x = new Date(`${today}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  const setup = () => {
    reset({ accounts: [OWNER], linked: OWNER });
    db.get(OWNER).payload.bills = [
      { id: "b1", name: "Electricity (EDC)", amount: 40000, currency: "KHR", due: future(2), status: "Upcoming" },
      { id: "b2", name: "Rent", amount: 300, currency: "USD", due: future(-1), status: "Upcoming" },
      { id: "b3", name: "Old", amount: 5, currency: "USD", due: future(-30), status: "Paid" },
      { id: "b4", name: "Netflix", amount: 9.99, currency: "USD", due: future(25), status: "Upcoming", lastPaidAt: future(-3) }
    ];
  };

  setup();
  await say("/bills");
  let msg = sendTexts().pop() || {};
  check("/bills lists unpaid bills, overdue first", /Rent[\s\S]*Electricity/.test(msg.text || ""), msg.text);
  check("/bills hides Paid bills", !(msg.text || "").includes("Old"));
  check("/bills marks a bill paid in the last 20 days", /Netflix[^\n]*បានបង់ថ្មីៗ/.test(msg.text || ""));
  const buttons = (msg.reply_markup?.inline_keyboard || []).flat();
  check("/bills: a ✅ Paid button for each unpaid bill (not the recently paid one)", buttons.filter(b => String(b.callback_data || "").startsWith("paid|")).length === 2, JSON.stringify(buttons));
  check("/bills: overdue / soon labels", /ហួស 1 ថ្ងៃ/.test(msg.text) && /2 ថ្ងៃទៀត/.test(msg.text), msg.text);

  // pressing ✅ Paid from /bills pays the bill in the data
  const paidToken = buttons.find(b => /Rent/.test(b.text)).callback_data.split("|")[1];
  await call(webhook, { method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret() }, body: { callback_query: { id: "q2", data: `paid|${paidToken}`, message: { message_id: 8, chat: { id: 100 } } } } });
  const rent = db.get(OWNER).payload.bills.find(b => b.id === "b2");
  check("✅ Paid from /bills records the payment", Boolean(rent.lastPaidAt), JSON.stringify(rent));

  setup();
  await say("🧾 វិក្កយបត្រ");
  check("keyboard button 🧾 វិក្កយបត្រ = /bills", /Bills to pay/.test((sendTexts().pop() || {}).text || ""));
  setup();
  db.get(OWNER).payload.bills = [];
  await say("/bills");
  check("/bills with nothing to pay", /Nothing to pay/.test((sendTexts().pop() || {}).text || ""));

  setup();
  await say("/scan");
  check("/scan explains photo scanning", /Smart Scan/.test((sendTexts().pop() || {}).text || ""));
  await say("/words");
  const words = (sendTexts().pop() || {}).text || "";
  check("/words shows every category with sample words", ["អាហារ", "សាំង", "ខោអាវ", "វិក្កយបត្រ"].every(w => words.includes(w)), words.slice(0, 300));
  await say("/help");
  const help = sendTexts().pop() || {};
  check("/help mentions the new commands", ["/bills", "/scan", "/words"].every(w => (help.text || "").includes(w)));
  check("reply keyboard has 🧾 វិក្កយបត្រ", JSON.stringify(help.reply_markup || {}).includes("🧾 វិក្កយបត្រ"));

  setup();
  await say("/menu");
  const menu = (sendTexts().pop() || {}).reply_markup?.inline_keyboard || [];
  const keys = menu.flat().map(b => b.callback_data).filter(Boolean);
  check("menu has bills, scan, words, today, evening, week, month, lastmonth, backup, help",
    ["m|bills", "m|scan", "m|words", "m|today", "m|evening", "m|week", "m|month", "m|lastmonth", "m|backup", "m|help"].every(k => keys.includes(k)), keys.join(","));
  await press("bills");
  check("menu button 🧾 opens the bills list", /Bills to pay/.test((sendTexts().pop() || {}).text || ""));
  await press("words");
  check("menu button 🏷️ opens the words list", /Category words/.test((sendTexts().pop() || {}).text || ""));

  // money messages still work
  setup();
  await say("ខោអាវ 12$");
  const exp = db.get(OWNER).payload.expenses.pop();
  check("expense still logged with the new words", exp && exp.category === "Shopping" && exp.amount === 12, JSON.stringify(exp));

  // the "/" command list sent to Telegram
  const { BOT_COMMANDS } = (() => { try { return { BOT_COMMANDS: require(path.join(root, "lib/telegram.js")).BOT_COMMANDS }; } catch (e) { return {}; } })();
  const setCmd = telegram.find(entry => entry.method === "setMyCommands");
  const list = (setCmd?.body?.commands || BOT_COMMANDS || []).map(c => c.command);
  check("/ command list includes bills, scan, words", ["bills", "scan", "words"].every(c => list.includes(c)), list.join(","));

  console.log(`\n${pass}/${pass + fail} bot menu checks passed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
