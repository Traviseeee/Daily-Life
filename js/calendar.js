const CAMBODIA_HOLIDAY_CACHE_KEY = "mylife:cambodia-holidays";
let cambodiaHolidayState = { year: null, items: [], loading: false };
let selectedCalendarDate = "";

function renderCalendar(view = "month") {
  const parts = location.hash.replace("#", "").split("/");
  const current = parseCalendarCursor(parts[2]);
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const visibleMonth = monthKey(current);
  const prevMonth = monthKey(new Date(year, month - 1, 1));
  const nextMonth = monthKey(new Date(year, month + 1, 1));
  ensureCambodiaHolidays(year);
  const monthEvents = calendarItemsForMonth(current);
  const startOffset = (firstDay.getDay() + 6) % 7;
  if (!selectedCalendarDate || !selectedCalendarDate.startsWith(visibleMonth)) {
    const today = calendarDateInput(new Date());
    selectedCalendarDate = today.startsWith(visibleMonth) ? today : `${visibleMonth}-01`;
  }
  const cells = Array.from({ length: Math.ceil((startOffset + totalDays) / 7) * 7 }, (_, index) => {
    const day = index - startOffset + 1;
    const iso = day > 0 && day <= totalDays ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
    const events = iso ? monthEvents.filter(event => event.date === iso) : [];
    const date = iso ? new Date(`${iso}T00:00:00`) : null;
    const isWeekend = date ? date.getDay() === 0 || date.getDay() === 6 : false;
    const holiday = iso ? cambodiaHolidayState.items.find(item => item.date === iso) : null;
    const isSelected = iso === selectedCalendarDate;
    return `<button class="day ${iso ? "has-date" : "empty-day"} ${isWeekend ? "weekend" : ""} ${holiday ? "public-holiday" : ""} ${isSelected ? "selected-day" : ""}" type="button" ${iso ? `data-calendar-date="${iso}"` : "disabled"} aria-pressed="${isSelected}" aria-label="${iso ? formatDate(iso) : ""}"><strong>${iso ? day : ""}</strong>${holiday ? `<span class="holiday-label" title="${escapeAttr(holiday.name)}">${languageCode() === "km" ? "ថ្ងៃឈប់សម្រាក" : "Holiday"}</span>` : ""}${events.map(eventChip).join("")}</button>`;
  });

  return `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.calendar()}</span>${t("calendar")}</h1>
          <p class="page-subtitle">${t("calendarSubtitle")}</p>
        </div>
        <button class="button" data-action="add-calendar">${Icons.plus()} ${t("addEvent")}</button>
      </div>
      <div class="tabs">${[["month", "month"], ["week", "week"], ["day", "day"]].map(([id, label]) => `<a class="tab ${view === id ? "active" : ""}" href="#calendar/${id}/${visibleMonth}">${t(label)}</a>`).join("")}</div>
      <article class="glass-card card-pad">
        <div class="calendar-toolbar">
          <div>
            <h2 class="section-title">${current.toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { month: "long", year: "numeric" })}</h2>
            <span class="pill">${monthEvents.length} ${t("events")}</span>
          </div>
          <div class="calendar-actions">
            <a class="icon-button previous-month" href="#calendar/${view}/${prevMonth}" aria-label="${t("previousMonth")}">${Icons.chevron()}</a>
            <a class="button ghost-button" href="#calendar/${view}/${monthKey(new Date())}">${t("today")}</a>
            <a class="icon-button next-month" href="#calendar/${view}/${nextMonth}" aria-label="${t("nextMonth")}">${Icons.chevron()}</a>
          </div>
        </div>
        <div class="calendar-grid">
          ${(languageCode() === "km" ? ["ចន្ទ", "អង្គារ", "ពុធ", "ព្រហ", "សុក្រ", "សៅរ៍", "អាទិត្យ"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]).map((day, index) => `<div class="calendar-weekday secondary ${index > 4 ? "weekend" : ""}"><strong>${day}</strong></div>`).join("")}
          ${cells.join("")}
        </div>
      </article>
      ${renderSelectedDayDetails(selectedCalendarDate, monthEvents)}
      <article class="glass-card card-pad" style="margin-top:18px"><h2 class="section-title">${t("allEvents")}</h2><div class="list">${monthEvents.map(eventRow).join("") || calendarEmptyCard()}</div></article>
    </section>
  `;
}

