const routes = [
  { id: "home", label: "Home", icon: "home" },
  { id: "today", labelKey: "today", icon: "sun" },
  { id: "summary", labelKey: "smartSummary", icon: "chart" },
  { id: "family", label: "Family", icon: "family" },
  { id: "goals", label: "Goals", icon: "goal" },
  { id: "money", label: "Financial", icon: "money" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "daily", label: "Daily life", icon: "spark" },
  { id: "memories", label: "Memories", icon: "memory" }
];

const utilityRoutes = [
  { id: "tips", label: "Tips", icon: "help" },
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "help", label: "Help", icon: "help" }
];

const FOOTER_ROUTES_KEY = "mylife:footer-routes";

function footerRoutes() {
  const allRoutes = [...routes, ...utilityRoutes];
  const defaults = ["home", "today", "money", "calendar", "family"];
  try {
    let saved = JSON.parse(localStorage.getItem(FOOTER_ROUTES_KEY) || "null");
    // one-time: put Today in the footer (it is the most useful page); Goals moves to ☰
    if (Array.isArray(saved) && !saved.includes("today") && !localStorage.getItem("mylife:footer-today-v1")) {
      const at = saved.indexOf("goals");
      if (at >= 0) saved.splice(at, 1, "today");
      else saved.splice(1, 0, "today");
      saved = saved.slice(0, 5);
      localStorage.setItem(FOOTER_ROUTES_KEY, JSON.stringify(saved));
    }
    localStorage.setItem("mylife:footer-today-v1", "1");
    const selected = Array.isArray(saved) ? saved.filter(id => allRoutes.some(route => route.id === id)) : defaults;
    return (selected.length ? selected : defaults).slice(0, 5).map(id => allRoutes.find(route => route.id === id));
  } catch (error) {
    return defaults.map(id => allRoutes.find(route => route.id === id));
  }
}

function navLink(route) {
  return `<a class="nav-item" href="#${route.id}" data-route="${route.id}">${Icons[route.icon]()}<span>${t(route.labelKey || route.id)}</span></a>`;
}

function renderNavigation() {
  document.getElementById("sideNav").innerHTML = routes.map(navLink).join("");
  document.getElementById("utilityNav").innerHTML = utilityRoutes.map(navLink).join("");
  document.getElementById("mobileNav").innerHTML = footerRoutes().map(navLink).join("");
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

function bindNavigationSheetGestures() {
  if (document.documentElement.dataset.navigationSheetGesturesBound) return;
  let gestureStart = null;
  const sheetSelector = ".financial-sidebar, .goals-sidebar";
  const handleSelector = ".financial-sidebar-handle, .goals-sidebar-handle";

  document.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch") return;
    const handle = event.target.closest(handleSelector);
    if (handle) {
      gestureStart = { y: event.clientY, direction: "close", dialog: handle.closest("dialog") };
      return;
    }
    if (event.target.closest(`${sheetSelector}, .mobile-nav, button, a, input, select, textarea`)) return;
    gestureStart = event.clientY >= window.innerHeight - 150
      ? { y: event.clientY, direction: "open" }
      : null;
  });

  document.addEventListener("pointerup", event => {
    if (!gestureStart) return;
    const distance = event.clientY - gestureStart.y;
    const { direction, dialog } = gestureStart;
    gestureStart = null;
    if (direction === "open" && distance < -64) {
      const sheet = document.querySelector(sheetSelector);
      if (sheet && !sheet.open) sheet.showModal();
    } else if (direction === "close" && distance > 64) {
      dialog?.close();
    }
  });

  document.addEventListener("pointercancel", () => { gestureStart = null; });
  document.documentElement.dataset.navigationSheetGesturesBound = "true";
}
