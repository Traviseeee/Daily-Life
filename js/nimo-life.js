/* Nimo Life Companion · step 1 (5 Nov): XP, level, daily streak.
 * XP lives in Supabase (nimo_profile / nimo_xp_history). Only the
 * nimo_award() database function writes XP: it knows the fixed rewards, gives
 * each one once per Asia/Phnom_Penh day and works out level + streak itself.
 * This file shows the small home row and the one-time level-up popup, and asks
 * the server for a reward when the user really did the thing in the app. */
const NimoLife = (() => {
  const CACHE = "mylife:nimo:v1";
  const DAILY = ["checkin", "expense", "summary", "savings"];
  let state = read();
  let busy = new Set();
  let popupShown = 0;
  let lastFinance = 0;
  let open = false; // details (today's ticks + this month) shown only on tap

  function read() { try { return JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (error) { return null; } }
  function keep(next) { state = next; try { localStorage.setItem(CACHE, JSON.stringify(next)); } catch (error) { /* memory copy is fine */ } }
  const km = () => (typeof languageCode === "function" ? languageCode() === "km" : true);
  const L = (k, e) => (km() ? k : e);
  const client = () => (typeof window !== "undefined" && window.MYLIFE_SUPABASE?.enabled !== false ? window.supabaseClient : null);
  const today = () => (typeof localDateInput === "function" ? localDateInput() : new Date().toISOString().slice(0, 10));
  const fresh = () => state && state.day === today();

  function paint() {
    const slot = document.querySelector("[data-nimo-life]");
    if (slot) slot.outerHTML = card();
    maybePopup();
  }

  async function load() {
    const c = client();
    if (!c || busy.has("load")) return;
    busy.add("load");
    try {
      const { data, error } = await c.rpc("nimo_state");
      if (!error && data) { keep({ ...data, day: today() }); paint(); }
    } catch (error) { /* offline: keep the cached row */ }
    finally { busy.delete("load"); }
  }

  async function award(activity) {
    const c = client();
    if (!c || busy.has(activity) || (activity !== "finance" && fresh() && (state.today || []).includes(activity))) return;
    busy.add(activity);
    try {
      const { data, error } = await c.rpc("nimo_award", { p_activity: activity });
      if (error || !data) return;
      if (data.reason) return; // e.g. no expense today: nothing to give yet
      const got = (data.awarded || []).reduce((sum, item) => sum + Number(item.xp || 0), 0);
      keep({ ...data, day: today() });
      paint();
      if (got > 0 && typeof Toast !== "undefined" && activity !== "checkin") {
        const first = (data.awarded || [])[0] || {};
        const what = { loan: L("បង់កម្ចី", "Loan paid"), bill: L("បង់វិក្កយបត្រ", "Bill paid"), save: L("ដាក់សន្សំ", "Saved"), milestone: L("សន្សំដល់", "Savings reached"), mstreak: L("ខែជាប់គ្នា", "Money months") }[first.activity];
        const detail = what ? `${what}${first.name ? ` · ${first.name}` : first.amount ? ` $${first.amount}` : first.months ? ` ${first.months}` : ""} · ` : "";
        Toast.show(`🐾 ${detail}Nimo +${got} XP`, "success", { sound: "nomiPip" });
      }
    } catch (error) { /* try again next time */ }
    finally { busy.delete(activity); }
  }

  // called on every App.render: decide which daily rewards the user has earned
  function sync(route, param) {
    if (!client()) return;
    if (!fresh()) { if (state) keep({ ...state, today: [], todayXp: 0, day: today() }); load(); }
    award("checkin");
    const day = today();
    if ((appData?.expenses || []).some(item => String(item.date || "").slice(0, 10) === day)) award("expense");
    if (route === "money" && (!param || param === "overview")) award("summary");
    if (route === "reports" || (route === "money" && param === "reports")) award("summary");
    if (route === "money" && param === "savings") award("savings");
    // real money records (loan paid, bill paid, savings deposit): the server checks them
    if (Date.now() - lastFinance > 20000) { lastFinance = Date.now(); award("finance"); }
    setTimeout(maybePopup, 2500);
  }

  function card() {
    if (!client() || !state) return `<div data-nimo-life hidden></div>`;
    const level = Number(state.level || 1), xp = Number(state.xp || 0);
    const from = Number(state.levelXp || 0), to = Number(state.nextXp || from + 50);
    const pct = Math.max(3, Math.min(100, Math.round((xp - from) / Math.max(1, to - from) * 100)));
    const done = fresh() ? state.today || [] : [];
    const streak = Number(state.streak || 0);
    const mood = done.length >= 4 ? "proud" : done.length ? "happy" : "sleepy";
    const nomi = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy(mood) : "🐱";
    const labels = { checkin: L("Check-in", "Check-in"), expense: L("ចំណាយ", "Expense"), summary: L("សង្ខេប", "Summary"), savings: L("សន្សំ", "Savings") };
    const go = { checkin: "", expense: "#money/expenses", summary: "#money/overview", savings: "#money/savings" };
    const ticks = DAILY.map(key => {
      const on = done.includes(key);
      return `<button type="button" class="nmc-tick${on ? " is-on" : ""}"${go[key] && !on ? ` data-hv2-go="${go[key].slice(1)}"` : ""}>${on ? "✓" : "○"} ${escapeHtml(labels[key])}</button>`;
    }).join("");
    const doneCount = DAILY.filter(key => done.includes(key)).length;
    return `<div data-nimo-life class="nmc-wrap${open ? " is-open" : ""}">
      <section class="nmc" data-nmc-toggle role="button" tabindex="0" aria-expanded="${open}" aria-label="${escapeAttr(L("មើលលម្អិត Nimo", "Show Nimo details"))}">
        <span class="nmc-av" style="--p:${pct}"><span class="nmc-nomi" data-nomi data-mood="${mood}" role="button" tabindex="0" aria-label="Nomi">${nomi}</span><b class="nmc-lv">Lv ${level}</b></span>
        <span class="nmc-mid"><b>Nimo · ${escapeHtml(L(`កម្រិត ${level}`, `Level ${level}`))}</b><span class="nmc-bar"><i style="width:${pct}%"></i></span><small>${xp} / ${to} XP · ${escapeHtml(L(`ទៀត ${Math.max(0, to - xp)}`, `${Math.max(0, to - xp)} to go`))}</small></span>
        <span class="nmc-fire${streak ? "" : " is-off"}" title="${escapeAttr(L(`ថ្ងៃជាប់គ្នាវែងបំផុត ${state.longestStreak || 0}`, `Longest ${state.longestStreak || 0} days`))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z" fill="currentColor"/></svg><b>${streak}</b><small>${escapeHtml(L("ថ្ងៃ", "days"))}</small></span>
        <span class="nmc-fire nmc-month${Number(state.monthStreak || 0) ? "" : " is-off"}" title="${escapeAttr(L("ខែជាប់គ្នា ដែលបង់កម្ចី / វិក្កយបត្រ / ដាក់សន្សំ", "Months in a row with a loan, bill or savings payment"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M12 7v10M9.5 9.5h3.8a1.7 1.7 0 0 1 0 3.4h-2.6a1.7 1.7 0 0 0 0 3.4H14.5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg><b>${Number(state.monthStreak || 0)}</b><small>${escapeHtml(L("ខែ", "mo"))}</small></span>
        <span class="nmc-chev" aria-hidden="true"><b>${doneCount}/4</b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
      </section>
      <div class="nmc-more"${open ? "" : " hidden"}>
      <small class="nmc-cap">${escapeHtml(L("ថ្ងៃនេះ", "Today"))}</small>
      <div class="nmc-ticks">${ticks}</div>
      ${(state.month || []).length ? `<small class="nmc-cap">${escapeHtml(L("ខែនេះ", "This month"))}</small><div class="nmc-ticks nmc-month-ticks">${(state.month || []).slice(0, 4).map(item => `<span class="nmc-tick is-on is-money">${{ loan: "🏦", bill: "🧾", save: "🐷" }[item.activity] || "✓"} ${escapeHtml(String(item.text || "").replace(/^.*· /, ""))} +${item.xp}</span>`).join("")}</div>` : ""}
      </div>
    </div>`;
  }

  function maybePopup() {
    if (!state || location.hash.replace("#", "").split("/")[0] !== "home") return;
    const level = Number(state.level || 1), seen = Number(state.seenLevel || 1);
    if (level <= seen || popupShown === level || document.querySelector(".nmc-pop")) return;
    // wait until other pop-ups (money check-in, login, sheets) are closed
    if ([...document.querySelectorAll(".ma-pop, #modalRoot > *, #loginModal")].some(el => el.getBoundingClientRect().height > 0)) { setTimeout(maybePopup, 4000); return; }
    popupShown = level;
    const nomi = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy("proud") : "🐱";
    const unlock = {
      2: L("មុខថ្មី · រីករាយ", "New mood · happy"), 3: L("មុខថ្មី · ងងុយ & រំភើប", "New moods · sleepy & excited"), 4: L("មុខថ្មី + Sticker", "New faces + stickers"),
      5: L("គ្រឿងតុបតែងដំបូង", "First accessories"), 6: L("មុខ & ស្ទីលពិសេស", "Special moods & styles"), 7: L("សម្លៀកបំពាក់ពិសេស", "Special outfits"),
      8: L("រូបរាង Nimo ពិសេស", "Special Nimo look"), 9: L("មុខកម្រ", "Rare faces"), 10: L("Nimo រឿងព្រេង 👑", "Legendary Nimo 👑")
    }[level] || L("របស់ថ្មីបន្ថែម", "More to collect");
    document.body.insertAdjacentHTML("beforeend", `<div class="nmc-pop" role="dialog" aria-modal="true" aria-label="Level up">
      <div class="nmc-pop-card"><i class="nmc-sp s1">✦</i><i class="nmc-sp s2">✦</i><i class="nmc-sp s3">✧</i>
        <span class="nmc-pop-nomi">${nomi}</span>
        <h3>${escapeHtml(L(`ឡើងកម្រិត ${level}! 🎉`, `Level up! → Level ${level} 🎉`))}</h3>
        <p>${escapeHtml(L("Nimo ធំឡើងហើយ អរគុណដែលថែទាំខ្លួនឯងរាល់ថ្ងៃ", "Nimo grew up — thanks for looking after yourself every day"))}</p>
        <span class="nmc-pop-unl">🎁 ${escapeHtml(unlock)}</span>
        <button type="button" data-nmc-pop-ok>${escapeHtml(L("ល្អណាស់!", "Yay!"))}</button>
      </div></div>`);
    if (typeof Sound !== "undefined") { try { Sound.play("nomiHello"); } catch (error) { /* no sound */ } }
  }

  document.addEventListener("click", event => {
    const head = event.target.closest("[data-nmc-toggle]");
    if (!head || event.target.closest("[data-nomi]")) return;
    open = !open;
    const wrap = head.closest(".nmc-wrap");
    wrap?.classList.toggle("is-open", open);
    head.setAttribute("aria-expanded", String(open));
    const more = wrap?.querySelector(".nmc-more");
    if (more) more.hidden = !open;
  });
  document.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches?.("[data-nmc-toggle]")) { event.preventDefault(); event.target.click(); }
  });

  document.addEventListener("click", async event => {
    if (!event.target.closest("[data-nmc-pop-ok]") && !event.target.classList?.contains("nmc-pop")) return;
    const pop = document.querySelector(".nmc-pop");
    pop?.classList.add("is-out");
    setTimeout(() => pop?.remove(), 220);
    const level = Number(state?.level || 1);
    keep({ ...state, seenLevel: level });
    try { await client()?.rpc("nimo_seen", { p_level: level }); } catch (error) { /* shows once per session anyway */ }
  });

  return { card, sync, load, award, state: () => state };
})();
