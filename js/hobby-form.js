/* MYLIFE hobby form — same style as the event / expense / memory forms.
 * Smart title ("Gym 45 នាទី" → Health + 45 min), favourite hobbies one tap
 * away, streak for the hobby, big duration stepper, category tiles, mood
 * pills with icons, and "remind me next time" which adds a reminder that
 * the Telegram bot sends (with the Done button). Saves the same fields:
 * title, date, minutes, category, mood, notes. */
const HobbyForm = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const svg = paths => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5a5.5 5.5 0 0 0-10 3.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    family: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    calm: '<circle cx="12" cy="12" r="9"/><path d="M8 15h8"/><path d="M8 10c.5-.7 1.2-1 2-1M14 9c.8 0 1.5.3 2 1"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    tired: '<circle cx="12" cy="12" r="9"/><path d="M8 16c1-1 2.5-1.5 4-1.5s3 .5 4 1.5"/><path d="M8 10h2M14 10h2"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1L12 2z"/>',
    stress: '<circle cx="12" cy="12" r="9"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><path d="M8 9l2 1M16 9l-2 1"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>'
  };
  const icon = name => svg(ICON[name] || ICON.star);

  const CATS = [
    { value: "Work", icon: "briefcase", tone: "#3f86d6", re: /ការងារ|work|meeting|project|code|coding|office/i },
    { value: "Personal", icon: "user", tone: "#8b5cf6", re: /ផ្ទាល់ខ្លួន|game|ហ្គេម|movie|កុន|music|តន្ត្រី|ហ្គីតា|guitar|draw|គូរ|photo|ថតរូប|cook|ចម្អិន|garden|ដាំ/i },
    { value: "Love", icon: "heart", tone: "#d6457a", re: /ស្នេហា|love|date|ណាត់|សង្សារ/i },
    { value: "Family", icon: "family", tone: "#ff6fa5", re: /គ្រួសារ|family|kids|កូន|ម៉ាក់|ប៉ា/i },
    { value: "Health", icon: "pulse", tone: "#22c55e", re: /សុខភាព|gym|run|រត់|walk|ដើរ|yoga|យូហ្គា|swim|ហែល|bike|កង់|football|បាល់|sport|កីឡា|workout|ហាត់|meditat|សមាធិ|sleep|គេង/i },
    { value: "Learning", icon: "book", tone: "#f59e0b", re: /រៀន|learn|study|read|អាន|សៀវភៅ|book|course|english|អង់គ្លេស|class|ថ្នាក់/i }
  ];
  const MOODS = [
    { key: "moodHappy", km: "សប្បាយ", en: "Happy", icon: "smile", tone: "#f59e0b" },
    { key: "moodCalm", km: "ស្ងប់", en: "Calm", icon: "calm", tone: "#3f86d6" },
    { km: "មានថាមពល", en: "Energized", icon: "zap", tone: "#22c55e" },
    { km: "ពេញចិត្ត", en: "Proud", icon: "star", tone: "#8b5cf6" },
    { key: "moodTired", km: "ហត់", en: "Tired", icon: "tired", tone: "#94a3b8" },
    { key: "moodStressed", km: "តានតឹង", en: "Stressed", icon: "stress", tone: "#ef4444" }
  ];
  const MINUTE_CHIPS = [15, 30, 45, 60, 90, 120];
  const catLabel = value => t(value.toLowerCase()) || value;
  const moodLabel = mood => (mood.key && t(mood.key) && t(mood.key) !== mood.key ? t(mood.key) : km() ? mood.km : mood.en);
  const fmtMin = m => {
    const n = Number(m) || 0;
    if (!n) return L("—", "—");
    if (n < 60) return L(`${n} នាទី`, `${n} min`);
    const h = Math.floor(n / 60), r = n % 60;
    return r ? L(`${h} ម៉ោង ${r} នាទី`, `${h} h ${r} min`) : L(`${h} ម៉ោង`, `${h} h`);
  };

  let state = null;

  function shift(days, from) {
    const date = from ? new Date(`${from}T12:00:00`) : new Date();
    date.setDate(date.getDate() + days);
    return localDateInput(date);
  }

  // Most-logged hobbies with their usual category and length.
  function favourites() {
    const map = new Map();
    appData.hobbyLogs.forEach(item => {
      const title = String(item.title || "").trim();
      if (!title) return;
      const key = title.toLowerCase();
      const entry = map.get(key) || { title, count: 0, minutes: [], category: item.category, last: "" };
      entry.count += 1;
      if (Number(item.minutes)) entry.minutes.push(Number(item.minutes));
      if (String(item.date || "") >= entry.last) {
        entry.last = String(item.date || "");
        entry.category = item.category || entry.category;
        entry.title = title;
      }
      map.set(key, entry);
    });
    return [...map.values()]
      .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
      .slice(0, 6)
      .map(entry => {
        const sorted = entry.minutes.sort((a, b) => a - b);
        return { ...entry, usual: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0 };
      });
  }

  // Days in a row (ending today or yesterday) this hobby was logged + total this week.
  function stats(title, excludeId) {
    const key = String(title || "").trim().toLowerCase();
    if (!key) return null;
    const logs = appData.hobbyLogs.filter(item => item.id !== excludeId && String(item.title || "").trim().toLowerCase() === key);
    if (!logs.length) return null;
    const days = new Set(logs.map(item => item.date));
    let streak = 0;
    let day = days.has(shift(0)) ? shift(0) : shift(-1);
    while (days.has(day)) {
      streak += 1;
      day = shift(-1, day);
    }
    const weekStart = shift(-6);
    const weekMinutes = logs.filter(item => item.date >= weekStart).reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
    return { streak, times: logs.length, weekMinutes };
  }

  function render(hobby) {
    const isEdit = Boolean(hobby.id);
    const favs = favourites();
    const category = hobby.category || "Personal";
    const moodNow = String(hobby.mood || "").trim().toLowerCase();
    const knownMood = MOODS.some(m => [m.km, m.en, moodLabel(m)].some(v => v.toLowerCase() === moodNow));
    const dateChips = [[shift(0), L("ថ្ងៃនេះ", "Today")], [shift(-1), L("ម្សិលមិញ", "Yesterday")]];
    const remindChips = [[shift(1), L("ស្អែក", "Tomorrow")], [shift(3), L("3 ថ្ងៃទៀត", "In 3 days")], [shift(7), L("1 សប្តាហ៍", "1 week")]];
    const now = new Date();
    const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${now.getMinutes() < 30 ? "00" : "30"}`;
    return `
      <form class="modal glass-card event-modal hobby-form-modal" id="modalForm" novalidate>
        <div class="ev-head">
          <div class="ev-head-icon">${Icons.spark()}</div>
          <h2 class="section-title">${isEdit ? t("editHobby") : t("recordHobbyTitle")}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>

        ${favs.length && !isEdit ? `<div class="hf-favs">${favs.map(fav => `<button type="button" class="hf-fav" data-hf-fav="${escapeAttr(fav.title)}" data-cat="${escapeAttr(fav.category || "")}" data-min="${fav.usual || ""}"><b>${escapeHtml(fav.title)}</b><small>${fav.usual ? escapeHtml(fmtMin(fav.usual)) : L(`${fav.count} ដង`, `${fav.count}×`)}</small></button>`).join("")}</div>` : ""}

        <div class="ev-title-wrap">
          <input class="ev-title" id="title" name="title" type="text" autocomplete="off" placeholder="${escapeAttr(L("ឧ. ហាត់ប្រាណ 45 នាទី, អានសៀវភៅ 1 ម៉ោង", "e.g. Gym 45 min, Read a book 1h"))}" value="${escapeAttr(hobby.title || "")}">
          <div class="ev-smart" data-hf-smart><i>${Icons.spark()}</i><em data-hf-smart-text>${escapeHtml(L("សរសេរ — ខ្ញុំនឹងស្គាល់រយៈពេល និងប្រភេទឱ្យ", "Type it — the length and category are picked for you"))}</em></div>
          <div class="field-error" data-error="title"></div>
        </div>

        <div class="hf-streak" data-hf-streak hidden></div>

        <section class="ev-section">
          <div class="ev-label">${icon("clock")}<strong>${escapeHtml(L("រយៈពេល", "How long"))}</strong><em class="ev-summary" data-hf-when></em></div>
          <div class="hf-duration">
            <button type="button" class="hf-step" data-hf-step="-15" aria-label="-15">${icon("minus")}</button>
            <div class="hf-big"><input id="minutes" name="minutes" type="number" inputmode="numeric" min="0" step="5" placeholder="0" value="${escapeAttr(hobby.minutes || "")}"><span>${escapeHtml(L("នាទី", "min"))}</span></div>
            <button type="button" class="hf-step" data-hf-step="15" aria-label="+15">${icon("plus")}</button>
          </div>
          <div class="ev-row hf-min-row">${MINUTE_CHIPS.map(m => `<button type="button" class="ev-chip" data-hf-min="${m}">${escapeHtml(fmtMin(m))}</button>`).join("")}</div>
          <div class="ev-row">${dateChips.map(([value, label]) => `<button type="button" class="ev-chip" data-hf-date="${value}">${escapeHtml(label)}</button>`).join("")}<input class="ev-date" id="date" name="date" type="date" value="${escapeAttr(hobby.date || localDateInput())}"></div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.spark()}<strong>${escapeHtml(t("category"))}</strong></div>
          <div class="ev-cats hf-cats">${CATS.map(cat => `<label class="ev-cat" style="--tone:${cat.tone};--tone-bg:color-mix(in srgb, ${cat.tone} 15%, #ffffff)"><input type="radio" name="category" value="${cat.value}" ${cat.value === category ? "checked" : ""}><i class="ev-cat-icon">${icon(cat.icon)}</i><b>${escapeHtml(catLabel(cat.value))}</b></label>`).join("")}</div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${icon("smile")}<strong>${escapeHtml(t("moodAfter"))}</strong></div>
          <div class="hf-moods">${MOODS.map(mood => `<label class="hf-mood" style="--tone:${mood.tone}"><input type="radio" name="hfMood" value="${escapeAttr(moodLabel(mood))}" ${moodNow && [mood.km, mood.en, moodLabel(mood)].some(v => v.toLowerCase() === moodNow) ? "checked" : ""}><i>${icon(mood.icon)}</i><b>${escapeHtml(moodLabel(mood))}</b></label>`).join("")}</div>
          ${moodNow && !knownMood ? `<input type="hidden" name="hfMoodOld" value="${escapeAttr(hobby.mood)}">` : ""}
        </section>

        ${isEdit ? "" : `<div class="ev-tg-wrap hf-tg">
          <label class="ev-telegram" data-tone="off">
            <i class="ev-tg-icon"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1.1-1 .2-1.5L20.5 2.8c.9-.3 1.6.2 1.4 1.5Z"/></svg></i>
            <div class="ev-tg-text"><strong>${escapeHtml(L("រំលឹកពេលក្រោយតាម Telegram", "Remind me next time on Telegram"))}</strong><em data-hf-remind-note></em></div>
            <input type="checkbox" id="hfRemindOn" class="ev-switch">
          </label>
          <div class="ev-before" data-hf-before hidden>
            <span>${escapeHtml(L("ពេល", "When"))}</span>
            ${remindChips.map(([value, label], i) => `<label class="ev-before-chip"><input type="radio" name="hfRemindDay" value="${value}" ${i === 0 ? "checked" : ""}><b>${escapeHtml(label)}</b></label>`).join("")}
            <input class="hf-remind-time" id="hfRemindTime" type="time" value="${defaultTime}">
          </div>
        </div>`}

        <details class="ev-notes" ${hobby.notes ? "open" : ""}>
          <summary>${icon("note")}<strong>${escapeHtml(t("notes"))}</strong></summary>
          <textarea id="notes" name="notes" rows="3" placeholder="${escapeAttr(L("អ្វីដែលបានធ្វើ ឬរៀនថ្ងៃនេះ…", "What you did or learned…"))}">${escapeHtml(hobby.notes || "")}</textarea>
        </details>

        <div class="ev-foot">
          <small class="ev-shortcut">${escapeHtml(L("Ctrl + Enter ដើម្បីរក្សាទុក", "Ctrl + Enter to save"))}</small>
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit">${Icons.check()}${isEdit ? t("saveRecord") : t("recordHobby")}</button>
        </div>
      </form>`;
  }

  function sync(root) {
    const form = root.querySelector("#modalForm");
    const minutes = Number(form.elements.minutes.value) || 0;
    const date = form.elements.date.value;
    root.querySelectorAll("[data-hf-min]").forEach(chip => chip.classList.toggle("active", Number(chip.dataset.hfMin) === minutes));
    root.querySelectorAll("[data-hf-date]").forEach(chip => chip.classList.toggle("active", chip.dataset.hfDate === date));
    const when = root.querySelector("[data-hf-when]");
    if (when) when.textContent = [minutes ? fmtMin(minutes) : "", date ? formatDate(date) : ""].filter(Boolean).join(" · ");

    const remindOn = root.querySelector("#hfRemindOn");
    if (remindOn) {
      state.remind = remindOn.checked ? (form.querySelector('input[name="hfRemindDay"]:checked')?.value || "") : "";
      root.querySelector("[data-hf-before]").hidden = !remindOn.checked;
      const timeInput = root.querySelector("#hfRemindTime");
      root.querySelector(".hf-tg .ev-telegram").dataset.tone = state.remind ? "ok" : "off";
      root.querySelector("[data-hf-remind-note]").textContent = state.remind
        ? L(`ផ្ញើ "${cleanTitle(form.elements.title.value) || "…"}" នៅ ${formatDate(state.remind)} ម៉ោង ${fmtClock(timeInput.value)}`, `Sends "${cleanTitle(form.elements.title.value) || "…"}" on ${formatDate(state.remind)} at ${fmtClock(timeInput.value)}`)
        : L("បើកដើម្បីរំលឹកឱ្យធ្វើម្តងទៀត", "Turn on to get a nudge to do it again");
    }

    const streakBox = root.querySelector("[data-hf-streak]");
    const info = stats(form.elements.title.value, state.hobby.id);
    if (info) {
      const parts = [];
      if (info.streak >= 1) parts.push(`<b>${icon("flame")}${escapeHtml(L(`${info.streak + (date === shift(0) && !state.hobby.id ? 1 : 0)} ថ្ងៃជាប់ៗ`, `${info.streak + (date === shift(0) && !state.hobby.id ? 1 : 0)}-day streak`))}</b>`);
      parts.push(`<span>${escapeHtml(L(`បានធ្វើ ${info.times} ដង`, `Done ${info.times}×`))}</span>`);
      if (info.weekMinutes) parts.push(`<span>${escapeHtml(L(`៧ ថ្ងៃនេះ: ${fmtMin(info.weekMinutes)}`, `Last 7 days: ${fmtMin(info.weekMinutes)}`))}</span>`);
      streakBox.innerHTML = parts.join("");
      streakBox.hidden = false;
    } else {
      streakBox.hidden = true;
    }
  }

  // "Gym 45 នាទី" / "read 1h" / "យូហ្គា 1.5 ម៉ោង" → minutes; keywords → category.
  function parseMinutes(text) {
    const s = String(text).toLowerCase();
    let match = s.match(/(\d+(?:\.\d+)?)\s*(?:ម៉ោង|hours|hour|hrs|hr|h(?![a-z]))(?:\s*(\d+)\s*(?:នាទី|minutes|mins|min|m(?![a-z])))?/);
    if (match) return Math.round(parseFloat(match[1]) * 60 + (Number(match[2]) || 0));
    match = s.match(/(\d+)\s*(?:នាទី|minutes|mins|min|m(?![a-z]))/);
    if (match) return Number(match[1]);
    if (/កន្លះម៉ោង|half an hour|half hour/.test(s)) return 30;
    return 0;
  }

  function smart(root) {
    const form = root.querySelector("#modalForm");
    const text = form.elements.title.value;
    const found = [];
    const minutes = parseMinutes(text);
    if (minutes && !state.touched.has("minutes")) {
      form.elements.minutes.value = minutes;
      found.push(fmtMin(minutes));
    }
    if (!state.touched.has("category")) {
      const fav = favourites().find(item => item.title.toLowerCase() === text.trim().toLowerCase());
      const cat = (fav?.category && CATS.find(c => c.value === fav.category)) || CATS.find(c => c.re.test(text));
      if (cat) {
        const radio = form.querySelector(`input[name="category"][value="${cat.value}"]`);
        if (radio) radio.checked = true;
        found.push(catLabel(cat.value));
      }
    }
    const smartBox = root.querySelector("[data-hf-smart]");
    const label = root.querySelector("[data-hf-smart-text]");
    smartBox.classList.toggle("is-found", found.length > 0);
    label.textContent = found.length
      ? `${L("បានស្គាល់", "Picked up")}: ${found.join(" · ")}`
      : L("សរសេរ — ខ្ញុំនឹងស្គាល់រយៈពេល និងប្រភេទឱ្យ", "Type it — the length and category are picked for you");
    sync(root);
  }

  // Removes "45 នាទី" / "1h" from the saved title so the log stays clean.
  function cleanTitle(text) {
    return String(text)
      .replace(/\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|ម៉ោង)(?:\s*\d+\s*(?:m|min|mins|minutes|នាទី))?/gi, "")
      .replace(/\d+\s*(?:minutes|mins|min|m(?![a-z]))/gi, "")
      .replace(/\d+\s*នាទី/g, "")
      .replace(/កន្លះម៉ោង/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() || String(text).trim();
  }

  function open(hobby) {
    hobby = hobby || {};
    state = { hobby, remind: "", touched: new Set(hobby.id ? ["minutes", "category"] : []) };
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = render(hobby);
    root.classList.add("open");
    const form = root.querySelector("#modalForm");
    Modal.escapeHandler = event => {
      if (event.key === "Escape") Modal.close();
    };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));

    let timer;
    form.elements.title.addEventListener("input", () => {
      root.querySelector('[data-error="title"]').textContent = "";
      clearTimeout(timer);
      timer = setTimeout(() => smart(root), 200);
    });
    root.querySelectorAll("[data-hf-fav]").forEach(button => button.addEventListener("click", () => {
      form.elements.title.value = button.dataset.hfFav;
      if (button.dataset.min) form.elements.minutes.value = button.dataset.min;
      const radio = button.dataset.cat && form.querySelector(`input[name="category"][value="${button.dataset.cat}"]`);
      if (radio) radio.checked = true;
      state.touched.add("minutes");
      state.touched.add("category");
      root.querySelectorAll("[data-hf-fav]").forEach(other => other.classList.toggle("active", other === button));
      const smartBox = root.querySelector("[data-hf-smart]");
      smartBox.classList.add("is-found");
      root.querySelector("[data-hf-smart-text]").textContent = L("យកតាមដងមុនៗ — កែបានបើចង់", "Filled from last time — change if you like");
      sync(root);
    }));
    root.querySelectorAll("[data-hf-step]").forEach(button => button.addEventListener("click", () => {
      const next = Math.max(0, (Number(form.elements.minutes.value) || 0) + Number(button.dataset.hfStep));
      form.elements.minutes.value = next || "";
      state.touched.add("minutes");
      sync(root);
    }));
    root.querySelectorAll("[data-hf-min]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.minutes.value = chip.dataset.hfMin;
      state.touched.add("minutes");
      sync(root);
    }));
    form.elements.minutes.addEventListener("input", () => {
      state.touched.add("minutes");
      sync(root);
    });
    root.querySelectorAll("[data-hf-date]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.date.value = chip.dataset.hfDate;
      sync(root);
    }));
    form.elements.date.addEventListener("change", () => sync(root));
    form.querySelectorAll('input[name="category"]').forEach(radio => radio.addEventListener("change", () => state.touched.add("category")));
    // tapping the chosen mood again clears it
    form.querySelectorAll('input[name="hfMood"]').forEach(radio => radio.addEventListener("click", () => {
      if (radio.dataset.was === "1") {
        radio.checked = false;
        radio.dataset.was = "";
      } else {
        form.querySelectorAll('input[name="hfMood"]').forEach(other => (other.dataset.was = ""));
        radio.dataset.was = "1";
      }
    }));
    form.querySelectorAll('input[name="hfMood"]:checked').forEach(radio => (radio.dataset.was = "1"));
    root.querySelector("#hfRemindOn")?.addEventListener("change", () => sync(root));
    form.querySelectorAll('input[name="hfRemindDay"]').forEach(radio => radio.addEventListener("change", () => sync(root)));
    root.querySelector("#hfRemindTime")?.addEventListener("input", () => sync(root));
    const details = root.querySelector(".ev-notes");
    details.addEventListener("toggle", () => {
      if (details.open) setTimeout(() => form.elements.notes.focus(), 30);
    });
    form.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", event => {
      event.preventDefault();
      const raw = form.elements.title.value.trim();
      if (!raw || !form.elements.date.value) {
        root.querySelector('[data-error="title"]').textContent = t("required");
        form.elements.title.focus();
        return;
      }
      form.querySelector(".ev-submit").disabled = true;
      const title = hobby.id ? raw : cleanTitle(raw);
      const minutes = Number(form.elements.minutes.value) || 0;
      const data = {
        title,
        date: form.elements.date.value,
        minutes: minutes ? String(minutes) : "",
        category: form.querySelector('input[name="category"]:checked')?.value || "Personal",
        mood: form.querySelector('input[name="hfMood"]:checked')?.value || form.elements.hfMoodOld?.value || "",
        notes: form.elements.notes.value.trim()
      };
      if (hobby.id) Store.edit("hobbyLogs", hobby.id, data);
      else Store.add("hobbyLogs", data);
      if (!hobby.id && state.remind) {
        const time = root.querySelector("#hfRemindTime")?.value || "";
        Store.add("reminders", { title, date: state.remind, time, category: data.category, notes: data.minutes ? fmtMin(data.minutes) : "", done: false });
      }
      Toast.show(hobby.id ? t("hobbyRecordSaved") : (state.remind ? L("បានកត់ត្រា និងកំណត់ការរំលឹក", "Recorded and reminder set") : t("hobbyRecorded")));
      Modal.close();
    });

    sync(root);
    if (!hobby.id) setTimeout(() => form.elements.title.focus(), 60);
  }

  return { open };
})();
