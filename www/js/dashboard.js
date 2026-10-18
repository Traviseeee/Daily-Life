function renderHome() {
  const stats = Store.calculate();
  const todayIso = localDashboardDate(new Date());
  const todayEvents = appData.calendarEvents.filter(event => event.date === todayIso);
  const hasMoneyData = ["income", "expenses", "savings", "loans", "bills"].some(key => appData[key].length);
  const hasAnyData = appData.profile.name || ["family", "goals", "income", "expenses", "savings", "loans", "bills", "calendarEvents", "memories"].some(key => appData[key].length);
  const profileName = appData.profile.name || "Your Name";
  const firstName = profileName.split(/\s+/).filter(Boolean)[0] || "there";
  const profilePosition = imagePosition(appData.profile.photoPosition);
  const profilePhoto = appData.profile.photo ? '<img src="' + appData.profile.photo + '" style="--image-position-x: ' + profilePosition.x + '%; --image-position-y: ' + profilePosition.y + '%;" alt="' + escapeHtml(profileName) + '">' : initials(profileName);
  const moodOptions = [
    { value: "happy", emoji: "😊", label: t("moodHappy"), robot: t("moodCheerful") },
    { value: "calm", emoji: "😌", label: t("moodCalm"), robot: t("moodBalanced") },
    { value: "tired", emoji: "😴", label: t("moodTired"), robot: t("moodLowEnergy") },
    { value: "stressed", emoji: "😟", label: t("moodStressed"), robot: t("moodNeedsEase") },
    { value: "excited", emoji: "🤩", label: t("moodExcited"), robot: t("moodMotivated") }
  ];
  const moodHistory = Array.isArray(appData.moodHistory) ? appData.moodHistory : [];
  const todayMood = appData.mood?.date === todayIso ? appData.mood : null;
  const selectedMood = todayMood ? moodOptions.find(option => option.value === todayMood.value) || moodOptions[0] : null;
  const reflectionText = appData.dailyReflection?.date === todayIso ? (appData.dailyReflection.text || "") : "";
  const focusDefaults = [
    { id: "focus-move", text: t("moveMyBody"), done: false },
    { id: "focus-water", text: t("drinkWater"), done: false },
    { id: "focus-family", text: t("checkInWithFamily"), done: false }
  ];
  const focusItems = appData.dailyFocus?.date === todayIso && Array.isArray(appData.dailyFocus.items) && appData.dailyFocus.items.length
    ? appData.dailyFocus.items
    : focusDefaults;
  const focusDoneCount = focusItems.filter(item => item.done).length;
  const focusProgress = focusItems.length ? Math.round((focusDoneCount / focusItems.length) * 100) : 0;
  const reflectionReady = (reflectionText || "").trim().length > 0;
  const agenda = homeAgenda(todayIso);
  const challengeImage = appData.profile.launcherCover || appData.profile.familyPhoto || "";
  const challengeImagePosition = imagePosition(appData.profile.launcherCover
    ? appData.profile.launcherCoverPosition
    : appData.profile.familyPhotoPosition);

  const moodHistoryChart = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const iso = localDateInput(date);
    const entry = moodHistory.find(item => item.date === iso);
    const option = entry ? moodOptions.find(item => item.value === entry.value) : null;
    const isKhmer = languageCode() === "km";
    const khmerWeekdays = ["អាទិ", "ចន្ទ", "អង្គ", "ពុធ", "ព្រហ", "សុក្រ", "សៅរ៍"];
    return {
      day: isKhmer ? khmerWeekdays[date.getDay()] : date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3),
      date: isKhmer ? String(date.getDate()).replace(/\d/g, digit => "០១២៣៤៥៦៧៨៩"[Number(digit)]) : date.getDate(),
      isToday: iso === todayIso,
      label: option ? option.label : "—",
      emoji: option ? option.emoji : "·",
      value: option ? option.value : ""
    };
  });

  return '<section class="page home-featured-page">' +
    '<div class="home-hero-panel">' +
      '<div class="home-hero-copy">' +
        '<span class="eyebrow">' + t("privateDashboard") + '</span>' +
        '<h1 class="page-title">' + homeGreeting() + ', ' + escapeHtml(firstName) + '</h1>' +
        '<div class="home-quote-row">' +
          '<span class="quote-mark">“</span>' +
          '<p>' + t("smallStepsBigWins") + '</p>' +
          '<span class="quote-arrow">›</span>' +
        '</div>' +
      '</div>' +
      '<div class="home-profile-side home-profile-trigger" role="button" tabindex="0" aria-label="' + t("editProfile") + '">' +
        '<div class="home-avatar-ring">' +
          '<span class="home-user-avatar">' + profilePhoto + '</span>' +
        '</div>' +
        '<div class="home-profile-meta">' +
          '<strong>' + escapeHtml(profileName) + '</strong>' +
        '</div>' +
        '<div class="home-profile-menu" aria-hidden="true">' +
          '<button type="button" class="home-profile-menu-item" data-account-action="edit-profile">Edit profile</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    renderHomeAgenda(agenda) +
    '<div class="home-challenge-card' + (challengeImage ? " has-cover-image" : "") + '">' +
      '<label class="home-challenge-image-edit" title="' + escapeAttr(t(challengeImage ? "changeFocusImage" : "addFocusImage")) + '"><span aria-hidden="true">' + Icons.edit() + '</span><input type="file" accept="image/*" data-home-challenge-image aria-label="' + escapeAttr(t(challengeImage ? "changeFocusImage" : "addFocusImage")) + '"></label>' +
      '<div class="home-challenge-copy">' +
        '<span class="home-challenge-label">' + t("dailyFocus") + '</span>' +
        '<h2>' + (languageCode() === "km" ? "ត្រូវការជំនួយបន្តិច?" : "Need a nudge?") + '</h2>' +
        '<p>' + (languageCode() === "km" ? "កត់សម្គាល់អារម្មណ៍ ឬសរសេររឿងល្អមួយយ៉ាង" : "Check in, reflect, and finish a tiny win.") + '</p>' +
        '<button class="suggestion-button" type="button" data-action="smart-assistant">' + (languageCode() === "km" ? "ជំនួយ" : "Help") + '</button>' +
      '</div>' +
      (challengeImage ? '<img class="home-challenge-image" src="' + escapeAttr(challengeImage) + '" style="--challenge-image-x: ' + challengeImagePosition.x + '%; --challenge-image-y: ' + challengeImagePosition.y + '%;" alt="">' : '') +
      '<div class="home-challenge-art" aria-hidden="true"><span class="shape orange"></span><span class="shape grey"></span><span class="shape dark"></span></div>' +
    '</div>' +
    '<div class="home-week-row" aria-label="' + (languageCode() === "km" ? "អារម្មណ៍ប្រចាំសប្តាហ៍" : "Mood this week") + '">' +
      moodHistoryChart.map(day => '<div class="home-week-day ' + (day.isToday ? "active" : "") + '"' + (day.isToday ? ' aria-current="date"' : '') + '><span class="week-label">' + day.day + '</span><strong>' + day.date + '</strong><span class="week-mood ' + (day.value ? "has-mood" : "no-mood") + '" aria-label="' + escapeHtml(day.label) + '">' + day.emoji + '</span></div>').join("") +
    '</div>' +
    '' +
    '<a class="home-smart-summary-link" href="#summary"><span>' + Icons.chart() + '</span><span><strong>' + escapeHtml(t("smartSummary")) + '</strong><small>' + escapeHtml(t("smartSummarySubtitle")) + '</small></span>' + Icons.chevron() + '</a>' +
    '<div class="home-overview">' +
      '<article class="glass-card mood-card">' +
        '<span class="eyebrow">' + t("mood") + '</span>' +
        '<h2 class="section-title section-title-with-icon"><span class="section-title-icon">' + Icons.mood() + '</span>' + t("mood") + '</h2>' +
        '<div class="mood-selector">' +
          moodOptions.map(option => '<button class="mood-button ' + (selectedMood && selectedMood.value === option.value ? "active" : "") + '" type="button" data-mood="' + option.value + '" aria-label="' + escapeHtml(option.label) + '"><span class="mood-emoji">' + option.emoji + '</span><span class="mood-label">' + escapeHtml(option.label) + '</span></button>').join("") +
        '</div>' +
        (todayMood ? '<div class="mood-selected"><span class="eyebrow">' + t("todayMood") + '</span><span class="mood-emoji-large">' + selectedMood.emoji + '</span><strong>' + escapeHtml(selectedMood.label) + '</strong></div>' : '<p class="secondary" style="margin-top:12px;text-align:center">' + t("tapToLogMood") + '</p>') +
      '</article>' +
      '<article class="glass-card reflection-card">' +
        '<span class="eyebrow">' + t("dailyReflection") + '</span>' +
        '<h2 class="section-title section-title-with-icon"><span class="section-title-icon">' + Icons.quote() + '</span>' + t("dailyReflection") + '</h2>' +
        '<textarea class="reflection-textarea" placeholder="' + t("reflectionPlaceholder") + '" data-reflection-textarea>' + escapeHtml(reflectionText) + '</textarea>' +
        '<div class="reflection-stats">' +
          '<span class="stat"><strong>' + reflectionText.trim().length + '</strong> ' + t("characters") + '</span>' +
          '<span class="stat"><strong>' + reflectionText.trim().split(/\s+/).filter(Boolean).length + '</strong> ' + t("words") + '</span>' +
        '</div>' +
        (reflectionReady ? '<button class="button" type="button" data-action="save-reflection">' + t("saveReflection") + '</button>' : '') +
      '</article>' +
      '<article class="glass-card focus-card">' +
        '<span class="eyebrow">' + t("dailyFocus") + '</span>' +
        '<h2 class="section-title section-title-with-icon"><span class="section-title-icon">' + Icons.target() + '</span>' + t("dailyFocus") + '</h2>' +
        '<div class="focus-progress"><div class="progress-track"><div class="progress-fill" style="--progress:' + focusProgress + '%"></div></div><span class="focus-progress-text">' + focusProgress + '%</span></div>' +
        '<ul class="focus-list">' +
          focusItems.map(item => '<li class="focus-item ' + (item.done ? "done" : "") + '"><label><input type="checkbox" ' + (item.done ? "checked" : "") + ' data-focus-id="' + item.id + '"><span class="focus-text">' + escapeHtml(item.text) + '</span></label></li>').join("") +
        '</ul>' +
        '<button class="button ghost-button" type="button" data-action="edit-focus">' + Icons.edit() + ' ' + t("editFocus") + '</button>' +
      '</article>' +
    '</div>' +
  '</section>';
}

