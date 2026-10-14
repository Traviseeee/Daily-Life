const crypto = require("crypto");
const { sendToUser } = require("../lib/push");

function safeSecretMatch(candidate, expected) {
  const left = Buffer.from(String(candidate || ""));
  const right = Buffer.from(String(expected || ""));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(String(req.body || "{}"));
  } catch (error) {
    return {};
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const expected = process.env.SEND_SECRET;
  if (!expected) return res.status(503).json({ error: "send_not_configured" });
  if (!safeSecretMatch(req.headers["x-secret"], expected)) {
    console.warn("Rejected an unauthorized push send request.");
    return res.status(401).json({ error: "unauthorized" });
  }

  const body = requestBody(req);
  const userId = String(body.userId || "");
  if (!userId) return res.status(400).json({ error: "user_id_required" });

  try {
    const result = await sendToUser(userId, {
      title: String(body.title || "MYLIFE alert").slice(0, 120),
      body: String(body.body || "You have a new reminder.").slice(0, 500),
      url: String(body.url || "/#home").slice(0, 500)
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("MYLIFE push send failed.", error);
    return res.status(500).json({ error: "push_send_failed" });
  }
};