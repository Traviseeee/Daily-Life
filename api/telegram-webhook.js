// Receives Telegram button presses (callback queries) for MYLIFE alerts.
// ✅ Paid / Done / Saved update the user's app data, ⏰ buttons snooze,
// 👍 just acknowledges. Only the configured chat can use the buttons.

const { createClient } = require("@supabase/supabase-js");
const { getRedis, sendToUser } = require("../lib/push");
const crypto = require("crypto");
const { tgCall, webhookSecret, loadAction, saveAction, addSnooze, appLink } = require("../lib/telegram");
const { buildTelegramText, dateLabels, timeLabels, escapeHtml } = require("../lib/telegram-message");
const { parseEvent, parseMoney } = require("../lib/smart-parse");
const { monthSpending, formatMoney, convert, CATEGORY_KM } = require("../lib/money-report");
const { digestItem } = require("./dispatch");

const APP_TIME_ZONE = "Asia/Phnom_Penh";

function zonedToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function zonedClock(ms) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

// Same rules as markBillPaid() in js/dashboard.js.
function markBillPaid(bill, today) {
  if (bill.status === "Paid") return "already";
  if (bill.lastPaidAt && bill.due && bill.due > today) return "already";
  const frequency = bill.frequency || "Monthly";
  const changes = { status: "Paid", lastPaidAt: today, lastPaidDue: bill.due || "", lastPaidStatus: bill.status || "Upcoming" };
  const due = parseDate(bill.due);
  if (frequency !== "Once" && due) {
    const todayDate = parseDate(today);
    do {
      if (frequency === "Daily") due.setDate(due.getDate() + 1);
      else if (frequency === "Weekly") due.setDate(due.getDate() + 7);
      else {
        const months = frequency === "Quarterly" ? 3 : frequency === "Yearly" ? 12 : 1;
        const day = due.getDate();
        due.setDate(1);
        due.setMonth(due.getMonth() + months);
        due.setDate(Math.min(day, new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate()));
      }
    } while (due <= todayDate);
    changes.due = dateInput(due);
    changes.status = "Upcoming";
  }
  Object.assign(bill, changes, { updatedAt: new Date().toISOString() });
  return "updated";
}

