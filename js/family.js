let familyMediaTimer = null;

function renderFamily() {
  const familyEvents = appData.calendarEvents.filter(event => event.category === "Family");
  const hasFamily = appData.family.length > 0;

  if (!hasFamily) {
    return `
      <section class="page family-empty-page">
        <div data-family-group></div>
        ${familyEmptyCard()}
      </section>
    `;
  }

  // Family V2 (js/family-v2.js); the old layout below stays as a fallback
  if (typeof FamilyV2 !== "undefined") return FamilyV2.render();

  return `
    <section class="page family-page">
      <div class="page-header fam-head">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.family()}</span>${t("family")}</h1>
          <p class="page-subtitle">${t("familySubtitle")}</p>
        </div>
        <button class="fam-add" type="button" data-action="add-family" aria-label="${escapeAttr(t("addFamilyMember"))}" title="${escapeAttr(t("addFamilyMember"))}">${Icons.plus()}</button>
      </div>
      <div data-family-group></div>
      ${familyAvatarRow()}
      ${typeof MemoryFeed !== "undefined" ? MemoryFeed.familyTeaser() : ""}
      ${familyComingUp()}
      ${familyMediaCard()}
      <div class="grid three-col">${appData.family.map(memberCard).join("")}</div>
      ${relationshipAnniversaryCards()}
      ${familyPhotoCard()}
      <div class="grid two-col family-overview-grid">
        <article class="glass-card card-pad family-events-panel">
          <div class="between">
            <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.calendar()}</span>${t("familyEvents")}</h2>
            <button class="button ghost-button" type="button" data-action="add-event">${Icons.plus()} ${t("addEvent")}</button>
          </div>
          <div class="list family-event-list">
            ${familyEvents.map(event => `<div class="family-event-card"><span class="icon-badge green">${Icons.calendar()}</span><div class="family-event-copy"><strong>${escapeHtml(event.title)}</strong><span>${formatDate(event.date)}</span></div><div class="family-event-actions"><button class="icon-button" data-edit-event="${escapeAttr(event.id)}" aria-label="${escapeAttr(t("editEvent"))}">${Icons.edit()}</button><button class="icon-button" data-delete-event="${escapeAttr(event.id)}" aria-label="${escapeAttr(t("deleteEvent"))}">${Icons.trash()}</button></div></div>`).join("") || `<p class="family-events-empty">${Icons.calendar()}<span>${escapeHtml(t("noFamilyEvents"))}</span></p>`}
          </div>
        </article>
        <article class="glass-card card-pad family-summary-panel">
          <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.chart()}</span>${t("familySnapshot")}</h2>
          <div class="family-summary-grid">
            <div class="family-summary-item"><span class="family-summary-icon">${Icons.family()}</span><span class="family-summary-label">${t("members")}</span><strong>${appData.family.length}</strong></div>
            <div class="family-summary-item"><span class="family-summary-icon">${Icons.calendar()}</span><span class="family-summary-label">${t("events")}</span><strong>${familyEvents.length}</strong></div>
            <div class="family-summary-item"><span class="family-summary-icon">${Icons.cake()}</span><span class="family-summary-label">${t("upcomingBirthdays")}</span><strong>${appData.family.filter(member => member.birthday).length}</strong></div>
          </div>
        </article>
      </div>
    </section>
  `;
}

