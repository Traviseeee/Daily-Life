// Launcher (☰): tools in 4 groups, each with a live "smart" badge, and a footer editor.
// Home is not a tile — the 🏠 button (top-left) and the footer already go there.
const LAUNCHER_GROUPS = [
  { id: "daily", km: "ប្រចាំថ្ងៃ", en: "Every day", routes: ["today", "calendar", "daily"] },
  { id: "life", km: "ជីវិត", en: "Life", routes: ["family", "goals", "memories"] },
  { id: "money", km: "លុយ", en: "Money", routes: ["money", "summary"] },
  { id: "more", km: "ផ្សេងៗ", en: "More", routes: ["settings", "tips", "help"] }
];
const LAUNCHER_ICON = { tips: "heart", help: "help" };
const FOOTER_MAX = 5;

function launcherAllRoutes() {
  return [...routes, ...utilityRoutes];
}

// A short live fact for each tool, e.g. "3 today", "$295 left", "🎂 in 5 days".
function launcherBadge(routeId) {
  const km = languageCode() === "km";
  try {
    if (routeId === "today") {
      const n = getUpcomingNotifications(0, Infinity).length;
      return n ? { text: km ? `${n} រឿងថ្ងៃនេះ` : `${n} today`, tone: "lime" } : { text: km ? "ទំនេរ" : "Free day", tone: "muted" };
    }
    if (routeId === "calendar") {
      const n = getUpcomingNotifications(7, Infinity).length;
      return n ? { text: km ? `${n} ក្នុង ៧ ថ្ងៃ` : `${n} this week`, tone: "blue" } : null;
    }
    if (routeId === "money" && typeof moneyMonthNumbers === "function") {
      const left = moneyMonthNumbers().left;
      const plain = String(money(Math.abs(left))).replace(/<[^>]*>/g, "");
      return left < 0 ? { text: km ? `ខ្វះ ${plain}` : `Short ${plain}`, tone: "red" } : { text: km ? `នៅសល់ ${plain}` : `${plain} left`, tone: "green" };
    }
    if (routeId === "family") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const next = appData.family
        .filter(member => member.birthday)
        .map(member => ({ name: member.name, days: Math.round((nextYearlyDate(member.birthday, today) - today) / 86400000) }))
        .sort((a, b) => a.days - b.days)[0];
      if (next) return { text: next.days === 0 ? (km ? `🎂 ${next.name} ថ្ងៃនេះ` : `🎂 ${next.name} today`) : (km ? `🎂 ${next.days} ថ្ងៃទៀត` : `🎂 in ${next.days} days`), tone: "pink" };
      return appData.family.length ? { text: km ? `${appData.family.length} នាក់` : `${appData.family.length} people`, tone: "muted" } : null;
    }
    if (routeId === "goals") {
      const open = appData.goals.filter(goal => !(Number(goal.targetAmount) > 0 && Number(goal.currentAmount) >= Number(goal.targetAmount))).length;
      return open ? { text: km ? `${open} កំពុងធ្វើ` : `${open} active`, tone: "purple" } : null;
    }
    if (routeId === "memories") return appData.memories.length ? { text: km ? `${appData.memories.length} អនុស្សាវរីយ៍` : `${appData.memories.length} saved`, tone: "muted" } : null;
    if (routeId === "daily") {
      const today = localDateInput();
      const n = appData.hobbyLogs.filter(item => item.date === today).length;
      return n ? { text: km ? `${n} កត់ថ្ងៃនេះ` : `${n} logged today`, tone: "lime" } : { text: km ? "មិនទាន់កត់" : "Nothing yet", tone: "muted" };
    }
  } catch (error) {
    return null;
  }
  return null;
}

