/* MYLIFE Home V2 (draft 23 Oct 2026): what matters today first.
 * Order: title "ថ្ងៃនេះមាន N រឿង" + week strip → next up → money (left this month +
 * waiting answers) → quick actions → today's schedule → daily focus → mood →
 * reflection → family memories → smart summary.
 * Same data and the same hooks as before (data-focus-id, data-mood, edit-focus,
 * data-reflection-textarea, save-reflection, home-profile-side, data-ma-home), so
 * bindHome() and the other modules keep working. Colours: css/home-v2.css
 * (light = sky blue, dark = green + lime). */
const HomeV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_DAYS = ["អាទិ", "ចន្ទ", "អង្គ", "ពុធ", "ព្រហ", "សុក្រ", "សៅរ៍"];
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    plus: () => svg('<path d="M12 5v14M5 12h14"/>'),
    scan: () => svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>'),
    cal: () => svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    photo: () => svg('<rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="11" r="2"/><path d="m21 17-5-5-8 8"/>'),
    chev: () => svg('<path d="m9 6 6 6-6 6"/>')
  };

  const plainMoney = (value, currency) => {
    try { if (typeof formatPlainMoney === "function") return formatPlainMoney(Number(value) || 0, currency || appData.profile.currency || "USD"); } catch (error) { /* below */ }
    return `$${(Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const iso = date => localDateInput(date);
  const dayLabel = date => (km() ? KM_DAYS[date.getDay()] : date.toLocaleDateString("en-US", { weekday: "short" }));
  const longDate = date => (km() ? `${KM_DAYS[date.getDay()]} ${date.getDate()} ${KM_MONTHS[date.getMonth()]}` : date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }));
  const clock = time => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
  };
  const kindOf = item => item.kind === "bill" ? "bill" : item.source === "family" || item.kind === "birthday" || item.kind === "anniversary" ? "family" : item.kind === "reminder" ? "reminder" : item.kind === "holiday" ? "holiday" : "event";
  const TAG = { bill: ["វិក្កយបត្រ", "Bill", "amber"], family: ["គ្រួសារ", "Family", "violet"], reminder: ["រំលឹក", "Reminder", "green"], holiday: ["ថ្ងៃឈប់", "Holiday", "green"], event: ["ព្រឹត្តិការណ៍", "Event", "blue"] };

  function data() {
    const todayIso = localDateInput();
    const agenda = typeof homeAgenda === "function" ? homeAgenda(todayIso) : { today: 0, items: [], allItems: [] };
    const due = typeof MoneyAsk !== "undefined" && typeof MoneyAsk.items === "function" && !(typeof Login !== "undefined" && Login.guestMode) && appData.profile?.moneyAsk !== false ? MoneyAsk.items() : [];
    const month = typeof moneyMonthNumbers === "function" ? moneyMonthNumbers() : null;
    const focus = typeof FocusEditor !== "undefined" ? FocusEditor.items(todayIso) : (appData.dailyFocus?.date === todayIso && appData.dailyFocus.items?.length ? appData.dailyFocus.items : [
      { id: "focus-move", text: t("moveMyBody"), done: false },
      { id: "focus-water", text: t("drinkWater"), done: false },
      { id: "focus-family", text: t("checkInWithFamily"), done: false }
    ]);
    return { todayIso, agenda, due, month, focus };
  }

  function header(d) {
    const today = new Date();
    const todayItems = (d.agenda.allItems || d.agenda.items || []).filter(item => !item.overdue && item.date === d.todayIso);
    const things = d.agenda.today + d.due.length + d.focus.filter(item => !item.done).length;
    const name = appData.profile.name || L("អ្នក", "you");
    const photo = appData.profile.photo ? `<img src="${escapeAttr(appData.profile.photo)}" alt="">` : escapeHtml(initials(appData.profile.name || "ML"));
    const dates = new Set((d.agenda.allItems || []).map(item => item.date));
    (appData.calendarEvents || []).forEach(event => event.date && dates.add(event.date));
    const week = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 3 + index); return date; });
    const parts = [L(`${d.agenda.today} ព្រឹត្តិការណ៍`, `${d.agenda.today} event${d.agenda.today === 1 ? "" : "s"}`)];
    if (d.due.length) parts.push(L(`${d.due.length} លុយត្រូវឆ្លើយ`, `${d.due.length} money to confirm`));
    return `<header class="hv2-head">
      <div class="hv2-title-row">
        <div class="hv2-title">
          <h1>${things ? L(`ថ្ងៃនេះមាន <span>${things} រឿង</span> ត្រូវធ្វើ`, `<span>${things} thing${things === 1 ? "" : "s"}</span> to do today`) : L(`ថ្ងៃនេះ <span>ទំនេរ</span> 🌿`, `Today is <span>free</span> 🌿`)}</h1>
          <p>${escapeHtml(longDate(today))} · ${escapeHtml(parts.join(" · "))}</p>
        </div>
        <div class="home-profile-side home-profile-trigger hv2-avatar" role="button" tabindex="0" aria-label="${escapeAttr(t("editProfile"))}" title="${escapeAttr(name)}">
          <span class="hv2-avatar-face">${photo}</span>
          <div class="home-profile-menu" aria-hidden="true">
            ${(typeof Login !== "undefined" && (Login.guestMode || !Login.authenticated)) ? `<button type="button" class="home-profile-menu-item home-profile-menu-login" data-account-action="login">${L("ចូលគណនី (Log in)", "Log in")}</button>` : ""}
            <button type="button" class="home-profile-menu-item" data-account-action="edit-profile">${escapeHtml(t("editProfile"))}</button>
          </div>
        </div>
      </div>
      <nav class="hv2-week" aria-label="${escapeAttr(L("សប្តាហ៍នេះ", "This week"))}">${week.map(date => {
        const key = iso(date);
        const on = key === d.todayIso;
        return `<a class="hv2-day${on ? " is-today" : ""}" href="#calendar"${on ? ' aria-current="date"' : ""}><small>${escapeHtml(dayLabel(date))}</small><b>${date.getDate()}</b><i class="${dates.has(key) ? "has" : ""}"></i></a>`;
      }).join("")}</nav>
      ${todayItems.length ? "" : ""}
    </header>`;
  }

  function nextUp(d) {
    const nowClock = new Date().toTimeString().slice(0, 5);
    const list = (d.agenda.items || []).filter(item => !item.overdue);
    const next = list.find(item => item.date === d.todayIso && clock(item.time) >= nowClock) || list.find(item => item.date === d.todayIso) || list[0];
    if (!next) return "";
    const isToday = next.date === d.todayIso;
    const t0 = clock(next.time);
    let when;
    if (isToday && t0) {
      const [h, m] = t0.split(":").map(Number);
      const mins = h * 60 + m - (new Date().getHours() * 60 + new Date().getMinutes());
      when = mins > 0 ? (mins >= 60 ? L(`ក្នុង ${Math.round(mins / 60)} ម៉ោង`, `in ${Math.round(mins / 60)} h`) : L(`ក្នុង ${mins} នាទី`, `in ${mins} min`)) : L("ឥឡូវនេះ", "now");
    } else if (isToday) when = L("ថ្ងៃនេះ", "today");
    else when = next.daysLeft === 1 ? L("ស្អែក", "tomorrow") : L(`ក្នុង ${next.daysLeft} ថ្ងៃ`, `in ${next.daysLeft} days`);
    const box = isToday && t0 ? t0 : (() => { const date = new Date(`${next.date}T00:00:00`); return `${date.getDate()}<small>${escapeHtml(km() ? KM_MONTHS[date.getMonth()].slice(0, 3) : date.toLocaleDateString("en-US", { month: "short" }))}</small>`; })();
    return `<a class="hv2-next" href="${escapeAttr(next.href || "#calendar")}">
      <span class="hv2-next-time">${box}</span>
      <span class="hv2-next-text"><small>${escapeHtml(L("បន្ទាប់", "Next"))} · ${escapeHtml(when)}</small><b>${escapeHtml(next.title || "")}</b></span>
      <span class="hv2-next-go">${IC.chev()}</span>
    </a>`;
  }

  function money(d) {
    const m = d.month;
    if (!m) return "";
    const spentPct = m.income > 0 ? Math.min(100, Math.round((m.expenses / m.income) * 100)) : 0;
    const monthName = km() ? KM_MONTHS[new Date().getMonth()] : new Date().toLocaleDateString("en-US", { month: "long" });
    const due = d.due;
    const dueNames = due.slice(0, 2).map(item => item.title).join(" · ");
    return `<section class="hv2-card hv2-money">
      <div class="hv2-row"><span class="hv2-label">${escapeHtml(L(`នៅសល់ខែ${monthName}`, `Left in ${monthName}`))}</span><a class="hv2-chip" href="#money">${escapeHtml(L("មើល", "View"))} ›</a></div>
      <div class="hv2-amount${m.left < 0 ? " is-neg" : ""}">${escapeHtml(plainMoney(m.left))}</div>
      <div class="hv2-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${spentPct}" aria-label="${escapeAttr(L("ចាយបាន", "Spent"))}"><i style="width:${spentPct}%"></i></div>
      <div class="hv2-legend"><span>${escapeHtml(L("ចាយ", "Spent"))} <b>${escapeHtml(plainMoney(m.expenses))}</b></span><span>${escapeHtml(L("ចំណូល", "Income"))} <b>${escapeHtml(plainMoney(m.income))}</b></span><span>${escapeHtml(L("សន្សំ", "Saved"))} <b>${escapeHtml(plainMoney(m.saved))}</b></span></div>
      ${due.length ? `<button type="button" class="hv2-wait" data-ma-home><span class="hv2-count">${due.length}</span><b>${escapeHtml(L(`${dueNames} រង់ចាំឆ្លើយ`, `${dueNames} waiting`))}</b><span class="hv2-pill">${escapeHtml(L("ឆ្លើយ", "Answer"))}</span></button>` : ""}
    </section>`;
  }

  function quick() {
    const item = (attrs, icon, tone, label) => `<button type="button" class="hv2-q" ${attrs}><i class="hv2-q-${tone}">${icon}</i><span>${escapeHtml(label)}</span></button>`;
    return `<div class="hv2-quick">
      ${item('data-action="add-expense"', IC.plus(), "a", L("កត់ចំណាយ", "Expense"))}
      ${item('data-hv2-go="#scan"', IC.scan(), "b", L("ស្កេន", "Scan"))}
      ${item('data-action="add-event"', IC.cal(), "c", L("ព្រឹត្តិការណ៍", "Event"))}
      ${item('data-hv2-quick="add-memory"', IC.photo(), "d", L("រូបថត", "Photo"))}
    </div>`;
  }

  function schedule(d) {
    const all = (d.agenda.allItems || d.agenda.items || []).filter(item => !item.overdue);
    const todays = all.filter(item => item.date === d.todayIso);
    const list = (todays.length ? todays : all).slice(0, 4);
    const heading = todays.length ? L("កាលវិភាគថ្ងៃនេះ", "Today's schedule") : L("ខាងមុខ", "Coming up");
    const rows = list.map(item => {
      const kind = kindOf(item);
      const [kmTag, enTag, tone] = TAG[kind];
      const time = item.date === d.todayIso ? (clock(item.time) || L("ពេញថ្ងៃ", "All day")) : (() => { const date = new Date(`${item.date}T00:00:00`); return `${date.getDate()} ${km() ? KM_MONTHS[date.getMonth()].slice(0, 3) : date.toLocaleDateString("en-US", { month: "short" })}`; })();
      const sub = item.amount ? plainMoney(item.amount, item.currency) : (item.categoryLabel || "");
      return `<a class="hv2-tl-row" href="${escapeAttr(item.href || "#calendar")}"><span class="hv2-tl-time">${escapeHtml(time)}</span><span class="hv2-dot is-${tone}"></span><span class="hv2-tl-text"><b>${escapeHtml(item.title || "")}</b>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</span><span class="hv2-tag is-${tone}">${escapeHtml(L(kmTag, enTag))}</span></a>`;
    }).join("");
    return `<div class="hv2-sec"><b>${escapeHtml(heading)}</b><a href="#calendar">${escapeHtml(L("ប្រតិទិន", "Calendar"))} ›</a></div>
      <section class="hv2-card hv2-tl">${rows || `<button type="button" class="hv2-empty" data-action="add-event">${IC.cal()}<span>${escapeHtml(L("គ្មានអ្វីទេ — ចុចបន្ថែមព្រឹត្តិការណ៍", "Nothing planned — tap to add an event"))}</span></button>`}</section>`;
  }

  function focusCard(d) {
    const done = d.focus.filter(item => item.done).length;
    const pct = d.focus.length ? Math.round((done / d.focus.length) * 100) : 0;
    return `<div class="hv2-sec"><b>${escapeHtml(t("dailyFocus"))}</b><button type="button" class="hv2-link" data-action="edit-focus">${escapeHtml(L("កែ", "Edit"))} ›</button></div>
      <section class="hv2-card hv2-focus focus-card${pct === 100 ? " all-done" : ""}">
        <div class="hv2-ring progress-fill" style="--p:${pct / 100}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${escapeAttr(t("dailyFocus"))}"><span class="focus-count">${done}/${d.focus.length}</span></div>
        <ul class="hv2-checks focus-list">${d.focus.map(item => `<li class="focus-item${item.done ? " done" : ""}"><label><input type="checkbox" ${item.done ? "checked" : ""} data-focus-id="${escapeAttr(item.id)}"><span class="hv2-box" aria-hidden="true"></span><span class="focus-text">${escapeHtml(item.text)}</span></label></li>`).join("")}</ul>
      </section>`;
  }

  function moodCard(d) {
    const options = [["happy", "😊", t("moodHappy")], ["calm", "😌", t("moodCalm")], ["tired", "😴", t("moodTired")], ["stressed", "😟", t("moodStressed")], ["excited", "🤩", t("moodExcited")]];
    const current = appData.mood?.date === d.todayIso ? appData.mood.value : "";
    return `<div class="hv2-sec"><b>${escapeHtml(L("អារម្មណ៍ថ្ងៃនេះ", "Today's mood"))}</b></div>
      <section class="hv2-card hv2-mood">${options.map(([value, emoji, label]) => `<button type="button" class="hv2-mood-btn${current === value ? " is-on" : ""}" data-mood="${value}" aria-label="${escapeAttr(label)}" aria-pressed="${current === value}"><span>${emoji}</span><small>${escapeHtml(label)}</small></button>`).join("")}</section>`;
  }

  function reflection(d) {
    const text = appData.dailyReflection?.date === d.todayIso ? (appData.dailyReflection.text || "") : "";
    return `<details class="hv2-card hv2-reflect"${text ? " open" : ""}>
      <summary><b>${escapeHtml(t("dailyReflection"))}</b><small>${escapeHtml(text ? L("បានសរសេរ ✓", "Written ✓") : L("ចុចដើម្បីសរសេរ", "Tap to write"))}</small></summary>
      <textarea class="reflection-textarea" data-reflection-textarea placeholder="${escapeAttr(t("reflectionPlaceholder"))}" aria-label="${escapeAttr(t("reflectionPlaceholder"))}">${escapeHtml(text)}</textarea>
      <button class="button" type="button" data-action="save-reflection">${escapeHtml(t("saveReflection"))}</button>
    </details>`;
  }

  function render() {
    const d = data();
    return `<section class="page home-featured-page hv2">
      ${header(d)}
      <div class="hv2-body">
        ${nextUp(d)}
        ${money(d)}
        ${quick()}
        ${schedule(d)}
        ${focusCard(d)}
        ${moodCard(d)}
        ${reflection(d)}
        ${typeof MemoryFeed !== "undefined" ? MemoryFeed.familyTeaser() : ""}
        <a class="hv2-card hv2-summary" href="#summary"><span class="hv2-summary-icon">${Icons.chart()}</span><span><b>${escapeHtml(t("smartSummary"))}</b><small>${escapeHtml(t("smartSummarySubtitle"))}</small></span>${IC.chev()}</a>
      </div>
    </section>`;
  }

  // extra buttons that are not bound elsewhere
  document.addEventListener("click", event => {
    const go = event.target.closest("[data-hv2-go]");
    if (go) { location.hash = go.dataset.hv2Go; return; }
    const quickAction = event.target.closest("[data-hv2-quick]");
    if (quickAction && typeof runQuickAction === "function") runQuickAction(quickAction.dataset.hv2Quick);
  });

  return { render };
})();
