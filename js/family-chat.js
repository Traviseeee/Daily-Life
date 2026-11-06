/* MYLIFE Family Chat (6 Nov 2026)
 * #chat           → my chats: the family group + 2-person chats
 * #chat/<id>      → one chat (full screen, above the bottom bar)
 * #chat/dm-<uid>  → opens (or makes) the private chat with that member
 * Text, Nomi stickers, share cards from the app (paid / saved / goal / event), ❤️ reactions,
 * delete own message. Data: supabase/migrations/20261106_family_chat.sql (RLS: only the
 * people in a chat can read it). New messages: Supabase Realtime + a light poll as backup. */
const FamilyChat = (() => {
  const km = () => (typeof languageCode === "function" ? languageCode() === "km" : true);
  const L = (k, e) => (km() ? k : e);
  const esc = value => (typeof escapeHtml === "function" ? escapeHtml(String(value ?? "")) : String(value ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`));
  const attr = value => (typeof escapeAttr === "function" ? escapeAttr(String(value ?? "")) : esc(value));
  const FG = () => (typeof FamilyGroup !== "undefined" ? FamilyGroup : null);
  const client = () => (typeof window !== "undefined" ? window.supabaseClient : null);
  const curRoute = () => (typeof App !== "undefined" ? App.route : "");
  const toast = (...args) => { if (typeof Toast !== "undefined") Toast.show(...args); };
  const S = { chats: [], unread: 0, missing: false, loaded: false, room: null, msgs: [], sig: null, channel: null, poll: null, listPoll: null, busy: false, lastToastAt: 0 };

  const STICKERS = [
    ["hello", "happy", "សួស្តី!", "Hi!"], ["love", "love", "ស្រលាញ់ 💗", "Love you 💗"], ["ok", "wink", "យល់ព្រម!", "Okay!"], ["thanks", "calm", "អរគុណ 🙏", "Thanks 🙏"],
    ["proud", "proud", "ពូកែ! 🎉", "Great! 🎉"], ["yay", "cheer", "យេ! 🥳", "Yay! 🥳"], ["miss", "worry", "នឹក…", "Miss you…"], ["night", "sleepy", "រាត្រីសួស្តី 🌙", "Good night 🌙"]
  ];
  const QUICK = [["👍", "យល់ព្រម", "OK"], ["🚗", "កំពុងទៅ", "On my way"], ["🏠", "ដល់ផ្ទះហើយ", "Home now"], ["🍲", "ញ៉ាំបាយហើយឬនៅ?", "Eaten yet?"]];
  const EMOJI = ["❤️", "😂", "👍", "🎉", "😢", "🙏"];

  /* ---------- people ---------- */
  const st = () => FG()?.state || {};
  const me = () => st().me;
  const memberOf = uid => (st().members || []).find(m => m.user_id === uid) || null;
  function nameOf(uid) {
    if (!uid) return L("សមាជិក", "Member");
    const m = memberOf(uid);
    if (m && FG()?.nameOf) return FG().nameOf(m);
    return m?.display_name || L("អតីតសមាជិក", "Former member");
  }
  const first = uid => String(nameOf(uid)).trim().split(/\s+/)[0];
  function photoOf(uid) {
    const p = FG()?.profileOf?.(uid);
    if (p?.photo) return p.photo;
    if (uid === me()) return (typeof appData !== "undefined" && appData.profile?.photo) || "";
    return "";
  }
  const TONES = ["linear-gradient(135deg,#ffb3c4,#ff6f91)", "linear-gradient(135deg,#ffd98a,#f5a524)", "linear-gradient(135deg,#9fe3c8,#2fb489)", "linear-gradient(135deg,#a9d4ff,#4a8ff0)", "linear-gradient(135deg,#b8adff,#6b5ce7)"];
  function av(uid, cls = "") {
    const photo = photoOf(uid);
    const n = String(uid || "").split("").reduce((t, c) => t + c.charCodeAt(0), 0);
    const letter = (Array.from(String(nameOf(uid)).trim())[0] || "?").toUpperCase();
    return `<span class="fc-av ${cls}" style="background:${TONES[n % TONES.length]}">${photo ? `<img src="${attr(photo)}" alt="">` : esc(letter)}</span>`;
  }
  const groupAv = cls => `<span class="fc-av is-fam ${cls}">👪</span>`;
  const familyName = () => st().family?.name || L("គ្រួសារ", "Family");
  const chatTitle = c => c.kind === "group" ? L("គ្រួសារទាំងអស់គ្នា", "Whole family") : nameOf(c.other_user);
  const chatById = id => S.chats.find(c => c.chat_id === id) || null;

  /* ---------- time ---------- */
  function clock(iso) {
    const d = new Date(iso);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  function dayLabel(iso) {
    const d = new Date(iso); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return L("ថ្ងៃនេះ", "Today");
    if (d.toDateString() === y.toDateString()) return L("ម្សិលមិញ", "Yesterday");
    const KM = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
    return km() ? `${d.getDate()} ${KM[d.getMonth()]}` : d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  }
  function listTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString() ? clock(iso) : dayLabel(iso);
  }

  /* ---------- data ---------- */
  async function ready() {
    const fg = FG();
    if (!fg || !client()) return false;
    if (fg.state.status !== "ready") { try { await fg.load(); } catch (error) { return false; } }
    return Boolean(fg.state.family && fg.state.me);
  }
  async function loadList({ notify = false } = {}) {
    if (!(await ready())) { S.loaded = true; return S.chats; }
    const before = S.unread;
    const { data, error } = await client().rpc("family_chat_list", { p_family: st().family.id });
    S.loaded = true;
    if (error) {
      S.missing = /does not exist|could not find|schema cache|PGRST202/i.test(`${error.message} ${error.code}`);
      return S.chats;
    }
    S.missing = false;
    S.chats = Array.isArray(data) ? data : [];
    S.unread = S.chats.reduce((t, c) => t + (c.chat_id === S.room ? 0 : Number(c.unread) || 0), 0);
    badges();
    if (notify && S.unread > before) {
      const c = S.chats.filter(x => x.chat_id !== S.room && x.unread > 0 && x.last_sender !== me()).sort((a, b) => String(b.last_at).localeCompare(String(a.last_at)))[0];
      if (c && Date.now() - S.lastToastAt > 4000 && typeof Toast !== "undefined") {
        S.lastToastAt = Date.now();
        Toast.show(`💬 ${first(c.last_sender)}: ${preview(c)}`, "success", { sound: "nomiPurr" });
      }
    }
    if (curRoute() === "chat" && !S.room) paintList();
    return S.chats;
  }
  function preview(c) {
    if (!c.last_kind) return L("មិនទាន់មានសារ — និយាយសួស្តីសិន 👋", "No messages yet — say hi 👋");
    if (c.last_kind === "sticker") return L("🐱 sticker", "🐱 sticker");
    if (c.last_kind === "share") return `📌 ${c.last_body || L("ចែករំលែក", "Shared")}`;
    return c.last_body || "";
  }
  function badges() {
    document.querySelectorAll("[data-fc-badge]").forEach(el => { el.textContent = S.unread > 9 ? "9+" : String(S.unread || ""); el.hidden = !S.unread; });
    document.querySelectorAll('.nav-item[data-route="family"]').forEach(el => el.classList.toggle("fc-has-new", S.unread > 0));
  }
  async function loadRoom() {
    if (!S.room || !client()) return;
    const { data, error } = await client().from("family_messages").select("*").eq("chat_id", S.room).order("created_at", { ascending: false }).limit(80);
    if (error) return;
    const rows = (data || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const sig = rows.map(r => `${r.id}|${r.deleted_at || ""}|${JSON.stringify(r.reactions || {})}`).join(",");
    const hadNew = rows.length && S.msgs.length && rows[rows.length - 1].id !== S.msgs[S.msgs.length - 1]?.id && rows[rows.length - 1].sender !== me();
    S.msgs = rows;
    if (sig !== S.sig) {
      S.sig = sig; paintMsgs();
      if (hadNew && typeof Sound !== "undefined") Sound.play("pop");
      client().rpc("family_chat_read", { p_chat: S.room }).then(() => {}, () => {});
    }
  }

  /* ---------- live updates ---------- */
  function watch() {
    if (S.channel || !client()?.channel || !st().family) return;
    try {
      S.channel = client().channel(`fc-${st().family.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "family_messages" }, payload => {
          const row = payload.new || payload.old || {};
          if (S.room && row.chat_id === S.room) loadRoom();
          loadList({ notify: !S.room || row.chat_id !== S.room });
        })
        .subscribe();
    } catch (error) { S.channel = null; }
    clearInterval(S.listPoll);
    S.listPoll = setInterval(() => { if (document.visibilityState === "visible") loadList({ notify: true }); }, 30000);
  }

  /* ---------- share cards from the app ---------- */
  const fmt = n => (typeof money === "function" ? String(money(Number(n) || 0)).replace(/<[^>]*>/g, "") : `$${Number(n || 0).toLocaleString()}`);
  function shareOptions() {
    const out = [];
    const data = typeof appData !== "undefined" ? appData : {};
    if (typeof DoneFeed !== "undefined" && DoneFeed.items) {
      DoneFeed.items(7).slice(0, 4).forEach(item => out.push({ type: item.kind === "save" ? "save" : "paid", icon: item.kind === "save" ? "🐷" : "✅",
        head: item.kind === "save" ? L("🐷 បានសន្សំ", "🐷 Saved") : L("✅ បានបង់", "✅ Paid"), title: `${item.title}${item.amount ? ` — ${item.amount}` : ""}`, sub: item.sub || L("ធ្វើរួចហើយ 👏", "Done 👏") }));
    }
    (data.goals || []).filter(g => Number(g.targetAmount) > 0).slice(0, 3).forEach(g => {
      const pct = Math.max(0, Math.min(100, Math.round((Number(g.currentAmount) || 0) / Number(g.targetAmount) * 100)));
      out.push({ type: "goal", icon: "🎯", head: L("🎯 គោលដៅ", "🎯 Goal"), title: g.name || L("គោលដៅ", "Goal"), sub: `${fmt(g.currentAmount)} / ${fmt(g.targetAmount)} · ${pct}%`, pct });
    });
    const today = typeof localDateInput === "function" ? localDateInput() : new Date().toISOString().slice(0, 10);
    (data.calendarEvents || []).filter(e => e.date && e.date >= today).sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`)).slice(0, 4)
      .forEach(e => out.push({ type: "event", icon: "📅", head: L("📅 ព្រឹត្តិការណ៍", "📅 Event"), title: e.title || L("ព្រឹត្តិការណ៍", "Event"), sub: `${dayLabel(`${e.date}T${e.time || "12:00"}`)}${e.time ? ` · ${e.time}` : ""}`, date: e.date, time: e.time || "" }));
    return out;
  }
  // plain text only (cards sent before 6 Nov could carry the money <span> markup)
  const plainText = v => String(v ?? "").replace(/<[^>]*>/g, "");
  function cardHtml(d, mine) {
    const type = ["paid", "save", "goal", "event"].includes(d.type) ? d.type : "paid";
    const pct = Math.max(0, Math.min(100, Number(d.pct) || 0));
    return `<div class="fc-card is-${type}"><div class="fc-card-h">${esc(d.head || "📌")}</div><div class="fc-card-b"><b>${esc(plainText(d.title))}</b>${d.sub ? `<small>${esc(plainText(d.sub))}</small>` : ""}${type === "goal" ? `<div class="fc-bar"><i style="width:${pct}%"></i></div>` : ""}</div>${type === "event" && !mine ? `<div class="fc-card-f"><button type="button" data-fc-going>✋ ${esc(L("ខ្ញុំទៅ", "I'm going"))}</button><button type="button" data-fc-addcal>📅 ${esc(L("ដាក់ក្នុងប្រតិទិនខ្ញុំ", "Add to my calendar"))}</button></div>` : ""}</div>`;
  }
  function stickerHtml(id) {
    const s = STICKERS.find(x => x[0] === id) || STICKERS[0];
    const art = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy(s[1]) : "🐱";
    return `<div class="fc-sticker">${art}<b>${esc(L(s[2], s[3]))}</b></div>`;
  }

  /* ---------- pages ---------- */
  function render(param = "") {
    S.room = null;
    if (param.startsWith("dm-")) { openDm(param.slice(3)); return page(`<div class="fc-empty">${esc(L("កំពុងបើក…", "Opening…"))}</div>`); }
    if (param) { S.room = param; return roomHtml(); }
    return page(listInner());
  }
  const page = inner => `<section class="page fc-page">${inner}</section>`;
  function listInner() {
    const s = st();
    if (!S.loaded || s.status === "loading" || s.status === "idle") return `<div class="fc-empty">${esc(L("កំពុងផ្ទុក…", "Loading…"))}</div>`;
    if (s.status === "signedout") return `<div class="fc-empty">🔒 ${esc(L("Login ដើម្បីជជែកជាមួយគ្រួសារ", "Log in to chat with your family"))}</div>`;
    if (!s.family) return `<div class="fc-empty">👪 ${esc(L("បង្កើត ឬចូលរួមគ្រួសារសិន ទើបជជែកបាន", "Create or join a family first"))}<a class="fc-link" href="#family">${esc(L("ទៅទំព័រគ្រួសារ ›", "Go to Family ›"))}</a></div>`;
    if (S.missing) return `<div class="fc-empty">🛠 ${esc(L("Chat មិនទាន់ setup · ត្រូវ run SQL 20261106_family_chat.sql ក្នុង Supabase ម្តង", "Chat not set up yet · run 20261106_family_chat.sql in Supabase once"))}</div>`;
    const group = S.chats.filter(c => c.kind === "group");
    const dms = S.chats.filter(c => c.kind === "dm");
    const others = (s.members || []).filter(m => m.user_id !== s.me && !dms.some(c => c.other_user === m.user_id));
    const row = c => `<a class="fc-row" href="#chat/${attr(c.chat_id)}">${c.kind === "group" ? groupAv("") : av(c.other_user)}<span class="fc-tx"><b>${esc(chatTitle(c))}</b><small>${c.last_sender && c.kind === "group" && c.last_kind ? `${esc(c.last_sender === me() ? L("អ្នក", "You") : first(c.last_sender))}: ` : ""}${esc(preview(c))}</small></span><span class="fc-meta">${esc(listTime(c.last_at))}${c.unread ? `<i class="fc-badge">${c.unread > 9 ? "9+" : c.unread}</i>` : ""}</span></a>`;
    const nomi = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy("wink") : "🐱";
    return `<header class="fc-head"><a class="fc-back" href="#family" aria-label="${attr(L("ត្រឡប់", "Back"))}">‹</a><div><h1>💬 ${esc(L("សារគ្រួសារ", "Family chat"))}</h1><p>${esc(familyName())} · ${esc(L(`${(s.members || []).length} នាក់`, `${(s.members || []).length} people`))}</p></div></header>
      ${group.map(row).join("")}
      ${dms.length || others.length ? `<p class="fc-sec">${esc(L("ជជែក 2 នាក់", "Just the two of you"))}</p>` : ""}
      ${dms.map(row).join("")}
      ${others.map(m => `<a class="fc-row is-new" href="#chat/dm-${attr(m.user_id)}">${av(m.user_id)}<span class="fc-tx"><b>${esc(nameOf(m.user_id))}</b><small>${esc(L("ចាប់ផ្ដើមជជែក 👋", "Start a chat 👋"))}</small></span><span class="fc-meta">›</span></a>`).join("")}
      <div class="fc-tip"><span class="fc-tip-nomi">${nomi}</span><span>${esc(L("ចុច ＋ ក្នុង chat ដើម្បីចែករំលែកការបង់ ការសន្សំ ឬព្រឹត្តិការណ៍ពី app 🐾", "Tap ＋ in a chat to share a payment, saving or event from the app 🐾"))}</span></div>`;
  }
  function paintList() {
    const pageEl = document.querySelector(".fc-page:not(.fc-room-page)");
    if (pageEl) pageEl.innerHTML = listInner();
  }
  function roomHtml() {
    const c = chatById(S.room);
    const title = c ? chatTitle(c) : L("សារ", "Chat");
    const isGroup = !c || c.kind === "group";
    return `<section class="page fc-page fc-room-page"><div class="fc-room">
      <header class="fc-rhead"><a class="fc-back" href="#chat" aria-label="${attr(L("ត្រឡប់", "Back"))}">‹</a>${isGroup ? groupAv("") : av(c.other_user)}
        <div class="fc-rtitle"><b>${esc(title)}</b><small>${esc(isGroup ? L(`${(st().members || []).length} នាក់ · ${familyName()}`, `${(st().members || []).length} people · ${familyName()}`) : L("ឯកជន · តែ 2 នាក់", "Private · just you two"))}</small></div>
        ${!isGroup && c ? `<a class="fc-ibtn" href="#profile/${attr(c.other_user)}" aria-label="Profile">👤</a>` : ""}</header>
      <div class="fc-msgs" data-fc-msgs><div class="fc-empty is-small">${esc(L("កំពុងផ្ទុក…", "Loading…"))}</div></div>
      ${isGroup ? `<div class="fc-quick">${QUICK.map(([i, k, e]) => `<button type="button" data-fc-quick="${attr(`${i} ${L(k, e)}`)}">${i} ${esc(L(k, e))}</button>`).join("")}</div>` : ""}
      <div class="fc-drawer" data-fc-drawer hidden></div>
      <form class="fc-comp" data-fc-form><button type="button" class="fc-ib" data-fc-open="share" aria-label="${attr(L("ចែករំលែក", "Share"))}">＋</button><button type="button" class="fc-ib" data-fc-open="sticker" aria-label="Sticker">🐱</button>
        <input class="fc-inp" name="text" maxlength="1000" autocomplete="off" enterkeyhint="send" placeholder="${attr(isGroup ? L("សរសេរសារ…", "Message…") : L(`សរសេរទៅ ${first(c.other_user)}…`, `Message ${first(c.other_user)}…`))}">
        <button type="submit" class="fc-send" aria-label="${attr(L("ផ្ញើ", "Send"))}">➤</button></form>
    </div></section>`;
  }
  function paintMsgs() {
    const box = document.querySelector("[data-fc-msgs]");
    if (!box) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const c = chatById(S.room);
    const isGroup = !c || c.kind === "group";
    const admin = FG()?.isAdmin?.();
    let lastDay = "", prev = null;
    const html = S.msgs.map(m => {
      let out = "";
      const day = new Date(m.created_at).toDateString();
      if (day !== lastDay) { out += `<div class="fc-day">${esc(dayLabel(m.created_at))}</div>`; lastDay = day; prev = null; }
      const mine = m.sender === me();
      const chain = prev && prev.sender === m.sender && (Date.parse(m.created_at) - Date.parse(prev.created_at)) < 180000;
      prev = m;
      let body;
      if (m.deleted_at) body = `<div class="fc-bub is-del">🗑 ${esc(L("សារត្រូវបានលុប", "Message deleted"))}</div>`;
      else if (m.kind === "sticker") body = stickerHtml(m.data?.sticker);
      else if (m.kind === "share") body = cardHtml(m.data || {}, mine);
      else body = `<div class="fc-bub">${esc(m.body).replace(/\n/g, "<br>")}</div>`;
      const reacts = Object.entries(m.reactions || {}).filter(([, list]) => Array.isArray(list) && list.length);
      const canDel = !m.deleted_at && (mine || (isGroup && admin));
      out += `<div class="fc-m${mine ? " is-me" : ""}${chain ? " is-chain" : ""}" data-fc-msg="${attr(m.id)}" data-fc-del="${canDel ? "1" : ""}">
        ${mine ? "" : chain ? `<span class="fc-av-gap"></span>` : av(m.sender, "is-sm")}
        <div class="fc-col">${!mine && isGroup && !chain ? `<span class="fc-who">${esc(first(m.sender))}</span>` : ""}${body}
          ${reacts.length ? `<span class="fc-reacts">${reacts.map(([e, list]) => `<button type="button" class="${list.includes(me()) ? "is-mine" : ""}" data-fc-react="${attr(e)}">${e}${list.length > 1 ? ` ${list.length}` : ""}</button>`).join("")}</span>` : ""}</div>
        <span class="fc-time">${esc(clock(m.created_at))}</span></div>`;
      return out;
    }).join("");
    box.innerHTML = html || `<div class="fc-empty is-small">${typeof HomeV2 !== "undefined" && HomeV2.buddy ? `<span class="fc-hi">${HomeV2.buddy("happy")}</span>` : "👋"}${esc(L("មិនទាន់មានសារ — ផ្ញើ sticker សួស្តីមួយ!", "No messages yet — send a hello sticker!"))}</div>`;
    if (nearBottom || !box.dataset.painted) box.scrollTop = box.scrollHeight;
    box.dataset.painted = "1";
  }

  /* ---------- actions ---------- */
  async function send(kind, body, data = {}) {
    if (!S.room || S.busy) return;
    S.busy = true;
    const temp = { id: `tmp-${Date.now()}`, chat_id: S.room, sender: me(), kind, body, data, reactions: {}, created_at: new Date().toISOString() };
    S.msgs.push(temp); paintMsgs();
    const box = document.querySelector("[data-fc-msgs]"); if (box) box.scrollTop = box.scrollHeight;
    const { error } = await client().rpc("family_chat_send", { p_chat: S.room, p_kind: kind, p_body: body || null, p_data: data });
    S.busy = false;
    if (error) {
      S.msgs = S.msgs.filter(m => m !== temp); paintMsgs();
      if (typeof Toast !== "undefined") Toast.show(`⚠️ ${L("ផ្ញើមិនបាន", "Couldn't send")} · ${error.message || ""}`, "warning");
      return false;
    }
    if (typeof Sound !== "undefined") Sound.play("pop");
    S.sig = ""; await loadRoom(); loadList();
    return true;
  }
  async function openDm(uid) {
    if (!(await ready())) return;
    const { data, error } = await client().rpc("family_chat_open_dm", { p_family: st().family.id, p_other: uid });
    if (error || !data) { if (typeof Toast !== "undefined") Toast.show(`⚠️ ${error?.message || L("បើកមិនបាន", "Couldn't open")}`, "warning"); location.replace("#chat"); return; }
    await loadList();
    location.replace(`#chat/${data}`);
  }
  function drawer(which) {
    const el = document.querySelector("[data-fc-drawer]");
    if (!el) return;
    const same = !el.hidden && el.dataset.which === which;
    document.querySelectorAll("[data-fc-open]").forEach(b => b.classList.toggle("is-on", !same && b.dataset.fcOpen === which));
    if (same) { el.hidden = true; return; }
    el.dataset.which = which; el.hidden = false;
    if (which === "sticker") {
      const art = m => (typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy(m) : "🐱");
      el.innerHTML = `<div class="fc-sgrid">${STICKERS.map(s => `<button type="button" data-fc-sticker="${attr(s[0])}">${art(s[1])}<small>${esc(L(s[2], s[3]))}</small></button>`).join("")}</div>`;
    } else {
      const opts = shareOptions();
      S.shareOpts = opts;
      el.innerHTML = opts.length ? `<p class="fc-dtitle">${esc(L("ចែករំលែកពី app", "Share from the app"))}</p><div class="fc-shgrid">${opts.map((o, i) => `<button type="button" data-fc-share="${i}"><span>${o.icon}</span><span><b>${esc(plainText(o.title))}</b><small>${esc(plainText(o.sub))}</small></span></button>`).join("")}</div>`
        : `<p class="fc-dtitle">${esc(L("មិនទាន់មានអ្វីចែករំលែក — បង់វិក្កយបត្រ ដាក់សន្សំ ឬបន្ថែមព្រឹត្តិការណ៍សិន", "Nothing to share yet — pay a bill, save, or add an event first"))}</p>`;
    }
  }
  function closeDrawer() { const el = document.querySelector("[data-fc-drawer]"); if (el) el.hidden = true; document.querySelectorAll("[data-fc-open]").forEach(b => b.classList.remove("is-on")); }
  function menuFor(msgEl) {
    document.querySelector(".fc-menu")?.remove();
    const id = msgEl.dataset.fcMsg;
    if (!id || id.startsWith("tmp-")) return;
    const m = S.msgs.find(x => x.id === id);
    if (!m || m.deleted_at) return;
    const menu = document.createElement("div");
    menu.className = "fc-menu";
    menu.innerHTML = `<div class="fc-menu-e">${EMOJI.map(e => `<button type="button" data-e="${e}">${e}</button>`).join("")}</div>${msgEl.dataset.fcDel ? `<button type="button" class="fc-menu-del" data-del>🗑 ${esc(L("លុបសារ", "Delete"))}</button>` : ""}${m.kind === "text" ? `<button type="button" class="fc-menu-del" data-copy>📋 ${esc(L("ចម្លង", "Copy"))}</button>` : ""}`;
    msgEl.querySelector(".fc-col").appendChild(menu);
    const close = event => { if (!menu.contains(event.target)) { menu.remove(); document.removeEventListener("pointerdown", close, true); } };
    setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
    menu.addEventListener("click", async event => {
      const b = event.target.closest("button"); if (!b) return;
      menu.remove();
      if (b.dataset.e) { await client().rpc("family_chat_react", { p_message: id, p_emoji: b.dataset.e }); S.sig = ""; loadRoom(); }
      else if (b.hasAttribute("data-del")) { const { error } = await client().rpc("family_chat_delete", { p_message: id }); if (!error && typeof Sound !== "undefined") Sound.play("delete"); S.sig = ""; loadRoom(); loadList(); }
      else if (b.hasAttribute("data-copy")) { try { await navigator.clipboard.writeText(m.body || ""); toast(L("បានចម្លង", "Copied")); } catch (error) { /* ignore */ } }
    });
  }

  function bind() {
    const pageEl = document.querySelector(".fc-page");
    document.body.classList.toggle("fc-room-open", Boolean(S.room));
    if (!pageEl) return;
    if (!S.loaded) loadList().then(() => { if (curRoute() === "chat" && !S.room) paintList(); });
    else if (!S.room) loadList();
    watch();
    clearInterval(S.poll);
    if (!S.room) return;
    // a room: lift it out of the page (the page animates with a transform, which would trap
    // position:fixed) so it covers the whole screen; the previous one is removed first
    document.querySelectorAll("body > .fc-room").forEach(el => el.remove());
    const roomEl = pageEl.querySelector(".fc-room");
    if (roomEl) document.body.appendChild(roomEl);
    // make sure the chat list is known (title), then load + poll
    if (!chatById(S.room)) loadList().then(() => { if (chatById(S.room) && curRoute() === "chat") App.render(); });
    S.sig = null; S.msgs = [];
    loadRoom();
    S.poll = setInterval(() => { if (document.visibilityState === "visible" && S.room) loadRoom(); }, 5000);
    const scope = roomEl || pageEl;
    const form = scope.querySelector("[data-fc-form]");
    const input = form.querySelector(".fc-inp");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      closeDrawer();
      if (!(await send("text", text))) input.value = text;
      input.focus();
    });
    input.addEventListener("focus", closeDrawer);
    scope.addEventListener("click", event => {
      const t = event.target;
      const open = t.closest("[data-fc-open]"); if (open) { drawer(open.dataset.fcOpen); return; }
      const stk = t.closest("[data-fc-sticker]"); if (stk) { closeDrawer(); send("sticker", null, { sticker: stk.dataset.fcSticker }); return; }
      const sh = t.closest("[data-fc-share]"); if (sh) { const o = S.shareOpts?.[Number(sh.dataset.fcShare)]; closeDrawer(); if (o) { const { icon, ...data } = o; void icon; send("share", o.title, data); } return; }
      const q = t.closest("[data-fc-quick]"); if (q) { send("text", q.dataset.fcQuick); return; }
      const react = t.closest("[data-fc-react]"); if (react) { const id = react.closest("[data-fc-msg]")?.dataset.fcMsg; if (id) client().rpc("family_chat_react", { p_message: id, p_emoji: react.dataset.fcReact }).then(() => { S.sig = ""; loadRoom(); }); return; }
      const going = t.closest("[data-fc-going]"); if (going) { const m = S.msgs.find(x => x.id === going.closest("[data-fc-msg]")?.dataset.fcMsg); send("text", `✋ ${L("ខ្ញុំទៅ", "I'm going")} — ${m?.data?.title || ""}`); return; }
      const addcal = t.closest("[data-fc-addcal]"); if (addcal) {
        const m = S.msgs.find(x => x.id === addcal.closest("[data-fc-msg]")?.dataset.fcMsg);
        if (m?.data?.date && typeof Store !== "undefined") { Store.add("calendarEvents", { title: m.data.title, date: m.data.date, time: m.data.time || "", category: "Family", reminder: true, notes: L(`ពី chat គ្រួសារ (${first(m.sender)})`, `From family chat (${first(m.sender)})`) }); toast(L("📅 បានដាក់ក្នុងប្រតិទិន", "📅 Added to your calendar")); }
        return;
      }
    });
    // hold a message (or right-click) → ❤️ / delete
    let timer = null;
    const box = scope.querySelector("[data-fc-msgs]");
    box.addEventListener("pointerdown", event => { const el = event.target.closest("[data-fc-msg]"); if (!el || event.target.closest("button")) return; timer = setTimeout(() => menuFor(el), 450); });
    ["pointerup", "pointerleave", "pointercancel", "scroll"].forEach(name => box.addEventListener(name, () => clearTimeout(timer), { passive: true }));
    box.addEventListener("contextmenu", event => { const el = event.target.closest("[data-fc-msg]"); if (el) { event.preventDefault(); menuFor(el); } });
    box.addEventListener("dblclick", event => { const el = event.target.closest("[data-fc-msg]"); if (el && !el.dataset.fcMsg.startsWith("tmp-")) client().rpc("family_chat_react", { p_message: el.dataset.fcMsg, p_emoji: "❤️" }).then(() => { S.sig = ""; loadRoom(); }); });
  }
  // leaving the chat page: stop the room poll
  window.addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#chat/")) { S.room = null; clearInterval(S.poll); document.body.classList.remove("fc-room-open"); document.querySelectorAll("body > .fc-room").forEach(el => el.remove()); }
  });
  // start watching for new messages once the family is known (badges on Family)
  function boot() {
    const tryStart = async () => { if (await ready()) { await loadList(); watch(); } };
    setTimeout(tryStart, 2500);
  }
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot(); }

  const buttonHtml = () => `<a class="fc-open" href="#chat" aria-label="${attr(L("សារគ្រួសារ", "Family chat"))}">💬<span>${esc(L("សារ", "Chat"))}</span><i data-fc-badge ${S.unread ? "" : "hidden"}>${S.unread || ""}</i></a>`;
  return { render, bind, loadList, buttonHtml, badges, get unread() { return S.unread; } };
})();
