const { bearerMatches } = require("../lib/safe-auth");
const { buildTelegramText } = require("../lib/telegram-message");

// Sends one sample alert through Make → Telegram.
// Protected with CRON_SECRET so strangers can't spam the Telegram chat.
// Usage: POST /api/test-telegram  with header  Authorization: Bearer <CRON_SECRET>
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!bearerMatches(req.headers.authorization, cronSecret)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(503).json({ error: "make_webhook_not_configured" });
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const item = {
    kind: "calendar",
    title: "MYLIFE Test",
    body: "Telegram connection test successful! · ការតភ្ជាប់ Telegram ដំណើរការល្អ",
    date: today,
    time: "09:00",
    hasTime: true,
    url: "/#calendar"
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Same shape as /api/dispatch so Make can learn every field from this sample.
      body: JSON.stringify({
        title: item.title,
        message: item.body,
        date: item.date,
        time: item.time,
        kind: item.kind,
        text: buildTelegramText(item)
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: "make_webhook_failed", status: response.status });
    }

    return res.status(200).json({ ok: true, message: "Test sent to Make" });
  } catch (error) {
    return res.status(500).json({ error: "request_failed" });
  }
};
