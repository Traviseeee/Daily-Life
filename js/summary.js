function renderSummary() {
  const items = [
    { key: "family", label: t("family"), count: appData.family.length, color: "#8eea28", icon: Icons.family(), href: "#family" },
    { key: "goals", label: t("goals"), count: appData.goals.length, color: "#17d9b5", icon: Icons.goal(), href: "#goals" },
    { key: "financial", label: t("money"), count: appData.income.length + appData.expenses.length + appData.savings.length + appData.loans.length + appData.bills.length, color: "#ffad35", icon: Icons.wallet(), href: "#money" },
    { key: "calendar", label: t("calendar"), count: appData.calendarEvents.length, color: "#f65b9a", icon: Icons.calendar(), href: "#calendar" },
    { key: "memories", label: t("memories"), count: appData.memories.length, color: "#8054f7", icon: Icons.memory(), href: "#memories" }
  ];
  const totalCount = items.reduce((total, item) => total + item.count, 0);
  const denominator = totalCount || 1;
  const upcoming = getUpcomingNotifications(7).length;
  const upcomingMessage = upcoming
    ? `${upcoming} ${t(upcoming === 1 ? "summaryInsightUpcomingSingular" : "summaryInsightUpcoming")}`
    : t("summaryInsightEmpty");

  return `
    <section class="page summary-page">
      <h1 class="sr-only">${t("summaryPageTitle")}</h1>
      <article class="glass-card summary-overview-card" aria-labelledby="summaryOverviewTitle">
        <div class="summary-overview-heading">
          <div><span class="eyebrow">${t("summaryOverview")}</span><h2 id="summaryOverviewTitle">${t("summaryOverviewBody")}</h2></div>
          <span class="summary-period-chip">${t("summaryAllRecords")}</span>
        </div>
        <div class="summary-bars">
          ${items.map(item => {
            const percent = Math.round((item.count / denominator) * 100);
            const recordLabel = t(item.count === 1 ? "summaryRecord" : "summaryRecords");
            return `
              <a class="summary-bar-row" href="${item.href}" aria-label="${escapeAttr(`${item.label}: ${item.count} ${recordLabel}, ${percent}%`)}">
                <span class="summary-bar-label"><span class="summary-bar-icon" style="--summary-color:${item.color}">${item.icon}</span><span>${escapeHtml(item.label)}</span></span>
                <span class="summary-bar-track" role="img" aria-label="${percent}%"><span style="--summary-progress:${percent}%; --summary-color:${item.color}"></span></span>
                <strong class="summary-bar-count">${item.count}<small> / ${denominator}</small></strong>
                <span class="summary-bar-percent">${percent}%</span>
              </a>
            `;
          }).join("")}
        </div>
      </article>
      <nav class="summary-shortcuts" aria-label="${escapeAttr(t("summaryShortcuts"))}">
        ${items.map(item => `
          <a class="summary-shortcut summary-shortcut-${item.key}" href="${item.href}" style="--summary-color:${item.color}" aria-label="${escapeAttr(`${item.label}: ${item.count} ${t(item.count === 1 ? "summaryRecord" : "summaryRecords")}`)}">
            <span class="summary-shortcut-icon" aria-hidden="true">${item.icon}</span>
            <span class="summary-shortcut-copy"><strong>${escapeHtml(item.label)}</strong><small>${item.count} ${t(item.count === 1 ? "summaryRecord" : "summaryRecords")}</small></span>
            <span class="summary-shortcut-arrow" aria-hidden="true">${Icons.chevron()}</span>
            <span class="summary-shortcut-art" aria-hidden="true">${item.icon}</span>
          </a>
        `).join("")}
      </nav>
      <aside class="summary-insight">
        <span class="summary-insight-icon" aria-hidden="true">${Icons.bell()}</span>
        <div class="summary-insight-copy">
          <strong>${escapeHtml(upcomingMessage)}</strong>
          <p>${t(upcoming ? "summaryInsightStayPositive" : "summaryInsightTitle")}</p>
        </div>
      </aside>
    </section>
  `;
}
