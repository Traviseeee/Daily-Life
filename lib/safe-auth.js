// Small auth helpers shared by the API routes.
const crypto = require("crypto");

// Constant-time "Authorization: Bearer <secret>" check (no early exit on the first wrong char).
function bearerMatches(header, secret) {
  if (!secret) return false;
  const a = crypto.createHash("sha256").update(String(header || "")).digest();
  const b = crypto.createHash("sha256").update(`Bearer ${secret}`).digest();
  return crypto.timingSafeEqual(a, b);
}

// Who may use the bot inside the MYLIFE chat.
// TELEGRAM_ALLOWED_USER_IDS (optional, comma separated Telegram user ids) limits
// a group chat to those people; unset = everyone in the chat (old behaviour).
function telegramSenderAllowed(from) {
  const list = String(process.env.TELEGRAM_ALLOWED_USER_IDS || "").split(/[\s,]+/).filter(Boolean);
  if (!list.length) return true;
  return Boolean(from && list.includes(String(from.id)));
}

module.exports = { bearerMatches, telegramSenderAllowed };