function renderSelectedDayDetails(date, monthEvents) {
  const holiday = cambodiaHolidayState.items.find(item => item.date === date);
  const events = monthEvents.filter(item => item.date === date);
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return `
    <article class="glass-card card-pad calendar-day-details">
      <div class="between">
        <div><span class="eyebrow">${languageCode() === "km" ? "ព័ត៌មានប្រចាំថ្ងៃ" : "Day details"}</span><h2 class="section-title">${escapeHtml(dateLabel)}</h2></div>
        <button class="button ghost-button" type="button" data-action="add-calendar" data-calendar-date="${date}">${Icons.plus()} ${t("addEvent")}</button>
      </div>
      ${holiday ? `<div class="holiday-detail"><span class="holiday-detail-icon">${Icons.calendar()}</span><div><strong>${escapeHtml(holiday.name)}</strong><small>${languageCode() === "km" ? "ថ្ងៃឈប់សម្រាកសាធារណៈកម្ពុជា" : "Cambodia public holiday"}</small></div></div>` : ""}
      ${events.length ? `<div class="calendar-detail-events">${events.map(event => `<div class="calendar-detail-event"><span class="icon-badge green">${Icons.calendar()}</span><div><strong>${escapeHtml(event.title)}</strong><small>${event.time ? escapeHtml(event.time) : (languageCode() === "km" ? "មិនបានកំណត់ពេល" : "Time not set")}${event.category ? ` · ${escapeHtml(optionLabel(event.category))}` : ""}</small></div></div>`).join("")}</div>` : ""}
      ${!holiday && !events.length ? `<p class="secondary calendar-detail-empty">${languageCode() === "km" ? "មិនមានព្រឹត្តិការណ៍ ឬថ្ងៃឈប់សម្រាកសម្រាប់ថ្ងៃនេះទេ។" : "No event or public holiday is scheduled for this day."}</p>` : ""}
    </article>
  `;
}

