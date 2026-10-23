// Tells the owner (Telegram) when someone uses MYLIFE with his family:
//   join    — a person accepted a family invite            (once per person)
//   login   — a family member signed in / opened the app  (at most every 6 hours)
//   blocked — an unknown account tried to sign in and was turned away
//             (at most once a day per account, 20 a day in total)
// The app calls it with the person's own access token; the server checks who
// they really are and what family they are in, so nobody can fake another name.
const { createClient } = require("@supabase/supabase-js");
const { getRedis } = require("../lib/push");
const { tgCall, botConfigured } = require("../lib/telegram");
const { resolveOwner } = require("../lib/owner");

const ROLE_KM = { admin: "អ្នកគ្រប់គ្រង", member: "សមាជិក", viewer: "អ្នកមើល" };
const esc = value => String(value ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!domain) return "";
  return `${name.slice(0, Math.min(3, Math.max(1, name.length - 2)))}…@${domain}`;
}
function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(String(req.body || "{}")); } catch (error) { return {}; }
}
function phnomPenhTime() {
  return new Date().toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: "not_configured" });
  if (!botConfigured()) return res.status(200).json({ sent: false, reason: "bot_off" });

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "unauthorized" });
  const event = String(body(req).event || "");
  if (!["join", "login", "blocked"].includes(event)) return res.status(400).json({ error: "bad_event" });

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user } = {}, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "unauthorized" });

    const redis = getRedis();
    const owner = await resolveOwner(redis, supabase);
    if (!owner) return res.status(200).json({ sent: false, reason: "owner_unknown" });
    if (user.id === owner) return res.status(200).json({ sent: false, reason: "owner" });

    const providers = [...new Set([...(user.identities || []).map(item => item.provider), ...(user.app_metadata?.providers || [])])];
    const via = providers.includes("google") && !providers.includes("email") ? "Google" : providers.includes("google") ? "Email/Google" : "Email";
    const meta = user.user_metadata || {};

    const { data: rows } = await supabase.from("family_members").select("family_id, role, display_name").eq("user_id", user.id).limit(1);
    const member = (rows || [])[0];
    let family = null;
    if (member) {
      const { data } = await supabase.from("families").select("id, name, owner_id").eq("id", member.family_id).maybeSingle();
      family = data;
    }
    const inMyFamily = Boolean(family && family.owner_id === owner);

    let text = "";
    if (event === "blocked") {
      if (inMyFamily) return res.status(200).json({ sent: false, reason: "is_member" });
      const once = redis ? await redis.set(`mylife:fam-alert:blocked:${user.id}`, "1", { nx: true, ex: 86400 }) : "OK";
      const count = redis ? await redis.incr(`mylife:fam-alert:blocked-day:${new Date().toISOString().slice(0, 10)}`) : 1;
      if (redis && count === 1) await redis.expire(`mylife:fam-alert:blocked-day:${new Date().toISOString().slice(0, 10)}`, 90000);
      if (once === null || count > 20) return res.status(200).json({ sent: false, reason: "limited" });
      text = [
        "⚠️ <b>គណនីចម្លែកព្យាយាមចូល MYLIFE</b>",
        "",
        `👤 ${esc(meta.full_name || meta.name || "—")} · ${esc(maskEmail(user.email))}`,
        `🔑 ${via} · 🕒 ${esc(phnomPenhTime())}`,
        "",
        "<i>គ្មាន invite → app បាន logout វាភ្លាម មិនបានឃើញទិន្នន័យអ្វីទេ។</i>"
      ].join("\n");
    } else {
      if (!inMyFamily) return res.status(200).json({ sent: false, reason: "not_member" });
      const key = event === "join" ? `mylife:fam-alert:join:${user.id}` : `mylife:fam-alert:login:${user.id}`;
      const once = redis ? await redis.set(key, "1", { nx: true, ex: event === "join" ? 7 * 86400 : 6 * 3600 }) : "OK";
      if (once === null) return res.status(200).json({ sent: false, reason: "limited" });
      const name = member.display_name || meta.full_name || meta.name || maskEmail(user.email);
      text = [
        event === "join" ? "🎉 <b>សមាជិកថ្មីបានចូលរួមគ្រួសារ</b>" : "👋 <b>សមាជិកគ្រួសារបានចូល MYLIFE</b>",
        "",
        `👤 <b>${esc(name)}</b> · ${esc(ROLE_KM[member.role] || member.role)}`,
        `📧 ${esc(maskEmail(user.email))} · 🔑 ${via}`,
        `🏠 ${esc(family.name)} · 🕒 ${esc(phnomPenhTime())}`
      ].join("\n");
    }

    await tgCall("sendMessage", { chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true });
    return res.status(200).json({ sent: true });
  } catch (error) {
    console.error("MYLIFE family alert failed.", error.message);
    return res.status(500).json({ error: "failed" });
  }
};
