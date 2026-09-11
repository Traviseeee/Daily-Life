const routes = [
  { id: "home", label: "Home", icon: "home" },
  { id: "family", label: "Family", icon: "family" },
  { id: "goals", label: "Goals", icon: "goal" },
  { id: "money", label: "Financial", icon: "money" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "memories", label: "Memories", icon: "memory" }
];

const utilityRoutes = [
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "help", label: "Help", icon: "help" }
];

function navLink(route) {
  return `<a class="nav-item" href="#${route.id}" data-route="${route.id}">${Icons[route.icon]()}<span>${t(route.id)}</span></a>`;
}

function renderNavigation() {
  document.getElementById("sideNav").innerHTML = routes.map(navLink).join("");
  document.getElementById("utilityNav").innerHTML = utilityRoutes.map(navLink).join("");
  document.getElementById("mobileNav").innerHTML = ["home", "family", "goals", "money", "settings"].map(id => navLink([...routes, ...utilityRoutes].find(route => route.id === id))).join("");
  document.getElementById("searchIcon").innerHTML = Icons.search();
  document.getElementById("bellButton").innerHTML = Icons.bell();
  const menuToggle = document.getElementById("menuToggle");
  const onLauncherPage = location.hash === "#launcher";
  menuToggle.innerHTML = onLauncherPage ? Icons.home() : Icons.menu();
  menuToggle.setAttribute("aria-label", onLauncherPage ? "Back to Home" : "Open home launcher");
  menuToggle.setAttribute("title", onLauncherPage ? "Back to Home" : "Open home launcher");
  document.getElementById("globalSearch").placeholder = t("searchPlaceholder");
}

function setActiveNav(routeId) {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.route === routeId);
  });
}
