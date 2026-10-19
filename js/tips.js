/*
 * Tips page — "គន្លឹះគ្រួសារ / Family tips".
 *
 * Today's tip hero, weekly goal ring + streak, "For you this week" cards
 * (family birthdays/anniversaries, weekly check-in, weekend idea), filterable
 * tip cards that open a bottom sheet, and editable family principles.
 *
 * Progress lives in appData.profile.tips and appData.profile.familyPrinciples,
 * so it syncs with the account. Tip content comes from getTipsData() in
 * dashboard.js. Loaded after js/dashboard.js.
 */

const TIPS_WEEKLY_GOAL = 3;
const TIPS_DONE_LIMIT = 300;
const TIPS_DEFAULT_PRINCIPLES = ["ជួយគ្នា", "និយាយគ្នា", "គោរពគ្រួសារទាំងសងខាង", "គ្រប់គ្រងលុយជាមួយគ្នា", "រកពេលសម្រាប់គ្នា", "សម្របគ្នាពេលមានបញ្ហា"];
const TIPS_FILTERS = ["ALL", "SAVED", "DAILY", "WEEKLY", "LOVE", "FAMILY", "MONEY", "FUTURE"];
const TIPS_FILTER_MAP = { BALANCE: "FAMILY", HOLIDAY: "FAMILY", HOME: "FAMILY", SELF: "LOVE", MINDSET: "LOVE" };
const TIPS_CATEGORY_KM = { ALL: "ទាំងអស់", SAVED: "បានរក្សាទុក", DAILY: "ប្រចាំថ្ងៃ", WEEKLY: "ប្រចាំសប្តាហ៍", LOVE: "ស្នេហា", FAMILY: "គ្រួសារ", MONEY: "លុយ", FUTURE: "អនាគត" };
const TIPS_CATEGORY_EN = { ALL: "All", SAVED: "Saved", DAILY: "Daily", WEEKLY: "Weekly", LOVE: "Love", FAMILY: "Family", MONEY: "Money", FUTURE: "Future" };

const TIPS_WEEKEND_IDEAS = {
  0: [
    { km: "ដើរលេងមាត់ទន្លេពេលថ្ងៃលិច ហើយនិយាយពីគោលដៅខែនេះ", en: "Sunset walk by the riverside and talk about this month's goals" },
    { km: "ចម្អិនម្ហូបដែលចូលចិត្តជាមួយគ្នានៅផ្ទះ", en: "Cook a favourite dish together at home" },
    { km: "Movie night នៅផ្ទះ — បិទទូរស័ព្ទ 2 ម៉ោង", en: "Movie night at home — phones off for 2 hours" },
    { km: "ទៅលេងឪពុកម្តាយជាមួយគ្នា ហើយជួយការងារផ្ទះបន្តិច", en: "Visit parents together and help with a small chore" },
    { km: "ដើរហាត់ប្រាណពេលព្រឹក ហើយញ៉ាំអាហារពេលព្រឹកនៅផ្ទះ", en: "Morning walk, then a slow breakfast at home" }
  ],
  10: [
    { km: "Coffee date + ម្ហូបតាមផ្លូវ", en: "Coffee date + street food" },
    { km: "ញ៉ាំនំបញ្ចុកពេលព្រឹកនៅផ្សារ ហើយដើរមើលផ្សារ", en: "Num banh chok breakfast at the market and a slow walk" },
    { km: "ទិញកូនដើមឈើមួយដើមមកដាំនៅផ្ទះជាមួយគ្នា", en: "Buy a small plant and pot it together" },
    { km: "ជិះកង់ ឬដើរលេងសួនច្បារ ហើយញ៉ាំការ៉េម", en: "Bike ride or park walk with ice cream" },
    { km: "បោះពុម្ពរូបថតល្អៗ 5 សន្លឹក ដាក់ស៊ុម", en: "Print 5 favourite photos and frame them" }
  ],
  50: [
    { km: "អាហារពេលល្ងាចនៅភោជនីយដ្ឋានល្អមួយ", en: "Dinner at a nice restaurant" },
    { km: "Day trip ទៅឧដុង្គ ឬកន្លែងជិតៗ", en: "Day trip to Oudong or somewhere nearby" },
    { km: "Massage / Spa សម្រាប់អ្នកទាំងពីរ", en: "Massage or spa for both of you" },
    { km: "ស្នាក់នៅសណ្ឋាគារមួយយប់ក្នុងក្រុង", en: "One-night staycation in the city" },
    { km: "រៀនធ្វើអ្វីថ្មីជាមួយគ្នា (class ធ្វើម្ហូប, គំនូរ...)", en: "Take a class together (cooking, painting…)" }
  ]
};

const TIPS_GIFT_IDEAS = {
  birthday: [
    { km: "កាតសរសេរដោយដៃ + ម្ហូបដែលគាត់ចូលចិត្ត", en: "A handwritten card + their favourite food" },
    { km: "រូបថតចាស់ៗមួយសន្លឹកដាក់ស៊ុម", en: "An old photo in a nice frame" },
    { km: "ទូរស័ព្ទទៅជូនពរពេលព្រឹក មុនអ្នកផ្សេង", en: "Call first thing in the morning, before everyone else" },
    { km: "នំខួបកំណើតតូចមួយ និងពេលញ៉ាំជាមួយគ្នា", en: "A small cake and time to eat together" }
  ],
  anniversary: [
    { km: "ទៅកន្លែងដែលជួបគ្នាលើកដំបូងម្តងទៀត", en: "Go back to where you first met" },
    { km: "សរសេររឿងល្អៗ 3 ក្នុងឆ្នាំនេះ ហើយអានឱ្យគ្នាស្តាប់", en: "Write 3 good things from this year and read them to each other" },
    { km: "អាហារពេលល្ងាចពិសេស — គ្មានទូរស័ព្ទ", en: "A special dinner — no phones" }
  ]
};

