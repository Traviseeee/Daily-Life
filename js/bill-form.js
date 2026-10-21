/* MYLIFE bill form.
 * Big amount with a $ / ៛ switch, quick picks (EDC, PPWSA, Wi-Fi…), due-date
 * chips with "in N days", frequency and category chips, and two clear switches
 * (reminder, auto-pay). Saves the same fields as the old form: name, amount,
 * currency, frequency, due, category, reminder, autoPay, status, notes.
 * Reuses the event/expense form styles (.event-modal, .expense-modal).
 */
const BillForm = (() => {
  const FREQUENCIES = ["Weekly", "Monthly", "Quarterly", "Yearly"];
  const STATUSES = ["Upcoming", "Paid", "Overdue"];
  const CATEGORIES = [
    { value: "Utilities", emoji: "⚡", km: "ទឹក · ភ្លើង", en: "Utilities", tone: "#f0a530" },
    { value: "Internet", emoji: "🌐", km: "អ៊ីនធឺណិត", en: "Internet", tone: "#2aa3df" },
    { value: "Phone", emoji: "📱", km: "ទូរស័ព្ទ", en: "Phone", tone: "#7c6cf0" },
    { value: "Rent", emoji: "🏠", km: "ថ្លៃជួល", en: "Rent", tone: "#e0705a" },
    { value: "Subscription", emoji: "🎬", km: "សេវាប្រចាំខែ", en: "Apps · TV", tone: "#d94f8a" },
    { value: "Insurance", emoji: "🛡️", km: "ធានារ៉ាប់រង", en: "Insurance", tone: "#3f9d76" },
    { value: "Loan", emoji: "🏦", km: "កម្ចី", en: "Loan", tone: "#5b7f95" },
    { value: "Other", emoji: "🧾", km: "ផ្សេងៗ", en: "Other", tone: "#8a948f" }
  ];
  // name stays matchable by the Telegram PPWSA/EDC bots (lib/utility-bills.js)
  const PICKS = [
    { emoji: "⚡", km: "ភ្លើង EDC", en: "EDC", name: "Electricity (EDC)", category: "Utilities", currency: "KHR" },
    { emoji: "💧", km: "ទឹក PPWSA", en: "PPWSA", name: "Water (PPWSA)", category: "Utilities", currency: "KHR" },
    { emoji: "🌐", km: "Wi-Fi", en: "Wi-Fi", name: "Internet (Wi-Fi)", category: "Internet" },
    { emoji: "📱", km: "កាតទូរស័ព្ទ", en: "Phone", name: "Phone", category: "Phone" },
    { emoji: "🏠", km: "ជួលផ្ទះ", en: "Rent", name: "Rent", category: "Rent" },
    { emoji: "🎬", km: "Netflix", en: "Netflix", name: "Netflix", category: "Subscription", currency: "USD", autoPay: true }
  ];

  const km = () => languageCode() === "km";
  const L = (kmText, enText) => (km() ? kmText : enText);
  const today = () => localDateInput();
  const shift = days => {
    const date = new Date(`${today()}T00:00:00`);
    date.setDate(date.getDate() + days);
    return localDateInput(date);
  };
  const endOfMonth = () => {
    const date = new Date(`${today()}T00:00:00`);
    return localDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  };
  const dayGap = iso => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000);

  function categoryChips(selected) {
    const list = CATEGORIES.slice();
    if (selected && !list.some(entry => entry.value === selected)) list.splice(list.length - 1, 0, { value: selected, emoji: "🏷️", km: selected, en: selected, tone: "#8a948f" });
    return list.map(entry => `
      <label class="ev-cat" style="--tone:${entry.tone};--tone-bg:color-mix(in srgb, ${entry.tone} 16%, #ffffff)">
        <input type="radio" name="category" value="${escapeAttr(entry.value)}" ${entry.value === selected ? "checked" : ""}>
        <i class="ev-cat-icon bf-emoji">${entry.emoji}</i>
        <b>${escapeHtml(L(entry.km, entry.en))}</b>
      </label>`).join("");
  }

  function switchRow(name, checked, emoji, title, hint) {
    return `
      <label class="bf-switch-row">
        <span class="bf-switch-icon">${emoji}</span>
        <span class="bf-switch-text"><strong>${escapeHtml(title)}</strong><em>${escapeHtml(hint)}</em></span>
        <input class="ev-switch bf-switch" type="checkbox" name="${name}" ${checked ? "checked" : ""}>
      </label>`;
  }

  function render(item) {
    const isEdit = Boolean(item.id);
    const currency = item.currency || appData.profile.currency || "USD";
    const due = item.due || "";
    const dueChips = [[today(), L("ថ្ងៃនេះ", "Today")], [shift(7), L("៧ ថ្ងៃទៀត", "In 7 days")], [endOfMonth(), L("ចុងខែ", "End of month")]];
    return `
      <form class="modal glass-card event-modal expense-modal bill-modal" id="modalForm" novalidate>
        <div class="ev-head">
          <div class="ev-head-icon bf-head-icon">${Icons.bill()}</div>
          <h2 class="section-title">${isEdit ? t("editBill") : t("addBill")}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>

        <div class="ev-title-wrap">
          <input class="ev-title" id="name" name="name" type="text" autocomplete="off" maxlength="80" placeholder="${escapeAttr(L("ឈ្មោះវិក្កយបត្រ ឧ. ភ្លើង EDC, Wi-Fi", "Bill name, e.g. EDC, Wi-Fi"))}" value="${escapeAttr(item.name || "")}">
          <div class="field-error" data-error="name"></div>
          ${isEdit ? "" : `<div class="ev-row bf-picks">${PICKS.map((pick, index) => `<button type="button" class="ev-chip" data-bf-pick="${index}">${pick.emoji} ${escapeHtml(L(pick.km, pick.en))}</button>`).join("")}</div>`}
        </div>

        <div class="xp-amount-card">
          <button type="button" class="xp-currency" data-bf-currency="${escapeAttr(currency)}" title="USD / KHR">${currency === "KHR" ? "៛" : "$"}</button>
          <input class="xp-amount" id="amount" name="amount" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${escapeAttr(item.amount ?? "")}" aria-label="${escapeAttr(t("amount"))}">
          <span class="xp-currency-name" data-bf-currency-name>${escapeHtml(currency)}</span>
        </div>
        <div class="field-error" data-error="amount"></div>

        <section class="ev-section">
          <div class="ev-label">${Icons.calendar()}<strong>${escapeHtml(t("dueDateDay"))}</strong><em class="ev-summary" data-bf-when></em></div>
          <div class="ev-row">${dueChips.map(([value, label]) => `<button type="button" class="ev-chip" data-bf-due="${value}">${escapeHtml(label)}</button>`).join("")}<input class="ev-date" id="due" name="due" type="date" value="${escapeAttr(due)}" aria-label="${escapeAttr(t("dueDateDay"))}"></div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.chart()}<strong>${escapeHtml(t("frequency"))}</strong></div>
          <div class="ev-row bf-seg">${FREQUENCIES.map(value => `<button type="button" class="ev-chip" data-bf-frequency="${value}">${escapeHtml(optionLabel(value))}</button>`).join("")}</div>
          <input type="hidden" name="frequency" value="${escapeAttr(item.frequency || "Monthly")}">
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.bill()}<strong>${escapeHtml(t("category"))}</strong></div>
          <div class="ev-cats xp-cats bf-cats">${categoryChips(item.category || "")}</div>
        </section>

        ${(appData.loans || []).length ? `
        <section class="ev-section">
          <div class="ev-label">${Icons.loan()}<strong>${escapeHtml(L("ភ្ជាប់ទៅកម្ចី", "Linked loan"))}</strong><em class="ev-summary">${escapeHtml(L("បង់ម្តង = រាប់ម្តង", "Pay once, counted once"))}</em></div>
          <select class="ev-date bf-loan" name="loanId" aria-label="${escapeAttr(L("ភ្ជាប់ទៅកម្ចី", "Linked loan"))}">
            <option value="">${escapeHtml(L("— មិនភ្ជាប់ —", "— Not a loan —"))}</option>
            ${(appData.loans || []).map(loan => `<option value="${escapeAttr(loan.id)}" ${item.loanId === loan.id ? "selected" : ""}>${escapeHtml(loan.name || "Loan")}${Number(loan.monthlyPayment) > 0 ? ` · ${escapeHtml(String(loan.monthlyPayment))} ${escapeHtml(loan.currency || "")}` : ""}</option>`).join("")}
          </select>
        </section>` : ""}

        <section class="ev-section bf-switches">
          ${switchRow("reminder", item.reminder ?? true, "🔔", t("reminder"), L("ជូនដំណឹង និងផ្ញើ Telegram មុនថ្ងៃផុតកំណត់", "Notify and send to Telegram before it is due"))}
          ${switchRow("autoPay", item.autoPay ?? false, "🔁", L("បង់ស្វ័យប្រវត្តិ", "Auto-pay"), L("Netflix, Wi-Fi… កត់ជាចំណាយដោយខ្លួនឯងនៅថ្ងៃបង់", "Netflix, Wi-Fi… logged as an expense on the due date"))}
        </section>

        ${isEdit ? `
        <section class="ev-section">
          <div class="ev-label">${Icons.check()}<strong>${escapeHtml(t("status"))}</strong></div>
          <div class="ev-row bf-seg">${STATUSES.map(value => `<button type="button" class="ev-chip" data-bf-status="${value}">${escapeHtml(optionLabel(value))}</button>`).join("")}</div>
        </section>` : ""}
        <input type="hidden" name="status" value="${escapeAttr(item.status || "Upcoming")}">

        <details class="ev-notes" ${item.notes ? "open" : ""}>
          <summary>${Icons.edit()}<strong>${escapeHtml(item.notes ? t("notes") : L("បន្ថែមកំណត់ចំណាំ", "Add notes"))}</strong></summary>
          <textarea id="notes" name="notes" rows="3" placeholder="${escapeAttr(L("លេខអតិថិជន, link វិក្កយបត្រ…", "Customer ID, bill link…"))}">${escapeHtml(item.notes || "")}</textarea>
        </details>

        <div class="ev-foot">
          <small class="ev-shortcut">${escapeHtml(L("Ctrl + Enter ដើម្បីរក្សាទុក", "Ctrl + Enter to save"))}</small>
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit">${Icons.check()}${isEdit ? t("saveBill") : t("addBill")}</button>
        </div>
      </form>`;
  }

  function setCurrency(root, currency) {
    const button = root.querySelector("[data-bf-currency]");
    button.dataset.bfCurrency = currency;
    button.textContent = currency === "KHR" ? "៛" : "$";
    root.querySelector("[data-bf-currency-name]").textContent = currency;
  }

  function sync(root) {
    const form = root.querySelector("#modalForm");
    const due = form.elements.due.value;
    root.querySelectorAll("[data-bf-due]").forEach(chip => chip.classList.toggle("active", chip.dataset.bfDue === due));
    root.querySelectorAll("[data-bf-frequency]").forEach(chip => chip.classList.toggle("active", chip.dataset.bfFrequency === form.elements.frequency.value));
    root.querySelectorAll("[data-bf-status]").forEach(chip => chip.classList.toggle("active", chip.dataset.bfStatus === form.elements.status.value));
    const when = root.querySelector("[data-bf-when]");
    if (when) {
      if (!due) {
        when.textContent = "";
        when.dataset.level = "";
      } else {
        const gap = dayGap(due);
        const text = gap === 0 ? L("ថ្ងៃនេះ", "today") : gap > 0 ? L(`${gap} ថ្ងៃទៀត`, `in ${gap} day${gap === 1 ? "" : "s"}`) : L(`ហួស ${-gap} ថ្ងៃ`, `${-gap} day${gap === -1 ? "" : "s"} late`);
        when.textContent = `${formatDate(due)} · ${text}`;
        when.dataset.level = gap < 0 ? "over" : gap <= 3 ? "warn" : "ok";
      }
    }
  }

  function flash(el) {
    if (!el) return;
    el.classList.remove("ev-flash");
    void el.offsetWidth;
    el.classList.add("ev-flash");
  }

  function open(item) {
    item = item || {};
    const isEdit = Boolean(item.id);
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = render(item);
    root.classList.add("open");
    const form = root.querySelector("#modalForm");

    Modal.escapeHandler = event => {
      if (event.key === "Escape") Modal.close();
    };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));

    root.querySelector("[data-bf-currency]").addEventListener("click", () => {
      const current = root.querySelector("[data-bf-currency]").dataset.bfCurrency;
      setCurrency(root, current === "KHR" ? "USD" : "KHR");
    });
    form.elements.amount.addEventListener("input", () => { root.querySelector('[data-error="amount"]').textContent = ""; });
    form.elements.name.addEventListener("input", () => { root.querySelector('[data-error="name"]').textContent = ""; });

    root.querySelectorAll("[data-bf-pick]").forEach(chip => chip.addEventListener("click", () => {
      const pick = PICKS[Number(chip.dataset.bfPick)];
      form.elements.name.value = pick.name;
      flash(form.elements.name);
      const radio = form.querySelector(`input[name="category"][value="${pick.category}"]`);
      if (radio) {
        radio.checked = true;
        flash(radio.closest("label"));
      }
      if (pick.currency) setCurrency(root, pick.currency);
      form.elements.autoPay.checked = Boolean(pick.autoPay);
      form.elements.frequency.value = "Monthly";
      root.querySelector('[data-error="name"]').textContent = "";
      root.querySelectorAll("[data-bf-pick]").forEach(other => other.classList.toggle("active", other === chip));
      sync(root);
      if (!form.elements.amount.value) form.elements.amount.focus();
    }));
    form.elements.loanId?.addEventListener("change", () => {
      const loan = (appData.loans || []).find(entry => entry.id === form.elements.loanId.value);
      if (!loan) return;
      if (!form.elements.amount.value && Number(loan.monthlyPayment) > 0) form.elements.amount.value = loan.monthlyPayment;
      if (loan.currency) setCurrency(root, loan.currency);
      if (!form.elements.name.value.trim()) form.elements.name.value = loan.name || "";
      const radio = form.querySelector('input[name="category"][value="Loan"]');
      if (radio) radio.checked = true;
      flash(root.querySelector(".xp-amount-card"));
    });
    root.querySelectorAll("[data-bf-due]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.due.value = chip.dataset.bfDue;
      sync(root);
    }));
    form.elements.due.addEventListener("change", () => sync(root));
    form.elements.due.addEventListener("input", () => sync(root));
    root.querySelectorAll("[data-bf-frequency]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.frequency.value = chip.dataset.bfFrequency;
      sync(root);
    }));
    root.querySelectorAll("[data-bf-status]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.status.value = chip.dataset.bfStatus;
      sync(root);
    }));
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
      const name = form.elements.name.value.trim();
      const amount = Number(form.elements.amount.value || 0);
      let bad = false;
      if (!name) {
        root.querySelector('[data-error="name"]').textContent = t("required");
        flash(form.elements.name);
        bad = true;
      }
      if (!form.elements.amount.value || amount < 0) {
        root.querySelector('[data-error="amount"]').textContent = amount < 0 ? t("positiveAmount") : t("required");
        flash(root.querySelector(".xp-amount-card"));
        bad = true;
      }
      if (bad) {
        (name ? form.elements.amount : form.elements.name).focus();
        return;
      }
      const record = {
        name,
        amount,
        currency: root.querySelector("[data-bf-currency]").dataset.bfCurrency || appData.profile.currency || "USD",
        frequency: form.elements.frequency.value || "Monthly",
        due: form.elements.due.value,
        category: form.querySelector('input[name="category"]:checked')?.value || "",
        reminder: form.elements.reminder.checked,
        autoPay: form.elements.autoPay.checked,
        status: form.elements.status.value || "Upcoming",
        notes: form.elements.notes.value.trim(),
        loanId: form.elements.loanId ? form.elements.loanId.value : (item.loanId || "")
      };
      // choosing "Paid" here is a real payment: go through markBillPaid so the
      // expense (or the linked loan payment) is recorded once, like the Paid button
      const payNow = isEdit && record.status === "Paid" && item.status !== "Paid" && typeof markBillPaid === "function";
      if (payNow) record.status = item.status || "Upcoming";
      if (isEdit) Store.edit("bills", item.id, record);
      else Store.add("bills", record);
      if (payNow) markBillPaid(item.id);
      else Toast.show(isEdit ? t("billSaved") : t("billAdded"));
      Modal.close();
    });

    sync(root);
    if (!isEdit) setTimeout(() => form.elements.name.focus(), 60);
  }

  return { open };
})();
