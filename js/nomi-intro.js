/* First-run MYLIFE guide. */
const NomiIntro = (() => {
  const SEEN_KEY = "mylife:nomi-intro-seen:v1";
  let startupTimer = null;

  function open() {
    if (typeof AppTour !== "undefined") AppTour.start();
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
    if (typeof AppTour !== "undefined") AppTour.init();
    document.addEventListener("click", event => {
      if (event.target.closest("[data-nomi-intro-open]")) { event.preventDefault(); open(); }
    });
  }

  return { init, open, startAfterLogin, isOpen: () => typeof AppTour !== "undefined" && AppTour.isOpen() };
})();
