/* When something is added from the Telegram bot (expense, income, event, a bill
 * paid with ✅), the app shows "📲 Added from Telegram" with a sound the next time
 * it pulls from the cloud. Records carry source: "telegram" (set by the bot).
 * Which records were already announced is a per-device list in localStorage;
 * the first run only remembers what exists, so old records never pop up. */
const TelegramArrivals = (() => {
  const KEY = "mylife:tg-seen:v1";
  const FEED_KEY = "mylife:tg-feed:v1";
  const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
  const FIRST_RUN_MS = 30 * 60 * 1000;
  const COLLECTIONS = [
    ["expenses", "expense"],
    ["income", "income"],
    ["calendarEvents", "event"]
  ];
  const ICON = { Food: "🍜", Transport: "🚗", Shopping: "🛍", Home: "🏠", Bills: "🧾", Loan: "🏦", Family: "👨‍👩‍👧", Health: "💊", Education: "📚", Entertainment: "🎬", Other: "📦", Salary: "💼", Bonus: "🎁", Freelance: "🎨", Business: "🏪" };
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

  /* bell feed: [{ collection, id, at, read }] newest first, kept 3 days */
  function readFeed() {
    try {
      const list = JSON.parse(localStorage.getItem(FEED_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return [];
    }
  }

  function writeFeed(list) {
    try {
      localStorage.setItem(FEED_KEY, JSON.stringify(list.slice(0, 30)));
    } catch (error) {
      /* ignore */
    }
  }

  function lookup(entry) {
    if (entry.collection === "bills") {
      const bill = (appData.bills || []).find(item => item.id === entry.id);
      if (!bill) return null;
      if (entry.kind === "billpaid") return { kind: "billpaid", record: bill };
      return bill.invoiceAt ? { kind: "invoice", record: bill } : null;
    }
    const pair = COLLECTIONS.find(([collection]) => collection === entry.collection);
    const record = pair && (appData[pair[0]] || []).find(item => item.id === entry.id);
    return record ? { kind: pair[1], record } : null;
  }

  // items still in the app (undone ones drop out), with display text
  function feed() {
    const now = Date.now();
    return readFeed()
      .filter(entry => now - entry.at < MAX_AGE_MS)
      .map(entry => ({ ...entry, item: lookup(entry) }))
      .filter(entry => entry.item)
      .map(entry => ({ ...entry, text: describe(entry.item), url: entry.collection === "bills" ? "#money/bills" : entry.collection === "calendarEvents" ? "#calendar" : entry.collection === "income" ? "#money/income" : "#money/expenses" }));
  }

  const unreadCount = () => feed().filter(entry => !entry.read).length;

  function markRead() {
    const list = readFeed();
    if (!list.some(entry => !entry.read)) return;
    writeFeed(list.map(entry => ({ ...entry, read: true })));
  }

  function clearFeed() {
    writeFeed([]);
  }

  function fromTelegram() {
    if (typeof appData === "undefined") return [];
    const records = COLLECTIONS.flatMap(([collection, kind]) => (appData[collection] || [])
      .filter(record => record && (record.source === "telegram" || record.method === "Telegram"))
      .map(record => ({ kind, record, key: record.id, at: record.createdAt })));
    // water / electricity invoice from the PPWSA / EDC bots: one pop-up per invoice
    const invoices = (appData.bills || [])
      .filter(bill => bill && bill.invoiceAt)
      .map(bill => ({ kind: "invoice", record: bill, key: `bill:${bill.id}:${bill.invoiceAt}`, at: bill.invoiceAt }));
    // a bill marked paid with ✅ in Telegram that recorded no expense (amount unknown)
    const paid = (appData.bills || [])
      .filter(bill => bill && bill.paidAt && bill.paidVia && bill.paidVia !== "app" && !(Number(bill.amount) > 0 && bill.lastPaidExpenseId))
      .map(bill => ({ kind: "billpaid", record: bill, key: `paid:${bill.id}:${bill.paidAt}`, at: bill.paidAt }));
    return [...records, ...invoices, ...paid];
  }

  const UTILITY_ICON = bill => (/water|ppwsa|ទឹក/i.test(`${bill.name} ${bill.notes || ""}`) ? "💧" : /electric|edc|ភ្លើង|អគ្គិសនី/i.test(`${bill.name} ${bill.notes || ""}`) ? "⚡" : "🧾");

  function amountText(value, currency) {
    const number = Number(value || 0);
    if (currency === "KHR") return `${Math.round(number).toLocaleString("en-US")} ៛`;
    return `$${number.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }

  const label = category => `${ICON[category] || "📦"} ${typeof optionLabel === "function" ? optionLabel(category || "Other") : category}`;
  const safe = text => (typeof escapeHtml === "function" ? escapeHtml(String(text || "")) : String(text || ""));

  function describe({ kind, record }) {
    if (kind === "invoice") return `${UTILITY_ICON(record)} ${L("វិក្កយបត្រថ្មី", "New bill")} · ${safe(record.name)}`;
    if (kind === "billpaid") return `✅ ${L("បានបង់", "Paid")} · ${safe(record.name)}`;
    if (kind === "event") return `📅 ${safe(record.title)}`;
    const sign = kind === "income" ? "+" : "−";
    const name = record.description || record.name;
    return `${sign}${amountText(record.amount, record.currency)} · ${label(record.category)}${name && ![String(record.category).toLowerCase(), String(optionLabel?.(record.category) || "").toLowerCase()].includes(String(name).trim().toLowerCase()) ? ` · ${safe(name)}` : ""}`;
  }

  // the same item split for a list row: icon · title · small line · amount (bell panel)
  function parts({ kind, record }) {
    const catName = typeof optionLabel === "function" ? optionLabel(record.category || "Other") : (record.category || "");
    if (kind === "invoice") return { icon: UTILITY_ICON(record), title: safe(record.name), sub: L("វិក្កយបត្រថ្មី", "New bill"), amount: Number(record.amount) > 0 ? amountText(record.amount, record.currency) : "", tone: "bill" };
    if (kind === "billpaid") return { icon: "✅", title: safe(record.name), sub: L("បានបង់", "Paid"), amount: "", tone: "paid" };
    if (kind === "event") return { icon: "📅", title: safe(record.title), sub: L("ព្រឹត្តិការណ៍", "Event"), amount: "", tone: "event" };
    const name = String(record.description || record.name || "").trim();
    const sameAsCat = !name || [String(record.category).toLowerCase(), String(catName).toLowerCase()].includes(name.toLowerCase());
    return {
      icon: ICON[record.category] || (kind === "income" ? "💰" : "📦"),
      title: safe(sameAsCat ? catName : name),
      sub: sameAsCat ? "" : safe(catName),
      amount: `${kind === "income" ? "+" : "−"}${amountText(record.amount, record.currency)}`,
      tone: kind === "income" ? "in" : "out"
    };
  }

  function check() {
    const items = fromTelegram();
    const ids = items.map(item => item.key);
    const seen = readSeen();
    // first run on this device: only items added in the last 30 minutes are announced
    const known = new Set(seen || items.filter(item => Date.now() - Date.parse(item.at || 0) > FIRST_RUN_MS).map(item => item.key));
    const now = Date.now();
    const fresh = items.filter(item => !known.has(item.key)
      && now - Date.parse(item.at || 0) < MAX_AGE_MS);
    writeSeen(ids);
    if (!fresh.length) return;
    const isBill = kind => kind === "invoice" || kind === "billpaid";
    const collectionOf = kind => (isBill(kind) ? "bills" : COLLECTIONS.find(([, k]) => k === kind)[0]);
    const feedNow = readFeed().filter(entry => !fresh.some(item => isBill(item.kind) && entry.collection === "bills" && entry.id === item.record.id));
    writeFeed([
      ...fresh.map(item => ({ collection: collectionOf(item.kind), id: item.record.id, kind: isBill(item.kind) ? item.kind : undefined, at: Date.parse(item.at || 0) || Date.now(), read: false })),
      ...feedNow
    ]);
    if (typeof NotificationCenter !== "undefined") NotificationCenter.renderBadge();

    const money = fresh.filter(item => item.kind === "expense" || item.kind === "income");
    showWhenClear(fresh, money.length ? "coin" : "notify");
  }

  /* ---------- centre pop-up: "Added successfully" ---------- */
  const AUTO_CLOSE_MS = 8000;
  let popupTimer = null;

  function closePopup() {
    clearTimeout(popupTimer);
    const node = document.getElementById("tgaPopup");
    if (!node) return;
    node.classList.add("is-leaving");
    document.removeEventListener("keydown", escClose);
    setTimeout(() => node.remove(), 200);
  }

  function escClose(event) {
    if (event.key === "Escape") closePopup();
  }

  function rowHtml({ kind, record }) {
    if (kind === "billpaid") {
      const next = record.due ? `${L("លើកក្រោយ", "Next")} ${formatDate(record.due)}` : "";
      return `<li class="tga-row tga-billpaid"><span class="tga-row-icon">${UTILITY_ICON(record)}</span><span class="tga-row-copy"><strong>${safe(record.name)}</strong><small>✅ ${L("បានបង់", "Paid")}${next ? ` · ${safe(next)}` : ""}</small></span></li>`;
    }
    if (kind === "invoice") {
      const due = record.due ? `${L("ផុតកំណត់", "Due")} ${formatDate(record.due)}` : "";
      const amount = Number(record.amount) > 0 ? `<span class="tga-amount">${amountText(record.amount, record.currency)}</span>` : "";
      return `<li class="tga-row tga-invoice"><span class="tga-row-icon">${UTILITY_ICON(record)}</span><span class="tga-row-copy"><strong>${safe(record.name)}</strong><small>${safe(due)}</small></span>${amount}</li>`;
    }
    if (kind === "event") {
      const when = [record.date ? formatDate(record.date) : "", record.time && typeof fmtClock === "function" ? fmtClock(record.time) : ""].filter(Boolean).join(" · ");
      return `<li class="tga-row"><span class="tga-row-icon">📅</span><span class="tga-row-copy"><strong>${safe(record.title)}</strong><small>${safe(when)}</small></span></li>`;
    }
    const sign = kind === "income" ? "+" : "−";
    const name = record.description || record.name || "";
    const sameAsCat = [String(record.category).toLowerCase(), String(optionLabel?.(record.category) || "").toLowerCase()].includes(name.trim().toLowerCase());
    const today = typeof localDateInput === "function" ? localDateInput() : "";
    const day = record.date || record.nextPaymentDate;
    const dayText = day && day !== today ? ` · ${formatDate(day)}` : "";
    return `<li class="tga-row tga-${kind}">
      <span class="tga-row-icon">${ICON[record.category] || "📦"}</span>
      <span class="tga-row-copy"><strong>${safe(optionLabel?.(record.category) || record.category)}</strong><small>${sameAsCat || !name ? "" : safe(name)}${safe(dayText)}</small></span>
      <span class="tga-amount">${sign}${amountText(record.amount, record.currency)}</span>
    </li>`;
  }

  function budgetHtml(fresh) {
    const month = (typeof localDateInput === "function" ? localDateInput() : "").slice(0, 7);
    const budgets = appData.profile?.categoryBudgets || {};
    const cats = [...new Set(fresh.filter(item => item.kind === "expense").map(item => item.record.category))].filter(cat => Number(budgets[cat]) > 0);
    return cats.map(category => {
      const budget = Number(budgets[category]);
      const spent = (appData.expenses || []).filter(e => String(e.date || "").startsWith(month) && (e.category || "Other") === category)
        .reduce((sum, e) => sum + toProfileCurrency(Number(e.amount || 0), e.currency), 0);
      const percent = Math.round((spent / budget) * 100);
      const tone = percent >= 100 ? "is-over" : percent >= 80 ? "is-near" : "";
      return `<div class="tga-budget ${tone}">
        <span>${ICON[category] || "📦"} ${L("ថវិកា", "Budget")} ${safe(optionLabel?.(category) || category)}</span>
        <strong>${percent}%</strong>
        <span class="tga-bar"><span style="width:${Math.min(100, percent)}%"></span></span>
        <small>${amountText(spent, appData.profile.currency || "USD")} / ${amountText(budget, appData.profile.currency || "USD")}${percent >= 100 ? ` · ${L("លើសថវិកា", "over budget")}` : ""}</small>
      </div>`;
    }).join("");
  }

  function showPopup(fresh, sound) {
    closePopup();
    document.getElementById("tgaPopup")?.remove();
    const onlyEvents = fresh.every(item => item.kind === "event");
    const onlyIncome = fresh.every(item => item.kind === "income");
    const onlyInvoices = fresh.every(item => item.kind === "invoice");
    const onlyPaid = fresh.every(item => item.kind === "billpaid");
    const url = onlyInvoices || onlyPaid ? "#money/bills" : onlyEvents ? "#calendar" : onlyIncome ? "#money/income" : "#money/expenses";
    const what = onlyInvoices || onlyPaid ? L("វិក្កយបត្រ", "bill") : onlyEvents ? L("ព្រឹត្តិការណ៍", "event") : onlyIncome ? L("ចំណូល", "income") : L("ចំណាយ", "expense");
    const invoice = onlyInvoices && fresh.length === 1 ? fresh[0].record : null;
    const node = document.createElement("div");
    node.id = "tgaPopup";
    node.className = "tga-overlay";
    node.innerHTML = `
      <section class="tga-card" role="dialog" aria-modal="true" aria-labelledby="tgaTitle">
        <div class="tga-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>
        <h3 id="tgaTitle">${onlyInvoices ? L("មានវិក្កយបត្រថ្មី!", "New bill arrived!") : onlyPaid ? L("បានបង់រួចរាល់!", "Bill paid!") : L("បានបន្ថែមដោយជោគជ័យ!", "Added successfully!")}</h3>
        <p class="tga-sub">📲 ${fresh.length > 1
          ? L(`${fresh.length} ពី Telegram · រក្សាទុកក្នុង app រួចហើយ`, `${fresh.length} from Telegram · saved in the app`)
          : L(`${what}ពី Telegram · រក្សាទុកក្នុង app រួចហើយ`, `${what} from Telegram · saved in the app`)}</p>
        <ul class="tga-list">${fresh.slice(0, 5).map(rowHtml).join("")}</ul>
        ${fresh.length > 5 ? `<p class="tga-more">+${fresh.length - 5} ${L("ទៀត", "more")}</p>` : ""}
        ${budgetHtml(fresh)}
        <div class="tga-actions">
          ${invoice && /^https:\/\//.test(invoice.invoiceUrl || "") ? `<a class="tga-btn tga-view" href="${safe(invoice.invoiceUrl)}" target="_blank" rel="noopener" data-tga-link>🔗 ${L("មើលវិក្កយបត្រ", "View bill")}</a>` : `<button type="button" class="tga-btn tga-view" data-tga-view>${L("មើល", "View")}</button>`}
          <button type="button" class="tga-btn tga-ok" data-tga-ok>${L("យល់ព្រម", "OK")}</button>
        </div>
        <span class="tga-timer" aria-hidden="true"><span style="animation-duration:${AUTO_CLOSE_MS}ms"></span></span>
      </section>`;
    document.body.appendChild(node);
    node.addEventListener("click", event => {
      if (event.target === node || event.target.closest("[data-tga-ok]") || event.target.closest("[data-tga-link]")) closePopup();
      if (event.target.closest("[data-tga-view]")) {
        closePopup();
        location.hash = url;
      }
    });
    document.addEventListener("keydown", escClose);
    const card = node.querySelector(".tga-card");
    // pause the countdown while the pointer is on the card, continue after
    let remaining = AUTO_CLOSE_MS;
    let startedAt = Date.now();
    const start = () => { startedAt = Date.now(); clearTimeout(popupTimer); popupTimer = setTimeout(closePopup, remaining); };
    card.addEventListener("pointerenter", () => { clearTimeout(popupTimer); remaining = Math.max(800, remaining - (Date.now() - startedAt)); });
    card.addEventListener("pointerleave", start);
    start();
    if (typeof Sound !== "undefined") Sound.play(sound);
    if (navigator.vibrate && appData.profile?.haptics !== false) {
      try { navigator.vibrate([18, 60, 18]); } catch (error) { /* ignore */ }
    }
    node.querySelector("[data-tga-ok]")?.focus({ preventScroll: true });
  }

  // wait until the welcome poster / an open form is closed, so the pop-up is seen
  function showWhenClear(fresh, sound, tries = 0) {
    const root = document.getElementById("modalRoot");
    const busy = root?.classList.contains("open") || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (busy && tries < 60) {
      setTimeout(() => showWhenClear(fresh, sound, tries + 1), 1000);
      return;
    }
    showPopup(fresh, sound);
  }

  if (typeof Store !== "undefined" && typeof Store.syncFromSupabase === "function") {
    const sync = Store.syncFromSupabase.bind(Store);
    Store.syncFromSupabase = async (...args) => {
      const result = await sync(...args);
      try { check(); } catch (error) { /* never break sync */ }
      return result;
    };
  }
  // the service worker got a push ("added from Telegram"): pull now instead of waiting
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data?.type !== "mylife-pull" || typeof Store === "undefined") return;
      Promise.resolve(Store.syncFromSupabase()).then(applied => {
        if (applied) window.dispatchEvent(new Event("mylife:cloud-merged"));
      }).catch(() => {});
    });
  }
  window.addEventListener("mylife:cloud-merged", () => {
    try { check(); } catch (error) { /* ignore */ }
  });
  setTimeout(() => { try { check(); } catch (error) { /* ignore */ } }, 1500);

  return { check, feed, unreadCount, markRead, clearFeed, parts };
})();
