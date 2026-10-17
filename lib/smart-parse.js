// Server copy of the event form's smart parser (js/event-form.js), used for
// Telegram messages like "ស្អែក 9 ព្រឹក ជួបម៉ាក់" or "ចាយ 5$ អាហារ".

const KM_DAYS = ["អាទិត្យ", "ចន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
const EN_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const EVENT_KEYWORDS = [
  { category: "Family", re: /ថ្ងៃកំណើត|ខួប|birthday|anniversary|bday|គ្រួសារ|family/i },
  { category: "Bill", re: /វិក្កយបត្រ|បង់ថ្លៃ|ថ្លៃទឹក|ថ្លៃភ្លើង|អ៊ីនធឺណិត|bill|invoice|rent|electric|internet/i },
  { category: "Loan", re: /កម្ចី|បង់ធនាគារ|loan|installment|mortgage/i },
  { category: "Goal", re: /គោលដៅ|goal|target/i },
  { category: "Reminder", re: /រំលឹក|remind/i }
];

const EXPENSE_KEYWORDS = [
  { category: "Food", re: /អាហារ|ញ៉ាំ|បាយ|កាហ្វេ|ភេសជ្ជៈ|food|eat|lunch|dinner|breakfast|coffee|drink|meal/i },
  { category: "Transport", re: /សាំង|ឡាន|ម៉ូតូ|តាក់ស៊ី|grab|passapp|ធ្វើដំណើរ|transport|fuel|gas|taxi|bus|parking/i },
  { category: "Shopping", re: /ទិញ|ខោអាវ|ផ្សារ|shopping|shop|clothes|amazon/i },
  { category: "Home", re: /ផ្ទះ|ជួល|home|house|rent|furniture/i },
  { category: "Family", re: /គ្រួសារ|កូន|ម៉ាក់|ប៉ា|family|kid|mom|dad/i },
  { category: "Bills", re: /វិក្កយបត្រ|ថ្លៃទឹក|ថ្លៃភ្លើង|អ៊ីនធឺណិត|ទូរស័ព្ទ|bill|electric|water|internet|phone/i },
  { category: "Education", re: /សាលា|សៀវភៅ|វគ្គ|រៀន|school|book|course|class|education/i },
  { category: "Health", re: /ពេទ្យ|ថ្នាំ|មន្ទីរពេទ្យ|health|doctor|medicine|hospital|gym/i },
  { category: "Entertainment", re: /កុន|ហ្គេម|កម្សាន្ត|movie|game|netflix|fun|party|entertainment/i }
];

function normalizeDigits(text) {
  return String(text || "").replace(/[០-៩]/g, ch => String("០១២៣៤៥៦៧៨៩".indexOf(ch)));
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function weekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function to24(hour, minute, marker) {
  let h = Number(hour);
  const m = Number(minute || 0);
  if (h > 23 || m > 59) return "";
  const mk = String(marker || "").toLowerCase();
  if (/pm|រសៀល|ល្ងាច|យប់/.test(mk) && h < 12) h += 12;
  if (/am|ព្រឹក/.test(mk) && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * @returns {{ date?, time?, category?, familyMember?, title }}
 */
function parseEvent(raw, today, familyNames = []) {
  let text = normalizeDigits(raw).trim();
  const found = {};
  const marker = "(am|pm|a\\.m\\.|p\\.m\\.|ព្រឹក|រសៀល|ល្ងាច|យប់)?";
  const timePatterns = [
    new RegExp(`(\\d{1,2}):(\\d{2})\\s*${marker}`, "i"),
    new RegExp(`ម៉ោង\\s*(\\d{1,2})(?:\\s*(?:និង|:)\\s*(\\d{1,2}))?\\s*${marker}`, "i"),
    /\b(\d{1,2})()\s*(am|pm)\b/i,
    /(\d{1,2})()\s*(ព្រឹក|រសៀល|ល្ងាច|យប់)/
  ];
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const time = to24(match[1], match[2], match[3]);
    if (time) {
      found.time = time;
      text = text.replace(match[0], " ");
      break;
    }
  }

  const dateRules = [
    [/ខានស្អែក|day after tomorrow/i, () => addDays(today, 2)],
    [/ស្អែក|tomorrow|tmr/i, () => addDays(today, 1)],
    [/ថ្ងៃនេះ|today|tonight|យប់នេះ|ល្ងាចនេះ/i, () => today],
    [/សប្តាហ៍ក្រោយ|សប្ដាហ៍ក្រោយ|next week/i, () => addDays(today, 7)]
  ];
  for (const [re, value] of dateRules) {
    const match = text.match(re);
    if (match) {
      found.date = value();
      text = text.replace(match[0], " ");
      break;
    }
  }
  if (!found.date) {
    const todayIndex = weekday(today);
    let dayIndex = KM_DAYS.findIndex(day => text.includes(`ថ្ងៃ${day}`));
    let token = dayIndex >= 0 ? `ថ្ងៃ${KM_DAYS[dayIndex]}` : "";
    if (dayIndex < 0) {
      dayIndex = EN_DAYS.findIndex(day => new RegExp(`\\b${day}\\b`, "i").test(text));
      token = dayIndex >= 0 ? new RegExp(`\\b${EN_DAYS[dayIndex]}\\b`, "i") : "";
    }
    if (dayIndex >= 0) {
      found.date = addDays(today, ((dayIndex - todayIndex + 7) % 7) || 7);
      text = text.replace(token, " ");
    }
  }
  // explicit dates: 25/10, 25-10-2026
  if (!found.date) {
    const match = text.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
    if (match) {
      const [, d, m, y] = match;
      let year = y ? Number(y.length === 2 ? `20${y}` : y) : Number(today.slice(0, 4));
      let iso = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!y && iso < today) iso = `${year + 1}${iso.slice(4)}`;
      if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
        found.date = iso;
        text = text.replace(match[0], " ");
      }
    }
  }

  const keyword = EVENT_KEYWORDS.find(item => item.re.test(text));
  if (keyword) found.category = keyword.category;
  const member = familyNames.find(name => name && name.trim().length >= 2 && text.toLowerCase().includes(name.trim().toLowerCase()));
  if (member) {
    found.familyMember = member;
    if (!found.category) found.category = "Family";
  }

  found.title = text.replace(/\s+/g, " ").replace(/^[\s,.\-–:]+|[\s,.\-–:]+$/g, "").trim() || String(raw).trim();
  return found;
}

/**
 * "ចាយ 5$ អាហារ", "spent 12000 KHR grab", "-3.5 coffee"
 * @returns {{ amount, currency, category, description } | null}
 */
function parseExpense(raw, defaultCurrency = "USD") {
  const text = normalizeDigits(raw).trim();
  const lead = text.match(/^(?:ចាយ|ចំណាយ|spent|spend|pay|paid|expense|-)\s*/i);
  if (!lead) return null;
  const rest = text.slice(lead[0].length);
  const amountMatch = rest.match(/(\$|៛)?\s*(\d+(?:[.,]\d+)?)\s*(\$|usd|khr|៛|riel|រៀល|ដុល្លារ|k(?![a-z]))?/i);
  if (!amountMatch) return null;
  let amount = Number(amountMatch[2].replace(",", "."));
  const unit = `${amountMatch[1] || ""}${amountMatch[3] || ""}`.toLowerCase();
  let currency = defaultCurrency;
  if (/\$|usd|ដុល្លារ/.test(unit)) currency = "USD";
  if (/khr|៛|riel|រៀល/.test(unit)) currency = "KHR";
  if (unit === "k") {
    amount *= 1000;
    currency = "KHR";
  }
  if (!unit && amount >= 500) currency = "KHR";
  if (!amount || amount <= 0) return null;
  const description = rest.replace(amountMatch[0], " ").replace(/\s+/g, " ").trim();
  const keyword = EXPENSE_KEYWORDS.find(item => item.re.test(description));
  return { amount, currency, category: keyword ? keyword.category : "Other", description };
}

module.exports = { parseEvent, parseExpense, addDays };
