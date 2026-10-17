
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const {
  getRedis,
  getUserSubscriptions,
  sendToSubscription
} = require("../lib/push");
const { buildTelegramText } = require("../lib/telegram-message");

// Redis dedupe makes a wide window safe: a late or skipped scheduler run still
// delivers alerts that came due in the last 30 minutes, exactly once.
const LOOKBACK_MS = 30 * 60 * 1000;
const APP_TIME_ZONE = "Asia/Phnom_Penh";
const SENT_TTL_SECONDS = 90 * 24 * 60 * 60;

function localDateTimeToUtc(dateValue, timeValue, timeZone) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(dateValue || "")
  );
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(
    String(timeValue || "09:00")
  );

  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const desiredLocalTime = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute
  );

  let utcTime = desiredLocalTime;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(utcTime))
        .map(part => [part.type, part.value])
    );

    const representedLocalTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute)
    );

    const correction = desiredLocalTime - representedLocalTime;
    utcTime += correction;

    if (!correction) break;
  }

  return utcTime;
}

function parsePayload(value) {
  if (value && typeof value === "object") return value;

  try {
    return JSON.parse(String(value || "{}"));
  } catch (error) {
    return {};
  }
}

function parseDate(value) {
  const normalized = /^\d{4}-\d{2}$/.test(String(value || ""))
    ? `${value}-01`
    : value;

  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Today's calendar date (YYYY-MM-DD) in Cambodia, not in the server's UTC clock.
function zonedTodayInput(timeZone = APP_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function toDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();

  result.setMonth(result.getMonth() + months, 1);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(day, lastDay));
  return result;
}

function loanNextPaymentDate(loan) {
  const firstPaymentDate = loan.firstPaymentDate || loan.startDate;
  const first = parseDate(firstPaymentDate);

  if (!first) return "";

  const monthlyPayment = Number(loan.monthlyPayment || 0);
  if (!monthlyPayment) return "";

  const durationMonths = Number(loan.durationMonths || 0);

  const today = parseDate(zonedTodayInput());

  let next = new Date(first);
  let index = 0;

  while (
    next < today &&
    (!durationMonths || index < durationMonths - 1)
  ) {
    index += 1;
    next = addMonths(first, index);
  }

  if (durationMonths && next < today) return "";

  const dateValue = toDateInput(next);

  if (
    (loan.payments || []).some(
      payment => payment.date === dateValue
    )
  ) {
    return "";
  }

  return dateValue;
}

function currentMonthKey() {
  return zonedTodayInput().slice(0, 7);
}

function savingsContributionPaid(saving, monthKey) {
  return (saving.contributions || []).some(
    entry => entry && entry.month === monthKey && entry.paid
  );
}

function notificationItems(payload) {
  const items = [];

  const add = item => {
    if (!item?.date || !item.title) return;
    items.push({ time: "09:00", hasTime: false, ...item });
  };

  (Array.isArray(payload.reminders) ? payload.reminders : [])
    .forEach(item => {
      if (item.done) return;

      add({
        kind: "reminder",
        id: item.id,
        title: item.title || "MYLIFE reminder",
        body: item.notes || item.category || "Upcoming reminder",
        date: item.date,
        time: item.time || "09:00",
        hasTime: Boolean(item.time),
        url: "/#daily"
      });
    });

  (Array.isArray(payload.calendarEvents) ? payload.calendarEvents : [])
    .forEach(item => {
      if (item.reminder === false) return;

      add({
        kind: "calendar",
        id: item.id,
        title: item.title || "MYLIFE event",
        body: item.notes || item.category || "Upcoming event",
        date: item.date,
        time: item.time || "09:00",
        hasTime: Boolean(item.time),
        url: "/#calendar"
      });
    });

  (Array.isArray(payload.bills) ? payload.bills : [])
    .forEach(item => {
      if (item.reminder === false || item.status === "Paid") return;

      add({
        kind: "bill",
        id: item.id,
        title: item.name || "Bill due",
        body: item.amount
          ? `${item.category || "Bill"} - ${item.currency || ""} ${Number(item.amount || 0)}`.trim()
          : (item.notes || "Bill payment is due"),
        date: item.due,
        url: "/#money/bills"
      });
    });

  (Array.isArray(payload.loans) ? payload.loans : [])
    .forEach(item => {
      const date = loanNextPaymentDate(item);
      if (!date) return;

      add({
        kind: "loan",
        id: item.id,
        title: item.name || "Loan payment due",
        body: item.monthlyPayment
          ? `Monthly payment: ${item.currency || ""} ${Number(item.monthlyPayment || 0)}`.trim()
          : "Loan payment is due",
        date,
        url: "/#money/loans"
      });
    });

  const monthKey = currentMonthKey();

  (Array.isArray(payload.savings) ? payload.savings : [])
    .forEach(item => {
      const monthlyAmount = Number(item.monthlyContribution || 0);

      if (
        monthlyAmount &&
        !savingsContributionPaid(item, monthKey)
      ) {
        add({
          kind: "savings-contribution",
          id: `${item.id || item.name}-${monthKey}`,
          title: item.name || "Savings contribution",
          body: `Monthly contribution: ${item.currency || ""} ${monthlyAmount}`.trim(),
          date: `${monthKey}-01`,
          url: "/#money/savings"
        });
      }

      if (item.deadline) {
        add({
          kind: "savings-deadline",
          id: `${item.id || item.name}-deadline`,
          title: item.name || "Savings deadline",
          body: item.notes || "Savings deadline",
          date: item.deadline,
          url: "/#money/savings"
        });
      }
    });

  return items;
}

