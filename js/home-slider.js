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
  // love card (A, 14 Nov): two big photos, small text under them
  function loveHtml(card) {
    const pics = card.faces.map(item => `<span class="hs-pic">${item.photo ? `<img src="${escapeAttr(item.photo)}" alt="">` : `<i>${escapeHtml(String(item.name || "?").slice(0, 1).toUpperCase())}</i>`}<b>${escapeHtml(item.name || "")}</b></span>`).join("");
    return `<a class="hs-slide hs-info hs-tone-love hs-lovea" href="${card.href}" data-hs-kind="${card.key}">
      ${deco(card.key)}<span class="hs-top"><span class="hs-lab">${escapeHtml(card.label)}</span></span>
      <span class="hs-pics">${pics}<em aria-hidden="true">♥</em></span>
      <span class="hs-lrow"><span class="hs-main"><b class="hs-big">${escapeHtml(card.big)}<small>${escapeHtml(L("ថ្ងៃរួមគ្នា", "days together"))}</small></b><span class="hs-sub">${escapeHtml(card.sub2 || "")}</span></span><span class="hs-go2">${escapeHtml(card.go)}</span></span>
      ${card.bar != null ? `<span class="hs-bar"><i style="width:${Math.max(0, Math.min(100, card.bar))}%"></i></span>` : ""}
    </a>`;
  }
  // joint savings (B + polish, 14 Nov): a jar that fills with coins, milestone ticks, small text
  function jointHtml(card) {
    const { p, cur, tgt } = card.jar;
    const next = [25, 50, 75, 100].find(step => step > p) || 100;
    const need = Math.max(0, (tgt * next) / 100 - cur);
    const ticks = [25, 50, 75].map(step => `<span class="hs-tick${p >= step ? " on" : ""}" style="bottom:${step}%"><em>${step}</em></span>`).join("");
    return `<a class="hs-slide hs-info hs-tone-joint hs-jointb" href="${card.href}" data-hs-kind="${card.key}">
      ${deco(card.key)}<span class="hs-top"><span class="hs-lab">${escapeHtml(card.label)}</span></span>
      <span class="hs-jarbox">
        <span class="hs-jar" aria-hidden="true"><span class="hs-jar-lid"></span><span class="hs-jar-body"><span class="hs-water" style="--lv:${Math.max(4, Math.min(100, p))}%"></span>${ticks}<b class="hs-jar-pct">${p}%</b></span><span class="hs-coin c1">🪙</span><span class="hs-coin c2">🪙</span></span>
        <span class="hs-side"><span><small>${escapeHtml(L("គណនី", "Account"))}</small><b>${escapeHtml(card.sub || "")}</b></span><span><small>${escapeHtml(L("មាន", "Saved"))}</small><b>${escapeHtml(fmt(cur))}</b></span><span><small>${escapeHtml(L("ខ្វះ", "Left"))}</small><b>${escapeHtml(fmt(Math.max(0, tgt - cur)))}</b></span><span><small>${escapeHtml(L(`ដល់ ${next}%`, `To ${next}%`))}</small><b>${escapeHtml(fmt(need))}</b></span></span>
      </span>
      <span class="hs-lrow"><span class="hs-sub">${escapeHtml(L(`គោលដៅ ${fmt(tgt)}`, `Target ${fmt(tgt)}`))}</span><span class="hs-go2">${escapeHtml(card.go)}</span></span>
    </a>`;
  }
  // goal (H, 14 Nov): a rocket climbing a night sky toward the flag; same layout as the jar
  function goalHtml(card) {
    const { p, cur, tgt } = card.goalInfo;
    const ty = Math.max(24, Math.min(150, 180 - 1.6 * p));
    const rocket = `<svg class="hs-sky" width="140" height="196" viewBox="0 0 140 196" aria-hidden="true"><defs><linearGradient id="hs-sky-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2f8f"/><stop offset=".6" stop-color="#7b68ee"/><stop offset="1" stop-color="#ffc9dd"/></linearGradient><clipPath id="hs-sky-c"><rect width="140" height="196" rx="30"/></clipPath></defs><rect width="140" height="196" rx="30" fill="url(#hs-sky-g)"/><g clip-path="url(#hs-sky-c)"><circle cx="106" cy="30" r="13" fill="#fff6d6"/><circle cx="111" cy="26" r="11" fill="#4a3ea6" opacity=".55"/><g fill="#fff"><circle class="hs-tw" cx="24" cy="26" r="1.6"/><circle class="hs-tw" cx="60" cy="14" r="1.3" style="animation-delay:.6s"/><circle class="hs-tw" cx="40" cy="58" r="1.4" style="animation-delay:1.2s"/><circle class="hs-tw" cx="88" cy="64" r="1.2" style="animation-delay:.3s"/></g><g class="hs-cloud"><ellipse cx="20" cy="158" rx="22" ry="8" fill="#fff" opacity=".8"/><ellipse cx="34" cy="154" rx="14" ry="8" fill="#fff" opacity=".8"/></g><g stroke="#fff" stroke-opacity=".55" stroke-dasharray="3 4"><path d="M10 148H130"/><path d="M10 112H130"/><path d="M10 76H130"/></g><g font-size="9" fill="#fff" opacity=".85"><text x="112" y="146">25</text><text x="112" y="110">50</text><text x="112" y="74">75</text></g><text x="8" y="30" font-size="15">🚩</text><g class="hs-rk-bob"><g transform="translate(70 ${ty})"><g class="hs-flame"><path d="M-6 28 Q0 54 6 28Z" fill="#ffb74a"/><path d="M-3 28 Q0 44 3 28Z" fill="#fff1a8"/></g><path d="M0 -26 C14 -10 14 14 8 28 H-8 C-14 14 -14 -10 0 -26Z" fill="#fff"/><path d="M-8 28 L-17 38 L-6 22Z M8 28 L17 38 L6 22Z" fill="#ff6f91"/><circle cx="0" cy="-4" r="6" fill="#7b68ee"/><circle cx="-1.5" cy="-5.5" r="2" fill="#fff" opacity=".7"/></g></g></g></svg>`;
    return `<a class="hs-slide hs-info hs-tone-goal hs-jointb" href="${card.href}" data-hs-kind="${card.key}">
      ${deco(card.key)}<span class="hs-top"><span class="hs-lab">${escapeHtml(card.label)}</span></span>
      <span class="hs-jarbox">${rocket}
        <span class="hs-side"><span><small>${escapeHtml(L("គោលដៅ", "Goal"))}</small><b>${escapeHtml(card.sub || "")}</b></span><span><small>${escapeHtml(L("បានដល់", "Reached"))}</small><b class="hs-side-big">${p}%</b></span><span><small>${escapeHtml(L("មាន", "Saved"))}</small><b>${escapeHtml(fmt(cur))}</b></span><span><small>${escapeHtml(L("ខ្វះ", "Left"))}</small><b>${escapeHtml(fmt(Math.max(0, tgt - cur)))}</b></span></span>
      </span>
      <span class="hs-lrow"><span class="hs-sub">${escapeHtml(p >= 75 ? L("ជិតដល់ទង់ហើយ 🚩", "Almost at the flag 🚩") : L("បន្តទៅមុខ 🚀", "Keep going 🚀"))}</span><span class="hs-go2">${escapeHtml(card.go)}</span></span>
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
