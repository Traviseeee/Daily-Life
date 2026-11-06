/* Nimo's day (7 Nov 2026): Nimo's motion + mood follow the clock in PHNOM PENH (not the phone's zone).
 * 5-6 wake / 6-9 coffee + breakfast / 9-12 work / 12-13 lunch / 13-17 work (ideas) / 17-19 music
 * 19-21 dinner with family / 21-22 sleepy / 22-5 asleep z z z. Art + motion: css/nimo-day.css.
 * Used by the Home hero and the Launcher (special moods - over budget, all done - still come first). */
const NimoDay = (() => {
const INK = "#3d2d6d";
// one slot per part of the day, Phnom Penh time
const SLOTS = [
  { id: "sleep",   from: 22 * 60, to: 5 * 60,  sky: "late",    t: "😴 គេងលក់", h: "z z z… ស្អែកជួបគ្នា" },
  { id: "wake",    from: 5 * 60,  to: 6 * 60,  sky: "dawn",    t: "🌅 ភ្ញាក់ពីគេង", h: "លាតខ្លួន… ស្រែកយ៉ាន" },
  { id: "coffee",  from: 6 * 60,  to: 9 * 60,  sky: "morning", t: "☕ កាហ្វេ + អាហារពេលព្រឹក", h: "ផឹកកាហ្វេ ញ៉ាំនំប៉័ង" },
  { id: "work",    from: 9 * 60,  to: 12 * 60, sky: "noon",    t: "💻 ម៉ោងធ្វើការ", h: "វាយ keyboard ផ្តោតការងារ" },
  { id: "lunch",   from: 12 * 60, to: 13 * 60, sky: "noon",    t: "🍜 ញ៉ាំបាយថ្ងៃត្រង់", h: "ឆ្ងាញ់ណាស់!" },
  { id: "work2",   from: 13 * 60, to: 17 * 60, sky: "noon",    t: "💡 ធ្វើការរសៀល", h: "គិតគំនិតថ្មី" },
  { id: "relax",   from: 17 * 60, to: 19 * 60, sky: "evening", t: "🎧 ចេញពីការងារ", h: "ស្ដាប់ភ្លេង សម្រាក" },
  { id: "dinner",  from: 19 * 60, to: 21 * 60, sky: "night",   t: "🍲 បាយល្ងាចជាមួយគ្រួសារ", h: "ជុំគ្នា កក់ក្ដៅ" },
  { id: "sleepy",  from: 21 * 60, to: 22 * 60, sky: "night",   t: "🥱 ងងុយហើយ", h: "ងក់ក្បាល… ជូតភ្នែក" }
];
const slotAt = min => SLOTS.find(s => s.from < s.to ? min >= s.from && min < s.to : min >= s.from || min < s.to);

// ---------- face parts ----------
const eye = (x, y) => `<g class="nd-eye"><circle cx="${x}" cy="${y}" r="4" fill="${INK}"/><circle cx="${x + 1.3}" cy="${y - 1.5}" r="1.3" fill="#fff"/></g>`;
const shut = (x, y, down = true) => `<path d="M${x - 4} ${y}q4 ${down ? 3 : -4} 8 0" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
const blush = `<ellipse cx="33" cy="61" rx="4.5" ry="2.7" fill="#ffb9c4" opacity=".85"/><ellipse cx="67" cy="61" rx="4.5" ry="2.7" fill="#ffb9c4" opacity=".85"/>`;
const smile = `<path d="M43 63q7 8 14 0" fill="#E6986B" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
const FACE = {
  sleep:  blush + shut(40, 55) + shut(60, 55) + `<path d="M46 64q4 2 8 0" stroke="${INK}" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  wake:   blush + shut(40, 54, false) + shut(60, 54, false) + `<ellipse class="nd-yawn" cx="50" cy="64" rx="4.5" ry="5.5" fill="#7a3e3e"/>`,
  coffee: blush + shut(40, 55, false) + eye(60, 53) + smile,
  work:   blush + eye(40, 54) + eye(60, 54) + `<path d="M45 64h10" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` +
          `<g fill="none" stroke="${INK}" stroke-width="1.6"><circle cx="40" cy="54" r="7"/><circle cx="60" cy="54" r="7"/><path d="M47 54h6"/></g>`,
  work2:  blush + `<g class="nd-eye"><circle cx="41" cy="52" r="4" fill="${INK}"/><circle cx="61" cy="52" r="4" fill="${INK}"/></g>` + `<path d="M45 64q5 -3 10 0" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
  lunch:  blush + shut(40, 55, false) + shut(60, 55, false) + `<ellipse class="nd-chew" cx="50" cy="64" rx="5" ry="3" fill="#E6986B" stroke="${INK}" stroke-width="2"/>`,
  relax:  blush + shut(40, 55) + shut(60, 55) + smile,
  dinner: `<ellipse cx="33" cy="61" rx="5" ry="3" fill="#ff9fb3"/><ellipse cx="67" cy="61" rx="5" ry="3" fill="#ff9fb3"/>` + [40, 60].map(x => `<path class="nd-eye" d="M${x} ${58}l-5 -5a3 3 0 0 1 5 -3a3 3 0 0 1 5 3z" fill="#ff6f91"/>`).join("") + smile,
  sleepy: blush + `<path d="M36 55h8M56 55h8" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M36 53q4 -2 8 0M56 53q4 -2 8 0" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".6"/>` + `<ellipse cx="50" cy="65" rx="3" ry="2.5" fill="${INK}"/>`
};

// ---------- props behind / in front ----------
const PROPS = {
  sleep: {
    back: `<g class="nd-moon"><path d="M86 10a10 10 0 1 0 8 16a8 8 0 1 1 -8 -16z" fill="#fff6c2"/></g>`,
    hat: `<path d="M30 34q14 -26 40 -4q-6 -4 -12 -2z" fill="#7a6cf0"/><path d="M30 34q20 -6 40 -4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="72" cy="20" r="4.5" fill="#fff"/>`,
    front: `<path d="M12 86q38 -14 76 0v8h-76z" fill="#9b8cff" opacity=".9"/><path d="M12 86q38 -14 76 0" stroke="#c9bdff" stroke-width="3" fill="none"/>` +
           `<g class="nd-zz" font-family="sans-serif" font-weight="800" fill="#c9bdff"><text x="70" y="36" font-size="11">z</text><text x="76" y="26" font-size="14">z</text><text x="84" y="14" font-size="17">Z</text></g>`
  },
  wake: {
    back: `<g class="nd-sun"><circle cx="14" cy="22" r="10" fill="#ffd36b"/><g stroke="#ffd36b" stroke-width="2.5" stroke-linecap="round"><path d="M14 5v-4M14 39v4M-3 22h-4M31 22h4"/></g></g>`,
    arms: `<ellipse cx="22" cy="36" rx="6" ry="9" fill="#c9bdff" transform="rotate(-25 22 36)"/><ellipse cx="78" cy="36" rx="6" ry="9" fill="#c9bdff" transform="rotate(25 78 36)"/>`
  },
  coffee: {
    front: `<g class="nd-cup"><path d="M20 66h20l-2 16a4 4 0 0 1 -4 3h-8a4 4 0 0 1 -4 -3z" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M40 70q7 0 5 6t-6 3" fill="none" stroke="${INK}" stroke-width="1.8"/><path d="M22 70h16" stroke="#a5683a" stroke-width="3"/>` +
           `<g class="nd-steam" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"><path d="M25 62q-3 -5 0 -9t0 -9"/><path d="M30 62q-3 -5 0 -9t0 -9"/><path d="M35 62q-3 -5 0 -9t0 -9"/></g>` +
           `<ellipse cx="30" cy="74" rx="6" ry="5" fill="#c9bdff"/></g>` +
           `<g class="nd-toast"><rect x="62" y="76" width="22" height="16" rx="5" fill="#f2c27b" stroke="${INK}" stroke-width="1.6"/><rect x="65" y="79" width="16" height="10" rx="3" fill="#ffe3a8"/></g>`
  },
  work: {
    front: `<rect x="18" y="72" width="64" height="22" rx="4" fill="#5b4fd6"/><rect x="21" y="75" width="58" height="16" rx="2" fill="#8f86ff"/><path d="M10 94h80" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
           `<circle cx="50" cy="83" r="3" fill="#fff" opacity=".9"/>` +
           `<ellipse class="nd-paw-l" cx="36" cy="72" rx="6" ry="4.5" fill="#c9bdff" stroke="${INK}" stroke-width="1.2"/><ellipse class="nd-paw-r" cx="64" cy="72" rx="6" ry="4.5" fill="#c9bdff" stroke="${INK}" stroke-width="1.2"/>` +
           `<path class="nd-spark" d="M86 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffd36b"/><path class="nd-spark" d="M12 38l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff"/>`
  },
  work2: {
    front: `<rect x="18" y="74" width="64" height="20" rx="4" fill="#5b4fd6"/><rect x="21" y="77" width="58" height="14" rx="2" fill="#8f86ff"/><path d="M10 94h80" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
           `<ellipse cx="34" cy="70" rx="6" ry="4.5" fill="#c9bdff" stroke="${INK}" stroke-width="1.2"/>` +
           `<g class="nd-bulb"><circle cx="80" cy="24" r="8" fill="#ffe27a"/><rect x="77" y="31" width="6" height="5" rx="1" fill="#b8a9e8"/><g stroke="#ffe27a" stroke-width="2" stroke-linecap="round"><path d="M80 10v-4M92 24h4M68 24h-4M89 15l3 -3M71 15l-3 -3"/></g></g>`,
    arms: `<ellipse cx="70" cy="62" rx="5.5" ry="8" fill="#c9bdff" transform="rotate(-30 70 62)"/>`
  },
  lunch: {
    front: `<path d="M22 78h56q-2 16 -28 16t-28 -16z" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M22 78h56" stroke="#ff8fab" stroke-width="3"/>` +
           `<path d="M30 78q4 -8 8 0q4 -8 8 0q4 -8 8 0q4 -8 8 0q4 -8 8 0" fill="#fff5d6" stroke="#e8b84a" stroke-width="1.4"/>` +
           `<g class="nd-chop"><path d="M60 76l22 -26M65 77l22 -24" stroke="#a5683a" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="72" cy="62" rx="5.5" ry="4.5" fill="#c9bdff" stroke="${INK}" stroke-width="1.2"/></g>` +
           `<path class="nd-floatheart" d="M84 34c-2.5-3-7-1-5 3l5 5 5-5c2-4-2.5-6-5-3z" fill="#ff8fab"/><path class="nd-floatheart d2" d="M16 40c-2-2.5-6-1-4 2.5l4 4 4-4c2-3.5-2-5-4-2.5z" fill="#ffc2d1"/>`
  },
  relax: {
    front: `<path d="M24 46q26 -30 52 0" stroke="#5b4fd6" stroke-width="4" fill="none"/><rect x="18" y="42" width="10" height="16" rx="5" fill="#ff8fab"/><rect x="72" y="42" width="10" height="16" rx="5" fill="#ff8fab"/>` +
           `<g font-family="sans-serif" font-weight="800" fill="#fff"><text class="nd-note-m" x="84" y="38" font-size="12">♪</text><text class="nd-note-m d2" x="8" y="34" font-size="13">♫</text><text class="nd-note-m d3" x="88" y="22" font-size="10">♪</text></g>`
  },
  dinner: {
    front: `<path d="M24 80h52q-2 14 -26 14t-26 -14z" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M28 80q22 -10 44 0" fill="#ffd9a8"/><circle cx="40" cy="77" r="2.4" fill="#4caf7d"/><circle cx="56" cy="76" r="2.4" fill="#ff8f6b"/>` +
           `<g class="nd-steam" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"><path d="M40 72q-3 -5 0 -9t0 -9"/><path d="M50 72q-3 -5 0 -9t0 -9"/><path d="M60 72q-3 -5 0 -9t0 -9"/></g>` +
           `<path class="nd-floatheart" d="M86 34c-2.5-3-7-1-5 3l5 5 5-5c2-4-2.5-6-5-3z" fill="#ff8fab"/><path class="nd-floatheart d2" d="M14 30c-2.5-3-7-1-5 3l5 5 5-5c2-4-2.5-6-5-3z" fill="#ff8fab"/>`
  },
  sleepy: {
    back: `<path d="M84 8a9 9 0 1 0 7 14a7 7 0 1 1 -7 -14z" fill="#fff6c2"/>`,
    front: `<g class="nd-rub"><ellipse cx="34" cy="60" rx="6" ry="7.5" fill="#c9bdff" stroke="${INK}" stroke-width="1.2"/></g>` +
           `<g class="nd-zz" font-family="sans-serif" font-weight="800" fill="#c9bdff"><text x="72" y="40" font-size="9">z</text></g>`
  }
};

function scene(id) {
  const p = PROPS[id] || {};
  const sleeping = id === "sleep";
  // curled up to sleep: squashed body, ears down, tail around
  const body = sleeping
    ? `<g class="nd-ear-l"><path d="M30 46l2 -12 12 8z" fill="#b3a6f7"/></g><g class="nd-ear-r"><path d="M70 46l-2 -12 -12 8z" fill="#b3a6f7"/></g><ellipse cx="50" cy="66" rx="34" ry="24" fill="#c9bdff"/><ellipse cx="50" cy="76" rx="20" ry="10" fill="#f4f0ff"/>`
    : `<g class="nd-ear-l"><path d="M28 34l4-16 14 10z" fill="#b3a6f7"/><path d="M31 30l2-7 6 5z" fill="#ffc2d1"/></g><g class="nd-ear-r"><path d="M72 34l-4-16-14 10z" fill="#b3a6f7"/><path d="M69 30l-2-7-6 5z" fill="#ffc2d1"/></g><ellipse cx="50" cy="60" rx="31" ry="30" fill="#c9bdff"/><ellipse cx="50" cy="72" rx="18" ry="14" fill="#f4f0ff"/>`;
  const face = sleeping ? `<g transform="translate(0 6)">${FACE.sleep}</g>` : FACE[id];
  return `<svg class="hv2-buddy nd-scene nd-is-${id}" viewBox="0 0 100 100" aria-hidden="true">
    ${p.back || ""}
    <ellipse cx="50" cy="96" rx="26" ry="3.5" fill="rgba(30,20,90,.18)"/>
    <g class="nd-tail"><path d="M74 80c14 2 18-12 10-18" stroke="#b9adf5" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M84 58c-3-4-9-1-6 4l6 6 6-6c3-5-3-8-6-4z" fill="#ff8fab"/></g>
    <g class="nd-body"><g class="nd-head">${body}${p.arms || ""}${p.hat || ""}<g>${face}</g></g></g>
    ${p.front || ""}
  </svg>`;
}


  // minutes since midnight in Phnom Penh
  function ppMinutes(date = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Phnom_Penh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
      return (Number(parts.find(x => x.type === "hour").value) % 24) * 60 + Number(parts.find(x => x.type === "minute").value);
    } catch (error) {
      return (date.getUTCHours() * 60 + date.getUTCMinutes() + 7 * 60) % 1440;
    }
  }
  const now = () => slotAt(ppMinutes());
  // the closest classic mood (sounds, speech lines)
  const MOOD = { sleep: "sleepy", wake: "wink", coffee: "wink", work: "happy", lunch: "happy", work2: "happy", relax: "calm", dinner: "calm", sleepy: "sleepy" };
  const moodNow = () => MOOD[now().id] || "happy";
  const svg = id => scene(id || now().id);
  // keep every Nimo-of-the-day on screen in step when the hour turns
  let last = now().id;
  setInterval(() => {
    if (document.hidden) return;
    const id = now().id;
    if (id === last) return;
    last = id;
    document.querySelectorAll("svg.nd-scene").forEach(el => { el.outerHTML = scene(id); });
  }, 30000);
  return { svg, now, moodNow, ppMinutes, slots: SLOTS };
})();