let tipsActiveFilter = "ALL";
let tipsOpenSheetId = null;
let tipsGlobalBound = false;
let tipsWeekendBudget = 0;

function tipsL(km, en) {
  return languageCode() === "km" ? km : en;
}

function tipSlug(title) {
  return String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function tipsCategoryOf(tip) {
  return TIPS_FILTER_MAP[tip.category] || tip.category;
}

function tipsCategoryLabel(category) {
  return tipsL(TIPS_CATEGORY_KM[category] || category, TIPS_CATEGORY_EN[category] || category);
}

function tipsAll() {
  return getTipsData().map(tip => ({ ...tip, id: tipSlug(tip.title), filter: tipsCategoryOf(tip) }));
}

function tipsText(tip) {
  const km = languageCode() === "km";
  return {
    title: km ? tip.khmerTitle : tip.title,
    short: km ? tip.khmerShort : tip.short,
    steps: km ? tip.khmerQuick : tip.quick,
    why: km ? tip.khmerDetail : tip.detail
  };
}

/* ---------- dates ---------- */

function tipsParseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function tipsToday() {
  return localDateInput();
}

function tipsAddDays(dateStr, days) {
  const date = tipsParseDate(dateStr) || new Date();
  date.setDate(date.getDate() + days);
  return localDateInput(date);
}

function tipsDaysBetween(fromStr, toStr) {
  const from = tipsParseDate(fromStr);
  const to = tipsParseDate(toStr);
  if (!from || !to) return Infinity;
  return Math.round((to - from) / 86400000);
}

// Monday of the week that contains dateStr.
function tipsWeekStart(dateStr) {
  const date = tipsParseDate(dateStr) || new Date();
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return localDateInput(date);
}

function tipsNextSaturday() {
  const date = tipsParseDate(tipsToday());
  const add = (6 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + add);
  return localDateInput(date);
}

function tipsDayNumber() {
  const today = tipsParseDate(tipsToday());
  return Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
}

function tipsFormatDate(dateStr) {
  const date = tipsParseDate(dateStr);
  if (!date) return "";
  if (typeof formatDate === "function") return formatDate(dateStr, { weekday: "short", month: "short", day: "numeric" });
  return date.toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { day: "numeric", month: "short" });
}

/* ---------- state (synced via appData.profile) ---------- */

function tipsState() {
  const saved = appData.profile?.tips || {};
  return {
    done: Array.isArray(saved.done) ? saved.done.filter(item => item && item.id && item.date) : [],
    fav: Array.isArray(saved.fav) ? saved.fav.filter(Boolean) : [],
    lastCheckin: saved.lastCheckin || ""
  };
}

function tipsKeepScroll(work) {
  const y = window.scrollY;
  work();
  window.requestAnimationFrame(() => window.scrollTo(0, y));
}

function tipsCommit(nextState, extra) {
  tipsKeepScroll(() => {
    const state = { ...nextState, done: nextState.done.slice(-TIPS_DONE_LIMIT) };
    appData.profile = { ...appData.profile, tips: state };
    if (typeof extra === "function") extra();
    Store.save();
    App.render();
  });
}

function tipsDoneThisWeek(state = tipsState()) {
  const start = tipsWeekStart(tipsToday());
  const ids = new Set();
  state.done.forEach(item => { if (item.date >= start) ids.add(item.id); });
  return ids;
}

function tipsStreak(state = tipsState()) {
  const weeks = new Set(state.done.map(item => tipsWeekStart(item.date)));
  let cursor = tipsWeekStart(tipsToday());
  if (!weeks.has(cursor)) cursor = tipsAddDays(cursor, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = tipsAddDays(cursor, -7);
  }
  return streak;
}

function tipsAddRecord(collection, record) {
  const records = ensureCollection(collection);
  records.push({ id: id(collection), createdAt: new Date().toISOString(), ...record });
}

/* ---------- today's tip ---------- */

function tipsOffsetKey() {
  return `mylife:tip-offset:${tipsToday()}`;
}

function tipsOffset() {
  try {
    return Number(sessionStorage.getItem(tipsOffsetKey())) || 0;
  } catch (error) {
    return 0;
  }
}

function tipsTodayTip(tips) {
  return tips[(tipsDayNumber() + tipsOffset()) % tips.length];
}

/* ---------- "for you this week" ---------- */

function tipsNextOccurrence(dateStr, today) {
  const base = tipsParseDate(dateStr);
  const now = tipsParseDate(today);
  if (!base || !now) return null;
  for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
    const month = base.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const date = new Date(year, month, Math.min(base.getDate(), lastDay));
    if (date >= now) return { date: localDateInput(date), years: year - base.getFullYear() };
  }
  return null;
}

