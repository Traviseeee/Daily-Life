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