// Hero card: "my family · N", the next birthday, and a row of round photos —
// "me" first (dashed + when not added yet), the family, then +. Tap a photo to
// jump to that person's card. A ring marks a birthday in the next 14 days.
function familyAvatarRow() {
  const isKm = languageCode() === "km";
  const todayIso = localDateInput();
  const today = parseAppDate(todayIso);
  const soon = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return localDateInput(d); })();
  const me = appData.family.find(member => member.relationship === "Me");
  const others = appData.family.filter(member => member !== me);
  // one colour per person, in order, so two people never share a colour
  const colors = ["#ff7eb3", "#5aa9ff", "#b38cff", "#ffad4a", "#2dd4bf", "#7c83ff", "#ff6b7a", "#e2b04a"];
  const colorOf = member => colors[Math.max(0, appData.family.indexOf(member)) % colors.length];
  const face = member => member.photo ? `<img src="${escapeAttr(member.photo)}" alt="">` : escapeHtml(initials(member.name || "?"));
  const item = (member, label) => {
    const next = nextBirthdayDate(member.birthday);
    const ring = next && next >= todayIso && next <= soon;
    return `<button class="fam-av ${ring ? "has-ring" : ""}" type="button" data-fam-jump="${escapeAttr(member.id)}" title="${escapeAttr(member.name || "")}"><span class="fam-av-face" style="background:${colorOf(member)}">${face(member)}</span><small>${escapeHtml(label)}</small></button>`;
  };
  const nextBirthday = appData.family
    .map(member => ({ member, next: nextBirthdayDate(member.birthday) }))
    .filter(item => item.next)
    .map(item => ({ ...item, days: Math.round((parseAppDate(item.next) - today) / 86400000) }))
    .filter(item => item.days >= 0 && item.days <= 60)
    .sort((x, y) => x.days - y.days)[0];
  const when = nextBirthday ? (nextBirthday.days === 0 ? (isKm ? "ថ្ងៃនេះ 🎉" : "today 🎉") : nextBirthday.days === 1 ? (isKm ? "ស្អែក" : "tomorrow") : (isKm ? `${nextBirthday.days} ថ្ងៃទៀត` : `in ${nextBirthday.days} days`)) : "";
  const count = appData.family.length;
  return `<article class="fam-hero">
    <span class="fam-hero-blob fam-hero-blob-a" aria-hidden="true"></span>
    <span class="fam-hero-blob fam-hero-blob-b" aria-hidden="true"></span>
    <div class="fam-hero-top">
      <strong>${isKm ? `គ្រួសារខ្ញុំ · ${count} នាក់` : `My family · ${count}`}</strong>
      ${nextBirthday ? `<span class="fam-hero-next">${Icons.cake()} ${escapeHtml(String(nextBirthday.member.name || "").split(/\s+/)[0])} · ${isKm ? "ថ្ងៃកំណើត" : "birthday"} ${escapeHtml(when)}</span>` : ""}
    </div>
    <nav class="fam-avatars" aria-label="${escapeAttr(t("family"))}">
      ${me ? item(me, isKm ? "ខ្ញុំ" : "Me") : `<button class="fam-av fam-av-me" type="button" data-action="add-self"><span class="fam-av-face">${Icons.plus()}</span><small>${isKm ? "ខ្ញុំ" : "Me"}</small></button>`}
      ${others.map(member => item(member, String(member.name || "").split(/\s+/)[0] || optionLabel(member.relationship || ""))).join("")}
      <button class="fam-av fam-av-add" type="button" data-action="add-family"><span class="fam-av-face">${Icons.plus()}</span><small>${isKm ? "បន្ថែម" : "Add"}</small></button>
    </nav>
  </article>`;
}