function tipsUpcomingFamilyDates() {
  const today = tipsToday();
  const list = [];
  (appData.family || []).forEach(member => {
    if (!member?.name) return;
    [["birthday", member.birthday], ["anniversary", member.anniversaryDate]].forEach(([kind, value]) => {
      if (!value) return;
      const next = tipsNextOccurrence(value, today);
      if (!next) return;
      const days = tipsDaysBetween(today, next.date);
      if (days > 21) return;
      const years = tipsParseDate(value).getFullYear() > 1900 ? next.years : 0;
      list.push({ kind, member, date: next.date, days, years, key: `tips:${kind}:${member.id || member.name}:${next.date}` });
    });
  });
  return list.sort((a, b) => a.days - b.days);
}

function tipsEventExists(item) {
  const title = tipsFamilyEventTitle(item);
  return (appData.calendarEvents || []).some(event => event.tipsKey === item.key || (event.date === item.date && event.title === title));
}

function tipsFamilyEventTitle(item) {
  return item.kind === "birthday"
    ? tipsL(`🎂 ថ្ងៃកំណើត ${item.member.name}`, `🎂 ${item.member.name}'s birthday`)
    : tipsL(`💍 ខួបអាពាហ៍ពិពាហ៍ ${item.member.name}`, `💍 ${item.member.name}'s anniversary`);
}

function tipsWeekNumber() {
  return Math.floor(tipsDaysBetween("2024-01-01", tipsWeekStart(tipsToday())) / 7);
}

function tipsWeekendIdea(budget) {
  const list = TIPS_WEEKEND_IDEAS[budget] || TIPS_WEEKEND_IDEAS[0];
  return list[Math.abs(tipsWeekNumber()) % list.length];
}

/* ---------- render ---------- */

function tipsRing(count) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const progress = Math.min(count, TIPS_WEEKLY_GOAL) / TIPS_WEEKLY_GOAL;
  return `
    <svg class="tp-ring" viewBox="0 0 84 84" aria-hidden="true">
      <circle class="tp-ring-track" cx="42" cy="42" r="${r}"></circle>
      <circle class="tp-ring-fill" cx="42" cy="42" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - progress)).toFixed(2)}"></circle>
    </svg>
  `;
}

function renderTipsFamilyDates(items) {
  if (!items.length) {
    return `
      <article class="tp-for-card tp-for-dates">
        <span class="tp-for-icon">🎂</span>
        <h3>${tipsL("ថ្ងៃកំណើត & ខួប", "Birthdays & anniversaries")}</h3>
        <p class="tp-for-text">${tipsL("គ្មានថ្ងៃពិសេសក្នុង 21 ថ្ងៃខាងមុខទេ។ បន្ថែមថ្ងៃកំណើតក្នុងទំព័រ គ្រួសារ។", "No special days in the next 21 days. Add birthdays on the Family page.")}</p>
        <a class="button ghost-button tp-small-btn" href="#family">${tipsL("ទៅទំព័រគ្រួសារ", "Open Family")}</a>
      </article>
    `;
  }
  return items.slice(0, 3).map((item, index) => {
    const added = tipsEventExists(item);
    const ideas = TIPS_GIFT_IDEAS[item.kind];
    const idea = ideas[(tipsWeekNumber() + index) % ideas.length];
    const when = item.days === 0 ? tipsL("ថ្ងៃនេះ!", "Today!") : item.days === 1 ? tipsL("ស្អែក", "Tomorrow") : tipsL(`នៅសល់ ${item.days} ថ្ងៃ`, `In ${item.days} days`);
    const yearsLine = item.years > 0
      ? (item.kind === "birthday" ? tipsL(`អាយុ ${item.years} ឆ្នាំ`, `Turns ${item.years}`) : tipsL(`${item.years} ឆ្នាំ`, `${item.years} years`))
      : "";
    return `
      <article class="tp-for-card tp-for-dates ${item.days <= 3 ? "is-soon" : ""}">
        <span class="tp-for-icon">${item.kind === "birthday" ? "🎂" : "💍"}</span>
        <span class="tp-for-pill">${escapeHtml(when)}</span>
        <h3>${escapeHtml(item.member.name)}</h3>
        <p class="tp-for-meta">${escapeHtml(item.kind === "birthday" ? tipsL("ថ្ងៃកំណើត", "Birthday") : tipsL("ខួប", "Anniversary"))} · ${escapeHtml(tipsFormatDate(item.date))}${yearsLine ? ` · ${escapeHtml(yearsLine)}` : ""}</p>
        <p class="tp-for-text">🎁 ${escapeHtml(languageCode() === "km" ? idea.km : idea.en)}</p>
        <button class="button ghost-button tp-small-btn" type="button" data-tip-add-date="${escapeAttr(item.key)}" ${added ? "disabled" : ""}>${added ? tipsL("✓ មានក្នុងប្រតិទិនហើយ", "✓ In calendar") : tipsL("📅 បន្ថែមទៅប្រតិទិន", "📅 Add to calendar")}</button>
      </article>
    `;
  }).join("");
}

