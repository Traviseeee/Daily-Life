/* Tips page (#tips): family & couple tips you can act on.
 * - Today's tip with ✅ done / ⏰ remind me / ↻ another one
 * - Week progress + streak (weeks in a row with at least one tip done)
 * - "For you": upcoming birthdays & anniversaries from Family, a weekend idea,
 *   and the weekly family check-in (saved as a Memory)
 * - Every tip card opens a sheet with steps and the same actions; ⭐ saves it
 * Progress lives in appData.profile.tips, principles in profile.familyPrinciples,
 * so both sync to the account. Tip texts come from getTipsData() (dashboard.js). */

const TIPS_WEEK_GOAL = 3;
let tipsOpenId = "";

const tipsKm = () => languageCode() === "km";
const tipsL = (km, en) => (tipsKm() ? km : en);

const TIP_CATS = {
  DAILY: { km: "ប្រចាំថ្ងៃ", en: "Daily", tone: "lime" },
  WEEKLY: { km: "ប្រចាំសប្តាហ៍", en: "Weekly", tone: "teal" },
  LOVE: { km: "ស្នេហា", en: "Love", tone: "rose" },
  FAMILY: { km: "គ្រួសារ", en: "Family", tone: "amber" },
  MONEY: { km: "លុយ", en: "Money", tone: "green" },
  FUTURE: { km: "អនាគត", en: "Future", tone: "violet" },
  HOME: { km: "ផ្ទះ", en: "Home", tone: "amber" }
};
const tipCategory = group => ({ BALANCE: "FAMILY", HOLIDAY: "FAMILY", SELF: "LOVE", MINDSET: "LOVE" }[group.category] || group.category);
const tipId = group => String(group.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const DATE_IDEAS = [
  { cost: "$0", km: "ដើរលេងមាត់ទន្លេពេលល្ងាច ហើយទុកទូរស័ព្ទចោល 30 នាទី", en: "Evening walk by the river, phones away for 30 minutes" },
  { cost: "$0", km: "ធ្វើម្ហូបជាមួយគ្នា ហើយញ៉ាំដោយបិទទូរទស្សន៍", en: "Cook together and eat with the TV off" },
  { cost: "$0", km: "មើលរូបចាស់ៗជាមួយគ្នា ហើយនិយាយពីអនុស្សាវរីយ៍", en: "Look through old photos and share the memories" },
  { cost: "$10", km: "កាហ្វេពេលព្រឹក នៅហាងថ្មីដែលមិនធ្លាប់ទៅ", en: "Morning coffee at a café you have never tried" },
  { cost: "$10", km: "ទិញនំ/ផ្លែឈើ ទៅញ៉ាំលេងនៅសួនច្បារ", en: "Pick up snacks or fruit for a picnic in the park" },
  { cost: "$10", km: "មើលកុន ឬលេងហ្គេមជាមួយគ្នានៅផ្ទះ", en: "Movie or board-game night at home" },
  { cost: "$50", km: "អាហារពេលល្ងាចនៅភោជនីយដ្ឋានដែលចូលចិត្ត", en: "Dinner at a favourite restaurant" },
  { cost: "$50", km: "ដំណើរកម្សាន្តថ្ងៃមួយ (កែប, កំពត, គិរីរម្យ)", en: "A day trip (Kep, Kampot, Kirirom)" },
  { cost: "$50", km: "ថ្ងៃសម្រាកពិសេស៖ ស្ប៉ា ឬអាហារពេលព្រឹកឆ្ងាញ់ៗ", en: "A treat day: spa or a nice brunch" }
];

/* ---------- dates ---------- */
function tipsToday() {
  return typeof localDateInput === "function" ? localDateInput() : new Date().toISOString().slice(0, 10);
}
function tipsAddDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function tipsWeekStart(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return tipsAddDays(iso, -((day + 6) % 7));
}
function tipsDaysBetween(a, b) {
  const t = iso => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86400000);
}

/* ---------- saved state (synced with the account) ---------- */
function tipsState() {
  const raw = appData.profile?.tips || {};
  return {
    done: Array.isArray(raw.done) ? raw.done : [],
    fav: Array.isArray(raw.fav) ? raw.fav : [],
    lastCheckin: raw.lastCheckin || ""
  };
}

