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
      </header>
      <nav class="tool-launcher" aria-label="App tools">
        ${tools.map(launcherTool).join("")}
      </nav>
    </section>
  `;
}

function launcherTool(route) {
  return `
    <a class="tool-launcher-item tool-${route.id} ${route.id === "home" ? "active" : ""}" href="#${route.id}">
      <span class="tool-launcher-icon">${Icons[route.icon]()}</span>
      <span>${t(route.id)}</span>
    </a>
  `;
}