function renderHomeNewsTicker() {
  const items = getUpcomingNotifications(7, 5);
  const shouldScroll = items.length >= 3;
  const itemMarkup = items.length
    ? items.map(item => {
        const when = item.daysLeft === 0
          ? t("today")
          : item.daysLeft === 1
            ? t("tomorrow")
            : t("inDays", { count: item.daysLeft });
        const href = item.kind === "bill"
          ? "#money/bills"
          : item.source === "family"
            ? "#family"
            : item.kind === "reminder"
              ? "#daily"
              : "#calendar";
        return '<a class="ticker-item" href="' + href + '">' + escapeHtml(item.title) + ' · ' + escapeHtml(when) + '</a>';
      }).join('<span class="ticker-divider" aria-hidden="true">✦</span>')
    : '<span class="ticker-item">' + escapeHtml(t("noUpcomingItems")) + '</span>';
  const groupMarkup = '<div class="ticker-group">' + itemMarkup + '</div>';

  return '<div class="news-ticker' + (shouldScroll ? ' is-scrolling' : '') + '" role="region" aria-label="' + escapeAttr(t("upcoming")) + '">' +
    '<div class="news-ticker-track">' +
      groupMarkup +
      (shouldScroll ? '<div class="ticker-group" aria-hidden="true">' + itemMarkup + '</div>' : '') +
    '</div>' +
  '</div>';
}

function localDashboardDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function homeAgenda(todayIso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 14);
  const weekEndIso = localDashboardDate(weekEnd);
  const limitIso = localDashboardDate(limit);
  const byKey = new Map();

  const addItem = item => {
    const key = `${item.kind}:${item.id}:${item.date}`;
    if (!byKey.has(key)) byKey.set(key, item);
  };

  getUpcomingNotifications(14, Infinity).forEach(item => {
    const bill = item.kind === "bill"
      ? appData.bills.find(candidate => candidate.id === item.id || (candidate.name === item.title && candidate.due === item.date))
      : null;
    addItem({
      ...item,
      href: item.kind === "bill" ? "#money/bills" : item.source === "family" ? "#family" : item.kind === "reminder" ? "#daily" : "#calendar",
      categoryLabel: item.source === "family" ? t("family") : item.kind === "bill" ? t("bill") : item.kind === "reminder" ? t("reminder") : t("calendarEvent"),
      amount: bill?.amount,
      currency: bill?.currency,
      overdue: false
    });
  });

  for (let year = today.getFullYear(); year <= limit.getFullYear(); year += 1) {
    ensureCambodiaHolidays(year);
    (cambodiaHolidayCache.get(year) || [])
      .filter(holiday => holiday.date >= todayIso && holiday.date <= limitIso)
      .forEach(holiday => {
        const date = parseAppDate(holiday.date);
        addItem({
          id: `holiday-${holiday.date}`,
          kind: "holiday",
          title: holiday.name,
          date: holiday.date,
          daysLeft: Math.max(0, Math.round((date.getTime() - today.getTime()) / 86400000)),
          categoryLabel: languageCode() === "km" ? "ថ្ងៃឈប់សម្រាកសាធារណៈ" : "Public holiday",
          href: `#calendar/day/${holiday.date}`,
          overdue: false
        });
      });
  }

  const monthCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  appData.bills.forEach(bill => {
    if (!bill.due || bill.status === "Paid") return;
    const dueDate = parseAppDate(bill.due);
    if (Number.isNaN(dueDate.getTime())) return;
    const frequency = bill.frequency || "Monthly";

    if (frequency === "Once" && bill.due < todayIso) {
      const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
      addItem({
        id: bill.id || `bill-${bill.due}`,
        kind: "bill",
        title: bill.name || t("bill"),
        date: bill.due,
        daysLeft: -overdueDays,
        categoryLabel: t("bill"),
        amount: bill.amount,
        currency: bill.currency,
        href: "#money/bills",
        overdue: true
      });
      return;
    }

    if (frequency === "Once" || bill.reminder === false || typeof recurringDatesInMonth !== "function") return;
    for (let monthOffset = 0; monthOffset <= 1; monthOffset += 1) {
      const cursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + monthOffset, 1);
      recurringDatesInMonth(bill.due, frequency, cursor)
        .filter(date => date >= todayIso && date <= limitIso)
        .forEach(date => {
          const due = parseAppDate(date);
          const daysLeft = Math.max(0, Math.round((due.getTime() - today.getTime()) / 86400000));
          addItem({
            id: bill.id || `bill-${bill.due}`,
            kind: "bill",
            title: bill.name || t("bill"),
            date,
            daysLeft,
            categoryLabel: t("bill"),
            amount: bill.amount,
            currency: bill.currency,
            href: "#money/bills",
            overdue: false
          });
        });
    }
  });

  const items = [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const nowClock = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
  const isOver = item => item.date === todayIso && item.time && String(item.time).slice(0, 5).padStart(5, "0") < nowClock;
  return {
    // "Today" counts only what is still ahead today
    today: items.filter(item => !item.overdue && item.date === todayIso && !isOver(item)).length,
    nextSevenDays: items.filter(item => !item.overdue && item.date > todayIso && item.date <= weekEndIso).length,
    overdueBills: items.filter(item => item.overdue).length,
    // hide today's timed items that are already over
    items: items.filter(item => !isOver(item)).slice(0, 5),
    allItems: items
  };
}

function renderHomeAgenda(agenda) {
  const itemIcon = item => item.kind === "bill" ? Icons.bill() : item.kind === "reminder" ? Icons.bell() : item.source === "family" ? Icons.family() : Icons.calendar();
  const whenLabel = item => item.overdue
    ? t("overdue")
    : item.daysLeft === 0
      ? t("today")
      : item.daysLeft === 1
        ? t("tomorrow")
        : t("inDays", { count: item.daysLeft });

  return '<section class="home-agenda-card" aria-labelledby="homeAgendaTitle">' +
    '<header class="home-agenda-header"><div><span class="home-agenda-eyebrow">' + escapeHtml(new Date().toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { weekday: "long", day: "numeric", month: "long" })) + '</span><h2 id="homeAgendaTitle">' + t("todayAndUpcoming") + '</h2></div><a class="home-agenda-view" href="#today">' + (languageCode() === "km" ? "មើលថ្ងៃនេះ" : "Open Today") + ' <span aria-hidden="true">›</span></a></header>' +
    '<div class="home-agenda-stats">' +
      '<div class="home-agenda-stat"><strong>' + agenda.today + '</strong><span>' + t("today") + '</span></div>' +
      '<div class="home-agenda-stat"><strong>' + agenda.nextSevenDays + '</strong><span>' + t("next7Days") + '</span></div>' +
      '<div class="home-agenda-stat home-agenda-stat-overdue"><strong>' + agenda.overdueBills + '</strong><span>' + t("overdueBills") + '</span></div>' +
    '</div>' +
    (agenda.items.length
      ? '<div class="home-agenda-list">' + agenda.items.slice(0, 4).map(item =>
          '<a class="home-agenda-item' + (item.overdue ? ' is-overdue' : '') + '" href="' + item.href + '">' +
            '<span class="home-agenda-item-icon" aria-hidden="true">' + itemIcon(item) + '</span>' +
            '<span class="home-agenda-item-copy"><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.categoryLabel) + (item.amount != null ? ' · ' + money(item.amount, item.currency) : '') + '</small></span>' +
            '<span class="home-agenda-item-date"><strong>' + whenLabel(item) + '</strong><small>' + escapeHtml(formatDate(item.date, { month: "short", day: "numeric" })) + '</small></span>' +
          '</a>'
        ).join("") + '</div>'
      : '<p class="home-agenda-empty">' + t("noUpcomingItems") + '</p>') +
  '</section>';
}

