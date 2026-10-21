/* MYLIFE "Today" page (#today): one screen with what's next, today's
 * timeline, overdue bills, money left, quick expense and the week ahead. */

function todayKm() {
  return languageCode() === "km";
}

function todayToneColor(key) {
  return (typeof CALENDAR_TONES !== "undefined" && CALENDAR_TONES[key]?.color) || "#5aa9ff";
}

function todayDayEntries(day) {
  const entries = [];
  const dayDate = new Date(`${day}T00:00:00`);

  appData.calendarEvents.forEach(event => {
    if (event.date !== day) return;
    const tone = typeof calendarTone === "function" ? calendarTone({ ...event, source: "event" }) : "personal";
    entries.push({ kind: "event", tone, icon: typeof agendaIcon === "function" ? agendaIcon({ ...event, source: "event" }) : Icons.calendar(), title: event.title, time: event.time || "", sub: optionLabel(event.category || "Personal"), id: event.id, action: "edit" });
  });

  appData.reminders.forEach(reminder => {
    if (reminder.done || reminder.date !== day) return;
    entries.push({ kind: "reminder", tone: "reminder", icon: Icons.bell(), title: reminder.title, time: reminder.time || "", sub: t("reminder"), id: reminder.id, action: "done" });
  });

  appData.bills.forEach(bill => {
    if (!bill.due) return;
    const due = (bill.status !== "Paid" && bill.due === day) || (typeof billCycleDates === "function" && billCycleDates(bill, day, day).length > 0 && !(bill.status === "Paid" && bill.due === day));
    if (!due) return;
    const paid = typeof billPaidCurrentCycle === "function" && billPaidCurrentCycle(bill) && bill.due > day;
    entries.push({ kind: "bill", tone: "bill", icon: Icons.bill(), title: bill.name, time: "", sub: t("bill"), amount: money(bill.amount, bill.currency), id: bill.id, action: paid ? "" : "paid", paid });
  });

  appData.loans.forEach(loan => {
    if (typeof loanPaymentDatesInMonth !== "function") return;
    if (!loanPaymentDatesInMonth(loan, dayDate).includes(day)) return;
    const paid = (loan.payments || []).some(payment => payment.date === day);
    entries.push({ kind: "loan", tone: "loan", icon: Icons.loan(), title: loan.name, time: "", sub: t("loan"), amount: money(loan.monthlyPayment, loan.currency), href: "#money/loans", paid });
  });

  appData.family.forEach(member => {
    [["birthday", member.birthday, Icons.cake()], ["anniversary", member.anniversaryDate, Icons.heart()]].forEach(([type, value, icon]) => {
      if (!value) return;
      const next = nextYearlyDate(value, dayDate);
      if (!next || calendarDateInput(next) !== day) return;
      const years = next.getFullYear() - new Date(`${value}T00:00:00`).getFullYear();
      if (type === "anniversary" && years <= 0) return;
      entries.push({ kind: type, tone: "family", icon, title: `${t(type)}: ${member.name}`, time: "", sub: years > 0 ? (todayKm() ? `${years} ឆ្នាំ` : `${years} years`) : "", href: "#family" });
    });
  });

  return entries.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function todayOverdueBills(today) {
  return appData.bills
    .filter(bill => bill.reminder !== false && bill.due && bill.due < today && bill.status !== "Paid" && !(typeof billPaidCurrentCycle === "function" && billPaidCurrentCycle(bill)))
    .map(bill => ({ kind: "bill", tone: "loan", icon: Icons.bill(), title: bill.name, sub: `${todayKm() ? "ហួសថ្ងៃ" : "Due"} ${formatDate(bill.due, { month: "short", day: "numeric" })}`, amount: money(bill.amount, bill.currency), id: bill.id, action: "paid" }));
}

function todayClock(time) {
  if (!time) return todayKm() ? "ពេញថ្ងៃ" : "All day";
  return fmtClock(time);
  const [h, m] = time.split(":").map(Number);
  const h12 = h % 12 || 12;
  if (todayKm()) return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "ព្រឹក" : h < 17 ? "រសៀល" : "ល្ងាច"}`;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function todayCountdown(time) {
  const [h, m] = time.split(":").map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const minutes = Math.max(0, Math.round((target - new Date()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (todayKm()) return hours ? `ក្នុង ${hours} ម៉ោង ${rest} នាទីទៀត` : `ក្នុង ${rest} នាទីទៀត`;
  return hours ? `in ${hours}h ${rest}m` : `in ${rest} min`;
}

function todayRow(entry, { past = false, next = false } = {}) {
  const action = entry.action === "paid"
    ? `<button class="td-act td-act-done" type="button" data-td-paid="${escapeAttr(entry.id)}">${Icons.check()}<span>${todayKm() ? "បង់រួច" : "Paid"}</span></button>`
    : entry.action === "done"
      ? `<button class="td-act td-act-done" type="button" data-td-done="${escapeAttr(entry.id)}">${Icons.check()}<span>${todayKm() ? "រួច" : "Done"}</span></button>`
      : entry.action === "edit"
        ? `<button class="icon-button td-act-icon" type="button" data-edit-event="${escapeAttr(entry.id)}" aria-label="${escapeAttr(t("editEvent"))}">${Icons.edit()}</button>`
        : entry.href ? `<a class="icon-button td-act-icon" href="${entry.href}" aria-label="${escapeAttr(t("view"))}">${Icons.chevron()}</a>` : "";
  return `<div class="td-row ${past ? "is-past" : ""} ${next ? "is-next" : ""} ${entry.paid ? "is-paid" : ""}" style="--tone:${todayToneColor(entry.tone)}">
    <span class="td-time">${escapeHtml(todayClock(entry.time))}</span>
    <span class="td-icon">${entry.icon}</span>
    <div class="td-copy"><strong>${escapeHtml(entry.title || "")}</strong>${entry.sub ? `<small>${escapeHtml(entry.sub)}</small>` : ""}</div>
    ${entry.amount ? `<span class="td-amount">${entry.amount}</span>` : ""}
    ${action}
  </div>`;
}

function renderToday() {
  const isKm = todayKm();
  const today = localDateInput();
  const tomorrowDate = new Date(`${today}T00:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = localDateInput(tomorrowDate);
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const entries = todayDayEntries(today);
  const overdue = todayOverdueBills(today);
  const tomorrowEntries = todayDayEntries(tomorrow);
  const next = entries.find(entry => entry.time && entry.time >= nowTime && !entry.paid);
  const hour = now.getHours();
  const greeting = isKm
    ? (hour < 12 ? "អរុណសួស្តី" : hour < 17 ? "ទិវាសួស្តី" : "សាយណ្ហសួស្តី")
    : (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  const name = appData.profile.name ? `, ${appData.profile.name}` : "";
  const kmDays = ["អាទិត្យ", "ចន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
  const kmMonths = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const dateLabel = isKm
    ? `ថ្ងៃ${kmDays[now.getDay()]} ${now.getDate()} ${kmMonths[now.getMonth()]} ${now.getFullYear()}`
    : now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  const stats = Store.calculate();
  // same "left this month" number as the Money page
  if (typeof moneyMonthNumbers === "function") stats.available = moneyMonthNumbers().left;
  const spentToday = sumMoney(appData.expenses.filter(item => item.date === today), "amount");
  const nearBudgets = typeof SmartMoney !== "undefined"
    ? expenseCategories.map(category => ({ category, ...SmartMoney.budgetStatus(category) })).filter(row => row.budget && row.percent >= 80)
    : [];

  const upcoming = getUpcomingNotifications(7, 8).filter(item => item.date > tomorrow);

  return `<section class="page today-page">
    <header class="td-hero">
      <div>
        <span class="eyebrow">${escapeHtml(dateLabel)}</span>
        <h1 class="page-title">${escapeHtml(greeting + name)} ${hour < 17 ? "☀️" : "🌙"}</h1>
        <div class="td-chips">
          <span class="td-chip">📋 ${entries.length} ${isKm ? "ថ្ងៃនេះ" : "today"}</span>
          ${overdue.length ? `<span class="td-chip td-chip-warn">⚠️ ${overdue.length} ${isKm ? "ហួសថ្ងៃ" : "overdue"}</span>` : ""}
          <span class="td-chip ${stats.available < 0 ? "td-chip-warn" : "td-chip-ok"}">💰 ${stats.available < 0 ? `${isKm ? "ចាយលើស" : "Over by"} ${money(-stats.available)}` : `${money(stats.available)} ${isKm ? "អាចចាយ" : "left"}`}</span>
        </div>
      </div>
      <button class="button" type="button" data-td-add-event>${Icons.plus()} ${t("addEvent")}</button>
    </header>

    <div class="td-grid">
      <div class="td-main">
        ${next ? `<article class="glass-card td-next" style="--tone:${todayToneColor(next.tone)}">
          <span class="td-next-label">${isKm ? "បន្ទាប់" : "Up next"} · ${escapeHtml(todayCountdown(next.time))}</span>
          <div class="td-next-body">
            <span class="td-next-icon">${next.icon}</span>
            <div><strong>${escapeHtml(next.title)}</strong><small>${escapeHtml(todayClock(next.time))}${next.sub ? ` · ${escapeHtml(next.sub)}` : ""}</small></div>
          </div>
        </article>` : ""}

        <article class="glass-card card-pad td-card">
          <div class="td-card-head"><h2 class="section-title">${isKm ? "កាលវិភាគថ្ងៃនេះ" : "Today's schedule"}</h2><span class="pill">${entries.length}</span></div>
          ${entries.length
            ? `<div class="td-list">${entries.map(entry => todayRow(entry, { past: entry.time && entry.time < nowTime, next: entry === next })).join("")}</div>`
            : `<div class="td-empty">🌿 ${isKm ? "ថ្ងៃនេះទំនេរ — សម្រាកឱ្យបានល្អ!" : "Nothing scheduled — enjoy your day!"}</div>`}
        </article>

        ${overdue.length ? `<article class="glass-card card-pad td-card td-overdue">
          <div class="td-card-head"><h2 class="section-title">⚠️ ${isKm ? "មិនទាន់បង់" : "Overdue"}</h2><span class="pill">${overdue.length}</span></div>
          <div class="td-list">${overdue.map(entry => todayRow(entry)).join("")}</div>
        </article>` : ""}

        <article class="glass-card card-pad td-card">
          <div class="td-card-head"><h2 class="section-title">🔜 ${isKm ? "ស្អែក" : "Tomorrow"}</h2><span class="pill">${tomorrowEntries.length}</span></div>
          ${tomorrowEntries.length
            ? `<div class="td-list">${tomorrowEntries.map(entry => todayRow({ ...entry, action: entry.action === "edit" ? "edit" : "" })).join("")}</div>`
            : `<div class="td-empty">${isKm ? "មិនទាន់មានអ្វីសម្រាប់ស្អែកទេ" : "Nothing planned for tomorrow yet"}</div>`}
        </article>
      </div>

      <aside class="td-side">
        ${typeof NotifyCenter !== "undefined" ? NotifyCenter.renderTodayCard() : ""}
        <article class="glass-card card-pad td-card td-money">
          <div class="td-card-head"><h2 class="section-title">💰 ${isKm ? "លុយថ្ងៃនេះ" : "Money today"}</h2><a class="td-link" href="#money">${t("view")} ${Icons.chevron()}</a></div>
          <div class="td-money-grid">
            <div><span>${isKm ? "ចាយថ្ងៃនេះ" : "Spent today"}</span><strong>${money(spentToday)}</strong></div>
            <div class="${stats.available < 0 ? "is-bad" : "is-good"}"><span>${isKm ? "អាចចាយខែនេះ" : "Left this month"}</span><strong>${money(stats.available)}</strong></div>
          </div>
          ${nearBudgets.length ? `<div class="td-budgets">${nearBudgets.map(row => `<a href="#money/budget" class="td-budget ${row.percent >= 100 ? "is-over" : ""}"><b>${escapeHtml(optionLabel(row.category))}</b><span>${row.percent}%</span></a>`).join("")}</div>` : ""}
        </article>
        ${typeof SmartMoney !== "undefined" ? SmartMoney.renderQuickExpense("td-qx") : ""}
        <article class="glass-card card-pad td-card">
          <div class="td-card-head"><h2 class="section-title">🎉 ${isKm ? "សប្តាហ៍នេះ" : "This week"}</h2></div>
          ${upcoming.length ? `<div class="td-upcoming">${upcoming.map(item => `<div class="td-up"><span class="td-up-days">${item.daysLeft}<small>${isKm ? "ថ្ងៃ" : "d"}</small></span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(formatDate(item.date, { weekday: "short", month: "short", day: "numeric" }))}</small></div></div>`).join("")}</div>` : `<div class="td-empty">${isKm ? "សប្តាហ៍នេះស្ងាត់" : "A quiet week ahead"}</div>`}
        </article>
      </aside>
    </div>
  </section>`;
}

function bindToday() {
  if (typeof NotifyCenter !== "undefined") NotifyCenter.bindPage(document.querySelector(".today-page") || document);
  document.querySelector("[data-td-add-event]")?.addEventListener("click", () => App.openEventModal({ date: localDateInput() }));
  document.querySelectorAll("[data-td-paid]").forEach(button => button.addEventListener("click", () => {
    if (typeof markBillPaid === "function") markBillPaid(button.dataset.tdPaid);
  }));
  document.querySelectorAll("[data-td-done]").forEach(button => button.addEventListener("click", () => {
    Store.edit("reminders", button.dataset.tdDone, { done: true });
    Toast.show(todayKm() ? "រួចរាល់ ✓" : "Done ✓");
  }));
  document.querySelectorAll("[data-edit-event]").forEach(button => button.addEventListener("click", () => {
    App.openEventModal(appData.calendarEvents.find(item => item.id === button.dataset.editEvent));
  }));
  if (typeof SmartMoney !== "undefined") SmartMoney.bindQuickExpense();
}
