const TROY_OUNCE_GRAMS = 31.1035;
const CHI_GRAMS = 3.75;

function quoteFrom(gold, fx) {
  const ounce = Number(gold?.price);
  const rate = Number(fx?.rate);
  if (!(ounce > 0) || !Number.isFinite(ounce)) throw new Error("gold_price_unavailable");
  const usdPerChi = ounce / TROY_OUNCE_GRAMS * CHI_GRAMS;
  return {
    goldUsdPerOunce: ounce,
    usdKhr: rate > 0 && Number.isFinite(rate) ? rate : 0,
    goldUsdPerChi: usdPerChi,
    goldKhrPerChi: rate > 0 && Number.isFinite(rate) ? usdPerChi * rate : 0,
    source: "gold-api.com",
    fxSource: rate > 0 ? "Frankfurter" : "unavailable",
    fetchedAt: new Date().toISOString()
  };
}

async function fetchQuote(fetcher = fetch) {
  const responses = await Promise.all([
    fetcher("https://api.gold-api.com/price/XAU", { cache: "no-store", signal: AbortSignal.timeout(10000) }),
    fetcher("https://api.frankfurter.dev/v2/rate/usd/khr", { cache: "no-store", signal: AbortSignal.timeout(10000) }).catch(() => null)
  ]);
  if (!responses[0]?.ok) throw new Error(`gold_api_${responses[0]?.status || "unavailable"}`);
  const gold = await responses[0].json();
  const fx = responses[1]?.ok ? await responses[1].json() : null;
  return quoteFrom(gold, fx);
}

function priceFor(quote, currency) {
  return currency === "KHR" ? Number(quote.goldKhrPerChi || 0) : Number(quote.goldUsdPerChi || 0);
}

function changePercent(current, previous) {
  const now = Number(current), before = Number(previous);
  return before > 0 ? ((now - before) / before) * 100 : null;
}

function evaluateRules(rules, quote, previousQuote, stateById = {}, now = Date.now()) {
  const next = { ...stateById };
  const triggered = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule?.enabled || !rule.id) continue;
    const current = priceFor(quote, rule.currency);
    const previous = previousQuote ? priceFor(previousQuote, rule.currency) : 0;
    const change = changePercent(current, previous);
    const threshold = Number(rule.threshold);
    if (!(current > 0 && threshold > 0)) continue;
    const state = next[rule.id] || {};
    let condition = false;
    if (rule.type === "above") condition = current >= threshold;
    else if (rule.type === "below") condition = current <= threshold;
    else if (rule.type === "rise") condition = change !== null && change >= threshold;
    else if (rule.type === "drop") condition = change !== null && change <= -threshold;
    const cooldownMs = Math.max(1, Number(rule.cooldownHours || 24)) * 3600000;
    const cooldownReady = !state.lastTriggeredAt || now - Date.parse(state.lastTriggeredAt) >= cooldownMs;
    if (condition && !state.active) {
      if (cooldownReady) {
        triggered.push({ rule, current, previous, change, quote });
        next[rule.id] = { ...state, active: true, lastTriggeredAt: new Date(now).toISOString() };
      } else {
        // This crossing happened during cooldown; keep it latched until the
        // price leaves the condition so it cannot retry/spam every scheduler run.
        next[rule.id] = { ...state, active: true };
      }
    } else if (!condition) {
      next[rule.id] = { ...state, active: false };
    }
  }
  return { state: next, triggered };
}

function valueGoldInvestments(savings, quote) {
  return (Array.isArray(savings) ? savings : []).flatMap(saving =>
    (Array.isArray(saving.transactions) ? saving.transactions : [])
      .filter(tx => tx.type === "gold" && Number(tx.goldWeightGrams) > 0)
      .map(tx => {
        const grams = Math.max(0, Number(tx.goldWeightGrams));
        const purity = Math.min(24, Math.max(1, Number(String(tx.goldPurity || "24K").match(/\d+/)?.[0] || 24)));
        const originalValue = Number(tx.purchaseValue ?? Math.max(0, Number(tx.amount || 0) - Number(tx.fees || 0))) + Number(tx.fees || 0);
        const currentUsd = grams * Number(quote.goldUsdPerOunce || 0) / TROY_OUNCE_GRAMS * purity / 24;
        const currency = tx.currency || saving.currency || "USD";
        const currentValue = currency === "KHR" ? Number(quote.usdKhr) > 0 ? currentUsd * Number(quote.usdKhr) : null : currentUsd;
        return { id: tx.id, savingId: saving.id, grams, purity, currency, originalValue, currentUsd, currentValue, profitLoss: currentValue === null ? null : currentValue - originalValue, returnPercent: currentValue !== null && originalValue > 0 ? (currentValue - originalValue) / originalValue * 100 : null };
      })
  );
}

function appendSnapshot(history, quote, date) {
  const list = Array.isArray(history) ? history.slice() : [];
  const item = { date, goldUsdPerChi: quote.goldUsdPerChi, goldKhrPerChi: quote.goldKhrPerChi, usdKhr: quote.usdKhr, source: quote.source, fxSource: quote.fxSource, updatedAt: quote.fetchedAt };
  const index = list.findIndex(entry => entry.date === date);
  if (index >= 0) list[index] = item; else list.push(item);
  return list.sort((a, b) => a.date.localeCompare(b.date)).slice(-366);
}

module.exports = { TROY_OUNCE_GRAMS, CHI_GRAMS, quoteFrom, fetchQuote, priceFor, changePercent, evaluateRules, valueGoldInvestments, appendSnapshot };
