/* MYLIFE Settings V2 (draft 23 Oct 2026). Overview = account card + status chips +
 * quick switches + grouped rows. Each row opens #settings/<section>, which shows the
 * old section (same markup, so bindSettings() keeps every control working) under a
 * back header. Colours: css/settings-v2.css (light = sky blue, dark = green + lime). */
const SettingsV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const SECTIONS = ["account", "appearance", "money", "notifications", "ai", "data", "about"];
  const TITLES = () => ({
    account: L("គណនី", "Account"), appearance: L("រូបរាង & ភាសា", "Look & language"), money: L("លុយ", "Money"),
    notifications: L("ការជូនដំណឹង", "Notifications"), ai: "AI · Gemini", data: L("ទិន្នន័យ & សុវត្ថិភាព", "Data & security"), about: L("អំពី MYLIFE", "About MYLIFE")
  });

  const chev = '<span class="sv-chev" aria-hidden="true">›</span>';
  const badge = (text, tone = "") => `<span class="sv-badge${tone ? ` is-${tone}` : ""}">${escapeHtml(text)}</span>`;
  const row = ({ href, icon, tone, title, sub, value = "", end = "" }) => {
    const inner = `<span class="sv-ic is-${tone}" aria-hidden="true">${icon}</span><span class="sv-tx"><b>${escapeHtml(title)}</b>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</span>${value ? `<span class="sv-val">${escapeHtml(value)}</span>` : ""}${end}`;
    return href ? `<a class="sv-row" href="${href}">${inner}${chev}</a>` : `<label class="sv-row">${inner}</label>`;
  };
  const toggle = (attrs, on) => `<input class="sv-switch" type="checkbox" ${attrs} ${on ? "checked" : ""}>`;

  function header() {
    const p = appData.profile;
    const pending = typeof SyncState !== "undefined" && SyncState.isPending?.();
    const backups = typeof Store.listBackups === "function" ? Store.listBackups() : [];
    const last = backups[0]?.createdAt ? new Date(backups[0].createdAt) : null;
    const days = last && !Number.isNaN(last.getTime()) ? Math.floor((Date.now() - last.getTime()) / 864e5) : null;
    const backupText = days === null ? L("មិនទាន់ backup", "No backup yet") : days === 0 ? L("Backup ថ្ងៃនេះ", "Backed up today") : L(`Backup ${days} ថ្ងៃមុន`, `Backup ${days}d ago`);
    const guest = typeof Login !== "undefined" && Login.guestMode;
    const fg = typeof FamilyGroup !== "undefined" ? FamilyGroup.state : null;
    const admin = fg?.family && fg.members?.some(m => m.user_id === fg.me && m.role === "admin");
    const who = guest ? L("ភ្ញៀវ · មិនទាន់ចូលគណនី", "Guest · not signed in") : [L("គណនី", "Account"), admin ? L("អ្នកគ្រប់គ្រងគ្រួសារ", "Family admin") : ""].filter(Boolean).join(" · ");
    const photo = p.photo ? `<img src="${escapeAttr(p.photo)}" alt="">` : `<span>${escapeHtml(initials(p.name || "ML"))}</span>`;
    return `<header class="sv-hero">
      <h1>${escapeHtml(t("settings"))}</h1>
      <div class="sv-prof">
        <span class="sv-av"><span class="sv-face">${photo}</span></span>
        <span class="sv-prof-tx"><b>${escapeHtml(p.name || L("មិនទាន់ដាក់ឈ្មោះ", "No name yet"))}</b><small>${escapeHtml(who)}</small></span>
        ${guest ? `<button class="sv-edit" type="button" data-action="connect-guest">${escapeHtml(L("ចូល", "Sign in"))}</button>` : `<button class="sv-edit" type="button" data-action="edit-profile">${escapeHtml(L("កែ", "Edit"))}</button>`}
      </div>
      <div class="sv-chips">
        <button type="button" class="sv-chip ${pending ? "is-warn" : "is-ok"}" data-settings-sync>☁️ ${escapeHtml(pending ? L("រង់ចាំ Sync", "Sync pending") : L("Sync រួច", "Synced"))}</button>
        <span class="sv-chip">🌐 ${p.language === "Khmer" ? "ខ្មែរ" : "English"}</span>
        <span class="sv-chip">$ ${escapeHtml(p.currency || "USD")}</span>
        <a class="sv-chip ${days === null || days > 7 ? "is-warn" : ""}" href="#settings/data">💾 ${escapeHtml(backupText)}</a>
      </div>
    </header>`;
  }

  function overview() {
    const p = appData.profile;
    const notifyOn = p.notificationsEnabled !== false;
    const pushOk = "Notification" in window && Notification.permission === "granted";
    const ai = p.aiSettings || {};
    const aiOn = Boolean(ai.apiKey) && ai.enabled !== false;
    const lockOn = typeof AppLock !== "undefined" && AppLock.isOn();
    const quickCount = (Array.isArray(p.quickActions) && p.quickActions.length) || (typeof QUICK_ACTION_DEFAULTS !== "undefined" ? QUICK_ACTION_DEFAULTS.length : 0);
    const pending = typeof SyncState !== "undefined" && SyncState.isPending?.();
    const notifySub = typeof settingsNotifySummary === "function" ? settingsNotifySummary() : "";
    return `<section class="page settings-page sv2">
      ${header()}
      <div class="sv-body">
        <div class="sv-quick">
          <div class="sv-q"><small>${escapeHtml(L("រូបរាង", "Theme"))}</small><div class="sv-seg" role="group">
            <button type="button" class="${p.theme === "light" ? "on" : ""}" data-sv-theme="light" aria-pressed="${p.theme === "light"}">☀️ ${escapeHtml(L("ភ្លឺ", "Light"))}</button>
            <button type="button" class="${p.theme !== "light" ? "on" : ""}" data-sv-theme="dark" aria-pressed="${p.theme !== "light"}">🌙 ${escapeHtml(L("ងងឹត", "Dark"))}</button>
          </div></div>
          <label class="sv-q"><small>${escapeHtml(L("ឯកជនភាព", "Privacy"))}</small><span class="sv-q-sw"><b>👁 ${escapeHtml(L("លាក់លុយ", "Hide money"))}</b>${toggle('data-preference="moneyHidden"', p.moneyHidden)}</span></label>
        </div>

        <div class="sv-lbl">${escapeHtml(L("ទូទៅ", "General"))}</div>
        <div class="sv-grp">
          ${row({ href: "#settings/appearance", icon: "🌐", tone: "blue", title: L("ភាសា & ម៉ោង", "Language & clock"), sub: `${L("ភាសា", "Language")} · ${p.clockFormat || "12-hour"} · ${L("ទម្រង់ថ្ងៃ", "date format")}`, value: p.language === "Khmer" ? "ខ្មែរ" : "English" })}
          ${row({ href: "#settings/appearance", icon: "🎨", tone: "violet", title: L("សំឡេង & ញ័រ", "Sound & vibration"), sub: L("សំឡេងចុច · ញ័រ · រូបស្វាគមន៍", "Tap sounds · vibration · welcome photo") })}
          ${row({ href: "#settings/appearance", icon: "⚡", tone: "grey", title: L("សកម្មភាពរហ័ស", "Quick actions"), sub: L("ប៊ូតុង + · Footer", "+ button · footer"), value: String(quickCount) })}
        </div>

        <div class="sv-lbl">${escapeHtml(L("លុយ", "Money"))}</div>
        <div class="sv-grp">
          ${row({ href: "#settings/money", icon: "💵", tone: "green", title: L("រូបិយប័ណ្ណ & ថវិកា", "Currency & budgets"), sub: `${p.currency || "USD"} · ${L("ថវិកាតាមប្រភេទ", "budgets by category")}`, value: p.currency || "USD" })}
          ${row({ icon: "💬", tone: "amber", title: L("សួរ \"បានទទួល/បង់ហើយឬនៅ?\"", "Ask \"received / paid yet?\""), sub: L("ពេលដល់ថ្ងៃ", "On the due day"), end: toggle('data-preference="moneyAsk"', p.moneyAsk !== false) })}
        </div>

        <div class="sv-lbl">${escapeHtml(L("ការជូនដំណឹង", "Notifications"))}</div>
        <div class="sv-grp">
          <button type="button" class="sv-row" data-nfc-open><span class="sv-ic is-amber" aria-hidden="true">🔔</span><span class="sv-tx"><b>${escapeHtml(L("ការជូនដំណឹង", "Notifications"))}</b><small>${escapeHtml(notifySub)}</small></span>${badge(notifyOn ? L("បើក", "On") : L("បិទ", "Off"), notifyOn ? "ok" : "warn")}${chev}</button>
          ${row({ href: "#settings/notifications", icon: "✈️", tone: "cyan", title: "Telegram bot", sub: L("@Daily2Life_Bot · ពាក្យបញ្ជា", "@Daily2Life_Bot · commands") })}
          ${row({ href: "#settings/notifications", icon: "📱", tone: "blue", title: L("ជូនដំណឹងលើអេក្រង់ចាក់សោ", "Lock-screen alerts"), sub: L("ទោះបិទ app ក៏ដោយ", "Even when the app is closed"), end: badge(pushOk ? L("រួចរាល់", "Ready") : L("ត្រូវរៀបចំ", "Set up"), pushOk ? "ok" : "warn") })}
        </div>

        ${typeof AiAssist !== "undefined" ? `<div class="sv-lbl">AI</div>
        <div class="sv-grp">
          ${row({ href: "#settings/ai", icon: "✨", tone: "violet", title: "AI · Gemini", sub: "MYLIFE Chat · Telegram bot", end: badge(aiOn ? L("បើក", "On") : ai.apiKey ? L("បិទ", "Off") : L("គ្មាន key", "No key"), aiOn ? "ok" : "warn") })}
        </div>` : ""}

        <div class="sv-lbl">${escapeHtml(L("ទិន្នន័យ & សុវត្ថិភាព", "Data & security"))}</div>
        <div class="sv-grp">
          ${row({ href: "#settings/data", icon: "☁️", tone: "blue", title: "Backup & Sync", sub: L("Cloud · ប្រចាំសប្តាហ៍ · ក្នុងឧបករណ៍", "Cloud · weekly · on this device"), end: badge(pending ? L("រង់ចាំ", "Pending") : L("Sync រួច", "Synced"), pending ? "warn" : "ok") })}
          ${row({ href: "#settings/data", icon: "📤", tone: "green", title: L("នាំចេញ / នាំចូល", "Export / import"), sub: "JSON · Excel" })}
          ${typeof AppLock !== "undefined" ? row({ icon: "🔒", tone: "grey", title: L("ចាក់សោដោយ PIN", "Lock with a PIN"), sub: L("សួរ PIN ពេលបើក app", "Ask for a PIN when MYLIFE opens"), end: toggle("data-applock-toggle", lockOn) }) : ""}
          ${row({ href: "#settings/about", icon: "ℹ️", tone: "pink", title: L("អំពី MYLIFE", "About MYLIFE"), sub: `V${typeof APP_VERSION !== "undefined" ? APP_VERSION : ""} · ${L("អ្វីថ្មី", "what's new")}` })}
        </div>

        <div class="sv-out">
          <button type="button" class="sv-logout" data-action="logout">↩ ${escapeHtml(t("logout"))}</button>
          <button type="button" class="sv-clear" data-action="clear-data">🗑 ${escapeHtml(L("លុបទិន្នន័យ", "Delete data"))}</button>
        </div>
        <p class="sv-ver">MYLIFE V${typeof APP_VERSION !== "undefined" ? APP_VERSION : ""} · ${escapeHtml(L("បង្កើតដោយ Tra", "made by Tra"))}</p>
      </div>
    </section>`;
  }

  // one old section under a back header; the rest of the old page is hidden by CSS
  function sub(id, oldHtml) {
    const html = oldHtml
      .replace('<section class="page settings-page">', `<section class="page settings-page sv2 sv2-sub" data-sv2="${id}">
        <header class="sv-hero sv-subhead"><a class="sv-back" href="#settings" aria-label="${escapeAttr(L("ត្រឡប់", "Back"))}">‹</a><h1>${escapeHtml(TITLES()[id] || t("settings"))}</h1></header>`)
      .replace(new RegExp(`<details class="settings-accordion" id="settings-section-${id}"(?: open)?>`), `<details class="settings-accordion" id="settings-section-${id}" open>`);
    return html;
  }

  function render(oldHtml) {
    const param = typeof App !== "undefined" ? String(App.param || "") : "";
    return SECTIONS.includes(param) ? sub(param, oldHtml()) : overview();
  }

  document.addEventListener("click", event => {
    const themeButton = event.target.closest("[data-sv-theme]");
    if (!themeButton) return;
    if (appData.profile.theme === themeButton.dataset.svTheme) return;
    Store.updateProfile({ theme: themeButton.dataset.svTheme });
    if (typeof App !== "undefined") { App.renderTheme?.(); App.render(); }
  });

  return { render, SECTIONS };
})();
