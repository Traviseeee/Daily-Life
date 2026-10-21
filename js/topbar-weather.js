// Header weather (option D): live weather for Phnom Penh from Open-Meteo
// (free, no API key) with animated sun / moon / cloud / rain / storm icons.
// - #topbarWeather   : small chip (icon + temp) — desktop + compact mobile header
// - #topbarWxCard    : weather card — mobile header on the Home page only
// - #topbarGreet     : greeting + date — mobile Home header
// Cached 30 min in localStorage; without network the last value (or a neutral
// placeholder) is shown, nothing else in the app depends on it.
const TopbarWeather = (() => {
  const PLACE = { name: "Phnom Penh", lat: 11.5564, lon: 104.9282 };
  const CACHE_KEY = "mylife:weather:v1";
  const MAX_AGE = 30 * 60 * 1000;
  let data = null;
  let loading = false;

  const km = () => (typeof languageCode === "function" ? languageCode() : "en") === "km";
  const TEXT = {
    sun: ["Clear sky", "មេឃស្រឡះ"], moon: ["Clear night", "យប់ស្រឡះ"],
    partly: ["Partly cloudy", "មានពពកខ្លះ"], cloud: ["Cloudy", "មានពពក"], fog: ["Foggy", "អ័ព្ទ"],
    rain: ["Rain", "ភ្លៀង"], storm: ["Thunderstorm", "ភ្លៀងផ្គររន្ទះ"],
    feels: ["Feels", "មានអារម្មណ៍"], rainChance: ["Chance of rain", "ឱកាសភ្លៀង"],
    umbrella: ["Rain likely, bring an umbrella", "អាចភ្លៀង យកឆ័ត្រទៅផង"],
    morning: ["Good morning", "អរុណសួស្តី"], afternoon: ["Good afternoon", "ទិវាសួស្តី"], evening: ["Good evening", "សាយណ្ហសួស្តី"],
    loading: ["Loading weather…", "កំពុងទាញអាកាសធាតុ…"]
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
  function icon(scene) {
    const sun = `<g class="tw-rays" stroke="#ffd34d" stroke-width="6" stroke-linecap="round"><path d="M50 6v12M50 82v12M6 50h12M82 50h12M19 19l8 8M73 73l8 8M19 81l8-8M73 27l8-8"/></g><circle class="tw-core" cx="50" cy="50" r="20" fill="#ffc62e"/>`;
    const smallSun = `<g transform="translate(-14 -14) scale(.8)">${sun}</g>`;
    const moon = `<path class="tw-core" d="M58 18a30 30 0 1 0 24 48A26 26 0 0 1 58 18z" fill="#f2e7b5"/><circle class="tw-star" cx="20" cy="24" r="3" fill="#fff"/><circle class="tw-star tw-d2" cx="84" cy="28" r="2.4" fill="#fff"/>`;
    const cloud = (fill = "#e6edf2", back = "#9fb3c2") => `<g class="tw-drift2"><ellipse cx="64" cy="42" rx="20" ry="13" fill="${back}"/></g><g class="tw-drift"><ellipse cx="45" cy="56" rx="27" ry="17" fill="${fill}"/><ellipse cx="65" cy="60" rx="19" ry="13" fill="${fill}"/></g>`;
    const drops = `<g stroke="#5fd3f3" stroke-width="5" stroke-linecap="round"><path class="tw-drop" d="M37 76l-3 8"/><path class="tw-drop tw-d1" d="M51 76l-3 8"/><path class="tw-drop tw-d2" d="M65 76l-3 8"/></g>`;
    const bolt = `<path class="tw-bolt" d="M54 66l-10 16h9l-5 14 14-20h-9l5-10z" fill="#ffd34d"/>`;
    const fog = `<g class="tw-drift" stroke="#c9d6df" stroke-width="5" stroke-linecap="round"><path d="M20 72h46M30 82h50"/></g>`;
    const body = {
      sun, moon,
      partly: `${smallSun}<g transform="translate(8 6)">${cloud()}</g>`,
      cloud: cloud(),
      fog: cloud("#d5dee5", "#9fb3c2") + fog,
      rain: `<g transform="translate(0 -8)">${cloud("#d5dee5", "#8ea4b4")}</g>${drops}`,
      storm: `<g transform="translate(0 -10)">${cloud("#b9c6d0", "#7d93a3")}</g>${bolt}<g stroke="#5fd3f3" stroke-width="5" stroke-linecap="round"><path class="tw-drop" d="M32 76l-3 8"/><path class="tw-drop tw-d2" d="M72 76l-3 8"/></g>`
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
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}&current=temperature_2m,apparent_temperature,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
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
        rain: Math.round((d.precipitation_probability_max || [])[0] || 0)
      };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (error) { /* storage full / private */ }
      render();
    } catch (error) {
      console.warn("MYLIFE weather unavailable.", error);
    } finally {
      loading = false;
    }
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
        ? `<span>${esc(tx(scene))}</span><span title="${esc(tx("rainChance"))}">💧${data.rain}%</span><span>${num(data.max)} / ${num(data.min)}</span>`
        : `<span>${esc(tx("loading"))}</span>`;
      card.dataset.scene = scene;
      card.innerHTML = `
        <div class="tw-card-icon">${icon(scene)}</div>
        <div class="tw-card-main">
          <div class="tw-card-temp"><strong>${num(data?.temp)}</strong>${data ? `<small>${esc(tx("feels"))} ${num(data.feels)}</small>` : ""}</div>
          <div class="tw-card-meta">${meta}</div>
          ${data && data.rain >= 60 && scene !== "rain" && scene !== "storm" ? `<div class="tw-card-tip">☂ ${esc(tx("umbrella"))}</div>` : ""}
        </div>
        <div class="tw-card-time"><strong data-tw-clock>${esc(clock)}</strong><small>${esc(ampm || PLACE.name)}</small></div>`;
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
    load(false);
    setInterval(tick, 15000);
    setInterval(() => load(false), MAX_AGE);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) load(false); });
  }

  return { init, render, load, sceneOf, icon };
})();

if (typeof window !== "undefined") window.TopbarWeather = TopbarWeather;