function familyMediaCard() {
  const media = validFamilyMedia();
  const active = media[0];
  return `
    <article class="glass-card family-media-card">
      <div class="family-photo-heading">
        <div><h2>${escapeHtml(t("familyMediaHelp"))}</h2></div>
        <label class="icon-button family-media-add" title="${escapeAttr(t("addFamilyMedia"))}">${Icons.plus()}<input type="file" accept="image/*,video/*" multiple data-family-media></label>
      </div>
      ${active ? `<div class="family-media-stage">${familyMediaMarkup(active, 0)}</div><div class="family-media-dots">${media.map((item, index) => `<button type="button" class="family-media-dot ${index === 0 ? "active" : ""}" data-family-media-index="${index}" aria-label="${index + 1}"></button>`).join("")}</div>` : `<div class="family-media-empty">${Icons.memory()}<span>${escapeHtml(t("noFamilyMedia"))}</span></div>`}
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
      <div class="family-anniversary-hero" style="--timeline-progress: ${progress}%">
        <div class="family-anniversary-hero-heading">
          <span class="family-anniversary-heart" aria-hidden="true">${Icons.heart()}</span>
          <strong>${escapeHtml(t("beenTogether"))}</strong>
        </div>
        <div class="family-anniversary-count"><strong>${days}</strong><span>${escapeHtml(t("days"))}</span></div>
        <div class="family-anniversary-timeline" aria-label="${escapeAttr(`${previousMilestone} ${t("days")}, ${days} ${t("today")}, ${nextMilestone} ${t("days")}`)}">
          <div class="family-anniversary-track"><span></span><i></i></div>
          <div class="family-anniversary-milestone"><strong>${previousMilestone}</strong><span>${escapeHtml(t("days"))}</span></div>
          <div class="family-anniversary-milestone current"><strong class="sr-only">${days}</strong><span>${escapeHtml(t("today"))}</span></div>
          <div class="family-anniversary-milestone"><strong>${nextMilestone}</strong><span>${escapeHtml(t("days"))}</span></div>
        </div>
      </div>
      <div class="family-anniversary-stats">
        <div class="family-anniversary-date-start"><span class="family-anniversary-date-icon" aria-hidden="true">${Icons.calendar()}</span><span class="family-anniversary-date-label">${escapeHtml(t("relationshipStart"))}</span><strong>${formatDate(member.anniversaryDate)}</strong></div>
        <div class="family-anniversary-date-next"><span class="family-anniversary-date-icon" aria-hidden="true">${Icons.gift()}</span><span class="family-anniversary-date-label">${escapeHtml(t("nextAnniversary"))}</span><strong>${formatDate(anniversaryDate)}</strong></div>
        ${upcomingBirthday ? `<div class="family-anniversary-date-birthday"><span class="family-anniversary-date-icon" aria-hidden="true">${Icons.cake()}</span><span class="family-anniversary-date-label">${escapeHtml(t("upcomingBirthday"))}</span><strong>${formatDate(upcomingBirthday)}</strong></div>` : ""}
      </div>
    </article>
  `;
}

function nextAnnualDate(value) {
  const start = parseAppDate(value);
  const next = new Date(new Date().getFullYear(), start.getMonth(), start.getDate());
  if (next <= new Date()) next.setFullYear(next.getFullYear() + 1);
  return localDateInput(next);
}

function nextBirthdayDate(value) {
  if (!value) return "";
  const birthDate = parseAppDate(value);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let next = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next.setFullYear(next.getFullYear() + 1);
  return localDateInput(next);
}

function familyPhotoCard() {
  const image = getFamilyPhoto();
  const position = imagePosition(appData.profile.familyPhotoPosition);
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
  return appData.profile.familyPhoto || "";
}

function validFamilyMedia() {
  return (Array.isArray(appData.familyMedia) ? appData.familyMedia : [])
    .filter(item => item && String(item.src || "").trim());
}

function familyMediaMarkup(item, index = 0) {
  if (!item || !String(item.src || "").trim()) return "";
  const source = escapeAttr(item.src);
  const media = item.type === "video"
    ? `<video src="${source}" autoplay muted loop playsinline></video>`
    : `<img src="${source}" alt="${escapeAttr(t("familyMedia"))}">`;
  return `${media}<div class="family-media-toolbar"><label class="family-media-action family-media-edit" title="${escapeAttr(t("edit"))}">${Icons.edit()}<input type="file" accept="image/*,video/*" data-family-media-edit="${index}"></label><button class="family-media-action family-media-remove" type="button" data-family-media-remove="${index}" aria-label="${escapeAttr(t("delete"))}">${Icons.trash()}</button></div><button class="family-media-control family-media-prev" type="button" data-family-media-prev aria-label="Previous">${Icons.chevron()}</button><button class="family-media-control family-media-next" type="button" data-family-media-next aria-label="Next">${Icons.chevron()}</button>`;
}

