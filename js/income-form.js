/* MYLIFE income form (8 Nov 2026) — same look as the smart expense form (js/expense-form.js):
 * big amount with a $ / ៛ switch, a name that picks the type for you ("ប្រាក់ខែ 800" → Salary, $800),
 * colour type tiles, chips for when / how often / where the money goes, the two reminders as switches,
 * notes folded away. Saves the same fields as before: name, amount, currency, category, accountType,
 * frequency, nextPaymentDate, recurring, ask, notes. Reuses the event / expense form styles.
 */
const IncomeForm = (() => {
  const KEYWORDS = [
    { category: "Salary", re: /ប្រាក់ខែ|ខែ|salary|payroll|wage|paycheck/i },
    { category: "Bonus", re: /រង្វាន់|បុណ្យ|bonus|reward|gift|កាដូ|ប្រាក់លើក/i },
    { category: "Freelance", re: /freelance|ក្រៅម៉ោង|ការងារក្រៅ|design|project|client|គម្រោង|អតិថិជន/i },
    { category: "Business", re: /លក់|ហាង|អាជីវកម្ម|business|shop|sale|sell|store|online/i }
  ];
  const ICON = { Salary: "salary", Business: "chart", Freelance: "user", Bonus: "gift", Other: "money" };
  const FREQ = [["Once", "ម្ដង", "Once"], ["Weekly", "ប្រចាំសប្ដាហ៍", "Weekly"], ["Monthly", "ប្រចាំខែ", "Monthly"], ["Yearly", "ប្រចាំឆ្នាំ", "Yearly"]];
  const ACCOUNT = [["unspecified", "មិនបញ្ជាក់", "Not set"], ["cash", "សាច់ប្រាក់", "Cash"], ["bank", "ធនាគារ", "Bank"]];

  const km = () => languageCode() === "km";
  const L = (kmText, enText) => (km() ? kmText : enText);
  const today = () => localDateInput();
  const shift = days => {
    const date = new Date(`${today()}T00:00:00`);
    date.setDate(date.getDate() + days);
    return localDateInput(date);
  };
  const normalizeDigits = text => String(text || "").replace(/[០-៩]/g, ch => String("០១២៣៤៥៦៧៨៩".indexOf(ch)));
  let touched = new Set();

  function tiles(selected) {
    return incomeCategories.map(category => {
      const tone = incomeCategoryColors[category] || "#94a3b8";
      return `
      <label class="ev-cat" style="--tone:${tone};--tone-bg:color-mix(in srgb, ${tone} 16%, #ffffff)">
        <input type="radio" name="category" value="${escapeAttr(category)}" ${category === selected ? "checked" : ""}>
        <i class="ev-cat-icon">${(Icons[ICON[category]] || Icons.money)()}</i>
        <b>${escapeHtml(optionLabel(category))}</b>
      </label>`;
    }).join("");
  }

  const chips = (name, list, value) => list.map(([key, kmText, enText]) =>
    `<button type="button" class="ev-chip ${key === value ? "active" : ""}" data-if-pick="${name}" data-value="${key}">${escapeHtml(L(kmText, enText))}</button>`).join("");

  function render(item) {
    const isEdit = Boolean(item.id);
    const currency = item.currency || appData.profile.currency || "USD";
    const frequency = item.frequency || "Monthly";
    const account = item.accountType || "unspecified";
    const next = item.nextPaymentDate || "";
    const dateChips = [[today(), L("ថ្ងៃនេះ", "Today")], [shift(-1), L("ម្សិលមិញ", "Yesterday")]];
    const sw = (name, on, label, sub) => `
      <label class="if-switch">
        <span><b>${escapeHtml(label)}</b>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</span>
        <input type="checkbox" name="${name}" ${on ? "checked" : ""}><i aria-hidden="true"></i>
      </label>`;
    return `
      <form class="modal glass-card event-modal expense-modal income-modal" id="modalForm" novalidate>
        <div class="ev-head">
          <div class="ev-head-icon xp-head-icon if-head-icon">${Icons.salary()}</div>
          <h2 class="section-title">${isEdit ? t("editIncome") : t("addIncome")}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>

        <div class="xp-amount-card">
          <button type="button" class="xp-currency" data-xp-currency="${escapeAttr(currency)}" title="USD / KHR">${currency === "KHR" ? "៛" : "$"}</button>
          <input class="xp-amount" id="amount" name="amount" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${escapeAttr(item.amount ?? "")}" aria-label="${escapeAttr(t("amount"))}">
          <span class="xp-currency-name" data-xp-currency-name>${escapeHtml(currency)}</span>
        </div>
        <div class="field-error" data-error="amount"></div>

        <div class="ev-title-wrap">
          <input class="ev-title xp-desc" id="name" name="name" type="text" autocomplete="off" placeholder="${escapeAttr(L("ឧ. ប្រាក់ខែ 800 ឬ លក់អនឡាញ 50", "e.g. Salary 800 or Online sales 50"))}" value="${escapeAttr(item.name || "")}">
          <div class="ev-smart" data-if-smart><i>${Icons.spark()}</i><em data-if-smart-text>${escapeHtml(L("សរសេរឈ្មោះចំណូល — ខ្ញុំនឹងជ្រើសប្រភេទឱ្យ", "Name it — the type is picked for you"))}</em></div>
        </div>
        <div class="field-error" data-error="name"></div>

        <section class="ev-section">
          <div class="ev-label">${Icons.chart()}<strong>${escapeHtml(t("category"))}</strong></div>
          <div class="ev-cats xp-cats if-cats">${tiles(item.category || "Salary")}</div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.calendar()}<strong>${escapeHtml(t("nextPaymentDate"))}</strong><em class="ev-summary" data-if-when></em></div>
          <div class="ev-row">${dateChips.map(([value, label]) => `<button type="button" class="ev-chip" data-if-date="${value}">${escapeHtml(label)}</button>`).join("")}<input class="ev-date" id="nextPaymentDate" name="nextPaymentDate" type="date" value="${escapeAttr(next)}" aria-label="${escapeAttr(t("nextPaymentDate"))}"></div>
          <div class="ev-label if-sub">${Icons.today()}<strong>${escapeHtml(t("frequency"))}</strong></div>
          <div class="ev-row">${chips("frequency", FREQ, frequency)}</div>
          <input type="hidden" name="frequency" value="${escapeAttr(frequency)}">
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.wallet()}<strong>${escapeHtml(L("ចូលគណនី", "Goes to"))}</strong></div>
          <div class="ev-row">${chips("accountType", ACCOUNT, account)}</div>
          <input type="hidden" name="accountType" value="${escapeAttr(account)}">
        </section>

        <section class="ev-section if-switches">
          ${sw("recurring", item.recurring ?? true, t("recurring"), L("បង្កើតម្ដងទៀតដោយស្វ័យប្រវត្តិ", "Repeats on its own"))}
          ${sw("ask", item.ask ?? true, L("សួរ “បានទទួលហើយឬនៅ?”", "Ask “got it yet?”"), L("ពេលដល់ថ្ងៃ ខ្ញុំនឹងសួរ មុនរាប់ចូលលុយ", "On the day, I'll ask before counting it"))}
        </section>

        <details class="ev-notes" ${item.notes ? "open" : ""}>
          <summary>${Icons.edit()}<strong>${escapeHtml(item.notes ? t("notes") : L("បន្ថែមកំណត់ចំណាំ", "Add notes"))}</strong></summary>
          <textarea id="notes" name="notes" rows="3" placeholder="${escapeAttr(L("ពីណា ឬព័ត៌មានបន្ថែម…", "From who, extra details…"))}">${escapeHtml(item.notes || "")}</textarea>
        </details>

        <div class="ev-foot">
          <small class="ev-shortcut">${escapeHtml(L("Ctrl + Enter ដើម្បីរក្សាទុក", "Ctrl + Enter to save"))}</small>
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit">${Icons.check()}${isEdit ? t("saveIncome") : t("addIncome")}</button>
        </div>
      </form>`;
  }

  function sync(root) {
    const form = root.querySelector("#modalForm");
    const date = form.elements.nextPaymentDate.value;
    root.querySelectorAll("[data-if-date]").forEach(chip => chip.classList.toggle("active", chip.dataset.ifDate === date));
    ["frequency", "accountType"].forEach(name => {
      const value = form.elements[name].value;
      root.querySelectorAll(`[data-if-pick="${name}"]`).forEach(chip => chip.classList.toggle("active", chip.dataset.value === value));
    });
    const when = root.querySelector("[data-if-when]");
    if (when) when.textContent = date ? formatDate(date) : "";
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

  // "ប្រាក់ខែ 800" → Salary + $800 · "លក់ 50k" → Business + 50,000៛
  function smart(root) {
    const form = root.querySelector("#modalForm");
    const text = normalizeDigits(form.elements.name.value);
    const found = [];
    const keyword = KEYWORDS.find(entry => entry.re.test(text));
    if (keyword && !touched.has("category")) {
      const radio = form.querySelector(`input[name="category"][value="${keyword.category}"]`);
      if (radio && !radio.checked) { radio.checked = true; flash(radio.closest("label")); }
      found.push(optionLabel(keyword.category));
    }
    const number = text.match(/(\d+(?:[.,]\d+)?)\s*(\$|usd|៛|khr|riel|រៀល|k(?![a-z]))?/i);
    if (number && !touched.has("amount")) {
      let amount = Number(number[1].replace(",", "."));
      const unit = String(number[2] || "").toLowerCase();
      let currency = "";
      if (unit === "k") { amount *= 1000; currency = "KHR"; }
      else if (/៛|khr|riel|រៀល/.test(unit)) currency = "KHR";
      else if (/\$|usd/.test(unit)) currency = "USD";
      else if (amount >= 10000) currency = "KHR";
      if (amount > 0) {
        form.elements.amount.value = amount;
        flash(form.elements.amount);
        if (currency) setCurrency(root, currency);
        found.push(`${currency === "KHR" ? "" : "$"}${amount.toLocaleString("en-US")}${currency === "KHR" ? "៛" : ""}`);
      }
    }
    const box = root.querySelector("[data-if-smart]");
    const label = root.querySelector("[data-if-smart-text]");
    box.classList.toggle("is-found", found.length > 0);
    label.textContent = found.length ? `${L("បានស្គាល់", "Picked up")}: ${found.join(" · ")}` : L("សរសេរឈ្មោះចំណូល — ខ្ញុំនឹងជ្រើសប្រភេទឱ្យ", "Name it — the type is picked for you");
  }

  function open(item) {
    item = item || {};
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = render(item);
    root.classList.add("open");
    touched = new Set(item.id ? ["category", "amount"] : [item.category && "category", item.amount && "amount"].filter(Boolean));

    const form = root.querySelector("#modalForm");
    Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));

    root.querySelector("[data-xp-currency]").addEventListener("click", () => {
      const current = root.querySelector("[data-xp-currency]").dataset.xpCurrency;
      setCurrency(root, current === "KHR" ? "USD" : "KHR");
    });
    form.elements.amount.addEventListener("input", () => {
      touched.add("amount");
      root.querySelector('[data-error="amount"]').textContent = "";
    });
    let timer;
    form.elements.name.addEventListener("input", () => {
      root.querySelector('[data-error="name"]').textContent = "";
      clearTimeout(timer);
      timer = setTimeout(() => smart(root), 220);
    });
    form.querySelectorAll('input[name="category"]').forEach(input => input.addEventListener("change", () => touched.add("category")));
    root.querySelectorAll("[data-if-date]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.nextPaymentDate.value = form.elements.nextPaymentDate.value === chip.dataset.ifDate ? "" : chip.dataset.ifDate;
      sync(root);
    }));
    form.elements.nextPaymentDate.addEventListener("change", () => sync(root));
    root.querySelectorAll("[data-if-pick]").forEach(chip => chip.addEventListener("click", () => {
      form.elements[chip.dataset.ifPick].value = chip.dataset.value;
      if (chip.dataset.ifPick === "frequency" && chip.dataset.value === "Once") form.elements.recurring.checked = false;
      sync(root);
    }));
    const details = root.querySelector(".ev-notes");
    details.addEventListener("toggle", () => { if (details.open) setTimeout(() => form.elements.notes.focus(), 30); });
    form.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); form.requestSubmit(); }
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
        // "ប្រាក់ខែ 850" → name "ប្រាក់ខែ" (the amount already went into the amount box)
        name: (normalizeDigits(form.elements.name.value).trim().replace(/\s*\d+(?:[.,]\d+)?\s*(\$|usd|៛|khr|riel|រៀល|k)?\s*$/i, "").trim()) || form.elements.name.value.trim() || optionLabel(category),
        amount,
        currency: root.querySelector("[data-xp-currency]").dataset.xpCurrency || appData.profile.currency || "USD",
        category,
        accountType: form.elements.accountType.value || "unspecified",
        frequency: form.elements.frequency.value || "Monthly",
        nextPaymentDate: form.elements.nextPaymentDate.value || "",
        recurring: form.elements.recurring.checked,
        ask: form.elements.ask.checked,
        notes: form.elements.notes.value.trim()
      };
      if (item.id) Store.edit("income", item.id, record);
      else Store.add("income", record);
      Toast.show(item.id ? t("incomeSaved") : t("incomeAdded"));
      Modal.close();
    });

    sync(root);
    if (!item.id) setTimeout(() => form.elements.amount.focus(), 60);
  }

  return { open };
})();
