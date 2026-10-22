/* App lock: a 4–6 digit PIN asked when MYLIFE opens, and when you come back
 * after some minutes away. The PIN is kept only on this device, as a salted
 * PBKDF2 hash (never the PIN itself), and is not synced. Forgot the PIN →
 * log out and log in again with email + password. */
const AppLock = (() => {
  const KEY = "mylife:lock:v1";
  const AWAY_KEY = "mylife:lock:away";
  const MAX_TRIES = 5;
  const WAIT_MS = 30000;
  const km = () => typeof languageCode === "function" && languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  let root = null;
  let tries = 0;
  let waitUntil = 0;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (error) { return null; } };
  const write = value => { try { value ? localStorage.setItem(KEY, JSON.stringify(value)) : localStorage.removeItem(KEY); } catch (error) { /* storage blocked */ } };
  const config = () => read() || { enabled: false, after: 5 };
  const isOn = () => Boolean(config().enabled && config().hash);

  const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
  async function hashPin(pin, saltHex) {
    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256));
  }
  const sameText = (a, b) => a.length === b.length && [...a].reduce((diff, ch, i) => diff | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

  async function savePin(pin) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    write({ ...config(), enabled: true, salt, hash: await hashPin(pin, salt), digits: pin.length });
  }

  /* ---------------- Face ID / fingerprint (WebAuthn, this device only) ---------------- */
  // The phone checks the face / finger itself; MYLIFE only keeps the id of a
  // device key that can be used after that check. Nothing about the face or
  // finger ever reaches the app. PIN stays as the backup.
  let bioAvailable = null;
  const b64 = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64 = text => Uint8Array.from(atob(String(text).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(text).length + 3) % 4)), c => c.charCodeAt(0));
  async function checkBio() {
    try {
      bioAvailable = Boolean(window.PublicKeyCredential && window.isSecureContext && !/^\d+\.\d+\.\d+\.\d+$/.test(location.hostname)
        && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch (error) { bioAvailable = false; }
    return bioAvailable;
  }
  checkBio();
  const hasBio = () => Boolean(bioAvailable && config().bio && config().bio.id);

  async function addBio() {
    const name = String((typeof appData !== "undefined" && appData.profile && appData.profile.name) || "MYLIFE");
    const credential = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "MYLIFE", id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "mylife-lock", displayName: `${name} · MYLIFE` },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000,
      attestation: "none"
    } });
    write({ ...config(), bio: { id: b64(credential.rawId), at: new Date().toISOString() } });
  }

  // true when the phone confirmed the face / finger
  async function useBio() {
    const id = config().bio && config().bio.id;
    if (!id) return false;
    try {
      const result = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: unb64(id) }],
        userVerification: "required",
        timeout: 60000
      } });
      return Boolean(result && b64(result.rawId) === id);
    } catch (error) {
      return false;
    }
  }

  /* ---------------- the keypad screen ---------------- */
  const LOGO = '<svg class="al-logo" viewBox="0 0 240 240" aria-hidden="true"><rect width="240" height="240" rx="56" fill="#0f3326"/><circle cx="120" cy="120" r="66" fill="none" stroke="#1f4a38" stroke-width="22"/><circle cx="120" cy="120" r="66" fill="none" stroke="#d9ff7b" stroke-width="22" stroke-linecap="round" stroke-dasharray="311 415" transform="rotate(-90 120 120)"/><circle cx="120" cy="120" r="20" fill="#9ef06a"/></svg>';

  // mode: "unlock" | "set" (new PIN, twice) | "check" (old PIN before change/turn off)
  function show({ mode, title, hint, digits = 0, onDone, onCancel }) {
    close();
    let entry = "";
    root = document.createElement("div");
    root.className = `app-lock app-lock-${mode}`;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", title);
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "left", "0", "back"];
    root.innerHTML = `
      <span class="al-blob al-blob-a" aria-hidden="true"></span>
      <span class="al-blob al-blob-b" aria-hidden="true"></span>
      <div class="al-box">
        ${LOGO}
        <h2>${escapeHtml(title)}</h2>
        <p class="al-hint" data-al-hint>${escapeHtml(hint)}</p>
        <div class="al-dots" data-al-dots aria-hidden="true"></div>
        ${mode === "unlock" && hasBio() ? `<button type="button" class="al-bio" data-al-bio><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 10v1M15 10v1M12 10v3h-1M9.5 16a3.5 3.5 0 0 0 5 0"/></svg>${L("Face ID / ស្នាមម្រាមដៃ", "Face ID / fingerprint")}</button>` : ""}
        <div class="al-pad">
          ${keys.map(k => k === "back"
            ? `<button type="button" class="al-key al-key-text" data-al-back aria-label="${L("លុប", "Delete")}">⌫</button>`
            : k === "left"
              ? (mode === "unlock"
                ? `<button type="button" class="al-key al-key-text" data-al-forgot>${L("ភ្លេច?", "Forgot?")}</button>`
                : `<button type="button" class="al-key al-key-text" data-al-cancel>${L("បោះបង់", "Cancel")}</button>`)
              : `<button type="button" class="al-key" data-al-key="${k}">${k}</button>`).join("")}
        </div>
        ${mode === "set" ? `<button type="button" class="al-done" data-al-done disabled>${L("រួច", "Done")}</button>` : ""}
      </div>`;
    document.body.appendChild(root);
    document.body.classList.add("app-locked");
    const dots = root.querySelector("[data-al-dots]");
    const hintEl = root.querySelector("[data-al-hint]");
    const doneBtn = root.querySelector("[data-al-done]");
    const size = () => (digits || Math.max(4, entry.length));
    const paint = () => {
      dots.innerHTML = Array.from({ length: Math.min(6, size()) }, (_, i) => `<i class="${i < entry.length ? "on" : ""}"></i>`).join("");
      if (doneBtn) doneBtn.disabled = entry.length < 4;
    };
    const fail = message => {
      hintEl.textContent = message;
      root.querySelector(".al-box").classList.remove("al-shake");
      void root.offsetWidth;
      root.querySelector(".al-box").classList.add("al-shake");
      entry = "";
      paint();
      if (navigator.vibrate) navigator.vibrate(120);
    };
    const finish = async () => {
      const value = entry;
      const result = await onDone(value, { fail, setHint: text => { hintEl.textContent = text; entry = ""; paint(); } });
      if (result === "ok") close();
    };
    const tryBio = async () => {
      if (!hasBio()) return;
      hintEl.textContent = L("កំពុងពិនិត្យ…", "Checking…");
      if (await useBio()) { tries = 0; close(); return; }
      hintEl.textContent = L("មិនបាន · ដាក់ PIN ជំនួស", "Didn't work · use your PIN");
    };
    if (mode === "unlock" && hasBio()) setTimeout(tryBio, 350); // ask the face / finger straight away
    const press = key => {
      if (Date.now() < waitUntil) {
        hintEl.textContent = L(`រង់ចាំ ${Math.ceil((waitUntil - Date.now()) / 1000)} វិនាទី`, `Wait ${Math.ceil((waitUntil - Date.now()) / 1000)} seconds`);
        return;
      }
      if (entry.length >= 6) return;
      entry += key;
      paint();
      if (digits && entry.length === digits) setTimeout(finish, 120);
    };
    root.addEventListener("click", event => {
      const k = event.target.closest("[data-al-key]");
      if (k) return press(k.dataset.alKey);
      if (event.target.closest("[data-al-back]")) { entry = entry.slice(0, -1); return paint(); }
      if (event.target.closest("[data-al-done]")) return finish();
      if (event.target.closest("[data-al-cancel]")) { close(); return onCancel && onCancel(); }
      if (event.target.closest("[data-al-forgot]")) return forgot();
      if (event.target.closest("[data-al-bio]")) return tryBio();
    });
    root.addEventListener("keydown", event => {
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") { entry = entry.slice(0, -1); paint(); }
      else if (event.key === "Enter" && doneBtn && !doneBtn.disabled) finish();
    });
    root.tabIndex = -1;
    paint();
    setTimeout(() => root && root.focus(), 30);
  }

  function close() {
    if (root) root.remove();
    root = null;
    document.body.classList.remove("app-locked", "app-lock-confirm");
  }

  /* ---------------- lock / unlock ---------------- */
  function lock() {
    if (!isOn() || root || document.getElementById("loginModal")) return;
    const cfg = config();
    const name = String((typeof appData !== "undefined" && appData.profile && appData.profile.name) || "").split(/\s+/)[0];
    show({
      mode: "unlock",
      title: name ? L(`សួស្តី ${name} 👋`, `Hi ${name} 👋`) : "MYLIFE",
      hint: L("ដាក់ PIN ដើម្បីបើក MYLIFE", "Enter your PIN to open MYLIFE"),
      digits: cfg.digits || 4,
      onDone: async (pin, ui) => {
        if (sameText(await hashPin(pin, cfg.salt), cfg.hash)) {
          tries = 0;
          return "ok";
        }
        tries += 1;
        if (tries >= MAX_TRIES) {
          tries = 0;
          waitUntil = Date.now() + WAIT_MS;
          ui.fail(L("PIN ខុស 5 ដង · រង់ចាំ 30 វិនាទី", "Wrong PIN 5 times · wait 30 seconds"));
        } else {
          ui.fail(L(`PIN មិនត្រឹមត្រូវ · នៅសល់ ${MAX_TRIES - tries} ដង`, `Wrong PIN · ${MAX_TRIES - tries} tries left`));
        }
        return "again";
      }
    });
  }

  function forgot() {
    const go = async () => {
      write(null);
      close();
      if (typeof Login !== "undefined" && Login.logout) await Login.logout();
      else location.reload();
    };
    if (typeof Modal !== "undefined" && Modal.confirm) {
      // the confirm sits above the lock screen
      document.body.classList.add("app-lock-confirm");
      Modal.confirm({
        title: L("ភ្លេច PIN?", "Forgot your PIN?"),
        message: L("App នឹង log out។ Login ឡើងវិញដោយ email និងពាក្យសម្ងាត់ ហើយកំណត់ PIN ថ្មីនៅ ការកំណត់។", "You'll be logged out. Log in again with your email and password, then set a new PIN in Settings."),
        confirmText: L("Log out", "Log out"),
        onConfirm: go,
        onCancel: () => document.body.classList.remove("app-lock-confirm")
      });
    } else go();
  }

  // new PIN, typed twice
  function setPin(onSaved) {
    let first = "";
    show({
      mode: "set",
      title: L("កំណត់ PIN", "Set a PIN"),
      hint: L("វាយ PIN 4–6 ខ្ទង់ រួចចុច រួច", "Type a 4–6 digit PIN, then Done"),
      onDone: async (pin, ui) => {
        if (!first) {
          first = pin;
          ui.setHint(L("វាយ PIN ម្ដងទៀតដើម្បីបញ្ជាក់", "Type the PIN again to confirm"));
          return "again";
        }
        if (pin !== first) {
          first = "";
          ui.fail(L("PIN មិនដូចគ្នា · សាកម្ដងទៀត", "PINs don't match · try again"));
          return "again";
        }
        await savePin(pin);
        if (typeof Toast !== "undefined") Toast.show(L("បានបើកការចាក់សោ 🔒", "App lock is on 🔒"), "success");
        if (onSaved) onSaved();
        return "ok";
      },
      onCancel: () => { if (onSaved) onSaved(); }
    });
  }

  // ask the current PIN first (turning the lock off, or changing the PIN)
  function checkPin(then) {
    const cfg = config();
    show({
      mode: "check",
      title: L("ដាក់ PIN បច្ចុប្បន្ន", "Enter your current PIN"),
      hint: L("ដើម្បីបន្ត", "To continue"),
      digits: cfg.digits || 4,
      onDone: async (pin, ui) => {
        if (sameText(await hashPin(pin, cfg.salt), cfg.hash)) { setTimeout(then, 50); return "ok"; }
        ui.fail(L("PIN មិនត្រឹមត្រូវ", "Wrong PIN"));
        return "again";
      }
    });
  }

  /* ---------------- settings rows (Settings → Data & privacy) ---------------- */
  function settingsRows() {
    const cfg = config();
    const on = isOn();
    const options = [[0, L("ភ្លាម", "Right away")], [1, L("1 នាទី", "1 minute")], [5, L("5 នាទី", "5 minutes")], [15, L("15 នាទី", "15 minutes")], [60, L("1 ម៉ោង", "1 hour")]];
    return `
      <label class="settings-preference-row"><span><strong>🔒 ${L("ចាក់សោ app ដោយ PIN", "Lock the app with a PIN")}</strong><small>${L("សួរ PIN ពេលបើក app លើឧបករណ៍នេះ", "Ask for a PIN when MYLIFE opens on this device")}</small></span><input type="checkbox" data-applock-toggle ${on ? "checked" : ""}></label>
      ${on ? `
      <label class="settings-preference-row"><span><strong>${L("ចាក់សោពេលណា", "Lock after")}</strong><small>${L("ក្រោយចេញពី app", "Time away from the app")}</small></span><select data-applock-after>${options.map(([v, l]) => `<option value="${v}" ${Number(cfg.after ?? 5) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      ${bioAvailable ? `<label class="settings-preference-row"><span><strong>😊 ${L("Face ID / ស្នាមម្រាមដៃ", "Face ID / fingerprint")}</strong><small>${L("បើកដោយមុខ ឬម្រាមដៃ · PIN នៅតែជាបម្រុង", "Unlock with your face or finger · PIN stays as backup")}</small></span><input type="checkbox" data-applock-bio ${cfg.bio && cfg.bio.id ? "checked" : ""}></label>` : ""}
      <div class="settings-preference-row settings-link-row"><span><strong>${L("ប្ដូរ PIN", "Change PIN")}</strong><small>${L("PIN នៅតែលើឧបករណ៍នេះ (មិន sync)។ ភ្លេច PIN → login ឡើងវិញ។", "The PIN stays on this device (not synced). Forgot it → log in again.")}</small></span><button type="button" class="button ghost-button" data-applock-change>${L("ប្ដូរ", "Change")}</button></div>` : ""}`;
  }
  const rerender = () => { if (typeof App !== "undefined" && App.render) App.render(); };

  document.addEventListener("change", event => {
    const toggle = event.target.closest?.("[data-applock-toggle]");
    if (toggle) {
      if (toggle.checked) setPin(rerender);
      else if (isOn()) {
        toggle.checked = true; // turns off only after the PIN is right
        checkPin(() => { write({ ...config(), enabled: false, hash: "", salt: "", bio: null }); if (typeof Toast !== "undefined") Toast.show(L("បានបិទការចាក់សោ", "App lock is off")); rerender(); });
      }
      return;
    }
    const bio = event.target.closest?.("[data-applock-bio]");
    if (bio) {
      if (bio.checked) {
        addBio()
          .then(() => { if (typeof Toast !== "undefined") Toast.show(L("បានបើក Face ID / ស្នាមម្រាមដៃ 😊", "Face ID / fingerprint is on 😊"), "success"); rerender(); })
          .catch(error => {
            bio.checked = false;
            console.warn("MYLIFE biometric setup:", error && error.name);
            if (typeof Toast !== "undefined") Toast.show(L("បើកមិនបាន · ទូរសព្ទមិនអនុញ្ញាត ឬបានបោះបង់", "Couldn't turn it on · not allowed or cancelled"), "warning");
          });
      } else {
        write({ ...config(), bio: null });
        if (typeof Toast !== "undefined") Toast.show(L("បានបិទ Face ID / ស្នាមម្រាមដៃ", "Face ID / fingerprint is off"));
      }
      return;
    }
    const after = event.target.closest?.("[data-applock-after]");
    if (after) {
      write({ ...config(), after: Number(after.value) });
      if (typeof Toast !== "undefined") Toast.show(t("preferenceSaved"));
    }
  });
  document.addEventListener("click", event => {
    if (event.target.closest?.("[data-applock-change]")) checkPin(() => setPin(rerender));
  });

  /* ---------------- when to lock ---------------- */
  document.addEventListener("visibilitychange", () => {
    if (!isOn()) return;
    if (document.visibilityState === "hidden") {
      try { localStorage.setItem(AWAY_KEY, String(Date.now())); } catch (error) { /* ignore */ }
      if (Number(config().after ?? 5) === 0) lock(); // hide the screen in the app switcher
      return;
    }
    let away = 0;
    try { away = Number(localStorage.getItem(AWAY_KEY) || 0); } catch (error) { /* ignore */ }
    if (away && Date.now() - away >= Number(config().after ?? 5) * 60000) lock();
  });
  // on open: wait for the login check, then lock (not over the login screen)
  const start = () => setTimeout(() => { if (isOn()) lock(); }, 700);
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);

  return { lock, isOn, settingsRows, setPin, close };
})();
