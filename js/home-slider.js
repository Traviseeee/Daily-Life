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
      list.push({ key: "joint", weight: 50, tone: "joint", label: `🏦 ${L("សន្សំរួម", "Joint savings")}`, big: `${p}%`, unit: "", sub: joint.name || "", bar: p, stats: [[L("មាន", "Saved"), fmt(joint.currentAmount)], [L("គោលដៅ", "Target"), fmt(joint.targetAmount)], [L("ខ្វះ", "Left"), fmt(Math.max(0, Number(joint.targetAmount) - Number(joint.currentAmount || 0)))]], href: "#money/savings", go: `${L("មើលគណនី", "Open")} ›` });
    }
    // 🎯 the goal closest to done
    const goal = (appData.goals || []).filter(g => g && Number(g.targetAmount || 0) > 0 && Number(g.currentAmount || 0) < Number(g.targetAmount)).sort((a, b) => Number(b.currentAmount || 0) / Number(b.targetAmount) - Number(a.currentAmount || 0) / Number(a.targetAmount))[0];
    if (goal) {
      const p = Math.round((Number(goal.currentAmount || 0) / Number(goal.targetAmount)) * 100);
      list.push({ key: "goal", weight: 20, tone: "goal", label: `🎯 ${L("គោលដៅ", "Goal")}`, big: `${p}%`, unit: "", sub: goal.name || goal.title || "", bar: p, stats: [[L("មាន", "Saved"), fmt(goal.currentAmount)], [L("គោលដៅ", "Target"), fmt(goal.targetAmount)], [L("ខ្វះ", "Left"), fmt(Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount || 0)))]], href: "#goals", go: `${L("មើលគោលដៅ", "Goals")} ›` });
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
  function infoHtml(card) {
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
