/**
 * Regression harness for the "deleted record comes back after refresh" bug.
 *
 * It loads the real js/sync.js + js/data.js inside a VM sandbox (stubbed window,
 * localStorage and Supabase client) and replays the mobile failure that caused the
 * bug: a local change is made, the upload never lands because the WebView is killed,
 * and the app is then relaunched against a stale cloud copy.
 *
 * Run with: npm run verify:sync
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const SCRIPT_FILES = ["js/sync.js", "js/data.js"];
const TABLE = "app_data";
const USER_ID = "user-1";

const createStorage = () => {
  const entries = new Map();
  return {
    getItem: key => (entries.has(String(key)) ? entries.get(String(key)) : null),
    setItem: (key, value) => { entries.set(String(key), String(value)); },
    removeItem: key => { entries.delete(String(key)); },
    clear: () => entries.clear(),
    key: index => [...entries.keys()][index] ?? null,
    get length() { return entries.size; }
  };
};

/** Minimal stand-in for the pieces of the Supabase client that data.js touches. */
const createFakeSupabase = ({ row = null } = {}) => {
  const state = {
    payload: row ? JSON.parse(JSON.stringify(row)) : null,
    upsertCount: 0,
    failedUploads: 0,
    failUploads: false
  };

  const client = {
    auth: {
      async getUser() {
        return { data: { user: { id: USER_ID } }, error: null };
      },
      async getSession() {
        return { data: { session: null } };
      }
    },
    from(table) {
      assert.strictEqual(table, TABLE, "data.js must only talk to the app_data table");
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: state.payload ? { payload: JSON.parse(JSON.stringify(state.payload)) } : null,
                    error: null
                  };
                }
              };
            }
          };
        },
        async upsert(record) {
          if (state.failUploads) {
            state.failedUploads += 1;
            return { error: { message: "simulated network failure" } };
          }
          state.upsertCount += 1;
          state.payload = JSON.parse(JSON.stringify(record.payload));
          return { error: null };
        }
      };
    }
  };

  return { client, state };
};

const createSandbox = (client, localStorage, sessionStorage) => {
  const sandbox = {
    // js/i18n.js loads after data.js in the app; Store.load() runs later (app.js) when t exists
    t: key => key,
    console,
    structuredClone,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Date,
    Math,
    JSON,
    Intl,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    RegExp,
    Map,
    Set,
    isNaN,
    parseInt,
    parseFloat,
    TextEncoder,
    localStorage,
    sessionStorage,
    navigator: { onLine: true },
    location: { origin: "http://localhost", pathname: "/", hash: "#home", search: "" },
    document: {
      visibilityState: "visible",
      addEventListener() {},
      querySelectorAll: () => [],
      getElementById: () => null
    }
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.MYLIFE_SUPABASE = { url: "https://example.supabase.co", anonKey: "anon-key", enabled: true };
  sandbox.window.supabaseClient = client;
  // No data URLs to upload in these tests.
  sandbox.window.MYLIFE_SUPABASE_API = { async uploadImageDataUrl() { return null; } };
  // Stubs for globals that data.js only calls through the UI.
  sandbox.App = { render() {} };
  sandbox.Login = { guestMode: false };

  vm.createContext(sandbox);
  return sandbox;
};

const loadApp = (client, localStorage, sessionStorage) => {
  const sandbox = createSandbox(client, localStorage, sessionStorage);
  const source = SCRIPT_FILES
    .map(file => fs.readFileSync(path.join(root, file), "utf8"))
    .join("\n");
  vm.runInContext(source, sandbox, { filename: "mylife-bundle.js" });
  return sandbox;
};

const evaluate = (sandbox, expression) => vm.runInContext(`(function() { ${expression} })()`, sandbox);
const runAsync = (sandbox, code) => vm.runInContext(`(async () => { ${code} })().catch(error => { throw error; })`, sandbox);
const settle = () => new Promise(resolve => setTimeout(resolve, 25));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const FAMILY_PAYLOAD = {
  profile: { name: "Sokha", email: "", currency: "USD", language: "English" },
  family: [
    { id: "family-keep", name: "Dad", relationship: "Father" },
    { id: "family-delete", name: "Mom", relationship: "Mother" }
  ]
};

/* --------------------------------------------------------------------------
 * The reported bug
 * ------------------------------------------------------------------------ */

test("a deleted record stays deleted after a refresh when the upload never landed", async () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const { client, state } = createFakeSupabase({ row: FAMILY_PAYLOAD });
  // Every upload from here on fails: this is the phone whose WebView is killed
  // before the upsert lands, leaving a stale cloud copy behind.
  state.failUploads = true;

  let sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "await Store.syncFromSupabase();");

  assert.deepStrictEqual(
    evaluate(sandbox, "return appData.family.map(item => item.id).sort();"),
    ["family-delete", "family-keep"],
    "the seeded cloud data should load on first boot"
  );

  await runAsync(sandbox, 'Store.delete("family", "family-delete");');
  await settle();

  assert.ok(
    evaluate(sandbox, "return SyncState.pendingInfo();"),
    "a failed upload must leave the pending flag set so it is retried"
  );
  assert.strictEqual(state.upsertCount, 0, "the simulated network kept every upload from landing");

  // The app is relaunched. Same localStorage, same stale cloud row.
  sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "Store.load();");
  assert.deepStrictEqual(
    evaluate(sandbox, "return appData.family.map(item => item.id);"),
    ["family-keep"],
    "the local snapshot must not contain the deleted member"
  );

  await runAsync(sandbox, "await Store.syncFromSupabase();");
  assert.deepStrictEqual(
    evaluate(sandbox, "return appData.family.map(item => item.id);"),
    ["family-keep"],
    "the cloud pull must not resurrect the deleted member"
  );

  assert.ok(
    evaluate(sandbox, 'return SyncState.deletions(appData).family["family-delete"];'),
    "the deletion must be recorded as a tombstone"
  );
});

