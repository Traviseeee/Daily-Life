function renderMemories() {
  const memories = appData.memories || [];
  const years = [...new Set(memories.map(memory => memory.date?.slice(0, 4)).filter(Boolean))].sort((left, right) => right.localeCompare(left));
  const locations = [...new Set(memories.map(memory => memory.location?.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.memory()}</span>${t("memories")}</h1>
          <p class="page-subtitle">${t("memoriesSubtitle")}</p>
        </div>
        <button class="button" data-action="add-memory">${Icons.plus()} ${t("addMemory")}</button>
      </div>
      ${memories.length ? `
        ${renderOnThisDay(memories)}
        <div class="memory-filter-panel">
          <div class="memory-filters" role="search">
            <label class="memory-search-field">
              <span aria-hidden="true">${Icons.search()}</span>
              <input type="search" data-memory-search placeholder="${escapeAttr(t("searchMemories"))}" aria-label="${escapeAttr(t("searchMemories"))}">
            </label>
            <div class="memory-filter-selects">
              <label class="memory-filter-select">
                <span class="sr-only">${escapeHtml(t("filterByYear"))}</span>
                <select data-memory-year aria-label="${escapeAttr(t("filterByYear"))}">
                  <option value="">${escapeHtml(t("allYears"))}</option>
                  ${years.map(year => `<option value="${escapeAttr(year)}">${escapeHtml(year)}</option>`).join("")}
                </select>
              </label>
              <label class="memory-filter-select">
                <span class="sr-only">${escapeHtml(t("filterByPlace"))}</span>
                <select data-memory-location aria-label="${escapeAttr(t("filterByPlace"))}">
                  <option value="">${escapeHtml(t("allPlaces"))}</option>
                  ${locations.map(location => `<option value="${escapeAttr(location)}">${escapeHtml(location)}</option>`).join("")}
                </select>
              </label>
            </div>
          </div>
          <div class="memory-filter-footer">
            <span data-memory-result-count aria-live="polite"></span>
            <button class="memory-filter-reset" type="button" data-memory-reset hidden>${escapeHtml(t("clearFilters"))}</button>
          </div>
        </div>
        <div class="memory-grid">${memories.map(memoryCard).join("")}</div>
        <p class="memory-filter-empty secondary" data-memory-filter-empty hidden>${escapeHtml(t("noResultsFound"))}</p>
      ` : memoriesEmptyCard()}
    </section>
  `;
}

function renderOnThisDay(memories) {
  const today = new Date();
  const monthDay = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const matches = memories
    .filter(memory => /^\d{4}-\d{2}-\d{2}$/.test(memory.date || "") && memory.date.slice(5) === monthDay && Number(memory.date.slice(0, 4)) < today.getFullYear())
    .sort((left, right) => right.date.localeCompare(left.date));
  if (!matches.length) return "";
  return `<details class="memory-on-this-day">
    <summary>${escapeHtml(t("onThisDay"))}<span class="pill">${matches.length}</span></summary>
    <div class="memory-on-this-day-list">${matches.map(memory => `<button class="memory-on-this-day-item" type="button" data-memory-jump="${escapeAttr(memory.id)}"><strong>${escapeHtml(memory.title)}</strong><span>${escapeHtml(formatDate(memory.date))}${memory.location ? ` · ${escapeHtml(memory.location)}` : ""}</span></button>`).join("")}</div>
  </details>`;
}

function memoriesEmptyCard() {
  return `
    <article class="glass-card image-empty-card memories-empty-card">
      <img src="https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=78" alt="" loading="lazy">
      <div class="image-empty-content">
        <span class="icon-badge blue">${Icons.memory()}</span>
        <h2>${escapeHtml(t("noMemoriesYet"))}</h2>
        <p class="secondary">${escapeHtml(t("noMemoriesBody"))}</p>
        <button class="button" data-action="add-memory">${Icons.plus()} ${t("addMemory")}</button>
      </div>
    </article>
  `;
}

function memoryCard(memory) {
  const style = memory.photo ? `background-image:url('${memory.photo}')` : `background:${memoryGradient(memory.id)}`;
  const tags = splitList(memory.tags);
  const familyMembers = splitList(memory.familyMembers);
  const hasDetails = memory.description || tags.length || familyMembers.length;
  const searchText = [memory.title, memory.location, memory.description, memory.familyMembers, memory.tags, memory.date].filter(Boolean).join(" ").toLocaleLowerCase();
  return `
    <article class="memory-card glass-card" id="memory-card-${escapeAttr(memory.id)}" data-memory-card data-memory-search-text="${escapeAttr(searchText)}" data-memory-year="${escapeAttr(memory.date?.slice(0, 4) || "")}" data-memory-location="${escapeAttr(memory.location?.trim() || "")}">
      <div class="memory-photo" style="${style}"></div>
      <div class="card-pad">
        <div class="memory-card-heading">
          <h2>${escapeHtml(memory.title)}</h2>
          <div class="memory-card-actions">
            <button class="icon-button" data-edit-memory="${memory.id}" aria-label="${escapeAttr(t("editMemory"))}">${Icons.edit()}</button>
            <button class="icon-button" data-delete-memory="${memory.id}" aria-label="${escapeAttr(t("deleteMemory"))}">${Icons.trash()}</button>
          </div>
        </div>
        <p class="memory-card-meta">${[memory.date ? formatDate(memory.date) : "", memory.location || ""].filter(Boolean).map(escapeHtml).join(" · ")}</p>
        ${hasDetails ? `<details class="memory-details">
          <summary>${escapeHtml(t("memoryDetails"))}</summary>
          ${memory.description ? `<p class="secondary">${escapeHtml(memory.description)}</p>` : ""}
          ${familyMembers.length ? `<p class="memory-details-line"><strong>${escapeHtml(t("familyMembers"))}:</strong> ${familyMembers.map(escapeHtml).join(", ")}</p>` : ""}
          ${tags.length ? `<div class="memory-card-tags">${tags.map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </details>` : ""}
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
    { name: "date", label: t("date"), type: "date", value: memory.date || localDateInput(), required: true },
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

function bindMemories() {
  document.querySelectorAll('[data-action="add-memory"]').forEach(button => button.addEventListener("click", () => openMemoryModal()));
  document.querySelectorAll("[data-edit-memory]").forEach(button => button.addEventListener("click", () => openMemoryModal(appData.memories.find(item => item.id === button.dataset.editMemory))));
  const search = document.querySelector("[data-memory-search]");
  const yearFilter = document.querySelector("[data-memory-year]");
  const locationFilter = document.querySelector("[data-memory-location]");
  const emptyState = document.querySelector("[data-memory-filter-empty]");
  const filterPanel = document.querySelector(".memory-filter-panel");
  const resetButton = document.querySelector("[data-memory-reset]");
  const resultCount = document.querySelector("[data-memory-result-count]");
  const filterMemories = () => {
    const query = search.value.trim().toLocaleLowerCase();
    const hasFilters = Boolean(query || yearFilter.value || locationFilter.value);
    let visibleCount = 0;
    document.querySelectorAll("[data-memory-card]").forEach(card => {
      const matches = card.dataset.memorySearchText.includes(query)
        && (!yearFilter.value || card.dataset.memoryYear === yearFilter.value)
        && (!locationFilter.value || card.dataset.memoryLocation === locationFilter.value);
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    emptyState.hidden = visibleCount > 0;
    resultCount.textContent = hasFilters ? `${visibleCount} / ${document.querySelectorAll("[data-memory-card]").length}` : "";
    resetButton.hidden = !hasFilters;
    filterPanel.classList.toggle("memory-filter-active", hasFilters);
  };
  search?.addEventListener("input", filterMemories);
  yearFilter?.addEventListener("change", filterMemories);
  locationFilter?.addEventListener("change", filterMemories);
  resetButton?.addEventListener("click", () => {
    search.value = "";
    yearFilter.value = "";
    locationFilter.value = "";
    filterMemories();
    search.focus();
  });
  document.querySelectorAll("[data-memory-jump]").forEach(button => button.addEventListener("click", () => {
    if (search && yearFilter && locationFilter && emptyState) {
      search.value = "";
      yearFilter.value = "";
      locationFilter.value = "";
      filterMemories();
    }
    const card = document.getElementById(`memory-card-${button.dataset.memoryJump}`);
    if (!card) return;
    document.querySelectorAll("[data-memory-card]").forEach(item => item.classList.remove("memory-card-highlight"));
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("memory-card-highlight");
  }));
  document.querySelectorAll("[data-delete-memory]").forEach(button => button.addEventListener("click", () => {
    Modal.confirm({ title: t("deleteMemory"), message: t("deleteMemoryMessage"), confirmText: t("delete"), onConfirm: () => {
      Store.delete("memories", button.dataset.deleteMemory);
      Toast.show(t("memoryDeleted"));
    }});
  }));
}
