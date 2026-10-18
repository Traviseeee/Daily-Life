// Water (PPWSA) and electricity (EDC) bill messages in the MYLIFE group.
// Their bots post "new invoice" and "payment successful" notices; MYLIFE must
// read them as bills (never as an expense line or a calendar event), and a
// copy forwarded or pasted by the user is understood the same way.

const PROVIDERS = {
  ppwsa: {
    icon: "💧",
    km: "ទឹក",
    en: "Water",
    company: "PPWSA",
    sender: /ppwsa|ទឹកស្អាត|water/i,
    link: /ppwsa\.com\.kh/i,
    bill: /water|ppwsa|ទឹក/i
  },
  edc: {
    icon: "⚡",
    km: "ភ្លើង",
    en: "Electricity",
    company: "EDC",
    sender: /\bedc\b|edc_|អគ្គិសនី|electric/i,
    link: /edc\.com\.kh/i,
    bill: /electric|\bedc\b|ភ្លើង|អគ្គិសនី|power/i
  }
};

function senderName(message) {
  const people = [message?.from, message?.forward_from, message?.forward_origin?.sender_user];
  const names = people.filter(Boolean).map(user => `${user.first_name || ""} ${user.last_name || ""} ${user.username || ""}`);
  if (message?.forward_sender_name) names.push(message.forward_sender_name);
  if (message?.forward_origin?.sender_user_name) names.push(message.forward_origin.sender_user_name);
  return names.join(" ");
}

function messageText(message) {
  return String(message?.text || message?.caption || "");
}

function linksOf(message) {
  const text = messageText(message);
  const urls = text.match(/https?:\/\/\S+/g) || [];
  [...(message?.entities || []), ...(message?.caption_entities || [])].forEach(entity => {
    if (entity.type === "text_link" && entity.url) urls.push(entity.url);
  });
  return urls;
}

function parseAmount(text) {
  // "ទឹកប្រាក់បានបង់ ៖ 1,500 KHR" / "Amount: 12.50 USD" / "45,000៛"
  const match = /(ទឹកប្រាក់[^\d\n]{0,20}|amount[^\d\n]{0,12})([\d][\d,\s]*(?:\.\d+)?)\s*(KHR|USD|រៀល|៛|\$)?/i.exec(text)
    || /([\d][\d,]*(?:\.\d+)?)\s*(KHR|USD|រៀល|៛)/i.exec(text);
  if (!match) return null;
  const number = match.length === 4 ? match[2] : match[1];
  const unit = (match.length === 4 ? match[3] : match[2]) || "KHR";
  const amount = Number(String(number).replace(/[,\s]/g, ""));
  if (!(amount > 0)) return null;
  return { amount, currency: /usd|\$/i.test(unit) ? "USD" : "KHR" };
}

function parseDate(text) {
  const match = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

/**
 * Recognises a PPWSA / EDC notice.
 * @returns null or { provider, type: "invoice"|"receipt", url, ref, amount, currency, date }
 */
function detectUtility(message) {
  const text = messageText(message);
  const links = linksOf(message);
  const sender = senderName(message);
  const provider = Object.keys(PROVIDERS).find(key => links.some(url => PROVIDERS[key].link.test(url)))
    || Object.keys(PROVIDERS).find(key => PROVIDERS[key].link.test(text))
    || (message?.from?.is_bot || message?.forward_from?.is_bot || message?.forward_origin?.sender_user?.is_bot
      ? Object.keys(PROVIDERS).find(key => PROVIDERS[key].sender.test(sender))
      : null);
  if (!provider) return null;

  const url = links.find(link => PROVIDERS[provider].link.test(link)) || links[0] || "";
  const receipt = /\/receipt\//i.test(url) || /បង់ប្រាក់.{0,30}ជោគជ័យ|payment.{0,20}success/i.test(text);
  const invoice = /\/invoice\//i.test(url) || /វិក្កយបត្រ|invoice|bill/i.test(text);
  if (!receipt && !invoice) return null;

  const money = receipt ? parseAmount(text) : null;
  const refMatch = /(?:បង្កាន់ដៃ[^\n:៖]*[:៖]\s*|receipt\s*(?:no\.?|#)?\s*[:៖]?\s*)([A-Z0-9-]{6,})/i.exec(text);
  const urlId = (/\/(?:invoice|receipt)\/([A-Za-z0-9]+)/i.exec(url) || [])[1] || "";
  return {
    provider,
    type: receipt ? "receipt" : "invoice",
    url,
    ref: (refMatch && refMatch[1]) || urlId.slice(0, 40) || String(message?.message_id || ""),
    amount: money ? money.amount : null,
    currency: money ? money.currency : null,
    date: parseDate(text)
  };
}

// the MYLIFE bill this notice belongs to (name, category or notes mention water/EDC…)
function findUtilityBill(bills, provider) {
  const pattern = PROVIDERS[provider].bill;
  const list = (Array.isArray(bills) ? bills : []).filter(bill => pattern.test(`${bill.name || ""} ${bill.notes || ""}`));
  if (list.length) return list.sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999")))[0];
  return null;
}

module.exports = { detectUtility, findUtilityBill, PROVIDERS };
