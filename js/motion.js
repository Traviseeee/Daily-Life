/* Motion upgrade: money totals roll up from 0 the first time a page opens.
   Only right after you open a page (not on every background refresh), only the
   big totals, and never when the phone asks for reduced motion. */
const MotionFx = (() => {
  const TARGETS = ".mm-card .mm-value .money-value, .tdx-stat .money-value";
  const DURATION = 650;
  let routeChangedAt = Date.now();
  const reduce = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const ease = t => 1 - Math.pow(1 - t, 3);

  function rollUp(node) {
    if (node.dataset.rolled) return;
    node.dataset.rolled = "1";
    const text = node.textContent;
    const match = text.match(/-?\d[\d,]*(?:\.\d+)?/);
    if (!match) return;
    const target = Number(match[0].replace(/,/g, ""));
    if (!Number.isFinite(target) || target === 0) return;
    const decimals = (match[0].split(".")[1] || "").length;
    const grouped = match[0].includes(",");
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const format = value => {
      const fixed = Math.abs(value).toFixed(decimals);
      const [whole, frac] = fixed.split(".");
      const body = grouped || whole.length > 3 ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : whole;
      return `${value < 0 ? "-" : ""}${body}${frac ? `.${frac}` : ""}`;
    };
    const start = performance.now();
    const step = now => {
      if (!node.isConnected) return;
      const t = Math.min(1, (now - start) / DURATION);
      node.textContent = `${before}${format(target * ease(t))}${after}`;
      if (t < 1) requestAnimationFrame(step);
      else node.textContent = text; // exactly what the app wrote
    };
    node.textContent = `${before}${format(0)}${after}`;
    requestAnimationFrame(step);
  }

  function scan() {
    if (reduce() || Date.now() - routeChangedAt > 1500) return;
    document.querySelectorAll(TARGETS).forEach(rollUp);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", () => { routeChangedAt = Date.now(); setTimeout(scan, 60); });
    const app = () => document.getElementById("app");
    const watch = () => {
      const root = app();
      if (!root || !("MutationObserver" in window)) return;
      new MutationObserver(() => scan()).observe(root, { childList: true, subtree: true });
      scan();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
    else watch();
  }
  return { scan };
})();
