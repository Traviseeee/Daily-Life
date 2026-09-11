function renderHome() {
  const stats = Store.calculate();
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayEvents = appData.calendarEvents.filter(event => event.date === todayIso);
  const hasMoneyData = ["income", "expenses", "savings", "loans", "bills"].some(key => appData[key].length);
  const hasAnyData = appData.profile.name || ["family", "goals", "income", "expenses", "savings", "loans", "bills", "calendarEvents", "memories"].some(key => appData[key].length);
  const greetingName = appData.profile.name ? `, ${appData.profile.name.split(" ")[0]}` : "";
  const cards = [
    hasMoneyData ? summaryCard("Available", t("availableMoney"), money(stats.available), t("availableTrend"), Icons.wallet(), "green") : "",
    appData.income.length ? summaryCard("Income", t("totalIncome"), money(stats.totalIncome), `${appData.income.length} ${t("incomeSourcesCount")}`, Icons.salary(), "blue") : "",
    appData.goals.length ? summaryCard("Goals", t("goalsLabel"), String(stats.activeGoals), `${appData.goals.length} ${t("goals")} ${t("inProgress")}`, Icons.goal(), "purple") : "",
    appData.bills.length ? summaryCard("Bills", t("upcomingBills"), String(stats.upcomingBills), `${appData.bills.length} ${t("bills")}`, Icons.bill(), "") : "",
    appData.family.length ? summaryCard("Family", t("familyMembers"), String(appData.family.length), `${stats.familyEvents} ${t("familyEvents")}`, Icons.family(), "green") : "",
    appData.calendarEvents.length ? summaryCard("Calendar", t("calendarEvents"), String(stats.calendarEvents), `${todayEvents.length} ${t("plannedToday")}`, Icons.calendar(), "blue") : "",
    appData.memories.length ? summaryCard("Memories", t("savedMemories"), String(appData.memories.length), t("savedMoments"), Icons.memory(), "purple") : ""
  ].filter(Boolean);

  return `
    <section class="page">
      <div class="page-header home-hero">
        <div class="home-hero-copy">
          <span class="eyebrow">${t("privateDashboard")}</span>
          <h1 class="page-title">${t("goodMorning")}${greetingName}</h1>
          <p class="page-subtitle">${t("lifeGlance")}</p>
          <div class="date-line">${new Date().toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
        </div>
        <div class="action-row">
          <button class="button" data-action="smart-assistant">${Icons.spark()} ${t("smartAssistant")}</button>
          <button class="button" data-action="create-user">${Icons.user()} ${t("createUser")}</button>
          <button class="button ghost-button" data-action="add-event">${Icons.plus()} ${t("addEvent")}</button>
        </div>
      </div>

      ${hasAnyData ? "" : emptyState(t("nothingYet"), t("emptyDashboard"), t("createUser"), "create-user")}

      ${cards.length ? `<div class="summary-grid grid">${cards.join("")}</div>` : ""}

      ${(todayEvents.length || hasMoneyData || appData.goals.length) ? `<div class="grid home-dashboard-grid ${todayEvents.length ? "has-today" : ""}">
        ${todayEvents.length ? `
        <article class="glass-card card-pad">
          <div class="between">
              <h2 class="section-title">${t("todaysPlan")}</h2>
            <span class="pill">${todayEvents.length} event${todayEvents.length === 1 ? "" : "s"}</span>
          </div>
          <div class="task-list">
            ${todayEvents.map(event => `
              <div class="task-row">
                <span class="icon-badge green">${Icons.calendar()}</span>
                <span class="task-time">${event.time || "All day"}</span>
                <span class="task-title">${event.title}</span>
                <span class="pill">${event.category}</span>
              </div>
            `).join("")}
          </div>
        </article>` : ""}

        ${(hasMoneyData || appData.goals.length) ? `
        <div class="grid home-insight-grid">
          ${hasMoneyData ? `
          <article class="glass-card card-pad">
            <div class="between">
              <h2 class="section-title">${t("moneyOverview")}</h2>
              ${Charts.donut([
                { label: t("income"), value: stats.totalIncome, color: "#9dff6e" },
                { label: t("expenses"), value: stats.totalExpenses, color: "#ff6673" },
                { label: t("monthlyContribution"), value: stats.monthlySavings, color: "#64f4d2" },
                { label: t("monthlyPayment"), value: stats.monthlyLoanPayments, color: "#9b6dff" }
              ])}
            </div>
            <div class="kv">
              <div><span>${t("income")}</span><strong>${money(stats.totalIncome)}</strong></div>
              <div><span>${t("expenses")}</span><strong>${money(stats.totalExpenses)}</strong></div>
              <div><span>${t("monthlyContribution")}</span><strong>${money(stats.monthlySavings)}</strong></div>
              <div><span>${t("monthlyPayment")}</span><strong>${money(stats.monthlyLoanPayments)}</strong></div>
              <div><span>${t("available")}</span><strong>${money(stats.available)}</strong></div>
            </div>
          </article>` : ""}
          ${appData.goals.length ? `
          <article class="glass-card card-pad">
            <h2 class="section-title">${t("goalProgress")}</h2>
            <div class="grid">
              ${appData.goals.slice(0, 4).map(goalProgress).join("")}
            </div>
          </article>` : ""}
        </div>` : ""}
      </div>` : ""}
    </section>
  `;
}

function summaryCard(label, title, value, trend, icon, tone) {
  return `
    <article class="glass-card card-pad">
      <div class="card-title-row">
        <span class="secondary">${title}</span>
        <span class="icon-badge ${tone}">${icon}</span>
      </div>
      <div class="metric">${value}</div>
      <div class="secondary">${trend}</div>
    </article>
  `;
}

function goalProgress(goal) {
  return `
    <a class="goal-item" href="#goals/${goal.id}">
      ${goalProgressContent(goal)}
    </a>
  `;
}

function goalProgressContent(goal) {
  const progress = pct(goal.currentAmount, goal.targetAmount);
  return `
    <div class="between"><strong>${goal.name}</strong><span class="pill">${progress}%</span></div>
    <div class="secondary">${money(goal.currentAmount)} / ${money(goal.targetAmount)}</div>
    <div class="progress-track"><div class="progress-fill" style="--progress:${progress}%"></div></div>
  `;
}

function bindHome() {
  document.querySelectorAll('[data-action="add-event"]').forEach(button => button.addEventListener("click", () => App.openEventModal()));
  document.querySelectorAll('[data-action="smart-assistant"]').forEach(button => button.addEventListener("click", () => SmartAssistant.open()));
  document.querySelectorAll('[data-action="create-user"]').forEach(button => button.addEventListener("click", () => openCreateUserModal()));
  document.querySelector('[data-action="setup-profile"]')?.addEventListener("click", () => openProfileModal());
  document.querySelector('[data-action="add-goal"]')?.addEventListener("click", () => openGoalModal());
}
