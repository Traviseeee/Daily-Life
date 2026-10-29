// Pull down to refresh (phone / PWA): at the top of a page, drag down and let go
// to pull fresh data from the cloud, the weather and family posts, then re-render.
const PullRefresh = (() => {
  const LIMIT = 72; // px to pull before it refreshes
  let startY = 0, startX = 0, pulling = false, dist = 0, busy = false, el = null;
  const km = () => (typeof languageCode === "function" ? languageCode() : "km") === "km";

  function ui() {
    if (el) return el;
    el = document.createElement("div");
    el.className = "ptr";
    el.setAttribute("aria-live", "polite");
    el.innerHTML = '<span class="ptr-spin" aria-hidden="true"></span><span class="ptr-text"></span>';
    document.body.appendChild(el);
    return el;
  }
  function setText(text) { ui().querySelector(".ptr-text").textContent = text; }
  function blocked(target) {
    if (busy || window.scrollY > 0) return true;
    if (document.getElementById("modalRoot")?.classList.contains("open")) return true;
    if (document.querySelector(".wxp-backdrop, .ma-pop, .fg-sheet, .tp-sheet, .rc-viewer")) return true;
    // inside something that scrolls on its own and isn't at its top
    for (let node = target; node && node !== document.body; node = node.parentElement) {
      if (node.scrollTop > 0) return true;
      if (node.matches?.("input, textarea, select, [contenteditable], .mobile-nav, .ptr-ignore")) return true;
    }
    return false;
  }
  function show(d) {
    const box = ui();
    const p = Math.min(1, d / LIMIT);
    box.classList.add("is-on");
    box.style.transform = `translate(-50%, ${Math.min(d, LIMIT + 24) - 56}px)`;
    box.style.opacity = String(Math.min(1, p * 1.4));
    box.querySelector(".ptr-spin").style.transform = `rotate(${p * 300}deg)`;
    box.classList.toggle("is-ready", p >= 1);
    setText(p >= 1 ? (km() ? "លែងដៃដើម្បីធ្វើឱ្យថ្មី" : "Release to refresh") : (km() ? "ទាញចុះដើម្បីធ្វើឱ្យថ្មី" : "Pull to refresh"));
  }
  function hide() {
    if (!el) return;
    el.classList.remove("is-on", "is-ready", "is-busy");
    el.style.transform = "";
    el.style.opacity = "";
  }
  async function refresh() {
    busy = true;
    const box = ui();
    box.classList.add("is-busy");
    box.style.transform = "translate(-50%, 14px)";
    box.style.opacity = "1";
    setText(km() ? "កំពុងទាញទិន្នន័យថ្មី…" : "Refreshing…");
    try {
      const jobs = [];
      if (typeof Store !== "undefined" && navigator.onLine) jobs.push(Store.syncFromSupabase().catch(() => false));
      if (typeof TopbarWeather !== "undefined" && TopbarWeather.load) jobs.push(Promise.resolve(TopbarWeather.load(true)).catch(() => null));
      if (typeof FamilyGroup !== "undefined" && FamilyGroup.refresh) jobs.push(Promise.resolve(FamilyGroup.refresh()).catch(() => null));
      if (typeof FamilyPosts !== "undefined" && FamilyPosts.reload) jobs.push(Promise.resolve(FamilyPosts.reload()).catch(() => null));
      await Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, 8000))]);
      if (typeof App !== "undefined") App.render();
      const time = new Date().toTimeString().slice(0, 5);
      if (typeof Toast !== "undefined") Toast.show(navigator.onLine ? `${km() ? "បានធ្វើឱ្យថ្មី" : "Updated"} · ${time}` : (km() ? "គ្មានអ៊ីនធឺណិត" : "Offline"), navigator.onLine ? "success" : "warning");
    } finally {
      busy = false;
      hide();
    }
  }
  function init() {
    if (!("ontouchstart" in window)) return;
    document.addEventListener("touchstart", e => {
      if (e.touches.length !== 1 || blocked(e.target)) { pulling = false; return; }
      startY = e.touches[0].clientY; startX = e.touches[0].clientX; pulling = true; dist = 0;
    }, { passive: true });
    document.addEventListener("touchmove", e => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY, dx = Math.abs(e.touches[0].clientX - startX);
      if (dy <= 0 || dx > dy || window.scrollY > 0) { if (dist) hide(); pulling = dist > 0 && dy > 0; dist = 0; return; }
      dist = dy * 0.5; // resistance
      if (dist > 6) show(dist);
    }, { passive: true });
    document.addEventListener("touchend", () => {
      if (!pulling) return;
      pulling = false;
      if (dist >= LIMIT) refresh(); else hide();
      dist = 0;
    });
  }
  return { init, refresh };
})();
document.addEventListener("DOMContentLoaded", () => PullRefresh.init());
