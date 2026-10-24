/* MYLIFE Summary V2 (draft 24 Oct 2026): hero + 4 tiles (the smart-list categories:
 * Today / Money / Goals / Family), each category's lists as a segment (one list at a
 * time instead of 4 open/close boxes), a money tip card, life areas as coloured bars
 * and "this week". Both themes in css/summary-v2.css.
 * Reuses renderHomeSmartLists() so every old action keeps working (mark bill paid,
 * quick add, links); bindHomeActions() binds it like before. */
const SummaryV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_DAY = ["អាទិត្យ", "ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
  const KM_M = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const TILE_TONE = { today: "blue", money: "green", goals: "amber", family: "violet" };
  const plain = value => String(money(value)).replace(/<[^>]*>/g, "");

  function insight() {
    if (typeof moneyMonthNumbers !== "function") return "";
    let m;
    try { m = moneyMonthNumbers(); } catch (error) { return ""; }
    if (!m || !(m.income > 0 || m.expenses > 0)) return "";
    const now = new Date();
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
    const share = m.income > 0 ? Math.round((m.expenses / m.income) * 100) : null;
    const title = share != null ? L(`ខែនេះចាយ ${share}% នៃចំណូល`, `Spent ${share}% of income this month`) : L(`ខែនេះចាយ ${plain(m.expenses)}`, `Spent ${plain(m.expenses)} this month`);
    const detail = m.left >= 0
      ? L(`នៅសល់ ${plain(m.left)} សម្រាប់ ${daysLeft} ថ្ងៃ · ≈ ${plain(m.left / daysLeft)}/ថ្ងៃ`, `${plain(m.left)} left for ${daysLeft} days · ≈ ${plain(m.left / daysLeft)}/day`)
      : L(`ខ្វះ ${plain(-m.left)} ខែនេះ — សាកកាត់ចំណាយខ្លះ`, `Short by ${plain(-m.left)} this month — try cutting some spending`);
    return `<a class="smv-tip${m.left < 0 ? " is-warn" : ""}" href="#money"><i>💡</i><p><span class="money-value" data-private-money>${escapeHtml(title)}</span><small><span class="money-value" data-private-money>${escapeHtml(detail)}</span></small></p><b>›</b></a>`;
  }

  function lifeAreas() {
    const items = [
      { label: t("family"), count: (appData.family || []).length, icon: "👨‍👩‍👧", tone: "violet", href: "#family" },
      { label: t("money"), count: ["income", "expenses", "savings", "loans", "bills"].reduce((sum, key) => sum + (appData[key] || []).length, 0), icon: "💵", tone: "green", href: "#money" },
      { label: t("calendar"), count: (appData.calendarEvents || []).length, icon: "📅", tone: "blue", href: "#calendar" },
      { label: t("goals"), count: (appData.goals || []).length, icon: "🎯", tone: "amber", href: "#goals" },
      { label: t("memories"), count: (appData.memories || []).length, icon: "📸", tone: "pink", href: "#memories" }
    ];
    const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
    return `<div class="smv-sec"><b>${escapeHtml(L("ផ្នែកជីវិត", "Life areas"))}</b><small>${escapeHtml(L(`${total} កំណត់ត្រា`, `${total} records`))}</small></div>
      <section class="smv-card smv-areas">${items.map(item => {
        const p = Math.round((item.count / total) * 100);
        return `<a href="${item.href}"><i>${item.icon}</i><span><b>${escapeHtml(item.label)}</b><span class="smv-bar is-${item.tone}"><em style="width:${Math.max(p, 2)}%"></em></span></span><small>${item.count} · ${p}%</small></a>`;
      }).join("")}</section>`;
  }

  function thisWeek() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
    const iso = date => localDateInput(date);
    const startIso = iso(start);
    const endIso = iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
    const prevStartIso = iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7));
    const prevEndIso = iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1));
    const todayIso = iso(today);
    const events = (appData.calendarEvents || []).filter(event => event.date >= startIso && event.date <= endIso);
    const passed = events.filter(event => event.date < todayIso).length;
    const spend = (from, to) => (appData.expenses || []).filter(expense => expense.date >= from && expense.date <= to).reduce((sum, expense) => sum + toProfileCurrency(expense.amount, expense.currency), 0);
    const spent = spend(startIso, todayIso);
    const before = spend(prevStartIso, prevEndIso);
    const saved = (appData.goals || []).reduce((sum, goal) => sum + (goal.contributions || []).filter(item => item.date >= startIso && item.date <= endIso).reduce((s, item) => s + Number(item.amount || 0), 0), 0);
    const diff = before - spent;
    const compare = before > 0
      ? (diff >= 0 ? L(`តិចជាងសប្តាហ៍មុន ${plain(diff)} 👍`, `${plain(diff)} less than last week 👍`) : L(`ច្រើនជាងសប្តាហ៍មុន ${plain(-diff)}`, `${plain(-diff)} more than last week`))
      : L("សប្តាហ៍មុនមិនបានចាយ", "Nothing spent last week");
    return `<div class="smv-sec"><b>${escapeHtml(L("សប្តាហ៍នេះ", "This week"))}</b></div>
      <section class="smv-card smv-week">
        <a href="#calendar"><i class="is-blue"></i><p>${escapeHtml(L(`ព្រឹត្តិការណ៍ ${events.length}`, `${events.length} event${events.length === 1 ? "" : "s"}`))}<small>${escapeHtml(L(`${passed} រួចហើយ · ${events.length - passed} នៅសល់`, `${passed} done · ${events.length - passed} to go`))}</small></p></a>
        <a href="#money/expenses"><i class="is-green"></i><p><span class="money-value" data-private-money>${escapeHtml(L(`ចាយ ${plain(spent)}`, `Spent ${plain(spent)}`))}</span><small>${escapeHtml(compare)}</small></p></a>
        <a href="#goals"><i class="is-amber"></i><p><span class="money-value" data-private-money>${escapeHtml(L(`សន្សំចូលគោលដៅ ${saved >= 0 ? "+" : "−"}${plain(Math.abs(saved))}`, `Saved to goals ${saved >= 0 ? "+" : "−"}${plain(Math.abs(saved))}`))}</span><small>${escapeHtml(L(`${(appData.goals || []).length} គោលដៅ`, `${(appData.goals || []).length} goals`))}</small></p></a>
      </section>`;
  }

  // one list at a time: a segment above each category's lists
  function enhance() {
    document.querySelectorAll(".smv .home-smart-list-grid").forEach(panel => {
      if (panel.dataset.smvDone) return;
      panel.dataset.smvDone = "1";
      const lists = [...panel.querySelectorAll(":scope > details.home-smart-list")];
      if (!lists.length) return;
      const seg = document.createElement("div");
      seg.className = "smv-seg";
      seg.setAttribute("role", "tablist");
      seg.style.setProperty("--n", Math.min(lists.length, 4));
      seg.dataset.n = String(lists.length);
      seg.innerHTML = lists.map((list, index) => {
        const title = list.querySelector("summary > span")?.textContent || "";
        const count = list.querySelector("summary > strong")?.textContent || "0";
        return `<button type="button" role="tab" class="${index === 0 ? "on" : ""}" data-smv-tab="${index}" aria-selected="${index === 0}"><span>${escapeHtml(title)}</span><em>${escapeHtml(count)}</em></button>`;
      }).join("");
      panel.prepend(seg);
      lists.forEach((list, index) => { list.open = true; list.classList.toggle("smv-on", index === 0); });
    });
  }
  document.addEventListener("click", event => {
    const tab = event.target.closest("[data-smv-tab]");
    if (tab) {
      const panel = tab.closest(".home-smart-list-grid");
      const index = Number(tab.dataset.smvTab);
      panel.querySelectorAll("[data-smv-tab]").forEach(button => { const on = button === tab; button.classList.toggle("on", on); button.setAttribute("aria-selected", String(on)); });
      panel.querySelectorAll(":scope > details.home-smart-list").forEach((list, i) => { list.open = true; list.classList.toggle("smv-on", i === index); });
      return;
    }
    if (event.target.closest("[data-smv-refresh]")) App.render();
  });
  // keep the lists open inside the segment (a tap on a summary would close it)
  document.addEventListener("toggle", event => {
    const list = event.target;
    if (list.matches?.(".smv details.home-smart-list") && !list.open) list.open = true;
  }, true);

  function render(todayIso, agenda, focusItems) {
    const now = new Date();
    const date = km() ? `${KM_DAY[now.getDay()]} ${now.getDate()} ${KM_M[now.getMonth()]}` : now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
    let lists = renderHomeSmartLists(agenda, focusItems, todayIso);
    // the 4 category buttons become the tiles in the hero
    let tiles = "";
    lists = lists.replace(/<div class="home-smart-category-nav"[\s\S]*?<\/div>/, match => { tiles = match; return ""; })
      .replace(/<header class="home-smart-lists-heading">[\s\S]*?<\/header>/, "");
    tiles = tiles.replace(/data-smart-category="(\w+)"/g, (match, id) => `${match} data-tone="${TILE_TONE[id] || "blue"}"`);
    setTimeout(enhance, 0);
    return `<section class="page summary-page smv">
      <header class="smv-hero">
        <div class="smv-top"><h1 class="smv-title">${escapeHtml(L("សង្ខេប", "Summary"))}</h1><button type="button" class="smv-ib" data-smv-refresh aria-label="${escapeAttr(L("ធ្វើឱ្យថ្មី", "Refresh"))}">⟳</button></div>
        <p class="smv-sub">${escapeHtml(date)} · ${escapeHtml(L("អ្វីៗសំខាន់ទាំងអស់នៅកន្លែងតែមួយ", "everything important in one place"))}</p>
        ${tiles}
      </header>
      <div class="smv-wrap">
        ${lists}
        ${insight()}
        ${lifeAreas()}
        ${thisWeek()}
      </div>
    </section>`;
  }

  return { render, enhance };
})();
