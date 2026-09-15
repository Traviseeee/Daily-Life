function renderLauncher() {
  const tools = [...routes, ...utilityRoutes];

  return `
    <section class="launcher-page page">
      <header class="launcher-hero">
        <div class="launcher-hero-copy">
          <h1 class="launcher-brand"><span>MY</span><strong>LIFE</strong></h1>
          <p>${t("launcherTagline")}</p>
        </div>
        <img class="launcher-hero-art" src="${escapeAttr(appData.profile.launcherCover || "assets/launcher-home-hero.png")}" alt="">
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
      const cover = await readFile(file);
      Store.updateProfile({ launcherCover: cover });
      Toast.show(languageCode() === "km" ? "បានប្តូររូបភាពផ្ទៃខាងក្រោយ" : "Launcher cover updated");
    } catch (error) {
      Toast.show(languageCode() === "km" ? "មិនអាចប្តូររូបភាពបានទេ" : "The cover image could not be changed", "danger");
    }
  });
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
