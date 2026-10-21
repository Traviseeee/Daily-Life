// Smart Scan on the server (Telegram bot): file bytes → text, free and offline.
// Photos/screenshots: Tesseract OCR (tesseract.js, English model bundled in
// node_modules — no API key, no download at run time). PDFs: the PDF's own text
// (pdf.js); a scanned PDF without text asks for a photo instead.
// The text is then read by js/scan-parse.js — the same rules the app uses.
const crypto = require("crypto");
const path = require("path");

const MAX_BYTES = 10 * 1024 * 1024;
let workerPromise = null;

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function kindOf(buffer, mime = "") {
  if (buffer.slice(0, 5).toString() === "%PDF-" || /pdf/i.test(mime)) return "pdf";
  const sig = buffer.slice(0, 12).toString("hex");
  if (sig.startsWith("ffd8ff") || sig.startsWith("89504e47") || sig.startsWith("52494646") || /^image\//i.test(mime)) return "image";
  return "";
}

async function ocrWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = require("tesseract.js");
      const langPath = path.dirname(require.resolve("@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"));
      const worker = await createWorker("eng", 1, { langPath, cachePath: "/tmp/mylife-tess", gzip: true });
      // 4 = one column of text of different sizes (receipts, bank slips)
      await worker.setParameters({ tessedit_pageseg_mode: "4" });
      return worker;
    })().catch(error => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

async function imageText(buffer) {
  const worker = await ocrWorker();
  const { data } = await worker.recognize(buffer);
  return { text: data.text || "", confidence: Math.round(data.confidence || 0) };
}

async function pdfText(buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // rebuild lines from the text items' vertical position
    const rows = new Map();
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      const key = [...rows.keys()].find(k => Math.abs(k - y) <= 3) ?? y;
      rows.set(key, [...(rows.get(key) || []), { x: item.transform[4], s: item.str }]);
    });
    pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.s).join(" ").trim()).filter(Boolean).join("\n"));
  }
  await doc.destroy();
  return { text: pages.join("\n"), confidence: 100 };
}

// → { text, confidence, hash, type } ; throws "unsupported_file" / "file_too_big" / "pdf_no_text"
async function readDocument(buffer, mime) {
  if (!buffer || !buffer.length) throw new Error("empty_file");
  if (buffer.length > MAX_BYTES) throw new Error("file_too_big");
  const type = kindOf(buffer, mime);
  if (!type) throw new Error("unsupported_file");
  const result = type === "pdf" ? await pdfText(buffer) : await imageText(buffer);
  if (type === "pdf" && result.text.replace(/\s/g, "").length < 10) throw new Error("pdf_no_text");
  return { ...result, hash: sha256(buffer), type };
}

module.exports = { readDocument, sha256, kindOf, MAX_BYTES };
