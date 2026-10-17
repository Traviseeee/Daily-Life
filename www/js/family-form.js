/* MYLIFE family member form — same style as the event and expense forms.
 * Big profile header (tap the photo to change it, type the name), emoji chips
 * for relationship and personality, partner chips with photos, birthday and
 * anniversary with live age / countdown, automatic zodiac, a care idea, and
 * folded notes. Saves the same fields as before. */
const FamilyForm = (() => {
  const RELATIONSHIPS = ["Me", "Wife", "Husband", "Girlfriend", "Boyfriend", "Mother", "Father", "Daughter", "Son", "Sister", "Brother", "Grandmother", "Grandfather", "Friend", "Other"];
  const MOODS = ["Happy", "Calm", "Cheerful", "Funny", "Caring", "Quiet", "Creative", "Energetic", "Sensitive", "Serious", "Adventurous", "Other"];
  const REL_EMOJI = { Me: "🙋", Wife: "👰", Husband: "🤵", Girlfriend: "💕", Boyfriend: "💙", Mother: "👩", Father: "👨", Daughter: "👧", Son: "👦", Sister: "👭", Brother: "👬", Grandmother: "👵", Grandfather: "👴", Friend: "🤝", Other: "✨" };
  const MOOD_EMOJI = { Happy: "😊", Calm: "😌", Cheerful: "😄", Funny: "😂", Caring: "🤗", Quiet: "🤫", Creative: "🎨", Energetic: "⚡", Sensitive: "🥺", Serious: "🧐", Adventurous: "🧗", Other: "🙂" };
  const ZODIAC = { Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓" };
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
      return `<label class="ev-cat ff-rel ${extra ? "ff-extra" : ""}" style="--tone:${tone};--tone-bg:color-mix(in srgb, ${tone} 15%, #ffffff)"><input type="radio" name="relationship" value="${escapeAttr(value)}" ${value === selected ? "checked" : ""}><i class="ev-cat-icon ff-emoji">${REL_EMOJI[value] || "•"}</i><b>${escapeHtml(label(value))}</b></label>`;
    }).join("");
    return `${tiles}<button type="button" class="ev-cat ff-more" data-ff-more><i class="ev-cat-icon ff-emoji">＋</i><b>${escapeHtml(L("ផ្សេងទៀត", "More"))}</b></button>`;
  }

  // Personality: one scrollable row of small pills (like quick expense).
  function moodPills(selected) {
    const list = [...MOODS];
    if (selected && !list.includes(selected)) list.unshift(selected);
    return list.map(value => {
      const tone = TONE[value] || "#94a3b8";
      return `<label class="ff-pill" style="--tone:${tone}"><input type="radio" name="characterMood" value="${escapeAttr(value)}" ${value === selected ? "checked" : ""}><i>${MOOD_EMOJI[value] || "🙂"}</i><b>${escapeHtml(label(value))}</b></label>`;
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
          <div class="ff-date-grid">
            <label class="ff-date">
              <span>🎂 ${escapeHtml(t("birthday"))}</span>
              <input class="ev-date" id="birthday" name="birthday" type="date" value="${escapeAttr(member.birthday || "")}">
              <small data-ff-birthday></small>
            </label>
            <label class="ff-date">
              <span>💞 ${escapeHtml(member.relatedMemberId ? t("relationshipStart") : t("anniversary"))}</span>
              <input class="ev-date" id="anniversaryDate" name="anniversaryDate" type="date" value="${escapeAttr(member.anniversaryDate || "")}">
              <small data-ff-anniversary></small>
            </label>
          </div>
          <div class="ff-zodiac" data-ff-zodiac></div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.gift()}<strong>${escapeHtml(L("ថែរក្សាទំនាក់ទំនង", "Care"))}</strong></div>
          <div class="ff-care-grid">
            <label class="ff-field"><span>📞 ${escapeHtml(t("phone"))}</span><input class="ev-date" id="phone" name="phone" type="tel" inputmode="tel" placeholder="012 345 678" value="${escapeAttr(member.phone || "")}"></label>
            <label class="ff-field"><span>⭐ ${escapeHtml(t("favorite"))}</span><input class="ev-date" id="favorite" name="favorite" type="text" placeholder="${escapeAttr(L("ម្ហូប ពណ៌ កាដូ…", "Food, colour, gifts…"))}" value="${escapeAttr(member.favorite || "")}"></label>
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
      : `<b>${escapeHtml(name ? name.charAt(0).toUpperCase() : REL_EMOJI[relationship] || "🙂")}</b>`;

    root.querySelector("[data-ff-meta]").textContent = [
      relationship ? `${REL_EMOJI[relationship] || ""} ${label(relationship)}` : "",
      mood ? `${MOOD_EMOJI[mood] || ""} ${label(mood)}` : "",
      sign ? `${ZODIAC[sign] || ""} ${label(sign)}` : ""
    ].filter(Boolean).join("  ·  ") || L("ជ្រើសទំនាក់ទំនង និងចរិតខាងក្រោម", "Pick a relationship and personality below");

    const b = nextInfo(birthday);
    const birthdayText = !b ? "" : b.days === 0
      ? L(`🎉 ថ្ងៃនេះខួបកំណើត ${b.years} ឆ្នាំ!`, `🎉 Turns ${b.years} today!`)
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

    root.querySelector("[data-ff-dates]").textContent = [b ? `🎂 ${birthdayText}` : "", anniversaryText ? `💞 ${anniversaryText}` : ""].filter(Boolean).join("   ");
    root.querySelector("[data-ff-zodiac]").innerHTML = sign
      ? `<span class="ff-zodiac-sign">${ZODIAC[sign] || "✦"}</span><b>${escapeHtml(label(sign))}</b><small>${escapeHtml(L("គណនាពីថ្ងៃកំណើតដោយស្វ័យប្រវត្តិ", "worked out from the birthday"))}</small>`
      : `<small>${escapeHtml(L("✦ រាសីនឹងលេចឡើងពេលបញ្ចូលថ្ងៃកំណើត", "✦ The zodiac sign appears once a birthday is set"))}</small>`;

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
      event.currentTarget.querySelector("i").textContent = grid.classList.contains("show-all") ? "－" : "＋";
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
