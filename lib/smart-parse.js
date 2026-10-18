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
  { category: "Bills", re: /វិក្កយបត្រ|ថ្លៃទឹក|ថ្លៃភ្លើង|អ៊ីនធឺណិត|កាតទូរស័ព្ទ|bill|electric|water bill|internet|wifi|phone card|top ?up|netflix|spotify|youtube|icloud|subscription/i },
  { category: "Food", re: /អាហារ|ញ៉ាំ|បាយ|កាហ្វេ|ភេសជ្ជៈ|តែ|ទឹកក្រូច|គុយទាវ|មី|នំ|ផ្លែឈើ|food|eat|lunch|dinner|breakfast|brunch|coffee|cafe|tea|drink|meal|snack|noodle|rice|pizza|burger|kfc|starbucks|amazon cafe|grocer/i },
  { category: "Transport", re: /សាំង|ឡាន|ម៉ូតូ|តាក់ស៊ី|កង់បី|រ៉ឺម៉ក|grab|passapp|pass app|tada|ធ្វើដំណើរ|transport|fuel|gas|petrol|taxi|tuk|bus|parking|ticket|flight/i },
  { category: "Shopping", re: /ទិញ|ខោអាវ|អាវ|ខោ|ស្បែកជើង|កាបូប|ផ្សារ|shopping|shop|cloth|shirt|t-shirt|pant|jean|shoe|sneaker|dress|bag|watch|amazon|taobao|shopee|lazada|gift/i },
  { category: "Home", re: /ផ្ទះ|ជួល|home|house|rent|furniture|kitchen|clean/i },
  { category: "Family", re: /គ្រួសារ|កូន|ម៉ាក់|ប៉ា|family|kid|mom|dad|baby/i },
  { category: "Education", re: /សាលា|សៀវភៅ|វគ្គ|រៀន|school|book|course|class|education|tuition/i },
  { category: "Health", re: /ពេទ្យ|ថ្នាំ|មន្ទីរពេទ្យ|ឱសថ|health|doctor|medicine|hospital|pharmacy|clinic|gym|dentist/i },
  { category: "Entertainment", re: /កុន|ហ្គេម|កម្សាន្ត|movie|cinema|game|fun|party|concert|karaoke|entertainment/i }
];

const INCOME_KEYWORDS = [
  { category: "Salary", re: /ប្រាក់ខែ|salary|payroll|wage/i },
  { category: "Bonus", re: /ប្រាក់រង្វាន់|bonus|reward|tip/i },
  { category: "Freelance", re: /freelance|client|project|design|job|គម្រោង|អតិថិជន/i },
  { category: "Business", re: /លក់|ហាង|business|shop|sale|sell|sold/i }
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
  const entry = parseMoney(raw, defaultCurrency, null);
  if (!entry || entry.type !== "expense") return null;
  return { amount: entry.amount, currency: entry.currency, category: entry.category, description: entry.description };
}

const EXPENSE_LEAD = /^(?:-|−|–|ចាយ|ចំណាយ|ទិញ(?=\s)|spent|spend|pay|paid|bought|buy|expense)\s*/i;
const INCOME_LEAD = /^(?:\+|ចំណូល|បានលុយ|ទទួលបាន|income|earned|received|got paid|got)\s*/i;
const UNIT = String.raw`usd|khr|riel|រៀល|ដុល្លារ|dollars?|\$|៛|k(?![a-z])|r(?![a-z])`;
const AMOUNT_RE = new RegExp(String.raw`(\$|៛)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\d+,\d{1,2})\s*(${UNIT})?`, "i");
// words that mean the line is about a time/plan, not money spent
const PLAN_WORDS = /\d{1,2}:\d{2}|\b\d{1,2}\s*(?:am|pm)\b|ម៉ោង|ព្រឹក|រសៀល|ល្ងាច|ស្អែក|tomorrow|\btmr\b|next week|សប្តាហ៍ក្រោយ|សប្ដាហ៍ក្រោយ|meeting|ជួប|\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b|ថ្ងៃ(?:ច័ន្ទ|អង្គារ|ពុធ|ព្រហស្បតិ៍|សុក្រ|សៅរ៍|អាទិត្យ)/i;

