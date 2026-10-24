// Header weather (option D): live weather for Phnom Penh from Open-Meteo
// (free, no API key) with animated sun / moon / cloud / rain / storm icons.
// - #topbarWeather   : small chip (icon + temp) — desktop + compact mobile header
// - #topbarWxCard    : weather card — mobile header on the Home page only
// - #topbarGreet     : greeting + date — mobile Home header
// Cached 30 min in localStorage; without network the last value (or a neutral
// placeholder) is shown, nothing else in the app depends on it.
const TopbarWeather = (() => {
  const PLACE = { name: "Phnom Penh", lat: 11.5564, lon: 104.9282 };
  const CACHE_KEY = "mylife:weather:v3";
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
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_mean&hourly=temperature_2m,weather_code,precipitation_probability,is_day&timezone=auto&forecast_days=7`;
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
        humidity: Math.round(c.relative_humidity_2m),
        wind: Math.round(c.wind_speed_10m),
        hours: nextHours(json),
        // 7 days + every hour (for the day pills and the rain alert on Home)
        days: (d.time || []).map((date, i) => ({
          date,
          code: (d.weather_code || [])[i],
          max: Math.round((d.temperature_2m_max || [])[i]),
          min: Math.round((d.temperature_2m_min || [])[i]),
          rain: Math.round((d.precipitation_probability_max || [])[i] || 0),
          wind: Math.round((d.wind_speed_10m_max || [])[i]),
          humidity: Math.round((d.relative_humidity_2m_mean || [])[i])
        })),
        hourly: ((json.hourly || {}).time || []).map((time, i) => ({
          t: String(time).slice(0, 13),
          temp: Math.round((json.hourly.temperature_2m || [])[i]),
          code: (json.hourly.weather_code || [])[i],
          day: (json.hourly.is_day || [])[i] !== 0,
          pop: Math.round((json.hourly.precipitation_probability || [])[i] || 0)
        }))
      };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (error) { /* storage full / private */ }
      render();
      if (!hadData) enter();
      showRainRow();
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


  // Weather pop-up (Home V2 / Launcher chip → centre of the screen): big animated
  // icon, temperature counts up, details + next 12 hours cascade in. css/popups-v2.css
  function closePopup() {
    const node = document.querySelector(".wxp");
    if (!node || node.classList.contains("is-closing")) return;
    node.classList.add("is-closing");
    document.removeEventListener("keydown", popupEsc);
    setTimeout(() => node.remove(), reduceMotion() ? 0 : 200);
  }
  function popupEsc(event) { if (event.key === "Escape") closePopup(); }
  const KM_DAY = ["អាទិ", "ចន្ទ", "អង្គ", "ពុធ", "ព្រហ", "សុក្រ", "សៅរ៍"];
  const KM_MON = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const placeTime = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString(); // Phnom Penh is UTC+7
  const nowKey = () => placeTime().slice(0, 13);
  const dayShort = iso => { const d = new Date(`${iso}T00:00:00`); return km() ? KM_DAY[d.getDay()] : d.toLocaleDateString("en-US", { weekday: "short" }); };
  const dayLong = iso => { const d = new Date(`${iso}T00:00:00`); return km() ? `${KM_DAY[d.getDay()]} ${d.getDate()} ${KM_MON[d.getMonth()]}` : d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }); };
  let popDay = 0;

  function hoursOf(index) {
    if (index === 0) return (Array.isArray(data?.hours) ? data.hours : []).filter((x, i) => i % 2 === 0).slice(0, 6).map((x, i) => ({ ...x, now: i === 0 }));
    const date = data?.days?.[index]?.date;
    return (data?.hourly || []).filter(x => x.t.slice(0, 10) === date && [6, 9, 12, 15, 18, 21].includes(Number(x.t.slice(11, 13))))
      .map(x => ({ h: Number(x.t.slice(11, 13)), temp: x.temp, code: x.code, day: x.day, pop: x.pop }));
  }

  function popupBody(index) {
    const days = (data?.days || []).slice(0, 5);
    const day = days[index];
    const today = index === 0 || !day;
    const scene = today ? sceneOf(data?.code, data ? data.isDay : isDayNow()) : sceneOf(day.code, true);
    const tip = today ? rainTip(scene) : (day.rain >= 60 ? tx("umbrella") : "");
    const temp = today ? data?.temp : day.max;
    const stat = (label, value) => `<span class="wxp-stat"><small>${esc(label)}</small><b>${esc(value)}</b></span>`;
    const rainPct = today ? (data?.rain || 0) : day.rain;
    const wind = today ? data?.wind : day.wind;
    const hum = today ? data?.humidity : day.humidity;
    const slots = hoursOf(index);
    return `<button type="button" class="wxp-x" data-wxp-close aria-label="Close">×</button>
      <small class="wxp-place">📍 ${esc(PLACE.name)} · ${esc(today ? dateLabel() : dayLong(day.date))}</small>
      <div class="wxp-icon">${icon(scene)}</div>
      <strong class="wxp-temp" data-wxp-temp="${Number(temp)}">${num(temp)}</strong>
      <span class="wxp-cond">${esc(data ? tx(scene) : tx("loading"))}${today ? "" : ` · ${num(day.max)} / ${num(day.min)}`}</span>
      ${days.length > 1 ? `<div class="wxp-days" role="tablist">${days.map((d, i) => `<button type="button" role="tab" class="wxp-day${i === index ? " on" : ""}" data-wxp-day="${i}" aria-selected="${i === index}">${icon(sceneOf(d.code, true))}<b>${new Date(`${d.date}T00:00:00`).getDate()}</b><small>${esc(i === 0 ? (km() ? "ថ្ងៃនេះ" : "Today") : dayShort(d.date))}</small></button>`).join("")}</div>` : ""}
      ${data ? `<div class="wxp-stats">${stat(`💧 ${tx("rainChance")}`, `${rainPct || 0}%`)}${Number.isFinite(wind) ? stat(`🌬 ${km() ? "ខ្យល់" : "Wind"}`, `${wind} km/h`) : stat(tx("feels"), num(data.feels))}${Number.isFinite(hum) ? stat(`💦 ${km() ? "សំណើម" : "Humidity"}`, `${hum}%`) : stat(km() ? "ខ្ពស់ / ទាប" : "High / Low", `${num(data.max)} / ${num(data.min)}`)}</div>` : ""}
      ${slots.length ? `<div class="wxp-hours">${slots.map((x, i) => `<div class="wxp-hour${x.now ? " is-now" : ""}" style="--d:${320 + i * 60}ms"><b>${esc(x.now ? tx("now") : hourLabel(x.h))}</b>${icon(sceneOf(x.code, x.day))}<span>${num(x.temp)}</span><small>${x.pop >= 30 ? `💧${x.pop}%` : "&nbsp;"}</small></div>`).join("")}</div>` : ""}
      ${tip ? `<div class="wxp-tip">☂ ${esc(tip)}</div>` : ""}`;
  }

  function countUp(node) {
    const el = node.querySelector("[data-wxp-temp]");
    const target = Number(el?.dataset.wxpTemp);
    if (!el || reduceMotion() || !Number.isFinite(target) || target === 0) return;
    const start = performance.now() + 120;
    const step = now => {
      const t = Math.max(0, Math.min(1, (now - start) / 600));
      if (!el.isConnected) return;
      el.textContent = num(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = num(0);
    requestAnimationFrame(step);
  }

  function popup() {
    document.querySelector(".wxp")?.remove();
    popDay = 0;
    const scene = sceneOf(data?.code, data ? data.isDay : isDayNow());
    const node = document.createElement("div");
    node.className = "wxp";
    node.dataset.scene = scene;
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-modal", "true");
    node.setAttribute("aria-label", tx(scene));
    node.innerHTML = `<div class="wxp-card" data-scene="${esc(scene)}">${popupBody(0)}</div>`;
    document.body.appendChild(node);
    document.addEventListener("keydown", popupEsc);
    node.addEventListener("click", event => {
      if (event.target === node || event.target.closest("[data-wxp-close]")) return closePopup();
      const pick = event.target.closest("[data-wxp-day]");
      if (!pick || Number(pick.dataset.wxpDay) === popDay) return;
      popDay = Number(pick.dataset.wxpDay);
      const card = node.querySelector(".wxp-card");
      const day = data?.days?.[popDay];
      const sceneNow = popDay === 0 ? sceneOf(data?.code, data ? data.isDay : isDayNow()) : sceneOf(day?.code, true);
      node.dataset.scene = sceneNow;
      card.innerHTML = popupBody(popDay);
      card.classList.remove("is-switch");
      void card.offsetWidth;
      card.classList.add("is-switch");
      countUp(node);
    });
    countUp(node);
    if (!data || !data.days) load(true).then(() => { if (node.isConnected && data) popup(); });
  }

  /* ---------- rain alert on Home ("Coming up" list): only when rain is likely ---------- */
  function rainAlert() {
    if (!data?.hourly?.length) return null;
    const now = nowKey();
    const today = now.slice(0, 10);
    const wet = data.hourly.filter(x => x.t >= now && x.t.slice(0, 10) === today && x.pop >= 60);
    // an event today / tomorrow that falls in a rainy hour
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const soonKeys = new Set(data.hourly.filter(x => x.t >= now && x.t.slice(0, 10) <= tomorrow && x.pop >= 60).map(x => x.t));
    const events = (typeof appData !== "undefined" ? appData.calendarEvents || [] : [])
      .filter(event => event.date && event.time && /^\d{1,2}:\d{2}/.test(event.time))
      .map(event => ({ event, key: `${event.date}T${String(event.time).padStart(5, "0").slice(0, 2)}` }))
      .filter(item => soonKeys.has(item.key))
      .sort((a, b) => a.key.localeCompare(b.key));
    if (events.length) {
      const { event, key } = events[0];
      const hour = data.hourly.find(x => x.t === key);
      const when = key.slice(0, 10) === today ? "" : (km() ? "ស្អែក " : "Tomorrow ");
      return {
        title: `${event.title || (km() ? "ព្រឹត្តិការណ៍" : "Event")} · ${when}${hourLabel(Number(key.slice(11, 13)))}`,
        detail: km() ? `ម៉ោងនោះអាចភ្លៀង ${hour.pop}% · យកឆ័ត្រ` : `${hour.pop}% chance of rain then · take an umbrella`
      };
    }
    if (!wet.length) return null;
    const from = Number(wet[0].t.slice(11, 13));
    const to = Number(wet[wet.length - 1].t.slice(11, 13)) + 1;
    const top = Math.max(...wet.map(x => x.pop));
    const range = to - from > 1 ? `${hourLabel(from)}–${hourLabel(to % 24)}` : hourLabel(from);
    return {
      title: km() ? "ថ្ងៃនេះអាចភ្លៀង" : "Rain likely today",
      detail: km() ? `ប្រហែល ${range} · ${top}% · កុំភ្លេចឆ័ត្រ` : `Around ${range} · ${top}% · bring an umbrella`
    };
  }
  function rainRowHtml() {
    const alert = rainAlert();
    if (!alert) return "";
    return `<button type="button" class="hv2-tl-row hv2-rain" data-wx-open><span class="hv2-tl-time hv2-rain-ic" aria-hidden="true">☂</span><span class="hv2-tl-text"><b>${esc(alert.title)}</b><small>${esc(alert.detail)}</small></span><span class="hv2-tag is-rain">${esc(km() ? "ភ្លៀង" : "Rain")}</span></button>`;
  }
  // weather loaded after Home was drawn: add / drop the row without redrawing the page
  function showRainRow() {
    const list = document.querySelector(".hv2-tl");
    if (!list) return;
    const html = rainRowHtml();
    const row = list.querySelector(".hv2-rain");
    if (!html) { row?.remove(); return; }
    if (row) row.outerHTML = html;
    else { list.querySelector(".hv2-empty")?.remove(); list.insertAdjacentHTML("afterbegin", html); }
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
      if (event.target.closest("[data-hv2-wx], [data-wx-open]")) popup();
    });
    document.addEventListener("keydown", event => {
      if ((event.key === "Enter" || event.key === " ") && event.target.matches?.("#topbarWxCard.can-open")) {
        event.preventDefault();
        toggle();
      }
    });
  }

  return { init, render, load, toggle, sceneOf, icon, popup, rainRowHtml };
})();

if (typeof window !== "undefined") window.TopbarWeather = TopbarWeather;
