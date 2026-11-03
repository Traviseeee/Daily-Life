/* Gold spot widget. Live quotes come from public market APIs; persisted daily
 * history and alert rules are synced in the existing profile/app_data record. */
const SavingsMarket = (() => {
  const CACHE_KEY = "mylife:savings-market:v1";
  const CACHE_MS = 60 * 1000;
  const GRAMS_PER_TROY_OUNCE = 31.1035;
  const GRAMS_PER_CHI = 3.75;
  let state = readCache();
  let request = null;
  let range = 30;
  let alertsOpen = false;

  function readCache() {
    try { const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return value && typeof value === "object" ? value : {}; }
    catch (error) { return {}; }
  }
  const km = () => languageCode() === "km";
  const L = (k, e) => km() ? k : e;
  const number = (value, digits = 0) => Number(value).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const history = () => Array.isArray(appData?.profile?.goldMarketHistory) ? appData.profile.goldMarketHistory : [];
  const rules = () => Array.isArray(appData?.profile?.goldPriceAlerts) ? appData.profile.goldPriceAlerts : [];
  function fresh() { const latest = Number(state.fetchedAt || 0); return latest > 0 && Date.now() - latest < CACHE_MS; }
  function timeLabel() {
    const checkedAt = state.updatedAtLocal || state.fetchedAt;
    if (!checkedAt) return state.hasAttempted ? L("មិនមានទិន្នន័យ", "unavailable") : L("កំពុងទាញទិន្នន័យ…", "Loading market data…");
    return new Date(checkedAt).toLocaleString(km() ? "km-KH" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function dailyChange(currency, current) {
    const previous = history().filter(item => item.date < new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const base = Number(currency === "KHR" ? previous?.goldKhrPerChi : previous?.goldUsdPerChi);
    if (!(base > 0 && current > 0)) return "";
    const pct = (current - base) / base * 100;
    return `<small class="sv-market-change ${pct < 0 ? "is-down" : "is-up"}">${pct > 0 ? "+" : ""}${number(pct, 2)}% · 1d</small>`;
  }
  function chartMarkup() {
    const code = "USD";
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - range + 1);
    const series = history().filter(item => new Date(`${item.date}T00:00:00`) >= cutoff && Number(item.goldUsdPerChi) > 0);
    const points = series.map(item => Number(item.goldUsdPerChi));
    if (points.length < 2) return `<div class="sv-market-chart-empty"><span aria-hidden="true">📈</span><b>${escapeHtml(L("កំពុងប្រមូលទិន្នន័យក្រាប…", "Collecting chart data…"))}</b></div>`;
    const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
    const path = points.map((value, i) => `${i ? "L" : "M"}${(i / (points.length - 1) * 100).toFixed(2)},${(38 - (value - min) / span * 30).toFixed(2)}`).join(" ");
    const first = points[0], last = points[points.length - 1], pct = first ? ((last - first) / first) * 100 : 0;
    const tone = pct < 0 ? "down" : "up";
    return `<div class="sv-market-chart-head"><span>${escapeHtml(L("តម្លៃមាស USD / ជី", "Gold price · USD / Chi"))}</span><b class="is-${tone}">${pct > 0 ? "+" : ""}${number(pct, 2)}%</b></div><svg class="sv-market-chart" viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label="Gold price history chart"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.8" vector-effect="non-scaling-stroke"/><circle cx="100" cy="${(38 - (last - min) / span * 30).toFixed(2)}" r="1.5" fill="currentColor"/></svg><div class="sv-market-chart-scale"><span>$${number(min, 2)}</span><span>${series[0].date} — ${series.at(-1).date}</span><span>$${number(max, 2)}</span></div>`;
  }
  const typeLabel = rule => ({ rise: L("ឡើង", "Rises"), drop: L("ធ្លាក់", "Drops"), above: L("លើស", "Above"), below: L("ក្រោម", "Below") })[rule.type] || rule.type;
  function alertMarkup() {
    const rows = rules().map(rule => `<div class="sv-market-alert-row"><span>🔔 ${escapeHtml(typeLabel(rule))} ${escapeHtml(String(rule.threshold))}${["rise", "drop"].includes(rule.type) ? "%" : ` ${rule.currency === "KHR" ? "៛" : "$"}/ជី`}</span><button type="button" data-sv-remove-alert="${escapeAttr(rule.id)}" aria-label="${escapeAttr(L("លុប", "Remove"))}">×</button></div>`).join("");
    return `<div class="sv-market-alerts" ${alertsOpen ? "" : "hidden"}>${rows || `<small>${escapeHtml(L("មិនទាន់មានច្បាប់ Alert", "No alert rules yet"))}</small>`}<form data-sv-alert-form class="sv-market-alert-form"><select name="type" aria-label="${escapeAttr(L("លក្ខខណ្ឌ", "Condition"))}"><option value="drop">${escapeHtml(L("ធ្លាក់ %", "Drops by %"))}</option><option value="rise">${escapeHtml(L("ឡើង %", "Rises by %"))}</option><option value="above">${escapeHtml(L("ដល់តម្លៃ / លើស", "Reaches / above"))}</option><option value="below">${escapeHtml(L("ក្រោមតម្លៃ", "Falls below"))}</option></select><input name="threshold" type="number" min="0.01" step="any" required placeholder="${escapeAttr(L("តម្លៃ", "Value"))}" aria-label="${escapeAttr(L("កម្រិត", "Threshold"))}"><select name="currency" aria-label="Currency"><option value="USD">USD / ជី</option><option value="KHR">KHR / ជី</option></select><select name="cooldownHours" aria-label="${escapeAttr(L("ចន្លោះពេល", "Cooldown"))}"><option value="24">24h</option><option value="72">3d</option><option value="168">7d</option></select><button type="submit">＋ ${escapeHtml(L("បន្ថែម", "Add"))}</button></form></div>`;
  }
  function alertHistoryMarkup() {
    const items = (Array.isArray(appData?.profile?.goldAlertHistory) ? appData.profile.goldAlertHistory : []).slice().reverse().slice(0, 5);
    if (!items.length) return "";
    return `<details class="sv-market-alert-history"><summary>${escapeHtml(L("ការជូនដំណឹងថ្មីៗ", "Recent alerts"))} · ${items.filter(item => !item.read).length}</summary>${items.map(item => `<div class="sv-market-history-row${item.read ? " is-read" : ""}"><span><b>${escapeHtml(item.title || "Gold alert")}</b><small>${escapeHtml(item.date || "")}</small></span>${item.read ? "✓" : `<button type="button" data-sv-read-alert="${escapeAttr(item.id)}">${escapeHtml(L("អាន", "Read"))}</button>`}</div>`).join("")}</details>`;
  }
  function content() {
    const usd = Number(state.goldUsdPerOunce) > 0 ? Number(state.goldUsdPerOunce) / GRAMS_PER_TROY_OUNCE * GRAMS_PER_CHI : 0;
    const khr = usd > 0 && Number(state.usdKhr) > 0 ? usd * Number(state.usdKhr) : 0;
    const gold = usd > 0 ? `<div class="sv-market-tile"><span class="sv-market-label"><i class="sv-market-dot is-gold"></i>${escapeHtml(L("មាស 24K · ដុល្លារ", "24K gold · USD"))}</span><strong>$${number(usd, 2)}<small>${escapeHtml(L("/ ជី", "/ Chi"))}</small></strong>${dailyChange("USD", usd)}</div>` : `<div class="sv-market-tile is-muted"><span class="sv-market-label"><i class="sv-market-dot is-gold"></i>24K · USD</span><strong>${escapeHtml(L("កំពុងផ្ទុក…", "Loading…"))}</strong></div>`;
    const goldKhr = khr > 0 ? `<div class="sv-market-tile"><span class="sv-market-label"><i class="sv-market-dot is-riel"></i>${escapeHtml(L("មាស 24K · រៀល", "24K gold · riel"))}</span><strong>៛${number(khr)}<small>${escapeHtml(L("/ ជី", "/ Chi"))}</small></strong>${dailyChange("KHR", khr)}</div>` : `<div class="sv-market-tile is-muted"><span class="sv-market-label">24K · KHR</span><strong>${escapeHtml(L("កំពុងផ្ទុក…", "Loading…"))}</strong></div>`;
    const fx = Number(state.usdKhr) > 0 ? `<div class="sv-market-fx"><span>USD/KHR</span><b>${number(state.usdKhr)} ៛</b><small>${escapeHtml(L("អត្រាយោងប្រចាំថ្ងៃ", "daily reference rate"))}</small></div>` : `<div class="sv-market-fx is-muted"><span>USD/KHR</span><b>${escapeHtml(L("មិនមានទិន្នន័យ", "Unavailable"))}</b></div>`;
    const lastGoldQuoteAt = Number(state.goldFetchedAt || state.fetchedAt || 0);
    const stale = lastGoldQuoteAt && Date.now() - lastGoldQuoteAt > 6 * 60 * 60 * 1000;
    const sourceHint = L("Gold API · Spot 24K / ជី · KHR តាម Frankfurter · តម្លៃហាងអាចខុស", "Gold API · 24K spot / Chi · Frankfurter KHR · shop prices may vary");
    const metaLabel = stale ? L("តម្លៃអាចចាស់", "May be outdated") : L("ធ្វើបច្ចុប្បន្នភាព", "Updated");
    return `<div class="sv-market-quotes">${gold}${goldKhr}${fx}</div><small class="sv-market-meta" title="${escapeAttr(sourceHint)}">${escapeHtml(metaLabel)} · ${escapeHtml(timeLabel())}</small><div class="sv-market-history"><div class="sv-market-history-head"><b>${escapeHtml(L("ប្រវត្តិតម្លៃ", "Price history"))}</b><div class="sv-market-range" role="group" aria-label="${escapeAttr(L("រយៈពេលក្រាប", "Chart range"))}">${[7, 30, 365].map(days => `<button type="button" data-sv-range="${days}" class="${range === days ? "is-active" : ""}">${days === 365 ? "1y" : `${days}d`}</button>`).join("")}</div></div>${chartMarkup()}</div><div class="sv-market-alert-head"><b>🔔 ${escapeHtml(L("ជូនដំណឹង", "Alerts"))}</b><button type="button" data-sv-alert-toggle aria-expanded="${alertsOpen}">${alertsOpen ? "−" : "＋"} ${escapeHtml(L("ច្បាប់", "Rules"))} · ${rules().length}</button></div>${alertMarkup()}${alertHistoryMarkup()}`;
  }
  function paint() { const root = document.querySelector("[data-savings-market]"); if (root) root.innerHTML = content(); }
  async function fetchJson(url) {
    const options = { cache: "no-store" };
    if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) options.signal = AbortSignal.timeout(9000);
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Market request failed (${response.status})`);
    return response.json();
  }
  async function refresh(force = false) {
    if (request) return request;
    if (!force && fresh()) return;
    request = (async () => {
      const [goldResult, fxResult] = await Promise.allSettled([fetchJson("https://api.gold-api.com/price/XAU"), fetchJson("https://api.frankfurter.dev/v2/rate/usd/khr")]);
      let gotQuote = false;
      if (goldResult.status === "fulfilled") {
        const price = Number(goldResult.value?.price);
        if (price > 0 && Number.isFinite(price)) { state.goldUsdPerOunce = price; state.goldUpdatedAt = goldResult.value?.updatedAt || goldResult.value?.timestamp || Date.now(); state.goldFetchedAt = Date.now(); state.updatedAtLocal = state.goldFetchedAt; gotQuote = true; }
      }
      if (fxResult.status === "fulfilled") { const rate = Number(fxResult.value?.rate); if (rate > 0 && Number.isFinite(rate)) { state.usdKhr = rate; state.fxDate = fxResult.value?.date || ""; state.fxFetchedAt = Date.now(); gotQuote = true; } }
      state.hasAttempted = true;
      if (gotQuote) { state.fetchedAt = Date.now(); try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (error) { /* in-memory quote is still available */ } }
      paint();
      if (location.hash.startsWith("#money/savings") && typeof App !== "undefined") App.render();
    })().catch(error => { console.warn("MYLIFE could not refresh savings market data.", error); state.hasAttempted = true; paint(); }).finally(() => { request = null; });
    return request;
  }
  function saveRules(next) {
    Store.updateProfile({ goldPriceAlerts: next });
  }
  function markAlertRead(id) {
    const list = Array.isArray(appData.profile.goldAlertHistory) ? appData.profile.goldAlertHistory : [];
    const next = list.map(item => item.id === id ? { ...item, read: true } : item);
    Store.updateProfile({ goldAlertHistory: next });
  }
  document.addEventListener("click", event => {
    const rangeButton = event.target.closest("[data-sv-range]");
    if (rangeButton) { range = Number(rangeButton.dataset.svRange) || 30; paint(); return; }
    if (event.target.closest("[data-sv-alert-toggle]")) { alertsOpen = !alertsOpen; paint(); return; }
    const read = event.target.closest("[data-sv-read-alert]");
    if (read) { markAlertRead(read.dataset.svReadAlert); return; }
    const remove = event.target.closest("[data-sv-remove-alert]");
    if (remove) saveRules(rules().filter(rule => rule.id !== remove.dataset.svRemoveAlert));
  });
  document.addEventListener("submit", event => {
    const form = event.target.closest("[data-sv-alert-form]");
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form), threshold = Number(data.get("threshold"));
    if (!(threshold > 0)) return;
    saveRules([...rules(), { id: `gold-rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: String(data.get("type")), threshold, currency: data.get("currency") === "KHR" ? "KHR" : "USD", cooldownHours: Number(data.get("cooldownHours") || 24), enabled: true }]);
  });
  window.setInterval(() => { if (document.visibilityState === "visible" && document.querySelector("[data-savings-market]")) refresh(true); }, CACHE_MS);
  return {
    render() { if (!fresh()) refresh(); return `<section class="sv-market-card" aria-label="${escapeAttr(L("ព័ត៌មានតម្លៃមាស", "Gold prices"))}"><div class="sv-market-heading"><strong>🪙 ${escapeHtml(L("តម្លៃមាស 24K", "24K gold prices"))}</strong><button type="button" class="sv-market-refresh" data-sv-market-refresh aria-label="${escapeAttr(L("ធ្វើបច្ចុប្បន្នភាព", "Refresh market quotes"))}" title="${escapeAttr(L("ធ្វើបច្ចុប្បន្នភាព", "Refresh"))}">↻</button></div><div data-savings-market>${content()}</div></section>`; },
    refresh,
    quote: () => ({ ...state, goldUsdPerGram: Number(state.goldUsdPerOunce || 0) / GRAMS_PER_TROY_OUNCE, goldUsdPerChi: Number(state.goldUsdPerOunce || 0) / GRAMS_PER_TROY_OUNCE * GRAMS_PER_CHI, goldKhrPerChi: Number(state.goldUsdPerOunce || 0) / GRAMS_PER_TROY_OUNCE * GRAMS_PER_CHI * Number(state.usdKhr || 0) })
  };
})();
