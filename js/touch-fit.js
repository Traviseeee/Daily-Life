/* Swipe from the left edge to go back, like a native iPhone app.
   Only in the installed app (home-screen PWA): Safari and Chrome tabs already
   have their own edge swipe, so there we do nothing. An open window closes
   first; otherwise we go back one page, or to Home if there is nothing behind. */
const TouchFit = (() => {
  const EDGE = 24;          // px from the left edge where a swipe can start
  const TRIGGER = 72;       // px to the right to count as "back"
  let start = null;
  let arrow = null;
  const trail = [location.hash || "#home"]; // pages visited in this session, so back never leaves the app

  const installed = () =>
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const reduce = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function ensureArrow() {
    if (arrow?.isConnected) return arrow;
    arrow = document.createElement("div");
    arrow.className = "edge-back";
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.body.appendChild(arrow);
    return arrow;
  }

  function show(dx) {
    const el = ensureArrow();
    const p = Math.min(1, dx / TRIGGER);
    el.classList.remove("is-leaving");
    el.classList.toggle("is-ready", p >= 1);
    el.style.opacity = String(p);
    el.style.transform = `translateX(${-44 + p * 58}px) scale(${0.8 + p * 0.2})`;
  }

  function hide() {
    if (!arrow) return;
    arrow.classList.add("is-leaving");
    arrow.style.opacity = "0";
    arrow.style.transform = "translateX(-44px) scale(0.8)";
  }

  function goBack() {
    const modal = document.getElementById("modalRoot");
    if (modal?.classList.contains("open") && typeof Modal !== "undefined") return Modal.close();
    const dialog = document.querySelector("dialog[open]");
    if (dialog) return dialog.close();
    if (document.body.classList.contains("nav-open")) return document.getElementById("menuToggle")?.click();
    const route = (location.hash || "#home").replace("#", "");
    if (trail.length > 1) { history.back(); return; }
    if (route !== "home" && route !== "") location.hash = "#home";
  }

  function onStart(event) {
    if (!installed() || event.touches.length !== 1) return;
    const t = event.touches[0];
    if (t.clientX > EDGE) return;
    // a horizontal strip (photos, avatars) under the finger keeps its own swipe
    if (event.target.closest?.(".mf-car, .fam-avatars, .mf-people, [data-no-edge-back], input, textarea, select")) return;
    start = { x: t.clientX, y: t.clientY, moved: false };
  }

  function onMove(event) {
    if (!start) return;
    const t = event.touches[0];
    const dx = t.clientX - start.x;
    const dy = Math.abs(t.clientY - start.y);
    if (!start.moved && dy > 18 && dy > dx) { start = null; hide(); return; } // a normal scroll
    if (dx > 8) {
      start.moved = true;
      if (!reduce()) show(dx);
    }
  }

  function onEnd(event) {
    if (!start) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = Math.abs(t.clientY - start.y);
    start = null;
    hide();
    if (dx >= TRIGGER && dy < 60) {
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (error) { /* not allowed */ } }
      goBack();
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", () => {
      const now = location.hash || "#home";
      if (trail.length > 1 && trail[trail.length - 2] === now) trail.pop(); // went back
      else if (trail[trail.length - 1] !== now) trail.push(now);
      if (trail.length > 50) trail.splice(0, trail.length - 50);
    });
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", () => { start = null; hide(); }, { passive: true });
  }

  return { goBack, installed };
})();

if (typeof window !== "undefined") window.TouchFit = TouchFit;

/* The orange ＋ steps aside while you scroll down (reading) and comes back as soon
   as you scroll up or stop near the top/bottom. */
(() => {
  if (typeof window === "undefined") return;
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const dy = y - lastY;
    const nearTop = y < 80;
    const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 40;
    if (nearTop || dy < -6) document.body.classList.remove("fab-away");
    else if (dy > 6 && !nearBottom) document.body.classList.add("fab-away");
    if (nearBottom) document.body.classList.remove("fab-away");
    if (Math.abs(dy) > 6) lastY = y;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("hashchange", () => { document.body.classList.remove("fab-away"); lastY = window.scrollY; });
})();
