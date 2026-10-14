const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { getRedis, getUserSubscriptions, sendToSubscription } = require("../lib/push");

const LOOKBACK_MS = 6 * 60 * 1000;
const SENT_TTL_SECONDS = 90 * 24 * 60 * 60;

function localDateTimeToUtc(dateValue, timeValue, timeZone) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(String(timeValue || "09:00"));
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const desiredLocalTime = Date.UTC(year, month - 1, day, hour, minute);
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
    const parts = Object.fromEntries(formatter.formatToParts(new Date(utcTime)).map(part => [part.type, part.value]));
    const representedLocalTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
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

function notificationItems(payload) {
  return [
    ...(Array.isArray(payload.reminders) ? payload.reminders.map(item => ({ ...item, kind: "reminder" })) : []),
    ...(Array.isArray(payload.calendarEvents) ? payload.calendarEvents.map(item => ({ ...item, kind: "calendar" })) : [])
  ].filter(item => item && item.date && !item.done);
}

function makeMarker(userId, endpoint, item) {
  const identity = [userId, endpoint, item.kind, item.id || item.title || "reminder", item.date, item.time || "09:00"].join("|");
  return crypto.createHash("sha256").update(identity).digest("hex");
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(503).json({ error: "cron_not_configured" });
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    console.warn("Rejected an unauthorized push dispatch request.");
    return res.status(401).json({ error: "unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return res.status(503).json({ error: "supabase_server_credentials_missing" });

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
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
        if (payload.profile?.notificationsEnabled === false) continue;
        const subscriptions = await getUserSubscriptions(row.user_id);
        if (!subscriptions.length) continue;

        for (const item of notificationItems(payload)) {
          const title = String(item.title || (item.kind === "calendar" ? "MYLIFE event" : "MYLIFE reminder"));
          const body = String(item.notes || item.category || (item.kind === "calendar" ? "Upcoming event" : "Upcoming reminder"));
          const destination = item.kind === "calendar" ? "/#calendar" : "/#daily";

          for (const entry of subscriptions) {
            const dueAt = localDateTimeToUtc(item.date, item.time || "09:00", entry.timeZone);
            if (dueAt === null || dueAt < now - LOOKBACK_MS || dueAt > now) continue;
            jobs.push(async () => {
              const marker = makeMarker(row.user_id, entry.endpoint, item);
              const sentKey = `mylife:push:sent:${marker}`;
              if (await redis.get(sentKey)) return "duplicate";
              const lockKey = `mylife:push:lock:${marker}`;
              const claimed = await redis.set(lockKey, "1", { nx: true, ex: 300 });
              if (!claimed) return "duplicate";
              try {
                await sendToSubscription(row.user_id, entry.subscription, { title, body, url: destination });
                await redis.set(sentKey, "1", { ex: SENT_TTL_SECONDS });
                return "sent";
              } finally {
                await redis.del(lockKey);
              }
            });
          }
        }
      }

      if ((rows || []).length < pageSize) break;
      offset += pageSize;
    }

    const results = await Promise.allSettled(jobs.map(job => job()));
    const sent = results.filter(result => result.status === "fulfilled" && result.value === "sent").length;
    const failed = results.filter(result => result.status === "rejected").length;
    return res.status(200).json({ ok: true, checked: jobs.length, sent, failed });
  } catch (error) {
    console.error("MYLIFE scheduled push dispatch failed.", error);
    return res.status(500).json({ error: "push_dispatch_failed" });
  }
};