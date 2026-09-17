const STORAGE_KEY = "mylife:user-data:v1";
const SUPABASE_TABLE = "app_data";

const getSupabaseConfig = () => {
  const config = window.MYLIFE_SUPABASE || {};
  const url = String(config.url || window.SUPABASE_URL || "").trim();
  const anonKey = String(config.anonKey || window.SUPABASE_ANON_KEY || "").trim();
  const hasPlaceholder = url.includes("YOUR-PROJECT") || anonKey.includes("YOUR-");
  return {
    url,
    anonKey,
    enabled: Boolean(url && anonKey && !hasPlaceholder)
  };
};

const getSupabaseClient = () => window.supabaseClient || null;

const isSupabaseReady = () => {
  const client = getSupabaseClient();
  const { enabled } = getSupabaseConfig();
  return Boolean(client && enabled);
};

const emptyData = {
  profile: {
    name: "",
    email: "",
    photo: "",
    launcherCover: "",
    currency: "USD",
    language: "English",
    dateFormat: "MMM d, yyyy",
    theme: "light",
    moneyHidden: false
  },
  mood: {
    date: "",
    value: "",
    label: "",
    robot: ""
  },
  moodHistory: [],
  dailyReflection: {
    date: "",
    text: ""
  },
  dailyFocus: {
    date: "",
    items: []
  },
  family: [],
  goals: [],
  income: [],
  expenses: [],
  savings: [],
  loans: [],
  bills: [],
  calendarEvents: [],
  memories: []
};

const mergeAppData = (base, update) => {
  const baseValue = base && typeof base === "object" ? structuredClone(base) : {};
  const updateValue = update && typeof update === "object" ? update : {};

  const merged = Array.isArray(baseValue) ? [...baseValue] : { ...baseValue };

  Object.keys(updateValue).forEach((key) => {
    const nextValue = updateValue[key];
    const currentValue = merged[key];

    if (Array.isArray(nextValue)) {
      merged[key] = structuredClone(nextValue);
      return;
    }

    if (nextValue && typeof nextValue === "object" && currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)) {
      merged[key] = mergeAppData(currentValue, nextValue);
      return;
    }

    merged[key] = structuredClone(nextValue);
  });

  return merged;
};

const appData = structuredClone(emptyData);