function ensureCambodiaHolidays(year) {
  if (cambodiaHolidayState.year === year || cambodiaHolidayState.loading) return;

  try {
    const cached = JSON.parse(localStorage.getItem(`${CAMBODIA_HOLIDAY_CACHE_KEY}:${year}`) || "null");
    if (Array.isArray(cached)) {
      cambodiaHolidayState = { year, items: cached, loading: false };
      return;
    }
  } catch (error) {
    // Fetch a fresh copy when cached holiday data is invalid.
  }

  cambodiaHolidayState = { year, items: [], loading: true };
  fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KH`)
    .then(response => response.ok ? response.json() : [])
    .then(items => {
      const holidays = Array.isArray(items) ? items.map(item => ({ date: item.date, name: item.localName || item.name })).filter(item => item.date && item.name) : [];
      localStorage.setItem(`${CAMBODIA_HOLIDAY_CACHE_KEY}:${year}`, JSON.stringify(holidays));
      cambodiaHolidayState = { year, items: holidays, loading: false };
      if (location.hash.startsWith("#calendar")) App.render();
    })
    .catch(() => {
      cambodiaHolidayState = { year, items: [], loading: false };
    });
}

function calendarEmptyCard() {
  return `
    <div class="image-empty-card calendar-empty-card">
      <img src="https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=900&q=78" alt="" loading="lazy">
      <div class="image-empty-content">
        <span class="icon-badge pink">${Icons.calendar()}</span>
        <h2>${escapeHtml(t("noCalendarEvents"))}</h2>
        <p class="secondary">${escapeHtml(t("noCalendarEventsBody"))}</p>
        <button class="button" data-action="add-calendar">${Icons.plus()} ${t("addEvent")}</button>
      </div>
    </div>
  `;
}

function parseCalendarCursor(value) {
  if (/^\d{4}-\d{2}$/.test(value || "")) {
    const [year, month] = value.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }
  return new Date();
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function calendarItemsForMonth(cursor) {
  const visibleMonth = monthKey(cursor);
  const items = [];
  const add = item => {
    if (!item.date || !item.date.startsWith(visibleMonth)) return;
    items.push(item);
  };

  appData.calendarEvents.forEach(event => add({
    ...event,
    source: "event",
    auto: false,
    href: "#calendar"
  }));

  appData.bills.forEach(bill => {
    if (bill.reminder === false || !bill.due) return;
    recurringDatesInMonth(bill.due, bill.frequency || "Monthly", cursor).forEach(date => add({
      id: `auto-bill-${bill.id}-${date}`,
      title: `${t("bill")}: ${bill.name}`,
      date,
      category: t("bill"),
      source: "bill",
      auto: true,
      amount: bill.amount,
      currency: bill.currency,
      href: "#money/bills",
      notes: bill.notes || ""
    }));
  });

  appData.loans.forEach(loan => {
    loanPaymentDatesInMonth(loan, cursor).forEach(date => add({
      id: `auto-loan-${loan.id}-${date}`,
      title: `${t("loan")}: ${loan.name}`,
      date,
      category: t("loan"),
      source: "loan",
      auto: true,
      amount: loan.monthlyPayment,
      currency: loan.currency,
      paid: (loan.payments || []).some(payment => payment.date === date),
      href: "#money/loans",
      notes: loan.notes || ""
    }));
  });

  appData.income.forEach(income => {
    if (!income.nextPaymentDate) return;
    recurringDatesInMonth(income.nextPaymentDate, income.recurring === false ? "Once" : income.frequency || "Monthly", cursor).forEach(date => add({
      id: `auto-income-${income.id}-${date}`,
      title: `${t("income")}: ${income.name}`,
      date,
      category: t("income"),
      source: "income",
      auto: true,
      amount: income.amount,
      currency: income.currency,
      href: "#money/income",
      notes: income.notes || ""
    }));
  });

  appData.expenses.forEach(expense => add({
    id: `auto-expense-${expense.id}`,
    title: `${t("expense")}: ${expense.description}`,
    date: expense.date,
    category: t("expense"),
    source: "expense",
    auto: true,
    amount: expense.amount,
    currency: expense.currency,
    href: "#money/expenses",
    notes: expense.notes || ""
  }));

  appData.goals.forEach(goal => add({
    id: `auto-goal-${goal.id}`,
    title: `${t("goal")}: ${goal.name}`,
    date: goal.deadline,
    category: t("goal"),
    source: "goal",
    auto: true,
    href: "#goals",
    notes: goal.description || ""
  }));

  appData.savings.forEach(saving => add({
    id: `auto-saving-${saving.id}`,
    title: `${t("savings")}: ${saving.name}`,
    date: saving.deadline,
    category: t("savings"),
    source: "savings",
    auto: true,
    amount: saving.targetAmount,
    currency: saving.currency,
    href: "#money/savings",
    notes: saving.notes || ""
  }));

  appData.family.forEach(member => {
    const birthday = yearlyDateInMonth(member.birthday, cursor);
    if (!birthday) return;
    add({
      id: `auto-family-${member.id}-${birthday}`,
      title: `${t("birthday")}: ${member.name}`,
      date: birthday,
      category: t("family"),
      source: "family",
      auto: true,
      href: "#family",
      notes: member.notes || ""
    });
  });

  appData.memories.forEach(memory => add({
    id: `auto-memory-${memory.id}`,
    title: `${t("memory")}: ${memory.title}`,
    date: memory.date,
    category: t("memory"),
    source: "memory",
    auto: true,
    href: "#memories",
    notes: memory.description || ""
  }));

  cambodiaHolidayState.items.forEach(holiday => add({
    id: `holiday-${holiday.date}`,
    title: holiday.name,
    date: holiday.date,
    category: languageCode() === "km" ? "ថ្ងៃឈប់សម្រាកសាធារណៈ" : "Public holiday",
    source: "holiday",
    auto: true,
    href: `#calendar/day/${visibleMonth}`,
    notes: languageCode() === "km" ? "ថ្ងៃឈប់សម្រាកសាធារណៈកម្ពុជា" : "Cambodia public holiday"
  }));

  return items.sort((a, b) => `${a.date} ${a.time || ""} ${a.title}`.localeCompare(`${b.date} ${b.time || ""} ${b.title}`));
}

