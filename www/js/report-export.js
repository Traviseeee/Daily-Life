/* MYLIFE monthly finance report — smarter output.
 *  - ReportInsights.build(month): adds category breakdown, last-month comparison,
 *    savings, daily average, month-end forecast, budget checks and plain-language
 *    insights (Khmer / English) to buildMonthlyFinanceReport().
 *  - ReportXlsx.download(month): a real .xlsx (no library) with 3 sheets —
 *    Summary, Transactions (real numbers + SUM total + filter), Categories (% formulas).
 *  - ReportCanvas.draw(month): a designed JPG (header, KPI cards, insights,
 *    category bars, transactions table, footer). */

const ReportInsights = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);

  function prevMonth(month) {
    const [y, m] = month.split("-").map(Number);
    return `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  }
  function daysIn(month) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  }
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  const plain = value => {
    const n = Number(value || 0);
    const cur = appData.profile.currency || "USD";
    const digits = cur === "KHR" ? 0 : Math.abs(n) < 100 && Math.round(n) !== n ? 2 : 0;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  };

  function build(month) {
    const report = buildMonthlyFinanceReport(month);
    const last = buildMonthlyFinanceReport(prevMonth(month));
    const expenses = (appData.expenses || []).filter(item => String(item.date || "").slice(0, 7) === month);

    const byCat = new Map();
    expenses.forEach(item => {
      const key = item.category || "Other";
      const entry = byCat.get(key) || { category: key, label: optionLabel(key), amount: 0, count: 0, color: (typeof expenseCategoryColors !== "undefined" && expenseCategoryColors[key]) || "#94a3b8" };
      entry.amount += toProfileCurrency(item.amount, item.currency);
      entry.count += 1;
      byCat.set(key, entry);
    });
    const categories = [...byCat.values()].sort((a, b) => b.amount - a.amount);
    const spent = categories.reduce((sum, item) => sum + item.amount, 0);
    categories.forEach(item => (item.share = spent ? item.amount / spent : 0));

    const saved = (appData.savings || []).reduce((sum, saving) => {
      const entry = typeof getSavingsContribution === "function" ? getSavingsContribution(saving, month) : null;
      return sum + (entry?.paid ? toProfileCurrency(entry.amount || saving.monthlyContribution, saving.currency) : 0);
    }, 0);

    const today = localDateInput();
    const isCurrent = today.slice(0, 7) === month;
    const days = daysIn(month);
    const elapsed = isCurrent ? Number(today.slice(8, 10)) : days;
    const dailyAvg = elapsed ? spent / elapsed : 0;
    const forecast = isCurrent ? dailyAvg * days : spent;
    const savingsRate = report.incomeTotal > 0 ? Math.round(((report.netCashFlow) / report.incomeTotal) * 100) : null;
    const biggest = expenses.slice().sort((a, b) => toProfileCurrency(b.amount, b.currency) - toProfileCurrency(a.amount, a.currency))[0];

    const budgets = appData.profile.categoryBudgets && typeof appData.profile.categoryBudgets === "object" ? appData.profile.categoryBudgets : {};
    const overBudget = Object.entries(budgets)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([category, amount]) => ({ category, label: optionLabel(category), budget: Number(amount), spent: byCat.get(category)?.amount || 0 }))
      .filter(item => item.spent > item.budget);

    // plain-language insights
    const insights = [];
    if (categories[0]) insights.push({ tone: "info", text: L(`ចំណាយច្រើនបំផុតលើ ${categories[0].label} — ${plain(categories[0].amount)} (${Math.round(categories[0].share * 100)}%)`, `Most spent on ${categories[0].label} — ${plain(categories[0].amount)} (${Math.round(categories[0].share * 100)}%)`) });
    const expChange = pct(report.expenseTotal, last.expenseTotal);
    if (expChange !== null && expChange !== 0) insights.push({ tone: expChange > 0 ? "warn" : "good", text: L(`ចំណាយ${expChange > 0 ? "កើន" : "ថយ"} ${Math.abs(expChange)}% ធៀបខែមុន (${plain(last.expenseTotal)})`, `Spending ${expChange > 0 ? "up" : "down"} ${Math.abs(expChange)}% vs last month (${plain(last.expenseTotal)})`) });
    if (savingsRate !== null) insights.push({ tone: savingsRate >= 20 ? "good" : savingsRate >= 0 ? "info" : "warn", text: savingsRate >= 0 ? L(`នៅសល់ ${savingsRate}% នៃចំណូល${savingsRate >= 20 ? " — ល្អណាស់!" : ""}`, `You kept ${savingsRate}% of your income${savingsRate >= 20 ? " — great!" : ""}`) : L(`ចាយលើសចំណូល ${plain(-report.netCashFlow)}`, `Spent ${plain(-report.netCashFlow)} more than you earned`) });
    if (isCurrent && spent > 0) insights.push({ tone: "info", text: L(`ជាមធ្យម ${plain(dailyAvg)}/ថ្ងៃ — ចុងខែអាចដល់ ${plain(forecast)}`, `About ${plain(dailyAvg)}/day — month-end could reach ${plain(forecast)}`) });
    overBudget.forEach(item => insights.push({ tone: "warn", text: L(`${item.label} លើសថវិកា ${plain(item.spent - item.budget)}`, `${item.label} is ${plain(item.spent - item.budget)} over budget`) }));
    if (saved > 0) insights.push({ tone: "good", text: L(`សន្សំបាន ${plain(saved)} ក្នុងខែនេះ`, `Saved ${plain(saved)} this month`) });
    if (!insights.length) insights.push({ tone: "info", text: L("មិនទាន់មានទិន្នន័យគ្រប់គ្រាន់សម្រាប់ខែនេះ", "Not enough data for this month yet") });

    return {
      ...report,
      last,
      categories,
      spent,
      saved,
      dailyAvg,
      forecast,
      isCurrent,
      savingsRate,
      biggest: biggest ? { name: biggest.description || optionLabel(biggest.category || "Other"), amount: toProfileCurrency(biggest.amount, biggest.currency), date: biggest.date } : null,
      overBudget,
      insights: insights.slice(0, 5),
      plain
    };
  }

  return { build, prevMonth };
})();

/* ---------------- .xlsx writer (store-only zip, no library) ---------------- */
const ReportXlsx = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const enc = new TextEncoder();
  const xml = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    const parts = [];
    const central = [];
    let offset = 0;
    files.forEach(({ name, data }) => {
      const nameBytes = enc.encode(name);
      const bytes = typeof data === "string" ? enc.encode(data) : data;
      const crc = crc32(bytes);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // utf-8 names
      local.setUint16(8, 0, true); // store
      local.setUint32(14, crc, true);
      local.setUint32(18, bytes.length, true);
      local.setUint32(22, bytes.length, true);
      local.setUint16(26, nameBytes.length, true);
      parts.push(new Uint8Array(local.buffer), nameBytes, bytes);
      const head = new DataView(new ArrayBuffer(46));
      head.setUint32(0, 0x02014b50, true);
      head.setUint16(4, 20, true);
      head.setUint16(6, 20, true);
      head.setUint16(8, 0x0800, true);
      head.setUint32(16, crc, true);
      head.setUint32(20, bytes.length, true);
      head.setUint32(24, bytes.length, true);
      head.setUint16(28, nameBytes.length, true);
      head.setUint32(42, offset, true);
      central.push(new Uint8Array(head.buffer), nameBytes);
      offset += 30 + nameBytes.length + bytes.length;
    });
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  const col = index => {
    let s = "";
    index += 1;
    while (index) {
      const r = (index - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      index = Math.floor((index - 1) / 26);
    }
    return s;
  };

  // styles: 0 normal · 1 header · 2 money · 3 title · 4 percent · 5 label · 6 bold money total · 7 subtitle · 8 money red · 9 money green
  function stylesXml(currency) {
    const moneyFmt = currency === "KHR" ? '#,##0" ៛"' : '"$"#,##0.00;[Red]-"$"#,##0.00';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="${xml(moneyFmt)}"/><numFmt numFmtId="165" formatCode="0%"/></numFmts>
<fonts count="6"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF1A2A12"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FF14201B"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF5D6B64"/><name val="Calibri"/></font><font><b/><sz val="12"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF2F7A12"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC5FF60"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F7EA"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD5DDCC"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="5" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }

  // cell: string | number | {v, s, f}
  function sheetXml({ cols, rows, filter, freeze }) {
    const body = rows.map((row, r) => `<row r="${r + 1}"${row.height ? ` ht="${row.height}" customHeight="1"` : ""}>${(row.cells || row).map((cell, c) => {
      if (cell === null || cell === undefined || cell === "") return "";
      const obj = typeof cell === "object" ? cell : { v: cell };
      const ref = `${col(c)}${r + 1}`;
      const style = obj.s !== undefined ? ` s="${obj.s}"` : typeof obj.v === "number" ? ' s="2"' : ' s="0"';
      if (obj.f) return `<c r="${ref}"${style}><f>${xml(obj.f)}</f></c>`;
      if (typeof obj.v === "number") return `<c r="${ref}"${style}><v>${Number.isFinite(obj.v) ? obj.v : 0}</v></c>`;
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(obj.v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : ""}
<cols>${cols.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>
<sheetData>${body}</sheetData>
${filter ? `<autoFilter ref="${filter}"/>` : ""}
</worksheet>`;
  }

  function workbook(sheets, currency) {
    const files = [
      { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
      { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${sheets.map((sheet, i) => sheet.filter ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(sheet.name.slice(0, 31))}'!$${sheet.filter.replace(":", ":$").replace(/([A-Z]+)(\d+)/g, "$1$$$2")}</definedName></definedNames>` : "").join("")}</workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "xl/styles.xml", data: stylesXml(currency) },
      ...sheets.map((sheet, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(sheet) }))
    ];
    return zip(files);
  }

  function build(month) {
    const r = ReportInsights.build(month);
    const H = v => ({ v, s: 1 });
    const label = v => ({ v, s: 5 });

    // 1. Summary
    const summaryRows = [
      [{ v: `MYLIFE · ${t("monthlyReport")}`, s: 3 }],
      { height: 18, cells: [{ v: `${r.monthLabel} · ${r.ownerName} · ${t("generatedOn")}: ${r.generatedOn}`, s: 7 }] },
      [],
      [H(L("សង្ខេប", "Summary")), H(L("ខែនេះ", "This month")), H(L("ខែមុន", "Last month")), H(L("ប្តូរ", "Change"))],
      [label(t("monthlyIncome")), r.incomeTotal, r.last.incomeTotal, { f: "IF(C5=0,\"\",(B5-C5)/C5)", s: 4 }],
      [label(t("monthlyExpenses")), r.expenseTotal, r.last.expenseTotal, { f: "IF(C6=0,\"\",(B6-C6)/C6)", s: 4 }],
      [label(t("monthlyPayment")), r.loanPaymentTotal, r.last.loanPaymentTotal, { f: "IF(C7=0,\"\",(B7-C7)/C7)", s: 4 }],
      [label(L("សន្សំបាន", "Saved")), r.saved, "", ""],
      [{ v: t("netCashFlow"), s: 5 }, { f: "B5-B6-B7", s: 6 }, { f: "C5-C6-C7", s: 6 }, ""],
      [label(L("អត្រារក្សាទុក", "Kept of income")), { f: "IF(B5=0,\"\",B9/B5)", s: 4 }, "", ""],
      [label(L("មធ្យមចាយ/ថ្ងៃ", "Average spend / day")), r.dailyAvg, "", ""],
      ...(r.isCurrent ? [[label(L("ប៉ាន់ស្មានចុងខែ", "Month-end forecast")), r.forecast, "", ""]] : []),
      ...(r.biggest ? [[label(L("ចំណាយធំបំផុត", "Biggest expense")), r.biggest.amount, r.biggest.name, ""]] : []),
      [],
      [H(L("💡 ការយល់ដឹង", "💡 Insights")), H(""), H(""), H("")],
      ...r.insights.map(item => [`${item.tone === "warn" ? "⚠️" : item.tone === "good" ? "✅" : "•"} ${item.text}`])
    ];

    // 2. Transactions
    const tx = r.rows;
    const txRows = [
      [H(t("type")), H(t("description")), H(t("category")), H(`${t("date")} / ${t("frequency")}`), H(t("amount"))],
      ...tx.map(row => [row.type, row.description, row.category, row.period, { v: Math.round(row.amount * 100) / 100, s: row.amount < 0 ? 8 : 9 }]),
      [{ v: L("សរុប", "Total"), s: 5 }, { v: "", s: 5 }, { v: "", s: 5 }, { v: "", s: 5 }, { f: `SUM(E2:E${tx.length + 1})`, s: 6 }]
    ];

    // 3. Categories
    const catStart = 2;
    const catEnd = r.categories.length + 1;
    const catRows = [
      [H(t("category")), H(L("ចំនួនដង", "Count")), H(t("amount")), H(L("ភាគរយ", "Share")), H(L("ថវិកា", "Budget")), H(L("នៅសល់", "Left"))],
      ...r.categories.map((item, i) => {
        const row = i + 2;
        const budget = Number((appData.profile.categoryBudgets || {})[item.category] || 0);
        return [item.label, { v: item.count, s: 0 }, Math.round(item.amount * 100) / 100, { f: `IF(SUM($C$${catStart}:$C$${catEnd})=0,0,C${row}/SUM($C$${catStart}:$C$${catEnd}))`, s: 4 }, budget || "", budget ? { f: `E${row}-C${row}`, s: 2 } : ""];
      }),
      [{ v: L("សរុប", "Total"), s: 5 }, { f: `SUM(B${catStart}:B${catEnd})`, s: 5 }, { f: `SUM(C${catStart}:C${catEnd})`, s: 6 }, { v: "", s: 5 }, { v: "", s: 5 }, { v: "", s: 5 }]
    ];

    return workbook([
      { name: L("សង្ខេប", "Summary"), cols: [30, 18, 18, 12], rows: summaryRows },
      { name: L("ប្រតិបត្តិការ", "Transactions"), cols: [14, 30, 18, 28, 16], rows: txRows, filter: `A1:E${tx.length + 1}`, freeze: 1 },
      { name: L("ប្រភេទ", "Categories"), cols: [22, 12, 16, 12, 14, 14], rows: catRows, freeze: 1 }
    ], r.currency);
  }

  function download(month) {
    const blob = build(month);
    downloadFile(`mylife-report-${month}.xlsx`, blob.type, blob);
  }

  return { build, download, crc32 };
})();

