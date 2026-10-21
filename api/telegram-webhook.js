// Receives Telegram button presses (callback queries) for MYLIFE alerts.
// ✅ Paid / Done / Saved update the user's app data, ⏰ buttons snooze,
// 👍 just acknowledges. Only the configured chat can use the buttons.

const { createClient } = require("@supabase/supabase-js");
const { getRedis, sendToUser } = require("../lib/push");
const crypto = require("crypto");
const { tgCall, tgUpload, sendAlert, webhookSecret, loadAction, saveAction, addSnooze, appLink } = require("../lib/telegram");
const { buildTelegramText, buildWeeklyText, dateLabels, timeLabels, escapeHtml } = require("../lib/telegram-message");
const { parseEvent, parseMoney } = require("../lib/smart-parse");
const { monthSpending, formatMoney, convert, CATEGORY_KM, weeklyReport } = require("../lib/money-report");
const { digestItem, eveningItem } = require("./dispatch");
const { payBill } = require("../lib/bill-pay");
const { updatePayloadSafe } = require("../lib/payload-store");
const { detectUtility, findUtilityBill, PROVIDERS } = require("../lib/utility-bills");
const NotifyPrefs = require("../lib/notify-prefs");

const APP_TIME_ZONE = "Asia/Phnom_Penh";

function zonedToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function zonedClock(ms) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
}

// Applies ✅ to the payload. Returns "updated", "already" or "missing".
function applyDone(payload, item) {
  const today = zonedToday();
  const id = item.sourceId || item.id;
  if (item.kind === "bill") {
    const bill = (payload.bills || []).find(entry => entry.id === id);
    if (!bill) return "missing";
    return payBill(payload, bill, today, "Telegram");
  }
  if (item.kind === "loan") {
    const loan = (payload.loans || []).find(entry => entry.id === id);
    if (!loan) return "missing";
    loan.payments = Array.isArray(loan.payments) ? loan.payments : [];
    if (loan.payments.some(payment => payment.date === item.date)) return "already";
    loan.payments.unshift({ amount: Number(loan.monthlyPayment || 0), date: item.date, scheduled: true });
    loan.updatedAt = new Date().toISOString();
    return "updated";
  }
  if (item.kind === "reminder") {
    const reminder = (payload.reminders || []).find(entry => entry.id === id);
    if (!reminder) return "missing";
    if (reminder.done) return "already";
    reminder.done = true;
    reminder.updatedAt = new Date().toISOString();
    return "updated";
  }
  if (item.kind === "undo") {
    const targets = Array.isArray(item.entries) && item.entries.length ? item.entries : [{ collection: item.collection, id: item.id }];
    let removed = 0;
    targets.forEach(({ collection, id: targetId }) => {
      const list = payload[collection];
      if (!Array.isArray(list) || !list.some(entry => entry.id === targetId)) return;
      payload[collection] = list.filter(entry => entry.id !== targetId);
      payload.deletions = payload.deletions && typeof payload.deletions === "object" ? payload.deletions : {};
      payload.deletions[collection] = payload.deletions[collection] || {};
      payload.deletions[collection][targetId] = new Date().toISOString();
      removed += 1;
    });
    return removed ? "updated" : "already";
  }
  if (item.kind === "savings-contribution") {
    const saving = (payload.savings || []).find(entry => entry.id === id);
    if (!saving) return "missing";
    const month = item.month || today.slice(0, 7);
    const amount = Number(saving.monthlyContribution || 0);
    const contributions = Array.isArray(saving.contributions) ? saving.contributions.slice() : [];
    const index = contributions.findIndex(entry => entry && entry.month === month);
    if (index >= 0 && contributions[index].paid) return "already";
    if (index >= 0) contributions[index] = { ...contributions[index], month, amount, paid: true };
    else contributions.unshift({ month, amount, paid: true });
    saving.contributions = contributions;
    saving.currentAmount = Number(saving.currentAmount || 0) + amount;
    saving.updatedAt = new Date().toISOString();
    return "updated";
  }
  return "missing";
}

function serviceClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function readPayload(userId) {
  const { data, error } = await serviceClient().from("app_data").select("payload").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return typeof data.payload === "string" ? JSON.parse(data.payload || "{}") : data.payload || {};
}

// Which MYLIFE account this Telegram chat belongs to: remembered from button
// presses, or the only account when there is just one.
async function ownerUserId(redis) {
  const known = await redis.get("mylife:tg:owner");
  if (known) return String(known);
  const { data, error } = await serviceClient().from("app_data").select("user_id").limit(2);
  if (error) throw error;
  if ((data || []).length === 1) {
    await redis.set("mylife:tg:owner", data[0].user_id);
    return data[0].user_id;
  }
  return null;
}

