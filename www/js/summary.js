function renderSummary() {
  const items = [
    { label: t("family"), count: appData.family.length, color: "#b8ff5a", icon: Icons.family(), href: "#family" },
    { label: t("goals"), count: appData.goals.length, color: "#64f4d2", icon: Icons.goal(), href: "#goals" },
    { label: t("money"), count: appData.income.length + appData.expenses.length + appData.savings.length + appData.loans.length + appData.bills.length, color: "#ffcf6e", icon: Icons.wallet(), href: "#money" },
    { label: t("calendar"), count: appData.calendarEvents.length + getUpcomingNotifications(7).length, color: "#ff7fae", icon: Icons.calendar(), href: "#calendar" },
    { label: t("memories"), count: appData.memories.length, color: "#a58bff", icon: Icons.memory(), href: "#memories" }
  ];
  const max = Math.max(...items.map(item => item.count), 1);
  const firstName = (appData.profile.name || t("yourName")).split(/\s+/)[0];
  const upcoming = getUpcomingNotifications(7).length;

  return `
    <section class="page summary-page">
      <header class="summary-page-header summary-hero">
        <div>
          <span class="eyebrow">${t("dashboardSnapshot")}</span>
          <h1 class="page-title">${t("summaryGreeting")}, <span>${escapeHtml(firstName)}</span></h1>
          <p class="page-subtitle">${t("dashboardSnapshotBody")}</p>
        </div>
        <div class="summary-hero-mark">${Icons.chart()}</div>
      </header>

      <article class="glass-card summary-overview-card">
        <div class="summary-overview-heading">
          <div><span class="eyebrow">${t("summaryOverview")}</span><h2>${t("summaryOverviewBody")}</h2></div>
          <span class="icon-badge green">${Icons.chart()}</span>
        </div>
        <div class="summary-bars">
          ${items.map(item => `
            <a class="summary-bar-row" href="${item.href}">
              <span class="summary-bar-label"><span style="color:${item.color}">${item.icon}</span>${escapeHtml(item.label)}</span>
              <span class="summary-bar-track"><span style="--summary-progress:${Math.max(item.count ? 9 : 3, (item.count / max) * 100)}%; --summary-color:${item.color}"></span></span>
              <strong>${item.count}</strong>
            </a>
          `).join("")}
        </div>
      </article>
      <div class="summary-shortcuts" aria-label="${escapeAttr(t("summaryShortcuts"))}">
        ${items.map(item => `
          <a class="summary-shortcut" href="${item.href}">
            <span class="summary-shortcut-icon" style="color:${item.color}">${item.icon}</span>
            <span class="summary-shortcut-copy"><strong>${escapeHtml(item.label)}</strong><small>${item.count} ${t("summaryRecords")}</small></span>
            <span class="summary-shortcut-arrow">${Icons.chevron()}</span>
          </a>
        `).join("")}
      </div>
      <p class="summary-upcoming-note">${upcoming ? `${upcoming} ${t("summaryInsightUpcoming")}` : t("summaryInsightEmpty")}</p>
    </section>
  `;
}
