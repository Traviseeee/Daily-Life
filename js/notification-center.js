/*
 * MYLIFE Notification Center
 * Smart bell panel: shows time + live countdown, groups alerts (soon / today /
 * earlier today / tomorrow / this week), filters by kind, and lets the user
 * mark reminders done, snooze an alert for 1 hour, or hide it for today.
 * Hidden/snoozed state is a per-device convenience kept in localStorage.
 */
const NotificationCenter = (() => {
  const DISMISS_KEY = "mylife:notif-dismissed:v1";
  const SNOOZE_KEY = "mylife:notif-snooze:v1";
  const SOON_MS = 60 * 60 * 1000;
  const SNOOZE_MS = 60 * 60 * 1000;

  let filter = "all";
  let ticker = null;
  let keyHandler = null;

  const isKm = () => languageCode() === "km";
  const L = (km, en) => (isKm() ? km : en);

  const svg = paths => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const icon = {
    event: () => Icons.calendar(),
    bill: () => Icons.bill(),
    family: () => Icons.heart(),
    vehicle: () => (Icons.car ? Icons.car() : Icons.calendar()),
    reminder: () => svg('<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>'),
    clock: () => svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    snooze: () => svg('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2 1.5M5 4 2.5 6.5M19 4l2.5 2.5"/>'),
    check: () => svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    hide: () => svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    chevron: () => svg('<path d="m9 6 6 6-6 6"/>'),
    settings: () => Icons.settings(),
    bellOff: () => svg('<path d="M8.7 3.6A6 6 0 0 1 18 8c0 3.2.6 5.2 1.3 6.5M17 17H3c0-2 3-2 3-9 0-.6.1-1.2.2-1.7M10 21h4M3 3l18 18"/>')
  };

  const kindLabel = kind => ({
    event: L("ព្រឹត្តិការណ៍", "Event"),
    reminder: L("ការរំលឹក", "Reminder"),
    bill: L("វិក្កយបត្រ", "Bill"),
    family: L("គ្រួសារ", "Family"),
    vehicle: L("ម៉ូតូ/ឡាន", "Vehicle")
  })[kind] || L("ព្រឹត្តិការណ៍", "Event");

  /* ---------- per-device hidden / snoozed state ---------- */
  function readMap(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function writeMap(key, map) {
    try {
      localStorage.setItem(key, JSON.stringify(map));
    } catch (error) {
      /* storage unavailable: state just won't persist */
    }
  }

  const itemKey = item => `${item.type}|${item.id}|${item.date}`;

  function prune() {
    const today = calendarDateInput(new Date());
    const now = Date.now();
    [DISMISS_KEY, SNOOZE_KEY].forEach(key => {
      const map = readMap(key);
      let changed = false;
      Object.keys(map).forEach(entry => {
        const date = entry.split("|").pop();
        const expired = date < today || (key === SNOOZE_KEY && Number(map[entry]) <= now);
        if (expired) {
          delete map[entry];
          changed = true;
        }
      });
      if (changed) writeMap(key, map);
    });
  }

  function setState(key, item, value) {
    const map = readMap(key);
    if (value === null) delete map[itemKey(item)];
    else map[itemKey(item)] = value;
    writeMap(key, map);
  }

  /* ---------- data ---------- */
  function sourceRecord(item) {
    if (item.type === "event") return appData.calendarEvents.find(entry => entry.id === item.id);
    if (item.type === "reminder") return appData.reminders.find(entry => entry.id === item.id);
    if (item.type === "bill") return appData.bills.find(entry => entry.id === item.id);
    return null;
  }

  function enrich(item, now, dismissed, snoozed) {
    const record = sourceRecord(item) || {};
    const time = /^\d{1,2}:\d{2}/.test(String(record.time || "")) ? String(record.time).slice(0, 5).padStart(5, "0") : "";
    const at = new Date(`${item.date}T${time || "23:59"}:00`);
    const kind = item.type === "vehicle" ? "vehicle" : item.type === "bill" ? "bill" : item.source === "family" ? "family" : item.type === "reminder" ? "reminder" : "event";
    let group = "week";
    if (item.daysLeft === 0) {
      if (time && at < now) group = "earlier";
      else if (time && at - now <= SOON_MS) group = "soon";
      else group = "today";
    } else if (item.daysLeft === 1) {
      group = "tomorrow";
    }
    const key = itemKey(item);
    return {
      ...item,
      record,
      time,
      at,
      kind,
      group,
      muted: record.reminder === false,
      dismissed: Boolean(dismissed[key]),
      snoozedUntil: Number(snoozed[key]) > now.getTime() ? Number(snoozed[key]) : 0
    };
  }

  function collect() {
    prune();
    const now = new Date();
    const dismissed = readMap(DISMISS_KEY);
    const snoozed = readMap(SNOOZE_KEY);
    return [...getUpcomingNotifications(7, 60), ...vehicleItems()]
      .filter(item => typeof NotifyPrefs === "undefined" || NotifyPrefs.allows(appData.profile, item.type, "app"))
      .map(item => enrich(item, now, dismissed, snoozed))
      .sort((left, right) => left.at - right.at);
  }

  // 🏍️ services due within a week, or overdue (shown today until logged) — 12 Nov
  function vehicleItems() {
    if (typeof VehicleDue === "undefined" || !Array.isArray(appData.vehicles)) return [];
    const today = localDateInput();
    const out = [];
    appData.vehicles.forEach(v => (v.services || []).forEach(svc => {
      const st = VehicleDue.status(v, svc, today);
      if (!st.dueDate) return;
      const gap = VehicleDue.daysBetween(today, st.dueDate);
      if (gap > 7) return;
      const late = gap < 0 || st.p >= 1;
      out.push({
        id: `${v.id}|${svc.key}`, type: "vehicle", kind: "vehicle", vehicleId: v.id, service: svc.key,
        title: `${VehicleDue.EMOJI[svc.key] || "🔧"} ${late ? L(`ដល់ពេល${VehicleDue.name(svc.key)}`, `${VehicleDue.name(svc.key, false)} due`) : VehicleDue.name(svc.key, isKm())} · ${v.name}`,
        date: late ? today : st.dueDate, daysLeft: late ? 0 : gap, time: ""
      });
    }));
    return out;
  }

  const isActive = entry => !entry.dismissed && !entry.snoozedUntil;

  /* ---------- formatting ---------- */
  function clockLabel(entry) {
    if (!entry.time) return L("ពេញមួយថ្ងៃ", "All day");
    return fmtClockDate(entry.at);
  }

  function relativeLabel(entry, now) {
    if (entry.daysLeft === 0 && entry.time) {
      const minutes = Math.round((entry.at - now) / 60000);
      if (minutes === 0) return L("ឥឡូវនេះ", "Now");
      const abs = Math.abs(minutes);
      const hours = Math.floor(abs / 60);
      const rest = abs % 60;
      const span = hours
        ? L(`${hours} ម៉ោង${rest ? ` ${rest} នាទី` : ""}`, `${hours}h${rest ? ` ${rest}m` : ""}`)
        : L(`${abs} នាទី`, `${abs} min`);
      return minutes > 0 ? L(`នៅ ${span}ទៀត`, `in ${span}`) : L(`ហួស ${span}`, `${span} ago`);
    }
    if (entry.daysLeft === 0) return L("ថ្ងៃនេះ", "Today");
    if (entry.daysLeft === 1) return L("ស្អែក", "Tomorrow");
    // Khmer written by hand: many browsers have no km-KH dates and fall back to English
    const day = new Date(`${entry.date}T00:00:00`);
    const KM_D = ["អាទិត្យ", "ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
    const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
    const weekday = isKm() ? `${KM_D[day.getDay()]} ${day.getDate()} ${KM_M[day.getMonth()]}` : day.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
    return L(`${weekday} · ក្នុង ${entry.daysLeft} ថ្ងៃ`, `${weekday} · in ${entry.daysLeft} days`);
  }

  const groupMeta = () => [
    ["soon", L("ជិតដល់ម៉ោង", "Coming up")],
    ["today", L("ក្រោយទៀតថ្ងៃនេះ", "Later today")],
    ["earlier", L("ហួសម៉ោងហើយថ្ងៃនេះ", "Earlier today")],
    ["tomorrow", L("ស្អែក", "Tomorrow")],
    ["week", L("សប្តាហ៍នេះ", "This week")]
  ];

  /* ---------- badge ---------- */
  // same number on the Home Screen / taskbar icon (iOS 16.4+ web app, Chrome, Edge)
  let iconCount = -1;
  function syncAppIcon(count) {
    if (count === iconCount) return;
    iconCount = count;
    try {
      if ("setAppBadge" in navigator) {
        (count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => {});
      }
      if (window.caches) {
        caches.open("mylife-badge")
          .then(cache => cache.put("/__mylife-badge", new Response(String(count))))
          .catch(() => {});
      }
    } catch (error) {
      // unsupported browser: the bell still shows the number
    }
  }

  // back from the background: a push may have bumped the icon, set it to the real count
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    iconCount = -1;
    renderBadge();
  });

  function renderBadge() {
    const bell = document.getElementById("bellButton");
    if (!bell) return;
    const enabled = appData.profile?.notificationsEnabled !== false;
    const entries = collect().filter(isActive);
    const telegram = typeof TelegramArrivals !== "undefined" ? TelegramArrivals.unreadCount() : 0;
    const count = (enabled ? entries.filter(entry => entry.daysLeft <= 1 && entry.group !== "earlier").length : 0) + telegram;
    const urgent = enabled && entries.some(entry => entry.group === "soon");

    let badge = bell.querySelector(".notification-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "notification-badge";
      badge.setAttribute("aria-hidden", "true");
      bell.appendChild(badge);
    }

    const label = count
      ? L(`ការជូនដំណឹង ${count}`, `${count} notifications`)
      : L("ការជូនដំណឹង", "Notifications");
    badge.textContent = count > 99 ? "99+" : String(count || "");
    badge.hidden = count === 0;
    bell.classList.toggle("has-notifications", count > 0);
    bell.classList.toggle("has-urgent-notification", urgent);
    bell.classList.toggle("notifications-off", !enabled);
    bell.setAttribute("aria-label", label);
    bell.setAttribute("title", label);
    syncAppIcon(count);
  }

  /* ---------- panel ---------- */
  function getRoot() {
    let root = document.getElementById("notificationCenterRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "notificationCenterRoot";
      root.className = "nc-root";
      document.body.appendChild(root);
    }
    return root;
  }

  function itemHtml(entry, now) {
    const timeChip = `<span class="nc-time ${entry.time ? "" : "is-allday"}">${icon.clock()}${escapeHtml(clockLabel(entry))}</span>`;
    const canSnooze = entry.daysLeft === 0 && entry.time && entry.group !== "earlier";
    return `
      <li class="nc-item nc-kind-${entry.kind} nc-group-${entry.group} ${entry.muted ? "is-muted" : ""}" data-nc-key="${escapeAttr(itemKey(entry))}">
        <button class="nc-item-main" type="button" data-nc-open="${escapeAttr(itemKey(entry))}">
          <span class="nc-icon">${icon[entry.kind]()}</span>
          <span class="nc-copy">
            <strong>${escapeHtml(entry.title)}</strong>
            <span class="nc-meta">
              ${timeChip}
              <span class="nc-relative">${escapeHtml(relativeLabel(entry, now))}</span>
              ${entry.muted ? `<span class="nc-muted-flag" title="${escapeAttr(L("បានបិទការរំលឹក", "Reminder off"))}">${icon.bellOff()}</span>` : ""}
            </span>
          </span>
          <span class="nc-chevron">${icon.chevron()}</span>
        </button>
        <span class="nc-actions">
          ${entry.kind === "vehicle" ? `<button class="nc-action is-done" type="button" data-nc-vdone="${escapeAttr(itemKey(entry))}" title="${escapeAttr(L("ធ្វើរួច", "Done"))}" aria-label="${escapeAttr(L("ធ្វើរួច", "Done"))}">${icon.check()}</button>` : ""}
          ${entry.kind === "reminder" ? `<button class="nc-action is-done" type="button" data-nc-done="${escapeAttr(itemKey(entry))}" title="${escapeAttr(L("ធ្វើរួច", "Mark done"))}" aria-label="${escapeAttr(L("ធ្វើរួច", "Mark done"))}">${icon.check()}</button>` : ""}
          ${canSnooze ? `<button class="nc-action" type="button" data-nc-snooze="${escapeAttr(itemKey(entry))}" title="${escapeAttr(L("ពន្យារ 1 ម៉ោង", "Snooze 1 hour"))}" aria-label="${escapeAttr(L("ពន្យារ 1 ម៉ោង", "Snooze 1 hour"))}">${icon.snooze()}</button>` : ""}
          <button class="nc-action" type="button" data-nc-hide="${escapeAttr(itemKey(entry))}" title="${escapeAttr(L("លាក់សម្រាប់ថ្ងៃនេះ", "Hide for today"))}" aria-label="${escapeAttr(L("លាក់", "Hide"))}">${icon.hide()}</button>
        </span>
      </li>
    `;
  }

  function nextUpHtml(entries, now) {
    const next = entries.find(entry => entry.time && entry.at >= now && entry.daysLeft <= 1);
    if (!next) return "";
    const totalWindow = 6 * 60 * 60 * 1000;
    const progress = Math.max(4, Math.min(100, 100 - ((next.at - now) / totalWindow) * 100));
    return `
      <button class="nc-next nc-kind-${next.kind}" type="button" data-nc-open="${escapeAttr(itemKey(next))}">
        <span class="nc-next-label">${L("បន្ទាប់", "Up next")}</span>
        <span class="nc-next-title">${escapeHtml(next.title)}</span>
        <span class="nc-next-when"><strong>${escapeHtml(clockLabel(next))}</strong><span>${escapeHtml(relativeLabel(next, now))}</span></span>
        <span class="nc-progress" aria-hidden="true"><span style="width:${progress.toFixed(0)}%"></span></span>
      </button>
    `;
  }

  function agoLabel(at) {
    const minutes = Math.max(0, Math.round((Date.now() - at) / 60000));
    if (minutes < 1) return L("ឥឡូវនេះ", "Just now");
    if (minutes < 60) return L(`${minutes} នាទីមុន`, `${minutes} min ago`);
    const hours = Math.round(minutes / 60);
    if (hours < 24) return L(`${hours} ម៉ោងមុន`, `${hours}h ago`);
    return L(`${Math.round(hours / 24)} ថ្ងៃមុន`, `${Math.round(hours / 24)}d ago`);
  }

  function dayBucket(at) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    if (at >= start.getTime()) return "today";
    if (at >= start.getTime() - 86400000) return "yesterday";
    return "earlier";
  }

  function telegramRowHtml(entry) {
    const part = typeof TelegramArrivals.parts === "function" ? TelegramArrivals.parts(entry.item) : null;
    const dot = entry.read ? "" : `<i class="nc-dot" aria-label="${escapeAttr(L("ថ្មី", "New"))}"></i>`;
    if (!part) return `<li class="nc-item nc-kind-telegram ${entry.read ? "" : "is-new"}"><button class="nc-item-main" type="button" data-nc-tg-open="${escapeAttr(entry.url)}">${dot}<span class="nc-icon nc-tg-icon">${entry.collection === "bills" ? "🧾" : entry.collection === "calendarEvents" ? "📅" : entry.collection === "income" ? "💰" : "💸"}</span>
      <span class="nc-copy"><strong>${entry.text}</strong><span class="nc-meta"><span class="nc-relative">Telegram · ${escapeHtml(agoLabel(entry.at))}</span></span></span>
      <span class="nc-chevron">${icon.chevron()}</span></button></li>`;
    return `<li class="nc-item nc-kind-telegram ${entry.read ? "" : "is-new"}"><button class="nc-item-main" type="button" data-nc-tg-open="${escapeAttr(entry.url)}">${dot}<span class="nc-icon nc-tg-icon nc-tg-${part.tone}">${part.icon}</span>
      <span class="nc-copy"><strong class="nc-tg-title">${part.title}</strong><span class="nc-meta"><span class="nc-tg-cat">Telegram · ${part.sub}</span><span class="nc-relative">${escapeHtml(agoLabel(entry.at))}</span></span></span>
      ${part.amount ? `<span class="nc-tg-amount is-${part.tone}">${part.amount}</span>` : `<span class="nc-chevron">${icon.chevron()}</span>`}</button></li>`;
  }

  // Telegram arrivals, newest first, under "today / yesterday / earlier" (7 Nov 2026)
  function telegramHtml() {
    const list = typeof TelegramArrivals !== "undefined" ? TelegramArrivals.feed().slice(0, 8) : [];
    if (!list.length) return "";
    const names = { today: L("ថ្ងៃនេះ", "Today"), yesterday: L("ម្សិលមិញ", "Yesterday"), earlier: L("មុននេះ", "Earlier") };
    const days = ["today", "yesterday", "earlier"].map(day => [day, list.filter(entry => dayBucket(entry.at) === day)]).filter(([, items]) => items.length);
    return `
      <section class="nc-group nc-telegram" data-nc-group="telegram">
        <h3>📲 ${L("បានកត់ពី Telegram", "Added from Telegram")}<span>${list.length}</span><button class="nc-link nc-tg-clear" type="button" data-nc-tg-clear>${L("សម្អាត", "Clear")}</button></h3>
        ${days.map(([day, items]) => `<p class="nc-day">${names[day]}</p><ul class="nc-list">${items.map(telegramRowHtml).join("")}</ul>`).join("")}
      </section>
    `;
  }

  function savingsUseActivityHtml() {
    if (typeof NotifyPrefs !== "undefined" && !NotifyPrefs.allows(appData.profile, "savings-use", "app")) return "";
    const month = localDateInput().slice(0, 7);
    const entries = (appData.savings || []).flatMap(saving => (Array.isArray(saving.transactions) ? saving.transactions : [])
      .filter(entry => ["gold", "spend", "investment"].includes(entry.type) && String(entry.date || "").startsWith(month))
      .map(entry => ({ ...entry, savingName: saving.name || L("ប្រាក់សន្សំ", "Savings") })))
      .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
    if (!entries.length) return "";
    const totals = new Map();
    const goldTotals = new Map();
    const spendTotals = new Map();
    const investmentTotals = new Map();
    let chiTotal = 0;
    entries.forEach(entry => {
      const currency = entry.currency || appData.profile.currency || "USD";
      totals.set(currency, (totals.get(currency) || 0) + Number(entry.amount || 0));
      const typeTotals = entry.type === "gold" ? goldTotals : entry.type === "spend" ? spendTotals : investmentTotals;
      typeTotals.set(currency, (typeTotals.get(currency) || 0) + Number(entry.amount || 0));
      if (entry.type === "gold") chiTotal += Math.max(0, Number(entry.goldWeightGrams || 0)) / 3.75;
    });
    const monthDate = new Date(`${month}-01T00:00:00`);
    const monthName = monthDate.toLocaleDateString(isKm() ? "km-KH" : "en-US", { month: "long", year: "numeric" });
    const totalLabel = [...totals].map(([currency, amount]) => money(amount, currency)).join(" + ");
    const breakdown = [
      goldTotals.size ? `${L("មាស", "Gold")}: ${[...goldTotals].map(([currency, amount]) => String(money(amount, currency)).replace(/<[^>]*>/g, "")).join(" + ")}` : "",
      spendTotals.size ? `${L("ចំណាយ", "Spending")}: ${[...spendTotals].map(([currency, amount]) => String(money(amount, currency)).replace(/<[^>]*>/g, "")).join(" + ")}` : "",
      investmentTotals.size ? `${L("វិនិយោគ/ប្រើផ្សេងៗ", "Investment / other use")}: ${[...investmentTotals].map(([currency, amount]) => String(money(amount, currency)).replace(/<[^>]*>/g, "")).join(" + ")}` : ""
    ].filter(Boolean).join(" · ");
    return `<section class="nc-group nc-gold-activity" data-nc-group="savings-use">
      <h3>💰 ${escapeHtml(L(`ការប្រើប្រាក់សន្សំ · ${monthName}`, `Savings use · ${monthName}`))}<span>${entries.length}</span></h3>
      <div class="nc-gold-month-total"><span><small>${L("ប្រើពីសន្សំសរុបខែនេះ", "Total used from savings this month")}</small><strong>${totalLabel}</strong>${breakdown ? `<small>${escapeHtml(breakdown)}</small>` : ""}</span>${chiTotal ? `<b>${chiTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })} ជី ${L("មាស", "gold")}</b>` : ""}</div>
      <div class="nc-gold-list">${entries.slice(0, 5).map(entry => {
        const weight = Number(entry.goldWeightGrams || 0) / 3.75;
        const chi = entry.goldChi && entry.goldChi !== "custom" ? Number(entry.goldChi) : weight;
        const detail = entry.type === "gold"
          ? `${chi.toLocaleString("en-US", { maximumFractionDigits: 2 })} ជី · ${entry.goldPurity || "24K"}`
          : entry.type === "spend" ? [entry.category ? optionLabel(entry.category) : L("ចំណាយ", "Spending"), entry.note || ""].filter(Boolean).join(" · ") : entry.note || L("ប្រើផ្សេងៗ", "Other use");
        const txIcon = entry.type === "gold" ? "🪙" : entry.type === "spend" ? "💸" : "📈";
        const what = entry.type === "gold" ? `${L("ទិញមាស", "Gold")} ${detail}` : detail;
        return `<div class="nc-gold-row"><span class="nc-gold-coin">${txIcon}</span><span class="nc-gold-copy"><strong>${escapeHtml(what)}</strong><small>${escapeHtml(entry.savingName)} · ${escapeHtml(entry.date || "")}</small></span><b>−${money(Number(entry.amount || 0), entry.currency || "USD")}</b></div>`;
      }).join("")}</div>
      <a class="nc-gold-open" href="#money/savings">${L("បើកគណនីសន្សំ", "Open savings")} ›</a>
    </section>`;
  }

  function savingsMonthStats() {
    if (typeof NotifyPrefs !== "undefined" && !NotifyPrefs.allows(appData.profile, "savings-use", "app")) return { count: 0, chi: 0 };
    const month = localDateInput().slice(0, 7);
    let count = 0;
    let chi = 0;
    (appData.savings || []).forEach(saving => (Array.isArray(saving.transactions) ? saving.transactions : []).forEach(entry => {
      if (!["gold", "spend", "investment"].includes(entry.type) || !String(entry.date || "").startsWith(month)) return;
      count += 1;
      if (entry.type === "gold") chi += Math.max(0, Number(entry.goldWeightGrams || 0)) / 3.75;
    }));
    return { count, chi };
  }

  // Bell panel v2 (7 Nov 2026): small header, three summary boxes, tabs, Nimo's note,
  // then what's coming up, Telegram by day, savings use, and "done" folded away.
  function panelHtml() {
    const now = new Date();
    const enabled = appData.profile?.notificationsEnabled !== false;
    const all = collect();
    const active = all.filter(isActive);
    const hiddenCount = all.length - active.length;
    const kinds = ["event", "reminder", "bill", "family", "vehicle"].filter(kind => active.some(entry => entry.kind === kind));
    const tgList = typeof TelegramArrivals !== "undefined" ? TelegramArrivals.feed().slice(0, 8) : [];
    const tgNew = tgList.filter(entry => !entry.read).length;
    const sav = savingsMonthStats();
    const tabs = ["all", ...kinds, ...(tgList.length ? ["telegram"] : []), ...(sav.count ? ["savings"] : [])];
    if (filter === "todo") filter = "all";
    if (!tabs.includes(filter)) filter = "all";
    const showUpcoming = filter === "all" || kinds.includes(filter);
    const visible = filter === "all" ? active : active.filter(entry => entry.kind === filter);
    const todayCount = active.filter(entry => entry.daysLeft === 0).length;
    const newCount = tgNew + active.filter(entry => entry.daysLeft <= 1 && entry.group !== "earlier").length;

    const groups = groupMeta()
      .map(([id, title]) => [id, title, visible.filter(entry => entry.group === id)])
      .filter(([, , items]) => items.length);
    const tabLabel = id => id === "all" ? L("ទាំងអស់", "All") : id === "telegram" ? "Telegram" : id === "savings" ? L("សន្សំ", "Savings") : kindLabel(id);
    const tabCount = id => id === "all" ? active.length + tgList.length + sav.count : id === "telegram" ? tgList.length : id === "savings" ? sav.count : active.filter(entry => entry.kind === id).length;

    const nomi = typeof HomeV2 !== "undefined" && !!HomeV2.buddy ? (() => {
      const mood = !enabled ? "sleepy" : todayCount ? "worry" : "happy";
      const title = !enabled ? L("ការជូនដំណឹងបិទ 💤", "Alerts are off 💤")
        : todayCount ? L(`ថ្ងៃនេះមាន ${todayCount} រឿង`, `${todayCount} things today`)
        : active.length ? L("ថ្ងៃនេះទំនេរ 🌿", "Today is free 🌿") : L("គ្មានអ្វីត្រូវធ្វើទេ 🌿", "All caught up 🌿");
      const say = !enabled ? L("ខ្ញុំដេកសិន… បើកវិញនៅការកំណត់", "Nap time… turn them on in settings")
        : todayCount ? L("កុំភ្លេចណា! ខ្ញុំនឹងរំលឹកមុនម៉ោង។", "Don't forget — I'll remind you before.")
        : active.length ? L(`៧ ថ្ងៃខាងមុខមាន ${active.length} រឿង។ ថ្ងៃនេះសម្រាកបាន!`, `${active.length} coming up this week. Relax today!`)
        : L("វិក្កយបត្រ និងព្រឹត្តិការណ៍ ៧ ថ្ងៃខាងមុខ នៅស្អាត។", "No bills or events in the next 7 days.");
      return `<div class="nc-calm"><span class="nc-nomi" data-nomi data-mood="${mood}" role="button" tabindex="0" aria-label="Nomi">${HomeV2.buddy(mood)}</span><span class="nc-calm-copy"><b>${escapeHtml(title)}</b><small data-nomi-say>${escapeHtml(say)}</small></span></div>`;
    })() : "";

    const stat = (id, value, label, hl) => `<button type="button" class="nc-stat ${hl ? "is-hl" : ""} ${filter === id ? "active" : ""}" data-nc-filter="${id}"><b>${value}</b><small>${label}</small></button>`;
    const nothing = !groups.length && !tgList.length && !sav.count;

    return `
      <div class="nc-backdrop" data-nc-close></div>
      <section class="nc-panel nc-v2" role="dialog" aria-modal="true" aria-labelledby="ncTitle">
        <header class="nc-header">
          <h2 id="ncTitle">${L("ការជូនដំណឹង", "Notifications")}${newCount ? `<span class="nc-new-count">${L(`${newCount} ថ្មី`, `${newCount} new`)}</span>` : ""}</h2>
          <button class="nc-head-btn" type="button" data-nc-settings aria-label="${escapeAttr(L("ការកំណត់", "Settings"))}">${icon.settings()}</button>
          <button class="nc-close nc-head-btn" type="button" data-nc-close aria-label="${escapeAttr(t("close"))}">${Icons.close()}</button>
        </header>

        <div class="nc-scroll">
          ${enabled ? "" : `
            <div class="nc-banner">
              <span class="nc-banner-icon">${icon.bellOff()}</span>
              <span><strong>${L("ការជូនដំណឹងត្រូវបានបិទ", "Notifications are off")}</strong><small>${L("អ្នកនឹងមិនទទួលបាន alert ទេ", "You won't get alerts")}</small></span>
              <button class="nc-banner-button" type="button" data-nc-settings>${L("បើក", "Turn on")}</button>
            </div>
          `}

          ${nothing ? "" : `<div class="nc-stats">
            ${stat("all", todayCount, L("ត្រូវធ្វើថ្ងៃនេះ", "To do today"), true)}
            ${stat("telegram", tgList.length, L("Telegram", "Telegram"))}
            ${stat("savings", sav.chi ? `${sav.chi.toLocaleString("en-US", { maximumFractionDigits: 2 })} ជី` : sav.count, sav.chi ? L("មាសខែនេះ", "Gold this month") : L("ប្រើសន្សំ", "Savings use"))}
          </div>`}

          ${tabs.length > 2 ? `
            <div class="nc-filters" role="tablist" aria-label="${escapeAttr(L("ត្រងតាមប្រភេទ", "Filter by type"))}">
              ${tabs.map(id => `<button type="button" role="tab" class="nc-filter nc-kind-${id} ${filter === id ? "active" : ""}" data-nc-filter="${id}" aria-selected="${filter === id}">${escapeHtml(tabLabel(id))}<span>${tabCount(id)}</span></button>`).join("")}
            </div>
          ` : ""}

          ${filter === "all" ? nomi : ""}
          ${showUpcoming ? nextUpHtml(active, now) : ""}
          ${showUpcoming ? groups.map(([id, title, items]) => `
            <section class="nc-group" data-nc-group="${id}">
              <h3>${escapeHtml(title)}<span>${items.length}</span></h3>
              <ul class="nc-list">${items.map(entry => itemHtml(entry, now)).join("")}</ul>
            </section>
          `).join("") : ""}
          ${filter === "all" || filter === "telegram" ? telegramHtml() : ""}
          ${filter === "all" || filter === "savings" ? savingsUseActivityHtml() : ""}
          ${nothing && !(filter === "all" && nomi) ? `
            <div class="nc-empty">
              <span class="nc-empty-icon">${Icons.bell()}</span>
              <strong>${L("គ្មានការជូនដំណឹង", "Nothing coming up")}</strong>
              <small>${L("ការរំលឹក ព្រឹត្តិការណ៍ និងវិក្កយបត្រក្នុង 7 ថ្ងៃខាងមុខនឹងបង្ហាញនៅទីនេះ", "Reminders, events and bills for the next 7 days show up here")}</small>
            </div>
          ` : ""}
          ${filter === "all" && typeof DoneFeed !== "undefined" ? (() => {
            const done = DoneFeed.bellHtml();
            if (!done) return "";
            const n = typeof DoneFeed.items === "function" ? DoneFeed.items(7).slice(0, 8).length : "";
            return `<details class="nc-done-fold"><summary>✓ ${L("បានធ្វើរួច · 7 ថ្ងៃ", "Done · 7 days")}<span>${n}</span></summary>${done}</details>`;
          })() : ""}
        </div>

        <footer class="nc-footer">
          ${hiddenCount ? `<button class="nc-link" type="button" data-nc-restore>${L(`បង្ហាញ ${hiddenCount} ដែលបានលាក់`, `Show ${hiddenCount} hidden`)}</button>` : "<span></span>"}
          <button class="nc-link" type="button" data-nc-settings>${icon.settings()}${L("ការកំណត់ការជូនដំណឹង", "Notification settings")}</button>
        </footer>
        <div class="nc-grab" data-nc-grab aria-hidden="true"><i></i></div>
      </section>
    `;
  }

  function findEntry(key) {
    return collect().find(entry => itemKey(entry) === key);
  }

  function rerender() {
    const root = document.getElementById("notificationCenterRoot");
    if (!root || !root.classList.contains("open")) return;
    const scroll = root.querySelector(".nc-scroll")?.scrollTop || 0;
    root.innerHTML = panelHtml();
    const nextScroll = root.querySelector(".nc-scroll");
    if (nextScroll) nextScroll.scrollTop = scroll;
    const panel = root.querySelector(".nc-panel");
    if (panel) panel.style.animation = "none"; // a refresh, not an opening: don't slide in again
    bind(root);
    bindDrag(root);
    renderBadge();
  }

  function openRecord(entry) {
    close();
    if (entry.kind === "family") {
      location.hash = "#family";
      return;
    }
    if (entry.kind === "vehicle") {
      location.hash = "#vehicle";
      return;
    }
    if (entry.kind === "bill") {
      location.hash = "#money/bills";
      return;
    }
    if (entry.kind === "reminder") {
      location.hash = "#daily";
      return;
    }
    location.hash = "#calendar";
    setTimeout(() => {
      const event = appData.calendarEvents.find(record => record.id === entry.id);
      if (event && typeof App.openNotificationDetail === "function") App.openNotificationDetail(event, entry);
    }, 200);
  }

  function bind(root) {
    root.querySelectorAll("[data-nc-close]").forEach(element => element.addEventListener("click", close));

    root.querySelectorAll("[data-nc-filter]").forEach(button => button.addEventListener("click", () => {
      filter = button.dataset.ncFilter;
      rerender();
    }));

    root.querySelectorAll("[data-nc-open]").forEach(button => button.addEventListener("click", () => {
      const entry = findEntry(button.dataset.ncOpen);
      if (entry) openRecord(entry);
    }));

    root.querySelectorAll("[data-nc-hide]").forEach(button => button.addEventListener("click", () => {
      const entry = findEntry(button.dataset.ncHide);
      if (!entry) return;
      setState(DISMISS_KEY, entry, Date.now());
      animateOut(button, rerender);
    }));

    root.querySelectorAll("[data-nc-snooze]").forEach(button => button.addEventListener("click", () => {
      const entry = findEntry(button.dataset.ncSnooze);
      if (!entry) return;
      setState(SNOOZE_KEY, entry, Date.now() + SNOOZE_MS);
      Toast.show(L(`ពន្យារ "${entry.title}" 1 ម៉ោង`, `Snoozed "${entry.title}" for 1 hour`), "success", { duration: 2200 });
      animateOut(button, rerender);
    }));

    // 🏍️ ✓ → the "log a service" form, already filled (guessed km, last price)
    root.querySelectorAll("[data-nc-vdone]").forEach(button => button.addEventListener("click", () => {
      const entry = findEntry(button.dataset.ncVdone);
      if (!entry || entry.kind !== "vehicle") return;
      close();
      if (location.hash !== "#vehicle") location.hash = "#vehicle";
      setTimeout(() => { if (typeof VehicleTool !== "undefined" && VehicleTool.openLog) VehicleTool.openLog(entry.vehicleId, entry.service); }, 250);
    }));

    root.querySelectorAll("[data-nc-done]").forEach(button => button.addEventListener("click", () => {
      const entry = findEntry(button.dataset.ncDone);
      if (!entry || entry.kind !== "reminder") return;
      animateOut(button, () => {
        Store.edit("reminders", entry.id, { done: true });
        Toast.show(L("បានសម្គាល់ថាធ្វើរួច", "Marked as done"), "success", { duration: 2000 });
        rerender();
      });
    }));

    root.querySelectorAll("[data-nc-tg-open]").forEach(button => button.addEventListener("click", () => {
      const url = button.dataset.ncTgOpen;
      close();
      location.hash = url;
    }));

    root.querySelectorAll("[data-nc-tg-clear]").forEach(button => button.addEventListener("click", () => {
      TelegramArrivals.clearFeed();
      rerender();
    }));

    root.querySelectorAll("[data-nc-restore]").forEach(button => button.addEventListener("click", () => {
      writeMap(DISMISS_KEY, {});
      writeMap(SNOOZE_KEY, {});
      rerender();
    }));

    root.querySelectorAll("[data-nc-settings]").forEach(button => button.addEventListener("click", () => {
      close();
      // the notification control center when it is loaded, the Settings page otherwise
      if (typeof NotifyCenter !== "undefined") NotifyCenter.open();
      else location.hash = "#settings";
    }));
  }

  // phone: the panel drops from the top like iPhone's Notification Center — drag it back up to close
  function bindDrag(root) {
    const panel = root.querySelector(".nc-panel");
    if (!panel || !window.matchMedia?.("(max-width: 720px)").matches) return;
    let startY = 0, dy = 0, dragging = false;
    panel.addEventListener("touchstart", event => {
      const fromGrab = event.target.closest("[data-nc-grab], .nc-header");
      const scroll = panel.querySelector(".nc-scroll");
      const atBottom = scroll && scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 2;
      if (!fromGrab && !atBottom) return;
      dragging = true; startY = event.touches[0].clientY; dy = 0;
      panel.style.animation = "none"; // the drop-in animation would hold the position
      panel.style.transition = "none";
    }, { passive: true });
    panel.addEventListener("touchmove", event => {
      if (!dragging) return;
      dy = Math.min(0, event.touches[0].clientY - startY);
      if (dy < -4) panel.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    panel.addEventListener("touchend", () => {
      if (!dragging) return;
      dragging = false;
      panel.style.transition = "transform .22s ease";
      if (dy < -70) {
        panel.style.transform = "translateY(-105%)";
        setTimeout(close, 200);
      } else {
        panel.style.transform = "";
      }
    });
  }

  // phone: pull down on the page head (avatar / weather / bell row) to open the panel
  (function bindPullOpen() {
    let startY = 0, startX = 0, armed = false;
    document.addEventListener("touchstart", event => {
      armed = false;
      if (!window.matchMedia?.("(max-width: 720px)").matches || window.scrollY > 4) return;
      if (!event.target.closest?.(".topbar, .hv2-head") || event.target.closest("input, textarea, select")) return;
      if (document.getElementById("notificationCenterRoot")?.classList.contains("open")) return;
      if (document.getElementById("modalRoot")?.classList.contains("open")) return;
      armed = true; startY = event.touches[0].clientY; startX = event.touches[0].clientX;
    }, { passive: true });
    document.addEventListener("touchend", event => {
      if (!armed) return;
      armed = false;
      const touch = event.changedTouches[0];
      const dy = touch.clientY - startY;
      const dx = Math.abs(touch.clientX - startX);
      if (dy > 60 && dx < dy * 0.6) open();
    }, { passive: true });
  })();

  function animateOut(button, done) {
    const row = button.closest(".nc-item");
    if (!row || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      done();
      return;
    }
    row.classList.add("is-leaving");
    setTimeout(done, 180);
  }

  function open() {
    const root = getRoot();
    root.classList.add("open");
    root.innerHTML = panelHtml();
    bind(root);
    bindDrag(root);
    document.getElementById("bellButton")?.setAttribute("aria-expanded", "true");
    root.querySelector(".nc-close")?.focus({ preventScroll: true });
    if (typeof TelegramArrivals !== "undefined") {
      TelegramArrivals.markRead();
      renderBadge();
    }

    clearInterval(ticker);
    ticker = setInterval(rerender, 30000);

    keyHandler = event => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", keyHandler);
  }

  function close() {
    const root = document.getElementById("notificationCenterRoot");
    clearInterval(ticker);
    ticker = null;
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
    if (!root) return;
    root.classList.remove("open");
    root.innerHTML = "";
    const bell = document.getElementById("bellButton");
    bell?.setAttribute("aria-expanded", "false");
    renderBadge();
  }

  function toggle() {
    const root = document.getElementById("notificationCenterRoot");
    if (root?.classList.contains("open")) close();
    else open();
  }

  return { open, close, toggle, renderBadge, refresh: rerender };
})();
