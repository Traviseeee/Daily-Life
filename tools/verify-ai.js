/**
 * MYLIFE AI (Gemini): the shared js/ai-assist.js and the Telegram bot flow.
 * Gemini is faked (no network, no real key, no production data).
 * Run with: node tools/verify-ai.js
 */

const Module = require("module");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const OWNER = "owner-0000";
const STRANGER = "stranger-9999";
const clone = value => JSON.parse(JSON.stringify(value));
const answer = text => ({ candidates: [{ content: { parts: [{ text }] } }] });

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
let gemini = [];        // requests sent to Gemini
let geminiReply = null; // (model, body) => { status, json }
global.fetch = async (url, options = {}) => {
  if (String(url).includes("generativelanguage.googleapis.com")) {
    const model = decodeURIComponent(String(url).split("/models/")[1].split(":")[0]);
    const body = JSON.parse(options.body);
    gemini.push({ model, body, key: options.headers["x-goog-api-key"] });
    const out = geminiReply ? geminiReply(model, body) : { status: 200, json: answer("OK") };
    return { ok: out.status === 200, status: out.status, json: async () => out.json };
  }
  const method = String(url).split("/").pop();
  let body = {};
  if (options.body instanceof FormData) {
    const file = options.body.get("photo") || options.body.get("document");
    body = { caption: options.body.get("caption"), file: file?.name, content: file && /json/.test(file.type || "") ? await file.text() : "" };
  }
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


const AI = require(path.join(root, "lib/ai-assist.js"));
const KEY = "AIzaTEST_fake_key_1234567890";

(async () => {
  /* ---------- shared module ---------- */
  const settings = { apiKey: KEY, model: "", enabled: true };
  gemini = []; geminiReply = () => ({ status: 200, json: answer("Hello") });
  let r = await AI.callGemini(settings, { prompt: "hi" });
  check("callGemini returns the text and the model", r.text === "Hello" && r.model === AI.MODELS[0], JSON.stringify(r));
  check("the key goes in a header, not the URL", gemini[0].key === KEY && !JSON.stringify(gemini).includes(`key=${KEY}`));

  gemini = []; geminiReply = model => model === AI.MODELS[0] ? { status: 404, json: { error: { message: "models/x is not found" } } } : { status: 200, json: answer("from fallback") };
  r = await AI.callGemini(settings, { prompt: "hi" });
  check("unknown model → tries the next model", r.text === "from fallback" && r.model === AI.MODELS[1], JSON.stringify(r));

  gemini = []; geminiReply = (model, b) => b.generationConfig.thinkingConfig ? { status: 400, json: { error: { message: "thinking is not supported by this model" } } } : { status: 200, json: answer("no thinking") };
  r = await AI.callGemini({ ...settings, model: "gemini-2.0-flash" }, { prompt: "hi" });
  check("model without thinking → same model again without thinkingConfig", r.text === "no thinking" && r.model === "gemini-2.0-flash" && gemini.length === 2, JSON.stringify(gemini.map(g => g.model)));

  // a slow model (long thinking) is skipped: the next model answers
  gemini = []; geminiReply = null;
  const realFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).includes(AI.MODELS[0])) {
      return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    }
    return realFetch(url, options);
  };
  geminiReply = () => ({ status: 200, json: answer("fast answer") });
  const t0 = Date.now();
  r = await AI.callGemini({ ...settings, model: AI.MODELS[0] }, { prompt: "hi", timeoutMs: 300 });
  check("slow model → times out and the next model answers", r.text === "fast answer" && r.model !== AI.MODELS[0] && Date.now() - t0 < 3000, JSON.stringify(r));
  let slowCode = "";
  try { await AI.callGemini({ ...settings, model: AI.MODELS[0] }, { prompt: "hi", timeoutMs: 300, totalMs: 2600 }); } catch (e) { slowCode = e.code; }
  global.fetch = realFetch;
  r = await AI.callGemini(settings, { prompt: "hi" });
  check("the model that answered is tried first next time", gemini[gemini.length - 1].model === r.model && r.text === "fast answer");
  geminiReply = (model) => ({ status: 200, json: model === AI.MODELS[2] ? answer("third") : { candidates: [{ content: { parts: [{ text: "secret thoughts", thought: true }] } }] } });
  r = await AI.callGemini({ ...settings, model: AI.MODELS[0] }, { prompt: "hi" });
  check("only-thinking (empty) answer → next model; thoughts never shown", r.text === "third", JSON.stringify(r));

  // newer models reject thinkingConfig with a plain "invalid argument" → retried without it
  gemini = []; geminiReply = (m, b) => b.generationConfig.thinkingConfig ? { status: 400, json: { error: { message: "Request contains an invalid argument.", status: "INVALID_ARGUMENT" } } } : { status: 200, json: answer("works without thinking") };
  r = await AI.callGemini({ ...settings, model: AI.MODELS[0] }, { prompt: "hi" });
  check("plain 'invalid argument' → same model again without thinkingConfig", r.text === "works without thinking" && r.model === AI.MODELS[0] && gemini.length === 2, JSON.stringify(gemini.map(g => [g.model, !!g.body.generationConfig.thinkingConfig])));
  geminiReply = () => ({ status: 400, json: { error: { message: "Request contains an invalid argument." } } });
  let invalidCode = "";
  try { await AI.callGemini(settings, { prompt: "hi" }); } catch (e) { invalidCode = e.code + ":" + e.message; }
  check("every model says invalid argument → 'failed' with Google's words", /^failed:Request contains an invalid argument/.test(invalidCode), invalidCode);

  const codeOf = async reply => { geminiReply = () => reply; try { await AI.callGemini(settings, { prompt: "x" }); return "none"; } catch (e) { return e.code; } };
  check("429 → quota", await codeOf({ status: 429, json: { error: { message: "Resource exhausted" } } }) === "quota");
  check("400 API key not valid → bad_key", await codeOf({ status: 400, json: { error: { message: "API key not valid. Please pass a valid API key." } } }) === "bad_key");
  check("403 → bad_key", await codeOf({ status: 403, json: { error: { message: "denied" } } }) === "bad_key");
  check("empty answer → empty", await codeOf({ status: 200, json: { candidates: [] } }) === "empty");
  let noKey = "";
  try { await AI.callGemini({ apiKey: "" }, { prompt: "x" }); } catch (e) { noKey = e.code; }
  check("no key → no_key", noKey === "no_key");
  check("errors read as Khmer sentences", /API key/.test(AI.errorText({ code: "bad_key" })) && /ឥតគិតថ្លៃ/.test(AI.errorText({ code: "quota" })));

  // settings + secrets
  const pl = { profile: { name: "Tra", currency: "USD", aiSettings: { apiKey: KEY, model: "gemini-2.5-flash", telegram: false } }, expenses: [] };
  const st = AI.settingsOf(pl, {});
  check("settingsOf reads the saved key and switches", st.apiKey === KEY && st.enabled && st.telegram === false && st.model === "gemini-2.5-flash");
  check("settingsOf uses GEMINI_API_KEY when nothing is saved", AI.settingsOf({ profile: {} }, { GEMINI_API_KEY: "envkey" }).apiKey === "envkey");
  check("no key → not enabled", AI.settingsOf({ profile: {} }, {}).enabled === false);
  const stripped = AI.withoutSecrets(pl);
  check("withoutSecrets removes only the key", !JSON.stringify(stripped).includes(KEY) && stripped.profile.aiSettings.model === "gemini-2.5-flash" && pl.profile.aiSettings.apiKey === KEY);
  check("maskKey never shows the whole key", AI.maskKey(KEY) !== KEY && !AI.maskKey(KEY).includes("fake_key"));

  // context: totals, no private notes / phones / photos
  const ctxPayload = {
    profile: { name: "Tra", currency: "USD" },
    expenses: [
      { date: today, amount: 6000, currency: "KHR", category: "Food", description: "Coconut + Banana", notes: "SECRET-NOTE" },
      { date: today, amount: 5, currency: "USD", category: "Transport", description: "fuel" }
    ],
    family: [{ name: "Mom", birthday: "1970-" + today.slice(5), phone: "+855 12 345 678", photo: "data:image/png;base64,AAAA" }],
    bills: [{ name: "EDC", amount: 40, currency: "USD", due: today, status: "Upcoming" }]
  };
  const ctx = AI.buildContext(ctxPayload, today);
  check("context has this month's total ($1.46 + $5)", ctx.includes("$6.46"), ctx);
  check("context lists recent expenses and bills", ctx.includes("Coconut + Banana") && ctx.includes("EDC"));
  check("context leaves out notes, phone numbers and photos", !/SECRET-NOTE|345 678|base64/.test(ctx));
  check("context has the birthday", ctx.includes("Mom"));

  // parse cleaning
  const clean = AI.cleanParsed({ type: "expense", items: [{ amount: "6000", currency: "khr", category: "food", description: "ដូង + ចេក", date: "1999-01-01" }, { amount: -5 }] }, today, "USD");
  check("parse: amount, currency, category, bad date → today, bad item dropped", clean.type === "expense" && clean.items.length === 1 && clean.items[0].amount === 6000 && clean.items[0].currency === "KHR" && clean.items[0].category === "Food" && clean.items[0].date === today, JSON.stringify(clean));
  check("parse: expense with no valid item → other", AI.cleanParsed({ type: "expense", items: [] }, today, "USD").type === "other");
  check("parse: event time padded", AI.cleanParsed({ type: "event", event: { title: "Dentist", date: today, time: "9:30" } }, today, "USD").event.time === "09:30");
  check("parse: unknown category → Other", AI.cleanParsed({ type: "expense", items: [{ amount: 2, category: "Snacks" }] }, today, "USD").items[0].category === "Other");

  // question detection
  ["ខែនេះចាយអាហារប៉ុន្មាន?", "តើខែនេះចាយច្រើនជាងខែមុនទេ", "how much did I spend on food", "should I save more?"].forEach(q => check(`question: ${q}`, AI.looksLikeQuestion(q)));
  ["coffee 2", "ទិញដូងពីរផ្លែ ប្រាំមួយពាន់", "Grab 15k", "ស្អែក 9 ព្រឹក ជួបម៉ាក់"].forEach(q => check(`not a question: ${q}`, !AI.looksLikeQuestion(q)));
  check("toHtml escapes HTML and keeps **bold**", AI.toHtml("**$5** <script>") === "<b>$5</b> &lt;script&gt;");

  /* ---------- Telegram bot ---------- */
  const withAi = (extra = {}) => {
    reset({ accounts: [OWNER], linked: OWNER });
    db.get(OWNER).payload.profile.aiSettings = { apiKey: KEY, enabled: true, ...extra };
    db.get(OWNER).payload.expenses = [{ id: "e1", date: today, amount: 3, currency: "USD", category: "Food", description: "Lunch" }];
    gemini = [];
  };
  const lastText = () => (sendTexts().pop() || {}).text || "";

  // AI off: old behaviour (text with no day/time becomes an event)
  reset({ accounts: [OWNER], linked: OWNER }); gemini = [];
  delete process.env.GEMINI_API_KEY;
  await say("meeting with client");
  check("AI off: plain text is still an event, Gemini never called", (db.get(OWNER).payload.calendarEvents || []).length === 1 && gemini.length === 0);
  await say("ខែនេះចាយអាហារប៉ុន្មាន?");
  check("AI off: no Gemini call", gemini.length === 0);

  // question
  withAi(); geminiReply = () => ({ status: 200, json: answer("ខែនេះចាយអាហារ **$3.00** 🍜") });
  await say("ខែនេះចាយអាហារប៉ុន្មាន?");
  check("question → AI answer in Telegram", /<b>\$3\.00<\/b>/.test(lastText()) && gemini.length === 1, lastText());
  check("question is not saved as an event or expense", !(db.get(OWNER).payload.calendarEvents || []).length && db.get(OWNER).payload.expenses.length === 1);
  check("the data summary was sent with the question", gemini[0].body.contents[0].parts[0].text.includes("Lunch"));

  // "តើ…100$…?" must not be saved as $100
  withAi(); geminiReply = () => ({ status: 200, json: answer("មិនទាន់លើសទេ") });
  await say("តើខែនេះចាយលើស 100$ ទេ?");
  check("question with an amount is answered, not saved as an expense", db.get(OWNER).payload.expenses.length === 1 && /មិនទាន់លើស/.test(lastText()), lastText());

  // hard message → expense
  withAi(); geminiReply = (m, b) => b.generationConfig.responseMimeType === "application/json"
    ? { status: 200, json: answer(JSON.stringify({ type: "expense", items: [{ amount: 6000, currency: "KHR", category: "Food", description: "ដូង ២ ផ្លែ", date: today }] })) }
    : { status: 200, json: answer("?") };
  await say("ទិញដូងពីរផ្លែ ប្រាំមួយពាន់");
  const ex = db.get(OWNER).payload.expenses;
  check("hard text → AI saves the expense", ex.length === 2 && ex[1].amount === 6000 && ex[1].currency === "KHR" && ex[1].category === "Food" && ex[1].notes === "AI", JSON.stringify(ex[1]));
  check("hard text → reply says AI read it, with undo", /AI អានសារនេះ/.test(lastText()) && JSON.stringify(sendTexts().pop().reply_markup || {}).includes("undo"), lastText());
  check("no event made for it", !(db.get(OWNER).payload.calendarEvents || []).length);

  // hard message → event
  withAi(); geminiReply = () => ({ status: 200, json: answer(JSON.stringify({ type: "event", event: { title: "ទៅពេទ្យធ្មេញ", date: today, time: "15:00", category: "Health" } })) });
  await say("ចាំទៅពេទ្យធ្មេញម៉ោងបីរសៀលនេះ");
  const evs = db.get(OWNER).payload.calendarEvents || [];
  check("hard text → AI event with time", evs.length === 1 && evs[0].time === "15:00" && evs[0].category === "Health", JSON.stringify(evs));

  // other → friendly reply, nothing saved (no more junk events)
  withAi(); geminiReply = () => ({ status: 200, json: answer(JSON.stringify({ type: "other", reply: "សួស្តី! ចង់ឲ្យជួយអ្វី?" })) });
  await say("hello bot");
  check("chit-chat → reply only, nothing saved", !(db.get(OWNER).payload.calendarEvents || []).length && db.get(OWNER).payload.expenses.length === 1 && /សួស្តី/.test(lastText()), lastText());

  // normal lines never call Gemini
  withAi();
  await say("កាហ្វេ 2.5$");
  await say("ស្អែក 9 ព្រឹក ជួបម៉ាក់");
  check("normal expense and dated event: no Gemini call", gemini.length === 0 && db.get(OWNER).payload.expenses.length === 2 && (db.get(OWNER).payload.calendarEvents || []).length === 1);

  // AI error → falls back to the old way, never stuck
  withAi(); geminiReply = () => ({ status: 429, json: { error: { message: "quota" } } });
  await say("meeting with client");
  check("parse fails (quota) → old behaviour (event)", (db.get(OWNER).payload.calendarEvents || []).length === 1);
  withAi(); geminiReply = () => ({ status: 400, json: { error: { message: "API key not valid" } } });
  await say("ខែនេះចាយអ្វីច្រើនជាងគេ?");
  check("question with a bad key → clear Khmer message", /API key មិនត្រឹមត្រូវ/.test(lastText()), lastText());

  // Telegram switch off
  withAi({ telegram: false }); geminiReply = () => ({ status: 200, json: answer("x") });
  await say("ខែនេះចាយអាហារប៉ុន្មាន?");
  check("'use in Telegram' off → bot does not call Gemini", gemini.length === 0);

  // /advice, /ask, /ai, menu
  withAi(); geminiReply = () => ({ status: 200, json: answer("• ចាយអាហារតិច\n• សន្សំ 10%") });
  await say("/advice");
  check("/advice → advice reply", /ដំបូន្មានលុយ/.test(lastText()) && /សន្សំ 10%/.test(lastText()), lastText());
  await say("/ask តើគួរសន្សំប៉ុន្មាន");
  check("/ask → AI answer", gemini.length === 2);
  await say("/ask");
  check("/ask alone → how to use it", /\/ask/.test(lastText()) && gemini.length === 2);
  await say("/ai");
  check("/ai → status on", /AI បើក/.test(lastText()));
  reset({ accounts: [OWNER], linked: OWNER });
  await say("/ai");
  check("/ai with no key → how to add one", /aistudio/.test(lastText()));
  await say("/menu");
  const keys = ((sendTexts().pop() || {}).reply_markup?.inline_keyboard || []).flat().map(b => b.callback_data);
  check("menu has 🤖 advice and 💬 AI", keys.includes("m|advice") && keys.includes("m|ai"));
  withAi(); geminiReply = () => ({ status: 200, json: answer("ដំបូន្មាន") });
  await press("advice");
  check("menu 🤖 button → advice", /ដំបូន្មានលុយ/.test(lastText()));

  // /backup file never holds the key
  withAi();
  await say("/backup");
  const doc = telegram.filter(t => t.method === "sendDocument").pop();
  check("/backup is sent with the data", Boolean(doc) && doc.body.content.includes("Lunch"), JSON.stringify(doc && doc.body).slice(0, 200));
  check("/backup never contains the AI key", !JSON.stringify(telegram).includes(KEY));

  console.log(`\n${pass}/${pass + fail} AI checks passed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
