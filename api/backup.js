// Weekly cloud backups (written by /api/dispatch) for the signed-in user.
// GET /api/backup            → { backups: ["2026-10-18", ...] }
// GET /api/backup?date=YYYY-MM-DD → the backup payload (JSON)
// Requires the user's Supabase access token: Authorization: Bearer <token>.

const { createClient } = require("@supabase/supabase-js");
const { getRedis } = require("../lib/push");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "unauthorized" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "not_configured" });
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) return res.status(401).json({ error: "unauthorized" });
    const userId = data.user.id;
    const redis = getRedis();

    const date = String(req.query?.date || "");
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "bad_date" });
      const raw = await redis.get(`mylife:backup:${userId}:${date}`);
      if (!raw) return res.status(404).json({ error: "not_found" });
      const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
      return res.status(200).json({ date, payload });
    }

    const dates = (await redis.lrange(`mylife:backups:${userId}`, 0, 4)) || [];
    return res.status(200).json({ backups: dates });
  } catch (error) {
    console.error("MYLIFE backup request failed.", error.message);
    return res.status(500).json({ error: "backup_failed" });
  }
};