function tipsCommit(mutate) {
  const state = tipsState();
  mutate(state);
  state.done = state.done.slice(-300);
  appData.profile.tips = state;
  const y = window.scrollY;
  Store.save({ reason: "tips" });
  App.render();
  window.scrollTo(0, y);
}

function getFamilyPrinciples() {
  const defaults = ["ជួយគ្នា", "និយាយគ្នា", "គោរពគ្រួសារទាំងសងខាង", "គ្រប់គ្រងលុយជាមួយគ្នា", "រកពេលសម្រាប់គ្នា", "សម្របសម្រួលគ្នាពេលមានបញ្ហា"];
  const fromProfile = appData.profile?.familyPrinciples;
  if (Array.isArray(fromProfile) && fromProfile.length) return fromProfile;
  try {
    const saved = JSON.parse(localStorage.getItem("mylife:family-principles") || "null");
    return Array.isArray(saved) && saved.length ? saved : defaults;
  } catch (error) {
    return defaults;
  }
}

function tipsProgress(state, today) {
  const week = tipsWeekStart(today);
  const thisWeek = state.done.filter(entry => entry.date >= week);
  const weeks = new Set(state.done.map(entry => tipsWeekStart(entry.date)));
  // weeks in a row with at least one tip done (this week counts once it has one)
  let cursor = weeks.has(week) ? week : tipsAddDays(week, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = tipsAddDays(cursor, -7);
  }
  return { count: thisWeek.length, ids: new Set(thisWeek.map(entry => entry.id)), streak };
}

const tipDoneToday = (state, id, today) => state.done.some(entry => entry.id === id && entry.date === today);

/* ---------- "for you": family dates, weekend idea, check-in ---------- */
function nextOccurrence(iso, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
  const year = Number(today.slice(0, 4));
  let next = `${year}${iso.slice(4)}`;
  if (next < today) next = `${year + 1}${iso.slice(4)}`;
  return { date: next, years: Number(next.slice(0, 4)) - Number(iso.slice(0, 4)) };
}

function familyDates(today) {
  const list = [];
  (appData.family || []).forEach(member => {
    if (!member?.name) return;
    [["birthday", "🎂"], ["anniversaryDate", "💞"]].forEach(([field, icon]) => {
      const next = nextOccurrence(member[field], today);
      if (!next) return;
      const days = tipsDaysBetween(today, next.date);
      if (days > 21) return;
      const isBirthday = field === "birthday";
      list.push({
        icon,
        days,
        date: next.date,
        title: isBirthday ? tipsL(`ថ្ងៃកំណើត ${member.name}`, `${member.name}'s birthday`) : tipsL(`ខួប ${member.name}`, `Anniversary · ${member.name}`),
        sub: isBirthday && next.years > 0 && next.years < 120 ? tipsL(`អាយុ ${next.years} ឆ្នាំ`, `turns ${next.years}`) : next.years > 0 ? tipsL(`${next.years} ឆ្នាំ`, `${next.years} years`) : "",
        idea: isBirthday ? tipsL("គំនិត: កាតសរសេរដោយដៃ + អាហារដែលគាត់ចូលចិត្ត", "Idea: a handwritten card + their favourite meal") : tipsL("គំនិត: ញ៉ាំអាហារពេលល្ងាចពីរនាក់ ហើយរំលឹកថ្ងៃដំបូង", "Idea: dinner for two and remember your first day"),
        eventTitle: isBirthday ? `🎂 ${member.name}` : `💞 ${member.name}`
      });
    });
  });
  return list.sort((a, b) => a.days - b.days).slice(0, 3);
}

function weekendIdea(today) {
  const index = Math.floor(Date.parse(tipsWeekStart(today)) / (7 * 86400000)) % DATE_IDEAS.length;
  return DATE_IDEAS[(index + DATE_IDEAS.length) % DATE_IDEAS.length];
}

function nextSaturday(today) {
  const [y, m, d] = today.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return tipsAddDays(today, (6 - day + 7) % 7 || 0);
}

function inCalendar(title, date) {
  return (appData.calendarEvents || []).some(event => event.date === date && String(event.title || "").trim() === title);
}

