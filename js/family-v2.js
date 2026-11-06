/* MYLIFE Family V2 (draft 23 Oct 2026): members as round photos → days together →
 * important dates → memories → member cards → family group → events → photos.
 * Both themes (css/family-v2.css). Same hooks as before so bindFamily() keeps
 * working: data-fam-jump, data-edit-family, data-delete-family, data-action
 * add-family / add-self / add-event, data-edit-event, [data-family-group]
 * (FamilyGroup card), data-family-media…, data-family-photo, data-family-about.
 * The old layout in family.js stays as a fallback. */
const FamilyV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const REL_KM = { Me: "ខ្ញុំ", Wife: "ប្រពន្ធ", Husband: "ប្តី", Girlfriend: "សង្សារ", Boyfriend: "សង្សារ", Mother: "ម្តាយ", Father: "ឪពុក", Daughter: "កូនស្រី", Son: "កូនប្រុស", Sister: "បងប្អូនស្រី", Brother: "បងប្អូនប្រុស", Grandmother: "យាយ", Grandfather: "តា", Friend: "មិត្តភក្តិ", Other: "ផ្សេងៗ" };
  const PARTNER = ["Wife", "Husband", "Girlfriend", "Boyfriend"];
  const COVERS = ["linear-gradient(135deg,#f6c7a7,#c98b6a)", "linear-gradient(135deg,#f2b8c6,#b57a8f)", "linear-gradient(135deg,#a9d1c3,#5d8e83)", "linear-gradient(135deg,#c7c2f2,#7e78c9)", "linear-gradient(135deg,#ffd59e,#e09a4c)", "linear-gradient(135deg,#9cc6ff,#4f86d9)"];
  const IDEA_KM = {
    Wife: "សួរសុខទុក្ខ ហើយធ្វើរឿងល្អតូចមួយ",
    Husband: "អរគុណគាត់សម្រាប់រឿងមួយដែលគាត់ធ្វើ",
    Girlfriend: "ផ្ញើសារល្អៗ ឬណាត់ជួបគ្នាបន្តិច",
    Boyfriend: "លើកទឹកចិត្ត ហើយនិយាយគ្នាសប្បាយៗ",
    Mother: "សួរសុខទុក្ខ ហើយស្តាប់គាត់",
    Father: "ទូរស័ព្ទសួរសុខទុក្ខគាត់",
    Daughter: "ឲ្យពេល និងលើកទឹកចិត្តនាង",
    Son: "សួរពីថ្ងៃរបស់គាត់ ហើយអបអរជាមួយ",
    Sister: "ផ្ញើសារកំប្លែង ឬជួយនាងមួយរឿង",
    Brother: "ណាត់ញ៉ាំ ឬលេងជាមួយគ្នា",
    Grandmother: "ទៅលេង ហើយស្តាប់រឿងគាត់",
    Grandfather: "សួរពីអនុស្សាវរីយ៍របស់គាត់",
    Friend: "ផ្ញើសារសួរសុខទុក្ខ",
    Me: "ធ្វើរឿងតូចមួយឲ្យខ្លួនឯងសប្បាយ"
  };

  const todayIso = () => localDateInput();
  const dateOf = iso => parseAppDate(iso);
  const daysUntil = iso => Math.round((dateOf(iso) - dateOf(todayIso())) / 86400000);
  const first = name => String(name || "").split(/\s+/)[0];
  const relLabel = member => (km() ? REL_KM[member.relationship] || member.relationship || "" : member.relationship || "");
  const dayMonth = iso => { const d = dateOf(iso); return km() ? `${d.getDate()} ${KM_M[d.getMonth()]}` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const coverOf = member => COVERS[Math.max(0, fam().indexOf(member)) % COVERS.length];
  const face = member => (member.photo ? `<img src="${escapeAttr(member.photo)}" alt="">` : `<span>${escapeHtml(initials(member.name || "?"))}</span>`);
  const groupState = () => (typeof FamilyGroup !== "undefined" ? FamilyGroup.state : null);
  const isGroupAdmin = () => { const s = groupState(); return Boolean(s?.family && s.members?.some(m => m.user_id === s.me && m.role === "admin")); };

  // Lavender (light, 31 Oct): Nomi in the hero, a big "days together" counter card, small date cards, compact members
  const lav = () => typeof HomeV2 !== "undefined" && !!HomeV2.buddy;
  const nomi = (mood, cls) => `<span class="${cls}" data-nomi data-mood="${mood}" role="button" tabindex="0" aria-label="Nomi">${HomeV2.buddy(mood)}</span>`;
  function dateItems() {
    const items = [];
    const seenPairs = new Set();
    fam().forEach(member => {
      if (member.birthday) {
        const next = nextBirthdayDate(member.birthday);
        if (next) {
          const age = dateOf(next).getFullYear() - dateOf(member.birthday).getFullYear();
          items.push({ date: next, icon: "🎂", kind: "bday", name: first(member.name), tone: member.relationship === "Me" || PARTNER.includes(member.relationship) ? "love" : "amber", title: L(`ថ្ងៃកំណើត ${member.name}`, `${member.name}'s birthday`), short: L(`ខួប ${first(member.name)}`, `${first(member.name)}'s bday`), sub: [dayMonth(next), age > 0 && age < 120 ? L(`អាយុ ${age}`, `turns ${age}`) : ""].filter(Boolean).join(" · "), attrs: `data-fam-jump="${escapeAttr(member.id)}"` });
        }
      }
      if (member.anniversaryDate) {
        const pair = member.relatedMemberId ? [member.id, member.relatedMemberId].sort().join(":") : member.id;
        if (seenPairs.has(pair) || seenPairs.has(`d:${member.anniversaryDate}`)) return;
        seenPairs.add(pair);
        seenPairs.add(`d:${member.anniversaryDate}`);
        const next = nextAnnualDate(member.anniversaryDate);
        const years = dateOf(next).getFullYear() - dateOf(member.anniversaryDate).getFullYear();
        items.push({ date: next, icon: "💞", kind: "anniv", tone: "love", title: L(`ខួប${years > 0 ? ` ${years} ឆ្នាំ` : ""}`, `Anniversary${years > 0 ? ` · ${years} yrs` : ""}`), short: L("ខួបអាពាហ៍", "Anniversary"), sub: dayMonth(next), attrs: `data-fam-jump="${escapeAttr(member.id)}"` });
      }
    });
    (appData.calendarEvents || []).filter(event => event.category === "Family" && event.date >= todayIso()).forEach(event => {
      items.push({ date: event.date, icon: "📅", kind: "event", tone: "blue", title: event.title, short: event.title, sub: `${dayMonth(event.date)}${event.time ? ` · ${typeof todayClock === "function" ? todayClock(event.time) : event.time}` : ""}`, attrs: `data-edit-event="${escapeAttr(event.id)}"` });
    });
    return items.filter(item => daysUntil(item.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  }
  function nomiLine() {
    const next = dateItems()[0];
    if (!next) return [L("បន្ថែមថ្ងៃកំណើត ឬខួប ខ្ញុំនឹងរំលឹកមុន 🐾", "Add birthdays or anniversaries — I'll remind you 🐾"), "happy"];
    const d = daysUntil(next.date);
    const what = next.kind === "anniv" ? L("ខួបអាពាហ៍ពិពាហ៍ 💞", "your anniversary 💞") : next.kind === "bday" ? L(`ថ្ងៃកំណើត ${next.name} 🎂`, `${next.name}'s birthday 🎂`) : next.title;
    if (d === 0) return [L(`ថ្ងៃនេះ ${what}! អបអរណា 🎉`, `Today is ${what}! Celebrate 🎉`), "cheer"];
    if (d === 1) return [L(`ស្អែក ${what} — ត្រៀមខ្លួនផង!`, `Tomorrow: ${what} — get ready!`), "cheer"];
    return [L(`នៅ ${d} ថ្ងៃទៀត ដល់${what}`, `${d} days to ${what}`), next.kind === "anniv" ? "love" : "happy"];
  }

  function hero() {
    const me = fam().find(member => member.relationship === "Me");
    const others = fam().filter(member => member !== me);
    const s = groupState();
    const groupName = s?.family?.name;
    const soon = localDateInput(new Date(Date.now() + 14 * 86400000));
    const av = (member, label, sub) => {
      const next = nextBirthdayDate(member.birthday);
      const party = next && next <= soon;
      if (lav()) {
        // Family v4: one tidy row; a pink ring + countdown when a birthday is within 60 days; tap → member sheet
        const d = next ? daysUntil(next) : -1;
        const near = d >= 0 && d <= 60;
        return `<button class="fv-av fv4-av${near ? " is-near" : ""}" type="button" data-fv-sheet="${escapeAttr(member.id)}" title="${escapeAttr(member.name || "")}"><span class="fv-ring"><span class="fv-face" style="background:${coverOf(member)}">${face(member)}</span></span><b>${escapeHtml(label)}</b>${d >= 0 ? `<small>${escapeHtml(d === 0 ? L("ថ្ងៃនេះ 🎂", "today 🎂") : L(`${d} ថ្ងៃ 🎂`, `${d} d 🎂`))}</small>` : ""}</button>`;
      }
      return `<button class="fv-av${PARTNER.includes(member.relationship) ? " is-love" : ""}${party ? " is-party" : ""}" type="button" data-fam-jump="${escapeAttr(member.id)}" title="${escapeAttr(member.name || "")}"><span class="fv-ring"><span class="fv-face" style="background:${coverOf(member)}">${face(member)}</span></span><b>${escapeHtml(label)}</b><small>${escapeHtml(sub)}</small></button>`;
    };
    return `<header class="fv-hero">
      <div class="fv-title">
        <div><h1>${escapeHtml(t("family"))}</h1><p>${escapeHtml([groupName || L("គ្រួសារខ្ញុំ", "My family"), L(`${fam().length} នាក់`, `${fam().length} people`), isGroupAdmin() ? L("អ្នកគ្រប់គ្រង", "Admin") : ""].filter(Boolean).join(" · "))}</p></div>
        <div class="fv-title-acts">${s?.family && typeof FamilyChat !== "undefined" ? FamilyChat.buttonHtml() : ""}${s?.family && !isGroupAdmin() ? "" : `<button class="fv-invite" type="button" data-fv-invite>${Icons.plus()}<span>${escapeHtml(L("អញ្ជើញ", "Invite"))}</span></button>`}</div>
      </div>
      ${lav() ? (() => { const [say, mood] = nomiLine(); return `<div class="fv-talk">${nomi(mood, "fv-nomi")}<span class="fv-say" data-nomi-say>${escapeHtml(say)}</span></div>`; })() : ""}
      <nav class="fv-avs" aria-label="${escapeAttr(t("family"))}">
        ${me ? av(me, L("ខ្ញុំ", "Me"), first(me.name)) : `<button class="fv-av is-add${lav() ? " fv4-av" : ""}" type="button" data-action="add-self"><span class="fv-ring"><span class="fv-face">${Icons.plus()}</span></span><b>${escapeHtml(L("ខ្ញុំ", "Me"))}</b><small>${escapeHtml(L("បន្ថែម", "Add"))}</small></button>`}
        ${others.map(member => av(member, first(member.name) || relLabel(member), relLabel(member))).join("")}
        ${lav() ? `<button class="fv-av fv4-av is-add" type="button" data-action="add-family"><span class="fv-ring"><span class="fv-face">${Icons.plus()}</span></span><b>${escapeHtml(L("បន្ថែម", "Add"))}</b></button>` : ""}
      </nav>
    </header>`;
  }

  // the first couple with a start date: days together, the next 1000-day mark
  function loveCard() {
    const member = fam().find(item => item.relatedMemberId && item.anniversaryDate && fam().some(other => other.id === item.relatedMemberId));
    if (!member) return "";
    const other = fam().find(item => item.id === member.relatedMemberId);
    const days = daysSinceDate(member.anniversaryDate);
    const next = Math.ceil(Math.max(days, 1) / 1000) * 1000 === days ? days + 1000 : Math.ceil(Math.max(days, 1) / 1000) * 1000;
    const progress = Math.min(100, Math.max(2, ((days - (next - 1000)) / 1000) * 100));
    const left = next - days;
    if (lav()) {
      const start = dateOf(member.anniversaryDate);
      const now = dateOf(todayIso());
      let y = now.getFullYear() - start.getFullYear();
      let mo = now.getMonth() - start.getMonth();
      let dd = now.getDate() - start.getDate();
      if (dd < 0) { mo -= 1; dd += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
      if (mo < 0) { y -= 1; mo += 12; }
      const annIso = nextAnnualDate(member.anniversaryDate);
      const annIn = daysUntil(annIso);
      const pf = m => `<span class="fv-tg-face" style="background:${coverOf(m)}">${face(m)}</span>`;
      return `<section class="fv-tg" data-fam-jump="${escapeAttr(member.id)}">
        <div class="fv-tg-top"><span class="fv-tg-pair">${pf(member)}<i>♥</i>${pf(other)}</span><small>${escapeHtml(first(member.name))} ♥ ${escapeHtml(first(other.name))}</small></div>
        ${nomi("love", "fv-tg-nomi")}
        <small class="fv-tg-lbl">${escapeHtml(L("បាននៅជាមួយគ្នា", "Together for"))}</small>
        <div class="fv-tg-n" data-fv-count="${days}">${days.toLocaleString("en-US")}<span>${escapeHtml(L("ថ្ងៃ", "days"))}</span></div>
        <div class="fv-tg-ymd">${[[y, L("ឆ្នាំ", "yrs")], [mo, L("ខែ", "mo")], [dd, L("ថ្ងៃ", "d")]].map(([n, u]) => `<span><b>${n}</b>${escapeHtml(u)}</span>`).join("")}</div>
        <div class="fv-tg-bar"><i style="width:${progress}%"></i><em style="left:${progress}%">♥</em></div>
        <div class="fv-tg-foot"><span>🎉 ${escapeHtml(L(`${left} ថ្ងៃទៀតដល់ ${next.toLocaleString("en-US")}`, `${left} days to ${next.toLocaleString("en-US")}`))}</span><span class="is-ann">💞 ${escapeHtml(annIn === 0 ? L("ខួបថ្ងៃនេះ!", "Anniversary today!") : L(`ខួប ${dayMonth(annIso)} · ${annIn} ថ្ងៃ`, `Anniv. ${dayMonth(annIso)} · ${annIn}d`))}</span></div>
      </section>`;
    }
    return `<section class="fv-love">
      <small>${escapeHtml(member.name)} ♥ ${escapeHtml(other.name)}</small>
      <b>${escapeHtml(L("បាននៅជាមួយគ្នា", "Together for"))}</b>
      <div class="fv-love-n">${days.toLocaleString("en-US")}<span>${escapeHtml(L("ថ្ងៃ", "days"))}</span></div>
      <div class="fv-love-bar"><i style="width:${progress}%"></i></div>
      <div class="fv-love-foot"><span>${escapeHtml(L(`${left} ថ្ងៃទៀតដល់ ${next.toLocaleString("en-US")} ថ្ងៃ 🎉`, `${left} days to ${next.toLocaleString("en-US")} 🎉`))}</span><span>${escapeHtml(L(`ខួប ${dayMonth(nextAnnualDate(member.anniversaryDate))}`, `Anniversary ${dayMonth(nextAnnualDate(member.anniversaryDate))}`))}</span></div>
    </section>`;
  }

  // birthdays, anniversaries (one per couple) and family events, nearest first
  function importantDates() {
    if (lav()) {
      const list = dateItems().slice(0, 6);
      const tone = { love: "#ff6f91", amber: "#e08a2e", blue: "#2f7bf5" };
      return `<section class="fv4-card fv4-dates">
        ${head("cal", "#ff6f91", L("ថ្ងៃសំខាន់ខាងមុខ", "Coming dates"), `<a class="fv4-more" href="#calendar">${escapeHtml(L("ប្រតិទិន", "Calendar"))} ›</a>`)}
        ${list.map(item => { const d = daysUntil(item.date); const c = tone[item.tone] || "#7b68ee"; return `<button class="fv4-dy" type="button" ${item.attrs.replace("data-fam-jump", "data-fv-sheet")} style="--c:${c}"><span class="fv4-de">${item.icon}</span><span class="fv4-tx"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.sub)}</small></span><span class="fv4-cd">${d === 0 ? `<b>🎉</b><small>${escapeHtml(L("ថ្ងៃនេះ", "today"))}</small>` : `<b>${d}</b><small>${escapeHtml(d === 1 ? L("ស្អែក", "tmrw") : L("ថ្ងៃទៀត", "days"))}</small>`}</span></button>`; }).join("") || `<p class="fv-empty">${escapeHtml(L("បន្ថែមថ្ងៃកំណើត ឬខួប ដើម្បីរំលឹកមុន", "Add birthdays or anniversaries to be reminded"))}</p>`}
        <button class="fv4-addrow" type="button" data-action="add-event">＋ ${escapeHtml(L("បន្ថែមថ្ងៃសំខាន់", "Add a date"))}</button>
      </section>`;
    }
    if (false) {
      const list = dateItems().slice(0, 6);
      return `<div class="fv-sec"><b>${escapeHtml(L("ថ្ងៃសំខាន់", "Important dates"))}</b><button class="fv-link" type="button" data-action="add-event">+ ${escapeHtml(L("ព្រឹត្តិការណ៍", "Event"))}</button></div>
        ${list.length ? `<div class="fv-dts">${list.map(item => { const d = daysUntil(item.date); return `<button class="fv-dt is-${item.tone}" type="button" ${item.attrs}><em>${item.icon}</em><b>${escapeHtml(item.short)}</b><small>${escapeHtml(dayMonth(item.date))}</small><strong>${d === 0 ? "🎉" : d}<span>${escapeHtml(d === 0 ? L("ថ្ងៃនេះ", "today") : d === 1 ? L("ស្អែក", "tmrw") : L("ថ្ងៃ", "days"))}</span></strong></button>`; }).join("")}</div>` : `<section class="fv-card fv-ups"><p class="fv-empty">${escapeHtml(L("បន្ថែមថ្ងៃកំណើត ឬខួប ដើម្បីរំលឹកមុន", "Add birthdays or anniversaries to be reminded"))}</p></section>`}`;
    }
    const items = [];
    const seenPairs = new Set();
    fam().forEach(member => {
      if (member.birthday) {
        const next = nextBirthdayDate(member.birthday);
        if (next) {
          const age = dateOf(next).getFullYear() - dateOf(member.birthday).getFullYear();
          items.push({ date: next, icon: "🎂", tone: member.relationship === "Me" || PARTNER.includes(member.relationship) ? "love" : "amber", title: L(`ថ្ងៃកំណើត ${member.name}`, `${member.name}'s birthday`), sub: [dayMonth(next), age > 0 && age < 120 ? L(`អាយុ ${age}`, `turns ${age}`) : ""].filter(Boolean).join(" · "), attrs: `data-fam-jump="${escapeAttr(member.id)}"` });
        }
      }
      if (member.anniversaryDate) {
        const pair = member.relatedMemberId ? [member.id, member.relatedMemberId].sort().join(":") : member.id;
        if (seenPairs.has(pair)) return;
        seenPairs.add(pair);
        const next = nextAnnualDate(member.anniversaryDate);
        const years = dateOf(next).getFullYear() - dateOf(member.anniversaryDate).getFullYear();
        items.push({ date: next, icon: "💞", tone: "love", title: L(`ខួប${years > 0 ? ` ${years} ឆ្នាំ` : ""}`, `Anniversary${years > 0 ? ` · ${years} yrs` : ""}`), sub: dayMonth(next), attrs: `data-fam-jump="${escapeAttr(member.id)}"` });
      }
    });
    (appData.calendarEvents || []).filter(event => event.category === "Family" && event.date >= todayIso()).forEach(event => {
      items.push({ date: event.date, icon: "📅", tone: "blue", title: event.title, sub: `${dayMonth(event.date)}${event.time ? ` · ${typeof todayClock === "function" ? todayClock(event.time) : event.time}` : ""}`, attrs: `data-edit-event="${escapeAttr(event.id)}"` });
    });
    const list = items.filter(item => daysUntil(item.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    const rows = list.map(item => {
      const days = daysUntil(item.date);
      return `<button class="fv-up" type="button" ${item.attrs}>
        <span class="fv-up-ic is-${item.tone}">${item.icon}</span>
        <span class="fv-up-tx"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.sub)}</small></span>
        <span class="fv-up-cd">${days === 0 ? `<b>🎉</b><small>${escapeHtml(L("ថ្ងៃនេះ", "today"))}</small>` : `<b>${days}</b><small>${escapeHtml(days === 1 ? L("ស្អែក", "tomorrow") : L("ថ្ងៃទៀត", "days"))}</small>`}</span>
      </button>`;
    }).join("");
    return `<div class="fv-sec"><b>${escapeHtml(L("ថ្ងៃសំខាន់ខាងមុខ", "Important dates"))}</b><button class="fv-link" type="button" data-action="add-event">+ ${escapeHtml(L("ព្រឹត្តិការណ៍", "Event"))}</button></div>
      <section class="fv-card fv-ups">${rows || `<p class="fv-empty">${escapeHtml(L("បន្ថែមថ្ងៃកំណើត ឬខួប ដើម្បីរំលឹកមុន", "Add birthdays or anniversaries to be reminded"))}</p>`}</section>`;
  }

  function idea(member) {
    if (km()) return IDEA_KM[member.relationship] || "បង្ហាញថាគាត់សំខាន់សម្រាប់អ្នក";
    return familyCareIdea({ ...member, favorite: "" }).replace(/^[^:]*:\s*/, "");
  }

  function memberCard(member) {
    const related = fam().find(item => item.id === member.relatedMemberId);
    const tel = member.phone ? String(member.phone).replace(/[^\d+]/g, "") : "";
    const sign = member.zodiacSign || "";
    const mood = member.characterMood ? (km() ? ({ Happy: "សប្បាយ", Calm: "ស្ងប់", Cheerful: "រីករាយ", Funny: "កំប្លែង", Caring: "យកចិត្តទុកដាក់", Quiet: "ស្ងៀម", Creative: "ច្នៃប្រឌិត", Energetic: "ស្វាហាប់", Sensitive: "រសើប", Serious: "ម៉ឺងម៉ាត់", Adventurous: "ចូលចិត្តផ្សងព្រេង" }[member.characterMood] || member.characterMood) : member.characterMood) : "";
    const ZODIAC = { Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓" };
    const tags = [sign && `${ZODIAC[sign] || "✨"} ${sign}`, mood && `😊 ${mood}`, member.favorite && `❤️ ${member.favorite}`].filter(Boolean);
    const facts = [];
    const missing = [];
    if (member.birthday) facts.push([L("ថ្ងៃកំណើត", "Birthday"), dayMonth(member.birthday)]); else missing.push(L("ថ្ងៃកំណើត", "Birthday"));
    if (member.anniversaryDate) facts.push([L("ខួប", "Anniversary"), dayMonth(member.anniversaryDate)]); else if (PARTNER.includes(member.relationship)) missing.push(L("ខួប", "Anniversary"));
    if (member.phone) facts.push([L("ទូរស័ព្ទ", "Phone"), String(member.phone).replace(/^(\d{3})(\d{3})(\d{3,4})$/, "$1 $2 $3")]); else missing.push(L("លេខទូរស័ព្ទ", "Phone"));
    const notes = [member.relationshipNote, member.notes].filter(Boolean);
    if (lav()) {
      const sub = [relLabel(member), related ? related.name : "", member.birthday ? L(`ខួប ${dayMonth(member.birthday)}`, `Bday ${dayMonth(member.birthday)}`) : ""].filter(Boolean).join(" · ");
      return `<article class="fv-member is-lav" id="family-member-${escapeAttr(member.id || "")}">
        <div class="fv-mrow">
          <span class="fv-mface" style="background:${coverOf(member)}">${face(member)}</span>
          <div class="fv-mname"><b>${escapeHtml(member.name || "")}</b><small>${escapeHtml(sub)}</small></div>
          ${tel ? `<a class="fv-call" href="tel:${escapeAttr(tel)}" aria-label="${escapeAttr(L(`ហៅទៅ ${member.name}`, `Call ${member.name}`))}">📞</a>` : ""}
          <button class="fv-mbtn" type="button" data-edit-family="${escapeAttr(member.id)}" aria-label="${escapeAttr(L(`កែ ${member.name}`, `Edit ${member.name}`))}">${Icons.edit()}</button>
          <button class="fv-mbtn" type="button" data-delete-family="${escapeAttr(member.id)}" aria-label="${escapeAttr(L(`លុប ${member.name}`, `Delete ${member.name}`))}">${Icons.trash()}</button>
        </div>
        ${tags.length ? `<div class="fv-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        ${missing.length ? `<div class="fv-missing">${missing.map(label => `<button type="button" data-edit-family="${escapeAttr(member.id)}">+ ${escapeHtml(label)}</button>`).join("")}</div>` : ""}
        <button class="fv-idea fv-tip" type="button" data-family-about aria-expanded="false"><span class="fv-tip-row"><span class="fv-tip-nomi">${HomeV2.buddy("happy")}</span><span class="fv-tip-tx">${escapeHtml(idea(member))}</span>${notes.length ? `<span class="fv-tip-more">${escapeHtml(L(`ចំណាំ ${notes.length}`, `${notes.length} notes`))} ›</span>` : ""}</span>${notes.map(note => `<span class="fv-note">📝 ${escapeHtml(note)}</span>`).join("")}</button>
      </article>`;
    }
    return `<article class="fv-member" id="family-member-${escapeAttr(member.id || "")}">
      <div class="fv-cover" style="background:${coverOf(member)}">${member.photo ? `<img src="${escapeAttr(member.photo)}" alt="">` : ""}
        <span class="fv-tools"><button type="button" data-edit-family="${escapeAttr(member.id)}" aria-label="${escapeAttr(L(`កែ ${member.name}`, `Edit ${member.name}`))}">${Icons.edit()}</button><button type="button" data-delete-family="${escapeAttr(member.id)}" aria-label="${escapeAttr(L(`លុប ${member.name}`, `Delete ${member.name}`))}">${Icons.trash()}</button></span>
      </div>
      <div class="fv-mrow">
        <span class="fv-mface" style="background:${coverOf(member)}">${face(member)}</span>
        <div class="fv-mname"><b>${escapeHtml(member.name || "")}</b><small>${escapeHtml([relLabel(member), related ? related.name : ""].filter(Boolean).join(" · "))}</small></div>
        ${tel ? `<a class="fv-call" href="tel:${escapeAttr(tel)}" aria-label="${escapeAttr(L(`ហៅទៅ ${member.name}`, `Call ${member.name}`))}">📞</a>` : ""}
      </div>
      ${tags.length ? `<div class="fv-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      ${facts.length ? `<div class="fv-facts" style="--n:${facts.length}">${facts.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></div>`).join("")}</div>` : ""}
      ${missing.length ? `<div class="fv-missing">${missing.map(label => `<button type="button" data-edit-family="${escapeAttr(member.id)}">+ ${escapeHtml(label)}</button>`).join("")}</div>` : ""}
      <button class="fv-idea" type="button" data-family-about aria-expanded="false"><span>💡 ${escapeHtml(idea(member))}</span>${notes.map(note => `<span class="fv-note">📝 ${escapeHtml(note)}</span>`).join("")}</button>
    </article>`;
  }

  // the days-together number counts up when the page opens
  function countUp() {
    const el = document.querySelector(".fv-tg-n[data-fv-count]");
    if (!el || el.dataset.done) return;
    el.dataset.done = "1";
    const end = Number(el.dataset.fvCount) || 0;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || end < 10) return;
    const unit = el.querySelector("span")?.outerHTML || "";
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 1200);
      el.innerHTML = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString("en-US") + unit;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Family v4 (6 Nov 2026, approved draft) ---------- */
  const FI = {
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3" fill="currentColor" fill-opacity=".2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor" fill-opacity=".2"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" fill="currentColor" fill-opacity=".2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" fill="currentColor" fill-opacity=".18"/></svg>',
    msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="currentColor" fill-opacity=".18"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" fill="currentColor" fill-opacity=".18"/></svg>'
  };
  const head = (icon, color, title, link = "") => `<div class="fv4-ch"><span class="fv4-gi" style="--c:${color}">${FI[icon]}</span><h2>${escapeHtml(title)}</h2>${link}</div>`;
  const telOf = member => (member?.phone ? String(member.phone).replace(/[^\d+]/g, "") : "");
  const loveText = () => L("គិតដល់ណា 💜 ថ្ងៃនេះសុខសប្បាយទេ?", "Thinking of you 💜 How is your day?");
  function lastCallText(member) {
    if (!member.lastCallAt) return "";
    const d = Math.max(0, Math.round((dateOf(todayIso()) - dateOf(String(member.lastCallAt).slice(0, 10))) / 86400000));
    const when = d === 0 ? L("ហៅថ្ងៃនេះ", "called today") : d === 1 ? L("ហៅម្សិលមិញ", "called yesterday") : L(`ហៅចុងក្រោយ ${d} ថ្ងៃមុន`, `last call ${d} days ago`);
    return d >= 10 ? `${when} · ${L("យូរហើយ 💜", "it's been a while 💜")}` : when;
  }
  // call / message / love buttons for one member (no phone: call and message add the number)
  function careButtons(member) {
    const tel = telOf(member);
    const id = escapeAttr(member.id);
    const call = tel ? `<a class="fv4-act is-call" href="tel:${escapeAttr(tel)}" data-fv-called="${id}" aria-label="${escapeAttr(L(`ហៅទៅ ${member.name}`, `Call ${member.name}`))}">${FI.phone}</a>` : `<button class="fv4-act is-call is-off" type="button" data-fv-edit="${id}" aria-label="${escapeAttr(L("បន្ថែមលេខទូរស័ព្ទ", "Add phone"))}">${FI.phone}</button>`;
    const sms = tel ? `<a class="fv4-act is-msg" href="sms:${escapeAttr(tel)}" aria-label="${escapeAttr(L(`ផ្ញើសារទៅ ${member.name}`, `Message ${member.name}`))}">${FI.msg}</a>` : `<button class="fv4-act is-msg is-off" type="button" data-fv-edit="${id}" aria-label="${escapeAttr(L("បន្ថែមលេខទូរស័ព្ទ", "Add phone"))}">${FI.msg}</button>`;
    const love = tel ? `<a class="fv4-act is-love" href="sms:${escapeAttr(tel)}?&body=${encodeURIComponent(loveText())}" aria-label="${escapeAttr(L("ផ្ញើក្តីស្រឡាញ់", "Send love"))}">${FI.heart}</a>` : `<button class="fv4-act is-love" type="button" data-fv-sheet="${id}" aria-label="${escapeAttr(L("ផ្ញើក្តីស្រឡាញ់", "Send love"))}">${FI.heart}</button>`;
    return `${call}${sms}${love}`;
  }
  // "Stay close": everyone except me, one row each
  function closeCard() {
    const list = fam().filter(member => member.relationship !== "Me");
    if (!list.length) return "";
    return `<section class="fv4-card fv4-close">
      ${head("heart", "#1f9d74", L("នៅជិតគ្នា", "Stay close"), `<button class="fv4-more" type="button" data-action="add-family">＋ ${escapeHtml(L("បន្ថែម", "Add"))}</button>`)}
      ${list.map(member => {
        const sub = lastCallText(member) || (telOf(member) ? [relLabel(member), idea(member)].filter(Boolean).join(" · ") : L("មិនទាន់មានលេខទូរស័ព្ទ", "No phone number yet"));
        return `<div class="fv4-cl" id="family-member-${escapeAttr(member.id)}"><button class="fv4-who" type="button" data-fv-sheet="${escapeAttr(member.id)}"><span class="fv4-face" style="background:${coverOf(member)}">${face(member)}</span><span class="fv4-tx"><b>${escapeHtml(member.name || "")}</b><small>${escapeHtml(sub)}</small></span></button><span class="fv4-acts">${careButtons(member)}</span></div>`;
      }).join("")}
    </section>`;
  }
  function memoriesCard() {
    return `<section class="fv4-card fv4-mem">
      ${head("photo", "#e08a2e", L("អនុស្សាវរីយ៍គ្រួសារ", "Family memories"), `<a class="fv4-more" href="#memories">${escapeHtml(L("ទាំងអស់", "All"))} ›</a>`)}
      ${typeof MemoryFeed !== "undefined" ? MemoryFeed.familyTeaser() : ""}
      <details class="fv-media-fold fv4-fold">
        <summary><b>📷 ${escapeHtml(L("រូបភាព និងវីដេអូគ្រួសារ", "Family photos & videos"))}</b><span>${escapeHtml(L("បើក", "Open"))} ›</span></summary>
        ${familyMediaCard()}
        ${familyPhotoCard()}
      </details>
    </section>`;
  }
  // member sheet: big face, call / message / love, details, edit · delete
  function openSheet(id) {
    const member = appData.family.find(item => item.id === id);
    const root = document.getElementById("modalRoot");
    if (!member || !root) return;
    if (typeof Modal !== "undefined" && Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    const next = nextBirthdayDate(member.birthday);
    const d = next ? daysUntil(next) : -1;
    const related = appData.family.find(item => item.id === member.relatedMemberId);
    const ZODIAC = { Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓" };
    const tags = [member.zodiacSign && `${ZODIAC[member.zodiacSign] || "✨"} ${member.zodiacSign}`, member.favorite && `❤️ ${member.favorite}`].filter(Boolean);
    const notes = [member.relationshipNote, member.notes].filter(Boolean);
    const rows = [
      [L("លេខទូរស័ព្ទ", "Phone"), member.phone ? escapeHtml(String(member.phone)) : `<button type="button" class="fv4-link" data-fv-edit="${escapeAttr(member.id)}">+ ${escapeHtml(L("បន្ថែម", "Add"))}</button>`, !member.phone],
      [L("ថ្ងៃកំណើត", "Birthday"), member.birthday ? escapeHtml(dayMonth(member.birthday)) : `<button type="button" class="fv4-link" data-fv-edit="${escapeAttr(member.id)}">+ ${escapeHtml(L("បន្ថែម", "Add"))}</button>`, !member.birthday],
      [L("ទំនាក់ទំនង", "Relationship"), escapeHtml([relLabel(member), related ? related.name : ""].filter(Boolean).join(" · ") || "—"), true],
      member.anniversaryDate ? [L("ខួប", "Anniversary"), escapeHtml(dayMonth(member.anniversaryDate)), true] : null,
      member.lastCallAt ? [L("ហៅចុងក្រោយ", "Last call"), escapeHtml(lastCallText(member)), true] : null
    ].filter(Boolean);
    root.innerHTML = `<div class="modal glass-card fv4-sheet" id="modalForm" role="dialog" aria-modal="true" aria-label="${escapeAttr(member.name || "")}">
      <span class="fv4-grab" aria-hidden="true"></span>
      <button class="icon-button fv4-x" type="button" data-close aria-label="${escapeAttr(t("close"))}">${Icons.close()}</button>
      <div class="fv4-sh"><span class="fv4-face is-big" style="background:${coverOf(member)}">${face(member)}</span><span><h3>${escapeHtml(member.name || "")}</h3><small>${escapeHtml(d >= 0 ? (d === 0 ? L("🎂 ថ្ងៃកំណើតថ្ងៃនេះ!", "🎂 Birthday today!") : L(`🎂 ខួប ${dayMonth(next)} · នៅ ${d} ថ្ងៃ`, `🎂 ${dayMonth(next)} · in ${d} days`)) : relLabel(member))}</small></span></div>
      <div class="fv4-big">${careButtons(member)}</div>
      <p class="fv4-idea">💡 ${escapeHtml(idea(member))}</p>
      <div class="fv4-info">${rows.map(([k, v]) => `<div><span>${escapeHtml(k)}</span><b>${v}</b></div>`).join("")}</div>
      ${tags.length ? `<div class="fv-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      ${notes.map(note => `<p class="fv4-note">📝 ${escapeHtml(note)}</p>`).join("")}
      ${member.userId ? `<a class="fv4-profile" href="#profile/${escapeAttr(member.userId)}" data-fv-profile>👤 ${escapeHtml(L("មើល Profile", "View profile"))} ›</a>` : ""}
      <div class="fv4-two"><button type="button" class="fv4-edit" data-fv-edit="${escapeAttr(member.id)}">${FI.edit} ${escapeHtml(L("កែព័ត៌មាន", "Edit"))}</button><button type="button" class="fv4-del" data-fv-delete="${escapeAttr(member.id)}">${escapeHtml(L("លុបចេញ", "Remove"))}</button></div>
    </div>`;
    root.classList.add("open");
    if (typeof Modal !== "undefined") {
      Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
      document.addEventListener("keydown", Modal.escapeHandler);
    }
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));
  }

  // a new member with no family cards of their own (6 Nov): show the family group's
  // accounts instead (from their profiles), read-only; tapping someone opens their profile
  let virtual = false, virtualList = [];
  function accountPeople() {
    const s = groupState();
    if (!s || s.status !== "ready") return [];
    return (s.members || []).map(m => {
      const p = s.profiles?.[m.user_id] || {};
      return { id: `acct-${m.user_id}`, userId: m.user_id, virtual: true, name: p.display_name || m.display_name || "", photo: p.photo || "",
        birthday: p.birthday || "", phone: p.phone || "", relationship: m.user_id === s.me ? "Me" : "Other" };
    });
  }
  function fam() { return virtual ? virtualList : appData.family; }
  function canShowGroup() {
    const s = groupState();
    return lav() && !appData.family.length && s?.status === "ready" && (s.members || []).length > 1;
  }

  function render() {
    virtual = canShowGroup();
    virtualList = virtual ? accountPeople() : [];
    if (lav()) requestAnimationFrame(countUp);
    return `<section class="page family-page fam2${lav() ? " is-lav" : ""}">
      ${hero()}
      ${lav() ? `<div class="fv-body fv4">
        ${loveCard()}
        ${importantDates()}
        ${closeCard()}
        ${memoriesCard()}
        <div class="fv-group" data-family-group></div>
      </div>` : `<div class="fv-body">
        ${loveCard()}
        ${importantDates()}
        ${typeof MemoryFeed !== "undefined" ? MemoryFeed.familyTeaser() : ""}
        <section class="fv-members-panel">
          <div class="fv-members-head"><b>👥 ${escapeHtml(L("សមាជិក", "Members"))}<small>${appData.family.length}</small></b><button class="fv-add-member" type="button" data-action="add-family"><span>＋</span>${escapeHtml(L("បន្ថែម", "Add"))}</button></div>
          <div class="fv-members-list">${appData.family.length ? appData.family.map(memberCard).join("") : `<p class="fv-empty">${escapeHtml(L("មិនទាន់មានសមាជិក", "No members yet"))}</p>`}</div>
        </section>
        <div class="fv-group" data-family-group></div>
        <details class="fv-media-fold">
          <summary><b>📷 ${escapeHtml(L("រូបភាព និងវីដេអូគ្រួសារ", "Family photos & videos"))}</b><span>${escapeHtml(L("បើក", "Open"))} ›</span></summary>
          ${familyMediaCard()}
          ${familyPhotoCard()}
        </details>
      </div>`}
    </section>`;
  }

  document.addEventListener("click", event => {
    const acct = event.target.closest('[data-fv-sheet^="acct-"], [data-fv-edit^="acct-"]');
    if (acct) { event.preventDefault(); location.hash = `#profile/${(acct.dataset.fvSheet || acct.dataset.fvEdit).slice(5)}`; return; }
    const sheet = event.target.closest("[data-fv-sheet]");
    if (sheet) { event.preventDefault(); openSheet(sheet.dataset.fvSheet); return; }
    if (event.target.closest("[data-fv-profile]") && typeof Modal !== "undefined") { Modal.close(); return; }
    const edit = event.target.closest("[data-fv-edit]");
    if (edit) {
      const member = appData.family.find(item => item.id === edit.dataset.fvEdit);
      if (typeof Modal !== "undefined") Modal.close();
      if (member && typeof openFamilyModal === "function") setTimeout(() => openFamilyModal(member), 60);
      return;
    }
    const del = event.target.closest("[data-fv-delete]");
    if (del) {
      const id = del.dataset.fvDelete;
      Modal.close();
      setTimeout(() => Modal.confirm({ title: t("deleteFamilyMember"), message: t("deleteFamilyMessage"), confirmText: t("delete"), onConfirm: () => { Store.delete("family", id); Toast.show(t("familyMemberDeleted")); } }), 60);
      return;
    }
    // tapping Call remembers the day, so "Stay close" can say when you last called (no page redraw)
    const called = event.target.closest("[data-fv-called]");
    if (called) {
      const member = appData.family.find(item => item.id === called.dataset.fvCalled);
      if (member) { member.lastCallAt = todayIso(); try { Store.save(); } catch (error) { /* call still goes */ } }
      return;
    }
    if (!event.target.closest("[data-fv-invite]")) return;
    // admin of a family group: invite link; otherwise add a member to my list
    if (isGroupAdmin() && typeof FamilyGroup.openInvite === "function") FamilyGroup.openInvite();
    else if (typeof openFamilyModal === "function") openFamilyModal();
  });

  return { render, canShowGroup };
})();
