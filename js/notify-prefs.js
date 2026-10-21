/*
 * Notification control center — shared rules for the app and the server.
 *
 * Saved in appData.profile.notify (synced in Supabase app_data):
 *   { telegram: true, app: true, tools: { bills: true, ... },
 *     stages: { bills: [3, 0], loans: [0], savings: [0], calendar: [0], family: [0] } }
 *
 * - profile.notificationsEnabled === false is still the master "everything off".
 * - Channel off (telegram / app) stops delivery through that channel only.
 * - Tool off stops that tool's alerts only; the tool itself keeps working.
 * - stages[tool]: days before the date to remind (0 = on the day itself), for every
 *   tool that has dates (STAGE_TOOLS). Older saves only had billStages (= stages.bills).
 *   Per-item settings (event "remind before", family "days before", per-goal
 *   reminders) still work on top of these.
 * The older switches (budgetAlerts, morningDigest, per-bill "reminder", ...) still apply.
 */
(function (root) {
  const TOOLS = ["bills", "expenses", "loans", "savings", "calendar", "family", "reports", "backup"];

  // alert kind (server items, app items, bell types) → tool
  const TOOL_OF = {
    bill: "bills", autopay: "bills", utility: "bills",
    budget: "expenses", unusual: "expenses", evening: "expenses", expense: "expenses", income: "expenses",
    loan: "loans",
    "savings-contribution": "savings", "savings-deadline": "savings", goal: "savings",
    calendar: "calendar", event: "calendar", reminder: "calendar",
    birthday: "family", anniversary: "family", "family-birthday": "family", "family-anniversary": "family",
    digest: "reports", weekly: "reports", "weekly-image": "reports", "monthly-image": "reports", report: "reports",
    "backup-file": "backup"
  };

  const BILL_STAGES = [3, 2, 1, 0];
  const STAGES = BILL_STAGES;
  // tools whose items have a date → they get the 3 / 2 / 1 day / on-the-day choices
  const STAGE_TOOLS = ["bills", "loans", "savings", "calendar", "family"];

  const cleanStages = list => [...new Set((Array.isArray(list) ? list : []).map(Number).filter(n => STAGES.includes(n)))].sort((a, b) => b - a);

  function prefs(profile) {
    const raw = (profile && typeof profile.notify === "object" && profile.notify) || {};
    const tools = {};
    TOOLS.forEach(tool => { tools[tool] = !(raw.tools && raw.tools[tool] === false); });
    const saved = raw.stages && typeof raw.stages === "object" ? raw.stages : {};
    const stages = {};
    STAGE_TOOLS.forEach(tool => {
      let list = saved[tool];
      if (!Array.isArray(list) && tool === "bills") list = raw.billStages;
      stages[tool] = Array.isArray(list) ? cleanStages(list) : [0];
    });
    return {
      telegram: raw.telegram !== false,
      app: raw.app !== false,
      tools,
      stages,
      billStages: stages.bills
    };
  }

  // days-before list for a tool (or an alert kind); [0] for tools without dates
  function stagesFor(profile, toolOrKind) {
    const tool = STAGE_TOOLS.includes(toolOrKind) ? toolOrKind : toolOf(toolOrKind);
    return STAGE_TOOLS.includes(tool) ? prefs(profile).stages[tool] : [0];
  }

  function toolOf(kind) {
    return TOOL_OF[String(kind || "")] || "";
  }

  // channel: "telegram" | "app" (web push, pop-ups, bell)
  function allows(profile, kind, channel) {
    if (profile && profile.notificationsEnabled === false) return false;
    const p = prefs(profile);
    if (channel === "telegram" && !p.telegram) return false;
    if (channel === "app" && !p.app) return false;
    const tool = toolOf(kind);
    return !tool || p.tools[tool];
  }

  const api = { TOOLS, BILL_STAGES, STAGES, STAGE_TOOLS, prefs, toolOf, allows, stagesFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NotifyPrefs = api;
})(typeof window !== "undefined" ? window : globalThis);
