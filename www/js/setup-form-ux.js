/* Gives the grouped setup forms (Create user / Edit user data) the same look
 * as the event, expense and family forms: icon header, lime tabs, short
 * selects as chips, a photo picker with preview and switches for yes/no.
 * The original inputs stay in the form, so saving is unchanged. */
const SetupFormUX = (() => {
  const km = () => languageCode() === "km";
  const CAMERA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>';
  const MAX_CHIP_OPTIONS = 5;

  function chipifySelect(select) {
    const options = [...select.options].filter(option => option.value !== "" || option.textContent.trim());
    if (!options.length || options.length > MAX_CHIP_OPTIONS) return;
    const row = document.createElement("div");
    row.className = "su-chips";
    options.forEach(option => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ev-chip su-chip";
      chip.dataset.value = option.value;
      chip.textContent = option.textContent;
      chip.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        sync();
      });
      row.appendChild(chip);
    });
    const sync = () => row.querySelectorAll(".su-chip").forEach(chip => chip.classList.toggle("active", chip.dataset.value === select.value));
    select.classList.add("su-hidden");
    select.addEventListener("change", sync);
    select.after(row);
    sync();
  }

  function photoPicker(input, currentUrl) {
    const field = input.closest(".field");
    if (!field) return;
    const box = document.createElement("label");
    box.className = "su-photo";
    box.htmlFor = input.id;
    box.innerHTML = `<span class="su-photo-img">${currentUrl ? `<img src="${escapeAttr(currentUrl)}" alt="">` : CAMERA}</span>
      <span class="su-photo-copy"><strong>${km() ? "ជ្រើសរូបថត" : "Choose a photo"}</strong><small data-su-file>${km() ? "ចុចទីនេះ ដើម្បីប្តូររូប" : "Tap to change the picture"}</small></span>
      <span class="su-photo-btn">${CAMERA}</span>`;
    input.classList.add("su-hidden");
    input.after(box);
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      box.querySelector("[data-su-file]").textContent = file.name;
      if (file.type?.startsWith("image/")) box.querySelector(".su-photo-img").innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
    });
  }

  function enhance(root) {
    const form = root.querySelector(".modal-setup");
    if (!form || form.dataset.suEnhanced) return;
    form.dataset.suEnhanced = "1";
    form.classList.add("su-modern");

    // header icon like the other forms
    const title = form.querySelector(".section-title");
    if (title && !title.previousElementSibling?.classList?.contains("su-head-icon")) {
      const iconBox = document.createElement("span");
      iconBox.className = "su-head-icon";
      iconBox.innerHTML = Icons.user();
      title.before(iconBox);
      title.parentElement.classList.add("su-head");
    }

    form.querySelectorAll("select").forEach(chipifySelect);

    form.querySelectorAll('input[type="file"]').forEach(input => {
      const current = input.name === "photo" ? appData.profile.photo : "";
      photoPicker(input, current);
    });

    form.querySelectorAll('.field-inline input[type="checkbox"]').forEach(box => box.classList.add("ev-switch", "su-switch"));

    // submit button with a check icon, like the other forms
    const submit = form.querySelector('button[type="submit"]');
    if (submit && !submit.querySelector("svg")) submit.insertAdjacentHTML("afterbegin", Icons.check());
    submit?.classList.add("ev-submit");
  }

  return { enhance };
})();

/* Same look for every ordinary Modal form (memories, hobbies, bills, loans,
 * savings, income, goals…): icon header, white field card, short selects as
 * chips, photo picker, switches, plus helpers for common fields:
 * date → Today / Yesterday, minutes → 15/30/60/90, mood → mood chips,
 * familyMembers → people chips with photos, tags → quick tags. */
