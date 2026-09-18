/**
 * MYLIFE sync primitives.
 *
 * Two defects this module exists to fix:
 *
 * 1. A deletion only ever existed in the live snapshot. The cloud merge was a pure
 *    union merge with no delete path, so a stale remote payload pushed deleted
 *    records straight back into the app on the next refresh. Tombstones record
 *    *what* was deleted so a merge can never add it back.
 *
 * 2. Uploads were fire-and-forget. On mobile the WebView is killed before the
 *    upsert lands, so the change existed only on the device while the cloud kept
 *    the old payload. The pending flag makes an unsynced change sticky, and the
 *    next sync pushes before it pulls.
 *
 * Loaded before js/data.js. Depends on nothing but localStorage.
 */

const SYNC_PENDING_KEY = "mylife:pending-sync:v1";
const SYNC_ACCOUNT_KEY = "mylife:sync-account:v1";
const SYNC_NOTICE_KEY = "mylife:sync-notice-shown";
const DELETIONS_FIELD = "deletions";
const TOMBSTONE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const SYNC_RETRY_INTERVAL_MS = 30000;

const syncReadJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (error) {
    try {
      localStorage.removeItem(key);
    } catch (removeError) {
      console.warn("MYLIFE could not reset corrupt sync state.", removeError);
    }
    return fallback;
  }
};

const syncWriteJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("MYLIFE could not persist sync state.", error);
    return false;
  }
};

const SyncState = {
  /* ------------------------------------------------------------------ *
   * Pending upload queue
   * ------------------------------------------------------------------ */

  /**
   * Records that local data has changes the cloud does not have yet.
   * `mode` is either "merge" (reconcile with the cloud) or "replace"
   * (local is the whole truth and the cloud copy must be overwritten).
   * An existing "replace" intent is never downgraded to "merge".
   */
  markPending({ mode = "merge", reason = "save" } = {}) {
    const current = syncReadJson(SYNC_PENDING_KEY, null) || {};
    const resolvedMode = current.mode === "replace" || mode === "replace" ? "replace" : "merge";
    syncWriteJson(SYNC_PENDING_KEY, {
      mode: resolvedMode,
      reason,
      firstMarkedAt: current.firstMarkedAt || new Date().toISOString(),
      lastMarkedAt: new Date().toISOString(),
      attempts: Number(current.attempts || 0)
    });
  },

  clearPending() {
    try {
      localStorage.removeItem(SYNC_PENDING_KEY);
    } catch (error) {
      console.warn("MYLIFE could not clear the pending sync flag.", error);
    }
  },

  pendingInfo() {
    return syncReadJson(SYNC_PENDING_KEY, null);
  },

  isPending() {
    try {
      return Boolean(localStorage.getItem(SYNC_PENDING_KEY));
    } catch (error) {
      return false;
    }
  },

  isReplacePending() {
    return this.pendingInfo()?.mode === "replace";
  },

  noteAttempt() {
    const current = this.pendingInfo();
    if (!current) return;
    syncWriteJson(SYNC_PENDING_KEY, {
      ...current,
      attempts: Number(current.attempts || 0) + 1,
      lastAttemptAt: new Date().toISOString()
    });
  },

  /* ------------------------------------------------------------------ *
   * Account scoping
   * ------------------------------------------------------------------ */

  getAccountId() {
    try {
      return String(localStorage.getItem(SYNC_ACCOUNT_KEY) || "");
    } catch (error) {
      return "";
    }
  },

  setAccountId(userId) {
    try {
      if (!userId) localStorage.removeItem(SYNC_ACCOUNT_KEY);
      else localStorage.setItem(SYNC_ACCOUNT_KEY, String(userId));
    } catch (error) {
      console.warn("MYLIFE could not remember the sync account.", error);
    }
  },

  /** True when a different account's cached payload is still sitting in localStorage. */
  isDifferentAccount(userId) {
    const known = this.getAccountId();
    return Boolean(known && userId && known !== userId);
  },

  /* ------------------------------------------------------------------ *
   * Tombstones
   * ------------------------------------------------------------------ */

  deletions(data) {
    const bucket = data[DELETIONS_FIELD];
    if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) {
      data[DELETIONS_FIELD] = {};
    }
    return data[DELETIONS_FIELD];
  },

  record(data, collection, recordId) {
    if (!collection || !recordId) return;
    const deletions = this.deletions(data);
    if (!deletions[collection] || typeof deletions[collection] !== "object") deletions[collection] = {};
    deletions[collection][recordId] = new Date().toISOString();
  },

  recordAll(data, collection, records = []) {
    records.forEach(record => this.record(data, collection, record?.id));
  },

  revoke(data, collection, recordId) {
    const deletions = this.deletions(data);
    if (deletions[collection]) delete deletions[collection][recordId];
  },

  clear(data) {
    data[DELETIONS_FIELD] = {};
  },

  count(data) {
    return Object.values(this.deletions(data))
      .reduce((total, ids) => total + Object.keys(ids || {}).length, 0);
  },

  /**
   * Newest timestamp wins per record id, so two devices cannot drop each
   * other's deletions. ISO-8601 UTC strings compare correctly as strings.
   */
  merge(first, second) {
    const merged = {};
    [first, second].forEach(source => {
      if (!source || typeof source !== "object" || Array.isArray(source)) return;
      Object.entries(source).forEach(([collection, ids]) => {
        if (!ids || typeof ids !== "object" || Array.isArray(ids)) return;
        if (!merged[collection]) merged[collection] = {};
        Object.entries(ids).forEach(([recordId, deletedAt]) => {
          const stamp = String(deletedAt || "");
          if (!merged[collection][recordId] || stamp > merged[collection][recordId]) {
            merged[collection][recordId] = stamp;
          }
        });
      });
    });
    return merged;
  },

  has(data, collection, recordId) {
    const deletions = this.deletions(data);
    return Boolean(deletions[collection] && deletions[collection][recordId]);
  },

  /** Drops tombstoned records from every list. This is what stops a stale remote resurrecting them. */
  apply(data) {
    const deletions = this.deletions(data);
    Object.keys(deletions).forEach(collection => {
      const list = data[collection];
      if (!Array.isArray(list)) return;
      const deleted = deletions[collection] || {};
      const kept = list.filter(item => !item?.id || !deleted[item.id]);
      if (kept.length !== list.length) data[collection] = kept;
    });
    return data;
  },

  /** A tombstone only earns its keep while a stale remote copy could still exist. */
  prune(data, now = Date.now()) {
    const deletions = this.deletions(data);
    let removed = 0;
    Object.keys(deletions).forEach(collection => {
      const ids = deletions[collection];
      if (!ids || typeof ids !== "object") {
        delete deletions[collection];
        return;
      }
      Object.entries(ids).forEach(([recordId, deletedAt]) => {
        const stamp = Date.parse(deletedAt);
        if (Number.isNaN(stamp) || now - stamp < TOMBSTONE_TTL_MS) return;
        delete ids[recordId];
        removed += 1;
      });
      if (!Object.keys(ids).length) delete deletions[collection];
    });
    return removed;
  }
};

