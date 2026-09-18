let familyMediaTimer = null;

function renderFamily() {
  const familyEvents = appData.calendarEvents.filter(event => event.category === "Family");
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.family()}</span>${t("family")}</h1>
          <p class="page-subtitle">${t("familySubtitle")}</p>
        </div>
        <div class="action-row family-page-actions">
          <button class="button ghost-button" data-action="add-self">${Icons.user()} ${t("addMyself")}</button>
          <button class="button" data-action="add-family">${Icons.plus()} ${t("addFamilyMember")}</button>
        </div>
      </div>
      ${familyMediaCard()}
      ${appData.family.length ? `<div class="grid three-col">${appData.family.map(memberCard).join("")}</div>` : familyEmptyCard()}
      ${relationshipAnniversaryCards()}
      ${familyPhotoCard()}
      <div class="grid two-col" style="margin-top:18px">
        <article class="glass-card card-pad">
          <div class="between">
            <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.calendar()}</span>${t("familyEvents")}</h2>
            <button class="button ghost-button" type="button" data-action="add-event">${Icons.plus()} ${t("addEvent")}</button>
          </div>
          <div class="list">
            ${familyEvents.map(event => `<div class="list-row"><span class="icon-badge green">${Icons.calendar()}</span><strong>${event.title}</strong><span class="secondary">${formatDate(event.date)}</span><button class="icon-button" data-edit-event="${event.id}" aria-label="${t("editEvent")}">${Icons.edit()}</button><button class="icon-button" data-delete-event="${event.id}" aria-label="${t("deleteEvent")}">${Icons.trash()}</button></div>`).join("") || emptyState(t("noFamilyEvents"), t("noFamilyEventsBody"), t("addEvent"), "add-event")}
          </div>
        </article>
        <article class="glass-card card-pad">
          <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.chart()}</span>${t("familySnapshot")}</h2>
          <div class="kv">
            <div><span>${t("members")}</span><strong>${appData.family.length}</strong></div>
            <div><span>${t("events")}</span><strong>${familyEvents.length}</strong></div>
            <div><span>${t("upcomingBirthdays")}</span><strong>${appData.family.filter(member => member.birthday).length}</strong></div>
          </div>
        </article>
      </div>
    </section>
  `;
}

function familyMediaCard() {
  const media = Array.isArray(appData.familyMedia) ? appData.familyMedia : [];
  const active = media[0];
  return `
    <article class="glass-card family-media-card">
      <div class="family-photo-heading">
        <div><h2>${escapeHtml(t("familyMediaHelp"))}</h2></div>
        <label class="icon-button family-media-add" title="${escapeAttr(t("addFamilyMedia"))}">${Icons.plus()}<input type="file" accept="image/*,video/*" multiple data-family-media></label>
      </div>
      ${active ? `<div class="family-media-stage">${active.type === "video" ? `<video src="${escapeAttr(active.src)}" muted loop playsinline></video>` : `<img src="${escapeAttr(active.src)}" alt="${escapeAttr(t("familyMedia"))}">`}<div class="family-media-toolbar"><label class="family-media-action family-media-edit" title="${escapeAttr(t("edit"))}">${Icons.edit()}<input type="file" accept="image/*,video/*" data-family-media-edit="0"></label><button class="family-media-action family-media-remove" type="button" data-family-media-remove="0" aria-label="${escapeAttr(t("delete"))}">${Icons.trash()}</button></div><button class="family-media-control family-media-prev" type="button" data-family-media-prev aria-label="Previous">${Icons.chevron()}</button><button class="family-media-control family-media-next" type="button" data-family-media-next aria-label="Next">${Icons.chevron()}</button></div><div class="family-media-dots">${media.map((item, index) => `<button type="button" class="family-media-dot ${index === 0 ? "active" : ""}" data-family-media-index="${index}" aria-label="${index + 1}"></button>`).join("")}</div>` : `<div class="family-media-empty">${Icons.memory()}<span>${escapeHtml(t("noFamilyMedia"))}</span></div>`}
    </article>
  `;
}

function relationshipAnniversaryCards() {
  const seenPairs = new Set();
  return appData.family.filter(member => member.relatedMemberId && member.anniversaryDate).map(member => {
    const relatedMember = appData.family.find(item => item.id === member.relatedMemberId);
    if (!relatedMember) return "";
    const pairKey = [member.id, relatedMember.id].sort().join(":");
    if (seenPairs.has(pairKey)) return "";
    seenPairs.add(pairKey);
    return relationshipAnniversaryCard(member);
  }).join("");
}

function relationshipAnniversaryCard(member) {
  const relatedMember = appData.family.find(item => item.id === member.relatedMemberId);
  if (!relatedMember) return "";
  const days = daysSinceDate(member.anniversaryDate);
  const nextMilestone = Math.ceil(Math.max(days, 1) / 1000) * 1000;
  const previousMilestone = Math.max(nextMilestone - 1000, 0);
  const progress = Math.min(100, Math.max(0, ((days - previousMilestone) / (nextMilestone - previousMilestone || 1)) * 100));
  const anniversaryDate = nextAnnualDate(member.anniversaryDate);
  const birthdayDates = [nextBirthdayDate(member.birthday), nextBirthdayDate(relatedMember.birthday)].filter(Boolean).sort();
  const upcomingBirthday = birthdayDates[0] || "";
  return `
    <article class="glass-card family-anniversary-card">
      <div class="family-anniversary-heading">
        <div><span class="eyebrow">${escapeHtml(t("ourAnniversary"))}</span><h2>${escapeHtml(member.name)} &amp; ${escapeHtml(relatedMember.name)}</h2></div>
        <span class="icon-badge green">${Icons.spark()}</span>
      </div>
      <div class="family-anniversary-hero">
        <strong>${escapeHtml(t("beenTogether"))}</strong>
        <span>${days} ${escapeHtml(t("days"))}</span>
      </div>
      <div class="family-anniversary-timeline" style="--timeline-progress: ${progress}%">
        <div class="family-anniversary-track"><span></span></div>
        <div class="family-anniversary-milestone"><strong>${previousMilestone}</strong><span>${escapeHtml(t("days"))}</span></div>
        <div class="family-anniversary-milestone current"><strong>${days}</strong><span>${escapeHtml(t("today"))}</span></div>
        <div class="family-anniversary-milestone"><strong>${nextMilestone}</strong><span>${escapeHtml(t("days"))}</span></div>
      </div>
      <div class="family-anniversary-stats">
        <div><span>${escapeHtml(t("relationshipStart"))}</span><strong>${formatDate(member.anniversaryDate)}</strong></div>
        <div><span>${escapeHtml(t("nextAnniversary"))}</span><strong>${formatDate(anniversaryDate)}</strong></div>
        ${upcomingBirthday ? `<div><span>${escapeHtml(t("upcomingBirthday"))}</span><strong>${formatDate(upcomingBirthday)}</strong></div>` : ""}
      </div>
    </article>
  `;
}

function nextAnnualDate(value) {
  const start = parseAppDate(value);
  const next = new Date(new Date().getFullYear(), start.getMonth(), start.getDate());
  if (next <= new Date()) next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

function nextBirthdayDate(value) {
  if (!value) return "";
  const birthDate = parseAppDate(value);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let next = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

function familyPhotoCard() {
  const image = getFamilyPhoto();
  const position = storedImagePosition("mylife:family-photo-position");
  return `
    <article class="glass-card family-photo-card">
      <div class="family-photo-heading">
        <div>
          <span class="eyebrow">${languageCode() === "km" ? "រូបថតគ្រួសារ" : "FAMILY PHOTO"}</span>
          <h2>${languageCode() === "km" ? "រូបថតរបស់យើង" : "A photo of us"}</h2>
        </div>
        <span class="icon-badge green">${Icons.memory()}</span>
      </div>
      <div class="family-photo-frame">
        ${image ? `<img src="${escapeAttr(image)}" style="--image-position-x: ${position.x}%; --image-position-y: ${position.y}%;" alt="${languageCode() === "km" ? "រូបថតគ្រួសារ" : "Family photo"}">` : `<span>${Icons.family()}</span>`}
      </div>
      <label class="button family-photo-upload">${image ? (languageCode() === "km" ? "ប្តូររូបថត" : "Change photo") : (languageCode() === "km" ? "បន្ថែមរូបថត" : "Add photo")}<input type="file" accept="image/*" data-family-photo></label>
    </article>
  `;
}

function getFamilyPhoto() {
  try {
    return localStorage.getItem("mylife:family-photo") || "";
  } catch (error) {
    return "";
  }
}

function familyEmptyCard() {
  return `
    <article class="glass-card family-empty-card">
      <img src="https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=900&q=78" alt="" loading="lazy">
      <div class="family-empty-content">
        <span class="icon-badge green">${Icons.plus()}</span>
        <h2>${escapeHtml(t("noFamilyYet"))}</h2>
        <p class="secondary">${escapeHtml(t("noFamilyBody"))}</p>
        <div class="action-row family-empty-actions">
          <button class="button ghost-button" data-action="add-self">${Icons.user()} ${t("addMyself")}</button>
          <button class="button" data-action="add-family">${Icons.plus()} ${t("addFamilyMember")}</button>
        </div>
      </div>
    </article>
  `;
}

function memberCard(member) {
  const relatedMember = appData.family.find(item => item.id === member.relatedMemberId);
  const relationshipDays = relatedMember ? daysSinceDate(member.anniversaryDate) : 0;
  return `
    <article class="glass-card card-pad family-member-card">
      <div class="family-member-head">
        <span class="thumb">${member.photo ? `<img src="${member.photo}" alt="">` : initials(member.name)}</span>
        <div class="family-member-identity">
          <h2>${escapeHtml(member.name)}</h2>
          <p class="secondary">${escapeHtml(member.relationship)}${relatedMember ? ` · ${escapeHtml(relatedMember.name)}` : ""}</p>
        </div>
        <span class="action-row">
          <button class="icon-button" data-edit-family="${member.id}" aria-label="Edit ${member.name}">${Icons.edit()}</button>
          <button class="icon-button" data-delete-family="${member.id}" aria-label="Delete ${member.name}">${Icons.trash()}</button>
        </span>
      </div>
      <div class="family-detail-tags">
        ${member.zodiacSign ? `<span class="pill family-zodiac-tag">${escapeHtml(member.zodiacSign)}</span>` : ""}
        ${member.characterMood ? `<span class="pill family-mood-tag">${escapeHtml(member.characterMood)}</span>` : ""}
        ${member.favorite ? `<span class="pill family-favorite-tag">${escapeHtml(member.favorite)}</span>` : ""}
      </div>
      ${relationshipDays ? `<p class="secondary family-relationship-duration">${escapeHtml(t("togetherFor").replace("{days}", relationshipDays))}</p>` : ""}
      <div class="kv">
        <div><span>${t("birthday")}</span><strong>${formatDate(member.birthday, { month: "short", day: "numeric" })}</strong></div>
        <div><span>${t("anniversary")}</span><strong>${formatDate(member.anniversaryDate, { month: "short", day: "numeric" })}</strong></div>
        <div><span>${t("phone")}</span><strong>${escapeHtml(member.phone || t("notSet"))}</strong></div>
      </div>
      <div class="family-smart-insight">
        <span class="family-insight-icon">${Icons.spark()}</span>
        <span>${escapeHtml(familyCareIdea(member))}</span>
      </div>
      ${member.relationshipNote ? `<p class="secondary family-relationship-note">${escapeHtml(member.relationshipNote)}</p>` : ""}
      <p class="muted">${escapeHtml(member.notes || "")}</p>
    </article>
  `;
}

function familyFields(member = {}) {
  const relationshipOptions = ["Me", "Wife", "Husband", "Girlfriend", "Boyfriend", "Mother", "Father", "Daughter", "Son", "Sister", "Brother", "Grandmother", "Grandfather", "Friend", "Other"];
  const zodiacOptions = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
  const moodOptions = ["Happy", "Calm", "Cheerful", "Funny", "Caring", "Quiet", "Creative", "Energetic", "Sensitive", "Serious", "Adventurous", "Other"];
  if (member.relationship && !relationshipOptions.includes(member.relationship)) relationshipOptions.unshift(member.relationship);
  if (member.zodiacSign && !zodiacOptions.includes(member.zodiacSign)) zodiacOptions.unshift(member.zodiacSign);
  if (member.characterMood && !moodOptions.includes(member.characterMood)) moodOptions.unshift(member.characterMood);
  const relatedMembers = appData.family.filter(item => item.id !== member.id);
  const fields = [
    { type: "heading", label: t("familyProfileSection"), description: t("familyProfileSectionHelp") },
    ...(appData.family.length ? [{ name: "existingMember", label: t("chooseExistingMember"), type: "select", options: ["", ...appData.family.map(item => item.id)], optionLabels: [t("newFamilyProfile"), ...appData.family.map(item => item.name)], value: member.id || "" }] : []),
    { name: "name", label: t("name"), value: member.name, required: true },
    { name: "relationship", label: t("relationship"), type: "select", options: relationshipOptions, value: member.relationship, required: true },
    { name: "relatedMemberId", label: t("relatedPerson"), type: "select", options: ["", ...relatedMembers.map(item => item.id)], optionLabels: [t("noRelatedPerson"), ...relatedMembers.map(item => item.name)], value: member.relatedMemberId || "" },
    { name: "characterMood", label: t("characterMood"), type: "select", options: moodOptions, value: member.characterMood },
    { type: "heading", label: t("familyDatesSection"), description: t("familyDatesSectionHelp") },
    { name: "birthday", label: t("birthday"), type: "date", value: member.birthday },
    { name: "zodiacSign", label: t("zodiacSign"), type: "select", options: zodiacOptions, value: member.zodiacSign },
    { name: "anniversaryDate", label: member.relatedMemberId ? t("relationshipStart") : t("anniversary"), type: "date", value: member.anniversaryDate },
    { type: "heading", label: t("familyCareSection"), description: t("familyCareSectionHelp") },
    { name: "phone", label: t("phone"), value: member.phone },
    { name: "favorite", label: t("favorite"), value: member.favorite },
    { name: "relationshipNote", label: t("relationshipNote"), type: "textarea", value: member.relationshipNote },
    { name: "notes", label: t("notes"), type: "textarea", value: member.notes },
    { name: "photo", label: t("photo"), type: "file", value: member.photo }
  ];
  return fields;
}

function daysSinceDate(value) {
  if (!value) return 0;
  const start = parseAppDate(value);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today - start) / 86400000);
  return days >= 0 ? days : 0;
}

function openFamilyModal(member) {
  const isEditing = Boolean(member?.id);
  let activeMember = member;
  Modal.open({
    title: isEditing ? t("editFamilyMember") : t("addFamilyMember"),
    submitText: isEditing ? t("saveFamilyMember") : t("addFamilyMember"),
    wide: true,
    fields: familyFields(member),
    onSubmit(data) {
      data.zodiacSign = zodiacSignForDate(data.birthday) || data.zodiacSign || "";
      const existing = data.existingMember ? appData.family.find(item => item.id === data.existingMember) : null;
      if (existing && !data.photo) data.photo = existing.photo || "";
      delete data.existingMember;
      if (isEditing || existing) Store.edit("family", (activeMember || existing).id, data);
      else Store.add("family", data);
      Toast.show(isEditing || existing ? t("familyMemberSaved") : t("familyMemberAdded"));
    }
  });
  const form = document.querySelector("#modalForm");
  form?.classList.add("family-modal");
  const relationshipInput = document.querySelector("#relationship");
  const existingMemberInput = document.querySelector("#existingMember");
  const moodInput = document.querySelector("#characterMood");
  const favoriteInput = document.querySelector("#favorite");
  const guide = document.createElement("div");
  guide.className = "family-smart-guide";
  guide.innerHTML = `<span class="family-insight-icon">${Icons.spark()}</span><div><strong>${escapeHtml(t("smartFamilyGuide"))}</strong><p></p></div>`;
  form?.querySelector(".between:last-child")?.before(guide);
  const updateGuide = () => {
    guide.querySelector("p").textContent = familyCareIdea({
      name: document.querySelector("#name")?.value,
      relationship: relationshipInput?.value,
      characterMood: moodInput?.value,
      favorite: favoriteInput?.value
    });
  };
  existingMemberInput?.addEventListener("change", () => {
    const selected = appData.family.find(item => item.id === existingMemberInput.value);
    if (!selected) return;
    activeMember = selected;
    ["name", "relationship", "relatedMemberId", "characterMood", "birthday", "zodiacSign", "anniversaryDate", "phone", "favorite", "relationshipNote", "notes"].forEach(name => {
      const input = document.querySelector(`#${name}`);
      if (input) input.value = selected[name] || "";
    });
    updateGuide();
  });
  [relationshipInput, moodInput, favoriteInput].forEach(input => input?.addEventListener("input", updateGuide));
  updateGuide();
  const birthdayInput = document.querySelector("#birthday");
  const zodiacInput = document.querySelector("#zodiacSign");
  birthdayInput?.addEventListener("change", () => {
    const sign = zodiacSignForDate(birthdayInput.value);
    if (sign && zodiacInput) zodiacInput.value = sign;
  });
}

