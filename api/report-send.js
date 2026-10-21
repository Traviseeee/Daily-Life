// POST /api/report-send — the app sends its monthly report (designed JPG + Excel)
// to the MYLIFE Telegram chat. Used by the "📤 Send to Telegram" button and by
// the automatic send at the start of a month (auto: true, once per month).
// Also { test: { kind, title, body, date, time, hasTime, early } }: one sample reminder
// from the notification center ("Send a test"), so the user sees the real Telegram
// message without waiting for the day. Test messages get only an "Open" button
// (no Paid / Done buttons), so a test can never change data.
// Auth: the user's Supabase access token (Authorization: Bearer <token>).

const { createClient } = require("@supabase/supabase-js");
const { getRedis } = require("../lib/push");
const { tgUpload, tgCall, botConfigured, appLink } = require("../lib/telegram");
const { buildTelegramText } = require("../lib/telegram-message");
const { isOwner } = require("../lib/owner");

const TEST_KINDS = {
  bill: "/#money/bills", loan: "/#money/loans", "savings-deadline": "/#money/savings", goal: "/#goals",
  calendar: "/#calendar", reminder: "/#daily", birthday: "/#family", anniversary: "/#family"
};

function testItem(raw) {
  const kind = String(raw?.kind || "");
  if (!TEST_KINDS[kind]) return null;
  const date = String(raw.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const early = Number(raw.early || 0);
  const time = /^\d{2}:\d{2}$/.test(String(raw.time || "")) ? raw.time : "09:00";
  return {
    kind,
    title: String(raw.title || "MYLIFE").slice(0, 80),
    body: String(raw.body || "").slice(0, 200),
    date,
    time,
    hasTime: raw.hasTime === true,
    early: [0, 1440, 2880, 4320].includes(early) ? early : 0,
    url: TEST_KINDS[kind]
  };
}

const MAX_JPG = 4 * 1024 * 1024;
const MAX_XLSX = 2 * 1024 * 1024;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!botConfigured()) return res.status(503).json({ error: "telegram_not_configured" });

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "unauthorized" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (error) { body = {}; }
  }
  const test = body?.test ? testItem(body.test) : null;
  if (body?.test && !test) return res.status(400).json({ error: "bad_test" });
  const month = String(body?.month || "");
  if (!test && !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "bad_month" });

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) return res.status(401).json({ error: "unauthorized" });
    const userId = data.user.id;
    const redis = getRedis();
    // Reports and test messages go to the owner's Telegram group only (B2).
    if (!(await isOwner(userId, redis, supabase))) return res.status(403).json({ error: "not_owner" });

    if (test) {
      const slow = await redis.set(`mylife:notify-test-wait:${userId}`, "1", { nx: true, ex: 10 });
      if (!slow) return res.status(429).json({ error: "wait" });
      await tgCall("sendMessage", {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `🧪 <b>សារសាកល្បង · Test message</b>\n\n${buildTelegramText(test)}`,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [[{ text: "📱 បើក MYLIFE · Open", url: appLink(test) }]] }
      });
      return res.status(200).json({ ok: true });
    }

    const sentKey = `mylife:report-sent:${userId}:${month}`;
    if (body.auto) {
      // automatic send: once per month, whichever device opens first
      const claimed = await redis.set(sentKey, "app", { nx: true, ex: 70 * 24 * 60 * 60 });
      if (!claimed) return res.status(200).json({ ok: true, skipped: "already_sent" });
    } else {
      const slow = await redis.set(`mylife:report-send-wait:${userId}`, "1", { nx: true, ex: 15 });
      if (!slow) return res.status(429).json({ error: "wait" });
      await redis.set(sentKey, "app", { ex: 70 * 24 * 60 * 60 });
    }

    const jpg = Buffer.from(String(body.jpg || ""), "base64");
    const xlsx = Buffer.from(String(body.xlsx || ""), "base64");
    if (!jpg.length && !xlsx.length) return res.status(400).json({ error: "no_files" });
    if (jpg.length > MAX_JPG || xlsx.length > MAX_XLSX) return res.status(413).json({ error: "too_large" });

    const caption = String(body.caption || `📊 MYLIFE ${month}`).slice(0, 900);
    const keyboard = { inline_keyboard: [[{ text: "📱 បើករបាយការណ៍ · Open", url: appLink({ url: "/#money/reports" }) }]] };
    if (jpg.length) await tgUpload("sendPhoto", "photo", jpg, `mylife-report-${month}.jpg`, "image/jpeg", { caption, parse_mode: "HTML", reply_markup: keyboard });
    if (xlsx.length) await tgUpload("sendDocument", "document", xlsx, `mylife-report-${month}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", { caption: `📑 Excel · ${month}` });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("MYLIFE report send failed.", error.message);
    return res.status(500).json({ error: "send_failed" });
  }
};
