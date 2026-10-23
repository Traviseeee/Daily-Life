/* MYLIFE Calendar V2 (draft 23 Oct 2026): month card → the chosen day as a
 * timeline with a "now" line → coming up. Both themes (css/calendar-v2.css).
 * Uses the data renderCalendar() already built and the same hooks, so bindCalendar()
 * keeps working: .day[data-calendar-date] selects a day, data-action="add-calendar"
 * adds, data-open-event opens a manual event (the form has edit + delete).
 * The old layout in calendar.js stays as a fallback. */
const CalendarV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_DAY = ["អាទិត្យ", "ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
  const KM_DAY_S = ["អាទិ", "ចន្ទ", "អង្គ", "ពុធ", "ព្រហ", "សុក្រ", "សៅរ៍"];
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const HOLIDAY = "#e5484d";
  const HIDDEN = new Set(["expense", "memory"]);
  let showAll = false;

  const dateOf = iso => new Date(`${iso}T00:00:00`);
  const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 86400000);
  const monthName = d => (km() ? KM_M[d.getMonth()] : d.toLocaleDateString("en-US", { month: "long" }));
  const shortDay = d => (km() ? KM_DAY_S[d.getDay()] : d.toLocaleDateString("en-US", { weekday: "short" }));
  const longDay = iso => { const d = dateOf(iso); return km() ? `${KM_DAY[d.getDay()]} ${d.getDate()} ${KM_M[d.getMonth()]}` : d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }); };
  const tone = event => (event.source === "holiday" ? "holiday" : calendarTone(event));
  const color = event => (event.source === "holiday" ? HOLIDAY : CALENDAR_TONES[tone(event)].color);
  const toneLabel = event => { const item = CALENDAR_TONES[tone(event)]; return km() ? (event.source === "holiday" ? "ថ្ងៃឈប់" : item.km) : item.en; };
  // "Bill: EDC" → "EDC"; a forwarded ABA Pay request → the name only
  function cleanTitle(event) {
    let text = String(event.title || "");
    if (event.auto && event.source !== "holiday") text = text.replace(/^[^:]{1,24}:\s*/, "");
    if (typeof SmartParse !== "undefined" && SmartParse.cleanPayText) text = SmartParse.cleanPayText(text);
    return text;
  }
  // amounts with cents ($344.84), still hidden by the privacy switch
  const full = (value, currency) => `<span class="money-value" data-private-money>${escapeHtml(formatPlainMoney(Number(value) || 0, currency || appData.profile.currency || "USD"))}</span>`;
  const clock = time => (typeof todayClock === "function" ? todayClock(time) : time);
  // auto items link to their page; manual events are a button that opens the form (edit + delete)
  const wrap = (event, cls, inner) => (event.auto
    ? `<a class="${cls}" href="${escapeAttr(event.href || "#calendar")}">${inner}</a>`
    : `<div class="${cls}" role="button" tabindex="0" data-open-event="${escapeAttr(event.id)}">${inner}</div>`);

  function itemsBetween(fromIso, toIso) {
    const months = new Set();
    for (let d = dateOf(fromIso); d <= dateOf(toIso); d.setMonth(d.getMonth() + 1, 1)) months.add(`${d.getFullYear()}-${d.getMonth()}`);
    const list = [...months].flatMap(key => { const [y, m] = key.split("-").map(Number); ensureCambodiaHolidays(y); return calendarItemsForMonth(new Date(y, m, 1)); });
    return list.filter(item => item.date >= fromIso && item.date <= toIso);
  }

  function hero(ctx) {
    const today = localDateInput();
    const week = new Date(); week.setDate(week.getDate() + 7);
    const soon = dedupeAgendaItems(itemsBetween(today, localDateInput(week))).filter(item => !HIDDEN.has(item.source));
    const todayCount = soon.filter(item => item.date === today).length;
    const seg = [["month", L("ខែ", "Month")], ["week", L("សប្តាហ៍", "Week")], ["day", L("ថ្ងៃ", "Day")]];
    return `<header class="cv2-hero">
      <div class="cv2-title">
        <div><h1>${escapeHtml(t("calendar"))}</h1><p>${escapeHtml(L(`ថ្ងៃនេះ ${todayCount} · ខាងមុខ ${soon.length - todayCount} ក្នុង 7 ថ្ងៃ`, `${todayCount} today · ${soon.length - todayCount} in the next 7 days`))}</p></div>
        <button class="cv2-add" type="button" data-action="add-calendar" aria-label="${escapeAttr(t("addEvent"))}">${Icons.plus()}</button>
      </div>
      <nav class="cv2-seg">${seg.map(([id, label]) => `<a class="${ctx.view === id ? "on" : ""}" href="#calendar/${id}/${id === "month" ? ctx.visibleMonth : ctx.selectedLinkDate}"${ctx.view === id ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`).join("")}</nav>
    </header>`;
  }

  function cell(iso, ctx) {
    if (!iso) return '<span class="cv2-c is-blank" aria-hidden="true"></span>';
    const today = localDateInput();
    const d = dateOf(iso);
    const events = ctx.periodEvents.filter(event => event.date === iso && event.source !== "memory");
    const holiday = cambodiaHolidayState.items.find(item => item.date === iso);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const colors = [...new Set(events.map(color))].slice(0, 3);
    const cls = ["cv2-c", iso === today ? "is-today" : iso < today ? "is-past" : "", weekend ? "is-weekend" : "", holiday ? "is-holiday" : "", iso === selectedCalendarDate && iso !== today ? "is-selected" : ""].filter(Boolean).join(" ");
    return `<button class="${cls}" type="button" data-calendar-date="${iso}" aria-pressed="${iso === selectedCalendarDate}" aria-label="${escapeAttr(longDay(iso))}${holiday ? ` · ${escapeAttr(holiday.name)}` : ""}"><b>${d.getDate()}</b><span class="cv2-dots">${colors.map(c => `<i style="background:${c}"></i>`).join("")}</span></button>`;
  }

  function monthCard(ctx) {
    const today = localDateInput();
    let dates = ctx.dates;
    if (ctx.view === "day") {
      // day view: the week around that day, so the next / previous day is one tap
      const start = dateOf(selectedCalendarDate); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return localDateInput(d); });
    }
    const first = dateOf(dates.find(Boolean)); const last = dateOf([...dates].reverse().find(Boolean));
    const title = ctx.view === "month"
      ? `${monthName(ctx.current)} ${ctx.current.getFullYear()}`
      : ctx.view === "day" ? longDay(selectedCalendarDate)
        : `${first.getDate()}${first.getMonth() !== last.getMonth() ? ` ${monthName(first)}` : ""} – ${last.getDate()} ${monthName(last)}`;
    const count = ctx.periodEvents.filter(event => event.source !== "memory").length;
    const isNow = ctx.view === "month" ? today.startsWith(ctx.visibleMonth) : dates.includes(today);
    const head = [L("ចន្ទ", "Mon"), L("អង្គ", "Tue"), L("ពុធ", "Wed"), L("ព្រហ", "Thu"), L("សុក្រ", "Fri"), L("សៅរ៍", "Sat"), L("អាទិ", "Sun")];
    const used = [...new Map(ctx.periodEvents.filter(event => event.source !== "memory").map(event => [tone(event), event])).values()];
    return `<section class="cv2-card cv2-month">
      <div class="cv2-nav">
        <a class="cv2-nb" href="${ctx.prevHref}" aria-label="${escapeAttr(t("previousMonth"))}">‹</a>
        <b>${escapeHtml(title)}<small>${escapeHtml(L(`${count} រឿង`, `${count} items`))}</small></b>
        ${isNow ? "" : `<a class="cv2-today" href="${ctx.todayHref}">${escapeHtml(L("ថ្ងៃនេះ", "Today"))}</a>`}
        <a class="cv2-nb" href="${ctx.nextHref}" aria-label="${escapeAttr(t("nextMonth"))}">›</a>
      </div>
      <div class="cv2-wd">${head.map((name, i) => `<span class="${i > 4 ? "is-weekend" : ""}">${name}</span>`).join("")}</div>
      <div class="cv2-grid" data-calendar-view="${escapeAttr(ctx.view)}">${dates.map(iso => cell(iso, ctx)).join("")}</div>
      ${used.length ? `<div class="cv2-chips">${used.map(event => `<span class="cv2-chip"><i style="background:${color(event)}"></i>${escapeHtml(toneLabel(event))}</span>`).join("")}</div>` : ""}
    </section>`;
  }

  function dayList(ctx) {
    const iso = selectedCalendarDate;
    const today = localDateInput();
    const now = new Date();
    const nowClock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const events = ctx.periodEvents.filter(event => event.date === iso && event.source !== "memory");
    const timed = events.filter(event => event.time && event.source !== "expense").sort((a, b) => a.time.localeCompare(b.time));
    const allDay = events.filter(event => !event.time && event.source !== "expense");
    const spent = events.filter(event => event.source === "expense");
    const row = (event, past) => {
      const amount = event.amount ? `<span class="cv2-amt">${event.source === "expense" ? "−" : ""}${full(event.amount, event.currency)}</span>` : "";
      const sub = [toneLabel(event), event.source === "expense" && /ABA Pay/i.test(event.notes || "") ? "ABA Pay" : ""].filter(Boolean).join(" · ");
      return wrap(event, `cv2-tl${past ? " is-done" : ""}`, `
        <span class="cv2-tm">${event.time ? escapeHtml(clock(event.time)) : event.source === "expense" ? "" : escapeHtml(L("ពេញថ្ងៃ", "All day"))}</span>
        <span class="cv2-bx" style="--k:${color(event)}">${amount}<b>${escapeHtml(cleanTitle(event))}</b><small>${escapeHtml(sub)}</small></span>`);
    };
    let nowShown = false;
    const timedRows = timed.map(event => {
      const past = iso < today || (iso === today && event.time < nowClock);
      let line = "";
      if (iso === today && !past && !nowShown) { nowShown = true; line = `<div class="cv2-now">${escapeHtml(L(`ឥឡូវ ${clock(nowClock)}`, `Now ${clock(nowClock)}`))}</div>`; }
      return line + row(event, past);
    }).join("");
    const endNow = iso === today && timed.length && !nowShown ? `<div class="cv2-now">${escapeHtml(L(`ឥឡូវ ${clock(nowClock)}`, `Now ${clock(nowClock)}`))}</div>` : "";
    // spending: each one when there are a few, one summary row when there are many
    const spentRows = spent.length > 4
      ? `<a class="cv2-tl" href="#money/expenses"><span class="cv2-tm"></span><span class="cv2-bx" style="--k:${CALENDAR_TONES.expense.color}"><span class="cv2-amt">−${money(spent.reduce((sum, item) => sum + toProfileCurrency(item.amount, item.currency), 0))}</span><b>${escapeHtml(L(`ចំណាយ ${spent.length} មុខ`, `${spent.length} expenses`))}</b><small>${escapeHtml(spent.slice(0, 3).map(cleanTitle).join(" · "))} …</small></span></a>`
      : spent.map(event => row(event, iso < today)).join("");
    const rows = allDay.map(event => row(event, iso < today)).join("") + timedRows + endNow + spentRows;
    const count = events.length;
    return `<div class="cv2-sec"><b>${escapeHtml(longDay(iso))}</b><small>${escapeHtml(L(`${count} រឿង`, `${count} items`))}</small></div>
      <section class="cv2-card cv2-day">${rows || `<button class="cv2-empty" type="button" data-action="add-calendar" data-calendar-date="${iso}">${Icons.plus()}<span>${escapeHtml(L("គ្មានអ្វីទេ — ចុចបន្ថែមព្រឹត្តិការណ៍", "Nothing planned — tap to add"))}</span></button>`}</section>`;
  }

  function upcoming() {
    const today = localDateInput();
    const until = new Date(); until.setDate(until.getDate() + (showAll ? 92 : 45));
    const list = mergeHolidayRanges(dedupeAgendaItems(itemsBetween(today, localDateInput(until)))
      .filter(event => !HIDDEN.has(event.source) && event.date > today && event.date !== selectedCalendarDate && !event.paid))
      .slice(0, showAll ? 30 : 4);
    if (!list.length) return "";
    const thisMonth = today.slice(0, 7);
    const rows = list.map(event => {
      const d = dateOf(event.date);
      const days = daysBetween(today, event.date);
      const when = event.time ? clock(event.time) : event.dateEnd ? `${d.getDate()}–${dateOf(event.dateEnd).getDate()} ${monthName(dateOf(event.dateEnd))}` : "";
      const sub = [event.amount ? full(event.amount, event.currency) : "", when || (event.source === "holiday" ? L("ពេញមួយថ្ងៃ", "All day") : ""), days <= 14 ? (days === 1 ? L("ស្អែក", "tomorrow") : L(`ក្នុង ${days} ថ្ងៃ`, `in ${days} days`)) : ""].filter(Boolean).join(" · ");
      return wrap(event, "cv2-ag", `
        <span class="cv2-dt"><b>${d.getDate()}</b><small>${escapeHtml(event.date.slice(0, 7) === thisMonth ? shortDay(d) : monthName(d))}</small></span>
        <span class="cv2-tx"><b>${escapeHtml(cleanTitle(event))}</b>${sub ? `<small>${sub}</small>` : ""}</span>
        <span class="cv2-tag" style="--k:${color(event)}">${escapeHtml(toneLabel(event))}</span>`);
    }).join("");
    return `<div class="cv2-sec"><b>${escapeHtml(L("ខាងមុខ", "Coming up"))}</b><button type="button" class="cv2-link" data-cv2-all>${escapeHtml(showAll ? L("បង្ហាញតិច ›", "Show less ›") : L("មើលទាំងអស់ ›", "See all ›"))}</button></div>
      <section class="cv2-card cv2-up">${rows}</section>`;
  }

  function render(ctx) {
    return `<section class="page cv2">
      ${hero(ctx)}
      <div class="cv2-body">
        ${monthCard(ctx)}
        ${dayList(ctx)}
        ${upcoming()}
      </div>
    </section>`;
  }

  document.addEventListener("click", event => {
    const all = event.target.closest("[data-cv2-all]");
    if (all) { showAll = !showAll; App.render(); return; }
    // a day in the grid (same as bindCalendar's .day handler; own class so old .day styles stay out)
    const day = event.target.closest(".cv2-c[data-calendar-date]");
    if (day) {
      selectedCalendarDate = day.dataset.calendarDate;
      const [, view] = location.hash.replace("#", "").split("/");
      if (view === "week" || view === "day") { location.hash = `#calendar/${view}/${selectedCalendarDate}`; return; }
      App.render();
    }
  });
  // keyboard: Enter / Space on a manual event opens it like a click
  document.addEventListener("keydown", event => {
    const row = event.target.closest?.(".cv2 [data-open-event]");
    if (row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); row.click(); }
  });

  return { render };
})();
