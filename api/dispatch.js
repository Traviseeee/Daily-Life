
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const {
  getRedis,
  getUserSubscriptions,
  sendToSubscription
} = require("../lib/push");
const { sendAlert, flushSnoozes, ensureWebhook } = require("../lib/telegram");
const { budgetAlerts, weeklyReport, CATEGORY_KM } = require("../lib/money-report");
const { frequentExpenses, unusualToday, convert } = require("../lib/money-insights");
const { payBill } = require("../lib/bill-pay");
const { updatePayloadSafe } = require("../lib/payload-store");

// Redis dedupe makes a wide window safe: a late or skipped scheduler run still
// delivers alerts that came due in the last 30 minutes, exactly once.
const LOOKBACK_MS = 30 * 60 * 1000;
const APP_TIME_ZONE = "Asia/Phnom_Penh";
const SENT_TTL_SECONDS = 90 * 24 * 60 * 60;

function localDateTimeToUtc(dateValue, timeValue, timeZone) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(dateValue || "")
  );
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(
    String(timeValue || "09:00")
  );

  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const desiredLocalTime = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute
  );

  let utcTime = desiredLocalTime;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(utcTime))
        .map(part => [part.type, part.value])
    );

    const representedLocalTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute)
    );

    const correction = desiredLocalTime - representedLocalTime;
    utcTime += correction;

    if (!correction) break;
  }

  return utcTime;
}

function parsePayload(value) {
  if (value && typeof value === "object") return value;

  try {
    return JSON.parse(String(value || "{}"));
  } catch (error) {
    return {};
  }
}

function parseDate(value) {
  const normalized = /^\d{4}-\d{2}$/.test(String(value || ""))
    ? `${value}-01`
    : value;

  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Today's calendar date (YYYY-MM-DD) in Cambodia, not in the server's UTC clock.
function zonedTodayInput(timeZone = APP_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function toDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();

  result.setMonth(result.getMonth() + months, 1);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(day, lastDay));
  return result;
}

function loanNextPaymentDate(loan) {
  const firstPaymentDate = loan.firstPaymentDate || loan.startDate;
  const first = parseDate(firstPaymentDate);

  if (!first) return "";

  const monthlyPayment = Number(loan.monthlyPayment || 0);
  if (!monthlyPayment) return "";

  const durationMonths = Number(loan.durationMonths || 0);

  const today = parseDate(zonedTodayInput());

  let next = new Date(first);
  let index = 0;

  while (
    next < today &&
    (!durationMonths || index < durationMonths - 1)
  ) {
    index += 1;
    next = addMonths(first, index);
  }

  if (durationMonths && next < today) return "";

  const dateValue = toDateInput(next);

  if (
    (loan.payments || []).some(
      payment => payment.date === dateValue
    )
  ) {
    return "";
  }

  return dateValue;
}

function currentMonthKey() {
  return zonedTodayInput().slice(0, 7);
}

function savingsContributionPaid(saving, monthKey) {
  return (saving.contributions || []).some(
    entry => entry && entry.month === monthKey && entry.paid
  );
}

function moneyLabel(currency, amount) {
  const value = Number(amount || 0);
  if (!value) return "";
  if (currency === "KHR") return `${value.toLocaleString("en-US")} ៛`;
  if (currency === "USD") return `$${value.toLocaleString("en-US")}`;
  return `${currency || ""} ${value.toLocaleString("en-US")}`.trim();
}

// Does a recurring bill fall on `dateInput`? Cycles start at bill.due and
// repeat by frequency (Once / Daily / Weekly / Monthly / Quarterly / Yearly).
// Marking a bill paid in the app moves `due` to the next cycle, so every
// cycle on or after `due` is still unpaid and should be reminded.
function billOccursOn(bill, dateInput) {
  const due = parseDate(bill.due);
  const day = parseDate(dateInput);
  if (!due || !day || day < due) return false;

  const frequency = bill.frequency || "Monthly";
  if (frequency === "Once") return toDateInput(due) === dateInput;
  if (frequency === "Daily") return true;
  if (frequency === "Weekly") {
    return Math.round((day - due) / 86400000) % 7 === 0;
  }

  const months = (day.getFullYear() - due.getFullYear()) * 12 + day.getMonth() - due.getMonth();
  if (frequency === "Quarterly" && months % 3 !== 0) return false;
  if (frequency === "Yearly" && months % 12 !== 0) return false;
  const lastDay = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
  return day.getDate() === Math.min(due.getDate(), lastDay);
}

