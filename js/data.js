const STORAGE_KEY = "mylife:user-data:v1";
const SUPABASE_TABLE = "app_data";
const isGuestMode = () => typeof Login !== "undefined" && Login.guestMode;

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

const stripLargeImages = value => {
  if (Array.isArray(value)) return value.map(stripLargeImages);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    typeof item === "string" && item.startsWith("data:image/") ? "" : stripLargeImages(item)
  ]));
};

const saveLocalSnapshot = value => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch (error) {
    const quotaError = error?.name === "QuotaExceededError" || error?.code === 22;
    if (!quotaError) return false;
    [
      "mylife:tips-couple-image",
      "mylife:family-photo"
    ].forEach(key => localStorage.removeItem(key));
    const compactValue = stripLargeImages(value);
    localStorage.removeItem(STORAGE_KEY);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compactValue));
    } catch (compactError) {
      console.warn("MYLIFE local storage is full; keeping data in memory for cloud sync.", compactError);
    }
    return false;
  }
};

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
    clockFormat: "12-hour",
    soundEnabled: true,
    notificationsEnabled: true,
    theme: "light",
    moneyHidden: false,
    quickActions: ["smart-assistant", "add-event", "add-goal"]
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
  familyMedia: [],
  goals: [],
  income: [],
  expenses: [],
  savings: [],
  loans: [],
  bills: [],
  calendarEvents: [],
  memories: [],
  hobbyLogs: [],
  reminders: [],
  // Tombstones: { [collection]: { [recordId]: deletedAtIso } }. Synced with the
  // payload so a deletion survives a merge with a stale cloud copy.
  deletions: {}
};

