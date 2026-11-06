/* MYLIFE Done feed (6 Nov 2026)
 * 1. celebrate(): a small Nomi card with confetti when a loan / bill is paid or savings go in
 *    (bigger "debt free" card when a loan is fully paid). Replaces the plain toast.
 * 2. items(days): what was paid / saved lately, read from data that already exists:
 *    expenses with loanId / billId (createdAt) and savings contributions (at / partnerAt).
 *    Used by the bell ("✓ Done") and Home (Nomi line + ✓ rows in the Today card).
 * Nothing new is stored except the `at` / `partnerAt` time on new savings entries. */
const DoneFeed = (() => {
  const km = () => (typeof languageCode === "function" ? languageCode() : "en") === "km";
  const L = (k, e) => (km() ? k : e);
  const esc = value => (typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? ""));
  const plain = (value, currency) => String(typeof money === "function" ? money(value, currency) : value).replace(/<[^>]*>/g, "");
  const dayOf = value => {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : (typeof localDateInput === "function" ? localDateInput(d) : d.toISOString().slice(0, 10));
  };
  const todayIso = () => (typeof localDateInput === "function" ? localDateInput() : new Date().toISOString().slice(0, 10));
  const first = name => String(name || "").trim().split(/\s+/)[0] || "";

  function loanInfo(loan) {
    const total = typeof loanPayoffAmount === "function" ? loanPayoffAmount(loan) || Number(loan.originalAmount || 0) : 0;
    const remaining = typeof loanRemaining === "function" ? loanRemaining(loan) : 0;
    const paid = Math.max(0, total - remaining);
    const monthly = Number(loan.monthlyPayment || 0);
    return { total, remaining, paid, pct: total ? Math.min(100, Math.round(paid / total * 100)) : 0, monthsLeft: monthly ? Math.ceil(remaining / monthly - 0.001) : 0 };
  }

  function loanSub(loan) {
    const info = loanInfo(loan);
    if (info.remaining <= 0) return L("បង់ផ្តាច់ហើយ 🏆", "Fully paid 🏆");
    return [info.monthsLeft ? L(`នៅ ${info.monthsLeft} ខែ`, `${info.monthsLeft} mo left`) : "", plain(info.remaining, loan.currency), `${info.pct}%`].filter(Boolean).join(" · ");
  }

  /* ---------- 1. celebrate ---------- */
  let timer = null;
  function celebrate({ title, sub = "", big = false, mood = "love" } = {}) {
    if (typeof document === "undefined") return;
    document.querySelector(".df-cele")?.remove();
    clearTimeout(timer);
    const el = document.createElement("div");
    el.className = `df-cele${big ? " is-big" : ""}`;
    el.setAttribute("role", "status");
    const buddy = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy(mood) : "🐱";
    const bits = Array.from({ length: big ? 26 : 14 }, (_, i) => `<i style="--x:${Math.round(Math.random() * 100)}%;--d:${(Math.random() * 0.5).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg;--c:${["#8b7cf6", "#ff8fab", "#ffc65c", "#5fd3a7", "#6fb7ff"][i % 5]}"></i>`).join("");
    el.innerHTML = `<div class="df-confetti" aria-hidden="true">${bits}</div>
      <div class="df-card"><span class="df-nomi">${buddy}</span><span class="df-tx"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span></div>`;
    el.addEventListener("click", () => el.remove());
    document.body.appendChild(el);
    if (navigator.vibrate) try { navigator.vibrate(big ? [30, 40, 30] : 20); } catch (error) { /* ignore */ }
    timer = setTimeout(() => { el.classList.add("is-out"); setTimeout(() => el.remove(), 300); }, big ? 5200 : 3200);
  }

  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  function monthWord(iso) {
    const d = new Date(`${String(iso || todayIso()).slice(0, 7)}-01T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return km() ? KM_MONTHS[d.getMonth()] : d.toLocaleDateString("en-US", { month: "long" });
  }
  function dayWord(iso) {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return km() ? `${d.getDate()} ${KM_MONTHS[d.getMonth()]}` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function afterLoanPay(loan, date) {
    if (!loan) return;
    const info = loanInfo(loan);
    const name = loan.name || L("កម្ចី", "Loan");
    if (info.remaining <= 0) {
      celebrate({ big: true, mood: "love", title: L(`🏆 រួចបំណុលហើយ!`, `🏆 Debt free!`), sub: L(`${name} បង់ផ្តាច់ ${plain(info.total, loan.currency)}`, `${name} fully paid · ${plain(info.total, loan.currency)}`) });
      return;
    }
    const month = date ? monthWord(date) : "";
    celebrate({ mood: "cheer", title: L(`🎉 បង់ ${name}${month ? ` ខែ${month}` : ""}រួច!`, `🎉 ${name}${month ? ` · ${month}` : ""} paid!`), sub: loanSub(loan) });
  }

  function afterBillPay(bill) {
    if (!bill) return;
    celebrate({ mood: "cheer", title: L(`✓ បង់ ${bill.name || "វិក្កយបត្រ"} រួច`, `✓ ${bill.name || "Bill"} paid`), sub: bill.due && bill.status !== "Paid" ? L(`លើកក្រោយ ${dayWord(bill.due)}`, `Next ${dayWord(bill.due)}`) : "" });
  }

  function afterSave(saving, who, amount) {
    if (!saving) return;
    const reached = Number(saving.targetAmount || 0) > 0 && Number(saving.currentAmount || 0) >= Number(saving.targetAmount || 0);
    const by = who ? `${who} ` : "";
    if (reached) {
      celebrate({ big: true, mood: "love", title: L("🏆 ដល់គោលដៅហើយ!", "🏆 Goal reached!"), sub: `${saving.name || ""} · ${plain(saving.currentAmount, saving.currency)}` });
      return;
    }
    const p = Number(saving.targetAmount || 0) ? Math.round(Number(saving.currentAmount || 0) / Number(saving.targetAmount) * 100) : 0;
    celebrate({ mood: "cheer", title: L(`🐷 ${by}ដាក់ ${plain(amount, saving.currency)} រួច!`, `🐷 ${by}saved ${plain(amount, saving.currency)}!`), sub: [saving.name || "", p ? `${p}%` : ""].filter(Boolean).join(" · ") });
  }

  /* ---------- 2. what was done lately ---------- */
  function items(days = 7) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const sinceIso = typeof localDateInput === "function" ? localDateInput(since) : since.toISOString().slice(0, 10);
    const out = [];
    const data = typeof appData !== "undefined" ? appData : {};
    (data.expenses || []).forEach(entry => {
      if (!entry || (!entry.loanId && !entry.billId)) return;
      const day = dayOf(entry.createdAt) || entry.date;
      if (!day || day < sinceIso) return;
      const loan = entry.loanId ? (data.loans || []).find(item => item.id === entry.loanId) : null;
      out.push({
        kind: loan ? "loan" : "bill", at: entry.createdAt || `${day}T12:00:00`, day,
        title: loan ? L(`បង់ ${loan.name || "កម្ចី"}`, `Paid ${loan.name || "loan"}`) : L(`បង់ ${entry.description || "វិក្កយបត្រ"}`, `Paid ${entry.description || "bill"}`),
        amount: plain(entry.amount, entry.currency), sub: loan ? loanSub(loan) : "", href: loan ? "#money/loans" : "#money/bills"
      });
    });
    (data.savings || []).forEach(saving => {
      const member = saving.jointWith ? (data.family || []).find(person => person.id === saving.jointWith) : null;
      const partner = first(member?.name || saving.jointName) || L("ដៃគូ", "Partner");
      (saving.contributions || []).forEach(entry => {
        if (entry?.paid && entry.at && dayOf(entry.at) >= sinceIso) out.push({ kind: "save", at: entry.at, day: dayOf(entry.at), title: L(`ដាក់សន្សំ ${saving.name || ""}`, `Saved · ${saving.name || ""}`), amount: plain(entry.amount, saving.currency), sub: saving.jointWith ? L("ខ្ញុំ", "Me") : "", href: "#money/savings" });
        if (entry?.partnerPaid && entry.partnerAt && dayOf(entry.partnerAt) >= sinceIso) out.push({ kind: "save", at: entry.partnerAt, day: dayOf(entry.partnerAt), title: L(`ដាក់សន្សំ ${saving.name || ""}`, `Saved · ${saving.name || ""}`), amount: plain(entry.partnerAmount, saving.currency), sub: partner, href: "#money/savings" });
      });
    });
    return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  const ICON = { loan: "🏦", bill: "🧾", save: "🐷" };
  function whenLabel(item) {
    const today = todayIso();
    if (item.day === today) {
      const d = new Date(item.at);
      return Number.isNaN(d.getTime()) ? L("ថ្ងៃនេះ", "Today") : d.toLocaleTimeString(km() ? "en-GB" : "en-US", { hour: "2-digit", minute: "2-digit" });
    }
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (item.day === (typeof localDateInput === "function" ? localDateInput(y) : "")) return L("ម្សិលមិញ", "Yesterday");
    return item.day.slice(5).replace("-", "/");
  }

  // bell: "✓ Done" group (last 7 days)
  function bellHtml() {
    const list = items(7).slice(0, 8);
    if (!list.length) return "";
    return `<section class="nc-group df-bell" data-nc-group="done">
      <h3>✓ ${esc(L("បានធ្វើរួច · 7 ថ្ងៃ", "Done · 7 days"))}<span>${list.length}</span></h3>
      <div class="df-list">${list.map(item => `<a class="df-row" href="${item.href}" data-nc-close><span class="df-ic">${ICON[item.kind]}</span><span class="df-copy"><b>${esc(item.title)}</b><small>${esc([whenLabel(item), item.sub].filter(Boolean).join(" · "))}</small></span><span class="df-amt">✓ ${esc(item.amount)}</span></a>`).join("")}</div>
    </section>`;
  }

  // Home Today card: ✓ rows for today
  function homeRows() {
    const today = todayIso();
    return items(1).filter(item => item.day === today).slice(0, 3).map(item => `<a class="hv2-tl-row df-home-row" href="${item.href}"><span class="hv2-tl-ic df-home-ic">✓</span><span class="df-copy"><b>${esc(item.title)}</b><small>${esc(item.sub || L("រួចហើយ", "Done"))}</small></span><span class="df-amt">${esc(item.amount)}</span></a>`).join("");
  }

  // Home Nomi bubble lines for today
  function heroLines() {
    const today = todayIso();
    return items(1).filter(item => item.day === today).slice(0, 2).map(item => {
      if (item.kind === "loan") {
        const left = item.sub && !item.sub.includes("🏆") ? item.sub.split(" · ")[0] : "";
        if (item.sub.includes("🏆")) return [`${item.title} ផ្តាច់ហើយ 🏆 អបអរ!`, `${item.title} in full 🏆 Congrats!`];
        return [`${item.title} រួចហើយ 💪${left ? ` ${left}ទៀត` : ""}`, `${item.title} 💪${left ? ` ${left}` : ""}`];
      }
      if (item.kind === "save") return [`ដាក់សន្សំ ${item.amount} រួច 🐷 ល្អណាស់!`, `Saved ${item.amount} 🐷 nice!`];
      return [`${item.title} រួច ✓ ធូរចិត្ត`, `${item.title} ✓ one less thing`];
    });
  }

  // Home news ticker: week summary + each thing done, scrolling in one line
  function tickerHtml() {
    const list = items(7);
    if (!list.length) return "";
    const paid = list.filter(item => item.kind !== "save").length;
    const saved = list.filter(item => item.kind === "save").length;
    const head = [paid ? L(`បង់ ${paid}`, `${paid} paid`) : "", saved ? L(`សន្សំ ${saved} ដង`, `${saved} saved`) : ""].filter(Boolean).join(" · ");
    const bits = [`🎉 ${L("សប្តាហ៍នេះ", "This week")}: ${head}`, ...list.slice(0, 8).map(item => `✓ ${item.title}${item.kind === "save" && item.sub ? ` (${item.sub})` : ""} ${item.amount}`)];
    const line = bits.map(text => `<span>${esc(text)}</span>`).join('<i aria-hidden="true">•</i>');
    const dur = Math.max(14, Math.round(bits.join(" ").length * 0.28));
    return `<a class="df-ticker" href="#money" aria-label="${esc(bits.join(". "))}"><b class="df-tk-tag">✓ ${esc(L("រួចហើយ", "Done"))}</b><span class="df-tk-win"><span class="df-tk-run" style="--dur:${dur}s">${line}<i aria-hidden="true">•</i>${line}<i aria-hidden="true">•</i></span></span></a>`;
  }

  return { tickerHtml, celebrate, afterLoanPay, afterBillPay, afterSave, items, bellHtml, homeRows, heroLines, loanInfo };
})();
