// Safe server-side edits of a user's app_data payload (Telegram bot, auto-pay).
// Optimistic locking: the write only lands if updated_at is still what we read.
// If the app saved in between, we read again and re-apply the change, so neither
// the app's edit (e.g. a new profile name) nor the bot's edit is ever lost.

async function updatePayloadSafe(supabase, userId, mutate, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const { data, error } = await supabase.from("app_data").select("payload,updated_at").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return "missing";
    const wasString = typeof data.payload === "string";
    const payload = wasString ? JSON.parse(data.payload || "{}") : data.payload || {};
    const result = await mutate(payload);
    if (result !== "updated") return result;
    let query = supabase.from("app_data")
      .update({ payload: wasString ? JSON.stringify(payload) : payload, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    query = data.updated_at ? query.eq("updated_at", data.updated_at) : query.is("updated_at", null);
    const { data: written, error: saveError } = await query.select("user_id");
    if (saveError) throw saveError;
    if (Array.isArray(written) && written.length) return "updated";
    // someone (the app) saved in between: read again and retry
    await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
  }
  throw new Error("MYLIFE payload changed too often; edit not saved");
}

module.exports = { updatePayloadSafe };
