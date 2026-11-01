/* First-run MYLIFE guide. */
const NomiIntro = (() => {
  const SEEN_KEY = "mylife:nomi-intro-seen:v1";
  let index = 0;
  let shown = false;
  let startupTimer = null;
  let returnFocusTo = null;
  const km = () => languageCode() === "km";
  const L = (kh, en) => km() ? kh : en;
  const steps = () => [
    { icon: Icons.spark(), title: L("សួស្តី! ខ្ញុំ Nomi", "Hi, I’m Nomi"), body: L("ខ្ញុំនៅទីនេះជួយឲ្យជីវិតប្រចាំថ្ងៃងាយស្រួល និងស្ងប់ចិត្តជាងមុន។", "I’m here to make everyday life feel a little easier and more organized."), note: L("ចាប់ផ្តើមតូចៗ ហើយរីកចម្រើនរាល់ថ្ងៃ។", "Small steps add up. Let’s take a look around.") },
    { icon: Icons.home(), title: L("មើលថ្ងៃនេះភ្លាមៗ", "Start with today"), body: L("ទំព័រដើមបង្ហាញកិច្ចការ កម្មវិធី និងអ្វីដែលគួរយកចិត្តទុកដាក់។", "Home brings your plans, reminders, and useful updates together."), note: L("ចុចលើកាត ដើម្បីចូលទៅមើលបន្ថែម។", "Tap any card to open the details.") },
    { icon: Icons.money(), title: L("តាមដានលុយឲ្យច្បាស់", "Feel clearer about money"), body: L("កត់ចំណូល ចំណាយ វិក្កយបត្រ និងសន្សំ ដើម្បីឃើញរូបភាពហិរញ្ញវត្ថុរបស់អ្នក។", "Track income, spending, bills, and savings in one place."), note: L("អាចកត់វិក្កយបត្រថាបង់ហើយបានផងដែរ។", "You can mark bills paid as you go.") },
    { icon: Icons.target(), title: L("គោលដៅធំ ចាប់ពីជំហានតូច", "Make room for your goals"), body: L("បំបែកគោលដៅ និងផែនការសន្សំជាជំហានងាយៗ ដែលអ្នកអាចធ្វើបានរាល់ថ្ងៃ។", "Turn goals and savings plans into small steps you can keep up with."), note: L("អ្នកអាចកែផែនការពេលណាក៏បាន។", "You can adjust your plans whenever life changes.") },
    { icon: Icons.memory(), title: L("រក្សាអ្វីដែលមានន័យ", "Keep the moments that matter"), body: L("ប្រើប្រតិទិន សមាជិកគ្រួសារ និងអនុស្សាវរីយ៍ ដើម្បីរៀបចំជីវិត និងរក្សាពេលវេលាល្អៗ។", "Use Calendar, Family, and Memories to stay close to plans and people."), note: L("តោះចាប់ផ្តើម! ខ្ញុំនឹងនៅទីនេះ។", "That’s the tour. I’ll be here whenever you need me.") }
  ];

  function render() {
    const list = steps();
    const step = list[index];
    const final = index === list.length - 1;
    const mascot = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy(index === 0 ? "happy" : index === 2 ? "wink" : "calm") : Icons.spark();
    return `<div class="ni-backdrop" data-ni-backdrop>
      <section class="ni-dialog" role="dialog" aria-modal="true" aria-labelledby="ni-title" aria-describedby="ni-body" tabindex="-1">
        <button class="ni-close" type="button" data-ni-close aria-label="${L("បិទ", "Close")}">${Icons.close()}</button>
        <div class="ni-hero"><span class="ni-glow" aria-hidden="true"></span><span class="ni-mascot" aria-hidden="true">${mascot}</span><span class="ni-spark ni-spark-one" aria-hidden="true">✦</span><span class="ni-spark ni-spark-two" aria-hidden="true">✧</span></div>
        <div class="ni-step-label">${L("ណែនាំកម្មវិធី", "A QUICK TOUR")} <span>${index + 1} / ${list.length}</span></div>
        <div class="ni-icon" aria-hidden="true">${step.icon}</div>
        <h2 id="ni-title">${step.title}</h2>
        <p id="ni-body">${step.body}</p>
        <p class="ni-note">${step.note}</p>
        <div class="ni-dots" role="group" aria-label="${L("ជំហានណែនាំ", "Tour steps")}">${list.map((_, i) => `<span class="${i === index ? "is-active" : ""}"${i === index ? ' aria-current="step"' : ""}></span>`).join("")}</div>
        <div class="ni-actions">
          <button class="ni-skip" type="button" data-ni-skip>${L("រំលង", "Skip tour")}</button>
          <div class="ni-next-actions">${index > 0 ? `<button class="ni-back" type="button" data-ni-back>${L("ត្រឡប់", "Back")}</button>` : ""}<button class="ni-next" type="button" data-ni-next>${final ? L("ចាប់ផ្តើមប្រើ", "Let’s go") : L("បន្ទាប់", "Next")} <span aria-hidden="true">${final ? "✓" : "→"}</span></button></div>
        </div>
      </section>
    </div>`;
  }

  function finish() {
    const root = document.getElementById("modalRoot");
    root?.querySelector(".ni-backdrop")?.remove();
    if (root && !root.children.length) root.classList.remove("open");
    document.body.classList.remove("ni-open");
    shown = false;
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (_) { /* the tour can still close if storage is unavailable */ }
    if (returnFocusTo?.isConnected && typeof returnFocusTo.focus === "function") returnFocusTo.focus({ preventScroll: true });
    returnFocusTo = null;
  }

  function open() {
    if (shown) return;
    const root = document.getElementById("modalRoot");
    if (!root) return;
    returnFocusTo = document.activeElement;
    index = 0;
    root.innerHTML = render();
    root.classList.add("open");
    document.body.classList.add("ni-open");
    shown = true;
    root.querySelector(".ni-dialog")?.focus({ preventScroll: true });
  }

  function advance(delta) {
    const list = steps();
    const next = index + delta;
    if (next < 0) return;
    if (next >= list.length) return finish();
    index = next;
    const root = document.getElementById("modalRoot");
    if (root?.querySelector(".ni-backdrop")) {
      root.innerHTML = render();
      root.querySelector(".ni-dialog")?.focus({ preventScroll: true });
    }
  }

  function startAfterLogin() {
    let attempts = 0;
    startupTimer = window.setInterval(() => {
      attempts += 1;
      const modalRoot = document.getElementById("modalRoot");
      if (Login.isOpen || modalRoot?.querySelector("#loginModal")) {
        if (attempts >= 240) clearInterval(startupTimer);
        return;
      }
      if (appData.profile.name && (Login.authenticated || Login.guestMode || Login.getRememberedSession())) {
        clearInterval(startupTimer);
        startupTimer = null;
        let seen = false;
        try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch (_) { /* show once per app session when storage is blocked */ }
        if (!seen) open();
        return;
      }
      if (attempts >= 240) clearInterval(startupTimer);
    }, 500);
  }

  function init() {
    document.addEventListener("click", event => {
      if (event.target.closest("[data-nomi-intro-open]")) { event.preventDefault(); open(); return; }
      if (event.target.closest("[data-ni-close], [data-ni-skip]")) { finish(); return; }
      if (event.target.closest("[data-ni-next]")) { advance(1); return; }
      if (event.target.closest("[data-ni-back]")) advance(-1);
    });
    document.addEventListener("keydown", event => {
      if (!shown) return;
      if (event.key === "Tab") {
        const dialog = document.querySelector(".ni-dialog");
        const focusable = [...(dialog?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!focusable.includes(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key === "Escape") { event.preventDefault(); finish(); }
      if (event.key === "ArrowRight") advance(1);
      if (event.key === "ArrowLeft") advance(-1);
    });
  }

  return { init, open, startAfterLogin, isOpen: () => shown };
})();
