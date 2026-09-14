function renderLauncher() {
  const tools = [...routes, ...utilityRoutes];

  return `
    <section class="launcher-page page">
      <header class="launcher-hero">
        <div class="launcher-hero-copy">
          <h1 class="launcher-brand"><span>MY</span><strong>LIFE</strong></h1>
          <p>${t("launcherTagline")}</p>
        </div>
        <img class="launcher-hero-art" src="assets/launcher-home-hero.png" alt="">
        <button class="icon-button launcher-edit-button" type="button" data-footer-edit aria-label="${languageCode() === "km" ? "កែប្រែ Footer" : "Edit footer"}" title="${languageCode() === "km" ? "កែប្រែ Footer" : "Edit footer"}">${Icons.edit()}</button>
      </header>
      <nav class="tool-launcher" aria-label="App tools">
        ${tools.map(launcherTool).join("")}
      </nav>
    </section>
  `;
}

function bindLauncher() {
  const page = document.querySelector(".launcher-page");
  const editButton = document.querySelector("[data-footer-edit]");
  editButton?.addEventListener("click", () => {
    const editing = page.classList.toggle("launcher-editing");
    editButton.classList.toggle("active", editing);
    const label = editing ? (languageCode() === "km" ? "រួចរាល់" : "Done") : (languageCode() === "km" ? "កែប្រែ Footer" : "Edit footer");
    editButton.innerHTML = editing ? Icons.check() : Icons.edit();
    editButton.setAttribute("aria-label", label);
    editButton.setAttribute("title", label);
  });
  if (sessionStorage.getItem("mylife:open-footer-editor") === "1") {
    sessionStorage.removeItem("mylife:open-footer-editor");
    editButton?.click();
  }
}

function launcherTool(route) {
  const pinned = footerRoutes().some(item => item.id === route.id);
  return `
    <div class="tool-launcher-entry">
      <a class="tool-launcher-item tool-${route.id} ${route.id === "home" ? "active" : ""}" href="#${route.id}">
        <span class="tool-launcher-icon">${Icons[route.icon]()}</span>
        <span>${t(route.id)}</span>
      </a>
      <button class="tool-footer-pin ${pinned ? "active" : ""}" type="button" data-pin-footer="${route.id}" aria-pressed="${pinned}" aria-label="${pinned ? "Remove from footer" : "Add to footer"}" title="${pinned ? "Remove from footer" : "Add to footer"}">${pinned ? "✓" : "+"}</button>
    </div>
  `;
}