/* ---------- render ---------- */
function tipText(group) {
  const km = tipsKm();
  return {
    title: km ? group.khmerTitle : group.title,
    short: km ? group.khmerShort : group.short,
    quick: (km ? group.khmerQuick : group.quick) || [],
    detail: km ? group.khmerDetail : group.detail
  };
}

function todayTipIndex(groups, today) {
  let offset = 0;
  try { offset = Number(sessionStorage.getItem(`mylife:tip-offset:${today}`) || 0); } catch (error) { offset = 0; }
  return (Math.floor(Date.parse(today) / 86400000) + offset) % groups.length;
}

function renderTips() {
  const groups = getTipsData();
  const today = tipsToday();
  const state = tipsState();
  const progress = tipsProgress(state, today);
  const dayIndex = todayTipIndex(groups, today);
  const tip = groups[dayIndex];
  const tipT = tipText(tip);
  const tipKey = tipId(tip);
  const doneNow = tipDoneToday(state, tipKey, today);
  const coupleImage = typeof getTipsCoupleImage === "function" ? getTipsCoupleImage() : "";
  const principles = getFamilyPrinciples();
  const cat = TIP_CATS[tipCategory(tip)] || TIP_CATS.DAILY;
  const goalPct = Math.min(100, Math.round((progress.count / TIPS_WEEK_GOAL) * 100));
  const dates = familyDates(today);
  const idea = weekendIdea(today);
  const checkinDays = state.lastCheckin ? tipsDaysBetween(state.lastCheckin, today) : null;
  const checkinDue = checkinDays === null || checkinDays >= 6;
  const filters = ["ALL", "SAVED", "DAILY", "WEEKLY", "LOVE", "FAMILY", "MONEY", "FUTURE"];
  const filterLabel = key => key === "ALL" ? tipsL("ទាំងអស់", "All") : key === "SAVED" ? `⭐ ${tipsL("រក្សាទុក", "Saved")}` : tipsL(TIP_CATS[key].km, TIP_CATS[key].en);

  return `
    <section class="page tips-page tp-page">
      <header class="tp-head">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.heart()}</span>${tipsL("គន្លឹះគ្រួសារ", "Family tips")}</h1>
          <p class="page-subtitle">${tipsL("រឿងតូចៗរៀងរាល់ថ្ងៃ ដែលធ្វើឱ្យគ្រួសារកក់ក្តៅ និងរឹងមាំ។", "Small things, done often, that keep a family warm and strong.")}</p>
        </div>
        <label class="tp-couple" title="${tipsL("រូបគូស្នេហ៍", "Couple photo")}">
          ${coupleImage ? `<img src="${escapeAttr(coupleImage)}" alt="">` : `<span>${Icons.family()}</span>`}
          <small>${coupleImage ? tipsL("ប្តូររូប", "Change") : tipsL("ដាក់រូប", "Add photo")}</small>
          <input type="file" accept="image/*" data-couple-photo hidden>
        </label>
      </header>

      <div class="tp-top">
        <article class="tp-hero tp-tone-${cat.tone}">
          <div class="tp-hero-meta">
            <span class="tp-pill">${Icons.spark()} ${tipsL("គន្លឹះថ្ងៃនេះ", "Today's tip")}</span>
            <span class="tp-pill tp-pill-soft">${escapeHtml(tipsL(cat.km, cat.en))}</span>
          </div>
          <h2>${escapeHtml(tipT.title)}</h2>
          <p>${escapeHtml(tipT.short)}</p>
          <ul class="tp-steps">${tipT.quick.slice(0, 3).map(step => `<li>${Icons.check()}<span>${escapeHtml(step)}</span></li>`).join("")}</ul>
          <div class="tp-hero-actions">
            <button class="tp-btn tp-btn-main ${doneNow ? "is-done" : ""}" type="button" data-tip-done="${tipKey}">${Icons.check()} ${doneNow ? tipsL("បានធ្វើថ្ងៃនេះ", "Done today") : tipsL("ខ្ញុំធ្វើរួច", "I did it")}</button>
            <button class="tp-btn" type="button" data-tip-remind="${tipKey}">${Icons.bell()} ${tipsL("រំលឹកម៉ោង 7 ល្ងាច", "Remind me 7 PM")}</button>
            <button class="tp-btn tp-btn-icon" type="button" data-tip-next title="${tipsL("គន្លឹះផ្សេង", "Another tip")}" aria-label="${tipsL("គន្លឹះផ្សេង", "Another tip")}">↻</button>
          </div>
        </article>

        <article class="tp-week">
          <span class="tp-eyebrow">${tipsL("សប្តាហ៍នេះ", "This week")}</span>
          <div class="tp-ring" style="--p:${goalPct}">
            <strong>${progress.count}<small>/${TIPS_WEEK_GOAL}</small></strong>
          </div>
          <p>${progress.count >= TIPS_WEEK_GOAL ? tipsL("ល្អណាស់! គោលដៅសប្តាហ៍នេះសម្រេច 🎉", "Great! This week's goal is done 🎉") : tipsL(`ធ្វើ ${TIPS_WEEK_GOAL - progress.count} ទៀត ដើម្បីសម្រេចគោលដៅ`, `${TIPS_WEEK_GOAL - progress.count} more to reach the goal`)}</p>
          <div class="tp-week-foot">
            <span>🔥 ${progress.streak} ${tipsL("សប្តាហ៍ជាប់គ្នា", progress.streak === 1 ? "week streak" : "weeks streak")}</span>
            <span>⭐ ${state.fav.length}</span>
          </div>
        </article>
      </div>

      <section class="tp-section">
        <h3 class="tp-section-title">${tipsL("សម្រាប់អ្នកសប្តាហ៍នេះ", "For you this week")}</h3>
        <div class="tp-foryou">
          ${dates.map(item => {
            const added = inCalendar(item.eventTitle, item.date);
            return `<article class="tp-card tp-date">
              <span class="tp-card-icon">${item.icon}</span>
              <div class="tp-card-copy">
                <strong>${escapeHtml(item.title)}</strong>
                <small>${item.days === 0 ? tipsL("ថ្ងៃនេះ!", "Today!") : item.days === 1 ? tipsL("ស្អែក", "Tomorrow") : tipsL(`នៅ ${item.days} ថ្ងៃទៀត`, `in ${item.days} days`)} · ${escapeHtml(formatDate(item.date))}${item.sub ? ` · ${escapeHtml(item.sub)}` : ""}</small>
                <p>${escapeHtml(item.idea)}</p>
              </div>
              <button class="tp-btn tp-btn-sm ${added ? "is-done" : ""}" type="button" ${added ? "disabled" : `data-tip-cal="${escapeAttr(item.date)}" data-tip-cal-title="${escapeAttr(item.eventTitle)}"`}>${added ? `${Icons.check()} ${tipsL("មានក្នុងប្រតិទិន", "In calendar")}` : `${Icons.calendar()} ${tipsL("ដាក់ក្នុងប្រតិទិន", "Add to calendar")}`}</button>
            </article>`;
          }).join("")}
          <article class="tp-card tp-checkin ${checkinDue ? "is-due" : ""}">
            <span class="tp-card-icon">💬</span>
            <div class="tp-card-copy">
              <strong>${tipsL("ការសន្ទនាប្រចាំសប្តាហ៍", "Weekly family check-in")}</strong>
              <small>${checkinDue ? tipsL("10 នាទី · សំណួរ 3", "10 minutes · 3 questions") : tipsL(`បានធ្វើ ${checkinDays === 0 ? "ថ្ងៃនេះ" : `${checkinDays} ថ្ងៃមុន`} ✅`, `Done ${checkinDays === 0 ? "today" : `${checkinDays} days ago`} ✅`)}</small>
              <p>${tipsL("អ្វីល្អ? អ្វីពិបាក? សប្តាហ៍ក្រោយចង់ធ្វើអ្វីជាមួយគ្នា? — រក្សាទុកក្នុង Memories", "What went well? What was hard? What shall we do next week? — saved to Memories")}</p>
            </div>
            <button class="tp-btn tp-btn-sm ${checkinDue ? "tp-btn-main" : ""}" type="button" data-tip-checkin>${Icons.edit()} ${checkinDue ? tipsL("ចាប់ផ្តើម", "Start") : tipsL("ធ្វើម្ដងទៀត", "Do again")}</button>
          </article>
          <article class="tp-card tp-idea">
            <span class="tp-card-icon">🌿</span>
            <div class="tp-card-copy">
              <strong>${tipsL("គំនិតចុងសប្តាហ៍", "Weekend idea")} <span class="tp-cost">${idea.cost}</span></strong>
              <p>${escapeHtml(tipsL(idea.km, idea.en))}</p>
            </div>
            <button class="tp-btn tp-btn-sm" type="button" data-tip-weekend>${Icons.bell()} ${tipsL("រំលឹកថ្ងៃសៅរ៍", "Remind Saturday")}</button>
          </article>
        </div>
      </section>

      <section class="tp-section">
        <div class="tp-filter-row" role="toolbar" aria-label="${tipsL("ច្រោះគន្លឹះ", "Tip filters")}">
          ${filters.map((key, index) => `<button class="tp-chip ${index === 0 ? "active" : ""}" type="button" data-tip-filter="${key}">${filterLabel(key)}</button>`).join("")}
        </div>
        <div class="tp-grid">
          ${groups.map(group => {
            const id = tipId(group);
            const text = tipText(group);
            const c = TIP_CATS[tipCategory(group)] || TIP_CATS.DAILY;
            const fav = state.fav.includes(id);
            const done = progress.ids.has(id);
            return `<button class="tp-tip tp-tone-${c.tone}" type="button" data-tip-open="${id}" data-category="${tipCategory(group)}" data-saved="${fav ? "1" : ""}">
              <span class="tp-tip-icon">${group.icon}</span>
              <span class="tp-tip-copy">
                <span class="tp-tip-cat">${escapeHtml(tipsL(c.km, c.en))}${done ? ` · <b>✅ ${tipsL("សប្តាហ៍នេះ", "this week")}</b>` : ""}</span>
                <strong>${escapeHtml(text.title)}</strong>
                <small>${escapeHtml(text.short)}</small>
              </span>
              ${fav ? `<span class="tp-tip-star" aria-label="${tipsL("បានរក្សាទុក", "Saved")}">⭐</span>` : ""}
            </button>`;
          }).join("")}
        </div>
        <p class="tp-empty" data-tip-empty hidden>${tipsL("មិនទាន់មានគន្លឹះដែលបានរក្សាទុកទេ។ ចុច ⭐ លើគន្លឹះដែលចូលចិត្ត។", "No saved tips yet. Tap ⭐ on the ones you like.")}</p>
      </section>

      <article class="tp-principles">
        <div class="tp-principles-head">
          <div><span class="tp-eyebrow">${tipsL("គ្រួសាររបស់យើង", "Our family")}</span><h3>${tipsL("គោលការណ៍របស់យើង", "Our principles")}</h3></div>
          <button class="icon-button" type="button" data-principles-edit aria-label="${tipsL("កែប្រែ", "Edit")}" title="${tipsL("កែប្រែ", "Edit")}">${Icons.edit()}</button>
        </div>
        <ul class="tp-principles-list" data-principles-list>${principles.map(item => `<li>${Icons.heart()}<span>${escapeHtml(item)}</span></li>`).join("")}</ul>
        <form class="tp-principles-form" data-principles-form hidden>
          <label for="principlesInput">${tipsL("គោលការណ៍មួយក្នុងមួយបន្ទាត់", "One principle per line")}</label>
          <textarea id="principlesInput" rows="6">${escapeHtml(principles.join("\n"))}</textarea>
          <div class="action-row"><button class="button" type="submit">${tipsL("រក្សាទុក", "Save")}</button><button class="button ghost-button" type="button" data-principles-cancel>${tipsL("បោះបង់", "Cancel")}</button></div>
        </form>
      </article>

      <p class="tips-final-note">${tipsL("គ្រួសារដែលល្អ មិនមែនជាគ្រួសារដែលគ្មានបញ្ហាទេ — គឺជាគ្រួសារដែលដោះស្រាយបញ្ហាជាមួយគ្នា។ ❤️", "A good family is not one without problems — it is one that solves them together. ❤️")}</p>
    </section>
  `;
}