// Applies ✅ to the payload. Returns "updated", "already" or "missing".
function applyDone(payload, item) {
  const today = zonedToday();
  const id = item.sourceId || item.id;
  if (item.kind === "bill") {
    const bill = (payload.bills || []).find(entry => entry.id === id);
    if (!bill) return "missing";
    const result = markBillPaid(bill, today);
    // same as the app: a paid bill is also recorded as an expense
    if (result === "updated" && Number(bill.amount) > 0) {
      payload.expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
      const existing = payload.expenses.find(entry => entry.billId === bill.id && entry.date === today);
      const expenseId = existing?.id || `expenses-bill-${bill.id}-${Date.now()}`;
      if (!existing) {
        payload.expenses.push({ id: expenseId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), description: bill.name || "Bill", amount: Number(bill.amount), currency: bill.currency || payload.profile?.currency || "USD", date: today, category: "Bills", method: "Telegram", notes: "Bill", billId: bill.id, source: "telegram" });
      }
      bill.lastPaidExpenseId = expenseId;
    }
    return result;
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
  const supabase = serviceClient();
  const { data, error } = await supabase.from("app_data").select("payload").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return "missing";
  const wasString = typeof data.payload === "string";
  const payload = wasString ? JSON.parse(data.payload || "{}") : data.payload || {};
  const result = mutate(payload);
  if (result !== "updated") return result;
  const { error: saveError } = await supabase
    .from("app_data")
    .update({ payload: wasString ? JSON.stringify(payload) : payload, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (saveError) throw saveError;
  return "updated";
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
  "☀️ <code>/today</code> — សង្ខេបថ្ងៃនេះ · Today's summary"
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
async function pushAdded(userId, title, body, url) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  try {
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

// Reply text for saved money lines, read from the saved payload so budget % is exact.
function moneyReplyText(payload, saved, today, skipped = []) {
  const currency = payload.profile?.currency || "USD";
  const lines = [];
  const dayNote = date => (date && date !== today ? ` · 📆 ${escapeHtml(dateLabels(date).km)}` : "");
  if (saved.length === 1) {
    const { collection, record } = saved[0];
    const entry = { collection, category: record.category };
    lines.push(collection === "income" ? "💰 <b>បានកត់ចំណូល · Income saved</b>" : "💸 <b>បានកត់ចំណាយ · Expense saved</b>", "");
    lines.push(`<b>${escapeHtml(formatMoney(record.amount, record.currency))}</b> · ${escapeHtml(catLabel(entry))}${dayNote(record.date || record.nextPaymentDate)}`);
    const name = record.description || record.name;
    if (name) lines.push(`📝 ${escapeHtml(name)}`);
  } else {
    lines.push(`🧾 <b>បានកត់ ${saved.length} · ${saved.length} saved</b>`, "");
    let out = 0;
    let inc = 0;
    saved.forEach(({ collection, record }) => {
      const sign = collection === "income" ? "+" : "−";
      const value = convert(record.amount, record.currency, currency);
      if (collection === "income") inc += value; else out += value;
      lines.push(`${sign} <b>${escapeHtml(formatMoney(record.amount, record.currency))}</b> · ${escapeHtml(catLabel({ collection, category: record.category }))}${record.description || record.name ? ` · ${escapeHtml(record.description || record.name)}` : ""}${dayNote(record.date || record.nextPaymentDate)}`);
    });
    lines.push("");
    if (out) lines.push(`💸 ចំណាយសរុប · Spent <b>${escapeHtml(formatMoney(out, currency))}</b>`);
    if (inc) lines.push(`💰 ចំណូលសរុប · Income <b>${escapeHtml(formatMoney(inc, currency))}</b>`);
  }
  // budget status for each touched expense category
  const month = today.slice(0, 7);
  const spending = monthSpending(payload, month);
  const cats = [...new Set(saved.filter(item => item.collection === "expenses" && String(item.record.date || "").startsWith(month)).map(item => item.record.category))];
  cats.forEach(category => {
    const budget = Number(payload.profile?.categoryBudgets?.[category] || 0);
    if (!budget) return;
    const spent = spending[category] || 0;
    const percent = Math.round((spent / budget) * 100);
    lines.push(`${percent >= 100 ? "🚨" : percent >= 80 ? "⚠️" : "📊"} ${escapeHtml(CATEGORY_KM[category] || category)} ${percent}% · ${escapeHtml(formatMoney(spent, currency))} / ${escapeHtml(formatMoney(budget, currency))}`);
  });
  if (skipped.length) lines.push("", `🤔 មិនយល់ · Skipped: ${skipped.map(line => `<code>${escapeHtml(line)}</code>`).join(", ")}`);
  if (saved.length === 1 && saved[0].collection === "expenses") lines.push("", "<i>ខុសប្រភេទ? ចុចរូបខាងក្រោម · Wrong category? Tap below</i>");
  return lines.join("\n");
}

function moneyKeyboard(token, saved) {
  const url = saved.every(item => item.collection === "income") ? "/#money/income" : "/#money/expenses";
  const rows = [];
  if (saved.length === 1 && saved[0].collection === "expenses") {
    const current = saved[0].record.category;
    const buttons = EXPENSE_CATS.map((category, index) => ({ text: category === current ? `✅${CAT_ICON[category]}` : CAT_ICON[category], callback_data: `cat${index}|${token}` }));
    rows.push(buttons.slice(0, 5), buttons.slice(5));
  }
  rows.push([{ text: saved.length > 1 ? "↩️ លុបទាំងអស់ · Undo all" : "↩️ លុបវិញ · Undo", callback_data: `undo|${token}` }, { text: "📱 Open", url: appLink({ url }) }]);
  return { inline_keyboard: rows };
}

async function handleMessage(message, redis) {
  const text = String(message.text || "").trim();
  if (!text) return;
  if (/^\/(start|help)\b|^ជំនួយ$/i.test(text)) return reply(message, HELP_TEXT);

  const userId = await ownerUserId(redis);
  if (!userId) {
    return reply(message, "⚠️ សូមចុចប៊ូតុងណាមួយលើការរំលឹក MYLIFE ម្ដងសិន ដើម្បីភ្ជាប់គណនី។\n<i>Press any button on a MYLIFE alert once to link your account.</i>");
  }
  const payload = await readPayload(userId);
  if (!payload) return reply(message, "⚠️ រកមិនឃើញទិន្នន័យ MYLIFE · No MYLIFE data found");
  const today = zonedToday();

  if (/^\/today\b|^ថ្ងៃនេះ$/i.test(text)) {
    const digest = digestItem({ ...payload, profile: { ...(payload.profile || {}), morningDigest: true } }, today);
    return reply(message, buildTelegramText({ ...digest, heading: "📋 <b>សង្ខេបថ្ងៃនេះ · Today</b>" }));
  }

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
      onlyIncome ? "/#money/income" : "/#money/expenses"
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
  await pushAdded(userId, "📲 បានបន្ថែមព្រឹត្តិការណ៍ពី Telegram", `📅 ${event.title} · ${date.km}${event.time ? ` · ${time.km}` : ""}`, "/#calendar");
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
