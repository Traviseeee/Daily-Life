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
    // Private app: new accounts are closed (also turn off sign-ups in Supabase Auth).
    // Set SIGNUP_OPEN to true to show "Create account" again.
    // closed for strangers; open for someone who came with a family invite link (js/family-group.js)
    const SIGNUP_OPEN = (() => { try { return Boolean(sessionStorage.getItem("mylife:family-join") || localStorage.getItem("mylife:family-join")); } catch (error) { return false; } })();
    const supabaseConfigured = Boolean(window.MYLIFE_SUPABASE?.enabled && window.supabaseClient);
    const hasProfile = Boolean(appData.profile.name);
    const hasAccount = Boolean(hasProfile && appData.profile.passwordHash);
    const isLegacy = hasProfile && !hasAccount;
    const isReset = mode === "reset";
    const authMode = supabaseConfigured ? (mode === "signup" && SIGNUP_OPEN ? "signup" : "login") : "create";
    const isSignup = authMode === "signup";
    this.isOpen = true;
    const L = (km, en) => (typeof languageCode === "function" && languageCode() === "km" ? km : en);
    const LOGO = '<svg class="login-logo" viewBox="0 0 240 240" aria-hidden="true"><rect width="240" height="240" rx="56" fill="#0f3326"/><circle cx="120" cy="120" r="66" fill="none" stroke="#1f4a38" stroke-width="22"/><circle class="login-logo-ring" cx="120" cy="120" r="66" fill="none" stroke="#d9ff7b" stroke-width="22" stroke-linecap="round" stroke-dasharray="311 415" transform="rotate(-90 120 120)"/><circle cx="120" cy="120" r="20" fill="#9ef06a"/></svg>';
    const modal = document.createElement("div");
    modal.className = "login-modal glass-card";
    modal.id = "loginModal";
    modal.innerHTML = `
      <div class="login-content">
        <span class="login-blob login-blob-a" aria-hidden="true"></span>
        <span class="login-blob login-blob-b" aria-hidden="true"></span>
        <span class="login-blob login-blob-c" aria-hidden="true"></span>
        <div class="login-brand">
          ${LOGO}
          <div><strong>MY <em>LIFE</em></strong><small>${L("លុយ · គ្រួសារ · ប្រតិទិន · AI", "Money · family · calendar · AI")}</small></div>
        </div>
        <div class="login-glass">
        <div class="login-header">
          <h2>${isReset ? L("ប្ដូរពាក្យសម្ងាត់", "Reset password") : hasAccount ? t("unlockMylife") : isLegacy ? t("secureAccount") : supabaseConfigured ? (isSignup ? L("បង្កើតគណនី", "Create account") : L("ចូលគណនី", "Log in")) : t("createAccount")}</h2>
          <p>${isReset ? L("ដាក់ email របស់អ្នក យើងនឹងផ្ញើតំណប្ដូរពាក្យសម្ងាត់ទៅ inbox។", "Enter your email and we’ll send a reset link to your inbox.") : hasAccount ? t("enterPassword") : isLegacy ? t("secureAccountHelp") : supabaseConfigured ? (isSignup ? L("បង្កើតគណនី MYLIFE ថ្មីដោយ email និងពាក្យសម្ងាត់។", "Create a new MYLIFE account with email and password.") : L("សូមស្វាគមន៍ត្រលប់មកវិញ 👋 ចូលដើម្បីបន្ត។", "Welcome back 👋 Sign in to continue.")) : t("createAccountHelp")}</p>
        </div>
        ${supabaseConfigured && !isReset && SIGNUP_OPEN ? `
          <div class="login-mode-toggle" aria-label="Authentication mode">
            <button type="button" class="login-mode-button ${!isSignup ? "active" : ""}" data-auth-mode="login">${L("ចូលគណនី", "Log in")}</button>
            <button type="button" class="login-mode-button ${isSignup ? "active" : ""}" data-auth-mode="signup">${L("បង្កើតគណនី", "Create account")}</button>
          </div>
        ` : ""}
        ${supabaseConfigured && !isReset ? `
          <button type="button" class="login-google-button" id="loginGoogleButton"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"/></svg><span>${L("បន្តជាមួយ Google", "Continue with Google")}</span></button>
          <div class="login-or" aria-hidden="true"><span>${L("ឬប្រើ email", "or use email")}</span></div>
        ` : ""}
        <form id="loginForm">
          ${isReset ? `
            <div class="login-input-group">
              <label for="loginName">Email</label>
              <input id="loginName" type="email" placeholder="${L("ឈ្មោះ@gmail.com", "you@example.com")}" autocomplete="email" value="${appData.profile.name || ""}" required />
            </div>
          ` : supabaseConfigured ? `
            <div class="login-input-group">
              <label for="loginName">Email</label>
              <input id="loginName" type="email" placeholder="${L("ឈ្មោះ@gmail.com", "you@example.com")}" autocomplete="email" value="" required />
            </div>
            ${isSignup ? `<div class="login-input-group"><label for="loginPassword">${L("ពាក្យសម្ងាត់", "Password")}</label><input id="loginPassword" type="password" placeholder="${L("ពាក្យសម្ងាត់របស់អ្នក", "Enter your password")}" autocomplete="new-password" minlength="6" required /></div><div class="login-input-group"><label for="loginPasswordConfirm">${L("បញ្ជាក់ពាក្យសម្ងាត់", "Confirm password")}</label><input id="loginPasswordConfirm" type="password" placeholder="${L("វាយម្ដងទៀត", "Confirm your password")}" autocomplete="new-password" minlength="6" required /></div>` : `<div class="login-input-group"><label for="loginPassword">${L("ពាក្យសម្ងាត់", "Password")}</label><input id="loginPassword" type="password" placeholder="${L("ពាក្យសម្ងាត់របស់អ្នក", "Enter your password")}" autocomplete="current-password" minlength="6" required /></div>`}
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
          <button type="submit" class="button login-button">${isReset ? L("ផ្ញើតំណ", "Send reset link") : hasAccount ? t("unlock") : isLegacy ? t("secureAccount") : supabaseConfigured ? (isSignup ? L("បង្កើតគណនី", "Create account") : L("ចូល →", "Log in →")) : t("createAccount")}</button>
          <button type="button" class="login-guest-button" id="loginGuestButton">${t("continueAsGuest")}</button>
          ${(supabaseConfigured || hasAccount) && !isReset ? `<button type="button" class="login-reset-link" id="loginResetButton">${t("forgotPassword")}</button>` : ""}
        </form>
        <div class="login-footer">
          <p class="secondary">${supabaseConfigured ? L("🔒 ទិន្នន័យ sync សុវត្ថិភាពជាមួយគណនីរបស់អ្នក", "🔒 Your data syncs securely with your account") : t("noDataStored")}</p>
        </div>
        </div>
      </div>
    `;
    const modalRoot = document.getElementById("modalRoot");
    modalRoot.classList.add("open");
    modalRoot.appendChild(modal);
    this.decorate(modal, L);

    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const currentMode = document.querySelector(".login-mode-button.active")?.dataset.authMode || (supabaseConfigured ? "login" : "create");
      const submitIsSignup = supabaseConfigured ? currentMode === "signup" : !hasAccount;
      this.submit(hasAccount, isReset, isLegacy, submitIsSignup);
    });
    document.getElementById("loginGoogleButton")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      const { error } = await window.MYLIFE_SUPABASE_API.signInWithGoogle();
      // back with the browser's ← button: the button works again
      window.addEventListener("pageshow", () => { button.disabled = false; }, { once: true });
      if (error) {
        button.disabled = false;
        const box = document.getElementById("loginError");
        if (box) box.textContent = /provider is not enabled|Unsupported provider/i.test(error.message || "") ? L("Google login មិនទាន់បើកនៅ Supabase", "Google login is not enabled in Supabase yet") : error.message;
      }
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

  // icons in the fields, a 👁 button for passwords, "remember" + "forgot" on one
  // row, and an "or" line before "continue as guest" — the form logic is unchanged
  decorate(modal, L) {
    const ICON = {
      mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
      lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
      eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
    };
    modal.querySelectorAll(".login-input-group input:not([type=checkbox])").forEach(input => {
      const field = document.createElement("div");
      field.className = "login-field";
      input.replaceWith(field);
      const icon = input.type === "email" ? ICON.mail : input.type === "password" ? ICON.lock : ICON.user;
      field.insertAdjacentHTML("afterbegin", `<span class="login-field-icon" aria-hidden="true">${icon}</span>`);
      field.appendChild(input);
      if (input.type === "password") {
        const eye = document.createElement("button");
        eye.type = "button";
        eye.className = "login-eye";
        eye.setAttribute("aria-label", L("បង្ហាញពាក្យសម្ងាត់", "Show password"));
        eye.innerHTML = ICON.eye;
        eye.addEventListener("click", () => {
          const show = input.type === "password";
          input.type = show ? "text" : "password";
          eye.classList.toggle("is-on", show);
          input.focus();
        });
        field.appendChild(eye);
      }
    });
    const rememberRow = modal.querySelector(".login-remember-row");
    const reset = modal.querySelector("#loginResetButton");
    if (rememberRow && reset) rememberRow.appendChild(reset);
    const guest = modal.querySelector("#loginGuestButton");
    if (guest) guest.insertAdjacentHTML("beforebegin", `<div class="login-or"><span>${L("ឬ", "or")}</span></div>`);
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
          // Keep the name the user chose (e.g. "Tra"). Writing the email prefix here
          // used to look like a newer edit and overwrote the cloud name on every login.
          Store.updateProfile({ email }, { sync: false });
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
        // only a brand-new account with no name gets one from the email
        if (!String(appData.profile.name || "").trim()) Store.updateProfile({ name: email.split("@")[0] || "User" }, { sync: false });
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

  // a Google account that isn't part of MYLIFE (see OAuthGate in js/data.js)
  blockedGoogle(reason) {
    const km = languageCode() === "km";
    this.authenticated = false;
    this.setRememberedSession(false);
    try { sessionStorage.removeItem("mylife:oauth-pending"); } catch (error) { /* ignore */ }
    const text = reason === "check_failed"
      ? (km ? "មិនអាចពិនិត្យគណនី Google បានទេ។ សូមពិនិត្យ internet ហើយសាកម្ដងទៀត។" : "Couldn't check this Google account. Check your internet and try again.")
      : (km ? "គណនី Google នេះមិនទាន់ភ្ជាប់ជាមួយ MYLIFE ទេ។ សូម login ដោយ email និងពាក្យសម្ងាត់ ឬសុំ invite link ពីម្ចាស់គ្រួសារ។" : "This Google account isn't part of MYLIFE yet. Log in with your email and password, or ask the family owner for an invite link.");
    if (!this.isOpen) this.open();
    const show = () => { const box = document.getElementById("loginError"); if (box) box.textContent = text; };
    show();
    setTimeout(show, 300);
  },

  // back from Google: pull this account's data, take the name Google gives, remember the device
  async finishOAuth(session) {
    let pending = false;
    try { pending = sessionStorage.getItem("mylife:oauth-pending") === "1"; sessionStorage.removeItem("mylife:oauth-pending"); } catch (error) { /* ignore */ }
    if (!pending) return;
    try {
      await Store.syncFromSupabase();
      // signed out by the Google check (not part of MYLIFE): stop here
      const { data: still } = await window.supabaseClient.auth.getSession();
      if (!still?.session) return;
      const meta = session.user?.user_metadata || {};
      if (!String(appData.profile.name || "").trim()) Store.updateProfile({ name: meta.full_name || meta.name || String(session.user?.email || "").split("@")[0] || "User" }, { sync: false });
      await Store.syncToSupabase();
    } catch (error) { console.warn("MYLIFE: Google sign-in sync", error); }
    this.setRememberedSession(true);
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
      await window.PushNotifications?.disable();
    } catch (error) {
      console.warn("MYLIFE could not remove this device's push subscription before signing out.", error);
    }

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
        await this.finishOAuth(session);
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

if (typeof window !== "undefined") {
  window.addEventListener("mylife:oauth-blocked", event => Login.blockedGoogle(event.detail?.reason));
}

