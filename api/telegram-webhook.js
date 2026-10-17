// Receives Telegram button presses (callback queries) for MYLIFE alerts.
// ✅ Paid / Done / Saved update the user's app data, ⏰ buttons snooze,
// 👍 just acknowledges. Only the configured chat can use the buttons.

const { createClient } = require("@supabase/supabase-js");
const { getRedis } = require("../lib/push");
const { tgCall, webhookSecret, loadAction, addSnooze, appLink } = require("../lib/telegram");

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
    return bill ? markBillPaid(bill, today) : "missing";
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

async function updatePayload(userId, mutate) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
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
  paid: "✅ បានបង់ · Paid",
  done: "✅ រួចរាល់ · Done",
  saved: "✅ បានសន្សំ · Saved",
  seen: "👍 បានឃើញ · Seen"
};

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
