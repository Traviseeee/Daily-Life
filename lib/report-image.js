// Finance report pictures for Telegram (weekly on Sunday, monthly on the 1st).
// Text is shaped with HarfBuzz (correct Khmer vowel order) and drawn as glyph
// outlines, then the SVG is turned into PNG with resvg. Fonts: lib/fonts.

const fs = require("fs");
const path = require("path");
const { convert, incomeThisMonth, incomeBetween, monthForecast } = require("./money-insights");
const { CATEGORY_KM, weeklyReport } = require("./money-report");

const FONT_DIR = path.join(__dirname, "fonts");
const KM = "km";
const NUM = "num";
let shaper = null;

// Loads HarfBuzz + the fonts once per server instance.
async function ready() {
  if (shaper) return shaper;
  const hb = await require("harfbuzzjs");
  const load = name => {
    const blob = hb.createBlob(fs.readFileSync(path.join(FONT_DIR, name)));
    const face = hb.createFace(blob, 0);
    return { font: hb.createFont(face), upem: face.upem, paths: new Map() };
  };
  shaper = {
    hb,
    fonts: {
      km400: load("NotoSansKhmer-Regular.ttf"),
      km700: load("NotoSansKhmer-Bold.ttf"),
      num400: load("Inter-Regular.ttf"),
      num700: load("Inter-Bold.ttf"),
      num800: load("Inter-ExtraBold.ttf")
    }
  };
  return shaper;
}

function pickFont(value, family, weight) {
  // Inter has no Khmer letters (or ៛): such text always uses Noto Sans Khmer
  const khmer = /[\u1780-\u17FF\u19E0-\u19FF]/.test(value);
  if (family === NUM && !khmer) return shaper.fonts[weight >= 800 ? "num800" : weight >= 600 ? "num700" : "num400"];
  return shaper.fonts[weight >= 600 ? "km700" : "km400"];
}
const COLORS = { Food: "#fb7185", Home: "#f59e0b", Family: "#f472b6", Transport: "#60a5fa", Shopping: "#a78bfa", Bills: "#f97316", Loan: "#5b7f95", Education: "#2dd4bf", Health: "#34d399", Entertainment: "#818cf8", Other: "#94a3b8" };
const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
const KM_DAYS = ["អា", "ច", "អ", "ពុ", "ព្រ", "សុ", "ស"];

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]));

function money(value, currency) {
  const number = Number(value || 0);
  if (currency === "KHR") return `${Math.round(number).toLocaleString("en-US")} ៛`;
  const cents = Math.abs(number) < 100 && Math.round(number * 100) % 100 !== 0;
  return `${number < 0 ? "-" : ""}$${Math.abs(number).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const kmDate = iso => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${KM_MONTHS[m - 1]} ${y}`;
};

function spendingBetween(payload, from, to) {
  const currency = payload.profile?.currency || "USD";
  const byDay = {};
  const byCategory = {};
  let total = 0;
  let count = 0;
  (payload.expenses || []).forEach(item => {
    const date = String(item.date || "");
    if (!date || date < from || date > to) return;
    const value = convert(item.amount, item.currency || currency, currency);
    total += value;
    count += 1;
    byDay[date] = (byDay[date] || 0) + value;
    const category = item.category || "Other";
    byCategory[category] = (byCategory[category] || 0) + value;
  });
  return { total, count, byDay, byCategory };
}

/* ---------------- drawing ---------------- */

const W = 1080;

function text(x, y, value, { size = 30, weight = 400, fill = "#f4fff7", family = KM, anchor = "start", opacity = 1 } = {}) {
  const str = String(value ?? "");
  if (!str) return "";
  const f = pickFont(str, family, weight);
  const buffer = shaper.hb.createBuffer();
  buffer.addText(str);
  buffer.guessSegmentProperties();
  shaper.hb.shape(f.font, buffer);
  const glyphs = buffer.json();
  buffer.destroy();
  const scale = size / f.upem;
  const width = glyphs.reduce((sum, glyph) => sum + glyph.ax, 0) * scale;
  let pen = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  const parts = glyphs.map(glyph => {
    let d = f.paths.get(glyph.g);
    if (d === undefined) {
      d = f.font.glyphToPath(glyph.g);
      f.paths.set(glyph.g, d);
    }
    const gx = pen + glyph.dx * scale;
    const gy = y - glyph.dy * scale;
    pen += glyph.ax * scale;
    return d ? `<path transform="translate(${gx.toFixed(2)} ${gy.toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>` : "";
  }).join("");
  return `<g fill="${fill}" opacity="${opacity}">${parts}</g>`;
}