function openSelfFamilyModal() {
  const existing = appData.family.find(item => item.relationship === "Me");
  openFamilyModal(existing || {
    name: appData.profile.name || "",
    relationship: "Me",
    birthday: "",
    anniversaryDate: "",
    phone: "",
    characterMood: "",
    zodiacSign: "",
    favorite: "",
    relationshipNote: "",
    notes: "",
    photo: appData.profile.photo || ""
  });
}

function familyCareIdea(member = {}) {
  const name = member.name || t("thisPerson");
  const relationship = String(member.relationship || "").toLowerCase();
  const mood = String(member.characterMood || "").toLowerCase();
  const favorite = member.favorite ? ` ${member.favorite} could make it feel personal.` : "";
  const openings = {
    wife: "Make space for a calm check-in and one thoughtful act today.",
    husband: "Notice one thing he carries for the family and thank him for it.",
    girlfriend: "Send a warm message or plan a small moment that feels like yours.",
    boyfriend: "Share a little encouragement and make time for an easy conversation.",
    mother: "Ask how she is doing, then listen without rushing to solve it.",
    father: "Call, check in, or invite him to share a story from his day.",
    daughter: "Give her attention, encouragement, and room to be herself.",
    son: "Ask about what is on his mind and celebrate a small win with him.",
    sister: "Send a playful message or offer help before she needs to ask.",
    brother: "Reconnect through a shared joke, memory, or simple plan.",
    grandmother: "Give her time, patience, and a story she can enjoy sharing.",
    grandfather: "Ask about his memories and let him know his presence matters.",
    friend: "Reach out with a genuine message and suggest a low-pressure catch-up."
  };
  const moodAdditions = {
    quiet: "Keep the gesture gentle and give them breathing room.",
    sensitive: "Use soft words and let them know they are safe with you.",
    energetic: "Turn the connection into a small activity or shared adventure.",
    tired: "Offer practical help or a peaceful moment instead of adding pressure.",
    stressed: "Ask what would make today lighter, then help with one small thing."
  };
  const opening = openings[relationship] || "Choose one small, sincere way to show this person they matter to you.";
  return `${name}: ${moodAdditions[mood] || opening}${moodAdditions[mood] ? ` ${opening}` : ""}${favorite}`;
}