/**
 * One line of money from Telegram / chat.
 *  "-20$ for cloths", "20$ clothes", "lunch $4.5", "coffee 2", "ឡាន 5000៛",
 *  "+100$ salary", "-5$ coffee yesterday", "-3$ tea 12/10"
 * @param today ISO date ("2026-10-18") — used for "yesterday" / dd/mm; null = no dates
 * @returns {{ type: "expense"|"income", amount, currency, category, description, date? } | null}
 */
function parseMoney(raw, defaultCurrency = "USD", today = null) {
  let text = normalizeDigits(raw).replace(/\s+/g, " ").trim();
  if (!text) return null;
  let type = "";
  const income = text.match(INCOME_LEAD);
  const expense = !income && text.match(EXPENSE_LEAD);
  if (income) { type = "income"; text = text.slice(income[0].length); }
  else if (expense) { type = "expense"; text = text.slice(expense[0].length); }

  const amountMatch = text.match(AMOUNT_RE);
  if (!amountMatch) return null;
  const hasUnit = Boolean(amountMatch[1] || amountMatch[3]);
  if (!type) {
    // no "-" / "+": only money when it clearly looks like money and not a plan
    if (PLAN_WORDS.test(text)) return null;
    const words = text.replace(amountMatch[0], " ");
    const BARE = ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment"];
    if (!hasUnit && !EXPENSE_KEYWORDS.some(item => BARE.includes(item.category) && item.re.test(words))) return null;
    if (!hasUnit && text.replace(amountMatch[0], "").trim().split(" ").length > 4) return null;
    type = "expense";
  }

  const digits = amountMatch[2];
  let amount = Number(/^\d{1,3}(,\d{3})+/.test(digits) ? digits.replace(/,/g, "") : digits.replace(",", "."));
  const unit = `${amountMatch[1] || ""}${amountMatch[3] || ""}`.toLowerCase();
  let currency = defaultCurrency;
  if (/\$|usd|ដុល្លារ|dollar/.test(unit)) currency = "USD";
  if (/khr|៛|riel|រៀល/.test(unit) || unit === "r") currency = "KHR";
  if (unit === "k") { amount *= 1000; currency = "KHR"; }
  if (!unit && amount >= 500) currency = "KHR";
  if (!amount || amount <= 0 || !Number.isFinite(amount)) return null;

  let rest = text.replace(amountMatch[0], " ");
  let date;
  if (today) {
    const dayRules = [
      [/ម្សិលម៉្ងៃ|ម្សិលម្ងៃ|2 days ago/i, () => addDays(today, -2)],
      [/ម្សិលមិញ|yesterday|\byday\b|\bytd\b/i, () => addDays(today, -1)],
      [/ថ្ងៃនេះ|today/i, () => today]
    ];
    for (const [re, value] of dayRules) {
      const match = rest.match(re);
      if (match) { date = value(); rest = rest.replace(match[0], " "); break; }
    }
    if (!date) {
      const match = rest.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);
      if (match) {
        const [, d, m, y] = match;
        const year = y ? Number(y.length === 2 ? `20${y}` : y) : Number(today.slice(0, 4));
        let iso = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (!y && iso > today) iso = `${year - 1}${iso.slice(4)}`;
        if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31 && iso <= today) {
          date = iso;
          rest = rest.replace(match[0], " ");
        }
      }
    }
  }

  const keywords = type === "income" ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;
  const keyword = keywords.find(item => item.re.test(rest));
  const description = rest
    .replace(new RegExp(String.raw`(^|\s)(?:${UNIT.replace(/\|\\\$\|៛\|k\(\?!\[a-z\]\)\|r\(\?!\[a-z\]\)/, "")})(?=\s|$)`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:for|on|at|of|to|from|សម្រាប់|ពី|ឱ្យ|អោយ)\s+/i, "")
    .replace(/^[\s,.:;\-–]+|[\s,.:;\-–]+$/g, "")
    .trim();
  return { type, amount, currency, category: keyword ? keyword.category : "Other", description, ...(date ? { date } : {}) };
}

module.exports = { parseEvent, parseExpense, parseMoney, addDays };