test("a tombstone outlasts a stale cloud copy on every later refresh", async () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const { client, state } = createFakeSupabase({ row: FAMILY_PAYLOAD });
  state.failUploads = true;

  let sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "await Store.syncFromSupabase();");
  await runAsync(sandbox, 'Store.delete("family", "family-delete");');
  await settle();

  // Three consecutive relaunches, each against the same stale row.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    sandbox = loadApp(client, localStorage, sessionStorage);
    await runAsync(sandbox, "Store.load(); await Store.syncFromSupabase();");
    assert.deepStrictEqual(
      evaluate(sandbox, "return appData.family.map(item => item.id);"),
      ["family-keep"],
      `relaunch ${attempt + 1} must not resurrect the deleted member`
    );
  }
});

/* --------------------------------------------------------------------------
 * Convergence: the cloud copy must catch up
 * ------------------------------------------------------------------------ */

test("the cloud copy converges once the upload finally succeeds", async () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const { client, state } = createFakeSupabase({ row: FAMILY_PAYLOAD });

  let sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "await Store.syncFromSupabase();");
  await runAsync(sandbox, 'Store.delete("family", "family-delete");');
  await settle();

  assert.deepStrictEqual(
    state.payload.family.map(item => item.id),
    ["family-keep"],
    "a successful upload must overwrite the cloud copy without the deleted member"
  );
  assert.ok(state.upsertCount > 0, "the deletion must reach the cloud");
  assert.strictEqual(
    evaluate(sandbox, "return SyncState.isPending();"),
    false,
    "the pending flag must stand down after a successful upload"
  );

  sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "Store.load(); await Store.syncFromSupabase();");
  assert.deepStrictEqual(
    evaluate(sandbox, "return appData.family.map(item => item.id);"),
    ["family-keep"],
    "the record must stay deleted after the cloud copy has converged"
  );
});

test("a stale remote row still holding the record is corrected, not adopted", async () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const { client, state } = createFakeSupabase({ row: FAMILY_PAYLOAD });

  let sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "await Store.syncFromSupabase();");
  await runAsync(sandbox, 'Store.delete("family", "family-delete");');
  await settle();

  // A second device wrote the stale row back, still containing the deleted member.
  state.payload = JSON.parse(JSON.stringify(FAMILY_PAYLOAD));

  sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "Store.load(); await Store.syncFromSupabase();");
  assert.deepStrictEqual(
    evaluate(sandbox, "return appData.family.map(item => item.id);"),
    ["family-keep"],
    "the local tombstone must win over the remote record"
  );
  assert.deepStrictEqual(
    state.payload.family.map(item => item.id),
    ["family-keep"],
    "the corrected state must be pushed back so the record does not return on the next refresh"
  );
});