function familyEmptyCard() {
  return `
    <article class="family-empty-card">
      <div class="family-empty-hero">
        <div class="family-empty-icon" aria-hidden="true">${Icons.family()}</div>
        <div class="family-empty-copy">
          <h2>${escapeHtml(t("family"))}</h2>
          <p>${escapeHtml(t("familySubtitle"))}</p>
        </div>
      </div>
      <div class="family-empty-actions">
        <button class="button ghost-button" data-action="add-self">${Icons.user()} ${t("addMyself")}</button>
        <button class="button" data-action="add-family">${Icons.plus()} ${t("addFamilyMember")}</button>
      </div>
    </article>
  `;
}

function memberCard(member) {
  const relatedMember = appData.family.find(item => item.id === member.relatedMemberId);
  const relationshipDays = relatedMember ? daysSinceDate(member.anniversaryDate) : 0;
  return `
    <article class="glass-card family-profile-card" id="family-member-${escapeAttr(member.id || "")}">
      <div class="family-profile-cover">
        ${member.photo ? `<img src="${escapeAttr(member.photo)}" alt="">` : `<span class="family-profile-cover-art" aria-hidden="true">${Icons.family()}</span>`}
        <span class="family-profile-category">${escapeHtml(t("family"))}</span>
      </div>
      <div class="family-profile-body">
        <div class="family-profile-heading">
          <span class="family-profile-avatar">${member.photo ? `<img src="${escapeAttr(member.photo)}" alt="${escapeAttr(member.name)}">` : escapeHtml(initials(member.name))}</span>
          <div class="family-profile-identity">
            <h2>${escapeHtml(member.name)}</h2>
            <p>${escapeHtml(member.relationship)}${relatedMember ? ` · ${escapeHtml(relatedMember.name)}` : ""}</p>
          </div>
          <div class="family-profile-tools">
            <button class="icon-button" data-edit-family="${escapeAttr(member.id)}" aria-label="Edit ${escapeAttr(member.name)}">${Icons.edit()}</button>
            <button class="icon-button" data-delete-family="${escapeAttr(member.id)}" aria-label="Delete ${escapeAttr(member.name)}">${Icons.trash()}</button>
          </div>
        </div>
        ${member.zodiacSign || member.characterMood || member.favorite ? `<div class="family-detail-tags">
          ${member.zodiacSign ? `<span class="pill family-zodiac-tag">${escapeHtml(member.zodiacSign)}</span>` : ""}
          ${member.characterMood ? `<span class="pill family-mood-tag">${escapeHtml(member.characterMood)}</span>` : ""}
          ${member.favorite ? `<span class="pill family-favorite-tag">${escapeHtml(member.favorite)}</span>` : ""}
        </div>` : ""}
        ${familyProfileStats(member)}
        ${relationshipDays ? `<div class="family-profile-duration">${Icons.heart()}<span>${escapeHtml(t("togetherFor").replace("{days}", relationshipDays))}</span></div>` : ""}
        ${familyAboutBlock(member)}
      </div>
    </article>
  `;
}

// Only the details that are filled in; missing ones become small "+ add" chips
// that open the edit form. The phone number is a tap-to-call link.
function familyProfileStats(member) {
  const km = languageCode() === "km";
  const stats = [];
  const missing = [];
  if (member.birthday) stats.push(`<div><span>${Icons.calendar()}${t("birthday")}</span><strong>${formatDate(member.birthday, { month: "short", day: "numeric" })}</strong></div>`);
  else missing.push(km ? "ថ្ងៃកំណើត" : "Birthday");
  if (member.anniversaryDate) stats.push(`<div><span>${Icons.heart()}${t("anniversary")}</span><strong>${formatDate(member.anniversaryDate, { month: "short", day: "numeric" })}</strong></div>`);
  else if (["wife", "husband", "girlfriend", "boyfriend", "partner", "mother", "father"].includes(String(member.relationship || "").toLowerCase())) missing.push(km ? "ខួប" : "Anniversary");
  if (member.phone) {
    const tel = String(member.phone).replace(/[^\d+]/g, "");
    stats.push(`<a class="family-stat-call" href="tel:${escapeAttr(tel)}" aria-label="${escapeAttr((km ? "ហៅទៅ " : "Call ") + member.name)}"><span>${Icons.user()}${t("phone")}</span><strong>${escapeHtml(member.phone)}</strong><em class="family-call-badge" aria-hidden="true">📞</em></a>`);
  } else missing.push(km ? "លេខទូរស័ព្ទ" : "Phone");
  return `
    ${stats.length ? `<div class="family-profile-stats family-stats-${stats.length}">${stats.join("")}</div>` : ""}
    ${missing.length ? `<div class="family-missing">${missing.map(label => `<button class="family-missing-chip" type="button" data-edit-family="${escapeAttr(member.id)}">+ ${escapeHtml(label)}</button>`).join("")}</div>` : ""}
  `;
}