function renderLauncher() {
  const km = languageCode() === "km";
  const all = launcherAllRoutes();
  return `
    <section class="launcher-page page">
      <header class="launcher-hero">
        <div class="launcher-hero-copy">
          <h1 class="launcher-brand"><img class="launcher-brand-mark" src="assets/icons/mylife-icon.svg?v=4" alt=""><span>MY</span><strong>LIFE</strong></h1>
          <p>${t("launcherTagline")}</p>
          <div class="launcher-hero-actions">
            <button class="launcher-footer-edit-button" type="button" data-footer-edit aria-pressed="false">${Icons.edit()}<span>${km ? "រៀបចំ footer" : "Arrange footer"}</span></button>
          </div>
        </div>
        <img class="launcher-hero-art" src="${escapeAttr(appData.profile.launcherCover || "assets/launcher-home-hero.png")}" style="--launcher-cover-x: ${launcherCoverPosition().x}%; --launcher-cover-y: ${launcherCoverPosition().y}%" alt="">
        <button class="icon-button launcher-edit-button" type="button" data-launcher-cover aria-label="${km ? "ប្តូររូបភាពផ្ទៃខាងក្រោយ" : "Change launcher cover"}" title="${km ? "ប្តូររូបភាពផ្ទៃខាងក្រោយ" : "Change launcher cover"}">${Icons.edit()}</button>
        <input class="sr-only" type="file" accept="image/*" data-launcher-cover-input>
      </header>
      <section class="footer-editor" data-footer-editor hidden></section>
      <nav class="tool-launcher-groups" aria-label="App tools">
        ${LAUNCHER_GROUPS.map(group => `
          <section class="tool-group">
            <h2 class="tool-group-title">${km ? group.km : group.en}</h2>
            <div class="tool-launcher">${group.routes.map(id => all.find(route => route.id === id)).filter(Boolean).map(launcherTool).join("")}</div>
          </section>`).join("")}
      </nav>
    </section>
  `;
}

function renderFooterEditor() {
  const km = languageCode() === "km";
  const slots = footerRoutes();
  return `
    <div class="footer-editor-head">
      <div><strong>${km ? "Footer របស់អ្នក" : "Your footer"}</strong><small>${km ? `ចុច + លើឧបករណ៍ខាងក្រោម ដើម្បីបន្ថែម · អតិបរមា ${FOOTER_MAX}` : `Tap + on a tool below to add · up to ${FOOTER_MAX}`}</small></div>
      <div class="footer-editor-actions">
        <button type="button" class="footer-editor-reset" data-footer-reset>${km ? "លំនាំដើម" : "Reset"}</button>
        <button type="button" class="footer-editor-done" data-footer-edit>${Icons.check()}${km ? "រួចរាល់" : "Done"}</button>
      </div>
    </div>
    <div class="footer-slots">
      ${slots.map((route, index) => `<div class="footer-slot">
        <span class="footer-slot-icon">${Icons[route.icon]()}</span>
        <b>${escapeHtml(t(route.labelKey || route.id))}</b>
        <div class="footer-slot-tools">
          <button type="button" data-footer-move="${route.id}" data-dir="-1" ${index === 0 ? "disabled" : ""} aria-label="${km ? "ទៅឆ្វេង" : "Move left"}">‹</button>
          <button type="button" data-footer-remove="${route.id}" ${slots.length <= 1 ? "disabled" : ""} aria-label="${km ? "ដកចេញ" : "Remove"}">×</button>
          <button type="button" data-footer-move="${route.id}" data-dir="1" ${index === slots.length - 1 ? "disabled" : ""} aria-label="${km ? "ទៅស្តាំ" : "Move right"}">›</button>
        </div>
      </div>`).join("")}
      ${Array.from({ length: FOOTER_MAX - slots.length }, () => `<div class="footer-slot is-empty"><span>+</span></div>`).join("")}
    </div>`;
}

function saveFooterRoutes(ids) {
  try {
    localStorage.setItem(FOOTER_ROUTES_KEY, JSON.stringify(ids.slice(0, FOOTER_MAX)));
  } catch (error) { /* ignore */ }
  renderNavigation();
  if (typeof setActiveNav === "function") setActiveNav("launcher");
  refreshFooterEditing();
}

function refreshFooterEditing() {
  const editor = document.querySelector("[data-footer-editor]");
  if (editor && !editor.hidden) editor.innerHTML = renderFooterEditor();
  const pinned = footerRoutes().map(route => route.id);
  document.querySelectorAll("[data-footer-toggle]").forEach(button => {
    const on = pinned.includes(button.dataset.footerToggle);
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", String(on));
    button.textContent = on ? "✓" : "+";
  });
}

