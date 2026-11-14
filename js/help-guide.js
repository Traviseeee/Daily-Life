// Help guide (12 Nov 2026): a launcher banner, topics with sample UI on the Help page, and a "?" next to page titles.
const HelpGuide = (() => {
  const km = () => (typeof languageCode === "function" ? languageCode() === "km" : true);
  const L = (kh, en) => (km() ? kh : en);
  const esc = value => (typeof escapeHtml === "function" ? escapeHtml(value) : String(value).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]));
  const row = (inner, extra = "") => `<div class="hg-row ${extra}">${inner}</div>`;
  const ex = (title, inner) => `<div class="hg-ex" aria-hidden="true"><em>${esc(title)}</em>${inner}</div>`;
  const sw = on => `<span class="hg-sw${on ? " on" : ""}"></span>`;

  const GROUPS = [["all", "ទាំងអស់", "All"], ["start", "ចាប់ផ្តើម", "Start"], ["money", "លុយ", "Money"], ["family", "គ្រួសារ", "Family"], ["tools", "ឧបករណ៍", "Tools"]];

  // id, groups, area ("?" button page), icon, title, sub, steps, note, example
  const TOPICS = () => [
    { id: "family-invite", g: "family", area: "family", icon: "💞", t: L("អញ្ជើញ Lychee ចូល app", "Invite Lychee"), s: L("ភ្ជាប់គណនីនាង ជាមួយកាតក្នុងគ្រួសារ", "Link her account to her family card"),
      steps: [L("គ្រួសារ ➜ ប៊ូតុង “អញ្ជើញ” ➜ ចម្លង link", "Family ➜ Invite ➜ copy the link"), L("ផ្ញើ link ទៅនាង ហើយនាងចុចចូល", "Send her the link; she opens it"), L("កាតនាងភ្ជាប់ដោយស្វ័យប្រវត្តិ (ឈ្មោះដូចគ្នា) ឬអ្នកជ្រើសកាតដោយដៃ", "Her card links by the same name, or pick the card yourself")],
      note: L("កាតភ្ជាប់ហើយ បង្ហាញរូប លេខទូរស័ព្ទ និងថ្ងៃកំណើតពី profile របស់នាង។", "A linked card shows her photo, phone and birthday from her profile."),
      ex: ex(L("ឧទាហរណ៍ · ទំព័រគ្រួសារ", "Example · Family page"), row(`<span>🐱</span><span><b>Lychee</b><br><small>${L("ភ្ជាប់ជាមួយគណនី", "Linked to an account")}</small></span><span class="hg-pill">${L("បានភ្ជាប់", "Linked")}</span>`) + row(`<b>🔗 ${L("link អញ្ជើញ", "Invite link")}</b><span class="hg-btn">${L("ចម្លង", "Copy")}</span>`)) },
    { id: "family-perms", g: "family", area: "family", icon: "🔐", t: L("សិទ្ធិ៖ អ្វីដែលនាងឃើញ", "Access: what she sees"), s: L("ចុចលើសមាជិក ➜ សិទ្ធិ", "Tap a member ➜ Role & access"),
      steps: [L("បើក switch ផ្នែកណាដែលចង់ឲ្យនាងឃើញ៖ លុយ, វិក្កយបត្រ, សន្សំ, ព្រឹត្តិការណ៍ផ្ទាល់ខ្លួន", "Turn on the parts she may see: money, bills, savings, my events"), L("ប៊ូតុង “✨ អនុញ្ញាតទាំងអស់” បើកគ្រប់យ៉ាងតែម្តង", "“✨ Allow everything” turns all on at once"), L("បិទវិញពេលណាក៏បាន ហើយនាងឈប់ឃើញភ្លាម", "Turn off any time and she stops seeing it")],
      note: L("ផ្នែកឯកជនបិទជាស្រេច ហើយនាងមើលបានតែប៉ុណ្ណោះ មិនអាចកែទិន្នន័យអ្នកទេ។", "Private parts start off, and she can only view, never edit, your data."), warn: true,
      ex: ex(L("ឧទាហរណ៍ · សិទ្ធិរបស់ Lychee", "Example · Lychee's access"), row(`<b>✨ ${L("អនុញ្ញាតទាំងអស់", "Allow everything")}</b>${sw(true)}`) + row(`<b>${L("លុយ", "Money")}</b>${sw(true)}`) + row(`<b>${L("វិក្កយបត្រ", "Bills")}</b>${sw(false)}`) + row(`<b>${L("សន្សំ", "Savings")}</b>${sw(true)}`)) },
    { id: "family-joint", g: "family money", area: "money", icon: "🏦", t: L("គណនីសន្សំរួម (Joint)", "Joint savings account"), s: L("ចែកជានិច្ចជាមួយម្ចាស់រួម", "Always shared with the co-owner"),
      steps: [L("នាងឃើញគណនីរួមក្នុងបញ្ជីរបស់នាង", "She sees the joint account in her own list"), L("នាងចុចធីកខែដែលបានដាក់ ➜ ក្លាយជាកំណត់ត្រា", "She ticks a month she paid ➜ it becomes a note"), L("app របស់អ្នកអនុវត្តកំណត់ត្រានោះចូលគណនីពិតពេលបើក", "Your app applies the note to the real account when opened")],
      ex: ex(L("ឧទាហរណ៍ · គណនីរួម", "Example · Joint account"), row(`<b>🏦 ${L("សន្សំជាមួយ Lychee", "Savings with Lychee")}</b><span class="hg-pill">${L("រួម", "Joint")}</span>`) + `<div class="hg-bar"><i style="width:62%"></i></div>` + row(`<small>${L("ខែវិច្ឆិកា", "November")}</small><span class="sp"><b>$150</b> ✓</span>`)) },
    { id: "family-memories", g: "family", area: "memories", icon: "🖼️", t: L("Memories ចែកជាមួយគ្រួសារ", "Share Memories with family"), s: L("Post ថ្មីចែកស្វ័យប្រវត្តិ", "New posts share automatically"),
      steps: [L("Post រូបនៅ Memories ➜ គ្រួសារឃើញដោយស្វ័យប្រវត្តិ", "Post a photo in Memories ➜ the family sees it"), L("ដក “ចែករំលែកជាមួយគ្រួសារ” ចេញ ដើម្បីទុក post នោះជាឯកជន", "Turn off “Share with family” to keep a post private"), L("ដាក់ឈ្មោះសមាជិកក្នុង “មនុស្សក្នុងរូប”", "Tag people in “Who is in the photo”")],
      ex: ex(L("ឧទាហរណ៍ · ពេល post", "Example · New post"), row(`<b>${L("មនុស្សក្នុងរូប", "In the photo")}</b><span class="hg-pill">Chin Chetra</span><span class="hg-pill pk">Lychee</span>`) + row(`<b>${L("ចែករំលែកជាមួយគ្រួសារ", "Share with family")}</b>${sw(true)}`)) },
    { id: "couple", g: "family", area: "family", icon: "💗", t: L("ថ្ងៃស្នេហារួម", "Shared love date"), s: L("ថ្ងៃដូចគ្នាលើទូរស័ព្ទទាំងពីរ", "The same date on both phones"),
      steps: [L("កាតមួយក្នុងគូ ដាក់ “ថ្ងៃចាប់ផ្តើមស្នេហា”", "Put the “together since” date on one card of the couple"), L("ភ្ជាប់កាតទាំងពីរជាមួយគណនី ហើយទូរស័ព្ទទាំងពីរបង្ហាញថ្ងៃដូចគ្នា", "Link both cards to accounts and both phones show the same date")] },
    { id: "money-record", g: "money start", area: "money", icon: "💰", t: L("កត់លុយ និងមើលតាមខែ", "Record money, view by month"), s: L("ចំណូល ចំណាយ និងសល់ក្នុងខែ", "Income, spending and what is left"),
      steps: [L("លុយ ➜ ប៊ូតុង + ➜ កត់ចំណូល ឬចំណាយ", "Money ➜ + ➜ add income or an expense"), L("ព្រួញ ‹ › ប្តូរខែ ហើយកាតបង្ហាញលទ្ធផលខែនោះ", "‹ › changes the month and the card follows"), L("លុយ ➜ របាយការណ៍ ➜ នាំចេញ Excel", "Money ➜ Reports ➜ export to Excel")],
      ex: ex(L("ឧទាហរណ៍ · កាតខែ", "Example · Month card"), row(`<span><small>${L("នៅសល់សម្រាប់ចាយ", "Left to spend")}</small><br><b style="font-size:1.05rem">$420.00</b></span><span class="hg-btn">+ ${L("កត់", "Add")}</span>`) + `<div class="hg-bar"><i style="width:38%"></i></div>`) },
    { id: "calendar-add", g: "start", area: "calendar", icon: "📅", t: L("ប្រតិទិន និងការរំលឹក", "Calendar and reminders"), s: L("ព្រឹត្តិការណ៍ ថ្ងៃកំណើត វិក្កយបត្រ", "Events, birthdays and bills"),
      steps: [L("ប្រតិទិន ➜ ប៊ូតុង + ➜ ដាក់ឈ្មោះ ថ្ងៃ និងម៉ោង", "Calendar ➜ + ➜ name, day and time"), L("រឿងថ្ងៃនេះ និងថ្ងៃខាងមុខ បង្ហាញនៅ Home និង Launcher", "Today and upcoming items show on Home and the Launcher"), L("ព្រឹត្តិការណ៍ដែលអ្នកចែក Lychee ឃើញក្នុងប្រតិទិននាង", "Events you share appear in Lychee's calendar")] },
    { id: "goals", g: "start", area: "goals", icon: "🎯", t: L("គោលដៅ", "Goals"), s: L("តាមដានអ្វីដែលចង់សម្រេច", "Track what you want to reach"),
      steps: [L("គោលដៅ ➜ បន្ថែមគោលដៅថ្មី", "Goals ➜ add a goal"), L("ធ្វើបច្ចុប្បន្នភាពវឌ្ឍនភាពជាបណ្តើរៗ", "Update the progress as you go")] },
    { id: "chat-telegram", g: "tools start", area: "", icon: "✨", t: L("MYLIFE Chat និង Telegram", "MYLIFE Chat and Telegram"), s: L("សួរ ឬកត់ជាភាសាខ្មែរ", "Ask or record in Khmer"),
      steps: [L("ប៊ូតុង ✨ លើ header ➜ វាយ “ខែនេះចាយប៉ុន្មាន?”", "✨ in the header ➜ type “How much did I spend this month?”"), L("Telegram bot ➜ ផ្ញើ /today ឬ /help", "Telegram bot ➜ send /today or /help")],
      ex: ex("MYLIFE Chat", `<div class="hg-me">${L("ខែនេះចាយប៉ុន្មាន?", "Spent this month?")}</div><div class="hg-say">${L("ខែនេះចាយបាន $312 នៅសល់ $420 ✨", "You spent $312 and have $420 left ✨")}</div>`) }
  ];

  const AREAS_FN = () => ({ family: ["family", L("គ្រួសារ", "Family")], money: ["money-record", L("លុយ", "Money")], calendar: ["calendar-add", L("ប្រតិទិន", "Calendar")], memories: ["family-memories", L("Memories", "Memories")], goals: ["goals", L("គោលដៅ", "Goals")] });

  const topicHtml = (topic, open) => `<details class="hg-acc" data-hg-id="${topic.id}" data-hg-g="${topic.g}"${open ? " open" : ""}>
      <summary><i>${topic.icon}</i><span>${esc(topic.t)}<small>${esc(topic.s)}</small></span></summary>
      <ol class="hg-steps">${topic.steps.map(step => `<li>${esc(step)}</li>`).join("")}</ol>
      ${topic.ex || ""}${topic.note ? `<p class="hg-note${topic.warn ? " warn" : ""}">${esc(topic.note)}</p>` : ""}
    </details>`;

  // the Help page: new topics first, the older cards and Smart Help folded below
  function page(param, legacy) {
    const want = String(param || "");
    const topics = TOPICS();
    return `<section class="page help-page hg hg-page">
      <div class="page-header"><div>
        <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${typeof Icons !== "undefined" && Icons.help ? Icons.help() : "?"}</span>${L("ជំនួយ", "Help")}</h1>
        <p class="page-subtitle">${L("របៀបប្រើ MYLIFE ជាជំហានខ្លីៗ", "How MYLIFE works, in short steps")}</p>
      </div></div>
      <button class="hg-tour" type="button" data-nomi-intro-open><i aria-hidden="true">🐱</i><span><b>${esc(L("ដំណើរទស្សនកិច្ចជាមួយ Nomi", "Take the tour with Nomi"))}</b><small>${esc(L("ដើរមើលអេក្រង់ពិត រួមទាំងសាកល្បងសន្សំ · ១ នាទី", "A walk through the real screens, with a savings demo · 1 min"))}</small></span><em aria-hidden="true">›</em></button>
      <input class="hg-search" type="search" id="hgSearch" placeholder="${esc(L("ស្វែងរក៖ ឧ. អញ្ជើញ, សន្សំរួម", "Search: e.g. invite, joint"))}" autocomplete="off">
      <div class="hg-chips" id="hgChips">${GROUPS.map(([id, kh, en], index) => `<button class="hg-chip${index ? "" : " on"}" type="button" data-hg-f="${id}">${esc(L(kh, en))}</button>`).join("")}</div>
      <div class="hg-list" id="hgList">${topics.map((topic, index) => topicHtml(topic, want ? topic.id === want || topic.area === want : index === 0)).join("")}<p class="hg-empty" id="hgEmpty" hidden>${esc(L("រកមិនឃើញ ព្យាយាមពាក្យផ្សេង", "Nothing found. Try another word."))}</p></div>
      <details class="hg-more hg-acc"><summary><i>📘</i><span>${esc(L("ការណែនាំទូទៅ", "General guide"))}<small>${esc(L("ស្វែងរក · បន្ថែម · ពិនិត្យ · Backup · Telegram", "Search · Add · Review · Backup · Telegram"))}</small></span></summary><div style="padding:0 12px 12px">${legacy || ""}</div></details>
    </section>`;
  }

  function filter() {
    const q = (document.getElementById("hgSearch")?.value || "").trim().toLowerCase();
    const f = document.querySelector(".hg-chip.on")?.dataset.hgF || "all";
    let shown = 0;
    document.querySelectorAll(".hg-acc[data-hg-id]").forEach(item => {
      const okGroup = f === "all" || ` ${item.dataset.hgG} `.includes(` ${f} `);
      const okText = !q || item.textContent.toLowerCase().includes(q);
      item.hidden = !(okGroup && okText);
      if (!item.hidden) shown += 1;
    });
    const empty = document.getElementById("hgEmpty");
    if (empty) empty.hidden = shown > 0;
  }

  const banner = () => `<a class="hg-ban hg" href="#help" aria-label="${esc(L("ជំនួយ និងរបៀបប្រើ", "Help and how-to"))}"><i>?</i><span><b>${esc(L("ជំនួយ និងរបៀបប្រើ", "Help and how-to"))}</b><small>${esc(L("មើលពីរបៀបដែល app នេះដំណើរការ ជាជំហានខ្លីៗ", "See how the app works in short steps"))}</small></span><em>›</em></a>`;

  // a small "?" after the page title
  function mount(route) {
    if (!AREAS_FN()[route]) return;
    const heading = document.querySelector("#app h1");
    if (!heading || heading.querySelector(".hg-q, .hg-demo")) return;
    // pages with a guided demo get one "!" chip (the demo replaces the "?" sheet; the Help page keeps every topic);
    // pages without a demo keep the "?" help sheet
    const hasDemo = typeof AppTour !== "undefined" && AppTour.has(route);
    if (!hasDemo) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "hg-q"; button.dataset.hgArea = route; button.textContent = "?";
      button.setAttribute("aria-label", L("ជំនួយផ្នែកនេះ", "Help for this page"));
      heading.appendChild(button);
    }
    if (hasDemo) {
      const demoBtn = document.createElement("button");
      demoBtn.type = "button"; demoBtn.className = "hg-demo"; demoBtn.dataset.atSection = route;
      demoBtn.textContent = "!";
      demoBtn.setAttribute("aria-label", L("សាកល្បងមើលផ្នែកនេះ", "Guided demo of this page")); demoBtn.title = L("សាកល្បងមើល", "Demo");
      heading.appendChild(demoBtn);
    }
  }

  // Help and Tips have no top bar, so they get their own back arrow
  function mountBack(route) {
    if (route !== "help" && route !== "tips") return;
    const page = document.querySelector("#app > .page, #app > section");
    if (!page || page.querySelector(".hg-backbtn")) return;
    const wrap = document.createElement("div");
    wrap.className = "hg hg-backrow";
    wrap.innerHTML = `<button class="hg-backbtn" type="button" data-hg-back aria-label="${esc(L("ត្រឡប់ក្រោយ", "Back"))}"><span aria-hidden="true">‹</span>${esc(L("ត្រឡប់ក្រោយ", "Back"))}</button>`;
    page.prepend(wrap);
  }

  function closeSheet() { document.querySelector(".hg-back")?.remove(); }
  function openSheet(area) {
    const entry = AREAS_FN()[area]; if (!entry) return;
    const topics = TOPICS().filter(topic => topic.area === area);
    closeSheet();
    const wrap = document.createElement("div");
    wrap.className = "hg-back hg";
    wrap.innerHTML = `<div class="hg-sheet" role="dialog" aria-modal="true" aria-label="${esc(entry[1])}">
      <header><h3>${esc(L("ជំនួយ · ", "Help · "))}${esc(entry[1])}</h3><button class="hg-x" type="button" data-hg-close aria-label="${esc(L("បិទ", "Close"))}">×</button></header>
      ${topics.map(topic => `<div><div class="hg-tip"><span>💡</span><span><b>${esc(topic.t)}</b><br>${esc(topic.steps.join(" · "))}</span></div></div>`).join("") || `<div class="hg-tip">${esc(entry[1])}</div>`}
      <a class="hg-go" href="#help/${entry[0]}" data-hg-close>${esc(L("មើលការណែនាំពេញ ›", "Full guide ›"))}</a>
    </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector(".hg-x")?.focus();
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-hg-back]")) { event.preventDefault(); if (history.length > 1) history.back(); else location.hash = "#launcher"; return; }
    const q = event.target.closest(".hg-q");
    if (q) { event.preventDefault(); event.stopPropagation(); openSheet(q.dataset.hgArea); return; }
    if (event.target.closest("[data-hg-close]") || event.target.classList?.contains("hg-back")) { closeSheet(); return; }
    const chip = event.target.closest(".hg-chip");
    if (chip) { document.querySelectorAll(".hg-chip").forEach(item => item.classList.toggle("on", item === chip)); filter(); }
  });
  document.addEventListener("input", event => { if (event.target.id === "hgSearch") filter(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeSheet(); });

  return { page, banner, mount, mountBack, openSheet };
})();
