// Builds the bilingual (Khmer + English) Telegram message for a MYLIFE alert.
// Output uses Telegram HTML parse mode, so Make only has to forward `text`.

const APP_URL = process.env.APP_URL || "https://daily-life-2.vercel.app";

const KIND = {
  calendar: { icon: "📅", km: "ព្រឹត្តិការណ៍", en: "Event" },
  reminder: { icon: "⏰", km: "ការរំលឹក", en: "Reminder" },
  bill: { icon: "🧾", km: "វិក្កយបត្រ", en: "Bill" },
  loan: { icon: "💳", km: "កម្ចី", en: "Loan payment" },
  "savings-contribution": { icon: "💰", km: "សន្សំប្រចាំខែ", en: "Monthly saving" },
  "savings-deadline": { icon: "🎯", km: "ផុតកំណត់សន្សំ", en: "Savings deadline" },
  birthday: { icon: "🎂", km: "ថ្ងៃកំណើត", en: "Birthday" },
  anniversary: { icon: "💞", km: "ខួប", en: "Anniversary" }
};

const KM_WEEKDAYS = ["អាទិត្យ", "ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Generic fallbacks the server uses when an item has no notes; not worth showing.
const GENERIC_BODIES = new Set([
  "Upcoming event",
  "Upcoming reminder",
  "Bill payment is due",
  "Loan payment is due",
  "Savings deadline",
  "It is time."
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function dateLabels(dateValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
  if (!match) return { km: String(dateValue || ""), en: String(dateValue || "") };
  const [, y, m, d] = match.map(Number);
  // Pure calendar arithmetic, independent of the server time zone.
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    km: `ថ្ងៃ${KM_WEEKDAYS[weekday]} ${d} ${KM_MONTHS[m - 1]} ${y}`,
    en: `${EN_WEEKDAYS[weekday]}, ${d} ${EN_MONTHS[m - 1]} ${y}`
  };
}

function timeLabels(timeValue, hasTime) {
  if (!hasTime) return { km: "ពេញមួយថ្ងៃ", en: "All day" };
  const match = /^(\d{1,2}):(\d{2})/.exec(String(timeValue || ""));
  if (!match) return { km: String(timeValue), en: String(timeValue) };
  const hour = Number(match[1]);
  const minute = match[2];
  const hour12 = hour % 12 || 12;
  const period = hour < 12 ? "ព្រឹក" : hour < 18 ? "រសៀល" : "ល្ងាច";
  return {
    km: `${hour12}:${minute} ${period}`,
    en: `${hour12}:${minute} ${hour < 12 ? "AM" : "PM"}`
  };
}

function appLink(item) {
  const path = String(item.url || "/").replace(/^\/?/, "/");
  return `${APP_URL}${path}`;
}

/**
 * @param {object} item  dispatch item: { kind, title, body, date, time, hasTime, url }
 * @returns {string} Telegram HTML message
 */
function buildTelegramText(item) {
  const kind = KIND[item.kind] || KIND.reminder;
  const date = dateLabels(item.date);
  const time = timeLabels(item.time, item.hasTime !== false);
  const body = String(item.body || "").trim();
  const showBody = body && !GENERIC_BODIES.has(body);

  const lines = [
    `🔔 <b>MYLIFE · ការរំលឹក / Reminder</b>`,
    "",
    `${kind.icon} <b>${escapeHtml(item.title || "MYLIFE")}</b>`
  ];

  if (showBody) body.split("\n").filter(Boolean).forEach(line => lines.push(`📝 ${escapeHtml(line)}`));

  lines.push(
    "",
    `📆 ${escapeHtml(date.km)}`,
    `      <i>${escapeHtml(date.en)}</i>`,
    `🕒 ${escapeHtml(time.km)} · <i>${escapeHtml(time.en)}</i>`,
    `🏷️ ${kind.km} · <i>${kind.en}</i>`,
    "",
    `👉 <a href="${escapeHtml(appLink(item))}">បើក MYLIFE · Open MYLIFE</a>`
  );

  return lines.join("\n");
}

module.exports = { buildTelegramText };