function bindLauncher() {
  const page = document.querySelector(".launcher-page");
  const editButton = document.querySelector("[data-launcher-cover]");
  const coverInput = document.querySelector("[data-launcher-cover-input]");
  const footerEditButton = document.querySelector("[data-footer-edit]");
  const editor = document.querySelector("[data-footer-editor]");
  const setEditing = editing => {
    page.classList.toggle("footer-editing", editing);
    footerEditButton?.classList.toggle("active", editing);
    footerEditButton?.setAttribute("aria-pressed", String(editing));
    if (editor) {
      editor.hidden = !editing;
      if (editing) {
        editor.innerHTML = renderFooterEditor();
        editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  };
  page?.addEventListener("click", event => {
    const toggleEdit = event.target.closest("[data-footer-edit]");
    if (toggleEdit) {
      setEditing(!page.classList.contains("footer-editing"));
      return;
    }
    const ids = footerRoutes().map(route => route.id);
    const add = event.target.closest("[data-footer-toggle]");
    if (add) {
      event.preventDefault();
      const id = add.dataset.footerToggle;
      if (ids.includes(id)) {
        if (ids.length <= 1) return;
        saveFooterRoutes(ids.filter(item => item !== id));
      } else if (ids.length >= FOOTER_MAX) {
        Toast.show(languageCode() === "km" ? `Footer ពេញហើយ (${FOOTER_MAX}) — ដកមួយចេញសិន` : `Footer is full (${FOOTER_MAX}) — remove one first`, "warning");
      } else {
        saveFooterRoutes([...ids, id]);
      }
      return;
    }
    const move = event.target.closest("[data-footer-move]");
    if (move) {
      const index = ids.indexOf(move.dataset.footerMove);
      const target = index + Number(move.dataset.dir);
      if (index < 0 || target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      saveFooterRoutes(ids);
      return;
    }
    const remove = event.target.closest("[data-footer-remove]");
    if (remove && ids.length > 1) {
      saveFooterRoutes(ids.filter(item => item !== remove.dataset.footerRemove));
      return;
    }
    if (event.target.closest("[data-footer-reset]")) saveFooterRoutes(["home", "today", "money", "calendar", "family"]);
  });
  editButton?.addEventListener("click", () => coverInput?.click());
  coverInput?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const coverData = await readFile(file);
      const hero = document.querySelector(".launcher-hero");
      if (!hero) return;

      const currentImage = hero.querySelector(".launcher-hero-art");
      const preview = document.createElement("div");
      preview.className = "launcher-cover-editor";
      preview.innerHTML = `
        <div class="launcher-cover-editor-frame">
          <img class="launcher-cover-editor-image" src="${escapeAttr(coverData)}" alt="" style="--launcher-cover-x: 0%; --launcher-cover-y: 0%;">
        </div>
        <div class="launcher-cover-editor-actions">
          <button class="button ghost-button" type="button" data-launcher-cover-cancel>${languageCode() === "km" ? "បោះបង់" : "Cancel"}</button>
          <button class="button" type="button" data-launcher-cover-save>${languageCode() === "km" ? "រក្សាទុក" : "Save"}</button>
        </div>
      `;

      if (currentImage) currentImage.style.display = "none";
      hero.appendChild(preview);

      const editorImage = preview.querySelector(".launcher-cover-editor-image");
      const frame = preview.querySelector(".launcher-cover-editor-frame");
      let dragStart = null;
      const setPosition = (x, y) => {
        const clampedX = clamp(x, -50, 50);
        const clampedY = clamp(y, -50, 50);
        editorImage.style.setProperty("--launcher-cover-x", `${clampedX}%`);
        editorImage.style.setProperty("--launcher-cover-y", `${clampedY}%`);
      };

      editorImage.addEventListener("pointerdown", event => {
        event.preventDefault();
        editorImage.setPointerCapture(event.pointerId);
        dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, positionX: Number.parseFloat(editorImage.style.getPropertyValue("--launcher-cover-x")) || 0, positionY: Number.parseFloat(editorImage.style.getPropertyValue("--launcher-cover-y")) || 0 };
      });

      editorImage.addEventListener("pointermove", event => {
        if (!dragStart || dragStart.pointerId !== event.pointerId) return;
        const bounds = frame.getBoundingClientRect();
        const dx = ((event.clientX - dragStart.x) / bounds.width) * 100;
        const dy = ((event.clientY - dragStart.y) / bounds.height) * 100;
        setPosition(dragStart.positionX + dx, dragStart.positionY + dy);
      });

      editorImage.addEventListener("pointerup", () => { dragStart = null; });
      editorImage.addEventListener("pointercancel", () => { dragStart = null; });

      preview.querySelector("[data-launcher-cover-cancel]")?.addEventListener("click", () => {
        preview.remove();
        if (currentImage) currentImage.style.display = "";
      });

      preview.querySelector("[data-launcher-cover-save]")?.addEventListener("click", () => {
        const previewX = Number.parseFloat(editorImage.style.getPropertyValue("--launcher-cover-x")) || 0;
        const previewY = Number.parseFloat(editorImage.style.getPropertyValue("--launcher-cover-y")) || 0;
        const x = clamp(-previewX, -50, 50);
        const y = clamp(-previewY, -50, 50);
        preview.remove();
        Store.updateProfile({ launcherCover: coverData, launcherCoverPosition: { x, y } });
        if (currentImage) currentImage.style.display = "";
        Toast.show(languageCode() === "km" ? "បានប្តូររូបភាពផ្ទៃខាងក្រោយ" : "Launcher cover updated");
      });

      coverInput.value = "";
    } catch (error) {
      Toast.show(languageCode() === "km" ? "មិនអាចប្តូររូបភាពបានទេ" : "The cover image could not be changed", "danger");
    }
  });
}

