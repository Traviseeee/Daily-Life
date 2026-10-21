/*
 * Notification control center — shared rules for the app and the server.
 *
 * Saved in appData.profile.notify (synced in Supabase app_data):
 *   { telegram: true, app: true, tools: { bills: true, ... }, billStages: [0] }
 *
 * - profile.notificationsEnabled === false is still the master "everything off".
 * - Channel off (telegram / app) stops delivery through that channel only.
 * - Tool off stops that tool's alerts only; the tool itself keeps working.
 * - billStages: days before the due date to remind (0 = on the due date).
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

  function prefs(profile) {
    const raw = (profile && typeof profile.notify === "object" && profile.notify) || {};
    const tools = {};
    TOOLS.forEach(tool => { tools[tool] = !(raw.tools && raw.tools[tool] === false); });
    const stages = Array.isArray(raw.billStages)
      ? raw.billStages.map(Number).filter(n => BILL_STAGES.includes(n))
      : [0];
    return {
      telegram: raw.telegram !== false,
      app: raw.app !== false,
      tools,
      billStages: [...new Set(stages)].sort((a, b) => b - a)
    };
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

  const api = { TOOLS, BILL_STAGES, prefs, toolOf, allows };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NotifyPrefs = api;
})(typeof window !== "undefined" ? window : globalThis);
