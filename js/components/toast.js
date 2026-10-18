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
  unlock() {
    this.unlocked = true;
    this.ensureContext();
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
    tap: (s, c) => s.tone(c, { freq: 520, to: 620, dur: 0.06, gain: 0.022 }),
    pop: (s, c) => s.tone(c, { freq: 700, to: 980, dur: 0.07, gain: 0.03, type: "triangle" }),
    toggleOn: (s, c) => { s.tone(c, { freq: 600, dur: 0.06, gain: 0.03 }); s.tone(c, { at: 0.05, freq: 900, dur: 0.08, gain: 0.03 }); },
    toggleOff: (s, c) => { s.tone(c, { freq: 800, dur: 0.06, gain: 0.028 }); s.tone(c, { at: 0.05, freq: 520, dur: 0.08, gain: 0.026 }); },
    open: (s, c) => s.tone(c, { freq: 380, to: 760, dur: 0.16, gain: 0.03, type: "triangle", attack: 0.02 }),
    close: (s, c) => s.tone(c, { freq: 700, to: 360, dur: 0.14, gain: 0.025, type: "triangle", attack: 0.01 }),
    nav: (s, c) => s.tone(c, { freq: 880, dur: 0.035, gain: 0.012 }),
    success: (s, c) => { s.tone(c, { freq: 660, dur: 0.12, gain: 0.04 }); s.tone(c, { at: 0.09, freq: 990, dur: 0.18, gain: 0.04 }); },
    coin: (s, c) => { s.tone(c, { freq: 988, dur: 0.08, gain: 0.04, type: "square" }); s.tone(c, { at: 0.07, freq: 1319, dur: 0.22, gain: 0.035, type: "square" }); },
    delete: (s, c) => { s.noise(c, { dur: 0.18, gain: 0.05 }); s.tone(c, { freq: 420, to: 180, dur: 0.18, gain: 0.025 }); },
    warning: (s, c) => { s.tone(c, { freq: 520, dur: 0.1, gain: 0.04, type: "triangle" }); s.tone(c, { at: 0.13, freq: 520, dur: 0.12, gain: 0.04, type: "triangle" }); },
    error: (s, c) => { s.tone(c, { freq: 440, to: 300, dur: 0.14, gain: 0.045, type: "sawtooth" }); s.tone(c, { at: 0.12, freq: 300, to: 200, dur: 0.2, gain: 0.04, type: "sawtooth" }); },
    notify: (s, c) => { s.tone(c, { freq: 1046, dur: 0.5, gain: 0.05, attack: 0.005 }); s.tone(c, { freq: 2093, dur: 0.35, gain: 0.015, attack: 0.005 }); s.tone(c, { at: 0.18, freq: 1318, dur: 0.6, gain: 0.04, attack: 0.005 }); },
    celebrate: (s, c) => [523, 659, 784, 1046].forEach((f, i) => s.tone(c, { at: i * 0.08, freq: f, dur: 0.22, gain: 0.04, type: "triangle" }))
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
    if (!ctx) return;
    this.master.gain.setValueAtTime(this.volume() * 1.6, ctx.currentTime);
    try { recipe(this, ctx); } catch (error) { /* audio is best-effort */ }
  },
  // Settings preview: plays a few sounds in a row
  preview() {
    this.unlock();
    ["tap", "pop", "success", "coin", "notify", "celebrate"].forEach((name, i) => setTimeout(() => this.play(name, { force: true }), i * 520));
  }
};

window.Sound = Sound;
["pointerdown", "keydown", "touchstart"].forEach(eventName => {
  window.addEventListener(eventName, () => Sound.unlock(), { once: true, passive: true });
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
    setTimeout(() => node.remove(), duration);
  }
};
