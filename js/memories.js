function renderMemories() {
  const groups = appData.memories.reduce((acc, memory) => {
    const date = memory.date ? new Date(`${memory.date}T00:00:00`) : new Date();
    const year = date.getFullYear();
    const month = date.toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { month: "long" });
    acc[year] = acc[year] || {};
    acc[year][month] = acc[year][month] || [];
    acc[year][month].push(memory);
    return acc;
  }, {});

  return `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.memory()}</span>${t("memories")}</h1>
          <p class="page-subtitle">${t("memoriesSubtitle")}</p>
        </div>
        <button class="button" data-action="add-memory">${Icons.plus()} ${t("addMemory")}</button>
      </div>
      ${appData.memories.length ? `
        <div class="grid two-col">
          <div class="memory-grid">${appData.memories.map(memoryCard).join("")}</div>
          <article class="glass-card card-pad">
            <h2 class="section-title">${t("memoryTimeline")}</h2>
            ${Object.entries(groups).map(([year, months]) => `<h3>${year}</h3>${Object.entries(months).map(([month, memories]) => `
              <div class="goal-item">
                <strong>${month}</strong>
                ${memories.map(memory => `<div class="between"><span class="secondary">${escapeHtml(memory.title)}</span><span class="pill">${firstTag(memory.tags)}</span></div>`).join("")}
              </div>
            `).join("")}`).join("")}
          </article>
        </div>
      ` : emptyState(t("noMemoriesYet"), t("noMemoriesBody"), t("addMemory"), "add-memory")}
    </section>
  `;
}

function memoryCard(memory) {
  const style = memory.photo ? `background-image:url('${memory.photo}')` : `background:${memoryGradient(memory.id)}`;
  return `
    <article class="memory-card glass-card">
      <div class="memory-photo" style="${style}"></div>
      <div class="card-pad">
        <div class="between"><span class="pill">${escapeHtml(memory.location || t("noLocation"))}</span><span class="secondary">${formatDate(memory.date)}</span></div>
        <h2>${escapeHtml(memory.title)}</h2>
        <p class="secondary">${escapeHtml(memory.description || "")}</p>
        <div>${splitList(memory.tags).map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join(" ")}</div>
        <div class="action-row">
          <button class="button ghost-button" data-edit-memory="${memory.id}">${Icons.edit()} ${t("edit")}</button>
          <button class="icon-button" data-delete-memory="${memory.id}" aria-label="${t("deleteMemory")}">${Icons.trash()}</button>
        </div>
      </div>
    </article>
  `;
}

function memoryGradient(seed = "") {
  const options = [
    "linear-gradient(135deg, rgba(184,255,90,.36), rgba(155,109,255,.28))",
    "linear-gradient(135deg, rgba(155,109,255,.5), rgba(184,255,90,.18))",
    "linear-gradient(135deg, rgba(100,244,210,.34), rgba(155,109,255,.26))",
    "linear-gradient(135deg, rgba(157,255,110,.34), rgba(18,11,36,.42))"
  ];
  return options[String(seed).length % options.length];
}

function memoryFields(memory = {}) {
  return [
    { name: "title", label: t("title"), value: memory.title, required: true },
    { name: "photo", label: t("photo"), type: "file", value: memory.photo },
    { name: "date", label: t("date"), type: "date", value: memory.date || new Date().toISOString().slice(0, 10), required: true },
    { name: "location", label: t("location"), value: memory.location },
    { name: "description", label: t("description"), type: "textarea", value: memory.description },
    { name: "familyMembers", label: t("familyMembers"), value: memory.familyMembers },
    { name: "tags", label: t("tags"), value: memory.tags }
  ];
}

function openMemoryModal(memory) {
  Modal.open({
    title: memory ? t("editMemory") : t("addMemory"),
    submitText: memory ? t("saveMemory") : t("addMemory"),
    fields: memoryFields(memory),
    onSubmit(data) {
      if (memory) Store.edit("memories", memory.id, data);
      else Store.add("memories", data);
      Toast.show(memory ? t("memorySaved") : t("memoryAdded"));
    }
  });
}

function splitList(value) {
  return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
}

function firstTag(value) {
  return splitList(value)[0] || "memory";
}

function bindMemories() {
  document.querySelectorAll('[data-action="add-memory"]').forEach(button => button.addEventListener("click", () => openMemoryModal()));
  document.querySelectorAll("[data-edit-memory]").forEach(button => button.addEventListener("click", () => openMemoryModal(appData.memories.find(item => item.id === button.dataset.editMemory))));
  document.querySelectorAll("[data-delete-memory]").forEach(button => button.addEventListener("click", () => {
    Modal.confirm({ title: t("deleteMemory"), message: t("deleteMemoryMessage"), confirmText: t("delete"), onConfirm: () => {
      Store.delete("memories", button.dataset.deleteMemory);
      Toast.show(t("memoryDeleted"));
    }});
  }));
}
