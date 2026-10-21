// Smart Scan in the Telegram bot: a photo / screenshot / PDF sent to the group →
// OCR (lib/scan-ocr.js) → the same rules as the app (js/scan-parse.js) → a
// summary with ✅ Save / 🔗 Pay bill / 🔄 type / ✏️ Edit in app / ❌ Cancel.
// Nothing is saved until a button is pressed; an unpaid invoice becomes a bill,
// never an expense; duplicates (same file, same reference, same shop+amount+date)
// are shown first instead of being saved twice.
const { readDocument } = require("./scan-ocr");
const ScanParse = require("./scan-parse");
const { escapeHtml } = require("./telegram-message");
const { formatMoney } = require("./money-report");

const API = "https://api.telegram.org";
const KIND_TEXT = {
  expense: "🧾 បង្កាន់ដៃចំណាយ · Receipt",
  payment: "💳 បង្កាន់ដៃបង់ប្រាក់ · Payment slip",
  bill: "📄 វិក្កយបត្រមិនទាន់បង់ · Unpaid bill",
  unknown: "❔ មិនច្បាស់ · Unknown"
};
const FIELD_KM = { amount: "ចំនួនទឹកប្រាក់ · amount", date: "ថ្ងៃ · date", merchant: "ហាង/អ្នកទទួល · merchant", dueDate: "ថ្ងៃផុតកំណត់ · due date" };

function isScanDocument(document) {
  if (!document) return false;
  return /^image\//i.test(document.mime_type || "") || /pdf/i.test(document.mime_type || "") || /\.(pdf|jpe?g|png|webp)$/i.test(document.file_name || "");
}

