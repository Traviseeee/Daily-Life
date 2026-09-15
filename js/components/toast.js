const Sound = {
  context: null,
  enabled: true,
  ensureContext() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor || !this.enabled) return null;
    if (!this.context) {
      this.context = new AudioCtor();
    }
    if (this.context.state === "suspended") {
      this.context.resume();
    }
    return this.context;
  },
  play(type = "tap") {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    const oscillator = ctx.createOscillator();

    oscillator.type = type === "alert" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(type === "alert" ? 660 : 420, now);
    oscillator.frequency.exponentialRampToValueAtTime(type === "alert" ? 980 : 560, now + (type === "alert" ? 0.14 : 0.08));

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(type === "alert" ? 0.055 : 0.03, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + (type === "alert" ? 0.26 : 0.14));

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + (type === "alert" ? 0.26 : 0.14));

    if (type === "alert") {
      const oscillator2 = ctx.createOscillator();
      const gainNode2 = ctx.createGain();
      oscillator2.type = "sine";
      oscillator2.frequency.setValueAtTime(420, now + 0.08);
      oscillator2.frequency.exponentialRampToValueAtTime(530, now + 0.18);
      gainNode2.gain.setValueAtTime(0.0001, now + 0.08);
      gainNode2.gain.exponentialRampToValueAtTime(0.04, now + 0.09);
      gainNode2.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      oscillator2.connect(gainNode2);
      gainNode2.connect(ctx.destination);
      oscillator2.start(now + 0.08);
      oscillator2.stop(now + 0.19);
    }
  }
};

window.Sound = Sound;

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

    Sound.play(tone === "warning" || tone === "danger" ? "alert" : "tap");
    setTimeout(() => node.remove(), duration);
  }
};
