/* MYLIFE Smart calculator (#calc, 8 Nov 2026 · draft A): four tabs —
 * 🏷️ discount (+ optional 10% tax), 👥 split a bill (+ tip), 💱 $ ⇄ ៛, ➗ plain calculator.
 * Every result shows both $ and ៛. "＋ កត់ជាចំណាយ" opens the normal expense form pre-filled,
 * so nothing is saved without the user confirming. The ៛ rate is kept on this device only. */
const CalcTool = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const RATE_KEY = "mylife:calc-rate";
  const TAB_KEY = "mylife:calc-tab";
  let tab = "disc";
  try { tab = localStorage.getItem(TAB_KEY) || "disc"; } catch (error) { /* private mode */ }
  const s = { price: "", priceCur: "USD", pct: "20", tax: false, total: "", people: 2, tip: 0, fxAmount: "", fxDir: "USD", expr: "" };

  const rate = () => { try { return Number(localStorage.getItem(RATE_KEY)) || 4100; } catch (error) { return 4100; } };
  const usd = v => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const khr = v => `៛${Math.round(Number(v || 0)).toLocaleString("en-US")}`;
  const fmt = (value, cur) => (cur === "KHR" ? khr(value) : usd(value));
  const other = (value, cur) => (cur === "KHR" ? usd(value / rate()) : khr(value * rate()));
  const num = v => { const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };

  /* ---------- tiny safe calculator (no eval): + − × ÷ % and brackets ---------- */
  function evaluate(text) {
    const src = String(text).replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
    if (!src) return 0;
    let i = 0;
    const peek = () => src[i];
    function number() {
      let start = i;
      while (i < src.length && /[0-9.]/.test(src[i])) i += 1;
      if (start === i) throw new Error("bad");
      let value = Number(src.slice(start, i));
      if (peek() === "%") { i += 1; value /= 100; }
      return value;
    }
    function factor() {
      if (peek() === "-") { i += 1; return -factor(); }
      if (peek() === "(") { i += 1; const v = expr(); if (peek() === ")") i += 1; return v; }
      return number();
    }
    function term() {
      let v = factor();
      while (peek() === "*" || peek() === "/") { const op = src[i++]; const r = factor(); v = op === "*" ? v * r : v / r; }
      return v;
    }
    function expr() {
      let v = term();
      while (peek() === "+" || peek() === "-") {
        const op = src[i++];
        const save = i;
        let r = term();
        // "120 − 20%" means 20% of 120 (like a phone calculator)
        if (src[i - 1] === "%" && src.slice(save, i).indexOf("(") < 0) r = v * r;
        v = op === "+" ? v + r : v - r;
      }
      return v;
    }
    const value = expr();
    if (i < src.length || !Number.isFinite(value)) throw new Error("bad");
    return value;
  }

  /* ---------- tabs ---------- */
  const chips = (list, current, attr, suffix = "") => list.map(v => `<button type="button" class="ct-chip${String(current) === String(v) ? " is-on" : ""}" ${attr}="${v}">${v}${suffix}</button>`).join("");
  const curBtn = (cur, attr) => `<button type="button" class="ct-cur" ${attr}>${cur === "KHR" ? "៛" : "$"}</button>`;

  function disc() {
    const price = num(s.price), pct = Math.min(100, Math.max(0, num(s.pct)));
    const after = price * (1 - pct / 100);
    const pay = s.tax ? after * 1.1 : after;
    return {
      body: `<div class="ct-box">
          <label class="ct-field"><small>${L("តម្លៃដើម", "Price")}</small><span class="ct-in">${curBtn(s.priceCur, "data-ct-pricecur")}<input inputmode="decimal" type="number" min="0" step="any" placeholder="0" value="${escapeAttr(s.price)}" data-ct="price"></span></label>
          <label class="ct-field"><small>${L("បញ្ចុះ (%)", "Discount (%)")}</small><span class="ct-in"><input inputmode="decimal" type="number" min="0" max="100" step="any" placeholder="0" value="${escapeAttr(s.pct)}" data-ct="pct"><em>%</em></span></label>
          <div class="ct-chips">${chips([10, 15, 20, 30, 50], s.pct, "data-ct-pct", "%")}<button type="button" class="ct-chip${s.tax ? " is-on" : ""}" data-ct-tax>+ ${L("ពន្ធ", "Tax")} 10%</button></div>
        </div>`,
      result: `<small>${L("តម្លៃត្រូវបង់", "You pay")}</small><b class="ct-big">${fmt(pay, s.priceCur)}</b><span class="ct-sub"><span>≈ ${other(pay, s.priceCur)}</span><span>${L("សន្សំបាន", "You save")} ${fmt(price - after, s.priceCur)}</span></span>`,
      amount: pay, cur: s.priceCur, desc: L(`ទិញ (បញ្ចុះ ${pct}%)`, `Purchase (${pct}% off)`)
    };
  }

  function split() {
    const total = num(s.total), people = Math.max(1, Number(s.people) || 1);
    const withTip = total * (1 + s.tip / 100);
    const each = withTip / people;
    return {
      body: `<div class="ct-box">
          <label class="ct-field"><small>${L("សរុប", "Total")}</small><span class="ct-in">${curBtn(s.priceCur, "data-ct-pricecur")}<input inputmode="decimal" type="number" min="0" step="any" placeholder="0" value="${escapeAttr(s.total)}" data-ct="total"></span></label>
          <div class="ct-field"><small>${L("មនុស្ស", "People")}</small><span class="ct-step"><button type="button" data-ct-people="-1" aria-label="-">−</button><b>${people}</b><button type="button" data-ct-people="1" aria-label="+">+</button><span class="ct-faces" aria-hidden="true">${"👤".repeat(Math.min(people, 8))}${people > 8 ? "…" : ""}</span></span></div>
          <div class="ct-chips"><span class="ct-lbl">Tip</span>${chips([0, 5, 10], s.tip, "data-ct-tip", "%")}</div>
        </div>`,
      result: `<small>${L("ម្នាក់ៗបង់", "Each pays")}</small><b class="ct-big">${fmt(each, s.priceCur)}</b><span class="ct-sub"><span>≈ ${other(each, s.priceCur)}</span><span>${L("សរុប", "Total")} ${fmt(withTip, s.priceCur)}</span></span>`,
      amount: each, cur: s.priceCur, desc: L(`ចែកលុយ ${people} នាក់`, `Split with ${people}`),
      share: `${L("ចែកលុយ", "Split")}: ${fmt(withTip, s.priceCur)} ÷ ${people} = ${fmt(each, s.priceCur)} (${other(each, s.priceCur)})`
    };
  }

  function fx() {
    const a = num(s.fxAmount);
    const out = s.fxDir === "USD" ? a * rate() : a / rate();
    return {
      body: `<div class="ct-box">
          <label class="ct-field"><small>${s.fxDir === "USD" ? L("ដុល្លារ", "Dollars") : L("រៀល", "Riel")}</small><span class="ct-in">${curBtn(s.fxDir, "data-ct-fxdir")}<input inputmode="decimal" type="number" min="0" step="any" placeholder="0" value="${escapeAttr(s.fxAmount)}" data-ct="fxAmount"></span></label>
          <div class="ct-chips">${(s.fxDir === "USD" ? [1, 5, 10, 20, 50, 100] : [1000, 5000, 10000, 20000, 50000, 100000]).map(v => `<button type="button" class="ct-chip" data-ct-fxq="${v}">${s.fxDir === "USD" ? `$${v}` : `៛${v.toLocaleString("en-US")}`}</button>`).join("")}</div>
          <label class="ct-field ct-rate"><small>${L("អត្រា $1 =", "Rate $1 =")}</small><span class="ct-in"><em>៛</em><input inputmode="numeric" type="number" min="1" step="1" value="${rate()}" data-ct-rate></span></label>
        </div>`,
      result: `<small>${s.fxDir === "USD" ? L("ជារៀល", "In riel") : L("ជាដុល្លារ", "In dollars")}</small><b class="ct-big">${s.fxDir === "USD" ? khr(out) : usd(out)}</b><span class="ct-sub"><span>${s.fxDir === "USD" ? usd(a) : khr(a)}</span><span>⇄ ${L("ចុច $ / ៛ ដើម្បីប្តូរ", "tap $ / ៛ to swap")}</span></span>`,
      amount: a, cur: s.fxDir, desc: L("ប្តូរប្រាក់", "Exchange")
    };
  }

  function basic() {
    let value = 0, bad = false;
    try { value = evaluate(s.expr); } catch (error) { bad = true; }
    const keys = ["C", "%", "⌫", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "$/៛", "0", ".", "="];
    return {
      body: `<div class="ct-screen"><span class="ct-expr">${escapeHtml(s.expr || "0")}</span><b class="ct-val">${bad ? "…" : fmt(value, s.priceCur)}</b><span class="ct-alt">≈ ${bad ? "…" : other(value, s.priceCur)}</span></div>
        <div class="ct-keys">${keys.map(k => `<button type="button" class="${/[÷×−+%⌫]/.test(k) ? "is-op" : k === "=" ? "is-eq" : ""}" data-ct-key="${escapeAttr(k)}">${k === "$/៛" ? (s.priceCur === "KHR" ? "៛" : "$") : k}</button>`).join("")}</div>`,
      result: "",
      amount: bad ? 0 : value, cur: s.priceCur, desc: L("គិតលេខ", "Calculation")
    };
  }

  const TABS = () => [["disc", "🏷️", L("បញ្ចុះ", "Discount")], ["split", "👥", L("ចែក", "Split")], ["fx", "💱", "$↔៛"], ["basic", "➗", L("គិត", "Calc")]];
  function view() { return tab === "split" ? split() : tab === "fx" ? fx() : tab === "basic" ? basic() : disc(); }

  function inner() {
    const v = view();
    return `<div class="ct-seg" role="tablist">${TABS().map(([id, icon, label]) => `<button type="button" role="tab" aria-selected="${tab === id}" class="${tab === id ? "is-on" : ""}" data-ct-tab="${id}"><span aria-hidden="true">${icon}</span>${escapeHtml(label)}</button>`).join("")}</div>
      ${v.body}
      ${v.result ? `<div class="ct-result">${v.result}</div>` : ""}
      <div class="ct-acts">
        <button type="button" class="ct-ghost" data-ct-copy>${v.share ? `✈️ ${L("ចែករំលែក", "Share")}` : `📋 ${L("ចម្លង", "Copy")}`}</button>
        <button type="button" class="ct-main" data-ct-expense ${v.amount > 0 ? "" : "disabled"}>＋ ${tab === "split" ? L("កត់ចំណែកខ្ញុំ", "Log my share") : L("កត់ជាចំណាយ", "Log as expense")}</button>
      </div>`;
  }

  function render() {
    return `<section class="page ct-page">
      <header class="ct-hero"><a class="ct-back" href="#launcher" aria-label="${escapeAttr(L("ត្រឡប់", "Back"))}">‹</a><span class="ct-hi"><span class="ct-ic" aria-hidden="true">🧮</span><span><b>${L("គិតលេខឆ្លាត", "Smart calculator")}</b><small>$1 = ៛${rate().toLocaleString("en-US")}</small></span></span></header>
      <div class="ct-panel" data-ct>${inner()}</div>
    </section>`;
  }

  function paint(focusAttr) {
    const panel = document.querySelector("[data-ct]");
    if (!panel) return;
    const active = document.activeElement?.getAttribute?.("data-ct") || focusAttr;
    const caret = document.activeElement?.selectionStart;
    panel.innerHTML = inner();
    const small = document.querySelector(".ct-hi small");
    if (small) small.textContent = `$1 = ៛${rate().toLocaleString("en-US")}`;
    if (active) {
      const input = panel.querySelector(`[data-ct="${active}"]`);
      if (input) { input.focus(); try { if (caret != null) input.setSelectionRange(caret, caret); } catch (error) { /* number inputs */ } }
    }
  }

  function bind() {
    const panel = document.querySelector("[data-ct]");
    if (!panel || panel.dataset.bound) return;
    panel.dataset.bound = "1";
    panel.addEventListener("input", event => {
      const field = event.target.closest("[data-ct]");
      if (field) { s[field.dataset.ct] = field.value; paintResult(); return; }
      if (event.target.closest("[data-ct-rate]")) {
        const v = Number(event.target.value);
        if (v > 0) { try { localStorage.setItem(RATE_KEY, String(v)); } catch (error) { /* ignore */ } }
        paintResult();
      }
    });
    panel.addEventListener("click", event => {
      const b = sel => event.target.closest(sel);
      if (b("[data-ct-tab]")) { tab = b("[data-ct-tab]").dataset.ctTab; try { localStorage.setItem(TAB_KEY, tab); } catch (error) { /* ignore */ } paint(); return; }
      if (b("[data-ct-pct]")) { s.pct = b("[data-ct-pct]").dataset.ctPct; paint(); return; }
      if (b("[data-ct-tax]")) { s.tax = !s.tax; paint(); return; }
      if (b("[data-ct-tip]")) { s.tip = Number(b("[data-ct-tip]").dataset.ctTip); paint(); return; }
      if (b("[data-ct-people]")) { s.people = Math.max(1, Math.min(50, s.people + Number(b("[data-ct-people]").dataset.ctPeople))); paint(); return; }
      if (b("[data-ct-pricecur]")) { s.priceCur = s.priceCur === "USD" ? "KHR" : "USD"; paint(); return; }
      if (b("[data-ct-fxdir]")) {
        const a = num(s.fxAmount);
        const out = s.fxDir === "USD" ? a * rate() : a / rate();
        s.fxDir = s.fxDir === "USD" ? "KHR" : "USD";
        if (a) s.fxAmount = String(s.fxDir === "KHR" ? Math.round(out) : Math.round(out * 100) / 100);
        paint(); return;
      }
      if (b("[data-ct-fxq]")) { s.fxAmount = b("[data-ct-fxq]").dataset.ctFxq; paint(); return; }
      if (b("[data-ct-key]")) { key(b("[data-ct-key]").dataset.ctKey); return; }
      if (b("[data-ct-copy]")) { copy(); return; }
      if (b("[data-ct-expense]")) logExpense();
    });
  }

  // update only the numbers while typing (keeps the keyboard open)
  function paintResult() {
    const panel = document.querySelector("[data-ct]");
    if (!panel) return;
    const v = view();
    const box = panel.querySelector(".ct-result");
    if (box) box.innerHTML = v.result;
    const btn = panel.querySelector("[data-ct-expense]");
    if (btn) btn.disabled = !(v.amount > 0);
    const small = document.querySelector(".ct-hi small");
    if (small) small.textContent = `$1 = ៛${rate().toLocaleString("en-US")}`;
  }

  function key(k) {
    if (k === "C") s.expr = "";
    else if (k === "⌫") s.expr = s.expr.slice(0, -1);
    else if (k === "$/៛") s.priceCur = s.priceCur === "USD" ? "KHR" : "USD";
    else if (k === "=") { try { const v = evaluate(s.expr); s.expr = String(Math.round(v * 100) / 100); } catch (error) { /* keep */ } }
    else s.expr += k;
    paint();
  }

  function copy() {
    const v = view();
    const text = v.share || `${fmt(v.amount, v.cur)} (${other(v.amount, v.cur)})`;
    if (navigator.share && v.share) { navigator.share({ text }).catch(() => {}); return; }
    (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => Toast.show(L("📋 បានចម្លង", "📋 Copied"), "success")).catch(() => Toast.show(text));
  }

  function logExpense() {
    const v = view();
    if (!(v.amount > 0)) return;
    const amount = v.cur === "KHR" ? Math.round(v.amount) : Math.round(v.amount * 100) / 100;
    if (typeof ExpenseForm !== "undefined") ExpenseForm.open({ amount, currency: v.cur, description: v.desc });
    else if (typeof openExpenseModal === "function") openExpenseModal();
  }

  return { render, bind, evaluate };
})();