async function downloadFile(tgCall, fileId) {
  const file = await tgCall("getFile", { file_id: fileId });
  if (!file?.file_path) throw new Error("download_failed");
  const response = await fetch(`${API}/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!response.ok) throw new Error("download_failed");
  return Buffer.from(await response.arrayBuffer());
}

// short base64url of the draft for "✏️ Edit in app" (the app opens #scan?d=…)
function draftLink(draft) {
  const keep = ["kind", "merchant", "amount", "currency", "date", "dueDate", "category", "paymentMethod", "ref", "provider", "billingPeriod", "customerId", "hash"];
  const small = Object.fromEntries(keep.filter(key => draft[key]).map(key => [key, draft[key]]));
  return `/#scan?d=${Buffer.from(JSON.stringify(small)).toString("base64url")}`;
}

function summaryText(draft, { duplicates = [], bill = null, ocrConfidence = 0, status = "" } = {}) {
  const money = draft.amount ? formatMoney(draft.amount, draft.currency || "USD") : "—";
  const lines = [
    status || "📷 <b>Smart Scan · អានរួចហើយ</b>",
    "",
    `${KIND_TEXT[draft.kind] || KIND_TEXT.unknown}`,
    `💵 <b>${escapeHtml(money)}</b>${draft.currency ? "" : " ⚠️"}`,
    draft.merchant ? `🏪 ${escapeHtml(draft.merchant)}` : "🏪 —",
    draft.date ? `📆 ${escapeHtml(draft.date)}` : "",
    draft.dueDate ? `⏰ ផុតកំណត់ · Due ${escapeHtml(draft.dueDate)}` : "",
    draft.billingPeriod ? `🗓 ${escapeHtml(draft.billingPeriod)}` : "",
    draft.category ? `🏷 ${escapeHtml(draft.category)}` : "",
    draft.paymentMethod ? `🏦 ${escapeHtml(draft.paymentMethod)}` : "",
    draft.ref ? `🔖 Ref ${escapeHtml(draft.ref)}` : ""
  ].filter(line => line !== "");
  if (draft.missing.length) lines.push("", `⚠️ មិនច្បាស់ · Not found: ${draft.missing.map(key => FIELD_KM[key] || key).join(", ")}`);
  if (draft.kind === "bill") lines.push("", "<i>វិក្កយបត្រមិនទាន់បង់ — នឹងរក្សាទុកជា Bill មិនមែនជាចំណាយទេ</i>");
  if (bill) lines.push("", `🔗 ត្រូវនឹង bill <b>${escapeHtml(bill.name)}</b> (${escapeHtml(formatMoney(bill.amount, bill.currency || "USD"))}${bill.due ? ` · ${escapeHtml(bill.due)}` : ""})`);
  if (duplicates.length) {
    lines.push("", "⚠️ <b>ហាក់ដូចជាមានរួចហើយ · Possible duplicate</b>");
    duplicates.slice(0, 2).forEach(dup => lines.push(`• ${escapeHtml(dup.label || dup.collection)} ${dup.amount ? escapeHtml(formatMoney(dup.amount, dup.currency || "USD")) : ""} ${escapeHtml(dup.date || "")}`));
  }
  if (ocrConfidence && ocrConfidence < 60) lines.push("", "<i>រូបមិនសូវច្បាស់ — សូមពិនិត្យលេខ · Blurry photo, please check</i>");
  return lines.join("\n");
}

function keyboard(token, draft, { bill, duplicates, appLink }) {
  const rows = [];
  const can = draft.kind === "bill" || Number(draft.amount) > 0;
  if (can && !duplicates.length) {
    if (bill && draft.kind !== "bill") rows.push([{ text: `🔗 បង់ ${bill.name}`.slice(0, 40), callback_data: `scanlink|${token}` }], [{ text: "💸 រក្សាទុកជាចំណាយ · Save expense", callback_data: `scansave|${token}` }]);
    else if (bill && draft.kind === "bill") rows.push([{ text: `🔄 Update ${bill.name}`.slice(0, 40), callback_data: `scanlink|${token}` }, { text: "➕ Bill ថ្មី", callback_data: `scansave|${token}` }]);
    else rows.push([{ text: draft.kind === "bill" ? "✅ រក្សាទុក Bill · Save bill" : "✅ រក្សាទុក · Save", callback_data: `scansave|${token}` }]);
  }
  if (can && duplicates.length) rows.push([{ text: "✅ រក្សាទុកដដែល · Save anyway", callback_data: `scanforce|${token}` }]);
  rows.push([
    { text: draft.kind === "bill" ? "🔄 ជាចំណាយ" : "🔄 ជា Bill", callback_data: `scankind|${token}` },
    { text: "✏️ កែក្នុង App", url: appLink({ url: draftLink(draft) }) },
    { text: "❌ បោះបង់", callback_data: `scancancel|${token}` }
  ]);
  return { inline_keyboard: rows };
}

/* ---------- a photo / PDF arrives ---------- */
async function handleScan(message, ctx) {
  const { redis, tgCall, reply, ownerUserId, readPayload, saveAction, appLink } = ctx;
  const photo = Array.isArray(message.photo) && message.photo.length ? message.photo[message.photo.length - 1] : null;
  const file = photo || message.document;
  if (!file) return null;
  // Telegram retries the same update: handle each file once per 10 minutes
  const fresh = await redis.set(`mylife:scan:tg:${file.file_unique_id}:${message.message_id}`, "1", { nx: true, ex: 600 });
  if (fresh === null) return null;

  const userId = await ownerUserId(redis);
  if (!userId) return reply(message, "⚠️ សូមចុចប៊ូតុងណាមួយលើការរំលឹក MYLIFE ម្ដងសិន ដើម្បីភ្ជាប់គណនី។");
  if (Number(file.file_size || 0) > 10 * 1024 * 1024) return reply(message, "⚠️ ឯកសារធំពេក (អតិបរមា 10MB) · File too big (max 10MB)");

  await tgCall("sendChatAction", { chat_id: message.chat.id, action: "typing" }).catch(() => {});
  let doc;
  try {
    const buffer = await downloadFile(tgCall, file.file_id);
    doc = await readDocument(buffer, message.document?.mime_type || (photo ? "image/jpeg" : ""));
  } catch (error) {
    const why = {
      pdf_no_text: "📄 PDF នេះជារូបស្កេន គ្មានអក្សរ — សូមផ្ញើជារូបថត ឬ screenshot វិញ · Scanned PDF: please send a photo",
      unsupported_file: "⚠️ ប្រភេទឯកសារមិនគាំទ្រ (JPG, PNG, WebP, PDF) · Unsupported file",
      file_too_big: "⚠️ ឯកសារធំពេក (អតិបរមា 10MB) · File too big"
    }[error.message] || "❌ អានឯកសារមិនបាន សូមសាកម្ដងទៀត · Could not read the file, please try again";
    console.warn("MYLIFE scan failed.", error.message);
    return reply(message, why);
  }

  const payload = (await readPayload(userId)) || {};
  const draft = { ...ScanParse.parse(doc.text, { defaultCurrency: payload.profile?.currency }), hash: doc.hash };
  if (!doc.text.trim() || (!draft.amount && !draft.merchant && !draft.date)) {
    return reply(message, "🤔 រកមិនឃើញព័ត៌មានហិរញ្ញវត្ថុក្នុងរូបនេះទេ — សូមថតឱ្យច្បាស់ ត្រង់ និងពេញបង្កាន់ដៃ · Nothing readable found, try a clearer photo");
  }
  const duplicates = ScanParse.findDuplicates(payload, draft);
  const bill = ScanParse.matchBill(payload, draft);
  const token = await saveAction(redis, { userId, item: { kind: "scan", draft, billId: bill?.id || "", ocr: doc.confidence } });
  return reply(message, summaryText(draft, { duplicates, bill, ocrConfidence: doc.type === "image" ? doc.confidence : 0 }), keyboard(token, draft, { bill, duplicates, appLink }));
}

/* ---------- a button on the scan summary ---------- */
// verb: scansave | scanforce | scanlink | scankind | scancancel
async function handleScanAction(verb, token, action, query, ctx) {
  const { redis, tgCall, readPayload, updatePayload, saveAction, pushAdded, appLink, answer, makeId } = ctx;
  const { userId, item } = action;
  const chat_id = query.message.chat.id;
  const message_id = query.message.message_id;
  const draft = item.draft;

  if (verb === "scancancel") {
    await answer("❌ បានបោះបង់ · Cancelled");
    await tgCall("editMessageText", { chat_id, message_id, text: summaryText(draft, { status: "❌ <b>បានបោះបង់ · Cancelled</b>" }), parse_mode: "HTML" }).catch(() => {});
    await redis.del(`mylife:tg:act:${token}`).catch(() => {});
    return;
  }

  if (verb === "scankind") {
    const next = { ...draft, kind: draft.kind === "bill" ? "expense" : "bill", status: draft.kind === "bill" ? "paid" : "unpaid" };
    const payload = (await readPayload(userId)) || {};
    const bill = ScanParse.matchBill(payload, next);
    const duplicates = ScanParse.findDuplicates(payload, next);
    await saveAction(redis, { userId, item: { ...item, draft: next, billId: bill?.id || "" } }).then(newToken => {
      return tgCall("editMessageText", { chat_id, message_id, text: summaryText(next, { duplicates, bill }), parse_mode: "HTML", reply_markup: keyboard(newToken, next, { bill, duplicates, appLink }) });
    }).catch(() => {});
    await answer(next.kind === "bill" ? "📄 Bill" : "💸 Expense");
    return;
  }

  // save (once — a second press says it's already done)
  const claimed = await redis.set(`mylife:scan:done:${token}`, "1", { nx: true, ex: 45 * 86400 });
  if (claimed === null) {
    await answer("👌 បានរក្សាទុករួចហើយ · Already saved");
    return;
  }
  let result = null;
  let blocked = null;
  try {
    await updatePayload(userId, payload => {
      if (verb !== "scanforce") {
        const dups = ScanParse.findDuplicates(payload, draft);
        if (dups.length) { blocked = dups; return "unchanged"; }
      }
      result = ScanParse.apply(payload, draft, { source: "Telegram", linkBillId: verb === "scanlink" ? item.billId : "", makeId });
      return "updated";
    });
  } catch (error) {
    await redis.del(`mylife:scan:done:${token}`).catch(() => {});
    await answer("❌ រក្សាទុកមិនបាន · Could not save");
    console.warn("MYLIFE scan save failed.", error.message);
    return;
  }
  if (blocked) {
    await redis.del(`mylife:scan:done:${token}`).catch(() => {});
    await answer("⚠️ មានរួចហើយ · Already in MYLIFE");
    await tgCall("editMessageText", { chat_id, message_id, text: summaryText(draft, { duplicates: blocked }), parse_mode: "HTML", reply_markup: keyboard(token, draft, { bill: null, duplicates: blocked, appLink }) }).catch(() => {});
    return;
  }

  const label = {
    "expense-created": "✅ <b>បានកត់ចំណាយ · Expense saved</b>",
    "bill-created": "✅ <b>បានបង្កើត Bill · Bill saved (unpaid)</b>",
    "bill-updated": "✅ <b>បាន update Bill · Bill updated</b>",
    "bill-paid": "✅ <b>Bill បានបង់ · Bill marked paid</b>",
    "bill-already-paid": "👌 <b>Bill នេះបានបង់រួចហើយ · Already paid</b>"
  }[result.outcome] || "✅ <b>បានរក្សាទុក · Saved</b>";
  const url = result.collection === "bills" || result.billId ? "/#money/bills" : "/#money/expenses";
  const rows = [];
  if (result.outcome === "expense-created" || result.outcome === "bill-created") {
    const undo = await saveAction(redis, { userId, item: { kind: "undo", entries: [{ collection: result.collection, id: result.id }], collection: result.collection, id: result.id, url } });
    rows.push({ text: "↩️ លុបវិញ · Undo", callback_data: `undo|${undo}` });
  }
  rows.push({ text: "📱 បើក MYLIFE", url: appLink({ url }) });
  await answer("✅ Saved");
  await tgCall("editMessageText", { chat_id, message_id, text: summaryText(draft, { status: label }), parse_mode: "HTML", reply_markup: { inline_keyboard: [rows] } }).catch(() => {});
  const money = draft.amount ? formatMoney(draft.amount, draft.currency || "USD") : "";
  await pushAdded(userId, "📷 Smart Scan · បានរក្សាទុក", [draft.merchant, money].filter(Boolean).join(" · "), url, result.collection === "bills" ? "bill" : "expense");
}

module.exports = { isScanDocument, handleScan, handleScanAction, summaryText, draftLink };
