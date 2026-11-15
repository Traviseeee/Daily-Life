/* MYLIFE Home slider (13 Nov 2026): the money card stays exactly as it is, and you can swipe
 * left to photo cards of the same size — the newest family post, "this day last year", my newest memory.
 * No photos → no slider (the money card alone, as before).
 * Auto-slides every 5 s while on screen; a touch pauses it, it waits 12 s after you swipe yourself,
 * and it never moves with "reduce motion" on. */
const HomeSlider = (() => {
  const km = () => languageCode() === "km";
  const L = (k, e) => (km() ? k : e);
  const KEY = "mylife.homeSlide";
  const feed = () => (typeof MemoryFeed !== "undefined" && MemoryFeed.mediaOf ? MemoryFeed : null);
  const fam = () => (typeof FamilyPosts !== "undefined" && FamilyPosts.active && FamilyPosts.active() ? FamilyPosts : null);

  // first picture of a memory (a video's poster counts)
  function picture(memory) {
    const media = feed()?.mediaOf(memory) || [];
    const item = media.find(m => m.type !== "video") || media.find(m => m.type === "video" && m.thumb);
    if (!item) return "";
    if (item.legacy || item.url) return `<img alt="" loading="lazy" src="${escapeAttr(item.url)}">`;
    const path = item.type === "video" ? item.thumb : item.path;
    return `<img alt="" loading="lazy" decoding="async" data-mf-path="${escapeAttr(path)}">`;
  }
  const sortKey = m => `${m.date || ""}|${m.createdAt || ""}`;
  function ago(iso) {
    if (!iso) return "";
    const days = Math.round((new Date(`${localDateInput()}T00:00:00`) - new Date(`${String(iso).slice(0, 10)}T00:00:00`)) / 864e5);
    if (days <= 0) return L("ថ្ងៃនេះ", "today");
    if (days === 1) return L("ម្សិលមិញ", "yesterday");
    if (days < 30) return L(`${days} ថ្ងៃមុន`, `${days} days ago`);
    return typeof formatDate === "function" ? formatDate(String(iso).slice(0, 10)) : String(iso).slice(0, 10);
  }
  const initials = name => String(name || "?").trim().split(/\s+/).map(p => Array.from(p)[0] || "").join("").slice(0, 2).toUpperCase();

  function slides() {
    if (!feed()) return [];
    const mine = (appData.memories || []).filter(m => picture(m));
    const others = (fam()?.othersAsMemories?.() || []).filter(m => picture(m));
    const used = new Set();
    const out = [];
    const take = (memory, kind) => { if (!memory || used.has(memory.id)) return; used.add(memory.id); out.push({ memory, kind }); };
    // 📸 family: newest post from someone else (or one of mine that is shared)
    const shared = [...others, ...mine.filter(m => fam()?.postBySource?.(m.id))].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
    take(shared[0], "family");
    // 🕰️ this day in an earlier year
    const md = localDateInput().slice(5);
    const year = localDateInput().slice(0, 4);
    const past = [...mine, ...others].filter(m => String(m.date || "").slice(5, 10) === md && String(m.date).slice(0, 4) < year).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
    take(past[0], "past");
    // 💜 my newest
    take(mine.slice().sort((a, b) => sortKey(b).localeCompare(sortKey(a)))[0], "mine");
    return out;
  }

  // cards that are not photos (13 Nov): each shows only when it has something real to say
  const today = () => localDateInput();
  function infoCards() {
    const list = [];
    const facts = typeof FamilyV2 !== "undefined" && FamilyV2.sliderFacts ? FamilyV2.sliderFacts() : {};
    const t = today();
    // 🚗 the service closest to (or past) its due date
    if (typeof VehicleDue !== "undefined") {
      let best = null;
      (appData.vehicles || []).forEach(v => (v.services || []).forEach(svc => {
        const st = VehicleDue.status(v, svc, t);
        if (st.p == null || !st.dueDate) return;
        const gap = VehicleDue.daysBetween(t, st.dueDate);
        if (gap <= 14 && (!best || gap < best.gap)) best = { v, svc, gap };
      }));
      if (best) {
        const late = best.gap < 0, n = Math.abs(best.gap);
        list.push({ key: "car", weight: late ? 100 : best.gap <= 3 ? 90 : 40, tone: "car", label: `🚗 ${late ? L("ហួសកំណត់", "Overdue") : L("ឡាន", "Vehicle")}`, big: String(n), unit: late ? L("ថ្ងៃហួស", "days late") : L("ថ្ងៃទៀត", "days left"), sub: `${VehicleDue.name(best.svc.key, true)} · ${best.v.name || ""}`.trim(), href: "#vehicle", go: `⛽ ${L("កត់", "Log")} ›` });
      }
    }
    // 🧾 unpaid invoices
    if (typeof InvoiceDue !== "undefined") {
      const open = (appData.invoices || []).filter(inv => inv && inv.status !== "paid" && InvoiceDue.total(inv) > 0);
      if (open.length) {
        const late = open.filter(inv => /^\d{4}-\d{2}-\d{2}$/.test(inv.due || "") && inv.due < t);
        const sum = open.reduce((total, inv) => total + InvoiceDue.total(inv), 0);
        list.push({ key: "inv", weight: late.length ? 95 : 35, tone: "inv", label: `🧾 ${L("វិក្កយបត្រ", "Invoices")}`, big: String(typeof money === "function" ? money(sum, open[0].currency || "USD") : sum).replace(/<[^>]*>/g, ""), unit: "", sub: L(`មិនទាន់បង់ ${open.length}${late.length ? ` · ហួសកំណត់ ${late.length}` : ""}`, `${open.length} unpaid${late.length ? ` · ${late.length} overdue` : ""}`), href: "#invoice", go: `${L("មើល", "View")} ›` });
      }
    }
    // 💗 close to a 1,000-day mark
    if (facts.love) list.push({ key: "love", weight: facts.love.left <= 30 ? 85 : 30, tone: "love", label: `💗 ${L("ថ្ងៃរួមគ្នា", "Together")}`, big: String(facts.love.days), unit: L("ថ្ងៃ", "days"), sub: facts.love.names, bar: facts.love.progress, faces: facts.love.faces, stats: [[L("ដល់ការរំលឹក", "To the mark"), L(`${facts.love.left} ថ្ងៃ`, `${facts.love.left} days`)], [L("ថ្ងៃទី", "Day"), facts.love.next.toLocaleString()]], sub2: `🎉 ${L(`${facts.love.left} ថ្ងៃទៀតដល់ ${facts.love.next.toLocaleString()}`, `${facts.love.left} days to ${facts.love.next.toLocaleString()}`)}`, href: "#family", go: `${L("មើលគ្រួសារ", "Family")} ›` });
    // 🎂 the next family date
    if (facts.date && facts.date.days <= 30) list.push({ key: "date", weight: facts.date.days <= 7 ? 88 : 45, tone: "bd", label: `${facts.date.icon} ${L("ជិតមកដល់", "Coming up")}`, big: String(facts.date.days), unit: L("ថ្ងៃទៀត", "days"), sub: `${facts.date.title} · ${facts.date.sub}`, href: "#calendar", go: `${L("មើលប្រតិទិន", "Calendar")} ›` });
    // 🏦 joint savings account
    const joint = (appData.savings || []).find(item => item && item.jointWith && Number(item.targetAmount || 0) > 0);
    if (joint) {
      const p = Math.min(100, Math.round((Number(joint.currentAmount || 0) / Number(joint.targetAmount)) * 100));
      list.push({ key: "joint", weight: 50, tone: "joint", label: `🏦 ${L("សន្សំរួម", "Joint savings")}`, big: `${p}%`, unit: "", sub: joint.name || "", bar: p, jar: { p, cur: Number(joint.currentAmount || 0), tgt: Number(joint.targetAmount) }, stats: [[L("មាន", "Saved"), fmt(joint.currentAmount)], [L("គោលដៅ", "Target"), fmt(joint.targetAmount)], [L("ខ្វះ", "Left"), fmt(Math.max(0, Number(joint.targetAmount) - Number(joint.currentAmount || 0)))]], href: "#money/savings", go: `${L("មើលគណនី", "Open")} ›` });
    }
    // 🎯 the goal closest to done
    const goal = (appData.goals || []).filter(g => g && Number(g.targetAmount || 0) > 0 && Number(g.currentAmount || 0) < Number(g.targetAmount)).sort((a, b) => Number(b.currentAmount || 0) / Number(b.targetAmount) - Number(a.currentAmount || 0) / Number(a.targetAmount))[0];
    if (goal) {
      const p = Math.round((Number(goal.currentAmount || 0) / Number(goal.targetAmount)) * 100);
      list.push({ key: "goal", weight: 20, tone: "goal", label: `🎯 ${L("គោលដៅ", "Goal")}`, big: `${p}%`, unit: "", sub: goal.name || goal.title || "", bar: p, goalInfo: { p, cur: Number(goal.currentAmount || 0), tgt: Number(goal.targetAmount) }, stats: [[L("មាន", "Saved"), fmt(goal.currentAmount)], [L("គោលដៅ", "Target"), fmt(goal.targetAmount)], [L("ខ្វះ", "Left"), fmt(Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount || 0)))]], href: "#goals", go: `${L("មើលគោលដៅ", "Goals")} ›` });
    }
    return list.sort((a, b) => b.weight - a.weight).slice(0, 3);
  }
  // one template for every card (14 Nov): light card like the money card — small label, big number + Nomi, bar, 3 mini stats, one link
  const ROLE_OF = { car: "bill", inv: "bill", love: "family", bd: "holiday", joint: "save", goal: "focus", spend: "money" };
  const nomiOf = key => { try { return typeof HomeV2 !== "undefined" && HomeV2.role ? HomeV2.role(ROLE_OF[key] || "money", "happy") : ""; } catch (error) { return ""; } };
  const fmt = n => (typeof formatPlainMoney === "function" ? formatPlainMoney(Number(n) || 0, appData.profile?.currency || "USD") : String(n));
  const DECO = { love: ["💗", "💖", "💕"], bd: ["🎈", "✨", "🎉"], joint: ["🪙", "✨", "🪙"], goal: ["⭐", "✨", "🎯"], spend: ["🪙", "✨", "💸"], car: ["✨", "🔧", "✨"], inv: ["🧾", "✨", "🪙"] };
  const deco = key => `<span class="hs-deco" aria-hidden="true">${(DECO[key] || ["✨", "✨", "✨"]).map(ch => `<i>${ch}</i>`).join("")}</span>`;
  const faces = list => (list && list.length ? `<span class="hs-faces" aria-hidden="true">${list.map(item => `<span class="hs-face">${item.photo ? `<img src="${escapeAttr(item.photo)}" alt="">` : escapeHtml(String(item.name || "?").slice(0, 1).toUpperCase())}</span>`).join("")}<em>♥</em></span>` : "");
  // love card (A, 14 Nov; v2, 15 Nov): landscape like the other cards - names, two photos, two icon tiles, progress to the next mark
  function loveHtml(card) {
    const pics = card.faces.map(item => `<span class="hs-pic">${item.photo ? `<img src="${escapeAttr(item.photo)}" alt="">` : `<i>${escapeHtml(String(item.name || "?").slice(0, 1).toUpperCase())}</i>`}<b>${escapeHtml(item.name || "")}</b></span>`).join("");
    const next = card.stats && card.stats[1] ? card.stats[1][1] : "";
    const left = card.stats && card.stats[0] ? card.stats[0][1] : "";
    const bar = Math.max(0, Math.min(100, card.bar == null ? 0 : card.bar));
    return `<a class="hs-slide hs-info hs-tone-love hs-lovea hs-lovel" href="${card.href}" data-hs-kind="${card.key}">
      ${deco(card.key)}<span class="hs-top"><span class="hs-lab">${escapeHtml(card.label)}</span><span class="hs-gname">${escapeHtml(card.sub || "")}</span></span>
      <span class="hs-pics">${pics}<em aria-hidden="true">♥</em></span>
      <span class="hs-side hs-side2">
        <span class="hs-c is-days"><i class="hs-si" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg></i><em><small>${escapeHtml(L("ថ្ងៃរួមគ្នា", "Together"))}</small><b>${escapeHtml(card.big)} ${escapeHtml(card.unit || "")}</b></em></span>
        <span class="hs-c is-mark"><i class="hs-si" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg></i><em><small>${escapeHtml(L("ថ្ងៃទី", "Day"))} ${escapeHtml(String(next))}</small><b>${escapeHtml(String(left))}</b></em></span>
      </span>
      <span class="hs-bar"><i style="width:${bar}%"></i></span>
      <span class="hs-lrow"><span class="hs-sub">${escapeHtml(card.sub2 || "")}</span><span class="hs-go2">${escapeHtml(card.go)}</span></span>
    </a>`;
  }
  // joint savings (B + polish, 14 Nov): a jar that fills with coins, milestone ticks, small text
  function jointHtml(card) {
    const { p, cur, tgt } = card.jar;
    const pc = Math.max(0, Math.min(100, p)), X0 = 16, W = 268, Y0 = 46, Y1 = 124;
    const fx = X0 + W * pc / 100;
    const next = [25, 50, 75, 100].find(step => step > p) || 100;
    const need = Math.max(0, (tgt * next) / 100 - cur);
    const r1 = n => Math.round(n * 10) / 10;
    // water: fills the tank left → right; the front edge is a gentle wave
    let edge = "";
    for (let y = Y0, k = 0; y < Y1; y += 13, k++) edge += ` Q${r1(fx + (k % 2 ? -5 : 5))} ${r1(y + 6.5)} ${r1(fx)} ${r1(Math.min(Y1, y + 13))}`;
    const water = pc > 0 ? `<path class="hs-wtr" d="M${X0} ${Y0} H${r1(fx)}${edge} H${X0}Z" fill="url(#hs-wt-g)"/>` : "";
    const marks = [25, 50, 75].map(step => { const x = r1(X0 + W * step / 100), on = pc >= step; return `<path d="M${x} ${Y0 + 2}V${Y1 - 2}" stroke="#fff" stroke-opacity="${on ? .75 : .4}" stroke-dasharray="3 4" fill="none"/>`; }).join("");
    const labels = [25, 50, 75].map(step => `<text x="${r1(X0 + W * step / 100)}" y="${Y1 + 12}" text-anchor="middle" font-size="9.5" fill="#fff" opacity="${pc >= step ? 1 : .75}">${step}</text>`).join("");
    const bx = Math.max(26, Math.min(274, fx));
    const bub = `<g><rect x="${r1(bx - 21)}" y="3" width="42" height="20" rx="10" fill="#fff"/><path d="M${r1(bx - 4)} 22.5L${r1(bx)} 28L${r1(bx + 4)} 22.5Z" fill="#fff"/><text x="${r1(bx)}" y="17" text-anchor="middle" font-size="11.5" font-weight="800" fill="#17804a">${p}%</text></g>`;
    const coins = pc < 100 ? `<g class="hs-coinfall2"><circle cx="${r1(Math.max(30, fx))}" cy="34" r="5.5" fill="#ffc94a" stroke="#e29a12" stroke-width="1.4"/><text x="${r1(Math.max(30, fx))}" y="37.4" text-anchor="middle" font-size="8" font-weight="800" fill="#b8730a">$</text></g>` : "";
    const tank = `<svg class="hs-sky hs-tank" viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="hs-tk-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f6b52"/><stop offset=".62" stop-color="#1f9d73"/><stop offset="1" stop-color="#c8f3e1"/></linearGradient><linearGradient id="hs-wt-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7be3b7"/><stop offset="1" stop-color="#2fd39a"/></linearGradient><clipPath id="hs-tk-c"><rect width="300" height="150" rx="26"/></clipPath><clipPath id="hs-tk-i"><rect x="${X0}" y="${Y0}" width="${W}" height="${Y1 - Y0}" rx="16"/></clipPath></defs><rect width="300" height="150" rx="26" fill="url(#hs-tk-g)"/><g clip-path="url(#hs-tk-c)"><ellipse cx="270" cy="150" rx="80" ry="26" fill="#fff" opacity=".35"/><ellipse cx="30" cy="152" rx="90" ry="20" fill="#fff" opacity=".25"/><circle cx="262" cy="22" r="3" fill="#fff" opacity=".5"/><circle cx="40" cy="20" r="2" fill="#fff" opacity=".4"/></g><rect x="${X0}" y="${Y0}" width="${W}" height="${Y1 - Y0}" rx="16" fill="#0b4a3a" fill-opacity=".35"/><g clip-path="url(#hs-tk-i)">${water}${marks}</g><rect x="${X0}" y="${Y0}" width="${W}" height="${Y1 - Y0}" rx="16" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.4"/><rect x="${X0 + 8}" y="${Y0 + 6}" width="${W - 16}" height="5" rx="2.5" fill="#fff" opacity=".18"/>${labels}${coins}${bub}</svg>`;
    return `<a class="hs-slide hs-info hs-tone-joint hs-jointb" href="${card.href}" data-hs-kind="${card.key}">
      ${deco(card.key)}<span class="hs-top"><span class="hs-lab">${escapeHtml(card.label)}</span><span class="hs-gname">${escapeHtml(card.sub || "")}</span></span>
      <span class="hs-jarbox">${tank}
        <span class="hs-side hs-side2">
          <span class="hs-c is-saved"><i class="hs-si" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 8l5-5 5 5"/></svg></i><em><small>${escapeHtml(L("មាន", "Saved"))}</small><b>${escapeHtml(fmt(cur))}</b></em></span>
          <span class="hs-c is-target"><i class="hs-si" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg></i><em><small>${escapeHtml(L("គោលដៅ", "Target"))}</small><b>${escapeHtml(fmt(tgt))}</b></em></span>
          <span class="hs-c is-left"><i class="hs-si" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></i><em><small>${escapeHtml(L("ខ្វះ", "Left"))}</small><b>${escapeHtml(fmt(Math.max(0, tgt - cur)))}</b></em></span>
          <span class="hs-c is-next"><i class="hs-si" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg></i><em><small>${escapeHtml(next === 100 ? L("បានដល់", "Reached") : L(`ដល់ ${next}%`, `To ${next}%`))}</small><b>${escapeHtml(next === 100 ? `${p}%` : fmt(need))}</b></em></span>
        </span>
      </span>
      <span class="hs-lrow"><span class="hs-sub">${escapeHtml(p >= 75 ? L("ជិតពេញហើយ 🎉", "Almost full 🎉") : p >= 25 ? L("កំពុងពេញឡើង 🪙", "Filling up 🪙") : L("ចាប់ផ្តើមហើយ 🪙", "Just started 🪙"))}</span><span class="hs-go2">${escapeHtml(card.go)}</span></span>
    </a>`;
  }
  // goal (H, 14 Nov; v2, 15 Nov): a rocket flies a curved trail from the launch pad to the flag; lit milestones, % bubble, goal name
  function goalHtml(card) {
    const { p, cur, tgt } = card.goalInfo;
    const pc = Math.max(0, Math.min(100, p)), t = pc / 100;
    const P0 = [26, 124], P1 = [128, 22], P2 = [252, 84];
    const bz = u => [0, 1].map(i => (1 - u) * (1 - u) * P0[i] + 2 * (1 - u) * u * P1[i] + u * u * P2[i]);
    const ang = u => { const dx = 2 * (1 - u) * (P1[0] - P0[0]) + 2 * u * (P2[0] - P1[0]), dy = 2 * (1 - u) * (P1[1] - P0[1]) + 2 * u * (P2[1] - P1[1]); return Math.atan2(dy, dx) * 180 / Math.PI; };
    const r1 = n => Math.round(n * 10) / 10;
    const [rx, ry] = bz(Math.max(.03, t)), ra = ang(Math.max(.03, t));
    const q1 = [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t];
    const trailDone = t > .01 ? `<path d="M${P0[0]} ${P0[1]} Q${r1(q1[0])} ${r1(q1[1])} ${r1(bz(t)[0])} ${r1(bz(t)[1])}" fill="none" stroke="url(#hs-trail-g)" stroke-width="3.2" stroke-linecap="round"/>` : "";
    const dots = [25, 50, 75].map(step => { const [x, y] = bz(step / 100), on = pc >= step; return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${on ? 4.6 : 3.4}" fill="${on ? "#ffd86b" : "#2d2478"}" stroke="#fff" stroke-opacity="${on ? 1 : .6}" stroke-width="1.4"/><text x="${r1(x)}" y="${r1(y + 17)}" text-anchor="middle" font-size="9.5" fill="#fff" opacity="${on ? 1 : .7}">${step}</text>`; }).join("");
    const bx = Math.max(24, Math.min(276, rx)), by = Math.max(14, ry - 30);
    const bubble = `<g class="hs-bub"><rect x="${r1(bx - 21)}" y="${r1(by - 11)}" width="42" height="20" rx="10" fill="#fff"/><path d="M${r1(bx - 4)} ${r1(by + 8.5)}L${r1(bx)} ${r1(by + 14)}L${r1(bx + 4)} ${r1(by + 8.5)}Z" fill="#fff"/><text x="${r1(bx)}" y="${r1(by + 3.6)}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#5b49d6">${p}%</text></g>`;
    const rocket = `<svg class="hs-sky" viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="hs-sky-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f2682"/><stop offset=".6" stop-color="#6a58e6"/><stop offset="1" stop-color="#ffc9dd"/></linearGradient><linearGradient id="hs-trail-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb74a" stop-opacity=".25"/><stop offset="1" stop-color="#fff1a8"/></linearGradient><clipPath id="hs-sky-c"><rect width="300" height="150" rx="26"/></clipPath></defs><rect width="300" height="150" rx="26" fill="url(#hs-sky-g)"/><g clip-path="url(#hs-sky-c)"><circle cx="262" cy="26" r="12" fill="#fff6d6" opacity=".95"/><circle cx="267" cy="22" r="10" fill="#4a3ea6" opacity=".5"/><g fill="#fff"><circle class="hs-tw" cx="22" cy="24" r="1.6"/><circle class="hs-tw" cx="96" cy="14" r="1.3" style="animation-delay:.6s"/><circle class="hs-tw" cx="196" cy="30" r="1.4" style="animation-delay:1.2s"/><circle class="hs-tw" cx="232" cy="52" r="1.2" style="animation-delay:.3s"/><circle class="hs-tw" cx="60" cy="52" r="1.2" style="animation-delay:.9s"/></g><ellipse cx="40" cy="152" rx="120" ry="22" fill="#fff" opacity=".28"/><ellipse cx="262" cy="150" rx="70" ry="26" fill="#fff" opacity=".4"/><path d="M${P0[0]} ${P0[1]} Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>${trailDone}${dots}<rect x="14" y="124" width="26" height="5" rx="2.5" fill="#fff" opacity=".9"/><path d="M${P2[0]} ${P2[1] + 6}V${P2[1] - 22}" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M${P2[0] + 1} ${P2[1] - 22}L${P2[0] + 18} ${P2[1] - 15}L${P2[0] + 1} ${P2[1] - 8}Z" fill="#ff4f86"/><ellipse cx="${P2[0]}" cy="${P2[1] + 7}" rx="12" ry="3.2" fill="#fff" opacity=".85"/><g class="hs-rk-bob"><g transform="translate(${r1(rx)} ${r1(ry)}) rotate(${r1(ra)}) scale(.78)"><g class="hs-flame"><path d="M-22 0 Q-40 -9 -54 0 Q-40 9 -22 0Z" fill="#ffb74a"/><path d="M-22 0 Q-32 -4 -42 0 Q-32 4 -22 0Z" fill="#fff1a8"/></g><g transform="rotate(90)"><path d="M0 -26 C14 -10 14 14 8 28 H-8 C-14 14 -14 -10 0 -26Z" fill="#fff"/><path d="M-8 28 L-17 38 L-6 22Z M8 28 L17 38 L6 22Z" fill="#ff6f91"/><circle cx="0" cy="-4" r="6" fill="#7b68ee"/><circle cx="-1.5" cy="-5.5" r="2" fill="#fff" opacity=".7"/></g></g></g>${bubble}</g></svg>`;
    const next = [25, 50, 75, 100].find(step => step > p) || 100;
    const need = Math.max(0, (tgt * next) / 100 - cur);
    return `<a class="hs-slide hs-info hs-tone-goal hs-jointb" href="${card.href}" data-hs-kind="${card.key}">
      ${deco(card.key)}<span class="hs-top"><span class="hs-lab">${escapeHtml(card.label)}</span><span class="hs-gname">${escapeHtml(card.sub || "")}</span></span>
      <span class="hs-jarbox">${rocket}
        <span class="hs-side hs-side2">
          <span class="hs-c is-saved"><i class="hs-si" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 8l5-5 5 5"/></svg></i><em><small>${escapeHtml(L("មាន", "Saved"))}</small><b>${escapeHtml(fmt(cur))}</b></em></span>
          <span class="hs-c is-target"><i class="hs-si" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg></i><em><small>${escapeHtml(L("គោលដៅ", "Target"))}</small><b>${escapeHtml(fmt(tgt))}</b></em></span>
          <span class="hs-c is-left"><i class="hs-si" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></i><em><small>${escapeHtml(L("ខ្វះ", "Left"))}</small><b>${escapeHtml(fmt(Math.max(0, tgt - cur)))}</b></em></span>
          <span class="hs-c is-next"><i class="hs-si" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg></i><em><small>${escapeHtml(next === 100 ? L("ដល់ទង់", "To the flag") : L(`ដល់ ${next}%`, `To ${next}%`))}</small><b>${escapeHtml(fmt(need))}</b></em></span>
        </span>
      </span>
      <span class="hs-lrow"><span class="hs-sub">${escapeHtml(p >= 75 ? L("ជិតដល់ទង់ហើយ 🚩", "Almost at the flag 🚩") : p >= 25 ? L("កំពុងឡើងល្អ 🚀", "Climbing nicely 🚀") : L("ចាប់ផ្តើមហើយ 🚀", "Lift-off 🚀"))}</span><span class="hs-go2">${escapeHtml(card.go)}</span></span>
    </a>`;
  }
  function infoHtml(card) {
    if (card.key === "goal" && card.goalInfo) return goalHtml(card);
    if (card.key === "joint" && card.jar) return jointHtml(card);
    if (card.key === "love" && card.faces && card.faces.length) return loveHtml(card);
    const stats = (card.stats || []).slice(0, 3);
    return `<a class="hs-slide hs-info hs-tone-${card.tone}" href="${card.href}" data-hs-kind="${card.key}">
      ${deco(card.key)}<span class="hs-top"><span class="hs-lab">${escapeHtml(card.label)}</span></span>
      <span class="hs-row"><span class="hs-main">${faces(card.faces)}<b class="hs-big">${escapeHtml(card.big)}${card.unit ? `<small>${escapeHtml(card.unit)}</small>` : ""}</b><span class="hs-sub">${escapeHtml(card.sub || "")}</span></span><span class="hs-nomi" aria-hidden="true">${nomiOf(card.key)}</span></span>
      ${card.bar != null ? `<span class="hs-bar"><i style="width:${Math.max(0, Math.min(100, card.bar))}%"></i></span>` : ""}
      ${stats.length ? `<span class="hs-stats">${stats.map(row => `<span><small>${escapeHtml(row[0])}</small><b>${escapeHtml(row[1])}</b></span>`).join("")}</span>` : ""}
      <span class="hs-go2">${escapeHtml(card.go)}</span>
    </a>`;
  }

  function slideHtml({ memory, kind }) {
    const count = (feed()?.mediaOf(memory) || []).length;
    const label = kind === "family" ? `📸 ${L("គ្រួសារ", "Family")}` : kind === "past" ? `🕰️ ${L(`ថ្ងៃនេះ ${Number(localDateInput().slice(0, 4)) - Number(String(memory.date).slice(0, 4))} ឆ្នាំមុន`, `${Number(localDateInput().slice(0, 4)) - Number(String(memory.date).slice(0, 4))} yr ago today`)}` : `💜 ${L("អនុស្សាវរីយ៍ខ្ញុំ", "My memory")}`;
    const author = memory.family ? { name: memory.authorName, photo: memory.authorPhoto } : { name: appData.profile?.name || L("ខ្ញុំ", "Me"), photo: appData.profile?.photo };
    const face = author.photo && !String(author.photo).startsWith("data:video") ? `<img src="${escapeAttr(author.photo)}" alt="">` : escapeHtml(initials(author.name));
    const caption = memory.title || memory.description || memory.location || "";
    const fp = memory.family ? memory.familyPostId : fam()?.postBySource?.(memory.id)?.id || "";
    const likes = fp && fam()?.likesOf ? fam().likesOf(fp).length : 0;
    const comments = fp && fam()?.commentsOf ? fam().commentsOf(fp).length : 0;
    return `<a class="hs-slide hs-photo mf-media-box" href="#memories" data-hs-kind="${kind}">
      ${picture(memory)}
      <span class="hs-shade" aria-hidden="true"></span>
      <span class="hs-top"><span class="hs-lab">${escapeHtml(label)}</span>${count > 1 ? `<span class="hs-cnt">📷 ${count}</span>` : ""}</span>
      <span class="hs-bot">
        <span class="hs-who"><span class="hs-av">${face}</span><span><b>${escapeHtml(author.name || "")}</b> · ${escapeHtml(ago(memory.date || memory.createdAt))}</span></span>
        ${caption ? `<b class="hs-cap">${escapeHtml(caption)}</b>` : ""}
        <span class="hs-acts">${likes ? `<span>❤️ ${likes}</span>` : ""}${comments ? `<span>💬 ${comments}</span>` : ""}<span class="hs-go">${escapeHtml(L("មើល", "View"))} ›</span></span>
      </span>
    </a>`;
  }

  // wrap the untouched money card; nothing changes when there is no photo
  function wrap(moneyHtml) {
    const photos = slides();
    let info = [];
    try { info = infoCards(); } catch (error) { info = []; }
    // urgent info cards (vehicle overdue, 1,000-day mark…) go right after the money card, the rest after the photos
    const urgent = info.filter(card => card.weight >= 85), calm = info.filter(card => card.weight < 85);
    const spend = typeof SmartSpend !== "undefined" && SmartSpend.slide ? SmartSpend.slide() : "";
    const parts = [...(spend ? [spend] : []), ...urgent.map(infoHtml), ...photos.map(slideHtml), ...calm.map(infoHtml)].slice(0, 5);
    if (!moneyHtml) return typeof SmartSpend !== "undefined" ? SmartSpend.card() : moneyHtml;
    if (!parts.length) return moneyHtml;
    const n = parts.length + 1;
    return `<div class="hs-wrap" data-hs>
      <div class="hs-track" data-hs-track><div class="hs-slide hs-money">${moneyHtml}</div>${parts.join("")}</div>
      <div class="hs-dots" role="tablist" aria-label="${escapeAttr(L("កាត", "Cards"))}">${Array.from({ length: n }, (_, i) => `<button type="button" class="${i ? "" : "is-on"}" data-hs-dot="${i}" aria-label="${i + 1} / ${n}"></button>`).join("")}</div>
    </div>`;
  }

  function bind() {
    const wrapEl = document.querySelector("[data-hs]");
    if (!wrapEl || wrapEl.dataset.bound) return;
    wrapEl.dataset.bound = "1";
    const track = wrapEl.querySelector("[data-hs-track]");
    const dots = [...wrapEl.querySelectorAll("[data-hs-dot]")];
    const step = () => (track.children[0]?.getBoundingClientRect().width || 1) + 12;
    const index = () => Math.round(track.scrollLeft / step());
    const sync = () => {
      const i = index();
      dots.forEach((dot, k) => dot.classList.toggle("is-on", k === i));
      try { sessionStorage.setItem(KEY, String(i)); } catch (error) { /* private mode */ }
    };
    let raf = 0;
    track.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
    dots.forEach(dot => dot.addEventListener("click", () => track.scrollTo({ left: Number(dot.dataset.hsDot) * step(), behavior: "smooth" })));
    // come back to the card you were looking at (same visit only)
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(KEY) || 0); } catch (error) { saved = 0; }
    if (saved > 0 && saved < dots.length) { track.scrollLeft = saved * step(); sync(); }
    // ⏯ auto slide (draft A, 13 Nov)
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let timer = 0, holdUntil = 0, visible = true, auto = false;
    const tick = () => {
      if (!document.body.contains(track)) { clearInterval(timer); return; }
      if (!visible || document.hidden || Date.now() < holdUntil || document.querySelector("#modalRoot.open")) return;
      const next = index() + 1 >= dots.length ? 0 : index() + 1;
      auto = true;
      track.scrollTo({ left: next * step(), behavior: "smooth" });
      setTimeout(() => { auto = false; }, 900);
    };
    const hold = ms => { holdUntil = Date.now() + ms; };
    if (!still && dots.length > 1) {
      timer = setInterval(tick, 5000);
      ["pointerdown", "touchstart", "wheel", "focusin"].forEach(type => track.addEventListener(type, () => hold(12000), { passive: true }));
      track.addEventListener("mouseenter", () => hold(60000));
      track.addEventListener("mouseleave", () => hold(3000));
      track.addEventListener("scroll", () => { if (!auto) hold(12000); }, { passive: true });
      dots.forEach(dot => dot.addEventListener("click", () => hold(12000)));
      if ("IntersectionObserver" in window) new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting !== false; }, { threshold: 0.5 }).observe(track);
    }
    // photos from the private bucket
    if (feed()?.resolveIn) feed().resolveIn(track);
  }

  return { wrap, bind, slides };
})();