// "Coming up": birthdays and anniversaries in the next 30 days.
function familyComingUp() {
  const km = languageCode() === "km";
  const today = parseAppDate(localDateInput());
  const items = [];
  appData.family.forEach(member => {
    [["birthday", "🎂"], ["anniversaryDate", "💞"]].forEach(([field, icon]) => {
      const value = member[field];
      if (!value) return;
      const next = nextBirthdayDate(value);
      if (!next) return;
      const days = Math.round((parseAppDate(next) - today) / 86400000);
      if (days < 0 || days > 30) return;
      const years = parseAppDate(next).getFullYear() - parseAppDate(value).getFullYear();
      const when = days === 0 ? (km ? "ថ្ងៃនេះ!" : "Today!") : days === 1 ? (km ? "ស្អែក" : "Tomorrow") : (km ? `${days} ថ្ងៃទៀត` : `in ${days} days`);
      const extra = years > 0 && years < 120 ? (field === "birthday" ? (km ? `អាយុ ${years}` : `turns ${years}`) : (km ? `${years} ឆ្នាំ` : `${years} yrs`)) : "";
      items.push({ days, html: `<li class="${days <= 3 ? "is-soon" : ""}"><span class="family-coming-icon">${icon}</span><span class="family-coming-copy"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(when)} · ${escapeHtml(formatDate(next, { month: "short", day: "numeric" }))}${extra ? ` · ${escapeHtml(extra)}` : ""}</small></span></li>` });
    });
  });
  if (!items.length) return "";
  return `
    <article class="glass-card family-coming-up">
      <h2 class="family-coming-title">${km ? "ថ្ងៃពិសេសខាងមុខ" : "Coming up"}</h2>
      <ul>${items.sort((a, b) => a.days - b.days).slice(0, 6).map(item => item.html).join("")}</ul>
    </article>
  `;
}

