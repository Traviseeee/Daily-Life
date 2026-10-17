/* MYLIFE family member form — same style as the event and expense forms.
 * Big profile header (tap the photo to change it, type the name), emoji chips
 * for relationship and personality, partner chips with photos, birthday and
 * anniversary with live age / countdown, automatic zodiac, a care idea, and
 * folded notes. Saves the same fields as before. */
const FamilyForm = (() => {
  const RELATIONSHIPS = ["Me", "Wife", "Husband", "Girlfriend", "Boyfriend", "Mother", "Father", "Daughter", "Son", "Sister", "Brother", "Grandmother", "Grandfather", "Friend", "Other"];
  const MOODS = ["Happy", "Calm", "Cheerful", "Funny", "Caring", "Quiet", "Creative", "Energetic", "Sensitive", "Serious", "Adventurous", "Other"];
  // Line icons (24px grid, stroke = currentColor) — no emoji.
  const svg = (paths, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const P = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    ring: '<circle cx="12" cy="15" r="6"/><path d="m9.5 3.5 2.5 4 2.5-4"/><path d="M8.5 3.5h7"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5a5.5 5.5 0 0 0-10 3.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    flower: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5A3 3 0 1 1 12 3.5a3 3 0 0 1 0 6Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-2.5-2.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm5 0a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    baby: '<path d="M9 12h.01M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    tree: '<path d="M12 22v-6"/><path d="M8 16h8a4 4 0 0 0 1.2-7.8A5 5 0 0 0 6.8 8.2 4 4 0 0 0 8 16Z"/>',
    hand: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.9-3.9a3 3 0 0 0-4.2 0l-.9.9a1 1 0 1 1-3-3l2.8-2.8a5.8 5.8 0 0 1 7.1-.9l.5.3a2 2 0 0 0 1.4.2L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
    spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    calm: '<circle cx="12" cy="12" r="10"/><path d="M9 15h6"/><path d="M8 10c.6-.7 1.4-.7 2 0M14 10c.6-.7 1.4-.7 2 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    laugh: '<circle cx="12" cy="12" r="10"/><path d="M18 13a6 6 0 0 1-12 0Z"/><path d="M9 9h.01M15 9h.01"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2a10 10 0 0 0 0 20 1.7 1.7 0 0 0 1.7-1.7c0-.4-.2-.8-.4-1.1a1.7 1.7 0 0 1 1.3-2.8H17a5 5 0 0 0 5-5C22 6 17.5 2 12 2Z"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z"/>',
    glasses: '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-4 0M2.5 13 5 7c.7-1.3 1.4-2 3-2M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/>',
    mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
    cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3M12 8v3M17 8v3"/><path d="M7 4h.01M12 4h.01M17 4h.01"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1L12 2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>'
  };
  const REL_ICON = { Me: "user", Wife: "ring", Husband: "ring", Girlfriend: "heart", Boyfriend: "heart", Mother: "flower", Father: "shield", Daughter: "baby", Son: "baby", Sister: "users", Brother: "users", Grandmother: "tree", Grandfather: "tree", Friend: "hand", Other: "spark" };
  const MOOD_ICON = { Happy: "smile", Calm: "calm", Cheerful: "sun", Funny: "laugh", Caring: "heart", Quiet: "moon", Creative: "palette", Energetic: "zap", Sensitive: "drop", Serious: "glasses", Adventurous: "mountain", Other: "spark" };
  const icon = (name, size) => svg(P[name] || P.spark, size);
  const PARTNER = ["Wife", "Husband", "Girlfriend", "Boyfriend", "Me"];
  // tile colours, same idea as the expense categories
  const TONE = {
    Me: "#5aa9ff", Wife: "#ff5c8a", Husband: "#3f86d6", Girlfriend: "#ff6fa5", Boyfriend: "#5b7cfa",
    Mother: "#f59e0b", Father: "#0ea5a4", Daughter: "#f472b6", Son: "#60a5fa", Sister: "#c084fc",
    Brother: "#34d399", Grandmother: "#fb923c", Grandfather: "#a3a36b", Friend: "#22c55e", Other: "#94a3b8",
    Happy: "#f5b301", Calm: "#38bdf8", Cheerful: "#fb923c", Funny: "#f472b6", Caring: "#ef4444",
    Quiet: "#94a3b8", Creative: "#a78bfa", Energetic: "#facc15", Sensitive: "#f9a8d4", Serious: "#64748b",
    Adventurous: "#10b981"
  };

  const km = () => languageCode() === "km";
  const L = (kmText, enText) => (km() ? kmText : enText);
  const KM_LABEL = {
    Me: "ខ្ញុំ", Wife: "ប្រពន្ធ", Husband: "ប្តី", Girlfriend: "សង្សារស្រី", Boyfriend: "សង្សារប្រុស",
    Mother: "ម្តាយ", Father: "ឪពុក", Daughter: "កូនស្រី", Son: "កូនប្រុស", Sister: "បងប្អូនស្រី",
    Brother: "បងប្អូនប្រុស", Grandmother: "យាយ", Grandfather: "តា", Friend: "មិត្តភក្តិ", Other: "ផ្សេងៗ",
    Happy: "សប្បាយ", Calm: "ស្ងប់", Cheerful: "រីករាយ", Funny: "កំប្លែង", Caring: "យកចិត្តទុកដាក់",
    Quiet: "ស្ងៀម", Creative: "ច្នៃប្រឌិត", Energetic: "ស្វាហាប់", Sensitive: "រសើប", Serious: "ម៉ឺងម៉ាត់",
    Adventurous: "ចូលចិត្តផ្សងព្រេង"
  };
  const label = value => (km() && KM_LABEL[value]) || optionLabel(value) || value;
  // shown first; the rest sit behind "more"
  const MAIN_REL = ["Me", "Wife", "Husband", "Girlfriend", "Boyfriend", "Mother", "Father", "Daughter", "Son"];

  let photoFile = null;
  let photoPreview = "";

  // Relationship: compact tiles (icon left, like the event form categories).
  function relationTiles(selected) {
    const list = [...RELATIONSHIPS];
    if (selected && !list.includes(selected)) list.unshift(selected);
    const tiles = list.map(value => {
      const tone = TONE[value] || "#94a3b8";
      const extra = !MAIN_REL.includes(value) && value !== selected;
      return `<label class="ev-cat ff-rel ${extra ? "ff-extra" : ""}" style="--tone:${tone};--tone-bg:color-mix(in srgb, ${tone} 15%, #ffffff)"><input type="radio" name="relationship" value="${escapeAttr(value)}" ${value === selected ? "checked" : ""}><i class="ev-cat-icon ff-emoji">${icon(REL_ICON[value])}</i><b>${escapeHtml(label(value))}</b></label>`;
    }).join("");
    return `${tiles}<button type="button" class="ev-cat ff-more" data-ff-more><i class="ev-cat-icon ff-emoji" data-ff-more-icon>${icon("plus")}</i><b>${escapeHtml(L("ផ្សេងទៀត", "More"))}</b></button>`;
  }

  // Personality: one scrollable row of small pills (like quick expense).
  function moodPills(selected) {
    const list = [...MOODS];
    if (selected && !list.includes(selected)) list.unshift(selected);
    return list.map(value => {
      const tone = TONE[value] || "#94a3b8";
      return `<label class="ff-pill" style="--tone:${tone}"><input type="radio" name="characterMood" value="${escapeAttr(value)}" ${value === selected ? "checked" : ""}><i>${icon(MOOD_ICON[value], 16)}</i><b>${escapeHtml(label(value))}</b></label>`;
    }).join("");
  }

  function people(member) {
    const others = appData.family.filter(item => item.id !== member.id && item.name);
    if (!others.length) return "";
    const none = `<label class="ev-person"><input type="radio" name="relatedMemberId" value="" ${!member.relatedMemberId ? "checked" : ""}><i class="ev-avatar ev-avatar-none">–</i><b>${escapeHtml(L("គ្មាន", "None"))}</b></label>`;
    return none + others.map(person => `<label class="ev-person"><input type="radio" name="relatedMemberId" value="${escapeAttr(person.id)}" ${person.id === member.relatedMemberId ? "checked" : ""}>${person.photo ? `<i class="ev-avatar"><img src="${escapeAttr(person.photo)}" alt=""></i>` : `<i class="ev-avatar">${escapeHtml(person.name.trim().charAt(0).toUpperCase())}</i>`}<b>${escapeHtml(person.name)}</b></label>`).join("");
  }

  function render(member) {
    const isEdit = Boolean(member.id);
    const hasPeople = appData.family.some(item => item.id !== member.id && item.name);
    const hasNotes = member.relationshipNote || member.notes;
    return `
      <form class="modal glass-card event-modal family-form-modal" id="modalForm" novalidate>
        <div class="ev-head">
          <div class="ev-head-icon ff-head-icon">${Icons.family()}</div>
          <h2 class="section-title">${isEdit ? t("editFamilyMember") : t("addFamilyMember")}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>

        <div class="ff-profile">
          <label class="ff-photo" title="${escapeAttr(t("photo"))}">
            <span class="ff-photo-img" data-ff-photo></span>
            <span class="ff-photo-badge">${Icons.edit()}</span>
            <input type="file" accept="image/*" name="photoFile">
          </label>
          <div class="ff-profile-main">
            <input class="ev-title ff-name" id="name" name="name" type="text" autocomplete="off" placeholder="${escapeAttr(L("ឈ្មោះ ឬឈ្មោះហៅក្រៅ", "Name or nickname"))}" value="${escapeAttr(member.name || "")}">
            <div class="ff-meta" data-ff-meta></div>
            <div class="ff-dates" data-ff-dates></div>
          </div>
        </div>
        <div class="field-error" data-error="name"></div>

        <section class="ev-section">
          <div class="ev-label">${Icons.heart()}<strong>${escapeHtml(t("relationship"))}</strong></div>
          <div class="ev-cats ff-rel-grid" data-ff-rel>${relationTiles(member.relationship || "")}</div>
          ${hasPeople ? `<div class="ff-related" data-ff-related>
            <div class="ev-label ff-sub">${Icons.family()}<strong>${escapeHtml(t("relatedPerson"))}</strong></div>
            <div class="ev-people">${people(member)}</div>
          </div>` : ""}
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.spark()}<strong>${escapeHtml(t("characterMood"))}</strong></div>
          <div class="ff-pills">${moodPills(member.characterMood || "")}</div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.calendar()}<strong>${escapeHtml(L("ថ្ងៃសំខាន់ៗ", "Important dates"))}</strong><em class="ev-summary">${escapeHtml(L("រំលឹកតាម Telegram ដោយខ្លួនឯង", "Auto reminders on Telegram"))}</em></div>
          <div class="ff-date-cards">
            <label class="ff-date-card ff-bday">
              <span class="ff-dc-icon">${icon("cake", 20)}</span>
              <span class="ff-dc-body">
                <span class="ff-dc-label">${escapeHtml(t("birthday"))}</span>
                <input id="birthday" name="birthday" type="date" value="${escapeAttr(member.birthday || "")}">
              </span>
              <small class="ff-dc-badge" data-ff-birthday></small>
            </label>
            <label class="ff-date-card ff-anniv">
              <span class="ff-dc-icon">${icon("heart", 20)}</span>
              <span class="ff-dc-body">
                <span class="ff-dc-label">${escapeHtml(member.relatedMemberId ? t("relationshipStart") : t("anniversary"))}</span>
                <input id="anniversaryDate" name="anniversaryDate" type="date" value="${escapeAttr(member.anniversaryDate || "")}">
              </span>
              <small class="ff-dc-badge" data-ff-anniversary></small>
            </label>
          </div>
          <div class="ff-zodiac" data-ff-zodiac></div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.gift()}<strong>${escapeHtml(L("ថែរក្សាទំនាក់ទំនង", "Care"))}</strong></div>
          <div class="ff-care-grid">
            <label class="ff-field"><span>${icon("phone", 15)}${escapeHtml(t("phone"))}</span><input class="ev-date" id="phone" name="phone" type="tel" inputmode="tel" placeholder="012 345 678" value="${escapeAttr(member.phone || "")}"></label>
            <label class="ff-field"><span>${icon("star", 15)}${escapeHtml(t("favorite"))}</span><input class="ev-date" id="favorite" name="favorite" type="text" placeholder="${escapeAttr(L("ម្ហូប ពណ៌ កាដូ…", "Food, colour, gifts…"))}" value="${escapeAttr(member.favorite || "")}"></label>
          </div>
          <div class="ff-idea" data-ff-idea><i>${Icons.spark()}</i><p></p></div>
        </section>

        <details class="ev-notes" ${hasNotes ? "open" : ""}>
          <summary>${Icons.edit()}<strong>${escapeHtml(hasNotes ? t("notes") : L("បន្ថែមកំណត់ចំណាំ", "Add notes"))}</strong></summary>
          <textarea id="relationshipNote" name="relationshipNote" rows="2" placeholder="${escapeAttr(t("relationshipNote"))}">${escapeHtml(member.relationshipNote || "")}</textarea>
          <textarea id="notes" name="notes" rows="2" placeholder="${escapeAttr(t("notes"))}">${escapeHtml(member.notes || "")}</textarea>
        </details>

        <div class="ev-foot">
          <small class="ev-shortcut">${escapeHtml(L("Ctrl + Enter ដើម្បីរក្សាទុក", "Ctrl + Enter to save"))}</small>
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit">${Icons.check()}${isEdit ? t("saveFamilyMember") : t("addFamilyMember")}</button>
        </div>
      </form>`;
  }

  function nextInfo(value) {
    if (!value) return null;
    const original = new Date(`${value}T00:00:00`);
    if (Number.isNaN(original.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = nextYearlyDate(value, today);
    const days = Math.round((next - today) / 86400000);
    const years = next.getFullYear() - original.getFullYear();
    return { days, years, past: original <= today };
  }

  function sync(root, member) {
    const form = root.querySelector("#modalForm");
    const name = form.elements.name.value.trim();
    const relationship = form.querySelector('input[name="relationship"]:checked')?.value || "";
    const mood = form.querySelector('input[name="characterMood"]:checked')?.value || "";
    const birthday = form.elements.birthday.value;
    const anniversary = form.elements.anniversaryDate.value;
    const sign = (typeof zodiacSignForDate === "function" && zodiacSignForDate(birthday)) || member.zodiacSign || "";

    const photo = photoPreview || member.photo || "";
    root.querySelector("[data-ff-photo]").innerHTML = photo
      ? `<img src="${escapeAttr(photo)}" alt="">`
      : (name ? `<b>${escapeHtml(name.charAt(0).toUpperCase())}</b>` : icon(REL_ICON[relationship] || "user", 34));

    const metaParts = [
      relationship ? `<span class="ff-tag" style="--tone:${TONE[relationship] || "#94a3b8"}">${icon(REL_ICON[relationship], 13)}${escapeHtml(label(relationship))}</span>` : "",
      mood ? `<span class="ff-tag" style="--tone:${TONE[mood] || "#94a3b8"}">${icon(MOOD_ICON[mood], 13)}${escapeHtml(label(mood))}</span>` : "",
      sign ? `<span class="ff-tag" style="--tone:#7a52d6">${icon("star", 13)}${escapeHtml(label(sign))}</span>` : ""
    ].filter(Boolean);
    root.querySelector("[data-ff-meta]").innerHTML = metaParts.length ? metaParts.join("") : `<span class="ff-meta-hint">${escapeHtml(L("ជ្រើសទំនាក់ទំនង និងចរិតខាងក្រោម", "Pick a relationship and personality below"))}</span>`;

    const b = nextInfo(birthday);
    const birthdayText = !b ? "" : b.days === 0
      ? L(`ថ្ងៃនេះខួបកំណើត ${b.years} ឆ្នាំ!`, `Turns ${b.years} today!`)
      : L(`អាយុ ${Math.max(0, b.years - 1)} ឆ្នាំ · ខួបក្នុង ${b.days} ថ្ងៃទៀត`, `${Math.max(0, b.years - 1)} years · birthday in ${b.days} days`);
    root.querySelector("[data-ff-birthday]").textContent = birthdayText;

    const a = nextInfo(anniversary);
    let anniversaryText = "";
    if (a && a.past) {
      const start = new Date(`${anniversary}T00:00:00`);
      const now = new Date();
      let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
      if (now.getDate() < start.getDate()) months -= 1;
      const years = Math.floor(months / 12);
      anniversaryText = L(`${years ? `${years} ឆ្នាំ ` : ""}${months % 12} ខែ · ខួបក្នុង ${a.days} ថ្ងៃ`, `${years ? `${years}y ` : ""}${months % 12}m · next in ${a.days} days`);
    }
    root.querySelector("[data-ff-anniversary]").textContent = anniversaryText;

    root.querySelector("[data-ff-dates]").innerHTML = [
      b ? `<span>${icon("cake", 13)}${escapeHtml(birthdayText)}</span>` : "",
      anniversaryText ? `<span>${icon("heart", 13)}${escapeHtml(anniversaryText)}</span>` : ""
    ].filter(Boolean).join("");
    root.querySelectorAll(".ff-date-card").forEach(card => card.classList.toggle("is-set", Boolean(card.querySelector("input").value)));
    const zodiacBox = root.querySelector("[data-ff-zodiac]");
    zodiacBox.hidden = !sign;
    zodiacBox.innerHTML = sign
      ? `<span class="ff-zodiac-sign">${icon("star", 16)}</span><span><b>${escapeHtml(label(sign))}</b><small>${escapeHtml(L("រាសី · គណនាពីថ្ងៃកំណើតដោយស្វ័យប្រវត្តិ", "Zodiac · worked out from the birthday"))}</small></span>`
      : "";

    const related = root.querySelector("[data-ff-related]");
    if (related) related.hidden = !(PARTNER.includes(relationship) || form.querySelector('input[name="relatedMemberId"]:checked')?.value);

    const idea = typeof familyCareIdea === "function"
      ? familyCareIdea({ name, relationship, characterMood: mood, favorite: form.elements.favorite.value })
      : "";
    const ideaBox = root.querySelector("[data-ff-idea]");
    ideaBox.hidden = !idea || !name || !relationship;
    ideaBox.querySelector("p").textContent = idea;
  }

  function open(member) {
    member = member || {};
    photoFile = null;
    photoPreview = "";
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = render(member);
    root.classList.add("open");
    const form = root.querySelector("#modalForm");

    Modal.escapeHandler = event => {
      if (event.key === "Escape") Modal.close();
    };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));

    const refresh = () => sync(root, member);
    root.querySelector("[data-ff-more]")?.addEventListener("click", event => {
      const grid = root.querySelector("[data-ff-rel]");
      grid.classList.toggle("show-all");
      event.currentTarget.querySelector("b").textContent = grid.classList.contains("show-all") ? L("តិចជាងនេះ", "Less") : L("ផ្សេងទៀត", "More");
      event.currentTarget.querySelector("i").innerHTML = icon(grid.classList.contains("show-all") ? "minus" : "plus");
    });
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    form.elements.photoFile.addEventListener("change", () => {
      const file = form.elements.photoFile.files?.[0];
      if (!file || !file.type?.startsWith("image/")) return;
      photoFile = file;
      photoPreview = URL.createObjectURL(file);
      refresh();
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
      const relationship = form.querySelector('input[name="relationship"]:checked')?.value || "";
      if (!name || !relationship) {
        root.querySelector('[data-error="name"]').textContent = !name
          ? t("required")
          : L("សូមជ្រើសទំនាក់ទំនង", "Please pick a relationship");
        if (!name) form.elements.name.focus();
        return;
      }
      const submit = form.querySelector(".ev-submit");
      submit.disabled = true;
      const data = {
        name,
        relationship,
        relatedMemberId: form.querySelector('input[name="relatedMemberId"]:checked')?.value || "",
        characterMood: form.querySelector('input[name="characterMood"]:checked')?.value || "",
        birthday: form.elements.birthday.value,
        anniversaryDate: form.elements.anniversaryDate.value,
        phone: form.elements.phone.value.trim(),
        favorite: form.elements.favorite.value.trim(),
        relationshipNote: form.elements.relationshipNote.value.trim(),
        notes: form.elements.notes.value.trim()
      };
      data.zodiacSign = (typeof zodiacSignForDate === "function" && zodiacSignForDate(data.birthday)) || member.zodiacSign || "";
      try {
        if (photoFile) {
          data.photo = await readFile(photoFile);
          data.photoPosition = { x: 0, y: 0 };
        } else {
          data.photo = member.photo || "";
        }
      } catch (error) {
        data.photo = member.photo || "";
      }
      if (member.id) Store.edit("family", member.id, data);
      else Store.add("family", data);
      Toast.show(member.id ? t("familyMemberSaved") : t("familyMemberAdded"));
      Modal.close();
    });

    refresh();
    if (!member.id) setTimeout(() => form.elements.name.focus(), 60);
  }

  return { open };
})();
