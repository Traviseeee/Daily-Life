/* Report Center (#money/reports, top): a history of report images like the ones
 * the Telegram bot sends — Day / Week / Month tabs, one card per period with
 * spend, income, change vs the period before and a mini chart. Tapping a card
 * opens the designed image with ⬇ JPG, Excel (month) and ✈️ Telegram.
 * Images are drawn on demand from the data, so nothing new is stored. */
const ReportCenter = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const SENT_KEY = "mylife:report-sent-log";
  const FONT = '"Noto Sans Khmer","Khmer OS System","Leelawadee UI",Inter,Calibri,Arial,sans-serif';
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const KM_DAYS = ["អាទិត្យ", "ចន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
  let tab = "day";
  // money() returns HTML (privacy span); the image and Telegram caption need plain text
  const cash = (value, currency) => String(money(value, currency)).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&");

  /* ---------- data ---------- */
  const iso = date => localDateInput(date);
  const addDays = (value, n) => { const d = new Date(`${value}T00:00:00`); d.setDate(d.getDate() + n); return iso(d); };
  const inRange = (item, from, to) => item.date && item.date >= from && item.date <= to;
  const mondayOf = value => { const d = new Date(`${value}T00:00:00`); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return iso(d); };
  const monthEnd = month => { const [y, m] = month.split("-").map(Number); return iso(new Date(y, m, 0)); };
  const prevMonth = month => { const [y, m] = month.split("-").map(Number); return `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`; };

  function periodOf(kind, key) {
    if (kind === "day") return { kind, key, from: key, to: key, prev: { from: addDays(key, -1), to: addDays(key, -1) } };
    if (kind === "week") return { kind, key, from: key, to: addDays(key, 6), prev: { from: addDays(key, -7), to: addDays(key, -1) } };
    const p = prevMonth(key);
    return { kind, key, from: `${key}-01`, to: monthEnd(key), prev: { from: `${p}-01`, to: monthEnd(p) } };
  }
  function stats(period) {
    const expenses = (appData.expenses || []).filter(item => inRange(item, period.from, period.to));
    const income = (appData.income || []).filter(item => inRange(item, period.from, period.to));
    const prevSpend = sumMoney((appData.expenses || []).filter(item => inRange(item, period.prev.from, period.prev.to)), "amount");
    const spend = sumMoney(expenses, "amount");
    const cats = {};
    expenses.forEach(item => { const c = typeof expenseGroupOf === "function" ? expenseGroupOf(item) : (item.category || "Other"); cats[c] = (cats[c] || 0) + toProfileCurrency(item.amount, item.currency); });
    const categories = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    // mini chart: per day (week / month) or per category (day)
    let bars = [];
    // day: the 7 days ending that day (a single full bar looked like a blank square)
    if (period.kind === "day") for (let d = addDays(period.key, -6); d <= period.key; d = addDays(d, 1)) bars.push(sumMoney((appData.expenses || []).filter(item => item.date === d), "amount"));
    else for (let d = period.from; d <= period.to; d = addDays(d, 1)) bars.push(sumMoney(expenses.filter(item => item.date === d), "amount"));
    return {
      expenses: expenses.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || toProfileCurrency(b.amount, b.currency) - toProfileCurrency(a.amount, a.currency)),
      count: expenses.length,
      spend,
      income: sumMoney(income, "amount"),
      prevSpend,
      change: prevSpend ? Math.round(((spend - prevSpend) / prevSpend) * 100) : null,
      categories,
      bars
    };
  }
  function label(period, long = false) {
    const [y, m, d] = period.key.split("-").map(Number);
    if (period.kind === "month") return km() ? `ខែ${KM_MONTHS[m - 1]} ${y}` : new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (period.kind === "day") {
      const date = new Date(y, m - 1, d);
      const today = iso(new Date());
      const rel = period.key === today ? L("ថ្ងៃនេះ", "Today") : period.key === addDays(today, -1) ? L("ម្សិលមិញ", "Yesterday") : "";
      const text = km() ? `${KM_DAYS[date.getDay()]} ${d} ${KM_MONTHS[m - 1]}${long ? ` ${y}` : ""}` : date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", ...(long ? { year: "numeric" } : {}) });
      return rel && !long ? `${rel} · ${text}` : text;
    }
    const end = new Date(`${period.to}T00:00:00`);
    const a = km() ? `${d} ${KM_MONTHS[m - 1]}` : new Date(y, m - 1, d).toLocaleDateString("en-US", { day: "numeric", month: "short" });
    const b = km() ? `${end.getDate()} ${KM_MONTHS[end.getMonth()]}` : end.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    return `${a} – ${b}${long ? ` ${end.getFullYear()}` : ""}`;
  }
  function history(kind) {
    const today = iso(new Date());
    const keys = [];
    if (kind === "day") for (let i = 0; i < 14; i += 1) keys.push(addDays(today, -i));
    else if (kind === "week") { const w = mondayOf(today); for (let i = 0; i < 10; i += 1) keys.push(addDays(w, -7 * i)); }
    else {
      let m = today.slice(0, 7);
      const first = (appData.expenses || []).reduce((min, item) => (item.date && item.date < min ? item.date : min), today).slice(0, 7);
      for (let i = 0; i < 24 && m >= first; i += 1) { keys.push(m); m = prevMonth(m); }
    }
    return keys.map(key => periodOf(kind, key)).map(period => ({ period, s: stats(period) }))
      .filter(({ period, s }, index) => index === 0 || s.count || s.income || period.kind === "week");
  }

  /* ---------- sent log (this device + the server's monthly auto send) ---------- */
  const sentKey = period => `${period.kind}:${period.key}`;
  function sentLog() { try { return JSON.parse(localStorage.getItem(SENT_KEY) || "{}") || {}; } catch (error) { return {}; } }
  function markSent(period) {
    try { const log = sentLog(); log[sentKey(period)] = Date.now(); localStorage.setItem(SENT_KEY, JSON.stringify(log)); } catch (error) { /* private mode */ }
  }
  const wasSent = period => Boolean(sentLog()[sentKey(period)]) || (period.kind === "month" && appData.profile?.lastReportSent === period.key);

  /* ---------- list ---------- */
  function mini(bars) {
    const max = Math.max(...bars, 0.0001);
    const list = bars.length ? bars : [0];
    return `<span class="rc-mini" aria-hidden="true">${list.map(v => `<i style="height:${Math.max(6, Math.round((v / max) * 100))}%"></i>`).join("")}</span>`;
  }
  function card({ period, s }) {
    const up = s.change !== null && s.change > 0;
    const change = s.change === null ? "" : `<span class="rc-chg ${up ? "is-up" : "is-down"}">${up ? "▲" : "▼"} ${Math.abs(s.change)}%</span>`;
    const top = s.categories[0] ? `${escapeHtml(optionLabel(s.categories[0][0]))}` : L("គ្មានចំណាយ", "No spending");
    return `<button type="button" class="rc-card" data-rc-open="${period.kind}:${period.key}">
      <span class="rc-thumb">${mini(s.bars)}<b>${period.kind === "day" ? L("ថ្ងៃ", "Day") : period.kind === "week" ? L("សប្តាហ៍", "Week") : L("ខែ", "Month")}</b></span>
      <span class="rc-copy">
        <strong>${escapeHtml(label(period))}</strong>
        <span class="rc-nums"><b class="rc-out">-${money(s.spend)}</b>${s.income ? `<b class="rc-in">+${money(s.income)}</b>` : ""}${change}</span>
        <small>${s.count} ${L("ចំណាយ", "expenses")} · ${top}${wasSent(period) ? ` · <span class="rc-sent">✓ ${L("បានផ្ញើ Telegram", "Sent to Telegram")}</span>` : ""}</small>
      </span>
      <span class="rc-go" aria-hidden="true">›</span>
    </button>`;
  }
  function render() {
    const tabs = [["day", L("ថ្ងៃ", "Day")], ["week", L("សប្តាហ៍", "Week")], ["month", L("ខែ", "Month")]];
    const list = history(tab);
    return `<article class="rc-panel" data-rc>
      <div class="rc-head"><div><span class="rc-eyebrow">📊 ${L("មជ្ឈមណ្ឌលរបាយការណ៍", "Report Center")}</span><h2>${L("ប្រវត្តិរបាយការណ៍", "Report history")}</h2></div></div>
      <div class="rc-seg" role="tablist">${tabs.map(([id, text]) => `<button type="button" role="tab" aria-selected="${tab === id}" class="${tab === id ? "is-on" : ""}" data-rc-tab="${id}">${text}</button>`).join("")}</div>
      <div class="rc-list">${list.map(card).join("")}</div>
    </article>`;
  }

  /* ---------- day / week image (month uses the existing monthly design) ---------- */
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function fit(c, text, max) {
    let value = String(text || "");
    while (value.length > 1 && c.measureText(value).width > max) value = value.slice(0, -2);
    return value === String(text || "") ? value : `${value}…`;
  }
  async function drawPeriod(period) {
    const s = stats(period);
    if (document.fonts?.load) await Promise.all(["500", "600", "700", "800"].map(w => document.fonts.load(`${w} 24px "Noto Sans Khmer"`, "ក").catch(() => null)));
    const W = 1080, M = 56;
    const rows = s.expenses.slice(0, 10);
    const cats = s.categories.slice(0, 6);
    const H = 560 + cats.length * 64 + 90 + Math.max(1, rows.length) * 56 + 120;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext("2d");
    c.textBaseline = "top";
    c.fillStyle = "#f4f7fb"; c.fillRect(0, 0, W, H);
    // header
    const g = c.createLinearGradient(0, 0, W, 300);
    g.addColorStop(0, "#0f2a1c"); g.addColorStop(1, "#1f4a33");
    c.fillStyle = g; c.fillRect(0, 0, W, 300);
    c.fillStyle = "#c5ff60"; c.font = `800 26px ${FONT}`;
    c.fillText(`MYLIFE · ${period.kind === "day" ? L("របាយការណ៍ប្រចាំថ្ងៃ", "Daily report") : L("របាយការណ៍ប្រចាំសប្តាហ៍", "Weekly report")}`, M, 52);
    c.fillStyle = "#ffffff"; c.font = `800 52px ${FONT}`;
    c.fillText(label(period, true), M, 100);
    c.fillStyle = "rgba(255,255,255,.72)"; c.font = `500 24px ${FONT}`;
    c.fillText(`${appData.profile?.name || "MYLIFE"} · ${s.count} ${L("ចំណាយ", "expenses")}`, M, 182);
    // KPI cards
    const kpis = [
      [L("ចំណាយ", "Spent"), `-${cash(s.spend)}`, "#d1384f"],
      [L("ចំណូល", "Income"), `+${cash(s.income)}`, "#16803c"],
      [L("ធៀបមុន", "vs before"), s.change === null ? "—" : `${s.change > 0 ? "▲" : "▼"} ${Math.abs(s.change)}%`, s.change > 0 ? "#d1384f" : "#16803c"]
    ];
    const kw = (W - M * 2 - 32) / 3;
    kpis.forEach(([name, value, color], i) => {
      const x = M + i * (kw + 16);
      c.fillStyle = "#ffffff"; roundRect(c, x, 250, kw, 150, 26); c.fill();
      c.strokeStyle = "#e3e9f1"; c.lineWidth = 2; c.stroke();
      c.fillStyle = "#6b7a72"; c.font = `600 22px ${FONT}`; c.fillText(name, x + 26, 278);
      c.fillStyle = color; c.font = `800 38px ${FONT}`; c.fillText(fit(c, value, kw - 40), x + 26, 324);
    });
    let y = 450;
    // categories
    c.fillStyle = "#14231b"; c.font = `800 30px ${FONT}`; c.fillText(L("តាមប្រភេទ", "By category"), M, y); y += 62;
    const max = Math.max(...cats.map(([, v]) => v), 0.0001);
    if (!cats.length) { c.fillStyle = "#8a968f"; c.font = `500 24px ${FONT}`; c.fillText(L("គ្មានចំណាយ", "No spending"), M, y); y += 64; }
    cats.forEach(([name, value]) => {
      c.fillStyle = "#26302a"; c.font = `600 24px ${FONT}`; c.fillText(fit(c, optionLabel(name), 260), M, y + 4);
      c.fillStyle = "#e6ecf3"; roundRect(c, M + 280, y + 8, 520, 22, 11); c.fill();
      c.fillStyle = (typeof expenseCategoryColors !== "undefined" && expenseCategoryColors[name]) || "#5b8def";
      roundRect(c, M + 280, y + 8, Math.max(22, 520 * (value / max)), 22, 11); c.fill();
      c.fillStyle = "#14231b"; c.font = `700 24px ${FONT}`; c.textAlign = "right"; c.fillText(cash(value), W - M, y + 4); c.textAlign = "left";
      y += 64;
    });
    y += 26;
    // transactions
    c.fillStyle = "#14231b"; c.font = `800 30px ${FONT}`; c.fillText(L("ចំណាយធំៗ", "Expenses"), M, y); y += 58;
    c.fillStyle = "#ffffff"; roundRect(c, M, y, W - M * 2, Math.max(1, rows.length) * 56 + 16, 24); c.fill();
    y += 8;
    if (!rows.length) { c.fillStyle = "#8a968f"; c.font = `500 22px ${FONT}`; c.fillText(L("គ្មានទិន្នន័យ", "Nothing recorded"), M + 24, y + 14); }
    rows.forEach((item, i) => {
      if (i) { c.fillStyle = "#eef2f6"; c.fillRect(M + 24, y, W - M * 2 - 48, 2); }
      const name = (typeof expenseName === "function" ? expenseName(item) : item.description) || optionLabel(item.category || "Other");
      c.fillStyle = "#26302a"; c.font = `600 22px ${FONT}`;
      c.fillText(fit(c, `${period.kind === "week" ? `${item.date.slice(8)} · ` : ""}${name}`, W - M * 2 - 260), M + 24, y + 15);
      c.fillStyle = "#d1384f"; c.font = `700 22px ${FONT}`; c.textAlign = "right"; c.fillText(`-${cash(item.amount, item.currency)}`, W - M - 24, y + 15); c.textAlign = "left";
      y += 56;
    });
    c.fillStyle = "#8a968f"; c.font = `500 18px ${FONT}`;
    c.fillText(`${L("បង្កើតនៅ", "Generated")} ${new Date().toLocaleString(km() ? "km-KH" : "en-US")} · MYLIFE`, M, H - 70);
    c.fillStyle = "#c5ff60"; c.fillRect(0, H - 12, W, 12);
    return canvas;
  }
  async function canvasFor(period) {
    if (period.kind === "month") return typeof getMonthlyFinanceReportCanvas === "function" ? getMonthlyFinanceReportCanvas(period.key) : ReportCanvas.draw(period.key);
    return drawPeriod(period);
  }

  // 💡 insights under the image (month: the full monthly insights; day / week: quick facts)
  function insightsHtml(period) {
    let list = [];
    if (period.kind === "month" && typeof ReportInsights !== "undefined") {
      try { list = ReportInsights.build(period.key).insights.map(item => ({ text: item.text, tone: item.tone })); } catch (error) { list = []; }
    } else {
      const s = stats(period);
      if (s.categories[0]) list.push({ text: L(`ចាយច្រើនជាងគេលើ ${optionLabel(s.categories[0][0])} · ${cash(s.categories[0][1])}`, `Most on ${optionLabel(s.categories[0][0])} · ${cash(s.categories[0][1])}`), tone: "info" });
      if (s.change !== null) list.push({ text: s.change > 0 ? L(`ចាយច្រើនជាងមុន ${s.change}%`, `${s.change}% more than before`) : L(`ចាយតិចជាងមុន ${Math.abs(s.change)}% 👍`, `${Math.abs(s.change)}% less than before 👍`), tone: s.change > 0 ? "warn" : "good" });
      if (!s.count) list.push({ text: L("មិនមានចំណាយទេ 🎉", "No spending 🎉"), tone: "good" });
    }
    if (!list.length) return "";
    return `<div class="rc-v-ins"><b>💡 ${L("ការយល់ដឹង", "Insights")}</b><ul>${list.slice(0, 5).map(item => `<li class="is-${escapeAttr(item.tone || "info")}">${escapeHtml(item.text)}</li>`).join("")}</ul></div>`;
  }

  /* ---------- viewer ---------- */
  let current = null;
  async function open(id) {
    const [kind, key] = id.split(":");
    const period = periodOf(kind, key);
    current = { period, canvas: null };
    const box = document.createElement("div");
    box.className = "rc-viewer";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = `<div class="rc-v-card">
      <div class="rc-v-head"><div><span>${period.kind === "day" ? L("របាយការណ៍ប្រចាំថ្ងៃ", "Daily report") : period.kind === "week" ? L("របាយការណ៍ប្រចាំសប្តាហ៍", "Weekly report") : L("របាយការណ៍ប្រចាំខែ", "Monthly report")}</span><strong>${escapeHtml(label(period, true))}</strong></div><button type="button" class="rc-v-x" data-rc-close aria-label="${L("បិទ", "Close")}">✕</button></div>
      <div class="rc-v-stage"><span class="rc-v-wait">${L("កំពុងបង្កើតរូប…", "Drawing…")}</span></div>
      ${insightsHtml(period)}
      <div class="rc-v-actions">
        <button type="button" class="rc-v-btn" data-rc-jpg>⬇ JPG</button>
        ${period.kind === "month" ? `<button type="button" class="rc-v-btn" data-rc-xlsx>📑 Excel</button><button type="button" class="rc-v-btn" data-rc-word>📝 Word</button>` : ""}
        <button type="button" class="rc-v-btn is-tg" data-rc-tg>✈️ Telegram</button>
      </div></div>`;
    document.body.appendChild(box);
    box.addEventListener("click", event => {
      if (event.target === box || event.target.closest("[data-rc-close]")) close();
      else if (event.target.closest("[data-rc-jpg]")) downloadJpg();
      else if (event.target.closest("[data-rc-xlsx]")) ReportXlsx?.download?.(period.key);
      else if (event.target.closest("[data-rc-word]") && typeof exportMonthlyFinanceReport === "function") { financeReportMonth = period.key; exportMonthlyFinanceReport("word"); }
      else if (event.target.closest("[data-rc-tg]")) sendTelegram(event.target.closest("[data-rc-tg]"));
    });
    document.addEventListener("keydown", onKey);
    try {
      const canvas = await canvasFor(period);
      if (!current || current.period !== period) return;
      current.canvas = canvas;
      const img = new Image();
      img.alt = label(period, true);
      img.src = canvas.toDataURL("image/jpeg", 0.88);
      box.querySelector(".rc-v-stage").replaceChildren(img);
    } catch (error) {
      box.querySelector(".rc-v-wait").textContent = L("បង្កើតរូបមិនបាន", "Couldn't draw the report");
    }
  }
  const onKey = event => { if (event.key === "Escape") close(); };
  function close() {
    document.querySelector(".rc-viewer")?.remove();
    document.removeEventListener("keydown", onKey);
    current = null;
  }
  function fileName(period) { return `mylife-${period.kind}-${period.key}.jpg`; }
  function downloadJpg() {
    if (!current?.canvas) return;
    const link = document.createElement("a");
    link.download = fileName(current.period);
    link.href = current.canvas.toDataURL("image/jpeg", 0.92);
    link.click();
  }
  async function blobToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }
  async function sendTelegram(button) {
    if (!current?.canvas || button.disabled) return;
    const { period, canvas } = current;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = L("កំពុងផ្ញើ…", "Sending…");
    try {
      if (period.kind === "month" && typeof ReportTelegram !== "undefined") await ReportTelegram.send(period.key);
      else {
        const token = typeof ReportTelegram !== "undefined" ? await ReportTelegram.accessToken() : "";
        if (!token) throw new Error("not_signed_in");
        const s = stats(period);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
        const response = await fetch("/api/report-send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            month: period.key.slice(0, 7),
            period: `${period.kind}:${period.key}`,
            caption: `📊 <b>${escapeHtml(label(period, true))}</b>\n💸 ${L("ចំណាយ", "Spent")} ${escapeHtml(cash(s.spend))}${s.income ? ` · 💰 ${L("ចំណូល", "Income")} ${escapeHtml(cash(s.income))}` : ""}`,
            jpg: await blobToBase64(blob)
          })
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error || `send_${response.status}`);
      }
      markSent(period);
      Toast.show(L("📤 បានផ្ញើទៅ Telegram", "📤 Sent to Telegram"), "success", { sound: "notify" });
      refreshList();
    } catch (error) {
      Toast.show(error.message === "not_signed_in" ? L("សូម login សិន ដើម្បីផ្ញើទៅ Telegram", "Sign in first to send to Telegram")
        : error.message === "wait" ? L("ទើបផ្ញើរួច សូមរង់ចាំបន្តិច", "Just sent — wait a moment")
          : L("ផ្ញើមិនបាន សូមសាកម្ដងទៀត", "Couldn't send, try again"), "warning");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }
  function refreshList() {
    const panel = document.querySelector("[data-rc]");
    if (panel) panel.outerHTML = render();
  }

  document.addEventListener("click", event => {
    const tabButton = event.target.closest("[data-rc-tab]");
    if (tabButton) { tab = tabButton.dataset.rcTab; refreshList(); return; }
    const cardButton = event.target.closest("[data-rc-open]");
    if (cardButton) open(cardButton.dataset.rcOpen);
  });

  return { render, open, close, drawPeriod };
})();