// Yearly family dates (birthday / anniversary) that fall on `dateInput`.
// A 29 Feb date is celebrated on 28 Feb in non-leap years.
function yearlyDateYears(value, dateInput) {
  const original = parseDate(value);
  const day = parseDate(dateInput);
  if (!original || !day || day < original) return null;
  const lastDay = new Date(day.getFullYear(), original.getMonth() + 1, 0).getDate();
  const matches = day.getMonth() === original.getMonth()
    && day.getDate() === Math.min(original.getDate(), lastDay);
  return matches ? day.getFullYear() - original.getFullYear() : null;
}

// Local date/time minus `minutes`, as { date, time } strings (pure calendar math).
function shiftLocal(dateValue, timeValue, minutes) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
  const t = /^(\d{1,2}):(\d{2})/.exec(String(timeValue || "09:00"));
  if (!d || !t) return null;
  const at = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]) - minutes * 60000);
  const pad = n => String(n).padStart(2, "0");
  return {
    date: `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`,
    time: `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`
  };
}

function addDaysInput(dateInput, days) {
  const date = parseDate(dateInput);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

// Everything that happens on one day, for the morning digest.
function dayEntries(payload, day) {
  const entries = [];
  (payload.calendarEvents || []).forEach(item => {
    if (item.date === day && item.title) entries.push({ kind: "calendar", title: item.title, time: item.time || "", hasTime: Boolean(item.time) });
  });
  (payload.reminders || []).forEach(item => {
    if (!item.done && item.date === day && item.title) entries.push({ kind: "reminder", title: item.title, time: item.time || "", hasTime: Boolean(item.time) });
  });
  (payload.bills || []).forEach(item => {
    if (!item.due || !item.name) return;
    const due = (item.status !== "Paid" && item.due === day) || (billOccursOn(item, day) && !(item.status === "Paid" && item.due === day));
    if (due) entries.push({ kind: "bill", title: item.name, extra: moneyLabel(item.currency, item.amount) });
  });
  (payload.loans || []).forEach(item => {
    if (item.name && loanNextPaymentDate(item) === day) entries.push({ kind: "loan", title: item.name, extra: moneyLabel(item.currency, item.monthlyPayment) });
  });
  (payload.family || []).forEach(member => {
    if (!member?.name) return;
    const age = yearlyDateYears(member.birthday, day);
    if (age !== null) entries.push({ kind: "birthday", title: member.name, extra: age > 0 ? `${age} ឆ្នាំ` : "" });
    const years = yearlyDateYears(member.anniversaryDate, day);
    if (years !== null && years > 0) entries.push({ kind: "anniversary", title: member.name, extra: `${years} ឆ្នាំ` });
  });
  return entries.sort((a, b) => (a.hasTime ? a.time : "") .localeCompare(b.hasTime ? b.time : ""));
}

function digestItem(payload, today) {
  const profile = payload.profile || {};
  if (profile.morningDigest === false) return null;
  const tomorrow = addDaysInput(today, 1);
  const upcoming = [];
  for (let days = 2; days <= 7; days += 1) {
    const day = addDaysInput(today, days);
    (payload.family || []).forEach(member => {
      if (!member?.name) return;
      if (yearlyDateYears(member.birthday, day) !== null) upcoming.push({ kind: "birthday", title: member.name, days, date: day });
      const years = yearlyDateYears(member.anniversaryDate, day);
      if (years !== null && years > 0) upcoming.push({ kind: "anniversary", title: member.name, days, date: day });
    });
  }
  const overdue = (payload.bills || [])
    .filter(bill => bill.name && bill.due && bill.due < today && bill.status !== "Paid" && bill.reminder !== false)
    .map(bill => ({ kind: "bill", title: bill.name, extra: moneyLabel(bill.currency, bill.amount) }));
  const todayEntries = dayEntries(payload, today);
  return {
    kind: "digest",
    id: `digest-${today}`,
    title: "MYLIFE morning digest",
    body: todayEntries.length ? `ថ្ងៃនេះមាន ${todayEntries.length} · ${todayEntries.length} today` : "ថ្ងៃនេះទំនេរ · Nothing today",
    date: today,
    time: /^\d{1,2}:\d{2}$/.test(String(profile.digestTime || "")) ? profile.digestTime : "07:00",
    hasTime: true,
    url: "/#calendar",
    digest: { today: todayEntries, tomorrow: dayEntries(payload, tomorrow), overdue, upcoming }
  };
}

// Adds a "coming up" copy of an item that fires `remindBefore` minutes early.
function withEarly(items, item, remindBefore) {
  const minutes = Number(remindBefore || 0);
  if (!minutes || minutes < 0) return;
  const fire = shiftLocal(item.date, item.time || "09:00", minutes);
  if (!fire) return;
  items.push({ ...item, id: `${item.id}-before-${minutes}`, sourceId: item.id, early: minutes, fireDate: fire.date, fireTime: fire.time });
}

function notificationItems(payload) {
  const items = [];

  const add = item => {
    if (!item?.date || !item.title) return;
    items.push({ time: "09:00", hasTime: false, ...item });
  };

  (Array.isArray(payload.reminders) ? payload.reminders : [])
    .forEach(item => {
      if (item.done) return;

      const reminder = {
        kind: "reminder",
        id: item.id,
        title: item.title || "MYLIFE reminder",
        body: item.notes || "",
        date: item.date,
        time: item.time || "09:00",
        hasTime: Boolean(item.time),
        url: "/#daily"
      };
      add(reminder);
      if (item.date && item.title) withEarly(items, reminder, item.remindBefore);
    });

  (Array.isArray(payload.calendarEvents) ? payload.calendarEvents : [])
    .forEach(item => {
      if (item.reminder === false) return;

      const event = {
        kind: "calendar",
        id: item.id,
        title: item.title || "MYLIFE event",
        body: item.notes || "",
        date: item.date,
        time: item.time || "09:00",
        hasTime: Boolean(item.time),
        url: "/#calendar"
      };
      add(event);
      if (item.date) withEarly(items, event, item.remindBefore);
    });

  const today = zonedTodayInput();

  (Array.isArray(payload.bills) ? payload.bills : [])
    .forEach(item => {
      if (item.reminder === false || !item.due) return;

      const dates = new Set();
      // The current cycle (first due date or the one after the last payment).
      if (item.status !== "Paid") dates.add(item.due);
      // Every later cycle that lands on today, even if earlier ones weren't marked paid.
      if (billOccursOn(item, today) && !(item.status === "Paid" && item.due === today)) {
        dates.add(today);
      }

      const amount = moneyLabel(item.currency, item.amount);
      dates.forEach(date => add({
        kind: "bill",
        id: item.id,
        title: item.name || "Bill due",
        body: [amount ? `ត្រូវបង់ · Due: ${amount}` : "", item.notes || ""].filter(Boolean).join("\n"),
        date,
        amount: Number(item.amount || 0),
        currency: item.currency || "",
        url: "/#money/bills"
      }));
    });

  (Array.isArray(payload.loans) ? payload.loans : [])
    .forEach(item => {
      const date = loanNextPaymentDate(item);
      if (!date) return;

      add({
        kind: "loan",
        id: item.id,
        title: item.name || "Loan payment due",
        body: item.monthlyPayment
          ? `ត្រូវបង់ប្រចាំខែ · Monthly payment: ${moneyLabel(item.currency, item.monthlyPayment)}`
          : "",
        date,
        amount: Number(item.monthlyPayment || 0),
        url: "/#money/loans"
      });
    });

  const monthKey = currentMonthKey();

  (Array.isArray(payload.savings) ? payload.savings : [])
    .forEach(item => {
      const monthlyAmount = Number(item.monthlyContribution || 0);

      if (
        monthlyAmount &&
        !savingsContributionPaid(item, monthKey)
      ) {
        add({
          kind: "savings-contribution",
          id: `${item.id || item.name}-${monthKey}`,
          sourceId: item.id,
          month: monthKey,
          title: item.name || "Savings contribution",
          body: `សន្សំខែនេះ · Monthly saving: ${moneyLabel(item.currency, monthlyAmount)}`,
          date: `${monthKey}-01`,
          url: "/#money/savings"
        });
      }

      if (item.deadline) {
        add({
          kind: "savings-deadline",
          id: `${item.id || item.name}-deadline`,
          title: item.name || "Savings deadline",
          body: item.notes || "",
          date: item.deadline,
          url: "/#money/savings"
        });
      }
    });

  // Goals: deadline alert (+ N days before) and a monthly nudge on the 1st. Only goals
  // the user switched on in the goal form (goalReminder === true).
  const goalCurrency = (payload.profile || {}).currency || "USD";
  (Array.isArray(payload.goals) ? payload.goals : [])
    .forEach(goal => {
      if (!goal || !goal.name || goal.goalReminder !== true) return;
      const target = Number(goal.targetAmount || 0);
      const current = Number(goal.currentAmount || 0);
      const remaining = target - current;
      if (target > 0 && remaining <= 0) return;
      if (goal.deadline && goal.deadline >= today) {
        const deadlineItem = {
          kind: "goal",
          id: `${goal.id || goal.name}-goal-deadline`,
          title: goal.name,
          body: remaining > 0 ? `នៅខ្វះ · Still need: ${moneyLabel(goalCurrency, Math.round(remaining))}` : (goal.description || ""),
          date: goal.deadline,
          url: `/#goals/${goal.id || ""}`
        };
        add(deadlineItem);
        withEarly(items, { time: "09:00", hasTime: false, ...deadlineItem }, Math.round(Number(goal.remindDaysBefore || 0)) * 1440);
      }
      if (goal.monthlyNudge && remaining > 0 && today.endsWith("-01")) {
        let monthsLeft = 0;
        if (goal.deadline) {
          const [y, m] = goal.deadline.split("-").map(Number);
          const [ty, tm] = today.split("-").map(Number);
          monthsLeft = Math.max(1, (y - ty) * 12 + (m - tm));
        }
        add({
          kind: "goal",
          id: `${goal.id || goal.name}-goal-month-${today.slice(0, 7)}`,
          title: goal.name,
          body: monthsLeft
            ? `ខែនេះគួរសន្សំ · Save this month: ${moneyLabel(goalCurrency, Math.ceil(remaining / monthsLeft))}`
            : `នៅខ្វះ · Still need: ${moneyLabel(goalCurrency, Math.round(remaining))}`,
          date: today,
          url: `/#goals/${goal.id || ""}`
        });
      }
    });

  (Array.isArray(payload.family) ? payload.family : [])
    .forEach(member => {
      if (!member || !member.name) return;
      if (member.dateReminder === false) return;

      // "N days before" copy for birthdays / anniversaries (set in the family form).
      const daysBefore = Math.round(Number(member.remindDaysBefore || 0));
      if (daysBefore > 0 && daysBefore <= 30) {
        const ahead = addDaysInput(today, daysBefore);
        const aheadBirthday = yearlyDateYears(member.birthday, ahead);
        if (aheadBirthday !== null) {
          withEarly(items, { kind: "birthday", id: `${member.id || member.name}-birthday-${ahead}`, title: member.name, body: aheadBirthday > 0 ? `អាយុ ${aheadBirthday} ឆ្នាំ · Turns ${aheadBirthday}` : "", date: ahead, time: "09:00", hasTime: false, url: "/#family" }, daysBefore * 1440);
        }
        const aheadYears = yearlyDateYears(member.anniversaryDate, ahead);
        if (aheadYears !== null && aheadYears > 0) {
          withEarly(items, { kind: "anniversary", id: `${member.id || member.name}-anniversary-${ahead}`, title: member.name, body: `${aheadYears} ឆ្នាំ · ${aheadYears} year${aheadYears === 1 ? "" : "s"}`, date: ahead, time: "09:00", hasTime: false, url: "/#family" }, daysBefore * 1440);
        }
      }

      const birthdayYears = yearlyDateYears(member.birthday, today);
      if (birthdayYears !== null) {
        add({
          kind: "birthday",
          id: `${member.id || member.name}-birthday`,
          title: member.name,
          body: birthdayYears > 0 ? `អាយុ ${birthdayYears} ឆ្នាំ · Turns ${birthdayYears}` : "",
          date: today,
          url: "/#family"
        });
      }

      const anniversaryYears = yearlyDateYears(member.anniversaryDate, today);
      if (anniversaryYears !== null && anniversaryYears > 0) {
        add({
          kind: "anniversary",
          id: `${member.id || member.name}-anniversary`,
          title: member.name,
          body: `${anniversaryYears} ឆ្នាំ · ${anniversaryYears} year${anniversaryYears === 1 ? "" : "s"}`,
          date: today,
          url: "/#family"
        });
      }
    });

  const digest = digestItem(payload, today);
  if (digest) items.push(digest);

  // Category budgets: 80% and 100% alerts, once per category per month.
  budgetAlerts(payload, today).forEach(alert => items.push({
    ...alert,
    date: `${today.slice(0, 7)}-01`,
    time: "00:00",
    hasTime: false
  }));

  // Sunday evening weekly money report.
  const profile = payload.profile || {};
  const [y, m, d] = today.split("-").map(Number);
  if (profile.weeklyReport !== false && new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0) {
    items.push({
      kind: "weekly",
      id: `weekly-${today}`,
      title: "MYLIFE weekly report",
      body: "របាយការណ៍ប្រចាំសប្តាហ៍ · Weekly report",
      date: today,
      time: /^\d{1,2}:\d{2}$/.test(String(profile.weeklyReportTime || "")) ? profile.weeklyReportTime : "19:00",
      hasTime: true,
      url: "/#money/reports",
      weekly: weeklyReport(payload, today)
    });
    // the same evening: report picture, then the JSON backup file
    if (profile.weeklyImage !== false) {
      items.push({
        kind: "weekly-image", id: `weekly-image-${today}`, title: "MYLIFE weekly image", date: today,
        time: plusMinutes(profile.weeklyReportTime, "19:00", 1), hasTime: true, url: "/#money/reports",
        makeFile: async () => ({
          method: "sendPhoto", field: "photo", mime: "image/png", filename: `mylife-week-${today}.png`,
          buffer: Buffer.from(await require("../lib/report-image").weeklyImage(payload, today)),
          caption: "📊 <b>របាយការណ៍ប្រចាំសប្តាហ៍</b>"
        })
      });
    }
    if (profile.telegramBackup !== false) {
      items.push({
        kind: "backup-file", id: `backup-file-${today}`, title: "MYLIFE backup", date: today,
        time: plusMinutes(profile.weeklyReportTime, "19:00", 2), hasTime: true, url: "/#settings",
        makeFile: async () => ({
          method: "sendDocument", field: "document", mime: "application/json", filename: `mylife-backup-${today}.json`,
          buffer: Buffer.from(JSON.stringify(payload, null, 1)),
          caption: `💾 <b>Backup ប្រចាំសប្តាហ៍</b> · ${today}\nរក្សាទុកឯកសារនេះ។ ពេលត្រូវការ៖ Settings → Import`
        })
      });
    }
  }

  // Fallback on the 2nd, 09:00: picture of last month — only if the app has not
  // already sent its full report (JPG + Excel) when it was opened in the new month.
  if (profile.monthlyImage !== false && today.endsWith("-02")) {
    const last = addDaysInput(today, -2).slice(0, 7);
    items.push({
      kind: "monthly-image", id: `monthly-image-${last}`, title: "MYLIFE monthly image", date: today, time: "09:00", hasTime: true, url: "/#money/reports",
      skipKey: userId => `mylife:report-sent:${userId}:${last}`,
      makeFile: async () => ({
        method: "sendPhoto", field: "photo", mime: "image/png", filename: `mylife-month-${last}.png`,
        buffer: Buffer.from(await require("../lib/report-image").monthlyImage(payload, last)),
        caption: "🗓️ <b>របាយការណ៍ប្រចាំខែ</b>"
      })
    });
  }

  // Evening check: "did you spend anything else today?"
  if (profile.eveningCheck !== false) {
    items.push(eveningItem(payload, today, /^\d{1,2}:\d{2}$/.test(String(profile.eveningCheckTime || "")) ? profile.eveningCheckTime : "21:00"));
  }

  // Spending far above a normal day (once a day, 08:00–21:00)
  if (profile.unusualAlert !== false) {
    const check = unusualToday(payload, today);
    if (check.unusual) {
      const currency = profile.currency || "USD";
      items.push({
        kind: "unusual", id: `unusual-${today}`, title: "MYLIFE unusual spending", date: today, time: "00:00", hasTime: false, sendNow: true, url: "/#money/expenses",
        body: `ថ្ងៃនេះចាយ ${fmtMoney(currency, check.today)} ច្រើនជាងធម្មតា ${Math.round(check.ratio)} ដង`,
        html: [
          "⚠️ <b>ថ្ងៃនេះចាយច្រើនជាងធម្មតា</b>",
          "",
          `💸 ថ្ងៃនេះ <b>${fmtMoney(currency, check.today)}</b>`,
          `📊 ធម្មតា ${fmtMoney(currency, check.average)} / ថ្ងៃ · ច្រើនជាង <b>${Math.round(check.ratio)} ដង</b>`,
          "",
          "<i>បើជាការទិញធំដែលបានគ្រោងទុក មិនអីទេ 👍</i>"
        ].join("\n")
      });
    }
  }

  return items;
}

// "$3.25", "$12", "15,000 ៛" (riel never shows decimals)
function fmtMoney(currency, amount) {
  const value = Number(amount || 0);
  if ((currency || "USD") === "KHR") return `${Math.round(value).toLocaleString("en-US")} ៛`;
  const cents = Math.round(value * 100) % 100 !== 0;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
}

function plusMinutes(value, fallback, minutes) {
  const time = /^\d{1,2}:\d{2}$/.test(String(value || "")) ? value : fallback;
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function eveningItem(payload, today, time) {
  const currency = payload.profile?.currency || "USD";
  const todays = (payload.expenses || []).filter(item => item.date === today);
  const total = todays.reduce((sum, item) => sum + convert(item.amount, item.currency || currency, currency), 0);
  const quick = frequentExpenses(payload, today, 4);
  const lines = ["🌙 <b>មុនគេង · កត់ចំណាយថ្ងៃនេះ</b>", ""];
  if (todays.length) {
    lines.push(`ថ្ងៃនេះបងកត់ <b>${todays.length} មុខ</b> · <b>${fmtMoney(currency, total)}</b>`);
    todays.slice(-4).forEach(item => lines.push(`• ${String(item.description || CATEGORY_KM[item.category] || "").replace(/[<>&]/g, "")} ${fmtMoney(item.currency || currency, item.amount)}`));
  } else {
    lines.push("ថ្ងៃនេះមិនទាន់កត់ចំណាយទេ");
  }
  lines.push("", "មានចាយអ្វីទៀតទេ?", quick.length ? "👇 ចុចមួយដងដើម្បីកត់ ឬវាយតបមក ឧ. <code>coffee 2</code>" : "វាយតបមក ឧ. <code>coffee 2</code> ឬ <code>grab 15k</code>");
  return {
    kind: "evening", id: `evening-${today}`, title: "MYLIFE evening check", date: today, time, hasTime: true, url: "/#money/expenses",
    html: lines.join("\n"), quick
  };
}

// Bills marked "auto-pay" (subscriptions) are paid on their due date and recorded
// as expenses. Runs from 07:00 local, once per bill cycle.
async function autoPayBills(supabase, redis, userId, rawPayload) {
  const payload = parsePayload(rawPayload);
  const today = zonedTodayInput();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (hour < 7) return "skipped";
  const due = (payload.bills || []).filter(bill => bill.autoPay && bill.due && bill.due <= today && bill.status !== "Paid");
  if (!due.length) return "skipped";
  const claimed = [];
  for (const bill of due) {
    if (await redis.set(`mylife:autopay:${userId}:${bill.id}:${bill.due}`, "1", { nx: true, ex: 40 * 24 * 60 * 60 })) claimed.push(bill.id);
  }
  if (!claimed.length) return "duplicate";

  const paid = [];
  let fresh = null;
  await updatePayloadSafe(supabase, userId, payload => {
    paid.length = 0;
    (payload.bills || []).forEach(bill => {
      if (!claimed.includes(bill.id)) return;
      if (payBill(payload, bill, today, "Auto-pay") === "updated") paid.push(bill);
    });
    fresh = payload;
    return paid.length ? "updated" : "skipped";
  });
  if (!paid.length) return "skipped";

  const currency = fresh.profile?.currency || "USD";
  await sendAlert({
    kind: "autopay", id: `autopay-${today}`, title: "MYLIFE auto-pay", date: today, url: "/#money/bills",
    html: ["🔁 <b>បង់ស្វ័យប្រវត្តិ</b>", "", ...paid.map(bill => `✅ ${String(bill.name || "Bill").replace(/[<>&]/g, "")} · <b>${fmtMoney(bill.currency || currency, bill.amount)}</b>`), "", "<i>បានកត់ជាចំណាយ (វិក្កយបត្រ) រួចហើយ</i>"].join("\n")
  }, userId, redis);
  return "paid";
}

// When an item should fire: its own date/time, or earlier for "remind before".
// "sendNow" items (budget alerts) fire right away, but only 08:00–21:00 local.
function itemDueAt(item, timeZone) {
  if (item.sendNow) {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    return hour >= 8 && hour < 21 ? Date.now() - 1000 : null;
  }
  return localDateTimeToUtc(item.fireDate || item.date, item.fireTime || item.time || "09:00", timeZone);
}

// Weekly cloud backup of each payload into Redis (last 5 kept, 36 days).
const BACKUP_TTL_SECONDS = 36 * 24 * 60 * 60;
const BACKUP_MAX_BYTES = 900 * 1024;

async function weeklyBackup(redis, userId, rawPayload) {
  const lastKey = `mylife:backup:last:${userId}`;
  if (await redis.get(lastKey)) return "recent";
  const json = typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload || {});
  if (json.length > BACKUP_MAX_BYTES) {
    await redis.set(lastKey, "too-big", { ex: 24 * 60 * 60 });
    return "too_big";
  }
  const day = zonedTodayInput();
  await redis.set(`mylife:backup:${userId}:${day}`, json, { ex: BACKUP_TTL_SECONDS });
  await redis.lrem(`mylife:backups:${userId}`, 0, day);
  await redis.lpush(`mylife:backups:${userId}`, day);
  await redis.ltrim(`mylife:backups:${userId}`, 0, 4);
  await redis.expire(`mylife:backups:${userId}`, BACKUP_TTL_SECONDS);
  await redis.set(lastKey, day, { ex: 7 * 24 * 60 * 60 });
  return "saved";
}

function makeMarker(userId, endpoint, item) {
  const identity = [
    userId,
    endpoint,
    item.kind,
    item.id || item.title || "reminder",
    item.date,
    item.time || "09:00"
  ].join("|");

  return crypto.createHash("sha256").update(identity).digest("hex");
}

async function sendTelegram(item, userId, redis) {
  const marker = makeMarker(userId, "telegram", item);
  const sentKey = `mylife:telegram:sent:${marker}`;
  const lockKey = `mylife:telegram:lock:${marker}`;

  if (await redis.get(sentKey)) return "duplicate";
  if (typeof item.skipKey === "function" && await redis.get(item.skipKey(userId))) return "skipped";

  const claimed = await redis.set(lockKey, "1", {
    nx: true,
    ex: 300
  });

  if (!claimed) return "duplicate";

  try {
    // Bot API with buttons first; Make.com webhook as the fallback.
    const result = await sendAlert(item, userId, redis);
    if (result === "sent") {
      await redis.set(sentKey, "1", {
        ex: SENT_TTL_SECONDS
      });
    }
    return result;
  } finally {
    await redis.del(lockKey);
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "method_not_allowed"
    });
  }

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return res.status(503).json({
      error: "cron_not_configured"
    });
  }

  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    console.warn("Rejected an unauthorized push dispatch request.");

    return res.status(401).json({
      error: "unauthorized"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({
      error: "supabase_server_credentials_missing"
    });
  }

  try {
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const redis = getRedis();
    const now = Date.now();
    const jobs = [];

    let offset = 0;
    const pageSize = 500;

    while (true) {
      const { data: rows, error } = await supabase
        .from("app_data")
        .select("user_id,payload")
        .order("user_id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      for (const row of rows || []) {
        const payload = parsePayload(row.payload);

        jobs.push({ channel: "backup", run: () => weeklyBackup(redis, row.user_id, row.payload) });
        jobs.push({ channel: "autopay", run: () => autoPayBills(supabase, redis, row.user_id, row.payload) });

        if (payload.profile?.notificationsEnabled === false) {
          continue;
        }

        const items = notificationItems(payload);

        // Send due alerts to Make.com / Telegram.
        // This works even if the user has no Web Push subscription.
        for (const item of items) {
          const dueAt = itemDueAt(item, APP_TIME_ZONE);

          if (
            dueAt === null ||
            dueAt < now - LOOKBACK_MS ||
            dueAt > now
          ) {
            continue;
          }

          jobs.push({
            channel: "telegram",
            run: () => sendTelegram(item, row.user_id, redis)
          });
        }

        // Keep existing Web Push notifications.
        const subscriptions = await getUserSubscriptions(row.user_id);

        for (const item of items) {
          if (["digest", "weekly", "budget", "evening", "weekly-image", "monthly-image", "backup-file", "autopay"].includes(item.kind)) continue;
          const title = String(item.title || "MYLIFE alert");
          const body = String(
            item.body || item.notes || item.category || "It is time."
          );
          const destination = String(item.url || "/#daily");

          for (const entry of subscriptions) {
            const dueAt = itemDueAt(item, entry.timeZone);

            if (
              dueAt === null ||
              dueAt < now - LOOKBACK_MS ||
              dueAt > now
            ) {
              continue;
            }

            jobs.push({ channel: "push", run: async () => {
              const marker = makeMarker(
                row.user_id,
                entry.endpoint,
                item
              );

              const sentKey = `mylife:push:sent:${marker}`;

              if (await redis.get(sentKey)) return "duplicate";

              const lockKey = `mylife:push:lock:${marker}`;

              const claimed = await redis.set(lockKey, "1", {
                nx: true,
                ex: 300
              });

              if (!claimed) return "duplicate";

              try {
                await sendToSubscription(
                  row.user_id,
                  entry.subscription,
                  {
                    title,
                    body,
                    url: destination
                  }
                );

                await redis.set(sentKey, "1", {
                  ex: SENT_TTL_SECONDS
                });

                return "sent";
              } finally {
                await redis.del(lockKey);
              }
            } });
          }
        }
      }

      if ((rows || []).length < pageSize) break;

      offset += pageSize;
    }

    const results = await Promise.allSettled(
      jobs.map(job => job.run())
    );

    // Snoozed alerts (⏰ buttons) and the bot webhook never block regular alerts.
    let snoozed = { sent: 0, failed: 0 };
    let webhook = "skipped";
    try {
      snoozed = await flushSnoozes(redis, now);
    } catch (error) {
      console.error("MYLIFE snooze flush failed.", error.message);
    }
    try {
      webhook = await ensureWebhook(redis);
    } catch (error) {
      webhook = "error";
      console.error("MYLIFE Telegram webhook setup failed.", error.message);
    }

    const breakdown = {
      telegram: { sent: 0, duplicate: 0, skipped: 0, failed: 0 },
      push: { sent: 0, duplicate: 0, skipped: 0, failed: 0 },
      backup: { saved: 0, recent: 0, too_big: 0, failed: 0 },
      autopay: { paid: 0, skipped: 0, duplicate: 0, failed: 0 }
    };

    results.forEach((result, index) => {
      const bucket = breakdown[jobs[index].channel];
      if (result.status === "rejected") {
        bucket.failed += 1;
        console.error(`MYLIFE ${jobs[index].channel} alert failed.`, result.reason);
        return;
      }
      if (bucket[result.value] !== undefined) bucket[result.value] += 1;
    });
    const alertJobs = jobs.filter(job => !["backup", "autopay"].includes(job.channel)).length;

    const sent = breakdown.telegram.sent + breakdown.push.sent;
    const failed = breakdown.telegram.failed + breakdown.push.failed;

    return res.status(200).json({
      ok: true,
      checked: alertJobs,
      sent,
      failed,
      telegram: breakdown.telegram,
      push: breakdown.push,
      snoozed,
      webhook,
      backup: breakdown.backup,
      autopay: breakdown.autopay
    });
  } catch (error) {
    console.error("MYLIFE scheduled notification dispatch failed.", error);

    return res.status(500).json({
      error: "notification_dispatch_failed"
    });
  }
};

// Shared with /api/telegram-webhook (the /today command).
module.exports.digestItem = digestItem;
module.exports.eveningItem = eveningItem;
module.exports.zonedTodayInput = zonedTodayInput;
