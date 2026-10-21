/*
 * Smart Scan page (#scan): take or upload a photo / screenshot / PDF of a
 * receipt, bill or payment slip → read it on the phone (free OCR, no API key) →
 * review and correct the fields → save. Uses the same reading and saving rules
 * as the Telegram bot (js/scan-parse.js). "✏️ Edit in app" from the bot opens
 * #scan?d=… with the bot's result already filled in.
 */
const SmartScanPage = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js";
  const PDF_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
  const PDF_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  const MAX_BYTES = 10 * 1024 * 1024;

  // page state (survives App.render while on #scan)
  let state = { step: "pick", draft: null, preview: "", fileName: "", text: "", progress: 0, error: "", force: false, linkBillId: "", saved: null };
  let worker = null;

  const svg = paths => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    scan: () => svg('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 9h8M8 12h8M8 15h5"/>'),
    camera: () => svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    upload: () => svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
    warn: () => svg('<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4M12 17h.01"/>'),
    check: () => Icons.check()
  };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("load_failed"));
      document.head.appendChild(script);
    });
  }

  function decodeDraft() {
    const match = /[?&]d=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (!match) return null;
    try {
      const json = decodeURIComponent(escape(atob(match[1].replace(/-/g, "+").replace(/_/g, "/"))));
      const data = JSON.parse(json);
      return { missing: [], warnings: [], confidence: "medium", ...data };
    } catch (error) {
      return null;
    }
  }

  /* ---------- reading ---------- */
  async function sha256(buffer) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function imageToCanvas(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      // grayscale helps Tesseract with coloured bank screenshots
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.data.length; i += 4) {
        const g = data.data[i] * 0.299 + data.data[i + 1] * 0.587 + data.data[i + 2] * 0.114;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = g;
      }
      ctx.putImageData(data, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function ocr(canvas) {
    await loadScript(TESS_URL);
    if (!worker) {
      worker = await window.Tesseract.createWorker("eng", 1, {
        logger: message => {
          if (message.status === "recognizing text") setProgress(Math.round(message.progress * 100));
        }
      });
      await worker.setParameters({ tessedit_pageseg_mode: "4" });
    }
    const { data } = await worker.recognize(canvas);
    return { text: data.text || "", confidence: Math.round(data.confidence || 0) };
  }

  async function pdfPages(buffer) {
    const pdfjs = await import(PDF_URL);
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const rows = new Map();
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      const key = [...rows.keys()].find(k => Math.abs(k - y) <= 3) ?? y;
      rows.set(key, [...(rows.get(key) || []), { x: item.transform[4], s: item.str }]);
    });
    const text = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.s).join(" ").trim()).filter(Boolean).join("\n");
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return { text, canvas };
  }

  async function readFile(file) {
    if (file.size > MAX_BYTES) throw new Error("file_too_big");
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
    const isImage = /^image\//i.test(file.type);
    if (!isPdf && !isImage) throw new Error("unsupported_file");
    const buffer = await file.arrayBuffer();
    const hash = await sha256(buffer);
    if (isPdf) {
      const { text, canvas } = await pdfPages(buffer);
      state.preview = canvas.toDataURL("image/jpeg", 0.7);
      if (text.replace(/\s/g, "").length >= 10) return { text, hash, confidence: 100 };
      const read = await ocr(canvas); // scanned PDF: read the picture of page 1
      return { ...read, hash };
    }
    const canvas = await imageToCanvas(file);
    state.preview = URL.createObjectURL(file);
    const read = await ocr(canvas);
    return { ...read, hash };
  }

  async function handleFile(file) {
    if (!file) return;
    state = { ...state, step: "reading", progress: 0, error: "", fileName: file.name || "", draft: null, saved: null, force: false, linkBillId: "" };
    rerender();
    try {
      const read = await readFile(file);
      const draft = { ...ScanParse.parse(read.text, { defaultCurrency: appData.profile.currency }), hash: read.hash, ocrConfidence: read.confidence };
      const bill = ScanParse.matchBill(appData, draft);
      state = { ...state, step: "review", text: read.text, draft, linkBillId: bill ? bill.id : "" };
      if (!read.text.trim() || (!draft.amount && !draft.merchant && !draft.date)) state.error = "nothing";
    } catch (error) {
      console.warn("MYLIFE scan failed.", error);
      state = { ...state, step: "pick", error: error.message || "read_failed" };
    }
    rerender();
  }

  function setProgress(value) {
    state.progress = value;
    const bar = document.querySelector("[data-scan-progress]");
    if (bar) bar.style.setProperty("--p", `${value}%`);
    const label = document.querySelector("[data-scan-progress-label]");
    if (label) label.textContent = `${value}%`;
  }

  /* ---------- render ---------- */
  const errorText = code => ({
    file_too_big: L("ឯកសារធំពេក (អតិបរមា 10MB)", "File too big (max 10MB)"),
    unsupported_file: L("មិនស្គាល់ប្រភេទឯកសារនេះទេ — សូមប្រើ JPG, PNG, WebP ឬ PDF", "Unsupported file — use JPG, PNG, WebP or PDF"),
    load_failed: L("លើកដំបូង ត្រូវការអ៊ីនធឺណិតសិន", "Needs internet the first time to load the reader"),
    nothing: L("អានមិនសូវច្បាស់ទេ — សូមបំពេញខាងក្រោម ឬថតម្តងទៀតឲ្យច្បាស់ជាងនេះ", "Nothing clear was found — fill in below or try a sharper photo")
  }[code] || L("អានមិនបាន សូមសាកម្ដងទៀត", "Could not read it, please try again"));

  function pickView() {
    return `
      <article class="glass-card sc-pick">
        <span class="sc-pick-icon">${ICON.scan()}</span>
        <h2>${L("ស្កេនបង្កាន់ដៃ វិក្កយបត្រ ឬ Slip", "Scan a receipt, bill or payment slip")}</h2>
        <p>${L("ABA, ACLEDA, Wing, EDC, PPWSA, ហាង… ប្រើរូបថត screenshot ឬ PDF ក៏បាន", "ABA, ACLEDA, Wing, EDC, PPWSA, shops… — photo, screenshot or PDF")}</p>
        <div class="sc-pick-actions">
          <label class="button sc-btn-main">${ICON.camera()}<span>${L("ថតរូប", "Take photo")}</span><input type="file" accept="image/*" capture="environment" data-scan-file hidden></label>
          <label class="button ghost-button">${ICON.upload()}<span>${L("ជ្រើសរូប ឬ PDF", "Upload image or PDF")}</span><input type="file" accept="image/*,application/pdf,.pdf" data-scan-file hidden></label>
        </div>
        ${state.error ? `<p class="sc-error">${ICON.warn()}<span>${escapeHtml(errorText(state.error))}</span></p>` : ""}
        <ul class="sc-tips">
          <li>${L("ថតឲ្យត្រង់ មានពន្លឺល្អ និងឃើញបង្កាន់ដៃទាំងមូល", "Straight, well lit, the whole receipt in view")}</li>
          <li>${L("អានលើទូរស័ព្ទរបស់អ្នកផ្ទាល់ — រូបមិនត្រូវបានផ្ញើទៅណាទេ", "Read on your phone — the photo is not sent anywhere")}</li>
          <li>${L("ក៏អាចផ្ញើរូបទៅ Telegram bot បានដែរ", "You can also send the photo to the Telegram bot")}</li>
        </ul>
      </article>`;
  }

  function readingView() {
    return `
      <article class="glass-card sc-reading">
        ${state.preview ? `<img class="sc-thumb" src="${escapeAttr(state.preview)}" alt="">` : ""}
        <strong>${L("កំពុងអាន…", "Reading…")}</strong>
        <div class="sc-progress" data-scan-progress style="--p:${state.progress}%"><span></span></div>
        <small data-scan-progress-label>${state.progress}%</small>
        <p>${L("លើកដំបូងអាចយូរបន្តិច (ប្រហែល 10 វិនាទី)", "The first scan takes ~10 s (loading the reader)")}</p>
      </article>`;
  }

  const KINDS = [["expense", () => L("ចំណាយ", "Expense")], ["payment", () => L("Slip បង់ប្រាក់", "Payment slip")], ["bill", () => L("វិក្កយបត្រមិនទាន់បង់", "Unpaid bill")]];

  function field(name, label, value, type = "text", extra = "") {
    const missing = state.draft.missing.includes(name) || (name === "currency" && state.draft.warnings.includes("currency"));
    return `<label class="sc-field ${missing ? "is-missing" : ""}"><span>${escapeHtml(label)}${missing ? ` <b>${ICON.warn()} ${L("ពិនិត្យ", "check")}</b>` : ""}</span><input type="${type}" name="${name}" value="${escapeAttr(value ?? "")}" ${extra}></label>`;
  }

  function reviewView() {
    const d = state.draft;
    const duplicates = ScanParse.findDuplicates(appData, d);
    const bill = ScanParse.matchBill(appData, d);
    const categories = typeof expenseCategories !== "undefined" ? expenseCategories : ["Food", "Transport", "Shopping", "Bills", "Health", "Other"];
    const canSave = d.kind === "bill" || Number(d.amount) > 0;
    return `
      <form class="sc-review" data-scan-form>
        <article class="glass-card sc-doc">
          ${state.preview ? `<img class="sc-preview" src="${escapeAttr(state.preview)}" alt="${L("ឯកសារ", "Document")}">` : `<div class="sc-preview sc-preview-empty">${ICON.scan()}<small>${L("ពី Telegram", "From Telegram")}</small></div>`}
          ${state.text ? `<details class="sc-raw"><summary>${L("អក្សរដែលអានបាន", "Text found")}</summary><pre>${escapeHtml(state.text)}</pre></details>` : ""}
        </article>
        <article class="glass-card sc-fields">
          ${state.error ? `<p class="sc-error">${ICON.warn()}<span>${escapeHtml(errorText(state.error))}</span></p>` : ""}
          <div class="sc-kinds" role="radiogroup" aria-label="${L("ប្រភេទ", "Type")}">
            ${KINDS.map(([kind, label]) => `<label class="sc-kind ${d.kind === kind || (kind === "expense" && d.kind === "unknown") ? "is-on" : ""}"><input type="radio" name="kind" value="${kind}" ${d.kind === kind || (kind === "expense" && d.kind === "unknown") ? "checked" : ""}>${escapeHtml(label())}</label>`).join("")}
          </div>
          ${d.kind === "bill" ? `<p class="sc-note">${L("វិក្កយបត្រនេះមិនទាន់បង់ — វានឹងរក្សាទុកជា Bill (មិនទាន់គិតជាចំណាយទេ)។", "Unpaid bill — saved as a Bill, not as an expense.")}</p>` : ""}
          <div class="sc-grid">
            ${field("amount", L("ចំនួនទឹកប្រាក់", "Amount"), d.amount ?? "", "number", 'step="0.01" min="0" inputmode="decimal"')}
            <label class="sc-field ${d.warnings.includes("currency") ? "is-missing" : ""}"><span>${L("រូបិយប័ណ្ណ", "Currency")}</span><select name="currency">${["USD", "KHR"].map(c => `<option ${(d.currency || appData.profile.currency || "USD") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
            ${field("merchant", d.kind === "bill" ? L("អ្នកផ្តល់សេវា", "Provider") : L("ហាង / អ្នកទទួល", "Merchant / recipient"), d.merchant)}
            ${field("date", d.kind === "bill" ? L("ថ្ងៃចេញវិក្កយបត្រ", "Issue date") : L("ថ្ងៃ", "Date"), d.date, "date")}
            ${d.kind === "bill" ? field("dueDate", L("ថ្ងៃផុតកំណត់", "Due date"), d.dueDate, "date") : ""}
            <label class="sc-field"><span>${L("ប្រភេទចំណាយ", "Category")}</span><select name="category">${categories.map(c => `<option value="${c}" ${d.category === c ? "selected" : ""}>${escapeHtml(typeof optionLabel === "function" ? optionLabel(c) : c)}</option>`).join("")}</select></label>
            ${field("paymentMethod", L("បង់តាម", "Paid with"), d.paymentMethod)}
            ${field("ref", L("លេខយោង / វិក្កយបត្រ", "Reference / invoice no."), d.ref)}
          </div>
          ${d.billingPeriod ? `<p class="sc-note">🗓 ${escapeHtml(d.billingPeriod)}</p>` : ""}
          ${bill ? `
            <div class="sc-link">
              <strong>🔗 ${escapeHtml(d.kind === "bill" ? L(`ដូច Bill “${bill.name}”`, `Matches bill “${bill.name}”`) : L(`ប្រហែលជាការបង់ Bill “${bill.name}”`, `Looks like a payment for “${bill.name}”`))}</strong>
              <label><input type="radio" name="link" value="${escapeAttr(bill.id)}" ${state.linkBillId === bill.id ? "checked" : ""}> ${escapeHtml(d.kind === "bill" ? L("កែ Bill នេះ", "Update this bill") : L("កត់ថា Bill នេះបង់រួច", "Mark this bill paid"))}</label>
              <label><input type="radio" name="link" value="" ${state.linkBillId ? "" : "checked"}> ${escapeHtml(d.kind === "bill" ? L("បង្កើត Bill ថ្មី", "Create a new bill") : L("រក្សាទុកជាចំណាយមួយទៀត", "Save as a separate expense"))}</label>
            </div>` : ""}
          ${duplicates.length ? `
            <div class="sc-dup">
              <strong>${ICON.warn()} ${L("ហាក់ដូចជាបានកត់រួចហើយ", "Possible duplicate")}</strong>
              <ul>${duplicates.slice(0, 3).map(dup => `<li>${escapeHtml(dup.label || dup.collection)} · ${escapeHtml(dup.amount ? (typeof formatPlainMoney === "function" ? formatPlainMoney(dup.amount, dup.currency) : dup.amount) : "")} · ${escapeHtml(dup.date || "")}</li>`).join("")}</ul>
              <label><input type="checkbox" data-scan-force ${state.force ? "checked" : ""}> ${L("ដឹងហើយ — រក្សាទុកទៀត", "I know — save anyway")}</label>
            </div>` : ""}
          <div class="sc-actions">
            <button class="button" type="submit" ${canSave && (!duplicates.length || state.force) ? "" : "disabled"}>${ICON.check()} ${L("រក្សាទុក", "Save")}</button>
            <button class="button ghost-button" type="button" data-scan-reset>${L("ស្កេនថ្មី", "Scan another")}</button>
          </div>
        </article>
      </form>`;
  }

  function savedView() {
    const s = state.saved;
    const text = {
      "expense-created": L("បានកត់ចំណាយ", "Expense saved"),
      "bill-created": L("បានបង្កើត Bill (មិនទាន់បង់)", "Bill saved (unpaid)"),
      "bill-updated": L("បានកែ Bill រួច", "Bill updated"),
      "bill-paid": L("បង់ Bill រួច និងកត់ចំណាយ", "Bill marked paid + expense saved"),
      "bill-already-paid": L("Bill នេះបានបង់រួចហើយ", "That bill was already paid")
    }[s.outcome] || L("បានរក្សាទុក", "Saved");
    return `
      <article class="glass-card sc-done">
        <span class="sc-done-icon">${ICON.check()}</span>
        <h2>${escapeHtml(text)}</h2>
        <div class="sc-actions">
          <a class="button ghost-button" href="${s.collection === "bills" || s.billId ? "#money/bills" : "#money/expenses"}">${L("មើល", "View")}</a>
          <button class="button" type="button" data-scan-reset>${ICON.scan()} ${L("ស្កេនថ្មី", "Scan another")}</button>
        </div>
      </article>`;
  }

  function render() {
    const fromBot = decodeDraft();
    if (fromBot && (!state.draft || state.draft.hash !== fromBot.hash || state.step === "saved")) {
      const bill = ScanParse.matchBill(appData, fromBot);
      state = { ...state, step: "review", draft: fromBot, preview: "", text: "", error: "", linkBillId: bill ? bill.id : "" };
    }
    const body = state.step === "reading" ? readingView() : state.step === "review" && state.draft ? reviewView() : state.step === "saved" && state.saved ? savedView() : pickView();
    return `
      <section class="page sc-page">
        <div class="page-header">
          <div>
            <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${ICON.scan()}</span>${t("smartScan")}</h1>
            <p class="page-subtitle">${L("ថតបង្កាន់ដៃ វិក្កយបត្រ ឬ slip ហើយ app នឹងអានលេខឲ្យ — អ្នកគ្រាន់តែពិនិត្យ ហើយរក្សាទុក", "Read receipts, bills and slips automatically — check, then save")}</p>
          </div>
        </div>
        ${body}
      </section>`;
  }

  function rerender() {
    if (location.hash.split(/[/?]/)[0] !== "#scan") return;
    const app = document.getElementById("app");
    app.innerHTML = render();
    bind();
  }

  function readForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const d = { ...state.draft };
    d.kind = data.kind || d.kind;
    d.amount = data.amount === "" ? null : Math.round(Number(data.amount) * 100) / 100;
    ["currency", "merchant", "date", "category", "paymentMethod", "ref"].forEach(key => { if (key in data) d[key] = String(data[key] || "").trim(); });
    if ("dueDate" in data) d.dueDate = data.dueDate;
    d.missing = d.missing.filter(key => !String(d[key] ?? "").trim());
    d.warnings = d.warnings.filter(key => key !== "currency");
    return { draft: d, link: data.link ?? state.linkBillId };
  }

  function bind() {
    const page = document.querySelector(".sc-page");
    if (!page) return;
    page.querySelectorAll("[data-scan-file]").forEach(input => input.addEventListener("change", () => handleFile(input.files?.[0])));
    page.querySelectorAll("[data-scan-reset]").forEach(button => button.addEventListener("click", () => {
      state = { step: "pick", draft: null, preview: "", fileName: "", text: "", progress: 0, error: "", force: false, linkBillId: "", saved: null };
      if (location.hash !== "#scan") history.replaceState(null, "", "#scan");
      rerender();
    }));
    const form = page.querySelector("[data-scan-form]");
    if (!form) return;
    // kind / link / force changes re-render (they change which fields and buttons show)
    form.querySelectorAll('input[name="kind"], input[name="link"]').forEach(input => input.addEventListener("change", () => {
      const { draft, link } = readForm(form);
      if (input.name === "kind") draft.status = draft.kind === "bill" ? "unpaid" : "paid";
      state = { ...state, draft, linkBillId: input.name === "link" ? link : (ScanParse.matchBill(appData, draft)?.id || "") };
      rerender();
    }));
    form.querySelector("[data-scan-force]")?.addEventListener("change", event => {
      state = { ...state, draft: readForm(form).draft, force: event.target.checked };
      rerender();
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const { draft, link } = readForm(form);
      if (draft.kind !== "bill" && !(Number(draft.amount) > 0)) {
        Toast.show(L("សូមបញ្ចូលចំនួនទឹកប្រាក់", "Please enter the amount"));
        return;
      }
      const dups = ScanParse.findDuplicates(appData, draft);
      if (dups.length && !state.force) {
        state = { ...state, draft };
        rerender();
        return;
      }
      try {
        const result = ScanParse.apply(appData, draft, { source: "Scan", linkBillId: link, makeId: collection => id(collection), today: localDateInput() });
        if (Store.save()) {
          if (typeof Sound !== "undefined") Sound.play(result.collection === "expenses" ? "coin" : "success");
          state = { ...state, step: "saved", saved: result, draft };
          history.replaceState(null, "", "#scan");
          rerender();
        }
      } catch (error) {
        Toast.show(L("រក្សាទុកមិនបាន", "Could not save"));
      }
    });
  }

  return { render, bind };
})();
