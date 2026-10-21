// Expense category words (js/smart-parse.js) — the bot, MYLIFE Chat and the
// expense form all use them. Run: node tools/verify-categories.js [path]
const path = require("path");
const file = path.resolve(process.argv[2] || path.join(__dirname, "../js/smart-parse.js"));
const S = require(file);
const TODAY = "2026-10-21";

// [message as typed in Telegram, expected category]
const CASES = [
  // Food
  ["បាយ 5000", "Food"], ["ញ៉ាំគុយទាវ 2$", "Food"], ["កាហ្វេ 2.5", "Food"], ["តែទឹកដោះ 1.5$", "Food"],
  ["ទិញបាយ 3$", "Food"], ["ទិញសាច់ជ្រូក 20000", "Food"], ["ទិញបន្លែនៅផ្សារ 8000", "Food"], ["នំប៉័ង 1$", "Food"],
  ["ការ៉េម 1$", "Food"], ["lunch 4$", "Food"], ["Starbucks 4.5$", "Food"], ["Cafe Amazon 2$", "Food"],
  ["groceries 25$", "Food"], ["foodpanda 6$", "Food"], ["beer 3$", "Food"], ["fruit 2$", "Food"],
  // Clothes / shopping
  ["ខោអាវ 12$", "Shopping"], ["ទិញអាវ 10$", "Shopping"], ["ស្បែកជើង 25$", "Shopping"], ["ទិញខោ 8$", "Shopping"],
  ["shoes 30$", "Shopping"], ["t-shirt 7$", "Shopping"], ["jeans 20$", "Shopping"], ["Shopee 15$", "Shopping"],
  ["កាត់សក់ 3$", "Shopping"], ["perfume 40$", "Shopping"],
  // Gas / transport
  ["សាំង 5$", "Transport"], ["ចាក់សាំង 20000", "Transport"], ["gas 5$", "Transport"], ["Grab 15k", "Transport"],
  ["PassApp 6000", "Transport"], ["parking 1$", "Transport"], ["ផ្លាស់ប្រេងម៉ូតូ 8$", "Transport"], ["ជួលឡាន 40$", "Transport"],
  ["Caltex 10$", "Transport"], ["tuk tuk 2$", "Transport"], ["flight 120$", "Transport"],
  // Bills
  ["ថ្លៃភ្លើង 40000", "Bills"], ["ថ្លៃទឹក 15000", "Bills"], ["Netflix 9.99$", "Bills"], ["wifi 20$", "Bills"],
  ["កាតទូរស័ព្ទ 5$", "Bills"], ["top up 2$", "Bills"], ["water bill 10$", "Bills"],
  // Home
  ["ជួលផ្ទះ 300$", "Home"], ["rent 250$", "Home"], ["ម្សៅសាប៊ូ 4$", "Home"], ["sofa 200$", "Home"],
  ["ម៉ាស៊ីនត្រជាក់ 350$", "Home"], ["laundry 3$", "Home"],
  // Family
  ["លុយកូន 5$", "Family"], ["ឲ្យម៉ាក់ 50$", "Family"], ["diaper 12$", "Family"], ["ទឹកដោះគោម្សៅ 25$", "Family"],
  ["ចងដៃ 20$", "Family"],
  // Education
  ["ថ្លៃសាលា 100$", "Education"], ["សៀវភៅ 5$", "Education"], ["course 30$", "Education"], ["print 1$", "Education"],
  // Health
  ["ថ្នាំ 3$", "Health"], ["ពេទ្យធ្មេញ 25$", "Health"], ["gym 30$", "Health"], ["pharmacy 6$", "Health"], ["ម៉ាស់ 1$", "Health"],
  // Entertainment
  ["មើលកុន 6$", "Entertainment"], ["សំបុត្រកុន 5$", "Entertainment"], ["movie ticket 5$", "Entertainment"], ["karaoke 20$", "Entertainment"],
  ["hotel 45$", "Entertainment"], ["ដំណើរកម្សាន្ត 100$", "Entertainment"],
  // must NOT be pulled into a category by a word hidden inside another word
  ["ការងារ 5$", "Other"], ["ម៉ាស៊ីនថត 200$", "Other"], ["facebook ads 10$", "Other"], ["business 5$", "Other"]
];

let pass = 0, fail = 0;
for (const [text, want] of CASES) {
  const got = S.parseMoney(text, "USD", TODAY);
  const category = got ? got.category : "(not money)";
  if (category === want) pass++;
  else { fail++; console.log(`FAIL "${text}" → ${category} (want ${want})`); }
}
// amounts and currency still parse the same way
const g = S.parseMoney("Grab 15k", "USD", TODAY);
if (g && g.amount === 15000 && g.currency === "KHR") pass++; else { fail++; console.log("FAIL Grab 15k amount", g); }
const c = S.parseMoney("កាហ្វេ 2.5$", "USD", TODAY);
if (c && c.amount === 2.5 && c.currency === "USD" && c.description === "កាហ្វេ") pass++; else { fail++; console.log("FAIL coffee", c); }

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