const Store = {
  async syncFromSupabase() {
    if (!isSupabaseReady()) return false;

    try {
      const client = getSupabaseClient();
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) return false;

      const { data, error } = await client
        .from(SUPABASE_TABLE)
        .select("payload")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("MYLIFE could not load data from Supabase.", error);
        return false;
      }

      if (!data || !data.payload) return false;

      const remotePayload = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
      Object.assign(appData, structuredClone(emptyData), remotePayload || {});
      appData.profile = { ...emptyData.profile, ...(appData.profile || {}) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
      return true;
    } catch (error) {
      console.warn("MYLIFE could not sync from Supabase.", error);
      return false;
    }
  },
  async syncToSupabase() {
    if (!isSupabaseReady()) return false;

    try {
      this.migrateLegacyLocalData();

      const client = getSupabaseClient();
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) return false;

      const { data: existingRow, error: loadError } = await client
        .from(SUPABASE_TABLE)
        .select("payload")
        .eq("user_id", user.id)
        .maybeSingle();

      if (loadError) {
        console.warn("MYLIFE could not load existing Supabase data before merge.", loadError);
      }

      const remotePayload = existingRow && existingRow.payload ?
        (typeof existingRow.payload === "string" ? JSON.parse(existingRow.payload) : existingRow.payload) :
        {};

      const mergedPayload = mergeAppData(remotePayload, appData);

      const { error } = await client
        .from(SUPABASE_TABLE)
        .upsert({
          user_id: user.id,
          payload: mergedPayload,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (error) {
        console.warn("MYLIFE could not save data to Supabase.", error);
        return false;
      }

      return true;
    } catch (error) {
      console.warn("MYLIFE could not sync to Supabase.", error);
      return false;
    }
  },
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      Object.assign(appData, structuredClone(emptyData), saved || {});
      appData.profile = { ...emptyData.profile, ...(appData.profile || {}) };
    } catch (error) {
      console.warn("MYLIFE could not load saved data.", error);
      Object.assign(appData, structuredClone(emptyData));
    }
  },
  getLocalSnapshot() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (error) {
      console.warn("MYLIFE could not read legacy local data.", error);
      return null;
    }
  },
  migrateLegacyLocalData() {
    const localSnapshot = this.getLocalSnapshot();
    if (!localSnapshot) return false;

    const hasMeaningfulData = Object.keys(localSnapshot).some(key => {
      const value = localSnapshot[key];
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return Boolean(value);
    });

    if (!hasMeaningfulData) return false;

    const merged = mergeAppData(localSnapshot, appData);
    Object.assign(appData, structuredClone(emptyData), merged || {});
    appData.profile = { ...emptyData.profile, ...(merged.profile || appData.profile || {}) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    return true;
  },
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
      this.syncToSupabase();
      return true;
    } catch (error) {
      handleStorageError(error);
      return false;
    }
  },
  add(collection, item) {
    const previous = structuredClone(appData);
    appData[collection].push({ id: id(collection), createdAt: new Date().toISOString(), ...item });
    if (this.save()) App.render();
    else restoreData(previous);
  },
  edit(collection, itemId, changes) {
    const previous = structuredClone(appData);
    const item = appData[collection].find(record => record.id === itemId);
    if (!item) return;
    Object.assign(item, changes, { updatedAt: new Date().toISOString() });
    if (this.save()) App.render();
    else restoreData(previous);
  },
  delete(collection, itemId) {
    const previous = structuredClone(appData);
    appData[collection] = appData[collection].filter(item => item.id !== itemId);
    if (this.save()) App.render();
    else restoreData(previous);
  },
  updateProfile(changes) {
    const previous = structuredClone(appData);
    appData.profile = { ...appData.profile, ...changes };
    if (this.save()) App.render();
    else restoreData(previous);
  },
  updateMood(mood) {
    const previous = structuredClone(appData);
    const today = new Date().toISOString().slice(0, 10);
    const history = Array.isArray(appData.moodHistory) ? appData.moodHistory : [];

    appData.mood = {
      date: today,
      value: mood.value || "",
      label: mood.label || "",
      robot: mood.robot || ""
    };

    appData.moodHistory = [...history.filter(entry => entry.date !== today), {
      date: today,
      value: mood.value || "",
      label: mood.label || "",
      robot: mood.robot || ""
    }].slice(-7);

    if (this.save()) App.render();
    else restoreData(previous);
  },
  updateDailyReflection(text) {
    const previous = structuredClone(appData);
    const today = new Date().toISOString().slice(0, 10);
    appData.dailyReflection = {
      date: today,
      text: (text || "").trim()
    };
    if (!this.save()) restoreData(previous);
  },
  updateDailyFocus(items) {
    const previous = structuredClone(appData);
    const today = new Date().toISOString().slice(0, 10);
    appData.dailyFocus = {
      date: today,
      items: Array.isArray(items) ? items.map((item, index) => ({
        id: item.id || `focus-${today}-${index}`,
        text: String(item.text || "").trim(),
        done: !!item.done
      })).filter(item => item.text) : []
    };
    if (!this.save()) restoreData(previous);
  },
  createUser(data) {
    const previous = structuredClone(appData);
    const previousMoneyHidden = appData.profile.moneyHidden;
    Object.assign(appData, structuredClone(emptyData));
    appData.profile = {
      ...emptyData.profile,
      name: data.name || "",
      photo: data.photo || "",
      currency: data.currency || "USD",
      language: data.language || "English",
      dateFormat: data.dateFormat || "MMM d, yyyy",
      moneyHidden: previousMoneyHidden || false
    };

    const addIfFilled = (collection, keys, item) => {
      if (!keys.some(key => hasValue(item[key]))) return;
      appData[collection].push({ id: id(collection), createdAt: new Date().toISOString(), ...item });
    };

    addIfFilled("family", ["name", "relationship", "birthday", "anniversaryDate", "phone", "characterMood", "zodiacSign", "favorite", "relationshipNote", "notes"], {
      name: data.familyName || "",
      relationship: data.familyRelationship || "",
      characterMood: data.familyCharacterMood || "",
      zodiacSign: data.familyZodiacSign || "",
      birthday: data.familyBirthday || "",
      anniversaryDate: data.familyAnniversaryDate || "",
      phone: data.familyPhone || "",
      favorite: data.familyFavorite || "",
      relationshipNote: data.familyRelationshipNote || "",
      notes: data.familyNotes || "",
      photo: ""
    });
    addIfFilled("goals", ["name", "targetAmount", "currentAmount", "deadline", "description"], {
      name: data.goalName || "",
      category: data.goalCategory || "Personal",
      targetAmount: Number(data.goalTargetAmount || 0),
      currentAmount: Number(data.goalCurrentAmount || 0),
      deadline: data.goalDeadline || "",
      description: data.goalDescription || "",
      contributions: []
    });
    addIfFilled("income", ["name", "amount", "nextPaymentDate", "notes"], {
      name: data.incomeName || "",
      amount: Number(data.incomeAmount || 0),
      currency: data.incomeCurrency || appData.profile.currency || "USD",
      category: data.incomeCategory || "Salary",
      frequency: data.incomeFrequency || "Monthly",
      nextPaymentDate: data.incomeNextPaymentDate || "",
      recurring: data.incomeRecurring ?? true,
      notes: data.incomeNotes || ""
    });
    addIfFilled("expenses", ["description", "amount", "date", "method", "notes"], {
      description: data.expenseDescription || "",
      amount: Number(data.expenseAmount || 0),
      currency: data.expenseCurrency || appData.profile.currency || "USD",
      category: data.expenseCategory || "Food",
      date: data.expenseDate || "",
      method: data.expenseMethod || "",
      notes: data.expenseNotes || ""
    });
    addIfFilled("savings", ["name", "targetAmount", "currentAmount", "monthlyContribution", "deadline", "notes"], {
      name: data.savingsName || "",
      targetAmount: Number(data.savingsTargetAmount || 0),
      currentAmount: Number(data.savingsCurrentAmount || 0),
      monthlyContribution: Number(data.savingsMonthlyContribution || 0),
      currency: data.savingsCurrency || appData.profile.currency || "USD",
      deadline: data.savingsDeadline || "",
      notes: data.savingsNotes || ""
    });
    addIfFilled("loans", ["name", "originalAmount", "monthlyPayment", "dueDate", "notes"], {
      name: data.loanName || "",
      originalAmount: Number(data.loanOriginalAmount || 0),
      interestRate: Number(data.loanInterestRate || 0),
      durationMonths: Number(data.loanDurationMonths || 0),
      monthlyPayment: Number(data.loanMonthlyPayment || 0),
      currency: data.loanCurrency || appData.profile.currency || "USD",
      paymentFrequency: data.loanPaymentFrequency || "Monthly",
      firstPaymentDate: data.loanFirstPaymentDate || data.loanStartDate || "",
      startDate: data.loanFirstPaymentDate || data.loanStartDate || "",
      paymentDay: Number(data.loanPaymentDay || 0),
      dueDate: data.loanDueDate || "",
      notes: data.loanNotes || "",
      payments: []
    });
    addIfFilled("bills", ["name", "amount", "due", "category", "notes"], {
      name: data.billName || "",
      amount: Number(data.billAmount || 0),
      currency: data.billCurrency || appData.profile.currency || "USD",
      frequency: data.billFrequency || "Monthly",
      due: data.billDue || "",
      category: data.billCategory || "",
      reminder: data.billReminder ?? true,
      notes: data.billNotes || "",
      status: data.billStatus || "Upcoming"
    });
    addIfFilled("calendarEvents", ["title", "date", "time", "notes"], {
      title: data.eventTitle || "",
      date: data.eventDate || "",
      time: data.eventTime || "",
      category: data.eventCategory || "Personal",
      familyMember: data.eventFamilyMember || "",
      reminder: data.eventReminder ?? true,
      notes: data.eventNotes || ""
    });
    addIfFilled("memories", ["title", "date", "location", "description", "familyMembers", "tags"], {
      title: data.memoryTitle || "",
      photo: "",
      date: data.memoryDate || "",
      location: data.memoryLocation || "",
      description: data.memoryDescription || "",
      familyMembers: data.memoryFamilyMembers || "",
      tags: data.memoryTags || ""
    });

    if (this.save()) App.render();
    else restoreData(previous);
  },
  updateUserData(data) {
    const previous = structuredClone(appData);
    appData.profile = {
      ...appData.profile,
      name: data.name || "",
      photo: data.photo || appData.profile.photo || "",
      currency: data.currency || "USD",
      language: data.language || "English",
      dateFormat: data.dateFormat || "MMM d, yyyy",
      moneyHidden: appData.profile.moneyHidden || false
    };

    const upsertFirst = (collection, enabled, keys, item) => {
      if (!enabled) {
        appData[collection] = [];
        return;
      }
      if (!keys.some(key => hasValue(item[key]))) {
        appData[collection] = [];
        return;
      }
      const existing = appData[collection][0];
      if (existing) {
        appData[collection][0] = { ...existing, ...item, updatedAt: new Date().toISOString() };
        return;
      }
      appData[collection].push({ id: id(collection), createdAt: new Date().toISOString(), ...item });
    };

    upsertFirst("family", data.familyEnabled, ["name", "relationship", "birthday", "anniversaryDate", "phone", "characterMood", "zodiacSign", "favorite", "relationshipNote", "notes"], {
      name: data.familyName || "",
      relationship: data.familyRelationship || "",
      characterMood: data.familyCharacterMood || "",
      zodiacSign: data.familyZodiacSign || "",
      birthday: data.familyBirthday || "",
      anniversaryDate: data.familyAnniversaryDate || "",
      phone: data.familyPhone || "",
      favorite: data.familyFavorite || "",
      relationshipNote: data.familyRelationshipNote || "",
      notes: data.familyNotes || "",
      photo: appData.family[0]?.photo || ""
    });
    upsertFirst("goals", data.goalEnabled, ["name", "targetAmount", "currentAmount", "deadline", "description"], {
      name: data.goalName || "",
      category: data.goalCategory || "Personal",
      targetAmount: Number(data.goalTargetAmount || 0),
      currentAmount: Number(data.goalCurrentAmount || 0),
      deadline: data.goalDeadline || "",
      description: data.goalDescription || "",
      contributions: appData.goals[0]?.contributions || []
    });
    upsertFirst("income", data.incomeEnabled, ["name", "amount", "nextPaymentDate", "notes"], {
      name: data.incomeName || "",
      amount: Number(data.incomeAmount || 0),
      currency: data.incomeCurrency || appData.profile.currency || "USD",
      category: data.incomeCategory || "Salary",
      frequency: data.incomeFrequency || "Monthly",
      nextPaymentDate: data.incomeNextPaymentDate || "",
      recurring: data.incomeRecurring ?? true,
      notes: data.incomeNotes || ""
    });
    upsertFirst("expenses", data.expenseEnabled, ["description", "amount", "date", "method", "notes"], {
      description: data.expenseDescription || "",
      amount: Number(data.expenseAmount || 0),
      currency: data.expenseCurrency || appData.profile.currency || "USD",
      category: data.expenseCategory || "Food",
      date: data.expenseDate || "",
      method: data.expenseMethod || "",
      notes: data.expenseNotes || ""
    });
    upsertFirst("savings", data.savingsEnabled, ["name", "targetAmount", "currentAmount", "monthlyContribution", "deadline", "notes"], {
      name: data.savingsName || "",
      targetAmount: Number(data.savingsTargetAmount || 0),
      currentAmount: Number(data.savingsCurrentAmount || 0),
      monthlyContribution: Number(data.savingsMonthlyContribution || 0),
      currency: data.savingsCurrency || appData.profile.currency || "USD",
      deadline: data.savingsDeadline || "",
      notes: data.savingsNotes || ""
    });
    upsertFirst("loans", data.loanEnabled, ["name", "originalAmount", "monthlyPayment", "dueDate", "notes"], {
      name: data.loanName || "",
      originalAmount: Number(data.loanOriginalAmount || 0),
      interestRate: Number(data.loanInterestRate || 0),
      durationMonths: Number(data.loanDurationMonths || 0),
      monthlyPayment: Number(data.loanMonthlyPayment || 0),
      currency: data.loanCurrency || appData.profile.currency || "USD",
      paymentFrequency: data.loanPaymentFrequency || "Monthly",
      firstPaymentDate: data.loanFirstPaymentDate || data.loanStartDate || "",
      startDate: data.loanFirstPaymentDate || data.loanStartDate || "",
      paymentDay: Number(data.loanPaymentDay || 0),
      dueDate: data.loanDueDate || "",
      notes: data.loanNotes || "",
      payments: appData.loans[0]?.payments || []
    });
    upsertFirst("bills", data.billEnabled, ["name", "amount", "due", "category", "notes"], {
      name: data.billName || "",
      amount: Number(data.billAmount || 0),
      currency: data.billCurrency || appData.profile.currency || "USD",
      frequency: data.billFrequency || "Monthly",
      due: data.billDue || "",
      category: data.billCategory || "",
      reminder: data.billReminder ?? true,
      notes: data.billNotes || "",
      status: data.billStatus || "Upcoming"
    });
    upsertFirst("calendarEvents", data.eventEnabled, ["title", "date", "time", "notes"], {
      title: data.eventTitle || "",
      date: data.eventDate || "",
      time: data.eventTime || "",
      category: data.eventCategory || "Personal",
      familyMember: data.eventFamilyMember || "",
      reminder: data.eventReminder ?? true,
      notes: data.eventNotes || ""
    });
    upsertFirst("memories", data.memoryEnabled, ["title", "date", "location", "description", "familyMembers", "tags"], {
      title: data.memoryTitle || "",
      photo: appData.memories[0]?.photo || "",
      date: data.memoryDate || "",
      location: data.memoryLocation || "",
      description: data.memoryDescription || "",
      familyMembers: data.memoryFamilyMembers || "",
      tags: data.memoryTags || ""
    });

    if (this.save()) App.render();
    else restoreData(previous);
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(appData, structuredClone(emptyData));
    appData.profile = { ...emptyData.profile };
    App.render();
  },
  loadDemoData() {
    const previous = structuredClone(appData);
    Object.assign(appData, demoData());
    if (this.save()) App.render();
    else restoreData(previous);
  },
  calculate() {
    const totalIncome = sumMoney(appData.income, "amount");
    const totalExpenses = sumMoney(appData.expenses, "amount");
    const totalSavings = sumMoney(appData.savings, "currentAmount");
    const monthlySavings = sumMoney(appData.savings, "monthlyContribution");
    const loanBalance = appData.loans.reduce((total, loan) => total + toProfileCurrency(loanRemaining(loan), loan.currency), 0);
    const monthlyLoanPayments = appData.loans.reduce((total, loan) => total + loanMonthlyEquivalent(loan), 0);
    const upcomingBills = appData.bills.filter(bill => bill.status !== "Paid").length;
    const activeGoals = appData.goals.length;
    const familyEvents = appData.calendarEvents.filter(event => event.category === "Family").length;
    const calendarEvents = appData.calendarEvents.length;
    const upcomingAlerts = getUpcomingNotifications(7);
    const available = totalIncome - totalExpenses - monthlySavings - monthlyLoanPayments;

    return {
      totalIncome,
      totalExpenses,
      totalSavings,
      monthlySavings,
      loanBalance,
      monthlyLoanPayments,
      upcomingBills,
      activeGoals,
      familyEvents,
      calendarEvents,
      upcomingAlertsCount: upcomingAlerts.length,
      upcomingAlerts,
      available,
      savingsRate: totalIncome ? Math.round((monthlySavings / totalIncome) * 100) : 0
    };
  },
  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const includes = text => String(text || "").toLowerCase().includes(q);
    return [
      [t("goals"), appData.goals.filter(item => includes(`${item.name} ${item.category} ${item.description}`)).map(item => result(item.name, "#goals", t("goal")))],
      [t("money"), [
        ...appData.income.filter(item => includes(`${item.name} ${item.category}`)).map(item => result(item.name, "#money/income", t("income"))),
        ...appData.expenses.filter(item => includes(`${item.description} ${item.category}`)).map(item => result(item.description, "#money/expenses", t("expense"))),
        ...appData.bills.filter(item => includes(`${item.name} ${item.category}`)).map(item => result(item.name, "#money/bills", t("bill"))),
        ...appData.loans.filter(item => includes(item.name)).map(item => result(item.name, "#money/loans", t("loan")))
      ]],
      [t("family"), appData.family.filter(item => includes(`${item.name} ${item.relationship}`)).map(item => result(item.name, "#family", t("family")))],
      [t("memories"), appData.memories.filter(item => includes(`${item.title} ${item.description} ${item.tags}`)).map(item => result(item.title, "#memories", t("memory")))],
      [t("calendar"), appData.calendarEvents.filter(item => includes(`${item.title} ${item.category} ${item.notes}`)).map(item => result(item.title, "#calendar", t("calendarEvent")))]
    ];
  }
};

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function result(label, href, type) {
  return { label, href, type };
}

