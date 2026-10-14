const { createClient } = require("@supabase/supabase-js");
const { getRedis, isValidTimeZone } = require("../lib/push");

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
    const { data: { user } = {}, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return res.status(401).json({ error: "unauthorized" });

    const body = requestBody(req);
    const subscription = body.subscription;
    let endpoint;
    try {
      endpoint = new URL(subscription?.endpoint);
    } catch (error) {
      return res.status(400).json({ error: "invalid_subscription" });
    }
    if (endpoint.protocol !== "https:" || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "invalid_subscription" });
    }

    const timeZone = isValidTimeZone(String(body.timeZone || "UTC"));
    await getRedis().hset(`mylife:push:subscriptions:${user.id}`, {
      [subscription.endpoint]: JSON.stringify({ subscription, timeZone })
    });
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("MYLIFE could not save a push subscription.", error);
    return res.status(500).json({ error: "subscription_save_failed" });
  }
};