function renderTipsCheckinCard(state) {
  const days = state.lastCheckin ? tipsDaysBetween(state.lastCheckin, tipsToday()) : Infinity;
  const due = days >= 6;
  const last = state.lastCheckin
    ? (days === 0 ? tipsL("បានធ្វើថ្ងៃនេះ ✓", "Done today ✓") : tipsL(`លើកមុន៖ ${days} ថ្ងៃមុន`, `Last: ${days} days ago`))
    : tipsL("មិនទាន់ធ្វើម្តងសោះ", "Not done yet");
  return `
    <article class="tp-for-card tp-for-checkin ${due ? "is-due" : ""}">
      <span class="tp-for-icon">💬</span>
      ${due ? `<span class="tp-for-pill">${tipsL("ដល់ពេលហើយ", "Due")}</span>` : ""}
      <h3>${tipsL("ពិភាក្សាគ្រួសារប្រចាំសប្តាហ៍", "Weekly family check-in")}</h3>
      <p class="tp-for-text">${tipsL("សំណួរ 3៖ អ្វីល្អ? អ្វីពិបាក? សប្តាហ៍ក្រោយធ្វើអ្វី?", "3 questions: What went well? What was hard? What next week?")}</p>
      <p class="tp-for-meta">${escapeHtml(last)}</p>
      <button class="button ${due ? "" : "ghost-button"} tp-small-btn" type="button" data-tip-checkin>${tipsL("ចាប់ផ្តើម", "Start check-in")}</button>
    </article>
  `;
}

function renderTipsWeekendCard() {
  const budget = tipsWeekendBudget;
  const idea = tipsWeekendIdea(budget);
  return `
    <article class="tp-for-card tp-for-weekend">
      <span class="tp-for-icon">🌿</span>
      <h3>${tipsL("គំនិតចុងសប្តាហ៍", "Weekend idea")}</h3>
      <div class="tp-budget-chips" role="group" aria-label="${tipsL("ថវិកា", "Budget")}">
        ${[0, 10, 50].map(value => `<button class="tp-budget-chip ${value === budget ? "active" : ""}" type="button" data-tip-budget="${value}" aria-pressed="${value === budget}">$${value}</button>`).join("")}
      </div>
      <p class="tp-for-text" data-tip-weekend-text>${escapeHtml(languageCode() === "km" ? idea.km : idea.en)}</p>
      <button class="button ghost-button tp-small-btn" type="button" data-tip-weekend="${budget}">${tipsL("🔔 រំលឹកថ្ងៃសៅរ៍ 9 AM", "🔔 Remind Sat 9 AM")}</button>
    </article>
  `;
}

function renderTipsCard(tip, state, doneIds) {
  const text = tipsText(tip);
  const done = doneIds.has(tip.id);
  const saved = state.fav.includes(tip.id);
  const hidden = tipsActiveFilter === "SAVED" ? !saved : (tipsActiveFilter !== "ALL" && tip.filter !== tipsActiveFilter);
  return `
    <button class="tp-card tp-cat-${tip.filter.toLowerCase()}" type="button" data-tip-open="${escapeAttr(tip.id)}" data-tip-filter-cat="${tip.filter}" ${hidden ? "hidden" : ""}>
      <span class="tp-card-head">
        <span class="tp-card-icon">${tip.icon}</span>
        <span class="tp-card-cat">${escapeHtml(tipsCategoryLabel(tip.filter))}</span>
        ${saved ? `<span class="tp-card-star" aria-label="${tipsL("បានរក្សាទុក", "Saved")}">⭐</span>` : ""}
      </span>
      <strong class="tp-card-title">${escapeHtml(text.title)}</strong>
      <span class="tp-card-short">${escapeHtml(text.short)}</span>
      ${done ? `<span class="tp-card-done">✅ ${tipsL("សប្តាហ៍នេះ", "this week")}</span>` : ""}
    </button>
  `;
}

