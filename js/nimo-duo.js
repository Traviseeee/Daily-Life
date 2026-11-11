/* Nimo shared streak ("streak រួមគ្នា") with a family member (11 Nov 2026).
 * Server: supabase/migrations/20261111_nimo_duo.sql. A day counts only when both
 * people did their Nimo check-in that Phnom Penh day; the server counts it and gives
 * the 7 / 30 / 100-day XP. Hidden until the SQL is installed. */
const NimoDuo = (() => {
  const L = (k, e) => (typeof languageCode === "function" && languageCode() !== "km" ? e : k);
  let list = null;
  let loadedAt = 0;
  let loading = null;
  const asked = new Set();
  const client = () => (typeof window !== "undefined" ? window.supabaseClient : null);
  const fg = () => (typeof FamilyGroup !== "undefined" ? FamilyGroup.state : null);
  const ready = () => Boolean(client() && fg()?.status === "ready" && fg()?.family?.id && fg()?.me);
  const me = () => fg()?.me;
  const memberOf = id => (fg()?.members || []).find(member => member.user_id === id) || null;
  const nameOf = id => { const m = memberOf(id); return m && FamilyGroup.nameOf ? FamilyGroup.nameOf(m) : L("សមាជិក", "Member"); };
  const first = text => String(text || "").trim().split(/\s+/)[0] || "";
  const photoOf = id => (FamilyGroup.profileOf ? FamilyGroup.profileOf(id)?.photo : "") || "";
  const face = id => { const p = id === me() ? (photoOf(id) || (appData.family || []).find(x => x.relationship === "Me")?.photo || "") : photoOf(id); const n = id === me() ? (appData.profile?.name || "Me") : nameOf(id); return `<span class="nd-face">${p ? `<img src="${escapeAttr(p)}" alt="">` : escapeHtml(Array.from(n)[0] || "?")}</span>`; };
  const FLAME = '<svg class="nd-flame" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 2c2 6 9 9 9 19a9 9 0 0 1-18 0c0-4 2-7 4-8 0 3 1.5 5 3.5 5-1-5 0-11 1.5-16z" fill="#ff7a45"/><path d="M16 26c.6 1.6 2.6 2.6 2.6 5a2.6 2.6 0 0 1-5.2 0c0-1.6 1.4-2.8 2.6-5z" fill="#ffe08a"/></svg>';

  async function load(force = false) {
    if (!ready()) return;
    if (loading) return loading;
    if (!force && list && Date.now() - loadedAt < 60000) return;
    loading = (async () => {
      const { data, error } = await client().rpc("nimo_duo_refresh");
      if (error) { list = list || []; return; }
      list = (Array.isArray(data) ? data : []).filter(item => item.family === fg().family.id);
      loadedAt = Date.now();
      repaint();
      setTimeout(popups, 2800);
    })().catch(() => { list = list || []; }).finally(() => { loading = null; });
    return loading;
  }
  let lastSig = "";
  function repaint() {
    if (typeof NimoLife !== "undefined") { NimoLife.repaint?.(); NimoLife.repaintSheet?.(); }
    // Home hero badge + Nomi line: re-render once when the shared streak changed
    const sig = JSON.stringify(list || []);
    const route = String(location.hash || "").replace("#", "").split("/")[0] || "home";
    if (sig !== lastSig && (route === "home" || route === "profile") && typeof App !== "undefined" && !document.querySelector("#modalRoot.open, .nms, .mp-sheet, .fl-sheet-wrap")) { lastSig = sig; App.render(); }
    else lastSig = sig;
  }
  function sync() { if (ready()) load(); }
  const active = () => (list || []).filter(item => item.status === "active");

  // under the Nimo row on Home
  function row() {
    const duos = active().slice(0, 2);
    if (!duos.length) return "";
    return duos.map(item => {
      const partner = first(nameOf(item.partner));
      const waiting = item.meToday && !item.partnerToday;
      return `<div class="nd-row" data-nmc-open>
        <span class="nd-faces">${face(me())}${face(item.partner)}</span>
        <span class="nd-text"><b>${escapeHtml(L(`ខ្ញុំ + ${partner}`, `Me + ${partner}`))}</b><small>${escapeHtml(L(`streak រួម · វែងបំផុត ${item.longest}`, `shared streak · best ${item.longest}`))}</small></span>
        <span class="nd-num${item.streak ? "" : " is-off"}">${FLAME}<b>${item.streak}</b></span>
      </div>
      <div class="nd-today"><span class="${item.meToday ? "is-ok" : ""}">${item.meToday ? "✓" : "○"} ${escapeHtml(L("ខ្ញុំ", "Me"))}</span><span class="${item.partnerToday ? "is-ok" : ""}">${item.partnerToday ? "✓" : "○"} ${escapeHtml(partner)}${item.partnerToday ? "" : escapeHtml(L(" រង់ចាំ…", " waiting…"))}</span>${waiting && !nudged(item.partner) ? `<button type="button" class="nd-nudge" data-nd-nudge="${escapeAttr(item.partner)}">💜 ${escapeHtml(L("រំលឹក", "Nudge"))}</button>` : ""}</div>`;
    }).join("");
  }

  // small chip next to the hero Nomi on Home (js/home-v2.js nimoBadge)
  function badge() {
    const item = active()[0];
    if (!item) return "";
    return `<em class="hv4-duo${item.streak ? "" : " is-off"}${item.meToday && !item.partnerToday ? " is-wait" : ""}" title="${escapeAttr(L(`streak រួមជាមួយ ${nameOf(item.partner)}`, `shared streak with ${nameOf(item.partner)}`))}">${face(item.partner)}🔥${item.streak}</em>`;
  }
  // a line for the hero Nomi to say
  function heroLine() {
    const item = active()[0];
    if (!item) return null;
    const who = first(nameOf(item.partner));
    if (item.meToday && !item.partnerToday) return [`🔥 ${item.streak} ថ្ងៃជាមួយ ${who} · រង់ចាំ ${who} check-in`, `🔥 ${item.streak} days with ${who} · waiting for ${who}`];
    if (!item.meToday) return [`🔥 ${who} កំពុងរង់ចាំអ្នក · streak រួម ${item.streak} ថ្ងៃ`, `🔥 ${who} is waiting for you · ${item.streak}-day shared streak`];
    return [`🔥 ${item.streak} ថ្ងៃជាប់គ្នា ជាមួយ ${who}!`, `🔥 ${item.streak} days in a row with ${who}!`];
  }

  // section inside the Nimo sheet
  function sheetSection() {
    if (!ready() || list === null) return "";
    const others = (fg().members || []).filter(member => member.user_id !== me());
    if (!others.length) return "";
    const rows = others.map(member => {
      const id = member.user_id;
      const duo = (list || []).find(item => item.partner === id);
      let right;
      if (duo?.status === "active") right = `<span class="nd-st is-on">🔥 ${duo.streak} · <button type="button" class="nd-link" data-nd-leave="${escapeAttr(duo.id)}">${escapeHtml(L("ចាកចេញ", "Leave"))}</button></span>`;
      else if (duo?.status === "pending" && duo.invitedBy === me()) right = `<span class="nd-st">⏳ ${escapeHtml(L("រង់ចាំ", "Waiting"))}</span>`;
      else if (duo?.status === "pending") right = `<button type="button" class="nd-link" data-nd-no="${escapeAttr(duo.id)}">${escapeHtml(L("បដិសេធ", "Decline"))}</button><button type="button" class="nd-go" data-nd-yes="${escapeAttr(duo.id)}">🔥 ${escapeHtml(L("ចូលរួម", "Join"))}</button>`;
      else right = `<button type="button" class="nd-go" data-nd-invite="${escapeAttr(id)}">＋ ${escapeHtml(L("អញ្ជើញ", "Invite"))}</button>`;
      const sub = duo?.status === "active" ? L(`វែងបំផុត ${duo.longest} ថ្ងៃ`, `best ${duo.longest} days`) : duo?.status === "pending" && duo.invitedBy !== me() ? L("អញ្ជើញអ្នក", "invited you") : L("មិនទាន់ចូល streak", "not sharing yet");
      return `<div class="nms-row nd-mrow">${face(id)}<span class="nms-t">${escapeHtml(nameOf(id))}<small>${escapeHtml(sub)}</small></span>${right}</div>`;
    }).join("");
    return `${active().length ? `<div class="nd-sheet-rows">${row()}</div>` : ""}<h4>🔥 ${escapeHtml(L("Streak រួមគ្នា", "Shared streaks"))}<span>${escapeHtml(L("ទាំងពីរ check-in = +1", "both check in = +1"))}</span></h4>
      <div class="nms-box">${rows}</div>
      <p class="nms-note nd-rules">${escapeHtml(L("ម្នាក់ខកខាន → streak រួមចាប់ពី 0 · streak ផ្ទាល់ខ្លួនមិនប៉ះ · 7 · 30 · 100 ថ្ងៃ = +7 · +20 · +50 XP ម្នាក់", "One misses → the shared streak starts again · your own streak is safe · 7 · 30 · 100 days = +7 · +20 · +50 XP each"))}</p>`;
  }

  const otherPopupOpen = () => [...document.querySelectorAll(".ma-pop, #modalRoot > *, #loginModal, .nmc-pop, .nd-pop, .nms, .fl-sheet-wrap")].some(el => el.getBoundingClientRect().height > 0);
  function popups() {
    const route = String(location.hash || "").replace("#", "").split("/")[0] || "home";
    if (route !== "home" || !list) return;
    if (otherPopupOpen()) { setTimeout(popups, 4000); return; }
    const invite = list.find(item => item.status === "pending" && item.invitedBy !== me() && !asked.has(item.id));
    if (invite) {
      asked.add(invite.id);
      show(`<div class="nd-big">🔥</div><h3>${escapeHtml(L(`${first(nameOf(invite.partner))} អញ្ជើញអ្នកចូល streak រួម!`, `${first(nameOf(invite.partner))} wants to share a streak!`))}</h3><p>${escapeHtml(L("Check-in រាល់ថ្ងៃទាំងពីរនាក់ ដើម្បីឲ្យភ្លើងឆេះ", "Check in every day, both of you, to keep the fire going"))}</p>
        <div class="nd-btns"><button type="button" class="is-soft" data-nd-close>${escapeHtml(L("ពេលក្រោយ", "Later"))}</button><button type="button" data-nd-yes="${escapeAttr(invite.id)}">🔥 ${escapeHtml(L("ចូលរួម", "Join"))}</button></div><button type="button" class="nd-decline" data-nd-no="${escapeAttr(invite.id)}">${escapeHtml(L("បដិសេធ", "No thanks"))}</button>`, "is-invite");
      return;
    }
    for (const item of active()) {
      const m = [100, 30, 7].find(n => item.streak >= n);
      if (!m) continue;
      const key = `mylife:nimo-duo:${item.id}:${m}`;
      try { if (localStorage.getItem(key)) continue; localStorage.setItem(key, "1"); } catch (error) { continue; }
      show(`<div class="nd-big">🐱🔥🐱</div><b class="nd-n">${item.streak}</b><h3>${escapeHtml(L(`ថ្ងៃជាប់គ្នា ជាមួយ ${first(nameOf(item.partner))}!`, `days in a row with ${first(nameOf(item.partner))}!`))}</h3><p>${escapeHtml(L(`+${m === 7 ? 7 : m === 30 ? 20 : 50} XP ម្នាក់ 🎉`, `+${m === 7 ? 7 : m === 30 ? 20 : 50} XP each 🎉`))}</p><div class="nd-btns"><button type="button" data-nd-close>${escapeHtml(L("ល្អណាស់!", "Yay!"))}</button></div>`, "is-cele");
      if (typeof Sound !== "undefined") { try { Sound.play("nomiHello"); } catch (error) { /* quiet */ } }
      return;
    }
  }
  function show(inner, kind) {
    document.body.insertAdjacentHTML("beforeend", `<div class="nd-pop ${kind}" role="dialog" aria-modal="true"><div class="nd-card">${inner}</div></div>`);
  }
  function closePop() { const pop = document.querySelector(".nd-pop"); if (!pop) return; pop.classList.add("is-out"); setTimeout(() => pop.remove(), 200); }

  async function call(fn, args, ok) {
    const { error } = await client().rpc(fn, args);
    if (error) { Toast.show(`⚠️ ${error.message}`); return; }
    if (ok) Toast.show(ok);
    await load(true);
  }
  const nudgeKey = partner => `mylife:nimo-nudge:${partner}:${typeof localDateInput === "function" ? localDateInput() : new Date().toISOString().slice(0, 10)}`;
  function nudged(partner) { try { return Boolean(localStorage.getItem(nudgeKey(partner))); } catch (error) { return false; } }
  async function dm(partner, text) {
    const { data: chat, error } = await client().rpc("family_chat_open_dm", { p_family: fg().family.id, p_other: partner });
    if (error || !chat) throw error || new Error("no chat");
    const sent = await client().rpc("family_chat_send", { p_chat: chat, p_kind: "text", p_body: text, p_data: {} });
    if (sent.error) throw sent.error;
  }
  async function nudge(partner) {
    if (nudged(partner)) { Toast.show(L("💜 បានរំលឹករួចហើយថ្ងៃនេះ", "💜 Already nudged today")); return; }
    try { localStorage.setItem(nudgeKey(partner), "1"); } catch (error) { /* still send once */ }
    try {
      const { data: chat, error } = await client().rpc("family_chat_open_dm", { p_family: fg().family.id, p_other: partner });
      if (error || !chat) throw error || new Error("no chat");
      const duo = active().find(item => item.partner === partner);
      const sent = await client().rpc("family_chat_send", { p_chat: chat, p_kind: "text", p_body: L(`💜 កុំភ្លេច check-in ថ្ងៃនេះណា ដើម្បីរក្សា streak រួម 🔥 ${duo?.streak || 0} ថ្ងៃ!`, `💜 Don't forget to check in today to keep our 🔥 ${duo?.streak || 0}-day streak!`), p_data: {} });
      if (sent.error) throw sent.error;
      Toast.show(L(`💜 បានរំលឹក ${first(nameOf(partner))} ក្នុងសារ`, `💜 Nudged ${first(nameOf(partner))} in chat`));
      repaint();
      document.querySelectorAll(`[data-nd-nudge="${CSS.escape(partner)}"]`).forEach(button => button.remove());
    } catch (error) { try { localStorage.removeItem(nudgeKey(partner)); } catch (e) { /* ignore */ } Toast.show(L("⚠️ ផ្ញើសាររំលឹកមិនបាន", "⚠️ Couldn't send the nudge")); }
  }
  // small app-style question sheet (instead of the browser's confirm box)
  function ask(title, text, yesLabel, onYes) {
    document.querySelector(".fl-sheet-wrap")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="fl-sheet-wrap nd-ask" role="dialog" aria-modal="true"><div class="fl-scrim" data-nd-ask-no></div><div class="fl-sheet"><span class="fl-grab"></span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p><div class="fl-btns"><button type="button" class="fl-btn" data-nd-ask-no>${escapeHtml(L("បោះបង់", "Cancel"))}</button><button type="button" class="fl-btn is-primary" data-nd-ask-yes>${escapeHtml(yesLabel)}</button></div></div></div>`);
    const wrap = document.querySelector(".fl-sheet-wrap.nd-ask");
    requestAnimationFrame(() => wrap.classList.add("is-in"));
    const close = () => { wrap.classList.remove("is-in"); setTimeout(() => wrap.remove(), 240); };
    wrap.addEventListener("click", event => {
      if (event.target.closest("[data-nd-ask-yes]")) { close(); onYes(); }
      else if (event.target.closest("[data-nd-ask-no]")) close();
    });
  }
  document.addEventListener("click", event => {
    const t = event.target;
    if (t.closest(".nd-ask")) return;
    const nudgeBtn = t.closest("[data-nd-nudge]");
    if (nudgeBtn) { event.stopPropagation(); event.preventDefault(); nudge(nudgeBtn.dataset.ndNudge); return; }
    const inv = t.closest("[data-nd-invite]");
    if (inv) {
      const who = inv.dataset.ndInvite;
      call("nimo_duo_invite", { p_family: fg().family.id, p_partner: who }, L(`🔥 បានអញ្ជើញ ${first(nameOf(who))} · រង់ចាំការចូលរួម`, `🔥 Invited ${first(nameOf(who))}`))
        .then(() => { const duo = (list || []).find(item => item.partner === who); if (duo?.status === "pending") dm(who, L("🔥 ខ្ញុំអញ្ជើញអ្នកចូល streak រួមក្នុង MYLIFE! បើក Home ហើយចុច «ចូលរួម»", "🔥 I invited you to a shared streak in MYLIFE! Open Home and tap Join")).catch(() => {}); });
      return;
    }
    const no = t.closest("[data-nd-no]");
    if (no) { closePop(); call("nimo_duo_answer", { p_duo: no.dataset.ndNo, p_yes: false }, L("បានបដិសេធ", "Declined")); return; }
    const yes = t.closest("[data-nd-yes]");
    if (yes) { closePop(); call("nimo_duo_answer", { p_duo: yes.dataset.ndYes, p_yes: true }, L("🔥 ចូលរួមហើយ! Check-in រាល់ថ្ងៃទាំងពីរនាក់", "🔥 You're in! Check in every day, both of you")); return; }
    const leave = t.closest("[data-nd-leave]");
    if (leave) { ask(L("ចាកចេញពី streak រួមមែនទេ?", "Leave this shared streak?"), L("streak រួមនឹងបញ្ចប់ · streak ផ្ទាល់ខ្លួនរបស់អ្នកនៅដដែល · អញ្ជើញម្ដងទៀតបានពេលក្រោយ", "The shared streak ends · your own streak is safe · you can invite again later"), L("ចាកចេញ", "Leave"), () => call("nimo_duo_leave", { p_duo: leave.dataset.ndLeave }, L("បានចាកចេញ · streak ផ្ទាល់ខ្លួននៅដដែល", "Left · your own streak is safe"))); return; }
    if (t.closest("[data-nd-close]") || t.classList?.contains("nd-pop")) closePop();
  }, true);

  return { sync, load, row, badge, heroLine, sheetSection, nudged, list: () => list };
})();
