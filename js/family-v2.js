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
  const coverOf = member => COVERS[Math.max(0, appData.family.indexOf(member)) % COVERS.length];
  const face = member => (member.photo ? `<img src="${escapeAttr(member.photo)}" alt="">` : `<span>${escapeHtml(initials(member.name || "?"))}</span>`);
  const groupState = () => (typeof FamilyGroup !== "undefined" ? FamilyGroup.state : null);
  const isGroupAdmin = () => { const s = groupState(); return Boolean(s?.family && s.members?.some(m => m.user_id === s.me && m.role === "admin")); };

  function hero() {
    const me = appData.family.find(member => member.relationship === "Me");
    const others = appData.family.filter(member => member !== me);
    const s = groupState();
    const groupName = s?.family?.name;
    const soon = localDateInput(new Date(Date.now() + 14 * 86400000));
    const av = (member, label, sub) => {
      const next = nextBirthdayDate(member.birthday);
      const party = next && next <= soon;
      return `<button class="fv-av${PARTNER.includes(member.relationship) ? " is-love" : ""}${party ? " is-party" : ""}" type="button" data-fam-jump="${escapeAttr(member.id)}" title="${escapeAttr(member.name || "")}"><span class="fv-ring"><span class="fv-face" style="background:${coverOf(member)}">${face(member)}</span></span><b>${escapeHtml(label)}</b><small>${escapeHtml(sub)}</small></button>`;
    };
    return `<header class="fv-hero">
      <div class="fv-title">
        <div><h1>${escapeHtml(t("family"))}</h1><p>${escapeHtml([groupName || L("គ្រួសារខ្ញុំ", "My family"), L(`${appData.family.length} នាក់`, `${appData.family.length} people`), isGroupAdmin() ? L("អ្នកគ្រប់គ្រង", "Admin") : ""].filter(Boolean).join(" · "))}</p></div>
        <button class="fv-invite" type="button" data-fv-invite>${Icons.plus()}<span>${escapeHtml(L("អញ្ជើញ", "Invite"))}</span></button>
      </div>
      <nav class="fv-avs" aria-label="${escapeAttr(t("family"))}">
        ${me ? av(me, L("ខ្ញុំ", "Me"), first(me.name)) : `<button class="fv-av is-add" type="button" data-action="add-self"><span class="fv-ring"><span class="fv-face">${Icons.plus()}</span></span><b>${escapeHtml(L("ខ្ញុំ", "Me"))}</b><small>${escapeHtml(L("បន្ថែម", "Add"))}</small></button>`}
        ${others.map(member => av(member, first(member.name) || relLabel(member), relLabel(member))).join("")}
        <button class="fv-av is-add" type="button" data-action="add-family"><span class="fv-ring"><span class="fv-face">${Icons.plus()}</span></span><b>${escapeHtml(L("បន្ថែម", "Add"))}</b><small>${escapeHtml(L("សមាជិក", "member"))}</small></button>
      </nav>
    </header>`;
  }

  // the first couple with a start date: days together, the next 1000-day mark
  function loveCard() {
    const member = appData.family.find(item => item.relatedMemberId && item.anniversaryDate && appData.family.some(other => other.id === item.relatedMemberId));
    if (!member) return "";
    const other = appData.family.find(item => item.id === member.relatedMemberId);
    const days = daysSinceDate(member.anniversaryDate);
    const next = Math.ceil(Math.max(days, 1) / 1000) * 1000 === days ? days + 1000 : Math.ceil(Math.max(days, 1) / 1000) * 1000;
    const progress = Math.min(100, Math.max(2, ((days - (next - 1000)) / 1000) * 100));
    const left = next - days;
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
    const items = [];
    const seenPairs = new Set();
    appData.family.forEach(member => {
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
    const related = appData.family.find(item => item.id === member.relatedMemberId);
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

  function render() {
    return `<section class="page family-page fam2">
      ${hero()}
      <div class="fv-body">
        ${loveCard()}
        ${importantDates()}
        ${typeof MemoryFeed !== "undefined" ? MemoryFeed.familyTeaser() : ""}
        <div class="fv-sec"><b>${escapeHtml(L("សមាជិក", "Members"))}</b><button class="fv-link" type="button" data-action="add-family">+ ${escapeHtml(L("បន្ថែម", "Add"))}</button></div>
        ${appData.family.map(memberCard).join("")}
        <div class="fv-sec"><b>${escapeHtml(L("ក្រុមគ្រួសារ", "Family group"))}</b></div>
        <div class="fv-group" data-family-group></div>
        ${familyMediaCard()}
        ${familyPhotoCard()}
      </div>
    </section>`;
  }

  document.addEventListener("click", event => {
    if (!event.target.closest("[data-fv-invite]")) return;
    // admin of a family group: invite link; otherwise add a member to my list
    if (isGroupAdmin() && typeof FamilyGroup.openInvite === "function") FamilyGroup.openInvite();
    else if (typeof openFamilyModal === "function") openFamilyModal();
  });

  return { render };
})();