function renderHomeSmartLists(agenda, focusItems, todayIso) {
  const today = parseAppDate(todayIso);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const monthStart = `${todayIso.slice(0, 7)}-01`;
  const nextMonthLimit = new Date(today);
  nextMonthLimit.setDate(nextMonthLimit.getDate() + 30);
  const nextMonthLimitIso = localDashboardDate(nextMonthLimit);
  const upcomingItems = agenda.allItems.filter(item => !item.overdue && item.date >= todayIso && item.date <= localDashboardDate(weekEnd));
  const overdueBills = appData.bills.filter(bill => bill.status !== "Paid" && bill.due && bill.due < todayIso);
  const overdueReminders = appData.reminders.filter(reminder => !reminder.done && reminder.date && reminder.date < todayIso);
  const dueSoonGoals = appData.goals.filter(goal => {
    if (!goal.deadline || (Number(goal.targetAmount || 0) > 0 && Number(goal.currentAmount || 0) >= Number(goal.targetAmount || 0))) return false;
    return goal.deadline <= nextMonthLimitIso;
  });
  const attentionItems = [
    ...overdueBills.map(bill => ({ title: bill.name || t("bill"), detail: `${t("overdue")} · ${formatDate(bill.due, { month: "short", day: "numeric" })}`, href: "#money/bills" })),
    ...overdueReminders.map(reminder => ({ title: reminder.title || t("reminder"), detail: `${t("overdue")} · ${formatDate(reminder.date, { month: "short", day: "numeric" })}`, href: "#daily" })),
    ...dueSoonGoals.map(goal => ({ title: goal.name || t("goal"), detail: `${t("deadline")} · ${formatDate(goal.deadline, { month: "short", day: "numeric" })}`, href: `#goals/${goal.id}` }))
  ];
  const unpaidBills = appData.bills
    .filter(bill => bill.status !== "Paid")
    .slice()
    .sort((left, right) => String(left.due || "").localeCompare(String(right.due || "")));
  const billsDueSoon = unpaidBills.filter(bill => bill.due && bill.due >= todayIso && bill.due <= localDashboardDate(weekEnd));
  const todayEvents = appData.calendarEvents
    .filter(event => event.date === todayIso)
    .map(event => ({ title: event.title || t("calendarEvent"), detail: event.time ? fmtClock(event.time) : t("calendarEvent"), href: "#calendar" }));
  const todayReminders = appData.reminders
    .filter(reminder => !reminder.done && reminder.date === todayIso)
    .map(reminder => ({ title: reminder.title || t("reminder"), detail: reminder.time ? fmtClock(reminder.time) : t("reminder"), href: "#daily" }));
  const todayFocusItems = focusItems.map(item => ({
    title: item.text,
    detail: item.done ? t("completed") : t("dailyFocus"),
    href: "#daily"
  }));
  const incompleteToday = [
    ...focusItems.filter(item => !item.done).map(item => ({ title: item.text, detail: t("dailyFocus"), href: "#daily" })),
    ...todayReminders.map(item => ({ ...item, detail: t("reminder") }))
  ];
  const familyDates = getUpcomingNotifications(365, Infinity)
    .filter(item => item.source === "family")
    .slice(0, 5)
    .map(item => ({ title: item.title, detail: formatDate(item.date, { month: "short", day: "numeric" }), href: "#family" }));
  const monthExpenses = appData.expenses
    .filter(expense => expense.date && expense.date >= monthStart && expense.date <= todayIso)
    .slice()
    .sort((left, right) => String(right.date).localeCompare(String(left.date)));
  const spendingByCategory = new Map();
  monthExpenses.forEach(expense => {
    const category = expense.category || "Other";
    spendingByCategory.set(category, (spendingByCategory.get(category) || 0) + toProfileCurrency(expense.amount, expense.currency));
  });
  const categories = [...spendingByCategory.entries()].sort((left, right) => right[1] - left[1]);
  const recentExpenses = monthExpenses.slice(0, 3).map(expense => ({
    title: expense.description || t("expense"),
    detail: `${formatDate(expense.date, { month: "short", day: "numeric" })} · ${money(expense.amount, expense.currency)}`,
    href: "#money/expenses"
  }));
  const goalsToRevisit = appData.goals.filter(goal => {
    if (Number(goal.targetAmount || 0) > 0 && Number(goal.currentAmount || 0) >= Number(goal.targetAmount || 0)) return false;
    const contributionDate = (Array.isArray(goal.contributions) ? goal.contributions : [])
      .map(item => item.date)
      .filter(Boolean)
      .sort()
      .slice(-1)[0];
    const lastUpdate = contributionDate || (goal.updatedAt || goal.createdAt || "").slice(0, 10);
    const stale = lastUpdate && lastUpdate < localDashboardDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30));
    const approachingDeadline = goal.deadline && goal.deadline >= todayIso && goal.deadline <= nextMonthLimitIso;
    return Boolean(stale || approachingDeadline);
  }).slice(0, 5).map(goal => ({
    title: goal.name || t("goal"),
    detail: goal.deadline ? `${t("deadline")} · ${formatDate(goal.deadline, { month: "short", day: "numeric" })}` : t("goalsToRevisit"),
    href: `#goals/${goal.id}`
  }));

  const rowList = (items, emptyText = t("noUpcomingItems")) => items.length
    ? `<div class="home-smart-list-rows">${items.map(item => `<a class="home-smart-list-row" href="${escapeAttr(item.href)}"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.detail)}</small></a>`).join("")}</div>`
    : `<p class="home-smart-list-empty">${escapeHtml(emptyText)}</p>`;
  const listCard = (key, title, count, body, open = false) =>
    `<details class="home-smart-list" data-smart-list="${escapeAttr(key)}"${open ? " open" : ""}><summary><span>${escapeHtml(title)}</span><strong>${count}</strong></summary><div class="home-smart-list-content">${body}</div></details>`;
  const billRowsFor = bills => bills.length
    ? `<div class="home-smart-list-rows">${bills.slice(0, 6).map(bill => {
      const paid = billPaidCurrentCycle(bill);
      return `<div class="home-smart-list-row home-smart-bill-row"><a href="#money/bills"><span>${escapeHtml(bill.name || t("bill"))}</span><small>${bill.due ? escapeHtml(formatDate(bill.due, { month: "short", day: "numeric" })) : escapeHtml(t("dueDate"))} · ${money(bill.amount, bill.currency)}</small></a><button type="button" class="${paid ? "is-paid" : "is-unpaid"}" data-home-${paid ? "undo" : "mark"}-bill="${escapeAttr(bill.id)}" aria-pressed="${paid}">${paid ? Icons.check() : ""}${escapeHtml(paid ? t("billPaidLabel") : t("billUnpaidLabel"))}</button></div>`;
    }).join("")}</div>`
    : `<p class="home-smart-list-empty">${escapeHtml(t("noBillsYet"))}</p>`;
  const billRows = billRowsFor(unpaidBills);
  const billsDueSoonRows = billsDueSoon.length
    ? billRowsFor(billsDueSoon)
    : `<p class="home-smart-list-empty">${escapeHtml(t("noBillsDueSoon"))}</p>`;
  const spendingBody = monthExpenses.length
    ? `<div class="home-smart-spending-total"><span>${escapeHtml(t("monthlyExpenses"))}</span><strong>${escapeHtml(money(monthExpenses.reduce((sum, expense) => sum + toProfileCurrency(expense.amount, expense.currency), 0)))}</strong></div><div class="home-smart-category-list">${categories.slice(0, 4).map(([category, total]) => `<div><span>${escapeHtml(optionLabel(category))}</span><strong>${escapeHtml(money(total))}</strong></div>`).join("")}</div>${rowList(recentExpenses, t("noExpensesYet"))}<a class="home-smart-list-link" href="#money/expenses">${escapeHtml(t("expenses"))} ›</a>`
    : `<p class="home-smart-list-empty">${escapeHtml(t("noExpensesYet"))}</p>`;
  const quickCapture = `<div class="home-smart-capture-actions"><button type="button" data-action="add-event">${escapeHtml(t("addEvent"))}</button><button type="button" data-action="add-bill">${escapeHtml(t("addBill"))}</button><button type="button" data-action="add-expense">${escapeHtml(t("addExpense"))}</button><button type="button" data-action="add-reminder">${escapeHtml(t("addReminder"))}</button></div>`;
  const upcomingRows = upcomingItems.map(item => ({
    title: item.title,
    detail: `${item.categoryLabel} · ${formatDate(item.date, { month: "short", day: "numeric" })}`,
    href: item.href
  }));
  const smartCategories = [
    {
      id: "today",
      label: t("today"),
      icon: Icons.calendar(),
      count: new Set([
        ...attentionItems.map(item => `${item.href}:${item.title}`),
        ...upcomingItems.map(item => `${item.kind}:${item.id}:${item.date}`),
      ]).size,
      lists: [
        listCard("attention", t("needsAttention"), attentionItems.length, rowList(attentionItems, t("allCaughtUp")), attentionItems.length > 0),
        listCard("upcoming", t("comingUp"), upcomingItems.length, rowList(upcomingRows)),
        listCard("today", t("todaysPlan"), todayEvents.length + todayReminders.length, rowList([...todayEvents, ...todayReminders], t("noUpcomingItems"))),
        listCard("incomplete-today", t("incompleteToday"), incompleteToday.length, rowList(incompleteToday, t("noIncompleteToday")))
      ]
    },
    {
      id: "money",
      label: t("money"),
      icon: Icons.money(),
      count: unpaidBills.length + monthExpenses.length,
      lists: [
        listCard("unpaid", t("unpaidBills"), unpaidBills.length, billRows),
        listCard("due-soon", t("billsDueSoon"), billsDueSoon.length, billsDueSoonRows),
        listCard("spending", t("recentSpending"), monthExpenses.length, spendingBody)
      ]
    },
    {
      id: "goals",
      label: t("goals"),
      icon: Icons.goal(),
      count: goalsToRevisit.length,
      lists: [listCard("goals", t("goalsToRevisit"), goalsToRevisit.length, rowList(goalsToRevisit, t("noGoalsToRevisit")))]
    },
    {
      id: "family",
      label: t("family"),
      icon: Icons.family(),
      count: familyDates.length,
      lists: [listCard("family", t("familyDates"), familyDates.length, rowList(familyDates, t("noFamilyDates")))]
    }
  ];

  return `<section class="home-smart-lists" aria-labelledby="homeSmartListsTitle">
    <header class="home-smart-lists-heading"><h2 id="homeSmartListsTitle">${escapeHtml(t("smartLists"))}</h2></header>
    <div class="home-smart-category-nav" role="group" aria-label="${escapeAttr(t("smartLists"))}">
      ${smartCategories.map((category, index) => `<button class="home-smart-category${index === 0 ? " active" : ""}" type="button" data-smart-category="${category.id}" aria-controls="home-smart-panel-${category.id}" aria-pressed="${index === 0}">${category.icon}<span>${escapeHtml(category.label)}</span><strong>${category.count}</strong></button>`).join("")}
    </div>
    ${smartCategories.map((category, index) => `<div class="home-smart-list-grid" id="home-smart-panel-${category.id}" data-smart-panel="${category.id}"${index === 0 ? "" : " hidden"}>${category.lists.join("")}</div>`).join("")}
  </section>`;
}

function billPaidCurrentCycle(bill) {
  if (bill.status === "Paid") return true;
  if (!bill.lastPaidAt || !bill.due) return false;
  return bill.due > localDashboardDate(new Date());
}

