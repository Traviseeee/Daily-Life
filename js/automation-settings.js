/* Settings card: Telegram automations (morning digest, weekly report,
 * budget alerts), bot commands, and weekly cloud backups. */

function renderAutomationCard() {
  const isKm = languageCode() === "km";
  const p = appData.profile;
  const row = (key, checked, title, help, timeKey, timeValue) => `
    <label class="auto-row">
      <span class="auto-copy"><strong>${title}</strong><small>${help}</small></span>
      ${timeKey ? `<input class="auto-time" type="time" value="${escapeAttr(timeValue)}" data-auto-time="${timeKey}" ${checked ? "" : "disabled"}>` : ""}
      <input class="auto-switch" type="checkbox" data-auto-toggle="${key}" ${checked ? "checked" : ""}>
    </label>`;
  return `
    <article class="glass-card card-pad settings-preferences-card auto-card" data-settings-section="preferences">
      <div class="between">
        <div>
          <h2 class="section-title section-title-with-icon"><span class="section-title-icon">${Icons.spark()}</span>${isKm ? "Telegram & ស្វ័យប្រវត្តិ" : "Telegram & automations"}</h2>
          <p class="secondary">${isKm ? "សារដែល MYLIFE ផ្ញើទៅ Telegram ដោយខ្លួនឯង" : "Messages MYLIFE sends to Telegram on its own"}</p>
        </div>
      </div>
      <div class="auto-list">
        ${row("morningDigest", p.morningDigest !== false, isKm ? "☀️ សារសង្ខេបព្រឹក" : "☀️ Morning digest", isKm ? "កាលវិភាគថ្ងៃនេះ bill ហួសថ្ងៃ និងថ្ងៃកំណើត" : "Today's plan, overdue bills, birthdays", "digestTime", p.digestTime || "07:00")}
        ${row("weeklyReport", p.weeklyReport !== false, isKm ? "📈 របាយការណ៍ប្រចាំសប្តាហ៍" : "📈 Weekly money report", isKm ? "រៀងរាល់ថ្ងៃអាទិត្យ ធៀបនឹងសប្តាហ៍មុន" : "Every Sunday, compared with last week", "weeklyReportTime", p.weeklyReportTime || "19:00")}
        ${row("budgetAlerts", p.budgetAlerts !== false, isKm ? "📊 ព្រមានថវិកា" : "📊 Budget alerts", isKm ? "ពេលចាយដល់ 80% និង 100% នៃថវិកា" : "At 80% and 100% of a category budget")}
        ${row("eveningCheck", p.eveningCheck !== false, isKm ? "🌙 សួរពេលយប់" : "🌙 Evening check", isKm ? "\"មានចាយអ្វីទៀតទេ?\" ជាមួយប៊ូតុងចំណាយញឹកញាប់" : "\"Anything else today?\" with one-tap frequent expenses", "eveningCheckTime", p.eveningCheckTime || "21:00")}
        ${row("unusualAlert", p.unusualAlert !== false, isKm ? "⚠️ ព្រមានចាយមិនធម្មតា" : "⚠️ Unusual spending", isKm ? "ពេលថ្ងៃនេះចាយច្រើនជាងធម្មតា 3 ដង" : "When today is 3× a normal day")}
        ${row("weeklyImage", p.weeklyImage !== false, isKm ? "🖼️ រូបរបាយការណ៍ប្រចាំសប្តាហ៍" : "🖼️ Weekly report picture", isKm ? "រូបភាពក្រាហ្វ ផ្ញើជាមួយរបាយការណ៍ថ្ងៃអាទិត្យ" : "Chart picture with the Sunday report")}
        ${row("monthlyImage", p.monthlyImage !== false, isKm ? "🗓️ រូបរបាយការណ៍ប្រចាំខែ" : "🗓️ Monthly report picture", isKm ? "ថ្ងៃទី 1 ម៉ោង 9 ព្រឹក សម្រាប់ខែមុន" : "On the 1st at 9:00, for last month")}
        ${row("telegramBackup", p.telegramBackup !== false, isKm ? "💾 Backup ទៅ Telegram" : "💾 Backup to Telegram", isKm ? "ឯកសារ JSON រៀងរាល់ថ្ងៃអាទិត្យ (Import វិញបាន)" : "JSON file every Sunday (can be imported)")}
      </div>
      <details class="auto-help">
        <summary>🤖 ${isKm ? "ប្រើ Telegram bot (ផ្ញើសារទៅ bot)" : "Use the Telegram bot (send it a message)"}</summary>
        <ul>
          <li><code>ស្អែក 9 ព្រឹក ជួបម៉ាក់</code> → 📅 ${isKm ? "បន្ថែមព្រឹត្តិការណ៍" : "adds an event"}</li>
          <li><code>coffee 2</code> · <code>-20$ cloths</code> · <code>grab 15k</code> → 💸 ${isKm ? "កត់ចំណាយ (ច្រើនបន្ទាត់ក៏បាន)" : "logs expenses (one per line)"}</li>
          <li><code>+100$ salary</code> → 💰 ${isKm ? "កត់ចំណូល" : "logs income"}</li>
          <li><code>/today</code> → ☀️ ${isKm ? "សង្ខេបថ្ងៃនេះ" : "today's summary"}</li>
          <li><code>/evening</code> · <code>/week</code> · <code>/month</code> · <code>/backup</code> → ${isKm ? "សួរពេលយប់ របាយការណ៍ រូបភាព និង backup ភ្លាមៗ" : "evening check, reports, pictures and backup right now"}</li>
          <li>✅ ⏰ ${isKm ? "ចុចប៊ូតុងលើការរំលឹក ដើម្បីកត់ថាបង់រួច ឬរំលឹកម្ដងទៀត" : "tap buttons on alerts to mark paid or snooze"}</li>
        </ul>
      </details>
      <div class="auto-backups">
        <div class="auto-backups-head">
          <strong>☁️ ${isKm ? "Backup ប្រចាំសប្តាហ៍ (Cloud)" : "Weekly cloud backups"}</strong>
          <small>${isKm ? "រក្សាទុក ៥ សប្តាហ៍ចុងក្រោយ ដោយស្វ័យប្រវត្តិ" : "Last 5 weeks, saved automatically"}</small>
        </div>
        <div class="auto-backup-list" data-cloud-backups><span class="secondary">${isKm ? "កំពុងផ្ទុក…" : "Loading…"}</span></div>
      </div>
    </article>`;
}

