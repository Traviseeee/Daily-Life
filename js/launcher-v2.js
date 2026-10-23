/* MYLIFE Launcher V2 (draft 23 Oct 2026): greeting + search → Today / Money cards →
 * all apps in one card (soft icons) → coming up → quick add. Both themes
 * (css/launcher-v2.css). Keeps bindLauncher()'s hooks: .launcher-page,
 * [data-footer-editor], launcherTool() tiles with their footer pins, data-launcher-quick.
 * The old layout in launcher.js stays as a fallback. */
const LauncherV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_DAY = ["អាទិត្យ", "ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
  const KM_DAY_S = ["អាទិ", "ចន្ទ", "អង្គ", "ពុធ", "ព្រហ", "សុក្រ", "សៅរ៍"];
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  // help sits inside Tips, so the grid is 12 (4 × 3)
  const ORDER = ["today", "calendar", "money", "family", "goals", "memories", "daily", "summary", "scan", "notifications", "tips", "settings"];

  function hero() {
    const p = appData.profile;
    const now = new Date();
    const hour = now.getHours();
    const hello = hour < 12 ? L("អរុណសួស្តី ☀️", "Good morning ☀️") : hour < 17 ? L("ទិវាសួស្តី ☀️", "Good afternoon ☀️") : L("សាយណ្ហសួស្តី 🌙", "Good evening 🌙");
    const date = km() ? `${KM_DAY[now.getDay()]} ${now.getDate()} ${KM_M[now.getMonth()]}` : now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
    const photo = p.photo ? `<img src="${escapeAttr(p.photo)}" alt="">` : `<span>${escapeHtml(initials(p.name || "ML"))}</span>`;
    return `<header class="lv-hero">
      <div class="lv-hi">
        <a class="lv-av" href="#settings" aria-label="${escapeAttr(t("settings"))}"><span class="lv-face">${photo}</span></a>
        <span class="lv-hi-tx"><small>${escapeHtml(`${date} · ${hello}`)}</small><b>${escapeHtml(String(p.name || L("ភ្ញៀវ", "Guest")).split(/\s+/)[0])}</b></span>
        <span class="lv-wx" data-hv2-wx>${document.getElementById("topbarWeather")?.innerHTML || ""}</span>
      </div>
      <div class="lv-search">
        <button type="button" class="lv-search-go" data-lv-search>🔍 <span>${escapeHtml(L("ស្វែងរកក្នុង MYLIFE…", "Search MYLIFE…"))}</span></button>
        <a class="lv-search-btn" href="#scan" aria-label="${escapeAttr(L("ស្កេន", "Scan"))}">${Icons.scan()}</a>
        <button type="button" class="lv-search-btn" data-lv-ai aria-label="AI">${Icons.spark()}</button>
      </div>
    </header>`;
  }

  function widgets() {
    const today = launcherBadge("today");
    const family = launcherBadge("family");
    const m = typeof moneyMonthNumbers === "function" ? moneyMonthNumbers() : null;
    const waiting = typeof MoneyAsk !== "undefined" && appData.profile.moneyAsk !== false ? MoneyAsk.items().length : 0;
    const plain = value => String(money(Math.abs(value))).replace(/<[^>]*>/g, "");
    const free = today?.tone === "muted";
    return `<div class="lv-sum">
      <a class="lv-sc is-main" href="#today"><small>${escapeHtml(L("ថ្ងៃនេះ", "Today"))}</small><b>${escapeHtml(free ? `${today.text} 🌿` : today?.text || "")}</b><em>${escapeHtml(family?.text || "")}</em></a>
      <a class="lv-sc" href="#money"><small>${escapeHtml(L("លុយខែនេះ", "Money this month"))}</small>${m ? `<b class="${m.left < 0 ? "is-neg" : ""}"><span class="money-value" data-private-money>${escapeHtml(m.left < 0 ? L(`ខ្វះ ${plain(m.left)}`, `Short ${plain(m.left)}`) : L(`នៅសល់ ${plain(m.left)}`, `${plain(m.left)} left`))}</span></b>` : ""}<em>${escapeHtml(waiting ? L(`${waiting} រង់ចាំឆ្លើយ ›`, `${waiting} waiting ›`) : L("មើលលម្អិត ›", "Details ›"))}</em></a>
    </div>`;
  }

  function upcoming() {
    let items = [];
    try { items = getUpcomingNotifications(14, 4); } catch (error) { items = []; }
    const today = localDateInput();
    const thisMonth = today.slice(0, 7);
    const rows = items.map(item => {
      const d = new Date(`${item.date}T00:00:00`);
      const isBill = item.kind === "bill";
      const tag = isBill ? L("វិក្កយបត្រ", "Bill") : item.kind === "birthday" || item.type === "birthday" ? L("គ្រួសារ", "Family") : item.kind === "reminder" ? L("រំលឹក", "Reminder") : L("ព្រឹត្តិការណ៍", "Event");
      const tone = isBill ? "amber" : item.kind === "birthday" || item.type === "birthday" ? "pink" : item.kind === "reminder" ? "green" : "blue";
      const when = item.daysLeft === 0 ? L("ថ្ងៃនេះ", "today") : item.daysLeft === 1 ? L("ស្អែក", "tomorrow") : L(`ក្នុង ${item.daysLeft} ថ្ងៃ`, `in ${item.daysLeft} days`);
      const amount = item.amount ? String(money(item.amount, item.currency || undefined)) : "";
      return `<a class="lv-up" href="${isBill ? "#money/bills" : "#calendar"}">
        <span class="lv-dt"><b>${d.getDate()}</b><small>${escapeHtml(item.date.slice(0, 7) === thisMonth ? (km() ? KM_DAY_S[d.getDay()] : d.toLocaleDateString("en-US", { weekday: "short" })) : (km() ? KM_M[d.getMonth()] : d.toLocaleDateString("en-US", { month: "short" })))}</small></span>
        <span class="lv-up-tx"><b>${escapeHtml(item.title || "")}</b><small>${amount ? `${amount} · ` : ""}${escapeHtml(when)}</small></span>
        <span class="lv-tag is-${tone}">${escapeHtml(tag)}</span>
      </a>`;
    }).join("");
    return `<div class="lv-sec"><b>${escapeHtml(L("ជិតមកដល់", "Coming up"))}</b><a href="#calendar">${escapeHtml(L("ប្រតិទិន ›", "Calendar ›"))}</a></div>
      <section class="lv-card lv-ups">${rows || `<p class="lv-empty">${escapeHtml(L("២ សប្តាហ៍ខាងមុខ ទំនេរ 🎉", "Nothing in the next 2 weeks 🎉"))}</p>`}</section>`;
  }

  function quickAdd() {
    const actions = [["add-event", "📅", L("ព្រឹត្តិការណ៍", "Event")], ["add-expense", "💸", L("ចំណាយ", "Expense")], ["add-hobby", "🎨", L("ចំណូលចិត្ត", "Hobby")], ["add-memory", "📸", L("អនុស្សាវរីយ៍", "Memory")]];
    return `<div class="lv-sec"><b>${escapeHtml(L("បន្ថែមរហ័ស", "Quick add"))}</b><button type="button" class="lv-link" data-footer-edit aria-pressed="false">${escapeHtml(L("រៀបចំ footer ›", "Arrange footer ›"))}</button></div>
      <div class="lv-qa">${actions.map(([id, icon, label]) => `<button type="button" class="lv-q" data-launcher-quick="${id}"><i>${icon}</i><span>${escapeHtml(label)}</span></button>`).join("")}</div>`;
  }

  function render() {
    const all = launcherAllRoutes();
    return `<section class="launcher-page page lv2">
      ${hero()}
      <div class="lv-body">
        ${widgets()}
        <section class="footer-editor" data-footer-editor hidden></section>
        <div class="lv-sec"><b>${escapeHtml(L("កម្មវិធីទាំងអស់", "All apps"))}</b></div>
        <nav class="app-grid lv-grid" aria-label="App tools">${ORDER.map(id => all.find(route => route.id === id)).filter(Boolean).map(launcherTool).join("")}</nav>
        ${upcoming()}
        ${quickAdd()}
      </div>
    </section>`;
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-lv-search]")) {
      document.body.classList.add("hv2-search-open");
      setTimeout(() => document.getElementById("globalSearch")?.focus(), 50);
    }
    if (event.target.closest("[data-lv-ai]")) document.getElementById("smartAssistantButton")?.click();
  });

  return { render };
})();