function markBillPaid(billId) {
  const bill = appData.bills.find(item => item.id === billId);
  if (!bill || billPaidCurrentCycle(bill)) return;
  const frequency = bill.frequency || "Monthly";
  const paidOn = localDashboardDate(new Date());
  const nextBill = {
    status: "Paid",
    lastPaidAt: paidOn,
    lastPaidDue: bill.due || "",
    lastPaidStatus: bill.status || "Upcoming"
  };
  if (frequency !== "Once") {
    const dueDate = parseAppDate(bill.due);
    if (!Number.isNaN(dueDate.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      do {
        if (frequency === "Daily") dueDate.setDate(dueDate.getDate() + 1);
        else if (frequency === "Weekly") dueDate.setDate(dueDate.getDate() + 7);
        else {
          const months = frequency === "Quarterly" ? 3 : frequency === "Yearly" ? 12 : 1;
          const day = dueDate.getDate();
          dueDate.setDate(1);
          dueDate.setMonth(dueDate.getMonth() + months);
          dueDate.setDate(Math.min(day, new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()));
        }
      } while (dueDate <= today);
      nextBill.due = localDashboardDate(dueDate);
      nextBill.status = "Upcoming";
    }
  }
  // A paid bill is money spent: record it as an expense so it counts in
  // "left this month", budgets, category charts and the monthly report.
  const amount = Number(bill.amount || 0);
  if (amount > 0) {
    const existing = appData.expenses.find(item => item.billId === bill.id && item.date === paidOn);
    const expenseId = existing?.id || `expenses-bill-${bill.id}-${Date.now()}`;
    if (!existing) {
      Store.add("expenses", {
        id: expenseId,
        description: bill.name || t("bill"),
        amount,
        currency: bill.currency || appData.profile.currency || "USD",
        date: paidOn,
        category: "Bills",
        method: "",
        notes: t("bill"),
        billId: bill.id
      });
    }
    nextBill.lastPaidExpenseId = expenseId;
  }
  Store.edit("bills", bill.id, nextBill);
  Toast.show(t("paymentMarkedPaid"));
}

function markBillUnpaid(billId) {
  const bill = appData.bills.find(item => item.id === billId);
  if (!bill) return;
  const changes = {
    status: bill.lastPaidStatus || "Upcoming",
    lastPaidAt: "",
    lastPaidDue: "",
    lastPaidStatus: ""
  };
  if (bill.lastPaidDue) changes.due = bill.lastPaidDue;
  // undo: remove the expense that "paid" created
  if (bill.lastPaidExpenseId && appData.expenses.some(item => item.id === bill.lastPaidExpenseId)) Store.delete("expenses", bill.lastPaidExpenseId);
  changes.lastPaidExpenseId = "";
  Store.edit("bills", bill.id, changes);
  Toast.show(t("paymentMarkedUnpaid"));
}

function homeEmptyCard() {
  return `
    <article class="glass-card image-empty-card home-empty-card">
      <img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=78" alt="" loading="lazy">
      <div class="image-empty-content">
        <span class="icon-badge green">${Icons.home()}</span>
        <h2>${escapeHtml(t("nothingYet"))}</h2>
        <p class="secondary">${escapeHtml(t("emptyDashboard"))}</p>
        <button class="button" data-action="create-user">${Icons.plus()} ${t("createUser")}</button>
      </div>
    </article>
  `;
}

function homePhotoCard() {
  const image = getFamilyPhoto();
  const isKhmer = languageCode() === "km";
  const position = imagePosition(appData.profile.familyPhotoPosition);
  return `
    <article class="glass-card family-photo-card home-photo-card">
      <div class="family-photo-heading">
        <div><span class="eyebrow">${isKhmer ? "រូបថតគ្រួសារ" : "FAMILY PHOTO"}</span><h2>${isKhmer ? "រូបថតរបស់យើង" : "A photo of us"}</h2></div>
        <span class="icon-badge green">${Icons.memory()}</span>
      </div>
      <div class="family-photo-frame">
        ${image ? `<img src="${escapeAttr(image)}" style="--image-position-x: ${position.x}%; --image-position-y: ${position.y}%;" alt="${isKhmer ? "រូបថតគ្រួសារ" : "Family photo"}">` : `<img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=78" alt="" loading="lazy">`}
      </div>
      <label class="button family-photo-upload">${image ? (isKhmer ? "ប្តូររូបថត" : "Change photo") : (isKhmer ? "បន្ថែមរូបថត" : "Add photo")}<input type="file" accept="image/*" data-family-photo></label>
    </article>
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
  const hasTarget = typeof goalHasTarget === "function" ? goalHasTarget(goal) : Number(goal?.targetAmount || 0) > 0;
  const progress = pct(goal.currentAmount, goal.targetAmount);
  return `
    <div class="between"><strong>${goal.name}</strong><span class="pill">${hasTarget ? `${progress}%` : t("notSet")}</span></div>
    <div class="secondary">${hasTarget ? `${money(goal.currentAmount)} / ${money(goal.targetAmount)}` : `${t("target")}: ${t("notSet")}`}</div>
    ${hasTarget ? `<div class="progress-track"><div class="progress-fill" style="--progress:${progress}%"></div></div>` : ""}
  `;
}

function getTipsData() {
  return [
    {
      icon: Icons.home(), category: "HOME", title: "Our Home", khmerTitle: "ផ្ទះរបស់យើង",
      short: "Make home a place you both feel happy returning to.", khmerShort: "ធ្វើឱ្យផ្ទះក្លាយជាកន្លែងដែលយើងទាំងពីរសប្បាយចិត្តត្រឡប់មកវិញ។",
      quick: ["Help with housework", "Make the home comfortable", "Decide home matters together"],
      khmerQuick: ["ជួយគ្នាធ្វើការងារ", "រៀបចំផ្ទះឱ្យមានផាសុកភាព", "សម្រេចចិត្តរឿងផ្ទះជាមួយគ្នា"],
      detail: "Home is more than a building. It should be a safe, warm place for both partners.",
      khmerDetail: "ផ្ទះមិនមែនគ្រាន់តែជាអគារទេ។ វាជាកន្លែងដែលគូស្នេហ៍គួរមានអារម្មណ៍ថាមានសុវត្ថិភាព និងមានភាពកក់ក្តៅ។"
    },
    {
      icon: Icons.user(), category: "DAILY", title: "Small Love Every Day", khmerTitle: "ស្រឡាញ់រាល់ថ្ងៃ",
      short: "Love grows through small things done every day.", khmerShort: "ស្នេហាអាចចាប់ផ្តើមពីរឿងតូចៗដែលធ្វើជារៀងរាល់ថ្ងៃ។",
      quick: ["Ask how their day was", "Say thank you", "Help when they are tired"],
      khmerQuick: ["សួរគ្នាថ្ងៃនេះយ៉ាងម៉េច", "និយាយអរគុណ", "ជួយពេលម្នាក់ហត់"],
      detail: "Expensive gifts are not required. Consistent small care can mean more.",
      khmerDetail: "មិនចាំបាច់មានអំណោយថ្លៃៗទេ។ ការយកចិត្តទុកដាក់តូចៗដែលធ្វើជាប្រចាំ អាចមានន័យខ្លាំងជាង។"
    },
    {
      icon: Icons.family(), category: "DAILY", title: "Help Each Other", khmerTitle: "ជួយគ្នា",
      short: "Family responsibility belongs to both people.", khmerShort: "ការទទួលខុសត្រូវក្នុងគ្រួសារ គួរតែជារឿងរបស់មនុស្សពីរនាក់។",
      quick: ["Share housework", "Help when one is tired", "Do not keep score"],
      khmerQuick: ["ចែកការងារផ្ទះ", "ជួយពេលម្នាក់ហត់", "កុំរាប់ថាអ្នកណាធ្វើច្រើនជាង"],
      detail: "Balance is not always 50/50. Some days one person gives more, and other days the roles change.",
      khmerDetail: "Balance មិនមានន័យថា 50/50 រាល់ថ្ងៃទេ។ ថ្ងៃខ្លះម្នាក់អាចជួយបានច្រើនជាង ហើយថ្ងៃផ្សេងទៀតអាចប្តូរគ្នា។"
    },
    {
      icon: Icons.help(), category: "WEEKLY", title: "Our Time Together", khmerTitle: "ពេលវេលារបស់យើង",
      short: "Protect time for your relationship, not only responsibilities.", khmerShort: "កុំឱ្យការងារ និងបន្ទុកគ្រួសារធ្វើឱ្យភ្លេចភាពជាគូស្នេហ៍។",
      quick: ["Eat together", "Have coffee or watch a movie", "Take a small weekend trip"],
      khmerQuick: ["ញ៉ាំអាហារជាមួយគ្នា", "Coffee / Movie", "Weekend trip តូចៗ"],
      detail: "It does not need to cost much. What matters is choosing time to give each other.",
      khmerDetail: "មិនចាំបាច់ចំណាយលុយច្រើនទេ។ អ្វីសំខាន់គឺមានពេលដែលអ្នកទាំងពីរផ្តល់ឱ្យគ្នា។"
    },
    {
      icon: Icons.help(), category: "LOVE", title: "Talk to Each Other", khmerTitle: "និយាយគ្នា",
      short: "Small problems grow when they are left unspoken.", khmerShort: "បញ្ហាតូចៗអាចក្លាយជាបញ្ហាធំ បើមិននិយាយគ្នា។",
      quick: ["Listen before answering", "Say what is bothering you", "Solve it together"],
      khmerQuick: ["ស្តាប់មុនឆ្លើយ", "និយាយពីអ្វីដែលធ្វើឱ្យមិនសប្បាយ", "ដោះស្រាយជាមួយគ្នា"],
      detail: "Do not focus on winning an argument. Focus on solving the problem together. Try saying, \"We have a problem. How can we solve it together?\"",
      khmerDetail: "កុំផ្តោតលើការឈ្នះការឈ្លោះ។ ផ្តោតលើការដោះស្រាយបញ្ហា។ ជំនួសឱ្យពាក្យថា «អ្នកតែងតែ...» សាកនិយាយថា «យើងមានបញ្ហាមួយ។ តើយើងអាចដោះស្រាយជាមួយគ្នាយ៉ាងម៉េច?»"
    },
    {
      icon: Icons.money(), category: "MONEY", title: "Money and Home", khmerTitle: "លុយ និងផ្ទះ",
      short: "Manage money together to keep home life steady.", khmerShort: "គ្រប់គ្រងលុយជាមួយគ្នា ដើម្បីរក្សាផ្ទះឱ្យមានស្ថេរភាព។",
      quick: ["Know the monthly loan", "Plan monthly spending", "Avoid unnecessary debt"],
      khmerQuick: ["ដឹងចំនួន loan រាល់ខែ", "រៀបចំចំណាយប្រចាំខែ", "កុំបង្កើតបំណុលមិនចាំបាច់"],
      detail: "A home loan is a responsibility, but it supports the place where you live. Manage it without making daily life too stressful.",
      khmerDetail: "ប្រាក់កម្ចីផ្ទះគឺជាការទទួលខុសត្រូវ ប៉ុន្តែវាជាប្រាក់ដែលទៅលើកន្លែងរស់នៅរបស់យើង។ គោលដៅគឺគ្រប់គ្រងវាឱ្យបានល្អ ដោយមិនធ្វើឱ្យជីវិតប្រចាំថ្ងៃតានតឹងពេក។"
    },
    {
      icon: Icons.family(), category: "FAMILY", title: "Both Families", khmerTitle: "គ្រួសារទាំងសងខាង",
      short: "Respect the family that raised you and the family you are building.", khmerShort: "គោរពគ្រួសារដែលចិញ្ចឹមយើង និងគ្រួសារដែលយើងកំពុងបង្កើត។",
      quick: ["Respect parents", "Support your partner's family", "Make important decisions together"],
      khmerQuick: ["គោរពឪពុកម្តាយ", "គាំទ្រគ្រួសាររបស់ partner", "សម្រេចចិត្តសំខាន់ៗជាមួយគ្នា"],
      detail: "Marriage does not mean leaving an old family behind. A new family also needs care and protection.",
      khmerDetail: "ការរៀបការមិនមានន័យថាបោះបង់គ្រួសារចាស់ទេ។ ប៉ុន្តែគ្រួសារថ្មីក៏ត្រូវការការថែរក្សា និងការពារ។"
    },
    {
      icon: Icons.family(), category: "BALANCE", title: "Family Balance", khmerTitle: "Balance រវាងគ្រួសារ",
      short: "Balance does not mean everything must be 50/50.", khmerShort: "Balance មិនមែនមានន័យថាត្រូវស្មើគ្នា 50/50 រាល់ពេលទេ។",
      quick: ["Think about time", "Think about travel cost", "Adapt to the situation"],
      khmerQuick: ["គិតពីពេលវេលា", "គិតពីថ្លៃធ្វើដំណើរ", "សម្របតាមស្ថានភាព"],
      detail: "If visiting both sides in one day costs too much, split the visits across different days. The goal is respect without financial pressure.",
      khmerDetail: "បើមិនមានឡាន ហើយការទៅទាំងពីរខាងក្នុងថ្ងៃតែមួយចំណាយច្រើន អាចបែងថ្ងៃបាន។ គោលដៅគឺគោរពទាំងពីរខាង ដោយមិនបង្កើតសម្ពាធហិរញ្ញវត្ថុ។"
    },
    {
      icon: Icons.calendar(), category: "HOLIDAY", title: "Holidays", khmerTitle: "ថ្ងៃបុណ្យ",
      short: "Plan holidays together before visiting family.", khmerShort: "រៀបចំថ្ងៃបុណ្យជាមួយគ្នា មុនពេលទៅលេងគ្រួសារ។",
      quick: ["Plan the days early", "Think about travel", "Set a budget"],
      khmerQuick: ["រៀបចំថ្ងៃជាមុន", "គិតពីការធ្វើដំណើរ", "គិតពីថវិកា"],
      detail: "You can visit one family on one day and the other family on another day. It does not have to be perfectly equal.",
      khmerDetail: "អាចទៅគ្រួសារខាងមួយថ្ងៃ និងមួយខាងនៅថ្ងៃផ្សេង។ មិនចាំបាច់បង្ខំឱ្យស្មើគ្នាដាច់ខាតទេ។"
    },
    {
      icon: Icons.user(), category: "SELF", title: "Personal Time", khmerTitle: "ពេលវេលាផ្ទាល់ខ្លួន",
      short: "Living together still needs personal space.", khmerShort: "ការរស់នៅជាមួយគ្នា ក៏ត្រូវការពេលវេលាផ្ទាល់ខ្លួនដែរ។",
      quick: ["Keep a personal hobby", "See friends", "Make quiet time"],
      khmerQuick: ["មាន hobby ផ្ទាល់ខ្លួន", "ជួបមិត្តភក្តិ", "មានពេលស្ងប់ស្ងាត់"],
      detail: "Personal space does not mean less love. It can help both people feel comfortable and respected.",
      khmerDetail: "Personal space មិនមានន័យថាស្នេហាតិចទេ។ វាអាចជួយឱ្យមនុស្សពីរនាក់មានអារម្មណ៍ស្រួល និងគោរពគ្នា។"
    },
    {
      icon: Icons.family(), category: "FUTURE", title: "If You Have Children", khmerTitle: "បើមានកូន",
      short: "Do not let life become only work, children, money, and chores.", khmerShort: "កុំឱ្យជីវិតក្លាយជាការងារ + កូន + លុយ + ការងារផ្ទះប៉ុណ្ណោះ។",
      quick: ["Share childcare", "Help when one is tired", "Make time for each other"],
      khmerQuick: ["ចែកការងារថែទាំកូន", "ជួយគ្នាពេលហត់", "រកពេលសម្រាប់គ្នា"],
      detail: "Before becoming parents, you were partners. Keep caring for the relationship between you.",
      khmerDetail: "មុនពេលក្លាយជាឪពុកម្តាយ អ្នកទាំងពីរគឺជាគូស្នេហ៍។ កុំភ្លេចថែរក្សាទំនាក់ទំនងរបស់អ្នកទាំងពីរ។"
    },
    {
      icon: Icons.spark(), category: "MINDSET", title: "Social Media", khmerTitle: "Social Media",
      short: "Do not compare your life with what you see online.", khmerShort: "កុំយកជីវិតរបស់អ្នកទៅប្រៀបធៀបជាមួយអ្វីដែលឃើញ Online។",
      quick: ["Online is not the whole life", "Learn without assuming", "Do not predict your future from others"],
      khmerQuick: ["Social Media មិនមែនជាជីវិតទាំងមូល", "រៀនពីបញ្ហារបស់អ្នកដទៃ", "កុំសន្មត់ថារឿងដូចគ្នានឹងកើតលើយើង"],
      detail: "Social media often highlights conflict because it attracts attention. Quiet, healthy couples may simply post nothing.",
      khmerDetail: "Social Media ងាយបង្ហាញរឿង Divorce, Conflict និង Problems ព្រោះរឿងទាំងនេះទាក់ទាញការចាប់អារម្មណ៍។ គូស្នេហ៍ដែលរស់នៅធម្មតា និងសុខសាន្ត អាចមិន Post អ្វីទាំងអស់។"
    },
    {
      icon: Icons.user(), category: "LOVE", title: "When Your Partner Is Afraid", khmerTitle: "ពេល partner មានការភ័យ",
      short: "When love feels uncertain, show it through actions.", khmerShort: "បើ partner ខ្លាចថាស្នេហានឹងផ្លាស់ប្តូរ បង្ហាញតាមសកម្មភាព។",
      quick: ["Listen", "Help", "Spend time together"],
      khmerQuick: ["ស្តាប់", "ជួយ", "ចំណាយពេលជាមួយគ្នា"],
      detail: "Show love through help, listening, respect, keeping promises, and steady care, not words alone.",
      khmerDetail: "កុំត្រឹមតែនិយាយថា «ខ្ញុំស្រឡាញ់អ្នក»។ បង្ហាញតាមការជួយ ការស្តាប់ ការគោរព ការរក្សាពាក្យសន្យា និងការយកចិត្តទុកដាក់។"
    },
    {
      icon: Icons.home(), category: "FUTURE", title: "Build Life Together", khmerTitle: "សាងសង់ជីវិតជាមួយគ្នា",
      short: "You do not need a perfect life before building a family.", khmerShort: "មិនចាំបាច់មានជីវិត Perfect មុនពេលបង្កើតគ្រួសារទេ។",
      quick: ["Have a livable home", "Manage finances", "Learn to adapt"],
      khmerQuick: ["មានផ្ទះដែលអាចរស់នៅបាន", "គ្រប់គ្រងហិរញ្ញវត្ថុ", "រៀនសម្របគ្នា"],
      detail: "A family needs two people willing to listen, help, adapt, and build the future together.",
      khmerDetail: "គ្រួសារមិនត្រូវការជីវិត perfect ទេ។ វាត្រូវការមនុស្សពីរនាក់ដែលចង់ស្តាប់ ជួយគ្នា សម្របគ្នា និងសាងសង់អនាគតជាមួយគ្នា។"
    },
    {
      icon: Icons.help(), category: "LOVE", title: "Reset After a Disagreement", khmerTitle: "ស្តារភាពស្និទ្ធស្នាលក្រោយការមិនយល់គ្នា",
      short: "A disagreement does not have to become distance.", khmerShort: "ការមិនយល់គ្នាមិនចាំបាច់ធ្វើឱ្យយើងឃ្លាតឆ្ងាយពីគ្នាទេ។",
      quick: ["Take a calm pause", "Own your part", "Agree on one next step"],
      khmerQuick: ["សម្រាកបន្តិចដើម្បីស្ងប់ចិត្ត", "ទទួលស្គាល់ចំណែករបស់ខ្លួន", "ព្រមព្រៀងលើជំហានបន្ទាប់មួយ"],
      detail: "When both people are ready, return to the conversation gently. A sincere apology and one practical next step can help rebuild trust.",
      khmerDetail: "នៅពេលអ្នកទាំងពីរត្រៀមខ្លួន សូមត្រឡប់មកនិយាយគ្នាដោយស្ងប់ស្ងាត់។ ការសុំទោសដោយស្មោះ និងជំហានជាក់ស្តែងមួយ អាចជួយស្តារទំនុកចិត្តឡើងវិញ។"
    },
    {
      icon: Icons.spark(), category: "DAILY", title: "Notice the Good", khmerTitle: "សង្កេតឃើញអំពើល្អៗ",
      short: "Specific appreciation helps everyday care feel seen.", khmerShort: "ការកោតសរសើរដោយជាក់លាក់ធ្វើឱ្យការយកចិត្តទុកដាក់ប្រចាំថ្ងៃមានន័យ។",
      quick: ["Name what you appreciated", "Say thank you", "Notice effort, not only results"],
      khmerQuick: ["ប្រាប់ថាអ្នកកោតសរសើរអ្វី", "និយាយអរគុណ", "សង្កេតការខិតខំ មិនមែនតែលទ្ធផល"],
      detail: "Instead of a general compliment, mention the action that mattered to you. Feeling noticed can encourage both partners to keep showing care.",
      khmerDetail: "ជំនួសឱ្យការសរសើរទូទៅ សូមប្រាប់ពីសកម្មភាពដែលមានន័យចំពោះអ្នក។ ការមានអារម្មណ៍ថាត្រូវបានគេមើលឃើញ អាចជួយឱ្យអ្នកទាំងពីរបន្តយកចិត្តទុកដាក់គ្នា។"
    },
    {
      icon: Icons.calendar(), category: "WEEKLY", title: "Have a Weekly Check-In", khmerTitle: "ពិភាក្សាគ្នារៀងរាល់សប្តាហ៍",
      short: "A short check-in can prevent small worries from piling up.", khmerShort: "ការពិភាក្សាខ្លីៗអាចជួយកុំឱ្យកង្វល់តូចៗកើនឡើង។",
      quick: ["Ask what went well", "Share one concern", "Plan one thing together"],
      khmerQuick: ["សួរថាមានអ្វីល្អកើតឡើង", "ចែករំលែកកង្វល់មួយ", "រៀបចំរឿងមួយជាមួយគ្នា"],
      detail: "Choose a relaxed time and keep the conversation kind and practical. Listen to understand rather than trying to solve everything at once.",
      khmerDetail: "ជ្រើសរើសពេលដែលស្រួលចិត្ត ហើយនិយាយគ្នាដោយសប្បុរស និងជាក់ស្តែង។ ស្តាប់ដើម្បីយល់គ្នា មិនចាំបាច់ដោះស្រាយគ្រប់យ៉ាងក្នុងពេលតែមួយទេ។"
    }
  ];
}

function renderTips() {
  const groups = getTipsData();
  const isKhmer = languageCode() === "km";
  const selectedLang = isKhmer ? "km" : "en";
  const principles = getFamilyPrinciples();
  const dayIndex = Math.floor(Date.now() / 86400000) % groups.length;
  const tipOfDay = groups[dayIndex];
  const title = isKhmer ? "គន្លឹះ" : t("tips");
  const subtitle = isKhmer ? "រឿងតូចៗដែលជួយឱ្យជីវិតគ្រួសាររបស់យើងមានភាពកក់ក្តៅ និងរឹងមាំ។" : t("familyTipsIntro");
  const supporting = isKhmer ? "មិនចាំបាច់ល្អឥតខ្ចោះទេ — សាងសង់ជីវិតជាមួយគ្នា មួយថ្ងៃម្តង។ ❤️" : "You do not need to be perfect. Build life together, one day at a time. ❤️";
  const categoryLabels = ["ALL", "DAILY", "WEEKLY", "LOVE", "FAMILY", "MONEY", "FUTURE"];
  const filterCategory = group => ({ BALANCE: "FAMILY", HOLIDAY: "FAMILY", SELF: "LOVE", MINDSET: "LOVE" }[group.category] || group.category);
  const tipImages = [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1504159506876-f8338247a14a?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1504159506876-f8338247a14a?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=240&q=75"
  ];
  const coupleImage = getTipsCoupleImage();
  const text = group => ({
    title: selectedLang === "km" ? group.khmerTitle : group.title,
    short: selectedLang === "km" ? group.khmerShort : group.short,
    quick: selectedLang === "km" ? group.khmerQuick : group.quick,
    detail: selectedLang === "km" ? group.khmerDetail : group.detail
  });

  return `
    <section class="page tips-page">
      <div class="page-header tips-page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.help()}</span>${title}</h1>
          <p class="page-subtitle">${escapeHtml(subtitle)}</p>
          <p class="tips-supporting-line">${escapeHtml(supporting)}</p>
        </div>
      </div>

      <article class="glass-card tips-day-card">
        <div class="tips-day-icon">${Icons.spark()}</div>
        <div class="tips-day-copy">
          <span class="tips-eyebrow">${isKhmer ? "គន្លឹះប្រចាំថ្ងៃ" : "TIP OF THE DAY"}</span>
          <strong>${escapeHtml(text(tipOfDay).short)}</strong>
        </div>
        <button class="button ghost-button tips-day-button" type="button" data-tip-focus="${dayIndex}">${isKhmer ? "មើលគន្លឹះ" : "View tip"} ${Icons.chevron()}</button>
        <div class="tips-couple-photo-area">
          ${coupleImage ? `<img class="tips-couple-photo" src="${escapeAttr(coupleImage)}" alt="${isKhmer ? "រូបថតគូស្នេហ៍" : "Couple photo"}">` : `<span class="tips-couple-photo-empty">${Icons.family()}</span>`}
          <label class="tips-photo-upload">${coupleImage ? (isKhmer ? "ប្តូររូប" : "Change photo") : (isKhmer ? "បន្ថែមរូបគូស្នេហ៍" : "Add couple photo")}<input type="file" accept="image/*" data-couple-photo></label>
        </div>
      </article>

      <div class="tips-filter-row" role="toolbar" aria-label="${isKhmer ? "ច្រោះគន្លឹះ" : "Tip filters"}">
        ${categoryLabels.map((category, index) => `<button class="tips-filter ${index === 0 ? "active" : ""}" type="button" data-tip-filter="${category}">${category}</button>`).join("")}
      </div>

      <div class="tips-page-shell tips-card-grid">
        ${groups.map((group, index) => {
          const current = text(group);
          return `
            <details class="glass-card tips-compact-card" data-tip-card data-category="${filterCategory(group)}" data-tip-index="${index}">
              <summary>
                <span class="tips-compact-head">
                  <span class="tips-group-icon">${group.icon}</span>
                  <span class="tips-compact-meta"><span class="tips-eyebrow">${group.category}</span><strong>${escapeHtml(current.title)}</strong></span>
                </span>
                <img class="tips-compact-image" src="${tipImages[index]}" alt="" loading="lazy">
                <span class="tips-compact-chevron">${Icons.chevron()}</span>
              </summary>
              <div class="tips-compact-body">
                <p class="tips-short-description">${escapeHtml(current.short)}</p>
                <ul class="tips-quick-list">${current.quick.map(item => `<li><span>${Icons.check()}</span>${escapeHtml(item)}</li>`).join("")}</ul>
                <div class="tips-detail-copy"><strong>${isKhmer ? "លម្អិត" : "More"}</strong><p>${escapeHtml(current.detail)}</p></div>
                <button class="button ghost-button tips-close-detail" type="button">${isKhmer ? "បិទ" : "Close"}</button>
              </div>
              <span class="tips-more-label">${isKhmer ? "មើលបន្ថែម" : "View more"} ${Icons.chevron()}</span>
            </details>
          `;
        }).join("")}
      </div>

      <article class="glass-card tips-principles-card">
        <div class="tips-principles-header">
          <div><span class="tips-eyebrow">${isKhmer ? "គ្រួសាររបស់យើង" : "OUR FAMILY PRINCIPLES"}</span><h2>${isKhmer ? "គោលការណ៍របស់យើង" : "Our family principles"}</h2></div>
          <button class="icon-button" type="button" data-principles-edit aria-label="${isKhmer ? "កែប្រែ" : "Edit"}" title="${isKhmer ? "កែប្រែ" : "Edit"}">${Icons.edit()}</button>
        </div>
        <ul class="tips-principles-list">${principles.map(item => `<li><span>${Icons.check()}</span>${escapeHtml(item)}</li>`).join("")}</ul>
        <form class="tips-principles-form" data-principles-form hidden>
          <label for="principlesInput">${isKhmer ? "គោលការណ៍មួយក្នុងមួយបន្ទាត់" : "One principle per line"}</label>
          <textarea id="principlesInput" rows="6">${escapeHtml(principles.join("\n"))}</textarea>
          <div class="action-row"><button class="button" type="submit">${isKhmer ? "រក្សាទុក" : "Save"}</button><button class="button ghost-button" type="button" data-principles-cancel>${isKhmer ? "បោះបង់" : "Cancel"}</button></div>
        </form>
      </article>

      <p class="tips-final-note">${isKhmer ? "គ្រួសារដែលល្អ មិនមែនជាគ្រួសារដែលគ្មានបញ្ហាទេ។ វាគឺជាគ្រួសារដែលចេះស្តាប់ ជួយគ្នា សម្របគ្នា និងដោះស្រាយបញ្ហាជាមួយគ្នា។ ❤️" : "A good family is not a family without problems. It is a family that listens, helps, adapts, and solves problems together. ❤️"}</p>
    </section>
  `;
}

function getFamilyPrinciples() {
  const defaults = ["ជួយគ្នា", "និយាយគ្នា", "គោរពគ្រួសារទាំងសងខាង", "គ្រប់គ្រងលុយជាមួយគ្នា", "រកពេលសម្រាប់គ្នា", "សម្របគ្នាពេលមានបញ្ហា"];
  try {
    const saved = JSON.parse(localStorage.getItem("mylife:family-principles") || "null");
    return Array.isArray(saved) && saved.length ? saved : defaults;
  } catch (error) {
    return defaults;
  }
}

function getTipsCoupleImage() {
  return appData.profile.tipsCoupleImage || "";
}

function bindTips() {
  document.querySelectorAll("[data-tip-filter]").forEach(button => button.addEventListener("click", () => {
    const category = button.dataset.tipFilter;
    document.querySelectorAll("[data-tip-filter]").forEach(item => item.classList.toggle("active", item === button));
    document.querySelectorAll("[data-tip-card]").forEach(card => {
      card.hidden = category !== "ALL" && card.dataset.category !== category;
      if (card.hidden) card.open = false;
    });
  }));

  document.querySelectorAll(".tips-close-detail").forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    button.closest("details").open = false;
  }));

  document.querySelector("[data-tip-focus]")?.addEventListener("click", event => {
    const card = document.querySelector(`[data-tip-index="${event.currentTarget.dataset.tipFocus}"]`);
    if (!card) return;
    card.open = true;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.querySelector("[data-couple-photo]")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      const container = event.target.closest(".tips-day-card");
      if (container) {
        const editor = createImagePositionEditor({
          src: dataUrl,
          key: "tips-couple",
          title: languageCode() === "km" ? "លៃតម្រូវរូបគូស្នេហ៍" : "Adjust couple photo",
          onSave: position => {
            Store.updateProfile({ tipsCoupleImage: dataUrl, tipsCoupleImagePosition: position });
          },
          onCancel: () => {
            event.target.value = "";
          }
        });
        container.appendChild(editor);
      }
    } catch (error) {
      Toast.show(languageCode() === "km" ? "មិនអាចបញ្ចូលរូបភាពបានទេ" : "The image could not be uploaded.");
    }
  });

  const principlesForm = document.querySelector("[data-principles-form]");
  const principlesCard = document.querySelector(".tips-principles-card");
  document.querySelector("[data-principles-edit]")?.addEventListener("click", () => {
    principlesForm.hidden = false;
    principlesCard.querySelector(".tips-principles-list").hidden = true;
    principlesForm.querySelector("textarea").focus();
  });
  document.querySelector("[data-principles-cancel]")?.addEventListener("click", () => {
    principlesForm.hidden = true;
    principlesCard.querySelector(".tips-principles-list").hidden = false;
  });
  principlesForm?.addEventListener("submit", event => {
    event.preventDefault();
    const principles = principlesForm.querySelector("textarea").value.split("\n").map(item => item.trim()).filter(Boolean).slice(0, 10);
    if (!isGuestMode()) localStorage.setItem("mylife:family-principles", JSON.stringify(principles));
    App.render();
  });
}

