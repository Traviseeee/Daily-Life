/* MYLIFE memory form — same style as the event / expense forms.
 * Big photo cover (the date is taken from the photo), a title that picks up
 * tags and people ("Lychee birthday dinner" → #Birthday #Food + Lychee),
 * quick date chips, recent places, people with photos, colour tag chips and
 * a folded story. Saves the same fields: title, photo, date, location,
 * description, familyMembers, tags. */
const MemoryForm = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const svg = paths => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    family: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z"/>',
    cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3M12 8v3M17 8v3"/>',
    food: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5a5.5 5.5 0 0 0-10 3.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1L12 2z"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r=".5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    swap: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>'
  };
  const icon = name => svg(ICON[name] || ICON.tag);
  const TAGS = [
    { km: "គ្រួសារ", en: "Family", icon: "family", tone: "#ff6fa5", re: /គ្រួសារ|family|mom|dad|ម៉ាក់|ប៉ា|កូន/i },
    { km: "ធ្វើដំណើរ", en: "Travel", icon: "plane", tone: "#3f86d6", re: /ធ្វើដំណើរ|ដំណើរកម្សាន្ត|trip|travel|beach|សមុទ្រ|ខេត្ត|holiday|vacation/i },
    { km: "ថ្ងៃកំណើត", en: "Birthday", icon: "cake", tone: "#f59e0b", re: /ថ្ងៃកំណើត|ខួបកំណើត|birthday|bday/i },
    { km: "ម្ហូប", en: "Food", icon: "food", tone: "#ef4444", re: /ម្ហូប|ញ៉ាំ|អាហារ|បាយ|កាហ្វេ|food|dinner|lunch|breakfast|coffee|restaurant|cafe/i },
    { km: "ខួប", en: "Anniversary", icon: "heart", tone: "#d6457a", re: /ខួប|anniversary|date night|ណាត់/i },
    { km: "ដើរលេង", en: "Outing", icon: "sun", tone: "#22c55e", re: /ដើរលេង|outing|park|walk|picnic|ផ្សារ|mall/i },
    { km: "ពិសេស", en: "Special", icon: "star", tone: "#8b5cf6", re: /ពិសេស|special|first|graduation|wedding|រៀបការ|បញ្ចប់ការសិក្សា/i }
  ];
  const tagLabel = tag => (km() ? tag.km : tag.en);
  const split = value => String(value || "").split(",").map(item => item.trim()).filter(Boolean);

  let state = null;

  function shift(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDateInput(date);
  }

  function recentPlaces(current) {
    const seen = new Set();
    return appData.memories
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .map(item => String(item.location || "").trim())
      .filter(place => place && place !== current && !seen.has(place.toLowerCase()) && seen.add(place.toLowerCase()))
      .slice(0, 4);
  }

  function render(memory) {
    const isEdit = Boolean(memory.id);
    const chosenTags = split(memory.tags).map(item => item.toLowerCase());
    const people = split(memory.familyMembers).map(item => item.toLowerCase());
    const known = new Set(TAGS.flatMap(tag => [tag.km.toLowerCase(), tag.en.toLowerCase()]));
    const customTags = split(memory.tags).filter(item => !known.has(item.toLowerCase()));
    const dateChips = [[shift(0), L("ថ្ងៃនេះ", "Today")], [shift(-1), L("ម្សិលមិញ", "Yesterday")], [shift(-7), L("សប្តាហ៍មុន", "Last week")]];
    const places = recentPlaces(memory.location || "");
    const family = appData.family.filter(member => member.name);
    return `
      <form class="modal glass-card event-modal memory-form-modal" id="modalForm" novalidate>
        <div class="ev-head">
          <div class="ev-head-icon">${Icons.memory()}</div>
          <h2 class="section-title">${isEdit ? t("editMemory") : t("addMemory")}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>

        <label class="mf-cover" data-mf-cover>
          <input type="file" accept="image/*" name="photoFile">
          <span class="mf-cover-img" data-mf-cover-img></span>
          <span class="mf-cover-empty">
            <i>${icon("camera")}</i>
            <strong>${escapeHtml(L("បន្ថែមរូបថត", "Add a photo"))}</strong>
            <small>${escapeHtml(L("ថ្ងៃខែនឹងយកពីរូបថតដោយខ្លួនឯង", "The date is taken from the photo"))}</small>
          </span>
          <span class="mf-cover-change">${icon("swap")}${escapeHtml(L("ប្តូររូប", "Change"))}</span>
        </label>

        <div class="ev-title-wrap">
          <input class="ev-title" id="title" name="title" type="text" autocomplete="off" placeholder="${escapeAttr(L("ឧ. ញ៉ាំថ្ងៃកំណើតជាមួយ Lychee", "e.g. Birthday dinner with Lychee"))}" value="${escapeAttr(memory.title || "")}">
          <div class="ev-smart" data-mf-smart><i>${Icons.spark()}</i><em data-mf-smart-text>${escapeHtml(L("សរសេរចំណងជើង — ខ្ញុំនឹងជ្រើសស្លាក និងមនុស្សឱ្យ", "Write a title — tags and people are picked for you"))}</em></div>
          <div class="field-error" data-error="title"></div>
        </div>

        <section class="ev-section">
          <div class="ev-label">${Icons.calendar()}<strong>${escapeHtml(L("ពេលណា & ទីណា", "When & where"))}</strong><em class="ev-summary" data-mf-when></em></div>
          <div class="ev-row">${dateChips.map(([value, label]) => `<button type="button" class="ev-chip" data-mf-date="${value}">${escapeHtml(label)}</button>`).join("")}<input class="ev-date" id="date" name="date" type="date" value="${escapeAttr(memory.date || localDateInput())}"></div>
          <div class="mf-place">
            <i>${icon("pin")}</i>
            <input id="location" name="location" type="text" autocomplete="off" placeholder="${escapeAttr(L("ទីកន្លែង ឧ. កែប, ផ្ទះយាយ", "Place, e.g. Kep, Grandma's house"))}" value="${escapeAttr(memory.location || "")}">
          </div>
          ${places.length ? `<div class="ev-row mf-places">${places.map(place => `<button type="button" class="ev-chip" data-mf-place="${escapeAttr(place)}">${icon("pin")}${escapeHtml(place)}</button>`).join("")}</div>` : ""}
        </section>

        ${family.length ? `<section class="ev-section">
          <div class="ev-label">${Icons.family()}<strong>${escapeHtml(L("ជាមួយអ្នកណា", "Who was there"))}</strong><em class="ev-summary" data-mf-people-count></em></div>
          <div class="ev-people">${family.map(member => `<label class="ev-person"><input type="checkbox" name="mfPeople" value="${escapeAttr(member.name.trim())}" ${people.includes(member.name.trim().toLowerCase()) ? "checked" : ""}>${member.photo ? `<i class="ev-avatar"><img src="${escapeAttr(member.photo)}" alt=""></i>` : `<i class="ev-avatar">${escapeHtml(member.name.charAt(0).toUpperCase())}</i>`}<b>${escapeHtml(member.name)}</b></label>`).join("")}</div>
        </section>` : ""}

        <section class="ev-section">
          <div class="ev-label">${icon("tag")}<strong>${escapeHtml(t("tags"))}</strong></div>
          <div class="ev-cats mf-tags">${TAGS.map(tag => `<label class="ev-cat" style="--tone:${tag.tone};--tone-bg:color-mix(in srgb, ${tag.tone} 15%, #ffffff)"><input type="checkbox" name="mfTag" value="${escapeAttr(tagLabel(tag))}" ${chosenTags.includes(tag.km.toLowerCase()) || chosenTags.includes(tag.en.toLowerCase()) ? "checked" : ""}><i class="ev-cat-icon">${icon(tag.icon)}</i><b>${escapeHtml(tagLabel(tag))}</b></label>`).join("")}</div>
          <div class="mf-place mf-custom-tag"><i>${icon("plus")}</i><input id="mfCustomTags" type="text" autocomplete="off" placeholder="${escapeAttr(L("ស្លាកផ្សេងទៀត (បំបែកដោយក្បៀស)", "Other tags (comma separated)"))}" value="${escapeAttr(customTags.join(", "))}"></div>
        </section>

        <details class="ev-notes" ${memory.description ? "open" : ""}>
          <summary>${icon("book")}<strong>${escapeHtml(memory.description ? L("រឿងរ៉ាវ", "Story") : L("សរសេររឿងរ៉ាវ", "Write the story"))}</strong></summary>
          <textarea id="description" name="description" rows="4" placeholder="${escapeAttr(L("តើមានអ្វីកើតឡើង? អ្វីដែលបងចង់ចងចាំ…", "What happened? What do you want to remember…"))}">${escapeHtml(memory.description || "")}</textarea>
        </details>

        <div class="ev-foot">
          <small class="ev-shortcut">${escapeHtml(L("Ctrl + Enter ដើម្បីរក្សាទុក", "Ctrl + Enter to save"))}</small>
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit">${Icons.check()}${isEdit ? t("saveMemory") : t("addMemory")}</button>
        </div>
      </form>`;
  }

  function sync(root) {
    const form = root.querySelector("#modalForm");
    const date = form.elements.date.value;
    root.querySelectorAll("[data-mf-date]").forEach(chip => chip.classList.toggle("active", chip.dataset.mfDate === date));
    const place = form.elements.location.value.trim().toLowerCase();
    root.querySelectorAll("[data-mf-place]").forEach(chip => chip.classList.toggle("active", chip.dataset.mfPlace.toLowerCase() === place));
    const when = root.querySelector("[data-mf-when]");
    if (when) when.textContent = [date ? formatDate(date) : "", form.elements.location.value.trim()].filter(Boolean).join(" · ");
    const count = form.querySelectorAll('input[name="mfPeople"]:checked').length;
    const countEl = root.querySelector("[data-mf-people-count]");
    if (countEl) countEl.textContent = count ? L(`${count} នាក់`, `${count} people`) : "";

    const cover = root.querySelector("[data-mf-cover]");
    const url = state.preview || state.memory.photo || "";
    cover.classList.toggle("has-photo", Boolean(url));
    root.querySelector("[data-mf-cover-img]").innerHTML = url ? `<img src="${escapeAttr(url)}" alt="">` : "";
  }

  function smart(root) {
    const form = root.querySelector("#modalForm");
    const text = form.elements.title.value;
    const found = [];
    if (!state.touched.has("tags")) {
      TAGS.forEach(tag => {
        if (!tag.re.test(text)) return;
        const box = [...form.querySelectorAll('input[name="mfTag"]')].find(input => input.value === tagLabel(tag));
        if (box && !box.checked) box.checked = true;
        if (box) found.push(`#${tagLabel(tag)}`);
      });
    }
    if (!state.touched.has("people")) {
      form.querySelectorAll('input[name="mfPeople"]').forEach(box => {
        const name = box.value.trim().toLowerCase();
        if (name.length >= 2 && text.toLowerCase().includes(name)) {
          box.checked = true;
          found.push(box.value);
        }
      });
    }
    const smartBox = root.querySelector("[data-mf-smart]");
    const label = root.querySelector("[data-mf-smart-text]");
    if (found.length) {
      smartBox.classList.add("is-found");
      label.textContent = `${L("បានស្គាល់", "Picked up")}: ${found.join(" · ")}`;
    } else if (!state.photoDate) {
      smartBox.classList.remove("is-found");
      label.textContent = L("សរសេរចំណងជើង — ខ្ញុំនឹងជ្រើសស្លាក និងមនុស្សឱ្យ", "Write a title — tags and people are picked for you");
    }
    sync(root);
  }

  function open(memory) {
    memory = memory || {};
    state = { memory, file: null, preview: "", touched: new Set(memory.id ? ["tags", "people", "date"] : []), photoDate: "" };
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = render(memory);
    root.classList.add("open");
    const form = root.querySelector("#modalForm");
    Modal.escapeHandler = event => {
      if (event.key === "Escape") Modal.close();
    };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));

    form.elements.photoFile.addEventListener("change", () => {
      const file = form.elements.photoFile.files?.[0];
      if (!file || !file.type?.startsWith("image/")) return;
      state.file = file;
      state.preview = URL.createObjectURL(file);
      if (!state.touched.has("date") && file.lastModified) {
        const taken = localDateInput(new Date(file.lastModified));
        form.elements.date.value = taken;
        state.photoDate = taken;
        const smartBox = root.querySelector("[data-mf-smart]");
        smartBox.classList.add("is-found");
        root.querySelector("[data-mf-smart-text]").textContent = L(`បានយកថ្ងៃពីរូបថត: ${formatDate(taken)}`, `Date taken from the photo: ${formatDate(taken)}`);
      }
      sync(root);
    });
    let timer;
    form.elements.title.addEventListener("input", () => {
      root.querySelector('[data-error="title"]').textContent = "";
      clearTimeout(timer);
      timer = setTimeout(() => smart(root), 220);
    });
    root.querySelectorAll("[data-mf-date]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.date.value = chip.dataset.mfDate;
      state.touched.add("date");
      sync(root);
    }));
    form.elements.date.addEventListener("change", () => {
      state.touched.add("date");
      sync(root);
    });
    root.querySelectorAll("[data-mf-place]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.location.value = chip.dataset.mfPlace;
      sync(root);
    }));
    form.elements.location.addEventListener("input", () => sync(root));
    form.querySelectorAll('input[name="mfTag"]').forEach(box => box.addEventListener("change", () => state.touched.add("tags")));
    form.querySelectorAll('input[name="mfPeople"]').forEach(box => box.addEventListener("change", () => {
      state.touched.add("people");
      sync(root);
    }));
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
      const title = form.elements.title.value.trim();
      if (!title || !form.elements.date.value) {
        root.querySelector('[data-error="title"]').textContent = t("required");
        form.elements.title.focus();
        return;
      }
      const submit = form.querySelector(".ev-submit");
      submit.disabled = true;
      const tags = [
        ...[...form.querySelectorAll('input[name="mfTag"]:checked')].map(box => box.value),
        ...split(form.querySelector("#mfCustomTags").value)
      ];
      const data = {
        title,
        date: form.elements.date.value,
        location: form.elements.location.value.trim(),
        description: form.elements.description.value.trim(),
        familyMembers: [...form.querySelectorAll('input[name="mfPeople"]:checked')].map(box => box.value).join(", ") || (memory.id && !appData.family.length ? memory.familyMembers || "" : ""),
        tags: [...new Set(tags)].join(", ")
      };
      try {
        if (state.file) {
          data.photo = await readFile(state.file);
          data.photoPosition = { x: 0, y: 0 };
        } else {
          data.photo = memory.photo || "";
        }
      } catch (error) {
        data.photo = memory.photo || "";
      }
      if (memory.id) Store.edit("memories", memory.id, data);
      else Store.add("memories", data);
      Toast.show(memory.id ? t("memorySaved") : t("memoryAdded"));
      Modal.close();
    });

    sync(root);
    if (!memory.id) setTimeout(() => form.elements.title.focus(), 60);
  }

  return { open };
})();
