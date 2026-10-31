/* MYLIFE sound effects — small synthesized sounds (no audio files).
 * Sound.play(name) with: tap, pop, toggleOn, toggleOff, open, close, nav,
 * success, coin, delete, warning, error, notify, celebrate.
 * - follows Settings → sound on/off and volume (profile.soundVolume 0–100)
 * - a short "priority" window stops a toast sound from doubling a specific one
 *   (e.g. adding an expense plays "coin", not "coin" + "success")
 * - light haptics on phones for success / warning / error / celebrate */
const Sound = {
  context: null,
  master: null,
  enabled: true,
  unlocked: false,
  last: { at: 0, priority: -1 },
  PRIORITY: { tap: 0, nav: 0, pop: 1, toggleOn: 1, toggleOff: 1, open: 1, close: 1, success: 2, warning: 2, coin: 3, delete: 3, error: 3, notify: 3, celebrate: 4 },
  HAPTIC: { success: 12, coin: [10, 40, 10], warning: [20, 60, 20], error: [40, 50, 40], delete: 18, celebrate: [12, 40, 12, 40, 30], notify: [30, 80, 30] },
  ensureContext() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor || !this.enabled || !this.unlocked) return null;
    if (!this.context) {
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return this.context;
  },
  // a sound the browser blocked (no touch yet / app was in background):
  // it plays on the next touch if that comes within 15 s
  pending: null,
  unlock() {
    this.unlocked = true;
    const ctx = this.ensureContext();
    if (!this.pending) return;
    const { type, at } = this.pending;
    this.pending = null;
    if (performance.now() - at > 15000 || !ctx) return;
    const go = () => {
      this.master.gain.setValueAtTime(this.volume() * 1.6, ctx.currentTime);
      try { this.RECIPES[type](this, ctx); } catch (error) { /* best-effort */ }
    };
    if (ctx.state === "running") go();
    else ctx.resume().then(go).catch(() => {});
  },
  volume() {
    const raw = Number(window.appData?.profile?.soundVolume);
    return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) / 100 : 0.7;
  },
  // one short tone: frequency glide + soft attack/decay envelope
  tone(ctx, { at = 0, freq = 440, to = null, dur = 0.12, type = "sine", gain = 0.05, attack = 0.008 }) {
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur * 0.9);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  },
  noise(ctx, { at = 0, dur = 0.14, gain = 0.03, from = 2400, to = 500 }) {
    const start = ctx.currentTime + at;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    src.start(start);
    src.stop(start + dur + 0.02);
  },
  RECIPES: {
    tap: (s, c) => s.tone(c, { freq: 900, to: 1200, dur: 0.05, gain: 0.026 }),
    // Nomi (31 Oct): C hello · A pip-pip · D boing-hop · E purr-chirp · B nyaa
    nomiHello: (s, c) => { s.tone(c, { freq: 784, to: 800, dur: 0.13, gain: 0.07 }); s.tone(c, { at: 0.12, freq: 988, to: 1000, dur: 0.13, gain: 0.07 }); s.tone(c, { at: 0.24, freq: 1175, to: 1200, dur: 0.22, gain: 0.07 }); s.tone(c, { at: 0.36, freq: 2350, to: 2397, dur: 0.18, gain: 0.025, type: "triangle" }); s.tone(c, { at: 0.44, freq: 2794, to: 2850, dur: 0.18, gain: 0.025, type: "triangle" }); },
    nomiPip: (s, c) => { s.tone(c, { freq: 880, to: 1320, dur: 0.12, gain: 0.07 }); s.tone(c, { at: 0.14, freq: 990, to: 1560, dur: 0.16, gain: 0.07 }); },
    nomiHop: (s, c) => { s.tone(c, { freq: 300, to: 900, dur: 0.16, gain: 0.075 }); s.tone(c, { at: 0.16, freq: 900, to: 1400, dur: 0.12, gain: 0.05 }); },
    nomiNyaa: (s, c) => { s.tone(c, { freq: 620, to: 1040, dur: 0.18, gain: 0.065 }); s.tone(c, { at: 0.17, freq: 1040, to: 760, dur: 0.32, gain: 0.06 }); },
    nomiPurr: (s, c) => {
      const t = c.currentTime, o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
      o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(950, t + 0.3);
      l.frequency.value = 28; lg.gain.value = 40; l.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.055, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g); g.connect(s.master); o.start(t); l.start(t); o.stop(t + 0.34); l.stop(t + 0.34);
      s.tone(c, { at: 0.33, freq: 1100, to: 1700, dur: 0.14, gain: 0.06 });
    },
    // UI sounds in Nomi's voice (31 Oct): soft round sine "bubbles", upward glides and a little sparkle
    pop: (s, c) => s.tone(c, { freq: 700, to: 1200, dur: 0.08, gain: 0.04 }),
    toggleOn: (s, c) => { s.tone(c, { freq: 880, to: 1320, dur: 0.07, gain: 0.04 }); s.tone(c, { at: 0.07, freq: 1320, to: 1760, dur: 0.08, gain: 0.032 }); },
    toggleOff: (s, c) => s.tone(c, { freq: 1100, to: 700, dur: 0.11, gain: 0.035 }),
    open: (s, c) => { s.tone(c, { freq: 500, to: 1000, dur: 0.14, gain: 0.04, attack: 0.015 }); s.tone(c, { at: 0.1, freq: 2000, to: 2100, dur: 0.12, gain: 0.012, type: "triangle" }); },
    close: (s, c) => s.tone(c, { freq: 1000, to: 520, dur: 0.12, gain: 0.032, attack: 0.01 }),
    nav: (s, c) => s.tone(c, { freq: 1300, to: 1500, dur: 0.04, gain: 0.018 }),
    success: (s, c) => { s.tone(c, { freq: 784, to: 800, dur: 0.11, gain: 0.05 }); s.tone(c, { at: 0.1, freq: 988, to: 1010, dur: 0.16, gain: 0.05 }); s.tone(c, { at: 0.2, freq: 2350, to: 2400, dur: 0.16, gain: 0.018, type: "triangle" }); },
    coin: (s, c) => { s.tone(c, { freq: 1320, to: 1760, dur: 0.08, gain: 0.045 }); s.tone(c, { at: 0.08, freq: 1760, to: 2350, dur: 0.14, gain: 0.04 }); s.tone(c, { at: 0.18, freq: 2794, to: 2850, dur: 0.12, gain: 0.014, type: "triangle" }); },
    delete: (s, c) => { s.tone(c, { freq: 620, to: 240, dur: 0.18, gain: 0.045 }); s.noise(c, { dur: 0.12, gain: 0.015, from: 1800, to: 400 }); },
    warning: (s, c) => { s.tone(c, { freq: 620, to: 1040, dur: 0.14, gain: 0.045 }); s.tone(c, { at: 0.14, freq: 1040, to: 760, dur: 0.22, gain: 0.04 }); },
    error: (s, c) => { s.tone(c, { freq: 560, to: 420, dur: 0.14, gain: 0.05 }); s.tone(c, { at: 0.14, freq: 420, to: 300, dur: 0.24, gain: 0.045 }); },
    notify: (s, c) => { s.tone(c, { freq: 784, to: 800, dur: 0.13, gain: 0.06 }); s.tone(c, { at: 0.12, freq: 988, to: 1000, dur: 0.13, gain: 0.06 }); s.tone(c, { at: 0.24, freq: 1175, to: 1200, dur: 0.26, gain: 0.06 }); s.tone(c, { at: 0.36, freq: 2350, to: 2400, dur: 0.2, gain: 0.02, type: "triangle" }); },
    celebrate: (s, c) => { [523, 659, 784, 1046].forEach((f, i) => s.tone(c, { at: i * 0.08, freq: f, to: f * 1.02, dur: 0.2, gain: 0.05 })); [2350, 2794, 3136].forEach((f, i) => s.tone(c, { at: 0.34 + i * 0.07, freq: f, to: f * 1.02, dur: 0.16, gain: 0.016, type: "triangle" })); }
  },
  play(type = "tap", { force = false } = {}) {
    this.enabled = window.appData?.profile?.soundEnabled !== false;
    if (!this.enabled && !force) return;
    if (force) this.enabled = true;
    const recipe = this.RECIPES[type] || this.RECIPES.tap;
    const priority = this.PRIORITY[type] ?? 0;
    const now = performance.now();
    // a more important sound just played: skip this one (no doubling)
    if (!force && now - this.last.at < 260 && priority <= this.last.priority && priority < 3) return;
    if (!force && now - this.last.at < 40) return;
    this.last = { at: now, priority };
    if (this.HAPTIC[type] && navigator.vibrate && window.appData?.profile?.haptics !== false) {
      try { navigator.vibrate(this.HAPTIC[type]); } catch (error) { /* ignore */ }
    }
    const ctx = this.ensureContext();
    const important = priority >= 2;
    if (!ctx) {
      if (important) this.pending = { type: this.RECIPES[type] ? type : "tap", at: now };
      return;
    }
    const go = () => {
      this.master.gain.setValueAtTime(this.volume() * 1.6, ctx.currentTime);
      try { recipe(this, ctx); } catch (error) { /* audio is best-effort */ }
    };
    if (ctx.state === "running") {
      go();
      return;
    }
    // suspended (no touch yet or back from background): try, else wait for a touch
    if (important) this.pending = { type: this.RECIPES[type] ? type : "tap", at: now };
    ctx.resume().then(() => {
      if (ctx.state !== "running" || !this.pending || this.pending.at !== now) return;
      this.pending = null;
      go();
    }).catch(() => {});
  },
  // Settings preview: plays a few sounds in a row
  preview() {
    this.unlock();
    ["nomiHello", "tap", "pop", "toggleOn", "success", "coin", "notify", "celebrate"].forEach((name, i) => setTimeout(() => this.play(name, { force: true }), i * 560));
  }
};

window.Sound = Sound;
// every touch keeps audio alive (phones suspend it in the background) and plays a waiting sound
["pointerdown", "keydown", "touchstart"].forEach(eventName => {
  window.addEventListener(eventName, () => Sound.unlock(), { passive: true, capture: true });
});

const Toast = {
  show(message, tone = "success", options = {}) {
    const stack = document.getElementById("toastStack");
    if (!stack) return;

    const { icon = Icons.check(), duration = 2600 } = options;
    const node = document.createElement("div");
    node.className = `toast toast-${tone}`;
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    stack.appendChild(node);

    Sound.play(options.sound || (tone === "danger" ? "error" : tone === "warning" ? "warning" : "success"));
    setTimeout(() => {
      node.classList.add("is-leaving");
      setTimeout(() => node.remove(), 170);
    }, duration);
  }
};
