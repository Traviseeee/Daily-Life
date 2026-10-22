/* MYLIFE AI (Google Gemini), shared by the app (window.AiAssist) and the
 * server (require("../js/ai-assist.js")): the Telegram bot and MYLIFE Chat.
 *
 * The API key is the user's own. It is typed in Settings → AI and kept in
 * profile.aiSettings.apiKey (their own synced data). The server can also use
 * the GEMINI_API_KEY environment variable. The key is never put in backups:
 * use AiAssist.withoutSecrets(payload) before exporting data.
 *
 * Only a short summary of the user's data is sent to Gemini (totals, recent
 * expenses, bills, loans, events, goals), never photos, phone numbers or notes. */
(function (root) {
// fastest first: a phone or the bot should get an answer in a few seconds.
// A slow model (long "thinking") is skipped after a few seconds and the next one tried.
const MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];
let goodModel = ""; // the last model that answered — tried first next time
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/";
const KHR_PER_USD = 4100;
const EXPENSE_CATEGORIES = ["Food", "Home", "Family", "Transport", "Shopping", "Bills", "Loan", "Education", "Health", "Entertainment", "Other"];
const INCOME_CATEGORIES = ["Salary", "Business", "Freelance", "Bonus", "Gift", "Other"];

/* ---------------- settings ---------------- */
function settingsOf(payload, env = {}) {
  const saved = (payload && payload.profile && payload.profile.aiSettings) || {};
  const apiKey = String(saved.apiKey || env.GEMINI_API_KEY || "").trim();
  return {
    apiKey,
    model: String(saved.model || env.GEMINI_MODEL || "").trim(),
    enabled: saved.enabled !== false && Boolean(apiKey),
    telegram: saved.telegram !== false
  };
}

// a copy of the data with the API key removed (for backups and exports)
function withoutSecrets(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const copy = JSON.parse(JSON.stringify(payload));
  if (copy.profile && copy.profile.aiSettings) {
    delete copy.profile.aiSettings.apiKey;
  }
  return copy;
}

const maskKey = key => (key ? `${String(key).slice(0, 4)}••••${String(key).slice(-4)}` : "");

/* ---------------- Gemini call ---------------- */
class AiError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

async function callGemini(settings, { system, prompt, json = false, maxTokens = 700, temperature = 0.4, timeoutMs = 14000, totalMs = 40000 }) {
  if (!settings || !settings.apiKey) throw new AiError("no_key", "No Gemini API key");
  const order = [settings.model, goodModel, ...MODELS].filter(Boolean);
  const models = order.filter((model, index) => order.indexOf(model) === index);
  const started = Date.now();
  let lastError = null;
  const attempts = [];
  models.forEach(model => { attempts.push({ model, thinking: true }); attempts.push({ model, thinking: false, onlyIf: "thinking" }); });
  let skipNoThinking = true;
  for (const { model, thinking, onlyIf } of attempts) {
    if (onlyIf && skipNoThinking) continue;
    skipNoThinking = true;
    const left = totalMs - (Date.now() - started);
    if (left < 2500) break; // out of time: stop with the last error
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), Math.min(timeoutMs, left)) : null;
    try {
      const response = await fetch(`${ENDPOINT}${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": settings.apiKey },
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            ...(json ? { responseMimeType: "application/json" } : {}),
            ...(thinking ? { thinkingConfig: { thinkingBudget: 0 } } : {})
          }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = String(data && data.error && data.error.message || response.status);
        const clean = String(message).split(settings.apiKey).join("••••").slice(0, 220);
        const keyProblem = /api key|api_key|has not been used|disabled|blocked|referer|referrer|restricted|not authorized|permission|location is not supported/i.test(message);
        // this model does not take our thinkingConfig (newer models answer with a
        // plain "invalid argument") → same model again without it
        if (response.status === 400 && thinking && !keyProblem) {
          skipNoThinking = false;
          lastError = new AiError("model", clean);
          continue;
        }
        // the model name is unknown for this key, or busy → try the next one
        if (response.status === 404 || response.status === 503 || response.status === 500 || (response.status === 400 && /model/i.test(message) && !/api key/i.test(message))) {
          lastError = new AiError(response.status >= 500 ? "failed" : "model", clean);
          continue;
        }
        // say exactly what Google said, so a real key problem is easy to tell apart
        if (/api key not valid|api_key_invalid|invalid api key/i.test(message)) throw new AiError("bad_key", clean);
        if (/has not been used|is disabled|SERVICE_DISABLED|API_KEY_SERVICE_BLOCKED|blocked/i.test(message)) throw new AiError("api_off", clean);
        if (/location is not supported|region|country/i.test(message)) throw new AiError("region", clean);
        if (/referer|referrer|restricted|not authorized|permission/i.test(message)) throw new AiError("restricted", clean);
        if (response.status === 400) { lastError = new AiError("failed", clean); continue; } // this model rejects the request → next model
        if (response.status === 401 || response.status === 403) throw new AiError("bad_key", clean);
        if (response.status === 429) throw new AiError("quota", message);
        throw new AiError("failed", message);
      }
      const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      const text = parts.filter(part => !part.thought).map(part => part.text || "").join("").trim();
      if (!text) { lastError = new AiError("empty", "Empty answer"); continue; } // e.g. all tokens spent thinking
      goodModel = model;
      return { text, model };
    } catch (error) {
      if (error instanceof AiError) throw error;
      if (error && error.name === "AbortError") { lastError = new AiError("timeout", `${model} took too long`); continue; }
      throw new AiError("network", error && error.message);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastError || new AiError("model", "No Gemini model available");
}

// short Khmer message for an error code (the bot and the app show this)
function errorText(error, km = true, withDetail = false) {
  const code = error && error.code;
  const T = {
    no_key: ["មិនទាន់មាន API key ទេ។ ដាក់ key នៅ ការកំណត់ → AI។", "No API key yet. Add one in Settings → AI."],
    bad_key: ["Google ថា API key មិនត្រឹមត្រូវ។ ចម្លង key ទាំងមូលពី AI Studio ម្ដងទៀត (កុំចម្លងពីបញ្ជីដែលលាក់ ••••)។", "Google says the API key is not valid. Copy the whole key from AI Studio again (not the hidden •••• one)."],
    api_off: ["Key នេះមិនទាន់បើក Gemini API ទេ។ បង្កើត key ថ្មីនៅ aistudio.google.com/apikey។", "Gemini API is not turned on for this key. Create a new key at aistudio.google.com/apikey."],
    region: ["Google មិនទាន់អនុញ្ញាត Gemini API ពីទីតាំងនេះទេ។", "Google doesn't allow the Gemini API from this location yet."],
    restricted: ["Key នេះមានការកំណត់ (restriction) ដែលបិទ app នេះ។ ដក restriction ឬបង្កើត key ថ្មី។", "This key has a restriction that blocks the app. Remove it or create a new key."],
    quota: ["AI ប្រើអស់កម្រិតឥតគិតថ្លៃសម្រាប់ពេលនេះហើយ។ សាកម្ដងទៀតបន្តិចក្រោយ។", "The free AI limit is used up for now. Try again a bit later."],
    timeout: ["AI ឆ្លើយយឺតពេក។ សាកម្ដងទៀត។", "AI took too long. Please try again."],
    network: ["ភ្ជាប់ AI មិនបាន។ ពិនិត្យអ៊ីនធឺណិត។", "Couldn't reach the AI. Check the internet."],
    model: ["រក model Gemini មិនឃើញ។ សាកប្ដូរ model នៅ ការកំណត់ → AI។", "Gemini model not found. Try another model in Settings → AI."]
  };
  const pair = T[code] || ["AI មានបញ្ហាបន្តិច។ សាកម្ដងទៀត។", "The AI had a problem. Please try again."];
  const text = km ? pair[0] : pair[1];
  const detail = withDetail && error && error.message && !["no_key", "timeout"].includes(code) ? ` (Google: ${String(error.message).slice(0, 160)})` : "";
  return text + detail;
}

/* ---------------- data summary sent to the AI ---------------- */
const toUsd = (amount, currency) => (String(currency || "USD").toUpperCase() === "KHR" ? Number(amount || 0) / KHR_PER_USD : Number(amount || 0));
const fromUsd = (usd, currency) => (currency === "KHR" ? usd * KHR_PER_USD : usd);
const fmt = (value, currency) => (currency === "KHR" ? `${Math.round(value).toLocaleString("en-US")}៛` : `$${(Math.round(value * 100) / 100).toFixed(2)}`);
const list = value => (Array.isArray(value) ? value : []);
const iso = value => String(value || "").slice(0, 10);
const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const clip = (text, n = 40) => String(text || "").replace(/\s+/g, " ").trim().slice(0, n);

function buildContext(payload, today) {
  const p = payload || {};
  const cur = (p.profile && p.profile.currency) || "USD";
  const money = usd => fmt(fromUsd(usd, cur), cur);
  const month = today.slice(0, 7);
  const lastMonthDate = new Date(`${month}-01T00:00:00Z`); lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);
  const expenses = list(p.expenses).filter(e => e && e.date);
  const sumBy = items => items.reduce((s, e) => s + toUsd(e.amount, e.currency), 0);
  const byCat = items => {
    const out = {};
    items.forEach(e => { const c = e.category || "Other"; out[c] = (out[c] || 0) + toUsd(e.amount, e.currency); });
    return Object.entries(out).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c} ${money(v)}`).join(", ");
  };
  const thisMonth = expenses.filter(e => iso(e.date).startsWith(month));
  const prevMonth = expenses.filter(e => iso(e.date).startsWith(lastMonth));
  const week = expenses.filter(e => iso(e.date) > addDays(today, -7) && iso(e.date) <= today);
  const recent = expenses.filter(e => iso(e.date) > addDays(today, -21)).sort((a, b) => iso(b.date).localeCompare(iso(a.date))).slice(0, 40);
  const incomeMonth = list(p.income).filter(i => iso(i.date || i.receivedDate || i.nextPaymentDate).startsWith(month));
  const recurringIncome = list(p.income).filter(i => i.recurring || /monthly/i.test(i.frequency || ""));

  const lines = [];
  lines.push(`Today: ${today}. Main currency: ${cur} (1 USD = ${KHR_PER_USD} KHR). Name: ${clip(p.profile && p.profile.name, 30) || "-"}.`);
  lines.push(`Spent this month (${month}): ${money(sumBy(thisMonth))} in ${thisMonth.length} expenses. By category: ${byCat(thisMonth) || "none"}.`);
  lines.push(`Spent last month (${lastMonth}): ${money(sumBy(prevMonth))}. By category: ${byCat(prevMonth) || "none"}.`);
  lines.push(`Last 7 days: ${money(sumBy(week))}.`);
  if (incomeMonth.length || recurringIncome.length) {
    lines.push(`Income this month: ${money(sumBy(incomeMonth))}. Regular income: ${recurringIncome.map(i => `${clip(i.name || i.source || i.category, 24)} ${money(toUsd(i.amount, i.currency))}/${clip(i.frequency || "month", 10)}`).join(", ") || "none"}.`);
  }
  if (recent.length) {
    lines.push("Recent expenses (date | amount | category | text | method):");
    recent.forEach(e => lines.push(`- ${iso(e.date)} | ${fmt(Number(e.amount || 0), String(e.currency || cur).toUpperCase())} | ${e.category || "Other"} | ${clip(e.description, 32)} | ${clip(e.method, 10)}`));
  }
  const bills = list(p.bills).filter(b => b && b.status !== "Paid" && iso(b.due || b.dueDate)).sort((a, b) => iso(a.due || a.dueDate).localeCompare(iso(b.due || b.dueDate))).slice(0, 10);
  if (bills.length) lines.push(`Unpaid bills: ${bills.map(b => `${clip(b.name, 24)} ${fmt(Number(b.amount || 0), b.currency || cur)} due ${iso(b.due || b.dueDate)}`).join("; ")}.`);
  const loans = list(p.loans).slice(0, 6);
  if (loans.length) lines.push(`Loans: ${loans.map(l => `${clip(l.name, 24)} ${fmt(Number(l.monthlyPayment || 0), l.currency || cur)}/month, original ${fmt(Number(l.originalAmount || l.principal || 0), l.currency || cur)}, ${list(l.payments).length} payments made`).join("; ")}.`);
  const savings = list(p.savings).slice(0, 6);
  if (savings.length) lines.push(`Savings: ${savings.map(s => `${clip(s.name, 24)} ${money(toUsd(s.currentAmount, s.currency))} of ${money(toUsd(s.targetAmount, s.currency))}`).join("; ")}.`);
  const goals = list(p.goals).slice(0, 6);
  if (goals.length) lines.push(`Goals: ${goals.map(g => `${clip(g.name || g.title, 24)} ${money(toUsd(g.currentAmount || g.current || 0, g.currency))} of ${money(toUsd(g.targetAmount || g.target || 0, g.currency))}${g.deadline ? ` by ${iso(g.deadline)}` : ""}`).join("; ")}.`);
  const budgets = p.budgets && typeof p.budgets === "object" ? p.budgets : null;
  if (budgets && !Array.isArray(budgets)) {
    const b = Object.entries(budgets).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k} ${money(Number(v))}`);
    if (b.length) lines.push(`Monthly budgets: ${b.join(", ")}.`);
  }
  const soon = addDays(today, 14);
  const events = list(p.calendarEvents).filter(e => iso(e.date) >= today && iso(e.date) <= soon).sort((a, b) => (iso(a.date) + (a.time || "")).localeCompare(iso(b.date) + (b.time || ""))).slice(0, 12);
  if (events.length) lines.push(`Events next 14 days: ${events.map(e => `${iso(e.date)}${e.time ? ` ${e.time}` : ""} ${clip(e.title, 30)}`).join("; ")}.`);
  const birthdays = list(p.family).filter(m => m && m.birthday).map(m => {
    const md = String(m.birthday).slice(5, 10);
    let next = `${today.slice(0, 4)}-${md}`;
    if (next < today) next = `${Number(today.slice(0, 4)) + 1}-${md}`;
    return { name: clip(m.name, 20), next };
  }).filter(b => b.next <= addDays(today, 45)).sort((a, b) => a.next.localeCompare(b.next));
  if (birthdays.length) lines.push(`Birthdays soon: ${birthdays.map(b => `${b.name} ${b.next}`).join("; ")}.`);
  return lines.join("\n");
}

/* ---------------- the three jobs ---------------- */
const SYSTEM_BASE = [
  "You are MYLIFE AI, a friendly personal assistant inside the user's own life app (money, bills, loans, calendar, goals, family).",
  "Answer in the same language as the user (Khmer if they write Khmer; keep common English words like app names). Write natural, simple, human Khmer.",
  "Use ONLY the data given. If the data does not have the answer, say so briefly. Never invent numbers.",
  "Be short: at most 8 lines. Use plain text and simple bullets (•). You may use **bold** for one or two key numbers. No tables, no headings.",
  "You are not a licensed financial advisor; give practical everyday tips only."
].join(" ");

async function ask(payload, question, { today, settings }) {
  const result = await callGemini(settings, {
    system: SYSTEM_BASE,
    prompt: `MY DATA:\n${buildContext(payload, today)}\n\nMY QUESTION:\n${String(question).slice(0, 800)}`
  });
  return result.text;
}

async function advice(payload, { today, settings, km = true }) {
  const result = await callGemini(settings, {
    system: SYSTEM_BASE,
    maxTokens: 800,
    prompt: `MY DATA:\n${buildContext(payload, today)}\n\n${km
      ? "សូមមើលការចាយវាយខែនេះ ធៀបនឹងខែមុន ហើយផ្ដល់ដំបូន្មានលុយជាភាសាខ្មែរ៖ ១) សង្ខេបមួយបន្ទាត់ ២) ចំណុចល្អ ១ ៣) ចំណុចគួរប្រយ័ត្ន ១-២ (ប្រភេទណាចាយច្រើន វិក្កយបត្រជិតដល់) ៤) គន្លឹះ ២-៣ ដែលធ្វើបានភ្លាម។ ខ្លី និងច្បាស់។"
      : "Look at this month's spending compared with last month and give money advice: 1) one-line summary 2) one good point 3) one or two things to watch (biggest categories, bills due soon) 4) two or three tips to do now. Short and clear."}`
  });
  return result.text;
}

// "Hard" text the normal parser could not read → { type, items, event, reply }
async function parseText(payload, text, { today, settings }) {
  const cur = (payload && payload.profile && payload.profile.currency) || "USD";
  const result = await callGemini(settings, {
    json: true,
    temperature: 0.1,
    maxTokens: 500,
    system: "You turn a short personal message (Khmer or English) into JSON for a life app. Reply with JSON only.",
    prompt: [
      `Today is ${today} (${new Date(`${today}T00:00:00Z`).toUTCString().slice(0, 3)}). Default currency ${cur}. Khmer riel = KHR (៛, រៀល, k = thousand riel when small like 15k). Dollar = USD ($, ដុល្លារ).`,
      `Expense categories: ${EXPENSE_CATEGORIES.join(", ")}. Fruit, drinks and snacks are Food. Income categories: ${INCOME_CATEGORIES.join(", ")}.`,
      "Return: {\"type\":\"expense\"|\"income\"|\"event\"|\"question\"|\"other\",",
      " \"items\":[{\"amount\":number,\"currency\":\"USD\"|\"KHR\",\"category\":string,\"description\":string,\"date\":\"YYYY-MM-DD\"}],",
      " \"event\":{\"title\":string,\"date\":\"YYYY-MM-DD\",\"time\":\"HH:MM\" or \"\",\"category\":\"Personal\"|\"Family\"|\"Work\"|\"Health\"|\"Bill\"|\"Reminder\"},",
      " \"reply\":string}",
      "Rules: money spent → expense (one item per thing paid). Money received → income. A plan, appointment or reminder with a day or time → event. A question → question. Anything else → other with a one-line friendly Khmer reply.",
      `MESSAGE:\n${String(text).slice(0, 600)}`
    ].join("\n")
  });
  let data;
  try { data = JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch (error) { return { type: "other", items: [], reply: "" }; }
  return cleanParsed(data, today, cur);
}

function validDate(value, today) {
  const v = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) return today;
  return v >= addDays(today, -366) && v <= addDays(today, 366) ? v : today;
}

function cleanParsed(data, today, cur) {
  const type = ["expense", "income", "event", "question", "other"].includes(data && data.type) ? data.type : "other";
  const items = list(data && data.items).map(item => {
    const amount = Math.round(Number(item && item.amount) * 100) / 100;
    if (!(amount > 0) || amount > 1e9) return null;
    const currency = String(item.currency || cur).toUpperCase() === "KHR" ? "KHR" : "USD";
    const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const category = cats.find(c => c.toLowerCase() === String(item.category || "").toLowerCase()) || "Other";
    return { amount, currency, category, description: String(item.description || "").slice(0, 80).trim(), date: validDate(item.date, today) };
  }).filter(Boolean).slice(0, 10);
  const ev = data && data.event;
  const event = ev && String(ev.title || "").trim()
    ? { title: String(ev.title).slice(0, 100).trim(), date: validDate(ev.date, today), time: /^\d{1,2}:\d{2}$/.test(String(ev.time || "")) ? String(ev.time).padStart(5, "0") : "", category: ["Personal", "Family", "Work", "Health", "Bill", "Reminder"].includes(ev.category) ? ev.category : "Personal" }
    : null;
  return {
    type: (type === "expense" || type === "income") && !items.length ? "other" : type === "event" && !event ? "other" : type,
    items,
    event,
    reply: String((data && data.reply) || "").slice(0, 300)
  };
}

// a question rather than something to save
function looksLikeQuestion(text) {
  const t = String(text || "").trim();
  return /[?？]\s*$/.test(t)
    || /^(តើ|ហេតុអ្វី|ធ្វើម៉េច|ធ្វើយ៉ាងម៉េច|ប៉ុន្មាន|ណា|ពេលណា|អ្វី|ជួយ|ណែនាំ|គួរ)/.test(t)
    || /(ប៉ុន្មាន|ឬទេ|អត់|ទេ\s*\?|ដែរឬទេ|យ៉ាងម៉េច|ម៉េចដែរ)$/.test(t)
    || /^(what|how|why|when|where|which|who|should|can|could|do|does|did|is|are|am|will|tell me|give me|help|advise|suggest)\b/i.test(t);
}

// **bold** and bullets → safe HTML (Telegram and the app)
function toHtml(text, escape) {
  const esc = escape || (s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  return esc(String(text || "").replace(/^#+\s*/gm, "").replace(/^\s*[-*]\s+/gm, "• "))
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*\n]+)\*/g, "$1");
}

const api = { MODELS, settingsOf, withoutSecrets, maskKey, callGemini, errorText, buildContext, ask, advice, parseText, cleanParsed, looksLikeQuestion, toHtml, AiError };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.AiAssist = api;
})(typeof window !== "undefined" ? window : globalThis);
