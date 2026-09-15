function renderFamily() {
  const familyEvents = appData.calendarEvents.filter(event => event.category === "Family");
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.family()}</span>${t("family")}</h1>
          <p class="page-subtitle">${t("familySubtitle")}</p>
        </div>
        <button class="button" data-action="add-family">${Icons.plus()} ${t("addFamilyMember")}</button>
      </div>
      ${appData.family.length ? `<div class="grid three-col">${appData.family.map(memberCard).join("")}</div>` : familyEmptyCard()}
      ${familyPhotoCard()}
      <div class="grid two-col" style="margin-top:18px">
        <article class="glass-card card-pad">
          <div class="between">
            <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.calendar()}</span>${t("familyEvents")}</h2>
            <button class="button ghost-button" data-action="add-event">${Icons.plus()} ${t("addEvent")}</button>
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
        <button class="button" data-action="add-family">${Icons.plus()} ${t("addFamilyMember")}</button>
      </div>
    </article>
  `;
}

function memberCard(member) {
  return `
    <article class="glass-card card-pad">
      <div class="between">
        <span class="thumb">${member.photo ? `<img src="${member.photo}" alt="">` : initials(member.name)}</span>
        <span class="action-row">
          <button class="icon-button" data-edit-family="${member.id}" aria-label="Edit ${member.name}">${Icons.edit()}</button>
          <button class="icon-button" data-delete-family="${member.id}" aria-label="Delete ${member.name}">${Icons.trash()}</button>
        </span>
      </div>
      <h2>${escapeHtml(member.name)}</h2>
      <p class="secondary">${escapeHtml(member.relationship)}</p>
      <div class="kv">
        <div><span>${t("birthday")}</span><strong>${formatDate(member.birthday)}</strong></div>
        <div><span>${t("phone")}</span><strong>${escapeHtml(member.phone || t("notSet"))}</strong></div>
      </div>
      <p class="muted">${escapeHtml(member.notes || "")}</p>
    </article>
  `;
}

function familyFields(member = {}) {
  return [
    { name: "name", label: t("name"), value: member.name, required: true },
    { name: "relationship", label: t("relationship"), value: member.relationship, required: true },
    { name: "birthday", label: t("birthday"), type: "date", value: member.birthday },
    { name: "phone", label: t("phone"), value: member.phone },
    { name: "notes", label: t("notes"), type: "textarea", value: member.notes },
    { name: "photo", label: t("photo"), type: "file", value: member.photo }
  ];
}

function openFamilyModal(member) {
  Modal.open({
    title: member ? t("editFamilyMember") : t("addFamilyMember"),
    submitText: member ? t("saveFamilyMember") : t("addFamilyMember"),
    fields: familyFields(member),
    onSubmit(data) {
      if (member) Store.edit("family", member.id, data);
      else Store.add("family", data);
      Toast.show(member ? t("familyMemberSaved") : t("familyMemberAdded"));
    }
  });
}

function bindFamily() {
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
          localStorage.setItem("mylife:family-photo", dataUrl);
          localStorage.setItem("mylife:family-photo-position", JSON.stringify(position));
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
}
