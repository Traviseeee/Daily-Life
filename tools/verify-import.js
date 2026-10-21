/**
 * Regression harness for Settings › Import JSON (QC findings B1 + B7).
 *
 * Loads the real js/sync.js + js/data.js in a VM sandbox (fake localStorage and a
 * fake Supabase client, no network, no production data) and checks that:
 *  - a malformed backup is rejected before anything changes, locally or in the cloud,
 *  - a valid backup first saves a recoverable "before-import" copy, then replaces,
 *  - a failed backup or a failed save leaves the current data untouched.
 *
 * Run with: node tools/verify-import.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const SCRIPT_FILES = ["js/sync.js", "js/data.js"];
const USER_ID = "user-1";
const STORAGE_KEY = "mylife:user-data:v1";
const BACKUP_PREFIX = "mylife:backup:";

const createStorage = ({ failWhen } = {}) => {
  const entries = new Map();
  return {
    getItem: key => (entries.has(String(key)) ? entries.get(String(key)) : null),
    setItem: (key, value) => {
      if (failWhen && failWhen(String(key))) {
        const error = new Error("simulated storage failure");
        error.name = "SimulatedError";
        throw error;
      }
      entries.set(String(key), String(value));
    },
    removeItem: key => { entries.delete(String(key)); },
    clear: () => entries.clear(),
    key: index => [...entries.keys()][index] ?? null,
    get length() { return entries.size; },
    dump: () => JSON.stringify([...entries.entries()].sort())
  };
};

const createFakeSupabase = row => {
  const state = { payload: row ? JSON.parse(JSON.stringify(row)) : null, upsertCount: 0 };
  const client = {
    auth: {
      async getUser() { return { data: { user: { id: USER_ID } }, error: null }; },
      async getSession() { return { data: { session: null } }; }
    },
    from() {
      return {
        select() {
          return { eq() { return { async maybeSingle() { return { data: state.payload ? { payload: JSON.parse(JSON.stringify(state.payload)) } : null, error: null }; } }; } };
        },
        async upsert(record) {
          state.upsertCount += 1;
          state.payload = JSON.parse(JSON.stringify(record.payload));
          return { error: null };
        }
      };
    }
  };
  return { client, state };
};

const loadApp = (client, localStorage) => {
  const toasts = [];
  const sandbox = {
    console: { ...console, warn() {}, info() {} }, structuredClone, setTimeout, clearTimeout, setInterval, clearInterval,
    Promise, Date, Math, JSON, Intl, Object, Array, String, Number, Boolean, Error, RegExp, Map, Set,
    isNaN, parseInt, parseFloat, TextEncoder,
    localStorage, sessionStorage: createStorage(),
    navigator: { onLine: true },
    location: { origin: "http://localhost", pathname: "/", hash: "#settings", search: "" },
    document: { visibilityState: "visible", addEventListener() {}, querySelectorAll: () => [], getElementById: () => null }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.MYLIFE_SUPABASE = { url: "https://example.supabase.co", anonKey: "anon-key", enabled: true };
  sandbox.window.supabaseClient = client;
  sandbox.window.MYLIFE_SUPABASE_API = { async uploadImageDataUrl() { return null; } };
  sandbox.App = { render() {} };
  sandbox.Login = { guestMode: false };
  sandbox.t = key => key; // i18n is not loaded in the sandbox
  sandbox.Toast = { show: message => toasts.push(message) };
  vm.createContext(sandbox);
  vm.runInContext(SCRIPT_FILES.map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n"), sandbox, { filename: "mylife-bundle.js" });
  sandbox.__toasts = toasts;
  return sandbox;
};

const evaluate = (sandbox, code) => vm.runInContext(`(function() { ${code} })()`, sandbox);
const runAsync = (sandbox, code) => vm.runInContext(`(async () => { ${code} })()`, sandbox);
const settle = () => new Promise(resolve => setTimeout(resolve, 40));

const CURRENT = {
  profile: { name: "Tra", email: "tra@example.com", currency: "USD", language: "English" },
  expenses: [{ id: "exp-current", description: "Lunch", amount: 4.5, currency: "USD", category: "Food", date: "2026-10-20" }],
  bills: [{ id: "bill-current", name: "Electricity", amount: 30, currency: "USD", due: "2026-10-25", frequency: "Monthly", status: "Upcoming" }]
};
const VALID_BACKUP = {
  profile: { name: "Tra", email: "tra@example.com", currency: "KHR", language: "Khmer" },
  expenses: [{ id: "exp-imported", description: "Rice", amount: 8000, currency: "KHR", category: "Food", date: "2026-09-01" }],
  bills: [],
  family: [{ id: "fam-1", name: "Mom", relationship: "Mother" }],
  deletions: { goals: { "goal-old": "2026-09-01T00:00:00.000Z" } },
  someFutureSection: { kept: true }
};

/** A logged-in app with CURRENT data loaded locally and in the (fake) cloud. */
const bootWithCurrentData = async (storageOptions = {}) => {
  const localStorage = createStorage(storageOptions);
  const { client, state } = createFakeSupabase(CURRENT);
  const sandbox = loadApp(client, localStorage);
  await runAsync(sandbox, "await Store.syncFromSupabase();");
  await settle();
  assert.deepStrictEqual(evaluate(sandbox, "return appData.expenses.map(e => e.id);"), ["exp-current"], "setup: current data loaded");
  return { sandbox, localStorage, state };
};

