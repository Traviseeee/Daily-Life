const Login = {
  isOpen: false,

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    const modal = document.createElement("div");
    modal.className = "login-modal glass-card";
    modal.id = "loginModal";
    modal.innerHTML = `
      <div class="login-content">
        <div class="login-header">
          <h2>${t("welcomeToMylife")}</h2>
          <p>${t("enterYourName")}</p>
        </div>
        <form id="loginForm">
          <div class="login-input-group">
            <label for="loginName">${t("yourName")}</label>
            <input 
              id="loginName" 
              type="text" 
              placeholder="${t("enterYourName")}"
              autocomplete="off"
              value="${appData.profile.name || ""}"
            />
          </div>
          <button type="submit" class="button login-button">${t("continue")}</button>
        </form>
        <div class="login-footer">
          <p class="secondary">${t("noDataStored")}</p>
        </div>
      </div>
    `;
    document.getElementById("modalRoot").appendChild(modal);

    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("loginName").value.trim();
      if (name) {
        Store.updateProfile({ name });
        this.close();
        App.render();
      }
    });

    document.getElementById("loginName").focus();
  },

  close() {
    this.isOpen = false;
    const modal = document.getElementById("loginModal");
    if (modal) modal.remove();
  },

  showIfNeeded() {
    if (this.isOpen || appData.profile.name) return;
    const modalRoot = document.getElementById("modalRoot");
    if (!modalRoot) return;
    requestAnimationFrame(() => {
      if (!this.isOpen && !appData.profile.name) {
        this.open();
      }
    });
  }
};