function renderLegacyTips() {
  const groups = [
    {
      icon: Icons.home(),
      title: "Our Home",
      khmerTitle: "ផ្ទះរបស់យើង",
      items: [
        { enTitle: "Home is a safe place", kmTitle: "ផ្ទះគឺជាកន្លែងសម្រាប់សុវត្ថិភាព", enText: "A home is not only a building. It is a place where both partners feel safe, comfortable, respected, and supported.", kmText: "ផ្ទះមិនត្រឹមតែជាអគារទេ។ វាគឺជាកន្លែងដែលដៃគូទាំងពីររីករាយ សុវត្ថិភាព គោរព និងត្រូវបានគាំទ្រ។" },
        { enTitle: "Home habits", kmTitle: "ទម្លាប់ក្នុងផ្ទះ", enText: "Keep the home clean together, share responsibilities, make it comfortable, and make important decisions together.", kmText: "សម្អាតផ្ទះជាមួយគ្នា ចែករំលែកកិច្ចការទាន់ពេលវេលា និងធ្វើការសម្រេចចិត្តសំខាន់ជាមួយគ្នា។" }
      ]
    },
    {
      icon: Icons.user(),
      title: "Small Love Every Day",
      khmerTitle: "សេចក្តីស្រឡាញ់តូចៗរាល់ថ្ងៃ",
      items: [
        { enTitle: "Daily care matters", kmTitle: "ការថែទាំប្រចាំថ្ងៃមានค่า", enText: "Ask how the day was, say thank you, give a hug, help when tired, eat together, listen, and remember the little things that matter.", kmText: "សួរថាថ្ងៃនេះរបៀបណា សូមសរសើរ ឱបគ្នា ជួយពេលមានកម្លាំងតិច និយាយគ្នា និងចងចាំអ្វីដែលមានន័យ។" },
        { enTitle: "Small care is meaningful", kmTitle: "ការថែទាំតូចៗមានន័យ", enText: "Small care every day can be more meaningful than expensive gifts.", kmText: "ការថែទាំតូចៗរាល់ថ្ងៃអាចមានន័យច្រើនជាងការជូនរង្វាន់ដែលមានតម្លៃខ្ពស់។" }
      ]
    },
    {
      icon: Icons.family(),
      title: "Help Each Other",
      khmerTitle: "ជួយគ្នា",
      items: [
        { enTitle: "Shared responsibility", kmTitle: "ការទទួលខុសត្រូវរួម", enText: "Family responsibility should not belong to only one person. Help with housework, share cooking and cleaning, and appreciate what each person does.", kmText: "កិច្ចការក្នុងគ្រួសារមិនគួរតែត្រូវទទួលខុសត្រូវដោយម្នាក់ម្នាក់ទេ។ ជួយគ្នាក្នុងផ្ទះ ចែករំលែកការចម្អិន និងសម្អាត និងកោតសរសើរ។" },
        { enTitle: "No scorekeeping", kmTitle: "មិនត្រូវដាក់ពិន្ទុ", enText: "Do not keep score of who did more. Sometimes one person gives more and sometimes the other does. The goal is to support each other.", kmText: "កុំដាក់ពិន្ទុថាត្រូវបានលើកទឹកចិត្តកាន់តែច្រើន។ គោលដៅគឺជួយគ្នា និងគាំទ្រ។" }
      ]
    },
    {
      icon: Icons.help(),
      title: "Keep Our Relationship",
      khmerTitle: "រក្សាទំនាក់ទំនងរបស់យើង",
      items: [
        { enTitle: "Quality time", kmTitle: "ពេលវេលាដែលមានគុណភាព", enText: "Make time for each other through dinner together, movies, coffee, short trips, walks, and relaxing at home.", kmText: "រកពេលជាមួយគ្នា តាមរយៈអាហារពេលល្ងាច ខ្សែភាពយន្ត កាហ្វេ ធ្វើដំណើរ និងសម្រាកនៅផ្ទះ។" },
        { enTitle: "It does not need to be expensive", kmTitle: "មិនចាំបាច់មានតម្លៃខ្ពស់", enText: "Quality time matters more than money.", kmText: "ពេលវេលាដែលមានគុណភាពមានតម្លៃជាងប្រាក់។" }
      ]
    },
    {
      icon: Icons.help(),
      title: "Communication",
      khmerTitle: "ការនិយាយគ្នា",
      items: [
        { enTitle: "Talk early", kmTitle: "និយាយនៅពេលដំបូង", enText: "Talk when something is bothering you, ask if your partner needs help, and listen before judging.", kmText: "និយាយនៅពេលមានអារម្មណ៍មិនស្រួល សួរថាដៃគូនៅត្រូវការជួយដោយរបៀបណា និងស្តាប់មុនពេលវាយតម្លៃ។" },
        { enTitle: "Solve together", kmTitle: "ដោះស្រាយជាមួយគ្នា", enText: "Discuss problems instead of avoiding them, and focus on solving the issue, not winning the argument.", kmText: "ពិភាក្សាលើបញ្ហា ជំនួសឱ្យចៀសវាង ហើយផ្តោតលើការដោះស្រាយជាមួយគ្នា។" }
      ]
    },
    {
      icon: Icons.money(),
      title: "Money & House Loan",
      khmerTitle: "ហិរញ្ញវត្ថុ និងប្រាក់កម្ចីផ្ទះ",
      items: [
        { enTitle: "Plan responsibly", kmTitle: "គ្រោងការណ៍ដោយទំនួលខុសត្រូវ", enText: "Know the monthly payment, plan household expenses, save an emergency fund, avoid unnecessary debt, and discuss large expenses together.", kmText: "ដឹងពីការបង់ប្រាក់ប្រចាំខែ គ្រោងថវិកាក្នុងផ្ទះ ទុកប្រាក់បន្ទាន់បំផុត និងពិភាក្សាអំពីការចំណាយធំជាមួយគ្នា។" },
        { enTitle: "Respect the goal", kmTitle: "គោរពចំពោះគោលដៅ", enText: "The goal is not a perfect financial situation. The goal is to manage money together responsibly.", kmText: "គោលដៅមិនមែនជាស្ថានភាពហិរញ្ញវត្ថុដ៏ល្អឥតខ្ចោះទេទេ។ គោលដៅគឺគ្រប់គ្រងប្រាក់ដោយទំនួលខុសត្រូវ និងរួមគ្នា។" }
      ]
    }
  ];

  const isKhmer = languageCode() === "km";
  const selectedLang = isKhmer ? "km" : "en";

  return `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.help()}</span>${t("tips")}</h1>
          <p class="page-subtitle">${t("familyTipsIntro")}</p>
        </div>
      </div>

      <div class="tips-page-shell">
        ${groups.map(group => `
          <article class="glass-card tips-group-card">
            <div class="tips-group-head">
              <span class="tips-group-icon">${group.icon}</span>
              <div>
                <h2>${escapeHtml(isKhmer ? group.khmerTitle : group.title)}</h2>
                ${isKhmer ? "" : `<small>${escapeHtml(group.khmerTitle)}</small>`}
              </div>
            </div>
            <div class="tips-language-grid">
              <div class="tips-language-block ${isKhmer ? "khmer-block" : ""}">
                ${group.items.map(item => `
                  <div class="tips-item-block">
                    <strong>${escapeHtml(selectedLang === "en" ? item.enTitle : item.kmTitle)}</strong>
                    <p>${escapeHtml(selectedLang === "en" ? item.enText : item.kmText)}</p>
                  </div>
                `).join("")}
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function openTipsModal() {
  const groups = [
    {
      icon: Icons.home(),
      title: "Our Home",
      khmerTitle: "ផ្ទះរបស់យើង",
      items: [
        { enTitle: "Home is a safe place", kmTitle: "ផ្ទះគឺជាកន្លែងសម្រាប់សុវត្ថិភាព", enText: "A home is not only a building. It is a place where both partners feel safe, comfortable, respected, and supported.", kmText: "ផ្ទះមិនត្រឹមតែជាអគារទេ។ វាគឺជាកន្លែងដែលដៃគូទាំងពីររីករាយ សុវត្ថិភាព គោរព និងត្រូវបានគាំទ្រ។" },
        { enTitle: "Home habits", kmTitle: "ទម្លាប់ក្នុងផ្ទះ", enText: "Keep the home clean together, share responsibilities, make it comfortable, and make important decisions together.", kmText: "សម្អាតផ្ទះជាមួយគ្នា ចែករំលែកកិច្ចការទាន់ពេលវេលា និងធ្វើការសម្រេចចិត្តសំខាន់ជាមួយគ្នា។" }
      ]
    },
    {
      icon: Icons.user(),
      title: "Small Love Every Day",
      khmerTitle: "សេចក្តីស្រឡាញ់តូចៗរាល់ថ្ងៃ",
      items: [
        { enTitle: "Daily care matters", kmTitle: "ការថែទាំប្រចាំថ្ងៃមានค่า", enText: "Ask how the day was, say thank you, give a hug, help when tired, eat together, listen, and remember the little things that matter.", kmText: "សួរថាថ្ងៃនេះរបៀបណា សូមសរសើរ ឱបគ្នា ជួយពេលមានកម្លាំងតិច និយាយគ្នា និងចងចាំអ្វីដែលមានន័យ។" },
        { enTitle: "Small care is meaningful", kmTitle: "ការថែទាំតូចៗមានន័យ", enText: "Small care every day can be more meaningful than expensive gifts.", kmText: "ការថែទាំតូចៗរាល់ថ្ងៃអាចមានន័យច្រើនជាងការជូនរង្វាន់ដែលមានតម្លៃខ្ពស់។" }
      ]
    },
    {
      icon: Icons.family(),
      title: "Help Each Other",
      khmerTitle: "ជួយគ្នា",
      items: [
        { enTitle: "Shared responsibility", kmTitle: "ការទទួលខុសត្រូវរួម", enText: "Family responsibility should not belong to only one person. Help with housework, share cooking and cleaning, and appreciate what each person does.", kmText: "កិច្ចការក្នុងគ្រួសារមិនគួរតែត្រូវទទួលខុសត្រូវដោយម្នាក់ម្នាក់ទេ។ ជួយគ្នាក្នុងផ្ទះ ចែករំលែកការចម្អិន និងសម្អាត និងកោតសរសើរ។" },
        { enTitle: "No scorekeeping", kmTitle: "មិនត្រូវដាក់ពិន្ទុ", enText: "Do not keep score of who did more. Sometimes one person gives more and sometimes the other does. The goal is to support each other.", kmText: "កុំដាក់ពិន្ទុថាត្រូវបានលើកទឹកចិត្តកាន់តែច្រើន។ គោលដៅគឺជួយគ្នា និងគាំទ្រ។" }
      ]
    },
    {
      icon: Icons.help(),
      title: "Keep Our Relationship",
      khmerTitle: "រក្សាទំនាក់ទំនងរបស់យើង",
      items: [
        { enTitle: "Quality time", kmTitle: "ពេលវេលាដែលមានគុណភាព", enText: "Make time for each other through dinner together, movies, coffee, short trips, walks, and relaxing at home.", kmText: "រកពេលជាមួយគ្នា តាមរយៈអាហារពេលល្ងាច ខ្សែភាពយន្ត កាហ្វេ ធ្វើដំណើរ និងសម្រាកនៅផ្ទះ។" },
        { enTitle: "It does not need to be expensive", kmTitle: "មិនចាំបាច់មានតម្លៃខ្ពស់", enText: "Quality time matters more than money.", kmText: "ពេលវេលាដែលមានគុណភាពមានតម្លៃជាងប្រាក់។" }
      ]
    },
    {
      icon: Icons.help(),
      title: "Communication",
      khmerTitle: "ការនិយាយគ្នា",
      items: [
        { enTitle: "Talk early", kmTitle: "និយាយនៅពេលដំបូង", enText: "Talk when something is bothering you, ask if your partner needs help, and listen before judging.", kmText: "និយាយនៅពេលមានអារម្មណ៍មិនស្រួល សួរថាដៃគូនៅត្រូវការជួយដោយរបៀបណា និងស្តាប់មុនពេលវាយតម្លៃ។" },
        { enTitle: "Solve together", kmTitle: "ដោះស្រាយជាមួយគ្នា", enText: "Discuss problems instead of avoiding them, and focus on solving the issue, not winning the argument.", kmText: "ពិភាក្សាលើបញ្ហា ជំនួសឱ្យចៀសវាង ហើយផ្តោតលើការដោះស្រាយជាមួយគ្នា។" }
      ]
    },
    {
      icon: Icons.money(),
      title: "Money & House Loan",
      khmerTitle: "ហិរញ្ញវត្ថុ និងប្រាក់កម្ចីផ្ទះ",
      items: [
        { enTitle: "Plan responsibly", kmTitle: "គ្រោងការណ៍ដោយទំនួលខុសត្រូវ", enText: "Know the monthly payment, plan household expenses, save an emergency fund, avoid unnecessary debt, and discuss large expenses together.", kmText: "ដឹងពីការបង់ប្រាក់ប្រចាំខែ គ្រោងថវិកាក្នុងផ្ទះ ទុកប្រាក់បន្ទាន់បំផុត និងពិភាក្សាអំពីការចំណាយធំជាមួយគ្នា។" },
        { enTitle: "Respect the goal", kmTitle: "គោរពចំពោះគោលដៅ", enText: "The goal is not a perfect financial situation. The goal is to manage money together responsibly.", kmText: "គោលដៅមិនមែនជាស្ថានភាពហិរញ្ញវត្ថុដ៏ល្អឥតខ្ចោះទេទេ។ គោលដៅគឺគ្រប់គ្រងប្រាក់ដោយទំនួលខុសត្រូវ និងរួមគ្នា។" }
      ]
    }
  ];

  const isKhmer = languageCode() === "km";
  const selectedLang = isKhmer ? "km" : "en";
  const selectedLabel = isKhmer ? "Khmer" : "English";
  const selectedBadge = isKhmer ? "KH" : "EN";

  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal glass-card modal-wide tips-modal" aria-modal="true" role="dialog" aria-labelledby="tipsTitle">
      <div class="tips-modal-header">
        <div class="tips-modal-title-wrap">
          <span class="tips-modal-badge">${Icons.help()}</span>
          <div>
            <h2 id="tipsTitle">${isKhmer ? "គន្លឹះជីវិតគ្រួសារ" : "Family Life Tips"}</h2>
            <p class="secondary tips-modal-subtitle">${isKhmer ? "Family Life Tips" : "គន្លឹះជីវិតគ្រួសារ"}</p>
          </div>
        </div>
        <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
      </div>

      <div class="tips-accordion">
        ${groups.map((group, index) => `
          <div class="tips-group ${index === 0 ? "active" : ""}">
            <button class="tips-group-toggle" type="button" aria-expanded="${index === 0 ? "true" : "false"}">
              <span class="tips-group-icon">${group.icon}</span>
              <span class="tips-group-copy">
                <strong>${escapeHtml(group.title)}</strong>
                <small>${escapeHtml(group.khmerTitle)}</small>
              </span>
              <span class="tips-chevron">${Icons.chevron()}</span>
            </button>
            <div class="tips-group-panel" ${index === 0 ? "style=\"display:block\"" : ""}>
              <div class="tips-language-grid">
                <div class="tips-language-block ${isKhmer ? "khmer-block" : ""}">
                  <div class="tips-language-label"><span>${selectedBadge}</span> ${selectedLabel}</div>
                  ${group.items.map(item => `
                    <div class="tips-item-block">
                      <strong>${escapeHtml(selectedLang === "en" ? item.enTitle : item.kmTitle)}</strong>
                      <p>${escapeHtml(selectedLang === "en" ? item.enText : item.kmText)}</p>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="between tips-modal-actions">
        <button class="button ghost-button" type="button" data-close>Close</button>
      </div>
    </div>
  `;
  root.classList.add("open");

  root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
    root.classList.remove("open");
    root.innerHTML = "";
  }));

  root.querySelectorAll(".tips-group-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const group = button.closest(".tips-group");
      const panel = group.querySelector(".tips-group-panel");
      const isOpen = group.classList.contains("active");
      root.querySelectorAll(".tips-group").forEach(item => {
        item.classList.remove("active");
        item.querySelector(".tips-group-toggle").setAttribute("aria-expanded", "false");
        item.querySelector(".tips-group-panel").style.display = "none";
      });
      if (!isOpen) {
        group.classList.add("active");
        button.setAttribute("aria-expanded", "true");
        panel.style.display = "block";
      }
    });
  });
}

function bindHome() {
  if (typeof bindFamily === "function") bindFamily({ mediaOnly: true });
  document.querySelector("[data-home-challenge-image]")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      const card = event.target.closest(".home-challenge-card");
      if (!card) return;

      card.querySelector(".image-position-preview")?.remove();
      card.appendChild(createImagePositionEditor({
        src: dataUrl,
        key: "home-challenge",
        title: languageCode() === "km" ? "អូសរូបភាពដើម្បីលៃតម្រូវ" : "Drag to adjust your card image",
        onSave: position => {
          Store.updateProfile({ launcherCover: dataUrl, launcherCoverPosition: position });
          Toast.show(languageCode() === "km" ? "បានធ្វើបច្ចុប្បន្នភាពរូបភាពកាត" : "Focus card image updated");
        },
        onCancel: () => {
          event.target.value = "";
        }
      }));
    } catch (error) {
      Toast.show(languageCode() === "km" ? "មិនអាចបញ្ចូលរូបភាពបានទេ" : "The card image could not be uploaded.", "danger");
    }
  });
  document.querySelector("[data-family-photo]")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      Store.updateProfile({ familyPhoto: dataUrl, familyPhotoPosition: { x: 0, y: 0 } });
    } catch (error) {
      Toast.show(languageCode() === "km" ? "មិនអាចបញ្ចូលរូបថតបានទេ" : "The photo could not be uploaded.");
    }
  });

  document.querySelectorAll("[data-reflection-textarea]").forEach(textarea => {
    textarea.addEventListener("input", event => {
      Store.updateDailyReflection(event.target.value);
    });
    textarea.addEventListener("blur", event => {
      if (!event.target.value.trim()) {
        Store.updateDailyReflection("");
      }
    });
  });

  document.querySelectorAll("[data-focus-id]").forEach(input => {
    input.addEventListener("change", event => {
      const items = (appData.dailyFocus?.date === localDateInput() && Array.isArray(appData.dailyFocus.items) && appData.dailyFocus.items.length
        ? appData.dailyFocus.items
        : [
            { id: "focus-move", text: t("moveMyBody"), done: false },
            { id: "focus-water", text: t("drinkWater"), done: false },
            { id: "focus-family", text: t("checkInWithFamily"), done: false }
          ]).map(item => item.id === event.target.dataset.focusId ? { ...item, done: event.target.checked } : item);
      Store.updateDailyFocus(items);
    });
  });

  document.querySelectorAll('[data-action="save-reflection"]').forEach(button => {
    button.addEventListener("click", () => {
      const textarea = document.querySelector("[data-reflection-textarea]");
      if (!textarea) return;
      Store.updateDailyReflection(textarea.value);
      Toast.show(t("reflectionSaved") || "Reflection saved");
    });
  });

  document.querySelectorAll('[data-action="edit-focus"]').forEach(button => {
    button.addEventListener("click", () => {
      const focusList = document.querySelector(".focus-list");
      if (!focusList) return;
      focusList.scrollIntoView({ behavior: "smooth", block: "center" });
      focusList.querySelectorAll("input[type='checkbox']").forEach(input => input.focus());
    });
  });

  bindHomeActions();
}

function bindHomeActions({ bindProfile = true } = {}) {
  document.querySelectorAll('[data-action="add-event"]').forEach(button => button.addEventListener("click", () => App.openEventModal()));
  document.querySelectorAll('[data-action="smart-assistant"]').forEach(button => button.addEventListener("click", () => SmartAssistant.open()));
  document.querySelectorAll('[data-action="create-user"]').forEach(button => button.addEventListener("click", () => openCreateUserModal()));
  document.querySelectorAll('[data-action="add-goal"]').forEach(button => button.addEventListener("click", () => openGoalModal()));
  document.querySelectorAll('[data-action="add-expense"]').forEach(button => button.addEventListener("click", () => openExpenseModal()));
  document.querySelectorAll('[data-action="add-bill"]').forEach(button => button.addEventListener("click", () => openBillModal()));
  document.querySelectorAll('[data-action="add-reminder"]').forEach(button => button.addEventListener("click", () => App.openReminderModal()));
  document.querySelectorAll("[data-home-mark-bill]").forEach(button => button.addEventListener("click", () => markBillPaid(button.dataset.homeMarkBill)));
  document.querySelectorAll("[data-home-undo-bill]").forEach(button => button.addEventListener("click", () => markBillUnpaid(button.dataset.homeUndoBill)));
  document.querySelectorAll("[data-smart-category]").forEach(button => button.addEventListener("click", () => {
    const selectedCategory = button.dataset.smartCategory;
    document.querySelectorAll("[data-smart-category]").forEach(categoryButton => {
      const isSelected = categoryButton === button;
      categoryButton.classList.toggle("active", isSelected);
      categoryButton.setAttribute("aria-pressed", String(isSelected));
    });
    document.querySelectorAll("[data-smart-panel]").forEach(panel => {
      panel.hidden = panel.dataset.smartPanel !== selectedCategory;
    });
  }));
  document.querySelector("[data-toggle-smart-capture]")?.addEventListener("click", event => {
    const button = event.currentTarget;
    const panel = document.querySelector("[data-smart-capture-panel]");
    if (!panel) return;
    const isExpanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!isExpanded));
    panel.hidden = isExpanded;
  });
  if (bindProfile) {
    document.querySelectorAll('[data-account-action]').forEach(button => {
      button.addEventListener("click", async event => {
        event.stopPropagation();
        const action = button.dataset.accountAction;
        if (action === "edit-profile") {
          openProfileModal();
          document.querySelector(".home-profile-side")?.classList.remove("menu-open");
          return;
        }
        if (action === "logout") {
          await Login.logout();
          App.render();
          return;
        }
        Login.open();
      });
    });
    document.querySelectorAll('.home-profile-side').forEach(button => {
      button.addEventListener("click", event => {
        if (event.target.closest('[data-account-action]')) return;
        button.classList.toggle("menu-open");
      });
      button.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          button.classList.toggle("menu-open");
        }
      });
    });

    document.addEventListener("click", event => {
      if (!event.target.closest(".home-profile-side")) {
        document.querySelectorAll(".home-profile-side").forEach(panel => panel.classList.remove("menu-open"));
      }
    });
  }
}

function homeGreeting() {
  const hour = new Date().getHours();
  if (languageCode() === "km") return hour < 12 ? "អរុណសួស្តី" : hour < 17 ? "ទិវាសួស្តី" : "សាយណ្ហសួស្តី";
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
