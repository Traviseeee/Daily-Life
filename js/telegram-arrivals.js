/* When something is added from the Telegram bot (expense, income, event, a bill
 * paid with ✅), the app shows "📲 Added from Telegram" with a sound the next time
 * it pulls from the cloud. Records carry source: "telegram" (set by the bot).
 * Which records were already announced is a per-device list in localStorage;
 * the first run only remembers what exists, so old records never pop up. */
const TelegramArrivals = (() => {
  const KEY = "mylife:tg-seen:v1";
  const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
  const FIRST_RUN_MS = 30 * 60 * 1000;
  const COLLECTIONS = [
    ["expenses", "expense"],
    ["income", "income"],
    ["calendarEvents", "event"]
  ];
  const ICON = { Food: "🍜", Transport: "🚗", Shopping: "🛍", Home: "🏠", Bills: "🧾", Family: "👨‍👩‍👧", Health: "💊", Education: "📚", Entertainment: "🎬", Other: "📦", Salary: "💼", Bonus: "🎁", Freelance: "🎨", Business: "🏪" };
  const km = () => (typeof languageCode === "function" ? languageCode() : "km") === "km";
  const L = (k, e) => (km() ? k : e);

  function readSeen() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeSeen(ids) {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch (error) {
      /* storage unavailable: worst case an item is announced again */
    }
  }

  function fromTelegram() {
    if (typeof appData === "undefined") return [];
    return COLLECTIONS.flatMap(([collection, kind]) => (appData[collection] || [])
      .filter(record => record && (record.source === "telegram" || record.method === "Telegram"))
      .map(record => ({ kind, record })));
  }

  function amountText(value, currency) {
    const number = Number(value || 0);
    if (currency === "KHR") return `${Math.round(number).toLocaleString("en-US")} ៛`;
    return `$${number.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }

  const label = category => `${ICON[category] || "📦"} ${typeof optionLabel === "function" ? optionLabel(category || "Other") : category}`;
  const safe = text => (typeof escapeHtml === "function" ? escapeHtml(String(text || "")) : String(text || ""));

  function describe({ kind, record }) {
    if (kind === "event") return `📅 ${safe(record.title)}`;
    const sign = kind === "income" ? "+" : "−";
    const name = record.description || record.name;
    return `${sign}${amountText(record.amount, record.currency)} · ${label(record.category)}${name && ![String(record.category).toLowerCase(), String(optionLabel?.(record.category) || "").toLowerCase()].includes(String(name).trim().toLowerCase()) ? ` · ${safe(name)}` : ""}`;
  }

  function check() {
    const items = fromTelegram();
    const ids = items.map(item => item.record.id);
    const seen = readSeen();
    // first run on this device: only items added in the last 30 minutes are announced
    const known = new Set(seen || items.filter(item => Date.now() - Date.parse(item.record.createdAt || 0) > FIRST_RUN_MS).map(item => item.record.id));
    const now = Date.now();
    const fresh = items.filter(item => !known.has(item.record.id)
      && now - Date.parse(item.record.createdAt || 0) < MAX_AGE_MS);
    writeSeen(ids);
    if (!fresh.length || typeof Toast === "undefined") return;

    const money = fresh.filter(item => item.kind !== "event");
    let message;
    if (fresh.length === 1) {
      message = `<b>📲 ${L("បានបន្ថែមពី Telegram", "Added from Telegram")}</b><br>${describe(fresh[0])}`;
    } else {
      const spent = money.filter(item => item.kind === "expense")
        .reduce((sum, item) => sum + toProfileCurrency(Number(item.record.amount || 0), item.record.currency), 0);
      const total = spent ? ` · ${L("ចំណាយ", "spent")} ${amountText(spent, appData.profile.currency || "USD")}` : "";
      message = `<b>📲 ${L(`បានបន្ថែម ${fresh.length} ពី Telegram`, `${fresh.length} added from Telegram`)}</b>${total}<br>${fresh.slice(0, 3).map(describe).join("<br>")}${fresh.length > 3 ? "<br>…" : ""}`;
    }
    showWhenClear(message, money.length ? "coin" : "notify");
  }

  // wait until the welcome poster / an open form is closed, so the toast is seen
  function showWhenClear(message, sound, tries = 0) {
    const root = document.getElementById("modalRoot");
    if (root?.classList.contains("open") && tries < 40) {
      setTimeout(() => showWhenClear(message, sound, tries + 1), 1000);
      return;
    }
    Toast.show(message, "success", { sound, duration: 5200 });
    if (navigator.vibrate && appData.profile?.haptics !== false) {
      try { navigator.vibrate([18, 60, 18]); } catch (error) { /* ignore */ }
    }
  }

  if (typeof Store !== "undefined" && typeof Store.syncFromSupabase === "function") {
    const sync = Store.syncFromSupabase.bind(Store);
    Store.syncFromSupabase = async (...args) => {
      const result = await sync(...args);
      try { check(); } catch (error) { /* never break sync */ }
      return result;
    };
  }
  window.addEventListener("mylife:cloud-merged", () => {
    try { check(); } catch (error) { /* ignore */ }
  });
  setTimeout(() => { try { check(); } catch (error) { /* ignore */ } }, 1500);

  return { check };
})();
