/* Upgrades the family member form (openFamilyModal) in place:
 * live profile preview, relationship and personality as emoji chips,
 * age / next birthday / years together worked out as you type, auto zodiac.
 * The original selects stay in the form (hidden) so saving is unchanged. */
const FamilyFormUX = (() => {
  const REL_EMOJI = { Me: "🙋", Wife: "👰", Husband: "🤵", Girlfriend: "💕", Boyfriend: "💙", Mother: "👩", Father: "👨", Daughter: "👧", Son: "👦", Sister: "👭", Brother: "👬", Grandmother: "👵", Grandfather: "👴", Friend: "🤝", Other: "✨" };
  const MOOD_EMOJI = { Happy: "😊", Calm: "😌", Cheerful: "😄", Funny: "😂", Caring: "🤗", Quiet: "🤫", Creative: "🎨", Energetic: "⚡", Sensitive: "🥺", Serious: "🧐", Adventurous: "🧗", Other: "🙂" };
  const ZODIAC = { Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓" };
  const km = () => languageCode() === "km";

  function chipify(select, emojiMap) {
    if (!select) return null;
    const row = document.createElement("div");
    row.className = "ff-chips";
    [...select.options].forEach(option => {
      if (!option.value) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ff-chip";
      chip.dataset.value = option.value;
      chip.innerHTML = `<span>${emojiMap[option.value] || "•"}</span><b>${escapeHtml(option.textContent)}</b>`;
      chip.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        sync();
      });
      row.appendChild(chip);
    });
    const sync = () => row.querySelectorAll(".ff-chip").forEach(chip => chip.classList.toggle("active", chip.dataset.value === select.value));
    select.classList.add("ff-hidden-select");
    select.after(row);
    sync();
    return sync;
  }

  function daysUntil(value) {
    if (!value) return null;
    const original = new Date(`${value}T00:00:00`);
    if (Number.isNaN(original.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = nextYearlyDate(value, today);
    return { days: Math.round((next - today) / 86400000), years: next.getFullYear() - original.getFullYear(), age: next.getFullYear() - original.getFullYear() - (Math.round((next - today) / 86400000) === 0 ? 0 : 1) };
  }

  function togetherLabel(value) {
    if (!value) return "";
    const start = new Date(`${value}T00:00:00`);
    const now = new Date();
    if (Number.isNaN(start.getTime()) || start > now) return "";
    let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
    if (now.getDate() < start.getDate()) months -= 1;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const info = daysUntil(value);
    const parts = km() ? `${years ? `${years} ឆ្នាំ ` : ""}${rest} ខែ ជាមួយគ្នា` : `${years ? `${years}y ` : ""}${rest}m together`;
    return `💞 ${parts}${info ? ` · ${km() ? `ខួបក្នុង ${info.days} ថ្ងៃទៀត` : `anniversary in ${info.days} days`}` : ""}`;
  }

  function hint(input) {
    let el = input.parentElement.querySelector(".ff-hint");
    if (!el) {
      el = document.createElement("small");
      el.className = "ff-hint";
      input.parentElement.appendChild(el);
    }
    return el;
  }

  function enhance(form) {
    if (!form || form.dataset.ffEnhanced) return;
    form.dataset.ffEnhanced = "1";
    const $ = id => form.querySelector(`#${id}`);
    const name = $("name");
    const relationship = $("relationship");
    const mood = $("characterMood");
    const birthday = $("birthday");
    const anniversary = $("anniversaryDate");
    const zodiac = $("zodiacSign");
    const photo = $("photo");
    const phone = $("phone");
    if (phone) {
      phone.type = "tel";
      phone.inputMode = "tel";
      phone.placeholder = "012 345 678";
    }
    if (name) name.placeholder = km() ? "ឈ្មោះ ឬឈ្មោះហៅក្រៅ" : "Name or nickname";

    // live preview card
    const hero = document.createElement("div");
    hero.className = "ff-hero";
    hero.innerHTML = `<div class="ff-avatar" data-ff-avatar></div><div class="ff-hero-copy"><strong data-ff-name></strong><span data-ff-meta></span><small data-ff-dates></small></div>`;
    form.querySelector(".form-grid")?.before(hero);
    const existingPhoto = (() => {
      const id = $("existingMember")?.value;
      return (appData.family.find(item => item.id === id) || {}).photo || "";
    })();
    let photoUrl = existingPhoto;

    const syncRel = chipify(relationship, REL_EMOJI);
    const syncMood = chipify(mood, MOOD_EMOJI);

    const update = () => {
      const label = String(name?.value || "").trim();
      hero.querySelector("[data-ff-name]").textContent = label || (km() ? "សមាជិកថ្មី" : "New member");
      const avatar = hero.querySelector("[data-ff-avatar]");
      avatar.innerHTML = photoUrl ? `<img src="${escapeAttr(photoUrl)}" alt="">` : `<span>${escapeHtml(label ? label.charAt(0).toUpperCase() : REL_EMOJI[relationship?.value] || "🙂")}</span>`;
      const rel = relationship?.value ? `${REL_EMOJI[relationship.value] || ""} ${optionLabel(relationship.value)}` : "";
      const moodText = mood?.value ? `${MOOD_EMOJI[mood.value] || ""} ${optionLabel(mood.value)}` : "";
      const sign = zodiac?.value ? `${ZODIAC[zodiac.value] || ""} ${optionLabel(zodiac.value)}` : "";
      hero.querySelector("[data-ff-meta]").textContent = [rel, moodText, sign].filter(Boolean).join(" · ");

      const lines = [];
      const b = daysUntil(birthday?.value);
      if (b) {
        const text = b.days === 0
          ? (km() ? `🎂 ថ្ងៃនេះខួបកំណើត ${b.years} ឆ្នាំ!` : `🎂 Turns ${b.years} today!`)
          : (km() ? `🎂 អាយុ ${b.age} ឆ្នាំ · ខួបកំណើតក្នុង ${b.days} ថ្ងៃទៀត` : `🎂 ${b.age} years · birthday in ${b.days} days`);
        lines.push(text);
        if (birthday) hint(birthday).textContent = text;
      } else if (birthday) hint(birthday).textContent = "";
      const together = togetherLabel(anniversary?.value);
      if (together) lines.push(together);
      if (anniversary) hint(anniversary).textContent = together;
      hero.querySelector("[data-ff-dates]").textContent = lines.join("  ·  ");
      if (zodiac) hint(zodiac).textContent = zodiac.value ? `${ZODIAC[zodiac.value] || ""} ${km() ? "គណនាពីថ្ងៃកំណើតដោយស្វ័យប្រវត្តិ" : "set from the birthday"}` : "";
    };

    [name, relationship, mood, birthday, anniversary, zodiac].forEach(input => {
      input?.addEventListener("input", update);
      input?.addEventListener("change", update);
    });
    photo?.addEventListener("change", () => {
      const file = photo.files?.[0];
      if (!file) return;
      photoUrl = URL.createObjectURL(file);
      update();
    });
    $("existingMember")?.addEventListener("change", () => {
      setTimeout(() => {
        const selected = appData.family.find(item => item.id === $("existingMember").value);
        photoUrl = selected?.photo || "";
        syncRel?.();
        syncMood?.();
        update();
      }, 0);
    });
    update();
  }

  return { enhance };
})();