/* ---------- tip sheet ---------- */
function openTipSheet(id) {
  const group = getTipsData().find(item => tipId(item) === id);
  if (!group) return;
  tipsOpenId = id;
  const today = tipsToday();
  const state = tipsState();
  const text = tipText(group);
  const c = TIP_CATS[tipCategory(group)] || TIP_CATS.DAILY;
  const fav = state.fav.includes(id);
  const doneNow = tipDoneToday(state, id, today);
  const times = state.done.filter(entry => entry.id === id).length;
  closeTipSheet(true);
  const node = document.createElement("div");
  node.className = "tp-sheet-overlay";
  node.id = "tipSheet";
  node.innerHTML = `
    <section class="tp-sheet tp-tone-${c.tone}" role="dialog" aria-modal="true" aria-labelledby="tipSheetTitle">
      <span class="tp-sheet-grip" aria-hidden="true"></span>
      <div class="tp-sheet-head">
        <span class="tp-tip-icon">${group.icon}</span>
        <div>
          <span class="tp-tip-cat">${escapeHtml(tipsL(c.km, c.en))}${times ? ` · ${tipsL(`បានធ្វើ ${times} ដង`, `done ${times}×`)}` : ""}</span>
          <h2 id="tipSheetTitle">${escapeHtml(text.title)}</h2>
        </div>
        <button class="icon-button" type="button" data-tip-close aria-label="${tipsL("បិទ", "Close")}">${Icons.close()}</button>
      </div>
      <p class="tp-sheet-short">${escapeHtml(text.short)}</p>
      <h4>${tipsL("សាកធ្វើ", "Try this")}</h4>
      <ul class="tp-steps">${text.quick.map(step => `<li>${Icons.check()}<span>${escapeHtml(step)}</span></li>`).join("")}</ul>
      <div class="tp-sheet-detail"><strong>${tipsL("ហេតុអ្វីសំខាន់", "Why it matters")}</strong><p>${escapeHtml(text.detail)}</p></div>
      <div class="tp-sheet-actions">
        <button class="tp-btn tp-btn-main ${doneNow ? "is-done" : ""}" type="button" data-tip-done="${id}">${Icons.check()} ${doneNow ? tipsL("បានធ្វើថ្ងៃនេះ", "Done today") : tipsL("ខ្ញុំធ្វើរួច", "I did it")}</button>
        <button class="tp-btn" type="button" data-tip-remind="${id}">${Icons.bell()} ${tipsL("រំលឹក 7 ល្ងាច", "Remind 7 PM")}</button>
        <button class="tp-btn ${fav ? "is-fav" : ""}" type="button" data-tip-fav="${id}">${fav ? "⭐" : "☆"} ${fav ? tipsL("បានរក្សាទុក", "Saved") : tipsL("រក្សាទុក", "Save")}</button>
      </div>
    </section>`;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add("open"));
  node.addEventListener("click", event => {
    if (event.target === node || event.target.closest("[data-tip-close]")) closeTipSheet();
  });
  bindTipActions(node);
  document.addEventListener("keydown", tipSheetEsc);
  node.querySelector("[data-tip-close]")?.focus({ preventScroll: true });
}

