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
  anniversary: { icon: "💞", km: "ខួប", en: "Anniversary" },
  digest: { icon: "☀️", km: "សង្ខេបព្រឹក", en: "Morning digest" },
  budget: { icon: "📊", km: "ថវិកា", en: "Budget" },
  weekly: { icon: "📈", km: "របាយការណ៍ប្រចាំសប្តាហ៍", en: "Weekly report" },
  expense: { icon: "💸", km: "ចំណាយ", en: "Expense" },
  goal: { icon: "🎯", km: "គោលដៅ", en: "Goal" }
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
function beforeLabels(minutes) {
  const m = Number(minutes || 0);
  if (m >= 1440 && m % 1440 === 0) {
    const d = m / 1440;
    return { km: `${d} ថ្ងៃទៀត`, en: `in ${d} day${d === 1 ? "" : "s"}` };
  }
  if (m >= 60 && m % 60 === 0) {
    const h = m / 60;
    return { km: `${h} ម៉ោងទៀត`, en: `in ${h} hour${h === 1 ? "" : "s"}` };
  }
  return { km: `${m} នាទីទៀត`, en: `in ${m} min` };
}

function buildTelegramText(item) {
  if (item.kind === "digest") return buildDigestText(item);
  if (item.kind === "weekly") return buildWeeklyText(item);
  if (item.kind === "budget") return buildBudgetText(item);
  const kind = KIND[item.kind] || KIND.reminder;
  const date = dateLabels(item.date);
  const time = timeLabels(item.time, item.hasTime !== false);
  const body = String(item.body || "").trim();
  const showBody = body && !GENERIC_BODIES.has(body);

  const header = item.early
    ? `⏳ <b>MYLIFE · ជិតដល់ពេល / Coming up</b>`
    : item.snoozed
      ? `⏰ <b>MYLIFE · រំលឹកម្ដងទៀត / Reminder again</b>`
      : `🔔 <b>MYLIFE · ការរំលឹក / Reminder</b>`;
  const lines = [header, "", `${kind.icon} <b>${escapeHtml(item.title || "MYLIFE")}</b>`];
  if (item.early) {
    const before = beforeLabels(item.early);
    lines.push(`⏳ ${escapeHtml(before.km)} · <i>${escapeHtml(before.en)}</i>`);
  }

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

/* ---------------- morning digest ---------------- */

function entryLine(entry) {
  const kind = KIND[entry.kind] || KIND.reminder;
  const time = entry.hasTime ? timeLabels(entry.time, true).km : "ពេញថ្ងៃ";
  const extra = entry.extra ? ` — ${escapeHtml(entry.extra)}` : "";
  return `• <b>${escapeHtml(time)}</b>  ${kind.icon} ${escapeHtml(entry.title)}${extra}`;
}

/**
 * item.digest = { today: [...entries], tomorrow: [...], overdue: [...], upcoming: [{title, kind, days, date}] }
 * entry = { kind, title, time, hasTime, extra }
 */
function buildDigestText(item) {
  const digest = item.digest || {};
  const today = digest.today || [];
  const tomorrow = digest.tomorrow || [];
  const overdue = digest.overdue || [];
  const upcoming = digest.upcoming || [];
  const date = dateLabels(item.date);

  const lines = [
    item.heading || `☀️ <b>អរុណសួស្តី · Good morning</b>`,
    `📆 ${escapeHtml(date.km)} · <i>${escapeHtml(date.en)}</i>`,
    ""
  ];

  if (today.length) {
    lines.push(`📋 <b>ថ្ងៃនេះ · Today</b> (${today.length})`);
    today.forEach(entry => lines.push(entryLine(entry)));
  } else {
    lines.push(`🌿 <b>ថ្ងៃនេះទំនេរ</b> · <i>Nothing scheduled today</i>`);
  }

  if (overdue.length) {
    lines.push("", `⚠️ <b>មិនទាន់បង់ · Overdue</b> (${overdue.length})`);
    overdue.forEach(entry => lines.push(`• ${(KIND[entry.kind] || KIND.bill).icon} ${escapeHtml(entry.title)}${entry.extra ? ` — ${escapeHtml(entry.extra)}` : ""}`));
  }

  if (tomorrow.length) {
    lines.push("", `🔜 <b>ស្អែក · Tomorrow</b> (${tomorrow.length})`);
    tomorrow.forEach(entry => lines.push(entryLine(entry)));
  }

  if (upcoming.length) {
    lines.push("", `🎉 <b>ឆាប់ៗនេះ · Coming soon</b>`);
    upcoming.forEach(entry => {
      const icon = (KIND[entry.kind] || KIND.birthday).icon;
      lines.push(`• ${icon} ${escapeHtml(entry.title)} — ${entry.days} ថ្ងៃទៀត · <i>in ${entry.days} days</i>`);
    });
  }

  lines.push("", `👉 <a href="${escapeHtml(appLink(item))}">បើក MYLIFE · Open MYLIFE</a>`);
  return lines.join("\n");
}

/* ---------------- budget + weekly ---------------- */

function buildBudgetText(item) {
  const over = Number(item.level) >= 100;
  const lines = [
    over ? `🚨 <b>លើសថវិកាហើយ · Over budget</b>` : `📊 <b>ជិតអស់ថវិកា · Budget at ${escapeHtml(item.percent)}%</b>`,
    "",
    `🏷️ <b>${escapeHtml(item.title)}</b>`
  ];
  String(item.body || "").split("\n").filter(Boolean).forEach(line => lines.push(`• ${escapeHtml(line)}`));
  lines.push("", `👉 <a href="${escapeHtml(appLink(item))}">មើលថវិកា · Open budget</a>`);
  return lines.join("\n");
}

function buildWeeklyText(item) {
  const w = item.weekly || {};
  const from = dateLabels(w.from);
  const to = dateLabels(w.to);
  const lines = [
    `📈 <b>របាយការណ៍ប្រចាំសប្តាហ៍ · Weekly report</b>`,
    `<i>${escapeHtml(from.en)} – ${escapeHtml(to.en)}</i>`,
    "",
    `💸 ចាយសប្តាហ៍នេះ · Spent: <b>${escapeHtml(w.spent || "$0")}</b> (${Number(w.count || 0)} ដង)`
  ];
  if (w.change === null || w.change === undefined) {
    lines.push(`↔️ សប្តាហ៍មុន · Last week: ${escapeHtml(w.before || "$0")}`);
  } else if (w.change > 0) {
    lines.push(`🔺 ច្រើនជាងសប្តាហ៍មុន ${w.change}% · ${w.change}% more (${escapeHtml(w.before)})`);
  } else if (w.change < 0) {
    lines.push(`🟢 តិចជាងសប្តាហ៍មុន ${Math.abs(w.change)}% · ${Math.abs(w.change)}% less (${escapeHtml(w.before)})`);
  } else {
    lines.push(`↔️ ស្មើសប្តាហ៍មុន · Same as last week`);
  }
  if (w.income) lines.push(`💵 ចំណូល · Income: ${escapeHtml(w.income)}`);
  if ((w.top || []).length) {
    lines.push("", `🏷️ <b>ចាយច្រើនជាងគេ · Top spending</b>`);
    w.top.forEach((entry, index) => lines.push(`${index + 1}. ${escapeHtml(entry.km)} — ${escapeHtml(entry.amount)} (${entry.share}%)`));
  }
  if ((w.budgets || []).length) {
    lines.push("", `📊 <b>ថវិកាខែនេះ · Budgets this month</b>`);
    w.budgets.forEach(entry => {
      const dot = entry.percent >= 100 ? "🔴" : entry.percent >= 80 ? "🟠" : "🟢";
      lines.push(`${dot} ${escapeHtml(entry.km)} ${entry.percent}%`);
    });
  }
  if (w.billsNext) lines.push("", `🧾 វិក្កយបត្រសប្តាហ៍ក្រោយ · Bills next week: <b>${w.billsNext}</b>`);
  lines.push("", `👉 <a href="${escapeHtml(appLink(item))}">មើលរបាយការណ៍ · Open reports</a>`);
  return lines.join("\n");
}

module.exports = { buildTelegramText, buildDigestText, buildWeeklyText, buildBudgetText, dateLabels, timeLabels, escapeHtml };
