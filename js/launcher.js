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
  const editButton = document.querySelector("[data-launcher-cover]");
  const coverInput = document.querySelector("[data-launcher-cover-input]");
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
