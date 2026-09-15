function renderLauncher() {
  const tools = [...routes, ...utilityRoutes];

  return `
    <section class="launcher-page page">
      <header class="launcher-hero">
        <div class="launcher-hero-copy">
          <h1 class="launcher-brand"><span>MY</span><strong>LIFE</strong></h1>
          <p>${t("launcherTagline")}</p>
        </div>
        <img class="launcher-hero-art" src="${escapeAttr(appData.profile.launcherCover || "assets/launcher-home-hero.png")}" style="--launcher-cover-x: ${launcherCoverPosition().x}%; --launcher-cover-y: ${launcherCoverPosition().y}%" alt="">
        <button class="icon-button launcher-edit-button" type="button" data-launcher-cover aria-label="${languageCode() === "km" ? "ប្តូររូបភាពផ្ទៃខាងក្រោយ" : "Change launcher cover"}" title="${languageCode() === "km" ? "ប្តូររូបភាពផ្ទៃខាងក្រោយ" : "Change launcher cover"}">${Icons.edit()}</button>
        <input class="sr-only" type="file" accept="image/*" data-launcher-cover-input>
      </header>
      <nav class="tool-launcher" aria-label="App tools">
        ${tools.map(launcherTool).join("")}
      </nav>
    </section>
  `;
}

function bindLauncher() {
  const page = document.querySelector(".launcher-page");
  const cover = document.querySelector(".launcher-hero-art");
  const editButton = document.querySelector("[data-launcher-cover]");
  const coverInput = document.querySelector("[data-launcher-cover-input]");
  editButton?.addEventListener("click", () => coverInput?.click());
  let dragStart;
  cover?.addEventListener("pointerdown", event => {
    event.preventDefault();
    cover.setPointerCapture(event.pointerId);
    const position = launcherCoverPosition();
    dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, position };
    cover.classList.add("is-dragging");
  });
  cover?.addEventListener("pointermove", event => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    const hero = cover.closest(".launcher-hero");
    if (!hero) return;
    const bounds = hero.getBoundingClientRect();
    const x = clamp(dragStart.position.x + ((event.clientX - dragStart.x) / bounds.width) * 100, -50, 50);
    const y = clamp(dragStart.position.y + ((event.clientY - dragStart.y) / bounds.height) * 100, -50, 50);
    cover.style.setProperty("--launcher-cover-x", `${x}%`);
    cover.style.setProperty("--launcher-cover-y", `${y}%`);
  });
  const finishCoverDrag = event => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    const x = Number.parseFloat(cover.style.getPropertyValue("--launcher-cover-x")) || 0;
    const y = Number.parseFloat(cover.style.getPropertyValue("--launcher-cover-y")) || 0;
    dragStart = null;
    cover.classList.remove("is-dragging");
    if (x !== launcherCoverPosition().x || y !== launcherCoverPosition().y) {
      Store.updateProfile({ launcherCoverPosition: { x, y } });
    }
  };
  cover?.addEventListener("pointerup", finishCoverDrag);
  cover?.addEventListener("pointercancel", finishCoverDrag);
  coverInput?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const cover = await readFile(file);
      Store.updateProfile({ launcherCover: cover });
      Toast.show(languageCode() === "km" ? "បានប្តូររូបភាពផ្ទៃខាងក្រោយ" : "Launcher cover updated");
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

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function launcherTool(route) {
  const pinned = footerRoutes().some(item => item.id === route.id);
  const description = launcherDescription(route.id);
  return `
    <div class="tool-launcher-entry">
      <a class="tool-launcher-item tool-${route.id} ${route.id === "home" ? "active" : ""}" href="#${route.id}">
        <span class="tool-launcher-watermark">${Icons[route.icon]()}</span>
        <span class="tool-launcher-icon">${Icons[route.icon]()}</span>
        <span class="tool-launcher-copy"><strong>${t(route.id)}</strong><small>${description}</small></span>
        <span class="tool-launcher-arrow">${Icons.chevron()}</span>
      </a>
      <button class="tool-footer-pin ${pinned ? "active" : ""}" type="button" data-pin-footer="${route.id}" aria-pressed="${pinned}" aria-label="${pinned ? "Remove from footer" : "Add to footer"}" title="${pinned ? "Remove from footer" : "Add to footer"}">${pinned ? "✓" : "+"}</button>
    </div>
  `;
}

function launcherDescription(routeId) {
  const descriptions = languageCode() === "km" ? {
    home: "កន្លែងចាប់ផ្តើមជីវិតប្រចាំថ្ងៃ",
    family: "គ្រួសារ និងទំនាក់ទំនង",
    goals: "កំណត់ និងសម្រេចគោលដៅ",
    money: "គ្រប់គ្រងប្រាក់ និងចំណាយ",
    calendar: "រៀបចំកិច្ចការ និងព្រឹត្តិការណ៍",
    memories: "រក្សាទុករូបថត និងការចងចាំ",
    tips: "គំនិត និង FAQ មានប្រយោជន៍",
    settings: "កំណត់តាមចំណូលចិត្តរបស់អ្នក",
    help: "ជំនួយ និងការណែនាំប្រើប្រាស់"
  } : {
    home: "Your daily life starting point",
    family: "Family and relationships",
    goals: "Set and reach your goals",
    money: "Manage money and spending",
    calendar: "Plan events and activities",
    memories: "Keep photos and memories",
    tips: "Useful ideas and FAQs",
    settings: "Make MYLIFE yours",
    help: "Guides and support"
  };
  return descriptions[routeId] || "";
}