function recordId(collection) {
  return `${collection}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

async function updatePayload(userId, mutate) {
  return updatePayloadSafe(serviceClient(), userId, mutate);
}

const DONE_TEXT = {
  undo: "↩️ បានលុបវិញ · Undone",
  paid: "✅ បានបង់ · Paid",
  done: "✅ រួចរាល់ · Done",
  saved: "✅ បានសន្សំ · Saved",
  seen: "👍 បានឃើញ · Seen"
};

const HELP_TEXT = [
  "🤖 <b>MYLIFE Bot</b>",
  "",
  "📅 <b>បន្ថែមព្រឹត្តិការណ៍ · Add an event</b>",
  "• <code>ស្អែក 9 ព្រឹក ជួបម៉ាក់</code>",
  "• <code>Dentist friday 3:30pm</code>",
  "• <code>25/10 ថ្ងៃកំណើតបង</code>",
  "",
  "💸 <b>កត់ចំណាយ · Log an expense</b>",
  "• <code>-20$ cloths</code> · <code>lunch $4.5</code>",
  "• <code>ឡាន 5000៛</code> · <code>15k សាំង</code>",
  "• <code>-5$ coffee ម្សិលមិញ</code> — ថ្ងៃមុន · yesterday",
  "• ច្រើនបន្ទាត់ = ច្រើនចំណាយ · one per line",
  "",
  "💰 <b>កត់ចំណូល · Log income</b>",
  "• <code>+100$ salary</code> · <code>+50$ client logo</code>",
  "",
  "☀️ <code>/today</code> — សង្ខេបថ្ងៃនេះ · Today's summary",
  "🌙 <code>/evening</code> — សួរពេលយប់ (ប៊ូតុងចំណាយញឹកញាប់)",
  "📈 <code>/week</code> — របាយការណ៍ 7 ថ្ងៃ + រូប",
  "🗓️ <code>/month</code> — រូបរបាយការណ៍ខែនេះ",
  "💾 <code>/backup</code> — ឯកសារ backup JSON",
  "",
  "💧⚡ <b>វិក្កយបត្រទឹក/ភ្លើង · Water & power bills</b>",
  "• សារពី PPWSA / EDC ក្នុងក្រុមនេះ (ឬ forward មក) → វិក្កយបត្រថ្មី = រំលឹក, បង្កាន់ដៃ = កត់ថាបានបង់",
  "☰ <code>/menu</code> — ម៉ឺនុយប៊ូតុង"
].join("\n");

async function reply(message, text, keyboard) {
  return tgCall("sendMessage", {
    chat_id: message.chat.id,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_to_message_id: message.message_id,
    ...(keyboard ? { reply_markup: keyboard } : {})
  });
}

async function undoKeyboard(redis, userId, collection, id, url) {
  const token = await saveAction(redis, { userId, item: { kind: "undo", collection, id, url } });
  return { inline_keyboard: [[{ text: "↩️ លុបវិញ · Undo", callback_data: `undo|${token}` }, { text: "📱 Open", url: appLink({ url }) }]] };
}

// Phone pop-up (web push) so the app also says "added" — best effort, never blocks the bot.
// kind decides which tool switch in the notification center applies.
async function pushAdded(userId, title, body, url, kind = "") {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  try {
    const payload = await readPayload(userId);
    if (payload && !NotifyPrefs.allows(payload.profile, kind, "app")) return;
    await sendToUser(userId, { title, body, url });
  } catch (error) {
    console.warn("MYLIFE Telegram pop-up not sent.", error.message);
  }
}

/* ---------------- money from chat ---------------- */

const EXPENSE_CATS = ["Food", "Transport", "Shopping", "Home", "Bills", "Family", "Health", "Education", "Entertainment", "Other"];
const CAT_ICON = { Food: "🍜", Transport: "🚗", Shopping: "🛍", Home: "🏠", Bills: "🧾", Family: "👨‍👩‍👧", Health: "💊", Education: "📚", Entertainment: "🎬", Other: "📦", Salary: "💼", Bonus: "🎁", Freelance: "🎨", Business: "🏪" };
const INCOME_KM = { Salary: "ប្រាក់ខែ", Bonus: "ប្រាក់រង្វាន់", Freelance: "ការងារក្រៅ", Business: "អាជីវកម្ម", Other: "ផ្សេងៗ" };

function catLabel(entry) {
  const km = entry.collection === "income" ? INCOME_KM[entry.category] || entry.category : CATEGORY_KM[entry.category] || entry.category;
  return `${CAT_ICON[entry.category] || "📦"} ${km}`;
}

function entryRecord(entry, today, fallbackCurrency) {
  const now = new Date().toISOString();
  const date = entry.date || today;
  if (entry.type === "income") {
    const id = recordId("income");
    return { collection: "income", record: { id, createdAt: now, updatedAt: now, name: entry.description || INCOME_KM[entry.category] || "Income", amount: entry.amount, currency: entry.currency || fallbackCurrency, category: entry.category || "Other", frequency: "Once", recurring: false, nextPaymentDate: date, notes: "Telegram", source: "telegram" } };
  }
  const id = recordId("expenses");
  return { collection: "expenses", record: { id, createdAt: now, updatedAt: now, description: entry.description || CATEGORY_KM[entry.category] || entry.category, amount: entry.amount, currency: entry.currency || fallbackCurrency, category: entry.category || "Other", date, method: "Telegram", notes: "", source: "telegram" } };
}

const fmt = (amount, currency) => {
  const value = Number(amount || 0);
  if (currency === "KHR") return formatMoney(value, "KHR");
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
};
const bar = percent => {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  return "▰".repeat(filled) + "▱".repeat(10 - filled);
};
function dayWord(date, today) {
  if (!date || date === today) return "ថ្ងៃនេះ";
  if (date === addDaysIso(today, -1)) return "ម្សិលមិញ";
  return dateLabels(date).km;
}
function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Reply text for saved money lines, read from the saved payload so totals are exact.
function moneyReplyText(payload, saved, today, skipped = []) {
  const currency = payload.profile?.currency || "USD";
  const lines = [];
  const nameOf = record => {
    const name = String(record.description || record.name || "").trim();
    const cat = String(record.category || "");
    return name && ![cat.toLowerCase(), String(CATEGORY_KM[cat] || "").toLowerCase(), String(INCOME_KM[cat] || "").toLowerCase()].includes(name.toLowerCase()) ? name : "";
  };

  if (saved.length === 1) {
    const { collection, record } = saved[0];
    const income = collection === "income";
    const name = nameOf(record);
    lines.push(income ? "✅ <b>បានកត់ចំណូល</b>" : "✅ <b>បានកត់ចំណាយ</b>", "");
    lines.push(`${income ? "💰" : "💸"} <b>${income ? "+" : "−"}${escapeHtml(fmt(record.amount, record.currency))}</b>`);
    lines.push(`${escapeHtml(catLabel({ collection, category: record.category }))}${name ? `  ·  ${escapeHtml(name)}` : ""}`);
    lines.push(`📆 ${escapeHtml(dayWord(record.date || record.nextPaymentDate, today))}`);
  } else {
    lines.push(`✅ <b>បានកត់ ${saved.length} មុខ</b>`, "");
    let out = 0;
    let inc = 0;
    saved.forEach(({ collection, record }) => {
      const income = collection === "income";
      const value = convert(record.amount, record.currency, currency);
      if (income) inc += value; else out += value;
      const name = nameOf(record);
      const day = (record.date || record.nextPaymentDate) !== today ? ` <i>(${escapeHtml(dayWord(record.date || record.nextPaymentDate, today))})</i>` : "";
      lines.push(`<b>${income ? "+" : "−"}${escapeHtml(fmt(record.amount, record.currency))}</b>  ${escapeHtml(catLabel({ collection, category: record.category }))}${name ? ` · ${escapeHtml(name)}` : ""}${day}`);
    });
    lines.push("");
    if (out) lines.push(`💸 ចំណាយសរុប  <b>${escapeHtml(fmt(out, currency))}</b>`);
    if (inc) lines.push(`💰 ចំណូលសរុប  <b>${escapeHtml(fmt(inc, currency))}</b>`);
  }

  // today's spending + budget bars for touched expense categories
  const expenses = saved.filter(item => item.collection === "expenses");
  const quote = [];
  if (expenses.length) {
    const todaySpent = (payload.expenses || []).filter(entry => entry.date === today)
      .reduce((sum, entry) => sum + convert(entry.amount, entry.currency || currency, currency), 0);
    quote.push(`📅 ថ្ងៃនេះចាយសរុប  <b>${escapeHtml(fmt(todaySpent, currency))}</b>`);
    const month = today.slice(0, 7);
    const spending = monthSpending(payload, month);
    [...new Set(expenses.filter(item => String(item.record.date || "").startsWith(month)).map(item => item.record.category))].forEach(category => {
      const budget = Number(payload.profile?.categoryBudgets?.[category] || 0);
      if (!budget) return;
      const spent = spending[category] || 0;
      const percent = Math.round((spent / budget) * 100);
      const icon = percent >= 100 ? "🔴" : percent >= 80 ? "🟡" : "🟢";
      const note = percent >= 100 ? `លើស ${fmt(spent - budget, currency)}` : `នៅសល់ ${fmt(budget - spent, currency)}`;
      quote.push("", `${icon} ថវិកា${escapeHtml(CATEGORY_KM[category] || category)}  <b>${percent}%</b>`, `${bar(percent)}`, `${escapeHtml(fmt(spent, currency))} / ${escapeHtml(fmt(budget, currency))} · ${escapeHtml(note)}`);
    });
  }
  if (quote.length) lines.push("", `<blockquote>${quote.join("\n")}</blockquote>`);
  if (skipped.length) lines.push("", `🤔 មិនយល់៖ ${skipped.map(line => `<code>${escapeHtml(line)}</code>`).join(", ")}`);
  return lines.join("\n");
}

// mode "main": Change category / Undo / Open — mode "cats": labelled category grid
function moneyKeyboard(token, saved, mode = "main") {
  const url = saved.every(item => item.collection === "income") ? "/#money/income" : "/#money/expenses";
  const single = saved.length === 1 && saved[0].collection === "expenses";
  if (mode === "cats" && single) {
    const current = saved[0].record.category;
    const buttons = EXPENSE_CATS.map((category, index) => ({
      text: `${category === current ? "✅ " : ""}${CAT_ICON[category]} ${CATEGORY_KM[category] || category}`,
      callback_data: `cat${index}|${token}`
    }));
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    rows.push([{ text: "‹ ត្រឡប់", callback_data: `catback|${token}` }]);
    return { inline_keyboard: rows };
  }
  const top = [];
  if (single) top.push({ text: "🏷 ប្តូរប្រភេទ", callback_data: `cats|${token}` });
  top.push({ text: saved.length > 1 ? "↩️ លុបទាំងអស់" : "↩️ លុបវិញ", callback_data: `undo|${token}` });
  return { inline_keyboard: [top, [{ text: "📱 បើក MYLIFE", url: appLink({ url }) }]] };
}

/* ---------------- menu + commands ---------------- */

// persistent buttons under the chat box
const REPLY_KEYBOARD = {
  keyboard: [[{ text: "☀️ ថ្ងៃនេះ" }, { text: "🌙 កត់ចំណាយ" }], [{ text: "📊 របាយការណ៍" }, { text: "☰ ម៉ឺនុយ" }]],
  resize_keyboard: true,
  is_persistent: true,
  input_field_placeholder: "coffee 2 · ស្អែក 9 ព្រឹក ជួបម៉ាក់"
};

const COMMAND_WORDS = [
  ["help", /^\/(start|help)\b|^ជំនួយ$|^❓/i],
  ["menu", /^\/menu\b|^☰|^ម៉ឺនុយ$|^menu$/i],
  ["reports", /^\/report\b|^📊 របាយការណ៍$|^របាយការណ៍$/i],
  ["today", /^\/today\b|^☀️ ថ្ងៃនេះ$|^ថ្ងៃនេះ$/i],
  ["evening", /^\/evening\b|^🌙 កត់ចំណាយ$/i],
  ["week", /^\/week\b/i],
  ["month", /^\/month\b/i],
  ["lastmonth", /^\/lastmonth\b/i],
  ["backup", /^\/backup\b/i]
];

function commandOf(text) {
  const found = COMMAND_WORDS.find(([, re]) => re.test(text));
  return found ? found[0] : "";
}

function menuKeyboard() {
  const b = (text, key) => ({ text, callback_data: `m|${key}` });
  return {
    inline_keyboard: [
      [b("☀️ ថ្ងៃនេះ", "today"), b("🌙 កត់ចំណាយ", "evening")],
      [b("📈 7 ថ្ងៃ", "week"), b("🗓️ ខែនេះ", "month")],
      [b("📅 ខែមុន", "lastmonth"), b("💾 Backup", "backup")],
      [{ text: "📑 របាយការណ៍ JPG + Excel (app)", url: appLink({ url: "/#money/reports" }) }],
      [b("❓ ជំនួយ", "help"), { text: "📱 បើក MYLIFE", url: appLink({ url: "/" }) }]
    ]
  };
}

function reportsKeyboard() {
  const b = (text, key) => ({ text, callback_data: `m|${key}` });
  return {
    inline_keyboard: [
      [b("📈 7 ថ្ងៃចុងក្រោយ", "week")],
      [b("🗓️ ខែនេះ (ដល់ថ្ងៃនេះ)", "month"), b("📅 ខែមុន", "lastmonth")],
      [{ text: "📑 JPG + Excel ពី app", url: appLink({ url: "/#money/reports" }) }]
    ]
  };
}

async function runCommand(command, { message, userId, payload, today, redis }) {
  const images = () => require("../lib/report-image");
  switch (command) {
    case "help":
      return reply(message, HELP_TEXT, REPLY_KEYBOARD);
    case "menu":
      return reply(message, "☰ <b>ម៉ឺនុយ MYLIFE</b>\n<i>ជ្រើសខាងក្រោម ឬវាយសារ ឧ.</i> <code>coffee 2</code>", menuKeyboard());
    case "reports":
      return reply(message, "📊 <b>របាយការណ៍</b> — ជ្រើសមួយ", reportsKeyboard());
    case "today": {
      const digest = digestItem({ ...payload, profile: { ...(payload.profile || {}), morningDigest: true } }, today);
      return reply(message, buildTelegramText({ ...digest, heading: "📋 <b>សង្ខេបថ្ងៃនេះ · Today</b>" }));
    }
    case "evening":
      return sendAlert(eveningItem(payload, today, "21:00"), userId, redis);
    case "week": {
      await reply(message, buildWeeklyText({ kind: "weekly", url: "/#money/reports", weekly: weeklyReport(payload, today) }));
      const png = await images().weeklyImage(payload, today);
      return tgUpload("sendPhoto", "photo", Buffer.from(png), `mylife-week-${today}.png`, "image/png", { caption: "📊 <b>របាយការណ៍ 7 ថ្ងៃ</b>", parse_mode: "HTML" });
    }
    case "month":
    case "lastmonth": {
      const month = command === "month" ? today.slice(0, 7) : (() => { const [y, m] = today.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; })();
      const png = await images().monthlyImage(payload, month);
      return tgUpload("sendPhoto", "photo", Buffer.from(png), `mylife-month-${month}.png`, "image/png", {
        caption: command === "month" ? "🗓️ <b>របាយការណ៍ខែនេះ (ដល់ថ្ងៃនេះ)</b>" : "📅 <b>របាយការណ៍ខែមុន</b>",
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "📑 Excel ពី app", url: appLink({ url: "/#money/reports" }) }]] }
      });
    }
    case "backup":
      return tgUpload("sendDocument", "document", Buffer.from(JSON.stringify(payload, null, 1)), `mylife-backup-${today}.json`, "application/json", { caption: `💾 <b>Backup</b> · ${today}\nរក្សាទុកឯកសារនេះ។ ពេលត្រូវការ៖ Settings → Import`, parse_mode: "HTML" });
    default:
      return null;
  }
}

/* ---------------- water / electricity bots (PPWSA, EDC) ---------------- */

function daysBetween(a, b) {
  const toDay = iso => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((toDay(b) - toDay(a)) / 86400000);
}

function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dueLine(bill) {
  if (!bill?.due) return "";
  const date = dateLabels(bill.due);
  return `📆 ផុតកំណត់ ${escapeHtml(date.km)} · <i>Due ${escapeHtml(date.en)}</i>`;
}

async function handleUtility(message, notice, redis) {
  const info = PROVIDERS[notice.provider];
  const label = `${info.icon} ${info.km} · ${info.en} (${info.company})`;
  // each notice is handled once, even if Telegram retries or it is forwarded again
  const fresh = await redis.set(`mylife:utility:${notice.provider}:${notice.type}:${notice.ref}`, "1", { nx: true, ex: 60 * 86400 });
  if (fresh === null) return null;

  const userId = await ownerUserId(redis);
  const payload = userId ? await readPayload(userId) : null;
  const linkRow = notice.url ? [{ text: notice.type === "receipt" ? "🧾 មើលបង្កាន់ដៃ · Receipt" : "🔗 មើលវិក្កយបត្រ · View bill", url: notice.url }] : null;
  const today = zonedToday();
  const bill = payload ? findUtilityBill(payload.bills, notice.provider) : null;

  if (notice.type === "invoice") {
    // save it in the app: the matching bill gets the invoice link (or a new bill is made)
    let saved = bill;
    let created = false;
    const oldInvoice = notice.date && daysBetween(notice.date, today) > 20;
    if (userId && payload && !oldInvoice) {
      await updatePayload(userId, data => {
        data.bills = Array.isArray(data.bills) ? data.bills : [];
        const now = new Date().toISOString();
        let target = findUtilityBill(data.bills, notice.provider);
        if (!target) {
          created = true;
          target = {
            id: recordId("bills"),
            createdAt: now,
            name: `${info.en} (${info.company})`,
            amount: 0,
            currency: "KHR",
            frequency: "Monthly",
            due: addDaysIso(today, 7),
            category: "Utilities",
            reminder: true,
            notes: "បង្កើតពីវិក្កយបត្រ Telegram — សូមកែថ្ងៃផុតកំណត់ · Made from a Telegram invoice, check the due date",
            status: "Upcoming",
            source: "telegram"
          };
          data.bills.push(target);
        }
        Object.assign(target, { invoiceUrl: notice.url, invoiceRef: notice.ref, invoiceAt: now, updatedAt: now });
        saved = { ...target };
        return "updated";
      });
    }
    const keyboard = [];
    if (saved && userId) {
      const token = await saveAction(redis, { userId, item: { kind: "bill", id: saved.id, sourceId: saved.id, title: saved.name, url: "/#money/bills" } });
      keyboard.push([{ text: "✅ បានបង់ · Paid", callback_data: `paid|${token}` }]);
    }
    if (linkRow) keyboard.push(linkRow);
    const amountText = saved && Number(saved.amount) > 0 ? ` · ប្រហែល ${escapeHtml(formatMoney(saved.amount, saved.currency || payload?.profile?.currency || "USD"))}` : "";
    const lines = [
      `🧾 <b>វិក្កយបត្រ${info.km}ថ្មី · New ${info.en.toLowerCase()} bill</b>`,
      label,
      saved ? `📌 ${escapeHtml(saved.name)}${amountText}` : "",
      saved ? dueLine(saved) : "",
      created ? "🆕 បានបង្កើតក្នុង MYLIFE → Money › Bills (សូមកែថ្ងៃផុតកំណត់) · Added to MYLIFE" : saved ? "📲 បានដាក់ក្នុង MYLIFE · Saved in MYLIFE" : "",
      "",
      "<i>ពេលបង់រួច បង្កាន់ដៃនឹងត្រូវកត់ដោយស្វ័យប្រវត្តិ · The receipt will be recorded automatically</i>"
    ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""));
    const sent = await reply(message, lines.join("\n"), keyboard.length ? { inline_keyboard: keyboard } : undefined);
    if (userId) await pushAdded(userId, `🧾 វិក្កយបត្រ${info.km}ថ្មី · ${info.company}`, saved?.due ? `ផុតកំណត់ ${dateLabels(saved.due).km}` : "មើលក្នុង Telegram", "/#money/bills", "utility");
    return sent;
  }

  // receipt: payment done → mark the bill paid with the real amount
  if (!userId || !payload) {
    return reply(message, `✅ <b>បានទទួលបង្កាន់ដៃ${info.km}</b>\n${label}\n⚠️ សូមចុចប៊ូតុងណាមួយលើការរំលឹក MYLIFE ម្ដងសិន ដើម្បីភ្ជាប់គណនី។`, linkRow ? { inline_keyboard: [linkRow] } : undefined);
  }
  // an old receipt (forwarded from weeks ago) must not pay this month's bill
  if (notice.date && daysBetween(notice.date, today) > 20) {
    return reply(message, `🗂 <b>បង្កាន់ដៃចាស់ · Old receipt</b>\n${label}\n📆 ${escapeHtml(dateLabels(notice.date).km)}\nℹ️ ចាស់ជាង 20 ថ្ងៃ មិនបានកត់ទេ · Older than 20 days, nothing saved`, linkRow ? { inline_keyboard: [linkRow] } : undefined);
  }
  const currency = payload.profile?.currency || "USD";
  const amount = notice.amount || null;
  const paidText = amount ? formatMoney(amount, notice.currency || "KHR") : "";
  let outcome = "added";
  let corrected = null;
  let billName = "";
  let nextDue = "";
  await updatePayload(userId, data => {
    const target = findUtilityBill(data.bills, notice.provider);
    if (target) {
      billName = target.name || info.en;
      // the receipt is the real bill: next month's estimate follows the last real amount
      const estimate = { amount: Number(target.amount) || 0, currency: target.currency || currency };
      if (amount) {
        target.amount = amount;
        target.currency = notice.currency || target.currency;
      }
      // paid with ✅ a few days ago → that was this payment: don't count it twice,
      // but put the real amount on the expense that ✅ recorded from the estimate
      if (target.lastPaidAt && daysBetween(target.lastPaidAt, today) < 20) {
        outcome = "already";
        nextDue = target.due || "";
        if (!amount) return "unchanged";
        data.expenses = Array.isArray(data.expenses) ? data.expenses : [];
        const now = new Date().toISOString();
        const expense = data.expenses.find(entry => entry.id === target.lastPaidExpenseId)
          || data.expenses.find(entry => entry.billId === target.id && entry.date === target.lastPaidAt);
        const realCurrency = notice.currency || currency;
        if (expense) {
          const changed = Number(expense.amount) !== amount || (expense.currency || currency) !== realCurrency;
          if (changed) {
            corrected = { from: formatMoney(expense.amount, expense.currency || currency), to: formatMoney(amount, realCurrency) };
            outcome = "corrected";
          }
          Object.assign(expense, { amount, currency: realCurrency, notes: `${info.company} receipt ${notice.ref}`, updatedAt: now });
        } else {
          const id = recordId("expenses");
          data.expenses.push({ id, createdAt: now, updatedAt: now, description: target.name || info.en, amount, currency: realCurrency, date: target.lastPaidAt, category: "Bills", method: info.company, notes: `${info.company} receipt ${notice.ref}`, billId: target.id, source: "telegram" });
          target.lastPaidExpenseId = id;
          outcome = "corrected";
          corrected = { from: estimate.amount > 0 ? formatMoney(estimate.amount, estimate.currency) : "—", to: formatMoney(amount, realCurrency) };
        }
        return "updated";
      }
      const result = payBill(data, target, today, info.company, { amount, currency: notice.currency, notes: `${info.company} receipt ${notice.ref}`, force: true });
      outcome = result === "updated" ? "paid" : "already";
      nextDue = target.due || "";
      return result === "updated" ? "updated" : "unchanged";
    }
    if (!amount) {
      outcome = "noamount";
      return "unchanged";
    }
    data.expenses = Array.isArray(data.expenses) ? data.expenses : [];
    const now = new Date().toISOString();
    data.expenses.push({ id: recordId("expenses"), createdAt: now, updatedAt: now, description: `${info.en} (${info.company})`, amount, currency: notice.currency || currency, date: notice.date && notice.date <= today ? notice.date : today, category: "Bills", method: info.company, notes: `${info.company} receipt ${notice.ref}`, source: "telegram" });
    return "updated";
  });

  const lines = [`✅ <b>បានបង់${info.km}រួច · ${info.en} paid</b>`, label];
  if (paidText) lines.push(`💵 ${escapeHtml(paidText)}`);
  if (outcome === "paid") {
    lines.push(`📌 បានកត់ "${escapeHtml(billName)}" ថាបានបង់ + ចំណាយ Bills · Marked paid`);
    if (nextDue) lines.push(`🔁 លើកក្រោយ ${escapeHtml(dateLabels(nextDue).km)} · <i>Next ${escapeHtml(dateLabels(nextDue).en)}</i>`);
  } else if (outcome === "corrected") {
    lines.push(`👌 "${escapeHtml(billName)}" បានកត់ថាបង់រួចហើយ (មិនកត់ស្ទួន)`);
    lines.push(`📝 កែចំណាយទៅលេខពិត ${escapeHtml(corrected.from)} → <b>${escapeHtml(corrected.to)}</b> · Fixed to the real amount`);
  } else if (outcome === "already") {
    lines.push(`👌 "${escapeHtml(billName)}" បានកត់ថាបង់រួចហើយ មិនកត់ស្ទួនទេ · Already recorded`);
  } else if (outcome === "added") {
    lines.push("📌 បានកត់ជាចំណាយ Bills · Saved as a Bills expense");
  } else {
    lines.push("ℹ️ រកមិនឃើញចំនួនទឹកប្រាក់ មិនបានកត់ទេ · No amount found, nothing saved");
  }
  const sent = await reply(message, lines.join("\n"), linkRow ? { inline_keyboard: [linkRow] } : undefined);
  if (outcome === "paid" || outcome === "added" || outcome === "corrected") {
    await pushAdded(userId, `${info.icon} បានបង់${info.km} · ${info.company}`, paidText ? `${paidText} · បានកត់ក្នុង MYLIFE` : "បានកត់ក្នុង MYLIFE", "/#money/bills", "utility");
  }
  return sent;
}

async function handleMessage(message, redis) {
  // water / electricity bots, or their message forwarded or pasted here
  const notice = detectUtility(message);
  if (notice) return handleUtility(message, notice, redis);
  // any other bot: never read as an expense, an event or a command
  if (message.from?.is_bot || message.via_bot) return null;

  // "/week@MyBot" in groups → "/week"
  const text = String(message.text || "").trim().replace(/^(\/[a-z]+)@\w+/i, "$1");
  if (!text) return;
  const command = commandOf(text);
  if (command === "help") return reply(message, HELP_TEXT, REPLY_KEYBOARD);

  const userId = await ownerUserId(redis);
  if (!userId) {
    return reply(message, "⚠️ សូមចុចប៊ូតុងណាមួយលើការរំលឹក MYLIFE ម្ដងសិន ដើម្បីភ្ជាប់គណនី។\n<i>Press any button on a MYLIFE alert once to link your account.</i>");
  }
  const payload = await readPayload(userId);
  if (!payload) return reply(message, "⚠️ រកមិនឃើញទិន្នន័យ MYLIFE · No MYLIFE data found");
  const today = zonedToday();
  if (command) return runCommand(command, { message, userId, payload, today, redis });

  const currency = payload.profile?.currency || "USD";
  const rows = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const parsedRows = rows.map(line => ({ line, entry: parseMoney(line, currency, today) }));
  const moneyRows = parsedRows.filter(row => row.entry);
  if (moneyRows.length) {
    const saved = moneyRows.map(row => entryRecord(row.entry, today, currency));
    const skipped = parsedRows.filter(row => !row.entry).map(row => row.line);
    let after = payload;
    await updatePayload(userId, data => {
      saved.forEach(({ collection, record }) => {
        data[collection] = Array.isArray(data[collection]) ? data[collection] : [];
        data[collection].push(record);
      });
      after = data;
      return "updated";
    });
    const token = await saveAction(redis, {
      userId,
      item: { kind: "undo", entries: saved.map(({ collection, record }) => ({ collection, id: record.id })), collection: saved[0].collection, id: saved[0].record.id, url: "/#money/expenses" }
    });
    const sent = await reply(message, moneyReplyText(after, saved, today, skipped), moneyKeyboard(token, saved));
    const lineOf = ({ collection, record }) => `${collection === "income" ? "+" : "−"}${formatMoney(record.amount, record.currency)} · ${catLabel({ collection, category: record.category })}${record.description || record.name ? ` · ${record.description || record.name}` : ""}`;
    const onlyIncome = saved.every(item => item.collection === "income");
    await pushAdded(
      userId,
      saved.length > 1 ? `📲 បានកត់ ${saved.length} ពី Telegram` : onlyIncome ? "📲 បានកត់ចំណូលពី Telegram" : "📲 បានកត់ចំណាយពី Telegram",
      saved.slice(0, 4).map(lineOf).join("\n"),
      onlyIncome ? "/#money/income" : "/#money/expenses",
      "expense"
    );
    return sent;
  }

  const familyNames = (payload.family || []).map(member => member?.name).filter(Boolean);
  const parsed = parseEvent(text, today, familyNames);
  const id = recordId("calendarEvents");
  const event = {
    id,
    createdAt: new Date().toISOString(),
    title: parsed.title,
    date: parsed.date || today,
    time: parsed.time || "",
    category: parsed.category || "Personal",
    familyMember: parsed.familyMember || "",
    reminder: true,
    notes: "",
    source: "telegram"
  };
  await updatePayload(userId, data => {
    data.calendarEvents = Array.isArray(data.calendarEvents) ? data.calendarEvents : [];
    data.calendarEvents.push(event);
    return "updated";
  });
  const date = dateLabels(event.date);
  const time = timeLabels(event.time, Boolean(event.time));
  const lines = [
    "📅 <b>បានបន្ថែមព្រឹត្តិការណ៍ · Event added</b>",
    "",
    `<b>${escapeHtml(event.title)}</b>`,
    `📆 ${escapeHtml(date.km)} · <i>${escapeHtml(date.en)}</i>`,
    `🕒 ${escapeHtml(time.km)} · <i>${escapeHtml(time.en)}</i>`,
    event.familyMember ? `👨‍👩‍👧 ${escapeHtml(event.familyMember)}` : "",
    event.time ? "🔔 នឹងរំលឹកតាម Telegram · You'll get an alert" : "🔔 នឹងរំលឹកម៉ោង 9:00 ព្រឹក · Alert at 9:00 AM"
  ].filter(Boolean);
  const sent = await reply(message, lines.join("\n"), await undoKeyboard(redis, userId, "calendarEvents", id, "/#calendar"));
  await pushAdded(userId, "📲 បានបន្ថែមព្រឹត្តិការណ៍ពី Telegram", `📅 ${event.title} · ${date.km}${event.time ? ` · ${time.km}` : ""}`, "/#calendar", "event");
  return sent;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!process.env.TELEGRAM_BOT_TOKEN || req.headers["x-telegram-bot-api-secret-token"] !== webhookSecret()) {
    return res.status(401).json({ error: "unauthorized" });
  }

  let update = req.body;
  if (typeof update === "string") {
    try {
      update = JSON.parse(update);
    } catch (error) {
      update = {};
    }
  }
  if (update?.message) {
    const message = update.message;
    if (String(message.chat?.id) !== String(process.env.TELEGRAM_CHAT_ID)) return res.status(200).json({ ok: true });
    try {
      await handleMessage(message, getRedis());
    } catch (error) {
      console.error("MYLIFE Telegram message failed.", error.message);
      await tgCall("sendMessage", { chat_id: message.chat.id, text: "❌ មានបញ្ហា សូមសាកម្ដងទៀត · Something went wrong" }).catch(() => {});
    }
    return res.status(200).json({ ok: true });
  }

  const query = update?.callback_query;
  if (!query) return res.status(200).json({ ok: true });

  const answer = text => tgCall("answerCallbackQuery", { callback_query_id: query.id, text, show_alert: false }).catch(() => {});
  const chatId = query.message?.chat?.id;

  try {
    if (String(chatId) !== String(process.env.TELEGRAM_CHAT_ID)) {
      await answer("⛔ មិនអនុញ្ញាត · Not allowed");
      return res.status(200).json({ ok: true });
    }

    const [verb, token] = String(query.data || "").split("|");
    if (verb === "m" && token) {
      const redisMenu = getRedis();
      const userId = await ownerUserId(redisMenu);
      if (!userId && token !== "help") {
        await answer("⚠️ មិនទាន់ភ្ជាប់គណនី");
        return res.status(200).json({ ok: true });
      }
      await answer(["week", "month", "lastmonth", "backup"].includes(token) ? "⏳ កំពុងរៀបចំ…" : "👌");
      const payload = userId ? await readPayload(userId) : null;
      await runCommand(token, { message: { chat: { id: chatId }, message_id: query.message?.message_id }, userId, payload: payload || {}, today: zonedToday(), redis: redisMenu });
      return res.status(200).json({ ok: true });
    }
    if (verb === "noop" || !token) {
      await answer("👌");
      return res.status(200).json({ ok: true });
    }

    const redis = getRedis();
    const action = await loadAction(redis, token);
    if (!action?.item) {
      await answer("⌛ ប៊ូតុងនេះផុតកំណត់ · This button expired");
      return res.status(200).json({ ok: true });
    }

    const item = action.item;
    if (action.userId) await redis.set("mylife:tg:owner", action.userId);
    let status;
    let toast;

    if (verb === "s10" || verb === "s60" || verb === "tomorrow") {
      let fireAt = Date.now() + (verb === "s10" ? 10 : 60) * 60000;
      if (verb === "tomorrow") {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60000);
        const day = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(tomorrow);
        fireAt = Date.parse(`${day}T09:00:00+07:00`);
      }
      await addSnooze(redis, action.userId, { ...item, early: 0 }, fireAt);
      const clock = zonedClock(fireAt);
      status = verb === "tomorrow" ? "⏰ ស្អែកម៉ោង 9:00 · Tomorrow 9:00" : `⏰ រំលឹកម្ដងទៀត ${clock} · Again at ${clock}`;
      toast = status;
    } else if ((verb === "cats" || verb === "catback") && item.kind === "undo") {
      const target = (item.entries || [])[0] || { collection: item.collection, id: item.id };
      const payload = await readPayload(action.userId);
      const record = (payload?.[target.collection] || []).find(entry => entry.id === target.id);
      if (!record) {
        await answer("⚠️ រកមិនឃើញក្នុង MYLIFE · Not found");
        return res.status(200).json({ ok: true });
      }
      await answer(verb === "cats" ? "🏷 ជ្រើសប្រភេទ" : "👌");
      await tgCall("editMessageReplyMarkup", {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: moneyKeyboard(token, [{ collection: target.collection, record }], verb === "cats" ? "cats" : "main")
      }).catch(() => {});
      return res.status(200).json({ ok: true });
    } else if (/^cat\d$/.test(verb) && item.kind === "undo") {
      const category = EXPENSE_CATS[Number(verb.slice(3))];
      const target = (item.entries || [])[0] || { collection: item.collection, id: item.id };
      let after = null;
      let record = null;
      const result = await updatePayload(action.userId, payload => {
        record = (payload[target.collection] || []).find(entry => entry.id === target.id);
        if (!record || !category) return "missing";
        const oldDefault = CATEGORY_KM[record.category] || record.category;
        if (!record.description || record.description === oldDefault) record.description = CATEGORY_KM[category] || category;
        record.category = category;
        record.updatedAt = new Date().toISOString();
        after = payload;
        return "updated";
      });
      if (result !== "updated") {
        await answer("⚠️ រកមិនឃើញក្នុង MYLIFE · Not found");
        return res.status(200).json({ ok: true });
      }
      const saved = [{ collection: target.collection, record }];
      await answer(`✅ ${catLabel({ collection: target.collection, category })}`);
      await tgCall("editMessageText", {
        chat_id: chatId,
        message_id: query.message.message_id,
        text: moneyReplyText(after, saved, zonedToday()),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: moneyKeyboard(token, saved)
      }).catch(() => {});
      return res.status(200).json({ ok: true });
    } else if (/^qa\d$/.test(verb) && item.kind === "evening") {
      // one-tap frequent expense from the evening check
      const entry = (item.quick || [])[Number(verb.slice(2))];
      if (!entry) {
        await answer("🤔");
        return res.status(200).json({ ok: true });
      }
      const today = zonedToday();
      const saved = [entryRecord({ type: "expense", amount: entry.amount, currency: entry.currency, category: entry.category, description: entry.description, date: item.date || today }, today, entry.currency)];
      let after = null;
      await updatePayload(action.userId, data => {
        data.expenses = Array.isArray(data.expenses) ? data.expenses : [];
        data.expenses.push(saved[0].record);
        after = data;
        return "updated";
      });
      const undoToken = await saveAction(redis, { userId: action.userId, item: { kind: "undo", entries: [{ collection: "expenses", id: saved[0].record.id }], collection: "expenses", id: saved[0].record.id, url: "/#money/expenses" } });
      await answer(`✅ ${entry.description}`);
      await tgCall("sendMessage", {
        chat_id: chatId,
        text: moneyReplyText(after, saved, today),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_to_message_id: query.message.message_id,
        reply_markup: moneyKeyboard(undoToken, saved)
      }).catch(() => {});
      await pushAdded(action.userId, "📲 បានកត់ចំណាយពី Telegram", `−${formatMoney(entry.amount, entry.currency)} · ${catLabel({ collection: "expenses", category: entry.category })} · ${entry.description}`, "/#money/expenses", "expense");
      return res.status(200).json({ ok: true });
    } else if (verb === "nomore") {
      status = "✅ ល្អណាស់! ថ្ងៃនេះកត់រួច";
      toast = "👍 រាត្រីសួស្តី";
    } else if (verb === "seen") {
      status = DONE_TEXT.seen;
      toast = "👍";
    } else if (DONE_TEXT[verb]) {
      const result = await updatePayload(action.userId, payload => applyDone(payload, item));
      if (result === "missing") {
        status = "⚠️ រកមិនឃើញក្នុង MYLIFE · Not found";
      } else {
        status = DONE_TEXT[verb];
      }
      toast = result === "updated" ? `${status} — MYLIFE updated` : status;
      // tell the app right away (push → it pulls and shows the pop-up)
      if (result === "updated" && item.kind === "bill") {
        await pushAdded(action.userId, `✅ បានបង់ · ${item.title || "Bill"}`, "ពី Telegram · បានកត់ក្នុង MYLIFE", "/#money/bills", "bill");
      }
    } else {
      await answer("🤔");
      return res.status(200).json({ ok: true });
    }

    await answer(toast);
    await tgCall("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: status, callback_data: "noop" }],
          [{ text: "📱 បើក MYLIFE · Open", url: appLink(item) }]
        ]
      }
    }).catch(() => {});
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("MYLIFE Telegram button failed.", error.message);
    await answer("❌ មានបញ្ហា សូមសាកម្ដងទៀត · Something went wrong");
    // 200 so Telegram doesn't retry the same press forever.
    return res.status(200).json({ ok: false });
  }
};
