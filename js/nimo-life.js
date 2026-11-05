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

  function read() { try { return JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (error) { return null; } }
  function keep(next) { state = next; try { localStorage.setItem(CACHE, JSON.stringify(next)); } catch (error) { /* memory copy is fine */ } }
  // what each level unlocks. Outfits at 5 · 10 · 15 · 20; drawn on top of the
  // original Nomi (same shape, size and colours) — only the gold / galaxy skins recolour it.
  const ROAD = [
    { lv: 1, mood: "happy", km: "Nimo តូច", en: "Baby Nimo" },
    { lv: 2, mood: "cheer", km: "មុខ រីករាយ", en: "Cheer face" },
    { lv: 3, mood: "sleepy", km: "មុខ ងងុយ & រំភើប", en: "Sleepy & excited" },
    { lv: 4, mood: "proud", km: "មោទនភាព + Sticker", en: "Proud + stickers" },
    { lv: 5, mood: "cheer", item: "party", km: "ឈុតពិធីបុណ្យ 🎉", en: "Party outfit 🎉", outfit: true },
    { lv: 6, mood: "happy", item: "glasses", km: "វ៉ែនតា", en: "Glasses" },
    { lv: 7, mood: "wink", item: "scarf", km: "កន្សែងក", en: "Scarf" },
    { lv: 8, mood: "proud", item: "gold", km: "ស្បែកមាស", en: "Golden skin" },
    { lv: 9, mood: "happy", item: "shades", km: "Cool 😎", en: "Cool 😎" },
    { lv: 10, mood: "proud", item: "royal", km: "ឈុតស្ដេច 👑", en: "Royal outfit 👑", outfit: true },
    { lv: 15, mood: "wink", item: "wizard", km: "ឈុតគ្រូមន្ត 🪄", en: "Wizard outfit 🪄", outfit: true },
    { lv: 20, mood: "love", item: "galaxy", km: "ឈុតកាឡាក់ស៊ី 🌌", en: "Galaxy outfit 🌌", outfit: true }
  ];
  const SLOTS = { party: ["head"], glasses: ["eyes"], scarf: ["neck"], gold: ["skin"], shades: ["eyes"], royal: ["head", "neck"], wizard: ["head", "neck"], galaxy: ["skin", "head"] };
  const ART = {
    party: '<path d="M40 30 50 3 60 30Z" fill="#ff8fb0"/><path d="M43.5 22h13M46.5 14h7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="50" cy="4" r="4" fill="#F5C45A"/>',
    glasses: '<g fill="rgba(255,255,255,.28)" stroke="#504AB9" stroke-width="2.4"><circle cx="40" cy="53" r="8"/><circle cx="60" cy="53" r="8"/></g><path d="M48 53h4" stroke="#504AB9" stroke-width="2.4"/>',
    scarf: '<path d="M21 76q29 13 58 0l1.5 7q-30.5 14-61 0z" fill="#ff7a8a"/><path d="M60 84l5 12 6-3-4-11z" fill="#ff5c70"/>',
    shades: '<path d="M30 49h18v5a7 7 0 0 1-14 0zM52 49h18v5a7 7 0 0 1-14 0z" fill="#1A2347"/><path d="M48 51h4" stroke="#1A2347" stroke-width="3"/><path d="M35 51h4" stroke="#fff" stroke-width="1.6" opacity=".6"/>',
    royal: '<path d="M14 64q-4 26 12 30l48 0q16-4 12-30q-36 16-72 0z" fill="#e5484d" opacity=".9"/><path d="M35 31 37 13 44 23 50 9 56 23 63 13 65 31Z" fill="#F5C45A" stroke="#E0A42E" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="25" r="3" fill="#ff7a8a"/>',
    wizard: '<path d="M18 72q32 16 64 0l2 9q-34 16-68 0z" fill="#3b2f8f"/><path d="M32 33q16-36 38-28q-10 4-8 28z" fill="#3b2f8f"/><path d="M28 33h46" stroke="#3b2f8f" stroke-width="6" stroke-linecap="round"/><path d="M52 16l1.4 3 3.2.4-2.3 2.2.6 3.2-2.9-1.6-2.9 1.6.6-3.2-2.3-2.2 3.2-.4z" fill="#F5C45A"/><circle cx="38" cy="78" r="1.8" fill="#F5C45A"/><circle cx="62" cy="80" r="1.8" fill="#F5C45A"/>',
    galaxy: '<ellipse cx="50" cy="10" rx="16" ry="4.5" fill="none" stroke="#F5C45A" stroke-width="3"/><g fill="#fff"><circle cx="34" cy="70" r="1.4"/><circle cx="66" cy="66" r="1.2"/><circle cx="58" cy="82" r="1.5"/><circle cx="40" cy="84" r="1"/><circle cx="72" cy="52" r="1"/></g>'
  };
  const SKIN = { gold: ["#ffd977", "#f0c14b", "#fff6d6", "#e8b93c"], galaxy: ["#6c5ce7", "#4b3fb8", "#a99cff", "#5a4bd6"] };
  const allowedLook = (look, level) => (Array.isArray(look) ? look : []).filter(id => ROAD.some(r => r.item === id && r.lv <= level));
  const myLook = () => allowedLook(appData?.profile?.nimoLook, Number(state?.level || 1));
  // put the chosen outfit on any Nomi svg made by HomeV2.buddy()
  function dress(svg, look) {
    if (!svg || typeof svg !== "string" || !look?.length) return svg;
    let out = svg;
    const skin = look.find(id => SKIN[id]);
    if (skin) {
      const [body, ear, belly, tail] = SKIN[skin];
      out = out.replace(/#c9bdff/g, body).replace(/#b3a6f7/g, ear).replace(/#f4f0ff/g, belly).replace(/#b9adf5/g, tail);
    }
    const back = look.includes("royal") ? ART.royal.split("<path d=\"M35")[0] : "";
    const front = look.filter(id => ART[id]).map(id => id === "royal" ? `<path d="M35${ART.royal.split("<path d=\"M35")[1]}` : ART[id]).join("");
    if (back) out = out.replace('<g class="nb-bodyg">', `<g class="nb-bodyg">${back}`);
    return out.replace(/<\/g><\/svg>$/, `<g class="nb-outfit">${front}</g></g></svg>`);
  }
  const nomiSvg = (mood, look = myLook()) => (typeof HomeV2 !== "undefined" && HomeV2.buddy ? dress(HomeV2.buddy(mood), look) : "🐱");
  const xpFor = lv => { const steps = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000]; if (lv <= 10) return steps[lv - 1]; let need = 3000, gap = 800; for (let i = 11; i <= lv; i++) { need += gap; gap += 100; } return need; };

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
    const nomi = nomiSvg(mood);

    return `<div data-nimo-life class="nmc-wrap">
      <section class="nmc" data-nmc-open role="button" tabindex="0" aria-label="${escapeAttr(L("បើក Nimo", "Open Nimo"))}">
        <span class="nmc-av" style="--p:${pct}"><span class="nmc-nomi" data-nomi data-mood="${mood}" role="button" tabindex="0" aria-label="Nomi">${nomi}</span><b class="nmc-lv">Lv ${level}</b></span>
        <span class="nmc-mid"><b>Nimo · ${escapeHtml(L(`កម្រិត ${level}`, `Level ${level}`))}</b><span class="nmc-bar"><i style="width:${pct}%"></i></span><small>${xp} / ${to} XP · ${escapeHtml(L(`ទៀត ${Math.max(0, to - xp)}`, `${Math.max(0, to - xp)} to go`))}</small></span>
        <span class="nmc-fire${streak ? "" : " is-off"}" title="${escapeAttr(L(`ថ្ងៃជាប់គ្នាវែងបំផុត ${state.longestStreak || 0} · ខែជាប់គ្នា = បង់កម្ចី / វិក្កយបត្រ / ដាក់សន្សំ`, `Longest ${state.longestStreak || 0} days · money months = loan, bill or savings paid`))}"><span class="nmc-fire-top"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z" fill="currentColor"/></svg><b>${streak}</b></span><small>${escapeHtml(L("ថ្ងៃ", "days"))}</small>${Number(state.monthStreak || 0) ? `<em class="nmc-mo">🪙 ${Number(state.monthStreak)} ${escapeHtml(L("ខែ", "mo"))}</em>` : ""}</span>
      </section>
    </div>`;
  }

  function maybePopup() {
    if (!state || location.hash.replace("#", "").split("/")[0] !== "home") return;
    const level = Number(state.level || 1), seen = Number(state.seenLevel || 1);
    if (level <= seen || popupShown === level || document.querySelector(".nmc-pop")) return;
    // wait until other pop-ups (money check-in, login, sheets) are closed
    if ([...document.querySelectorAll(".ma-pop, #modalRoot > *, #loginModal")].some(el => el.getBoundingClientRect().height > 0)) { setTimeout(maybePopup, 4000); return; }
    popupShown = level;
    showLevelPop(level);
  }

  function showLevelPop(level, demo = false) {
    const step = ROAD.find(r => r.lv === level);
    const next = ROAD.find(r => r.lv > level);
    const nomi = nomiSvg("proud", step?.item ? [step.item] : myLook());
    const unlock = step ? L(step.km, step.en) : next ? L(`បន្ទាប់ · ${next.km} នៅកម្រិត ${next.lv}`, `Next · ${next.en} at level ${next.lv}`) : L("របស់ថ្មីបន្ថែម", "More to collect");
    document.body.insertAdjacentHTML("beforeend", `<div class="nmc-pop${demo ? " is-demo" : ""}" role="dialog" aria-modal="true" aria-label="Level up">
      <div class="nmc-pop-card"><i class="nmc-sp s1">✦</i><i class="nmc-sp s2">✦</i><i class="nmc-sp s3">✧</i>
        <span class="nmc-pop-nomi">${nomi}</span>
        <h3>${escapeHtml(L(`ឡើងកម្រិត ${level}! 🎉`, `Level up! → Level ${level} 🎉`))}</h3>
        <p>${escapeHtml(L("Nimo ធំឡើងហើយ អរគុណដែលថែទាំខ្លួនឯងរាល់ថ្ងៃ", "Nimo grew up — thanks for looking after yourself every day"))}</p>
        <span class="nmc-pop-unl">🎁 ${escapeHtml(unlock)}</span>${step?.item ? `<small class="nmc-pop-tip">${escapeHtml(L("ពាក់បាននៅក្នុងទំព័រ Nimo", "Wear it from the Nimo sheet"))}</small>` : ""}
        <button type="button" data-nmc-pop-ok>${escapeHtml(L("ល្អណាស់!", "Yay!"))}</button>
      </div></div>`);
    if (typeof Sound !== "undefined") { try { Sound.play("nomiHello"); } catch (error) { /* no sound */ } }
  }

  // ---------- the Nimo sheet (tap the home row) ----------
  let preview = null;
  function sheetHtml() {
    const level = Number(state.level || 1), xp = Number(state.xp || 0);
    const to = Number(state.nextXp || xpFor(level + 1));
    const from = Number(state.levelXp || xpFor(level));
    const pct = Math.max(3, Math.min(100, Math.round((xp - from) / Math.max(1, to - from) * 100)));
    const done = fresh() ? state.today || [] : [];
    const look = myLook();
    const pv = preview ? ROAD.find(r => r.lv === preview) : null;
    const bigLook = pv ? (pv.item ? [pv.item] : []) : look;
    const bigMood = pv ? pv.mood : done.length >= 4 ? "proud" : "happy";
    const row = (on, ic, title, sub, xpText, go) => `<${go && !on ? `button type="button" data-hv2-go="${go}" data-nms-close` : "div"} class="nms-row${on ? " is-on" : ""}"><span class="nms-ck${ic.gold ? " is-gold" : ""}${on ? " is-on" : ""}">${ic.t}</span><span class="nms-t">${escapeHtml(title)}${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</span><em>${xpText}</em></${go && !on ? "button" : "div"}>`;
    const today = [
      row(done.includes("checkin"), { t: done.includes("checkin") ? "✓" : "○" }, L("Check-in (បើក app)", "Check-in (open the app)"), "", "+1"),
      row(done.includes("expense"), { t: done.includes("expense") ? "✓" : "○" }, L("កត់ចំណាយ", "Record an expense"), "", "+1", "money/expenses"),
      row(done.includes("summary"), { t: done.includes("summary") ? "✓" : "○" }, L("មើលសង្ខេបលុយ", "Review today's money"), L("Money → សង្ខេប", "Money → Overview"), "+2", "money/overview"),
      row(done.includes("savings"), { t: done.includes("savings") ? "✓" : "○" }, L("ពិនិត្យសន្សំ", "Check savings"), L("Money → សន្សំ", "Money → Savings"), "+1", "money/savings")
    ].join("");
    const icon = { loan: "🏦", bill: "🧾", save: "🐷" };
    const name = text => String(text || "").replace(/^.*· /, "");
    const what = { loan: L("បង់កម្ចី", "Loan paid"), bill: L("បង់វិក្កយបត្រ", "Bill paid"), save: L("ដាក់សន្សំ", "Saved") };
    const month = (state.month || []).map(item => row(true, { t: icon[item.activity] || "✓", gold: true }, `${what[item.activity] || ""} · ${name(item.text)}`, "", `+${item.xp}`)).join("")
      || `<p class="nms-empty">${escapeHtml(L("ខែនេះមិនទាន់មាន · បង់កម្ចី / វិក្កយបត្រ ឬដាក់សន្សំ ដើម្បីយក XP", "Nothing yet this month · pay a loan or bill, or save, to earn XP"))}</p>`;
    const tiles = ROAD.map(r => {
      const got = r.lv <= level, worn = r.item && look.includes(r.item);
      return `<button type="button" class="nms-lvl${got ? " is-got" : " is-lock"}${r.lv === level ? " is-now" : ""}${preview === r.lv ? " is-sel" : ""}${r.outfit ? " is-outfit" : ""}" data-nms-lv="${r.lv}">${nomiSvg(r.mood, r.item ? [r.item] : [])}<b>Lv ${r.lv}${worn ? " ✓" : ""}</b><small>${escapeHtml(L(r.km, r.en))}</small></button>`;
    }).join("");
    let tag = "";
    if (pv) {
      const wearable = pv.item && pv.lv <= level;
      const worn = wearable && look.includes(pv.item);
      tag = `<div class="nms-tag">${pv.lv <= level ? `✓ ${escapeHtml(L(`មានហើយ · ${pv.km}`, `Unlocked · ${pv.en}`))}` : `🔒 ${escapeHtml(L(`មើលមុន · ${pv.km} · ត្រូវការ ${xpFor(pv.lv)} XP`, `Preview · ${pv.en} · needs ${xpFor(pv.lv)} XP`))}`}${wearable ? `<button type="button" data-nms-wear="${pv.item}">${escapeHtml(worn ? L("ដោះចេញ", "Take off") : L("ពាក់", "Wear"))}</button>` : ""}</div>`;
    }
    return `<div class="nms" role="dialog" aria-modal="true" aria-label="Nimo">
      <div class="nms-scrim" data-nms-close></div>
      <div class="nms-sheet"><span class="nms-grab"></span><button type="button" class="nms-x" data-nms-close aria-label="${escapeAttr(L("បិទ", "Close"))}">✕</button>
        <div class="nms-sc">
          <div class="nms-big"><span class="nms-stage" data-nomi data-mood="${bigMood}">${nomiSvg(bigMood, bigLook)}</span>
            <h3>Nimo · ${escapeHtml(L(`កម្រិត ${level}`, `Level ${level}`))}</h3>
            <span class="nms-bar"><i style="width:${pct}%"></i></span>
            <small>${xp} / ${to} XP · ${escapeHtml(L(`ទៀត ${Math.max(0, to - xp)} → កម្រិត ${level + 1}`, `${Math.max(0, to - xp)} to level ${level + 1}`))}</small>
            ${tag}</div>
          <div class="nms-two">
            <div class="nms-st"><span class="is-fire">🔥</span><div><b>${Number(state.streak || 0)} ${escapeHtml(L("ថ្ងៃ", "days"))}</b><small>${escapeHtml(L(`វែងបំផុត ${state.longestStreak || 0} · 3 ថ្ងៃ = +3`, `Best ${state.longestStreak || 0} · 3 days = +3`))}</small></div></div>
            <div class="nms-st"><span class="is-gold">🪙</span><div><b>${Number(state.monthStreak || 0)} ${escapeHtml(L("ខែ", "mo"))}</b><small>${escapeHtml(L("បង់/សន្សំជាប់ · 3 ខែ = +10", "Paid/saved in a row · 3 mo = +10"))}</small></div></div>
          </div>
          <h4>${escapeHtml(L("ថ្ងៃនេះ", "Today"))}<span>${escapeHtml(L("+3 បើធ្វើគ្រប់ 4", "+3 when all 4 are done"))}</span></h4>
          <div class="nms-box">${today}</div>
          <h4>${escapeHtml(L("ខែនេះ · លុយពិត", "This month · real money"))}<span>${escapeHtml(L("server ពិនិត្យ", "checked by the server"))}</span></h4>
          <div class="nms-box">${month}</div>
          <h4>${escapeHtml(L("កម្រិត & ឈុត", "Levels & outfits"))}<span>${escapeHtml(L("ចុចមើល · ពាក់", "Tap to preview · wear"))}</span></h4>
          <div class="nms-road">${tiles}</div>
          <h4>${escapeHtml(L("របៀបយក XP", "How to earn XP"))}</h4>
          <div class="nms-box">
            ${row(false, { t: "💰" }, L("សន្សំដល់ $50 · $150 · $300 · $500 · $1k · $2.5k · $5k · $10k", "Savings reach $50 · $150 · $300 · $500 · $1k · $2.5k · $5k · $10k"), L("ម្ដងគត់ក្នុងមួយកម្រិត · មាសរាប់ផង", "Once each · gold counts too"), "+1…50")}
            ${row(false, { t: "🔥" }, L("ថ្ងៃជាប់ 3 · 7 · 14 · 30 · 60 · 100 · 180 · 365", "Days in a row 3 · 7 · 14 · 30 · 60 · 100 · 180 · 365"), "", "+3…150")}
            ${row(false, { t: "🪙" }, L("ខែជាប់ 3 · 6 · 12", "Money months in a row 3 · 6 · 12"), "", "+10…40")}
          </div>
          <button type="button" class="nms-try" data-nms-try>✨ ${escapeHtml(L("សាក popup ឡើងកម្រិត", "Try the level-up popup"))}</button>
          <p class="nms-note">${escapeHtml(L("Nimo មិនដែលបន្ទោសពេលចាយលុយ · XP មិនបាត់ · របស់ដែលបើករួច ជារបស់អ្នកជារៀងរហូត", "Nimo never scolds spending · XP never disappears · unlocked items are yours forever"))}</p>
        </div></div></div>`;
  }
  function openSheet() {
    if (!state) return;
    document.querySelector(".nms")?.remove();
    document.body.insertAdjacentHTML("beforeend", sheetHtml());
    document.body.classList.add("nms-open");
    requestAnimationFrame(() => document.querySelector(".nms")?.classList.add("is-in"));
  }
  function repaintSheet() {
    const sheet = document.querySelector(".nms"); if (!sheet) return;
    const top = sheet.querySelector(".nms-sc")?.scrollTop || 0;
    sheet.outerHTML = sheetHtml();
    const fresh2 = document.querySelector(".nms"); fresh2?.classList.add("is-in");
    const sc = fresh2?.querySelector(".nms-sc"); if (sc) sc.scrollTop = top;
  }
  function closeSheet() {
    const sheet = document.querySelector(".nms"); if (!sheet) return;
    preview = null;
    sheet.classList.remove("is-in");
    document.body.classList.remove("nms-open");
    setTimeout(() => sheet.remove(), 260);
  }
  document.addEventListener("click", event => {
    if (event.target.closest("[data-nmc-open]") && !event.target.closest("[data-nomi]")) { openSheet(); return; }
    if (!event.target.closest(".nms")) return;
    if (event.target.closest("[data-nms-close]")) { closeSheet(); return; }
    const lv = event.target.closest("[data-nms-lv]");
    if (lv) { const n = Number(lv.dataset.nmsLv); preview = preview === n ? null : n; repaintSheet(); document.querySelector(".nms-sc")?.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const wear = event.target.closest("[data-nms-wear]");
    if (wear) {
      const id = wear.dataset.nmsWear, look = myLook();
      const next = look.includes(id) ? look.filter(x => x !== id) : [...look.filter(x => !(SLOTS[x] || []).some(slot => (SLOTS[id] || []).includes(slot))), id];
      if (typeof Store !== "undefined" && Store.updateProfile) Store.updateProfile({ nimoLook: next });
      else appData.profile.nimoLook = next;
      if (typeof Sound !== "undefined") { try { Sound.play("nomiHop"); } catch (error) { /* quiet */ } }
      repaintSheet(); paint();
      return;
    }
    if (event.target.closest("[data-nms-try]")) { showLevelPop(Math.min(Number(state.level || 1) + 1, 20), true); }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.querySelector(".nms")) closeSheet();
  });
  window.addEventListener("hashchange", () => { if (document.querySelector(".nms")) closeSheet(); });
  document.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches?.("[data-nmc-open]")) { event.preventDefault(); event.target.click(); }
  });

  document.addEventListener("click", async event => {
    if (!event.target.closest("[data-nmc-pop-ok]") && !event.target.classList?.contains("nmc-pop")) return;
    const pop = document.querySelector(".nmc-pop");
    pop?.classList.add("is-out");
    setTimeout(() => pop?.remove(), 220);
    if (pop?.classList.contains("is-demo")) return;
    const level = Number(state?.level || 1);
    keep({ ...state, seenLevel: level });
    try { await client()?.rpc("nimo_seen", { p_level: level }); } catch (error) { /* shows once per session anyway */ }
  });

  return { card, sync, load, award, dress, open: openSheet, state: () => state };
})();
