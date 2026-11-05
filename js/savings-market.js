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
  let panelOpen = false;

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
  const ICON = {
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>'
  };
  function trend(days = 30) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days + 1);
    const points = history().filter(item => new Date(`${item.date}T00:00:00`) >= cutoff && Number(item.goldUsdPerChi) > 0).map(item => Number(item.goldUsdPerChi));
    return points.length >= 2 && points[0] > 0 ? (points[points.length - 1] - points[0]) / points[0] * 100 : null;
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
    if (points.length < 2) return `<div class="sv-market-chart-empty"><b>${escapeHtml(L("កំពុងប្រមូលទិន្នន័យក្រាប…", "Collecting chart data…"))}</b></div>`;
    const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
    const xy = points.map((value, i) => [(i / (points.length - 1) * 100).toFixed(2), (36 - (value - min) / span * 28).toFixed(2)]);
    const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
    const last = xy[xy.length - 1];
    return `<svg class="sv-market-chart svm-chart" viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label="${escapeAttr(L("ក្រាបតម្លៃមាស", "Gold price history chart"))}"><defs><linearGradient id="svmFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8B03C" stop-opacity=".35"/><stop offset="1" stop-color="#E8B03C" stop-opacity="0"/></linearGradient></defs><path d="${line} L100,42 L0,42 Z" fill="url(#svmFill)"/><path d="${line}" fill="none" stroke="#E0A42E" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg><span class="svm-dot" style="top:${(last[1] / 42 * 100).toFixed(1)}%"></span><div class="sv-market-chart-scale"><span>$${number(min, 2)}</span><span>${series[0].date.slice(5)} — ${series.at(-1).date.slice(5)}</span><span>$${number(max, 2)}</span></div>`;
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
    const pctSpan = (a, b) => (a > 0 && b > 0 ? (b - a) / a * 100 : null);
    const prev = history().filter(item => item.date < new Date().toISOString().slice(0, 10) && Number(item.goldUsdPerChi) > 0).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const day = pctSpan(Number(prev?.goldUsdPerChi), usd);
    const signed = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${number(Math.abs(v), 2)}%`;
    const trendPct = trend(range);
    const price = usd > 0 ? `<div class="svm-price"><b>$${number(usd, 2)}</b><span>${escapeHtml(L("/ ជី", "/ Chi"))}</span>${trendPct === null ? "" : `<em class="svm-chg ${trendPct < 0 ? "is-down" : "is-up"}">${signed(trendPct)} · ${range === 365 ? "1y" : `${range}d`}</em>`}</div>` : `<div class="svm-price is-muted"><b>${escapeHtml(L("កំពុងផ្ទុក…", "Loading…"))}</b></div>`;
    const chips = [khr > 0 ? `៛${number(khr)} ${L("/ ជី", "/ Chi")}` : "", Number(state.usdKhr) > 0 ? `1$ = ${number(state.usdKhr)}៛` : "", day === null ? "" : `${L("ថ្ងៃនេះ", "Today")} ${signed(day)}`].filter(Boolean).map(text => `<span>${escapeHtml(text)}</span>`).join("");
    const lastGoldQuoteAt = Number(state.goldFetchedAt || state.fetchedAt || 0);
    const stale = lastGoldQuoteAt && Date.now() - lastGoldQuoteAt > 6 * 60 * 60 * 1000;
    const sourceHint = L("Gold API · Spot 24K / ជី · KHR តាម Frankfurter · តម្លៃហាងអាចខុស", "Gold API · 24K spot / Chi · Frankfurter KHR · shop prices may vary");
    const metaLabel = stale ? L("តម្លៃអាចចាស់", "May be outdated") : L("ធ្វើបច្ចុប្បន្នភាព", "Updated");
    return `${chips ? `<div class="svm-chips">${chips}</div>` : ""}<div class="svm-chart-box">${chartMarkup()}</div><div class="sv-market-range svm-range" role="group" aria-label="${escapeAttr(L("រយៈពេលក្រាប", "Chart range"))}">${[7, 30, 365].map(days => `<button type="button" data-sv-range="${days}" class="${range === days ? "is-active" : ""}">${days === 365 ? "1y" : `${days}d`}</button>`).join("")}</div><button type="button" class="svm-alert-line" data-sv-alert-toggle aria-expanded="${alertsOpen}"><span class="svm-ii">${ICON.bell}</span><span><b>${escapeHtml(L("ជូនដំណឹងតម្លៃ", "Price alerts"))}</b></span><em>${rules().length} ${alertsOpen ? "−" : "›"}</em></button>${alertMarkup()}${alertHistoryMarkup()}<small class="sv-market-meta" title="${escapeAttr(sourceHint)}">${escapeHtml(metaLabel)} · ${escapeHtml(timeLabel())} · ${escapeHtml(L("តម្លៃហាងអាចខុស", "shop prices may differ"))}</small>`;
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
  function sparkPath() {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 29);
    const pts = history().filter(item => new Date(`${item.date}T00:00:00`) >= cutoff && Number(item.goldUsdPerChi) > 0).map(item => Number(item.goldUsdPerChi));
    if (pts.length < 2) return "";
    const min = Math.min(...pts), span = Math.max(...pts) - min || 1;
    return pts.map((v, i) => `${i ? "L" : "M"}${(i / (pts.length - 1) * 60).toFixed(1)},${(19 - (v - min) / span * 16).toFixed(1)}`).join(" ");
  }
  // compact market row for the gold card; tapping it opens the chart, chips and alerts
  function line() {
    if (!fresh()) refresh();
    const usd = Number(state.goldUsdPerOunce) > 0 ? Number(state.goldUsdPerOunce) / GRAMS_PER_TROY_OUNCE * GRAMS_PER_CHI : 0;
    const tr = trend(30), path = sparkPath();
    const chg = tr === null ? "" : `<em class="${tr < 0 ? "is-down" : "is-up"}">${tr > 0 ? "+" : tr < 0 ? "−" : ""}${number(Math.abs(tr), 1)}%</em>`;
    return `<button type="button" class="svg-market${panelOpen ? " is-open" : ""}" data-gold-market aria-expanded="${panelOpen}"><i class="svg-mk-dot" aria-hidden="true"></i><span>${escapeHtml(L("តម្លៃ 24K", "24K price"))}</span><b>${usd > 0 ? `$${number(usd, 2)}` : escapeHtml(L("កំពុងផ្ទុក…", "Loading…"))}</b>${chg}${path ? `<svg class="svg-spark" viewBox="0 0 60 22" aria-hidden="true"><path d="${path}" fill="none" stroke="#E0A42E" stroke-width="2" stroke-linejoin="round"/></svg>` : ""}<svg class="svg-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="svg-market-panel" data-gold-panel ${panelOpen ? "" : "hidden"}><div class="svg-mk-top"><small>${escapeHtml(L("តម្លៃ 1 ជី · Spot", "Per Chi · spot"))}</small><button type="button" class="sv-market-refresh" data-sv-market-refresh aria-label="${escapeAttr(L("ធ្វើបច្ចុប្បន្នភាព", "Refresh market quotes"))}">${ICON.refresh}</button></div><div data-savings-market>${content()}</div></div>`;
  }
  function setPanel(open) {
    panelOpen = open;
    const panel = document.querySelector("[data-gold-panel]"), btn = document.querySelector("[data-gold-market]");
    if (panel) panel.hidden = !open;
    if (btn) { btn.classList.toggle("is-open", open); btn.setAttribute("aria-expanded", String(open)); }
  }
  document.addEventListener("click", event => {
    if (event.target.closest("[data-gold-market]")) { setPanel(!panelOpen); return; }
    if (event.target.closest("[data-gold-alerts]")) { alertsOpen = true; setPanel(true); paint(); document.querySelector(".sv-market-alerts")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
  });
  return {
    line,
    render() { if (!fresh()) refresh(); return `<section class="sv-market-card" aria-label="${escapeAttr(L("ព័ត៌មានតម្លៃមាស", "Gold prices"))}"><div class="sv-market-heading"><strong>${escapeHtml(L("តម្លៃមាស 24K", "24K gold price"))}</strong><button type="button" class="sv-market-refresh" data-sv-market-refresh aria-label="${escapeAttr(L("ធ្វើបច្ចុប្បន្នភាព", "Refresh market quotes"))}" title="${escapeAttr(L("ធ្វើបច្ចុប្បន្នភាព", "Refresh"))}">${ICON.refresh}</button></div><div data-savings-market>${content()}</div></section>`; },
    refresh,
    trend,
    quote: () => ({ ...state, goldUsdPerGram: Number(state.goldUsdPerOunce || 0) / GRAMS_PER_TROY_OUNCE, goldUsdPerChi: Number(state.goldUsdPerOunce || 0) / GRAMS_PER_TROY_OUNCE * GRAMS_PER_CHI, goldKhrPerChi: Number(state.goldUsdPerOunce || 0) / GRAMS_PER_TROY_OUNCE * GRAMS_PER_CHI * Number(state.usdKhr || 0) })
  };
})();
