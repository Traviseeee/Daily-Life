// Header weather (option D): live weather for Phnom Penh from Open-Meteo
// (free, no API key) with animated sun / moon / cloud / rain / storm icons.
// - #topbarWeather   : small chip (icon + temp) — desktop + compact mobile header
// - #topbarWxCard    : weather card — mobile header on the Home page only
// - #topbarGreet     : greeting + date — mobile Home header
// Cached 30 min in localStorage; without network the last value (or a neutral
// placeholder) is shown, nothing else in the app depends on it.
const TopbarWeather = (() => {
  const PLACE = { name: "Phnom Penh", lat: 11.5564, lon: 104.9282 };
  const CACHE_KEY = "mylife:weather:v2";
  const MAX_AGE = 30 * 60 * 1000;
  let data = null;
  let loading = false;
  let open = false;

  const km = () => (typeof languageCode === "function" ? languageCode() : "en") === "km";
  const TEXT = {
    sun: ["Clear sky", "មេឃស្រឡះ"], moon: ["Clear night", "មេឃស្រឡះ"],
    partly: ["Partly cloudy", "មានពពកខ្លះ"], cloud: ["Cloudy", "មានពពក"], fog: ["Foggy", "អ័ព្ទ"],
    rain: ["Rain", "ភ្លៀង"], storm: ["Thunderstorm", "ភ្លៀងផ្គររន្ទះ"],
    feels: ["Feels", "មានអារម្មណ៍"], rainChance: ["Chance of rain", "ឱកាសភ្លៀង"],
    umbrella: ["Rain likely, bring an umbrella", "ថ្ងៃនេះអាចភ្លៀង កុំភ្លេចយកឆ័ត្រ"],
    umbrellaAt: ["Rain ~{t}, bring an umbrella", "ប្រហែលម៉ោង {t} អាចភ្លៀង កុំភ្លេចឆ័ត្រ"],
    now: ["Now", "ឥឡូវ"], more: ["Show hourly forecast", "ចុចមើលអាកាសធាតុតាមម៉ោង"],
    morning: ["Good morning", "អរុណសួស្តី"], afternoon: ["Good afternoon", "ទិវាសួស្តី"], evening: ["Good evening", "សាយណ្ហសួស្តី"],
    loading: ["Loading weather…", "កំពុងមើលអាកាសធាតុ…"]
  };
  const tx = key => TEXT[key][km() ? 1 : 0];

  function sceneOf(code, isDay) {
    if (code == null) return isDay ? "sun" : "moon";
    if (code >= 95) return "storm";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if (code === 45 || code === 48) return "fog";
    if (code === 3) return "cloud";
    if (code === 1 || code === 2) return isDay ? "partly" : "moon";
    return isDay ? "sun" : "moon";
  }

  // Animated SVG (viewBox 0 0 100 100). Classes animate in css/topbar.css.
  // Simple flat style: one colour per shape, rays as separate dashes, soft sky-blue clouds.
  function icon(scene) {
    const Y = "#fdd023";
    const rays = `<g class="tw-rays" stroke="${Y}" stroke-width="6" stroke-linecap="round"><path d="M50 6v8M50 86v8M6 50h8M86 50h8M19 19l6 6M75 75l6 6M19 81l6-6M75 25l6-6"/></g>`;
    const sun = `${rays}<circle class="tw-core" cx="50" cy="50" r="23" fill="${Y}"/>`;
    const smallSun = `<g transform="translate(28 4) scale(.7)">${sun}</g>`;
    const moon = `<path class="tw-core" d="M60 14a34 34 0 1 0 26 52A28 28 0 0 1 60 14z" fill="${Y}"/><path class="tw-star" d="M82 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="${Y}"/><circle class="tw-star tw-d2" cx="16" cy="26" r="3" fill="${Y}"/>`;
    const cloudShape = fill => `<g fill="${fill}"><circle cx="40" cy="52" r="17"/><circle cx="60" cy="58" r="12"/><rect x="16" y="58" width="68" height="22" rx="11"/></g>`;
    const cloud = (fill = "#a6d4f7", back = "#d2e9fb") => `<g class="tw-drift2"><g transform="translate(14 -12) scale(.7)" opacity=".9">${cloudShape(back)}</g></g><g class="tw-drift">${cloudShape(fill)}</g>`;
    const drops = `<g stroke="#5aa9e6" stroke-width="5" stroke-linecap="round"><path class="tw-drop" d="M37 82l-3 8"/><path class="tw-drop tw-d1" d="M51 82l-3 8"/><path class="tw-drop tw-d2" d="M65 82l-3 8"/></g>`;
    const bolt = `<path class="tw-bolt" d="M54 70l-10 15h9l-5 13 14-19h-9l5-9z" fill="${Y}"/>`;
    const fog = `<g class="tw-drift" stroke="#a6c4dc" stroke-width="5" stroke-linecap="round"><path d="M20 86h46M32 94h48"/></g>`;
    const body = {
      sun, moon,
      partly: `${smallSun}<g transform="translate(-4 4)">${cloud("#a6d4f7", "#a6d4f7").replace('<g class="tw-drift2">', '<g class="tw-drift2" style="display:none">')}</g>`,
      cloud: cloud(),
      fog: cloud("#cfe2f2", "#e3eef8") + fog,
      rain: `<g transform="translate(0 -6)">${cloud("#8fc3ee", "#c3dff6")}</g>${drops}`,
      storm: `<g transform="translate(0 -8)">${cloud("#8fb0d0", "#b9cde2")}</g>${bolt}<g stroke="#5aa9e6" stroke-width="5" stroke-linecap="round"><path class="tw-drop" d="M30 82l-3 8"/><path class="tw-drop tw-d2" d="M72 82l-3 8"/></g>`
    }[scene] || sun;
    return `<svg class="tw-icon tw-${scene}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function readCache() {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return saved && saved.at ? saved : null;
    } catch (error) { return null; }
  }

  async function load(force) {
    const cached = readCache();
    if (cached) data = cached;
    if (loading || (!force && cached && Date.now() - cached.at < MAX_AGE)) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    loading = true;
    const hadData = !!data;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}&current=temperature_2m,apparent_temperature,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=temperature_2m,weather_code,precipitation_probability,is_day&timezone=auto&forecast_days=2`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`weather ${response.status}`);
      const json = await response.json();
      const c = json.current || {};
      const d = json.daily || {};
      data = {
        at: Date.now(),
        temp: Math.round(c.temperature_2m),
        feels: Math.round(c.apparent_temperature),
        code: c.weather_code,
        isDay: c.is_day !== 0,
        max: Math.round((d.temperature_2m_max || [])[0]),
        min: Math.round((d.temperature_2m_min || [])[0]),
        rain: Math.round((d.precipitation_probability_max || [])[0] || 0),
        hours: nextHours(json)
      };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (error) { /* storage full / private */ }
      render();
      if (!hadData) enter();
    } catch (error) {
      console.warn("MYLIFE weather unavailable.", error);
    } finally {
      loading = false;
    }
  }

  // next 13 hours from the hourly forecast, in the place's own time zone
  function nextHours(json) {
    const h = json.hourly || {};
    const times = h.time || [];
    const nowKey = new Date(Date.now() + (json.utc_offset_seconds || 0) * 1000).toISOString().slice(0, 13);
    let start = times.findIndex(t => String(t).slice(0, 13) >= nowKey);
    if (start < 0) return [];
    return times.slice(start, start + 13).map((t, i) => ({
      h: Number(String(t).slice(11, 13)),
      temp: Math.round((h.temperature_2m || [])[start + i]),
      code: (h.weather_code || [])[start + i],
      day: (h.is_day || [])[start + i] !== 0,
      pop: Math.round((h.precipitation_probability || [])[start + i] || 0)
    }));
  }

  const hourLabel = hour => `${hour % 12 || 12}${hour < 12 ? "AM" : "PM"}`;

  function rainTip(scene) {
    if (!data || scene === "rain" || scene === "storm") return "";
    const hours = Array.isArray(data.hours) ? data.hours : [];
    const wet = hours.slice(1, 13).find(x => x.pop >= 60);
    if (wet) return tx("umbrellaAt").replace("{t}", hourLabel(wet.h));
    return data.rain >= 60 ? tx("umbrella") : "";
  }

  function hoursStrip() {
    const hours = Array.isArray(data?.hours) ? data.hours : [];
    if (!hours.length) return "";
    const slots = [0, 2, 4, 6, 8].map(i => hours[i]).filter(Boolean);
    return `<div class="tw-hours">${slots.map((x, i) => `
      <div class="tw-hour${i === 0 ? " is-now" : ""}"><b>${esc(i === 0 ? tx("now") : hourLabel(x.h))}</b>${icon(sceneOf(x.code, x.day))}<span>${num(x.temp)}</span>${x.pop >= 50 ? `<small>💧${x.pop}%</small>` : ""}</div>`).join("")}</div>`;
  }

  function toggle(force) {
    open = typeof force === "boolean" ? force : !open;
    render();
    if (open) play("tw-opening", 900);
  }

  // one-shot motion: a class on the card plays the CSS animation once, then goes away
  // (so the minute-by-minute re-render never replays it)
  const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  function play(cls, ms) {
    const card = document.getElementById("topbarWxCard");
    if (!card || reduceMotion()) return;
    card.classList.remove(cls);
    void card.offsetWidth;
    card.classList.add(cls);
    clearTimeout(play[cls]);
    play[cls] = setTimeout(() => card.classList.remove(cls), ms);
  }

  function enter() {
    if (!document.body.classList.contains("topbar-home") || !data) return;
    play("tw-enter", 1600);
    const el = document.querySelector("#topbarWxCard .tw-card-temp strong");
    const target = Number(data.temp);
    if (!el || reduceMotion() || !Number.isFinite(target) || target === 0) return;
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / 600);
      if (!el.isConnected) return;
      el.textContent = num(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const isDayNow = () => { const h = new Date().getHours(); return h >= 6 && h < 18; };
  const num = value => (Number.isFinite(value) ? `${value}°` : "--°");

  function greeting() {
    const h = new Date().getHours();
    return tx(h < 12 ? "morning" : h < 17 ? "afternoon" : "evening");
  }

  function dateLabel() {
    const now = new Date();
    try {
      return now.toLocaleDateString(km() ? "km-KH" : "en-US", { weekday: "short", day: "numeric", month: "short" });
    } catch (error) { return now.toDateString(); }
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function render() {
    const scene = sceneOf(data?.code, data ? data.isDay : isDayNow());
    const chip = document.getElementById("topbarWeather");
    if (chip) {
      chip.innerHTML = `${icon(scene)}<strong>${num(data?.temp)}</strong>`;
      chip.title = data ? `${tx(scene)} · ${PLACE.name}` : PLACE.name;
      chip.dataset.scene = scene;
    }

    const greet = document.getElementById("topbarGreet");
    if (greet) {
      const name = (typeof appData !== "undefined" && appData.profile?.name) || "";
      greet.innerHTML = `<strong>${esc(greeting())}${name ? `, ${esc(String(name).split(/\s+/)[0])}` : ""}</strong><small>${esc(dateLabel())}</small>`;
    }

    const card = document.getElementById("topbarWxCard");
    if (card) {
      const time = typeof fmtClockDate === "function" ? fmtClockDate(new Date()) : new Date().toLocaleTimeString();
      const [clock, ampm = ""] = String(time).split(/\s+(?=[AP]M$)/i);
      const meta = data
        ? `<span>${esc(tx(scene))}</span>`
        : `<span>${esc(tx("loading"))}</span>`;
      card.dataset.scene = scene;
      card.innerHTML = `
        <div class="tw-card-icon">${icon(scene)}</div>
        <div class="tw-card-main">
          <div class="tw-card-temp"><strong>${num(data?.temp)}</strong></div>
          <div class="tw-card-meta">${meta}</div>
          ${rainTip(scene) ? `<div class="tw-card-tip">☂ ${esc(rainTip(scene))}</div>` : ""}
        </div>
        <div class="tw-card-time"><strong data-tw-clock>${esc(clock)}</strong><small>${esc(ampm || PLACE.name)}</small></div>
        ${data?.hours?.length ? `<span class="tw-card-more" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${open ? hoursStrip() : ""}` : ""}`;
      const canOpen = !!data?.hours?.length;
      card.classList.toggle("is-open", open && canOpen);
      card.classList.toggle("can-open", canOpen);
      if (canOpen) {
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-expanded", String(open));
        card.setAttribute("title", tx("more"));
      }
    }
  }

  function tick() {
    const el = document.querySelector("#topbarWxCard [data-tw-clock]");
    if (!el) return;
    const time = typeof fmtClockDate === "function" ? fmtClockDate(new Date()) : "";
    const clock = String(time).split(/\s+(?=[AP]M$)/i)[0];
    if (el.textContent !== clock) render();
  }

  function init() {
    if (init.done) return;
    init.done = true;
    data = readCache();
    render();
    setTimeout(enter, 80);
    window.addEventListener("hashchange", () => setTimeout(enter, 80));
    load(false);
    setInterval(tick, 15000);
    setInterval(() => load(false), MAX_AGE);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) load(false); });
    document.addEventListener("click", event => {
      const card = event.target.closest("#topbarWxCard.can-open");
      if (card) toggle();
    });
    document.addEventListener("keydown", event => {
      if ((event.key === "Enter" || event.key === " ") && event.target.matches?.("#topbarWxCard.can-open")) {
        event.preventDefault();
        toggle();
      }
    });
  }

  return { init, render, load, toggle, sceneOf, icon };
})();

if (typeof window !== "undefined") window.TopbarWeather = TopbarWeather;