function tile(x, y, w, h, label, value, sub, accent) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="#0f2a22" stroke="#1d3d33"/>
    <rect x="${x + 28}" y="${y + 30}" width="10" height="34" rx="5" fill="${accent}"/>
    ${text(x + 50, y + 58, label, { size: 26, fill: "#a9c2b6" })}
    ${text(x + 28, y + 122, value, { size: value.length > 9 ? 40 : 50, weight: 800, family: NUM })}
    ${sub ? text(x + 28, y + 162, sub, { size: 24, fill: accent }) : ""}`;
}

function barChart(x, y, w, h, entries, currency) {
  const max = Math.max(1, ...entries.map(entry => entry.value));
  const gap = entries.length > 10 ? 6 : 22;
  const bw = (w - gap * (entries.length - 1)) / entries.length;
  return entries.map((entry, index) => {
    const bh = Math.max(entry.value > 0 ? 8 : 3, (entry.value / max) * (h - 60));
    const bx = x + index * (bw + gap);
    const by = y + h - 40 - bh;
    const label = entries.length <= 10 || index % 5 === 0 || index === entries.length - 1;
    return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(12, bw / 2).toFixed(1)}" fill="${entry.highlight ? "#d9ff7b" : "#3f7d63"}"/>
      ${entries.length <= 10 && entry.value > 0 ? text(bx + bw / 2, by - 12, money(entry.value, currency), { size: 20, family: NUM, anchor: "middle", fill: "#c1d5ca" }) : ""}
      ${label ? text(bx + bw / 2, y + h - 6, entry.label, { size: 22, anchor: "middle", fill: "#809386" }) : ""}`;
  }).join("");
}

function categoryRows(x, y, w, byCategory, total, currency) {
  const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!rows.length) return { svg: text(x, y + 40, "មិនទាន់មានចំណាយ", { size: 28, fill: "#809386" }), height: 70 };
  const svg = rows.map(([category, value], index) => {
    const ry = y + index * 74;
    const share = total ? value / total : 0;
    return `<circle cx="${x + 14}" cy="${ry + 22}" r="11" fill="${COLORS[category] || COLORS.Other}"/>
      ${text(x + 40, ry + 32, CATEGORY_KM[category] || category, { size: 30, weight: 700 })}
      ${text(x + w, ry + 32, `${money(value, currency)}   ${Math.round(share * 100)}%`, { size: 28, family: NUM, anchor: "end", fill: "#c1d5ca" })}
      <rect x="${x}" y="${ry + 46}" width="${w}" height="12" rx="6" fill="#16352b"/>
      <rect x="${x}" y="${ry + 46}" width="${Math.max(12, w * share).toFixed(1)}" height="12" rx="6" fill="${COLORS[category] || COLORS.Other}"/>`;
  }).join("");
  return { svg, height: rows.length * 74 };
}

function card(y, h, title, inner) {
  return `<rect x="48" y="${y}" width="${W - 96}" height="${h}" rx="34" fill="#0b231c" stroke="#1d3d33"/>
    ${text(88, y + 62, title, { size: 32, weight: 700, fill: "#d9ff7b" })}
    ${inner}`;
}

function render(svg) {
  const { Resvg } = require("@resvg/resvg-js");
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: "width", value: W } });
  return resvg.render().asPng();
}

