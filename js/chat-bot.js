/* MYLIFE Chat — talk to your own data (no outside AI, works offline).
 * Questions: today / tomorrow / this week, spending (by period and category),
 * money left, income, bills, loans, savings, goals, birthdays, family, hobbies,
 * memories. Commands: "ចាយ Grab 15k", "ស្អែក 9 ព្រឹក ជួបម៉ាក់", "បង់ EDC រួច",
 * "បើក ហិរញ្ញវត្ថុ". Every answer can carry buttons that open the right page.
 * It replaces the old Smart Assistant (same 🪄 button). */
const MyLifeChat = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const HISTORY_KEY = "mylife:chat-history";
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  let root = null;
  let history = [];
  let pending = {}; // actions waiting for a tap ("✓ save")

  const plainMoney = (value, currency) => String(money(value, currency)).replace(/<[^>]*>/g, "");
  const norm = text => String(text || "").toLowerCase().replace(/[០-៩]/g, ch => String("០១២៣៤៥៦៧៨៩".indexOf(ch))).trim();
  const shortDate = iso => {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    return km() ? `${d.getDate()} ${KM_MONTHS[d.getMonth()]}` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const daysWord = n => (n === 0 ? L("ថ្ងៃនេះ", "today") : n === 1 ? L("ស្អែក", "tomorrow") : L(`${n} ថ្ងៃទៀត`, `in ${n} days`));
  const li = items => `<ul class="mlc-list">${items.join("")}</ul>`;
  const row = (left, right = "") => `<li><span>${left}</span>${right ? `<b>${right}</b>` : ""}</li>`;
  const link = (label, href) => ({ label, href });
  const act = (label, run) => {
    const key = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    pending[key] = run;
    return { label, action: key };
  };

  /* ---------------- answers ---------------- */
  function agendaFor(day) {
    const items = [];
    appData.calendarEvents.filter(e => e.date === day).forEach(e => items.push({ time: e.time || "", text: e.title, icon: "📅" }));
    appData.reminders.filter(r => !r.done && r.date === day).forEach(r => items.push({ time: r.time || "", text: r.title, icon: "⏰" }));
    appData.bills.filter(b => b.due === day && b.status !== "Paid").forEach(b => items.push({ time: "", text: `${b.name} · ${plainMoney(b.amount, b.currency)}`, icon: "🧾" }));
    appData.family.forEach(m => {
      if (m.birthday && m.birthday.slice(5) === day.slice(5)) items.push({ time: "", text: L(`ថ្ងៃកំណើត ${m.name}`, `${m.name}'s birthday`), icon: "🎂" });
    });
    return items.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  }

  function answerDay(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const day = localDateInput(d);
    const items = agendaFor(day);
    const label = offset === 0 ? L("ថ្ងៃនេះ", "Today") : L("ស្អែក", "Tomorrow");
    if (!items.length) return { html: L(`${label} ទំនេរ 🎉 មិនមានអ្វីត្រូវធ្វើទេ។`, `${label} is free 🎉 Nothing planned.`), actions: [act(L("+ បន្ថែម event", "+ Add event"), () => App.openEventModal({ date: day }))] };
    return {
      html: `<p>${L(`${label} មាន ${items.length} រឿង៖`, `${label} you have ${items.length}:`)}</p>${li(items.map(i => row(`${i.icon} ${escapeHtml(i.text)}`, i.time ? fmtClock(i.time) : L("ពេញថ្ងៃ", "all day"))))}`,
      actions: [link(L("📅 បើកថ្ងៃនេះ", "📅 Open Today"), "#today")]
    };
  }

  function answerWeek() {
    const items = getUpcomingNotifications(7, 8);
    if (!items.length) return { html: L("៧ ថ្ងៃខាងមុខ ទំនេរ 🎉", "Nothing in the next 7 days 🎉") };
    return { html: `<p>${L("៧ ថ្ងៃខាងមុខ៖", "Next 7 days:")}</p>${li(items.map(i => row(escapeHtml(i.title), `${shortDate(i.date)} · ${daysWord(i.daysLeft)}`)))}`, actions: [link(L("📅 ប្រតិទិន", "📅 Calendar"), "#calendar")] };
  }

  function detectPeriod(q) {
    if (/ថ្ងៃនេះ|today/.test(q)) return "day";
    if (/សប្តាហ៍|week/.test(q)) return "week";
    if (/ឆ្នាំ|year/.test(q)) return "year";
    if (/ខែមុន|last month/.test(q)) return "lastMonth";
    return "month";
  }

  const CATEGORY_WORDS = {
    Food: /អាហារ|ញ៉ាំ|បាយ|កាហ្វេ|food|coffee|eat/,
    Transport: /grab|សាំង|ធ្វើដំណើរ|transport|taxi|fuel/,
    Bills: /វិក្កយបត្រ|ភ្លើង|ថ្លៃទឹក|bill/,
    Shopping: /ទិញឥវ៉ាន់|shopping|ខោអាវ/,
    Health: /ពេទ្យ|ថ្នាំ|health|doctor/,
    Home: /ផ្ទះ|ជួល|rent|home/,
    Family: /គ្រួសារ|family|កូន/,
    Education: /សាលា|រៀន|school|course/,
    Entertainment: /កម្សាន្ត|កុន|movie|game|netflix/
  };
  function detectCategory(q) {
    const byLabel = expenseCategories.find(cat => cat !== "Other" && (q.includes(cat.toLowerCase()) || q.includes(String(optionLabel(cat)).toLowerCase())));
    if (byLabel) return byLabel;
    return Object.entries(CATEGORY_WORDS).find(([, re]) => re.test(q))?.[0] || null;
  }

  function answerSpending(q) {
    const kind = detectPeriod(q);
    let range;
    if (kind === "lastMonth") {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      range = moneyPeriodRange({ kind: "month", anchor: localDateInput(d) });
    } else range = moneyPeriodRange({ kind, anchor: localDateInput() });
    let items = moneyExpensesIn(range);
    const cat = detectCategory(q);
    if (cat) items = items.filter(e => e.category === cat);
    const total = items.reduce((s, e) => s + toProfileCurrency(e.amount, e.currency), 0);
    const byCat = {};
    items.forEach(e => { byCat[e.category || "Other"] = (byCat[e.category || "Other"] || 0) + toProfileCurrency(e.amount, e.currency); });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const title = `${L("ចាយ", "Spent")}${cat ? ` ${optionLabel(cat)}` : ""} · ${range.label}`;
    return {
      html: `<p>${escapeHtml(title)}៖ <strong>${money(total)}</strong> (${items.length} ${L("ដង", items.length === 1 ? "time" : "times")})</p>${!cat && top.length ? li(top.map(([c, v]) => row(escapeHtml(optionLabel(c)), money(v)))) : ""}`,
      actions: [link(L("💰 មើលលុយ", "💰 Open Money"), "#money")]
    };
  }

  function answerLeft() {
    const m = moneyMonthNumbers();
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - today.getDate() + 1;
    const perDay = m.left > 0 ? m.left / daysLeft : 0;
    const fc = forecastLine();
    return {
      html: (m.left >= 0
        ? `<p>${L("ខែនេះនៅសល់", "Left this month")} <strong>${money(m.left)}</strong></p>${li([row(L("ចំណូល", "Income"), money(m.income)), row(L("ចាយ", "Spent"), money(m.expenses)), row(L("កម្ចី", "Loans"), money(m.loans)), row(L("អាចចាយ/ថ្ងៃ", "Can spend / day"), money(perDay))])}`
        : `<p>⚠️ ${L("ខែនេះខ្វះ", "Short this month by")} <strong>${money(-m.left)}</strong></p>${li([row(L("ចំណូល", "Income"), money(m.income)), row(L("ចាយ", "Spent"), money(m.expenses)), row(L("កម្ចី", "Loans"), money(m.loans))])}`) + fc,
      actions: [link(L("💰 មើលលុយ", "💰 Open Money"), "#money")]
    };
  }
  function forecastLine() {
    if (typeof MoneyInsights === "undefined") return "";
    const f = MoneyInsights.monthForecast(appData, localDateInput(), { leftNow: moneyMonthNumbers().left });
    const line = f.left < 0
      ? L(`🔮 បើចាយបែបនេះ ចុងខែនឹងខ្វះ ${plainMoney(Math.abs(f.left))}`, `🔮 At this pace you'll be short ${plainMoney(Math.abs(f.left))} by month-end`)
      : L(`🔮 បើចាយបែបនេះ ចុងខែនឹងនៅសល់ ${plainMoney(f.left)}`, `🔮 At this pace ${plainMoney(f.left)} will be left at month-end`);
    const budget = f.budgets[0];
    const extra = budget ? (budget.over ? L(` · ថវិកា${optionLabel(budget.category)} លើសហើយ`, ` · ${optionLabel(budget.category)} budget is over`) : L(` · ថវិកា${optionLabel(budget.category)} នឹងអស់ថ្ងៃទី ${budget.day}`, ` · ${optionLabel(budget.category)} budget runs out ~day ${budget.day}`)) : "";
    return `<p class="mlc-note">${escapeHtml(line + extra)}</p>`;
  }


  function answerIncome() {
    const m = moneyMonthNumbers();
    return { html: `<p>${L("ចំណូលខែនេះ", "Income this month")}: <strong>${money(m.income)}</strong></p>${li(appData.income.slice(0, 5).map(i => row(escapeHtml(i.name || ""), money(i.amount, i.currency))))}`, actions: [link(L("ចំណូល", "Income"), "#money/income")] };
  }

  function answerBills() {
    const today = localDateInput();
    // same rule as Home: recurring bills show their next cycle date; only one-time bills can be overdue
    const horizon = new Date(); horizon.setDate(horizon.getDate() + 60);
    const due = appData.bills
      .filter(b => b.due && b.status !== "Paid" && !(typeof billPaidCurrentCycle === "function" && billPaidCurrentCycle(b)))
      .map(b => {
        if ((b.frequency || "Monthly") === "Once" || typeof billCycleDates !== "function") return b;
        const next = billCycleDates(b, today, localDateInput(horizon))[0];
        return next ? { ...b, due: next } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 6);
    if (!due.length) return { html: L("គ្មានវិក្កយបត្រត្រូវបង់ទេ ✅", "No bills to pay ✅") };
    return {
      html: `<p>${L("វិក្កយបត្រត្រូវបង់៖", "Bills to pay:")}</p>${li(due.map(b => row(`${b.due < today ? "⚠️ " : ""}${escapeHtml(b.name)} · ${money(b.amount, b.currency)}`, b.due < today ? L("ហួសថ្ងៃ", "overdue") : shortDate(b.due))))}`,
      actions: [...due.slice(0, 2).map(b => act(L(`✓ បង់ ${b.name} រួច`, `✓ Paid ${b.name}`), () => { markBillPaid(b.id); return L(`បានកត់ ${b.name} ថាបង់រួច ✅`, `${b.name} marked as paid ✅`); })), link(L("🧾 វិក្កយបត្រ", "🧾 Bills"), "#money/bills")]
    };
  }

  function answerLoans() {
    if (!appData.loans.length) return { html: L("មិនមានកម្ចីទេ 👍", "No loans 👍") };
    return { html: li(appData.loans.map(l => row(escapeHtml(l.name || ""), `${money(l.monthlyPayment, l.currency)}/${L("ខែ", "mo")}`))), actions: [link(L("💳 កម្ចី", "💳 Loans"), "#money/loans")] };
  }

  function answerSavings() {
    const total = sumMoney(appData.savings, "currentAmount");
    return { html: `<p>${L("សន្សំសរុប", "Total savings")}: <strong>${money(total)}</strong></p>${li(appData.savings.slice(0, 5).map(s => row(escapeHtml(s.name || ""), money(s.currentAmount, s.currency))))}`, actions: [link(L("🏦 សន្សំ", "🏦 Savings"), "#money/savings")] };
  }

  function answerGoals(q) {
    const named = appData.goals.find(g => g.name && q.includes(String(g.name).toLowerCase().slice(0, 6)));
    const goals = named ? [named] : appData.goals.slice(0, 5);
    if (!goals.length) return { html: L("មិនទាន់មានគោលដៅទេ។", "No goals yet."), actions: [act(L("+ បង្កើតគោលដៅ", "+ New goal"), () => openGoalModal())] };
    return {
      html: li(goals.map(g => {
        const target = Number(g.targetAmount) || 0;
        const pct = target ? Math.min(100, Math.round((Number(g.currentAmount) || 0) / target * 100)) : null;
        return row(escapeHtml(g.name), pct === null ? (g.deadline ? shortDate(g.deadline) : "") : `${pct}% · ${money(g.currentAmount)} / ${money(target)}`);
      })) + (named && typeof SmartMoney !== "undefined" ? SmartMoney.goalPace(named) : ""),
      actions: [link(L("🎯 គោលដៅ", "🎯 Goals"), "#goals")]
    };
  }

  function upcomingFamilyDates() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list = [];
    appData.family.forEach(m => {
      if (m.birthday) list.push({ name: m.name, kind: "🎂", days: Math.round((nextYearlyDate(m.birthday, today) - today) / 86400000) });
      if (m.anniversaryDate) list.push({ name: m.name, kind: "💞", days: Math.round((nextYearlyDate(m.anniversaryDate, today) - today) / 86400000) });
    });
    return list.sort((a, b) => a.days - b.days);
  }

  function answerBirthdays() {
    const list = upcomingFamilyDates().slice(0, 5);
    if (!list.length) return { html: L("មិនទាន់មានថ្ងៃកំណើតក្នុងគ្រួសារទេ។", "No birthdays saved yet."), actions: [link(L("👨‍👩‍👧 គ្រួសារ", "👨‍👩‍👧 Family"), "#family")] };
    return { html: li(list.map(i => row(`${i.kind} ${escapeHtml(i.name)}`, daysWord(i.days)))), actions: [link(L("👨‍👩‍👧 គ្រួសារ", "👨‍👩‍👧 Family"), "#family")] };
  }

  function answerPerson(member) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = [row(L("ទំនាក់ទំនង", "Relationship"), escapeHtml(optionLabel(member.relationship || "")) || "—")];
    if (member.birthday) parts.push(row(L("ថ្ងៃកំណើត", "Birthday"), `${shortDate(member.birthday)} · ${daysWord(Math.round((nextYearlyDate(member.birthday, today) - today) / 86400000))}`));
    if (member.phone) parts.push(row(L("ទូរស័ព្ទ", "Phone"), escapeHtml(member.phone)));
    if (member.favorite) parts.push(row(L("ចូលចិត្ត", "Likes"), escapeHtml(member.favorite)));
    const memories = appData.memories.filter(m => String(m.familyMembers || "").toLowerCase().includes(member.name.trim().toLowerCase())).length;
    if (memories) parts.push(row(L("អនុស្សាវរីយ៍", "Memories"), String(memories)));
    return { html: `<p><strong>${escapeHtml(member.name)}</strong></p>${li(parts)}`, actions: [act(L("✏️ កែ", "✏️ Edit"), () => openFamilyModal(member)), link(L("👨‍👩‍👧 គ្រួសារ", "👨‍👩‍👧 Family"), "#family")] };
  }

  function answerHobbies() {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const week = appData.hobbyLogs.filter(h => h.date >= localDateInput(since));
    const minutes = week.reduce((s, h) => s + (Number(h.minutes) || 0), 0);
    const byTitle = {};
    week.forEach(h => { byTitle[h.title] = (byTitle[h.title] || 0) + 1; });
    return {
      html: `<p>${L("៧ ថ្ងៃនេះ", "Last 7 days")}: <strong>${week.length}</strong> ${L("ដង", week.length === 1 ? "time" : "times")} · ${fmtMinutes(minutes)}</p>${li(Object.entries(byTitle).slice(0, 5).map(([t2, n]) => row(escapeHtml(t2), `${n}×`)))}`,
      actions: [act(L("+ កត់ចំណង់ចំណូលចិត្ត", "+ Log a hobby"), () => App.openHobbyModal()), link(L("✨ ជីវិតប្រចាំថ្ងៃ", "✨ Daily life"), "#daily")]
    };
  }

  function fmtMinutes(m) {
    if (!m) return L("0 នាទី", "0 min");
    const h = Math.floor(m / 60);
    const r = m % 60;
    return h ? L(`${h} ម៉ោង${r ? ` ${r} នាទី` : ""}`, `${h} h${r ? ` ${r} min` : ""}`) : L(`${r} នាទី`, `${r} min`);
  }

  function answerMemories() {
    const today = localDateInput();
    const onThisDay = appData.memories.filter(m => m.date && m.date.slice(5) === today.slice(5) && m.date < today);
    const latest = appData.memories.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const lines = [row(L("សរុប", "Total"), String(appData.memories.length))];
    if (latest) lines.push(row(L("ចុងក្រោយ", "Latest"), `${escapeHtml(latest.title)} · ${shortDate(latest.date)}`));
    onThisDay.forEach(m => lines.push(row(`🕰 ${L("ថ្ងៃនេះកាលពី", "On this day")} ${m.date.slice(0, 4)}`, escapeHtml(m.title))));
    return { html: li(lines), actions: [act(L("+ អនុស្សាវរីយ៍", "+ Memory"), () => openMemoryModal()), link(L("📸 អនុស្សាវរីយ៍", "📸 Memories"), "#memories")] };
  }

  const PAGES = [
    [/ហិរញ្ញវត្ថុ|លុយ|money|finance/, "#money"], [/របាយការណ៍|report/, "#money/reports"], [/ប្រតិទិន|calendar/, "#calendar"],
    [/គ្រួសារ|family/, "#family"], [/គោលដៅ|goal/, "#goals"], [/ថ្ងៃនេះ|today/, "#today"], [/អនុស្សាវរីយ៍|memor/, "#memories"],
    [/ការកំណត់|setting/, "#settings"], [/ជីវិតប្រចាំថ្ងៃ|daily/, "#daily"], [/ថវិកា|budget/, "#money/budget"], [/វិក្កយបត្រ|bill/, "#money/bills"]
  ];

  /* ---------------- commands ---------------- */
  function commandExpense(raw) {
    if (typeof ExpenseForm === "undefined" || !ExpenseForm.parseExpense) return null;
    const parsed = ExpenseForm.parseExpense(raw);
    if (!parsed.amount) return { html: L("ចំនួនប៉ុន្មាន? ឧ. <code>ចាយ Grab 15k</code> ឬ <code>ចាយ 5$ អាហារ</code>", "How much? e.g. <code>spent 5$ food</code>") };
    const record = { description: parsed.description || optionLabel(parsed.category), amount: parsed.amount, currency: parsed.currency, category: parsed.category, date: localDateInput(), method: "" };
    return {
      html: `<p>${L("កត់ចំណាយនេះ?", "Save this expense?")}</p>${li([row(L("ចំនួន", "Amount"), money(record.amount, record.currency)), row(L("ប្រភេទ", "Category"), escapeHtml(optionLabel(record.category))), row(L("ការពិពណ៌នា", "Note"), escapeHtml(record.description))])}`,
      actions: [
        act(L("✓ កត់", "✓ Save"), () => { Store.add("expenses", record); return L(`បានកត់ ${plainMoney(record.amount, record.currency)} · ${optionLabel(record.category)} 💸`, `Saved ${plainMoney(record.amount, record.currency)} · ${record.category} 💸`); }),
        act(L("✏️ កែក្នុង form", "✏️ Edit in form"), () => { close(); openExpenseModal(record); })
      ]
    };
  }

  // money lines in the same format as the Telegram bot (shared SmartParse)
  function commandMoney(entries) {
    const today = localDateInput();
    const records = entries.map(entry => entry.type === "income"
      ? { collection: "income", record: { name: entry.description || optionLabel(entry.category), amount: entry.amount, currency: entry.currency, category: entry.category, frequency: "Once", recurring: false, nextPaymentDate: entry.date || today, notes: "" } }
      : { collection: "expenses", record: { description: entry.description || optionLabel(entry.category), amount: entry.amount, currency: entry.currency, category: entry.category, date: entry.date || today, method: "" } });
    const rows = records.map(({ collection, record }) => {
      const day = (record.date || record.nextPaymentDate) !== today ? ` · ${formatDate(record.date || record.nextPaymentDate)}` : "";
      return row(`${escapeHtml(optionLabel(record.category))}${record.description || record.name ? ` · ${escapeHtml(record.description || record.name)}` : ""}${escapeHtml(day)}`, `${collection === "income" ? "+" : "−"}${plainMoney(record.amount, record.currency)}`);
    });
    const single = records.length === 1 ? records[0] : null;
    const title = single
      ? (single.collection === "income" ? L("កត់ចំណូលនេះ?", "Save this income?") : L("កត់ចំណាយនេះ?", "Save this expense?"))
      : L(`កត់ទាំង ${records.length} នេះ?`, `Save these ${records.length}?`);
    const save = () => {
      records.forEach(({ collection, record }) => Store.add(collection, { ...record }));
      return single
        ? L(`បានកត់ ${plainMoney(single.record.amount, single.record.currency)} · ${optionLabel(single.record.category)} ✅`, `Saved ${plainMoney(single.record.amount, single.record.currency)} · ${optionLabel(single.record.category)} ✅`)
        : L(`បានកត់ ${records.length} មុខ ✅`, `Saved ${records.length} items ✅`);
    };
    const actions = [act(L("✓ កត់", "✓ Save"), save)];
    if (single && single.collection === "expenses") actions.push(act(L("✏️ កែក្នុង form", "✏️ Edit in form"), () => { close(); openExpenseModal(single.record); }));
    return { html: `<p>${title}</p>${li(rows)}`, actions };
  }

  function commandEvent(raw) {
    if (typeof EventForm === "undefined" || !EventForm.parseSmart) return null;
    const found = EventForm.parseSmart(raw);
    if (!found.date && !found.time) return null;
    const title = (found.title || raw)
      .replace(/ស្អែក|ខានស្អែក|ថ្ងៃនេះ|tomorrow|today|ម៉ោង\s*\d{1,2}(:\d{2})?|\d{1,2}(:\d{2})?\s*(ព្រឹក|រសៀល|ល្ងាច|យប់|am|pm)/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || raw;
    const event = { title, date: found.date || localDateInput(), time: found.time || "", category: found.category || "Personal", reminder: true, remindBefore: 0 };
    return {
      html: `<p>${L("បន្ថែម event នេះ?", "Add this event?")}</p>${li([row(L("ចំណងជើង", "Title"), escapeHtml(event.title)), row(L("ថ្ងៃ", "Date"), formatDate(event.date)), row(L("ម៉ោង", "Time"), event.time ? fmtClock(event.time) : L("ពេញថ្ងៃ", "All day"))])}<small class="mlc-note">🔔 ${L("Telegram នឹងរំលឹក", "Telegram will remind you")}</small>`,
      actions: [
        act(L("✓ បន្ថែម", "✓ Add"), () => { Store.add("calendarEvents", event); return L(`បានបន្ថែម "${event.title}" ${formatDate(event.date)} 📅`, `Added "${event.title}" on ${formatDate(event.date)} 📅`); }),
        act(L("✏️ កែក្នុង form", "✏️ Edit in form"), () => { close(); App.openEventModal(event); })
      ]
    };
  }

  function commandPaid(q) {
    const bill = appData.bills.find(b => b.name && q.includes(String(b.name).toLowerCase()));
    if (!bill) return null;
    if (typeof billPaidCurrentCycle === "function" && billPaidCurrentCycle(bill)) return { html: L(`${escapeHtml(bill.name)} បានបង់រួចហើយ ✅`, `${escapeHtml(bill.name)} is already paid ✅`) };
    return { html: L(`កត់ <strong>${escapeHtml(bill.name)}</strong> (${money(bill.amount, bill.currency)}) ថាបង់រួច?`, `Mark <strong>${escapeHtml(bill.name)}</strong> (${money(bill.amount, bill.currency)}) as paid?`), actions: [act(L("✓ បង់រួច", "✓ Paid"), () => { markBillPaid(bill.id); return L(`${bill.name} បង់រួច ✅ កត់ជាចំណាយហើយ`, `${bill.name} paid ✅ saved as an expense`); })] };
  }

  function help() {
    return {
      html: `<p>${L("ខ្ញុំអាចជួយ៖", "I can help with:")}</p>${li([
        row(L("📅 ថ្ងៃនេះ / ស្អែក / សប្តាហ៍នេះ មានអ្វី?", "📅 What's on today / tomorrow / this week?")),
        row(L("💸 ខែនេះចាយប៉ុន្មាន? ចាយអាហារប៉ុន្មាន?", "💸 How much did I spend this month? On food?")),
        row(L("💰 នៅសល់ប៉ុន្មាន? ចំណូល សន្សំ កម្ចី", "💰 How much is left? Income, savings, loans")),
        row(L("🧾 វិក្កយបត្រណាត្រូវបង់? · បង់ EDC រួច", "🧾 Which bills to pay? · paid EDC")),
        row(L("🎯 គោលដៅ · 🎂 ថ្ងៃកំណើត · ឈ្មោះគ្រួសារ", "🎯 Goals · 🎂 Birthdays · a family name")),
        row(L("✍️ ចាយ Grab 15k · ស្អែក 9 ព្រឹក ជួបម៉ាក់", "✍️ spent Grab 15k · tomorrow 9am meet mom")),
        row(L("🧭 បើក របាយការណ៍", "🧭 open reports"))
      ])}`
    };
  }

  /* ---------------- router ---------------- */
  function reply(raw) {
    const q = norm(raw);
    if (!q) return help();
    if (/^(ជំនួយ|help|\/help|អាចធ្វើអ្វី|what can)/.test(q)) return help();
    if (/^(សួស្តី|ជម្រាបសួរ|hello|hey|hi(?![a-z]))/.test(q)) {
      const name = String(appData.profile.name || "").split(/\s+/)[0];
      return { html: L(`សួស្តី${name ? ` ${escapeHtml(name)}` : ""} 👋 ចង់ដឹងអ្វីថ្ងៃនេះ?`, `Hi${name ? ` ${escapeHtml(name)}` : ""} 👋 What would you like to know?`) };
    }
    // commands first
    if (/^(បើក|ទៅ|open|go to|show)\s/.test(q)) {
      const page = PAGES.find(([re]) => re.test(q));
      if (page) return { html: L("កំពុងបើក…", "Opening…"), go: page[1] };
    }
    if (/(បង់|paid|pay).*(រួច|done|already)|^(paid|បង់រួច)\s/.test(q)) {
      const paid = commandPaid(q);
      if (paid) return paid;
    }
    if (/\d/.test(q) && !/[?？]|ប៉ុន្មាន|how much/.test(q)) {
      const entries = typeof SmartParse !== "undefined"
        ? raw.split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => SmartParse.parseMoney(line, appData.profile.currency || "USD", localDateInput())).filter(Boolean)
        : [];
      if (entries.length) return commandMoney(entries);
      if (/^(ចាយ|ចំណាយ|spent|spend|ទិញ|bought)\s/.test(q)) {
        const exp = commandExpense(raw);
        if (exp) return exp;
      }
    }
    const isQuestion = /[?？]|អ្វី|ប៉ុន្មាន|ណា|what|how|which|when|who|មានទេ|ឬទេ/.test(q);
    if (!isQuestion && /(ស្អែក|ខានស្អែក|tomorrow|ថ្ងៃ(ច័ន្ទ|អង្គារ|ពុធ|ព្រហ|សុក្រ|សៅរ៍|អាទិត្យ)|ម៉ោង|\d\s*(ព្រឹក|រសៀល|ល្ងាច|យប់|am|pm))/.test(q)) {
      const ev = commandEvent(raw);
      if (ev) return ev;
    }
    // questions
    const member = appData.family.find(m => m.name && m.name.trim().length > 1 && q.includes(m.name.trim().toLowerCase()));
    if (member && !/ថ្ងៃកំណើត|birthday/.test(q)) return answerPerson(member);
    if (/ចាយ|ចំណាយ|spent|spend|expense/.test(q)) return answerSpending(q);
    if (/សល់|left|balance|អាចចាយ|ខ្វះ/.test(q)) return answerLeft();
    if (/វិក្កយបត្រ|bill/.test(q)) return answerBills();
    if (/ចំណូល|income|salary|ប្រាក់ខែ/.test(q)) return answerIncome();
    if (/កម្ចី|loan|បំណុល|debt/.test(q)) return answerLoans();
    if (/គោលដៅ|goal/.test(q)) return answerGoals(q);
    if (/សន្សំ|saving/.test(q)) return answerSavings();
    if (/ថ្ងៃកំណើត|birthday|ខួប|anniversar/.test(q)) return answerBirthdays();
    if (/ចំណង់ចំណូលចិត្ត|hobby|hobbies|ហាត់|gym|អាន|streak/.test(q)) return answerHobbies();
    if (/អនុស្សាវរីយ៍|memor|រូបថត/.test(q)) return answerMemories();
    if (/ស្អែក|tomorrow/.test(q)) return answerDay(1);
    if (/សប្តាហ៍|week|ជិតមកដល់|upcoming|coming/.test(q)) return answerWeek();
    if (/ថ្ងៃនេះ|today|plan|schedule|កាលវិភាគ/.test(q)) return answerDay(0);
    const page = PAGES.find(([re]) => re.test(q));
    if (page) return { html: L("បើកទំព័រនេះ?", "Open this page?"), actions: [link("→ " + L("បើក", "Open"), page[1])] };
    // last try: search titles
    const hits = [];
    const look = (list, key, href, icon) => list.forEach(x => { if (String(x[key] || "").toLowerCase().includes(q)) hits.push(row(`${icon} ${escapeHtml(x[key])}`, x.date ? shortDate(x.date) : "")); });
    if (q.length >= 2) {
      look(appData.calendarEvents, "title", "#calendar", "📅");
      look(appData.expenses, "description", "#money/expenses", "💸");
      look(appData.memories, "title", "#memories", "📸");
      look(appData.bills, "name", "#money/bills", "🧾");
    }
    if (hits.length) return { html: `<p>${L("រកឃើញ៖", "Found:")}</p>${li(hits.slice(0, 6))}` };
    return { html: L("ខ្ញុំមិនទាន់យល់សំណួរនេះទេ 🙏 សាកសួរម្យ៉ាងទៀត ឬចុចសំណួរខាងក្រោម។", "I didn't get that yet 🙏 Try asking another way or tap a suggestion below."), suggest: true };
  }

  /* ---------------- Gemini AI (when a key is set in Settings → AI) ---------------- */
  const aiSettings = () => (typeof AiAssist !== "undefined" ? AiAssist.settingsOf(appData) : null);
  const aiReady = () => Boolean(aiSettings()?.enabled);
  const wantsAi = text => /^(ai|🤖)\s*/i.test(text) || /ដំបូន្មាន|ណែនាំ|គួរ|ហេតុអ្វី|វិភាគ|ប្រៀបធៀប|សន្សំបានម៉េច|advice|advise|suggest|tips?\b|why|analy[sz]e|compare|should i/i.test(text);
  const aiFoot = () => `<small class="mlc-note">🤖 Gemini · ${L("អាចខុសបាន សូមពិនិត្យ", "may be wrong, please check")}</small>`;

  async function aiAnswer(text, offline) {
    const settings = aiSettings();
    const today = localDateInput();
    const question = text.replace(/^(ai|🤖)\s*/i, "");
    try {
      if (/ដំបូន្មានលុយ|^money advice/i.test(question)) {
        const out = await AiAssist.advice(appData, { today, settings, km: km() });
        return { html: `<p>${AiAssist.toHtml(out, escapeHtml).replace(/\n/g, "<br>")}</p>${aiFoot()}`, actions: [link(L("💰 មើលលុយ", "💰 Open Money"), "#money")] };
      }
      if (!offline.suggest || AiAssist.looksLikeQuestion(question)) {
        const out = await AiAssist.ask(appData, question, { today, settings });
        return { html: `<p>${AiAssist.toHtml(out, escapeHtml).replace(/\n/g, "<br>")}</p>${aiFoot()}` };
      }
      // a message the offline parser could not read → let Gemini turn it into a record
      const parsed = await AiAssist.parseText(appData, question, { today, settings });
      if (parsed.type === "expense" || parsed.type === "income") {
        const out = commandMoney(parsed.items.map(item => ({ ...item, type: parsed.type })));
        return { ...out, html: `${out.html}${aiFoot()}` };
      }
      if (parsed.type === "event" && parsed.event) {
        const event = { ...parsed.event, reminder: true, remindBefore: 0 };
        return {
          html: `<p>${L("បន្ថែម event នេះ?", "Add this event?")}</p>${li([row(L("ចំណងជើង", "Title"), escapeHtml(event.title)), row(L("ថ្ងៃ", "Date"), formatDate(event.date)), row(L("ម៉ោង", "Time"), event.time ? fmtClock(event.time) : L("ពេញថ្ងៃ", "All day"))])}${aiFoot()}`,
          actions: [
            act(L("✓ បន្ថែម", "✓ Add"), () => { Store.add("calendarEvents", event); return L(`បានបន្ថែម "${event.title}" ${formatDate(event.date)} 📅`, `Added "${event.title}" on ${formatDate(event.date)} 📅`); }),
            act(L("✏️ កែក្នុង form", "✏️ Edit in form"), () => { close(); App.openEventModal(event); })
          ]
        };
      }
      if (parsed.type === "question") {
        const out = await AiAssist.ask(appData, question, { today, settings });
        return { html: `<p>${AiAssist.toHtml(out, escapeHtml).replace(/\n/g, "<br>")}</p>${aiFoot()}` };
      }
      return parsed.reply ? { html: `<p>${escapeHtml(parsed.reply)}</p>${aiFoot()}` } : offline;
    } catch (error) {
      console.warn("MYLIFE AI:", error.code || error.message);
      return { html: `<p>🤖 ${escapeHtml(AiAssist.errorText(error, km(), true))}</p>`, actions: ["bad_key", "no_key", "api_off", "restricted"].includes(error.code) ? [link(L("⚙️ ការកំណត់ AI", "⚙️ AI settings"), "#settings/ai")] : [] };
    }
  }

  /* ---------------- UI ---------------- */
  const SUGGESTIONS = () => [...(aiReady() ? [L("🤖 ដំបូន្មានលុយ", "🤖 Money advice")] : []), ...(km()
    ? ["ថ្ងៃនេះមានអ្វី?", "ខែនេះចាយប៉ុន្មាន?", "នៅសល់ប៉ុន្មាន?", "វិក្កយបត្រណាត្រូវបង់?", "ថ្ងៃកំណើតជិតដល់", "គោលដៅ", "ជំនួយ"]
    : ["What's on today?", "How much did I spend this month?", "How much is left?", "Which bills to pay?", "Upcoming birthdays", "Goals", "Help"])];

  function saveHistory() {
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-30).map(m => ({ from: m.from, html: m.html })))); } catch (error) { /* ignore */ }
  }
  function loadHistory() {
    try { history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]"); } catch (error) { history = []; }
  }

  function bubble(msg) {
    const actions = (msg.actions || []).map(a => a.href
      ? `<a class="mlc-btn" href="${escapeAttr(a.href)}" data-mlc-link>${escapeHtml(a.label)}</a>`
      : `<button class="mlc-btn" type="button" data-mlc-action="${escapeAttr(a.action)}">${escapeHtml(a.label)}</button>`).join("");
    return `<div class="mlc-msg mlc-${msg.from}"><div class="mlc-bubble">${msg.html}${actions ? `<div class="mlc-actions">${actions}</div>` : ""}</div></div>`;
  }

  function renderMessages() {
    const box = root.querySelector("[data-mlc-messages]");
    box.innerHTML = history.map(bubble).join("");
    box.scrollTop = box.scrollHeight;
  }

  function push(msg) {
    history.push(msg);
    saveHistory();
    renderMessages();
  }

  function ask(text) {
    const clean = String(text || "").trim();
    if (!clean) return;
    push({ from: "me", html: escapeHtml(clean) });
    const typing = document.createElement("div");
    typing.className = "mlc-msg mlc-bot mlc-typing";
    typing.innerHTML = '<div class="mlc-bubble"><i></i><i></i><i></i></div>';
    root.querySelector("[data-mlc-messages]").appendChild(typing);
    root.querySelector("[data-mlc-messages]").scrollTop = 1e9;
    setTimeout(async () => {
      let answer;
      try { answer = reply(clean); } catch (error) { answer = { html: L("មានបញ្ហាបន្តិច 🙏 សាកម្ដងទៀត។", "Something went wrong 🙏 Please try again.") }; console.warn(error); }
      // Gemini: advice / "why" questions, and anything the offline answers did not understand
      if (aiReady() && (answer.suggest || wantsAi(clean))) {
        answer = await aiAnswer(clean, answer);
        if (!root) return;
      }
      typing.remove();
      push({ from: "bot", html: answer.html, actions: answer.actions });
      if (typeof Sound !== "undefined") Sound.play("pop");
      if (answer.go) setTimeout(() => { close(); location.hash = answer.go; }, 450);
    }, 280);
  }

  function open() {
    if (root) return;
    loadHistory();
    pending = {};
    if (!history.length) {
      const name = String(appData.profile.name || "").split(/\s+/)[0];
      history.push({ from: "bot", html: L(`សួស្តី${name ? ` ${escapeHtml(name)}` : ""} 👋 ខ្ញុំជា MYLIFE Chat។ សួរខ្ញុំពីថ្ងៃនេះ លុយ វិក្កយបត្រ គោលដៅ ឬគ្រួសារ — ឬវាយ <code>ចាយ Grab 15k</code> ដើម្បីកត់ភ្លាម។`, `Hi${name ? ` ${escapeHtml(name)}` : ""} 👋 I'm MYLIFE Chat. Ask me about today, money, bills, goals or family — or type <code>spent Grab 15k</code> to log it.`) });
    }
    root = document.createElement("div");
    root.className = "mlc-overlay";
    root.innerHTML = `
      <section class="mlc-panel" role="dialog" aria-modal="true" aria-label="MYLIFE Chat">
        <header class="mlc-head">
          <span class="mlc-avatar">${Icons.spark()}</span>
          <div><strong>MYLIFE Chat</strong><small>${aiReady() ? L("ឆ្លើយពីទិន្នន័យរបស់អ្នក · 🤖 Gemini AI បើក", "Answers from your data · 🤖 Gemini AI on") : L("ឆ្លើយពីទិន្នន័យរបស់អ្នក · ឯកជន", "Answers from your data · private")}</small></div>
          <button class="icon-button" type="button" data-mlc-clear title="${L("សម្អាត", "Clear")}" aria-label="${L("សម្អាត", "Clear")}">${Icons.trash()}</button>
          <button class="icon-button" type="button" data-mlc-close aria-label="${L("បិទ", "Close")}">${Icons.close()}</button>
        </header>
        <div class="mlc-messages" data-mlc-messages></div>
        <div class="mlc-suggest">${SUGGESTIONS().map(s => `<button type="button" data-mlc-suggest>${escapeHtml(s)}</button>`).join("")}</div>
        <form class="mlc-input" data-mlc-form>
          <input type="text" autocomplete="off" placeholder="${escapeAttr(L("សួរ ឬវាយ៖ ចាយ Grab 15k…", "Ask or type: spent Grab 15k…"))}" data-mlc-text>
          <button type="submit" class="mlc-send" aria-label="${L("ផ្ញើ", "Send")}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button>
        </form>
      </section>`;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add("open"));
    renderMessages();
    const input = root.querySelector("[data-mlc-text]");
    setTimeout(() => input.focus(), 120);
    root.addEventListener("click", event => {
      if (event.target === root || event.target.closest("[data-mlc-close]")) return close();
      if (event.target.closest("[data-mlc-clear]")) {
        history = [];
        saveHistory();
        close();
        open();
        return;
      }
      const suggestion = event.target.closest("[data-mlc-suggest]");
      if (suggestion) return ask(suggestion.textContent);
      const linkEl = event.target.closest("[data-mlc-link]");
      if (linkEl) return close();
      const actionEl = event.target.closest("[data-mlc-action]");
      if (actionEl) {
        const run = pending[actionEl.dataset.mlcAction];
        if (!run) return;
        delete pending[actionEl.dataset.mlcAction];
        actionEl.closest(".mlc-actions")?.querySelectorAll("button").forEach(b => (b.disabled = true));
        const result = run();
        if (typeof result === "string") push({ from: "bot", html: escapeHtml(result) });
      }
    });
    root.querySelector("[data-mlc-form]").addEventListener("submit", event => {
      event.preventDefault();
      ask(input.value);
      input.value = "";
    });
    document.addEventListener("keydown", escClose);
  }

  function escClose(event) {
    if (event.key === "Escape") close();
  }

  function close() {
    if (!root) return;
    const node = root;
    root = null;
    document.removeEventListener("keydown", escClose);
    node.classList.remove("open");
    setTimeout(() => node.remove(), 200);
  }

  return { open, close, ask, reply };
})();

// The 🪄 button, the + menu and Home all open the chat now.
if (typeof SmartAssistant !== "undefined") SmartAssistant.open = () => MyLifeChat.open();
