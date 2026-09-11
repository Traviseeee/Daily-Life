const App = {
  route: "home",
  param: "",
  shellClockTimer: null,
  init() {
    Store.load();
    Login.showIfNeeded();
    renderNavigation();
    this.bindChrome();
    this.startShellClock();
    window.addEventListener("hashchange", () => this.render());
    this.render();
  },
  parseRoute() {
    const [route = "home", param = ""] = location.hash.replace("#", "").split("/");
    this.route = route || "home";
    this.param = param;
  },
  render() {
    this.parseRoute();
    const app = document.getElementById("app");
    const route = this.route;
    document.documentElement.lang = languageCode();
    renderNavigation();
    setActiveNav(route);
    this.renderProfile();
    this.renderLanguageSwitch();
    this.renderMoneyPrivacy();
    this.renderSmartAssistant();
    document.body.classList.remove("nav-open");
    document.body.classList.toggle("launcher-page-open", route === "launcher");

    if (route === "launcher") app.innerHTML = renderLauncher();
    else if (route === "family") app.innerHTML = renderFamily();
    else if (route === "goals") app.innerHTML = renderGoals(this.param);
    else if (route === "money") app.innerHTML = renderMoney(this.param || "overview");
    else if (route === "calendar") app.innerHTML = renderCalendar(this.param || "month");
    else if (route === "memories") app.innerHTML = renderMemories();
    else if (route === "settings") app.innerHTML = renderSettings();
    else if (route === "help") app.innerHTML = renderHelp();
    else app.innerHTML = renderHome();

    if (!appData.profile.name) {
      Login.showIfNeeded();
    }

    this.bindPage(route);
    app.focus({ preventScroll: true });
  },
  renderProfile() {
    const avatar = document.getElementById("profileAvatar");
    const name = document.getElementById("profileName");
    if (!avatar || !name) return;
    name.textContent = appData.profile.name || t("setupProfile");
    avatar.innerHTML = appData.profile.photo ? `<img src="${appData.profile.photo}" alt="">` : initials(appData.profile.name);
    document.querySelector("#profileButton small").textContent = t("personalAccount");
  },
  renderLanguageSwitch() {
    document.querySelectorAll("#languageSwitch [data-language]").forEach(button => {
      button.classList.toggle("active", button.dataset.language === (appData.profile.language || "English"));
    });
  },
  renderMoneyPrivacy() {
    const button = document.getElementById("moneyPrivacyButton");
    const hidden = !!appData.profile.moneyHidden;
    document.body.classList.toggle("money-hidden", hidden);
    if (!button) return;
    button.innerHTML = hidden ? Icons.eyeOff() : Icons.eye();
    button.classList.toggle("active", hidden);
    button.setAttribute("aria-label", hidden ? t("showMoney") : t("hideMoney"));
    button.setAttribute("title", hidden ? t("showMoney") : t("hideMoney"));
  },
  renderSmartAssistant() {
    const button = document.getElementById("smartAssistantButton");
    if (!button) return;
    button.innerHTML = Icons.spark();
    button.setAttribute("aria-label", t("smartAssistant"));
    button.setAttribute("title", t("smartAssistant"));
  },
  startShellClock() {
    this.updateShellClock();
    this.shellClockTimer = setInterval(() => this.updateShellClock(), 1000);
  },
  updateShellClock() {
    const clock = document.getElementById("topbarClock");
    if (!clock) return;
    clock.textContent = new Date().toLocaleTimeString(languageCode() === "km" ? "km-KH" : "en-US", {
      hour: "2-digit",
      minute: "2-digit"
    });
  },
  bindPage(route) {
    if (route === "home") bindHome();
    if (route === "family") bindFamily();
    if (route === "goals") bindGoals(this.param);
    if (route === "money") bindMoney();
    if (route === "calendar") bindCalendar();
    if (route === "memories") bindMemories();
    if (route === "settings") bindSettings();
  },
  bindChrome() {
    const menuToggle = document.getElementById("menuToggle");
    const closeLauncher = () => {
      document.body.classList.remove("nav-open");
      menuToggle.setAttribute("aria-expanded", "false");
    };
    const openLauncher = () => {
      document.body.classList.add("nav-open");
      menuToggle.setAttribute("aria-expanded", "true");
    };

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.addEventListener("click", () => {
      location.hash = this.route === "launcher" ? "#home" : "#launcher";
    });
    
    // Close nav when clicking outside the sidebar
    document.addEventListener("click", event => {
      const isNavOpen = document.body.classList.contains("nav-open");
      if (!isNavOpen) return;
      
      const clickedInSidebar = event.target.closest(".sidebar");
      const clickedOnMenuToggle = event.target.closest(".menu-toggle");
      
      // Close only if clicked outside sidebar and not on menu toggle
      if (!clickedInSidebar && !clickedOnMenuToggle) {
        closeLauncher();
      }
    });
    
    // Handle nav-item clicks to navigate and close sidebar
    document.addEventListener("click", event => {
      const navItem = event.target.closest(".nav-item");
      if (!navItem || (!navItem.closest(".sidebar") && !navItem.closest(".mobile-nav"))) return;
      
      const href = navItem.getAttribute("href");
      if (href?.startsWith("#")) {
        event.preventDefault();
        closeLauncher();
        if (location.hash !== href) {
          location.hash = href;
        }
      }
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
        closeLauncher();
        menuToggle.focus();
      }
    });
    document.getElementById("bellButton").addEventListener("click", () => {
      const count = Store.calculate().upcomingBills + appData.calendarEvents.length;
      Toast.show(count ? `${count} ${t("reminder")}` : t("noCalendarEvents"));
    });
    document.getElementById("smartAssistantButton").addEventListener("click", () => SmartAssistant.open());
    document.getElementById("moneyPrivacyButton").addEventListener("click", () => {
      Store.updateProfile({ moneyHidden: !appData.profile.moneyHidden });
      Toast.show(appData.profile.moneyHidden ? t("moneyHidden") : t("moneyVisible"));
    });
    document.getElementById("profileButton").addEventListener("click", () => location.hash = "#settings");
    document.querySelectorAll("#languageSwitch [data-language]").forEach(button => {
      button.addEventListener("click", () => {
        const language = button.dataset.language;
        if (appData.profile.language === language) return;
        Store.updateProfile({ language });
        this.updateShellClock();
        Toast.show(t("languageSwitched"));
      });
    });
    document.getElementById("globalSearch").addEventListener("input", event => this.search(event.target.value));
    document.addEventListener("click", event => {
      if (!event.target.closest(".search-wrap")) document.getElementById("searchResults").hidden = true;
    });
  },
  search(query) {
    const panel = document.getElementById("searchResults");
    const q = query.trim();
    if (!q) {
      panel.hidden = true;
      return;
    }
    const html = Store.search(q).map(([title, items]) => {
      if (!items.length) return "";
      return `<div style="margin-bottom:12px"><strong class="eyebrow">${title}</strong>${items.slice(0, 4).map(item => `<a class="list-row" href="${item.href}"><span>${escapeHtml(item.label)}</span><span class="pill">${item.type}</span></a>`).join("")}</div>`;
    }).join("");
    panel.innerHTML = html || emptyState(t("noResultsFound"), t("searchSavedData"));
    panel.hidden = false;
  },
  openEventModal(event = {}) {
    Modal.open({
      title: event.id ? t("editEvent") : t("addEvent"),
      submitText: event.id ? t("saveEvent") : t("addEvent"),
      fields: [
        { name: "title", label: t("eventTitle"), value: event.title, required: true },
        { name: "date", label: t("date"), type: "date", value: event.date || new Date().toISOString().slice(0, 10), required: true },
        { name: "time", label: t("time"), type: "time", value: event.time },
        { name: "category", label: t("category"), type: "select", options: ["Personal", "Family", "Goal", "Bill", "Loan", "Reminder"], value: event.category || "Personal" },
        { name: "familyMember", label: t("familyMemberName"), type: "select", options: ["", ...appData.family.map(member => member.name)], value: event.familyMember || "" },
        { name: "reminder", label: t("reminder"), type: "checkbox", value: event.reminder ?? true },
        { name: "notes", label: t("notes"), type: "textarea", value: event.notes }
      ],
      onSubmit(data) {
        if (event.id) Store.edit("calendarEvents", event.id, data);
        else Store.add("calendarEvents", data);
        Toast.show(event.id ? t("eventSaved") : t("eventAdded"));
      }
    });
  }
};

function emptyState(title, body, actionLabel = "", action = "") {
  return `
    <div class="empty-card">
      <div>
        <span class="icon-badge">${Icons.plus()}</span>
        <h2>${escapeHtml(title)}</h2>
        <p class="secondary">${escapeHtml(body)}</p>
        ${actionLabel ? `<button class="button" data-action="${action}">${Icons.plus()} ${escapeHtml(actionLabel)}</button>` : ""}
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => App.init());