const mergeAppData = (base, update) => {
  const baseValue = base && typeof base === "object" ? structuredClone(base) : {};
  const updateValue = update && typeof update === "object" ? update : {};

  const mergeLists = (currentList, nextList) => {
    if (!currentList.length || !nextList.length) return structuredClone(nextList.length ? nextList : currentList);
    if (!currentList.every(item => item && typeof item === "object") || !nextList.every(item => item && typeof item === "object")) {
      return structuredClone(nextList);
    }

    const identity = item => item.id || item.date || null;
    if (![...currentList, ...nextList].every(item => identity(item))) return structuredClone(nextList);

    const mergedList = currentList.map(item => structuredClone(item));
    nextList.forEach(nextItem => {
      const nextIdentity = identity(nextItem);
      const index = mergedList.findIndex(item => identity(item) === nextIdentity);
      if (index === -1) {
        mergedList.push(structuredClone(nextItem));
      } else {
        mergedList[index] = mergeAppData(mergedList[index], nextItem);
      }
    });
    return mergedList;
  };

  const merged = Array.isArray(baseValue) ? [...baseValue] : { ...baseValue };

  Object.keys(updateValue).forEach((key) => {
    const nextValue = updateValue[key];
    const currentValue = merged[key];

    // Tombstones merge by newest timestamp rather than by which payload wins,
    // so neither side can silently drop the other's deletions.
    if (key === DELETIONS_FIELD) {
      merged[key] = SyncState.merge(currentValue, nextValue);
      return;
    }

    if (Array.isArray(nextValue)) {
      merged[key] = Array.isArray(currentValue) ? mergeLists(currentValue, nextValue) : structuredClone(nextValue);
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

const toPayloadObject = raw => {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.warn("MYLIFE could not parse the stored payload.", error);
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
};

/** True when the account has nothing stored in the cloud yet. */
const isEmptyPayload = payload => !payload || !Object.keys(payload).some(key => {
  const value = payload[key];
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
});

/** Key order is irrelevant when comparing a stored payload to a freshly merged one. */
const canonicalizePayload = value => {
  if (Array.isArray(value)) return value.map(canonicalizePayload);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((sorted, key) => {
    sorted[key] = canonicalizePayload(value[key]);
    return sorted;
  }, {});
};

const payloadsDiffer = (first, second) => {
  try {
    return JSON.stringify(canonicalizePayload(first)) !== JSON.stringify(canonicalizePayload(second));
  } catch (error) {
    return true;
  }
};

/**
 * Empties a collection while recording what was removed. Without the tombstones
 * the next cloud merge would push every removed record straight back in.
 */
function clearCollectionWithTombstones(collection) {
  const records = appData[collection] || [];
  SyncState.recordAll(appData, collection, records);
  appData[collection] = [];
}

const appData = structuredClone(emptyData);
window.appData = appData;

const Store = {
  /** Bumped on every local mutation so an in-flight upload cannot clear a newer edit. */
  saveSequence: 0,

  /**
   * Pulls the cloud copy and reconciles it with local data.
   *
   * The previous version merged `local ∪ remote` unconditionally. Because that merge
   * only ever added records, a stale remote payload pushed deleted ones straight back
   * in — the reported "deleted family member returns after refresh". Three things fix
   * that: tombstones are applied after every merge, a local change that has not
   * reached the cloud wins over the remote copy, and the merged result is written
   * back so the stale remote is corrected instead of resurrecting the record on the
   * next refresh as well.
   */
  async syncFromSupabase(options = {}) {
    if (!isSupabaseReady()) return false;

    try {
      const startSequence = this.saveSequence;
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

      // A cached payload belonging to another account must never be merged into this
      // one, so drop it before anything else can read it.
      if (SyncState.isDifferentAccount(user.id)) {
        Object.assign(appData, structuredClone(emptyData));
        appData.profile = { ...emptyData.profile };
        SyncState.clearPending();
      }
      SyncState.setAccountId(user.id);

      const remotePayload = toPayloadObject(data?.payload);

      // Nothing stored in the cloud yet: the local copy is the only one, so publish
      // it instead of pulling an empty payload over the top of it.
      if (isEmptyPayload(remotePayload)) {
        saveLocalSnapshot(appData);
        SyncState.markPending({ mode: "merge", reason: "first-sync" });
        await this.syncToSupabase();
        return true;
      }

      // The user changed something while this request was in flight. That change is
      // newer than anything we just fetched, so publish rather than apply.
      if (this.saveSequence !== startSequence) {
        SyncState.markPending({ mode: "merge", reason: "edit-during-pull" });
        await this.syncToSupabase();
        return true;
      }

      const pendingInfo = SyncState.pendingInfo();

      // "Clear data", demo load and backup import mean local is the whole truth and
      // the cloud copy has to be overwritten, not merged with.
      if (pendingInfo?.mode === "replace") {
        await this.syncToSupabase();
        return true;
      }

      const localPayload = mergeAppData(this.getLocalSnapshot() || {}, appData);

      // A pending local change (a deletion, typically) has not reached the cloud yet.
      // Local wins so the stale remote cannot undo it, while records that only exist
      // remotely are still adopted.
      const mergedPayload = pendingInfo
        ? mergeAppData(remotePayload, localPayload)
        : mergeAppData(localPayload, remotePayload);

      Object.assign(appData, structuredClone(emptyData), mergedPayload || {});
      appData.profile = { ...emptyData.profile, ...(appData.profile || {}) };
      SyncState.apply(appData);
      SyncState.prune(appData);
      saveLocalSnapshot(appData);

      // Converge the cloud copy whenever it is behind us. Without this the record
      // would come back on the next refresh as well, not just this one.
      if (pendingInfo || payloadsDiffer(remotePayload, mergedPayload)) {
        SyncState.markPending({ mode: "merge", reason: "pull-converge" });
        await this.syncToSupabase();
      }
      return true;
    } catch (error) {
      console.warn("MYLIFE could not sync from Supabase.", error);
      return false;
    }
  },
  /**
   * Publishes the whole local snapshot. `appData` is already authoritative because
   * every mutation writes it to disk before syncing, and anything that failed to
   * upload is replayed from the pending flag. The old version re-read the remote row
   * only to ignore it, costing an extra round trip on every single save.
   */
  async syncToSupabase() {
    if (!isSupabaseReady()) return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

    try {
      const client = getSupabaseClient();
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) return false;

      await this.moveImagesToSupabase(user.id);

      const sequence = this.saveSequence;
      const payload = structuredClone(appData);

      const { error } = await client
        .from(SUPABASE_TABLE)
        .upsert({
          user_id: user.id,
          payload,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (error) {
        console.warn("MYLIFE could not save data to Supabase.", error);
        SyncState.noteAttempt();
        this.notifyPendingSync();
        return false;
      }

      // Only stand the pending flag down when nothing changed while uploading;
      // otherwise a newer local edit still has to reach the cloud.
      if (sequence === this.saveSequence) SyncState.clearPending();
      SyncState.setAccountId(user.id);
      saveLocalSnapshot(appData);
      return true;
    } catch (error) {
      console.warn("MYLIFE could not sync to Supabase.", error);
      SyncState.noteAttempt();
      this.notifyPendingSync();
      return false;
    }
  },
  async moveImagesToSupabase(userId) {
    const upload = window.MYLIFE_SUPABASE_API?.uploadImageDataUrl;
    if (!userId || typeof upload !== "function") return false;

    const imageFields = [
      { object: appData.profile, key: "photo", folder: `users/${userId}/profile` },
      { object: appData.profile, key: "launcherCover", folder: `users/${userId}/covers` }
    ];
    appData.family.forEach(item => imageFields.push({ object: item, key: "photo", folder: `users/${userId}/family` }));
    appData.memories.forEach(item => imageFields.push({ object: item, key: "photo", folder: `users/${userId}/memories` }));

    let changed = false;
    for (const field of imageFields) {
      if (!String(field.object?.[field.key] || "").startsWith("data:image/")) continue;
      const uploadedUrl = await upload(field.object[field.key], field.folder);
      if (uploadedUrl) {
        field.object[field.key] = uploadedUrl;
        changed = true;
      }
    }
    return changed;
  },
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      Object.assign(appData, structuredClone(emptyData), saved || {});
      appData.profile = { ...emptyData.profile, ...(appData.profile || {}) };
      // A snapshot that still carries a record alongside its tombstone keeps the
      // deletion: the tombstone is always the newer of the two.
      SyncState.apply(appData);
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
    saveLocalSnapshot(appData);
    return true;
  },
  /**
   * Writes the snapshot to disk, then publishes it in the background.
   *
   * The upload stays fire-and-forget because the UI must never wait on the network,
   * but it is no longer fire-and-forget *and lossy*: the pending flag is set before
   * the request starts, so if the WebView is killed before the upsert lands — the
   * usual case on a phone — the change is replayed on the next launch instead of
   * being silently undone by the stale cloud copy.
   */
  save(options = {}) {
    if (isGuestMode()) {
      if (typeof Toast !== "undefined" && typeof t === "function") Toast.show(t("guestSaveWarning"));
      return true;
    }
    try {
      SyncState.prune(appData);
      if (!saveLocalSnapshot(appData)) {
        Toast.show(t("saveFailed"));
        return false;
      }
      this.saveSequence += 1;
      if (options.sync !== false) {
        SyncState.markPending({ mode: options.mode || "merge", reason: options.reason || "save" });
        this.syncToSupabase();
      }
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
    const existed = appData[collection].some(item => item.id === itemId);
    appData[collection] = appData[collection].filter(item => item.id !== itemId);
    // The tombstone is the whole point: without it the union merge in
    // syncFromSupabase pushes the record straight back in on the next refresh.
    if (existed) SyncState.record(appData, collection, itemId);
    if (this.save()) App.render();
    else restoreData(previous);
  },
  updateProfile(changes, options = {}) {
    const previous = structuredClone(appData);
    appData.profile = { ...appData.profile, ...changes };
    if (this.save(options)) App.render();
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

    // Creating a user replaces everything, so the cloud copy has to be replaced too.
    if (this.save({ mode: "replace", reason: "create-user" })) App.render();
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
      // Clearing a section has to be recorded as a deletion, otherwise the next
      // cloud merge treats the removed records as "missing locally" and re-adds them.
      if (!enabled) {
        clearCollectionWithTombstones(collection);
        return;
      }
      if (!keys.some(key => hasValue(item[key]))) {
        clearCollectionWithTombstones(collection);
        return;
      }
      const existing = appData[collection][0];
      if (existing) {
        appData[collection][0] = { ...existing, ...item, updatedAt: new Date().toISOString() };
        return;
      }
      appData[collection].push({ id: id(collection), createdAt: new Date().toISOString(), ...item });
    };

    const familyMemberIndex = appData.family.findIndex(member => member.id === data.familyMemberId);
    const familyItem = {
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
      photo: appData.family[familyMemberIndex >= 0 ? familyMemberIndex : 0]?.photo || ""
    };
    if (!data.familyEnabled) clearCollectionWithTombstones("family");
    else if (!Object.values(familyItem).some(value => hasValue(value))) clearCollectionWithTombstones("family");
    else if (familyMemberIndex >= 0) appData.family[familyMemberIndex] = { ...appData.family[familyMemberIndex], ...familyItem, updatedAt: new Date().toISOString() };
    else upsertFirst("family", true, ["name", "relationship", "birthday", "anniversaryDate", "phone", "characterMood", "zodiacSign", "favorite", "relationshipNote", "notes"], familyItem);
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
  /**
   * Wiping local data is not enough on its own: without pushing the empty state the
   * next `syncFromSupabase` pulls the old cloud copy straight back in — which is why
   * "Clear data" also appeared to undo itself after a refresh.
   */
  clear() {
    Object.assign(appData, structuredClone(emptyData));
    appData.profile = { ...emptyData.profile };
    localStorage.removeItem(STORAGE_KEY);
    if (isGuestMode()) {
      App.render();
      return;
    }
    this.save({ mode: "replace", reason: "clear-data" });
    App.render();
  },
  loadDemoData() {
    const previous = structuredClone(appData);
    Object.assign(appData, demoData());
    SyncState.clear(appData);
    if (this.save({ mode: "replace", reason: "demo-data" })) App.render();
    else restoreData(previous);
  },
  /**
   * The app must never look like it saved while the cloud copy stayed behind.
   * Shown once per session so a flaky connection cannot spam the user.
   */
  notifyPendingSync() {
    if (isGuestMode() || !SyncState.isPending()) return;
    if (SyncScheduler.noticeShown()) return;
    if (typeof Toast === "undefined") return;
    const isKhmer = typeof languageCode === "function" && languageCode() === "km";
    Toast.show(isKhmer
      ? "រក្សាទុកក្នុងឧបករណ៍រួចហើយ — នឹងធ្វើសមកាលកម្មពេលមានអ៊ីនធឺណិត"
      : "Saved on this device — it will sync when you are back online", "warning", { duration: 3600 });
  },
  /** Replays an upload that never landed. Called on reconnect, app resume and on a timer. */
  flushPendingSync() {
    if (isGuestMode() || !SyncState.isPending()) return Promise.resolve(false);
    return this.syncToSupabase();
  },
  startSyncRetry() {
    SyncScheduler.start(() => this.flushPendingSync());
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

  appData.reminders.forEach(reminder => {
    if (reminder.done || !reminder.date) return;
    const reminderDate = new Date(`${reminder.date}T00:00:00`);
    if (reminderDate < today || reminderDate > limit) return;
    items.push({
      id: reminder.id || `reminder-${reminder.date}`,
      type: "reminder",
      title: reminder.title || "Reminder",
      date: reminder.date,
      daysLeft: Math.max(0, Math.round((reminderDate - today) / 86400000)),
      kind: "reminder",
      source: "daily",
      category: reminder.category || "Personal"
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
  const date = parseAppDate(value);
  if (languageCode() === "km" && options.month) {
    const months = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
    const parts = [String(date.getDate()), months[date.getMonth()]];
    if (options.year) parts.push(String(date.getFullYear()));
    return parts.join(" ");
  }
  return date.toLocaleDateString("en-US", options);
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
