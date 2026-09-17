function renderDaily() {
  const today = new Date().toISOString().slice(0, 10);
  const todayHobbies = appData.hobbyLogs.filter(item => item.date === today);
  const upcoming = appData.reminders.filter(item => !item.done && item.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const categories = ["work", "personal", "love", "family", "health", "learning"];

  return `
    <section class="page daily-page">
      <div class="page-header">
        <div><h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.spark()}</span>${t("daily")}</h1><p class="page-subtitle">${t("dailySubtitle")}</p></div>
        <div class="action-row"><button class="button ghost-button" data-action="enable-alerts">${Icons.bell()} ${t("enableAlerts")}</button><button class="button ghost-button" data-action="add-reminder">${Icons.bell()} ${t("addReminder")}</button><button class="button" data-action="add-hobby">${Icons.plus()} ${t("recordHobby")}</button></div>
      </div>
      <div class="grid two-col daily-top-grid">
        <article class="glass-card card-pad"><div class="between"><div><span class="eyebrow">${t("dailyToday")}</span><h2 class="section-title">${t("dailyRecord")}</h2></div><span class="icon-badge green">${Icons.spark()}</span></div><div class="daily-stat"><strong>${todayHobbies.length}</strong><span>${t("hobbyRecordCount")}</span></div><div class="list">${todayHobbies.map(hobbyRow).join("") || `<p class="secondary">${t("nothingYet")}</p>`}</div></article>
        <article class="glass-card card-pad"><div class="between"><div><span class="eyebrow">${t("nextUp")}</span><h2 class="section-title">${t("reminders")}</h2></div><span class="icon-badge pink">${Icons.bell()}</span></div><div class="list">${upcoming.slice(0, 4).map(reminderRow).join("") || `<p class="secondary">${t("noUpcomingReminders")}</p>`}</div></article>
      </div>
      <article class="glass-card card-pad daily-history"><div class="between"><div><span class="eyebrow">${t("lifeCategories")}</span><h2 class="section-title">${t("recentHobbies")}</h2></div><button class="button ghost-button" data-action="add-hobby">${Icons.plus()} ${t("recordHobby")}</button></div><div class="daily-category-row">${categories.map(category => `<span class="pill">${t(category)}</span>`).join("")}</div><div class="list">${appData.hobbyLogs.slice().sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)).slice(0, 12).map(hobbyRow).join("") || `<p class="secondary">${t("hobbyHistory")}</p>`}</div></article>
    </section>
  `;
}

function hobbyRow(item) {
  return `<div class="list-row daily-record-row"><span class="icon-badge green">${Icons.spark()}</span><div><strong>${escapeHtml(item.title)}</strong><span class="secondary">${formatDate(item.date)}${item.minutes ? ` · ${item.minutes} ${t("minutes")}` : ""}${item.category ? ` · ${escapeHtml(t(item.category.toLowerCase()) || item.category)}` : ""}</span></div><button class="icon-button" data-edit-hobby="${escapeAttr(item.id)}" aria-label="${t("editHobby")}">${Icons.edit()}</button><button class="icon-button" data-delete-hobby="${escapeAttr(item.id)}" aria-label="${t("delete")}">${Icons.trash()}</button></div>`;
}

function reminderRow(item) {
  return `<div class="list-row daily-record-row"><span class="icon-badge pink">${Icons.bell()}</span><div><strong>${escapeHtml(item.title)}</strong><span class="secondary">${formatDate(item.date)}${item.category ? ` · ${escapeHtml(t(item.category.toLowerCase()) || item.category)}` : ""}</span></div><button class="icon-button" data-complete-reminder="${escapeAttr(item.id)}" aria-label="${t("complete")}">${Icons.check()}</button><button class="icon-button" data-edit-reminder="${escapeAttr(item.id)}" aria-label="${t("editReminder")}">${Icons.edit()}</button></div>`;
}

function bindDaily() {
  document.querySelectorAll('[data-action="enable-alerts"]').forEach(button => button.addEventListener("click", async () => {
    const permission = await NotificationManager.requestPermission();
    Toast.show(permission === "granted" ? t("alertsEnabled") : t("alertsRemainOff"), permission === "granted" ? "success" : "warning");
    if (permission === "granted") NotificationManager.sync();
  }));
  document.querySelectorAll('[data-action="add-hobby"]').forEach(button => button.addEventListener("click", () => App.openHobbyModal()));
  document.querySelectorAll('[data-action="add-reminder"]').forEach(button => button.addEventListener("click", () => App.openReminderModal()));
  document.querySelectorAll("[data-edit-hobby]").forEach(button => button.addEventListener("click", () => App.openHobbyModal(appData.hobbyLogs.find(item => item.id === button.dataset.editHobby))));
  document.querySelectorAll("[data-delete-hobby]").forEach(button => button.addEventListener("click", () => Store.delete("hobbyLogs", button.dataset.deleteHobby)));
  document.querySelectorAll("[data-edit-reminder]").forEach(button => button.addEventListener("click", () => App.openReminderModal(appData.reminders.find(item => item.id === button.dataset.editReminder))));
  document.querySelectorAll("[data-complete-reminder]").forEach(button => button.addEventListener("click", () => Store.edit("reminders", button.dataset.completeReminder, { done: true })));
}