function makeMarker(userId, endpoint, item) {
  const identity = [
    userId,
    endpoint,
    item.kind,
    item.id || item.title || "reminder",
    item.date,
    item.time || "09:00"
  ].join("|");

  return crypto.createHash("sha256").update(identity).digest("hex");
}

async function sendToMakeWebhook(item, userId, redis) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;

  if (!webhookUrl) return "skipped";

  const marker = makeMarker(userId, "telegram", item);
  const sentKey = `mylife:telegram:sent:${marker}`;
  const lockKey = `mylife:telegram:lock:${marker}`;

  if (await redis.get(sentKey)) return "duplicate";

  const claimed = await redis.set(lockKey, "1", {
    nx: true,
    ex: 300
  });

  if (!claimed) return "duplicate";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: String(item.title || "MYLIFE alert"),
        message: String(item.body || "It is time."),
        date: String(item.date || ""),
        time: String(item.time || "09:00"),
        kind: String(item.kind || "reminder"),
        // Ready-made bilingual message (Telegram HTML parse mode).
        text: buildTelegramText(item)
      })
    });

    if (!response.ok) {
      throw new Error(`Make webhook failed: ${response.status}`);
    }

    await redis.set(sentKey, "1", {
      ex: SENT_TTL_SECONDS
    });

    return "sent";
  } finally {
    await redis.del(lockKey);
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "method_not_allowed"
    });
  }

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return res.status(503).json({
      error: "cron_not_configured"
    });
  }

  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    console.warn("Rejected an unauthorized push dispatch request.");

    return res.status(401).json({
      error: "unauthorized"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({
      error: "supabase_server_credentials_missing"
    });
  }

  try {
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const redis = getRedis();
    const now = Date.now();
    const jobs = [];

    let offset = 0;
    const pageSize = 500;

    while (true) {
      const { data: rows, error } = await supabase
        .from("app_data")
        .select("user_id,payload")
        .order("user_id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      for (const row of rows || []) {
        const payload = parsePayload(row.payload);

        if (payload.profile?.notificationsEnabled === false) {
          continue;
        }

        const items = notificationItems(payload);

        // Send due alerts to Make.com / Telegram.
        // This works even if the user has no Web Push subscription.
        for (const item of items) {
          const dueAt = localDateTimeToUtc(
            item.date,
            item.time || "09:00",
            "Asia/Phnom_Penh"
          );

          if (
            dueAt === null ||
            dueAt < now - LOOKBACK_MS ||
            dueAt > now
          ) {
            continue;
          }

          jobs.push({
            channel: "telegram",
            run: () => sendToMakeWebhook(item, row.user_id, redis)
          });
        }

        // Keep existing Web Push notifications.
        const subscriptions = await getUserSubscriptions(row.user_id);

        for (const item of items) {
          const title = String(item.title || "MYLIFE alert");
          const body = String(
            item.body || item.notes || item.category || "It is time."
          );
          const destination = String(item.url || "/#daily");

          for (const entry of subscriptions) {
            const dueAt = localDateTimeToUtc(
              item.date,
              item.time || "09:00",
              entry.timeZone
            );

            if (
              dueAt === null ||
              dueAt < now - LOOKBACK_MS ||
              dueAt > now
            ) {
              continue;
            }

            jobs.push({ channel: "push", run: async () => {
              const marker = makeMarker(
                row.user_id,
                entry.endpoint,
                item
              );

              const sentKey = `mylife:push:sent:${marker}`;

              if (await redis.get(sentKey)) return "duplicate";

              const lockKey = `mylife:push:lock:${marker}`;

              const claimed = await redis.set(lockKey, "1", {
                nx: true,
                ex: 300
              });

              if (!claimed) return "duplicate";

              try {
                await sendToSubscription(
                  row.user_id,
                  entry.subscription,
                  {
                    title,
                    body,
                    url: destination
                  }
                );

                await redis.set(sentKey, "1", {
                  ex: SENT_TTL_SECONDS
                });

                return "sent";
              } finally {
                await redis.del(lockKey);
              }
            } });
          }
        }
      }

      if ((rows || []).length < pageSize) break;

      offset += pageSize;
    }

    const results = await Promise.allSettled(
      jobs.map(job => job.run())
    );

    const breakdown = {
      telegram: { sent: 0, duplicate: 0, skipped: 0, failed: 0 },
      push: { sent: 0, duplicate: 0, skipped: 0, failed: 0 }
    };

    results.forEach((result, index) => {
      const bucket = breakdown[jobs[index].channel];
      if (result.status === "rejected") {
        bucket.failed += 1;
        console.error(`MYLIFE ${jobs[index].channel} alert failed.`, result.reason);
        return;
      }
      if (bucket[result.value] !== undefined) bucket[result.value] += 1;
    });

    const sent = breakdown.telegram.sent + breakdown.push.sent;
    const failed = breakdown.telegram.failed + breakdown.push.failed;

    return res.status(200).json({
      ok: true,
      checked: jobs.length,
      sent,
      failed,
      telegram: breakdown.telegram,
      push: breakdown.push
    });
  } catch (error) {
    console.error("MYLIFE scheduled notification dispatch failed.", error);

    return res.status(500).json({
      error: "notification_dispatch_failed"
    });
  }
};
