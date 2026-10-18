/* Sends the monthly report (designed JPG + Excel, the same files as the Reports
 * page exports) to the MYLIFE Telegram chat:
 *  - "📤 ផ្ញើទៅ Telegram" button on #money/reports (any month)
 *  - automatically once, the first time the app opens in a new month (last month)
 * The server endpoint is /api/report-send (needs the Supabase sign-in). */
const ReportTelegram = (() => {
  const km = () => (typeof languageCode === "function" ? languageCode() : "km") === "km";
  const L = (k, e) => (km() ? k : e);

  async function accessToken() {
    const session = await window.MYLIFE_SUPABASE_API?.getSession?.();
    return session?.data?.session?.access_token || "";
  }

  const prevMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return localDateInput(d).slice(0, 7);
  };

  async function blobToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }

  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const monthName = month => {
    const [y, m] = month.split("-").map(Number);
    return km() ? `ខែ${KM_MONTHS[m - 1]} ${y}` : new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  function caption(month) {
    const r = buildMonthlyFinanceReport(month);
    const plain = value => String(money(value)).replace(/<[^>]*>/g, "");
    const net = Number(r.netCashFlow ?? (r.incomeTotal - r.expenseTotal - (r.loanPaymentTotal || 0)));
    return [
      `📊 <b>${L("របាយការណ៍ប្រចាំខែ", "Monthly report")} · ${monthName(month)}</b>`,
      "",
      `💵 ${L("ចំណូល", "Income")}: <b>${plain(r.incomeTotal)}</b>`,
      `💸 ${L("ចំណាយ", "Spent")}: <b>${plain(r.expenseTotal)}</b>`,
      r.loanPaymentTotal ? `🏦 ${L("កម្ចី", "Loans")}: <b>${plain(r.loanPaymentTotal)}</b>` : "",
      `${net >= 0 ? "🟢" : "🔴"} ${L("សល់", "Net")}: <b>${plain(net)}</b>`
    ].filter(Boolean).join("\n");
  }

  function hasData(month) {
    return (appData.expenses || []).some(item => String(item.date || "").startsWith(month))
      || (appData.income || []).length > 0;
  }

  async function send(month, { auto = false } = {}) {
    const token = await accessToken();
    if (!token) throw new Error("not_signed_in");
    const canvas = typeof getMonthlyFinanceReportCanvas === "function" ? await getMonthlyFinanceReportCanvas(month) : await ReportCanvas.draw(month);
    const jpgBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    const xlsxBlob = typeof ReportXlsx !== "undefined" ? ReportXlsx.build(month) : null;
    const response = await fetch("/api/report-send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        month,
        auto,
        caption: caption(month),
        jpg: jpgBlob ? await blobToBase64(jpgBlob) : "",
        xlsx: xlsxBlob ? await blobToBase64(xlsxBlob) : ""
      })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `send_${response.status}`);
    return json;
  }

  // button on the Reports page
  async function sendFromButton(button) {
    const month = document.querySelector("[data-finance-report-month]")?.value || localDateInput().slice(0, 7);
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = L("កំពុងផ្ញើ…", "Sending…");
    try {
      await send(month);
      Toast.show(L("📤 បានផ្ញើរបាយការណ៍ទៅ Telegram", "📤 Report sent to Telegram"), "success", { sound: "notify" });
    } catch (error) {
      const message = error.message === "not_signed_in"
        ? L("សូម login សិន ដើម្បីផ្ញើទៅ Telegram", "Sign in first to send to Telegram")
        : error.message === "wait"
          ? L("ទើបផ្ញើរួច សូមរង់ចាំបន្តិច", "Just sent — wait a moment")
          : L("ផ្ញើមិនបាន សូមសាកម្ដងទៀត", "Couldn't send, try again");
      Toast.show(message, "warning");
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  // first app open of a new month: last month's report, once (server dedupes too)
  async function autoMonthly() {
    if (appData.profile?.reportAutoSend === false || appData.profile?.notificationsEnabled === false) return;
    const month = prevMonth();
    if (appData.profile?.lastReportSent === month || !hasData(month)) return;
    if (!(await accessToken())) return;
    try {
      const result = await send(month, { auto: true });
      Store.updateProfile({ lastReportSent: month });
      if (!result.skipped) Toast.show(L("📤 បានផ្ញើរបាយការណ៍ខែមុនទៅ Telegram", "📤 Last month's report sent to Telegram"), "success", { sound: "notify" });
    } catch (error) {
      /* try again next time the app opens */
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-finance-report-telegram]");
    if (button) sendFromButton(button);
  });
  setTimeout(() => { autoMonthly(); }, 9000);

  return { send, autoMonthly };
})();
