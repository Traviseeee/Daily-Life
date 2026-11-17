/* MYLIFE Business planner (#business, 17 Nov 2026 · phase 1, Khmer first):
 * a list of business plans → pick categories → 5-step setup → a workspace per plan.
 * Working parts now: Overview, Idea, Startup budget, Price & profit, Break-even, Tasks, Settings.
 * The other parts (market, model, products, monthly costs, equipment, marketing, timeline,
 * team, risk, 12-month forecast, reports) show what they will hold and come in the next phase.
 * Data: appData.businessPlans = [{ id, name, desc, location, owner, startDate, launchDate,
 *   categories[], customCat, status: "planning" | "running" | "archived",
 *   idea{ product, problem, customer, why, strengths, weaknesses },
 *   resources{ capital, skills, assets[{ id, name, value, updatedAt, deletedAt }] },
 *   goals{ startup, revenue, profit, customers },
 *   budget[{ id, name, est, actual, updatedAt, deletedAt }],
 *   tasks[{ id, title, due, done, updatedAt, deletedAt }],
 *   pricing{ item, materials, labor, overhead, packaging, delivery, other, sell, want },
 *   breakeven{ fixed, price, variable, units } }]
 * Nested items are hidden with deletedAt (never spliced out) because the cloud merge unions lists by id. */
