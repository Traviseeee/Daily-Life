/* MYLIFE smart expense form.
 * Big amount with a $ / ៛ switch, colour category chips, quick date and
 * payment-method chips, and a description that picks the category for you
 * ("កាហ្វេ 2.5" → Food, $2.5). Shows the category's budget as you go.
 * Saves the same fields as before: description, amount, currency, category,
 * date, method, notes. Reuses the event form styles (.event-modal).
 */
const ExpenseForm = (() => {
  const KEYWORDS = [
    { category: "Food", re: /អាហារ|ញ៉ាំ|បាយ|កាហ្វេ|ភេសជ្ជៈ|តែ|នំ|food|eat|lunch|dinner|breakfast|coffee|drink|meal|snack|tea/i },
    { category: "Transport", re: /សាំង|ឡាន|ម៉ូតូ|តាក់ស៊ី|grab|passapp|ធ្វើដំណើរ|transport|fuel|gas|taxi|bus|parking|tuk/i },
    { category: "Shopping", re: /ទិញ|ខោអាវ|ផ្សារ|shopping|shop|clothes|shoes|amazon|mall/i },
    { category: "Home", re: /ផ្ទះ|ជួល|home|house|rent|furniture|repair/i },
    { category: "Family", re: /គ្រួសារ|កូន|ម៉ាក់|ប៉ា|family|kid|mom|dad|gift|កាដូ/i },
    { category: "Bills", re: /វិក្កយបត្រ|ថ្លៃទឹក|ថ្លៃភ្លើង|អ៊ីនធឺណិត|ទូរស័ព្ទ|កាតទូរស័ព្ទ|bill|electric|water|internet|phone|edc/i },
    { category: "Education", re: /សាលា|សៀវភៅ|វគ្គ|រៀន|school|book|course|class|education|tuition/i },
    { category: "Health", re: /ពេទ្យ|ថ្នាំ|មន្ទីរពេទ្យ|health|doctor|medicine|hospital|gym|clinic|pharmacy/i },
    { category: "Entertainment", re: /កុន|ហ្គេម|កម្សាន្ត|movie|game|netflix|spotify|fun|party|cinema|entertainment/i }
  ];
  const METHODS = ["Cash", "ABA", "ACLEDA", "Wing", "Card"];
  const METHOD_KM = { Cash: "សាច់ប្រាក់", Card: "កាត" };

  // same words as the Telegram bot and MYLIFE Chat (js/smart-parse.js); the short list above is the fallback
  const findKeyword = text => {
    const shared = typeof SmartParse !== "undefined" && SmartParse.categorizeExpense ? SmartParse.categorizeExpense(text) : "";
    if (shared) return { category: shared };
    return typeof SmartParse !== "undefined" && SmartParse.categorizeExpense ? null : KEYWORDS.find(entry => entry.re.test(text));
  };

  let touched = new Set();

  const km = () => languageCode() === "km";
  const L = (kmText, enText) => (km() ? kmText : enText);
  const today = () => localDateInput();
  const shift = days => {
    const date = new Date(`${today()}T00:00:00`);
    date.setDate(date.getDate() + days);
    return localDateInput(date);
  };
  const normalizeDigits = text => String(text || "").replace(/[០-៩]/g, ch => String("០១២៣៤៥៦៧៨៩".indexOf(ch)));

  function categoryChips(selected) {
    return expenseCategories.map(category => `
      <label class="ev-cat" style="--tone:${expenseCategoryColors[category]};--tone-bg:color-mix(in srgb, ${expenseCategoryColors[category]} 16%, #ffffff)">
        <input type="radio" name="category" value="${escapeAttr(category)}" ${category === selected ? "checked" : ""}>
        <i class="ev-cat-icon">${Icons[expenseCategoryIcons[category] || "expense"]()}</i>
        <b>${escapeHtml(optionLabel(category))}</b>
      </label>`).join("");
  }

  function render(item) {
    const isEdit = Boolean(item.id);
    const currency = item.currency || appData.profile.currency || "USD";
    const method = item.method || "";
    const date = item.date || today();
    const dateChips = [[today(), L("ថ្ងៃនេះ", "Today")], [shift(-1), L("ម្សិលមិញ", "Yesterday")], [shift(-2), L("ម្សិលម្ងៃ", "2 days ago")]];
    const knownMethod = METHODS.includes(method);
    return `
      <form class="modal glass-card event-modal expense-modal" id="modalForm" novalidate>
        <div class="ev-head">
          <div class="ev-head-icon xp-head-icon">${Icons.expense()}</div>
          <h2 class="section-title">${isEdit ? `${t("edit")} ${t("expense")}` : t("addExpense")}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>

        <div class="xp-amount-card">
          <button type="button" class="xp-currency" data-xp-currency="${escapeAttr(currency)}" title="USD / KHR">${currency === "KHR" ? "៛" : "$"}</button>
          <input class="xp-amount" id="amount" name="amount" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${escapeAttr(item.amount ?? "")}" aria-label="${escapeAttr(t("amount"))}">
          <span class="xp-currency-name" data-xp-currency-name>${escapeHtml(currency)}</span>
        </div>
        <div class="field-error" data-error="amount"></div>

        <div class="ev-title-wrap">
          <input class="ev-title xp-desc" id="description" name="description" type="text" autocomplete="off" placeholder="${escapeAttr(L("ឧ. កាហ្វេ 2.5 ឬ សាំង 15000", "e.g. Coffee 2.5 or Grab 15000"))}" value="${escapeAttr(item.description || "")}">
          <div class="ev-smart" data-xp-smart><i>${Icons.spark()}</i><em data-xp-smart-text>${escapeHtml(L("សរសេរអ្វីដែលបានចាយ — ខ្ញុំនឹងជ្រើសប្រភេទឱ្យ", "Describe it — the category is picked for you"))}</em></div>
        </div>

        <section class="ev-section">
          <div class="ev-label">${Icons.chart()}<strong>${escapeHtml(t("category"))}</strong><em class="ev-summary" data-xp-budget></em></div>
          <div class="ev-cats xp-cats">${categoryChips(item.category || "Food")}</div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.calendar()}<strong>${escapeHtml(t("date"))}</strong><em class="ev-summary" data-xp-when></em></div>
          <div class="ev-row">${dateChips.map(([value, label]) => `<button type="button" class="ev-chip" data-xp-date="${value}">${escapeHtml(label)}</button>`).join("")}<input class="ev-date" id="date" name="date" type="date" value="${escapeAttr(date)}" aria-label="${escapeAttr(t("date"))}"></div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.wallet()}<strong>${escapeHtml(t("paymentMethod"))}</strong></div>
          <div class="ev-row">
            ${METHODS.map(value => `<button type="button" class="ev-chip" data-xp-method="${value}">${escapeHtml(km() ? METHOD_KM[value] || value : value)}</button>`).join("")}
            <input class="ev-date xp-method" id="method" name="method" type="text" maxlength="40" placeholder="${escapeAttr(L("ផ្សេងទៀត…", "Other…"))}" value="${escapeAttr(knownMethod ? "" : method)}" data-xp-method-input>
          </div>
          <input type="hidden" name="methodChoice" value="${escapeAttr(knownMethod ? method : "")}">
        </section>

        <details class="ev-notes" ${item.notes ? "open" : ""}>
          <summary>${Icons.edit()}<strong>${escapeHtml(item.notes ? t("notes") : L("បន្ថែមកំណត់ចំណាំ", "Add notes"))}</strong></summary>
          <textarea id="notes" name="notes" rows="3" placeholder="${escapeAttr(L("ទីកន្លែង ឬព័ត៌មានបន្ថែម…", "Where, why, extra details…"))}">${escapeHtml(item.notes || "")}</textarea>
        </details>

        <div class="ev-foot">
          <small class="ev-shortcut">${escapeHtml(L("Ctrl + Enter ដើម្បីរក្សាទុក", "Ctrl + Enter to save"))}</small>
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit">${Icons.check()}${isEdit ? `${t("save")} ${t("expense")}` : t("addExpense")}</button>
        </div>
      </form>`;
  }

  function sync(root) {
    const form = root.querySelector("#modalForm");
    const category = form.querySelector('input[name="category"]:checked')?.value;
    const date = form.elements.date.value;
    const method = form.elements.methodChoice.value;

    root.querySelectorAll("[data-xp-date]").forEach(chip => chip.classList.toggle("active", chip.dataset.xpDate === date));
    root.querySelectorAll("[data-xp-method]").forEach(chip => chip.classList.toggle("active", chip.dataset.xpMethod === method));
    form.elements.method.classList.toggle("has-value", Boolean(form.elements.method.value.trim()));

    const when = root.querySelector("[data-xp-when]");
    if (when) when.textContent = date ? formatDate(date) : "";

    const budgetEl = root.querySelector("[data-xp-budget]");
    if (budgetEl && typeof SmartMoney !== "undefined" && category) {
      const status = SmartMoney.budgetStatus(category);
      const currency = form.querySelector("[data-xp-currency]").dataset.xpCurrency;
      const adding = toProfileCurrency(Number(form.elements.amount.value || 0), currency);
      if (status.budget) {
        const after = status.spent + adding;
        const percent = Math.round((after / status.budget) * 100);
        const fmt = value => rielText(new Intl.NumberFormat("en-US", { style: "currency", currency: appData.profile.currency || "USD", maximumFractionDigits: 0 }).format(value));
        budgetEl.textContent = `${L("ថវិកា", "Budget")} ${percent}% · ${after <= status.budget ? `${L("នៅសល់", "left")} ${fmt(status.budget - after)}` : `${L("លើស", "over")} ${fmt(after - status.budget)}`}`;
        budgetEl.dataset.level = percent >= 100 ? "over" : percent >= 80 ? "warn" : "ok";
      } else {
        budgetEl.textContent = "";
        budgetEl.dataset.level = "";
      }
    }
  }

  function smart(root) {
    const form = root.querySelector("#modalForm");
    const text = normalizeDigits(form.elements.description.value);
    const found = [];
    const keyword = findKeyword(text);
    if (keyword && !touched.has("category")) {
      const radio = form.querySelector(`input[name="category"][value="${keyword.category}"]`);
      if (radio && !radio.checked) {
        radio.checked = true;
        flash(radio.closest("label"));
      }
      found.push(optionLabel(keyword.category));
    }
    const number = text.match(/(\d+(?:[.,]\d+)?)\s*(\$|usd|៛|khr|riel|រៀល|k(?![a-z]))?/i);
    if (number && !touched.has("amount")) {
      let amount = Number(number[1].replace(",", "."));
      const unit = String(number[2] || "").toLowerCase();
      let currency = "";
      if (unit === "k") {
        amount *= 1000;
        currency = "KHR";
      } else if (/៛|khr|riel|រៀល/.test(unit)) currency = "KHR";
      else if (/\$|usd/.test(unit)) currency = "USD";
      else if (amount >= 500) currency = "KHR";
      if (amount > 0) {
        form.elements.amount.value = amount;
        flash(form.elements.amount);
        if (currency) setCurrency(root, currency);
        found.push(`${currency === "KHR" ? "" : "$"}${amount.toLocaleString("en-US")}${currency === "KHR" ? "៛" : ""}`);
      }
    }
    const box = root.querySelector("[data-xp-smart]");
    const label = root.querySelector("[data-xp-smart-text]");
    if (found.length) {
      box.classList.add("is-found");
      label.textContent = `${L("បានស្គាល់", "Picked up")}: ${found.join(" · ")}`;
    } else {
      box.classList.remove("is-found");
      label.textContent = L("សរសេរអ្វីដែលបានចាយ — ខ្ញុំនឹងជ្រើសប្រភេទឱ្យ", "Describe it — the category is picked for you");
    }
    sync(root);
  }

  function setCurrency(root, currency) {
    const button = root.querySelector("[data-xp-currency]");
    button.dataset.xpCurrency = currency;
    button.textContent = currency === "KHR" ? "៛" : "$";
    root.querySelector("[data-xp-currency-name]").textContent = currency;
  }

  function flash(el) {
    if (!el) return;
    el.classList.remove("ev-flash");
    void el.offsetWidth;
    el.classList.add("ev-flash");
  }

  function open(item) {
    item = item || {};
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = render(item);
    root.classList.add("open");
    touched = new Set(item.id ? ["category", "amount"] : [item.category && "category", item.amount && "amount"].filter(Boolean));

    const form = root.querySelector("#modalForm");
    Modal.escapeHandler = event => {
      if (event.key === "Escape") Modal.close();
    };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));

    root.querySelector("[data-xp-currency]").addEventListener("click", () => {
      const current = root.querySelector("[data-xp-currency]").dataset.xpCurrency;
      setCurrency(root, current === "KHR" ? "USD" : "KHR");
      sync(root);
    });
    form.elements.amount.addEventListener("input", () => {
      touched.add("amount");
      root.querySelector('[data-error="amount"]').textContent = "";
      sync(root);
    });
    let timer;
    form.elements.description.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => smart(root), 220);
    });
    form.querySelectorAll('input[name="category"]').forEach(input => input.addEventListener("change", () => {
      touched.add("category");
      sync(root);
    }));
    root.querySelectorAll("[data-xp-date]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.date.value = chip.dataset.xpDate;
      sync(root);
    }));
    form.elements.date.addEventListener("change", () => sync(root));
    root.querySelectorAll("[data-xp-method]").forEach(chip => chip.addEventListener("click", () => {
      const same = form.elements.methodChoice.value === chip.dataset.xpMethod;
      form.elements.methodChoice.value = same ? "" : chip.dataset.xpMethod;
      if (!same) form.elements.method.value = "";
      sync(root);
    }));
    form.elements.method.addEventListener("input", () => {
      if (form.elements.method.value.trim()) form.elements.methodChoice.value = "";
      sync(root);
    });
    const details = root.querySelector(".ev-notes");
    details.addEventListener("toggle", () => {
      if (details.open) setTimeout(() => form.elements.notes.focus(), 30);
    });
    form.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", event => {
      event.preventDefault();
      const amount = Number(form.elements.amount.value || 0);
      if (!amount || amount < 0) {
        root.querySelector('[data-error="amount"]').textContent = t("required");
        form.elements.amount.focus();
        flash(root.querySelector(".xp-amount-card"));
        return;
      }
      const category = form.querySelector('input[name="category"]:checked')?.value || "Other";
      const record = {
        description: form.elements.description.value.trim() || optionLabel(category),
        amount,
        currency: root.querySelector("[data-xp-currency]").dataset.xpCurrency || appData.profile.currency || "USD",
        category,
        date: form.elements.date.value || today(),
        method: form.elements.methodChoice.value || form.elements.method.value.trim(),
        notes: form.elements.notes.value.trim()
      };
      if (item.id) Store.edit("expenses", item.id, record);
      else Store.add("expenses", record);
      Toast.show(item.id ? t("expenseSaved") : t("expenseAdded"));
      Modal.close();
    });

    sync(root);
    if (!item.id) setTimeout(() => form.elements.amount.focus(), 60);
  }

  // "Grab 15k" → { amount: 15000, currency: "KHR", category: "Transport", description: "Grab" } (used by the chat)
  function parseExpense(raw) {
    const text = normalizeDigits(raw);
    const keyword = findKeyword(text);
    const number = text.match(/(\d+(?:[.,]\d+)?)\s*(\$|usd|៛|khr|riel|រៀល|k(?![a-z]))?/i);
    let amount = 0;
    let currency = "";
    if (number) {
      amount = Number(number[1].replace(",", "."));
      const unit = String(number[2] || "").toLowerCase();
      if (unit === "k") { amount *= 1000; currency = "KHR"; }
      else if (/៛|khr|riel|រៀល/.test(unit)) currency = "KHR";
      else if (/\$|usd/.test(unit)) currency = "USD";
      else if (amount >= 500) currency = "KHR";
    }
    const description = text
      .replace(number ? number[0] : "", "")
      .replace(/^(ចាយ|ចំណាយ|spent|spend|pay|paid|ទិញ)\s*/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { amount, currency: currency || appData.profile.currency || "USD", category: keyword?.category || "Other", description };
  }

  return { open, parseExpense };
})();
