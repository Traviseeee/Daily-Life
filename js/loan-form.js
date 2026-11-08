/* MYLIFE loan form (8 Nov 2026) — same look as the smart expense / income forms:
 * big amount with a $ / ៛ switch, the loan name, a repayment card (rate · months · monthly payment)
 * with quick month chips and the existing smart suggestion (bindLoanSmartFill), payment-method chips,
 * dates with quick chips, the "paid yet?" reminder as a switch, notes folded away.
 * Saves through saveLoanRecord() in js/money.js — the same fields and maths as before.
 */
const LoanForm = (() => {
  const METHODS = [["unspecified", "មិនបញ្ជាក់", "Not set"], ["cash", "សាច់ប្រាក់", "Cash"], ["bank", "ផ្ទេរធនាគារ", "Bank"], ["qr", "បង់ QR", "QR"], ["other", "ផ្សេងៗ", "Other"]];
  const MONTHS = [12, 24, 36, 60, 120];

  const km = () => languageCode() === "km";
  const L = (kmText, enText) => (km() ? kmText : enText);
  const today = () => localDateInput();
  const shift = days => {
    const date = new Date(`${today()}T00:00:00`);
    date.setDate(date.getDate() + days);
    return localDateInput(date);
  };

  const box = (name, label, value, attrs = "") => `
    <div class="field lf-box"><label for="${name}">${escapeHtml(label)}</label>
      <input id="${name}" name="${name}" type="number" min="0" step="any" inputmode="decimal" value="${escapeAttr(value ?? "")}" ${attrs}></div>`;

  function render(item) {
    const isEdit = Boolean(item.id);
    const currency = item.currency || appData.profile.currency || "USD";
    const method = item.paymentType || "unspecified";
    const first = normalizeLoanPaymentDate(item.firstPaymentDate || item.startDate) || "";
    const dayValue = item.id ? (item.paymentDay || loanPaymentDay(item)) : "";
    return `
      <form class="modal glass-card event-modal expense-modal loan-modal" id="modalForm" novalidate>
        <div class="ev-head">
          <div class="ev-head-icon xp-head-icon">${Icons.loan()}</div>
          <h2 class="section-title">${isEdit ? t("editLoan") : t("addLoan")}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>

        <div class="xp-amount-card">
          <button type="button" class="xp-currency" data-xp-currency="${escapeAttr(currency)}" title="USD / KHR">${currency === "KHR" ? "៛" : "$"}</button>
          <input class="xp-amount" id="originalAmount" name="originalAmount" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${escapeAttr(item.originalAmount ?? "")}" aria-label="${escapeAttr(t("originalAmount"))}">
          <span class="xp-currency-name" data-xp-currency-name>${escapeHtml(currency)}</span>
        </div>
        <input type="hidden" name="currency" value="${escapeAttr(currency)}">
        <div class="field-error" data-error="originalAmount"></div>

        <div class="ev-title-wrap">
          <input class="ev-title xp-desc" id="name" name="name" type="text" autocomplete="off" placeholder="${escapeAttr(L("ឧ. កម្ចីផ្ទះ ABA ឬ ម៉ូតូ", "e.g. House loan ABA or Motorbike"))}" value="${escapeAttr(item.name || "")}">
        </div>
        <div class="field-error" data-error="name"></div>

        <section class="ev-section">
          <div class="ev-label">${Icons.chart()}<strong>${escapeHtml(L("ផែនការសងប្រាក់", "Repayment plan"))}</strong></div>
          <div class="lf-grid">
            ${box("interestRate", L("ការប្រាក់ %/ឆ្នាំ", "Interest %/yr"), item.interestRate || "")}
            ${box("durationMonths", L("រយៈពេល (ខែ)", "Months"), item.durationMonths || "", 'step="1"')}
          </div>
          <div class="ev-row lf-months">${MONTHS.map(n => `<button type="button" class="ev-chip" data-lf-months="${n}">${n % 12 === 0 ? escapeHtml(L(`${n / 12} ឆ្នាំ`, `${n / 12} yr`)) : n}</button>`).join("")}</div>
          ${box("monthlyPayment", t("monthlyPayment"), item.monthlyPayment || "")}
          <div class="ev-label if-sub">${Icons.wallet()}<strong>${escapeHtml(L("វិធីបង់កម្ចី", "Pay by"))}</strong></div>
          <div class="ev-row">${METHODS.map(([key, kmText, enText]) => `<button type="button" class="ev-chip" data-lf-method="${key}">${escapeHtml(L(kmText, enText))}</button>`).join("")}</div>
          <input type="hidden" name="paymentType" value="${escapeAttr(method)}">
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.calendar()}<strong>${escapeHtml(t("firstPaymentDate"))}</strong><em class="ev-summary" data-lf-when></em></div>
          <div class="ev-row">
            <button type="button" class="ev-chip" data-lf-date="${today()}">${escapeHtml(L("ថ្ងៃនេះ", "Today"))}</button>
            <button type="button" class="ev-chip" data-lf-date="${shift(-1)}">${escapeHtml(L("ម្សិលមិញ", "Yesterday"))}</button>
            <input class="ev-date" id="firstPaymentDate" name="firstPaymentDate" type="date" value="${escapeAttr(first)}" aria-label="${escapeAttr(t("firstPaymentDate"))}">
          </div>
          <div class="lf-grid lf-dates">
            ${box("paymentDay", t("paymentDay"), dayValue, 'step="1" max="31"')}
            <div class="field lf-box"><label for="dueDate">${escapeHtml(t("dueDate"))}</label><input id="dueDate" name="dueDate" type="date" value="${escapeAttr(item.dueDate || "")}"></div>
          </div>
        </section>

        <section class="ev-section if-switches">
          <label class="if-switch">
            <span><b>${escapeHtml(L("សួរ “បានបង់ហើយឬនៅ?”", "Ask “paid yet?”"))}</b><small>${escapeHtml(L("ពេលដល់ថ្ងៃបង់ ខ្ញុំនឹងសួរ", "On the due day, I'll ask"))}</small></span>
            <input type="checkbox" name="ask" ${(item.ask ?? true) ? "checked" : ""}><i aria-hidden="true"></i>
          </label>
        </section>

        <details class="ev-notes" ${item.notes ? "open" : ""}>
          <summary>${Icons.edit()}<strong>${escapeHtml(item.notes ? t("notes") : L("បន្ថែមកំណត់ចំណាំ", "Add notes"))}</strong></summary>
          <textarea id="notes" name="notes" rows="3" placeholder="${escapeAttr(L("ធនាគារ លេខកុង ឬព័ត៌មានបន្ថែម…", "Bank, account no. or extra details…"))}">${escapeHtml(item.notes || "")}</textarea>
        </details>

        <div class="ev-foot">
          <small class="ev-shortcut">${escapeHtml(L("Ctrl + Enter ដើម្បីរក្សាទុក", "Ctrl + Enter to save"))}</small>
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit">${Icons.check()}${isEdit ? t("saveLoan") : t("addLoan")}</button>
        </div>
      </form>`;
  }

  function sync(root) {
    const form = root.querySelector("#modalForm");
    const first = form.elements.firstPaymentDate.value;
    root.querySelectorAll("[data-lf-date]").forEach(chip => chip.classList.toggle("active", chip.dataset.lfDate === first));
    root.querySelectorAll("[data-lf-months]").forEach(chip => chip.classList.toggle("active", chip.dataset.lfMonths === form.elements.durationMonths.value));
    root.querySelectorAll("[data-lf-method]").forEach(chip => chip.classList.toggle("active", chip.dataset.lfMethod === form.elements.paymentType.value));
    const when = root.querySelector("[data-lf-when]");
    if (when) when.textContent = first ? formatDate(first) : "";
  }

  function flash(el) {
    if (!el) return;
    el.classList.remove("ev-flash");
    void el.offsetWidth;
    el.classList.add("ev-flash");
  }

  const fire = (input, type = "input") => input && input.dispatchEvent(new Event(type, { bubbles: true }));

  function open(item) {
    const original = item || null;
    item = item || {};
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = render(item);
    root.classList.add("open");
    const form = root.querySelector("#modalForm");
    Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));

    root.querySelector("[data-xp-currency]").addEventListener("click", () => {
      const button = root.querySelector("[data-xp-currency]");
      const next = button.dataset.xpCurrency === "KHR" ? "USD" : "KHR";
      button.dataset.xpCurrency = next;
      button.textContent = next === "KHR" ? "៛" : "$";
      root.querySelector("[data-xp-currency-name]").textContent = next;
      form.elements.currency.value = next;
      fire(form.elements.currency, "change");
    });
    form.elements.originalAmount.addEventListener("input", () => { root.querySelector('[data-error="originalAmount"]').textContent = ""; });
    form.elements.name.addEventListener("input", () => { root.querySelector('[data-error="name"]').textContent = ""; });
    root.querySelectorAll("[data-lf-months]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.durationMonths.value = chip.dataset.lfMonths;
      fire(form.elements.durationMonths);
      sync(root);
    }));
    form.elements.durationMonths.addEventListener("input", () => sync(root));
    root.querySelectorAll("[data-lf-method]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.paymentType.value = chip.dataset.lfMethod;
      sync(root);
    }));
    root.querySelectorAll("[data-lf-date]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.firstPaymentDate.value = chip.dataset.lfDate;
      fire(form.elements.firstPaymentDate);
      fire(form.elements.firstPaymentDate, "change");
      sync(root);
    }));
    form.elements.firstPaymentDate.addEventListener("change", () => sync(root));
    const details = root.querySelector(".ev-notes");
    details.addEventListener("toggle", () => { if (details.open) setTimeout(() => form.elements.notes.focus(), 30); });
    form.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); form.requestSubmit(); }
    });

    form.addEventListener("submit", event => {
      event.preventDefault();
      if (!Number(form.elements.originalAmount.value || 0)) {
        root.querySelector('[data-error="originalAmount"]').textContent = t("required");
        form.elements.originalAmount.focus();
        flash(root.querySelector(".xp-amount-card"));
        return;
      }
      if (!form.elements.name.value.trim()) {
        root.querySelector('[data-error="name"]').textContent = t("required");
        form.elements.name.focus();
        return;
      }
      const data = Object.fromEntries(new FormData(form).entries());
      data.name = data.name.trim();
      data.notes = (data.notes || "").trim();
      data.ask = form.elements.ask.checked;
      saveLoanRecord(original, data);
      Modal.close();
    });

    // the smart suggestion under the monthly payment (same as the old form)
    if (typeof bindLoanSmartFill === "function") bindLoanSmartFill();
    sync(root);
    if (!item.id) setTimeout(() => form.elements.originalAmount.focus(), 60);
  }

  return { open };
})();