function recurringDatesInMonth(startValue, frequency, cursor) {
  const start = parseAppDate(startValue);
  if (Number.isNaN(start.getTime())) return [];
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  if (start > monthEnd) return [];
  const normalizedFrequency = frequency || "Monthly";

  if (normalizedFrequency === "Once") return start >= monthStart && start <= monthEnd ? [calendarDateInput(start)] : [];
  if (normalizedFrequency === "Daily") {
    const dates = [];
    for (let date = new Date(Math.max(start.getTime(), monthStart.getTime())); date <= monthEnd; date.setDate(date.getDate() + 1)) {
      dates.push(calendarDateInput(date));
    }
    return dates;
  }
  if (normalizedFrequency === "Weekly") {
    const dates = [];
    const first = new Date(start);
    while (first < monthStart) first.setDate(first.getDate() + 7);
    for (let date = first; date <= monthEnd; date.setDate(date.getDate() + 7)) {
      dates.push(calendarDateInput(date));
    }
    return dates;
  }

  const monthsBetween = (cursor.getFullYear() - start.getFullYear()) * 12 + cursor.getMonth() - start.getMonth();
  if (monthsBetween < 0) return [];
  if (normalizedFrequency === "Quarterly" && monthsBetween % 3 !== 0) return [];
  if (normalizedFrequency === "Yearly" && cursor.getMonth() !== start.getMonth()) return [];
  const date = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(start.getDate(), monthEnd.getDate()));
  return [calendarDateInput(date)];
}

function loanPaymentDatesInMonth(loan, cursor) {
  const firstPaymentDate = loan.firstPaymentDate || loan.startDate;
  const first = parseAppDate(firstPaymentDate);
  if (Number.isNaN(first.getTime()) || !Number(loan.monthlyPayment || 0)) return [];
  const durationMonths = Number(loan.durationMonths || 0);
  const monthsBetween = (cursor.getFullYear() - first.getFullYear()) * 12 + cursor.getMonth() - first.getMonth();
  if (monthsBetween < 0) return [];
  if (durationMonths && monthsBetween > durationMonths - 1) return [];
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  return [calendarDateInput(new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(first.getDate(), lastDay)))];
}

function yearlyDateInMonth(value, cursor) {
  const date = parseAppDate(value);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== cursor.getMonth()) return "";
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  return calendarDateInput(new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(date.getDate(), lastDay)));
}

function calendarDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventChip(event) {
  return `<span class="event-chip ${event.source || event.category?.toLowerCase() || ""} ${event.auto ? "auto" : ""}" title="${escapeAttr(event.title)}">${escapeHtml(event.title)}</span>`;
}

function eventRow(event) {
  const amount = event.amount ? `<span class="secondary">${money(event.amount, event.currency)}</span>` : "";
  const actions = event.source === "holiday" ? "" : event.auto ? `<a class="button ghost-button" href="${event.href}">${t("view")}</a>` : `<button class="icon-button" data-edit-event="${event.id}" aria-label="${t("editEvent")}">${Icons.edit()}</button><button class="icon-button" data-delete-event="${event.id}" aria-label="${t("deleteEvent")}">${Icons.trash()}</button>`;
  return `<div class="list-row calendar-event-row ${event.auto ? "auto" : ""} ${event.source === "holiday" ? "holiday-event" : ""}">
    <span class="icon-badge green">${Icons.calendar()}</span>
    <div class="calendar-event-main"><strong>${escapeHtml(event.title)}</strong><span class="secondary">${formatDate(event.date)}${event.time ? ` · ${escapeHtml(event.time)}` : ""}</span></div>
    <div class="calendar-event-side"><div class="calendar-event-meta">${amount}<span class="pill">${optionLabel(event.category)}${event.auto ? ` · ${t("auto")}` : ""}</span></div><div class="calendar-event-actions">${actions}</div></div>
  </div>`;
}

function bindCalendar() {
  document.querySelectorAll('[data-action="add-calendar"]').forEach(button => button.addEventListener("click", () => App.openEventModal({ date: button.dataset.calendarDate || "" })));
  document.querySelectorAll(".day[data-calendar-date]").forEach(button => button.addEventListener("click", () => {
    selectedCalendarDate = button.getAttribute("data-calendar-date");
    App.render();
  }));
  document.querySelectorAll("[data-edit-event]").forEach(button => button.addEventListener("click", () => App.openEventModal(appData.calendarEvents.find(item => item.id === button.dataset.editEvent))));
  document.querySelectorAll("[data-delete-event]").forEach(button => button.addEventListener("click", () => {
    Modal.confirm({ title: t("deleteEvent"), message: t("deleteEventMessage"), confirmText: t("delete"), onConfirm: () => {
      Store.delete("calendarEvents", button.dataset.deleteEvent);
      Toast.show(t("eventDeleted"));
    }});
  }));
}
