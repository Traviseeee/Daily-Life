/* MYLIFE goal form — same style as the event / expense / memory / hobby forms.
 * Smart title ("សន្សំ $2000 ទិញម៉ូតូ 1 ឆ្នាំ" → Financial · $2,000 · deadline),
 * category tiles, big target amount with live progress and "save X / month",
 * savings link chips, deadline chips, Telegram card (deadline alert + monthly
 * nudge on the 1st), cover photo and notes. Saves the same goal fields plus
 * goalReminder, remindDaysBefore, monthlyNudge. */
const GoalForm = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const svg = paths => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    family: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    cap: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
    swap: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>'
  };
  const icon = name => svg(ICON[name] || ICON.flag);
  const TG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1.1-1 .2-1.5L20.5 2.8c.9-.3 1.6.2 1.4 1.5Z"/></svg>';

  const CATS = [
    { value: "Personal", icon: "user", tone: "#8b5cf6", re: /ផ្ទាល់ខ្លួន|personal|habit|ទម្លាប់/i },
    { value: "Family", icon: "family", tone: "#ff6fa5", re: /គ្រួសារ|family|កូន|kids|wedding|រៀបការ/i },
    { value: "Financial", icon: "coins", tone: "#22c55e", re: /សន្សំ|save|saving|លុយ|money|fund|invest|វិនិយោគ|debt|បំណុល|ម៉ូតូ|moto|car|ឡាន|phone|ទូរស័ព្ទ|laptop|ទិញ|buy/i },
    { value: "Home", icon: "home", tone: "#f59e0b", re: /ផ្ទះ|house|home|room|បន្ទប់|furniture|ដី|land/i },
    { value: "Travel", icon: "plane", tone: "#3f86d6", re: /ធ្វើដំណើរ|travel|trip|ដើរលេង|japan|korea|ជប៉ុន|កូរ៉េ|សៀមរាប|holiday|vacation|tour/i },
    { value: "Health", icon: "pulse", tone: "#ef4444", re: /សុខភាព|health|gym|run|រត់|weight|ស្រក|ទម្ងន់|kg|marathon|yoga/i },
    { value: "Education", icon: "cap", tone: "#0ea5e9", re: /រៀន|learn|study|course|english|អង់គ្លេស|degree|បរិញ្ញា|ielts|school|សាលា|certificate/i }
  ];
  const catLabel = value => (typeof optionLabel === "function" ? optionLabel(value) : value);
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  let state = null;

  const currency = () => appData.profile.currency || "USD";
  const fmt = value => String(money(Math.round(Number(value) || 0), currency())).replace(/<[^>]*>/g, "");

  function addMonths(months) {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return localDateInput(date);
  }
  function endOfYear() {
    return `${new Date().getFullYear()}-12-31`;
  }
  function monthsUntil(deadline) {
    if (!deadline) return 0;
    const days = (new Date(`${deadline}T00:00:00`) - new Date(`${localDateInput()}T00:00:00`)) / 86400000;
    return days / 30.44;
  }

  // Amount: "$2000", "2000$", "2k", "5 ពាន់", "1.5m", "៛2,000,000"
  function parseAmount(text) {
    const s = String(text).toLowerCase().replace(/(\d),(\d)/g, "$1$2");
    const re = /(\$|៛|usd|khr)?\s*(\d+(?:\.\d+)?)\s*(k(?![a-z])|m(?![a-z])|ពាន់|លាន|\$|៛|usd|khr|ដុល្លារ|រៀល|ខែ|ឆ្នាំ|months?|years?|kg|គីឡូ|ថ្ងៃ|days?|%|x)?/gi;
    for (const m of s.matchAll(re)) {
      const unit = (m[3] || "").toLowerCase();
      if (/^(ខែ|ឆ្នាំ|months?|years?|kg|គីឡូ|ថ្ងៃ|days?|%|x)$/.test(unit)) continue;
      let n = parseFloat(m[2]);
      if (unit === "k" || unit === "ពាន់") n *= 1000;
      if (unit === "m" || unit === "លាន") n *= 1000000;
      const marked = m[1] || unit;
      if (!marked && (n < 50 || /^(19|20)\d\d$/.test(m[2]))) continue;
      return n;
    }
    return 0;
  }

  // Deadline: "1 ឆ្នាំ", "6 ខែ", "6 months", "2 years", "ចុងឆ្នាំ", "end of year", "ធ្នូ 2027", "dec 2027"
  function parseDeadline(text) {
    const s = String(text).toLowerCase();
    let m = s.match(/(\d+)\s*(ខែ|months?|mo\b)/);
    if (m) return addMonths(Number(m[1]));
    m = s.match(/(\d+)\s*(ឆ្នាំ|years?|yr)/);
    if (m && Number(m[1]) < 30) return addMonths(Number(m[1]) * 12);
    if (/ចុងឆ្នាំ|end of (the )?year/.test(s)) return endOfYear();
    if (/ឆ្នាំក្រោយ|next year/.test(s)) return addMonths(12);
    for (let i = 0; i < 12; i++) {
      const re = new RegExp(`(?:${KM_MONTHS[i]}|${EN_MONTHS[i]}[a-z]*)\\s*(\\d{4})?`);
      const found = s.match(re);
      if (found) {
        const now = new Date();
        let year = Number(found[1]) || now.getFullYear();
        if (!found[1] && i < now.getMonth()) year += 1;
        const last = new Date(year, i + 1, 0).getDate();
        return `${year}-${String(i + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
      }
    }
    return "";
  }

  function render(goal, defaultCategory) {
    const isEdit = Boolean(goal.id);
    const category = goal.category || defaultCategory || "Personal";
    const linked = goal.linkedSavingsId || "";
    const reminderOn = isEdit ? goal.goalReminder === true : true;
    const before = Number(goal.remindDaysBefore ?? 7);
    const deadlineChips = [[addMonths(3), L("3 ខែ", "3 months")], [addMonths(6), L("6 ខែ", "6 months")], [addMonths(12), L("1 ឆ្នាំ", "1 year")], [endOfYear(), L("ចុងឆ្នាំ", "Year end")]];
    const targetChips = currency() === "KHR" ? [1000000, 4000000, 20000000, 40000000] : [500, 1000, 5000, 10000];
    return `
      <form class="modal glass-card event-modal goal-form-modal" id="modalForm" novalidate>
        <div class="ev-head">
          <div class="ev-head-icon">${Icons.goal()}</div>
          <h2 class="section-title">${isEdit ? t("editGoal") : t("createGoal")}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>

        <label class="gf-cover" data-gf-cover>
          <input type="file" accept="image/*" name="coverFile">
          <span class="gf-cover-img" data-gf-cover-img></span>
          <span class="gf-cover-empty"><i>${icon("camera")}</i><b>${escapeHtml(L("បន្ថែមរូបក្តីស្រមៃ", "Add a dream photo"))}</b></span>
          <span class="gf-cover-change">${icon("swap")}${escapeHtml(L("ប្តូររូប", "Change"))}</span>
        </label>

        <div class="ev-title-wrap">
          <input class="ev-title" id="name" name="name" type="text" autocomplete="off" placeholder="${escapeAttr(L("ឧ. សន្សំ $2000 ទិញម៉ូតូ ក្នុង 1 ឆ្នាំ", "e.g. Save $2000 for a motorbike in 1 year"))}" value="${escapeAttr(goal.name || "")}">
          <div class="ev-smart" data-gf-smart><i>${Icons.spark()}</i><em data-gf-smart-text>${escapeHtml(L("សរសេរគោលដៅ — ខ្ញុំនឹងស្គាល់ចំនួន ប្រភេទ និងថ្ងៃកំណត់ឱ្យ", "Write your goal — amount, category and deadline are picked for you"))}</em></div>
          <div class="field-error" data-error="name"></div>
        </div>

        <section class="ev-section">
          <div class="ev-label">${icon("flag")}<strong>${escapeHtml(t("category"))}</strong></div>
          <div class="ev-cats gf-cats">${CATS.map(cat => `<label class="ev-cat" style="--tone:${cat.tone};--tone-bg:color-mix(in srgb, ${cat.tone} 15%, #ffffff)"><input type="radio" name="category" value="${cat.value}" ${cat.value === category ? "checked" : ""}><i class="ev-cat-icon">${icon(cat.icon)}</i><b>${escapeHtml(catLabel(cat.value))}</b></label>`).join("")}</div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${icon("coins")}<strong>${escapeHtml(L("ចំនួនលុយ", "Amount"))}</strong><em class="ev-summary">${escapeHtml(L("ទុកទទេ បើមិនមែនគោលដៅលុយ", "Leave empty if it's not about money"))}</em></div>
          <div class="gf-amounts">
            <label class="gf-amount gf-target"><span>${escapeHtml(t("targetAmount"))}</span><div><em>${escapeHtml(currency())}</em><input id="targetAmount" name="targetAmount" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="${escapeAttr(goal.targetAmount || "")}"></div></label>
            <label class="gf-amount"><span>${escapeHtml(t("currentAmount"))}</span><div><em>${escapeHtml(currency())}</em><input id="currentAmount" name="currentAmount" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="${escapeAttr(goal.currentAmount || "")}"></div></label>
          </div>
          <div class="ev-row gf-target-chips">${targetChips.map(value => `<button type="button" class="ev-chip" data-gf-target="${value}">${escapeHtml(fmt(value))}</button>`).join("")}</div>
          <div class="gf-progress" data-gf-progress hidden><div class="gf-bar"><span data-gf-bar></span></div><b data-gf-percent></b></div>
          ${appData.savings.length ? `<div class="gf-link">
            <div class="ev-label gf-sub">${icon("link")}<strong>${escapeHtml(L("ភ្ជាប់ជាមួយការសន្សំ", "Link to savings"))}</strong><em class="ev-summary">${escapeHtml(L("ចំនួនបច្ចុប្បន្ន update ដោយខ្លួនឯង", "Current amount updates itself"))}</em></div>
            <div class="ev-row gf-links">
              <label class="gf-link-chip"><input type="radio" name="linkedSavingsId" value="" ${linked ? "" : "checked"}><b>${escapeHtml(L("មិនភ្ជាប់", "Not linked"))}</b></label>
              ${appData.savings.map(item => `<label class="gf-link-chip"><input type="radio" name="linkedSavingsId" value="${escapeAttr(item.id)}" ${linked === item.id ? "checked" : ""}><b>${escapeHtml(item.name || item.id)}</b><small>${escapeHtml(String(money(item.currentAmount || 0, item.currency)).replace(/<[^>]*>/g, ""))}</small></label>`).join("")}
            </div>
          </div>` : ""}
        </section>

        <section class="ev-section">
          <div class="ev-label">${icon("clock")}<strong>${escapeHtml(t("deadline"))}</strong><em class="ev-summary" data-gf-when></em></div>
          <div class="ev-row gf-deadline-row">${deadlineChips.map(([value, label]) => `<button type="button" class="ev-chip" data-gf-deadline="${value}">${escapeHtml(label)}</button>`).join("")}<input class="ev-date" id="deadline" name="deadline" type="date" value="${escapeAttr(goal.deadline || "")}"></div>
          <div class="gf-pace" data-gf-pace hidden></div>
        </section>

        <div class="ev-tg-wrap gf-tg">
          <label class="ev-telegram">
            <i class="ev-tg-icon">${TG}</i>
            <div class="ev-tg-text"><strong>${escapeHtml(L("ជូនដំណឹងតាម Telegram", "Telegram alert"))}</strong><em data-gf-alert></em></div>
            <input type="checkbox" name="goalReminder" class="ev-switch" ${reminderOn ? "checked" : ""}>
          </label>
          <div class="ev-before" data-gf-before ${reminderOn ? "" : "hidden"}>
            <span>${escapeHtml(L("រំលឹកមុន", "Remind"))}</span>
            ${[[0, L("ថ្ងៃកំណត់", "On the day")], [7, L("1 សប្តាហ៍", "1 week")], [30, L("1 ខែ", "1 month")]].map(([days, label]) => `<label class="ev-before-chip"><input type="radio" name="remindDaysBefore" value="${days}" ${before === days ? "checked" : ""}><b>${escapeHtml(label)}</b></label>`).join("")}
            <label class="ev-before-chip gf-monthly"><input type="checkbox" name="monthlyNudge" ${goal.monthlyNudge === false ? "" : "checked"}><b>${escapeHtml(L("ប្រចាំខែ (ថ្ងៃទី 1)", "Monthly (1st)"))}</b></label>
          </div>
        </div>

        <details class="ev-notes" ${goal.description ? "open" : ""}>
          <summary>${icon("note")}<strong>${escapeHtml(goal.description ? t("description") : L("ហេតុអ្វីគោលដៅនេះសំខាន់?", "Why does this goal matter?"))}</strong></summary>
          <textarea id="description" name="description" rows="3" placeholder="${escapeAttr(L("ហេតុផល ជំហាន ឬសារលើកទឹកចិត្តខ្លួនឯង…", "Your reason, steps or a note to yourself…"))}">${escapeHtml(goal.description || "")}</textarea>
        </details>

        <div class="ev-foot">
          <small class="ev-shortcut">${escapeHtml(L("Ctrl + Enter ដើម្បីរក្សាទុក", "Ctrl + Enter to save"))}</small>
          ${isEdit ? `<button class="icon-button ev-delete" type="button" data-gf-delete aria-label="${escapeAttr(t("deleteGoal"))}" title="${escapeAttr(t("deleteGoal"))}">${Icons.trash()}</button>` : ""}
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit">${Icons.check()}${isEdit ? t("saveGoal") : t("createGoal")}</button>
        </div>
      </form>`;
  }

  function sync(root) {
    const form = root.querySelector("#modalForm");
    const target = Number(form.elements.targetAmount.value) || 0;
    const linkedId = form.querySelector('input[name="linkedSavingsId"]:checked')?.value || "";
    const saving = linkedId && appData.savings.find(item => item.id === linkedId);
    if (saving) form.elements.currentAmount.value = Math.round(toProfileCurrency(saving.currentAmount, saving.currency) * 100) / 100;
    form.elements.currentAmount.readOnly = Boolean(saving);
    form.elements.currentAmount.closest(".gf-amount").classList.toggle("is-linked", Boolean(saving));
    const current = Number(form.elements.currentAmount.value) || 0;
    const deadline = form.elements.deadline.value;

    root.querySelectorAll("[data-gf-target]").forEach(chip => chip.classList.toggle("active", Number(chip.dataset.gfTarget) === target));
    root.querySelectorAll("[data-gf-deadline]").forEach(chip => chip.classList.toggle("active", chip.dataset.gfDeadline === deadline));

    const progress = root.querySelector("[data-gf-progress]");
    progress.hidden = !target;
    if (target) {
      const pct = Math.min(100, Math.round((current / target) * 100));
      root.querySelector("[data-gf-bar]").style.width = `${pct}%`;
      root.querySelector("[data-gf-percent]").textContent = `${pct}%`;
    }

    const months = monthsUntil(deadline);
    const when = root.querySelector("[data-gf-when]");
    when.textContent = deadline ? `${formatDate(deadline)}${months > 0 ? ` · ${months >= 1 ? L(`${Math.round(months)} ខែទៀត`, `${Math.round(months)} mo left`) : L(`${Math.round(months * 30.44)} ថ្ងៃទៀត`, `${Math.round(months * 30.44)} days left`)}` : ""}` : "";

    const pace = root.querySelector("[data-gf-pace]");
    const remaining = target - current;
    let paceText = "";
    let tone = "info";
    if (target && remaining <= 0) {
      paceText = L("🎉 ដល់គោលដៅហើយ!", "🎉 Goal reached!");
      tone = "done";
    } else if (target && deadline && months <= 0) {
      paceText = L(`⏰ ថ្ងៃកំណត់ហួសហើយ — នៅខ្វះ ${fmt(remaining)}`, `⏰ Deadline passed — still need ${fmt(remaining)}`);
      tone = "late";
    } else if (target && deadline) {
      const perMonth = remaining / Math.max(1, months);
      const perWeek = remaining / Math.max(1, months * 4.345);
      paceText = L(`💡 ត្រូវសន្សំ ${fmt(perMonth)}/ខែ (≈ ${fmt(perWeek)}/សប្តាហ៍) ដើម្បីទាន់ពេល`, `💡 Save ${fmt(perMonth)}/month (≈ ${fmt(perWeek)}/week) to make it`);
    } else if (target) {
      paceText = L("📅 ដាក់ថ្ងៃកំណត់ ដើម្បីដឹងថាត្រូវសន្សំប៉ុន្មានក្នុងមួយខែ", "📅 Add a deadline to see how much to save each month");
    }
    pace.hidden = !paceText;
    pace.textContent = paceText;
    pace.dataset.tone = tone;

    // Telegram card
    const on = form.elements.goalReminder.checked;
    root.querySelector("[data-gf-before]").hidden = !on;
    const before = Number(form.querySelector('input[name="remindDaysBefore"]:checked')?.value || 0);
    const monthly = form.elements.monthlyNudge.checked;
    const tg = root.querySelector(".gf-tg .ev-telegram");
    const alert = root.querySelector("[data-gf-alert]");
    let text;
    let tgTone = "ok";
    if (!on) {
      tgTone = "off";
      text = L("បិទ — មិនផ្ញើទៅ Telegram ទេ", "Off — nothing goes to Telegram");
    } else if (!deadline && !(monthly && target)) {
      tgTone = "warn";
      text = L("ដាក់ថ្ងៃកំណត់ ឬចំនួនលុយ ដើម្បីទទួលការរំលឹក", "Add a deadline or amount to get alerts");
    } else {
      const parts = [];
      if (deadline && months > 0) {
        const send = new Date(`${deadline}T00:00:00`);
        send.setDate(send.getDate() - before);
        parts.push(before && send > new Date() ? L(`${formatDate(localDateInput(send))} និង ${formatDate(deadline)}`, `${formatDate(localDateInput(send))} and ${formatDate(deadline)}`) : formatDate(deadline));
      }
      if (monthly && target) parts.push(L("ថ្ងៃទី 1 រៀងរាល់ខែ", "the 1st of every month"));
      text = L(`ផ្ញើម៉ោង 9 ព្រឹក ${parts.join(" · ")}`, `Sent at 9 AM on ${parts.join(" · ")}`);
    }
    tg.dataset.tone = tgTone;
    alert.textContent = text;

    const cover = root.querySelector("[data-gf-cover]");
    const url = state.preview || state.goal.coverImage || "";
    cover.classList.toggle("has-photo", Boolean(url));
    root.querySelector("[data-gf-cover-img]").innerHTML = url ? `<img src="${escapeAttr(url)}" alt="">` : "";
  }

  function smart(root) {
    const form = root.querySelector("#modalForm");
    const text = form.elements.name.value;
    const found = [];
    const amount = parseAmount(text);
    if (amount && !state.touched.has("target")) {
      form.elements.targetAmount.value = amount;
      found.push(fmt(amount));
    }
    if (!state.touched.has("category")) {
      const cat = CATS.find(item => item.re.test(text)) || (amount ? CATS.find(item => item.value === "Financial") : null);
      if (cat) {
        form.querySelector(`input[name="category"][value="${cat.value}"]`).checked = true;
        found.push(catLabel(cat.value));
      }
    }
    const deadline = parseDeadline(text);
    if (deadline && !state.touched.has("deadline")) {
      form.elements.deadline.value = deadline;
      found.push(formatDate(deadline));
    }
    const box = root.querySelector("[data-gf-smart]");
    box.classList.toggle("is-found", found.length > 0);
    root.querySelector("[data-gf-smart-text]").textContent = found.length
      ? `${L("បានស្គាល់", "Picked up")}: ${found.join(" · ")}`
      : L("សរសេរគោលដៅ — ខ្ញុំនឹងស្គាល់ចំនួន ប្រភេទ និងថ្ងៃកំណត់ឱ្យ", "Write your goal — amount, category and deadline are picked for you");
    sync(root);
  }

  function open(goal, defaultCategory = "Personal") {
    goal = goal || {};
    state = { goal, file: null, preview: "", touched: new Set(goal.id ? ["target", "category", "deadline"] : []) };
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = render(goal, defaultCategory);
    root.classList.add("open");
    const form = root.querySelector("#modalForm");
    Modal.escapeHandler = event => {
      if (event.key === "Escape") Modal.close();
    };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));

    let timer;
    form.elements.name.addEventListener("input", () => {
      root.querySelector('[data-error="name"]').textContent = "";
      clearTimeout(timer);
      timer = setTimeout(() => smart(root), 220);
    });
    form.elements.coverFile.addEventListener("change", () => {
      const file = form.elements.coverFile.files?.[0];
      if (!file || !file.type?.startsWith("image/")) return;
      state.file = file;
      state.preview = URL.createObjectURL(file);
      sync(root);
    });
    form.querySelectorAll('input[name="category"]').forEach(radio => radio.addEventListener("change", () => state.touched.add("category")));
    root.querySelectorAll("[data-gf-target]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.targetAmount.value = chip.dataset.gfTarget;
      state.touched.add("target");
      sync(root);
    }));
    form.elements.targetAmount.addEventListener("input", () => {
      state.touched.add("target");
      sync(root);
    });
    form.elements.currentAmount.addEventListener("input", () => sync(root));
    root.querySelectorAll("[data-gf-deadline]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.deadline.value = chip.dataset.gfDeadline;
      state.touched.add("deadline");
      sync(root);
    }));
    form.elements.deadline.addEventListener("change", () => {
      state.touched.add("deadline");
      sync(root);
    });
    form.querySelectorAll('input[name="linkedSavingsId"], input[name="remindDaysBefore"], input[name="goalReminder"], input[name="monthlyNudge"]').forEach(input => input.addEventListener("change", () => sync(root)));
    root.querySelector("[data-gf-delete]")?.addEventListener("click", () => {
      Modal.confirm({ title: t("deleteGoal"), message: t("deleteGoalMessage"), confirmText: t("delete"), onConfirm: () => {
        Store.delete("goals", goal.id);
        Toast.show(t("goalDeleted"));
        if (location.hash.startsWith("#goals/")) location.hash = "#goals";
      } });
    });
    const details = root.querySelector(".ev-notes");
    details.addEventListener("toggle", () => {
      if (details.open) setTimeout(() => form.elements.description.focus(), 30);
    });
    form.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const name = form.elements.name.value.trim();
      if (!name) {
        root.querySelector('[data-error="name"]').textContent = t("required");
        form.elements.name.focus();
        return;
      }
      form.querySelector(".ev-submit").disabled = true;
      const data = {
        name,
        category: form.querySelector('input[name="category"]:checked')?.value || "Personal",
        targetAmount: form.elements.targetAmount.value,
        currentAmount: form.elements.currentAmount.value,
        deadline: form.elements.deadline.value,
        linkedSavingsId: form.querySelector('input[name="linkedSavingsId"]:checked')?.value || "",
        description: form.elements.description.value.trim(),
        goalReminder: form.elements.goalReminder.checked,
        remindDaysBefore: Number(form.querySelector('input[name="remindDaysBefore"]:checked')?.value || 0),
        monthlyNudge: form.elements.monthlyNudge.checked
      };
      try {
        data.coverImage = state.file ? await readFile(state.file) : goal.coverImage || "";
        if (state.file) data.coverImagePosition = { x: 0, y: 0 };
      } catch (error) {
        data.coverImage = goal.coverImage || "";
      }
      if (goal.id) Store.edit("goals", goal.id, normalizeGoal(data, goal));
      else Store.add("goals", normalizeGoal(data));
      Toast.show(goal.id ? t("goalSaved") : t("goalCreated"));
      Modal.close();
    });

    sync(root);
    if (!goal.id) setTimeout(() => form.elements.name.focus(), 60);
  }

  return { open, parseAmount, parseDeadline };
})();
