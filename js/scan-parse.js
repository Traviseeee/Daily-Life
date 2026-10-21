/*
 * Smart Scan — reads OCR text from a receipt, bill (EDC, PPWSA…), payment slip
 * (ABA, ACLEDA, Wing…) or screenshot, and saves the confirmed result.
 * No AI and no API key: the text comes from Tesseract OCR (browser or server) or
 * from a PDF's own text, and these rules turn it into fields.
 *
 * Shared by the app (window.ScanParse) and the Telegram bot (require), so both
 * entry points give the same result:
 *   parse(text)                    → draft { kind, merchant, amount, currency, … , missing, warnings }
 *   findDuplicates(payload, draft) → records that look like the same document
 *   matchBill(payload, draft)      → an unpaid bill this payment probably settles
 *   apply(payload, draft, opts)    → saves it (expense / unpaid bill / link to bill)
 * Rules: never invent a value (empty + warning instead), never take a subtotal,
 * fee, previous balance or change as the total, and an unpaid invoice never
 * becomes an expense.
 */
(function (root) {
  const BillPay = typeof module !== "undefined" && module.exports ? require("./bill-pay.js") : root.BillPay;

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = n => String(n).padStart(2, "0");

  function normalize(text) {
    return String(text || "")
      .replace(/[០-៩]/g, d => String("០១២៣៤៥៦៧៨៩".indexOf(d)))
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .split("\n").map(line => line.trim()).filter(Boolean);
  }

  /* ---------- numbers & currency ---------- */
  // "1.500" (dot as thousands) is kept whole so a KHR amount can be read as 1500
  const NUM = String.raw`(\d{1,3}(?:[,\s]\d{3})+(?:\.\d{1,2})?|\d{1,3}(?:\.\d{3})+(?![\d,])|\d+(?:[.,]\d{1,2})?)`;

  function toNumber(raw) {
    let s = String(raw).replace(/\s/g, "");
    if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, "");
    else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function currencyOf(line) {
    if (/\$|usd|dollar|ដុល្លារ/i.test(line)) return "USD";
    if (/khr|៛|riel|រៀល/i.test(line)) return "KHR";
    return "";
  }

  // every amount on a line, with its currency when the line says it
  function amountsIn(line) {
    const out = [];
    const re = new RegExp(String.raw`(?:^|[^\w.])([-+]?)\s*(?:\$|usd|khr|៛)?\s*${NUM}\s*(?:\$|usd|khr|៛|riel)?`, "gi");
    let m;
    while ((m = re.exec(line))) {
      const chunk = m[0];
      const currency = currencyOf(chunk) || currencyOf(line);
      // riel has no cents: "1.500 KHR" is 1500 (OCR or a dot used as thousands)
      const value = currency === "KHR" && /^\d{1,3}(?:\.\d{3})+$/.test(m[2]) ? Number(m[2].replace(/\./g, "")) : toNumber(m[2]);
      if (!Number.isFinite(value) || value <= 0) continue;
      // skip things that look like dates, times, phone numbers or long ids
      if (/\d{1,2}:\d{2}/.test(chunk) || /^\s*\d{7,}\s*$/.test(m[2].replace(/[,\s]/g, "")) && !/[,.]/.test(m[2])) continue;
      out.push({ value, currency, raw: chunk.trim() });
    }
    return out;
  }

  const TOTAL_WORDS = /\b(grand\s*total|total\s*amount\s*(?:due|paid)?|amount\s*due|total\s*due|total\s*payable|net\s*total|amount\s*paid|total)\b|សរុប|ចំនួនទឹកប្រាក់សរុប|ត្រូវបង់|(?:ទឹក)?ប្រាក់(?:ដែល)?បានបង់/i;
  const NOT_TOTAL = /sub\s*-?\s*total|previous|balance\s*(?:b\/f|brought)|outstanding|discount|vat|tax|service\s*charge|fee|tip|cash|change|tender|received|deposit|qty|items?\b|saving|points?/i;
  const PAY_AMOUNT_WORDS = /\b(amount|total|paid|debit|transfer(?:red)?\s*amount)\b|ចំនួនទឹកប្រាក់|ទឹកប្រាក់/i;

  /* ---------- dates ---------- */
  function iso(y, m, d) {
    y = Number(y); m = Number(m); d = Number(d);
    if (y < 100) y += 2000;
    if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  function datesIn(line) {
    const out = [];
    let m;
    const ymd = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g;
    while ((m = ymd.exec(line))) out.push(iso(m[1], m[2], m[3]));
    const dmy = /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/g;
    while ((m = dmy.exec(line))) {
      // Cambodia writes day/month/year; month/day only when the first part can't be a month… and the second can't be a day
      const a = Number(m[1]), b = Number(m[2]);
      out.push(a > 12 || b <= 12 ? iso(m[3], b, a) : iso(m[3], a, b));
    }
    const mon = /\b(\d{1,2})[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s,.-]*(20\d{2})\b/gi;
    while ((m = mon.exec(line))) out.push(iso(m[3], MONTHS[m[2].toLowerCase()], m[1]));
    const mon2 = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s.]+(\d{1,2})(?:st|nd|rd|th)?[\s,]+(20\d{2})\b/gi;
    while ((m = mon2.exec(line))) out.push(iso(m[3], MONTHS[m[1].toLowerCase()], m[2]));
    return out.filter(Boolean);
  }

  function labelledDate(lines, re) {
    for (let i = 0; i < lines.length; i++) {
      if (!re.test(lines[i])) continue;
      const here = datesIn(lines[i]);
      if (here.length) return here[here.length - 1];
      const next = lines[i + 1] ? datesIn(lines[i + 1]) : [];
      if (next.length) return next[0];
    }
    return "";
  }

  /* ---------- references ---------- */
  function labelledValue(lines, re) {
    for (let i = 0; i < lines.length; i++) {
      const m = re.exec(lines[i]);
      if (!m) continue;
      const after = lines[i].slice(m.index + m[0].length).replace(/^[\s:#.៖-]+/, "");
      const token = (after.match(/[A-Z0-9][A-Z0-9-/]{3,}/i) || [])[0] || ((lines[i + 1] || "").match(/^[A-Z0-9][A-Z0-9-/]{3,}$/i) || [])[0];
      if (token && /\d/.test(token)) return token;
    }
    return "";
  }

  /* ---------- kinds, providers, categories ---------- */
  const PROVIDERS = [
    { id: "EDC", re: /electricit[eé]\s*du\s*cambodge|\bEDC\b|អគ្គិសនីកម្ពុជា/i, name: "Electricity (EDC)", category: "Bills" },
    { id: "PPWSA", re: /\bPPWSA\b|water\s*supply\s*authority|រដ្ឋាករទឹក/i, name: "Water (PPWSA)", category: "Bills" }
  ];
  const BANKS = [
    [/\bABA\b|ABA'?\s*Mobile|Advanced Bank of Asia/i, "ABA"], [/ACLEDA|\bToanChet\b/i, "ACLEDA"], [/\bWing\b/i, "Wing"],
    [/\bTrue\s*Money\b/i, "TrueMoney"], [/\bPi\s*Pay\b/i, "Pi Pay"], [/\bKHQR\b|Bakong/i, "KHQR"], [/\bCanadia\b/i, "Canadia"], [/\bPrince\b/i, "Prince"], [/\bWing\b/i, "Wing"]
  ];
  const CATEGORIES = [
    [/coffee|caf[eé]|tea|restaurant|food|kitchen|noodle|bbq|pizza|burger|kfc|starbucks|amazon|brown|lunch|dinner|bakery|ម្ហូប|កាហ្វេ|អាហារ/i, "Food"],
    [/grab|pass\s*app|tada|taxi|tuk|fuel|petrol|gasoline|caltex|ptt|tela|sokimex|total\s*energies|parking|សាំង/i, "Transport"],
    [/electric|water|internet|wifi|smart\s*axiata|cellcard|metfone|ezecom|opennet|edc|ppwsa|bill/i, "Bills"],
    [/pharma|clinic|hospital|doctor|medic|dental|ពេទ្យ|ឱសថ/i, "Health"],
    [/school|tuition|book|course|university|សាលា/i, "Education"],
    [/cinema|movie|legend|major|netflix|spotify|game|karaoke/i, "Entertainment"],
    [/mart|market|supermarket|aeon|lucky|chip\s*mong|makro|mall|shop|store|ផ្សារ/i, "Shopping"]
  ];

  function detectKind(text) {
    const paid = /transfer\s*(?:was\s*)?success|payment\s*(?:was\s*)?success|paid\s*success|successful(?:ly)?\s*(?:paid|transferred)|transaction\s*success|ផ្ទេរប្រាក់.{0,12}ជោគជ័យ|ទូទាត់.{0,12}ជោគជ័យ|បង់ប្រាក់.{0,12}ជោគជ័យ|\bTrx\.?\s*ID\b|transaction\s*(?:id|hash|no)/i.test(text);
    const bill = /invoice|\bbill\b|amount\s*due|due\s*date|billing\s*period|statement\s*date|វិក្កយបត្រ|ថ្ងៃផុតកំណត់/i.test(text);
    const receipt = /\breceipt\b|sub\s*-?\s*total|\bcash\b|\bchange\b|\bvat\b|thank\s*you|qty|បង្កាន់ដៃ/i.test(text);
    const stampPaid = /\bPAID\b(?!\s*(?:to|by|from|amount))|status\s*[:៖]?\s*paid|បានបង់/i.test(text);
    if (paid) return "payment";
    if (bill && !stampPaid) return "bill";
    if (bill && stampPaid) return "payment";
    if (receipt) return "expense";
    return "unknown";
  }

  function pickTotal(lines, kind) {
    // 1) a "total / amount due" line (never subtotal, previous balance, cash, change…)
    const candidates = [];
    lines.forEach((line, i) => {
      if (!TOTAL_WORDS.test(line) || NOT_TOTAL.test(line)) return;
      let amounts = amountsIn(line);
      if (!amounts.length && lines[i + 1] && !TOTAL_WORDS.test(lines[i + 1])) amounts = amountsIn(lines[i + 1]);
      if (amounts.length) {
        const strong = /grand\s*total|amount\s*due|total\s*due|total\s*amount|total\s*payable|amount\s*paid|ត្រូវបង់|សរុប|ប្រាក់(?:ដែល)?បានបង់/i.test(line);
        candidates.push({ ...amounts[amounts.length - 1], score: strong ? 3 : 2, index: i });
      }
    });
    if (candidates.length) {
      candidates.sort((a, b) => b.score - a.score || b.index - a.index);
      return { ...candidates[0], sure: true };
    }
    // 2) payment slips: the big signed amount near the top ("-12.50 USD") or an "Amount" line
    if (kind === "payment") {
      for (let i = 0; i < Math.min(lines.length, 8); i++) {
        if (/[-+]\s*\$?\s*\d/.test(lines[i]) || /^\s*[-+]?\s*(?:(?:\$|usd|khr|៛)\s*[\d,.\s]*\d|[\d,.\s]*\d\s*(?:\$|usd|khr|៛|riel))\s*$/i.test(lines[i])) {
          const amounts = amountsIn(lines[i]).filter(a => a.currency);
          if (amounts.length) return { ...amounts[0], sure: true };
        }
      }
      for (let i = 0; i < lines.length; i++) {
        if (!PAY_AMOUNT_WORDS.test(lines[i]) || NOT_TOTAL.test(lines[i])) continue;
        const amounts = amountsIn(lines[i]).concat(lines[i + 1] ? amountsIn(lines[i + 1]) : []).filter(a => a.currency);
        if (amounts.length) return { ...amounts[0], sure: true };
      }
    }
    return null;
  }

  function pickMerchant(lines, kind, provider, bank) {
    if (provider) return provider.name;
    if (kind === "payment") {
      for (let i = 0; i < lines.length; i++) {
        const m = /(?:transferred\s*to|transfer\s*to|paid\s*to|to\s*account|^to\b|beneficiary|receiver|recipient|merchant(?:\s*name)?|ផ្ទេរទៅ|អ្នកទទួល)\s*[:៖]?\s*(.*)$/i.exec(lines[i]);
        if (!m) continue;
        const value = (m[1] || "").trim() || (lines[i + 1] || "").trim();
        if (value && !/^\d[\d\s-]*$/.test(value)) return value.replace(/\s*\(.*\)\s*$/, "").slice(0, 60);
      }
    }
    // first line that is mostly letters and not a bank/app name or a label
    const skip = /receipt|invoice|tax|vat|tel|phone|date|time|www|http|@|^#|transfer|success|mobile|amount|total|payment|bank|^\W*$/i;
    for (const line of lines.slice(0, 6)) {
      const letters = line.replace(/[^A-Za-zក-៿]/g, "").length;
      if (letters >= 3 && letters / line.length > 0.5 && !skip.test(line) && !(bank && new RegExp(`^${bank}\\b`, "i").test(line))) return line.slice(0, 60);
    }
    return "";
  }

  /* ---------- parse ---------- */
  function parse(rawText, opts = {}) {
    const lines = normalize(rawText);
    const text = lines.join("\n");
    const kind = detectKind(text);
    const provider = PROVIDERS.find(p => p.re.test(text)) || null;
    const bank = (BANKS.find(([re]) => re.test(text)) || [])[1] || "";
    const total = pickTotal(lines, kind);
    const merchant = pickMerchant(lines, kind, provider, bank);
    const date = labelledDate(lines, /transaction\s*date|payment\s*date|paid\s*(?:on|date)|date\s*(?:&|and)?\s*time|^date\b|\bdate\s*[:៖]|កាលបរិច្ឆេទ|ថ្ងៃទី/i) || datesIn(text)[0] || "";
    const dueDate = labelledDate(lines, /due\s*date|pay\s*(?:by|before)|ថ្ងៃផុតកំណត់|ផុតកំណត់/i);
    const issueDate = labelledDate(lines, /issue\s*date|invoice\s*date|bill\s*date|statement\s*date|ថ្ងៃចេញ/i);
    const periodLine = lines.find(line => /billing\s*period|period|រយៈពេល/i.test(line)) || "";
    const periodDates = datesIn(periodLine);
    const ref = labelledValue(lines, /trx\.?\s*id|transaction\s*(?:id|no\.?|ref(?:erence)?|hash)|reference\s*(?:no\.?|#)?|ref\.?\s*(?:no\.?|#)?|receipt\s*(?:no\.?|#)|bill\s*(?:no\.?|#)|លេខយោង/i);
    const invoiceNo = labelledValue(lines, /invoice\s*(?:no\.?|number|#)|វិក្កយបត្រលេខ/i);
    const customerId = labelledValue(lines, /customer\s*(?:id|no\.?|code)|account\s*(?:no\.?|number)|meter\s*(?:no\.?)|លេខអតិថិជន/i);

    let currency = total?.currency || "";
    if (!currency && total) currency = Number.isInteger(total.value) && total.value >= 1000 ? "KHR" : (opts.defaultCurrency || "");
    const category = provider ? provider.category : ((CATEGORIES.find(([re]) => re.test(`${merchant}\n${text}`)) || [])[1] || "Other");

    const draft = {
      kind: kind === "unknown" ? (total ? "expense" : "unknown") : kind,
      merchant,
      provider: provider ? provider.id : "",
      amount: total ? Math.round(total.value * 100) / 100 : null,
      currency,
      date: kind === "bill" ? (issueDate || (date !== dueDate ? date : "")) : date,
      dueDate,
      issueDate,
      billingPeriod: periodDates.length >= 2 ? `${periodDates[0]} – ${periodDates[1]}` : "",
      category,
      paymentMethod: bank,
      ref: ref || invoiceNo || "",
      invoiceNo,
      customerId,
      status: kind === "bill" ? "unpaid" : kind === "payment" || kind === "expense" ? "paid" : "unknown",
      missing: [],
      warnings: []
    };
    if (!draft.amount) draft.missing.push("amount");
    if (!draft.date) draft.missing.push("date");
    if (!draft.merchant) draft.missing.push("merchant");
    if (draft.kind === "bill" && !draft.dueDate) draft.missing.push("dueDate");
    if (total && !total.currency) draft.warnings.push("currency");
    if (draft.kind === "unknown") draft.warnings.push("kind");
    draft.confidence = draft.amount && draft.kind !== "unknown" && !draft.warnings.length ? (draft.missing.length ? "medium" : "high") : "low";
    return draft;
  }

  /* ---------- duplicates & bill matching ---------- */
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9ក-៿]/g, "");
  const dayGap = (a, b) => Math.abs(new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) / 86400000;
  const todayIso = () => new Date().toISOString().slice(0, 10);
  // a bill already paid in the last 20 days (✅ Paid, auto-pay, a PPWSA/EDC receipt…):
  // a slip for it is the same payment, never the next cycle
  const recentlyPaid = (bill, date) => Boolean(bill && bill.lastPaidAt && dayGap(bill.lastPaidAt, date || todayIso()) < 20);

  function findDuplicates(payload, draft) {
    const found = [];
    const add = (collection, record, reason) => {
      if (!found.some(f => f.id === record.id)) found.push({ collection, id: record.id, reason, label: record.description || record.name || "", amount: record.amount, currency: record.currency, date: record.date || record.due || "" });
    };
    ["expenses", "bills", "income"].forEach(collection => (payload[collection] || []).forEach(record => {
      const scan = record.scan || {};
      if (draft.hash && scan.hash === draft.hash) add(collection, record, "same-file");
      else if (draft.ref && (scan.ref === draft.ref || record.invoiceRef === draft.ref)) add(collection, record, "same-reference");
    }));
    // no reference: same merchant + amount + date (amount alone is never enough)
    if (!draft.ref && draft.amount && draft.date && draft.merchant) {
      (payload.expenses || []).forEach(record => {
        if (record.date === draft.date && Number(record.amount) === Number(draft.amount) && norm(record.description) && norm(record.description) === norm(draft.merchant)) add("expenses", record, "same-merchant-amount-date");
      });
    }
    if (draft.kind !== "bill" && Number(draft.amount) > 0 && draft.date) {
      const currency = draft.currency || "";
      (payload.expenses || []).forEach(record => {
        const sameMoney = Number(record.amount) === Number(draft.amount) && (!currency || !record.currency || record.currency === currency);
        if (!sameMoney) return;
        // typed in Telegram / the app (no document) on the same day: maybe this same purchase
        if (record.date === draft.date && !(record.scan && record.scan.ref)) add("expenses", record, "same-amount-date");
        // a bill payment already recorded within a few days (✅ Paid, auto-pay, PPWSA/EDC receipt)
        else if (record.billId && record.date && dayGap(record.date, draft.date) <= 3) add("expenses", record, "bill-payment-recorded");
      });
    }
    return found;
  }

  function matchBill(payload, draft) {
    if (draft.kind === "bill") {
      return (payload.bills || []).find(bill => draft.provider && new RegExp(draft.provider, "i").test(`${bill.name} ${bill.notes || ""}`)) || null;
    }
    const open = (payload.bills || []).filter(bill => !recentlyPaid(bill, draft.date) && (bill.status !== "Paid" || (bill.due && draft.date && bill.due >= draft.date)));
    if (draft.provider) {
      const byProvider = open.find(bill => new RegExp(draft.provider, "i").test(`${bill.name} ${bill.notes || ""}`));
      if (byProvider) return byProvider;
    }
    if (!draft.amount) return null;
    const near = (a, b) => a && b && Math.abs(new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) <= 20 * 86400000;
    return open.find(bill => Number(bill.amount) === Number(draft.amount) && (bill.currency || "") === (draft.currency || bill.currency || "") && near(bill.due, draft.date || bill.due)
      && (norm(draft.merchant) && norm(bill.name).includes(norm(draft.merchant).slice(0, 5)))) || null;
  }

  /* ---------- save ---------- */
  // opts: { today, source ("Scan" | "Telegram"), linkBillId, makeId(collection) }
  function apply(payload, draft, opts = {}) {
    const today = opts.today || new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    const makeId = opts.makeId || (collection => `${collection}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const scan = { hash: draft.hash || "", ref: draft.ref || "", docType: draft.kind, via: opts.source || "Scan", at: now };
    const currency = draft.currency || payload.profile?.currency || "USD";
    const amount = Number(draft.amount) || 0;

    if (draft.kind === "bill") {
      // an unpaid invoice is a bill to pay — never an expense
      payload.bills = Array.isArray(payload.bills) ? payload.bills : [];
      const existing = opts.linkBillId ? payload.bills.find(bill => bill.id === opts.linkBillId) : null;
      if (existing) {
        Object.assign(existing, {
          ...(amount ? { amount, currency } : {}),
          ...(draft.dueDate && existing.status !== "Paid" ? { due: draft.dueDate } : {}),
          invoiceRef: draft.ref || existing.invoiceRef || "", invoiceAt: now, scan, updatedAt: now
        });
        return { outcome: "bill-updated", collection: "bills", id: existing.id };
      }
      const id = makeId("bills");
      payload.bills.push({
        id, createdAt: now, updatedAt: now,
        name: draft.merchant || "Bill", amount, currency,
        due: draft.dueDate || "", frequency: draft.provider ? "Monthly" : "Once",
        category: draft.category === "Bills" ? "Utilities" : (draft.category || "Other"),
        status: "Upcoming", reminder: true, invoiceRef: draft.ref || "",
        notes: [draft.billingPeriod ? `Period ${draft.billingPeriod}` : "", draft.customerId ? `Customer ${draft.customerId}` : ""].filter(Boolean).join(" · "),
        source: (opts.source || "scan").toLowerCase(), scan
      });
      return { outcome: "bill-created", collection: "bills", id };
    }

    if (!(amount > 0)) throw new Error("amount_required");

    if (opts.linkBillId) {
      const bill = (payload.bills || []).find(item => item.id === opts.linkBillId);
      if (bill && recentlyPaid(bill, draft.date || today)) {
        // already paid for this cycle: never pay the next one by mistake
        return { outcome: "bill-already-paid", collection: "bills", id: bill.id, billId: bill.id };
      }
      if (bill) {
        const result = BillPay.payBill(payload, bill, draft.date || today, opts.source || "Scan", { amount, currency, notes: `Scan ${draft.ref || ""}`.trim(), force: true });
        const expense = (payload.expenses || []).find(entry => entry.id === bill.lastPaidExpenseId);
        if (expense) Object.assign(expense, { amount, currency, scan, source: (opts.source || "scan").toLowerCase(), updatedAt: now });
        return { outcome: result === "updated" ? "bill-paid" : "bill-already-paid", collection: "expenses", id: expense?.id || "", billId: bill.id };
      }
    }

    payload.expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
    const id = makeId("expenses");
    payload.expenses.push({
      id, createdAt: now, updatedAt: now,
      description: draft.merchant || draft.category || "Expense", amount, currency,
      date: draft.date || today, category: draft.category || "Other",
      method: draft.paymentMethod || opts.source || "Scan",
      notes: draft.ref ? `Ref ${draft.ref}` : "", source: (opts.source || "scan").toLowerCase(), scan
    });
    return { outcome: "expense-created", collection: "expenses", id };
  }

  const api = { parse, findDuplicates, matchBill, apply, amountsIn, datesIn };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ScanParse = api;
})(typeof window !== "undefined" ? window : globalThis);
