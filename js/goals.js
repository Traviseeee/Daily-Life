const goalCategories = ["Personal", "Family", "Financial", "Home", "Travel", "Health", "Education"];

function renderGoals(goalId) {
  const selected = goalId ? appData.goals.find(goal => goal.id === goalId) : null;
  if (selected) return renderGoalDetail(selected);
  const selectedCategory = goalCategories.includes(goalId) ? goalId : "";
  const visibleGoals = selectedCategory ? appData.goals.filter(goal => goal.category === selectedCategory) : appData.goals;
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.goal()}</span>${t("goals")}</h1>
          <p class="page-subtitle">${t("goalsSubtitle")}</p>
        </div>
        <button class="button" data-action="add-goal">${Icons.plus()} ${t("createGoal")}</button>
      </div>
      <div class="financial-layout goals-layout">
        <aside class="financial-sidebar" aria-label="${t("goals")} ${t("category")}">
          <a class="financial-nav-item ${selectedCategory ? "" : "active"}" href="#goals">${Icons.goal()}<span>${t("allGoals")}</span><strong>${appData.goals.length}</strong></a>
          ${goalCategories.map(category => {
            const count = appData.goals.filter(goal => goal.category === category).length;
            return `<a class="financial-nav-item ${selectedCategory === category ? "active" : ""}" href="#goals/${category}">${Icons.goal()}<span>${optionLabel(category)}</span><strong>${count}</strong></a>`;
          }).join("")}
        </aside>
        <div class="financial-content">
          ${visibleGoals.length ? `<div class="grid three-col">${visibleGoals.map(goalCard).join("")}</div>` : goalEmptyCard()}
        </div>
      </div>
    </section>
  `;
}

function goalEmptyCard() {
  return `
    <article class="glass-card image-empty-card goal-empty-card">
      <img src="https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=78" alt="" loading="lazy">
      <div class="image-empty-content">
        <span class="icon-badge purple">${Icons.goal()}</span>
        <h2>${escapeHtml(t("noGoalsYet"))}</h2>
        <p class="secondary">${escapeHtml(t("noGoalsBody"))}</p>
        <button class="button" data-action="add-goal">${Icons.plus()} ${t("createGoal")}</button>
      </div>
    </article>
  `;
}

function goalCard(goal) {
  return `
    <article class="glass-card card-pad">
      <div class="card-title-row"><span class="icon-badge purple">${Icons.goal()}</span><span class="pill">${optionLabel(goal.category)}</span></div>
      <h2><a href="#goals/${goal.id}">${escapeHtml(goal.name)}</a></h2>
      <p class="secondary">${escapeHtml(goal.description || "")}</p>
      <div class="goal-item">${goalProgressContent(goal)}</div>
      <div class="kv"><div><span>Deadline</span><strong>${formatDate(goal.deadline)}</strong></div></div>
      <div class="action-row">
        <a class="button ghost-button" href="#goals/${goal.id}">${Icons.chevron()} ${t("open")}</a>
        <button class="button ghost-button" data-edit-goal="${goal.id}">${Icons.edit()} ${t("edit")}</button>
        <button class="icon-button" data-delete-goal="${goal.id}" aria-label="Delete ${goal.name}">${Icons.trash()}</button>
      </div>
    </article>
  `;
}

function renderGoalDetail(goal) {
  const progress = pct(goal.currentAmount, goal.targetAmount);
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <a class="pill" href="#goals">${t("backToGoals")}</a>
          <h1 class="page-title">${escapeHtml(goal.name)}</h1>
          <p class="page-subtitle">${escapeHtml(goal.description || "")}</p>
        </div>
        <div class="action-row">
          <button class="button" data-action="add-contribution">${Icons.plus()} ${t("addContribution")}</button>
          <button class="button ghost-button" data-edit-goal="${goal.id}">${Icons.edit()} ${t("editGoal")}</button>
          <button class="icon-button" data-delete-goal="${goal.id}" aria-label="Delete goal">${Icons.trash()}</button>
        </div>
      </div>
      <div class="grid two-col">
        <article class="glass-card card-pad">
          <p class="secondary">${t("progress")}</p>
          <div class="metric">${money(goal.currentAmount)} <span class="secondary" style="font-size:1rem">of ${money(goal.targetAmount)}</span></div>
          <div class="progress-track"><div class="progress-fill" style="--progress:${progress}%"></div></div>
          <p class="trend">${progress}% complete</p>
          <div class="kv">
            <div><span>${t("category")}</span><strong>${optionLabel(goal.category)}</strong></div>
            <div><span>${t("target")}</span><strong>${money(goal.targetAmount)}</strong></div>
            <div><span>${t("deadline")}</span><strong>${formatDate(goal.deadline)}</strong></div>
          </div>
        </article>
        <article class="glass-card card-pad">
          <h2 class="section-title">${t("recentContributions")}</h2>
          <div class="list">
            ${(goal.contributions || []).map(item => `<div class="list-row"><span class="icon-badge green">${Icons.arrowUp()}</span><strong>${formatDate(item.date)}</strong><span class="success">+${money(item.amount)}</span></div>`).join("") || emptyState(t("noContributionsYet"), t("noContributionsBody"), t("addContribution"), "add-contribution")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function goalFields(goal = {}) {
  return [
    { name: "name", label: t("goalName"), value: goal.name, required: true },
    { name: "category", label: t("category"), type: "select", options: goalCategories, value: goal.category || "Personal" },
    { name: "targetAmount", label: t("targetAmount"), type: "number", value: goal.targetAmount || "", required: true },
    { name: "currentAmount", label: t("currentAmount"), type: "number", value: goal.currentAmount || 0, required: true },
    { name: "deadline", label: t("deadline"), type: "date", value: goal.deadline },
    { name: "description", label: t("description"), type: "textarea", value: goal.description }
  ];
}

function normalizeGoal(data, existing = {}) {
  return {
    ...existing,
    ...data,
    targetAmount: Number(data.targetAmount || 0),
    currentAmount: Number(data.currentAmount || 0),
    contributions: existing.contributions || []
  };
}

function openGoalModal(goal) {
  Modal.open({
    title: goal ? t("editGoal") : t("createGoal"),
    submitText: goal ? t("saveGoal") : t("createGoal"),
    fields: goalFields(goal),
    onSubmit(data) {
      if (goal) Store.edit("goals", goal.id, normalizeGoal(data, goal));
      else Store.add("goals", normalizeGoal(data));
      Toast.show(goal ? t("goalSaved") : t("goalCreated"));
    }
  });
}

function bindGoals(goalId) {
  document.querySelectorAll('[data-action="add-goal"]').forEach(button => button.addEventListener("click", () => openGoalModal()));
  document.querySelectorAll("[data-edit-goal]").forEach(button => button.addEventListener("click", () => openGoalModal(appData.goals.find(item => item.id === button.dataset.editGoal))));
  document.querySelectorAll("[data-delete-goal]").forEach(button => button.addEventListener("click", () => {
    Modal.confirm({ title: t("deleteGoal"), message: t("deleteGoalMessage"), confirmText: t("delete"), onConfirm: () => {
      Store.delete("goals", button.dataset.deleteGoal);
      Toast.show(t("goalDeleted"));
      if (goalId) location.hash = "#goals";
    }});
  }));
  document.querySelectorAll('[data-action="add-contribution"]').forEach(button => button.addEventListener("click", () => {
    const goal = appData.goals.find(item => item.id === goalId);
    Modal.open({
      title: t("addContribution"),
      submitText: t("addContribution"),
      fields: [
        { name: "amount", label: t("amount"), type: "number", required: true },
        { name: "date", label: t("date"), type: "date", value: new Date().toISOString().slice(0, 10), required: true }
      ],
      onSubmit(data) {
        const amount = Number(data.amount || 0);
        goal.currentAmount = Number(goal.currentAmount || 0) + amount;
        goal.contributions = [{ date: data.date, amount }, ...(goal.contributions || [])];
        Store.save();
        Toast.show(t("goalUpdated"));
        App.render();
      }
    });
  }));
}
