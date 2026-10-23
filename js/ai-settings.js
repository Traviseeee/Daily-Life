/* Settings → AI (Gemini): the user's own free API key, model, Telegram switch,
 * a test button and the privacy note. The key is saved in
 * profile.aiSettings.apiKey and never shown again in full. */
function renderAiSettingsSection() {
  const km = languageCode() === "km";
  const L = (k, e) => (km ? k : e);
  const saved = appData.profile.aiSettings || {};
  const hasKey = Boolean(saved.apiKey);
  const on = hasKey && saved.enabled !== false;
  const models = [["", L("ស្វ័យប្រវត្តិ (ណែនាំ)", "Auto (recommended)")], ...AiAssist.MODELS.map(m => [m, m])];
  return `
          <details class="settings-accordion" id="settings-section-ai">
            ${settingsAccordionSummary("ai", "AI · Gemini", L("សួរ AI, ដំបូន្មានលុយ, ជួយអានសារ", "Ask AI, money advice, reads hard messages"), Icons.spark())}
            <div class="settings-accordion-body">
              <div class="ai-set-status ${on ? "is-on" : ""}">
                <span>${on ? "🤖" : "💤"}</span>
                <div><strong>${on ? L("AI បើក", "AI is on") : hasKey ? L("AI បិទ", "AI is off") : L("មិនទាន់មាន API key", "No API key yet")}</strong>
                <small>${hasKey ? `Key ${escapeHtml(AiAssist.maskKey(saved.apiKey))} · ${String(saved.apiKey).length} ${L("តួ", "characters")}` : L("យក key ឥតគិតថ្លៃពី Google AI Studio រួចដាក់ខាងក្រោម", "Get a free key from Google AI Studio and paste it below")}</small></div>
              </div>
              <div class="settings-preference-list settings-preference-list-standalone">
                <div class="settings-preference-row ai-key-row">
                  <span><strong>Gemini API key</strong><small><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> → Create API key</small></span>
                  <form class="ai-key-form" data-ai-key-form autocomplete="off">
                    <input type="password" name="apiKey" data-ai-key aria-label="Gemini API key" placeholder="${hasKey ? escapeAttr(L("ដាក់ key ថ្មីដើម្បីប្ដូរ", "Paste a new key to replace")) : "AIza…"}" autocomplete="off" spellcheck="false" inputmode="text">
                    <button class="button" type="submit">${L("រក្សាទុក", "Save")}</button>
                  </form>
                </div>
                <label class="settings-preference-row"><span><strong>${L("បើក AI", "Use AI")}</strong><small>${L("ក្នុង MYLIFE Chat និង Telegram bot", "In MYLIFE Chat and the Telegram bot")}</small></span><input type="checkbox" data-ai-pref="enabled" ${saved.enabled !== false ? "checked" : ""} ${hasKey ? "" : "disabled"}></label>
                <label class="settings-preference-row"><span><strong>${L("ប្រើក្នុង Telegram bot", "Use in the Telegram bot")}</strong><small>${L("សួរ bot, /advice, និងជួយអានសារពិបាក", "Ask the bot, /advice, and reading hard messages")}</small></span><input type="checkbox" data-ai-pref="telegram" ${saved.telegram !== false ? "checked" : ""} ${hasKey ? "" : "disabled"}></label>
                <label class="settings-preference-row"><span><strong>Model</strong><small>${L("បើ model មួយមិនដំណើរការ app សាក model បន្ទាប់ដោយខ្លួនឯង", "If one model fails the app tries the next one")}</small></span><select data-ai-pref="model">${models.map(([v, l]) => `<option value="${escapeAttr(v)}" ${(saved.model || "") === v ? "selected" : ""}>${escapeHtml(l)}</option>`).join("")}</select></label>
                <div class="settings-preference-row settings-link-row"><span><strong>${L("សាកល្បង", "Test")}</strong><small data-ai-test-result>${L("ពិនិត្យថា key ដំណើរការ", "Check that the key works")}</small></span><div class="settings-link-buttons"><button type="button" class="button ghost-button" data-ai-test ${hasKey ? "" : "disabled"}>▶ ${L("សាក", "Test")}</button>${hasKey ? `<button type="button" class="button ghost-button" data-ai-advice>🤖 ${L("ដំបូន្មានលុយ", "Money advice")}</button>` : ""}</div></div>
                ${hasKey ? `<div class="settings-preference-row settings-link-row"><span><strong>${L("លុប key", "Remove key")}</strong><small>${L("AI នឹងឈប់ដំណើរការ", "The AI stops working")}</small></span><button type="button" class="button ghost-button" data-ai-remove>${Icons.trash()} ${L("លុប", "Remove")}</button></div>` : ""}
              </div>
              <p class="ai-set-note">🔒 ${L(
                "Key រក្សាទុកក្នុងទិន្នន័យរបស់អ្នក (sync) ដើម្បីឲ្យ Telegram bot ប្រើបាន ហើយមិនចូលក្នុង Backup / Export ទេ។ AI ទទួលតែសង្ខេបលុយ វិក្កយបត្រ កម្ចី ព្រឹត្តិការណ៍ និងគោលដៅ — មិនមានរូបថត លេខទូរសព្ទ ឬកំណត់ចំណាំទេ។ Key ឥតគិតថ្លៃ៖ Google អាចប្រើសារដើម្បីកែលម្អសេវា។ ចម្លើយ AI អាចខុស សូមពិនិត្យមុនសម្រេចចិត្ត។",
                "The key is kept in your own synced data so the Telegram bot can use it, and is never put in a backup or export. The AI only gets a summary of money, bills, loans, events and goals — no photos, phone numbers or notes. Free keys: Google may use the messages to improve its service. AI answers can be wrong; check before you decide."
              )}</p>
            </div>
          </details>`;
}

(() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const save = patch => {
    const next = { ...(appData.profile.aiSettings || {}), ...patch, updatedAt: new Date().toISOString() };
    Store.updateProfile({ aiSettings: next });
  };

  document.addEventListener("submit", event => {
    const form = event.target.closest?.("[data-ai-key-form]");
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector("[data-ai-key]");
    // keys can have letters, numbers, "-", "_", "." …; pasting can add spaces,
    // quotes or invisible characters — remove those and let ▶ Test check the key
    const key = String(input.value || "").replace(/[\s\u200B-\u200D\u2060\uFEFF"'`“”‘’]/g, "");
    if (!key) {
      Toast.show(L("សូមដាក់ key ក្នុងប្រអប់សិន។", "Paste the key in the box first."), "warning");
      return;
    }
    // a real key is plain letters, numbers and - _ . only; "•" or "…" means it was
    // copied from a hidden (masked) view, other symbols come from the paste
    const odd = [...key].map((ch, index) => ({ ch, index })).filter(({ ch }) => !/[A-Za-z0-9._\-]/.test(ch));
    if (odd.length) {
      const first = odd[0];
      const masked = /[•…*]/.test(odd.map(item => item.ch).join(""));
      Toast.show(masked
        ? L("Key នេះត្រូវបានលាក់ (•••/…)។ នៅ AI Studio ចុចលើ key ហើយចុច Copy ដើម្បីចម្លង key ពេញ។", "This key is the hidden (•••/…) version. In AI Studio open the key and press Copy to copy the full key.")
        : L(`Key មានតួអក្សរមិនត្រឹមត្រូវ "${first.ch}" នៅតួទី ${first.index + 1}។ ចម្លង key ម្ដងទៀត។`, `The key has an invalid character "${first.ch}" at position ${first.index + 1}. Copy the key again.`), "warning");
      return;
    }
    if (key.length < 20 || key.length > 400 || /[<>]/.test(key)) {
      Toast.show(L(`Key ខ្លី ឬវែងពេក (${key.length} តួ)។ ចម្លង key ទាំងមូលពី AI Studio ម្ដងទៀត។`, `The key looks too short or too long (${key.length} characters). Copy the whole key from AI Studio again.`), "warning");
      return;
    }
    input.value = "";
    save({ apiKey: key, enabled: true });
    // read it back so we know it really was saved, then test it straight away
    const stored = appData.profile.aiSettings?.apiKey || "";
    if (stored !== key) {
      Toast.show(L("រក្សាទុក key មិនបាន។ សាកម្ដងទៀត។", "Couldn't save the key. Please try again."), "warning");
      return;
    }
    Toast.show(L(`បានរក្សាទុក ✅ ${AiAssist.maskKey(stored)} (${stored.length} តួ) · កំពុងសាក…`, `Saved ✅ ${AiAssist.maskKey(stored)} (${stored.length} characters) · testing…`), "success");
    setTimeout(() => document.querySelector("[data-ai-test]")?.click(), 400);
  });

  document.addEventListener("change", event => {
    const control = event.target.closest?.("[data-ai-pref]");
    if (!control) return;
    const key = control.dataset.aiPref;
    save({ [key]: control.type === "checkbox" ? control.checked : control.value });
    Toast.show(t("preferenceSaved"));
  });

  document.addEventListener("click", async event => {
    if (event.target.closest?.("[data-ai-remove]")) {
      Modal.confirm({
        title: L("លុប API key?", "Remove the API key?"),
        message: L("AI នឹងឈប់ដំណើរការក្នុង app និង Telegram bot។", "The AI will stop in the app and the Telegram bot."),
        confirmText: L("លុប", "Remove"),
        onConfirm: () => { save({ apiKey: "", enabled: false }); Toast.show(L("បានលុប key", "Key removed")); }
      });
      return;
    }
    if (event.target.closest?.("[data-ai-advice]")) {
      MyLifeChat.open();
      MyLifeChat.ask(L("🤖 ដំបូន្មានលុយ", "🤖 Money advice"));
      return;
    }
    const test = event.target.closest?.("[data-ai-test]");
    if (!test) return;
    const out = document.querySelector("[data-ai-test-result]");
    test.disabled = true;
    if (out) out.textContent = L("កំពុងសាក…", "Testing…");
    try {
      const settings = { ...AiAssist.settingsOf(appData), enabled: true };
      const result = await AiAssist.callGemini(settings, { prompt: "Reply with exactly: OK", maxTokens: 20, temperature: 0 });
      if (out) out.textContent = `✅ ${L("ដំណើរការ", "Works")} · ${result.model}`;
      Toast.show(`✅ Gemini ${L("ដំណើរការ", "works")} (${result.model})`, "success");
    } catch (error) {
      if (out) out.textContent = `⚠️ ${AiAssist.errorText(error, km(), true)}`;
      Toast.show(AiAssist.errorText(error, km()), "warning");
    } finally {
      test.disabled = false;
    }
  });
})();