function launcherCoverPosition() {
  const position = appData.profile.launcherCoverPosition || {};
  return {
    x: clamp(Number(position.x) || 0, -50, 50),
    y: clamp(Number(position.y) || 0, -50, 50)
  };
}

function launcherTool(route) {
  const pinned = footerRoutes().some(item => item.id === route.id);
  const description = launcherDescription(route.id);
  const icon = Icons[LAUNCHER_ICON[route.id] || route.icon]();
  const badge = launcherBadge(route.id);
  const km = languageCode() === "km";
  return `
    <div class="tool-launcher-entry">
      <a class="tool-launcher-item tool-${route.id}" href="#${route.id}">
        <span class="tool-launcher-watermark">${icon}</span>
        <span class="tool-launcher-icon">${icon}</span>
        <span class="tool-launcher-copy"><strong>${t(route.labelKey || route.id)}</strong><small>${description}</small>${badge ? `<em class="tool-badge tool-badge-${badge.tone}">${escapeHtml(badge.text)}</em>` : ""}</span>
        <span class="tool-launcher-arrow">${Icons.chevron()}</span>
      </a>
      <button class="tool-footer-pin ${pinned ? "active" : ""}" type="button" data-footer-toggle="${route.id}" aria-pressed="${pinned}" aria-label="${pinned ? (km ? "ដកពី footer" : "Remove from footer") : (km ? "បន្ថែមទៅ footer" : "Add to footer")}">${pinned ? "✓" : "+"}</button>
    </div>
  `;
}

function launcherDescription(routeId) {
  const descriptions = languageCode() === "km" ? {
    home: "កន្លែងចាប់ផ្តើមជីវិតប្រចាំថ្ងៃ",
    today: "កាលវិភាគ លុយ និងអ្វីត្រូវធ្វើថ្ងៃនេះ",
    daily: "ចំណង់ចំណូលចិត្ត និងការរំលឹក",
    summary: "ទិដ្ឋភាពជីវិតទាំងមូលរបស់អ្នក",
    family: "គ្រួសារ និងទំនាក់ទំនង",
    goals: "កំណត់ និងសម្រេចគោលដៅ",
    money: "គ្រប់គ្រងប្រាក់ និងចំណាយ",
    calendar: "រៀបចំកិច្ចការ និងព្រឹត្តិការណ៍",
    memories: "រក្សាទុករូបថត និងការចងចាំ",
    tips: "គន្លឹះជីវិត គ្រួសារ និងស្នេហា",
    settings: "កំណត់តាមចំណូលចិត្តរបស់អ្នក",
    help: "របៀបប្រើ MYLIFE"
  } : {
    home: "Your daily life starting point",
    today: "Today's plan, money and to-dos",
    daily: "Hobbies and reminders",
    summary: "Your complete life overview",
    family: "Family and relationships",
    goals: "Set and reach your goals",
    money: "Manage money and spending",
    calendar: "Plan events and activities",
    memories: "Keep photos and memories",
    tips: "Life, family and love tips",
    settings: "Make MYLIFE yours",
    help: "How to use MYLIFE"
  };
  return descriptions[routeId] || "";
}
