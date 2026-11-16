/* MYLIFE savings form (16 Nov 2026) — same look as the income / expense forms:
 * big goal amount with a $ / ៛ switch, the name under it, then grouped sections
 * (what you have · monthly plan · joint partner · deadline) with chips, notes folded away.
 * Saves the same fields as the old plain form: name, targetAmount, currentAmount, reserveAmount,
 * monthlyContribution, jointWith, partnerContribution, currency, deadline, notes.
 */
const SavingsForm = (() => {
  const km = () => languageCode() === "km";
  const L = (kmText, enText) => (km() ? kmText : enText);
  const plain = (value, currency) => formatPlainMoney(Number(value || 0), currency);
  const addMonths = months => {
    const date = new Date(`${localDateInput()}T00:00:00`);
    date.setMonth(date.getMonth() + months);
    return localDateInput(date);
  };

  function people(item) {
    const list = (appData.family || []).filter(member => member && member.id && member.relationship !== "Me")
      .map(member => ({ id: member.id, name: member.name || "?" }));
    if (item.jointWith && !list.some(person => person.id === item.jointWith)) list.push({ id: item.jointWith, name: item.jointName || "?" });
    return list;
  }

  const num = (name, label, value, hint = "") => `
    <label class="sf-field">
      <span>${escapeHtml(label)}</span>
      <input id="${name}" name="${name}" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${escapeAttr(value ?? "")}">
      ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
    </label>`;

  function render(item) {
    const isEdit = Boolean(item.id);
    const currency = item.currency || appData.profile.currency || "USD";
    const partners = people(item);
    const joint = item.jointWith || "";
    const deadlineChips = [[addMonths(3), L("៣ ខែ", "3 months")], [addMonths(6), L("៦ ខែ", "6 months")], [addMonths(12), L("១ ឆ្នាំ", "1 year")]];
    return `
      <form class="modal glass-card event-modal expense-modal income-modal savings-modal" id="modalForm" novalidate>
        <div class="ev-head">
          <div class="ev-head-icon xp-head-icon if-head-icon">${Icons.savings()}</div>
          <h2 class="section-title">${isEdit ? t("editSavings") : t("addSavings")}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>

        <p class="sf-cap">${escapeHtml(t("targetAmount"))}</p>
        <div class="xp-amount-card">
          <button type="button" class="xp-currency" data-xp-currency="${escapeAttr(currency)}" title="USD / KHR">${currency === "KHR" ? "៛" : "$"}</button>
          <input class="xp-amount" id="targetAmount" name="targetAmount" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${escapeAttr(item.targetAmount ?? "")}" aria-label="${escapeAttr(t("targetAmount"))}">
          <span class="xp-currency-name" data-xp-currency-name>${escapeHtml(currency)}</span>
        </div>
        <div class="field-error" data-error="targetAmount"></div>

        <div class="ev-title-wrap">
          <input class="ev-title xp-desc" id="name" name="name" type="text" autocomplete="off" placeholder="${escapeAttr(L("ឧ. មូលនិធិបម្រុង ឬ ទិញផ្ទះ", "e.g. Emergency fund or New house"))}" value="${escapeAttr(item.name || "")}" aria-label="${escapeAttr(t("savingsName"))}">
          <div class="ev-smart" data-sf-plan><i>${Icons.spark()}</i><em data-sf-plan-text></em></div>
        </div>
        <div class="field-error" data-error="name"></div>

        <section class="ev-section">
          <div class="ev-label">${Icons.wallet()}<strong>${escapeHtml(L("លុយដែលមាន", "What you have"))}</strong></div>
          <div class="sf-grid">
            ${num("currentAmount", t("currentAmount"), item.currentAmount ?? 0)}
            ${num("reserveAmount", L("ប្រាក់បម្រុង", "Keep aside"), item.reserveAmount ?? 0, L("មិនយកទៅប្រើ", "Not for spending"))}
          </div>
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.calendar()}<strong>${escapeHtml(L("ផែនការប្រចាំខែ", "Monthly plan"))}</strong></div>
          <div class="sf-grid${partners.length ? "" : " is-one"}">
            ${num("monthlyContribution", t("monthlyContribution"), item.monthlyContribution ?? 0)}
            ${partners.length ? `<div data-sf-partner-box>${num("partnerContribution", L("ដៃគូដាក់ /ខែ", "Partner / month"), item.partnerContribution ?? 0)}</div>` : ""}
          </div>
          ${partners.length ? `
          <div class="ev-label if-sub">${Icons.user()}<strong>${escapeHtml(L("គណនីរួម · ដៃគូ", "Joint account · partner"))}</strong></div>
          <div class="ev-row">
            <button type="button" class="ev-chip" data-sf-joint="">${escapeHtml(L("គ្មាន (ខ្ញុំម្នាក់)", "None (just me)"))}</button>
            ${partners.map(person => `<button type="button" class="ev-chip" data-sf-joint="${escapeAttr(person.id)}">${escapeHtml(person.name)}</button>`).join("")}
          </div>
          <input type="hidden" name="jointWith" value="${escapeAttr(joint)}">` : ""}
        </section>

        <section class="ev-section">
          <div class="ev-label">${Icons.target()}<strong>${escapeHtml(t("deadline"))}</strong><em class="ev-summary" data-sf-when></em></div>
          <div class="ev-row">${deadlineChips.map(([value, label]) => `<button type="button" class="ev-chip" data-sf-date="${value}">${escapeHtml(label)}</button>`).join("")}<input class="ev-date" id="deadline" name="deadline" type="date" value="${escapeAttr(item.deadline || "")}" aria-label="${escapeAttr(t("deadline"))}"></div>
        </section>

        <details class="ev-notes" ${item.notes ? "open" : ""}>
          <summary>${Icons.edit()}<strong>${escapeHtml(item.notes ? t("notes") : L("បន្ថែមកំណត់ចំណាំ", "Add notes"))}</strong></summary>
          <textarea id="notes" name="notes" rows="3" placeholder="${escapeAttr(L("សន្សំសម្រាប់អ្វី…", "What it is for…"))}">${escapeHtml(item.notes || "")}</textarea>
        </details>

        <div class="ev-foot">
          <small class="ev-shortcut">${escapeHtml(L("Ctrl + Enter ដើម្បីរក្សាទុក", "Ctrl + Enter to save"))}</small>
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit">${Icons.check()}${isEdit ? t("saveSavings") : t("addSavings")}</button>
        </div>
      </form>`;
  }

  // chips, partner box and the "what it takes" line follow the fields
  function sync(root) {
    const form = root.querySelector("#modalForm");
    const currency = root.querySelector("[data-xp-currency]").dataset.xpCurrency;
    const deadline = form.elements.deadline.value;
    root.querySelectorAll("[data-sf-date]").forEach(chip => chip.classList.toggle("active", chip.dataset.sfDate === deadline));
    const when = root.querySelector("[data-sf-when]");
    if (when) when.textContent = deadline ? formatDate(deadline) : "";
    const joint = form.elements.jointWith ? form.elements.jointWith.value : "";
    root.querySelectorAll("[data-sf-joint]").forEach(chip => chip.classList.toggle("active", chip.dataset.sfJoint === joint));
    const partnerBox = root.querySelector("[data-sf-partner-box]");
    if (partnerBox) partnerBox.hidden = !joint;

    const target = Number(form.elements.targetAmount.value || 0);
    const have = Number(form.elements.currentAmount.value || 0);
    const monthly = Number(form.elements.monthlyContribution.value || 0) + (joint && form.elements.partnerContribution ? Number(form.elements.partnerContribution.value || 0) : 0);
    const gap = Math.max(0, target - have);
    const box = root.querySelector("[data-sf-plan]");
    const text = root.querySelector("[data-sf-plan-text]");
    let line = L("ដាក់គោលដៅ និងថ្ងៃកំណត់ — ខ្ញុំគណនាឱ្យ", "Set a goal and a deadline — I'll do the maths");
    let found = false;
    if (target > 0 && gap === 0) { line = L("ដល់គោលដៅហើយ 🎉", "Goal already reached 🎉"); found = true; }
    else if (target > 0 && deadline) {
      const months = Math.max(1, Math.ceil((new Date(`${deadline}T00:00:00`) - new Date(`${localDateInput()}T00:00:00`)) / (30.44 * 864e5)));
      const need = gap / months;
      line = monthly > 0 && monthly >= need
        ? L(`ត្រូវការ ${plain(need, currency)}/ខែ · ផែនការអ្នកគ្រប់ ✓`, `Needs ${plain(need, currency)}/month · your plan covers it ✓`)
        : L(`ត្រូវការ ${plain(need, currency)}/ខែ ក្នុង ${months} ខែ`, `Needs ${plain(need, currency)}/month for ${months} months`);
      found = true;
    } else if (target > 0 && monthly > 0) {
      const months = Math.ceil(gap / monthly);
      line = L(`ដាក់ ${plain(monthly, currency)}/ខែ · ដល់គោលដៅក្នុង ${months} ខែ`, `${plain(monthly, currency)}/month · goal in ${months} months`);
      found = true;
    }
    box.classList.toggle("is-found", found);
    text.textContent = line;
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

    const form = root.querySelector("#modalForm");
    const hasJoint = Boolean(form.elements.jointWith);
    Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));

    root.querySelector("[data-xp-currency]").addEventListener("click", () => {
      const button = root.querySelector("[data-xp-currency]");
      const next = button.dataset.xpCurrency === "KHR" ? "USD" : "KHR";
      button.dataset.xpCurrency = next;
      button.textContent = next === "KHR" ? "៛" : "$";
      root.querySelector("[data-xp-currency-name]").textContent = next;
      sync(root);
    });
    form.addEventListener("input", event => {
      const error = root.querySelector(`[data-error="${event.target.name}"]`);
      if (error) error.textContent = "";
      sync(root);
    });
    root.querySelectorAll("[data-sf-date]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.deadline.value = form.elements.deadline.value === chip.dataset.sfDate ? "" : chip.dataset.sfDate;
      sync(root);
    }));
    form.elements.deadline.addEventListener("change", () => sync(root));
    root.querySelectorAll("[data-sf-joint]").forEach(chip => chip.addEventListener("click", () => {
      form.elements.jointWith.value = chip.dataset.sfJoint;
      sync(root);
    }));
    const details = root.querySelector(".ev-notes");
    details.addEventListener("toggle", () => { if (details.open) setTimeout(() => form.elements.notes.focus(), 30); });
    form.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); form.requestSubmit(); }
    });

    form.addEventListener("submit", event => {
      event.preventDefault();
      const name = form.elements.name.value.trim();
      const targetRaw = String(form.elements.targetAmount.value).trim();
      // same rule as the old form: a goal amount and a name are required
      if (targetRaw === "" || !(Number(targetRaw) >= 0)) {
        root.querySelector('[data-error="targetAmount"]').textContent = t("required");
        form.elements.targetAmount.focus();
        flash(root.querySelector(".xp-amount-card"));
        return;
      }
      if (!name) {
        root.querySelector('[data-error="name"]').textContent = t("required");
        form.elements.name.focus();
        return;
      }
      const data = {
        name,
        targetAmount: Number(targetRaw),
        currentAmount: Number(form.elements.currentAmount.value || 0),
        reserveAmount: Number(form.elements.reserveAmount.value || 0),
        monthlyContribution: Number(form.elements.monthlyContribution.value || 0),
        currency: root.querySelector("[data-xp-currency]").dataset.xpCurrency || appData.profile.currency || "USD",
        deadline: form.elements.deadline.value || "",
        notes: form.elements.notes.value.trim()
      };
      const joint = hasJoint
        ? savingsJointRecord({ jointWith: form.elements.jointWith.value, partnerContribution: form.elements.partnerContribution.value, jointName: item.jointName })
        : {};
      const record = { ...data, ...joint };
      if (item.id) Store.edit("savings", item.id, record);
      else Store.add("savings", record);
      Toast.show(item.id ? t("savingsSaved") : t("savingsCreated"));
      Modal.close();
    });

    sync(root);
    if (!item.id) setTimeout(() => form.elements.targetAmount.focus(), 60);
  }

  return { open };
})();