function getUpcomingNotifications(daysAhead = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + daysAhead);

  const items = [];

  appData.calendarEvents.forEach(event => {
    if (!event.date) return;
    const eventDate = new Date(`${event.date}T00:00:00`);
    if (eventDate < today || eventDate > limit) return;
    items.push({
      id: event.id || `event-${event.date}`,
      type: "event",
      title: event.title || "Event",
      date: event.date,
      daysLeft: Math.max(0, Math.round((eventDate - today) / 86400000)),
      kind: "event"
    });
  });

  appData.bills.forEach(bill => {
    if (bill.reminder === false || !bill.due || bill.status === "Paid") return;
    const dueDate = new Date(`${bill.due}T00:00:00`);
    if (dueDate < today || dueDate > limit) return;
    items.push({
      id: bill.id || `bill-${bill.due}`,
      type: "bill",
      title: bill.name || "Bill",
      date: bill.due,
      daysLeft: Math.max(0, Math.round((dueDate - today) / 86400000)),
      kind: "bill"
    });
  });

  appData.family.forEach(member => {
    [
      ["birthday", member.birthday],
      ["anniversary", member.anniversaryDate]
    ].forEach(([type, value]) => {
      const date = nextYearlyDate(value, today);
      if (!date || date > limit) return;
      items.push({
        id: `family-${type}-${member.id}-${calendarDateInput(date)}`,
        type: `family-${type}`,
        title: `${t(type)}: ${member.name}`,
        date: calendarDateInput(date),
        daysLeft: Math.max(0, Math.round((date - today) / 86400000)),
        kind: "event",
        source: "family",
        familyId: member.id
      });
    });
  });

  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
}

