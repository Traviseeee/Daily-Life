// QC B6 — Smart Scan reads the amount on EDC / bank receipts.
// Run: node tools/verify-scan.js [path/to/scan-parse.js]
// Uses made-up receipt text only (no real data, no network).
const path = require("path");
const file = path.resolve(process.argv[2] || path.join(__dirname, "../js/scan-parse.js"));
const S = require(file);

let pass = 0, fail = 0;
function check(name, text, want) {
  const d = S.parse(text);
  const problems = [];
  for (const [key, value] of Object.entries(want)) {
    if (d[key] !== value) problems.push(`${key}=${JSON.stringify(d[key])} (want ${JSON.stringify(value)})`);
  }
  if (problems.length) { fail++; console.log(`FAIL ${name}: ${problems.join(", ")}`); }
  else { pass++; console.log(`PASS ${name}`); }
}

/* ---- B6: the cases from the QC report ---- */
check("EDC KHR receipt (ទឹកប្រាក់បានបង់ ៖ 1,500 KHR)",
  "អគ្គិសនីកម្ពុជា\nបង្កាន់ដៃបង់ប្រាក់\nលេខអតិថិជន ៖ 123456789\nលេខយោង ៖ 9876543210\nទឹកប្រាក់បានបង់ ៖ 1,500 KHR\nកាលបរិច្ឆេទ ៖ 20/10/2026",
  { amount: 1500, currency: "KHR", provider: "EDC", date: "2026-10-20" });
check("Khmer digits (ទឹកប្រាក់បានបង់ ៖ ១,៥០០ ៛)",
  "អគ្គិសនីកម្ពុជា\nទឹកប្រាក់បានបង់ ៖ ១,៥០០ ៛\nកាលបរិច្ឆេទ ៖ ២០/១០/២០២៦",
  { amount: 1500, currency: "KHR" });
check("amount on the next line",
  "អគ្គិសនីកម្ពុជា\nទឹកប្រាក់បានបង់\n25,800 KHR\nលេខយោង ៖ 55511122",
  { amount: 25800, currency: "KHR" });
check("bank slip, currency before the amount (USD 3.00)",
  "ABA Bank\nTransfer success\nUSD 3.00\nTrx. ID: 123456789012\nDate 20/10/2026",
  { kind: "payment", amount: 3, currency: "USD" });
check("bank slip, signed (-USD 3.00)",
  "ABA Bank\nTransfer success\n-USD 3.00\nTrx. ID: 123456789012",
  { amount: 3, currency: "USD" });
check("EDC USD (Amount paid / USD 3.00)",
  "EDC\nReceipt\nRef: 202610201234\nAmount paid\nUSD 3.00\nDate: 20/10/2026",
  { amount: 3, currency: "USD" });

/* ---- OCR mistakes ---- */
check("OCR space as thousands (1 500 KHR)",
  "អគ្គិសនីកម្ពុជា\nទឹកប្រាក់បានបង់ ៖ 1 500 KHR\nលេខយោង ៖ 77788899",
  { amount: 1500, currency: "KHR" });
check("OCR dot as thousands for riel (1.500 KHR)",
  "អគ្គិសនីកម្ពុជា\nទឹកប្រាក់បានបង់ ៖ 1.500 KHR",
  { amount: 1500, currency: "KHR" });
check("OCR comma as decimal (3,00 USD)",
  "EDC\nទឹកប្រាក់បានបង់: 3,00 USD",
  { amount: 3, currency: "USD" });
check("OCR no space after the colon (ទឹកប្រាក់បានបង់៖1,500KHR)",
  "អគ្គិសនីកម្ពុជា\nទឹកប្រាក់បានបង់៖1,500KHR",
  { amount: 1500, currency: "KHR" });

/* ---- many reference numbers: never take an id as the amount ---- */
check("many refs around the amount",
  "អគ្គិសនីកម្ពុជា\nលេខវិក្កយបត្រ ៖ 400123\nលេខអតិថិជន ៖ 0123456789\nលេខយោង ៖ 9988776655\nទឹកប្រាក់បានបង់ ៖ 12,300 KHR\nTrx. ID: 556677889900\nលេខកុងទ័រ ៖ 778899",
  { amount: 12300, currency: "KHR" });
check("subtotal / fee / balance are not the paid amount",
  "Receipt\nSubtotal 2.50 USD\nService fee 0.50 USD\nPrevious balance 10.00 USD\nAmount paid 3.00 USD",
  { amount: 3, currency: "USD" });

/* ---- old behaviour must stay ---- */
check("unpaid EDC invoice stays a bill",
  "Electricite du Cambodge\nInvoice No: 556677\nDue date: 30/10/2026\nAmount due: 45,600 KHR",
  { kind: "bill", amount: 45600, currency: "KHR", dueDate: "2026-10-30" });
check("shop receipt total", "Coffee Shop\nReceipt\nLatte 2.50\nSubtotal 2.50\nVAT 0.25\nTotal 2.75 USD\nCash 5.00\nChange 2.25",
  { kind: "expense", amount: 2.75, currency: "USD" });
check("bank slip with trailing currency (-12.50 USD)", "ABA Bank\nTransfer success\n-12.50 USD\nTrx. ID: 1234567890",
  { kind: "payment", amount: 12.5, currency: "USD" });
check("USD 1.50 stays 1.5 (dot rule is riel only)", "Shop\nReceipt\nTotal USD 1.50", { amount: 1.5, currency: "USD" });
check("nothing to read → no amount", "hello there\nsee you tomorrow", { amount: null });

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
