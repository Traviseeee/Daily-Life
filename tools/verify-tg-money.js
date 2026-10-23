/**
 * Telegram money buttons: "✏️ Other amount" for bills / salary, and the savings
 * offer after salary is received. Same in-memory fakes as verify-bot-menu.js
 * (no network, no production data). Run with: node tools/verify-tg-money.js
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


const pressData = (data, extra = {}) => call(webhook, { method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret() }, body: { callback_query: { id: "q" + Math.random(), data, message: { message_id: 50, chat: { id: 100 }, ...extra } } } });
const month = today.slice(0, 7);

(async () => {
  const setup = () => {
    reset({ accounts: [OWNER], linked: OWNER });
    const p = db.get(OWNER).payload;
    p.reminders = []; p.bills = [{ id: "edc", name: "EDC", amount: 40000, currency: "KHR", due: today, frequency: "Monthly", status: "Upcoming" }];
    p.income = [{ id: "sal", name: "Salary", amount: 800, currency: "USD", frequency: "Monthly", recurring: true, nextPaymentDate: `${month}-01` }];
    p.savings = [{ id: "sv1", name: "Emergency", monthlyContribution: 100, currentAmount: 500, currency: "USD", contributions: [] }, { id: "sv2", name: "Trip", monthlyContribution: 50, currentAmount: 0, currency: "USD", contributions: [] }];
  };
  const p = () => db.get(OWNER).payload;

  /* bill: ✏️ other amount → type 52300 → one expense of 52,300 */
  setup();
  let token = await saveAction(redis, { userId: OWNER, item: { kind: "bill", id: "edc", title: "EDC", currency: "KHR", date: today, url: "/#money/bills" } });
  await pressData(`other|${token}`);
  check("other: asks to type the amount", sendTexts().some(m => /វាយចំនួនពិត/.test(m.text || "")));
  check("other: nothing saved yet", p().expenses.length === 0);
  await say("52,300");
  check("bill paid with the typed amount", p().expenses.length === 1 && p().expenses[0].amount === 52300, JSON.stringify(p().expenses));
  check("bill moved to next cycle", p().bills[0].due > today);
  await say("52300");
  check("typing again does not pay the bill twice", p().expenses.filter(e => e.billId === "edc").length === 1);

  /* salary: ✏️ other amount 760 → received 760 + savings offer */
  setup();
  token = await saveAction(redis, { userId: OWNER, item: { kind: "income", id: "sal-received", sourceId: "sal", month, title: "Salary", currency: "USD", date: today, url: "/#money/income" } });
  await pressData(`other|${token}`);
  await say("760");
  check("salary received 760", p().income[0].received?.[month]?.amount === 760 && p().income[0].received[month].via === "Telegram", JSON.stringify(p().income[0].received));
  const offer = sendTexts().find(m => /ដាក់សន្សំខែនេះ/.test(m.text || ""));
  check("savings offer sent after salary", Boolean(offer));
  const saveButtons = (offer?.reply_markup?.inline_keyboard || []).flat().filter(b => String(b.callback_data || "").startsWith("saved|"));
  check("offer has one button per open goal", saveButtons.length === 2, JSON.stringify(saveButtons));

  /* press Emergency twice → saved once; other button kept */
  telegram = [];
  await pressData(saveButtons[0].callback_data, { reply_markup: offer.reply_markup });
  await pressData(saveButtons[0].callback_data, { reply_markup: offer.reply_markup });
  const sv1 = p().savings[0];
  check("savings saved once", sv1.currentAmount === 600 && sv1.contributions.filter(c => c.month === month && c.paid).length === 1, JSON.stringify(sv1));
  const edit = telegram.find(t => t.method === "editMessageReplyMarkup");
  const kept = (edit?.body?.reply_markup?.inline_keyboard || []).flat();
  check("pressed goal ticked, other goal button kept", kept.some(b => /✅ Emergency/.test(b.text)) && kept.some(b => /Trip/.test(b.text) && String(b.callback_data).startsWith("saved|")), JSON.stringify(kept));

  /* ✅ received (as set) also offers savings; no offer when all saved */
  setup();
  p().savings.forEach(s => s.contributions.push({ month, amount: s.monthlyContribution, paid: true }));
  token = await saveAction(redis, { userId: OWNER, item: { kind: "income", id: "sal-received", sourceId: "sal", month, title: "Salary", currency: "USD", date: today } });
  await pressData(`received|${token}`);
  check("✅ received as set → 800", p().income[0].received?.[month]?.amount === 800);
  check("no savings offer when every goal is done", !sendTexts().some(m => /ដាក់សន្សំខែនេះ/.test(m.text || "")));

  /* other → then typing words cancels and is read as usual */
  setup();
  token = await saveAction(redis, { userId: OWNER, item: { kind: "bill", id: "edc", title: "EDC", currency: "KHR", date: today } });
  await pressData(`other|${token}`);
  await say("coffee 2");
  check("words after other: bill not paid", p().bills[0].due === today && !p().expenses.some(e => e.billId === "edc"));
  check("words after other: saved as a normal expense", p().expenses.some(e => /coffee/i.test(e.description || "")), JSON.stringify(p().expenses));

  /* forwarded ABA Pay request → one expense: name + amount only */
  setup();
  await say("https://pay.ababank.com/oRF8/ox6dh68b\n\nHi, Lyhuor HAM has requested you to pay $1.91 securely by tapping the ABA Pay link above.\n\nlink.payway.com.kh\nPayWay - Payment Link\nDirect Payment Link 2.0");
  check("ABA Pay: one expense", p().expenses.length === 1, JSON.stringify(p().expenses));
  check("ABA Pay: $1.91 USD", p().expenses[0]?.amount === 1.91 && p().expenses[0]?.currency === "USD");
  check("ABA Pay: name only", p().expenses[0]?.description === "Lyhuor HAM", p().expenses[0]?.description);
  check("ABA Pay: marked in notes", p().expenses[0]?.notes === "ABA Pay");

  /* buttons on alerts */
  const { verbsFor } = require(path.join(root, "lib/telegram.js"));
  if (typeof verbsFor === "function") {
    check("bill alert has ✏️ other", verbsFor({ kind: "bill" }).flat().includes("other"));
    check("loan alert has no ✏️ other", !verbsFor({ kind: "loan" }).flat().includes("other"));
  }

  console.log(`\n${pass}/${pass + fail} Telegram money checks passed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