// One tidy block: the care idea on top, the person's notes below as short lines.
// Long text is clamped; tapping the block shows everything.
function familyAboutBlock(member) {
  const km = languageCode() === "km";
  const idea = familyCareIdea({ ...member, favorite: "" }).replace(/^[^:]*:\s*/, "");
  const notes = [
    member.relationshipNote ? { icon: Icons.heart(), text: member.relationshipNote } : null,
    member.notes ? { icon: Icons.edit(), text: member.notes } : null
  ].filter(Boolean);
  return `
    <button class="family-profile-about" type="button" data-family-about aria-expanded="false">
      <span class="fpa-idea">
        <span class="fpa-icon">${Icons.spark()}</span>
        <span class="fpa-copy">
          <small>${km ? "គំនិតថ្ងៃនេះ" : "Care idea"}</small>
          <span class="fpa-text">${escapeHtml(idea)}</span>
        </span>
      </span>
      ${notes.length ? `<span class="fpa-notes">${notes.map(note => `<span class="fpa-note"><span class="fpa-note-icon">${note.icon}</span><span class="fpa-text">${escapeHtml(note.text)}</span></span>`).join("")}</span>` : ""}
    </button>
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
  if (typeof FamilyForm !== "undefined") return FamilyForm.open(member);
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
    if (sign && zodiacInput) {
      zodiacInput.value = sign;
      zodiacInput.dispatchEvent(new Event("change"));
    }
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
  if (typeof MemoryFeed !== "undefined") MemoryFeed.afterFamilyRender();
  if (typeof FamilyGroup !== "undefined") FamilyGroup.mount();
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
    const media = validFamilyMedia();
    if (!media.length) return;
    const current = Number(document.querySelector(".family-media-dot.active")?.dataset.familyMediaIndex || 0);
    const next = button.dataset.familyMediaIndex !== undefined ? Number(button.dataset.familyMediaIndex) : button.hasAttribute("data-family-media-next") ? (current + 1) % media.length : (current - 1 + media.length) % media.length;
    const selected = media[next];
    const stage = document.querySelector(".family-media-stage");
    if (!stage || !selected) return;
    stage.innerHTML = familyMediaMarkup(selected, next);
    document.querySelectorAll(".family-media-dot").forEach(dot => dot.classList.toggle("active", Number(dot.dataset.familyMediaIndex) === next));
    bindFamilyMediaStage();
    startFamilyMediaSlideshow();
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
          Store.updateProfile({ familyPhoto: dataUrl, familyPhotoPosition: position });
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
  document.querySelectorAll("[data-fam-jump]").forEach(button => button.addEventListener("click", () => {
    const card = document.getElementById(`family-member-${button.dataset.famJump}`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("fam-flash");
    void card.offsetWidth;
    card.classList.add("fam-flash");
  }));
  document.querySelectorAll("[data-family-about]").forEach(block => block.addEventListener("click", () => {
    const open = !block.classList.contains("is-open");
    block.classList.toggle("is-open", open);
    block.setAttribute("aria-expanded", String(open));
  }));
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
  const mediaCard = document.querySelector(".family-media-card");
  const media = validFamilyMedia();
  if (!mediaCard || media.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  familyMediaTimer = window.setInterval(() => {
    if (!mediaCard.isConnected) {
      clearInterval(familyMediaTimer);
      familyMediaTimer = null;
      return;
    }
    if (document.hidden || mediaCard.matches(":hover") || mediaCard.contains(document.activeElement)) return;

    const current = Number(mediaCard.querySelector(".family-media-dot.active")?.dataset.familyMediaIndex || 0);
    mediaCard.querySelector(`.family-media-dot[data-family-media-index="${(current + 1) % media.length}"]`)?.click();
  }, 5000);
}

function bindFamilyMediaActions() {
  document.querySelectorAll("[data-family-media-edit]").forEach(input => input.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const index = Number(event.target.dataset.familyMediaEdit);
    const media = [...(appData.familyMedia || [])];
    if (!media[index]) return;
    const previous = structuredClone(appData);
    const replacement = {
      ...media[index],
      type: file.type.startsWith("video/") ? "video" : "image",
      src: file.type.startsWith("image/") ? await readImageFile(file) : await readRawFile(file)
    };
    media[index] = replacement;
    appData.familyMedia = media;
    event.target.value = "";
    if (Store.save()) App.render();
    else restoreData(previous);
  }));
  const mediaCard = document.querySelector(".family-media-card");
  if (!mediaCard || mediaCard.dataset.mediaActionsBound) return;
  mediaCard.dataset.mediaActionsBound = "true";
  mediaCard.addEventListener("click", event => {
    const button = event.target.closest("[data-family-media-remove]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const index = Number(button.dataset.familyMediaRemove);
    const media = [...(appData.familyMedia || [])];
    if (!media[index]) return;
    const previous = structuredClone(appData);
    media.splice(index, 1);
    appData.familyMedia = media;
    if (Store.save()) App.render();
    else restoreData(previous);
  });
}

function bindFamilyMediaStage() {
  document.querySelectorAll(".family-media-stage [data-family-media-prev], .family-media-stage [data-family-media-next]").forEach(button => button.addEventListener("click", () => {
    const media = validFamilyMedia();
    if (!media.length) return;
    const current = Number(document.querySelector(".family-media-dot.active")?.dataset.familyMediaIndex || 0);
    const next = button.hasAttribute("data-family-media-next") ? (current + 1) % media.length : (current - 1 + media.length) % media.length;
    document.querySelector(`.family-media-dot[data-family-media-index="${next}"]`)?.click();
  }));
  bindFamilyMediaActions();
}
