/* Shared "together since" date for a couple in the family group (11 Nov 2026).
 * Table public.family_couples (supabase/migrations/20261111_family_couples.sql):
 * only the two people can read their row; family_couple_set() writes it.
 * - Tra keeps his love date on his own family card (as before). When the partner
 *   card is linked to an account (card.userId), the date is shared to that row.
 * - Lychee (no local couple card) sees the same love card from the shared row.
 * - If the partner changes the date, Tra's card follows it. Nothing is deleted. */
const FamilyCouple = (() => {
  let rows = null;
  let loadedAt = 0;
  let loading = null;
  let busy = false;
  const client = () => (typeof window !== "undefined" ? window.supabaseClient : null);
  const fg = () => (typeof FamilyGroup !== "undefined" ? FamilyGroup.state : null);
  const ready = () => Boolean(client() && fg()?.status === "ready" && fg()?.family?.id && fg()?.me);
  const me = () => fg()?.me;
  const partnerOf = row => (row.user_a === me() ? row.user_b : row.user_a);
  const L2 = (k, e) => (typeof languageCode === "function" && languageCode() !== "km" ? e : k);

  // my couple on my own cards: one card has relatedMemberId + anniversaryDate, one of the two is me
  function localPair() {
    const fam = appData.family || [];
    const card = fam.find(item => item.relatedMemberId && item.anniversaryDate && fam.some(other => other.id === item.relatedMemberId));
    if (!card) return null;
    const other = fam.find(item => item.id === card.relatedMemberId);
    const isMe = person => person.relationship === "Me" || (me() && person.userId === me());
    const partner = isMe(card) ? other : isMe(other) ? card : null;
    if (!partner?.userId || partner.userId === me()) return null;
    if (!(fg()?.members || []).some(member => member.user_id === partner.userId)) return null;
    return { card, partner };
  }

  async function load(force = false) {
    if (!ready()) return;
    if (loading) return loading;
    if (!force && rows && Date.now() - loadedAt < 60000) return;
    loading = (async () => {
      const { data, error } = await client().from("family_couples").select("*").eq("family_id", fg().family.id);
      if (error) { rows = rows || []; return; } // table not installed yet → nothing changes
      rows = data || [];
      loadedAt = Date.now();
      await reconcile();
      repaint();
    })().catch(() => { rows = rows || []; }).finally(() => { loading = null; });
    return loading;
  }

  // keep my card and the shared row the same date (newest edit wins)
  // keep my card and the shared row on the same date. The card remembers the last
  // date both sides agreed on (coupleSynced): if my date moved away from it, I changed
  // it → send mine; if only the shared row moved, my partner changed it → take theirs.
  let failedAt = 0;
  function remember(card, date) {
    if (card.coupleSynced === date) return;
    card.coupleSynced = date;
    try { Store.save(); } catch (error) { /* next save keeps it */ }
  }
  async function reconcile() {
    const pair = localPair();
    if (!pair || busy) return;
    const row = rows.find(item => partnerOf(item) === pair.partner.userId);
    const mine = String(pair.card.anniversaryDate || "").slice(0, 10);
    const synced = String(pair.card.coupleSynced || "");
    if (row && row.start_date === mine) { remember(pair.card, mine); return; }
    const iChanged = synced ? mine !== synced : !row || row.updated_by === me();
    if (row && !iChanged) {
      Store.edit("family", pair.card.id, { anniversaryDate: row.start_date, coupleSynced: row.start_date });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mine)) return;
    busy = true;
    try {
      const { data, error } = await client().rpc("family_couple_set", { p_family: fg().family.id, p_partner: pair.partner.userId, p_start: mine });
      if (error || !data) { failedAt = Date.now(); return; }
      rows = [...rows.filter(item => partnerOf(item) !== pair.partner.userId), data];
      remember(pair.card, mine);
    } finally { busy = false; }
  }
  // my card's date is not what the shared row says → sync now instead of waiting a minute
  function outOfStep() {
    if (!rows || Date.now() - failedAt < 30000) return false;
    const pair = localPair();
    if (!pair) return false;
    const row = rows.find(item => partnerOf(item) === pair.partner.userId);
    return !row || row.start_date !== String(pair.card.anniversaryDate || "").slice(0, 10);
  }

  function repaint() {
    const route = String(location.hash || "").replace("#", "").split("/")[0] || "home";
    if (["family", "home", "profile"].includes(route) && typeof App !== "undefined" && !document.querySelector("#modalRoot.open, .mp-sheet, .fl-sheet-wrap, .nd-pop, .nms")) App.render();
  }

  // called after every App.render
  function sync() { if (ready()) load(outOfStep()); }

  // the love card for someone who has no couple card of their own (Lychee)
  function virtual() {
    if (!rows?.length || localPair()) return null;
    const row = rows[0];
    const partnerId = partnerOf(row);
    const member = (fg()?.members || []).find(item => item.user_id === partnerId);
    if (!member) return null;
    const profile = FamilyGroup.profileOf ? FamilyGroup.profileOf(partnerId) : null;
    const mine = FamilyGroup.profileOf ? FamilyGroup.profileOf(me()) : null;
    const meCard = (appData.family || []).find(person => person.relationship === "Me");
    return {
      shared: true,
      partnerId,
      member: { id: "fc-me", name: meCard?.name || mine?.display_name || appData.profile?.name || L2("ខ្ញុំ", "Me"), photo: meCard?.photo || mine?.photo || "", anniversaryDate: row.start_date },
      other: { id: "fc-partner", name: FamilyGroup.nameOf ? FamilyGroup.nameOf(member) : (profile?.display_name || ""), photo: profile?.photo || "" }
    };
  }

  // Lychee can change the shared date from her love card
  function openEdit() {
    const v = virtual();
    if (!v) return;
    document.querySelector(".fl-sheet-wrap")?.remove();
    const today = typeof todayIso === "function" ? todayIso() : new Date().toISOString().slice(0, 10);
    document.body.insertAdjacentHTML("beforeend", `<div class="fl-sheet-wrap" role="dialog" aria-modal="true"><div class="fl-scrim" data-fc-close></div><div class="fl-sheet"><span class="fl-grab"></span>
      <h3>💞 ${escapeHtml(L2("ថ្ងៃចាប់ផ្ដើមស្រលាញ់គ្នា", "Together since"))}</h3>
      <p>${escapeHtml(L2(`ចែករំលែកជាមួយ ${v.other.name} · អ្នកទាំងពីរឃើញ និងកែបាន`, `Shared with ${v.other.name} · you both see and can edit it`))}</p>
      <input class="ev-date fc-date" type="date" max="${today}" value="${escapeAttr(v.member.anniversaryDate)}" data-fc-date>
      <div class="fl-btns"><button type="button" class="fl-btn" data-fc-close>${escapeHtml(L2("បោះបង់", "Cancel"))}</button><button type="button" class="fl-btn is-primary" data-fc-save>${escapeHtml(L2("រក្សាទុក", "Save"))}</button></div>
    </div></div>`);
    const wrap = document.querySelector(".fl-sheet-wrap");
    requestAnimationFrame(() => wrap.classList.add("is-in"));
    const close = () => { wrap.classList.remove("is-in"); setTimeout(() => wrap.remove(), 240); };
    wrap.addEventListener("click", async event => {
      if (event.target.closest("[data-fc-close]")) { close(); return; }
      if (!event.target.closest("[data-fc-save]")) return;
      const value = wrap.querySelector("[data-fc-date]").value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) { Toast.show(L2("⚠️ ជ្រើសថ្ងៃមុនថ្ងៃនេះ", "⚠️ Pick a day up to today")); return; }
      const { data, error } = await client().rpc("family_couple_set", { p_family: fg().family.id, p_partner: v.partnerId, p_start: value });
      if (error) { Toast.show(`⚠️ ${error.message}`); return; }
      rows = [...rows.filter(item => partnerOf(item) !== v.partnerId), data];
      close();
      Toast.show(L2("💞 បានរក្សាទុក · ទាំងពីរនាក់ឃើញថ្ងៃថ្មី", "💞 Saved · you both see the new date"));
      repaint();
    });
  }
  document.addEventListener("click", event => {
    if (event.target.closest("[data-fc-edit]")) { event.preventDefault(); openEdit(); }
  });

  // my own couple card is not linked to my partner's account, but we share one date → show that date
  function sharedDate() {
    if (!rows || rows.length !== 1 || localPair()) return "";
    return rows[0].start_date || "";
  }
  // for the member profile page: our date with this person (and my card to edit, if I keep one)
  function withPartner(userId) {
    const pair = localPair();
    if (pair && pair.partner.userId === userId) return { start: String(pair.card.anniversaryDate || "").slice(0, 10), cardId: pair.card.id };
    const row = (rows || []).find(item => partnerOf(item) === userId);
    return row ? { start: row.start_date, cardId: "" } : null;
  }
  return { sync, load, virtual, withPartner, sharedDate, rows: () => rows };
})();
