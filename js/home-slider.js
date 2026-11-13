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
    const list = slides();
    if (!list.length || !moneyHtml) return moneyHtml;
    const n = list.length + 1;
    return `<div class="hs-wrap" data-hs>
      <div class="hs-track" data-hs-track><div class="hs-slide hs-money">${moneyHtml}</div>${list.map(slideHtml).join("")}</div>
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