function tipSheetEsc(event) {
  if (event.key === "Escape") closeTipSheet();
}

function closeTipSheet(instant = false) {
  const node = document.getElementById("tipSheet");
  document.removeEventListener("keydown", tipSheetEsc);
  if (!instant) tipsOpenId = "";
  if (!node) return;
  if (instant) {
    node.remove();
    return;
  }
  node.classList.remove("open");
  setTimeout(() => node.remove(), 220);
}

/* ---------- actions ---------- */
function tipTitleById(id) {
  const group = getTipsData().find(item => tipId(item) === id);
  return group ? tipText(group).title : "";
}

function addTipReminder(title, date, time, notes) {
  const exists = (appData.reminders || []).some(item => !item.done && item.title === title && item.date === date);
  if (exists) {
    Toast.show(tipsL("មានការរំលឹកនេះរួចហើយ", "That reminder already exists"));
    return;
  }
  const y = window.scrollY;
  Store.add("reminders", { title, date, time, category: "Family", notes, done: false });
  window.scrollTo(0, y);
  if (typeof Sound !== "undefined") Sound.play("success");
  Toast.show(tipsL(`⏰ នឹងរំលឹក ${formatDate(date)} ម៉ោង ${time}`, `⏰ Reminder set for ${formatDate(date)} ${time}`));
}

