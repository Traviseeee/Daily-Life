/* Daily focus (Home card): today's list, live progress when you tick, and the
   "Edit focus" sheet (rename / add / remove, up to 6). An edited list carries
   over to the next day (unticked) instead of falling back to the 3 defaults. */
const FocusEditor = (() => {
  const MAX = 6;
  const km = () => (typeof languageCode === "function" ? languageCode() : "en") === "km";
  const L = (en, kh) => (km() ? kh : en);
  const esc = value => (typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? ""));

  function defaults() {
    return [
      { id: "focus-move", text: t("moveMyBody"), done: false },
      { id: "focus-water", text: t("drinkWater"), done: false },
      { id: "focus-family", text: t("checkInWithFamily"), done: false }
    ];
  }

  function items(todayIso = localDateInput()) {
    const saved = appData.dailyFocus;
    const list = Array.isArray(saved?.items) ? saved.items.filter(item => item && String(item.text || "").trim()) : [];
    if (saved?.date === todayIso && list.length) return list;
    if (saved?.custom && list.length) return list.map(item => ({ ...item, done: false }));
    return defaults();
  }

  function save(list) {
    Store.updateDailyFocus(list, { custom: !!appData.dailyFocus?.custom });
  }

  // tick a box: save, then update the card in place (no full re-render, no scroll jump)
  function toggle(id, done) {
    const list = items().map(item => item.id === id ? { ...item, done } : item);
    save(list);
    refreshCard(list);
  }

  function refreshCard(list = items()) {
    const card = document.querySelector(".focus-card");
    if (!card) return;
    const doneCount = list.filter(item => item.done).length;
    const pct = list.length ? Math.round((doneCount / list.length) * 100) : 0;
    const fill = card.querySelector(".progress-fill");
    if (fill) { fill.style.setProperty("--progress", `${pct}%`); fill.style.setProperty("--p", String(pct / 100)); }
    card.querySelector(".progress-track")?.setAttribute("aria-valuenow", String(pct));
    const text = card.querySelector(".focus-progress-text");
    if (text) text.textContent = `${pct}%`;
    const count = card.querySelector(".focus-count");
    if (count) count.textContent = `${doneCount}/${list.length}`;
    list.forEach(item => {
      const input = card.querySelector(`[data-focus-id="${CSS.escape(item.id)}"]`);
      input?.closest(".focus-item")?.classList.toggle("done", !!item.done);
    });
    const wasAll = card.classList.contains("all-done");
    card.classList.toggle("all-done", pct === 100);
    if (pct === 100 && !wasAll) {
      card.classList.remove("just-done");
      void card.offsetWidth;
      card.classList.add("just-done");
      setTimeout(() => card.classList.remove("just-done"), 1200);
      if (typeof Toast !== "undefined") Toast.show(L("All done for today! 🎉", "ធ្វើរួចទាំងអស់សម្រាប់ថ្ងៃនេះ! 🎉"), "success");
    }
  }

  const SUGGEST_EN = ["Read 10 minutes", "Walk 20 minutes", "No extra spending", "Sleep before 11", "Call Mom"];
  const SUGGEST_KM = ["អានសៀវភៅ 10 នាទី", "ដើរ 20 នាទី", "មិនចាយលុយមិនចាំបាច់", "គេងមុនម៉ោង 11", "ហៅទូរសព្ទទៅម្ដាយ"];

  function row(item, index) {
    return `<li class="fe-row" data-id="${esc(item.id || "")}" data-done="${item.done ? 1 : 0}" data-text="${esc(item.text || "")}">
      <span class="fe-num" aria-hidden="true">${index + 1}</span>
      <input type="text" maxlength="60" value="${esc(item.text || "")}" placeholder="${esc(L("e.g. Drink 8 glasses of water", "ឧ. ផឹកទឹក 8 កែវ"))}" aria-label="${esc(L(`Focus ${index + 1}`, `ការផ្តោតទី ${index + 1}`))}" enterkeyhint="next">
      <button class="icon-button fe-remove" type="button" aria-label="${esc(L("Remove", "លុបចេញ"))}">${Icons.close()}</button>
    </li>`;
  }

  function open() {
    const root = document.getElementById("modalRoot");
    if (!root) return;
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    const list = items();
    const suggestions = km() ? SUGGEST_KM : SUGGEST_EN;
    root.innerHTML = `
      <form class="modal glass-card focus-editor" id="modalForm" novalidate>
        <div class="between">
          <h2 class="section-title">${esc(t("editFocus"))}</h2>
          <button class="icon-button" type="button" data-close aria-label="${esc(t("close"))}">${Icons.close()}</button>
        </div>
        <p class="fe-hint">${esc(L(`Pick 1–${MAX} small things for today. Your list stays for the next days.`, `ជ្រើសរើសកិច្ចការតូចៗ 1–${MAX} សម្រាប់ថ្ងៃនេះ។ បញ្ជីនេះនឹងនៅសម្រាប់ថ្ងៃបន្ទាប់ៗដែរ។`))}</p>
        <ol class="fe-list">${list.map(row).join("")}</ol>
        <button class="button ghost-button fe-add" type="button">＋ ${esc(L("Add", "បន្ថែម"))}</button>
        <div class="fe-suggest" aria-label="${esc(L("Ideas", "គំនិត"))}">
          ${suggestions.map(text => `<button class="fe-chip" type="button">${esc(text)}</button>`).join("")}
        </div>
        <p class="fe-error" role="alert"></p>
        <div class="between fe-actions">
          <button class="button ghost-button fe-reset" type="button">${esc(L("Reset", "កំណត់ដើមវិញ"))}</button>
          <button class="button" type="submit">${esc(L("Save", "រក្សាទុក"))}</button>
        </div>
      </form>`;
    root.classList.add("open");
    Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
    document.addEventListener("keydown", Modal.escapeHandler);

    const form = root.querySelector("#modalForm");
    const listEl = form.querySelector(".fe-list");
    const addBtn = form.querySelector(".fe-add");
    const errorEl = form.querySelector(".fe-error");

    const sync = () => {
      const rows = [...listEl.children];
      rows.forEach((li, i) => {
        li.querySelector(".fe-num").textContent = i + 1;
        li.querySelector("input").setAttribute("aria-label", L(`Focus ${i + 1}`, `ការផ្តោតទី ${i + 1}`));
      });
      addBtn.hidden = rows.length >= MAX;
      form.querySelectorAll(".fe-chip").forEach(chip => { chip.disabled = rows.length >= MAX && !rows.some(li => !li.querySelector("input").value.trim()); });
      errorEl.textContent = "";
    };
    const addRow = (text = "") => {
      const empty = [...listEl.querySelectorAll("input")].find(input => !input.value.trim());
      if (text && empty) { empty.value = text; sync(); return empty; }
      if (listEl.children.length >= MAX) return null;
      listEl.insertAdjacentHTML("beforeend", row({ id: "", text, done: false }, listEl.children.length));
      const li = listEl.lastElementChild;
      li.classList.add("fe-new");
      sync();
      return li.querySelector("input");
    };

    form.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));
    addBtn.addEventListener("click", () => addRow()?.focus());
    form.querySelectorAll(".fe-chip").forEach(chip => chip.addEventListener("click", () => {
      const input = addRow(chip.textContent);
      if (input) { chip.classList.add("used"); }
    }));
    listEl.addEventListener("click", event => {
      const remove = event.target.closest(".fe-remove");
      if (!remove) return;
      const li = remove.closest(".fe-row");
      li.classList.add("fe-leaving");
      setTimeout(() => { li.remove(); sync(); }, 140);
    });
    listEl.addEventListener("keydown", event => {
      if (event.key !== "Enter" || !event.target.matches("input")) return;
      event.preventDefault();
      const li = event.target.closest(".fe-row");
      const next = li.nextElementSibling?.querySelector("input");
      if (next) next.focus();
      else if (event.target.value.trim()) addRow()?.focus();
    });
    form.querySelector(".fe-reset").addEventListener("click", () => {
      listEl.innerHTML = defaults().map(row).join("");
      form.querySelectorAll(".fe-chip.used").forEach(chip => chip.classList.remove("used"));
      sync();
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const seen = new Set();
      const next = [...listEl.children].map((li, i) => ({
        id: li.dataset.id || `focus-${Date.now().toString(36)}-${i}`,
        text: li.querySelector("input").value.trim(),
        // renamed = a new task, so it starts unticked
        done: li.dataset.done === "1" && li.querySelector("input").value.trim() === (li.dataset.text || "").trim()
      })).filter(item => item.text && !seen.has(item.text.toLowerCase()) && seen.add(item.text.toLowerCase()));
      if (!next.length) {
        errorEl.textContent = L("Add at least one focus.", "សូមបញ្ចូលយ៉ាងហោចណាស់ 1។");
        const first = listEl.querySelector("input");
        if (first) first.focus(); else addRow()?.focus();
        return;
      }
      const isDefault = next.length === 3 && next.every((item, i) => item.id === defaults()[i].id && item.text === defaults()[i].text);
      Store.updateDailyFocus(next, { custom: !isDefault });
      Modal.close();
      if (typeof App !== "undefined") App.render();
      if (typeof Toast !== "undefined") Toast.show(L("Focus saved", "បានរក្សាទុកការផ្តោត"), "success");
    });
    sync();
    setTimeout(() => listEl.querySelector("input")?.focus({ preventScroll: true }), 60);
  }

  return { items, toggle, refreshCard, open, defaults };
})();

if (typeof window !== "undefined") window.FocusEditor = FocusEditor;
