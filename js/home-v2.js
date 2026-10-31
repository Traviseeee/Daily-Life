/* MYLIFE Home V2 (draft 23 Oct 2026): what matters today first.
 * Order: title "ថ្ងៃនេះមាន N រឿង" + week strip → next up → money (left this month +
 * waiting answers) → quick actions → today's schedule → daily focus → mood →
 * reflection → family memories → smart summary.
 * Same data and the same hooks as before (data-focus-id, data-mood, edit-focus,
 * data-reflection-textarea, save-reflection, home-profile-side, data-ma-home), so
 * bindHome() and the other modules keep working. Colours: css/home-v2.css
 * (light = sky blue, dark = green + lime). */
const HomeV2 = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KM_DAYS = ["អាទិ", "ចន្ទ", "អង្គ", "ពុធ", "ព្រហ", "សុក្រ", "សៅរ៍"];
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    // duotone: a soft filled shape + a solid detail (Home quick dock, 30 Oct 2026)
    plus: () => '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="6" fill="currentColor" opacity=".22"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    scan: () => '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" opacity=".22"/><path d="M3 8V6a3 3 0 0 1 3-3h2M16 3h2a3 3 0 0 1 3 3v2M21 16v2a3 3 0 0 1-3 3h-2M8 21H6a3 3 0 0 1-3-3v-2M8 12h8" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
    cal: () => '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="4" fill="currentColor" opacity=".22"/><path d="M3 9a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v1H3Z" fill="currentColor"/><rect x="7" y="2.5" width="2.2" height="5" rx="1.1" fill="currentColor"/><rect x="14.8" y="2.5" width="2.2" height="5" rx="1.1" fill="currentColor"/><circle cx="12" cy="15" r="2" fill="currentColor"/></svg>',
    photo: () => '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4" fill="currentColor" opacity=".22"/><path d="M3 16.5 8.5 11l4.5 4.5 2.5-2.5L21 18.5A3.5 3.5 0 0 1 17.5 20h-11A3.5 3.5 0 0 1 3 16.5Z" fill="currentColor"/><circle cx="16" cy="9" r="2" fill="currentColor"/></svg>',
    chev: () => svg('<path d="m9 6 6 6-6 6"/>')
  };

  // light mode = "Lavender buddy" layout (31 Oct 2026): purple hero + mascot, 3 stat tiles,
  // week strip under them, today's progress card. Dark mode keeps the old layout.
  // light theme, every width (31 Oct: desktop uses the lavender look too)
  const lav = () => typeof document !== "undefined"; // 31 Oct: dark follows the light layout too (dark palette in css/home-lavender.css)
  // MYLIFE's own mascot: a round lavender buddy with a sprout (drawn here, no outside character)
  // MYLIFE buddy "Nomi" (31 Oct, picked from the mascot draft): a little lavender bean-cat drawn here.
  // mood: happy (normal) · cheer (focus all done) · sleepy (late night) · worry (spent too much)
  const BUDDY_INK = "#282694";
  function buddyFace(m, cx, cy, s) {
    const e = (x, y) => `<g class="nb-eye"><circle cx="${x}" cy="${y}" r="${4.4 * s}" fill="${BUDDY_INK}"/><circle cx="${x + 1.4 * s}" cy="${y - 1.6 * s}" r="${1.4 * s}" fill="#fff"/></g>`;
    const dx = 11 * s, ey = cy - 3 * s, my = cy + 8 * s;
    const blush = c => `<ellipse cx="${cx - 19 * s}" cy="${cy + 6 * s}" rx="${5 * s}" ry="${3 * s}" fill="${c}" opacity=".8"/><ellipse cx="${cx + 19 * s}" cy="${cy + 6 * s}" rx="${5 * s}" ry="${3 * s}" fill="${c}" opacity=".8"/>`;
    const st = `stroke="${BUDDY_INK}" stroke-width="${2.6 * s}" stroke-linecap="round" fill="none"`;
    if (m === "cheer") return blush("#ffb9c4") + `<path d="M${cx - dx - 4 * s} ${ey}q4 -5 8 0M${cx + dx - 4 * s} ${ey}q4 -5 8 0" ${st}/><path d="M${cx - 9 * s} ${my - 3 * s}q9 13 18 0z" fill="#E6986B" stroke="${BUDDY_INK}" stroke-width="${2.4 * s}" stroke-linejoin="round"/>`;
    if (m === "love") return blush("#ff9fb3") + [cx - dx, cx + dx].map(x => `<path class="nb-eye" d="M${x} ${ey + 4 * s}l${-5 * s} ${-5 * s}a${3 * s} ${3 * s} 0 0 1 ${5 * s} ${-3 * s}a${3 * s} ${3 * s} 0 0 1 ${5 * s} ${3 * s}z" fill="#ff6f91"/>`).join("") + `<path d="M${cx - 8 * s} ${my - 2 * s}q8 9 16 0" fill="#E6986B" stroke="${BUDDY_INK}" stroke-width="${2.5 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (m === "wink") return blush("#ffb9c4") + e(cx - dx, ey) + `<path d="M${cx + dx - 4 * s} ${ey}q4 -4 8 0" ${st}/><path d="M${cx - 7 * s} ${my - 2 * s}q7 7 14 0" ${st}/>`;
    if (m === "proud") return blush("#ffb9c4") + [cx - dx, cx + dx].map(x => `<path class="nb-eye" d="M${x} ${ey - 5 * s}l${1.6 * s} ${3.4 * s} ${3.6 * s} ${.5 * s}-${2.6 * s} ${2.5 * s}.6 ${3.6 * s}-${3.2 * s}-${1.7 * s}-${3.2 * s} ${1.7 * s}.6-${3.6 * s}-${2.6 * s}-${2.5 * s} ${3.6 * s}-${.5 * s}z" fill="#ffc94d" stroke="${BUDDY_INK}" stroke-width="${1.2 * s}" stroke-linejoin="round"/>`).join("") + `<path d="M${cx - 9 * s} ${my - 3 * s}q9 12 18 0z" fill="#E6986B" stroke="${BUDDY_INK}" stroke-width="${2.4 * s}" stroke-linejoin="round"/>`;
    if (m === "calm") return blush("#ffb9c4") + `<path d="M${cx - dx - 4 * s} ${ey}q4 3 8 0M${cx + dx - 4 * s} ${ey}q4 3 8 0" ${st}/><path d="M${cx - 6 * s} ${my - 1 * s}q6 5 12 0" ${st}/>`;
    if (m === "sleepy") return blush("#ffb9c4") + `<path d="M${cx - dx - 4 * s} ${ey}q4 3 8 0M${cx + dx - 4 * s} ${ey}q4 3 8 0" ${st}/><ellipse cx="${cx}" cy="${my}" rx="${3.2 * s}" ry="${2.6 * s}" fill="${BUDDY_INK}"/><text x="${cx + 22 * s}" y="${cy - 18 * s}" font-size="${11 * s}" font-weight="800" fill="#9F8CFF" font-family="sans-serif" class="nb-z">z</text>`;
    if (m === "worry") return blush("#c9d4ff") + e(cx - dx, ey + s) + e(cx + dx, ey + s) + `<path d="M${cx - dx - 5 * s} ${ey - 9 * s}l7 3M${cx + dx + 5 * s} ${ey - 9 * s}l-7 3" ${st}/><path d="M${cx - 6 * s} ${my + 3 * s}q6 -6 12 0" ${st}/><path class="nb-drop" d="M${cx + 27 * s} ${cy - 14 * s}q3 5 0 7q-3 -2 0 -7z" fill="#8fc9ff"/>`;
    return blush("#ffb9c4") + e(cx - dx, ey) + e(cx + dx, ey) + `<path d="M${cx - 8 * s} ${my - 2 * s}q8 9 16 0" fill="#E6986B" stroke="${BUDDY_INK}" stroke-width="${2.5 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // parts are grouped so css/home-v2.css can move them: breathe, blink, ears, tail, heart, arms (31 Oct)
  const buddy = (m = "happy") => `<svg class="hv2-buddy is-${m}" viewBox="0 0 100 100" aria-hidden="true"><ellipse class="nb-shadow" cx="50" cy="95" rx="24" ry="4" fill="rgba(40,38,148,.18)"/>`
    + `<g class="nb-tail"><path d="M74 80c14 2 18-12 10-18" stroke="#b9adf5" stroke-width="6" fill="none" stroke-linecap="round"/><path class="nb-heart" d="M84 58c-3-4-9-1-6 4l6 6 6-6c3-5-3-8-6-4z" fill="#ff8fab"/></g>`
    + `<g class="nb-bodyg"><g class="nb-ear-l"><path d="M28 34l4-16 14 10z" fill="#b3a6f7"/><path d="M31 30l2-7 6 5z" fill="#ffc2d1"/></g><g class="nb-ear-r"><path d="M72 34l-4-16-14 10z" fill="#b3a6f7"/><path d="M69 30l-2-7-6 5z" fill="#ffc2d1"/></g>`
    + `<ellipse cx="50" cy="60" rx="31" ry="30" fill="#c9bdff"/><ellipse cx="50" cy="72" rx="18" ry="14" fill="#f4f0ff"/>`
    + (m === "wink" ? '<ellipse class="nb-arm-r" cx="78" cy="46" rx="6" ry="8" fill="#c9bdff" transform="rotate(30 78 46)"/>' : "")
    + (m === "cheer" ? '<ellipse class="nb-arm-l" cx="22" cy="46" rx="6" ry="8" fill="#c9bdff" transform="rotate(-30 22 46)"/><ellipse class="nb-arm-r" cx="78" cy="46" rx="6" ry="8" fill="#c9bdff" transform="rotate(30 78 46)"/>' : "")
    + `<g class="nb-face">${buddyFace(m, 50, 56, 0.9)}</g></g></svg>`;
  // which mood fits right now
  function buddyMood(d) {
    const h = new Date().getHours();
    const m = d && d.month;
    const now = new Date();
    const daysLeft = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1);
    const spentToday = d ? (appData.expenses || []).filter(item => item.date === d.todayIso).reduce((t, item) => t + toProfileCurrency(item.amount, item.currency), 0) : 0;
    if (m && (m.left < 0 || (spentToday > 0 && spentToday > Math.max(0, m.left + spentToday) / daysLeft))) return "worry";
    if (d && d.focus.length && d.focus.every(item => item.done)) return "love";
    if (h >= 22 || h < 5) return "sleepy";
    if (h < 11) return "wink";
    if (h >= 18) return "calm";
    return "happy";
  }
  let MOOD_NOW = "happy";
  const MASCOT_FN = (m = MOOD_NOW) => buddy(m);
  // each place shows Nomi in its own mood (31 Oct)
  function progMood(d) {
    const done = d.focus.filter(item => item.done).length;
    if (d.focus.length && done >= d.focus.length) return "cheer";
    if (done > 0) return "happy";
    const h = new Date().getHours();
    return h >= 21 || h < 5 ? "sleepy" : "calm";
  }
  function moneyMood(m, spentToday, perDay) {
    if (m.left < 0 || (perDay > 0 && spentToday > perDay)) return "worry";
    if (spentToday === 0) return "proud";
    if (perDay > 0 && spentToday <= perDay / 2) return "happy";
    return "calm";
  }
  // Nomi talks: an intro the first time, then one friendly line for the mood (tap Nomi for the next one)
  const NOMI_LINES = {
    intro: ["សួស្តី! ខ្ញុំឈ្មោះ Nomi 🐾 ខ្ញុំនឹងជួយមើលលុយ និងថ្ងៃរបស់អ្នក", "Hi! I'm Nomi 🐾 I'll keep an eye on your money and your day"],
    happy: [["ថ្ងៃនេះល្អណាស់! ចាប់ផ្តើមតូចៗ 🌱", "Nice day! Start small 🌱"], ["ខ្ញុំនៅទីនេះជាមួយអ្នក 💜", "I'm right here with you 💜"]],
    cheer: [["អស្ចារ្យ! ធ្វើការផ្តោតរួចហើយ 🎉", "Amazing! Focus all done 🎉"], ["អ្នកពូកែណាស់ថ្ងៃនេះ ✨", "You did great today ✨"]],
    sleepy: [["យប់ហើយ… សម្រាកឱ្យបានល្អណា 😴", "It's late… rest well 😴"], ["ស្អែកយើងបន្តទៀត 🌙", "We'll keep going tomorrow 🌙"]],
    worry: [["ថ្ងៃនេះចាយច្រើនបន្តិច ប្រយ័ត្នណា 💸", "A bit much spent today, careful 💸"], ["យើងសន្សំបន្តិចទៀតស្អែក 🐷", "Let's save a little tomorrow 🐷"]],
    love: [["ធ្វើរួចទាំងអស់! ខ្ញុំស្រលាញ់ថ្ងៃនេះ 💜", "All done! I love today 💜"], ["អ្នកអស្ចារ្យណាស់ 🥰", "You're amazing 🥰"]],
    wink: [["អរុណសួស្តី! ☀️ ថ្ងៃថ្មីចាប់ផ្តើមហើយ", "Good morning! ☀️ A new day"], ["ញ៉ាំអាហារពេលព្រឹកហើយឬនៅ? 🍳", "Had breakfast yet? 🍳"]],
    proud: [["ខ្ញុំមោទនភាពនឹងអ្នក ⭐", "I'm proud of you ⭐"], ["សន្សំបានល្អ ⭐", "Saving well ⭐"]],
    calm: [["យឺតៗ មិនអីទេ ☁️", "Slow is fine ☁️"], ["ផឹកទឹកមួយកែវសិន 💧", "Have a glass of water first 💧"]]
  };
  // what Nomi says on the money card (the line follows today's spending)
  const MONEY_SAY = {
    cheer: ["ថ្ងៃនេះមិនទាន់ចាយទេ ល្អណាស់! 🐷", "No spending yet today, nice! 🐷"],
    proud: ["ថ្ងៃនេះមិនទាន់ចាយទេ ល្អណាស់! 🐷", "No spending yet today, nice! 🐷"],
    happy: ["ចាយបានល្អ នៅក្រោមកំណត់ ✨", "Spending looks good, under the limit ✨"],
    calm: ["ជិតដល់កំណត់ថ្ងៃនេះហើយ ☁️", "Close to today's limit ☁️"],
    worry: ["ចាយលើសហើយ ប្រយ័ត្នបន្តិចណា 💸", "Over the limit, go easy 💸"]
  };
  let nomiStep = 0;
  function nomiLine(mood) {
    let seen = false;
    try { seen = localStorage.getItem("mylife:nomi-hi") === "1"; } catch (error) { seen = true; }
    if (!seen && nomiStep === 0) { try { localStorage.setItem("mylife:nomi-hi", "1"); } catch (error) { /* ignore */ } return L(...NOMI_LINES.intro); }
    // tapping walks through who Nomi is and what Nomi does, then the mood lines
    if (nomiStep > 0) {
      const feel = { happy: ["រីករាយ 😊", "happy 😊"], cheer: ["សប្បាយខ្លាំង 🎉", "so happy 🎉"], sleepy: ["ងងុយ 😴", "sleepy 😴"], worry: ["បារម្ភបន្តិច 😟", "a bit worried 😟"], calm: ["ស្ងប់ ☁️", "calm ☁️"] }[mood] || ["រីករាយ", "happy"];
      const about = [
        ["សួស្តី! ខ្ញុំឈ្មោះ Nomi 🐾 មិត្តតូចរបស់ MYLIFE", "Hi! I'm Nomi 🐾 your little MYLIFE buddy"],
        ["ខ្ញុំមើលលុយ ហើយប្រាប់ពេលអ្នកចាយលើស 💸", "I watch your money and tell you when you overspend 💸"],
        ["ខ្ញុំរំលឹកព្រឹត្តិការណ៍ និងវិក្កយបត្រ 📅", "I remind you of events and bills 📅"],
        ["ខ្ញុំអបអរពេលអ្នកធ្វើការផ្តោតរួច 🎉", "I cheer when your focus is done 🎉"],
        [`មុខខ្ញុំប្តូរតាមថ្ងៃរបស់អ្នក · ឥឡូវខ្ញុំ${feel[0]}`, `My face follows your day · now I'm ${feel[1]}`]
      ];
      const list = [...about, ...(NOMI_LINES[mood] || NOMI_LINES.happy)];
      return L(...list[(nomiStep - 1) % list.length]);
    }
    const list = NOMI_LINES[mood] || NOMI_LINES.happy;
    return L(...list[0]);
  }

  const plainMoney = (value, currency) => {
    try { if (typeof formatPlainMoney === "function") return formatPlainMoney(Number(value) || 0, currency || appData.profile.currency || "USD"); } catch (error) { /* below */ }
    return `$${(Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const iso = date => localDateInput(date);
  const dayLabel = date => (km() ? KM_DAYS[date.getDay()] : date.toLocaleDateString("en-US", { weekday: "short" }));
  const longDate = date => (km() ? `${KM_DAYS[date.getDay()]} ${date.getDate()} ${KM_MONTHS[date.getMonth()]}` : date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }));
  const clock = time => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
  };
  const kindOf = item => item.kind === "bill" ? "bill" : item.source === "family" || item.kind === "birthday" || item.kind === "anniversary" ? "family" : item.kind === "reminder" ? "reminder" : item.kind === "holiday" ? "holiday" : "event";
  const TAG = { bill: ["វិក្កយបត្រ", "Bill", "amber"], family: ["គ្រួសារ", "Family", "violet"], reminder: ["រំលឹក", "Reminder", "green"], holiday: ["ថ្ងៃឈប់", "Holiday", "green"], event: ["ព្រឹត្តិការណ៍", "Event", "blue"] };

  function data() {
    const todayIso = localDateInput();
    const agenda = typeof homeAgenda === "function" ? homeAgenda(todayIso) : { today: 0, items: [], allItems: [] };
    const due = typeof MoneyAsk !== "undefined" && typeof MoneyAsk.items === "function" && !(typeof Login !== "undefined" && Login.guestMode) && appData.profile?.moneyAsk !== false ? MoneyAsk.items() : [];
    const month = typeof moneyMonthNumbers === "function" ? moneyMonthNumbers() : null;
    const focus = typeof FocusEditor !== "undefined" ? FocusEditor.items(todayIso) : (appData.dailyFocus?.date === todayIso && appData.dailyFocus.items?.length ? appData.dailyFocus.items : [
      { id: "focus-move", text: t("moveMyBody"), done: false },
      { id: "focus-water", text: t("drinkWater"), done: false },
      { id: "focus-family", text: t("checkInWithFamily"), done: false }
    ]);
    return { todayIso, agenda, due, month, focus };
  }

  function header(d) {
    const today = new Date();
    const todayItems = (d.agenda.allItems || d.agenda.items || []).filter(item => !item.overdue && item.date === d.todayIso);
    // real things only (focus has its own card): today's events + bills due today / tomorrow + money to answer
    const tomorrowIso = (() => { const x = new Date(); x.setDate(x.getDate() + 1); return iso(x); })();
    const billsSoon = (d.agenda.allItems || d.agenda.items || []).filter(item => item.kind === "bill" && !item.overdue && (item.date === d.todayIso || item.date === tomorrowIso));
    const things = d.agenda.today + billsSoon.filter(item => item.date === tomorrowIso).length + d.due.length;
    const focusDone = d.focus.filter(item => item.done).length;
    const name = appData.profile.name || L("អ្នក", "you");
    const photo = appData.profile.photo ? `<img src="${escapeAttr(appData.profile.photo)}" alt="">` : escapeHtml(initials(appData.profile.name || "ML"));
    const dates = new Set((d.agenda.allItems || []).map(item => item.date));
    // light: a past day gets ✓ when you checked in (picked a mood or logged an expense)
    const checked = new Set([...(appData.moodHistory || []).map(entry => entry.date), ...(appData.expenses || []).map(item => item.date)]);
    (appData.calendarEvents || []).forEach(event => event.date && dates.add(event.date));
    const week = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 3 + index); return date; });
    const parts = [L(`${d.agenda.today} ព្រឹត្តិការណ៍`, `${d.agenda.today} event${d.agenda.today === 1 ? "" : "s"}`)];
    if (d.due.length) parts.push(L(`${d.due.length} លុយត្រូវឆ្លើយ`, `${d.due.length} money to confirm`));
    const hour = today.getHours();
    const hello = hour < 12 ? L("សួស្តីពេលព្រឹក", "Good morning") : hour < 17 ? L("សួស្តីពេលថ្ងៃ", "Good afternoon") : L("សួស្តីពេលល្ងាច", "Good evening");
    const loggedOut = typeof Login !== "undefined" && (Login.guestMode || !Login.authenticated);
    return `<header class="hv2-head${lav() ? " is-lav" : ""}">${lav() ? '<div class="hv2-hero">' : ""}
      <div class="hv2-top">
        <div class="home-profile-side home-profile-trigger hv2-avatar" role="button" tabindex="0" aria-label="${escapeAttr(t("editProfile"))}" title="${escapeAttr(name)}">
          <span class="hv2-avatar-face">${photo}</span>
          <div class="home-profile-menu" aria-hidden="true">
            ${loggedOut ? `<button type="button" class="home-profile-menu-item home-profile-menu-login" data-account-action="login">${L("ចូលគណនី (Log in)", "Log in")}</button>` : ""}
            <button type="button" class="home-profile-menu-item" data-account-action="edit-profile">${escapeHtml(t("editProfile"))}</button>
            <button type="button" class="home-profile-menu-item hv2-only-phone" data-hv2-search>🔍 ${escapeHtml(L("ស្វែងរក", "Search"))}</button>
            <button type="button" class="home-profile-menu-item hv2-only-phone" data-hv2-menu>☰ ${escapeHtml(L("ម៉ឺនុយទាំងអស់", "All menus"))}</button>
          </div>
        </div>
        <div class="hv2-hello"><small>${escapeHtml(hello)} 👋</small><b>${escapeHtml(String(appData.profile.name || L("ភ្ញៀវ", "Guest")).split(/\s+/)[0])}</b></div>
        <span class="hv2-wx" data-hv2-wx role="button" tabindex="0">${document.getElementById("topbarWeather")?.innerHTML || ""}</span>
        <a class="hv2-bell hv2-menu" href="#launcher" aria-label="${escapeAttr(L("ម៉ឺនុយទាំងអស់", "All menus"))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/></svg></a>
        <button type="button" class="hv2-bell" data-hv2-bell aria-label="${escapeAttr(L("ការជូនដំណឹង", "Notifications"))}">${document.getElementById("bellButton")?.innerHTML || Icons.bell()}</button>
      </div>
      <div class="hv2-title-row">${lav() ? "" : `<button type="button" class="hv2-nomi-dark" data-nomi aria-label="Nomi">${MASCOT_FN()}<span class="hv2-say" data-nomi-say>${escapeHtml(nomiLine(MOOD_NOW))}</span></button>`}
        <div class="hv2-title">
          <h1>${things ? L(`ថ្ងៃនេះមាន <span>${things} រឿង</span> ត្រូវធ្វើ`, `<span>${things} thing${things === 1 ? "" : "s"}</span> to do today`) : L(`ថ្ងៃនេះ <span>ទំនេរ</span> 🌿`, `Today is <span>free</span> 🌿`)}</h1>
          <div class="hv2-why">
            <p>${escapeHtml(longDate(today))}</p>
            <span>📅 ${escapeHtml(L(`${d.agenda.today} ព្រឹត្តិការណ៍`, `${d.agenda.today} event${d.agenda.today === 1 ? "" : "s"}`))}</span>
            ${billsSoon[0] ? `<span>🧾 ${escapeHtml(billsSoon[0].date === d.todayIso ? L("ថ្ងៃនេះ", "Today") : L("ស្អែក", "Tomorrow"))} ${escapeHtml(billsSoon[0].title || "")}</span>` : ""}
            ${d.due.length ? `<span>⏳ ${escapeHtml(L(`${d.due.length} លុយត្រូវឆ្លើយ`, `${d.due.length} to confirm`))}</span>` : ""}
            <span>🎯 ${escapeHtml(L("ការផ្តោត", "Focus"))} ${focusDone}/${d.focus.length}</span>
          </div>
        </div>
      </div>
      ${lav() ? `<button type="button" class="hv2-hero-buddy" data-nomi aria-label="Nomi">${MASCOT_FN()}<span class="hv2-say" data-nomi-say>${escapeHtml(nomiLine(MOOD_NOW))}</span></button></div>${stats(d, focusDone)}` : ""}
      <nav class="hv2-week" aria-label="${escapeAttr(L("សប្តាហ៍នេះ", "This week"))}">${week.map(date => {
        const key = iso(date);
        const on = key === d.todayIso;
        return `<a class="hv2-day${on ? " is-today" : ""}${lav() && key < d.todayIso && checked.has(key) ? " is-ok" : ""}" href="#calendar"${on ? ' aria-current="date"' : ""}><small>${escapeHtml(dayLabel(date))}</small><b>${date.getDate()}</b><i class="${dates.has(key) ? "has" : ""}"></i></a>`;
      }).join("")}</nav>
      ${todayItems.length ? "" : ""}
    </header>`;
  }

  // light: 3 stat tiles under the hero (money left · today's events · focus)
  function stats(d, focusDone) {
    const left = d.month ? d.month.left : 0;
    const tile = (href, attrs, emoji, label, value, sub) => `<a class="hv2-st" ${href ? `href="${href}"` : 'href="#home"'} ${attrs}><i aria-hidden="true">${emoji}</i><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b><em>${escapeHtml(sub)}</em></a>`;
    const short = Math.abs(left) >= 1000 ? `${left < 0 ? "−" : ""}$${(Math.abs(left) / 1000).toFixed(1)}k` : `${left < 0 ? "−" : ""}$${Math.round(Math.abs(left))}`;
    return `<div class="hv2-stats">
      ${tile("#money", "", "💰", L("នៅសល់", "Left"), short, L("ខែនេះ", "this month"))}
      ${tile("#calendar", "", "📅", L("ព្រឹត្តិការណ៍", "Events"), String(d.agenda.today), L("ថ្ងៃនេះ", "today"))}
      ${tile("", 'data-hv2-scroll=".hv2-fx"', "🎯", L("ការផ្តោត", "Focus"), `${focusDone}/${d.focus.length}`, L("បានធ្វើ", "done"))}
    </div>`;
  }

  // light: "today's progress" card (focus steps + what is next) with the buddy
  function progress(d) {
    const done = d.focus.filter(item => item.done).length;
    const total = d.focus.length;
    const nowClock = new Date().toTimeString().slice(0, 5);
    const list = (d.agenda.items || []).filter(item => !item.overdue && item.date === d.todayIso);
    const next = list.find(item => clock(item.time) >= nowClock) || list[0];
    const nextTag = next ? `<span>${escapeHtml(L("បន្ទាប់", "Next"))}: ${escapeHtml(next.title || "")}${clock(next.time) ? ` ${escapeHtml(clock(next.time))}` : ""}</span>` : "";
    return `<a class="hv2-prog" href="${next ? escapeAttr(next.href || "#calendar") : "#home"}" ${next ? "" : 'data-hv2-scroll=".hv2-fx"'}>
      <span class="hv2-prog-cloud" aria-hidden="true"></span><span class="hv2-prog-buddy" data-nomi data-mood="${progMood(d)}" role="button" tabindex="0" aria-label="Nomi">${MASCOT_FN(progMood(d))}</span>
      <b>${escapeHtml(L("វឌ្ឍនភាពថ្ងៃនេះ", "Today's progress"))}</b>
      <span class="hv2-prog-seg">${d.focus.map((_, i) => `<i class="${i < done ? "on" : ""}"></i>`).join("")}<em>${done}/${total}</em></span>
      <span class="hv2-prog-tags"><span>${escapeHtml(total && done >= total ? L("ធ្វើរួចទាំងអស់ 🎉", "All done 🎉") : L(`នៅសល់ ${total - done}`, `${total - done} left`))}</span>${nextTag}</span>
    </a>`;
  }

  function nextUp(d) {
    const nowClock = new Date().toTimeString().slice(0, 5);
    const list = (d.agenda.items || []).filter(item => !item.overdue);
    const next = list.find(item => item.date === d.todayIso && clock(item.time) >= nowClock) || list.find(item => item.date === d.todayIso) || list[0];
    if (!next) return "";
    // "Coming up" lists bills and later days already; Next only shows today's / tomorrow's events
    if (next.kind === "bill" || !(next.date === d.todayIso || next.daysLeft === 1)) return "";
    const isToday = next.date === d.todayIso;
    const t0 = clock(next.time);
    let when;
    if (isToday && t0) {
      const [h, m] = t0.split(":").map(Number);
      const mins = h * 60 + m - (new Date().getHours() * 60 + new Date().getMinutes());
      when = mins > 0 ? (mins >= 60 ? L(`ក្នុង ${Math.round(mins / 60)} ម៉ោង`, `in ${Math.round(mins / 60)} h`) : L(`ក្នុង ${mins} នាទី`, `in ${mins} min`)) : L("ឥឡូវនេះ", "now");
    } else if (isToday) when = L("ថ្ងៃនេះ", "today");
    else when = next.daysLeft === 1 ? L("ស្អែក", "tomorrow") : L(`ក្នុង ${next.daysLeft} ថ្ងៃ`, `in ${next.daysLeft} days`);
    const box = isToday && t0 ? t0 : (() => { const date = new Date(`${next.date}T00:00:00`); return `${date.getDate()}<small>${escapeHtml(km() ? KM_MONTHS[date.getMonth()] : date.toLocaleDateString("en-US", { month: "short" }))}</small>`; })();
    return `<a class="hv2-next" href="${escapeAttr(next.href || "#calendar")}">
      <span class="hv2-next-time">${box}</span>
      <span class="hv2-next-text"><small>${escapeHtml(L("បន្ទាប់", "Next"))} · ${escapeHtml(when)}</small><b>${escapeHtml(next.title || "")}</b></span>
      <span class="hv2-next-go">${IC.chev()}</span>
    </a>`;
  }

  function money(d) {
    const m = d.month;
    if (!m) return "";
    const spentPct = m.income > 0 ? Math.min(100, Math.round((m.expenses / m.income) * 100)) : 0;
    const monthName = km() ? KM_MONTHS[new Date().getMonth()] : new Date().toLocaleDateString("en-US", { month: "long" });
    const due = d.due;
    const dueNames = due.slice(0, 2).map(item => item.title).join(" · ");
    if (lav()) return softMoney(d, m, due, dueNames);
    if (typeof WalletCard !== "undefined") {
      const dueHtml = due.length ? `<button type="button" class="hv2-wait" data-ma-home><span class="hv2-count">${due.length}</span><b>${escapeHtml(L(`${dueNames} រង់ចាំឆ្លើយ`, `${dueNames} waiting`))}</b><span class="hv2-pill">${escapeHtml(L("ឆ្លើយ", "Answer"))}</span></button>` : "";
      return WalletCard.render(m, d.todayIso, dueHtml);
    }
    return `<section class="hv2-card hv2-money">
      <div class="hv2-row"><span class="hv2-label">${escapeHtml(L(`នៅសល់ខែ${monthName}`, `Left in ${monthName}`))}</span><a class="hv2-chip" href="#money">${escapeHtml(L("មើល", "View"))} ›</a></div>
      <div class="hv2-amount${m.left < 0 ? " is-neg" : ""}">${escapeHtml(plainMoney(m.left))}</div>
      <div class="hv2-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${spentPct}" aria-label="${escapeAttr(L("ចាយបាន", "Spent"))}"><i style="width:${spentPct}%"></i></div>
      <div class="hv2-legend"><span>${escapeHtml(L("ចាយ", "Spent"))} <b>${escapeHtml(plainMoney(m.expenses))}</b></span><span>${escapeHtml(L("ចំណូល", "Income"))} <b>${escapeHtml(plainMoney(m.income))}</b></span><span>${escapeHtml(L("សន្សំ", "Saved"))} <b>${escapeHtml(plainMoney(m.saved))}</b></span></div>
      <div class="hv2-today-money">${(() => {
        const spentToday = (appData.expenses || []).filter(item => item.date === d.todayIso).reduce((t, item) => t + toProfileCurrency(item.amount, item.currency), 0);
        const now = new Date();
        const daysLeft = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1);
        return `<span>${escapeHtml(L("ចាយថ្ងៃនេះ", "Today"))} <b>${escapeHtml(plainMoney(spentToday))}</b></span><span>${escapeHtml(L("អាចចាយ/ថ្ងៃ", "Per day"))} <b>${escapeHtml(plainMoney(Math.max(0, m.left) / daysLeft))}</b></span>`;
      })()}</div>
      ${due.length ? `<button type="button" class="hv2-wait" data-ma-home><span class="hv2-count">${due.length}</span><b>${escapeHtml(L(`${dueNames} រង់ចាំឆ្លើយ`, `${dueNames} waiting`))}</b><span class="hv2-pill">${escapeHtml(L("ឆ្លើយ", "Answer"))}</span></button>` : ""}
    </section>`;
  }

  // red / amber strip at the top: overdue bills and budgets at 80%+ (from the old Today page)
  // the white money card itself (Home + Money overview share it). top = extra HTML for its first row
  function softArticle(todayIso, m, top = "") {
    const conf = appData.profile?.walletCard || {};
    const hide = conf.hide ? " is-hidden" : "";
    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const day = now.getDate();
    const daysLeft = Math.max(1, dim - day + 1);
    const monthName = km() ? KM_MONTHS[now.getMonth()] : now.toLocaleDateString("en-US", { month: "long" });
    const spentToday = (appData.expenses || []).filter(item => item.date === todayIso).reduce((t, item) => t + toProfileCurrency(item.amount, item.currency), 0);
    const perDay = Math.max(0, m.left) / daysLeft;
    const pct = m.income > 0 ? Math.round((m.expenses / m.income) * 100) : 0;
    const marks = [1, 8, 15, 22, dim];
    const at = n => `${((n - 1) / Math.max(1, dim - 1)) * 100}%`;
    const track = `<div class="hv2-mt"><div class="hv2-mt-lab">${marks.filter(n => Math.abs(n - day) > 3).map(n => `<span style="left:${at(n)}">${n}</span>`).join("")}<span class="is-now" style="left:${at(day)}">${escapeHtml(L("ថ្ងៃនេះ", "Today"))}</span></div>
      <div class="hv2-mt-bar"><i style="width:${at(day)}"></i>${marks.filter(n => n < day).map(n => `<b style="left:${at(n)}">✓</b>`).join("")}<b class="is-now" style="left:${at(day)}">✓</b></div></div>`;
    // card settings from "Design my card" (walletCard.soft): tint + glow, Nomi, talk, month line
    const sc = typeof WalletCard !== "undefined" && WalletCard.softConf ? WalletCard.softConf() : { tint: "white", nomi: true, talk: true, track: true };
    const tint = typeof WalletCard !== "undefined" && WalletCard.tintOf ? WalletCard.tintOf(sc.tint) : ["white", "#ffffff", "#ffe1d2"];
    const mood = sc.mood && sc.mood !== "auto" ? sc.mood : moneyMood(m, spentToday, perDay);
    return `<article class="wc-card hv2-soft${m.left < 0 ? " is-short" : ""}${sc.nomi ? "" : " no-nomi"}" style="--sc-bg:${tint[1]};--sc-glow:${tint[2]}">
        <span class="hv2-soft-glow" aria-hidden="true"></span>${top}
        ${sc.nomi ? `<span class="hv2-soft-buddy" data-nomi data-mood="${mood}" role="button" tabindex="0" aria-label="Nomi">${MASCOT_FN(mood)}${sc.talk ? `<span class="hv2-say" data-nomi-say>${escapeHtml(L(...(MONEY_SAY[mood] || MONEY_SAY.happy)))}</span>` : ""}</span>` : ""}
        <small>${escapeHtml(L(`នៅសល់សម្រាប់ចាយ · ខែ${monthName}`, `Left to spend · ${monthName}`))}</small>
        <a class="hv2-soft-amt money-value${hide}" href="#money">${escapeHtml(plainMoney(m.left))}</a>
        <span class="hv2-soft-pill">${escapeHtml(L(`ចាយរួច ${pct}% · ${daysLeft} ថ្ងៃទៀត`, `${pct}% spent · ${daysLeft} days left`))}</span>
        ${sc.track ? track : ""}
        <div class="hv2-soft-b">
          <div class="hv2-soft-bud"><span>${escapeHtml(L("ថវិកាខែនេះ", "Budget this month"))} <b class="money-value${hide}">${escapeHtml(plainMoney(m.income))}</b></span><button type="button" class="hv2-soft-edit" data-wc-edit>✎ ${escapeHtml(L("កែកាត", "Edit card"))}</button></div>
          <div class="hv2-soft-a3">
            <div class="hv2-soft-t is-spent"><em aria-hidden="true">↑</em><small>${escapeHtml(L("ចាយរួច", "Spent"))}</small><b class="money-value${hide}">${escapeHtml(plainMoney(m.expenses))}</b><span>${escapeHtml(L(`${pct}% នៃថវិកា`, `${pct}% of budget`))}</span></div>
            <div class="hv2-soft-t is-today"><em aria-hidden="true">☀️</em><small>${escapeHtml(L("ថ្ងៃនេះ", "Today"))}</small><b class="money-value${hide}">${escapeHtml(plainMoney(spentToday))}</b><span>${escapeHtml(spentToday === 0 ? L("មិនទាន់ចាយ 👍", "Nothing yet 👍") : spentToday > perDay ? L("លើសកម្រិតហើយ", "Over the daily limit") : L("ក្នុងកម្រិត", "Within the limit"))}</span></div>
            <div class="hv2-soft-t is-day"><em aria-hidden="true">✓</em><small>${escapeHtml(L("ចាយបាន/ថ្ងៃ", "Per day"))}</small><b class="money-value${hide}">${escapeHtml(plainMoney(perDay))}</b><span>${escapeHtml(L(`${daysLeft} ថ្ងៃទៀត`, `${daysLeft} days left`))}</span></div>
          </div>
        </div>
      </article>`;
  }

  // light (Lavender, 31 Oct): white money card like the "streak" card — buddy, big amount,
  // a month track (week marks ✓, today ringed), spent / today / per day; then a "spent today" row
  function softMoney(d, m, due, dueNames) {
    const conf = appData.profile?.walletCard || {};
    const hide = conf.hide ? " is-hidden" : "";
    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const day = now.getDate();
    const daysLeft = Math.max(1, dim - day + 1);
    const monthName = km() ? KM_MONTHS[now.getMonth()] : now.toLocaleDateString("en-US", { month: "long" });
    const spentToday = (appData.expenses || []).filter(item => item.date === d.todayIso).reduce((t, item) => t + toProfileCurrency(item.amount, item.currency), 0);
    const perDay = Math.max(0, m.left) / daysLeft;
    const pct = m.income > 0 ? Math.round((m.expenses / m.income) * 100) : 0;
    const marks = [1, 8, 15, 22, dim];
    const at = n => `${((n - 1) / Math.max(1, dim - 1)) * 100}%`;
    const track = `<div class="hv2-mt"><div class="hv2-mt-lab">${marks.filter(n => Math.abs(n - day) > 3).map(n => `<span style="left:${at(n)}">${n}</span>`).join("")}<span class="is-now" style="left:${at(day)}">${escapeHtml(L("ថ្ងៃនេះ", "Today"))}</span></div>
      <div class="hv2-mt-bar"><i style="width:${at(day)}"></i>${marks.filter(n => n < day).map(n => `<b style="left:${at(n)}">✓</b>`).join("")}<b class="is-now" style="left:${at(day)}">✓</b></div></div>`;
    const mini = typeof WalletCard !== "undefined" ? ((WalletCard.render(m, d.todayIso).match(/<div class="wc-mini">[\s\S]*?<\/div>\s*(?=<\/section>)/) || [""])[0]) : "";
    const dueHtml = due.length ? `<button type="button" class="hv2-wait" data-ma-home><span class="hv2-count">${due.length}</span><b>${escapeHtml(L(`${dueNames} រង់ចាំឆ្លើយ`, `${dueNames} waiting`))}</b><span class="hv2-pill">${escapeHtml(L("ឆ្លើយ", "Answer"))}</span></button>` : "";
    const segs = 8;
    const filled = perDay > 0 ? Math.min(segs, Math.ceil((spentToday / perDay) * segs)) : (spentToday > 0 ? segs : 0);
    const over = perDay > 0 ? spentToday > perDay : spentToday > 0;
    return `<section class="hv2-money wc-wrap hv2-soft-wrap">
      ${softArticle(d.todayIso, m)}
      ${dueHtml}
    </section>`;
  }

  function alerts(d) {
    const out = [];
    const today = d.todayIso;
    (appData.bills || []).filter(bill => bill.due && bill.due < today && bill.status !== "Paid" && !(typeof billPaidCurrentCycle === "function" && billPaidCurrentCycle(bill)))
      .slice(0, 2).forEach(bill => {
        const days = Math.round((new Date(`${today}T00:00:00`) - new Date(`${bill.due}T00:00:00`)) / 86400000);
        out.push(`<a class="hv2-alert is-red" href="#money/bills"><span>⚠️ ${escapeHtml(bill.name || t("bill"))} ${escapeHtml(L(`ហួស ${days} ថ្ងៃ`, `${days} days overdue`))} · ${escapeHtml(plainMoney(toProfileCurrency(bill.amount, bill.currency)))}</span><b>${escapeHtml(L("បង់", "Pay"))} ›</b></a>`);
      });
    if (typeof SmartMoney !== "undefined" && SmartMoney.budgetStatus) {
      expenseCategories.map(category => ({ category, ...SmartMoney.budgetStatus(category) }))
        .filter(row => row.budget && row.percent >= 80).sort((a, b) => b.percent - a.percent).slice(0, 1)
        .forEach(row => out.push(`<a class="hv2-alert ${row.percent >= 100 ? "is-red" : "is-amber"}" href="#money/expenses"><span>${row.percent >= 100 ? "🚨" : "⚠️"} ${escapeHtml(optionLabel(row.category))} ${escapeHtml(L(`ចាយ ${row.percent}% នៃថវិកា`, `at ${row.percent}% of budget`))}</span><b>${escapeHtml(L("មើល", "View"))} ›</b></a>`));
    }
    return out.length ? `<div class="hv2-alerts">${out.join("")}</div>` : "";
  }

  function quick() {
    const item = (attrs, icon, tone, label) => `<button type="button" class="hv2-q" ${attrs}><i class="hv2-q-${tone}">${icon}</i><span>${escapeHtml(label)}</span></button>`;
    return `<div class="hv2-quick">
      ${item('data-action="add-expense"', IC.plus(), "a", L("កត់ចំណាយ", "Expense"))}
      ${item('data-hv2-go="#scan"', IC.scan(), "b", L("ស្កេន", "Scan"))}
      ${item('data-action="add-event"', IC.cal(), "c", L("ព្រឹត្តិការណ៍", "Event"))}
      ${item('data-hv2-quick="add-memory"', IC.photo(), "d", L("រូបថត", "Photo"))}
    </div>`;
  }

  function schedule(d) {
    const all = (d.agenda.allItems || d.agenda.items || []).filter(item => !item.overdue);
    const todays = all.filter(item => item.date === d.todayIso);
    const list = (todays.length ? todays : all).slice(0, 4);
    const heading = todays.length ? L("កាលវិភាគថ្ងៃនេះ", "Today's schedule") : L("ខាងមុខ", "Coming up");
    const rows = list.map(item => {
      const kind = kindOf(item);
      const [kmTag, enTag, tone] = TAG[kind];
      const time = item.date === d.todayIso ? (clock(item.time) || L("ពេញថ្ងៃ", "All day")) : (() => { const date = new Date(`${item.date}T00:00:00`); return `${date.getDate()} ${km() ? KM_MONTHS[date.getMonth()] : date.toLocaleDateString("en-US", { month: "short" })}`; })();
      const sub = item.amount ? plainMoney(item.amount, item.currency) : (item.categoryLabel || "");
      const ic = { bill: "🧾", family: "👨‍👩‍👧", reminder: "🔔", holiday: "🎉", event: "📅" }[kind] || "📅";
      return `<a class="hv2-tl-row" href="${escapeAttr(item.href || "#calendar")}">${lav() ? `<span class="hv2-tl-ic is-${tone}" aria-hidden="true">${ic}</span>` : ""}<span class="hv2-tl-time">${escapeHtml(time)}</span><span class="hv2-dot is-${tone}"></span><span class="hv2-tl-text"><b>${escapeHtml(item.title || "")}</b>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</span><span class="hv2-tag is-${tone}">${escapeHtml(L(kmTag, enTag))}</span></a>`;
    }).join("");
    return `<div class="hv2-sec"><b>${escapeHtml(heading)}</b><a href="#calendar">${escapeHtml(L("ប្រតិទិន", "Calendar"))} ›</a></div>
      <section class="hv2-card hv2-tl">${typeof TopbarWeather !== "undefined" && TopbarWeather.rainRowHtml ? TopbarWeather.rainRowHtml() : ""}${rows || `<button type="button" class="hv2-empty" data-action="add-event">${IC.cal()}<span>${escapeHtml(L("គ្មានអ្វីទេ — ចុចបន្ថែមព្រឹត្តិការណ៍", "Nothing planned — tap to add an event"))}</span></button>`}</section>`;
  }

  // emoji for a focus line, guessed from its words (✨ when nothing fits)
  const FOCUS_EMOJI = [
    [/ទឹក|water|drink/i, "💧"], [/គ្រួសារ|family|mom|dad|ម្ដាយ|ម្តាយ|ឪពុក|call/i, "👨‍👩‍👧"], [/លុយ|ចាយ|money|spend|save|សន្សំ/i, "💸"],
    [/រាងកាយ|ហាត់|ដើរ|រត់|walk|run|move|body|exercise|gym|yoga/i, "🏃"], [/ការងារ|work|task|finish|បញ្ចប់/i, "💼"],
    [/អាន|សៀវភៅ|read|book|study|រៀន/i, "📚"], [/គេង|sleep|bed/i, "😴"], [/បាយ|ម្ហូប|eat|food|fruit|vegetable|ផ្លែ/i, "🥗"],
    [/សមាធិ|meditat|pray|breath/i, "🧘"], [/ផ្ទះ|clean|home|house/i, "🏠"]
  ];
  const focusEmoji = text => (FOCUS_EMOJI.find(([re]) => re.test(text || "")) || [null, "✨"])[1];
  const focusLeft = (done, total) => (total && done >= total ? L("ធ្វើរួចទាំងអស់ 🎉", "All done 🎉") : L(`នៅ ${total - done} ទៀត`, `${total - done} to go`));

  // light (31 Oct, draft D): focus grouped by category — tap a group to open its list
  const FX_CATS = [
    ["money", "💰", "លុយ", "Money", /លុយ|ចាយ|money|spend|save|សន្សំ/i, "#e5f7ef"],
    ["family", "👨‍👩‍👧", "គ្រួសារ", "Family", /គ្រួសារ|family|mom|dad|ម្ដាយ|ម្តាយ|ឪពុក|call/i, "#fdeef6"],
    ["health", "💪", "សុខភាព", "Health", /ទឹក|water|drink|រាងកាយ|ហាត់|ដើរ|រត់|walk|run|move|body|exercise|gym|yoga|គេង|sleep|bed|បាយ|ម្ហូប|eat|food|fruit|vegetable|ផ្លែ|សមាធិ|meditat|pray|breath/i, "#e6f4ff"],
    ["work", "💼", "ការងារ", "Work", /ការងារ|work|task|finish|បញ្ចប់|អាន|សៀវភៅ|read|book|study|រៀន|ផ្ទះ|clean|home|house/i, "#fff3dc"]
  ];
  const fxCatOf = text => (FX_CATS.find(cat => cat[4].test(text || "")) || ["other"])[0];
  const fxCatInfo = id => FX_CATS.find(cat => cat[0] === id) || ["other", "✨", "ផ្សេងៗ", "Other", null, "#f4f2fa"];
  function fxCatTiles(card) {
    const items = [...card.querySelectorAll(".focus-item")];
    card.querySelectorAll("[data-fx-cat]").forEach(tile => {
      const mine = items.filter(li => li.dataset.cat === tile.dataset.fxCat);
      const done = mine.filter(li => li.classList.contains("done")).length;
      const badge = tile.querySelector(".hv2-cat-n");
      if (badge) { badge.textContent = done >= mine.length ? "✓" : `${done}/${mine.length}`; badge.classList.toggle("is-ok", done >= mine.length); }
    });
  }
  function fxOpen(card, id) {
    card.dataset.open = id;
    card.querySelectorAll("[data-fx-cat]").forEach(tile => { const on = tile.dataset.fxCat === id; tile.classList.toggle("on", on); tile.setAttribute("aria-expanded", on); });
    card.querySelectorAll(".focus-item").forEach(li => { li.hidden = li.dataset.cat !== id; });
    const info = fxCatInfo(id);
    const title = card.querySelector("[data-fx-cat-title]");
    if (title) title.textContent = `${info[1]} ${L(info[2], info[3])}`;
  }

  function focusCard(d) {
    const done = d.focus.filter(item => item.done).length;
    const total = d.focus.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (lav()) {
      const groups = [];
      d.focus.forEach(item => { const id = fxCatOf(item.text); let g = groups.find(x => x.id === id); if (!g) groups.push(g = { id, items: [] }); g.items.push(item); });
      const order = [...FX_CATS.map(cat => cat[0]), "other"];
      groups.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      const open = (groups.find(g => g.items.some(item => !item.done)) || groups[0] || { id: "other" }).id;
      const openInfo = fxCatInfo(open);
      return `<div class="hv2-sec"><b>${escapeHtml(t("dailyFocus"))}</b><button type="button" class="hv2-link" data-action="edit-focus">${escapeHtml(L("កែ", "Edit"))} ›</button></div>
      <section class="hv2-card hv2-fx hv2-fx-cats focus-card${pct === 100 ? " all-done" : ""}" data-open="${open}">
        <div class="fx-head">
          <b class="fx-left fx-left-big" data-fx-left>${escapeHtml(focusLeft(done, total))}</b>
          <span class="fx-count"><b data-fx-done>${done}</b>/${total}</span>
        </div>
        <div class="fx-seg" data-fx-seg role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${escapeAttr(t("dailyFocus"))}">${d.focus.map((_, i) => `<i class="${i < done ? "on" : ""}"></i>`).join("")}</div>
        <div class="hv2-cats">${groups.map(g => {
          const info = fxCatInfo(g.id);
          const gDone = g.items.filter(item => item.done).length;
          const names = g.items.map(item => item.text).join(" · ");
          return `<button type="button" class="hv2-cat${g.id === open ? " on" : ""}" data-fx-cat="${g.id}" aria-expanded="${g.id === open}"><span class="hv2-cat-e" style="background:${info[5]}">${info[1]}</span><span class="hv2-cat-t"><b>${escapeHtml(L(info[2], info[3]))}</b><small>${escapeHtml(names)}</small></span><span class="hv2-cat-n${gDone >= g.items.length ? " is-ok" : ""}">${gDone >= g.items.length ? "✓" : `${gDone}/${g.items.length}`}</span></button>`;
        }).join("")}</div>
        <div class="hv2-cat-panel"><b class="hv2-cat-title" data-fx-cat-title>${escapeHtml(`${openInfo[1]} ${L(openInfo[2], openInfo[3])}`)}</b>
        <ul class="fx-grid focus-list">${d.focus.map(item => { const cat = fxCatOf(item.text); return `<li class="fx-tile focus-item${item.done ? " done" : ""}" data-cat="${cat}"${cat === open ? "" : " hidden"}><label><input type="checkbox" ${item.done ? "checked" : ""} data-focus-id="${escapeAttr(item.id)}"><span class="fx-em" aria-hidden="true">${focusEmoji(item.text)}</span><span class="focus-text">${escapeHtml(item.text)}</span><span class="fx-ck" aria-hidden="true"></span></label></li>`; }).join("")}</ul></div>
      </section>`;
    }
    return `<div class="hv2-sec"><b>${escapeHtml(t("dailyFocus"))}</b><button type="button" class="hv2-link" data-action="edit-focus">${escapeHtml(L("កែ", "Edit"))} ›</button></div>
      <section class="hv2-card hv2-fx focus-card${pct === 100 ? " all-done" : ""}">
        <div class="fx-head">
          <b class="fx-left fx-left-big" data-fx-left>${escapeHtml(focusLeft(done, total))}</b>
          <span class="fx-count"><b data-fx-done>${done}</b>/${total}</span>
        </div>
        <div class="fx-seg" data-fx-seg role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${escapeAttr(t("dailyFocus"))}">${d.focus.map((_, i) => `<i class="${i < done ? "on" : ""}"></i>`).join("")}</div>
        <ul class="fx-grid focus-list${total % 2 ? " is-odd" : ""}">${d.focus.map(item => `<li class="fx-tile focus-item${item.done ? " done" : ""}"><label><input type="checkbox" ${item.done ? "checked" : ""} data-focus-id="${escapeAttr(item.id)}"><span class="fx-em" aria-hidden="true">${focusEmoji(item.text)}</span><span class="focus-text">${escapeHtml(item.text)}</span><span class="fx-ck" aria-hidden="true"></span></label></li>`).join("")}</ul>
      </section>`;
  }

  // one drawn style for all 5 moods (system emoji mixed styles / sizes on some phones)
  const FACE_BASE = '<circle cx="20" cy="20" r="18" fill="#ffd35c"/><path d="M4.5 24a16 16 0 0 0 31 0 18 18 0 0 1-31 0z" fill="#f7b733" opacity=".55"/>';
  const FACE_INK = 'fill="none" stroke="#6b3d12" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
  const FACES = {
    happy: `<path ${FACE_INK} d="M12.5 17.5q2.5-3 5 0M22.5 17.5q2.5-3 5 0"/><path d="M12.5 23.5q7.5 8 15 0z" fill="#6b3d12"/><circle cx="11" cy="23" r="2.4" fill="#ff8f8f" opacity=".55"/><circle cx="29" cy="23" r="2.4" fill="#ff8f8f" opacity=".55"/>`,
    calm: `<path ${FACE_INK} d="M12.5 17q2.5 2.6 5 0M22.5 17q2.5 2.6 5 0M15.5 25.5q4.5 3 9 0"/><circle cx="11" cy="22.5" r="2.4" fill="#ff8f8f" opacity=".55"/><circle cx="29" cy="22.5" r="2.4" fill="#ff8f8f" opacity=".55"/>`,
    tired: `<path ${FACE_INK} d="M12.5 18.5h5M22.5 18.5h5"/><ellipse cx="20" cy="26.5" rx="2.6" ry="2.2" fill="#6b3d12"/><path d="M28 6.5h5l-5 5h5" fill="none" stroke="#7c8cff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    stressed: `<path ${FACE_INK} d="M12 16.5l5-2.2M28 16.5l-5-2.2M14.5 28q5.5-4.5 11 0"/><circle cx="15" cy="20" r="2" fill="#6b3d12"/><circle cx="25" cy="20" r="2" fill="#6b3d12"/><path d="M31.5 11.5q2 3 0 4.6q-2-1.6 0-4.6z" fill="#7cc4ff"/>`,
    excited: `<path d="M15 12.6l1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4z" fill="#ff5a7a"/><path d="M25 12.6l1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4z" fill="#ff5a7a"/><path d="M12 23.5q8 10 16 0z" fill="#6b3d12"/><path d="M15.5 27.4q4.5 2.6 9 0" fill="none" stroke="#ff8f8f" stroke-width="2.2" stroke-linecap="round"/>`
  };
  // mood buttons draw Nomi (31 Oct): happy · calm · tired → sleepy · stressed → worry · excited → cheer
  const face = key => buddy({ happy: "happy", calm: "calm", tired: "sleepy", stressed: "worry", excited: "cheer" }[key] || "happy").replace('class="hv2-buddy', 'class="hv2-face hv2-buddy-face');

  // a short friendly line after picking a mood
  const MOOD_NOTE = {
    happy: ["រីករាយ 😊 · ថ្ងៃល្អ ចែករំលែកវាជាមួយគ្រួសារផង", "Happy 😊 · a good day, share it with family"],
    calm: ["ស្ងប់ស្ងាត់ 😌 · រក្សាល្បឿនស្រួលៗនេះទុក", "Calm 😌 · keep this easy pace"],
    tired: ["ហត់ 😴 · សម្រាកបន្តិច ផឹកទឹក ហើយគេងឱ្យបានឆាប់", "Tired 😴 · rest a bit, drink water, sleep early"],
    stressed: ["តានតឹង 😣 · ដកដង្ហើមវែងៗ ធ្វើម្តងមួយរឿង", "Stressed 😣 · breathe slowly, one thing at a time"],
    excited: ["រំភើប 🤩 · ថាមពលល្អ! ប្រើវាលើការផ្តោតថ្ងៃនេះ", "Excited 🤩 · great energy, use it on today's focus"]
  };

  function moodCard(d) {
    const options = [["happy", face("happy"), t("moodHappy")], ["calm", face("calm"), t("moodCalm")], ["tired", face("tired"), t("moodTired")], ["stressed", face("stressed"), t("moodStressed")], ["excited", face("excited"), t("moodExcited")]];
    const current = appData.mood?.date === d.todayIso ? appData.mood.value : "";
    return `<div class="hv2-sec"><b>${escapeHtml(L("អារម្មណ៍ថ្ងៃនេះ", "Today's mood"))}</b></div>
      <section class="hv2-card hv2-mood-wrap"><div class="hv2-mood">${options.map(([value, emoji, label]) => `<button type="button" class="hv2-mood-btn${current === value ? " is-on" : ""}" data-mood="${value}" aria-label="${escapeAttr(label)}" aria-pressed="${current === value}"><span>${emoji}</span><small>${escapeHtml(label)}</small></button>`).join("")}</div>${current && MOOD_NOTE[current] ? `<p class="hv2-mood-note">${escapeHtml(L(...MOOD_NOTE[current]))}</p>` : ""}</section>`;
  }

  function reflection(d) {
    const text = appData.dailyReflection?.date === d.todayIso ? (appData.dailyReflection.text || "") : "";
    // light: an always-open "ask anything" style box with a round send button
    if (lav()) return `<div class="hv2-sec"><b>${escapeHtml(t("dailyReflection"))}</b>${text ? `<small class="hv2-ask-done">${escapeHtml(L("បានសរសេរ ✓", "Written ✓"))}</small>` : ""}</div>
    <section class="hv2-ask">
      <textarea class="reflection-textarea" data-reflection-textarea placeholder="${escapeAttr(L("ថ្ងៃនេះមានរឿងអ្វីល្អ? សរសេរបន្តិច…", "What went well today? Write a little…"))}" aria-label="${escapeAttr(t("reflectionPlaceholder"))}">${escapeHtml(text)}</textarea>
      <div class="hv2-ask-bar"><button type="button" class="hv2-ask-go" data-action="save-reflection" aria-label="${escapeAttr(t("saveReflection"))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></div>
    </section>`;
    return `<div class="hv2-sec"><b>${escapeHtml(t("dailyReflection"))}</b></div>
    <details class="hv2-card hv2-reflect"${text ? " open" : ""}>
      <summary><b>${escapeHtml(t("dailyReflection"))}</b><small>${escapeHtml(text ? L("បានសរសេរ ✓", "Written ✓") : L("ចុចដើម្បីសរសេរ", "Tap to write"))}</small></summary>
      <textarea class="reflection-textarea" data-reflection-textarea placeholder="${escapeAttr(t("reflectionPlaceholder"))}" aria-label="${escapeAttr(t("reflectionPlaceholder"))}">${escapeHtml(text)}</textarea>
      <button class="button" type="button" data-action="save-reflection">${escapeHtml(t("saveReflection"))}</button>
    </details>`;
  }

  // Home v3 (31 Oct): no repeats, grouped by urgency, one header style.
  // alerts → money card + quick add → coming up → focus (one card, folds when all done) → me (mood + reflection) → memories
  const icHead = (html, ic) => html.replace('<div class="hv2-sec">', `<div class="hv2-sec" data-ic="${ic}">`);
  const noHead = html => html.replace(/^\s*<div class="hv2-sec">[\s\S]*?<\/div>\s*/, "");
  function homeV3(d) {
    const fm = progMood(d);
    const focus = icHead(focusCard(d), "🎯").replace('<div class="fx-head">', `<div class="fx-head" data-fx-toggle><span class="fx-nomi" data-nomi data-mood="${fm}" role="button" tabindex="0" aria-label="Nomi">${buddy(fm)}</span>`);
    return `<div class="hv2-body hv2-v3">
        ${alerts(d)}
        ${money(d)}
        ${quick()}
        ${icHead(schedule(d), "📅")}
        ${focus}
        <div class="hv2-sec" data-ic="💜"><b>${escapeHtml(L("ខ្ញុំថ្ងៃនេះ", "Me today"))}</b></div>
        <section class="hv2-me">${noHead(moodCard(d))}${noHead(reflection(d))}</section>`;
  }

  function render() {
    const d = data();
    MOOD_NOW = buddyMood(d);
    return `<section class="page home-featured-page hv2">
      ${header(d)}
      ${lav() ? homeV3(d) : `<div class="hv2-body">
        ${alerts(d)}
        ${nextUp(d)}
        ${money(d)}
        ${quick()}
        ${schedule(d)}
        ${focusCard(d)}
        ${moodCard(d)}
        ${reflection(d)}`}
        ${typeof MemoryFeed !== "undefined" ? `<div class="hv2-sec"${lav() ? ' data-ic="📸"' : ""}><b>${escapeHtml(L("អនុស្សាវរីយ៍គ្រួសារ", "Family memories"))}</b><a class="hv2-link" href="#memories">${escapeHtml(L("ទាំងអស់", "All"))} ›</a></div>${MemoryFeed.familyTeaser()}` : ""}
      </div>
    </section>`;
  }

  // Nomi does a little something every few seconds: looks around, tilts, spins, jumps, waves, peeks (31 Oct)
  const NOMI_ACTS = ["look", "tilt", "spin", "jump", "wiggle", "peek"];
  setInterval(() => {
    if (document.hidden) return;
    const all = [...document.querySelectorAll("[data-nomi] .hv2-buddy, .hv2-face .hv2-buddy")].filter(el => el.getBoundingClientRect().width > 0 && !el.className.baseVal.includes(" act-"));
    if (!all.length) return;
    const el = all[Math.floor(Math.random() * all.length)];
    const act = NOMI_ACTS[Math.floor(Math.random() * NOMI_ACTS.length)];
    el.classList.add(`act-${act}`);
    setTimeout(() => el.classList.remove(`act-${act}`), 1600);
  }, 2600);

  // extra buttons that are not bound elsewhere
  document.addEventListener("click", event => {
    const go = event.target.closest("[data-hv2-go]");
    if (go) { location.hash = go.dataset.hv2Go; return; }
    const fxHead = event.target.closest("[data-fx-toggle]");
    if (fxHead && !event.target.closest("[data-nomi]")) { fxHead.closest(".hv2-fx")?.classList.toggle("is-open"); return; }
    const nomi = event.target.closest("[data-nomi]");
    if (nomi) {
      try { localStorage.setItem("mylife:nomi-hi", "1"); } catch (error) { /* ignore */ }
      nomiStep += 1;
      // Nomi's voice (31 Oct): hello on the intro tap, nyaa when sleepy / worried, then pip-pip and boing-hop in turn
      if (typeof Sound !== "undefined") {
        const m = nomi.dataset.mood || MOOD_NOW;
        Sound.play(nomiStep === 1 ? "nomiHello" : m === "sleepy" || m === "worry" ? "nomiNyaa" : nomi.closest("#loginModal, .tga-card, #modalRoot") ? "nomiPurr" : nomiStep % 2 ? "nomiHop" : "nomiPip");
      }
      const say = nomi.querySelector("[data-nomi-say]");
      if (say) { say.textContent = nomi.classList.contains("hv2-soft-buddy") && nomiStep % 2 ? L(...(MONEY_SAY[nomi.dataset.mood] || MONEY_SAY.happy)) : nomiLine(nomi.dataset.mood || MOOD_NOW); say.classList.remove("is-pop"); void say.offsetWidth; say.classList.add("is-pop"); }
      nomi.classList.remove("is-hop"); void nomi.offsetWidth; nomi.classList.add("is-hop");
      return;
    }
    const cat = event.target.closest("[data-fx-cat]");
    if (cat) { const card = cat.closest(".hv2-fx-cats"); if (card) fxOpen(card, cat.dataset.fxCat); return; }
    const jump = event.target.closest("[data-hv2-scroll]");
    if (jump) { event.preventDefault(); document.querySelector(jump.dataset.hv2Scroll)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const quickAction = event.target.closest("[data-hv2-quick]");
    if (quickAction && typeof runQuickAction === "function") runQuickAction(quickAction.dataset.hv2Quick);
    if (event.target.closest("[data-hv2-bell]")) document.getElementById("bellButton")?.click();
    if (event.target.closest("[data-hv2-menu]")) document.getElementById("menuToggle")?.click();
    if (event.target.closest("[data-hv2-search]")) {
      // phone Home hides the app top bar; show it again for the search box
      document.body.classList.add("hv2-search-open");
      setTimeout(() => document.getElementById("globalSearch")?.focus(), 50);
    }
  });
  window.addEventListener("hashchange", () => document.body.classList.remove("hv2-search-open"));
  // ticking a focus box: refresh the category counts (FocusEditor updates the rest)
  document.addEventListener("change", event => {
    if (!event.target.matches?.("[data-focus-id]")) return;
    const card = event.target.closest(".hv2-fx-cats");
    if (card) setTimeout(() => fxCatTiles(card), 30);
  });
  // phone ↔ desktop width: the lavender layout is phone only, so draw Home again when crossing 900px
  try { window.matchMedia("(max-width: 900px)").addEventListener("change", () => { if (location.hash.replace("#", "").split("/")[0] === "home" && typeof App !== "undefined") App.render(); }); } catch (error) { /* old browsers */ }

  // the Home header copies the app's weather chip and bell (with its badge); keep them in step
  function mirror(sourceId, selector) {
    const source = document.getElementById(sourceId);
    if (!source || typeof MutationObserver === "undefined") return;
    new MutationObserver(() => {
      const target = document.querySelector(selector);
      if (target && target.innerHTML !== source.innerHTML) target.innerHTML = source.innerHTML;
    }).observe(source, { childList: true, subtree: true, characterData: true, attributes: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { mirror("topbarWeather", "[data-hv2-wx]"); mirror("bellButton", "[data-hv2-bell]"); });
  else { mirror("topbarWeather", "[data-hv2-wx]"); mirror("bellButton", "[data-hv2-bell]"); }

  return { focusLeft, render, softArticle, lav, buddy };
})();
