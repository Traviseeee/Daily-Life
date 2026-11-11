/* MYLIFE member profiles (6 Nov 2026) — "like Facebook" for the family group.
 * Page #profile/<userId>: cover, photo, name, relation, bio, call / Telegram / SMS,
 * birthday countdown, about. My own page has "Edit my profile" (each detail can be
 * "Family" or "Only me"); an admin sees "Role & access" on other members.
 * Data: Supabase member_profiles (own row) + family_profiles(family) for everyone
 * (supabase/migrations/20261106_invite_v2_profiles.sql). Photos are resized on the
 * phone to small JPEG data URLs. Also used by the join welcome (mountSetup). */
const MemberProfile = (() => {
  const km = () => (typeof languageCode === "function" ? languageCode() : "en") === "km";
  const L = (k, e) => (km() ? k : e);
  const esc = value => (typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? ""));
  const attr = value => (typeof escapeAttr === "function" ? escapeAttr(value) : esc(value));
  const client = () => (typeof window !== "undefined" ? window.supabaseClient : null);
  const FG = () => (typeof FamilyGroup !== "undefined" ? FamilyGroup : null);
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const HIDEABLE = ["bio", "birthday", "relation", "phone", "telegram"];
  const RELATIONS = [["", "—", "—"], ["Partner", "សង្សារ", "Partner"], ["Spouse", "ប្តី / ប្រពន្ធ", "Spouse"], ["Mother", "ម្តាយ", "Mother"], ["Father", "ឪពុក", "Father"], ["Sibling", "បងប្អូន", "Sibling"], ["Child", "កូន", "Child"], ["Relative", "សាច់ញាតិ", "Relative"], ["Friend", "មិត្តភក្តិ", "Friend"]];
  const relLabel = value => { const row = RELATIONS.find(entry => entry[0] === value); return row ? L(row[1], row[2]) : value || ""; };
  let loadingOnce = false;

  const initials = name => String(name || "?").trim().split(/\s+/).map(part => Array.from(part)[0] || "").join("").slice(0, 2).toUpperCase() || "?";
  const dayLabel = iso => {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return km() ? `${d.getDate()} ${KM_MONTHS[d.getMonth()]}` : d.toLocaleDateString("en-US", { day: "numeric", month: "long" });
  };
  const monthYear = iso => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return km() ? `${KM_MONTHS[d.getMonth()]} ${d.getFullYear()}` : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  function daysToBirthday(iso) {
    if (!iso) return null;
    const b = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(b.getTime())) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    if (next < now) next.setFullYear(now.getFullYear() + 1);
    return Math.round((next - now) / 864e5);
  }

  // the person: shared profile + my local family card (if linked) as a fallback
  function person(userId) {
    const fg = FG();
    const state = fg?.state || {};
    const member = (state.members || []).find(entry => entry.user_id === userId);
    if (!member) return null;
    const profile = state.profiles?.[userId] || {};
    const card = (appData.family || []).find(entry => entry.userId === userId) || null;
    const self = userId === state.me;
    return {
      userId, self, member, card,
      name: profile.display_name || (fg ? fg.nameOf(member) : member.display_name) || card?.name || "",
      photo: profile.photo || (self ? appData.profile?.photo : "") || card?.photo || "",
      cover: profile.cover || "",
      bio: profile.bio || "",
      birthday: profile.birthday || (self ? "" : card?.birthday) || "",
      relation: profile.relation || "",
      phone: profile.phone || (self ? "" : card?.phone) || "",
      telegram: String(profile.telegram || "").replace(/^@/, ""),
      hidden: profile.hidden || {},
      role: member.role, joined: member.joined_at, raw: profile
    };
  }

  /* ---------- page ---------- */
  function render(userId) {
    const fg = FG();
    const state = fg?.state;
    if (!state || state.status !== "ready") {
      if (fg && !loadingOnce) { loadingOnce = true; fg.load(true).then(() => { loadingOnce = false; if (typeof App !== "undefined" && App.route === "profile") App.render(); }).catch(() => { loadingOnce = false; }); }
      const msg = state?.status === "signedout" ? L("Login ដើម្បីមើល Profile", "Log in to see profiles") : state?.status === "offline" ? L("ត្រូវ online ដើម្បីមើល Profile", "Go online to see profiles") : L("កំពុងផ្ទុក…", "Loading…");
      return `<section class="page mp-page"><div class="mp-empty">${esc(msg)}</div></section>`;
    }
    if (!state.v2) return `<section class="page mp-page"><div class="mp-empty">${esc(L("Profile មិនទាន់ setup · ត្រូវ run SQL 20261106_invite_v2_profiles.sql ក្នុង Supabase ម្តង", "Profiles not set up yet · run 20261106_invite_v2_profiles.sql in Supabase once"))}</div></section>`;
    const p = person(userId || state.me);
    if (!p) return `<section class="page mp-page"><div class="mp-empty">${esc(L("រកមិនឃើញសមាជិកនេះទេ", "Member not found"))}<a class="mp-back-link" href="#family">${esc(L("‹ ត្រឡប់ទៅគ្រួសារ", "‹ Back to family"))}</a></div></section>`;
    const days = daysToBirthday(p.birthday);
    const tg = p.telegram ? `https://t.me/${encodeURIComponent(p.telegram)}` : "";
    const phone = String(p.phone || "").replace(/[^\d+]/g, "");
    const act = (href, cls, icon, label) => href ? `<a class="mp-act ${cls}" href="${attr(href)}" ${href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${icon}<span>${esc(label)}</span></a>` : `<span class="mp-act ${cls} is-off">${icon}<span>${esc(label)}</span></span>`;
    const roleName = fgRole(p.role);
    const about = [
      p.birthday ? ["🎂", L("ថ្ងៃកំណើត", "Birthday"), dayLabel(p.birthday), "birthday"] : null,
      p.relation ? ["💗", L("ទំនាក់ទំនង", "Relation"), relLabel(p.relation), "relation"] : null,
      p.telegram ? ["✈️", "Telegram", `@${p.telegram}`, "telegram"] : null,
      p.phone ? ["📱", L("ទូរសព្ទ", "Phone"), p.phone, "phone"] : null,
      ["🗓", L("ចូលរួមគ្រួសារ", "Joined"), monthYear(p.joined), ""],
      ["👤", L("តួនាទី", "Role"), roleName, ""]
    ].filter(Boolean);
    return `<section class="page mp-page">
      <a class="mp-back" href="#family" aria-label="${attr(L("ត្រឡប់", "Back"))}">‹ ${esc(L("គ្រួសារ", "Family"))}</a>
      <article class="mp-card">
        <div class="mp-cover"${p.cover ? ` style="background-image:url('${attr(p.cover)}')"` : ""}></div>
        <div class="mp-me">
          <div class="mp-av">${p.photo ? `<img src="${attr(p.photo)}" alt="">` : esc(initials(p.name))}${p.self && typeof NimoLife !== "undefined" && NimoLife.state?.streak ? `<em>🔥 ${NimoLife.state.streak}</em>` : ""}</div>
          <h1>${esc(p.name)}${p.self ? ` <small>(${esc(L("អ្នក", "you"))})</small>` : ""}</h1>
          ${p.relation ? `<span class="mp-rel">💗 ${esc(relLabel(p.relation))}</span>` : `<span class="mp-rel is-role">${esc(roleName)}</span>`}
          ${p.bio ? `<p class="mp-bio">${esc(p.bio)}</p>` : p.self ? `<p class="mp-bio is-empty">${esc(L("សរសេរពីខ្លួនអ្នកបន្តិច…", "Write a little about you…"))}</p>` : ""}
          ${p.self ? `<button type="button" class="mp-edit" data-mp-edit>✎ ${esc(L("កែ Profile ខ្ញុំ", "Edit my profile"))}</button>`
            : `<div class="mp-acts">${act(phone ? `tel:${phone}` : "", "is-call", "📞", L("ហៅ", "Call"))}${act(tg, "is-tg", "✈️", "Telegram")}${act(`#chat/dm-${p.userId}`, "is-msg", "💬", L("សារ", "Message"))}</div>`}
          <div class="mp-stats">
            <div><b>${days === null ? "—" : days === 0 ? "🎉" : days}</b><small>${esc(days === 0 ? L("ថ្ងៃកំណើតថ្ងៃនេះ!", "Birthday today!") : L("ថ្ងៃដល់ខួបកំណើត", "days to birthday"))}</small></div>
            <div><b>${esc(monthYear(p.joined).split(" ")[0] || "—")}</b><small>${esc(L("ចូលរួម", "joined"))}</small></div>
            <div><b>${esc(roleName)}</b><small>${esc(L("តួនាទី", "role"))}</small></div>
          </div>
        </div>
      </article>
      ${usHtml(p)}
      ${cardBox(p)}
      <h2 class="mp-h">${esc(L("អំពី", "About"))}</h2>
      <div class="mp-info">${about.map(([icon, label, value, key]) => `<div><span>${icon} ${esc(label)}</span><b>${esc(value)}${p.self && key && p.hidden?.[key] ? ` <i>🔒 ${esc(L("តែខ្ញុំ", "only me"))}</i>` : ""}</b></div>`).join("")}</div>
      ${!p.self && fg.isAdmin() && !fg.isOwner(p.member) ? `<button type="button" class="mp-admin" data-mp-access="${attr(p.userId)}">⚙️ ${esc(L("តួនាទី និងសិទ្ធិមើល", "Role & access"))}</button>` : ""}
      ${p.self ? `<button type="button" class="mp-admin" data-mp-access="${attr(p.userId)}">⚙️ ${esc(L("ឈ្មោះក្នុងគ្រួសារ · ចាកចេញ", "Family name · leave"))}</button>` : ""}
    </section>`;
  }
  /* ---------- 💜 Us + 🔗 my card (11 Nov): love days, shared streak, the card I keep ---------- */
  function usHtml(p) {
    if (p.self) return selfStreaks();
    const love = typeof FamilyCouple !== "undefined" && FamilyCouple.withPartner ? FamilyCouple.withPartner(p.userId) : null;
    const duos = typeof NimoDuo !== "undefined" && NimoDuo.list ? NimoDuo.list() : null;
    const duo = duos ? duos.find(item => item.partner === p.userId) : null;
    const first = String(p.name || "").trim().split(/\s+/)[0] || p.name;
    let loveHtml = "";
    if (love?.start) {
      const days = typeof daysSinceDate === "function" ? daysSinceDate(love.start) : Math.floor((Date.now() - Date.parse(love.start)) / 864e5);
      const start = new Date(`${love.start}T00:00:00`), now = new Date();
      let y = now.getFullYear() - start.getFullYear(), mo = now.getMonth() - start.getMonth();
      if (now.getDate() < start.getDate()) mo -= 1;
      if (mo < 0) { y -= 1; mo += 12; }
      const ann = typeof nextAnnualDate === "function" ? nextAnnualDate(love.start) : "";
      const annIn = ann && typeof daysUntil === "function" ? daysUntil(ann) : null;
      loveHtml = `<button type="button" class="mp-love" ${love.cardId ? `data-mp-card="${attr(love.cardId)}"` : "data-fc-edit"}><span class="mp-love-ic">💞</span><span class="mp-love-t"><b>${days.toLocaleString("en-US")} <small>${esc(L("ថ្ងៃ", "days"))}</small></b><small>${esc(L(`បាននៅជាមួយគ្នា · ${y} ឆ្នាំ ${mo} ខែ`, `together · ${y} yrs ${mo} mo`))}</small></span>${ann ? `<span class="mp-love-ann">${esc(L(`ខួប ${dayLabel(ann).replace(/\s*\d{4}$/, "")}`, `Anniversary ${dayLabel(ann).replace(/\s*\d{4}$/, "")}`))}<br>${esc(annIn === 0 ? L("ថ្ងៃនេះ! 🎉", "today! 🎉") : L(`${annIn} ថ្ងៃទៀត`, `in ${annIn} days`))}</span>` : ""}</button>`;
    }
    let duoHtml = "";
    if (duos) {
      if (duo?.status === "active") {
        duoHtml = `<div class="mp-duo"><span class="mp-duo-n">🔥${duo.streak}</span><span class="mp-duo-t"><b>${esc(L("Streak រួមគ្នា", "Shared streak"))}</b><small>${esc(L(`វែងបំផុត ${duo.longest} ថ្ងៃ`, `best ${duo.longest} days`))}</small></span>${duo.meToday && !duo.partnerToday ? `<button type="button" class="mp-duo-btn" data-nd-nudge="${attr(p.userId)}">💜 ${esc(L("រំលឹក", "Nudge"))}</button>` : ""}</div>
          <div class="nd-today mp-duo-today"><span class="${duo.meToday ? "is-ok" : ""}">${duo.meToday ? "✓" : "○"} ${esc(L("ខ្ញុំ", "Me"))}</span><span class="${duo.partnerToday ? "is-ok" : ""}">${duo.partnerToday ? "✓" : "○"} ${esc(first)}${duo.partnerToday ? "" : esc(L(" រង់ចាំ…", " waiting…"))}</span></div>`;
      } else if (duo?.status === "pending" && duo.invitedBy !== FG()?.state?.me) {
        duoHtml = `<div class="mp-duo"><span class="mp-duo-n">🔥</span><span class="mp-duo-t"><b>${esc(L(`${first} អញ្ជើញអ្នកចូល streak រួម`, `${first} invited you to a shared streak`))}</b></span><button type="button" class="mp-duo-btn" data-nd-yes="${attr(duo.id)}">🔥 ${esc(L("ចូលរួម", "Join"))}</button></div>`;
      } else if (duo?.status === "pending") {
        duoHtml = `<div class="mp-duo"><span class="mp-duo-n">⏳</span><span class="mp-duo-t"><b>${esc(L("Streak រួមគ្នា", "Shared streak"))}</b><small>${esc(L(`រង់ចាំ ${first} ចូលរួម`, `waiting for ${first} to join`))}</small></span></div>`;
      } else {
        duoHtml = `<div class="mp-duo is-off"><span class="mp-duo-n">🔥</span><span class="mp-duo-t"><b>${esc(L("Streak រួមគ្នា", "Shared streak"))}</b><small>${esc(L("ទាំងពីរ check-in រាល់ថ្ងៃ = +1", "both check in every day = +1"))}</small></span><button type="button" class="mp-duo-btn" data-nd-invite="${attr(p.userId)}">＋ ${esc(L("អញ្ជើញ", "Invite"))}</button></div>`;
      }
    }
    if (!loveHtml && !duoHtml) return "";
    return `<h2 class="mp-h">💜 ${esc(L("ពួកយើង", "Us"))}<small>${esc(L(`មានតែអ្នក និង ${first} ឃើញ`, `only you and ${first} see this`))}</small></h2><div class="mp-us">${loveHtml}${duoHtml}</div>`;
  }
  function selfStreaks() {
    const st = typeof NimoLife !== "undefined" && NimoLife.state ? NimoLife.state() : null;
    const duos = typeof NimoDuo !== "undefined" && NimoDuo.list ? (NimoDuo.list() || []).filter(item => item.status === "active") : [];
    if (!st && !duos.length) return "";
    const nm = id => { const m = (FG()?.state?.members || []).find(x => x.user_id === id); return m && FG().nameOf ? String(FG().nameOf(m)).split(/\s+/)[0] : ""; };
    return `<h2 class="mp-h">🔥 ${esc(L("Streak របស់ខ្ញុំ", "My streaks"))}</h2><div class="mp-us mp-streaks">
      ${st ? `<div class="mp-duo"><span class="mp-duo-n">🔥${Number(st.streak || 0)}</span><span class="mp-duo-t"><b>${esc(L("ថ្ងៃជាប់ (ខ្ញុំ)", "My day streak"))}</b><small>${esc(L(`វែងបំផុត ${st.longestStreak || 0} ថ្ងៃ · Nimo កម្រិត ${st.level || 1}`, `best ${st.longestStreak || 0} days · Nimo level ${st.level || 1}`))}</small></span></div>` : ""}
      ${duos.map(item => `<a class="mp-duo" href="#profile/${attr(item.partner)}"><span class="mp-duo-n">🔥${item.streak}</span><span class="mp-duo-t"><b>${esc(L(`រួមជាមួយ ${nm(item.partner)}`, `with ${nm(item.partner)}`))}</b><small>${esc(L(`វែងបំផុត ${item.longest} ថ្ងៃ`, `best ${item.longest} days`))}</small></span><span class="mp-go">›</span></a>`).join("")}
    </div>`;
  }
  function cardBox(p) {
    if (p.self) return "";
    const fg = FG();
    const card = p.card;
    if (!card) {
      if (!fg?.isAdmin?.() || !fg.openCardPicker) return "";
      return `<h2 class="mp-h">🔗 ${esc(L("កាតរបស់ខ្ញុំ", "My card"))}</h2><div class="mp-us"><button type="button" class="mp-duo is-off mp-link" data-mp-linkcard="${attr(p.userId)}"><span class="mp-duo-n">🔗</span><span class="mp-duo-t"><b>${esc(L("ភ្ជាប់ទៅកាតក្នុងគ្រួសារ", "Link to a family card"))}</b><small>${esc(L("បើអ្នកបានបន្ថែមម្នាក់នេះពីមុន (ថ្ងៃកំណើត ថ្ងៃស្រលាញ់គ្នា …)", "If you added this person before (birthday, love date …)"))}</small></span><span class="mp-go">›</span></button></div>`;
    }
    const rows = [
      card.birthday ? ["🎂", L("ថ្ងៃកំណើត", "Birthday"), `${dayLabel(card.birthday)}${daysToBirthday(card.birthday) !== null ? ` · ${L(`${daysToBirthday(card.birthday)} ថ្ងៃទៀត`, `in ${daysToBirthday(card.birthday)} days`)}` : ""}`] : null,
      card.favorite ? ["⭐", L("ចូលចិត្ត", "Likes"), card.favorite] : null,
      card.notes ? ["📝", L("កំណត់ចំណាំ", "Notes"), String(card.notes).slice(0, 80)] : null
    ].filter(Boolean);
    return `<h2 class="mp-h">🔗 ${esc(L("កាតរបស់ខ្ញុំ", "My card"))}<small>${esc(L("ព័ត៌មានដែលអ្នកកត់", "what you keep"))}</small></h2><div class="mp-info mp-mycard">${rows.map(([icon, label, value]) => `<div><span>${icon} ${esc(label)}</span><b>${esc(value)}</b></div>`).join("")}<button type="button" class="mp-card-edit" data-mp-card="${attr(card.id)}"><span>✎ ${esc(L(`កែកាត ${card.name}`, `Edit ${card.name}'s card`))}</span><small>🔗 ${esc(L("ភ្ជាប់ជាមួយ account នេះ", "linked to this account"))}</small></button></div>`;
  }

  function fgRole(role) { const r = FG()?.ROLE?.[role]; return r ? L(r[0], r[1]) : role || ""; }

  function bind() {
    const page = document.querySelector(".mp-page");
    if (!page) return;
    if (bind.last !== location.hash) { bind.last = location.hash; window.scrollTo({ top: 0, behavior: "instant" }); }
    page.querySelector("[data-mp-edit]")?.addEventListener("click", openEdit);
    page.querySelectorAll("[data-mp-card]").forEach(button => button.addEventListener("click", () => { const card = (appData.family || []).find(item => item.id === button.dataset.mpCard); if (card && typeof openFamilyModal === "function") openFamilyModal(card); }));
    page.querySelector("[data-mp-linkcard]")?.addEventListener("click", event => FG()?.openCardPicker?.(event.currentTarget.dataset.mpLinkcard));
    if (typeof FamilyCouple !== "undefined") FamilyCouple.sync();
    if (typeof NimoDuo !== "undefined") NimoDuo.sync();
    page.querySelector("[data-mp-access]")?.addEventListener("click", event => FG()?.openMember(event.currentTarget.dataset.mpAccess));
  }

  /* ---------- photos: resize on the phone ---------- */
  function resize(file, maxW, maxH, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, maxW / img.width, maxH / img.height);
          // square avatar: crop the centre
          const square = maxW === maxH;
          const side = Math.min(img.width, img.height);
          const canvas = document.createElement("canvas");
          if (square) {
            const out = Math.min(maxW, side);
            canvas.width = out; canvas.height = out;
            canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out);
          } else {
            canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          let q = quality, url = canvas.toDataURL("image/jpeg", q);
          while (url.length > (square ? 150000 : 250000) && q > 0.4) { q -= 0.1; url = canvas.toDataURL("image/jpeg", q); }
          resolve(url);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function myRow() {
    const fg = FG();
    const uid = fg?.state?.me;
    if (!uid || !client()) return null;
    const { data } = await client().from("member_profiles").select("*").eq("user_id", uid).limit(1);
    return (data || [])[0] || null;
  }
  // my app photo → my family profile, so the family (chat, Family page) sees me (6 Nov).
  // The app photo can sit in my own private storage that others can't read, so a small copy goes here.
  // Runs once per photo; never replaces a photo I picked on purpose in "Edit my profile".
  let ensuring = false, failedSig = "";
  async function ensureMyPhoto({ force = false } = {}) {
    const fg = FG(); const uid = fg?.state?.me;
    const src = String((typeof appData !== "undefined" && appData.profile?.photo) || "");
    if (ensuring || !uid || !fg.state.family || !fg.state.v2 || !client() || !src) return false;
    const mark = `mylife:mp-photo-sync:${uid}`;
    const sig = `${src.length}:${src.slice(-40)}`;
    if (!force && failedSig === sig) return false; // tried this session already
    try { if (!force && localStorage.getItem(mark) === sig) return false; } catch (error) { /* ignore */ }
    if (!force && fg.profileOf?.(uid)?.photo) { try { localStorage.setItem(mark, sig); } catch (error) { /* ignore */ } return false; }
    ensuring = true;
    try {
      const blob = src.startsWith("data:") ? await (await fetch(src)).blob() : await (await fetch(src, { mode: "cors", cache: "no-store" })).blob();
      if (!blob || !/^image\//.test(blob.type || "image/")) return false;
      const photo = await resize(blob, 320, 320);
      const row = { user_id: uid, photo, updated_at: new Date().toISOString() };
      if (!fg.profileOf?.(uid)) row.display_name = fg.nameOf ? String(fg.nameOf(fg.state.members.find(m => m.user_id === uid) || {})).slice(0, 40) || null : null;
      const { error } = await client().from("member_profiles").upsert(row, { onConflict: "user_id" });
      if (error) throw error;
      try { localStorage.setItem(mark, sig); } catch (error) { /* ignore */ }
      await fg.load(true);
      if (typeof App !== "undefined" && ["family", "chat", "profile"].includes(App.route)) App.render();
      return true;
    } catch (error) {
      failedSig = sig;
      console.warn("MYLIFE: could not copy the profile photo to the family profile", error);
      return false;
    } finally { ensuring = false; }
  }

  async function hasMine() { try { return Boolean(await myRow()); } catch (error) { return false; } }

  async function save(values) {
    const uid = FG()?.state?.me;
    if (!uid) throw new Error("sign in first");
    const row = { user_id: uid, ...values, updated_at: new Date().toISOString() };
    const { error } = await client().from("member_profiles").upsert(row, { onConflict: "user_id" });
    if (error) throw error;
    // keep the family name in step too
    if (values.display_name) {
      const fid = FG()?.state?.family?.id;
      if (fid) await client().from("family_members").update({ display_name: values.display_name }).eq("family_id", fid).eq("user_id", uid);
    }
    // …and the app profile, so there is one name + photo everywhere
    const local = {};
    if (values.display_name) local.name = values.display_name;
    if (values.photo) local.photo = values.photo;
    if (Object.keys(local).length && typeof Store !== "undefined") Store.updateProfile(local);
    await FG()?.load(true);
  }

  const field = (name, label, value, opts = {}) => `<label class="mp-field"><span>${esc(label)}</span>${opts.select ? `<select name="${name}">${opts.select}</select>` : opts.area ? `<textarea name="${name}" maxlength="${opts.max || 160}" rows="2" placeholder="${attr(opts.ph || "")}">${esc(value || "")}</textarea>` : `<input name="${name}" type="${opts.type || "text"}" maxlength="${opts.max || 40}" value="${attr(value || "")}" placeholder="${attr(opts.ph || "")}">`}${opts.hide ? `<button type="button" class="mp-vis ${opts.hidden ? "is-me" : ""}" data-mp-vis="${name}">${esc(opts.hidden ? L("🔒 តែខ្ញុំ", "🔒 Only me") : L("👪 គ្រួសារ", "👪 Family"))}</button>` : ""}</label>`;

  function formHtml(p, compact) {
    const hidden = p.hidden || {};
    return `<form class="mp-form" data-mp-form>
      ${compact ? "" : `<div class="mp-cover-pick" data-mp-cover-box${p.cover ? ` style="background-image:url('${attr(p.cover)}')"` : ""}><label class="mp-cover-btn">📷 ${esc(L("ប្តូរ cover", "Change cover"))}<input type="file" accept="image/*" data-mp-cover hidden></label></div>`}
      <label class="mp-photo-pick ${compact ? "is-compact" : ""}"><span class="mp-photo" data-mp-photo-box>${p.photo ? `<img src="${attr(p.photo)}" alt="">` : `📷<small>${esc(L("ដាក់រូប", "Add photo"))}</small>`}</span><input type="file" accept="image/*" data-mp-photo hidden></label>
      ${field("display_name", L("ឈ្មោះ", "Name"), p.name, { max: 40 })}
      ${field("birthday", L("ថ្ងៃកំណើត", "Birthday"), String(p.birthday || "").slice(0, 10), { type: "date", hide: true, hidden: hidden.birthday })}
      ${field("bio", L("អំពីខ្ញុំ", "About me"), p.bio, { area: true, ph: L("ឧ. ចូលចិត្តឆ្មា 🐱 និងកាហ្វេ ☕", "e.g. I love cats 🐱 and coffee ☕"), hide: true, hidden: hidden.bio })}
      ${compact ? "" : `
      ${field("relation", L("ទំនាក់ទំនង", "Relation"), "", { select: RELATIONS.map(([value, k, e]) => `<option value="${attr(value)}" ${value === (p.relation || "") ? "selected" : ""}>${esc(L(k, e))}</option>`).join(""), hide: true, hidden: hidden.relation })}
      ${field("telegram", "Telegram", p.telegram ? `@${p.telegram}` : "", { ph: "@username", hide: true, hidden: hidden.telegram })}
      ${field("phone", L("លេខទូរសព្ទ", "Phone"), p.phone, { type: "tel", max: 30, hide: true, hidden: hidden.phone === undefined ? true : hidden.phone })}`}
      <p class="mp-err" data-mp-err hidden></p>
      <button type="submit" class="mp-save">${esc(compact ? L("បន្ត", "Continue") : L("រក្សាទុក", "Save"))}</button>
      ${compact ? `<button type="button" class="mp-skip" data-mp-skip>${esc(L("ធ្វើពេលក្រោយ", "Later"))}</button>` : ""}
    </form>`;
  }

  function bindForm(root, p, onDone) {
    const form = root.querySelector("[data-mp-form]");
    const values = { photo: p.raw?.photo || null, cover: p.raw?.cover || null };
    const hidden = { ...(p.hidden || {}) };
    if (hidden.phone === undefined) hidden.phone = true; // phone: only me unless they share it
    form.querySelector("[data-mp-photo]")?.addEventListener("change", async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { values.photo = await resize(file, 320, 320); form.querySelector("[data-mp-photo-box]").innerHTML = `<img src="${attr(values.photo)}" alt="">`; } catch (error) { Toast.show(L("⚠️ រូបនេះប្រើមិនបាន", "⚠️ Couldn't use that photo")); }
    });
    form.querySelector("[data-mp-cover]")?.addEventListener("change", async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { values.cover = await resize(file, 960, 420); form.querySelector("[data-mp-cover-box]").style.backgroundImage = `url('${values.cover}')`; } catch (error) { Toast.show(L("⚠️ រូបនេះប្រើមិនបាន", "⚠️ Couldn't use that photo")); }
    });
    form.querySelectorAll("[data-mp-vis]").forEach(button => button.addEventListener("click", event => {
      event.preventDefault();
      const key = button.dataset.mpVis;
      hidden[key] = !hidden[key];
      button.classList.toggle("is-me", hidden[key]);
      button.textContent = hidden[key] ? L("🔒 តែខ្ញុំ", "🔒 Only me") : L("👪 គ្រួសារ", "👪 Family");
    }));
    form.querySelector("[data-mp-skip]")?.addEventListener("click", () => onDone && onDone(false));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const button = form.querySelector(".mp-save");
      button.disabled = true;
      const row = {
        display_name: String(data.display_name || "").trim().slice(0, 40) || null,
        photo: values.photo, cover: values.cover,
        bio: String(data.bio ?? p.bio ?? "").trim().slice(0, 160) || null,
        birthday: data.birthday || null,
        hidden: Object.fromEntries(HIDEABLE.filter(key => hidden[key]).map(key => [key, true]))
      };
      if ("relation" in data) row.relation = data.relation || null;
      if ("telegram" in data) row.telegram = String(data.telegram || "").trim().replace(/^@/, "").slice(0, 40) || null;
      if ("phone" in data) row.phone = String(data.phone || "").trim().slice(0, 30) || null;
      try {
        await save(row);
        if (onDone) onDone(true);
      } catch (error) {
        const out = form.querySelector("[data-mp-err]");
        out.hidden = false; out.textContent = `⚠️ ${error.message || error}`;
        button.disabled = false;
      }
    });
  }

  function openEdit() {
    const fg = FG();
    const p = person(fg?.state?.me);
    if (!p) return;
    document.querySelector(".mp-sheet")?.remove();
    const node = document.createElement("div");
    node.className = "mp-sheet";
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-modal", "true");
    node.innerHTML = `<div class="mp-panel"><span class="mp-grab"></span><div class="mp-sheet-head"><strong>${esc(L("កែ Profile ខ្ញុំ", "Edit my profile"))}</strong><button type="button" class="mp-x" data-mp-close aria-label="${attr(L("បិទ", "Close"))}">✕</button></div>
      <p class="mp-note">${esc(L("ចុច 👪 / 🔒 ដើម្បីកំណត់ថាគ្រួសារមើលឃើញ ឬតែខ្ញុំ", "Tap 👪 / 🔒 to choose family or only me"))}</p>${formHtml(p, false)}</div>`;
    document.body.appendChild(node);
    document.body.classList.add("mp-open");
    const close = () => { node.remove(); document.body.classList.remove("mp-open"); };
    node.addEventListener("click", event => { if (event.target === node || event.target.closest("[data-mp-close]")) close(); });
    bindForm(node, p, saved => { close(); if (saved) { Toast.show(L("✅ បានរក្សាទុក Profile", "✅ Profile saved")); if (typeof App !== "undefined") App.render(); } });
  }

  // welcome flow step 2 (inside the join sheet)
  function mountSetup(container, onDone) {
    const p = person(FG()?.state?.me) || { name: appData.profile?.name || "", photo: appData.profile?.photo || "", hidden: {}, raw: {} };
    container.innerHTML = formHtml(p, true);
    bindForm(container, p, () => onDone());
  }

  return { render, bind, openEdit, mountSetup, hasMine, person, ensureMyPhoto };
})();