const ModernForm = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);

  function headerIcon(form) {
    const has = name => Boolean(form.querySelector(`[name="${name}"]`));
    if (has("photo") && has("location")) return Icons.memory();
    if (has("minutes")) return Icons.spark();
    if (has("due") || has("billEnabled")) return Icons.bill();
    if (has("monthlyPayment") || has("originalAmount")) return Icons.loan();
    if (has("targetAmount")) return Icons.savings();
    if (has("amount")) return Icons.money();
    return Icons.edit();
  }

  function quickChips(field, input, values, { toggle = false } = {}) {
    const row = document.createElement("div");
    row.className = "su-chips su-quick";
    values.forEach(([value, text, html]) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ev-chip su-chip";
      chip.dataset.value = value;
      chip.innerHTML = html || escapeHtml(text);
      chip.addEventListener("click", () => {
        if (toggle) {
          const list = input.value.split(",").map(item => item.trim()).filter(Boolean);
          const index = list.findIndex(item => item.toLowerCase() === value.toLowerCase());
          if (index >= 0) list.splice(index, 1);
          else list.push(value);
          input.value = list.join(", ");
        } else {
          input.value = value;
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        sync();
      });
      row.appendChild(chip);
    });
    const sync = () => {
      const current = toggle
        ? input.value.split(",").map(item => item.trim().toLowerCase())
        : [String(input.value).trim().toLowerCase()];
      row.querySelectorAll(".su-chip").forEach(chip => chip.classList.toggle("active", current.includes(chip.dataset.value.toLowerCase())));
    };
    input.addEventListener("input", sync);
    field.appendChild(row);
    sync();
  }

  function shiftDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDateInput(date);
  }

  function enhance(root) {
    const form = root.querySelector("#modalForm");
    if (!form || form.classList.contains("modal-setup") || form.classList.contains("event-modal") || form.dataset.suEnhanced) return;
    const inputs = form.querySelectorAll("input:not([type=hidden]), select, textarea");
    if (!inputs.length) return; // confirm dialogs
    form.dataset.suEnhanced = "1";
    form.classList.add("su-modern", "su-plain");

    const title = form.querySelector(".section-title");
    if (title) {
      const iconBox = document.createElement("span");
      iconBox.className = "su-head-icon";
      iconBox.innerHTML = headerIcon(form);
      title.before(iconBox);
      title.parentElement.classList.add("su-head");
    }

    // quick helpers before generic chip conversion
    form.querySelectorAll('input[type="date"]').forEach(input => {
      const field = input.closest(".field");
      if (field && !input.value) input.value = "";
      if (field) quickChips(field, input, [[shiftDate(0), L("ថ្ងៃនេះ", "Today")], [shiftDate(-1), L("ម្សិលមិញ", "Yesterday")]]);
    });
    const minutes = form.querySelector('input[name="minutes"]');
    if (minutes) quickChips(minutes.closest(".field"), minutes, [["15", L("15 នាទី", "15 min")], ["30", L("30 នាទី", "30 min")], ["60", L("1 ម៉ោង", "1 hour")], ["90", L("1.5 ម៉ោង", "1.5 h")], ["120", L("2 ម៉ោង", "2 hours")]]);
    const mood = form.querySelector('input[name="mood"]');
    if (mood) {
      const moods = km() ? ["សប្បាយ", "ស្ងប់", "មានថាមពល", "ហត់", "ពេញចិត្ត", "តានតឹង"] : ["Happy", "Calm", "Energized", "Tired", "Proud", "Stressed"];
      quickChips(mood.closest(".field"), mood, moods.map(item => [item, item]));
    }
    const people = form.querySelector('input[name="familyMembers"]');
    if (people && appData.family.length) {
      quickChips(people.closest(".field"), people, appData.family.filter(member => member.name).map(member => [
        member.name,
        member.name,
        `${member.photo ? `<img class="su-chip-avatar" src="${escapeAttr(member.photo)}" alt="">` : `<span class="su-chip-avatar">${escapeHtml(member.name.charAt(0).toUpperCase())}</span>`}${escapeHtml(member.name)}`
      ]), { toggle: true });
    }
    const tags = form.querySelector('input[name="tags"]');
    if (tags) {
      const quick = km() ? ["គ្រួសារ", "ធ្វើដំណើរ", "ថ្ងៃកំណើត", "ម្ហូប", "ខួប", "ដើរលេង"] : ["Family", "Travel", "Birthday", "Food", "Anniversary", "Outing"];
      tags.placeholder = L("វាយ ឬជ្រើសខាងក្រោម", "Type or pick below");
      quickChips(tags.closest(".field"), tags, quick.map(item => [item, `#${item}`]), { toggle: true });
    }

    // generic: short selects → chips (up to 6 options)
    form.querySelectorAll("select").forEach(select => {
      const options = [...select.options];
      if (!options.length || options.length > 6) return;
      const row = document.createElement("div");
      row.className = "su-chips";
      options.forEach(option => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "ev-chip su-chip";
        chip.dataset.value = option.value;
        chip.textContent = option.textContent || L("គ្មាន", "None");
        chip.addEventListener("click", () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          sync();
        });
        row.appendChild(chip);
      });
      const sync = () => row.querySelectorAll(".su-chip").forEach(chip => chip.classList.toggle("active", chip.dataset.value === select.value));
      select.classList.add("su-hidden");
      select.addEventListener("change", sync);
      select.after(row);
      sync();
    });

    // photo picker
    form.querySelectorAll('input[type="file"]').forEach(input => {
      const field = input.closest(".field");
      if (!field) return;
      const box = document.createElement("label");
      box.className = "su-photo";
      box.htmlFor = input.id;
      box.innerHTML = `<span class="su-photo-img">${Icons.memory()}</span><span class="su-photo-copy"><strong>${L("ជ្រើសរូបថត", "Choose a photo")}</strong><small data-su-file>${L("ចុចទីនេះ ដើម្បីបន្ថែមរូប", "Tap to add a picture")}</small></span><span class="su-photo-btn">${Icons.plus()}</span>`;
      input.classList.add("su-hidden");
      input.after(box);
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        box.querySelector("[data-su-file]").textContent = file.name;
        if (file.type?.startsWith("image/")) box.querySelector(".su-photo-img").innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
      });
    });

    form.querySelectorAll('.field-inline input[type="checkbox"]').forEach(box => box.classList.add("su-switch"));
    const submit = form.querySelector('button[type="submit"]');
    if (submit && !submit.querySelector("svg") && !submit.classList.contains("danger-button")) submit.insertAdjacentHTML("afterbegin", Icons.check());
    if (submit && !submit.classList.contains("danger-button")) submit.classList.add("ev-submit");
  }

  return { enhance };
})();