/* ---------------- designed JPG ---------------- */
const ReportCanvas = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const FONT = '"Noto Sans Khmer","Khmer OS System","Leelawadee UI",Inter,Calibri,Arial,sans-serif';

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wrap(ctx, text, max, font) {
    ctx.font = font;
    const words = String(text || "").split(/(\s+)/);
    const lines = [];
    let line = "";
    words.forEach(word => {
      const next = line + word;
      if (line.trim() && ctx.measureText(next).width > max) {
        lines.push(line.trim());
        line = word.trimStart();
      } else line = next;
    });
    if (line.trim()) lines.push(line.trim());
    // very long single words (Khmer has no spaces): hard-split by width
    return lines.flatMap(item => {
      if (ctx.measureText(item).width <= max) return [item];
      const out = [];
      let chunk = "";
      [...item].forEach(ch => {
        if (ctx.measureText(chunk + ch).width > max && chunk) {
          out.push(chunk);
          chunk = ch;
        } else chunk += ch;
      });
      if (chunk) out.push(chunk);
      return out;
    });
  }

  async function draw(month) {
    if (document.fonts?.ready) await document.fonts.ready;
    const r = ReportInsights.build(month);
    const money = r.plain;
    const W = 1240;
    const M = 56;
    const inner = W - M * 2;
    const measure = document.createElement("canvas").getContext("2d");

    // pre-measure dynamic blocks
    const insightFont = `500 19px ${FONT}`;
    const insightLines = r.insights.map(item => wrap(measure, item.text, inner - 90, insightFont));
    const insightsH = 70 + insightLines.reduce((s, lines) => s + lines.length * 28 + 14, 0) + 10;
    const cats = r.categories.slice(0, 8);
    const catsH = cats.length ? 70 + cats.length * 52 + 10 : 0;
    const colW = [120, 320, 190, 270, 196]; // = inner - 32
    const rowFont = `500 17px ${FONT}`;
    const rows = r.rows.length ? r.rows.map(row => [row.type, row.description, row.category, row.period, money(row.amount)]) : [[t("noMonthlyTransactions"), "", "", "", ""]];
    const rowLines = rows.map(row => row.map((cell, i) => wrap(measure, cell, colW[i] - 24, rowFont)));
    const rowH = rowLines.map(lines => Math.max(...lines.map(l => l.length)) * 26 + 24);
    const tableH = 70 + 52 + rowH.reduce((a, b) => a + b, 0) + 24;

    const headerH = 230;
    const kpiH = 170;
    const H = headerH + 40 + kpiH + 36 + insightsH + 30 + (catsH ? catsH + 30 : 0) + tableH + 110;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext("2d");
    c.textBaseline = "top";
    c.fillStyle = "#f6f8f3";
    c.fillRect(0, 0, W, H);

    // header
    const grad = c.createLinearGradient(0, 0, W, headerH);
    grad.addColorStop(0, "#0f2a1c");
    grad.addColorStop(1, "#1d4a2c");
    c.fillStyle = grad;
    c.fillRect(0, 0, W, headerH);
    c.fillStyle = "rgba(197,255,96,0.16)";
    c.beginPath();
    c.arc(W - 120, 40, 170, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#c5ff60";
    roundRect(c, M, 48, 132, 36, 18);
    c.fill();
    c.fillStyle = "#14201b";
    c.font = `800 18px ${FONT}`;
    c.fillText("MYLIFE", M + 30, 55);
    c.fillStyle = "#ffffff";
    c.font = `800 44px ${FONT}`;
    c.fillText(t("monthlyReport"), M, 100);
    c.fillStyle = "rgba(255,255,255,0.72)";
    c.font = `500 20px ${FONT}`;
    c.fillText(`${r.monthLabel} · ${r.ownerName} · ${r.currency}`, M, 166);

    // KPI cards
    let y = headerH + 40;
    const kpis = [
      { label: t("monthlyIncome"), value: r.incomeTotal, prev: r.last.incomeTotal, tone: "#16a34a", upGood: true },
      { label: t("monthlyExpenses"), value: r.expenseTotal, prev: r.last.expenseTotal, tone: "#ea7a2a", upGood: false },
      { label: t("monthlyPayment"), value: r.loanPaymentTotal, prev: r.last.loanPaymentTotal, tone: "#e0475f", upGood: false },
      { label: t("netCashFlow"), value: r.netCashFlow, prev: r.last.netCashFlow, tone: r.netCashFlow >= 0 ? "#5a9e12" : "#e0475f", upGood: true }
    ];
    const kw = (inner - 3 * 16) / 4;
    kpis.forEach((k, i) => {
      const x = M + i * (kw + 16);
      c.fillStyle = "#ffffff";
      roundRect(c, x, y, kw, kpiH, 22);
      c.fill();
      c.fillStyle = k.tone;
      roundRect(c, x, y, 8, kpiH, 4);
      c.fill();
      c.fillStyle = "#5d6b64";
      c.font = `600 17px ${FONT}`;
      wrap(c, k.label, kw - 44, `600 17px ${FONT}`).slice(0, 2).forEach((line, li) => c.fillText(line, x + 26, y + 22 + li * 24));
      c.fillStyle = k.tone;
      c.font = `800 34px ${FONT}`;
      c.fillText(money(k.value), x + 26, y + 80, kw - 44);
      if (k.prev && Math.sign(k.prev) === Math.sign(k.value || k.prev)) {
        const change = Math.round(((k.value - k.prev) / Math.abs(k.prev)) * 100);
        const good = change === 0 ? null : (change > 0) === k.upGood;
        c.fillStyle = good === null ? "#5d6b64" : good ? "#16a34a" : "#e0475f";
        c.font = `700 15px ${FONT}`;
        c.fillText(change === 0 ? L("• ដូចខែមុន", "• Same as last month") : `${change > 0 ? "▲" : "▼"} ${Math.abs(change)}% ${L("ធៀបខែមុន", "vs last month")}`, x + 26, y + 130, kw - 44);
      }
    });
    y += kpiH + 36;

    // insights
    c.fillStyle = "#ffffff";
    roundRect(c, M, y, inner, insightsH, 22);
    c.fill();
    c.fillStyle = "#14201b";
    c.font = `800 22px ${FONT}`;
    c.fillText(L("💡 ការយល់ដឹងខែនេះ", "💡 This month at a glance"), M + 28, y + 24);
    let iy = y + 70;
    r.insights.forEach((item, i) => {
      const dot = item.tone === "warn" ? "#e0475f" : item.tone === "good" ? "#16a34a" : "#3f86d6";
      c.fillStyle = dot;
      c.beginPath();
      c.arc(M + 40, iy + 13, 7, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#26302a";
      c.font = insightFont;
      insightLines[i].forEach((line, li) => c.fillText(line, M + 62, iy + li * 28));
      iy += insightLines[i].length * 28 + 14;
    });
    y += insightsH + 30;

    // categories
    if (cats.length) {
      c.fillStyle = "#ffffff";
      roundRect(c, M, y, inner, catsH, 22);
      c.fill();
      c.fillStyle = "#14201b";
      c.font = `800 22px ${FONT}`;
      c.fillText(t("spendingByCategory"), M + 28, y + 24);
      let cy = y + 74;
      const labelW = 220;
      const barX = M + 28 + labelW;
      const barW = inner - 56 - labelW - 190;
      cats.forEach(item => {
        c.fillStyle = "#26302a";
        c.font = `600 18px ${FONT}`;
        c.fillText(item.label, M + 28, cy + 4, labelW - 16);
        c.fillStyle = "#eef2ea";
        roundRect(c, barX, cy + 6, barW, 18, 9);
        c.fill();
        c.fillStyle = item.color;
        roundRect(c, barX, cy + 6, Math.max(10, barW * item.share), 18, 9);
        c.fill();
        c.fillStyle = "#14201b";
        c.font = `700 18px ${FONT}`;
        c.textAlign = "right";
        c.fillText(`${money(item.amount)}  ${Math.round(item.share * 100)}%`, M + inner - 28, cy + 4);
        c.textAlign = "left";
        cy += 52;
      });
      y += catsH + 30;
    }

    // transactions
    c.fillStyle = "#ffffff";
    roundRect(c, M, y, inner, tableH, 22);
    c.fill();
    c.fillStyle = "#14201b";
    c.font = `800 22px ${FONT}`;
    c.fillText(t("recentTransactions"), M + 28, y + 24);
    let ty = y + 70;
    c.fillStyle = "#c5ff60";
    roundRect(c, M + 16, ty, inner - 32, 52, 12);
    c.fill();
    const headers = [t("type"), t("description"), t("category"), `${t("date")} / ${t("frequency")}`, t("amount")];
    let tx = M + 16;
    c.fillStyle = "#1a2a12";
    c.font = `700 16px ${FONT}`;
    headers.forEach((h, i) => {
      if (i === headers.length - 1) {
        c.textAlign = "right";
        c.fillText(h, tx + colW[i] - 12, ty + 16, colW[i] - 24);
        c.textAlign = "left";
      } else c.fillText(h, tx + 12, ty + 16, colW[i] - 24);
      tx += colW[i];
    });
    ty += 52;
    rows.forEach((row, ri) => {
      if (ri % 2) {
        c.fillStyle = "#f4f7ef";
        c.fillRect(M + 16, ty, inner - 32, rowH[ri]);
      }
      tx = M + 16;
      rowLines[ri].forEach((lines, i) => {
        const isAmount = i === row.length - 1;
        c.fillStyle = isAmount ? (String(row[i]).startsWith("-") ? "#d1384f" : "#16803c") : "#26302a";
        c.font = isAmount ? `700 17px ${FONT}` : rowFont;
        lines.forEach((line, li) => {
          if (isAmount) {
            c.textAlign = "right";
            c.fillText(line, tx + colW[i] - 12, ty + 12 + li * 26);
            c.textAlign = "left";
          } else c.fillText(line, tx + 12, ty + 12 + li * 26);
        });
        tx += colW[i];
      });
      ty += rowH[ri];
    });
    y += tableH + 30;

    // footer
    c.fillStyle = "#8a968f";
    c.font = `500 15px ${FONT}`;
    c.fillText(`${t("generatedOn")} ${r.generatedOn} · MYLIFE`, M, y + 20);
    c.fillStyle = "#c5ff60";
    c.fillRect(0, H - 10, W, 10);
    return canvas;
  }

  return { draw };
})();