const BusinessPlanner = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const KM_N = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
  const kmNum = n => (km() ? String(n).replace(/\d/g, d => KM_N[d]) : String(n));

  const CATS = [
    ["retail", "🛍️", ["លក់រាយ និងហាង", "Retail & shop"], ["ហាងសម្លៀកបំពាក់ គ្រឿងទេស លក់ដុំ", "Clothes, groceries, wholesale"]],
    ["online", "🛒", ["អាជីវកម្មអនឡាញ", "Online business"], ["លក់តាម Facebook, TikTok, Telegram", "Selling on Facebook, TikTok, Telegram"]],
    ["make", "🏭", ["ផលិតកម្ម", "Manufacturing"], ["រោងចក្រតូច វេចខ្ចប់ គ្រឿងសង្ហារិម", "Small workshop, packaging, furniture"]],
    ["craft", "🧵", ["សិប្បកម្ម និងដៃ", "Handmade & craft"], ["ដេរ ប៉ាក់ កាបូប កាដូផ្ទាល់ខ្លួន", "Sewing, embroidery, bags, gifts"]],
    ["service", "🛠️", ["សេវាកម្ម", "Services"], ["ជួសជុល សម្អាត ប្រឹក្សា", "Repair, cleaning, consulting"]],
    ["food", "🍜", ["ម្ហូប និងភេសជ្ជៈ", "Food & drink"], ["ហាងបាយ នំ កាហ្វេ ដឹកម្ហូប", "Restaurant, cakes, coffee, delivery"]],
    ["farm", "🌾", ["កសិកម្ម", "Farming"], ["ដំណាំ សត្វ ផ្ទះកញ្ចក់", "Crops, animals, greenhouse"]],
    ["digital", "🎨", ["ឌីជីថល និងច្នៃប្រឌិត", "Digital & creative"], ["រចនា ថតរូប វីដេអូ គេហទំព័រ", "Design, photo, video, websites"]],
    ["edu", "📚", ["អប់រំ និងបណ្តុះបណ្តាល", "Education & training"], ["បង្រៀនគួរ វគ្គអនឡាញ", "Tutoring, online courses"]],
    ["beauty", "💅", ["សម្រស់", "Beauty"], ["សាឡន ផលិតផលថែស្បែក", "Salon, skincare products"]],
    ["build", "🏗️", ["សំណង់ និងអចលនទ្រព្យ", "Construction & property"], ["ជួសជុលផ្ទះ សម្ភារៈសំណង់", "Home repair, building supplies"]],
    ["move", "🚚", ["ដឹកជញ្ជូន", "Transport"], ["ដឹកអីវ៉ាន់ ជួលឡាន", "Delivery, car rental"]],
    ["trade", "🚢", ["នាំចូល និងនាំចេញ", "Import & export"], ["រកអ្នកផ្គត់ផ្គង់ គយ ឃ្លាំង", "Suppliers, customs, storage"]],
    ["family", "🏠", ["អាជីវកម្មគ្រួសារ", "Family business"], ["ហាង ឬរបរបន្តពីដូនតា", "A shop or trade run by the family"]],
    ["custom", "✨", ["ផ្សេងៗ / បង្កើតខ្លួនឯង", "Other / my own"], ["ដាក់ឈ្មោះប្រភេទដោយខ្លួនឯង", "Name your own type"]]
  ];
  const catOf = key => CATS.find(c => c[0] === key);
  const catName = key => { const c = catOf(key); return c ? L(c[2][0], c[2][1]) : key; };

  // starter tasks: everyone gets the basics, each type adds its own
  const BASE_TASKS = [
    ["សរសេរគំនិត និងបញ្ហាដែលអាជីវកម្មដោះស្រាយ", "Write down the idea and the problem it solves"],
    ["សួរអតិថិជនគោលដៅយ៉ាងតិច ៥ នាក់", "Talk to at least 5 target customers"],
    ["ពិនិត្យគូប្រជែង ៣ (តម្លៃ ចំណុចខ្លាំង)", "Check 3 competitors (prices, strengths)"],
    ["គណនាថ្លៃដើម និងតម្លៃលក់", "Work out cost and selling price"],
    ["រៀបចំបញ្ជីទុនចាប់ផ្តើម", "List the startup budget"],
    ["គណនាចំណុចរួចខ្លួន", "Find the break-even point"],
    ["កំណត់ថ្ងៃបើកលក់", "Set the launch date"]
  ];
  const CAT_TASKS = {
    retail: [["រកទីតាំងហាង និងប្រៀបធៀបថ្លៃជួល", "Find a shop location and compare rent"], ["រកអ្នកផ្គត់ផ្គង់ទំនិញ ២–៣", "Find 2–3 stock suppliers"]],
    online: [["បង្កើតទំព័រ Facebook / TikTok / Telegram", "Set up Facebook / TikTok / Telegram pages"], ["ថតរូបផលិតផលឱ្យស្អាត", "Take good product photos"], ["រៀបចំសេវាដឹកជញ្ជូន", "Arrange delivery"]],
    make: [["ប្រៀបធៀបម៉ាស៊ីន និងឧបករណ៍", "Compare machines and tools"], ["ផលិតគំរូសាកល្បង", "Make a test batch"]],
    craft: [["ធ្វើគំរូ ៣ ដុំ ដើម្បីបង្ហាញ", "Make 3 samples to show"], ["រកអ្នកផ្គត់ផ្គង់វត្ថុធាតុ", "Find material suppliers"]],
    service: [["កំណត់កញ្ចប់សេវា និងតម្លៃ", "Set service packages and prices"], ["រៀបចំឧបករណ៍ចាំបាច់", "Get the tools you need"]],
    food: [["សាកមុខម្ហូប ឬភេសជ្ជៈជាមួយមិត្តភក្តិ", "Test the menu with friends"], ["ពិនិត្យអនាម័យ និងលិខិតអនុញ្ញាត", "Check hygiene and permits"], ["រកអ្នកផ្គត់ផ្គង់គ្រឿងផ្សំ", "Find ingredient suppliers"]],
    farm: [["ជ្រើសដី ឬទីតាំង", "Choose the land or place"], ["គ្រោងរដូវដាំ ឬចិញ្ចឹម", "Plan the growing or raising season"]],
    digital: [["រៀបចំ portfolio ការងារ", "Put together a portfolio"], ["កំណត់កញ្ចប់តម្លៃ", "Set price packages"]],
    edu: [["រៀបចំកម្មវិធីសិក្សា", "Plan the lessons"], ["រកកន្លែងបង្រៀន ឬ platform", "Find a place or platform to teach"]],
    beauty: [["រកទីតាំង និងឧបករណ៍", "Find a place and equipment"], ["ជ្រើសផលិតផលដែលនឹងប្រើ", "Choose the products you will use"]],
    build: [["រៀបចំបញ្ជីសម្ភារៈ និងតម្លៃ", "List materials and prices"], ["ពិនិត្យអាជ្ញាប័ណ្ណដែលត្រូវការ", "Check the licences you need"]],
    move: [["ពិនិត្យយានយន្ត និងធានារ៉ាប់រង", "Check vehicles and insurance"], ["កំណត់តម្លៃដឹកតាមចម្ងាយ", "Set prices by distance"]],
    trade: [["រកអ្នកផ្គត់ផ្គង់បរទេស", "Find overseas suppliers"], ["សិក្សាពន្ធគយ និងថ្លៃដឹក", "Learn customs duty and shipping costs"]],
    family: [["បែងចែកតួនាទីក្នុងគ្រួសារ", "Share out roles in the family"], ["ដាក់លុយហាង និងលុយគ្រួសារដាច់គ្នា", "Keep shop money apart from family money"]]
  };

  // workspace parts: [key, emoji, km, en, ready?, what it will hold]
  const MODS = [
    ["ov", "🏠", "ទិដ្ឋភាពរួម", "Overview", true],
    ["idea", "💡", "គំនិត", "Idea", true],
    ["bud", "💰", "ទុនចាប់ផ្តើម", "Startup budget", true],
    ["price", "🧮", "តម្លៃ និងចំណេញ", "Price & profit", true],
    ["be", "⚖️", "ចំណុចរួចខ្លួន", "Break-even", true],
    ["task", "✅", "ការងារ", "Tasks", true],
    ["market", "🔎", "ស្រាវជ្រាវទីផ្សារ", "Market research", false, ["អតិថិជន គូប្រជែង និងភស្តុតាង (ស្មាន · កំពុងរក · បញ្ជាក់រួច)", "Customers, competitors and evidence (guess · checking · confirmed)"]],
    ["model", "🧩", "គំរូអាជីវកម្ម", "Business model", false, ["លក់អ្វី ឱ្យនរណា តាមណា រកលុយយ៉ាងណា", "What you sell, to whom, how, and how you earn"]],
    ["prod", "📦", "ផលិតផល និងសេវា", "Products & services", false, ["បញ្ជីផលិតផល តម្លៃ ថ្លៃដើម និងចំណូល/ខែ", "Product list with price, cost and monthly sales"]],
    ["month", "📆", "ចំណាយប្រចាំខែ", "Monthly costs", false, ["ជួល ប្រាក់ខែ ភ្លើង អ៊ីនធឺណិត", "Rent, wages, power, internet"]],
    ["equip", "🪡", "ឧបករណ៍ និងអ្នកផ្គត់ផ្គង់", "Equipment & suppliers", false, ["ប្រៀបធៀបម៉ាស៊ីន និងអ្នកផ្គត់ផ្គង់ក្បែរគ្នា", "Compare machines and suppliers side by side"]],
    ["mkt", "📣", "ផែនការទីផ្សារ", "Marketing", false, ["Facebook, TikTok, Telegram, ថវិកាផ្សាយ", "Facebook, TikTok, Telegram and ad budget"]],
    ["time", "🗺️", "ដំណាក់កាល", "Timeline", false, ["ពីគំនិត ដល់បើកលក់ — អ្នកកំណត់ថ្ងៃខ្លួនឯង", "From idea to launch, on your own dates"]],
    ["team", "👥", "ក្រុម", "Team", false, ["ម្ចាស់ ដៃគូ គ្រួសារ បុគ្គលិក និងតួនាទី", "Owners, partners, family, staff and roles"]],
    ["risk", "⚠️", "ហានិភ័យ", "Risks", false, ["ហានិភ័យ ផលប៉ះពាល់ និងផែនការបម្រុង", "Risks, impact and backup plans"]],
    ["fc", "📈", "ព្យាករណ៍ ១២ ខែ", "12-month forecast", false, ["ចំណូល ចំណាយ ចំណេញ ១២ ខែ", "Income, costs and profit for 12 months"]],
    ["rep", "🖨️", "របាយការណ៍", "Reports", false, ["នាំចេញ CSV និង backup", "Export CSV and backup"]],
    ["set", "⚙️", "កំណត់គម្រោង", "Plan settings", true]
  ];

  /* ---------- state on this screen (not saved) ---------- */
  let mod = "ov";
  let sort = "new";
  let filter = "all";
  let taskFilter = "all";
  let draft = null; // the plan being set up
  let step = -1; // -1 = categories, 0..4 = setup steps
  const fresh = () => ({ name: "", desc: "", location: "", owner: "self", startDate: localDateInput(), launchDate: "", categories: [], customCat: "", idea: {}, resources: { capital: "", skills: "", assets: [] }, goals: {} });

  /* ---------- helpers ---------- */
  const uid = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = () => new Date().toISOString();
  const list = () => (Array.isArray(appData.businessPlans) ? appData.businessPlans : []);
  const live = items => (Array.isArray(items) ? items.filter(item => item && !item.deletedAt) : []);
  const num = v => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
  const usd = v => { const n = Number(v) || 0; return `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: Math.abs(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`; };
  const dayLabel = iso => { if (!iso) return "—"; const [y, m, d] = iso.split("-").map(Number); return km() ? `${kmNum(d)} ${KM_M[m - 1]} ${kmNum(y)}` : new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  const ago = iso => {
    if (!iso) return "";
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
    if (days <= 0) return L("កែថ្ងៃនេះ", "Edited today");
    return L(`កែ ${kmNum(days)} ថ្ងៃមុន`, `Edited ${days} day${days > 1 ? "s" : ""} ago`);
  };
  const param = () => (typeof App !== "undefined" && App.param) || "";
  const current = () => list().find(plan => plan.id === param());
  const go = hash => { if (location.hash === hash) App.render(); else location.hash = hash; };

  function stats(plan) {
    const tasks = live(plan.tasks);
    const done = tasks.filter(task => task.done).length;
    const est = live(plan.budget).reduce((sum, item) => sum + num(item.est), 0);
    const actual = live(plan.budget).reduce((sum, item) => sum + num(item.actual), 0);
    const assets = live(plan.resources?.assets).reduce((sum, item) => sum + num(item.value), 0);
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    return { tasks: tasks.length, done, est, actual, assets, pct };
  }
  function stageOf(plan, pct) {
    if (plan.status === "archived") return L("បណ្ណសារ", "Archived");
    if (plan.status === "running") return L("កំពុងដំណើរការ", "Running");
    if (pct >= 80) return L("ជិតបើកលក់", "Almost ready to open");
    if (pct >= 50) return L("រៀបចំទុន និងឧបករណ៍", "Getting money and equipment ready");
    if (pct >= 20) return L("ស្រាវជ្រាវ និងគណនា", "Research and numbers");
    return L("គំនិតដំបូង", "First idea");
  }
  const icon = plan => { const c = catOf((plan.categories || [])[0]); return c ? c[1] : "💼"; };
  // pricing and break-even, the two formulas people get wrong
  function priceMath(p = {}) {
    const cost = ["materials", "labor", "overhead", "packaging", "delivery", "other"].reduce((sum, key) => sum + Math.max(0, num(p[key])), 0);
    const sell = num(p.sell);
    const profit = sell - cost;
    const margin = sell > 0 ? (profit / sell) * 100 : null;
    const want = p.want === undefined || p.want === "" ? 40 : num(p.want);
    const wantOk = want >= 0 && want < 100;
    return { cost, sell, profit, margin, want, wantOk, suggest: wantOk ? cost / (1 - want / 100) : null };
  }
  function beMath(b = {}) {
    const fixed = num(b.fixed), price = num(b.price), variable = num(b.variable);
    const cm = price - variable;
    const units = b.units === undefined || b.units === "" ? 300 : num(b.units);
    const ok = cm > 0;
    const qty = ok ? Math.ceil(fixed / cm) : null;
    return { fixed, price, variable, cm, ok, qty, revenue: ok ? qty * price : null, units, atUnits: units * cm - fixed };
  }

  /* ---------- smart bits (17 Nov): nice prices, riel, per-day, payback, Nomi's advice ---------- */
  const WORK_DAYS = 26; // a shop month in Cambodia: about 26 open days
  const rate = () => { let r = 4100; try { r = Number(localStorage.getItem("mylife:calc-rate")) || 4100; } catch (error) { /* ignore */ } return r; };
  const riel = v => `៛${(Math.round((Number(v) || 0) * rate() / 100) * 100).toLocaleString("en-US")}`;
  // a price people like to pay: up to the next 0.50 under $20, the next $1 under $100, else the next $5
  const nicePrice = v => { if (!(v > 0)) return 0; const step = v < 20 ? 0.5 : v < 100 ? 1 : 5; return Math.ceil((v - 1e-9) / step) * step; };
  const pct = v => `${(Math.round(v * 10) / 10).toLocaleString("en-US")}%`;
  const daysUntil = iso => (iso ? Math.round((new Date(`${iso}T00:00:00`) - new Date(`${localDateInput()}T00:00:00`)) / 864e5) : null);

  // the extra numbers both calculators and Nomi use
  function smartNumbers(plan) {
    const pm = priceMath(plan.pricing);
    const be = beMath(plan.breakeven);
    const s = stats(plan);
    const g = plan.goals || {};
    const capital = num(plan.resources?.capital);
    const goalCustomers = num(g.customers), goalProfit = num(g.profit);
    const perDay = be.qty ? Math.ceil(be.qty / WORK_DAYS) : null;
    const forGoal = be.ok && goalProfit > 0 ? Math.ceil((be.fixed + goalProfit) / be.cm) : null;
    // monthly profit if you sell your goal amount (or the "if you sell" number)
    const units = goalCustomers > 0 ? goalCustomers : be.units;
    const monthly = be.ok ? units * be.cm - be.fixed : null;
    const payback = s.est > 0 && monthly > 0 ? Math.ceil(s.est / monthly) : null;
    const reserve = be.fixed * 3; // three months of fixed costs kept aside
    return { pm, be, s, g, capital, gap: s.est - capital, perDay, forGoal, units, monthly, payback, reserve, goalCustomers, goalProfit };
  }

  // Nomi's advice: [tone, emoji, text, part to open]; tone: bad | warn | ok | idea
  function advice(plan) {
    const n = smartNumbers(plan);
    const { pm, be, s } = n;
    const tips = [];
    const add = (tone, emoji, text, to) => tips.push({ tone, emoji, text, to });
    // price
    if (!pm.cost && !pm.sell) add("idea", "🧮", L("ចាប់ផ្តើមគណនាថ្លៃដើមក្នុងមួយដុំសិន — វាជាគ្រឹះនៃលេខទាំងអស់", "Start with the cost of one unit — every other number builds on it"), "price");
    else if (pm.sell > 0 && pm.profit < 0) add("bad", "🔻", L(`លក់ ${usd(pm.sell)} តែថ្លៃដើម ${usd(pm.cost)} — ខាត ${usd(-pm.profit)} រាល់ដុំ។ គួរលក់យ៉ាងតិច ${usd(nicePrice(pm.cost / 0.6))}`, `Selling at ${usd(pm.sell)} with a ${usd(pm.cost)} cost loses ${usd(-pm.profit)} a unit. Ask at least ${usd(nicePrice(pm.cost / 0.6))}`), "price");
    else if (pm.sell > 0 && pm.margin < 20) add("warn", "📉", L(`អត្រាចំណេញ ${pct(pm.margin)} ទាបពេក — បើលក់ ${usd(nicePrice(pm.cost / 0.6))} នឹងបាន ~40%`, `A ${pct(pm.margin)} margin is thin — at ${usd(nicePrice(pm.cost / 0.6))} you'd make about 40%`), "price");
    else if (pm.sell > 0) add("ok", "💚", L(`អត្រាចំណេញ ${pct(pm.margin)} ល្អ — ចំណេញ ${usd(pm.profit)} រាល់ដុំ`, `A ${pct(pm.margin)} margin is healthy — ${usd(pm.profit)} a unit`), "price");
    else if (pm.cost) add("idea", "🏷️", L(`ថ្លៃដើម ${usd(pm.cost)} ហើយ — ដាក់តម្លៃលក់ ឧ. ${usd(nicePrice(pm.cost / 0.6))} (40%)`, `Cost is ${usd(pm.cost)} — set a price, e.g. ${usd(nicePrice(pm.cost / 0.6))} (40%)`), "price");
    // break-even
    if (be.price > 0 && !be.ok) add("bad", "⚖️", L("តម្លៃលក់មិនលើសថ្លៃដើម — លក់ច្រើនប៉ុណ្ណាក៏មិនរួចខ្លួន", "The price doesn't beat the cost — no amount of sales will break even"), "be");
    else if (be.ok && be.fixed > 0) {
      add(n.goalCustomers && be.qty > n.goalCustomers ? "warn" : "ok", "⚖️", n.goalCustomers && be.qty > n.goalCustomers
        ? L(`ត្រូវលក់ ${kmNum(be.qty)} ដុំ/ខែ ដើម្បីរួចខ្លួន តែគោលដៅមានតែ ${kmNum(n.goalCustomers)} — បន្ថយចំណាយថេរ ឬឡើងតម្លៃ`, `You need ${be.qty} sales a month to break even but aim for ${n.goalCustomers} — cut fixed costs or raise the price`)
        : L(`រួចខ្លួនពេលលក់ ${kmNum(be.qty)} ដុំ/ខែ (~${kmNum(n.perDay)} ដុំ/ថ្ងៃ)`, `Break even at ${be.qty} sales a month (~${n.perDay} a day)`), "be");
      if (n.forGoal) add("idea", "🎯", L(`ដើម្បីចំណេញ ${usd(n.goalProfit)}/ខែ ត្រូវលក់ ${kmNum(n.forGoal)} ដុំ/ខែ (~${kmNum(Math.ceil(n.forGoal / WORK_DAYS))}/ថ្ងៃ)`, `To make ${usd(n.goalProfit)} a month, sell ${n.forGoal} (~${Math.ceil(n.forGoal / WORK_DAYS)} a day)`), "be");
    } else if (pm.sell > 0) add("idea", "🏠", L("ដាក់ចំណាយថេរ/ខែ (ជួល ប្រាក់ខែ ភ្លើង) ដើម្បីដឹងថាត្រូវលក់ប៉ុន្មាន", "Add your monthly fixed costs (rent, wages, power) to see how much you must sell"), "be");
    // money
    if (!s.est) add("idea", "💰", L("រាយរបស់ត្រូវទិញ ដើម្បីដឹងទុនដែលត្រូវការពិតប្រាកដ", "List what you must buy to see the real startup budget"), "bud");
    else if (n.gap > 0) add("warn", "💸", L(`ទុនខ្វះ ${usd(n.gap)} (មាន ${usd(n.capital)} · ត្រូវការ ${usd(s.est)}) — ចាប់ផ្តើមតូចសិន ឬទិញរបស់មួយទឹក`, `${usd(n.gap)} short (have ${usd(n.capital)}, need ${usd(s.est)}) — start smaller or buy second-hand`), "bud");
    else if (n.reserve > 0 && n.capital - s.est < n.reserve) add("warn", "🛟", L(`ទុនគ្រប់ តែគួរទុកលុយបម្រុង ៣ ខែ ${usd(n.reserve)} — ឥឡូវសល់ ${usd(Math.max(0, n.capital - s.est))}`, `Covered, but keep 3 months of fixed costs (${usd(n.reserve)}) aside — ${usd(Math.max(0, n.capital - s.est))} left now`), "bud");
    else add("ok", "💰", L(`ទុនគ្រប់ សល់ ${usd(n.capital - s.est)}`, `Budget covered with ${usd(n.capital - s.est)} to spare`), "bud");
    live(plan.budget).filter(item => num(item.est) > 0 && num(item.actual) > num(item.est)).slice(0, 2)
      .forEach(item => add("warn", "🧾", L(`${item.name} ចាយលើសប៉ាន់ស្មាន ${usd(num(item.actual) - num(item.est))}`, `${item.name} went ${usd(num(item.actual) - num(item.est))} over the estimate`), "bud"));
    if (n.payback) add(n.payback > 24 ? "warn" : "ok", "⏳", L(`បើលក់ ${kmNum(n.units)} ដុំ/ខែ យកទុនមកវិញក្នុង ~${kmNum(n.payback)} ខែ`, `Selling ${n.units} a month pays the budget back in ~${n.payback} months`), "be");
    else if (n.monthly !== null && n.monthly <= 0 && be.fixed > 0) add("bad", "⏳", L(`បើលក់ ${kmNum(n.units)} ដុំ/ខែ នៅខាត ${usd(-n.monthly)}/ខែ`, `At ${n.units} a month you still lose ${usd(-n.monthly)} a month`), "be");
    // time + tasks
    const today = localDateInput();
    const open = live(plan.tasks).filter(task => !task.done);
    const late = open.filter(task => task.due && task.due < today).length;
    if (late) add("warn", "⏰", L(`ការងារ ${kmNum(late)} ហួសកំណត់ហើយ`, `${late} task${late > 1 ? "s are" : " is"} overdue`), "task");
    const left = daysUntil(plan.launchDate);
    if (plan.status !== "running" && left !== null && left < 0) add("idea", "🚀", L("ថ្ងៃបើកលក់កន្លងហើយ — បើបើករួច ប្តូរស្ថានភាពជា \"កំពុងដំណើរការ\" ឬកំណត់ថ្ងៃថ្មី", "The opening date has passed — mark it Running or set a new date"), "set");
    else if (left !== null && left >= 0 && open.length) {
      const weeks = Math.max(1, Math.ceil(left / 7));
      add(open.length / weeks > 5 ? "warn" : "idea", "🗓️", L(`នៅ ${kmNum(left)} ថ្ងៃទៀតបើកលក់ — ធ្វើ ~${kmNum(Math.ceil(open.length / weeks))} ការងារ/សប្តាហ៍`, `${left} days to opening — about ${Math.ceil(open.length / weeks)} task${open.length / weeks > 1 ? "s" : ""} a week`), "task");
    } else if (!plan.launchDate) add("idea", "🗓️", L("កំណត់ថ្ងៃបើកលក់ ដើម្បីឱ្យ Nomi ជួយគិតល្បឿនការងារ", "Set an opening date so Nomi can pace your tasks"), "set");
    const order = { bad: 0, warn: 1, idea: 2, ok: 3 };
    tips.sort((a, b) => order[a.tone] - order[b.tone]);
    const score = Math.max(5, Math.min(100, 100 - tips.reduce((t, tip) => t + (tip.tone === "bad" ? 25 : tip.tone === "warn" ? 10 : tip.tone === "idea" ? 6 : 0), 0)));
    return { tips, score, n };
  }
  const scoreLabel = score => (score >= 80 ? L("រឹងមាំ", "Strong") : score >= 55 ? L("កំពុងល្អ", "Getting there") : L("ត្រូវកែ", "Needs work"));
  const scoreMood = score => (score >= 80 ? "proud" : score >= 55 ? "" : "worry");
  const nomiSvg = mood => (typeof HomeV2 !== "undefined" && HomeV2.role ? HomeV2.role("money", mood) : typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy(mood === "worry" ? "worry" : "happy") : "🐱");
  const nomiCard = (text, mood, extra = "") => `<div class="bp-nomi"><span class="bp-nomi-av" aria-hidden="true">${nomiSvg(mood)}</span><div class="bp-bubble"><small>Nomi</small><p>${text}</p>${extra}</div></div>`;
  // one short line for the calculators, updated as you type
  function priceTip(plan) {
    const pm = priceMath(plan.pricing);
    if (!pm.cost) return L("ដាក់ថ្លៃសម្ភារៈ និងកម្លាំង — Nomi នឹងគណនាតម្លៃគួរលក់ឱ្យ 🧮", "Fill in materials and labour — Nomi works out the price 🧮");
    if (!pm.sell) return L(`ថ្លៃដើម ${usd(pm.cost)}។ សាកលក់ ${usd(nicePrice(pm.cost / 0.6))} ដើម្បីបាន ~40% 😺`, `Cost ${usd(pm.cost)}. Try ${usd(nicePrice(pm.cost / 0.6))} for about 40% 😺`);
    if (pm.profit < 0) return L(`ឱ! ខាត ${usd(-pm.profit)} រាល់ដុំ 😿 ឡើងតម្លៃយ៉ាងតិច ${usd(nicePrice(pm.cost))}`, `Oh no, ${usd(-pm.profit)} lost per unit 😿 Ask at least ${usd(nicePrice(pm.cost))}`);
    if (pm.margin < 20) return L(`ចំណេញ ${pct(pm.margin)} តិចពេក។ ${usd(nicePrice(pm.cost / 0.6))} ល្អជាង 🙀`, `${pct(pm.margin)} is thin. ${usd(nicePrice(pm.cost / 0.6))} works better 🙀`);
    if (pm.margin > 70) return L(`ចំណេញ ${pct(pm.margin)} ខ្ពស់ណាស់ — ពិនិត្យតម្លៃគូប្រជែងផង 👀`, `${pct(pm.margin)} is high — check competitors' prices 👀`);
    return L(`ល្អ! ចំណេញ ${usd(pm.profit)} រាល់ដុំ (${pct(pm.margin)}) ≈ ${riel(pm.profit)} 😸`, `Nice! ${usd(pm.profit)} a unit (${pct(pm.margin)}) ≈ ${riel(pm.profit)} 😸`);
  }
  function beTip(plan) {
    const n = smartNumbers(plan);
    const { be } = n;
    if (!be.fixed && !be.price) return L("ដាក់ចំណាយថេរ/ខែ និងតម្លៃ — Nomi ប្រាប់ថាត្រូវលក់ប៉ុន្មាន ⚖️", "Add fixed costs and prices — Nomi tells you how much to sell ⚖️");
    if (!be.ok) return L("តម្លៃលក់ត្រូវខ្ពស់ជាងថ្លៃដើមសិន 😿", "The price must beat the cost first 😿");
    if (!be.fixed) return L("ដាក់ចំណាយថេរ/ខែ ផង (ជួល ប្រាក់ខែ ភ្លើង) 🏠", "Add your monthly fixed costs too (rent, wages, power) 🏠");
    return L(`លក់ ~${kmNum(n.perDay)} ដុំ/ថ្ងៃ (${kmNum(WORK_DAYS)} ថ្ងៃ/ខែ) ក៏រួចខ្លួន${n.forGoal ? ` · ចំណេញ ${usd(n.goalProfit)} ត្រូវ ~${kmNum(Math.ceil(n.forGoal / WORK_DAYS))}/ថ្ងៃ` : ""} 😺`, `About ${n.perDay} a day (${WORK_DAYS} open days) breaks even${n.forGoal ? ` · ${usd(n.goalProfit)} profit needs ~${Math.ceil(n.forGoal / WORK_DAYS)} a day` : ""} 😺`);
  }

  /* ---------- saving without a full redraw (live calculators) ---------- */
  let saveTimer = null;
  function patch(plan, fn) {
    fn(plan);
    plan.updatedAt = now();
    clearTimeout(saveTimer);
    if (typeof isGuestMode === "function" && isGuestMode()) return; // guests keep it on screen only (no toast per key)
    saveTimer = setTimeout(() => Store.save(), 600);
  }
  function editPlan(plan, changes) { clearTimeout(saveTimer); Store.edit("businessPlans", plan.id, changes); }

  /* ---------- screens ---------- */
  const back = (href, label) => `<a class="ct-back" href="${href}" aria-label="${escapeAttr(label)}">‹</a>`;
  const hero = (href, title, sub, emoji = "💼") => `<header class="ct-hero">${back(href, L("ត្រឡប់", "Back"))}<span class="ct-hi"><span class="ct-ic" aria-hidden="true">${emoji}</span><span><b>${escapeHtml(title)}</b><small>${escapeHtml(sub)}</small></span></span></header>`;

  // Nomi on the list: the most urgent thing across your plans
  function dashNomi(all) {
    const active = all.filter(plan => plan.status !== "archived");
    if (!active.length) return nomiCard(L("សួស្តី! ប្រាប់ Nomi ពីគំនិតអាជីវកម្មរបស់អ្នក — Nomi ជួយគណនាតម្លៃ ទុន និងចំណុចរួចខ្លួន 💼", "Hi! Tell Nomi your business idea — I'll help with prices, budget and break-even 💼"), "");
    const worst = active.map(plan => ({ plan, a: advice(plan) })).sort((x, y) => x.a.score - y.a.score)[0];
    const tip = worst.a.tips[0];
    const text = tip && tip.tone !== "ok" ? `<b>${escapeHtml(worst.plan.name || "")}</b> · ${escapeHtml(tip.text)}` : L("គម្រោងទាំងអស់កំពុងទៅល្អ 😸", "All your plans are on track 😸");
    return nomiCard(text, scoreMood(worst.a.score));
  }

  function dashboard() {
    const all = list();
    const totals = all.reduce((t, plan) => { const s = stats(plan); t.est += s.est; t.done += s.done; t.tasks += s.tasks; if (plan.status === "running") t.run += 1; if (plan.status !== "archived" && plan.status !== "running") t.plan += 1; return t; }, { est: 0, done: 0, tasks: 0, run: 0, plan: 0 });
    let shown = all.filter(plan => filter === "all" ? plan.status !== "archived" : filter === "planning" ? (!plan.status || plan.status === "planning") : plan.status === filter);
    shown = shown.slice().sort((a, b) => sort === "old" ? String(a.createdAt).localeCompare(String(b.createdAt)) : sort === "progress" ? stats(b).pct - stats(a).pct : String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    const chips = [["all", L("ទាំងអស់", "All")], ["planning", L("កំពុងរៀបចំ", "Planning")], ["running", L("កំពុងដំណើរការ", "Running")], ["archived", L("បណ្ណសារ", "Archived")]];
    const card = plan => {
      const s = stats(plan);
      const hs = advice(plan).score;
      const search = [plan.name, plan.desc, ...(plan.categories || []).map(catName), plan.customCat].join(" ").toLowerCase();
      const archived = plan.status === "archived";
      return `<div class="bp-projw" data-bp-search="${escapeAttr(search)}"><a class="bp-proj" href="#business/${escapeAttr(plan.id)}">
        <span class="bp-ic" aria-hidden="true">${icon(plan)}</span>
        <span class="bp-pm"><b>${escapeHtml(plan.name || L("គ្មានឈ្មោះ", "Untitled"))}</b>${plan.desc ? `<small>${escapeHtml(plan.desc)}</small>` : ""}
          <span class="bp-tags">${(plan.categories || []).slice(0, 3).map(key => `<span class="bp-pill">${escapeHtml(key === "custom" && plan.customCat ? plan.customCat : catName(key))}</span>`).join("")}${plan.status === "running" ? `<span class="bp-pill is-ok">${L("កំពុងដំណើរការ", "Running")}</span>` : ""}</span></span>
        <span class="bp-pfoot"><span class="bp-meta"><span>${L("សុខភាព", "Health")} <b class="bp-hp is-${hs >= 80 ? "ok" : hs >= 55 ? "mid" : "bad"}">${kmNum(hs)}</b> · ${L("ដំណាក់កាល", "Stage")}៖ <b>${escapeHtml(stageOf(plan, s.pct))}</b></span><b>${kmNum(s.pct)}%</b></span>
          <span class="bp-prog" aria-hidden="true"><i style="width:${s.pct}%"></i></span>
          <span class="bp-meta"><span>${L("ទុន", "Budget")} <b>${usd(s.est)}</b></span>${plan.launchDate ? `<span>${L("បើកលក់", "Opens")} <b>${escapeHtml(dayLabel(plan.launchDate))}</b></span>` : ""}<span>${escapeHtml(ago(plan.updatedAt || plan.createdAt))}</span></span></span>
      </a>
      <button type="button" class="bp-more" data-bp-more="${escapeAttr(plan.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="${escapeAttr(L("ជម្រើសផ្សេងៗ", "More options"))}">⋯</button>
      <div class="bp-menu" role="menu" data-bp-menu="${escapeAttr(plan.id)}" hidden>
        <a role="menuitem" href="#business/${escapeAttr(plan.id)}" data-bp-open-set>⚙️ ${L("កែគម្រោង", "Edit plan")}</a>
        <button type="button" role="menuitem" data-bp-archive="${escapeAttr(plan.id)}">${archived ? `📤 ${L("យកចេញពីបណ្ណសារ", "Restore")}` : `🗄️ ${L("ទុកក្នុងបណ្ណសារ", "Archive")}`}</button>
        <button type="button" role="menuitem" class="is-bad" data-bp-del="${escapeAttr(plan.id)}">🗑️ ${L("លុប", "Delete")}</button>
      </div></div>`;
    };
    return `<section class="page bp-page">
      ${hero("#launcher", L("ផែនការអាជីវកម្ម", "Business planner"), L("ពីគំនិត រហូតដល់បើកលក់", "From idea to opening day"))}
      <div class="bp-panel">
        ${dashNomi(all)}
        <a class="bp-btn is-pri" href="#business/new">＋ ${L("ផែនការអាជីវកម្មថ្មី", "New business plan")}</a>
        ${all.length ? `<div class="bp-stats">
          <div><small>${L("គម្រោង", "Plans")}</small><b>${kmNum(all.length)}</b></div>
          <div><small>${L("កំពុងរៀបចំ", "Planning")}</small><b>${kmNum(totals.plan)}</b></div>
          <div><small>${L("ទុនប៉ាន់ស្មាន", "Est. budget")}</small><b>${usd(totals.est)}</b></div>
          <div><small>${L("ការងាររួច", "Tasks done")}</small><b>${kmNum(totals.done)}/${kmNum(totals.tasks)}</b></div>
        </div>` : ""}
      </div>
      ${all.length ? `<div class="bp-tools"><input class="bp-in" type="search" data-bp-q placeholder="${escapeAttr(L("ស្វែងរកគម្រោង", "Search plans"))}" aria-label="${escapeAttr(L("ស្វែងរកគម្រោង", "Search plans"))}">
          <select class="bp-in bp-sel" data-bp-sort aria-label="${escapeAttr(L("តម្រៀប", "Sort"))}">${[["new", L("ថ្មីបំផុត", "Newest")], ["old", L("ចាស់បំផុត", "Oldest")], ["progress", L("វឌ្ឍនភាព", "Progress")]].map(([k, label]) => `<option value="${k}"${sort === k ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></div>
        <div class="bp-chips" role="group" aria-label="${escapeAttr(L("តម្រង", "Filter"))}">${chips.map(([k, label]) => `<button type="button" class="bp-chip" data-bp-filter="${k}" aria-pressed="${filter === k}">${escapeHtml(label)}</button>`).join("")}</div>
        <div class="bp-list">${shown.map(card).join("") || `<p class="bp-mute bp-none">${L("គ្មានគម្រោងក្នុងតម្រងនេះ", "No plans in this filter")}</p>`}</div>
        <p class="bp-mute bp-none" data-bp-nohit hidden>${L("រកមិនឃើញ", "Nothing found")}</p>`
      : `<div class="bp-panel bp-empty"><span aria-hidden="true">💼</span><b>${L("មិនទាន់មានផែនការអាជីវកម្មទេ", "No business plans yet")}</b><small>${L("ចាប់ផ្តើមពីគំនិតមួយ។ យើងនឹងរៀបចំបញ្ជីការងារតាមប្រភេទអាជីវកម្មរបស់អ្នក។", "Start from one idea. We'll set up a task list that fits your type of business.")}</small><a class="bp-btn is-pri" href="#business/new">＋ ${L("ចាប់ផ្តើមផែនការដំបូង", "Start your first plan")}</a></div>`}
    </section>`;
  }

  function categories() {
    const d = draft;
    return `<section class="page bp-page">
      ${hero("#business", L("តើចង់ចាប់ផ្តើមអាជីវកម្មអ្វី?", "What business do you want to start?"), L("ជ្រើសប្រភេទមួយ ឬច្រើន", "Pick one type or more"), "🧭")}
      <div class="bp-panel">
        <input class="bp-in" type="search" data-bp-catq placeholder="${escapeAttr(L("ស្វែងរកប្រភេទ ឧ. ដេរ, កាហ្វេ", "Search types, e.g. sewing, coffee"))}" aria-label="${escapeAttr(L("ស្វែងរកប្រភេទ", "Search types"))}">
        <div class="bp-cats">${CATS.map(([key, emoji, name, sub]) => `<button type="button" class="bp-cat" data-bp-cat="${key}" data-bp-search="${escapeAttr(`${name[0]} ${name[1]} ${sub[0]} ${sub[1]}`.toLowerCase())}" aria-pressed="${d.categories.includes(key)}"><i aria-hidden="true">${emoji}</i><b>${escapeHtml(L(name[0], name[1]))}</b><small>${escapeHtml(L(sub[0], sub[1]))}</small></button>`).join("")}</div>
        <p class="bp-mute" data-bp-nohit hidden>${L("រកមិនឃើញ · សាក \"ផ្សេងៗ / បង្កើតខ្លួនឯង\"", "Not found · try \"Other / my own\"")}</p>
        <label class="bp-f" data-bp-custom${d.categories.includes("custom") ? "" : " hidden"}><span>${L("ឈ្មោះប្រភេទផ្ទាល់ខ្លួន", "Your own type")}</span><input class="bp-in" data-bp-f="customCat" value="${escapeAttr(d.customCat)}" placeholder="${escapeAttr(L("ឧ. លក់ផ្កាតុបតែង", "e.g. flower decorations"))}"></label>
      </div>
      <div class="bp-sticky"><span data-bp-count>${d.categories.length ? L(`បានជ្រើស ${kmNum(d.categories.length)} ប្រភេទ`, `${d.categories.length} picked`) : L("មិនទាន់ជ្រើស", "Nothing picked yet")}</span><button type="button" class="bp-btn is-pri" data-bp-step="0"${d.categories.length ? "" : " disabled"}>${L("បន្ត ›", "Next ›")}</button></div>
    </section>`;
  }

  const field = (key, label, value, extra = "") => `<label class="bp-f"><span>${label}</span><input class="bp-in" data-bp-f="${key}" value="${escapeAttr(value ?? "")}" ${extra}></label>`;
  const area = (key, label, value, ph = "") => `<label class="bp-f"><span>${label}</span><textarea class="bp-in" rows="2" data-bp-f="${key}" placeholder="${escapeAttr(ph)}">${escapeHtml(value ?? "")}</textarea></label>`;
  const OWNERS = () => [["self", L("បុគ្គល", "Just me")], ["family", L("គ្រួសារ", "Family")], ["partner", L("ដៃគូ", "Partners")], ["company", L("ក្រុមហ៊ុន", "Company")]];
  const STEPS = () => [L("ព័ត៌មានមូលដ្ឋាន", "The basics"), L("គំនិតអាជីវកម្ម", "Your idea"), L("ធនធានដែលមានស្រាប់", "What you already have"), L("គោលដៅ", "Goals"), L("ពិនិត្យឡើងវិញ", "Review")];

  function wizard() {
    const d = draft;
    const assetsValue = live(d.resources.assets).reduce((sum, item) => sum + num(item.value), 0);
    const tasksCount = BASE_TASKS.length + d.categories.reduce((n, key) => n + (CAT_TASKS[key] || []).length, 0);
    const owner = OWNERS().find(o => o[0] === d.owner);
    const body = [
      () => `${field("name", `${L("ឈ្មោះអាជីវកម្ម", "Business name")} *`, d.name, `required maxlength="80" placeholder="${escapeAttr(L("ឧ. ហាងដេរ និងប៉ាក់", "e.g. Sewing & embroidery shop"))}"`)}
        <p class="bp-err" data-bp-err hidden>${L("សូមដាក់ឈ្មោះអាជីវកម្ម", "Please give the business a name")}</p>
        ${field("desc", L("ពិពណ៌នាខ្លី", "Short description"), d.desc, `maxlength="140" placeholder="${escapeAttr(L("ឧ. ដេរអាវ និងប៉ាក់ឈ្មោះតាមការកុម្ម៉ង់", "e.g. Made-to-order shirts and name embroidery"))}"`)}
        ${field("location", L("ទីតាំង", "Location"), d.location, `placeholder="${escapeAttr(L("ឧ. ភ្នំពេញ, ទួលគោក", "e.g. Phnom Penh"))}"`)}
        <div class="bp-f"><span>${L("ម្ចាស់អាជីវកម្ម", "Owned by")}</span><div class="bp-chips">${OWNERS().map(([k, label]) => `<button type="button" class="bp-chip" data-bp-owner="${k}" aria-pressed="${d.owner === k}">${escapeHtml(label)}</button>`).join("")}</div></div>
        <div class="bp-two">${field("startDate", L("ចាប់ផ្តើមរៀបចំ", "Start planning"), d.startDate, 'type="date"')}${field("launchDate", L("គ្រោងបើកលក់", "Planned opening"), d.launchDate, 'type="date"')}</div>`,
      () => `${area("idea.product", L("លក់ផលិតផល ឬសេវាកម្មអ្វី?", "What will you sell?"), d.idea.product)}
        ${area("idea.problem", L("ដោះស្រាយបញ្ហាអ្វីឱ្យអតិថិជន?", "What problem does it solve?"), d.idea.problem, L("ឧ. ក្រុមហ៊ុនតូចៗរកកន្លែងប៉ាក់ឡូហ្គោចំនួនតិចមិនបាន", "e.g. small firms can't find anyone to embroider a few logos"))}
        ${field("idea.customer", L("អតិថិជនគោលដៅជានរណា?", "Who are your customers?"), d.idea.customer, `placeholder="${escapeAttr(L("ឧ. ក្រុមហ៊ុនតូច សាលារៀន", "e.g. small companies, schools"))}"`)}
        ${area("idea.why", L("ហេតុអ្វីគេជ្រើសយើង?", "Why would they pick you?"), d.idea.why, L("ឧ. ទទួលកុម្ម៉ង់ ១០ ដុំក៏បាន រួចក្នុង ៣ ថ្ងៃ", "e.g. orders from 10 pieces, ready in 3 days"))}`,
      () => `${field("resources.capital", L("ទុនដែលមានឥឡូវ ($)", "Money you have now ($)"), d.resources.capital, 'inputmode="decimal" placeholder="0"')}
        <div class="bp-f"><span>${L("ឧបករណ៍ និងសម្ភារៈដែលមានស្រាប់ · តម្លៃប៉ាន់ស្មាន", "Equipment you already own · rough value")}</span>
          ${live(d.resources.assets).map(item => `<div class="bp-asset"><input class="bp-in" data-bp-asset="${item.id}" data-k="name" value="${escapeAttr(item.name)}" placeholder="${escapeAttr(L("ឧ. ម៉ាស៊ីនដេរ ២ គ្រឿង", "e.g. 2 sewing machines"))}" aria-label="${escapeAttr(L("ឈ្មោះ", "Name"))}"><input class="bp-in" data-bp-asset="${item.id}" data-k="value" inputmode="decimal" value="${escapeAttr(item.value)}" placeholder="$" aria-label="${escapeAttr(L("តម្លៃ", "Value"))}"><button type="button" class="bp-x" data-bp-asset-del="${item.id}" aria-label="${escapeAttr(L("ដកចេញ", "Remove"))}">✕</button></div>`).join("")}
          <button type="button" class="bp-link" data-bp-asset-add>＋ ${L("បន្ថែមរបស់ដែលមាន", "Add something you own")}</button></div>
        <p class="bp-note">💡 ${L(`របស់ដែលមានស្រាប់ មិនមែនឥតគិតថ្លៃទេ។ យើងរាប់តម្លៃរបស់វា (<b data-bp-out="assets">${usd(assetsValue)}</b>) ក្នុងថ្លៃពិតនៃអាជីវកម្ម។`, `What you already own isn't free. Its value (<b data-bp-out="assets">${usd(assetsValue)}</b>) counts in the real cost of the business.`)}</p>
        ${field("resources.skills", L("ជំនាញដែលមាន", "Your skills"), d.resources.skills, `placeholder="${escapeAttr(L("ឧ. ដេរ ៥ ឆ្នាំ, រចនា", "e.g. 5 years sewing, design"))}"`)}`,
      () => `<div class="bp-two">${field("goals.startup", L("ទុនចាប់ផ្តើមគោលដៅ ($)", "Startup budget ($)"), d.goals.startup, 'inputmode="decimal" placeholder="0"')}${field("goals.revenue", L("ចំណូល/ខែ ($)", "Sales a month ($)"), d.goals.revenue, 'inputmode="decimal" placeholder="0"')}</div>
        <div class="bp-two">${field("goals.profit", L("ចំណេញ/ខែ ($)", "Profit a month ($)"), d.goals.profit, 'inputmode="decimal" placeholder="0"')}${field("goals.customers", L("អតិថិជន/ខែ", "Customers a month"), d.goals.customers, 'inputmode="numeric" placeholder="0"')}</div>
        <p class="bp-mute">${L("អាចរំលងបាន ហើយកែពេលក្រោយ។", "You can skip this and fill it in later.")}</p>`,
      () => `<div class="bp-rv">
          <div><span>${L("ឈ្មោះ", "Name")}</span><b>${escapeHtml(d.name || "—")}</b></div>
          <div><span>${L("ប្រភេទ", "Type")}</span><b>${escapeHtml(d.categories.map(key => key === "custom" && d.customCat ? d.customCat : catName(key)).join(" · "))}</b></div>
          <div><span>${L("ម្ចាស់", "Owned by")}</span><b>${escapeHtml(owner ? owner[1] : "—")}</b></div>
          <div><span>${L("បើកលក់", "Opens")}</span><b>${escapeHtml(dayLabel(d.launchDate))}</b></div>
          <div><span>${L("ទុនមាន + របស់មានស្រាប់", "Money + things you own")}</span><b>${usd(num(d.resources.capital))} + ${usd(assetsValue)}</b></div>
          <div><span>${L("ទុនគោលដៅ", "Budget goal")}</span><b>${usd(num(d.goals.startup))}</b></div>
        </div>
        <p class="bp-explain">${L(`យើងនឹងបង្កើតការងារចាប់ផ្តើម <b>${kmNum(tasksCount)}</b> តាមប្រភេទដែលអ្នកជ្រើស។ អ្នកអាចបន្ថែម ឬលុបពេលក្រោយ។`, `We'll add <b>${tasksCount}</b> starter tasks for the types you picked. You can add or remove them later.`)}</p>`
    ][step]();
    return `<section class="page bp-page">
      <header class="ct-hero"><button type="button" class="ct-back" data-bp-step="${step - 1}" aria-label="${escapeAttr(L("ត្រឡប់", "Back"))}">‹</button><span class="ct-hi"><span class="ct-ic" aria-hidden="true">📝</span><span><b>${escapeHtml(STEPS()[step])}</b><small>${L(`ជំហាន ${kmNum(step + 1)}/${kmNum(5)}`, `Step ${step + 1} of 5`)}</small></span></span></header>
      <div class="bp-panel">
        <div class="bp-dots" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => `<i${i <= step ? ' class="is-on"' : ""}></i>`).join("")}</div>
        <div class="bp-tags">${d.categories.map(key => `<span class="bp-pill">${escapeHtml(key === "custom" && d.customCat ? d.customCat : catName(key))}</span>`).join("")}</div>
        ${body}
      </div>
      <div class="bp-sticky">${step > 0 && step < 4 ? `<button type="button" class="bp-link" data-bp-step="${step + 1}">${L("រំលង", "Skip")}</button>` : "<span></span>"}<button type="button" class="bp-btn is-pri" ${step === 4 ? "data-bp-create" : `data-bp-step="${step + 1}"`}>${step === 4 ? `✓ ${L("បង្កើតផែនការ", "Create plan")}` : L("បន្ត ›", "Next ›")}</button></div>
    </section>`;
  }

  /* ---------- workspace ---------- */
  const kpi = (label, value, tone = "") => `<div class="bp-k${tone ? ` is-${tone}` : ""}"><small>${label}</small><b>${value}</b></div>`;
  const num_in = (scope, key, label, value, ph = "0") => `<label class="bp-f"><span>${label}</span><input class="bp-in" inputmode="decimal" data-bp-live="${scope}.${key}" value="${escapeAttr(value ?? "")}" placeholder="${ph}"></label>`;

  function modOverview(plan) {
    const s = stats(plan);
    const be = beMath(plan.breakeven);
    const capital = num(plan.resources?.capital);
    const gap = s.est - capital;
    const open = live(plan.tasks).filter(task => !task.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 3);
    const g = plan.goals || {};
    const a = advice(plan);
    const top = a.tips[0];
    const ring = `<div class="bp-health" style="--p:${a.score}"><span><b>${kmNum(a.score)}</b><small>/${kmNum(100)}</small></span></div>`;
    const tipRow = tip => `<button type="button" class="bp-tip is-${tip.tone}" data-bp-goto="${tip.to}"><span class="bp-tip-ic" aria-hidden="true">${tip.emoji}</span><span>${escapeHtml(tip.text)}</span><span aria-hidden="true">›</span></button>`;
    return `${nomiCard(top ? escapeHtml(top.text) : L("គម្រោងនេះមើលទៅល្អណាស់ 😸", "This plan looks great 😸"), scoreMood(a.score), `<span class="bp-score">${L("សុខភាពគម្រោង", "Plan health")} · <b>${escapeHtml(scoreLabel(a.score))}</b></span>`)}
      <div class="bp-card"><div class="bp-hd"><h3>${L("ដំបូន្មានឆ្លាតវៃ", "Smart advice")}</h3>${ring}</div>
        <div class="bp-tips">${a.tips.map(tipRow).join("")}</div></div>
      <div class="bp-kpis">
        ${kpi(L("ទុនប៉ាន់ស្មាន", "Est. budget"), usd(s.est))}
        ${kpi(L("ចាយរួច", "Spent"), usd(s.actual))}
        ${kpi(L("ការងាររួច", "Tasks done"), `${kmNum(s.done)}/${kmNum(s.tasks)}`)}
        ${kpi(L("ត្រូវលក់/ខែ ដើម្បីរួចខ្លួន", "Sell a month to break even"), be.qty === null || !be.fixed ? "—" : L(`${kmNum(be.qty)} ដុំ`, `${be.qty} units`))}
        ${kpi(L("ចំណេញ/ខែ (ប៉ាន់)", "Profit a month (est.)"), a.n.monthly === null || !be.fixed ? "—" : usd(a.n.monthly), a.n.monthly < 0 ? "bad" : "")}
        ${kpi(L("យកទុនមកវិញ", "Pays back in"), a.n.payback ? L(`~${kmNum(a.n.payback)} ខែ`, `~${a.n.payback} mo`) : "—")}
      </div>
      <div class="bp-card"><h3>${L("ជំហានបន្ទាប់", "Next steps")}</h3>
        ${open.length ? open.map(task => `<button type="button" class="bp-next" data-bp-goto="task"><span aria-hidden="true">○</span><span><b>${escapeHtml(task.title)}</b>${task.due ? `<small>${escapeHtml(dayLabel(task.due))}</small>` : ""}</span><span aria-hidden="true">›</span></button>`).join("") : `<p class="bp-mute">${s.tasks ? L("ការងារទាំងអស់រួចហើយ 🎉", "Every task is done 🎉") : L("មិនទាន់មានការងារ", "No tasks yet")}</p>`}
      </div>
      <div class="bp-card"><h3>${L("លុយ", "Money")}</h3>
        <div class="bp-res">
          <div><span>${L("ទុនមានឥឡូវ", "Money you have")}</span><b>${usd(capital)}</b></div>
          <div><span>${L("របស់មានស្រាប់", "Things you own")}</span><b>${usd(s.assets)}</b></div>
          <div class="${gap > 0 ? "is-bad" : "is-ok"}"><span>${gap > 0 ? L("ទុនខ្វះ", "Still need") : L("ទុនគ្រប់", "Covered")}</span><b>${usd(Math.abs(gap))}</b></div>
        </div>
        ${g.revenue || g.profit ? `<p class="bp-mute">${L("គោលដៅ/ខែ", "Monthly goal")}៖ ${L("ចំណូល", "sales")} ${usd(num(g.revenue))} · ${L("ចំណេញ", "profit")} ${usd(num(g.profit))}${g.customers ? ` · ${kmNum(num(g.customers))} ${L("អតិថិជន", "customers")}` : ""}</p>` : ""}
      </div>`;
  }

  function modIdea(plan) {
    const i = plan.idea || {};
    const t = (key, label, ph = "") => `<label class="bp-f"><span>${label}</span><textarea class="bp-in" rows="2" data-bp-live="idea.${key}" placeholder="${escapeAttr(ph)}">${escapeHtml(i[key] || "")}</textarea></label>`;
    return `<div class="bp-card"><h3>${L("គំនិតអាជីវកម្ម", "The idea")}</h3>
      ${t("product", L("លក់អ្វី?", "What you sell"))}
      ${t("problem", L("ដោះស្រាយបញ្ហាអ្វី?", "The problem it solves"))}
      ${t("customer", L("អតិថិជនជានរណា?", "Who buys"))}
      ${t("why", L("ហេតុអ្វីជ្រើសយើង?", "Why they pick you"))}
      <div class="bp-two">${t("strengths", L("ចំណុចខ្លាំង", "Strengths"))}${t("weaknesses", L("ចំណុចខ្សោយ", "Weak spots"))}</div>
      <p class="bp-mute" data-bp-saved>${L("រក្សាទុកដោយស្វ័យប្រវត្តិ", "Saves by itself")}</p></div>`;
  }

  function modBudget(plan) {
    const items = live(plan.budget);
    const s = stats(plan);
    return `<div class="bp-card"><h3>${L("ទុនចាប់ផ្តើម", "Startup budget")}</h3>
      <div class="bp-kpis is-2">${kpi(L("ប៉ាន់ស្មាន", "Estimate"), `<span data-bp-out="bud.est">${usd(s.est)}</span>`)}${kpi(L("ចាយពិត", "Spent"), `<span data-bp-out="bud.act">${usd(s.actual)}</span>`)}</div>
      ${items.length ? `<div class="bp-bhead"><span>${L("របស់ត្រូវទិញ", "Item")}</span><span>${L("ប៉ាន់ស្មាន", "Estimate")}</span><span>${L("ចាយពិត", "Spent")}</span><span></span></div>` : ""}
      ${items.map(item => `<div class="bp-brow"><input class="bp-in" data-bp-item="${item.id}" data-k="name" value="${escapeAttr(item.name)}" aria-label="${escapeAttr(L("ឈ្មោះ", "Name"))}"><input class="bp-in" inputmode="decimal" data-bp-item="${item.id}" data-k="est" value="${escapeAttr(item.est ?? "")}" placeholder="$" aria-label="${escapeAttr(L("ប៉ាន់ស្មាន", "Estimate"))}"><input class="bp-in" inputmode="decimal" data-bp-item="${item.id}" data-k="actual" value="${escapeAttr(item.actual ?? "")}" placeholder="$" aria-label="${escapeAttr(L("ចាយពិត", "Spent"))}"><button type="button" class="bp-x" data-bp-item-del="${item.id}" aria-label="${escapeAttr(L("ដកចេញ", "Remove"))}">✕</button></div>`).join("")}
      <form class="bp-add" data-bp-add="budget"><input class="bp-in" name="name" required placeholder="${escapeAttr(L("ឧ. ម៉ាស៊ីនប៉ាក់", "e.g. embroidery machine"))}" aria-label="${escapeAttr(L("របស់ត្រូវទិញ", "Item"))}"><input class="bp-in" name="est" inputmode="decimal" placeholder="$" aria-label="${escapeAttr(L("ប៉ាន់ស្មាន", "Estimate"))}"><button type="submit" class="bp-btn is-pri is-sm">＋</button></form>
      ${s.assets ? `<p class="bp-note">${L(`របស់មានស្រាប់ ${usd(s.assets)} រាប់ក្នុងថ្លៃពិត តែមិនត្រូវចាយលុយថ្មី។`, `Things you own (${usd(s.assets)}) count in the real cost but need no new money.`)}</p>` : ""}
    </div>`;
  }

  function modPrice(plan) {
    const p = plan.pricing || {};
    const m = priceMath(p);
    const ladder = [30, 40, 50].map(w => [w, m.cost ? nicePrice(m.cost / (1 - w / 100)) : 0]);
    return `${nomiCard(`<span data-bp-out="p.tip">${escapeHtml(priceTip(plan))}</span>`, "")}
      <div class="bp-card"><h3>${L("ថ្លៃដើមក្នុងមួយដុំ", "Cost of one unit")}</h3>
        <label class="bp-f"><span>${L("ផលិតផល", "Product")}</span><input class="bp-in" data-bp-live="pricing.item" value="${escapeAttr(p.item || "")}" placeholder="${escapeAttr(L("ឧ. អាវប៉ាក់ឡូហ្គោ", "e.g. logo shirt"))}"></label>
        <div class="bp-two">${num_in("pricing", "materials", L("សម្ភារៈ ($)", "Materials ($)"), p.materials)}${num_in("pricing", "labor", L("កម្លាំងពលកម្ម ($)", "Labour ($)"), p.labor)}</div>
        <div class="bp-two">${num_in("pricing", "overhead", L("ភ្លើង ទឹក ផ្សេងៗ ($)", "Power, water, overhead ($)"), p.overhead)}${num_in("pricing", "packaging", L("វេចខ្ចប់ ($)", "Packaging ($)"), p.packaging)}</div>
        <div class="bp-two">${num_in("pricing", "delivery", L("ដឹកជញ្ជូន ($)", "Delivery ($)"), p.delivery)}${num_in("pricing", "other", L("ផ្សេងៗ ($)", "Other ($)"), p.other)}</div>
        ${num_in("pricing", "sell", L("តម្លៃលក់ ($)", "Selling price ($)"), p.sell)}
        <div class="bp-res">
          <div><span>${L("ថ្លៃដើម/ដុំ", "Cost / unit")}</span><b data-bp-out="p.cost">${usd(m.cost)}</b></div>
          <div class="is-hl"><span>${L("ចំណេញ/ដុំ", "Profit / unit")}</span><b data-bp-out="p.profit">${usd(m.profit)}</b></div>
          <div><span>${L("អត្រាចំណេញ", "Margin")}</span><b data-bp-out="p.margin">${m.margin === null ? "—" : `${m.margin.toFixed(1)}%`}</b></div>
          <div><span>${L("ជាប្រាក់រៀល", "In riel")}</span><b data-bp-out="p.riel">${m.sell ? `${riel(m.sell)} · ${L("ចំណេញ", "profit")} ${riel(m.profit)}` : "—"}</b></div>
        </div>
        <div class="bp-f"><span>${L("ចុចដើម្បីយកតម្លៃស្អាត", "Tap a ready price")}</span><div class="bp-ladder" data-bp-ladder>${ladder.map(([w, v]) => `<button type="button" class="bp-chip" data-bp-setprice="${v}"${v ? "" : " disabled"}><b>${v ? usd(v) : "—"}</b><small>${kmNum(w)}%</small></button>`).join("")}</div></div>
        <p class="bp-explain"><code>${L("ចំណេញ = តម្លៃលក់ − ថ្លៃដើម", "Profit = price − cost")}</code><br><code>${L("អត្រាចំណេញ = ចំណេញ ÷ តម្លៃលក់ × 100", "Margin = profit ÷ price × 100")}</code></p>
      </div>
      <div class="bp-card"><h3>${L("តម្លៃលក់ដែលគួរដាក់", "Price to ask")}</h3>
        ${num_in("pricing", "want", L("ចង់បានអត្រាចំណេញ (%)", "Margin you want (%)"), p.want ?? 40, "40")}
        <div class="bp-res"><div class="is-hl"><span>${L("គួរលក់", "Sell at")}</span><b data-bp-out="p.suggest">${m.suggest === null ? "—" : usd(m.suggest)}</b></div>
          <div><span>${L("តម្លៃស្អាត", "Rounded price")}</span><b data-bp-out="p.nice">${m.suggest ? `${usd(nicePrice(m.suggest))} · ${riel(nicePrice(m.suggest))}` : "—"}</b></div></div>
        <p class="bp-err" data-bp-out-err="p.want"${m.wantOk ? " hidden" : ""}>${L("អត្រាចំណេញត្រូវនៅចន្លោះ 0% និងតិចជាង 100%", "The margin must be from 0% to under 100%")}</p>
        <p class="bp-explain"><code>${L("តម្លៃលក់ = ថ្លៃដើម ÷ (1 − អត្រាចំណេញ)", "Price = cost ÷ (1 − margin)")}</code><br>${L("ឧ. ថ្លៃដើម $6.50 ចង់ចំណេញ 40% → $6.50 ÷ 0.6 = $10.83។ មិនមែន $6.50 × 1.4 = $9.10 ទេ ព្រោះវាផ្តល់តែ 28.6%។", "E.g. cost $6.50 at 40% → $6.50 ÷ 0.6 = $10.83. Not $6.50 × 1.4 = $9.10, which is only 28.6%.")}</p>
      </div>`;
  }

  function modBreakeven(plan) {
    const b = plan.breakeven || {};
    const m = beMath(b);
    const pm = priceMath(plan.pricing);
    const n = smartNumbers(plan);
    return `${nomiCard(`<span data-bp-out="be.tip">${escapeHtml(beTip(plan))}</span>`, "")}
      <div class="bp-card"><h3>${L("ចំណុចរួចខ្លួន", "Break-even")}</h3><p class="bp-mute">${L("ត្រូវលក់ប៉ុន្មានដុំក្នុងមួយខែ ដើម្បីមិនខាត?", "How many must you sell a month so you don't lose money?")}</p>
      ${num_in("breakeven", "fixed", L("ចំណាយថេរ/ខែ ($) · ជួល ប្រាក់ខែ ភ្លើង", "Fixed costs a month ($) · rent, wages, power"), b.fixed)}
      <div class="bp-two">${num_in("breakeven", "price", L("តម្លៃលក់/ដុំ ($)", "Price / unit ($)"), b.price)}${num_in("breakeven", "variable", L("ថ្លៃដើម/ដុំ ($)", "Cost / unit ($)"), b.variable)}</div>
      ${pm.cost || pm.sell ? `<button type="button" class="bp-link" data-bp-usepricing>↺ ${L(`យកពីតម្លៃ និងចំណេញ (${usd(pm.sell)} / ${usd(pm.cost)})`, `Use Price & profit (${usd(pm.sell)} / ${usd(pm.cost)})`)}</button>` : ""}
      <div class="bp-res">
        <div><span>${L("ចំណេញរួម/ដុំ", "Margin / unit")}</span><b data-bp-out="be.cm">${usd(m.cm)}</b></div>
        <div class="is-hl"><span>${L("ត្រូវលក់/ខែ", "Sell a month")}</span><b data-bp-out="be.qty">${m.qty === null ? "—" : L(`${kmNum(m.qty)} ដុំ`, `${m.qty} units`)}</b></div>
        <div><span>${L("ចំណូល/ខែ ដែលត្រូវការ", "Sales needed a month")}</span><b data-bp-out="be.rev">${m.revenue === null ? "—" : usd(m.revenue)}</b></div>
        <div><span>${L("ក្នុងមួយថ្ងៃ", "A day")} (${kmNum(WORK_DAYS)} ${L("ថ្ងៃ/ខែ", "days/mo")})</span><b data-bp-out="be.day">${n.perDay ? L(`~${kmNum(n.perDay)} ដុំ`, `~${n.perDay} units`) : "—"}</b></div>
        ${n.goalProfit ? `<div><span>${L(`ចំណេញ ${usd(n.goalProfit)}/ខែ ត្រូវលក់`, `${usd(n.goalProfit)}/mo profit needs`)}</span><b data-bp-out="be.goal">${n.forGoal ? L(`${kmNum(n.forGoal)} ដុំ`, `${n.forGoal} units`) : "—"}</b></div>` : ""}
        <div><span>${L("យកទុនមកវិញ", "Budget paid back")}</span><b data-bp-out="be.pay">${n.payback ? L(`~${kmNum(n.payback)} ខែ`, `~${n.payback} months`) : "—"}</b></div>
      </div>
      <p class="bp-err" data-bp-out-err="be"${m.ok || (!m.price && !m.variable) ? " hidden" : ""}>${L("តម្លៃលក់ត្រូវខ្ពស់ជាងថ្លៃដើម បើមិនដូច្នោះ លក់ច្រើនប៉ុណ្ណាក៏នៅខាត", "The price must be above the cost, or you lose money however much you sell")}</p>
      <div class="bp-what"><span>${L("បើលក់", "If you sell")}</span><input class="bp-in" inputmode="numeric" data-bp-live="breakeven.units" value="${escapeAttr(b.units ?? 300)}" aria-label="${escapeAttr(L("ចំនួនដុំ", "Units"))}"><span>${L("ដុំ/ខែ", "a month")} →</span><b data-bp-out="be.at" class="${m.atUnits < 0 ? "is-bad" : "is-ok"}">${m.atUnits < 0 ? L("ខាត", "loss") : L("ចំណេញ", "profit")} ${usd(Math.abs(m.atUnits))}</b></div>
      <p class="bp-explain"><code>${L("ចំណេញរួម = តម្លៃលក់ − ថ្លៃដើម", "Margin = price − cost")}</code><br><code>${L("ត្រូវលក់ = ចំណាយថេរ ÷ ចំណេញរួម (បង្គត់ឡើង)", "Units = fixed costs ÷ margin (rounded up)")}</code></p>
    </div>`;
  }

  function modTasks(plan) {
    const today = localDateInput();
    const all = live(plan.tasks);
    const shown = all.filter(task => taskFilter === "all" ? true : taskFilter === "open" ? !task.done : taskFilter === "late" ? !task.done && task.due && task.due < today : task.done)
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
    const chips = [["all", L("ទាំងអស់", "All")], ["open", L("មិនទាន់រួច", "To do")], ["late", L("ហួសកំណត់", "Late")], ["done", L("រួចហើយ", "Done")]];
    return `<div class="bp-card"><div class="bp-hd"><h3>${L("ការងារ", "Tasks")}</h3><span class="bp-pill">${kmNum(all.filter(task => task.done).length)}/${kmNum(all.length)}</span></div>
      <div class="bp-chips">${chips.map(([k, label]) => `<button type="button" class="bp-chip" data-bp-tf="${k}" aria-pressed="${taskFilter === k}">${escapeHtml(label)}</button>`).join("")}</div>
      <div class="bp-tasks">${shown.map(task => `<div class="bp-task${task.done ? " is-done" : ""}${!task.done && task.due && task.due < today ? " is-late" : ""}">
          <button type="button" class="bp-check" data-bp-done="${task.id}" aria-pressed="${!!task.done}" aria-label="${escapeAttr(task.done ? L("សម្គាល់មិនទាន់រួច", "Mark not done") : L("សម្គាល់រួច", "Mark done"))}">${task.done ? "✓" : ""}</button>
          <span class="bp-tt"><b>${escapeHtml(task.title)}</b>${task.due ? `<small>${!task.done && task.due < today ? "⚠️ " : ""}${escapeHtml(dayLabel(task.due))}</small>` : ""}</span>
          <button type="button" class="bp-x" data-bp-task-del="${task.id}" aria-label="${escapeAttr(L("លុប", "Delete"))}">✕</button></div>`).join("") || `<p class="bp-mute">${L("គ្មានការងារនៅទីនេះ", "Nothing here")}</p>`}</div>
      <form class="bp-add is-task" data-bp-add="task"><input class="bp-in" name="title" required placeholder="${escapeAttr(L("ការងារថ្មី…", "New task…"))}" aria-label="${escapeAttr(L("ការងារថ្មី", "New task"))}"><input class="bp-in" name="due" type="date" aria-label="${escapeAttr(L("ថ្ងៃកំណត់", "Due date"))}"><button type="submit" class="bp-btn is-pri is-sm">＋</button></form>
    </div>`;
  }

  function modSettings(plan) {
    const statuses = [["planning", L("កំពុងរៀបចំ", "Planning")], ["running", L("កំពុងដំណើរការ", "Running")], ["archived", L("បណ្ណសារ", "Archived")]];
    return `<form class="bp-card" data-bp-settings><h3>${L("កំណត់គម្រោង", "Plan settings")}</h3>
        <label class="bp-f"><span>${L("ឈ្មោះអាជីវកម្ម", "Business name")}</span><input class="bp-in" name="name" required maxlength="80" value="${escapeAttr(plan.name || "")}"></label>
        <label class="bp-f"><span>${L("ពិពណ៌នាខ្លី", "Short description")}</span><input class="bp-in" name="desc" maxlength="140" value="${escapeAttr(plan.desc || "")}"></label>
        <label class="bp-f"><span>${L("ទីតាំង", "Location")}</span><input class="bp-in" name="location" value="${escapeAttr(plan.location || "")}"></label>
        <div class="bp-two"><label class="bp-f"><span>${L("ទុនមានឥឡូវ ($)", "Money you have ($)")}</span><input class="bp-in" name="capital" inputmode="decimal" value="${escapeAttr(plan.resources?.capital ?? "")}"></label><label class="bp-f"><span>${L("គ្រោងបើកលក់", "Planned opening")}</span><input class="bp-in" name="launchDate" type="date" value="${escapeAttr(plan.launchDate || "")}"></label></div>
        <div class="bp-f"><span>${L("ស្ថានភាព", "Status")}</span><div class="bp-chips">${statuses.map(([k, label]) => `<button type="button" class="bp-chip" data-bp-status="${k}" aria-pressed="${(plan.status || "planning") === k}">${escapeHtml(label)}</button>`).join("")}</div></div>
        <button type="submit" class="bp-btn is-pri">${L("រក្សាទុក", "Save")}</button>
      </form>
      <div class="bp-card bp-danger"><b>${L("លុបផែនការនេះ", "Delete this plan")}</b><small>${L("ការងារ ទុន និងលេខគណនាទាំងអស់នឹងបាត់។", "Its tasks, budget and numbers will all be gone.")}</small><button type="button" class="bp-btn is-bad" data-bp-delete>${L("លុប", "Delete")}</button></div>`;
  }

  function modSoon(m) {
    return `<div class="bp-card bp-soon"><span aria-hidden="true">${m[1]}</span><b>${escapeHtml(L(m[2], m[3]))}</b><small>${escapeHtml(L(m[5][0], m[5][1]))}</small><span class="bp-pill is-gold">${L("នឹងមានក្នុងកំណែបន្ទាប់", "Coming in the next update")}</span></div>`;
  }

  function workspace(plan) {
    const s = stats(plan);
    const m = MODS.find(item => item[0] === mod) || MODS[0];
    const body = !m[4] ? modSoon(m) : { ov: modOverview, idea: modIdea, bud: modBudget, price: modPrice, be: modBreakeven, task: modTasks, set: modSettings }[m[0]](plan);
    return `<section class="page bp-page">
      ${hero("#business", plan.name || L("គ្មានឈ្មោះ", "Untitled"), `${stageOf(plan, s.pct)} · ${kmNum(s.pct)}%`, icon(plan))}
      <div class="bp-panel bp-wshead">
        <span class="bp-prog" aria-hidden="true"><i style="width:${s.pct}%"></i></span>
        <nav class="bp-nav" aria-label="${escapeAttr(L("ផ្នែក", "Sections"))}">${MODS.map(item => `<button type="button" data-bp-mod="${item[0]}" aria-pressed="${item[0] === m[0]}"${item[4] ? "" : ' class="is-soon"'}><span aria-hidden="true">${item[1]}</span>${escapeHtml(L(item[2], item[3]))}</button>`).join("")}</nav>
      </div>
      <div class="bp-body">${body}</div>
    </section>`;
  }

  function render() {
    const p = param();
    if (p === "new") {
      if (!draft) { draft = fresh(); step = -1; }
      return step < 0 ? categories() : wizard();
    }
    if (p) {
      const plan = current();
      if (plan) return workspace(plan);
    }
    return dashboard();
  }

  /* ---------- actions ---------- */
  function create() {
    const d = draft;
    const stamp = now();
    const titles = [...BASE_TASKS, ...d.categories.flatMap(key => CAT_TASKS[key] || [])];
    const seen = new Set();
    const tasks = titles.filter(pair => !seen.has(pair[0]) && seen.add(pair[0])).map(pair => ({ id: uid(), title: L(pair[0], pair[1]), done: false, due: "", updatedAt: stamp }));
    const doneIdea = d.idea.product || d.idea.problem;
    if (doneIdea && tasks[0]) tasks[0].done = true;
    if (d.launchDate && tasks[6]) { tasks[6].done = true; }
    const plan = {
      name: d.name.trim(), desc: d.desc.trim(), location: d.location.trim(), owner: d.owner, startDate: d.startDate, launchDate: d.launchDate,
      categories: d.categories.slice(), customCat: d.customCat.trim(), status: "planning",
      idea: { ...d.idea }, resources: { capital: d.resources.capital, skills: d.resources.skills, assets: live(d.resources.assets).filter(item => item.name || item.value).map(item => ({ ...item, updatedAt: stamp })) },
      goals: { ...d.goals }, budget: [], tasks, pricing: { want: 40 }, breakeven: { units: 300 }, updatedAt: stamp
    };
    Store.add("businessPlans", plan);
    const made = list()[list().length - 1];
    draft = null; step = -1; mod = "ov";
    if (typeof Toast !== "undefined") Toast.show(L("💼 បានបង្កើតផែនការ", "💼 Plan created"), "success");
    if (made) go(`#business/${made.id}`);
  }

  function setPath(obj, path, value) {
    const keys = path.split(".");
    let o = obj;
    keys.slice(0, -1).forEach(key => { if (!o[key] || typeof o[key] !== "object") o[key] = {}; o = o[key]; });
    o[keys[keys.length - 1]] = value;
  }
  const getPath = (obj, path) => path.split(".").reduce((o, key) => (o == null ? o : o[key]), obj);

  // recompute numbers on screen without a redraw (keeps the keyboard up)
  function refreshOutputs(page, plan) {
    const out = (key, text, cls) => { const el = page.querySelector(`[data-bp-out="${key}"]`); if (el) { el.textContent = text; if (cls !== undefined) el.className = cls; } };
    const err = (key, show) => { const el = page.querySelector(`[data-bp-out-err="${key}"]`); if (el) el.hidden = !show; };
    const p = priceMath(plan.pricing);
    out("p.cost", usd(p.cost)); out("p.profit", usd(p.profit), p.profit < 0 ? "is-bad" : ""); out("p.margin", p.margin === null ? "—" : `${p.margin.toFixed(1)}%`);
    out("p.suggest", p.suggest === null ? "—" : usd(p.suggest)); err("p.want", !p.wantOk);
    const b = beMath(plan.breakeven);
    out("be.cm", usd(b.cm)); out("be.qty", b.qty === null ? "—" : L(`${kmNum(b.qty)} ដុំ`, `${b.qty} units`)); out("be.rev", b.revenue === null ? "—" : usd(b.revenue));
    out("be.at", `${b.atUnits < 0 ? L("ខាត", "loss") : L("ចំណេញ", "profit")} ${usd(Math.abs(b.atUnits))}`, b.atUnits < 0 ? "is-bad" : "is-ok");
    err("be", !b.ok && (b.price || b.variable));
    const s = stats(plan);
    out("bud.est", usd(s.est)); out("bud.act", usd(s.actual));
    const n = smartNumbers(plan);
    out("p.riel", p.sell ? `${riel(p.sell)} · ${L("ចំណេញ", "profit")} ${riel(p.profit)}` : "—");
    out("p.nice", p.suggest ? `${usd(nicePrice(p.suggest))} · ${riel(nicePrice(p.suggest))}` : "—");
    out("p.tip", priceTip(plan)); out("be.tip", beTip(plan));
    out("be.day", n.perDay ? L(`~${kmNum(n.perDay)} ដុំ`, `~${n.perDay} units`) : "—");
    out("be.goal", n.forGoal ? L(`${kmNum(n.forGoal)} ដុំ`, `${n.forGoal} units`) : "—");
    out("be.pay", n.payback ? L(`~${kmNum(n.payback)} ខែ`, `~${n.payback} months`) : "—");
    const ladder = page.querySelector("[data-bp-ladder]");
    if (ladder) [30, 40, 50].forEach((w, i) => { const v = p.cost ? nicePrice(p.cost / (1 - w / 100)) : 0; const btn = ladder.children[i]; if (btn) { btn.dataset.bpSetprice = v; btn.disabled = !v; btn.querySelector("b").textContent = v ? usd(v) : "—"; } });
  }

  function bind() {
    const page = document.querySelector(".bp-page");
    if (!page || page.dataset.bound) return;
    page.dataset.bound = "1";
    const plan = current();
    // the Next bar floats above the footer: move it out of the page (the page animates with a transform)
    document.querySelectorAll("body > .bp-floating").forEach(el => el.remove());
    const bar = page.querySelector(".bp-sticky");
    if (bar) {
      bar.classList.remove("reveal-on-scroll");
      bar.classList.add("bp-floating");
      page.classList.add("has-bar");
      document.body.appendChild(bar);
      if (!window.__bpBarWatch) { window.__bpBarWatch = true; window.addEventListener("hashchange", () => { if (!/^#business\/new/.test(location.hash)) document.querySelectorAll("body > .bp-floating").forEach(el => el.remove()); }); }
    }

    page.addEventListener("input", event => {
      const el = event.target;
      // search boxes filter what's on screen
      if (el.matches("[data-bp-q], [data-bp-catq]")) {
        const q = el.value.trim().toLowerCase();
        const items = page.querySelectorAll(el.matches("[data-bp-q]") ? ".bp-projw" : ".bp-cat");
        let hits = 0;
        items.forEach(item => { const on = !q || item.dataset.bpSearch.includes(q); item.hidden = !on; if (on) hits += 1; });
        const none = page.querySelector("[data-bp-nohit]"); if (none) none.hidden = hits > 0;
        return;
      }
      if (el.matches("[data-bp-f]") && draft) { setPath(draft, el.dataset.bpF, el.value); if (el.dataset.bpF === "name") { const e = page.querySelector("[data-bp-err]"); if (e) e.hidden = true; } return; }
      if (el.matches("[data-bp-asset]") && draft) { const item = draft.resources.assets.find(a => a.id === el.dataset.bpAsset); if (item) item[el.dataset.k] = el.value; const o = page.querySelector('[data-bp-out="assets"]'); if (o) o.textContent = usd(live(draft.resources.assets).reduce((sum, a) => sum + num(a.value), 0)); return; }
      if (!plan) return;
      if (el.matches("[data-bp-live]")) { patch(plan, p => setPath(p, el.dataset.bpLive, el.value)); refreshOutputs(page, plan); return; }
      if (el.matches("[data-bp-item]")) {
        patch(plan, p => { const item = (p.budget || []).find(b => b.id === el.dataset.bpItem); if (item) { item[el.dataset.k] = el.value; item.updatedAt = now(); } });
        refreshOutputs(page, plan);
      }
    });

    page.addEventListener("change", event => {
      if (event.target.matches("[data-bp-sort]")) { sort = event.target.value; App.render(); }
    });

    page.addEventListener("submit", event => {
      event.preventDefault();
      const form = event.target;
      if (!plan) return;
      if (form.matches("[data-bp-add]")) {
        const data = Object.fromEntries(new FormData(form));
        const stamp = now();
        if (form.dataset.bpAdd === "budget" && String(data.name || "").trim()) editPlan(plan, { budget: [...(plan.budget || []), { id: uid(), name: data.name.trim(), est: data.est || "", actual: "", updatedAt: stamp }] });
        if (form.dataset.bpAdd === "task" && String(data.title || "").trim()) editPlan(plan, { tasks: [...(plan.tasks || []), { id: uid(), title: data.title.trim(), due: data.due || "", done: false, updatedAt: stamp }] });
        setTimeout(() => document.querySelector(`.bp-page [data-bp-add="${form.dataset.bpAdd}"] input`)?.focus(), 0);
        return;
      }
      if (form.matches("[data-bp-settings]")) {
        const data = Object.fromEntries(new FormData(form));
        if (!String(data.name || "").trim()) return;
        editPlan(plan, { name: data.name.trim(), desc: data.desc.trim(), location: data.location.trim(), launchDate: data.launchDate, resources: { ...(plan.resources || {}), capital: data.capital } });
        if (typeof Toast !== "undefined") Toast.show(L("✓ បានរក្សាទុក", "✓ Saved"), "success");
      }
    });

    const onClick = event => {
      const b = sel => event.target.closest(sel);
      if (b("[data-bp-filter]")) { filter = b("[data-bp-filter]").dataset.bpFilter; App.render(); return; }
      // ⋯ menu on a plan card
      const closeMenus = () => page.querySelectorAll("[data-bp-menu]").forEach(menu => { menu.hidden = true; menu.previousElementSibling?.setAttribute("aria-expanded", "false"); });
      if (b("[data-bp-more]")) {
        const btn = b("[data-bp-more]");
        const menu = page.querySelector(`[data-bp-menu="${btn.dataset.bpMore}"]`);
        const open = menu.hidden;
        closeMenus();
        menu.hidden = !open; btn.setAttribute("aria-expanded", String(open));
        if (open) menu.querySelector("[role=menuitem]")?.focus();
        return;
      }
      if (b("[data-bp-open-set]")) { mod = "set"; return; }
      if (b(".bp-proj")) { mod = "ov"; return; }
      const byId = id => list().find(item => item.id === id);
      if (b("[data-bp-archive]")) {
        const target = byId(b("[data-bp-archive]").dataset.bpArchive);
        if (target) { const back = target.status === "archived"; Store.edit("businessPlans", target.id, { status: back ? "planning" : "archived" }); if (typeof Toast !== "undefined") Toast.show(back ? L("📤 យកចេញពីបណ្ណសាររួច", "📤 Restored") : L("🗄️ ទុកក្នុងបណ្ណសាររួច", "🗄️ Archived"), "success"); }
        return;
      }
      if (b("[data-bp-del]")) {
        const target = byId(b("[data-bp-del]").dataset.bpDel);
        closeMenus();
        if (target) Modal.confirm({ title: L("លុបផែនការ?", "Delete plan?"), message: L(`លុប "${target.name}"? ការងារ ទុន និងលេខគណនាទាំងអស់នឹងបាត់ ហើយមិនអាចយកមកវិញបានទេ។`, `Delete "${target.name}"? Its tasks, budget and numbers will be gone for good.`), confirmText: L("លុប", "Delete"), onConfirm: () => { Modal.close(); Store.delete("businessPlans", target.id); if (typeof Toast !== "undefined") Toast.show(L("🗑️ បានលុប", "🗑️ Deleted"), "success"); } });
        return;
      }
      if (!b("[data-bp-menu]")) closeMenus();
      // categories + setup
      if (b("[data-bp-cat]") && draft) {
        const key = b("[data-bp-cat]").dataset.bpCat;
        const i = draft.categories.indexOf(key);
        if (i >= 0) draft.categories.splice(i, 1); else draft.categories.push(key);
        b("[data-bp-cat]").setAttribute("aria-pressed", String(i < 0));
        const n = draft.categories.length;
        document.querySelector(".bp-floating [data-bp-count]").textContent = n ? L(`បានជ្រើស ${kmNum(n)} ប្រភេទ`, `${n} picked`) : L("មិនទាន់ជ្រើស", "Nothing picked yet");
        const nb = document.querySelector(".bp-floating [data-bp-step]"); if (nb) nb.disabled = !n;
        page.querySelector("[data-bp-custom]").hidden = !draft.categories.includes("custom");
        return;
      }
      if (b("[data-bp-step]") && draft) {
        const next = Number(b("[data-bp-step]").dataset.bpStep);
        if (step === 0 && next > 0 && !draft.name.trim()) { const e = page.querySelector("[data-bp-err]"); if (e) e.hidden = false; page.querySelector('[data-bp-f="name"]')?.focus(); return; }
        if (next < -1) { draft = null; step = -1; go("#business"); return; }
        step = next; App.render(); window.scrollTo(0, 0); return;
      }
      if (b("[data-bp-owner]") && draft) { draft.owner = b("[data-bp-owner]").dataset.bpOwner; page.querySelectorAll("[data-bp-owner]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.bpOwner === draft.owner))); return; }
      if (b("[data-bp-asset-add]") && draft) { draft.resources.assets.push({ id: uid(), name: "", value: "" }); App.render(); setTimeout(() => { const ins = document.querySelectorAll(".bp-asset input[data-k='name']"); ins[ins.length - 1]?.focus(); }, 0); return; }
      if (b("[data-bp-asset-del]") && draft) { draft.resources.assets = draft.resources.assets.filter(a => a.id !== b("[data-bp-asset-del]").dataset.bpAssetDel); App.render(); return; }
      if (b("[data-bp-create]") && draft) { if (!draft.name.trim()) { step = 0; App.render(); return; } create(); return; }
      if (!plan) return;
      // workspace
      if (b("[data-bp-mod]")) { mod = b("[data-bp-mod]").dataset.bpMod; App.render(); return; }
      if (b("[data-bp-goto]")) { mod = b("[data-bp-goto]").dataset.bpGoto; App.render(); return; }
      if (b("[data-bp-tf]")) { taskFilter = b("[data-bp-tf]").dataset.bpTf; App.render(); return; }
      if (b("[data-bp-done]")) {
        const id = b("[data-bp-done]").dataset.bpDone;
        editPlan(plan, { tasks: (plan.tasks || []).map(task => task.id === id ? { ...task, done: !task.done, updatedAt: now() } : task) });
        return;
      }
      if (b("[data-bp-task-del]")) {
        const id = b("[data-bp-task-del]").dataset.bpTaskDel;
        editPlan(plan, { tasks: (plan.tasks || []).map(task => task.id === id ? { ...task, deletedAt: now(), updatedAt: now() } : task) });
        return;
      }
      if (b("[data-bp-item-del]")) {
        const id = b("[data-bp-item-del]").dataset.bpItemDel;
        editPlan(plan, { budget: (plan.budget || []).map(item => item.id === id ? { ...item, deletedAt: now(), updatedAt: now() } : item) });
        return;
      }
      if (b("[data-bp-setprice]")) {
        const v = Number(b("[data-bp-setprice]").dataset.bpSetprice);
        if (v > 0) { const input = page.querySelector('[data-bp-live="pricing.sell"]'); patch(plan, p => setPath(p, "pricing.sell", String(v))); if (input) input.value = String(v); refreshOutputs(page, plan); }
        return;
      }
      if (b("[data-bp-usepricing]")) {
        const pm = priceMath(plan.pricing);
        editPlan(plan, { breakeven: { ...(plan.breakeven || {}), price: pm.sell ? String(+pm.sell.toFixed(2)) : "", variable: String(+pm.cost.toFixed(2)) } });
        return;
      }
      if (b("[data-bp-status]")) { editPlan(plan, { status: b("[data-bp-status]").dataset.bpStatus }); return; }
      if (b("[data-bp-delete]")) {
        Modal.confirm({ title: L("លុបផែនការ?", "Delete plan?"), message: L(`លុប "${plan.name}"? មិនអាចយកមកវិញបានទេ។`, `Delete "${plan.name}"? This can't be undone.`), confirmText: L("លុប", "Delete"), onConfirm: () => {
          Modal.close();
          mod = "ov";
          Store.delete("businessPlans", plan.id);
          go("#business");
        } });
      }
    };
    page.addEventListener("click", onClick);
    if (bar) bar.addEventListener("click", onClick);
  }

  // launcher tile hint: the soonest open task, else how many plans
  function badge() {
    const plans = list().filter(plan => plan.status !== "archived");
    if (!plans.length) return { text: L("ថ្មី", "New"), tone: "lime" };
    const today = localDateInput();
    const late = plans.reduce((n, plan) => n + live(plan.tasks).filter(task => !task.done && task.due && task.due < today).length, 0);
    if (late) return { text: L(`⚠️ ${kmNum(late)} ការងារហួស`, `⚠️ ${late} late`), tone: "amber" };
    return { text: L(`${kmNum(plans.length)} គម្រោង`, `${plans.length} plan${plans.length > 1 ? "s" : ""}`), tone: "muted" };
  }

  return { render, bind, badge, priceMath, beMath };
})();