/* --------------------------------------------------------------------------
 * No regressions in the merge behaviour the app already relied on
 * ------------------------------------------------------------------------ */

test("a locally added record survives a pull from a stale cloud row", async () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const { client, state } = createFakeSupabase({ row: FAMILY_PAYLOAD });

  let sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "await Store.syncFromSupabase();");
  // Added while the upload cannot land, so the cloud has no idea it exists.
  await runAsync(sandbox, 'Store.add("family", { name: "Sister", relationship: "Sister" });');
  await settle();

  assert.deepStrictEqual(
    evaluate(sandbox, "return appData.family.map(item => item.name).sort();"),
    ["Dad", "Mom", "Sister"],
    "the new record must sit alongside the cloud records"
  );

  // The cloud row is still the pre-add one.
  state.payload = JSON.parse(JSON.stringify(FAMILY_PAYLOAD));
  sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "Store.load(); await Store.syncFromSupabase();");
  assert.deepStrictEqual(
    evaluate(sandbox, "return appData.family.map(item => item.name).sort();"),
    ["Dad", "Mom", "Sister"],
    "the local addition must not be dropped by the stale cloud pull"
  );
});

test("clearing a section is durable", async () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const { client, state } = createFakeSupabase({ row: FAMILY_PAYLOAD });
  state.failUploads = true;

  let sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "await Store.syncFromSupabase();");
  await runAsync(sandbox, 'Store.updateUserData({ familyEnabled: false, name: "Sokha" });');
  await settle();

  assert.deepStrictEqual(
    evaluate(sandbox, "return appData.family.length;"),
    0,
    "disabling a section must empty it locally"
  );

  sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "Store.load(); await Store.syncFromSupabase();");
  assert.deepStrictEqual(
    evaluate(sandbox, "return appData.family.length;"),
    0,
    "the emptied section must not be restored by the cloud pull"
  );
});

test("Clear data does not restore itself from the cloud", async () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const { client } = createFakeSupabase({ row: FAMILY_PAYLOAD });
  let sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "await Store.syncFromSupabase();");
  await runAsync(sandbox, "Store.clear();");
  await settle();

  sandbox = loadApp(client, localStorage, sessionStorage);
  await runAsync(sandbox, "Store.load(); await Store.syncFromSupabase();");
  assert.deepStrictEqual(
    evaluate(sandbox, "return appData.family.length;"),
    0,
    "cleared data must not come back after a refresh"
  );
});

/* --------------------------------------------------------------------------
 * Tombstone unit behaviour
 * ------------------------------------------------------------------------ */

test("tombstones merge by newest timestamp and are pruned by age", async () => {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const { client } = createFakeSupabase();
  const sandbox = loadApp(client, localStorage, sessionStorage);

  const merged = evaluate(sandbox, `
    const older = { family: { a: "2020-01-01T00:00:00.000Z" }, goals: { g: "2024-01-01T00:00:00.000Z" } };
    const newer = { family: { a: "2025-01-01T00:00:00.000Z", b: "2025-02-01T00:00:00.000Z" } };
    return SyncState.merge(older, newer);
  `);

  assert.strictEqual(merged.family.a, "2025-01-01T00:00:00.000Z", "the newest timestamp must win per record");
  assert.strictEqual(merged.family.b, "2025-02-01T00:00:00.000Z", "records only one side knows about must survive");
  assert.strictEqual(merged.goals.g, "2024-01-01T00:00:00.000Z", "one side's collections must not be dropped");
  assert.strictEqual(
    evaluate(sandbox, `
      const data = {
        family: [{ id: "keep" }, { id: "gone" }],
        deletions: { family: { gone: new Date().toISOString() } }
      };
      SyncState.apply(data);
      return JSON.stringify(data.family.map(item => item.id));
    `),
    JSON.stringify(["keep"]),
    "tombstoned records must be filtered out of their list"
  );
  assert.strictEqual(
    evaluate(sandbox, `
      const data = { deletions: { family: { old: "2020-01-01T00:00:00.000Z" } } };
      return SyncState.prune(data);
    `),
    1,
    "tombstones older than the retention window must be pruned"
  );
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
      console.error(`  FAIL ${name}`);
      console.error(`       ${error.message}`);
    }
  }
  console.log(`\n${tests.length - failures}/${tests.length} sync regression checks passed`);
  process.exit(failures === 0 ? 0 : 1);
})();