function nextYearlyDate(value, today) {
  const original = parseAppDate(value);
  if (Number.isNaN(original.getTime())) return null;
  const build = year => new Date(year, original.getMonth(), Math.min(original.getDate(), new Date(year, original.getMonth() + 1, 0).getDate()));
  const current = build(today.getFullYear());
  return current >= today ? current : build(today.getFullYear() + 1);
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function sumMoney(items, key) {
  return items.reduce((total, item) => total + toProfileCurrency(item[key], item.currency), 0);
}

function hasValue(value) {
  return String(value ?? "").trim() !== "" && Number(value) !== 0;
}

function money(value, currency = appData.profile.currency || "USD") {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
  return `<span class="money-value" data-private-money>${formatted}</span>`;
}

function toProfileCurrency(value, fromCurrency = appData.profile.currency || "USD") {
  return convertCurrency(value, fromCurrency, appData.profile.currency || "USD");
}

function convertCurrency(value, fromCurrency = "USD", toCurrency = "USD") {
  const amount = Number(value || 0);
  const from = fromCurrency || "USD";
  const to = toCurrency || "USD";
  if (from === to) return amount;
  if (from === "KHR" && to === "USD") return amount / 4100;
  if (from === "USD" && to === "KHR") return amount * 4100;
  return amount;
}

function pct(current, target) {
  return target ? Math.min(100, Math.round((Number(current || 0) / Number(target || 0)) * 100)) : 0;
}

function loanPaid(loan) {
  const recordedPaid = (loan.payments || []).reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const payoffAmount = loanPayoffAmount(loan);
  if (recordedPaid) return Math.min(payoffAmount, recordedPaid);
  const firstPaymentDate = loan.firstPaymentDate || loan.startDate;
  if (!firstPaymentDate || !loan.monthlyPayment) return 0;

  const start = parseAppDate(applyLoanPaymentDay(firstPaymentDate, loanPaymentDay(loan)));
  const today = new Date();
  if (Number.isNaN(start.getTime()) || today < start) return 0;

  const elapsedPayments = elapsedPaymentCount(start, today, loan.paymentFrequency || "Monthly");
  return Math.min(payoffAmount, elapsedPayments * Number(loan.monthlyPayment || 0));
}

function loanRemaining(loan) {
  return Math.max(0, loanPayoffAmount(loan) - loanPaid(loan));
}

function loanPayoffAmount(loan) {
  const durationMonths = Number(loan.durationMonths || 0);
  const monthlyPayment = Number(loan.monthlyPayment || 0);
  if (durationMonths && monthlyPayment) return durationMonths * monthlyPayment;
  return Number(loan.originalAmount || 0);
}

function loanPaymentDay(loan) {
  const explicitDay = Number(loan.paymentDay || 0);
  if (explicitDay) return explicitDay;
  const firstPaymentDate = loan.firstPaymentDate || loan.startDate;
  if (!firstPaymentDate) return 0;
  const first = parseAppDate(firstPaymentDate);
  return Number.isNaN(first.getTime()) ? 0 : first.getDate();
}

function loanPaymentScheduleToCurrent(loan) {
  const firstPaymentDate = loan.firstPaymentDate || loan.startDate;
  const first = parseAppDate(firstPaymentDate);
  const monthlyPayment = Number(loan.monthlyPayment || 0);
  if (Number.isNaN(first.getTime()) || !monthlyPayment) return [];

  const today = stripTime(new Date());
  const durationMonths = Number(loan.durationMonths || 0);
  const maxIndex = durationMonths ? durationMonths - 1 : 240;
  const rows = [];

  for (let index = 0; index <= maxIndex; index += 1) {
    const date = addMonths(first, index);
    if (date > today) break;
    const dateValue = toDateInput(date);
    rows.push({
      date: dateValue,
      amount: monthlyPayment,
      paid: (loan.payments || []).some(payment => payment.date === dateValue)
    });
  }

  return rows;
}

function nextLoanPaymentDate(loan) {
  const firstPaymentDate = loan.firstPaymentDate || loan.startDate;
  if (!firstPaymentDate) return "";
  const first = parseAppDate(firstPaymentDate);
  if (Number.isNaN(first.getTime())) return "";
  const durationMonths = Number(loan.durationMonths || 0);
  const today = stripTime(new Date());
  let next = stripTime(first);
  let index = 0;
  while (next < today && (!durationMonths || index < durationMonths - 1)) {
    index += 1;
    next = addMonths(first, index);
  }
  if (durationMonths && next < today) return "";
  return toDateInput(next);
}

function elapsedPaymentCount(start, today, frequency = "Monthly") {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((stripTime(today) - stripTime(start)) / msPerDay);
  if (frequency === "Daily") return days + 1;
  if (frequency === "Weekly") return Math.floor(days / 7) + 1;
  if (frequency === "Yearly") return Math.max(0, today.getFullYear() - start.getFullYear() + (dateReached(today, start) ? 1 : 0));

  const monthDiff = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
  return Math.max(0, monthDiff + (today.getDate() >= start.getDate() ? 1 : 0));
}

function dateReached(today, start) {
  return today.getMonth() > start.getMonth() || (today.getMonth() === start.getMonth() && today.getDate() >= start.getDate());
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function loanMonthlyEquivalent(loan) {
  const amount = Number(loan.monthlyPayment || 0);
  let monthlyAmount = amount;
  if ((loan.paymentFrequency || "Monthly") === "Daily") monthlyAmount = amount * 30;
  else if (loan.paymentFrequency === "Weekly") monthlyAmount = amount * 4.333;
  else if (loan.paymentFrequency === "Yearly") monthlyAmount = amount / 12;
  return toProfileCurrency(monthlyAmount, loan.currency);
}

function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "Not set";
  return parseAppDate(value).toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", options);
}

function parseAppDate(value) {
  const normalized = /^\d{4}-\d{2}$/.test(String(value || "")) ? `${value}-01` : value;
  return new Date(`${normalized}T00:00:00`);
}

function normalizeLoanPaymentDate(value) {
  if (/^\d{4}-\d{2}$/.test(String(value || ""))) return `${value}-01`;
  return value || "";
}

function applyLoanPaymentDay(value, paymentDay) {
  const normalized = normalizeLoanPaymentDate(value);
  const day = Number(paymentDay || 0);
  if (!normalized || !day) return normalized;
  const date = parseAppDate(normalized);
  if (Number.isNaN(date.getTime())) return normalized;
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(Math.max(day, 1), lastDay));
  return toDateInput(date);
}