function renderTips() {
  const tips = tipsAll();
  const state = tipsState();
  const doneIds = tipsDoneThisWeek(state);
  const doneCount = doneIds.size;
  const streak = tipsStreak(state);
  const today = tipsTodayTip(tips);
  const todayText = tipsText(today);
  const todayDone = doneIds.has(today.id);
  const todaySaved = state.fav.includes(today.id);
  const principles = getFamilyPrinciples();
  const coupleImage = getTipsCoupleImage();
  const position = typeof imagePosition === "function" ? imagePosition(appData.profile.tipsCoupleImagePosition) : { x: 0, y: 0 };
  const visibleSaved = tipsActiveFilter === "SAVED" && !state.fav.length;
  const familyDates = tipsUpcomingFamilyDates();

  return `
    <section class="page tips-page tp-page">
      <header class="tp-header">
        <div class="tp-header-copy">
          <h1 class="page-title">${tipsL("គន្លឹះគ្រួសារ", "Family tips")}</h1>
          <p class="page-subtitle">${tipsL("រឿងតូចៗរាល់សប្តាហ៍ ដែលធ្វើឱ្យគ្រួសារកក់ក្តៅ និងរឹងមាំ។", "Small things each week that keep your family warm and strong.")}</p>
        </div>
        <label class="tp-couple" title="${tipsL("ប្តូររូប", "Change photo")}">
          ${coupleImage
            ? `<img src="${escapeAttr(coupleImage)}" alt="${tipsL("រូបថតគូស្នេហ៍", "Couple photo")}" style="--image-position-x:${position.x}%;--image-position-y:${position.y}%">`
            : `<span class="tp-couple-empty">${Icons.heart()}</span>`}
          <span class="tp-couple-edit" aria-hidden="true">${Icons.edit()}</span>
          <input type="file" accept="image/*" data-couple-photo aria-label="${tipsL("ប្តូររូបគូស្នេហ៍", "Change couple photo")}">
        </label>
      </header>
      <div class="tp-photo-editor" data-tip-photo-editor></div>

      <div class="tp-top">
      <article class="tp-hero">
        <div class="tp-hero-pills">
          <span class="tp-pill tp-pill-strong">${tipsL("គន្លឹះថ្ងៃនេះ", "Today's tip")}</span>
          <span class="tp-pill">${escapeHtml(tipsCategoryLabel(today.filter))}</span>
          ${todayDone ? `<span class="tp-pill">✅ ${tipsL("បានធ្វើ", "Done")}</span>` : ""}
        </div>
        <h2 class="tp-hero-title">${escapeHtml(todayText.title)}</h2>
        <p class="tp-hero-text">${escapeHtml(todayText.short)}</p>
        <ol class="tp-steps">${todayText.steps.map((step, index) => `<li><span>${index + 1}</span>${escapeHtml(step)}</li>`).join("")}</ol>
        <div class="tp-hero-actions">
          <button class="button tp-btn-done ${todayDone ? "is-done" : ""}" type="button" data-tip-done="${escapeAttr(today.id)}">${todayDone ? tipsL("✓ បានធ្វើ (មិនធ្វើវិញ)", "✓ Done (undo)") : tipsL("✓ ខ្ញុំបានធ្វើ", "✓ I did it")}</button>
          <button class="button ghost-button tp-btn-ghost" type="button" data-tip-remind="${escapeAttr(today.id)}">${tipsL("🔔 រំលឹក 7 PM", "🔔 Remind 7 PM")}</button>
          <button class="icon-button tp-btn-icon ${todaySaved ? "is-on" : ""}" type="button" data-tip-fav="${escapeAttr(today.id)}" aria-label="${tipsL("រក្សាទុក", "Save")}" title="${tipsL("រក្សាទុក", "Save")}">${todaySaved ? "⭐" : "☆"}</button>
          <button class="icon-button tp-btn-icon" type="button" data-tip-next aria-label="${tipsL("គន្លឹះផ្សេង", "Another tip")}" title="${tipsL("គន្លឹះផ្សេង", "Another tip")}">↻</button>
        </div>
      </article>

      <article class="glass-card tp-week">
        <div class="tp-week-ring">
          ${tipsRing(doneCount)}
          <span class="tp-week-count"><strong>${Math.min(doneCount, 99)}</strong>/${TIPS_WEEKLY_GOAL}</span>
        </div>
        <div class="tp-week-copy">
          <span class="tp-eyebrow">${tipsL("សប្តាហ៍នេះ", "This week")}</span>
          <strong>${doneCount >= TIPS_WEEKLY_GOAL ? tipsL("សម្រេចគោលដៅហើយ! 🎉", "Weekly goal reached! 🎉") : tipsL(`ធ្វើគន្លឹះ ${TIPS_WEEKLY_GOAL} ក្នុងមួយសប្តាហ៍`, `Do ${TIPS_WEEKLY_GOAL} tips a week`)}</strong>
          <div class="tp-week-stats">
            <span>🔥 ${tipsL(`${streak} សប្តាហ៍ជាប់គ្នា`, `${streak}-week streak`)}</span>
            <span>⭐ ${tipsL(`បានរក្សាទុក ${state.fav.length}`, `${state.fav.length} saved`)}</span>
          </div>
        </div>
      </article>
      </div>

      <div class="tp-section">
        <h2 class="tp-section-title">${tipsL("សម្រាប់អ្នកសប្តាហ៍នេះ", "For you this week")}</h2>
        <div class="tp-for-row">
          ${renderTipsFamilyDates(familyDates)}
          ${renderTipsCheckinCard(state)}
          ${renderTipsWeekendCard()}
        </div>
      </div>

      <div class="tp-section">
        <h2 class="tp-section-title">${tipsL("គន្លឹះទាំងអស់", "All tips")}</h2>
        <div class="tp-filters" role="toolbar" aria-label="${tipsL("ច្រោះគន្លឹះ", "Tip filters")}">
          ${TIPS_FILTERS.map(filter => `<button class="tp-chip ${tipsActiveFilter === filter ? "active" : ""}" type="button" data-tip-filter="${filter}" aria-pressed="${tipsActiveFilter === filter}">${filter === "SAVED" ? "⭐ " : ""}${escapeHtml(tipsCategoryLabel(filter))}</button>`).join("")}
        </div>
        <p class="tp-empty" data-tip-empty ${visibleSaved ? "" : "hidden"}>${tipsL("មិនទាន់មានគន្លឹះរក្សាទុកទេ — ចុច ⭐ លើគន្លឹះដែលអ្នកចូលចិត្ត។", "No saved tips yet — tap ⭐ on a tip you like.")}</p>
        <div class="tp-grid">${tips.map(tip => renderTipsCard(tip, state, doneIds)).join("")}</div>
      </div>

      <article class="glass-card tp-principles">
        <div class="tp-principles-head">
          <div>
            <span class="tp-eyebrow">${tipsL("គ្រួសាររបស់យើង", "Our family")}</span>
            <h2>${tipsL("គោលការណ៍របស់យើង", "Our family principles")}</h2>
          </div>
          <button class="icon-button" type="button" data-principles-edit aria-label="${tipsL("កែប្រែ", "Edit")}" title="${tipsL("កែប្រែ", "Edit")}">${Icons.edit()}</button>
        </div>
        <ul class="tp-principles-list" data-principles-list>${principles.map(item => `<li><span aria-hidden="true">${Icons.heart()}</span>${escapeHtml(item)}</li>`).join("")}</ul>
        <form class="tp-principles-form" data-principles-form hidden>
          <label for="principlesInput">${tipsL("គោលការណ៍មួយក្នុងមួយបន្ទាត់", "One principle per line")}</label>
          <textarea id="principlesInput" rows="6">${escapeHtml(principles.join("\n"))}</textarea>
          <div class="action-row"><button class="button" type="submit">${tipsL("រក្សាទុក", "Save")}</button><button class="button ghost-button" type="button" data-principles-cancel>${tipsL("បោះបង់", "Cancel")}</button></div>
        </form>
      </article>

      <p class="tp-footer">${tipsL("គ្រួសារដែលល្អ មិនមែនជាគ្រួសារដែលគ្មានបញ្ហាទេ។ វាគឺជាគ្រួសារដែលចេះស្តាប់ ជួយគ្នា សម្របគ្នា និងដោះស្រាយបញ្ហាជាមួយគ្នា។ ❤️", "A good family is not a family without problems. It is a family that listens, helps, adapts, and solves problems together. ❤️")}</p>
    </section>
  `;
}

