/* MYLIFE smart event form.
 * Replaces the generic Modal grid for calendar events with:
 *  - one big title field that understands "ស្អែក ម៉ោង 9 ព្រឹក", "tomorrow 3pm", family names, bill/loan words
 *  - quick date / time chips with a friendly Khmer/English label
 *  - category chips with icons, family member chips with photos
 *  - a Telegram toggle that says exactly when the alert will be sent
 * Saves the same fields as before: title, date, time, category, familyMember, reminder, notes.
 */
const EventForm = (() => {
  const CATEGORIES = [
    { value: "Personal", icon: "user", tone: "personal" },
    { value: "Family", icon: "family", tone: "family" },
    { value: "Goal", icon: "target", tone: "goal" },
    { value: "Bill", icon: "bill", tone: "bill" },
    { value: "Loan", icon: "loan", tone: "loan" },
    { value: "Reminder", icon: "bell", tone: "reminder" }
  ];

  const TEXT = {
    km: {
      titlePh: "ឧ. ជួបម៉ាក់ ស្អែក ម៉ោង 9 ព្រឹក",
      smartHint: "សរសេរធម្មតា — ខ្ញុំនឹងស្គាល់ថ្ងៃ ម៉ោង និងប្រភេទដោយស្វ័យប្រវត្តិ",
      detected: "បានស្គាល់",
      when: "នៅពេលណា",
      today: "ថ្ងៃនេះ",
      tomorrow: "ស្អែក",
      dayAfter: "ខានស្អែក",
      nextWeek: "សប្តាហ៍ក្រោយ",
      allDay: "ពេញមួយថ្ងៃ",
      morning: "ព្រឹក",
      afternoon: "រសៀល",
      evening: "ល្ងាច",
      pickTime: "ម៉ោងផ្សេង",
      type: "ប្រភេទ",
      who: "សមាជិកគ្រួសារ",
      nobody: "គ្មាន",
      telegram: "ជូនដំណឹងតាម Telegram",
      willSend: "នឹងផ្ញើ {when}",
      sendIn: "ក្នុង {rel}ទៀត",
      sendNow: "នឹងផ្ញើក្នុងមួយនាទីនេះ",
      past: "ពេលនេះកន្លងផុតហើយ — នឹងមិនផ្ញើទេ",
      pickTimeToAlert: "ជ្រើសម៉ោង ដើម្បីទទួលការជូនដំណឹងថ្ងៃនេះ",
      off: "បិទ — មិនផ្ញើទៅ Telegram ទេ",
      allDayNote: "(ព្រឹត្តិការណ៍ពេញមួយថ្ងៃ ផ្ញើម៉ោង 9 ព្រឹក)",
      notes: "កំណត់ចំណាំ",
      addNotes: "បន្ថែមកំណត់ចំណាំ",
      notesPh: "ទីកន្លែង អ្វីដែលត្រូវយក ឬព័ត៌មានបន្ថែម…",
      at: "ម៉ោង",
      min: "នាទី",
      hour: "ម៉ោង",
      day: "ថ្ងៃ",
      shortcut: "Ctrl + Enter ដើម្បីរក្សាទុក",
      before: "រំលឹកមុន",
      onTime: "ដល់ម៉ោង",
      plusEarly: "+ មុន {rel}"
    },
    en: {
      titlePh: "e.g. Lunch with Mom tomorrow 12pm",
      smartHint: "Type naturally — date, time and type are picked up automatically",
      detected: "Picked up",
      when: "When",
      today: "Today",
      tomorrow: "Tomorrow",
      dayAfter: "In 2 days",
      nextWeek: "Next week",
      allDay: "All day",
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      pickTime: "Other time",
      type: "Type",
      who: "Family member",
      nobody: "None",
      telegram: "Telegram alert",
      willSend: "Sends {when}",
      sendIn: "in {rel}",
      sendNow: "Sends within a minute",
      past: "This time has passed — it won't be sent",
      pickTimeToAlert: "Pick a time to get an alert today",
      off: "Off — nothing goes to Telegram",
      allDayNote: "(all-day events alert at 9:00 AM)",
      notes: "Notes",
      addNotes: "Add notes",
      notesPh: "Place, what to bring, extra details…",
      at: "at",
      min: "min",
      hour: "h",
      day: "d",
      shortcut: "Ctrl + Enter to save",
      before: "Also remind me",
      onTime: "On time",
      plusEarly: "+ {rel} before"
    }
  };

  const KM_DAYS = ["អាទិត្យ", "ចន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const EN_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const LOOKBACK_MS = 30 * 60 * 1000; // matches api/dispatch.js
  const BEFORE_OPTIONS = [0, 10, 30, 60, 1440];

  const KEYWORDS = [
    { category: "Family", re: /ថ្ងៃកំណើត|ខួប|birthday|anniversary|bday|គ្រួសារ|family/i },
    { category: "Bill", re: /វិក្កយបត្រ|បង់ថ្លៃ|ថ្លៃទឹក|ថ្លៃភ្លើង|អ៊ីនធឺណិត|bill|invoice|rent|electric|water bill|internet/i },
    { category: "Loan", re: /កម្ចី|បង់ធនាគារ|loan|installment|mortgage/i },
    { category: "Goal", re: /គោលដៅ|goal|target/i },
    { category: "Reminder", re: /រំលឹក|remind/i }
  ];

  let state = null;

  const lang = () => (typeof currentLang === "function" && currentLang() === "km" ? "km" : "en");
  const L = (key, values = {}) => (TEXT[lang()][key] || TEXT.en[key] || key).replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m));
  const icon = name => (Icons[name] ? Icons[name]() : "");
  const esc = value => escapeHtml(value);

  function todayInput() {
    return typeof localDateInput === "function" ? localDateInput() : new Date().toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dateFromInput(iso, time = "00:00") {
    const [y, m, d] = String(iso).split("-").map(Number);
    const [hh, mm] = String(time || "00:00").split(":").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  }

  function friendlyDate(iso) {
    if (!iso) return "";
    const today = todayInput();
    const date = dateFromInput(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const rel = iso === today ? L("today") : iso === addDays(today, 1) ? L("tomorrow") : iso === addDays(today, -1) ? (lang() === "km" ? "ម្សិលមិញ" : "Yesterday") : "";
    const full = lang() === "km"
      ? `ថ្ងៃ${KM_DAYS[date.getDay()]} ${date.getDate()} ${KM_MONTHS[date.getMonth()]}`
      : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    return rel ? `${rel} · ${full}` : full;
  }

  function friendlyTime(time) {
    if (!time) return L("allDay");
    const [h, m] = time.split(":").map(Number);
    if (lang() === "km") {
      const period = h < 12 ? L("morning") : h < 17 ? L("afternoon") : L("evening");
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, "0")} ${period}`;
    }
    return dateFromInput("2000-01-01", time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function beforeLabel(minutes) {
    if (!minutes) return L("onTime");
    if (minutes >= 1440) return `${minutes / 1440} ${L("day")}`;
    if (minutes >= 60) return `${minutes / 60} ${L("hour")}`;
    return `${minutes} ${L("min")}`;
  }

  function relative(ms) {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes} ${L("min")}`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} ${L("hour")}`;
    return `${Math.round(hours / 24)} ${L("day")}`;
  }

  /* ---------- smart title parsing ---------- */
  function normalizeDigits(text) {
    return String(text || "").replace(/[០-៩]/g, ch => String("០១២៣៤៥៦៧៨៩".indexOf(ch)));
  }

  function to24(hour, minute, marker) {
    let h = Number(hour);
    const m = Number(minute || 0);
    if (h > 23 || m > 59) return "";
    const mk = String(marker || "").toLowerCase();
    if (/pm|រសៀល|ល្ងាច|យប់/.test(mk) && h < 12) h += 12;
    if (/am|ព្រឹក/.test(mk) && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function parseSmart(raw) {
    const text = normalizeDigits(raw);
    const found = {};
    const marker = "(am|pm|a\\.m\\.|p\\.m\\.|ព្រឹក|រសៀល|ល្ងាច|យប់)?";

    let match = text.match(new RegExp(`(\\d{1,2}):(\\d{2})\\s*${marker}`, "i"))
      || text.match(new RegExp(`ម៉ោង\\s*(\\d{1,2})(?:\\s*(?:និង|:)\\s*(\\d{1,2}))?\\s*${marker}`, "i"))
      || text.match(/\b(\d{1,2})()\s*(am|pm)\b/i);
    if (match) {
      const time = to24(match[1], match[2], match[3]);
      if (time) found.time = time;
    }

    const today = todayInput();
    if (/ខានស្អែក|day after tomorrow/i.test(text)) found.date = addDays(today, 2);
    else if (/ស្អែក|tomorrow|tmr/i.test(text)) found.date = addDays(today, 1);
    else if (/ថ្ងៃនេះ|today|tonight|យប់នេះ|ល្ងាចនេះ/i.test(text)) found.date = today;
    else if (/សប្តាហ៍ក្រោយ|សប្ដាហ៍ក្រោយ|next week/i.test(text)) found.date = addDays(today, 7);
    else {
      const todayIndex = dateFromInput(today).getDay();
      let dayIndex = KM_DAYS.findIndex(day => text.includes(`ថ្ងៃ${day}`));
      if (dayIndex < 0) dayIndex = EN_DAYS.findIndex(day => new RegExp(`\\b${day}\\b`, "i").test(text));
      if (dayIndex >= 0) found.date = addDays(today, ((dayIndex - todayIndex + 7) % 7) || 7);
    }

    const keyword = KEYWORDS.find(item => item.re.test(text));
    if (keyword) found.category = keyword.category;

    const member = (appData.family || []).find(person => person.name && person.name.trim().length >= 2 && text.toLowerCase().includes(person.name.trim().toLowerCase()));
    if (member) {
      found.familyMember = member.name;
      if (!found.category) found.category = "Family";
    }
    return found;
  }

  /* ---------- markup ---------- */
  function chipsHtml() {
    const today = todayInput();
    const dates = [
      [today, L("today")],
      [addDays(today, 1), L("tomorrow")],
      [addDays(today, 2), L("dayAfter")],
      [addDays(today, 7), L("nextWeek")]
    ];
    const times = [["", L("allDay")], ["08:00", friendlyTime("08:00")], ["12:00", friendlyTime("12:00")], ["18:00", friendlyTime("18:00")]];
    return {
      dates: dates.map(([value, label]) => `<button type="button" class="ev-chip" data-ev-date="${value}">${esc(label)}</button>`).join(""),
      times: times.map(([value, label]) => `<button type="button" class="ev-chip" data-ev-time="${value}">${esc(label)}</button>`).join("")
    };
  }

  function categoriesHtml(selected) {
    return CATEGORIES.map(cat => `
      <label class="ev-cat ev-tone-${cat.tone}">
        <input type="radio" name="category" value="${cat.value}" ${cat.value === selected ? "checked" : ""}>
        <i class="ev-cat-icon">${icon(cat.icon)}</i>
        <b>${esc(optionLabel(cat.value))}</b>
      </label>`).join("");
  }

  function membersHtml(selected) {
    const people = (appData.family || []).filter(person => person.name);
    const none = `<label class="ev-person"><input type="radio" name="familyMember" value="" ${!selected ? "checked" : ""}><i class="ev-avatar ev-avatar-none">–</i><b>${esc(L("nobody"))}</b></label>`;
    return none + people.map(person => {
      const initial = esc(person.name.trim().charAt(0).toUpperCase());
      const avatar = person.photo ? `<i class="ev-avatar"><img src="${escapeAttr(person.photo)}" alt=""></i>` : `<i class="ev-avatar">${initial}</i>`;
      return `<label class="ev-person"><input type="radio" name="familyMember" value="${escapeAttr(person.name)}" ${person.name === selected ? "checked" : ""}>${avatar}<b>${esc(person.name)}</b></label>`;
    }).join("");
  }

  function render(event) {
    const chips = chipsHtml();
    const hasFamily = (appData.family || []).some(person => person.name);
    const reminderOn = event.reminder ?? true;
    const notes = event.notes || "";
    return `
      <form class="modal glass-card event-modal" id="modalForm" novalidate>
        <div class="ev-head">
          <div class="ev-head-icon">${icon("calendar")}</div>
          <h2 class="section-title">${event.id ? t("editEvent") : t("addEvent")}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>

        <div class="ev-title-wrap">
          <input class="ev-title" id="title" name="title" type="text" autocomplete="off" placeholder="${escapeAttr(L("titlePh"))}" value="${escapeAttr(event.title || "")}">
          <div class="ev-smart" data-ev-smart><i>${icon("spark")}</i><em data-ev-smart-text>${esc(L("smartHint"))}</em></div>
          <div class="field-error" data-error="title"></div>
        </div>

        <section class="ev-section">
          <div class="ev-label">${icon("calendar")}<strong>${esc(L("when"))}</strong><em class="ev-summary" data-ev-when></em></div>
          <div class="ev-row">${chips.dates}<input class="ev-date" id="date" name="date" type="date" value="${escapeAttr(event.date || todayInput())}" aria-label="${escapeAttr(t("date"))}"></div>
          <div class="ev-row">${chips.times}<input class="ev-time" id="time" name="time" type="time" value="${escapeAttr(event.time || "")}" aria-label="${escapeAttr(t("time"))}" title="${escapeAttr(L("pickTime"))}"></div>
          <div class="field-error" data-error="date"></div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${icon("spark")}<strong>${esc(L("type"))}</strong></div>
          <div class="ev-cats">${categoriesHtml(event.category || "Personal")}</div>
        </section>

        ${hasFamily ? `
        <section class="ev-section" data-ev-members ${event.category === "Family" || event.familyMember ? "" : "hidden"}>
          <div class="ev-label">${icon("family")}<strong>${esc(L("who"))}</strong></div>
          <div class="ev-people">${membersHtml(event.familyMember || "")}</div>
        </section>` : `<input type="hidden" name="familyMember" value="${escapeAttr(event.familyMember || "")}">`}

        <div class="ev-tg-wrap">
        <label class="ev-telegram">
          <i class="ev-tg-icon"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1.1-1 .2-1.5L20.5 2.8c.9-.3 1.6.2 1.4 1.5Z"/></svg></i>
          <div class="ev-tg-text"><strong>${esc(L("telegram"))}</strong><em data-ev-alert></em></div>
          <input type="checkbox" id="reminder" name="reminder" class="ev-switch" ${reminderOn ? "checked" : ""}>
        </label>
        <div class="ev-before" data-ev-before ${reminderOn ? "" : "hidden"}>
          <span>${esc(L("before"))}</span>
          ${BEFORE_OPTIONS.map(minutes => `<label class="ev-before-chip"><input type="radio" name="remindBefore" value="${minutes}" ${Number(event.remindBefore || 0) === minutes ? "checked" : ""}><b>${esc(beforeLabel(minutes))}</b></label>`).join("")}
        </div>
        </div>

        <details class="ev-notes" ${notes ? "open" : ""}>
          <summary>${icon("edit")}<strong>${esc(notes ? L("notes") : L("addNotes"))}</strong></summary>
          <textarea id="notes" name="notes" rows="3" placeholder="${escapeAttr(L("notesPh"))}">${esc(notes)}</textarea>
        </details>

        <div class="ev-foot">
          <small class="ev-shortcut">${esc(L("shortcut"))}</small>
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit">${icon("check")}${event.id ? t("saveEvent") : t("addEvent")}</button>
        </div>
      </form>`;
  }

  /* ---------- behaviour ---------- */
  function syncUi(root) {
    const form = root.querySelector("#modalForm");
    const date = form.elements.date.value;
    const time = form.elements.time.value;
    const category = form.querySelector('input[name="category"]:checked')?.value || "Personal";

    root.querySelectorAll("[data-ev-date]").forEach(chip => chip.classList.toggle("active", chip.dataset.evDate === date));
    root.querySelectorAll("[data-ev-time]").forEach(chip => chip.classList.toggle("active", chip.dataset.evTime === time));
    form.elements.time.classList.toggle("has-value", Boolean(time) && !["08:00", "12:00", "18:00"].includes(time));
    const whenEl = root.querySelector("[data-ev-when]");
    if (whenEl) whenEl.textContent = date ? `${friendlyDate(date)} · ${friendlyTime(time)}` : "";

    const members = root.querySelector("[data-ev-members]");
    if (members) {
      const chosen = form.querySelector('input[name="familyMember"]:checked')?.value;
      members.hidden = !(category === "Family" || chosen);
    }

    const alertEl = root.querySelector("[data-ev-alert]");
    const tg = root.querySelector(".ev-telegram");
    const on = form.elements.reminder.checked;
    const beforeBox = root.querySelector("[data-ev-before]");
    if (beforeBox) beforeBox.hidden = !on;
    const before = Number(form.querySelector('input[name="remindBefore"]:checked')?.value || 0);
    let message;
    let tone = "ok";
    if (!on) {
      message = L("off");
      tone = "off";
    } else if (!date) {
      message = "";
    } else {
      const fireAt = dateFromInput(date, time || "09:00");
      const diff = fireAt.getTime() - Date.now();
      const when = `${friendlyDate(date)} ${L("at")} ${friendlyTime(time || "09:00")}`;
      if (diff < -LOOKBACK_MS && !time && date === todayInput()) {
        message = L("pickTimeToAlert");
        tone = "warn";
      } else if (diff < -LOOKBACK_MS) {
        message = L("past");
        tone = "warn";
      } else if (diff <= 60000) {
        message = L("sendNow");
      } else {
        message = `${L("willSend", { when })} · ${L("sendIn", { rel: relative(diff) })}${time ? "" : ` ${L("allDayNote")}`}`;
      }
      if (before && diff - before * 60000 > -LOOKBACK_MS) message += ` ${L("plusEarly", { rel: beforeLabel(before) })}`;
    }
    if (alertEl) alertEl.textContent = message;
    tg?.setAttribute("data-tone", tone);
  }

  function applySmart(root) {
    const form = root.querySelector("#modalForm");
    const found = parseSmart(form.elements.title.value);
    const applied = [];

    if (found.date && !state.touched.has("date") && form.elements.date.value !== found.date) {
      form.elements.date.value = found.date;
      flash(form.elements.date);
    }
    if (found.date && !state.touched.has("date")) applied.push(friendlyDate(found.date).split(" · ")[0]);

    if (found.time && !state.touched.has("time")) {
      if (form.elements.time.value !== found.time) flash(form.elements.time);
      form.elements.time.value = found.time;
      applied.push(friendlyTime(found.time));
    }
    if (found.category && !state.touched.has("category")) {
      const radio = form.querySelector(`input[name="category"][value="${found.category}"]`);
      if (radio && !radio.checked) {
        radio.checked = true;
        flash(radio.closest("label"));
      }
      applied.push(optionLabel(found.category));
    }
    if (found.familyMember && !state.touched.has("familyMember")) {
      const radio = [...form.querySelectorAll('input[name="familyMember"]')].find(input => input.value === found.familyMember);
      if (radio && !radio.checked) {
        radio.checked = true;
        flash(radio.closest("label"));
      }
      if (radio) applied.push(found.familyMember);
    }

    const smart = root.querySelector("[data-ev-smart]");
    const smartText = root.querySelector("[data-ev-smart-text]");
    if (applied.length) {
      smart.classList.add("is-found");
      smartText.textContent = `${L("detected")}: ${applied.join(" · ")}`;
    } else {
      smart.classList.remove("is-found");
      smartText.textContent = L("smartHint");
    }
    syncUi(root);
  }

  function flash(el) {
    if (!el) return;
    el.classList.remove("ev-flash");
    void el.offsetWidth;
    el.classList.add("ev-flash");
  }

  function open(event = {}) {
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = render(event);
    root.classList.add("open");

    // When editing, keep what the user saved; only auto-fill on new events.
    state = { touched: new Set(event.id ? ["date", "time", "category", "familyMember"] : []) };
    if (event.date) state.touched.add("date");
    if (event.time) state.touched.add("time");
    if (event.category) state.touched.add("category");
    if (event.familyMember) state.touched.add("familyMember");

    const form = root.querySelector("#modalForm");
    Modal.escapeHandler = e => {
      if (e.key === "Escape") Modal.close();
    };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));

    let smartTimer;
    form.elements.title.addEventListener("input", () => {
      root.querySelector('[data-error="title"]').textContent = "";
      clearTimeout(smartTimer);
      smartTimer = setTimeout(() => applySmart(root), 220);
    });

    root.querySelectorAll("[data-ev-date]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.date.value = chip.dataset.evDate;
      state.touched.add("date");
      syncUi(root);
    }));
    root.querySelectorAll("[data-ev-time]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.time.value = chip.dataset.evTime;
      state.touched.add("time");
      syncUi(root);
    }));
    form.elements.date.addEventListener("change", () => { state.touched.add("date"); syncUi(root); });
    form.elements.time.addEventListener("input", () => { state.touched.add("time"); syncUi(root); });
    form.querySelectorAll('input[name="category"]').forEach(input => input.addEventListener("change", () => { state.touched.add("category"); syncUi(root); }));
    form.querySelectorAll('input[name="familyMember"]').forEach(input => input.addEventListener("change", () => { state.touched.add("familyMember"); syncUi(root); }));
    form.elements.reminder.addEventListener("change", () => syncUi(root));
    form.querySelectorAll('input[name="remindBefore"]').forEach(input => input.addEventListener("change", () => syncUi(root)));

    const details = root.querySelector(".ev-notes");
    details.addEventListener("toggle", () => {
      if (details.open) setTimeout(() => form.elements.notes.focus(), 30);
    });

    form.addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      const data = {
        title: form.elements.title.value.trim(),
        date: form.elements.date.value,
        time: form.elements.time.value,
        category: form.querySelector('input[name="category"]:checked')?.value || "Personal",
        familyMember: form.querySelector('input[name="familyMember"]:checked')?.value ?? form.elements.familyMember?.value ?? "",
        reminder: form.elements.reminder.checked,
        remindBefore: form.elements.reminder.checked ? Number(form.querySelector('input[name="remindBefore"]:checked')?.value || 0) : 0,
        notes: form.elements.notes.value.trim()
      };
      let invalid = false;
      if (!data.title) {
        root.querySelector('[data-error="title"]').textContent = t("required");
        form.elements.title.focus();
        invalid = true;
      }
      if (!data.date) {
        root.querySelector('[data-error="date"]').textContent = t("required");
        invalid = true;
      }
      if (invalid) return;

      if (event.id) Store.edit("calendarEvents", event.id, data);
      else Store.add("calendarEvents", data);
      Toast.show(event.id ? t("eventSaved") : t("eventAdded"));
      Modal.close();
    });

    syncUi(root);
    if (!event.id) setTimeout(() => form.elements.title.focus(), 60);
  }

  return { open, parseSmart };
})();
