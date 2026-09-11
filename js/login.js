const Login = {
  isOpen: false,
  authenticated: false,

  open(mode = "login") {
    if (this.isOpen) return;
    const hasProfile = Boolean(appData.profile.name);
    const hasAccount = Boolean(hasProfile && appData.profile.passwordHash);
    const isLegacy = hasProfile && !hasAccount;
    const isReset = mode === "reset" && hasAccount;
    this.isOpen = true;
    const modal = document.createElement("div");
    modal.className = "login-modal glass-card";
    modal.id = "loginModal";
    modal.innerHTML = `
      <div class="login-content">
        <div class="login-header">
          <span class="login-mark">${Icons.home()}</span>
          <h2>${isReset ? t("resetPassword") : hasAccount ? t("unlockMylife") : isLegacy ? t("secureAccount") : t("createAccount")}</h2>
          <p>${isReset ? t("resetPasswordHelp") : hasAccount ? t("enterPassword") : isLegacy ? t("secureAccountHelp") : t("createAccountHelp")}</p>
        </div>
        <form id="loginForm">
          <div class="login-input-group">
            <label for="loginName">${t("yourName")}</label>
            <input 
              id="loginName" 
              type="text" 
              placeholder="${t("enterYourName")}"
              autocomplete="name"
              ${(hasAccount || isReset || isLegacy) ? "readonly" : ""}
              value="${appData.profile.name || ""}"
            />
          </div>
          ${isReset ? `<div class="login-input-group"><label for="loginRecoveryAnswer">${t("dogNameQuestion")}</label><input id="loginRecoveryAnswer" type="text" autocomplete="off" required /></div>` : ""}
          ${isReset || isLegacy ? "" : `<div class="login-input-group">`}
            <label for="loginPassword">${t("password")}</label>
            <input id="loginPassword" type="password" placeholder="${t("enterPassword")}" autocomplete="${hasAccount && !isReset ? "current-password" : "new-password"}" minlength="4" required />
          </div>
          ${isReset || !hasAccount ? `<div class="login-input-group"><label for="loginPasswordConfirm">${t("confirmPassword")}</label><input id="loginPasswordConfirm" type="password" placeholder="${t("confirmPassword")}" autocomplete="new-password" minlength="4" required /></div>` : ""}
          ${!hasAccount ? `<div class="login-input-group"><label for="loginRecoveryAnswer">${t("dogNameQuestion")}</label><input id="loginRecoveryAnswer" type="text" placeholder="${t("dogNamePlaceholder")}" autocomplete="off" required /></div>` : ""}
          <p class="login-error" id="loginError" role="alert"></p>
          <button type="submit" class="button login-button">${isReset ? t("saveNewPassword") : hasAccount ? t("unlock") : isLegacy ? t("secureAccount") : t("createAccount")}</button>
          ${hasAccount && !isReset ? `<button type="button" class="login-reset-link" id="loginResetButton">${t("forgotPassword")}</button>` : ""}
        </form>
        <div class="login-footer">
          <p class="secondary">${t("noDataStored")}</p>
        </div>
      </div>
    `;
    const modalRoot = document.getElementById("modalRoot");
    modalRoot.classList.add("open");
    modalRoot.appendChild(modal);

    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.submit(hasAccount, isReset, isLegacy);
    });
    document.getElementById("loginResetButton")?.addEventListener("click", () => {
      this.close();
      this.open("reset");
    });

    document.getElementById(isReset ? "loginRecoveryAnswer" : hasAccount ? "loginPassword" : "loginName").focus();
  },

  async submit(hasAccount, isReset, isLegacy) {
    const name = document.getElementById("loginName").value.trim();
    const password = document.getElementById("loginPassword").value;
    const confirmation = document.getElementById("loginPasswordConfirm")?.value;
    const recoveryAnswer = document.getElementById("loginRecoveryAnswer")?.value.trim();
    const error = document.getElementById("loginError");
    const showError = message => { error.textContent = message; };

    if (!hasAccount && !isLegacy && !name) return showError(t("nameRequired"));
    if (isReset && await this.hash(recoveryAnswer.toLowerCase()) !== appData.profile.recoveryAnswerHash) return showError(t("wrongRecoveryAnswer"));
    if (password.length < 4) return showError(t("passwordTooShort"));
    if ((isReset || !hasAccount) && password !== confirmation) return showError(t("passwordMismatch"));
    const hash = await this.hash(password);
    if (hasAccount && !isReset && hash !== appData.profile.passwordHash) return showError(t("wrongPassword"));
    if (!hasAccount) Store.updateProfile({ name: name || appData.profile.name, passwordHash: hash, recoveryAnswerHash: await this.hash(recoveryAnswer.toLowerCase()) });
    if (isReset) Store.updateProfile({ passwordHash: hash });
    this.authenticated = true;
    this.close();
    App.render();
  },

  async hash(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  },

  close() {
    this.isOpen = false;
    const modal = document.getElementById("loginModal");
    if (modal) modal.remove();
    document.getElementById("modalRoot")?.classList.remove("open");
  },

  showIfNeeded() {
    if (this.isOpen || this.authenticated) return;
    const modalRoot = document.getElementById("modalRoot");
    if (!modalRoot) return;
    requestAnimationFrame(() => {
      if (!this.isOpen && !this.authenticated) {
        this.open();
      }
    });
  }
};