function initials(name) {
  return String(name || "MY").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "MY";
}

function restoreData(previous) {
  Object.assign(appData, structuredClone(emptyData), previous || {});
  appData.profile = { ...emptyData.profile, ...(appData.profile || {}) };
}

function handleStorageError(error) {
  console.warn("MYLIFE could not save data.", error);
  const quotaError = error?.name === "QuotaExceededError" || error?.code === 22;
  Toast.show(quotaError ? t("storageFull") : t("saveFailed"));
}

function demoData() {
  return {
    profile: { name: "Sokha Chen", photo: "", currency: "USD", language: "English", dateFormat: "MMM d, yyyy" },
    family: [
      { id: "demo-family-1", name: "Mom", relationship: "Mother", birthday: "1968-10-12", phone: "+855 12 000 001", notes: "Likes quiet family dinners.", photo: "" },
      { id: "demo-family-2", name: "Dad", relationship: "Father", birthday: "1966-11-04", phone: "+855 12 000 002", notes: "Call after lunch.", photo: "" }
    ],
    goals: [
      { id: "demo-goal-1", name: "New House", category: "Home", targetAmount: 20000, currentAmount: 8500, deadline: "2027-12-31", description: "Build a calm future home for the family.", contributions: [] },
      { id: "demo-goal-2", name: "Family Trip", category: "Travel", targetAmount: 1500, currentAmount: 650, deadline: "2026-08-30", description: "A long weekend by the sea.", contributions: [] }
    ],
    income: [
      { id: "demo-income-1", name: "Monthly Salary", amount: 2000, category: "Salary", frequency: "Monthly", nextPaymentDate: "2026-09-01", recurring: true, notes: "" }
    ],
    expenses: [
      { id: "demo-expense-1", description: "Groceries", amount: 320, category: "Food", date: "2026-08-21", method: "Card", notes: "" },
      { id: "demo-expense-2", description: "Rent", amount: 300, category: "Home", date: "2026-08-01", method: "Bank", notes: "" }
    ],
    savings: [
      { id: "demo-saving-1", name: "Emergency Fund", targetAmount: 5000, currentAmount: 2400, monthlyContribution: 300, deadline: "2027-01-01", notes: "" }
    ],
    loans: [
      { id: "demo-loan-1", name: "Car Loan", originalAmount: 15000, interestRate: 5.5, durationMonths: 20, monthlyPayment: 771.97, paymentFrequency: "Monthly", firstPaymentDate: "2025-01-05", startDate: "2025-01-05", paymentDay: 5, dueDate: "2026-08-05", notes: "", payments: [] }
    ],
    bills: [
      { id: "demo-bill-1", name: "Electricity", amount: 45, frequency: "Monthly", due: "2026-08-25", category: "Utilities", reminder: true, notes: "", status: "Upcoming" }
    ],
    calendarEvents: [
      { id: "demo-event-1", title: "Family Dinner", date: "2026-08-27", time: "19:00", category: "Family", familyMember: "Mom", reminder: true, notes: "" }
    ],
    memories: [
      { id: "demo-memory-1", title: "Family Trip", photo: "", date: "2026-08-15", location: "Kep", description: "Beautiful weekend with the family.", familyMembers: "Mom, Dad", tags: "travel, family" }
    ]
  };
}