function bindTipActions(root) {
  root.querySelectorAll("[data-tip-done]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.tipDone;
    const today = tipsToday();
    const before = tipsProgress(tipsState(), today).count;
    let added = false;
    tipsCommit(state => {
      if (tipDoneToday(state, id, today)) {
        state.done = state.done.filter(entry => !(entry.id === id && entry.date === today));
      } else {
        state.done.push({ id, date: today });
        added = true;
      }
    });
    if (added) {
      const reached = before < TIPS_WEEK_GOAL && before + 1 >= TIPS_WEEK_GOAL;
      if (typeof Sound !== "undefined") Sound.play(reached ? "celebrate" : "success");
      Toast.show(reached ? tipsL("🎉 សម្រេចគោលដៅសប្តាហ៍នេះ!", "🎉 Weekly goal reached!") : tipsL("✅ ល្អណាស់! បានកត់ទុក", "✅ Nice! Saved"));
    }
    if (tipsOpenId) openTipSheet(tipsOpenId);
  }));
  root.querySelectorAll("[data-tip-fav]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.tipFav;
    tipsCommit(state => {
      state.fav = state.fav.includes(id) ? state.fav.filter(item => item !== id) : [...state.fav, id];
    });
    if (typeof Sound !== "undefined") Sound.play("pop");
    if (tipsOpenId) openTipSheet(tipsOpenId);
  }));
  root.querySelectorAll("[data-tip-remind]").forEach(button => button.addEventListener("click", () => {
    const title = `💡 ${tipTitleById(button.dataset.tipRemind)}`;
    const now = new Date();
    const date = now.getHours() >= 19 ? tipsAddDays(tipsToday(), 1) : tipsToday();
    addTipReminder(title, date, "19:00", tipsL("គន្លឹះគ្រួសារ", "Family tip"));
    if (tipsOpenId) openTipSheet(tipsOpenId);
  }));
}

