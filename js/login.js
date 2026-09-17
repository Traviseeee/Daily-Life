const LOGIN_SESSION_KEY = "mylife:login-session:v1";

const Login = {
  isOpen: false,
  authenticated: false,

  getRememberedSession() {
    try {
      const raw = localStorage.getItem(LOGIN_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const expiresAt = Number(parsed?.expiresAt || 0);
      if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
        localStorage.removeItem(LOGIN_SESSION_KEY);
        return null;
      }
      return parsed;
    } catch (error) {
      localStorage.removeItem(LOGIN_SESSION_KEY);
      return null;
    }
  },

  setRememberedSession(rememberMe) {
    if (!rememberMe) {
      localStorage.removeItem(LOGIN_SESSION_KEY);
      return;
    }
    localStorage.setItem(LOGIN_SESSION_KEY, JSON.stringify({ expiresAt: Date.now() + 24 * 60 * 60 * 1000 }));
  },

  open(mode = "login") {
    if (this.isOpen) return;
    const supabaseConfigured = Boolean(window.MYLIFE_SUPABASE?.enabled && window.supabaseClient);
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
          <h2>${isReset ? t("resetPassword") : hasAccount ? t("unlockMylife") : isLegacy ? t("secureAccount") : supabaseConfigured ? "Create account" : t("createAccount")}</h2>
          <p>${isReset ? t("resetPasswordHelp") : hasAccount ? t("enterPassword") : isLegacy ? t("secureAccountHelp") : supabaseConfigured ? "Set up your MYLIFE account with email and password." : t("createAccountHelp")}</p>
        </div>
        <form id="loginForm">
          <div class="login-input-group">
            <label for="loginName">${supabaseConfigured ? "Email" : t("yourName")}</label>
            <input 
              id="loginName" 
              type="text" 
              placeholder="${supabaseConfigured ? "you@example.com" : t("enterYourName")}" 
              autocomplete="${supabaseConfigured ? "email" : "name"}"
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
          <div class="login-input-group login-remember-row">
            <label for="loginRemember" class="login-remember">
              <input id="loginRemember" type="checkbox" checked>
              <span>${t("rememberMe")}</span>
            </label>
          </div>
          <p class="login-error" id="loginError" role="alert"></p>
          <button type="submit" class="button login-button">${isReset ? t("saveNewPassword") : hasAccount ? t("unlock") : isLegacy ? t("secureAccount") : supabaseConfigured ? "Create account" : t("createAccount")}</button>
          ${hasAccount && !isReset ? `<button type="button" class="login-reset-link" id="loginResetButton">${t("forgotPassword")}</button>` : ""}
        </form>
        <div class="login-footer">
          <p class="secondary">${supabaseConfigured ? "Your data is securely synced to your Supabase account." : t("noDataStored")}</p>
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
    const rememberMe = document.getElementById("loginRemember")?.checked ?? true;
    const error = document.getElementById("loginError");
    const showError = message => { error.textContent = message; };

    const supabaseConfigured = Boolean(window.MYLIFE_SUPABASE?.enabled && window.supabaseClient);

    if (supabaseConfigured) {
      if (!name || !name.includes("@")) return showError("Please enter a valid email address.");
      if (password.length < 6) return showError("Password must be at least 6 characters.");
      if ((isReset || !hasAccount) && password !== confirmation) return showError(t("passwordMismatch"));

      try {
        const email = name;
        const result = !hasAccount && !isLegacy && !isReset
          ? await window.MYLIFE_SUPABASE_API.signUp(email, password)
          : await window.MYLIFE_SUPABASE_API.signIn(email, password);

        if (result.error) {
          showError(result.error.message || "Authentication failed.");
          return;
        }

        if (name) {
          Store.updateProfile({ name: name.split("@")?.[0] || appData.profile.name || "User" });
        }

        await Store.syncToSupabase();
        this.authenticated = true;
        this.setRememberedSession(rememberMe);
        this.close();
        App.render();
        return;
      } catch (authError) {
        showError(authError.message || "Authentication failed.");
        return;
      }
    }

    if (!hasAccount && !isLegacy && !name) return showError(t("nameRequired"));
    if (isReset && await this.hash(recoveryAnswer.toLowerCase()) !== appData.profile.recoveryAnswerHash) return showError(t("wrongRecoveryAnswer"));
    if (password.length < 4) return showError(t("passwordTooShort"));
    if ((isReset || !hasAccount) && password !== confirmation) return showError(t("passwordMismatch"));
    const hash = await this.hash(password);
    if (hasAccount && !isReset && hash !== appData.profile.passwordHash) return showError(t("wrongPassword"));
    if (!hasAccount) Store.updateProfile({ name: name || appData.profile.name, passwordHash: hash, recoveryAnswerHash: await this.hash(recoveryAnswer.toLowerCase()) });
    if (isReset) Store.updateProfile({ passwordHash: hash });
    this.authenticated = true;
    this.setRememberedSession(rememberMe);
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

  async showIfNeeded() {
    if (this.isOpen) return;
    if (this.getRememberedSession()) {
      this.authenticated = true;
      return;
    }
    if (this.authenticated) return;

    const supabaseSessionReady = window.MYLIFE_SUPABASE?.enabled && window.supabaseClient && window.supabaseClient.auth?.getSession;
    if (supabaseSessionReady) {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session) {
        this.authenticated = true;
        return;
      }
    }

    const modalRoot = document.getElementById("modalRoot");
    if (!modalRoot) return;
    requestAnimationFrame(() => {
      if (!this.isOpen && !this.authenticated && !this.getRememberedSession()) {
        this.open();
      }
    });
  }
};
