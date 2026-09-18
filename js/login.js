const LOGIN_SESSION_KEY = "mylife:login-session:v1";

const Login = {
  isOpen: false,
  authenticated: false,
  guestMode: false,

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
    const isReset = mode === "reset";
    const authMode = supabaseConfigured ? (mode === "signup" ? "signup" : "login") : "create";
    const isSignup = authMode === "signup";
    this.isOpen = true;
    const modal = document.createElement("div");
    modal.className = "login-modal glass-card";
    modal.id = "loginModal";
    modal.innerHTML = `
      <div class="login-content">
        <div class="login-header">
          <span class="login-mark">${Icons.home()}</span>
          <h2>${isReset ? "Reset password" : hasAccount ? t("unlockMylife") : isLegacy ? t("secureAccount") : supabaseConfigured ? (isSignup ? "Create account" : "Log in") : t("createAccount")}</h2>
          <p>${isReset ? "Enter your email and we’ll send a reset link to your inbox." : hasAccount ? t("enterPassword") : isLegacy ? t("secureAccountHelp") : supabaseConfigured ? (isSignup ? "Create a new MYLIFE account with email and password." : "Sign in to your existing MYLIFE account.") : t("createAccountHelp")}</p>
        </div>
        ${supabaseConfigured && !isReset ? `
          <div class="login-mode-toggle" aria-label="Authentication mode">
            <button type="button" class="login-mode-button ${!isSignup ? "active" : ""}" data-auth-mode="login">Log in</button>
            <button type="button" class="login-mode-button ${isSignup ? "active" : ""}" data-auth-mode="signup">Create account</button>
          </div>
        ` : ""}
        <form id="loginForm">
          ${isReset ? `
            <div class="login-input-group">
              <label for="loginName">Email</label>
              <input id="loginName" type="email" placeholder="you@example.com" autocomplete="email" value="${appData.profile.name || ""}" required />
            </div>
          ` : supabaseConfigured ? `
            <div class="login-input-group">
              <label for="loginName">Email</label>
              <input id="loginName" type="email" placeholder="you@example.com" autocomplete="email" value="" required />
            </div>
            ${isSignup ? `<div class="login-input-group"><label for="loginPassword">Password</label><input id="loginPassword" type="password" placeholder="Enter your password" autocomplete="new-password" minlength="6" required /></div><div class="login-input-group"><label for="loginPasswordConfirm">Confirm password</label><input id="loginPasswordConfirm" type="password" placeholder="Confirm your password" autocomplete="new-password" minlength="6" required /></div>` : `<div class="login-input-group"><label for="loginPassword">Password</label><input id="loginPassword" type="password" placeholder="Enter your password" autocomplete="current-password" minlength="6" required /></div>`}
          ` : `
            <div class="login-input-group">
              <label for="loginName">${t("yourName")}</label>
              <input id="loginName" type="text" placeholder="${t("enterYourName")}" autocomplete="name" value="" required />
            </div>
            <div class="login-input-group">
              <label for="loginPassword">${t("password")}</label>
              <input id="loginPassword" type="password" placeholder="${t("enterPassword")}" autocomplete="${hasAccount ? "current-password" : "new-password"}" minlength="4" required />
            </div>
            ${!hasAccount ? `<div class="login-input-group"><label for="loginPasswordConfirm">${t("confirmPassword")}</label><input id="loginPasswordConfirm" type="password" placeholder="${t("confirmPassword")}" autocomplete="new-password" minlength="4" required /></div>` : ""}
            ${!hasAccount ? `<div class="login-input-group"><label for="loginRecoveryAnswer">${t("dogNameQuestion")}</label><input id="loginRecoveryAnswer" type="text" placeholder="${t("dogNamePlaceholder")}" autocomplete="off" required /></div>` : ""}
          `}
          <div class="login-input-group login-remember-row">
            <label for="loginRemember" class="login-remember">
              <input id="loginRemember" type="checkbox" checked>
              <span>${t("rememberMe")}</span>
            </label>
          </div>
          <p class="login-error" id="loginError" role="alert"></p>
          <button type="submit" class="button login-button">${isReset ? "Send reset link" : hasAccount ? t("unlock") : isLegacy ? t("secureAccount") : supabaseConfigured ? (isSignup ? "Create account" : "Log in") : t("createAccount")}</button>
          <button type="button" class="login-guest-button" id="loginGuestButton">${t("continueAsGuest")}</button>
          ${(supabaseConfigured || hasAccount) && !isReset ? `<button type="button" class="login-reset-link" id="loginResetButton">${t("forgotPassword")}</button>` : ""}
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
      const currentMode = document.querySelector(".login-mode-button.active")?.dataset.authMode || (supabaseConfigured ? "login" : "create");
      const submitIsSignup = supabaseConfigured ? currentMode === "signup" : !hasAccount;
      this.submit(hasAccount, isReset, isLegacy, submitIsSignup);
    });
    document.querySelectorAll("[data-auth-mode]").forEach(button => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.authMode;
        if (nextMode === authMode) return;
        this.close();
        this.open(nextMode);
      });
    });
    document.getElementById("loginResetButton")?.addEventListener("click", () => {
      this.close();
      this.open("reset");
    });
    document.getElementById("loginGuestButton")?.addEventListener("click", () => this.startGuest());

    document.getElementById(isReset ? "loginName" : hasAccount ? "loginPassword" : "loginName").focus();
  },

  startGuest() {
    const language = appData.profile.language || "English";
    Object.assign(appData, structuredClone(emptyData), demoData());
    appData.profile = { ...emptyData.profile, ...appData.profile, name: t("guestPreview"), language };
    this.guestMode = true;
    this.authenticated = true;
    this.setRememberedSession(false);
    this.close();
    App.render();
  },

  async submit(hasAccount, isReset, isLegacy, isSignup = false) {
    const nameInput = document.getElementById("loginName");
    const passwordInput = document.getElementById("loginPassword");
    const confirmationInput = document.getElementById("loginPasswordConfirm");
    const recoveryInput = document.getElementById("loginRecoveryAnswer");

    const name = (nameInput?.value || "").trim();
    const password = passwordInput?.value || "";
    const confirmation = confirmationInput?.value || "";
    const recoveryAnswer = recoveryInput?.value.trim() || "";
    const rememberMe = document.getElementById("loginRemember")?.checked ?? true;
    const error = document.getElementById("loginError");
    const showError = message => { error.textContent = message; };

    const supabaseConfigured = Boolean(window.MYLIFE_SUPABASE?.enabled && window.supabaseClient);
    const activeMode = document.querySelector(".login-mode-button.active")?.dataset.authMode || "login";
    const resolvedIsSignup = supabaseConfigured ? activeMode === "signup" : !hasAccount;
    const effectiveSignup = typeof isSignup === "boolean" ? isSignup : resolvedIsSignup;

    if (isReset && supabaseConfigured) {
      if (!name || !name.includes("@")) return showError("Please enter a valid email address.");
      try {
        const { error } = await window.MYLIFE_SUPABASE_API.resetPassword(name);
        if (error) {
          showError(error.message || "Unable to send the reset email.");
          return;
        }
        showError("Reset link sent. Please check your email.");
        setTimeout(() => {
          this.close();
          this.open("login");
        }, 1000);
        return;
      } catch (error) {
        showError(error.message || "Unable to send the reset email.");
        return;
      }
    }

    if (supabaseConfigured) {
      if (!name || !name.includes("@")) return showError("Please enter a valid email address.");
      if (password.length < 6) return showError("Password must be at least 6 characters.");
      if (effectiveSignup && password !== confirmation) return showError(t("passwordMismatch"));

      try {
        const email = name;
        const result = effectiveSignup
          ? await window.MYLIFE_SUPABASE_API.signUp(email, password)
          : await window.MYLIFE_SUPABASE_API.signIn(email, password);

        if (result.error) {
          const message = String(result.error.message || "Authentication failed.");
          if (effectiveSignup && /already|exists|registered/i.test(message)) {
            showError("This email is already in use. Please log in instead.");
            this.close();
            this.open("login");
            return;
          }
          showError(message);
          return;
        }

        if (name) {
          const displayName = name.split("@")?.[0] || appData.profile.name || "User";
          Store.updateProfile({ name: displayName, email }, { sync: false });
          Store.migrateLegacyLocalData();
        }

        if (effectiveSignup && !result.data?.session) {
          showError("Account created. Please check your email to confirm, then log in.");
          this.close();
          this.open("login");
          return;
        }

        // Local-only data is no longer discarded here: syncFromSupabase drops the
        // cached payload only when it belongs to a different account, so signing up
        // on a device that already holds offline data keeps that data.
        await Store.syncFromSupabase();
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

  async logout() {
    try {
      // Push anything that never reached the cloud before the session disappears.
      // The pending flag survives a failure, so it is retried after the next login.
      if (window.MYLIFE_SUPABASE?.enabled && window.supabaseClient) {
        await Store.flushPendingSync();
      }
    } catch (error) {
      console.warn("MYLIFE could not flush pending changes before signing out.", error);
    }

    try {
      if (window.MYLIFE_SUPABASE?.enabled && window.supabaseClient) {
        await window.MYLIFE_SUPABASE_API.signOut();
      }
    } catch (error) {
      console.warn("Could not sign out from Supabase.", error);
    }

    localStorage.removeItem(LOGIN_SESSION_KEY);
    if (this.guestMode) {
      Object.assign(appData, structuredClone(emptyData));
      this.guestMode = false;
    }
    this.authenticated = false;
    this.isOpen = false;
    this.close();
    if (window.location.hash !== "#home") {
      window.location.hash = "#home";
    }
    requestAnimationFrame(() => this.showIfNeeded());
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