/* ---------- sheet ---------- */

function tipsCloseSheet() {
  tipsOpenSheetId = null;
  const root = document.querySelector("[data-tip-sheet-root]");
  if (!root) return;
  root.classList.remove("is-open");
  document.body.classList.remove("tp-sheet-open");
  window.setTimeout(() => root.remove(), 200);
}

function tipsOpenSheet(tipId, { animate = true } = {}) {
  const tip = tipsAll().find(item => item.id === tipId);
  if (!tip) return;
  tipsOpenSheetId = tipId;
  document.querySelector("[data-tip-sheet-root]")?.remove();
  const state = tipsState();
  const done = tipsDoneThisWeek(state).has(tip.id);
  const saved = state.fav.includes(tip.id);
  const text = tipsText(tip);
  const root = document.createElement("div");
  root.className = `tp-sheet-root ${animate ? "" : "is-open no-anim"}`;
  root.dataset.tipSheetRoot = "";
  root.innerHTML = `
    <div class="tp-sheet-backdrop" data-tip-sheet-close></div>
    <div class="tp-sheet tp-cat-${tip.filter.toLowerCase()}" role="dialog" aria-modal="true" aria-labelledby="tpSheetTitle">
      <span class="tp-sheet-grip" aria-hidden="true"></span>
      <div class="tp-sheet-head">
        <span class="tp-card-icon">${tip.icon}</span>
        <span class="tp-card-cat">${escapeHtml(tipsCategoryLabel(tip.filter))}</span>
        <button class="icon-button tp-sheet-x" type="button" data-tip-sheet-close aria-label="${tipsL("បិទ", "Close")}">${Icons.close()}</button>
      </div>
      <h2 id="tpSheetTitle" class="tp-sheet-title">${escapeHtml(text.title)}</h2>
      <p class="tp-sheet-short">${escapeHtml(text.short)}</p>
      <ol class="tp-steps tp-steps-sheet">${text.steps.map((step, index) => `<li><span>${index + 1}</span>${escapeHtml(step)}</li>`).join("")}</ol>
      <div class="tp-why">
        <strong>${tipsL("ហេតុអ្វីសំខាន់", "Why it matters")}</strong>
        <p>${escapeHtml(text.why)}</p>
      </div>
      <div class="tp-sheet-actions">
        <button class="button tp-btn-done ${done ? "is-done" : ""}" type="button" data-tip-done="${escapeAttr(tip.id)}">${done ? tipsL("✓ បានធ្វើ (មិនធ្វើវិញ)", "✓ Done (undo)") : tipsL("✓ ខ្ញុំបានធ្វើ", "✓ I did it")}</button>
        <button class="button ghost-button" type="button" data-tip-remind="${escapeAttr(tip.id)}">${tipsL("🔔 រំលឹក 7 PM", "🔔 Remind 7 PM")}</button>
        <button class="button ghost-button ${saved ? "is-on" : ""}" type="button" data-tip-fav="${escapeAttr(tip.id)}">${saved ? tipsL("⭐ បានរក្សាទុក", "⭐ Saved") : tipsL("☆ រក្សាទុក", "☆ Save")}</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  document.body.classList.add("tp-sheet-open");
  if (animate) window.requestAnimationFrame(() => root.classList.add("is-open"));
  root.querySelectorAll("[data-tip-sheet-close]").forEach(button => button.addEventListener("click", tipsCloseSheet));
  tipsBindActions(root);
  if (animate) root.querySelector(".tp-sheet-x")?.focus({ preventScroll: true });
}

/* ---------- actions ---------- */

function tipsToggleDone(tipId) {
  const state = tipsState();
  const weekStart = tipsWeekStart(tipsToday());
  const wasDone = state.done.some(item => item.id === tipId && item.date >= weekStart);
  if (wasDone) {
    state.done = state.done.filter(item => !(item.id === tipId && item.date >= weekStart));
    if (typeof Sound !== "undefined") Sound.play("toggleOff");
    Toast.show(tipsL("បានដកចេញវិញ", "Marked as not done"));
  } else {
    const before = tipsDoneThisWeek(state).size;
    state.done.push({ id: tipId, date: tipsToday() });
    const reached = before < TIPS_WEEKLY_GOAL && before + 1 >= TIPS_WEEKLY_GOAL;
    if (typeof Sound !== "undefined") Sound.play(reached ? "celebrate" : "success");
    Toast.show(reached ? tipsL("🎉 សម្រេចគោលដៅសប្តាហ៍នេះ!", "🎉 Weekly goal reached!") : tipsL("ល្អណាស់! ✓", "Nice work! ✓"));
  }
  tipsCommit(state);
}

function tipsToggleFav(tipId) {
  const state = tipsState();
  const saved = state.fav.includes(tipId);
  state.fav = saved ? state.fav.filter(item => item !== tipId) : [...state.fav, tipId];
  if (typeof Sound !== "undefined") Sound.play(saved ? "toggleOff" : "toggleOn");
  Toast.show(saved ? tipsL("បានដកចេញពីការរក្សាទុក", "Removed from saved") : tipsL("⭐ បានរក្សាទុក", "⭐ Saved"));
  tipsCommit(state);
}

function tipsRemind(tipId) {
  const tip = tipsAll().find(item => item.id === tipId);
  if (!tip) return;
  const now = new Date();
  const date = now.getHours() >= 19 ? tipsAddDays(tipsToday(), 1) : tipsToday();
  const text = tipsText(tip);
  const title = `💡 ${text.title}`;
  const exists = (appData.reminders || []).some(item => !item.done && item.date === date && item.title === title);
  if (exists) {
    Toast.show(tipsL("មានការរំលឹកនេះរួចហើយ", "This reminder already exists"));
    return;
  }
  tipsCommit(tipsState(), () => {
    tipsAddRecord("reminders", { title, date, time: "19:00", category: "Love", notes: text.steps.join(" · "), done: false });
  });
  if (typeof Sound !== "undefined") Sound.play("success");
  Toast.show(date === tipsToday() ? tipsL("🔔 នឹងរំលឹកនៅម៉ោង 7 PM ថ្ងៃនេះ", "🔔 Reminder set for 7 PM today") : tipsL("🔔 នឹងរំលឹកនៅម៉ោង 7 PM ស្អែក", "🔔 Reminder set for 7 PM tomorrow"));
}

function tipsAddFamilyDate(key) {
  const item = tipsUpcomingFamilyDates().find(entry => entry.key === key);
  if (!item || tipsEventExists(item)) return;
  tipsCommit(tipsState(), () => {
    tipsAddRecord("calendarEvents", {
      title: tipsFamilyEventTitle(item),
      date: item.date,
      time: "",
      category: "Family",
      familyMember: item.member.name,
      reminder: true,
      notes: "",
      tipsKey: item.key
    });
  });
  if (typeof Sound !== "undefined") Sound.play("success");
  Toast.show(tipsL("📅 បានបន្ថែមទៅប្រតិទិន", "📅 Added to calendar"));
}

function tipsOpenCheckin() {
  Modal.open({
    title: tipsL("💬 ពិភាក្សាគ្រួសារប្រចាំសប្តាហ៍", "💬 Weekly family check-in"),
    submitText: tipsL("រក្សាទុកក្នុង Memories", "Save to Memories"),
    fields: [
      { name: "good", label: tipsL("សប្តាហ៍នេះ អ្វីដែលល្អ?", "What went well this week?"), type: "textarea", value: "" },
      { name: "hard", label: tipsL("អ្វីដែលពិបាក?", "What was hard?"), type: "textarea", value: "" },
      { name: "next", label: tipsL("សប្តាហ៍ក្រោយ យើងនឹងធ្វើអ្វី?", "What will we do next week?"), type: "textarea", value: "" }
    ],
    onSubmit(data) {
      const lines = [
        [tipsL("អ្វីល្អ", "Went well"), data.good],
        [tipsL("អ្វីពិបាក", "Was hard"), data.hard],
        [tipsL("សប្តាហ៍ក្រោយ", "Next week"), data.next]
      ].filter(([, value]) => String(value || "").trim()).map(([label, value]) => `${label}: ${String(value).trim()}`);
      const state = tipsState();
      state.lastCheckin = tipsToday();
      tipsCommit(state, () => {
        tipsAddRecord("memories", {
          title: tipsL("💬 ពិភាក្សាគ្រួសារ", "💬 Family check-in"),
          date: tipsToday(),
          location: "",
          photo: "",
          description: lines.join("\n"),
          familyMembers: "",
          tags: "check-in, family"
        });
      });
      if (typeof Sound !== "undefined") Sound.play("success");
      Toast.show(tipsL("បានរក្សាទុកក្នុង Memories 💬", "Saved to Memories 💬"));
    }
  });
}

function tipsAddWeekend(budget) {
  const idea = tipsWeekendIdea(Number(budget));
  const date = tipsNextSaturday();
  const title = `🌿 ${languageCode() === "km" ? idea.km : idea.en}`;
  if ((appData.reminders || []).some(item => !item.done && item.date === date && item.title === title)) {
    Toast.show(tipsL("មានការរំលឹកនេះរួចហើយ", "This reminder already exists"));
    return;
  }
  tipsCommit(tipsState(), () => {
    tipsAddRecord("reminders", { title, date, time: "09:00", category: "Family", notes: tipsL(`ថវិកា $${budget}`, `Budget $${budget}`), done: false });
  });
  if (typeof Sound !== "undefined") Sound.play("success");
  Toast.show(tipsL(`🔔 នឹងរំលឹកថ្ងៃសៅរ៍ ${tipsFormatDate(date)} 9:00 AM`, `🔔 Reminder Saturday ${tipsFormatDate(date)} 9:00 AM`));
}

function tipsNextTip() {
  try {
    sessionStorage.setItem(tipsOffsetKey(), String(tipsOffset() + 1));
  } catch (error) { /* private mode: rotate in memory only */ }
  if (typeof Sound !== "undefined") Sound.play("pop");
  tipsKeepScroll(() => App.render());
}

function tipsApplyFilter(filter) {
  tipsActiveFilter = filter;
  const state = tipsState();
  document.querySelectorAll("[data-tip-filter]").forEach(chip => {
    const on = chip.dataset.tipFilter === filter;
    chip.classList.toggle("active", on);
    chip.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll("[data-tip-open]").forEach(card => {
    card.hidden = filter === "SAVED" ? !state.fav.includes(card.dataset.tipOpen) : (filter !== "ALL" && card.dataset.tipFilterCat !== filter);
  });
  const empty = document.querySelector("[data-tip-empty]");
  if (empty) empty.hidden = !(filter === "SAVED" && !state.fav.length);
}

function tipsBindActions(scope) {
  scope.querySelectorAll("[data-tip-done]").forEach(button => button.addEventListener("click", () => tipsToggleDone(button.dataset.tipDone)));
  scope.querySelectorAll("[data-tip-fav]").forEach(button => button.addEventListener("click", () => tipsToggleFav(button.dataset.tipFav)));
  scope.querySelectorAll("[data-tip-remind]").forEach(button => button.addEventListener("click", () => tipsRemind(button.dataset.tipRemind)));
}

function bindTips() {
  const page = document.querySelector(".tp-page");
  if (!page) return;

  if (!tipsGlobalBound) {
    tipsGlobalBound = true;
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && tipsOpenSheetId) tipsCloseSheet();
    });
    window.addEventListener("hashchange", () => {
      if (tipsOpenSheetId || document.querySelector("[data-tip-sheet-root]")) tipsCloseSheet();
    });
  }

  tipsBindActions(page);
  page.querySelector("[data-tip-next]")?.addEventListener("click", tipsNextTip);
  page.querySelectorAll("[data-tip-filter]").forEach(chip => chip.addEventListener("click", () => tipsApplyFilter(chip.dataset.tipFilter)));
  page.querySelectorAll("[data-tip-open]").forEach(card => card.addEventListener("click", () => tipsOpenSheet(card.dataset.tipOpen)));
  page.querySelectorAll("[data-tip-add-date]").forEach(button => button.addEventListener("click", () => tipsAddFamilyDate(button.dataset.tipAddDate)));
  page.querySelector("[data-tip-checkin]")?.addEventListener("click", tipsOpenCheckin);
  page.querySelectorAll("[data-tip-weekend]").forEach(button => button.addEventListener("click", () => tipsAddWeekend(button.dataset.tipWeekend)));
  page.querySelectorAll("[data-tip-budget]").forEach(chip => chip.addEventListener("click", () => {
    tipsWeekendBudget = Number(chip.dataset.tipBudget) || 0;
    page.querySelectorAll("[data-tip-budget]").forEach(item => {
      const on = item === chip;
      item.classList.toggle("active", on);
      item.setAttribute("aria-pressed", String(on));
    });
    const idea = tipsWeekendIdea(tipsWeekendBudget);
    const text = page.querySelector("[data-tip-weekend-text]");
    if (text) text.textContent = languageCode() === "km" ? idea.km : idea.en;
    const add = page.querySelector("[data-tip-weekend]");
    if (add) add.dataset.tipWeekend = String(tipsWeekendBudget);
  }));

  page.querySelector("[data-couple-photo]")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      const slot = page.querySelector("[data-tip-photo-editor]");
      if (!slot) return;
      slot.innerHTML = "";
      slot.appendChild(createImagePositionEditor({
        src: dataUrl,
        key: "tips-couple",
        title: tipsL("អូសដើម្បីលៃតម្រូវរូប", "Drag to adjust the photo"),
        onSave: position => Store.updateProfile({ tipsCoupleImage: dataUrl, tipsCoupleImagePosition: position }),
        onCancel: () => {
          event.target.value = "";
          slot.innerHTML = "";
        }
      }));
    } catch (error) {
      Toast.show(tipsL("មិនអាចបញ្ចូលរូបភាពបានទេ", "The image could not be uploaded."));
    }
  });

  const form = page.querySelector("[data-principles-form]");
  const list = page.querySelector("[data-principles-list]");
  form.hidden = true;
  page.querySelector("[data-principles-edit]")?.addEventListener("click", () => {
    form.hidden = false;
    list.hidden = true;
    form.querySelector("textarea").focus();
  });
  page.querySelector("[data-principles-cancel]")?.addEventListener("click", () => {
    form.hidden = true;
    list.hidden = false;
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const principles = form.querySelector("textarea").value.split("\n").map(item => item.trim()).filter(Boolean).slice(0, 12);
    tipsKeepScroll(() => Store.updateProfile({ familyPrinciples: principles.length ? principles : TIPS_DEFAULT_PRINCIPLES }));
    Toast.show(tipsL("បានរក្សាទុកគោលការណ៍", "Principles saved"));
  });

  // Re-open the sheet after a re-render (e.g. after ✓ / ⭐ inside it, or a sync refresh).
  if (tipsOpenSheetId) tipsOpenSheet(tipsOpenSheetId, { animate: false });
}

function getFamilyPrinciples() {
  const synced = appData.profile?.familyPrinciples;
  if (Array.isArray(synced) && synced.length) return synced;
  try {
    const saved = JSON.parse(localStorage.getItem("mylife:family-principles") || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (error) { /* ignore */ }
  return TIPS_DEFAULT_PRINCIPLES;
}
