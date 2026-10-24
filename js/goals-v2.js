/* MYLIFE Goals V2 (draft 24 Oct 2026): hero + category chips (instead of the ⚙ sidebar),
 * summary ring card, goal cards with a % ring, pace tip, "＋ add money", and a detail
 * page with a big ring, add / take out money and the money history.
 * Both themes in css/goals-v2.css. Keeps goals.js hooks: data-action="add-goal",
 * data-edit-goal, data-delete-goal, data-goal-cover (bound by bindGoals()).
 * Money in / out is saved in goal.contributions (same field as before; take-out = negative). */
const GoalsV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const CAT_EMOJI = { Personal: "🌱", Family: "👨‍👩‍👧", Financial: "💰", Home: "🏡", Travel: "✈️", Health: "💪", Education: "📚" };

  const num = value => Number(value || 0);
  const percent = goal => (num(goal.targetAmount) > 0 ? Math.max(0, Math.min(100, Math.round((num(goal.currentAmount) / num(goal.targetAmount)) * 100))) : 0);
  const done = goal => num(goal.targetAmount) > 0 && num(goal.currentAmount) >= num(goal.targetAmount);
  function dateLabel(iso, withYear) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (km()) return `${d} ${KM_M[m - 1]}${withYear ? ` ${y}` : ""}`;
    return new Date(y, m - 1, d).toLocaleDateString("en-US", withYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  }
  function daysLeft(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
    return Math.round((new Date(`${iso}T00:00:00`) - new Date(`${localDateInput()}T00:00:00`)) / 86400000);
  }
  function leftLabel(goal) {
    if (done(goal)) return L("សម្រេចហើយ 🎉", "Reached 🎉");
    const days = daysLeft(goal.deadline);
    if (days == null) return "";
    if (days < 0) return L(`ហួស ${-days} ថ្ងៃ`, `${-days} days late`);
    if (days === 0) return L("ថ្ងៃនេះ", "Today");
    return L(`${days} ថ្ងៃទៀត`, `${days} days left`);
  }
  const ring = (p, cls = "") => `<span class="gv-ring ${cls}" style="--p:${p}"><b>${p}%</b></span>`;
  const cover = goal => {
    const [start, end] = (typeof goalCategoryCovers !== "undefined" && goalCategoryCovers[goal.category]) || ["#a7cba9", "#6c9b77"];
    const pos = goal.coverImagePosition || { x: 0, y: 0 };
    return { style: `--gv-c1:${start};--gv-c2:${end}`, img: goal.coverImage ? `<img src="${escapeAttr(goal.coverImage)}" alt="" style="object-position:${50 + (Number(pos.x) || 0)}% ${50 + (Number(pos.y) || 0)}%">` : "" };
  };
  const catChip = goal => (goal.category ? `<span class="gv-cat">${CAT_EMOJI[goal.category] || "🎯"} ${escapeHtml(optionLabel(goal.category))}</span>` : "");
  const pace = goal => (typeof SmartMoney !== "undefined" && !done(goal) ? `${SmartMoney.linkedBadge(goal)}${SmartMoney.goalPace(goal)}` : "");

  function goalCard(goal) {
    const p = percent(goal);
    const c = cover(goal);
    const hasTarget = num(goal.targetAmount) > 0;
    const left = leftLabel(goal);
    return `<article class="gv-goal${done(goal) ? " is-done" : ""}">
      <div class="gv-cover" style="${c.style}">${c.img}${catChip(goal)}
        <label class="gv-cover-btn" title="${escapeAttr(t("photo"))}" aria-label="${escapeAttr(t("photo"))}">✎<input type="file" accept="image/*" data-goal-cover="${escapeAttr(goal.id)}" hidden></label>
        ${hasTarget ? ring(p, "is-float") : ""}
      </div>
      <div class="gv-body">
        <h3><a href="#goals/${escapeAttr(goal.id)}">${escapeHtml(goal.name || t("goal"))}</a></h3>
        <p class="gv-amt"><b>${money(goal.currentAmount)}</b>${hasTarget ? ` / ${money(goal.targetAmount)}` : ""}</p>
        ${hasTarget ? `<div class="gv-bar"><i style="width:${Math.max(p, 3)}%"></i></div>` : ""}
        ${pace(goal)}
        ${goal.deadline || left ? `<div class="gv-meta">${goal.deadline ? `<span>📅 ${escapeHtml(dateLabel(goal.deadline, true))}</span>` : ""}${left ? `<span>⏳ ${escapeHtml(left)}</span>` : ""}</div>` : ""}
        <div class="gv-acts"><button type="button" class="gv-btn is-main" data-gv-add="${escapeAttr(goal.id)}">＋ ${escapeHtml(L("ដាក់លុយ", "Add money"))}</button><a class="gv-btn" href="#goals/${escapeAttr(goal.id)}">${escapeHtml(L("បើក ›", "Open ›"))}</a></div>
      </div>
    </article>`;
  }

  function summaryCard(goals) {
    const withTarget = goals.filter(goal => num(goal.targetAmount) > 0);
    const saved = goals.reduce((sum, goal) => sum + num(goal.currentAmount), 0);
    const target = withTarget.reduce((sum, goal) => sum + num(goal.targetAmount), 0);
    const p = target > 0 ? Math.min(100, Math.round((withTarget.reduce((sum, goal) => sum + Math.min(num(goal.currentAmount), num(goal.targetAmount)), 0) / target) * 100)) : 0;
    const month = localDateInput().slice(0, 7);
    const thisMonth = goals.reduce((sum, goal) => sum + (goal.contributions || []).filter(item => String(item.date || "").slice(0, 7) === month).reduce((s, item) => s + num(item.amount), 0), 0);
    const next = goals.filter(goal => !done(goal) && goal.deadline && daysLeft(goal.deadline) >= 0).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    return `<section class="gv-card gv-sum">
      <div class="gv-sum-top">${ring(p, "is-md")}<div><small>${escapeHtml(L("សន្សំសរុប", "Saved in total"))}</small><b>${money(saved)}</b>${target ? `<em> / ${money(target)}</em>` : ""}</div></div>
      <div class="gv-minis">
        <div><small>${escapeHtml(L("ជិតដល់ថ្ងៃ", "Next deadline"))}</small><b>${next ? escapeHtml(dateLabel(next.deadline)) : "—"}</b></div>
        <div><small>${escapeHtml(L("ខែនេះ", "This month"))}</small><b>${thisMonth >= 0 ? "+" : "−"}${money(Math.abs(thisMonth))}</b></div>
        <div><small>${escapeHtml(L("សម្រេចហើយ", "Reached"))}</small><b>${goals.filter(done).length}</b></div>
      </div>
    </section>`;
  }

  function renderList(selectedCategory) {
    const all = appData.goals || [];
    const goals = selectedCategory ? all.filter(goal => goal.category === selectedCategory) : all;
    const saved = all.reduce((sum, goal) => sum + num(goal.currentAmount), 0);
    const target = all.reduce((sum, goal) => sum + num(goal.targetAmount), 0);
    const cats = (typeof goalCategories !== "undefined" ? goalCategories : []).filter(cat => all.some(goal => goal.category === cat));
    const sorted = goals.slice().sort((a, b) => Number(done(a)) - Number(done(b)) || String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")));
    return `<section class="page goals-page gv2">
      <header class="gv-hero">
        <div class="gv-top"><h1 class="gv-title">${escapeHtml(t("goals"))}</h1><button class="gv-add" type="button" data-action="add-goal" aria-label="${escapeAttr(t("createGoal"))}">${Icons.plus()}</button></div>
        <p class="gv-sub">${escapeHtml(L(`${all.length} គោលដៅ`, `${all.length} goal${all.length === 1 ? "" : "s"}`))}${target ? ` · ${escapeHtml(L("សន្សំបាន", "saved"))} ${money(saved)} / ${money(target)}` : ""}</p>
        ${all.length ? `<nav class="gv-chips" aria-label="${escapeAttr(t("category"))}">
          <a class="gv-chip${selectedCategory ? "" : " on"}" href="#goals">${escapeHtml(L("ទាំងអស់", "All"))} · ${all.length}</a>
          ${cats.map(cat => `<a class="gv-chip${selectedCategory === cat ? " on" : ""}" href="#goals/${cat}">${CAT_EMOJI[cat] || "🎯"} ${escapeHtml(optionLabel(cat))}</a>`).join("")}
        </nav>` : ""}
      </header>
      <div class="gv-wrap">
        ${all.length ? summaryCard(goals) : ""}
        ${sorted.length ? sorted.map(goalCard).join("") : `<section class="gv-card gv-empty"><span>🎯</span><h2>${escapeHtml(t("noGoalsYet"))}</h2><p>${escapeHtml(t("noGoalsBody"))}</p><button class="gv-btn is-main" type="button" data-action="add-goal">＋ ${escapeHtml(t("createGoal"))}</button></section>`}
      </div>
    </section>`;
  }

  function renderDetail(goal) {
    const p = percent(goal);
    const c = cover(goal);
    const hasTarget = num(goal.targetAmount) > 0;
    const remaining = Math.max(0, num(goal.targetAmount) - num(goal.currentAmount));
    const left = leftLabel(goal);
    const history = (goal.contributions || []).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    return `<section class="page goals-page gv2 gv2-detail">
      <header class="gv-dhero" style="${c.style}">${c.img}
        <div class="gv-dtop"><a class="gv-round" href="#goals" aria-label="${escapeAttr(t("backToGoals"))}">‹</a><button class="gv-round" type="button" data-edit-goal="${escapeAttr(goal.id)}" aria-label="${escapeAttr(t("editGoal"))}">✎</button></div>
        <div class="gv-dname">${catChip(goal)}<h1>${escapeHtml(goal.name || t("goal"))}</h1></div>
      </header>
      <div class="gv-wrap">
        <section class="gv-card">
          <div class="gv-big">${hasTarget ? ring(p, "is-lg") : ""}<div><small>${escapeHtml(L("សន្សំបាន", "Saved"))}</small><b>${money(goal.currentAmount)}</b><em>${hasTarget ? (done(goal) ? escapeHtml(L("សម្រេចគោលដៅហើយ 🎉", "Goal reached 🎉")) : `${escapeHtml(L("នៅខ្វះ", "Still need"))} ${money(remaining)}`) : escapeHtml(`${t("target")}: ${t("notSet")}`)}${left && !done(goal) ? ` · ${escapeHtml(left)}` : ""}</em></div></div>
          ${pace(goal)}
          <div class="gv-acts"><button type="button" class="gv-btn is-main" data-gv-add="${escapeAttr(goal.id)}">＋ ${escapeHtml(L("ដាក់លុយ", "Add money"))}</button><button type="button" class="gv-btn" data-gv-take="${escapeAttr(goal.id)}">− ${escapeHtml(L("ដកចេញ", "Take out"))}</button></div>
        </section>
        ${goal.description ? `<section class="gv-card gv-desc"><p>${escapeHtml(goal.description)}</p></section>` : ""}
        <section class="gv-card gv-kv">
          <div><small>${escapeHtml(t("target"))}</small><b>${hasTarget ? money(goal.targetAmount) : escapeHtml(t("notSet"))}</b></div>
          <div><small>${escapeHtml(t("deadline"))}</small><b>${goal.deadline ? escapeHtml(dateLabel(goal.deadline, true)) : "—"}</b></div>
          <div><small>${escapeHtml(t("category"))}</small><b>${goal.category ? escapeHtml(optionLabel(goal.category)) : "—"}</b></div>
        </section>
        <div class="gv-sec"><b>${escapeHtml(L("ប្រវត្តិ", "History"))}</b><small>${history.length}</small></div>
        <section class="gv-card gv-hist">
          ${history.length ? history.map(item => {
            const amount = num(item.amount);
            return `<div><i>${amount < 0 ? "↩" : "💰"}</i><p>${escapeHtml(amount < 0 ? L("ដកចេញ", "Taken out") : L("ដាក់ចូល", "Added"))}<small>${escapeHtml(dateLabel(item.date, true))}</small></p><b class="${amount < 0 ? "is-out" : ""}">${amount < 0 ? "−" : "+"}${money(Math.abs(amount))}</b></div>`;
          }).join("") : `<p class="gv-none">${escapeHtml(t("noContributionsYet"))}</p>`}
        </section>
        <button type="button" class="gv-delete" data-delete-goal="${escapeAttr(goal.id)}">${Icons.trash()} ${escapeHtml(t("deleteGoal"))}</button>
      </div>
    </section>`;
  }

  // ＋ add money / − take out (saved like the old "add contribution": goal.contributions + currentAmount)
  function moveMoney(goalId, sign) {
    const goal = (appData.goals || []).find(item => item.id === goalId);
    if (!goal) return;
    Modal.open({
      title: sign > 0 ? L("ដាក់លុយចូលគោលដៅ", "Add money") : L("ដកលុយចេញ", "Take money out"),
      submitText: sign > 0 ? L("ដាក់ចូល", "Add") : L("ដកចេញ", "Take out"),
      fields: [
        { name: "amount", label: t("amount"), type: "number", required: true },
        { name: "date", label: t("date"), type: "date", value: localDateInput(), required: true }
      ],
      onSubmit(data) {
        const amount = Math.abs(Number(data.amount || 0));
        if (!amount) return;
        const signed = sign > 0 ? amount : -Math.min(amount, num(goal.currentAmount));
        goal.currentAmount = Math.max(0, num(goal.currentAmount) + signed);
        goal.contributions = [{ date: data.date, amount: signed }, ...(goal.contributions || [])];
        goal.updatedAt = new Date().toISOString();
        Store.save();
        Toast.show(t("goalUpdated"));
        App.render();
      }
    });
  }

  document.addEventListener("click", event => {
    const add = event.target.closest("[data-gv-add]");
    if (add) return moveMoney(add.dataset.gvAdd, 1);
    const take = event.target.closest("[data-gv-take]");
    if (take) moveMoney(take.dataset.gvTake, -1);
  });

  return { renderList, renderDetail };
})();
