// Which MYLIFE account owns the Telegram group (QC finding B2).
//
// The bot, the scheduled alerts and the report sender all post into ONE chat
// (TELEGRAM_CHAT_ID), so only one account may use them. Anyone can sign up in
// the app, so the server must never post another account's reminders, backup
// file or reports into the owner's group.
//
// Owner, in order:
//   1. env MYLIFE_OWNER_USER_ID (most reliable — set it in Vercel)
//   2. the account already linked in Redis (mylife:tg:owner)
//   3. the only row in app_data, when there is exactly one (then remembered)
// Otherwise null = unknown: callers fail closed and send nothing.

const OWNER_KEY = "mylife:tg:owner";

function ownerFromEnv() {
  const value = String(process.env.MYLIFE_OWNER_USER_ID || "").trim();
  return value || null;
}

/**
 * @param redis   Upstash client (get/set)
 * @param supabase service-role client, used only for the "single account" fallback
 */
async function resolveOwner(redis, supabase) {
  const fromEnv = ownerFromEnv();
  if (fromEnv) return fromEnv;
  const known = redis ? await redis.get(OWNER_KEY) : null;
  if (known) return String(known);
  if (!supabase) return null;
  const { data, error } = await supabase.from("app_data").select("user_id").limit(2);
  if (error) throw error;
  if ((data || []).length === 1 && data[0].user_id) {
    if (redis) await redis.set(OWNER_KEY, data[0].user_id, { nx: true });
    return String(data[0].user_id);
  }
  return null;
}

async function isOwner(userId, redis, supabase) {
  if (!userId) return false;
  const owner = await resolveOwner(redis, supabase);
  return Boolean(owner) && String(owner) === String(userId);
}

// First link from a button press: only when no owner is known yet; never replaces one.
async function linkOwnerIfUnknown(userId, redis) {
  if (!userId || !redis || ownerFromEnv()) return false;
  const result = await redis.set(OWNER_KEY, String(userId), { nx: true });
  return result !== null;
}

module.exports = { resolveOwner, isOwner, linkOwnerIfUnknown, OWNER_KEY };