/**
 * Retries an unsynced local change once the app can reach the network again.
 * Mobile WebViews are suspended aggressively, so the interval alone is not
 * enough: visibility and focus both mean "we may be back online now".
 */
const SyncScheduler = {
  flushHandler: null,
  timer: null,
  running: false,
  started: false,
  sessionNoticeShown: false,

  start(flushHandler) {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.flushHandler = flushHandler;

    window.addEventListener("online", () => this.flush("online"));
    window.addEventListener("focus", () => this.flush("focus"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.flush("visible");
    });
    this.timer = window.setInterval(() => this.flush("interval"), SYNC_RETRY_INTERVAL_MS);
  },

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.started = false;
  },

  flush(reason = "retry") {
    if (this.running || !this.flushHandler) return Promise.resolve(false);
    if (!SyncState.isPending()) return Promise.resolve(false);
    if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve(false);

    this.running = true;
    return Promise.resolve(this.flushHandler(reason))
      .catch(error => {
        console.warn("MYLIFE background sync attempt failed.", error);
        return false;
      })
      .finally(() => {
        this.running = false;
      });
  },

  /** Shown at most once per session so a flaky connection cannot spam the user. */
  noticeShown() {
    if (this.sessionNoticeShown) return true;
    try {
      if (sessionStorage.getItem(SYNC_NOTICE_KEY)) return true;
      sessionStorage.setItem(SYNC_NOTICE_KEY, "1");
    } catch (error) {
      console.warn("MYLIFE could not record the sync notice.", error);
    }
    this.sessionNoticeShown = true;
    return false;
  }
};
