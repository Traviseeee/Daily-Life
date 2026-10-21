/* Smart text parser shared by the Telegram bot (api/, via lib/smart-parse.js)
 * and MYLIFE Chat in the app (window.SmartParse). Keep it dependency-free. */
(function (root) {
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

// Expense words by category — shared by the Telegram bot, MYLIFE Chat and the
// app's expense form, so "សាំង 5$", "ខោអាវ 12$" or "Grab 15k" always land in the
// same category. Khmer words match anywhere in the text; English words match as
// whole words (plural s/es allowed). The longest word that matches wins, so
// "ទិញបាយ" is Food, "សំបុត្រកុន" is Entertainment and "ជួលឡាន" is Transport.
// Words starting with "~" are weak (e.g. "ទិញ" = buy): used only when nothing else matches.
// Avoid short Khmer pieces that sit inside other words (តែ, មី, គោ, ត្រី, បង, តុ, មាស).
const EXPENSE_WORDS = {
  Bills: {
    km: ["វិក្កយបត្រ", "ថ្លៃទឹក", "ថ្លៃភ្លើង", "ភ្លើងEDC", "ភ្លើង EDC", "ទឹកPPWSA", "ទឹក PPWSA", "អ៊ីនធឺណិត", "អ៊ីនធើណែត", "វ៉ាយហ្វាយ", "កាតទូរស័ព្ទ", "បញ្ចូលលុយទូរស័ព្ទ", "ថ្លៃសំរាម", "ថ្លៃសេវា", "ធានារ៉ាប់រង", "ថ្លៃខ្សែកាប"],
    en: ["bill", "electric", "electricity", "edc", "ppwsa", "water bill", "internet", "wifi", "wi-fi", "phone card", "top up", "topup", "data plan", "cellcard", "metfone", "netflix", "spotify", "youtube premium", "youtube", "icloud", "google one", "chatgpt", "subscription", "insurance", "cable tv", "garbage"]
  },
  Food: {
    km: ["អាហារ", "ញ៉ាំ", "បាយ", "ម្ហូប", "កាហ្វេ", "ភេសជ្ជៈ", "ទឹកក្រូច", "ទឹកតែ", "តែបៃតង", "តែទឹកដោះ", "តែក្រូចឆ្មា", "តែគុជ", "គុយទាវ", "មីឆា", "មីសួ", "មីកញ្ចប់", "មីគ្រាប់", "នំបញ្ចុក", "នំប៉័ង", "នំខេក", "នំ", "បបរ", "សម្ល", "ផ្លែឈើ", "សាច់", "សាច់គោ", "សាច់ជ្រូក", "សាច់មាន់", "មាន់", "សាច់ទា", "ត្រីអាំង", "ត្រីចៀន", "ត្រីងៀត", "បង្គា", "ក្តាម", "គ្រឿងសមុទ្រ", "បន្លែ", "អង្ករ", "ស៊ុត", "ទឹកដោះគោ", "ទឹកសុទ្ធ", "ទឹកកក", "ទឹកដូង", "ទឹកអំពៅ", "ការ៉េម", "ស្ករ", "អំបិល", "ប្រេងឆា", "ទឹកត្រី", "ប៊ីយែរ", "ស្រាបៀរ", "បៀរ", "ភោជនីយដ្ឋាន", "ហាងបាយ", "សាច់អាំង", "ស៊ុប", "ផ្សារទំនើប", "អាហារពេលព្រឹក", "អាហារថ្ងៃត្រង់", "អាហារពេលល្ងាច"],
    en: ["food", "eat", "lunch", "dinner", "breakfast", "brunch", "meal", "snack", "coffee", "cafe", "café", "latte", "cappuccino", "tea", "milk tea", "bubble tea", "boba", "drink", "juice", "smoothie", "water", "noodle", "rice", "soup", "pizza", "burger", "sandwich", "chicken", "pork", "beef", "fish", "seafood", "shrimp", "fruit", "vegetable", "veggie", "grocery", "groceries", "supermarket", "bakery", "bread", "cake", "dessert", "ice cream", "beer", "wine", "restaurant", "bbq", "hotpot", "sushi", "ramen", "kfc", "mcdonald", "mcdonalds", "burger king", "pizza company", "pizza hut", "domino", "starbucks", "amazon cafe", "cafe amazon", "brown coffee", "tube coffee", "chatime", "koi", "texas chicken", "lucky burger", "foodpanda", "nham24", "wow now", "lucky supermarket", "chip mong supermarket"]
  },
  Transport: {
    km: ["សាំង", "ប្រេងសាំង", "ចាក់សាំង", "ម្ស៉ូត", "ឡាន", "ម៉ូតូ", "ម៉ូតូឌុប", "តាក់ស៊ី", "កង់បី", "រ៉ឺម៉ក", "ឡានក្រុង", "យន្តហោះ", "សំបុត្រយន្តហោះ", "សំបុត្រឡាន", "ចតឡាន", "ចំណតឡាន", "ថ្លៃចត", "ផ្លាស់ប្រេង", "ប្តូរប្រេង", "ជួសជុលម៉ូតូ", "ជួសជុលឡាន", "បូមកង់", "កង់ឡាន", "លាងឡាន", "លាងម៉ូតូ", "ជួលឡាន", "ជួលម៉ូតូ", "ធ្វើដំណើរ", "ថ្លៃធ្វើដំណើរ", "ថ្លៃផ្លូវ"],
    en: ["grab", "passapp", "pass app", "tada", "transport", "fuel", "gas", "petrol", "gasoline", "diesel", "taxi", "tuk", "tuktuk", "tuk tuk", "remork", "bus", "parking", "flight", "plane ticket", "ferry", "train", "toll", "car wash", "oil change", "motorbike", "moto", "car repair", "bike repair", "tire", "tyre", "car rental", "rent car", "rent a car", "rent moto", "caltex", "ptt", "tela", "total energies", "totalenergies", "sokimex", "ticket"]
  },
  Shopping: {
    km: ["~ទិញ", "ខោអាវ", "អាវ", "ខោ", "សំលៀកបំពាក់", "សម្លៀកបំពាក់", "អាវយឺត", "ខោខូវប៊យ", "សំពត់", "ស្បែកជើង", "កាបូប", "មួក", "វ៉ែនតា", "នាឡិកា", "គ្រឿងសំអាង", "ទឹកអប់", "ក្រែម", "ក្រែមលាបមុខ", "ទូរស័ព្ទថ្មី", "កុំព្យូទ័រ", "កាស", "ឆ្នាំងសាក", "ខ្សែសាក", "គ្រឿងអលង្ការ", "កាដូ", "~ផ្សារ", "ហាងទំនិញ", "កាត់សក់", "ធ្វើក្រចក", "ធ្វើសក់"],
    en: ["~buy", "~bought", "shopping", "shop", "mall", "aeon", "clothes", "cloth", "clothing", "shirt", "t-shirt", "tshirt", "pants", "jeans", "shorts", "shoes", "sneakers", "dress", "skirt", "bag", "watch", "glasses", "hat", "cap", "cosmetics", "makeup", "skincare", "perfume", "lotion", "phone case", "charger", "headphone", "earbuds", "airpods", "laptop", "iphone", "gadget", "electronics", "amazon", "taobao", "shopee", "lazada", "temu", "gift", "present", "haircut", "barber", "salon", "nails"]
  },
  Home: {
    km: ["ផ្ទះ", "ជួលផ្ទះ", "ថ្លៃជួល", "ថ្លៃផ្ទះ", "~ជួល", "គ្រឿងសង្ហារិម", "កៅអី", "ពូក", "ភួយ", "ខ្នើយ", "វាំងនន", "ចានឆ្នាំង", "ឆ្នាំង", "ខ្ទះ", "សម្អាត", "សាប៊ូបោកខោអាវ", "ម្សៅសាប៊ូ", "ទឹកលាងចាន", "អំពូល", "ជួសជុលផ្ទះ", "បំពង់ទឹក", "ម៉ាស៊ីនត្រជាក់", "កង្ហារ", "ទូទឹកកក", "ម៉ាស៊ីនបោកខោអាវ", "បោកអ៊ុត"],
    en: ["home", "house", "rent", "apartment", "condo", "furniture", "kitchen", "cleaning", "clean", "detergent", "laundry", "plumber", "~repair", "lamp", "bulb", "sofa", "bed", "mattress", "pillow", "curtain", "air conditioner", "aircon", "fan", "fridge", "washing machine", "hardware"]
  },
  Family: {
    km: ["គ្រួសារ", "កូន", "ម៉ាក់", "ប៉ា", "ឪពុក", "ម្តាយ", "ម្ដាយ", "ប្អូន", "យាយ", "ជីដូន", "ជីតា", "ប្រពន្ធ", "ប្តី", "ទារក", "កន្ទប", "ទឹកដោះគោម្សៅ", "ប្រដាប់ក្មេងលេង", "លុយកូន", "ចងដៃ", "មង្គលការ", "បុណ្យ", "ខួប"],
    en: ["family", "kid", "kids", "child", "children", "mom", "mum", "mother", "dad", "father", "parents", "wife", "husband", "baby", "diaper", "pampers", "formula", "toy", "wedding", "funeral"]
  },
  Education: {
    km: ["សាលា", "ថ្លៃសាលា", "ថ្លៃសិក្សា", "សៀវភៅ", "វគ្គ", "វគ្គសិក្សា", "រៀន", "ថ្នាក់", "គ្រូ", "ប៊ិច", "ខ្មៅដៃ", "សម្ភារៈសិក្សា", "បោះពុម្ព", "ថតចម្លង", "ប្រឡង"],
    en: ["school", "book", "course", "class", "education", "tuition", "study", "exam", "stationery", "pen", "notebook", "printing", "print", "photocopy", "udemy", "coursera", "ielts", "toefl"]
  },
  Health: {
    km: ["ពេទ្យ", "គ្រូពេទ្យ", "ពេទ្យធ្មេញ", "ថ្នាំ", "មន្ទីរពេទ្យ", "ឱសថ", "ឱសថស្ថាន", "គ្លីនិក", "ពិនិត្យសុខភាព", "ធ្មេញ", "វីតាមីន", "ម៉ាស់", "ហាត់ប្រាណ", "ម៉ាស្សា", "ចាក់ថ្នាំ"],
    en: ["health", "doctor", "medicine", "med", "meds", "hospital", "pharmacy", "clinic", "gym", "fitness", "dentist", "dental", "vitamin", "checkup", "check up", "mask", "massage", "spa", "u-care", "ucare"]
  },
  Entertainment: {
    km: ["កុន", "ភាពយន្ត", "សំបុត្រកុន", "ហ្គេម", "កម្សាន្ត", "ខារ៉ាអូខេ", "ដើរលេង", "ដំណើរកម្សាន្ត", "សណ្ឋាគារ", "រីសត", "តន្ត្រី", "ប្រគុំតន្ត្រី"],
    en: ["movie", "cinema", "film", "game", "gaming", "steam", "playstation", "fun", "party", "concert", "karaoke", "entertainment", "hotel", "resort", "trip", "vacation", "holiday", "tour", "bar", "club", "pub", "bowling", "movie ticket", "legend cinema", "major cineplex", "prime cineplex"]
  }
};

const escapeRe = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EXPENSE_MATCHERS = Object.entries(EXPENSE_WORDS).map(([category, words]) => ({
  category,
  words: [
    ...words.km.map(word => ({ weak: word.startsWith("~"), size: word.replace("~", "").length, re: new RegExp(escapeRe(word.replace("~", "")), "i") })),
    ...words.en.map(word => ({ weak: word.startsWith("~"), size: word.replace("~", "").length, re: new RegExp(String.raw`(?:^|[^a-z0-9])${escapeRe(word.replace("~", "")).replace(/ /g, "\\s*")}(?:s|es)?(?![a-z0-9])`, "i") }))
  ]
}));

// best expense category for a text, or "" when no word matches
function categorizeExpense(text) {
  const value = String(text || "").toLowerCase();
  if (!value.trim()) return "";
  let best = null;
  EXPENSE_MATCHERS.forEach(({ category, words }, order) => {
    words.forEach(word => {
      if (!word.re.test(value)) return;
      const score = word.weak ? 0.5 : word.size;
      if (!best || score > best.score) best = { category, score, order };
    });
  });
  return best ? best.category : "";
}

// kept for older callers: { category, re } with re.test() = "a word of this category is in the text"
const EXPENSE_KEYWORDS = EXPENSE_MATCHERS.map(({ category, words }) => ({ category, re: { test: text => words.some(word => !word.weak && word.re.test(String(text || "").toLowerCase())) } }));

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
function hasUnitOrBare(text) {
  return /\d/.test(text);
}

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
  if (!type && /^\d+(?:[.,]\d+)?\s*(?:\$|៛|usd|khr|k|r)?$/i.test(text)) type = "expense"; // just "5000" or "2.5$"
  if (!type && hasUnitOrBare(text) && /ប្រាក់ខែ|ប្រាក់រង្វាន់|salary|payroll|bonus/i.test(text) && !PLAN_WORDS.test(text)) type = "income";
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
      [/ខានស្អែក|day after tomorrow/i, () => addDays(today, 2)],
      [/ស្អែក|tomorrow|\btmr\b/i, () => addDays(today, 1)],
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
        // no year: a date up to 60 days ahead is this year (planned), further ahead means last year
        if (!y && iso > addDays(today, 60)) iso = `${year - 1}${iso.slice(4)}`;
        if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
          date = iso;
          rest = rest.replace(match[0], " ");
        }
      }
    }
  }

  const keyword = type === "income" ? INCOME_KEYWORDS.find(item => item.re.test(rest)) : (category => category ? { category } : null)(categorizeExpense(rest));
  const description = rest
    .replace(new RegExp(String.raw`(^|\s)(?:${UNIT.replace(/\|\\\$\|៛\|k\(\?!\[a-z\]\)\|r\(\?!\[a-z\]\)/, "")})(?=\s|$)`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:for|on|at|of|to|from|សម្រាប់|ពី|ឱ្យ|អោយ)\s+/i, "")
    .replace(/^[\s,.:;\-–]+|[\s,.:;\-–]+$/g, "")
    .trim();
  return { type, amount, currency, category: keyword ? keyword.category : "Other", description, ...(date ? { date } : {}) };
}

const api = { parseEvent, parseExpense, parseMoney, addDays, categorizeExpense, EXPENSE_WORDS };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.SmartParse = api;
})(typeof window !== "undefined" ? window : globalThis);