function zodiacSignForDate(value) {
  const date = parseAppDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
  return "Pisces";
}

function bindFamily(options = {}) {
  document.querySelector("[data-family-media]")?.addEventListener("change", async event => {
    const files = [...(event.target.files || [])].slice(0, 8);
    const validFiles = files.filter(file => file.size <= 15 * 1024 * 1024);
    if (validFiles.length < files.length) Toast.show(t("mediaTooLarge"));
    const additions = await Promise.all(validFiles.map(async file => ({
      id: `family-media-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: file.type.startsWith("video/") ? "video" : "image",
      src: file.type.startsWith("image/") ? await readImageFile(file) : await readRawFile(file)
    })));
    appData.familyMedia = [...(appData.familyMedia || []), ...additions].slice(-8);
    Store.save();
    App.render();
  });
  document.querySelectorAll("[data-family-media-prev], [data-family-media-next], [data-family-media-index]").forEach(button => button.addEventListener("click", () => {
    const media = appData.familyMedia || [];
    if (!media.length) return;
    const current = Number(document.querySelector(".family-media-dot.active")?.dataset.familyMediaIndex || 0);
    const next = button.dataset.familyMediaIndex !== undefined ? Number(button.dataset.familyMediaIndex) : button.hasAttribute("data-family-media-next") ? (current + 1) % media.length : (current - 1 + media.length) % media.length;
    const selected = media[next];
    const stage = document.querySelector(".family-media-stage");
    if (!stage || !selected) return;
    stage.innerHTML = `${selected.type === "video" ? `<video src="${escapeAttr(selected.src)}" muted loop playsinline></video>` : `<img src="${escapeAttr(selected.src)}" alt="${escapeAttr(t("familyMedia"))}">`}<div class="family-media-toolbar"><label class="family-media-action family-media-edit" title="${escapeAttr(t("edit"))}">${Icons.edit()}<input type="file" accept="image/*,video/*" data-family-media-edit="${next}"></label><button class="family-media-action family-media-remove" type="button" data-family-media-remove="${next}" aria-label="${escapeAttr(t("delete"))}">${Icons.trash()}</button></div><button class="family-media-control family-media-prev" type="button" data-family-media-prev aria-label="Previous">${Icons.chevron()}</button><button class="family-media-control family-media-next" type="button" data-family-media-next aria-label="Next">${Icons.chevron()}</button>`;
    document.querySelectorAll(".family-media-dot").forEach(dot => dot.classList.toggle("active", Number(dot.dataset.familyMediaIndex) === next));
    bindFamilyMediaStage();
  }));
  bindFamilyMediaActions();
  if (options.mediaOnly) {
    startFamilyMediaSlideshow();
    return;
  }
  document.querySelector("[data-family-photo]")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      const card = event.target.closest(".family-photo-card");
      if (!card) return;

      const editor = createImagePositionEditor({
        src: dataUrl,
        key: "family-photo",
        title: languageCode() === "km" ? "លៃតម្រូវរូបថត" : "Adjust photo",
        onSave: position => {
          if (!isGuestMode()) {
            localStorage.setItem("mylife:family-photo", dataUrl);
            localStorage.setItem("mylife:family-photo-position", JSON.stringify(position));
          }
          App.render();
        },
        onCancel: () => {
          event.target.value = "";
        }
      });
      card.appendChild(editor);
    } catch (error) {
      Toast.show(languageCode() === "km" ? "មិនអាចបញ្ចូលរូបថតបានទេ" : "The photo could not be uploaded.");
    }
  });
  document.querySelectorAll('[data-action="add-family"]').forEach(button => button.addEventListener("click", () => openFamilyModal()));
  document.querySelectorAll('[data-action="add-self"]').forEach(button => button.addEventListener("click", openSelfFamilyModal));
  document.querySelectorAll("[data-edit-family]").forEach(button => button.addEventListener("click", () => openFamilyModal(appData.family.find(item => item.id === button.dataset.editFamily))));
  document.querySelectorAll("[data-delete-family]").forEach(button => button.addEventListener("click", () => {
    Modal.confirm({ title: t("deleteFamilyMember"), message: t("deleteFamilyMessage"), confirmText: t("delete"), onConfirm: () => {
      Store.delete("family", button.dataset.deleteFamily);
      Toast.show(t("familyMemberDeleted"));
    }});
  }));
  document.querySelectorAll('[data-action="add-event"]').forEach(button => button.addEventListener("click", () => App.openEventModal({ category: "Family" })));
  document.querySelectorAll("[data-edit-event]").forEach(button => button.addEventListener("click", () => App.openEventModal(appData.calendarEvents.find(item => item.id === button.dataset.editEvent))));
  document.querySelectorAll("[data-delete-event]").forEach(button => button.addEventListener("click", () => {
    Modal.confirm({ title: t("deleteEvent"), message: t("deleteEventMessage"), confirmText: t("delete"), onConfirm: () => {
      Store.delete("calendarEvents", button.dataset.deleteEvent);
      Toast.show(t("eventDeleted"));
    }});
  }));
  startFamilyMediaSlideshow();
}

function startFamilyMediaSlideshow() {
  clearInterval(familyMediaTimer);
  familyMediaTimer = null;
  // Manual-only slideshow: no automatic advance to avoid distracting autoplay.
}

function bindFamilyMediaActions() {
  document.querySelectorAll("[data-family-media-edit]").forEach(input => input.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const index = Number(event.target.dataset.familyMediaEdit);
    const media = [...(appData.familyMedia || [])];
    if (!media[index]) return;
    const replacement = {
      ...media[index],
      type: file.type.startsWith("video/") ? "video" : "image",
      src: file.type.startsWith("image/") ? await readImageFile(file) : await readRawFile(file)
    };
    media[index] = replacement;
    appData.familyMedia = media;
    event.target.value = "";
    Store.save();
    App.render();
  }));
  document.querySelectorAll("[data-family-media-remove]").forEach(button => button.addEventListener("click", () => {
    const index = Number(button.dataset.familyMediaRemove);
    const media = [...(appData.familyMedia || [])];
    if (!media[index]) return;
    media.splice(index, 1);
    appData.familyMedia = media;
    Store.save();
    App.render();
  }));
}

function bindFamilyMediaStage() {
  document.querySelectorAll(".family-media-stage [data-family-media-prev], .family-media-stage [data-family-media-next]").forEach(button => button.addEventListener("click", () => {
    const media = appData.familyMedia || [];
    if (!media.length) return;
    const current = Number(document.querySelector(".family-media-dot.active")?.dataset.familyMediaIndex || 0);
    const next = button.hasAttribute("data-family-media-next") ? (current + 1) % media.length : (current - 1 + media.length) % media.length;
    document.querySelector(`.family-media-dot[data-family-media-index="${next}"]`)?.click();
  }));
  bindFamilyMediaActions();
}