async function cloudBackupRequest(query = "") {
  const session = await window.MYLIFE_SUPABASE_API?.getSession?.();
  const token = session?.data?.session?.access_token;
  if (!token) throw new Error("not_signed_in");
  const response = await fetch(`/api/backup${query}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`backup_${response.status}`);
  return response.json();
}

function restoreBackupPayload(imported, date) {
  if (!imported || typeof imported !== "object" || !imported.profile) {
    Toast.show(t("importFailed"));
    return;
  }
  const isKm = languageCode() === "km";
  Modal.confirm({
    title: isKm ? `ស្ដារ Backup ${date}` : `Restore backup ${date}`,
    message: isKm ? "ទិន្នន័យបច្ចុប្បន្ននឹងត្រូវជំនួសដោយ backup នេះ។ (ទិន្នន័យបច្ចុប្បន្នត្រូវបានរក្សាទុកជា local backup មុន)" : "Your current data will be replaced by this backup. (A local backup of the current data is kept first.)",
    confirmText: isKm ? "ស្ដារ" : "Restore",
    onConfirm: () => {
      if (typeof saveDataBackup === "function") saveDataBackup("before-cloud-restore");
      Object.assign(appData, structuredClone(emptyData), imported);
      appData.profile = { ...emptyData.profile, ...(appData.profile || {}) };
      SyncState.prune(appData);
      Store.save({ mode: "replace", reason: "cloud-restore" });
      App.render();
      Toast.show(t("jsonImported"));
    }
  });
}

async function loadCloudBackups() {
  const box = document.querySelector("[data-cloud-backups]");
  if (!box) return;
  const isKm = languageCode() === "km";
  try {
    const { backups = [] } = await cloudBackupRequest();
    if (!backups.length) {
      box.innerHTML = `<span class="secondary">${isKm ? "មិនទាន់មាន backup — backup ដំបូងនឹងបង្កើតដោយខ្លួនឯងក្នុងពេលឆាប់ៗ" : "No backups yet — the first one is made automatically soon"}</span>`;
      return;
    }
    box.innerHTML = backups.map(date => `<div class="auto-backup-row">
      <span>📦 ${escapeHtml(formatDate(date))}</span>
      <button class="button ghost-button" type="button" data-cloud-download="${escapeAttr(date)}">${Icons.arrowDown()} ${isKm ? "ទាញយក" : "Download"}</button>
      <button class="button ghost-button" type="button" data-cloud-restore="${escapeAttr(date)}">${isKm ? "ស្ដារ" : "Restore"}</button>
    </div>`).join("");
    box.querySelectorAll("[data-cloud-download]").forEach(button => button.addEventListener("click", async () => {
      try {
        const { payload, date } = await cloudBackupRequest(`?date=${encodeURIComponent(button.dataset.cloudDownload)}`);
        downloadFile(`mylife-cloud-backup-${date}.json`, "application/json", JSON.stringify(payload, null, 2));
      } catch (error) {
        Toast.show(isKm ? "ទាញយកមិនបាន" : "Download failed");
      }
    }));
    box.querySelectorAll("[data-cloud-restore]").forEach(button => button.addEventListener("click", async () => {
      try {
        const { payload, date } = await cloudBackupRequest(`?date=${encodeURIComponent(button.dataset.cloudRestore)}`);
        restoreBackupPayload(payload, date);
      } catch (error) {
        Toast.show(isKm ? "ស្ដារមិនបាន" : "Restore failed");
      }
    }));
  } catch (error) {
    box.innerHTML = `<span class="secondary">${isKm ? "ត្រូវ sign in និងភ្ជាប់អ៊ីនធឺណិត ដើម្បីមើល backup" : "Sign in and go online to see backups"}</span>`;
  }
}

function bindAutomationCard() {
  document.querySelectorAll("[data-auto-toggle]").forEach(input => input.addEventListener("change", () => {
    Store.updateProfile({ [input.dataset.autoToggle]: input.checked });
    Toast.show(languageCode() === "km" ? "បានរក្សាទុក" : "Saved");
  }));
  document.querySelectorAll("[data-auto-time]").forEach(input => input.addEventListener("change", () => {
    if (!/^\d{2}:\d{2}$/.test(input.value)) return;
    Store.updateProfile({ [input.dataset.autoTime]: input.value });
    Toast.show(languageCode() === "km" ? "បានរក្សាទុក" : "Saved");
  }));
  loadCloudBackups();
}
