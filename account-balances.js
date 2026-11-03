/* Cash and bank balances derived from explicitly assigned transactions. */
const AccountBalances = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => km() ? k : e;
  const profile = () => appData.profile || (appData.profile = {});

  function calculate() {
    const p = profile();
    const start = p.accountingStartDate || localDateInput();
    let cash = Number(p.cashOpeningBalance || 0);
    let bank = Number(p.bankOpeningBalance || 0);
    const incomeEntries = [];
    (appData.income || []).forEach(item => {
      const received = item.received && typeof item.received === "object" ? item.received : {};
      const receivedMonths = Object.values(received);
      if (receivedMonths.length) {
        receivedMonths.forEach(entry => {
          const account = entry.accountType || item.accountType || "unspecified";
          if (!entry.date || entry.date < start) return;
          incomeEntries.push({ date: entry.date, account, amount: toProfileCurrency(entry.amount, entry.currency || item.currency) });
        });
      } else if ((item.recurring === false || item.frequency === "Once") && item.accountType && item.accountType !== "unspecified") {
        const date = String(item.nextPaymentDate || item.createdAt || "").slice(0, 10);
        if (date >= start) incomeEntries.push({ date, account: item.accountType, amount: toProfileCurrency(item.amount, item.currency) });
      }
    });
    incomeEntries.forEach(entry => {
      if (entry.account === "cash") cash += entry.amount;
      else if (entry.account === "bank") bank += entry.amount;
    });
    const expenses = (appData.expenses || []).filter(item => item.date >= start);
    expenses.forEach(item => {
      const amount = toProfileCurrency(item.amount, item.currency);
      if (item.paymentType === "cash") cash -= amount;
      else if (item.paymentType === "bank" || item.paymentType === "qr") bank -= amount;
    });
    return { start, cash, bank, total: cash + bank };
  }

  function render() {
    const value = calculate();
    const currency = appData.profile.currency || "USD";
    const fmt = amount => formatPlainMoney(amount, currency);
    const nomi = typeof HomeV2 !== "undefined" && HomeV2.buddy ? HomeV2.buddy("happy") : "🐱";
    return `<section class="fv2-section ab-section">
      <div class="ab-head"><div class="ab-title"><div><h2>${escapeHtml(L("សមតុល្យ", "Balances"))}</h2><p>${escapeHtml(L("សាច់ប្រាក់ · ធនាគារ · សរុប", "Cash · Bank · Total"))}</p></div><span class="ab-nomi" aria-hidden="true">${nomi}</span></div><button type="button" class="ab-edit" data-account-balances-edit aria-label="${escapeAttr(L("កែសមតុល្យដើម", "Edit opening balances"))}">${Icons.edit()}<span>${escapeHtml(L("កែ", "Edit"))}</span></button></div>
      <div class="ab-grid">
        <article class="ab-card"><span class="ab-icon is-cash">${Icons.wallet()}</span><div><small>${escapeHtml(L("សាច់ប្រាក់", "Cash"))}</small><strong>${escapeHtml(fmt(value.cash))}</strong></div></article>
        <article class="ab-card"><span class="ab-icon is-bank">${Icons.bank ? Icons.bank() : Icons.wallet()}</span><div><small>${escapeHtml(L("ធនាគារ / QR", "Bank / QR"))}</small><strong>${escapeHtml(fmt(value.bank))}</strong></div></article>
        <article class="ab-card is-total"><span class="ab-icon is-total-icon">${Icons.chart()}</span><div><small>${escapeHtml(L("សរុបនៅសល់", "Total left"))}</small><strong>${escapeHtml(fmt(value.total))}</strong></div></article>
      </div>
      <p class="ab-note">${escapeHtml(L(`ចាប់ពី ${value.start} · មិនរាប់កំណត់ត្រាមិនបញ្ជាក់`, `Since ${value.start} · Unknown excluded`))}</p>
    </section>`;
  }

  function openSettings() {
    const p = profile();
    Modal.open({
      title: L("សមតុល្យដើមសាច់ប្រាក់ និងធនាគារ", "Opening cash and bank balances"),
      submitText: L("រក្សាទុក", "Save balances"),
      fields: [
        { name: "start", label: L("គិតចាប់ពីថ្ងៃនេះ (កត់សមតុល្យដើមនៅដើមថ្ងៃនេះ)", "Start date (opening balances are at the start of this day)"), type: "date", value: p.accountingStartDate || localDateInput(), required: true },
        { name: "cash", label: L("សមតុល្យសាច់ប្រាក់ដើម", "Opening cash balance"), type: "number", value: p.cashOpeningBalance || 0, required: true },
        { name: "bank", label: L("សមតុល្យធនាគារដើម", "Opening bank balance"), type: "number", value: p.bankOpeningBalance || 0, required: true }
      ],
      onSubmit(data) {
        const previous = structuredClone(appData);
        Object.assign(profile(), { accountingStartDate: data.start || localDateInput(), cashOpeningBalance: Number(data.cash || 0), bankOpeningBalance: Number(data.bank || 0) });
        if (!Store.save()) { restoreData(previous); return; }
        Modal.close();
        App.render();
      }
    });
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-account-balances-edit]")) openSettings();
  });

  return { calculate, render, openSettings };
})();
