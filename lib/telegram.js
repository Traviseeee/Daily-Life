// Telegram Bot API helpers for MYLIFE.
// - sends alerts straight to the bot with inline buttons (✅ done / ⏰ snooze),
//   falling back to the Make.com webhook when the bot is not configured or fails
// - stores button actions and snoozes in Redis
// - registers the bot webhook (only when the bot has no other webhook)
// Never log or return the bot token.

const crypto = require("crypto");
const { buildTelegramText } = require("./telegram-message");

const API = "https://api.telegram.org";
const APP_URL = process.env.APP_URL || "https://daily-life-2.vercel.app";
const ACTION_TTL_SECONDS = 45 * 24 * 60 * 60;
const SNOOZE_SET = "mylife:tg:snoozes";

function botConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

async function tgCall(method, body) {
  const response = await fetch(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${json.description || ""}`.trim());
  }
  return json.result;
}

// Secret Telegram echoes back in X-Telegram-Bot-Api-Secret-Token, derived so no new env var is needed.
function webhookSecret() {
  return crypto.createHash("sha256").update(`mylife-telegram:${process.env.CRON_SECRET || ""}`).digest("hex").slice(0, 48);
}

function webhookUrl() {
  return `${APP_URL}/api/telegram-webhook`;
}

function readJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

/* ---------------- buttons ---------------- */

const LABELS = {
  paid: "✅ បង់រួច · Paid",
  done: "✅ រួចរាល់ · Done",
  saved: "✅ សន្សំរួច · Saved",
  seen: "👍 បានឃើញ · Got it",
  nomore: "✅ គ្មានទៀតទេ",
  s10: "⏰ 10 នាទី",
  s60: "⏰ 1 ម៉ោង",
  tomorrow: "⏰ ស្អែក"
};

function verbsFor(item) {
  switch (item.kind) {
    case "bill":
    case "loan":
      return [["paid"], ["s60", "tomorrow"]];
    case "reminder":
      return [["done"], ["s10", "s60"]];
    case "savings-contribution":
      return [["saved"], ["tomorrow"]];
    case "calendar":
      return [["seen"], ["s10", "s60"]];
    case "digest":
    case "weekly":
    case "autopay":
      return [];
    case "evening":
      return [["nomore"]];
    default:
      return [["seen"]];
  }
}

function appLink(item) {
  return `${APP_URL}${String(item.url || "/").replace(/^\/?/, "/")}`;
}

const QUICK_ICON = { Food: "🍜", Transport: "🚗", Shopping: "🛍", Home: "🏠", Bills: "🧾", Family: "👨‍👩‍👧", Health: "💊", Education: "📚", Entertainment: "🎬", Other: "📦" };
const quickAmount = entry => (entry.currency === "KHR" ? `${Number(entry.amount).toLocaleString("en-US")}៛` : `$${Number(entry.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`);

async function buildKeyboard(item, userId, redis) {
  const rows = verbsFor(item);
  const keyboard = [];
  if (rows.length) {
    const token = crypto.randomBytes(6).toString("base64url");
    await redis.set(`mylife:tg:act:${token}`, JSON.stringify({ userId, item }), { ex: ACTION_TTL_SECONDS });
    // evening check: one-tap buttons for the expenses logged most often
    const quick = Array.isArray(item.quick) ? item.quick.slice(0, 4) : [];
    const quickButtons = quick.map((entry, index) => ({ text: `${QUICK_ICON[entry.category] || "📦"} ${String(entry.description).slice(0, 18)} ${quickAmount(entry)}`, callback_data: `qa${index}|${token}` }));
    for (let i = 0; i < quickButtons.length; i += 2) keyboard.push(quickButtons.slice(i, i + 2));
    rows.forEach(row => keyboard.push(row.map(verb => ({ text: LABELS[verb], callback_data: `${verb}|${token}` }))));
  }
  keyboard.push([{ text: "📱 បើក MYLIFE · Open", url: appLink(item) }]);
  return { inline_keyboard: keyboard };
}

async function saveAction(redis, data) {
  const token = crypto.randomBytes(6).toString("base64url");
  await redis.set(`mylife:tg:act:${token}`, JSON.stringify(data), { ex: ACTION_TTL_SECONDS });
  return token;
}

async function loadAction(redis, token) {
  return readJson(await redis.get(`mylife:tg:act:${token}`));
}

/* ---------------- sending ---------------- */

async function sendViaMake(item) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) return false;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: String(item.title || "MYLIFE alert"),
      message: String(item.body || "It is time."),
      date: String(item.date || ""),
      time: String(item.time || "09:00"),
      kind: String(item.kind || "reminder"),
      text: buildTelegramText(item)
    })
  });
  if (!response.ok) throw new Error(`Make webhook failed: ${response.status}`);
  return true;
}

// Uploads a file (report image, backup) — multipart, never logs the token.
async function tgUpload(method, field, buffer, filename, mime, extra = {}) {
  const form = new FormData();
  form.append("chat_id", String(process.env.TELEGRAM_CHAT_ID));
  Object.entries(extra).forEach(([key, value]) => form.append(key, typeof value === "string" ? value : JSON.stringify(value)));
  form.append(field, new Blob([buffer], { type: mime }), filename);
  const response = await fetch(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", body: form });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.ok) throw new Error(`Telegram ${method} failed: ${response.status} ${json.description || ""}`.trim());
  return json.result;
}

// Returns "sent" or "skipped"; throws when every route failed.
async function sendAlert(item, userId, redis) {
  // files (weekly/monthly report image, JSON backup) go only to the bot
  if (typeof item.makeFile === "function") {
    if (!botConfigured()) return "skipped";
    const file = await item.makeFile();
    if (!file) return "skipped";
    await tgUpload(file.method, file.field, file.buffer, file.filename, file.mime, {
      caption: file.caption || "",
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "📱 បើក MYLIFE · Open", url: appLink(item) }]] }
    });
    return "sent";
  }
  if (botConfigured()) {
    try {
      await tgCall("sendMessage", {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: buildTelegramText(item),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: await buildKeyboard(item, userId, redis)
      });
      return "sent";
    } catch (error) {
      console.error("MYLIFE Telegram bot send failed; trying Make.com.", error.message);
    }
  }
  return (await sendViaMake(item)) ? "sent" : "skipped";
}

/* ---------------- snoozes ---------------- */

async function addSnooze(redis, userId, item, fireAt) {
  const token = crypto.randomBytes(6).toString("base64url");
  await redis.set(`mylife:tg:snooze:${token}`, JSON.stringify({ userId, item, fireAt }), { ex: 3 * 24 * 60 * 60 });
  await redis.sadd(SNOOZE_SET, token);
  return token;
}

// Sends every snoozed alert whose time has come. srem is the claim, so two
// overlapping scheduler runs can never send the same snooze twice.
async function flushSnoozes(redis, now = Date.now()) {
  const results = { sent: 0, failed: 0 };
  const tokens = (await redis.smembers(SNOOZE_SET)) || [];
  for (const token of tokens) {
    const entry = readJson(await redis.get(`mylife:tg:snooze:${token}`));
    if (!entry) {
      await redis.srem(SNOOZE_SET, token);
      continue;
    }
    if (Number(entry.fireAt) > now) continue;
    const claimed = await redis.srem(SNOOZE_SET, token);
    if (!claimed) continue;
    try {
      await sendAlert({ ...entry.item, snoozed: true }, entry.userId, redis);
      results.sent += 1;
    } catch (error) {
      results.failed += 1;
      console.error("MYLIFE snoozed alert failed.", error.message);
    } finally {
      await redis.del(`mylife:tg:snooze:${token}`);
    }
  }
  return results;
}

/* ---------------- webhook registration ---------------- */

// Points the bot at /api/telegram-webhook so button presses reach the app.
// Never replaces a webhook that belongs to something else.
const BOT_COMMANDS = [
  { command: "menu", description: "☰ ម៉ឺនុយ · Menu" },
  { command: "today", description: "☀️ សង្ខេបថ្ងៃនេះ · Today" },
  { command: "bills", description: "🧾 វិក្កយបត្រត្រូវបង់ · Bills to pay" },
  { command: "evening", description: "🌙 កត់ចំណាយថ្ងៃនេះ · Log today" },
  { command: "report", description: "📊 របាយការណ៍ · Reports" },
  { command: "week", description: "📈 7 ថ្ងៃ + រូប · Last 7 days" },
  { command: "month", description: "🗓️ ខែនេះ · This month" },
  { command: "lastmonth", description: "📅 ខែមុន · Last month" },
  { command: "scan", description: "📷 ថតបង្កាន់ដៃ · Scan a receipt" },
  { command: "words", description: "🏷️ ពាក្យប្រភេទចំណាយ · Category words" },
  { command: "backup", description: "💾 Backup JSON" },
  { command: "help", description: "❓ ជំនួយ · Help" }
];

// The "/" menu in Telegram lists the bot commands.
async function ensureCommands(redis) {
  const key = "mylife:tg:commands:v2";
  if (await redis.get(key)) return;
  await tgCall("setMyCommands", { commands: BOT_COMMANDS });
  await redis.set(key, "1", { ex: 7 * 24 * 60 * 60 });
}

async function ensureWebhook(redis) {
  if (!botConfigured()) return "not_configured";
  try {
    await ensureCommands(redis);
  } catch (error) {
    console.warn("MYLIFE could not set bot commands.", error.message);
  }
  const url = webhookUrl();
  const doneKey = `mylife:tg:webhook:v2:${crypto.createHash("sha256").update(url + webhookSecret()).digest("hex").slice(0, 16)}`;
  if (await redis.get(doneKey)) return "ok";

  const info = await tgCall("getWebhookInfo", {});
  if (info.url && info.url !== url) {
    console.warn("MYLIFE: the Telegram bot already has a different webhook; buttons stay off.");
    await redis.set(doneKey, "other", { ex: 60 * 60 });
    return "other_webhook";
  }
  await tgCall("setWebhook", {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ["callback_query", "message"]
  });
  await redis.set(doneKey, "1", { ex: 24 * 60 * 60 });
  return "set";
}

module.exports = { BOT_COMMANDS,
  tgCall,
  tgUpload,
  botConfigured,
  saveAction,
  webhookSecret,
  sendAlert,
  loadAction,
  addSnooze,
  flushSnoozes,
  ensureWebhook,
  appLink,
  LABELS
};
