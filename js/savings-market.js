/* Small, cached market strip for Savings: gold spot + USD/KHR reference rate. */
const SavingsMarket = (() => {
  const CACHE_KEY = "mylife:savings-market:v1";
  const CACHE_MS = 60 * 1000;
  const GRAMS_PER_TROY_OUNCE = 31.1035;
  const GRAMS_PER_CHI = 3.75;
  let state = readCache();
  let request = null;

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return value && typeof value === "object" ? value : {};
    } catch (error) { return {}; }
  }

  const km = () => languageCode() === "km";
  const L = (k, e) => km() ? k : e;
  const number = (value, digits = 0) => Number(value).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

  function fresh() {
    const latest = Number(state.fetchedAt || 0);
    return latest > 0 && Date.now() - latest < CACHE_MS;
  }

  function timeLabel() {
    const checkedAt = state.updatedAtLocal || state.fetchedAt;
    if (!checkedAt) return state.hasAttempted ? L("មិនមានទិន្នន័យ", "unavailable") : L("កំពុងទាញទិន្នន័យ…", "Loading market data…");
    return new Date(checkedAt).toLocaleTimeString(km() ? "km-KH" : "en-US", { hour: "numeric", minute: "2-digit" });
  }

  function content() {
    const goldUsdPerChi = Number(state.goldUsdPerOunce) > 0 ? Number(state.goldUsdPerOunce) / GRAMS_PER_TROY_OUNCE * GRAMS_PER_CHI : 0;
    const goldKhrPerChi = goldUsdPerChi > 0 && Number(state.usdKhr) > 0 ? goldUsdPerChi * Number(state.usdKhr) : 0;
    const gold = goldUsdPerChi > 0
      ? `<div class="sv-market-tile"><span class="sv-market-label"><i class="sv-market-dot is-gold"></i>${escapeHtml(L("មាស 24K · ដុល្លារ", "24K gold · USD"))}</span><strong>$${number(goldUsdPerChi, 2)}<small>${escapeHtml(L("/ ជី", "/ Chi"))}</small></strong></div>`
      : `<div class="sv-market-tile is-muted"><span class="sv-market-label"><i class="sv-market-dot is-gold"></i>${escapeHtml(L("មាស 24K · ដុល្លារ", "24K gold · USD"))}</span><strong>${escapeHtml(L("កំពុងផ្ទុក…", "Loading…"))}</strong></div>`;
    const goldRiel = goldKhrPerChi > 0
      ? `<div class="sv-market-tile"><span class="sv-market-label"><i class="sv-market-dot is-riel"></i>${escapeHtml(L("មាស 24K · រៀល", "24K gold · riel"))}</span><strong>៛${number(goldKhrPerChi)}<small>${escapeHtml(L("/ ជី", "/ Chi"))}</small></strong></div>`
      : `<div class="sv-market-tile is-muted"><span class="sv-market-label"><i class="sv-market-dot is-riel"></i>${escapeHtml(L("មាស 24K · រៀល", "24K gold · riel"))}</span><strong>${escapeHtml(L("កំពុងផ្ទុក…", "Loading…"))}</strong></div>`;
    const rate = Number(state.usdKhr) > 0
      ? `<div class="sv-market-fx"><span>USD/KHR</span><b>${number(state.usdKhr)} ៛</b><small>${escapeHtml(L("អត្រាយោងប្រចាំថ្ងៃ", "daily reference rate"))}</small></div>`
      : `<div class="sv-market-fx is-muted"><span>USD/KHR</span><b>${escapeHtml(L("កំពុងផ្ទុក…", "Loading…"))}</b></div>`;
    const hasQuote = Number(state.goldUsdPerOunce) > 0 || Number(state.usdKhr) > 0;
    const note = hasQuote
      ? L("មាស 24K Spot · គិតជា ១ ជី · តម្លៃហាងអាចខុស", "24K spot estimate · per Chi · local shop prices may differ")
      : L("មិនអាចភ្ជាប់ទីផ្សារបាន", "Market data unavailable");
    return `<div class="sv-market-quotes">${gold}${goldRiel}${rate}</div><small class="sv-market-meta">${escapeHtml(note)} · ${escapeHtml(timeLabel())}</small>`;
  }

  function paint() {
    const root = document.querySelector("[data-savings-market]");
    if (root) root.innerHTML = content();
  }

  async function fetchJson(url) {
    const options = { cache: "no-store" };
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") options.signal = AbortSignal.timeout(9000);
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Market request failed (${response.status})`);
    return response.json();
  }

  async function refresh(force = false) {
    if (request) return request;
    if (!force && fresh()) return;
    request = (async () => {
      const [goldResult, fxResult] = await Promise.allSettled([
        fetchJson("https://api.gold-api.com/price/XAU"),
        fetchJson("https://api.frankfurter.dev/v2/rate/usd/khr")
      ]);
      if (goldResult.status === "fulfilled") {
        const price = Number(goldResult.value?.price);
        if (Number.isFinite(price) && price > 0) {
          state.goldUsdPerOunce = price;
          state.goldUpdatedAt = goldResult.value?.updatedAt || goldResult.value?.timestamp || Date.now();
        }
      }
      if (fxResult.status === "fulfilled") {
        const rate = Number(fxResult.value?.rate);
        if (Number.isFinite(rate) && rate > 0) {
          state.usdKhr = rate;
          state.fxDate = fxResult.value?.date || "";
        }
      }
      const gotQuote = goldResult.status === "fulfilled" || fxResult.status === "fulfilled";
      state.hasAttempted = true;
      if (gotQuote) {
        state.fetchedAt = Date.now();
        state.updatedAtLocal = state.fetchedAt;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (error) { /* keep the in-memory quote */ }
      }
      paint();
    })().catch(error => {
      console.warn("MYLIFE could not refresh savings market data.", error);
      state.hasAttempted = true;
      paint();
    }).finally(() => { request = null; });
    return request;
  }

  function render() {
    if (!fresh()) refresh();
    return `<section class="sv-market-card" aria-label="${escapeAttr(L("ព័ត៌មានទីផ្សារ", "Market watch"))}">
      <div class="sv-market-heading"><strong>${escapeHtml(L("ទីផ្សារ", "Market watch"))}</strong><button type="button" class="sv-market-refresh" data-sv-market-refresh aria-label="${escapeAttr(L("ធ្វើបច្ចុប្បន្នភាព", "Refresh market quotes"))}" title="${escapeAttr(L("ធ្វើបច្ចុប្បន្នភាព", "Refresh"))}">↻</button></div>
      <div data-savings-market>${content()}</div>
    </section>`;
  }

  window.setInterval(() => {
    if (document.visibilityState === "visible" && document.querySelector("[data-savings-market]")) refresh(true);
  }, CACHE_MS);

  return { render, refresh, quote: () => ({ ...state, goldUsdPerGram: Number(state.goldUsdPerOunce || 0) / GRAMS_PER_TROY_OUNCE, goldUsdPerChi: Number(state.goldUsdPerOunce || 0) / GRAMS_PER_TROY_OUNCE * GRAMS_PER_CHI, goldKhrPerChi: Number(state.goldUsdPerOunce || 0) / GRAMS_PER_TROY_OUNCE * GRAMS_PER_CHI * Number(state.usdKhr || 0) }) };
})();
