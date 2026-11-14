/* AppTour: a real first-run tour. Nomi walks the person through the actual screens,
   dims everything except the part being explained, and Savings has a tiny hands-on demo
   (fake numbers, nothing is saved). Opens once on first launch; Settings → "ជួប Nomi" replays it. */
const AppTour = (() => {
  const SEEN_KEY = "mylife:nomi-intro-seen:v1"; // same key as the old text intro: nobody sees it twice
  let active = false, mode = "full", index = 0, startHash = "", token = 0, demo = 25, returnFocusTo = null;
  const km = () => (typeof languageCode === "function" ? languageCode() : "km") === "km";
  const L = (kh, en) => (km() ? kh : en);
  const nav = route => `#mobileNav [data-route="${route}"]`;

  // route = where to go first; target = selectors tried in order (first visible wins); none → centered card
  const allSteps = () => [
    { route: "#home", mood: "happy", title: L("សួស្តី! ខ្ញុំ Nomi 👋", "Hi, I’m Nomi 👋"), body: L("ខ្ញុំនឹងនាំអ្នកដើរមើលកម្មវិធីពិតៗ ក្នុងមួយនាទី។ អ្នកអាចចុច «រំលង» បានគ្រប់ពេល។", "I’ll walk you through the real screens in about a minute. You can tap Skip at any time.") },
    { route: "#home", target: [".hs-slide", ".hs-sky", ".hv2 > section", ".hv2 > *"], mood: "calm", title: L("ទំព័រដើម · ថ្ងៃនេះ", "Home · today"), body: L("កិច្ចការ កម្មវិធី លុយ និងការរំលឹកសំខាន់ៗសម្រាប់ថ្ងៃនេះ នៅទីនេះ។ អូសកាតទៅឆ្វេងស្តាំដើម្បីមើលបន្ថែម។", "Today’s tasks, plans, money and reminders live here. Swipe the cards sideways to see more.") },
    { route: "#home", target: ["#mobileNav"], mood: "wink", title: L("របារម៉ឺនុយ", "The menu bar"), body: L("ប្តូរទំព័រពីទីនេះ៖ ទំព័រដើម ហិរញ្ញវត្ថុ ប្រតិទិន គ្រួសារ និងអនុស្សាវរីយ៍។", "Switch pages from here: Home, Finance, Calendar, Family and Memories.") },
    { route: "#money", target: [".fv2-page > :first-child", ".fv2-page > *", "#app .page > *"], mood: "calm", sec: "money", title: L("ហិរញ្ញវត្ថុ · លុយរបស់អ្នក", "Finance · your money"), body: L("កត់ចំណូល ចំណាយ វិក្កយបត្រ និងកម្ចី។ កម្មវិធីបូកសរុបឱ្យដោយស្វ័យប្រវត្តិ។", "Log income, spending, bills and loans. Totals are worked out for you.") },
    { route: "#money/savings", target: [".mt-add", '[data-action="add-savings"]', ".fv2-page > :first-child"], mood: "happy", demo: true, sec: "money", title: L("សន្សំ · សាកល្បងមើល", "Savings · try it"), body: L("នេះជាគណនីសាកល្បង (លេខក្លែង មិនរក្សាទុកទេ)។ ចុច ＋ ដាក់ប្រាក់ ដើម្បីមើលក្អមពេញ។ របស់ពិតបង្កើតដោយប៊ូតុង ＋ បន្ថែម ដែលភ្លឺនោះ។", "A practice account (fake numbers, nothing is saved). Tap ＋ to watch the jar fill. Your real one starts from the highlighted ＋ Add button.") },
    { route: "#goals", target: [".gv-add", '[data-action="add-goal"]', ".goals-page > :first-child"], mood: "wink", sec: "goals", title: L("គោលដៅ · រ៉ុក្កែត 🚀", "Goals · the rocket 🚀"), body: L("កំណត់គោលដៅ ហើយមើលរ៉ុក្កែតហោះទៅរកទង់ពេលអ្នកសន្សំជិតដល់។", "Set a goal and watch the rocket fly toward the flag as you get closer.") },
    { route: "#calendar", target: [".cv2 > :first-child", ".cv2 > *", nav("calendar")], mood: "calm", sec: "calendar", title: L("ប្រតិទិន", "Calendar"), body: L("ចុចថ្ងៃណាមួយ ដើម្បីកត់ព្រឹត្តិការណ៍ ឬមើលអ្វីដែលមកដល់។", "Tap a day to add an event or see what’s coming.") },
    { route: "#family", target: [nav("family"), ".fam2 > :first-child"], mood: "happy", sec: "family", title: L("គ្រួសារ", "Family"), body: L("អញ្ជើញសមាជិក ចែករំលែកអនុស្សាវរីយ៍ ហើយជ្រើសរើសអ្វីដែលពួកគេឃើញ។", "Invite people, share memories, and choose what each one can see.") },
    { route: "#memories", target: [nav("memories"), "#app .page > :first-child"], mood: "happy", sec: "memories", title: L("អនុស្សាវរីយ៍ (Memories)", "Memories"), body: L("ដាក់រូប និងវីដេអូពេលល្អៗ ហើយចែករំលែកជាមួយគ្រួសារ។", "Keep photos and videos of good moments, and share them with the family.") },
    { route: "#home", mood: "happy", final: true, title: L("រួចរាល់! 🎉", "You’re all set 🎉"), body: L("ចង់មើលម្តងទៀត? នៅ ការកំណត់ → «ជួប Nomi»។ ឥឡូវ សាកល្បងបង្កើតគណនីសន្សំរបស់អ្នក?", "Want to see it again? Settings → “Meet Nomi”. Ready to start your first savings account?") }
  ];

  const root = () => document.getElementById("modalRoot");
  const steps = () => (mode === "full" ? allSteps() : allSteps().filter(step => step.sec === mode));
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 4 && r.height > 4 && s.visibility !== "hidden" && s.display !== "none"; };
  const findTarget = list => { for (const sel of list || []) { try { const el = document.querySelector(sel); if (visible(el)) return el; } catch (_) { /* bad selector: skip */ } } return null; };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function jar(value) {
    const pct = Math.min(100, Math.round(value / 100 * 100));
    return `<svg class="at-jar" viewBox="0 0 80 96" aria-hidden="true"><rect x="22" y="6" width="36" height="12" rx="6" fill="#f5c76a"/><rect x="12" y="16" width="56" height="74" rx="18" fill="#eafaf3" stroke="#3fae85" stroke-width="4"/><clipPath id="atj"><rect x="14" y="18" width="52" height="70" rx="16"/></clipPath><g clip-path="url(#atj)"><rect class="at-water" x="12" y="${88 - 70 * pct / 100}" width="56" height="${70 * pct / 100 + 4}" fill="#7bd9b0"/></g><circle cx="30" cy="80" r="7" fill="#f5c76a" stroke="#e0a63c" stroke-width="2"/><circle cx="48" cy="78" r="7" fill="#f5c76a" stroke="#e0a63c" stroke-width="2"/></svg>`;
  }
  function demoHtml() {
    return `<div class="at-demo" data-at-demo><div class="at-demo-row">${jar(demo)}<div class="at-demo-amt"><b>$${demo}</b><span>/ $100</span><i class="at-demo-tag">${L("គណនីសាកល្បង", "Practice account")}</i></div></div><button type="button" class="at-demo-add" data-at-demo-add ${demo >= 100 ? "disabled" : ""}>${demo >= 100 ? L("ពេញហើយ 🎉", "Full 🎉") : L("＋ ដាក់ $25", "＋ Add $25")}</button></div>`;
  }

  function cardHtml(step, list) {
    const mascot = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy(step.mood || "calm") : "";
    const last = index === list.length - 1, makes = last && (mode === "full" || mode === "money");
    return `<span class="at-mascot" aria-hidden="true">${mascot}</span>
      <div class="at-step">${mode === "full" ? L("ណែនាំកម្មវិធី", "QUICK TOUR") : L("សាកល្បងផ្នែកនេះ", "TRY THIS PAGE")} <b>${index + 1} / ${list.length}</b></div>
      <h2 id="at-title">${step.title}</h2>
      <p id="at-body">${step.body}</p>
      ${step.demo ? demoHtml() : ""}
      <div class="at-dots" aria-hidden="true">${list.map((_, i) => `<i class="${i === index ? "is-on" : ""}"></i>`).join("")}</div>
      <div class="at-actions">
        <button type="button" class="at-skip" data-at-skip>${last && makes ? L("ទុកសិន", "Not now") : L("រំលង", "Skip")}</button>
        <span class="at-nav">${index > 0 ? `<button type="button" class="at-back" data-at-back>${L("ត្រឡប់", "Back")}</button>` : ""}<button type="button" class="at-next" data-at-next>${last ? (makes ? L("បង្កើតគណនីសន្សំ", "Create savings") : L("រួចរាល់", "Done")) : L("បន្ទាប់", "Next")}</button></span>
      </div>`;
  }

  function ensureLayer() {
    let layer = document.getElementById("atLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "atLayer";
      layer.innerHTML = `<div class="at-shade" data-at-shade></div><div class="at-hole" hidden></div><section class="at-card" role="dialog" aria-modal="true" aria-labelledby="at-title" aria-describedby="at-body" tabindex="-1"></section>`;
      document.body.appendChild(layer);
    }
    return layer;
  }

  function place(layer, target) {
    const hole = layer.querySelector(".at-hole"), card = layer.querySelector(".at-card");
    const vw = innerWidth, vh = innerHeight;
    card.style.transform = ""; card.style.top = ""; card.style.bottom = ""; card.style.left = ""; card.style.right = "";
    if (!target) { hole.hidden = true; layer.classList.add("is-center"); return; }
    layer.classList.remove("is-center");
    const r = target.getBoundingClientRect(), pad = 8;
    // tall targets (a whole page block) are clipped to the screen so the spotlight stays useful
    const top = Math.max(8, r.top - pad), bottom = Math.min(vh - 8, r.bottom + pad);
    const left = Math.max(6, r.left - pad), right = Math.min(vw - 6, r.right + pad);
    hole.hidden = false;
    Object.assign(hole.style, { top: `${top}px`, left: `${left}px`, width: `${right - left}px`, height: `${Math.max(40, bottom - top)}px` });
    const cardH = card.offsetHeight || 260, room = { above: top, below: vh - bottom };
    const below = room.below >= cardH + 16 || room.below >= room.above;
    if (below) card.style.top = `${Math.min(bottom + 12, Math.max(12, vh - cardH - 12))}px`;
    else card.style.top = `${Math.max(12, top - cardH - 12)}px`;
  }

  async function show(delta = 0) {
    const list = steps();
    const next = index + delta;
    if (next < 0) return;
    if (next >= list.length) return finish(true);
    index = next;
    const mine = ++token;
    const step = list[index];
    const layer = ensureLayer();
    layer.classList.add("is-busy");
    if (step.route && location.hash.split("?")[0] !== step.route) { location.hash = step.route; await wait(reduced() ? 60 : 380); }
    // wait for the screen to draw (up to ~2.2 s), then bring the target into view
    let target = null;
    for (let i = 0; i < 22 && mine === token; i += 1) { target = step.target ? findTarget(step.target) : null; if (target || !step.target) break; await wait(100); }
    if (mine !== token) return;
    if (target && target.id !== "mobileNav" && !target.closest("#mobileNav")) { target.scrollIntoView({ block: "center", behavior: "auto" }); await wait(60); } else window.scrollTo(0, 0);
    const card = layer.querySelector(".at-card");
    card.innerHTML = cardHtml(step, list);
    layer.classList.remove("is-busy");
    place(layer, target);
    layer.dataset.target = target ? "1" : "";
    layer._target = target;
    card.focus({ preventScroll: true });
  }

  function reposition() { const layer = document.getElementById("atLayer"); if (layer && active) place(layer, layer._target && layer._target.isConnected ? layer._target : null); }

  function finish(done) {
    token += 1;
    document.getElementById("atLayer")?.remove();
    document.body.classList.remove("at-open");
    active = false;
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (_) { /* fine without storage */ }
    if (mode === "full") {
      if (startHash && location.hash !== startHash && !done) location.hash = startHash; // replay: go back where you were
      if (done) location.hash = "#home";
    } else if (startHash && location.hash !== startHash) location.hash = startHash; // a one-page demo returns to its own page
    if (returnFocusTo && returnFocusTo.isConnected && returnFocusTo.focus) returnFocusTo.focus({ preventScroll: true });
    returnFocusTo = null;
  }

  function start(fromReplay, section) {
    if (active) return;
    mode = section || "full";
    if (mode !== "full" && !allSteps().some(step => step.sec === mode)) mode = "full";
    active = true; index = 0; demo = 25; token += 1;
    startHash = fromReplay || mode !== "full" ? location.hash || "#home" : "";
    returnFocusTo = document.activeElement;
    document.body.classList.add("at-open");
    show(0);
  }

  function demoAdd() {
    if (demo >= 100) return;
    demo = Math.min(100, demo + 25);
    const layer = document.getElementById("atLayer"); if (!layer) return;
    const box = layer.querySelector("[data-at-demo]"); if (box) { box.outerHTML = demoHtml(); }
    const fresh = layer.querySelector("[data-at-demo]"); if (fresh) fresh.classList.add(demo >= 100 ? "is-full" : "is-bump");
  }

  function init() {
    document.addEventListener("click", event => {
      const t = event.target;
      if (!t || !t.closest) return;
      if (t.closest("[data-nomi-intro-open]")) { event.preventDefault(); event.stopImmediatePropagation(); start(true); return; }
      if (!active) { const sec = t.closest("[data-at-section]"); if (sec) { event.preventDefault(); start(false, sec.dataset.atSection); } return; }
      if (t.closest("[data-at-demo-add]")) { demoAdd(); return; }
      if (t.closest("[data-at-skip]")) { finish(false); return; }
      if (t.closest("[data-at-back]")) { show(-1); return; }
      if (t.closest("[data-at-next]")) {
        const last = index === steps().length - 1;
        if (last && mode !== "full" && mode !== "money") finish(true);
        else if (last) { finish(true); setTimeout(() => { location.hash = "#money/savings"; setTimeout(() => document.querySelector('[data-action="add-savings"]')?.click(), 500); }, 80); }
        else show(1);
      }
    }, true);
    document.addEventListener("keydown", event => {
      if (!active) return;
      if (event.key === "Escape") { event.preventDefault(); finish(false); }
      else if (event.key === "ArrowRight") show(1);
      else if (event.key === "ArrowLeft") show(-1);
      else if (event.key === "Tab") {
        const f = [...document.querySelectorAll("#atLayer button:not([disabled])")];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (!f.includes(document.activeElement)) { event.preventDefault(); first.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener("resize", reposition);
    window.addEventListener("orientationchange", reposition);
  }

  return { init, start: () => start(false), replay: () => start(true), section: name => start(false, name), has: name => allSteps().some(step => step.sec === name), isOpen: () => active };
})();