const snapshot = ({ sandbox, localStorage, state }) => ({
  appData: evaluate(sandbox, "return JSON.stringify(appData);"),
  local: localStorage.getItem(STORAGE_KEY),
  storage: localStorage.dump(),
  cloud: JSON.stringify(state.payload),
  upserts: state.upsertCount,
  backups: evaluate(sandbox, "return Store.listBackups().length;")
});

const assertUntouched = async (ctx, before, label) => {
  await settle();
  const after = snapshot(ctx);
  assert.strictEqual(after.appData, before.appData, `${label}: in-memory data must not change`);
  assert.strictEqual(after.local, before.local, `${label}: the local saved copy must not change`);
  assert.strictEqual(after.storage, before.storage, `${label}: nothing may be written to localStorage (no backup, no snapshot)`);
  assert.strictEqual(after.cloud, before.cloud, `${label}: the Supabase copy must not change`);
  assert.strictEqual(after.upserts, before.upserts, `${label}: no upload may be sent`);
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* ---------------- malformed / wrong types: rejected, nothing touched ---------------- */

const MALFORMED = [
  ["expenses: null", { profile: { name: "X" }, expenses: null }],
  ["bills: \"oops\"", { profile: { name: "X" }, bills: "oops" }],
  ["expenses: null + bills: \"oops\" (QC repro)", { profile: {}, expenses: null, bills: "oops" }],
  ["profile missing", { expenses: [] }],
  ["profile is a list", { profile: [], expenses: [] }],
  ["record is a number", { profile: {}, expenses: [1, { id: "ok" }] }],
  ["record is null", { profile: {}, family: [null] }],
  ["mood is a string", { profile: {}, mood: "happy" }],
  ["deletions is a list", { profile: {}, deletions: [] }],
  ["deletions.expenses is a number", { profile: {}, deletions: { expenses: 5 } }],
  ["dailyFocus.items is a string", { profile: {}, dailyFocus: { date: "", items: "x" } }],
  ["top level is a list", [{ profile: {} }]],
  ["top level is a string (malformed JSON text)", "{ this is not json"],
  ["top level is null", null]
];

MALFORMED.forEach(([label, bad]) => {
  test(`rejects ${label} and changes nothing (local + cloud)`, async () => {
    const ctx = await bootWithCurrentData();
    const before = snapshot(ctx);
    ctx.sandbox.__bad = bad;
    const result = evaluate(ctx.sandbox, "return Store.importData(globalThis.__bad);");
    assert.strictEqual(result.ok, false, "import must be refused");
    assert.ok(result.errors.length > 0 && typeof result.errors[0] === "string", "a readable reason must be returned");
    assert.strictEqual(result.backupKey, "", "no backup is made for a refused file");
    await assertUntouched(ctx, before, label);
  });
});

test("validator names the broken fields for the user", async () => {
  const ctx = await bootWithCurrentData();
  const check = evaluate(ctx.sandbox, 'return validateAppDataImport({ profile: {}, expenses: null, bills: "oops" });');
  assert.strictEqual(check.ok, false);
  assert.ok(check.errors.some(e => e.startsWith("expenses:") && e.includes("null")), JSON.stringify(check.errors));
  assert.ok(check.errors.some(e => e.startsWith("bills:") && e.includes("oops")), JSON.stringify(check.errors));
});

test("JSON.parse failure (the UI's first step) leaves everything untouched", async () => {
  const ctx = await bootWithCurrentData();
  const before = snapshot(ctx);
  assert.throws(() => JSON.parse("{ \"profile\": {}, \"expenses\": [ }"), SyntaxError);
  await assertUntouched(ctx, before, "malformed JSON text");
});

/* ---------------- valid import ---------------- */

test("a valid import saves a recoverable backup FIRST, then replaces local + cloud data", async () => {
  const ctx = await bootWithCurrentData();
  const before = snapshot(ctx);
  ctx.sandbox.__good = VALID_BACKUP;
  const result = evaluate(ctx.sandbox, "return Store.importData(globalThis.__good);");
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.ok(result.backupKey.startsWith(BACKUP_PREFIX) && result.backupKey.endsWith(":before-import"), `backup key: ${result.backupKey}`);

  // the backup holds exactly the data that was there before the import
  const saved = JSON.parse(ctx.localStorage.getItem(result.backupKey));
  assert.strictEqual(JSON.stringify(saved), before.appData, "the backup must equal the pre-import data");
  assert.strictEqual(evaluate(ctx.sandbox, "return Store.listBackups().length;"), before.backups + 1, "the backup is listed under Restore local backup");

  // the imported data replaced the old data
  assert.deepStrictEqual(evaluate(ctx.sandbox, "return appData.expenses.map(e => e.id);"), ["exp-imported"]);
  assert.deepStrictEqual(evaluate(ctx.sandbox, "return appData.bills.length;"), 0);
  assert.deepStrictEqual(evaluate(ctx.sandbox, "return appData.family.map(f => f.name);"), ["Mom"]);
  assert.strictEqual(evaluate(ctx.sandbox, "return appData.profile.currency;"), "KHR");
  assert.strictEqual(evaluate(ctx.sandbox, "return appData.profile.theme;"), "light", "missing profile fields fall back to defaults");
  assert.ok(evaluate(ctx.sandbox, "return Array.isArray(appData.goals) && Array.isArray(appData.reminders);"), "missing sections become empty lists");
  assert.deepStrictEqual(evaluate(ctx.sandbox, "return appData.someFutureSection;"), { kept: true }, "unknown sections are kept as before");
  assert.ok(JSON.parse(ctx.localStorage.getItem(STORAGE_KEY)).expenses.some(e => e.id === "exp-imported"), "local copy saved");

  // the cloud copy is replaced (existing behaviour: mode "replace")
  await settle();
  assert.ok(ctx.state.upsertCount > before.upserts, "the import is uploaded");
  assert.deepStrictEqual(ctx.state.payload.expenses.map(e => e.id), ["exp-imported"], "cloud now holds the imported data, not a merge");
});

test("the before-import backup restores the old data", async () => {
  const ctx = await bootWithCurrentData();
  const before = snapshot(ctx);
  ctx.sandbox.__good = VALID_BACKUP;
  const { backupKey } = evaluate(ctx.sandbox, "return Store.importData(globalThis.__good);");
  ctx.sandbox.__key = backupKey;
  assert.strictEqual(evaluate(ctx.sandbox, "return Store.restoreBackup(globalThis.__key);"), true);
  assert.deepStrictEqual(evaluate(ctx.sandbox, "return appData.expenses.map(e => e.id);"), ["exp-current"]);
  assert.deepStrictEqual(evaluate(ctx.sandbox, "return appData.bills.map(b => b.id);"), ["bill-current"]);
  assert.strictEqual(evaluate(ctx.sandbox, "return appData.profile.name;"), JSON.parse(before.appData).profile.name);
});

test("importing into an empty app works", async () => {
  const localStorage = createStorage();
  const { client, state } = createFakeSupabase(null);
  const sandbox = loadApp(client, localStorage);
  evaluate(sandbox, "Object.keys(appData).forEach(k => delete appData[k]); Object.assign(appData, structuredClone(emptyData));");
  sandbox.__good = VALID_BACKUP;
  const result = evaluate(sandbox, "return Store.importData(globalThis.__good);");
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(evaluate(sandbox, "return appData.expenses.map(e => e.id);"), ["exp-imported"]);
  await settle();
  assert.ok(state.upsertCount >= 1);
});

/* ---------------- failed imports ---------------- */

test("if the backup cannot be written, the import is refused and nothing changes", async () => {
  const ctx = await bootWithCurrentData({ failWhen: key => key.startsWith(BACKUP_PREFIX) });
  const before = snapshot(ctx);
  ctx.sandbox.__good = VALID_BACKUP;
  const result = evaluate(ctx.sandbox, "return Store.importData(globalThis.__good);");
  assert.strictEqual(result.ok, false);
  assert.strictEqual(JSON.stringify(result.errors), JSON.stringify(["backup_failed"]));
  await assertUntouched(ctx, before, "backup failure");
});

test("if saving the imported data fails, the old data is put back and nothing is uploaded", async () => {
  const ctx = await bootWithCurrentData();
  // fail only the main snapshot write from now on (not a quota error → nothing written)
  const realSet = ctx.localStorage.setItem;
  ctx.localStorage.setItem = (key, value) => {
    if (key === STORAGE_KEY) { const error = new Error("disk error"); error.name = "SimulatedError"; throw error; }
    return realSet(key, value);
  };
  const before = snapshot(ctx);
  ctx.sandbox.__good = VALID_BACKUP;
  const result = evaluate(ctx.sandbox, "return Store.importData(globalThis.__good);");
  assert.strictEqual(result.ok, false);
  assert.strictEqual(JSON.stringify(result.errors), JSON.stringify(["save_failed"]));
  assert.ok(result.backupKey, "the safety backup was still made");
  await settle();
  assert.strictEqual(snapshot(ctx).appData, before.appData, "in-memory data restored");
  assert.strictEqual(ctx.localStorage.getItem(STORAGE_KEY), before.local, "local copy unchanged");
  assert.strictEqual(JSON.stringify(ctx.state.payload), before.cloud, "cloud unchanged");
  assert.strictEqual(ctx.state.upsertCount, before.upserts, "no upload");
});

test("a storage-full save during import also leaves the old local copy in place", async () => {
  const ctx = await bootWithCurrentData();
  const realSet = ctx.localStorage.setItem;
  let first = true;
  // first write of the main key = quota error; the compacted retry succeeds (as in a real browser)
  ctx.localStorage.setItem = (key, value) => {
    if (key === STORAGE_KEY && first) { first = false; const error = new Error("quota"); error.name = "QuotaExceededError"; throw error; }
    return realSet(key, value);
  };
  const before = snapshot(ctx);
  ctx.sandbox.__good = VALID_BACKUP;
  const result = evaluate(ctx.sandbox, "return Store.importData(globalThis.__good);");
  assert.strictEqual(result.ok, false);
  await settle();
  assert.strictEqual(snapshot(ctx).appData, before.appData, "in-memory data restored");
  assert.strictEqual(ctx.localStorage.getItem(STORAGE_KEY), before.local, "local copy restored after the compacted write");
  assert.strictEqual(JSON.stringify(ctx.state.payload), before.cloud, "cloud unchanged");
  assert.strictEqual(ctx.state.upsertCount, before.upserts, "no upload");
});

/* ------------------------------------------------------------------------ */

(async () => {
  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok   ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`  FAIL ${name}\n       ${error.message}`);
    }
  }
  console.log(`\n${tests.length - failures}/${tests.length} import checks passed`);
  process.exit(failures ? 1 : 0);
})();
