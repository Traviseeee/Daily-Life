/* Emoji → SVG icons for everything the app shows on screen.
 *
 * Strings in the code keep their emoji (they are also used for Telegram messages,
 * Excel files and toasts that are plain text); this file swaps them for line icons
 * once they are on the page, so every screen gets the same icon style.
 *
 * Not touched (stays emoji):
 *  - mood: the Home mood card, the week row and anything marked [data-keep-emoji]
 *  - faces (😊 😌 😴 😟 🤩 😓 🙆) — they are moods
 *  - text boxes, selects, raw OCR text (<pre>), code, and the page <title>
 */
const EmojiIcons = (() => {
  const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const c = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  const p = d => `<path d="${d}"/>`;
  const rect = (x, y, w, h, r = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;

  const ICON = {
    check: p("M20 6 9 17l-5-5"),
    checkCircle: c(12, 12, 10) + p("m8.5 12 2.5 2.5 5-5"),
    calendar: rect(3, 4, 18, 18) + p("M16 2v4M8 2v4M3 10h18"),
    party: p("M5.8 11.3 2 22l10.7-3.8") + p("M11 13c1.9 1.9 2.8 4.2 2 5-.8.8-3.1-.1-5-2s-2.8-4.2-2-5c.8-.8 3.1.1 5 2Z") + p("M4 3h.01M22 8h.01M15 2h.01M22 20h.01M14 10l1.5-1.5c.9-.9 2.3-.9 3.2 0M18 4l1-2M9 6l-1-3"),
    cake: p("M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01"),
    bulb: p("M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"),
    cash: rect(2, 6, 20, 12) + c(12, 12, 2) + p("M6 12h.01M18 12h.01"),
    wallet: p("M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"),
    receipt: p("M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z") + p("M8 8h8M8 12h8M8 16h5"),
    alert: p("m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3ZM12 9v4M12 17h.01"),
    pencil: p("M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"),
    alarm: c(12, 13, 8) + p("M12 9v4l2 2M5 3 2 6M22 6l-3-3"),
    hourglass: p("M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2"),
    clock: c(12, 12, 10) + p("M12 6v6l4 2"),
    users: p("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2") + c(9, 7, 4) + p("M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"),
    sparkles: p("M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"),
    star: p("M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.1 2 9.3l6.9-1Z"),
    send: p("M22 2 11 13M22 2l-7 20-4-9-9-4Z"),
    save: p("M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"),
    box: p("M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7ZM3.3 7 12 12l8.7-5M12 22V12"),
    target: c(12, 12, 10) + c(12, 12, 6) + c(12, 12, 2),
    menu: p("M4 6h16M4 12h16M4 18h16"),
    sun: c(12, 12, 4) + p("M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"),
    moon: p("M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"),
    cloud: p("M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"),
    link: p("M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"),
    message: p("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"),
    droplet: p("M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7Z"),
    zap: p("M13 2 3 14h9l-1 8 10-12h-9Z"),
    phone: rect(5, 2, 14, 20) + p("M12 18h.01"),
    heart: p("M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"),
    hand: p("M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"),
    home: p("M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"),
    chart: p("M3 3v18h18M18 17V9M13 17V5M8 17v-3"),
    trend: p("M22 7 13.5 15.5l-5-5L2 17M16 7h6v6"),
    bank: p("M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4Z"),
    camera: p("M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z") + c(12, 13, 3),
    bell: p("M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"),
    leaf: p("M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10ZM2 21c0-3 1.9-5.4 5.1-6"),
    repeat: p("m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3"),
    image: rect(3, 3, 18, 18) + c(9, 9, 2) + p("m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"),
    wand: p("m15 4 5 5M3 21l12-12M14 3l1 1M20 9l1 1M5 3v3M3.5 4.5h3M19 15v3M17.5 16.5h3"),
    thumbsUp: p("M7 10v12M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8a2 2 0 0 1-1.9 1.4H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9Z"),
    card: rect(2, 5, 20, 14) + p("M2 10h20"),
    compass: c(12, 12, 10) + p("m16.2 7.8-1.8 5.4-5.4 1.8 1.8-5.4Z"),
    food: p("M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"),
    car: p("M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M9 17h6") + c(7, 17, 2) + c(17, 17, 2),
    bag: p("M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0"),
    pill: p("m10.5 20.5 10-10a5 5 0 1 0-7-7l-10 10a5 5 0 1 0 7 7ZM8.5 8.5l7 7"),
    book: p("M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"),
    film: rect(2, 2, 20, 20) + p("M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"),
    up: p("m18 15-6-6-6 6"),
    down: p("m6 9 6 6 6-6"),
    flask: p("M9 2v6L4 18a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3L15 8V2M8 2h8M7 15h10"),
    brush: p("m9.1 11.9 8-8.1a2.9 2.9 0 1 1 4 4l-8 8.1M7.1 14.9c-1.7 0-3 1.4-3 3 0 1.3-2.5 1.5-2 2 1.1 1.1 2.5 2 4 2 2.2 0 4-1.8 4-4a3 3 0 0 0-3-3Z"),
    umbrella: p("M22 12a10 10 0 0 0-20 0ZM12 12v8a2 2 0 0 0 4 0M12 2v1"),
    bot: p("M12 8V4H8") + rect(4, 8, 16, 12) + p("M2 14h2M20 14h2M15 13v2M9 13v2"),
    call: p("M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"),
    play: p("M6 3l14 9-14 9Z"),
    flame: p("M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5Z"),
    briefcase: rect(2, 7, 20, 14) + p("M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"),
    gift: rect(3, 8, 18, 4, 1) + p("M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"),
    palette: p("M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1 3.7A1.6 1.6 0 0 1 14 22ZM7.5 10.5h.01M10.5 7.5h.01M15.5 7.5h.01"),
    store: p("M3 9 4.5 4h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"),
    dot: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>'
  };

  // emoji → [icon, colour] (no colour = the text colour around it)
  const MAP = {
    "✅": ["checkCircle", "#3aa66b"], "✓": ["check"], "✔": ["check"],
    "📅": ["calendar"], "🗓": ["calendar"], "🎉": ["party", "#a855f7"], "🎂": ["cake", "#ec4899"],
    "💡": ["bulb", "#f5b301"], "💸": ["cash", "#3aa66b"], "💵": ["cash", "#3aa66b"], "💰": ["wallet", "#e0a21a"],
    "🧾": ["receipt"], "⚠": ["alert", "#f0a530"], "✏": ["pencil"], "✍": ["pencil"],
    "⏰": ["alarm"], "⏳": ["hourglass"], "🕰": ["clock"], "👨‍👩‍👧": ["users"],
    "✨": ["sparkles", "#f5b301"], "🪄": ["wand", "#a855f7"], "✦": ["sparkles"], "🔮": ["sparkles", "#a855f7"], "🆕": ["sparkles"],
    "⭐": ["star", "#f5b301"], "☆": ["star"], "📤": ["send"], "📲": ["phone"], "📱": ["phone"],
    "💾": ["save"], "📦": ["box"], "🎯": ["target", "#ef4444"], "☰": ["menu"],
    "☀": ["sun", "#f5b301"], "🌙": ["moon", "#8b9cff"], "☁": ["cloud"], "💧": ["droplet", "#38bdf8"], "☂": ["umbrella", "#38bdf8"],
    "🔗": ["link"], "💬": ["message"], "💪": ["zap", "#f97316"], "⚡": ["zap", "#f5b301"],
    "💞": ["heart", "#ec4899"], "❤": ["heart", "#ef4444"], "💛": ["heart", "#f5b301"], "♡": ["heart"], "🙏": ["heart", "#ec4899"],
    "👋": ["hand"], "👍": ["thumbsUp"], "🏠": ["home"], "📊": ["chart"], "📈": ["trend", "#3aa66b"],
    "🏦": ["bank"], "💳": ["card"], "📸": ["camera"], "🔔": ["bell"], "🔁": ["repeat"],
    "🌿": ["leaf", "#3aa66b"], "🌱": ["leaf", "#3aa66b"], "🍃": ["leaf", "#3aa66b"], "🖼": ["image"],
    "🧭": ["compass"], "🍜": ["food"], "🚗": ["car"], "🛍": ["bag"], "💊": ["pill"], "📚": ["book"], "🎬": ["film"],
    "▲": ["up"], "▼": ["down"], "▶": ["play"], "🧪": ["flask"], "🧹": ["brush"], "🤖": ["bot"], "📞": ["call"],
    "🔥": ["flame", "#f97316"], "💼": ["briefcase"], "🎁": ["gift", "#ec4899"], "🎨": ["palette"], "🏪": ["store"],
    "🟢": ["dot", "#22c55e"], "🔴": ["dot", "#ef4444"]
  };

  // longest first so 👨‍👩‍👧 wins over 👨
  const keys = Object.keys(MAP).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const RE = new RegExp(`(${keys.join("|")})\\uFE0F?`, "gu");
  const TEST = new RegExp(RE.source, "u");

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "PRE", "CODE", "TITLE", "NOSCRIPT"]);
  const SKIP_SELECTOR = "[data-keep-emoji], .mood-card, .mood-selector, .mood-button, .mood-selected, .home-week-row, [data-mood], svg, [contenteditable=''], [contenteditable='true'], .ei";

  function svg(emoji) {
    const key = emoji.replace(/️/g, "");
    const [name, color] = MAP[key] || MAP[emoji] || [];
    if (!name) return null;
    const span = document.createElement("span");
    span.className = "ei";
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", key);
    if (color) span.style.color = color;
    span.innerHTML = `<svg viewBox="0 0 24 24" ${S} aria-hidden="true" focusable="false">${ICON[name]}</svg>`;
    return span;
  }

  function skip(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    return !!el.closest(SKIP_SELECTOR);
  }

  function convertText(node) {
    const text = node.nodeValue;
    if (!text || !TEST.test(text) || skip(node)) return;
    const frag = document.createDocumentFragment();
    let last = 0;
    text.replace(RE, (match, emoji, index) => {
      const icon = svg(emoji);
      if (!icon) return match;
      if (index > last) frag.appendChild(document.createTextNode(text.slice(last, index)));
      frag.appendChild(icon);
      last = index + match.length;
      return match;
    });
    if (!last) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function convert(root) {
    if (!root) return;
    if (root.nodeType === 3) return convertText(root);
    if (root.nodeType !== 1 || skip(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: node => (TEST.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(convertText);
  }

  let pending = new Set();
  let scheduled = false;
  function flush() {
    scheduled = false;
    const list = [...pending];
    pending = new Set();
    list.forEach(node => { if (node.isConnected) convert(node); });
  }

  function addStyle() {
    if (document.getElementById("emojiIconStyle")) return;
    const style = document.createElement("style");
    style.id = "emojiIconStyle";
    style.textContent = ".ei{display:inline-flex;align-items:center;justify-content:center;width:1.15em;height:1.15em;vertical-align:-0.2em;line-height:1;flex:0 0 auto}.ei svg{width:100%;height:100%;display:block}";
    document.head.appendChild(style);
  }

  function start() {
    if (start.done || typeof MutationObserver === "undefined") return;
    start.done = true;
    addStyle();
    convert(document.body);
    new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === "characterData") pending.add(record.target);
        record.addedNodes.forEach(node => pending.add(node));
      });
      if (!scheduled && pending.size) {
        scheduled = true;
        // before the next paint, so the emoji never flashes
        (window.queueMicrotask || (fn => Promise.resolve().then(fn)))(flush);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }

  return { convert, start, MAP };
})();