function openCheckin() {
  const today = tipsToday();
  Modal.open({
    title: tipsL("💬 ការសន្ទនាប្រចាំសប្តាហ៍", "💬 Weekly family check-in"),
    submitText: tipsL("រក្សាទុកក្នុង Memories", "Save to Memories"),
    fields: [
      { type: "heading", label: tipsL("អង្គុយជាមួយគ្នា 10 នាទី", "Sit together for 10 minutes"), description: tipsL("ម្នាក់ៗឆ្លើយខ្លីៗ។ ស្តាប់គ្នា កុំវិនិច្ឆ័យ។", "Each person answers briefly. Listen, don't judge.") },
      { name: "good", label: tipsL("😊 សប្តាហ៍នេះ អ្វីល្អ?", "😊 What went well this week?"), type: "textarea", required: true },
      { name: "hard", label: tipsL("😓 អ្វីពិបាក? ត្រូវការជំនួយអ្វី?", "😓 What was hard? What help do you need?"), type: "textarea" },
      { name: "next", label: tipsL("🎯 សប្តាហ៍ក្រោយ ចង់ធ្វើអ្វីជាមួយគ្នា?", "🎯 What shall we do together next week?"), type: "textarea" }
    ],
    onSubmit: data => {
      const description = [
        `😊 ${String(data.good || "").trim()}`,
        data.hard ? `😓 ${String(data.hard).trim()}` : "",
        data.next ? `🎯 ${String(data.next).trim()}` : ""
      ].filter(Boolean).join("\n");
      const state = tipsState();
      state.lastCheckin = today;
      appData.profile.tips = state;
      Store.add("memories", {
        title: tipsL("💬 ការសន្ទនាគ្រួសារ", "💬 Family check-in"),
        date: today,
        location: "",
        description,
        familyMembers: "",
        tags: "check-in, family",
        photo: ""
      });
      if (typeof Sound !== "undefined") Sound.play("celebrate");
      Toast.show(tipsL("💾 បានរក្សាទុកក្នុង Memories", "💾 Saved to Memories"));
    }
  });
}

