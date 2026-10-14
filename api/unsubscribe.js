const { createClient } = require("@supabase/supabase-js");
const { getRedis } = require("../lib/push");

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

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return res.status(503).json({ error: "supabase_not_configured" });
  const accessToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!accessToken) return res.status(401).json({ error: "unauthorized" });

  try {
    const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user } = {}, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return res.status(401).json({ error: "unauthorized" });

    const endpoint = String(requestBody(req).endpoint || "");
    if (!endpoint) return res.status(400).json({ error: "endpoint_required" });
    await getRedis().hdel(`mylife:push:subscriptions:${user.id}`, endpoint);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("MYLIFE could not remove a push subscription.", error);
    return res.status(500).json({ error: "unsubscribe_failed" });
  }
};