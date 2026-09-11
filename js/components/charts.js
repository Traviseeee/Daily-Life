const Charts = {
  donut(values) {
    const total = values.reduce((n, item) => n + item.value, 0) || 1;
    let offset = 25;
    const circles = values.map(item => {
      const dash = (item.value / total) * 100;
      const html = `<circle cx="21" cy="21" r="15.9" fill="transparent" stroke="${item.color}" stroke-width="5" stroke-dasharray="${dash} ${100 - dash}" stroke-dashoffset="${offset}"/>`;
      offset -= dash;
      return html;
    }).join("");
    return `<svg viewBox="0 0 42 42" width="150" height="150" aria-label="Money chart" role="img"><circle cx="21" cy="21" r="15.9" fill="transparent" stroke="rgba(255,255,255,.08)" stroke-width="5"/>${circles}</svg>`;
  },
  bars(values) {
    const max = Math.max(...values.map(item => item.value), 1);
    return `<div class="grid" style="gap:10px">${values.map(item => `
      <div>
        <div class="between"><span class="secondary">${item.label}</span><strong>${money(item.value)}</strong></div>
        <div class="progress-track"><div class="progress-fill" style="--progress:${(item.value / max) * 100}%; background:${item.color}"></div></div>
      </div>
    `).join("")}</div>`;
  }
};
