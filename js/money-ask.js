/* MYLIFE "did you get / pay it?" pop-up.
 * On the day salary/income is due, or a bill / loan payment is due (and while
 * it stays unanswered), opening the app asks once:
 *   💰 Salary $800 — got it yet?   [✅ Got it] [✏️ Other amount] [⏰ Not yet]
 *   🧾 EDC 40,000៛ — paid yet?      [✅ Paid] [⏰ Not yet]
 * Rules come from js/money-due.js (same as the Telegram alerts). Before saving
 * an answer the app pulls the cloud copy first, so something already paid or
 * received from Telegram is never recorded twice. "Not yet" asks again tomorrow
 * (kept on this device only).
 */
const MoneyAsk = (() => {
  const SNOOZE_KEY = "mylife:money-ask:later";
  let showing = false;
  let checkTimer = null;

  const km = () => languageCode() === "km";
  const L = (kmText, enText) => (km() ? kmText : enText);
  const today = () => localDateInput();

  function readLater() {
    try {
      const saved = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
      return saved && saved.day === today() && Array.isArray(saved.keys) ? saved.keys : [];
    } catch (error) {
      return [];
    }
  }
  function addLater(keys) {
    try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ day: today(), keys: [...new Set([...readLater(), ...keys])] })); } catch (error) { /* ignore */ }
  }

  function items() {
    if (typeof MoneyDue === "undefined" || typeof appData === "undefined") return [];
    const later = new Set(readLater());
    return MoneyDue.dueToday(appData, today()).filter(item => !later.has(item.key));
  }

  // plain text (money() returns HTML for the privacy blur)
  function plain(value, currency) {
    const code = currency || appData.profile.currency || "USD";
    try { if (typeof formatPlainMoney === "function") return formatPlainMoney(Number(value), code); } catch (error) { /* fall through */ }
    return code === "KHR" ? `${Math.round(value).toLocaleString("en-US")}៛` : `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function amountText(item) {
    if (!(item.amount > 0)) return "";
    return plain(item.amount, item.currency);
  }

  function whenText(item) {
    if (item.overdueDays <= 0) return L("ថ្ងៃនេះ", "today");
    if (item.overdueDays === 1) return L("ម្សិលមិញ", "yesterday");
    return L(`${item.overdueDays} ថ្ងៃមុន`, `${item.overdueDays} days ago`);
  }

  function rowHtml(item) {
    const amount = amountText(item);
    const icon = item.kind === "income" ? "💰" : item.kind === "loan" ? "🏦" : "🧾";
    const question = item.kind === "income"
      ? L(`បានទទួល${amount ? ` ${amount}` : ""} ហើយឬនៅ?`, `Got ${amount || "it"} yet?`)
      : L(`បានបង់${amount ? ` ${amount}` : ""} ហើយឬនៅ?`, `Paid ${amount || "it"} yet?`);
    return `<div class="ma-row" data-ma-row="${escapeAttr(item.key)}">
      <div class="ma-row-top">
        <span class="ma-icon ma-${item.kind}">${icon}</span>
        <div class="ma-text"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(question)}</span><em>${escapeHtml(L("ថ្ងៃកំណត់", "Due"))} ${escapeHtml(formatDate(item.date))} · ${escapeHtml(whenText(item))}</em></div>
      </div>
      <div class="ma-actions">
        <button type="button" class="ma-yes" data-ma-yes>${escapeHtml(item.kind === "income" ? L("✅ បានហើយ", "✅ Got it") : L("✅ បង់ហើយ", "✅ Paid"))}</button>
        ${item.kind === "income" ? `<button type="button" class="ma-other" data-ma-other>${escapeHtml(L("✏️ ចំនួនផ្សេង", "✏️ Other amount"))}</button>` : ""}
        <button type="button" class="ma-later" data-ma-later>${escapeHtml(L("⏰ មិនទាន់", "⏰ Not yet"))}</button>
      </div>
      <form class="ma-amount" data-ma-amount hidden><input type="number" min="0" step="any" inputmode="decimal" value="${escapeAttr(item.amount || "")}" aria-label="${escapeAttr(L("ចំនួនពិត", "Real amount"))}"><span>${escapeHtml(item.currency || "")}</span><button type="submit">${escapeHtml(L("រក្សាទុក", "Save"))}</button></form>
      <div class="ma-done" data-ma-done hidden></div>
    </div>`;
  }

  function busy() {
    const root = document.getElementById("modalRoot");
    return document.body.classList.contains("app-locked")
      || Boolean(document.querySelector(".app-lock:not([hidden])"))
      || root?.classList.contains("open")
      || Boolean(document.querySelector(".tga-overlay, .mf-reels, #loginModal"))
      || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  }

  const enabled = () => appData?.profile?.notificationsEnabled !== false && appData?.profile?.moneyAsk !== false;

  function check(tries = 0) {
    clearTimeout(checkTimer);
    if (showing || document.hidden || !enabled()) return;
    const list = items();
    if (!list.length) return;
    if (busy()) {
      if (tries < 90) checkTimer = setTimeout(() => check(tries + 1), 1500);
      return;
    }
    show(list);
  }

  function close(markLater) {
    const node = document.querySelector(".ma-pop");
    if (!node) return;
    if (markLater) addLater([...node.querySelectorAll("[data-ma-row]:not(.is-done)")].map(row => row.dataset.maRow));
    node.classList.add("is-closing");
    setTimeout(() => node.remove(), 180);
    document.removeEventListener("keydown", escClose);
    showing = false;
  }
  function escClose(event) { if (event.key === "Escape") close(true); }

  function show(list) {
    showing = true;
    const node = document.createElement("div");
    node.className = "ma-pop";
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-modal", "true");
    node.innerHTML = `<div class="ma-card">
      <div class="ma-head"><span class="ma-head-icon">💸</span><div><strong>${escapeHtml(L("លុយចូល · លុយចេញ ថ្ងៃនេះ", "Money due today"))}</strong><small>${escapeHtml(L("ឆ្លើយម្តង កត់ម្តង — មិនស្ទួន", "Answer once, saved once"))}</small></div><button type="button" class="ma-close" data-ma-close aria-label="Close">${Icons.close()}</button></div>
      <div class="ma-list">${list.map(rowHtml).join("")}</div>
    </div>`;
    document.body.appendChild(node);
    node.querySelector("[data-ma-close]").addEventListener("click", () => close(true));
    node.addEventListener("click", event => { if (event.target === node) close(true); });
    document.addEventListener("keydown", escClose);
    list.forEach(item => bindRow(node.querySelector(`[data-ma-row="${CSS.escape(item.key)}"]`), item));
  }

  function finishRow(row, text, tone = "ok") {
    row.classList.add("is-done");
    row.querySelector(".ma-actions").hidden = true;
    row.querySelector("[data-ma-amount]").hidden = true;
    const done = row.querySelector("[data-ma-done]");
    done.hidden = false;
    done.dataset.tone = tone;
    done.textContent = text;
    const pop = row.closest(".ma-pop");
    if (pop && !pop.querySelector("[data-ma-row]:not(.is-done)")) setTimeout(() => close(false), 1300);
  }

  // pull the newest cloud copy first: an answer given on Telegram is then seen here
  async function freshData() {
    if (typeof Store === "undefined" || typeof Store.syncFromSupabase !== "function" || !navigator.onLine) return;
    try { await Store.syncFromSupabase(); } catch (error) { /* offline: decide with what we have */ }
  }

  async function answer(row, item, amount) {
    row.querySelectorAll("button").forEach(button => { button.disabled = true; });
    await freshData();
    const stillDue = MoneyDue.dueToday(appData, today()).some(entry => entry.key === item.key);
    if (!stillDue) {
      finishRow(row, item.kind === "income" ? L("✅ បានកត់រួចហើយ (ប្រហែលពី Telegram)", "✅ Already saved (maybe from Telegram)") : L("✅ បានបង់រួចហើយ (ប្រហែលពី Telegram)", "✅ Already paid (maybe from Telegram)"));
      return;
    }
    if (item.kind === "bill") {
      markBillPaid(item.id); // records the expense (or the linked loan payment) once
      finishRow(row, L("✅ បានកត់ថាបង់ + ចំណាយ", "✅ Marked paid + expense saved"));
      return;
    }
    if (item.kind === "loan") {
      const loan = (appData.loans || []).find(entry => entry.id === item.id);
      const done = loan ? LoanPay.recordLoanPayment(appData, loan, item.date, { today: today(), via: "App" }) : { result: "missing" };
      if (done.result === "updated") { Store.save(); App.render(); }
      finishRow(row, done.result === "missing" ? L("⚠️ រកមិនឃើញ", "⚠️ Not found") : L("✅ បានកត់ការបង់កម្ចី", "✅ Loan payment saved"), done.result === "missing" ? "warn" : "ok");
      return;
    }
    const income = (appData.income || []).find(entry => entry.id === item.id);
    const result = income ? MoneyDue.recordIncomeReceived(income, item.month, { amount, date: today(), via: "App" }) : "missing";
    if (result === "updated") { Store.save(); App.render(); }
    const got = amount && Number(amount) !== Number(item.amount) ? plain(amount, item.currency) : "";
    finishRow(row, result === "missing" ? L("⚠️ រកមិនឃើញ", "⚠️ Not found") : L(`✅ បានកត់ថាទទួល${got ? ` ${got}` : ""}`, `✅ Marked received${got ? ` ${got}` : ""}`), result === "missing" ? "warn" : "ok");
  }

  function bindRow(row, item) {
    if (!row) return;
    row.querySelector("[data-ma-yes]").addEventListener("click", () => answer(row, item));
    row.querySelector("[data-ma-later]").addEventListener("click", () => {
      addLater([item.key]);
      finishRow(row, L("⏰ នឹងសួរម្តងទៀតស្អែក", "⏰ Will ask again tomorrow"), "later");
    });
    const other = row.querySelector("[data-ma-other]");
    const form = row.querySelector("[data-ma-amount]");
    other?.addEventListener("click", () => {
      form.hidden = false;
      row.querySelector(".ma-actions").hidden = true;
      setTimeout(() => form.querySelector("input").select(), 30);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const value = Number(form.querySelector("input").value || 0);
      if (!(value > 0)) return form.querySelector("input").focus();
      answer(row, item, value);
    });
  }

  function schedule(delay = 1800) {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => check(), delay);
  }

  // after each cloud pull, when the app comes back to the front, and once after start
  window.addEventListener("mylife:cloud-merged", () => schedule(800));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(1500); });
  if (typeof Store !== "undefined" && typeof Store.syncFromSupabase === "function") {
    const sync = Store.syncFromSupabase.bind(Store);
    Store.syncFromSupabase = async (...args) => {
      const result = await sync(...args);
      if (!showing) schedule(1200);
      return result;
    };
  }
  schedule(3500);

  // Notification Center → "Ask me now": also brings back what was put off today
  function askNow() {
    try { localStorage.removeItem(SNOOZE_KEY); } catch (error) { /* ignore */ }
    const list = items();
    if (!list.length) { Toast.show(L("ថ្ងៃនេះគ្មានអ្វីត្រូវសួរ", "Nothing to ask today")); return; }
    close(false);
    showing = false;
    show(list);
  }

  return { check, items, close, askNow, laterKeys: readLater };
})();
