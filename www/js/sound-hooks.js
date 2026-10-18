/* Connects MYLIFE actions to sound effects (see Sound in components/toast.js).
 * - money added (expense / income / saving) → "coin", bill paid → "coin"
 * - goal reaches its target → "celebrate"
 * - anything deleted → "delete", other saves → "success"
 * - forms open / close → "open" / "close", page change → "nav"
 * - switches → "toggleOn" / "toggleOff", chips & radio choices → "pop" */
(() => {
  if (typeof Store === "undefined" || typeof Sound === "undefined") return;
  const MONEY = new Set(["expenses", "income", "savings"]);
  const goalDone = goal => Number(goal?.targetAmount) > 0 && Number(goal?.currentAmount) >= Number(goal?.targetAmount);

  const add = Store.add.bind(Store);
  Store.add = (collection, item) => {
    const result = add(collection, item);
    Sound.play(MONEY.has(collection) ? "coin" : goalDone(item) ? "celebrate" : "success");
    return result;
  };

  const edit = Store.edit.bind(Store);
  Store.edit = (collection, itemId, changes) => {
    const before = collection === "goals" ? appData.goals.find(goal => goal.id === itemId) : null;
    const wasDone = goalDone(before);
    const result = edit(collection, itemId, changes);
    if (collection === "goals" && !wasDone && goalDone(appData.goals.find(goal => goal.id === itemId))) Sound.play("celebrate");
    else if (collection === "reminders" && changes?.done) Sound.play("success");
    else if (collection === "bills" && changes?.status === "Paid") Sound.play("coin");
    return result;
  };

  const remove = Store.delete.bind(Store);
  Store.delete = (collection, itemId) => {
    const result = remove(collection, itemId);
    Sound.play("delete");
    return result;
  };

  if (typeof window.markBillPaid === "function") {
    const paid = window.markBillPaid;
    window.markBillPaid = (...args) => {
      const result = paid(...args);
      Sound.play("coin");
      return result;
    };
  }

  // forms / dialogs opening and closing
  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) {
    let wasOpen = modalRoot.classList.contains("open");
    new MutationObserver(() => {
      const isOpen = modalRoot.classList.contains("open");
      if (isOpen === wasOpen) return;
      wasOpen = isOpen;
      if (modalRoot.classList.contains("welcome-poster-modal")) return;
      Sound.play(isOpen ? "open" : "close");
    }).observe(modalRoot, { attributes: true, attributeFilter: ["class"] });
  }

  // page changes
  window.addEventListener("hashchange", () => Sound.play("nav"));

  // switches, checkboxes, radio chips
  document.addEventListener("change", event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.type === "checkbox") Sound.play(input.checked ? "toggleOn" : "toggleOff");
    else if (input.type === "radio") Sound.play("pop");
  }, true);
  document.addEventListener("click", event => {
    if (event.target.closest(".ev-chip, .su-chip, .money-period-kind, .hf-fav, .app-quick-btn")) Sound.play("pop");
  }, true);
})();