function bindTips() {
  const page = document.querySelector(".tp-page");
  if (!page) return;
  bindTipActions(page);

  page.querySelector("[data-tip-next]")?.addEventListener("click", () => {
    const key = `mylife:tip-offset:${tipsToday()}`;
    try { sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) || 0) + 1)); } catch (error) { /* ignore */ }
    if (typeof Sound !== "undefined") Sound.play("tap");
    const y = window.scrollY;
    App.render();
    window.scrollTo(0, y);
  });

  page.querySelectorAll("[data-tip-open]").forEach(card => card.addEventListener("click", () => openTipSheet(card.dataset.tipOpen)));

  const empty = page.querySelector("[data-tip-empty]");
  page.querySelectorAll("[data-tip-filter]").forEach(button => button.addEventListener("click", () => {
    const filter = button.dataset.tipFilter;
    page.querySelectorAll("[data-tip-filter]").forEach(item => item.classList.toggle("active", item === button));
    let shown = 0;
    page.querySelectorAll("[data-tip-open]").forEach(card => {
      const show = filter === "ALL" || (filter === "SAVED" ? card.dataset.saved === "1" : card.dataset.category === filter);
      card.hidden = !show;
      if (show) shown += 1;
    });
    if (empty) empty.hidden = shown > 0;
  }));

  page.querySelectorAll("[data-tip-cal]").forEach(button => button.addEventListener("click", () => {
    const title = button.dataset.tipCalTitle;
    const date = button.dataset.tipCal;
    if (inCalendar(title, date)) return;
    const y = window.scrollY;
    Store.add("calendarEvents", { title, date, time: "", category: "Family", familyMember: "", reminder: true, notes: tipsL("ពីទំព័រគន្លឹះ", "From Tips") });
    window.scrollTo(0, y);
    if (typeof Sound !== "undefined") Sound.play("success");
    Toast.show(tipsL("📅 បានដាក់ក្នុងប្រតិទិន", "📅 Added to calendar"));
  }));

  page.querySelector("[data-tip-weekend]")?.addEventListener("click", () => {
    const idea = weekendIdea(tipsToday());
    addTipReminder(`🌿 ${tipsL(idea.km, idea.en)}`, nextSaturday(tipsToday()), "09:00", tipsL("គំនិតចុងសប្តាហ៍", "Weekend idea"));
  });

  page.querySelector("[data-tip-checkin]")?.addEventListener("click", openCheckin);

  page.querySelector("[data-couple-photo]")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      const container = page.querySelector(".tp-head");
      const editor = createImagePositionEditor({
        src: dataUrl,
        key: "tips-couple",
        title: tipsL("លៃតម្រូវរូបគូស្នេហ៍", "Adjust couple photo"),
        onSave: position => Store.updateProfile({ tipsCoupleImage: dataUrl, tipsCoupleImagePosition: position }),
        onCancel: () => { event.target.value = ""; }
      });
      container.appendChild(editor);
    } catch (error) {
      Toast.show(tipsL("មិនអាចបញ្ចូលរូបភាពបានទេ", "The image could not be uploaded."));
    }
  });

  const form = page.querySelector("[data-principles-form]");
  const list = page.querySelector("[data-principles-list]");
  page.querySelector("[data-principles-edit]")?.addEventListener("click", () => {
    form.hidden = false;
    list.hidden = true;
    form.querySelector("textarea").focus();
  });
  page.querySelector("[data-principles-cancel]")?.addEventListener("click", () => {
    form.hidden = true;
    list.hidden = false;
  });
  form?.addEventListener("submit", event => {
    event.preventDefault();
    const principles = form.querySelector("textarea").value.split("\n").map(item => item.trim()).filter(Boolean).slice(0, 10);
    Store.updateProfile({ familyPrinciples: principles });
    Toast.show(tipsL("💾 បានរក្សាទុក", "💾 Saved"));
  });

  // a sheet that was open before a re-render comes back
  if (tipsOpenId && !document.getElementById("tipSheet")) openTipSheet(tipsOpenId);
}

window.addEventListener("hashchange", () => {
  if (location.hash !== "#tips") closeTipSheet();
});