function frame(height, title, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#03110d"/><stop offset="0.5" stop-color="#071d18"/><stop offset="1" stop-color="#0a2219"/></linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0" r="0.6"><stop offset="0" stop-color="#d9ff7b" stop-opacity="0.18"/><stop offset="1" stop-color="#d9ff7b" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${height}" fill="url(#bg)"/><rect width="${W}" height="${height}" fill="url(#glow)"/>
    <rect x="48" y="52" width="64" height="64" rx="18" fill="#d9ff7b"/>
    ${text(80, 96, "M", { size: 36, weight: 800, family: NUM, anchor: "middle", fill: "#061812" })}
    ${text(132, 96, "MYLIFE", { size: 30, weight: 800, family: NUM, fill: "#d9ff7b" })}
    ${text(48, 190, title, { size: 58, weight: 700 })}
    ${text(48, 240, subtitle, { size: 30, fill: "#a9c2b6" })}
    ${body}
    ${text(W / 2, height - 36, "daily-life-2.vercel.app", { size: 22, family: NUM, anchor: "middle", fill: "#4d6b5e" })}
  </svg>`;
}

/* ---------------- weekly (Sunday) ---------------- */

async function weeklyImage(payload, today) {
  await ready();
  const currency = payload.profile?.currency || "USD";
  const from = addDays(today, -6);
  const week = spendingBetween(payload, from, today);
  const report = weeklyReport(payload, today);
  const forecast = monthForecast(payload, today);
  const incomeWeek = incomeBetween(payload, from, today);

  const change = report.change;
  const changeText = change === null || change === undefined ? "" : change > 0 ? `ច្រើនជាងសប្តាហ៍មុន ${change}%` : change < 0 ? `តិចជាងសប្តាហ៍មុន ${Math.abs(change)}%` : "ស្មើសប្តាហ៍មុន";
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(from, index);
    const [y, m, d] = date.split("-").map(Number);
    return { label: KM_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], value: week.byDay[date] || 0, highlight: date === today };
  });
  const cats = categoryRows(88, 0, W - 176, week.byCategory, week.total, currency);

  let y = 290;
  let body = "";
  body += tile(48, y, 480, 190, "ចាយសប្តាហ៍នេះ", money(week.total, currency), changeText || `${week.count} ដង`, change > 0 ? "#fb7185" : "#9ef06a");
  body += tile(552, y, 480, 190, "ចំណូលសប្តាហ៍នេះ", money(incomeWeek, currency), `${week.count} ចំណាយ`, "#7fe6cf");
  y += 222;
  body += card(y, 400, "ចំណាយប្រចាំថ្ងៃ", barChart(88, y + 90, W - 176, 290, days, currency));
  y += 432;
  body += card(y, cats.height + 110, "ចាយច្រើនជាងគេ", `<g transform="translate(0 ${y + 96})">${cats.svg}</g>`);
  y += cats.height + 142;

  const lines = [];
  lines.push(forecast.left < 0 ? [`បើចាយបែបនេះ ចុងខែនឹងខ្វះ ${money(Math.abs(forecast.left), currency)}`, "#fb7185"] : [`បើចាយបែបនេះ ចុងខែនឹងនៅសល់ ${money(forecast.left, currency)}`, "#9ef06a"]);
  if (forecast.daysLeft > 0) lines.push([`អាចចាយបាន ${money(forecast.perDay, currency)} ក្នុងមួយថ្ងៃ (${forecast.daysLeft} ថ្ងៃទៀត)`, "#f4fff7"]);
  forecast.budgets.slice(0, 2).forEach(entry => lines.push(entry.over
    ? [`ថវិកា${CATEGORY_KM[entry.category] || entry.category} លើសហើយ`, "#fb7185"]
    : [`ថវិកា${CATEGORY_KM[entry.category] || entry.category} នឹងអស់ប្រហែលថ្ងៃទី ${entry.day}`, "#f3d86a"]));
  body += card(y, 100 + lines.length * 52, "ព្យាករណ៍ចុងខែ", lines.map(([line, fill], index) => text(88, y + 118 + index * 52, line, { size: 30, fill })).join(""));
  y += 132 + lines.length * 52;

  const svg = frame(y + 80, "របាយការណ៍ប្រចាំសប្តាហ៍", `${kmDate(from)} – ${kmDate(today)}`, body);
  return render(svg);
}

/* ---------------- monthly (1st of the month, for last month) ---------------- */

async function monthlyImage(payload, month) {
  await ready();
  const currency = payload.profile?.currency || "USD";
  const [y0, m0] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y0, m0, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  const spend = spendingBetween(payload, from, to);
  const income = incomeThisMonth(payload, month);
  const left = income - spend.total;
  const budgets = Object.entries(payload.profile?.categoryBudgets || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([category, value]) => ({ category, percent: Math.round(((spend.byCategory[category] || 0) / Number(value)) * 100) }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 4);
  const days = Array.from({ length: lastDay }, (_, index) => ({ label: String(index + 1), value: spend.byDay[`${month}-${String(index + 1).padStart(2, "0")}`] || 0 }));
  const cats = categoryRows(88, 0, W - 176, spend.byCategory, spend.total, currency);

  let y = 290;
  let body = "";
  body += tile(48, y, 315, 190, "ចំណូល", money(income, currency), "", "#7fe6cf");
  body += tile(383, y, 315, 190, "ចំណាយ", money(spend.total, currency), `${spend.count} ដង`, "#fb7185");
  body += tile(718, y, 314, 190, left < 0 ? "ខ្វះ" : "នៅសល់", money(Math.abs(left), currency), income ? `${Math.round((spend.total / income) * 100)}% នៃចំណូល` : "", left < 0 ? "#fb7185" : "#9ef06a");
  y += 222;
  body += card(y, 380, "ចំណាយប្រចាំថ្ងៃ", barChart(88, y + 90, W - 176, 270, days, currency));
  y += 412;
  body += card(y, cats.height + 110, "ចាយតាមប្រភេទ", `<g transform="translate(0 ${y + 96})">${cats.svg}</g>`);
  y += cats.height + 142;
  if (budgets.length) {
    const inner = budgets.map((entry, index) => {
      const by = y + 96 + index * 70;
      const color = entry.percent >= 100 ? "#fb7185" : entry.percent >= 80 ? "#f3d86a" : "#9ef06a";
      return `${text(88, by + 26, `ថវិកា${CATEGORY_KM[entry.category] || entry.category}`, { size: 28 })}
        ${text(W - 88, by + 26, `${entry.percent}%`, { size: 28, weight: 700, family: NUM, anchor: "end", fill: color })}
        <rect x="88" y="${by + 40}" width="${W - 176}" height="12" rx="6" fill="#16352b"/>
        <rect x="88" y="${by + 40}" width="${Math.max(12, (W - 176) * Math.min(1, entry.percent / 100)).toFixed(1)}" height="12" rx="6" fill="${color}"/>`;
    }).join("");
    body += card(y, 110 + budgets.length * 70, "ថវិកា", inner);
    y += 142 + budgets.length * 70;
  }
  const svg = frame(y + 80, `របាយការណ៍ខែ${KM_MONTHS[m0 - 1]}`, `${kmDate(from)} – ${kmDate(to)}`, body);
  return render(svg);
}

module.exports = { weeklyImage, monthlyImage };
