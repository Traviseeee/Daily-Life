const goalCategories = ["Personal", "Family", "Financial", "Home", "Travel", "Health", "Education"];
const goalCategoryIcons = {
  Personal: "user",
  Family: "family",
  Financial: "money",
  Home: "home",
  Travel: "plane",
  Health: "heart",
  Education: "graduation"
};
const goalCategoryCovers = {
  Personal: ["#f3bd83", "#dc8769"],
  Family: ["#edaa87", "#ce7072"],
  Financial: ["#abc5eb", "#718dbb"],
  Home: ["#c6d99a", "#91ad71"],
  Travel: ["#9bd7c8", "#5ba99f"],
  Health: ["#e8aab4", "#c7798d"],
  Education: ["#c4b2e4", "#8c78b7"]
};

function renderGoals(goalId) {
  const selected = goalId ? appData.goals.find(goal => goal.id === goalId) : null;
  if (selected) return renderGoalDetail(selected);
  const selectedCategory = goalCategories.includes(goalId) ? goalId : "";
  const visibleGoals = selectedCategory ? appData.goals.filter(goal => goal.category === selectedCategory) : appData.goals;
  return `
    <section class="page">
      <div class="page-header goals-header">
        <div class="goals-header-main">
          <div class="goals-header-copy">
            <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.goal()}</span>${t("goals")}</h1>
            <p class="page-subtitle">${t("goalsSubtitle")}</p>
          </div>
          <div class="goals-nav-dock">
              <button class="goals-nav-toggle" type="button" data-open-goals-nav aria-label="${t("goals")} ${t("category")}" title="${t("goals")} ${t("category")}"><span class="goals-nav-toggle-lines" aria-hidden="true"><i></i><i></i><i></i></span></button>
            <dialog class="goals-sidebar" aria-label="${t("goals")} ${t("category")}">
              <div class="goals-sidebar-handle" aria-hidden="true"><span></span></div>
              <div class="goals-sidebar-heading"><div class="goals-sidebar-heading-copy"><strong>${t("goals")} ${t("category")}</strong><span>${t("goalsCategorySubtitle")}</span></div><button class="icon-button" type="button" data-close-goals-nav aria-label="${t("close")}">${Icons.close()}</button></div>
              <nav class="goals-sidebar-nav" aria-label="${t("goals")} ${t("category")}">
                <a class="financial-nav-item ${selectedCategory ? "" : "active"}" href="#goals"><span class="financial-nav-icon">${Icons.goal()}</span><span class="financial-nav-copy"><strong>${t("allGoals")}</strong></span><strong>${appData.goals.length}</strong>${Icons.chevron()}</a>
                ${goalCategories.map(category => {
                  const count = appData.goals.filter(goal => goal.category === category).length;
                  return `<a class="financial-nav-item ${selectedCategory === category ? "active" : ""}" href="#goals/${category}"><span class="financial-nav-icon">${Icons[goalCategoryIcons[category]]()}</span><span class="financial-nav-copy"><strong>${optionLabel(category)}</strong></span><strong>${count}</strong>${Icons.chevron()}</a>`;
                }).join("")}
              </nav>
            </dialog>
          </div>
        </div>
        <button class="button" type="button" data-action="add-goal">${Icons.plus()} ${t("createGoal")}</button>
      </div>
      <div class="goals-layout">
        <div class="goals-content">
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
  const hasTarget = goalHasTarget(goal);
  const cardIcon = Icons[goalCategoryIcons[goal.category]] || Icons.goal;
  const [coverStart, coverEnd] = goalCategoryCovers[goal.category] || ["#a7cba9", "#6c9b77"];
  const coverPosition = goal.coverImagePosition || { x: 0, y: 0 };
  const progress = hasTarget ? pct(goal.currentAmount, goal.targetAmount) : 0;
  return `
    <article class="glass-card goal-profile-card" style="--goal-cover-start:${coverStart};--goal-cover-end:${coverEnd}">
      <div class="goal-profile-cover">
        ${goal.coverImage ? `<img class="goal-profile-cover-image" src="${escapeAttr(goal.coverImage)}" style="--image-position-x:${Number(coverPosition.x) || 0}%;--image-position-y:${Number(coverPosition.y) || 0}%" alt="">` : ""}
        <span class="goal-profile-category">${optionLabel(goal.category)}</span>
        <label class="goal-profile-cover-upload" title="${escapeAttr(t("photo"))}" aria-label="${escapeAttr(t("photo"))}">${goal.coverImage ? Icons.edit() : Icons.plus()}<input type="file" accept="image/*" data-goal-cover="${escapeAttr(goal.id)}"></label>
      </div>
      <div class="goal-profile-body">
        <div class="goal-profile-heading">
          <span class="goal-profile-avatar">${cardIcon()}</span>
          <div class="goal-profile-copy">
            <h2><a href="#goals/${goal.id}">${escapeHtml(goal.name)}</a></h2>
            ${goal.description ? `<p>${escapeHtml(goal.description)}</p>` : ""}
          </div>
          <div class="goal-profile-tools">
            <button class="icon-button" data-edit-goal="${goal.id}" aria-label="${escapeAttr(t("edit"))} ${escapeAttr(goal.name)}">${Icons.edit()}</button>
            <button class="icon-button" data-delete-goal="${goal.id}" aria-label="${escapeAttr(t("delete"))} ${escapeAttr(goal.name)}">${Icons.trash()}</button>
          </div>
        </div>
        <div class="goal-profile-stats">
          <div><span>${Icons.goal()}${t("progress")}</span><strong>${hasTarget ? `${progress}%` : t("notSet")}</strong></div>
          <div><span>${Icons.savings()}${t("savings")}</span><strong>${money(goal.currentAmount)}</strong></div>
          <div><span>${Icons.calendar()}${t("deadline")}</span><strong>${formatDate(goal.deadline, { month: "short", day: "numeric" })}</strong></div>
        </div>
        <div class="goal-profile-progress">
          <div class="between"><span>${t("target")}</span><strong>${hasTarget ? money(goal.targetAmount) : t("notSet")}</strong></div>
          ${hasTarget ? `<div class="progress-track"><div class="progress-fill" style="--progress:${progress}%"></div></div>` : ""}
        </div>
        <a class="goal-profile-open" href="#goals/${goal.id}">${t("open")} ${Icons.chevron()}</a>
      </div>
    </article>
  `;
}

function renderGoalDetail(goal) {
  const progress = pct(goal.currentAmount, goal.targetAmount);
  const hasTarget = goalHasTarget(goal);
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
          <div class="metric">${money(goal.currentAmount)} ${hasTarget ? `<span class="secondary" style="font-size:1rem">of ${money(goal.targetAmount)}</span>` : ""}</div>
          ${hasTarget ? `<div class="progress-track"><div class="progress-fill" style="--progress:${progress}%"></div></div><p class="trend">${progress}% complete</p>` : `<p class="trend">${t("target")}: ${t("notSet")}</p>`}
          <div class="kv">
            <div><span>${t("category")}</span><strong>${optionLabel(goal.category)}</strong></div>
            <div><span>${t("target")}</span><strong>${hasTarget ? money(goal.targetAmount) : t("notSet")}</strong></div>
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

function goalFields(goal = null, defaultCategory = "Personal") {
  const currentGoal = goal || {};
  return [
    { name: "name", label: t("goalName"), value: currentGoal.name, required: true },
    { name: "category", label: t("category"), type: "select", options: goalCategories, value: currentGoal.category || defaultCategory || "Personal" },
    { name: "targetAmount", label: t("targetAmount"), type: "number", value: currentGoal.targetAmount || "" },
    { name: "currentAmount", label: t("currentAmount"), type: "number", value: currentGoal.currentAmount || "" },
    { name: "deadline", label: t("deadline"), type: "date", value: currentGoal.deadline },
    { name: "description", label: t("description"), type: "textarea", value: currentGoal.description },
    { name: "coverImage", label: t("photo"), type: "file", value: currentGoal.coverImage || "" }
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

function goalHasTarget(goal) {
  return Number(goal?.targetAmount || 0) > 0;
}

function openGoalModal(goal, defaultCategory = "Personal") {
  Modal.open({
    title: goal ? t("editGoal") : t("createGoal"),
    submitText: goal ? t("saveGoal") : t("createGoal"),
    fields: goalFields(goal, defaultCategory),
    onSubmit(data) {
      if (goal) Store.edit("goals", goal.id, normalizeGoal(data, goal));
      else Store.add("goals", normalizeGoal(data));
      Toast.show(goal ? t("goalSaved") : t("goalCreated"));
    }
  });
}

function bindGoals(goalId) {
  const defaultCategory = goalCategories.includes(goalId) ? goalId : "Personal";
  bindNavigationSheetGestures();
  document.querySelectorAll("[data-open-goals-nav]").forEach(button => button.addEventListener("click", () => {
    button.closest(".goals-nav-dock")?.querySelector(".goals-sidebar")?.showModal();
  }));
  document.querySelectorAll("[data-close-goals-nav]").forEach(button => button.addEventListener("click", () => {
    button.closest(".goals-sidebar")?.close();
  }));
  document.querySelectorAll(".goals-sidebar").forEach(dialog => dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  }));
  document.querySelectorAll('[data-action="add-goal"]').forEach(button => button.addEventListener("click", () => openGoalModal(null, defaultCategory)));
  document.querySelectorAll("[data-edit-goal]").forEach(button => button.addEventListener("click", () => openGoalModal(appData.goals.find(item => item.id === button.dataset.editGoal))));
  document.querySelectorAll("[data-goal-cover]").forEach(input => input.addEventListener("change", async () => {
    const file = input.files?.[0];
    const goal = appData.goals.find(item => item.id === input.dataset.goalCover);
    if (!file || !goal) return;
    try {
      const coverImage = await readFile(file);
      Store.edit("goals", goal.id, { coverImage, coverImagePosition: { x: 0, y: 0 } });
      Toast.show(t("goalSaved"));
    } catch (error) {
      console.error("Could not upload goal cover", error);
      Toast.show(t("saveFailed"));
    }
  }));
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
        { name: "date", label: t("date"), type: "date", value: localDateInput(), required: true }
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
