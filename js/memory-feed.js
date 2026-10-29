/* MYLIFE Memories feed — a small family Instagram.
 *
 * Views: Feed (post cards with photo carousel, ❤️ double-tap, 💬 comments,
 * 📍 place, tagged people, month dividers, load more on scroll) · Grid (3
 * columns) · Reels (full-screen vertical videos, autoplay muted, tap = sound).
 * Top: round family avatars → filter posts with that person.
 *
 * Data: each post is a normal record in appData.memories (so sync, JSON
 * export/import and old memories keep working). New posts add:
 *   media: [{ path, thumb, type: "image" | "video", w, h, size, thumbSize, duration }]
 *   tagIds, liked, comments: [{ id, text, at }]
 * Photos and videos never go in the payload: they are uploaded to the PRIVATE
 * Supabase bucket "family-media" (users/<uid>/posts/<postId>/…) and shown with
 * short-lived signed URLs. Old memories (memory.photo) still show as 1-photo posts.
 */
const MemoryFeed = (() => {
  const BUCKET = "family-media";
  const PAGE = 8;
  const MAX_PHOTOS = 10;
  const MAX_VIDEO_SECONDS = 60;
  const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
  const FREE_BYTES = 1024 * 1024 * 1024;
  const KM_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];

  // grid first (short page), 18 photos at a time; Feed / Reels one tap away
  const GRID_PAGE = 18;
  const state = { view: "grid", person: "", search: "", limit: PAGE, scope: "all", searchOpen: false, gridLimit: GRID_PAGE };
  let familySig = "";
  const signed = new Map(); // path → { url, exp }
  let observer = null;
  let reelObserver = null;
  let reelsMuted = true;

  const km = () => languageCode() === "km";
  const L = (kmText, enText) => (km() ? kmText : enText);

  /* ---------- data helpers ---------- */
  function mediaOf(memory) {
    if (Array.isArray(memory.media) && memory.media.length) return memory.media;
    return memory.photo ? [{ url: memory.photo, type: "image", legacy: true }] : [];
  }
  const isVideoPost = memory => mediaOf(memory).some(item => item.type === "video");
  const sortKey = memory => `${memory.date || ""}|${memory.createdAt || ""}`;

  // family (Part 2B): posts shared by other members come from FamilyPosts;
  // my own shared posts stay my memories and get the family ❤️ / 💬 on top
  const fam = () => (typeof FamilyPosts !== "undefined" && FamilyPosts.active() ? FamilyPosts : null);
  const fpIdOf = memory => (memory.family ? memory.familyPostId : fam()?.postBySource(memory.id)?.id || "");
  function allPosts() {
    const mine = state.scope === "family" ? [] : (appData.memories || []);
    const others = state.scope === "mine" ? [] : (fam()?.othersAsMemories() || []);
    const list = state.scope === "family" ? [...(appData.memories || []).filter(memory => fpIdOf(memory)), ...others] : [...mine, ...others];
    return list.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  }

  function personMatch(memory, member) {
    if (Array.isArray(memory.tagIds) && memory.tagIds.includes(member.id)) return true;
    const names = String(memory.familyMembers || "").toLowerCase().split(",").map(item => item.trim()).filter(Boolean);
    return Boolean(member.name) && names.includes(String(member.name).toLowerCase().trim());
  }

  function filtered() {
    const member = state.person ? (appData.family || []).find(item => item.id === state.person) : null;
    const query = state.search.trim().toLowerCase();
    return allPosts().filter(memory => {
      if (member && !personMatch(memory, member)) return false;
      if (!query) return true;
      return [memory.title, memory.description, memory.location, memory.familyMembers, memory.tags].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }

  function usedBytes() {
    return (appData.memories || []).reduce((total, memory) => total + (Array.isArray(memory.media) ? memory.media.reduce((sum, item) => sum + Number(item.size || 0) + Number(item.thumbSize || 0), 0) : 0), 0);
  }
  const mb = bytes => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

  function relative(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "";
    const days = Math.round((new Date(`${localDateInput()}T00:00:00`) - new Date(`${date}T00:00:00`)) / 86400000);
    if (days === 0) return L("ថ្ងៃនេះ", "Today");
    if (days === 1) return L("ម្សិលមិញ", "Yesterday");
    if (days > 1 && days < 7) return L(`${days} ថ្ងៃមុន`, `${days} days ago`);
    if (days >= 7 && days < 30) return L(`${Math.floor(days / 7)} សប្តាហ៍មុន`, `${Math.floor(days / 7)} weeks ago`);
    return formatDate(date);
  }

  function monthLabel(date) {
    const [y, m] = String(date || "").split("-").map(Number);
    if (!y || !m) return L("គ្មានថ្ងៃ", "No date");
    return km() ? `${KM_MONTHS[m - 1]} ${y}` : new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  }

  function avatar(person, extra = "") {
    const photo = person?.photo && !String(person.photo).startsWith("data:video") ? person.photo : "";
    return `<span class="mf-face ${extra}">${photo ? `<img src="${escapeAttr(photo)}" alt="" loading="lazy">` : escapeHtml(initials(person?.name))}</span>`;
  }

  /* ---------- signed URLs for the private bucket ---------- */
  async function resolveMedia(root = document) {
    const nodes = [...root.querySelectorAll("[data-mf-path]")].filter(node => !node.dataset.mfReady);
    if (!nodes.length) return;
    const now = Date.now();
    const missing = [...new Set(nodes.map(node => node.dataset.mfPath).filter(path => !(signed.get(path)?.exp > now)))];
    if (missing.length && window.supabaseClient?.storage) {
      try {
        const { data, error } = await window.supabaseClient.storage.from(BUCKET).createSignedUrls(missing, 3600);
        if (error) throw error;
        (data || []).forEach(row => { if (row.signedUrl) signed.set(row.path, { url: row.signedUrl, exp: now + 50 * 60 * 1000 }); });
      } catch (error) {
        console.warn("MYLIFE memories: signed URLs failed", error);
      }
    }
    nodes.forEach(node => {
      const hit = signed.get(node.dataset.mfPath);
      if (!hit) { node.closest(".mf-media-box")?.classList.add("is-missing"); return; }
      node.setAttribute(node.dataset.mfAttr || "src", hit.url);
      node.dataset.mfReady = "1";
    });
  }

  // <img> / <video> markup for one media item (legacy items have a direct url)
  function mediaTag(item, { thumb = false, reel = false } = {}) {
    if (item.type === "video") {
      if (thumb) return item.thumb ? `<img alt="" loading="lazy" data-mf-path="${escapeAttr(item.thumb)}">` : `<span class="mf-noimg">🎬</span>`;
      return `<video ${reel ? "loop muted playsinline preload=\"metadata\"" : "controls playsinline preload=\"none\""} data-mf-path="${escapeAttr(item.path)}" ${item.thumb ? `poster="" data-mf-poster="${escapeAttr(item.thumb)}"` : ""}></video>`;
    }
    if (item.legacy || item.url) return `<img alt="" loading="lazy" src="${escapeAttr(item.url)}">`;
    const path = thumb && item.thumb ? item.thumb : item.path;
    return `<img alt="" loading="lazy" decoding="async" data-mf-path="${escapeAttr(path)}">`;
  }

  // posters of videos are separate files: resolve them too
  function expandPosters(root) {
    root.querySelectorAll("video[data-mf-poster]").forEach(video => {
      if (video.dataset.mfPosterDone) return;
      video.dataset.mfPosterDone = "1";
      const holder = document.createElement("span");
      holder.hidden = true;
      holder.dataset.mfPath = video.dataset.mfPoster;
      holder.dataset.mfAttr = "data-src";
      video.after(holder);
      const apply = () => { if (holder.dataset.mfReady) video.poster = holder.getAttribute("data-src"); };
      holder._apply = apply;
    });
  }

  async function resolveAll(root) {
    expandPosters(root);
    await resolveMedia(root);
    root.querySelectorAll("video[data-mf-poster] + span[data-mf-path]").forEach(holder => holder._apply?.());
  }

  /* ---------- rendering ---------- */
  function render() {
    const posts = filtered();
    const people = (appData.family || []).filter(member => member.name);
    const used = usedBytes();
    const videoCount = allPosts().filter(isVideoPost).length;
    return `
      <section class="page mf-page mf2">
        <header class="mf2-hero">
          <div class="mf2-top">
            <h1 class="mf2-title">${t("memories")}</h1>
            <button class="mf2-ib" type="button" data-mf2-search aria-pressed="${state.searchOpen || state.search ? "true" : "false"}" aria-label="${escapeAttr(L("ស្វែងរក", "Search"))}">${Icons.search()}</button>
            <button class="mf-add" type="button" data-mf-new aria-label="${escapeAttr(L("Post ថ្មី", "New post"))}" title="${escapeAttr(L("Post ថ្មី", "New post"))}">${Icons.plus()}</button>
          </div>
          <p class="mf-usage">📦 ${(appData.memories || []).length} ${L("អនុស្សាវរីយ៍", "memories")} · ${escapeHtml(mb(used))} / 1 GB <span class="mf2-bar"><i style="width:${Math.max(2, Math.min(100, used / (1024 * 1024 * 1024) * 100)).toFixed(1)}%"></i></span></p>
          <div class="mf-people" role="list">
            <button type="button" class="mf-person ${state.person ? "" : "active"}" data-mf-person=""><span class="mf-face mf-face-all">${Icons.family()}</span><small>${escapeHtml(L("ទាំងអស់", "All"))}</small></button>
            ${people.map(member => `<button type="button" class="mf-person ${state.person === member.id ? "active" : ""}" data-mf-person="${escapeAttr(member.id)}">${avatar(member)}<small>${escapeHtml(member.name)}</small></button>`).join("")}
            <a class="mf-person mf2-add-person" href="#family"><span class="mf-face">＋</span><small>${escapeHtml(L("បន្ថែម", "Add"))}</small></a>
          </div>
        </header>

        ${scopeHtml()}

        ${onThisDay()}

        <div class="mf-bar">
          <div class="mf-views" role="tablist">
            ${[["feed", L("Feed", "Feed")], ["grid", L("Grid", "Grid")], ["reels", `Reels${videoCount ? ` · ${videoCount}` : ""}`]].map(([id, label]) => `<button type="button" role="tab" class="mf-view ${state.view === id ? "active" : ""}" data-mf-view="${id}" aria-selected="${state.view === id}">${escapeHtml(label)}</button>`).join("")}
          </div>
          ${state.searchOpen || state.search ? `<label class="mf-search"><span aria-hidden="true">${Icons.search()}</span><input type="search" data-mf-search value="${escapeAttr(state.search)}" placeholder="${escapeAttr(L("ស្វែងរក…", "Search…"))}"></label>` : ""}
        </div>

        ${posts.length ? (state.view === "grid" ? gridHtml(posts.slice(0, state.gridLimit)) + (posts.length > state.gridLimit ? `<button type="button" class="mf-grid-more" data-mf-grid-more>${escapeHtml(L(`មើលបន្ថែម (${posts.length - state.gridLimit} ទៀត)`, `Show more (${posts.length - state.gridLimit})`))}</button>` : "") : `<div class="mf-feed" data-mf-feed>${feedHtml(posts, 0, state.limit)}</div>${posts.length > state.limit ? `<div class="mf-more" data-mf-more>${L("កំពុងផ្ទុក…", "Loading…")}</div>` : ""}`) : emptyHtml()}
      </section>`;
  }

  function scopeHtml() {
    const family = fam();
    if (!family) return "";
    const unshared = family.canPost() ? (appData.memories || []).filter(memory => family.shareable(memory) && !family.postBySource(memory.id)).length : 0;
    return `<div class="mf-scope" role="tablist">
        ${[["all", L("ទាំងអស់", "All")], ["mine", L("របស់ខ្ញុំ", "Mine")], ["family", `👨‍👩‍👧 ${L("គ្រួសារ", "Family")}`]].map(([id, label]) => `<button type="button" role="tab" class="mf-scope-btn ${state.scope === id ? "active" : ""}" data-mf-scope="${id}" aria-selected="${state.scope === id}">${escapeHtml(label)}</button>`).join("")}
      </div>
      ${state.scope === "family" && unshared ? `<button type="button" class="mf-share-old" data-mf-share-old>📤 ${escapeHtml(L(`ចែករំលែកអនុស្សាវរីយ៍ចាស់ៗរបស់ខ្ញុំ (${unshared})`, `Share my older memories (${unshared})`))}</button>` : ""}`;
  }

  function emptyHtml() {
    const any = (appData.memories || []).length;
    return `<div class="mf-empty glass-card">
      <span class="mf-empty-icon">📸</span>
      <h2>${escapeHtml(any ? L("រកមិនឃើញ post", "No posts found") : L("មិនទាន់មានអនុស្សាវរីយ៍", "No memories yet"))}</h2>
      <p class="secondary">${escapeHtml(any ? L("សាកជ្រើសមនុស្ស ឬពាក្យផ្សេង", "Try another person or word") : L("ចុច ＋ ដើម្បី post រូប ឬវីដេអូដំបូង", "Tap ＋ to post your first photos or video"))}</p>
      ${any ? "" : `<button class="button" type="button" data-mf-new>${Icons.plus()} ${escapeHtml(L("Post ថ្មី", "New post"))}</button>`}
    </div>`;
  }

  function onThisDay() {
    const today = localDateInput();
    const matches = allPosts().filter(memory => /^\d{4}-\d{2}-\d{2}$/.test(memory.date || "") && memory.date.slice(5) === today.slice(5) && memory.date.slice(0, 4) < today.slice(0, 4));
    if (!matches.length) return "";
    const first = matches[0];
    const years = Number(today.slice(0, 4)) - Number(first.date.slice(0, 4));
    const item = mediaOf(first)[0];
    return `<button type="button" class="mf-otd" data-mf-jump="${escapeAttr(first.id)}">
      <span class="mf-otd-thumb mf-media-box">${item ? mediaTag(item, { thumb: true }) : "📅"}</span>
      <span class="mf-otd-text"><strong>📅 ${escapeHtml(L(`${years} ឆ្នាំមុន ថ្ងៃនេះ`, `${years} year${years > 1 ? "s" : ""} ago today`))}</strong><em>${escapeHtml(first.title || first.description || first.location || formatDate(first.date))}${matches.length > 1 ? ` · +${matches.length - 1}` : ""}</em></span>
      <span class="mf2-go">${escapeHtml(L("មើល ›", "View ›"))}</span>
    </button>`;
  }

  function monthCount(posts, key) {
    const n = posts.filter(memory => String(memory.date || "").slice(0, 7) === key).length;
    return `<em>· ${n} ${L("ប៉ុស្ត៍", n === 1 ? "post" : "posts")}</em>`;
  }

  function feedHtml(posts, from, to, previousMonth = "") {
    let month = previousMonth || (from > 0 ? String(posts[from - 1]?.date || "").slice(0, 7) : "");
    return posts.slice(from, to).map(memory => {
      const key = String(memory.date || "").slice(0, 7);
      const divider = key !== month ? `<div class="mf-month"><span>${escapeHtml(monthLabel(memory.date))} ${monthCount(posts, key)}</span></div>` : "";
      month = key;
      return divider + postHtml(memory);
    }).join("");
  }

  function taggedPeople(memory) {
    const byId = (memory.tagIds || []).map(id => (appData.family || []).find(member => member.id === id)).filter(Boolean).map(member => member.name);
    const names = String(memory.familyMembers || "").split(",").map(item => item.trim()).filter(Boolean);
    return [...new Set([...byId, ...names])];
  }

  function postHtml(memory) {
    const media = mediaOf(memory);
    const me = memory.family ? { name: memory.authorName } : { name: appData.profile?.name || L("ខ្ញុំ", "Me"), photo: appData.profile?.photo };
    const tags = taggedPeople(memory);
    const fpId = fpIdOf(memory);
    const comments = allComments(memory);
    const liked = isLiked(memory);
    const likeCount = fpId ? fam().likesOf(fpId).length : 0;
    const caption = memory.description || "";
    const shared = !memory.family && fpId;
    return `
      <article class="mf-post" id="mf-post-${escapeAttr(memory.id)}" data-mf-post="${escapeAttr(memory.id)}">
        <header class="mf-post-head">
          ${avatar(me, "mf-face-sm")}
          <div class="mf-post-who"><strong>${escapeHtml(me.name)}${shared ? ` <em class="mf-shared" title="${escapeAttr(L("បានចែករំលែកជាមួយគ្រួសារ", "Shared with family"))}">👨‍👩‍👧</em>` : ""}</strong><span>${escapeHtml(relative(memory.date))}${memory.location ? ` · 📍 ${escapeHtml(memory.location)}` : ""}</span></div>
          <button class="mf-icon" type="button" data-mf-menu="${escapeAttr(memory.id)}" aria-label="${escapeAttr(L("ជម្រើស", "Options"))}">⋯</button>
        </header>
        ${media.length ? `
          <div class="mf2-media">
          <div class="mf-car mf-media-box" data-mf-car>
            ${media.map(item => `<div class="mf-slide" data-mf-tap>${mediaTag(item)}</div>`).join("")}
            <span class="mf-heart" aria-hidden="true">❤️</span>
          </div>
            ${media.length > 1 ? `<span class="mf2-count" data-mf2-count>1/${media.length}</span>` : ""}
            ${memory.location ? `<span class="mf2-loc">📍 ${escapeHtml(memory.location)}</span>` : ""}
          </div>
          ${media.length > 1 ? `<div class="mf-dots">${media.map((_, index) => `<i class="${index === 0 ? "active" : ""}"></i>`).join("")}</div>` : ""}
        ` : `<div class="mf-textonly" data-mf-tap style="background:${typeof memoryGradient === "function" ? memoryGradient(memory.id) : "#16241b"}"><span>${escapeHtml(memory.title || memory.description || "")}</span><span class="mf-heart" aria-hidden="true">❤️</span></div>`}
        <div class="mf-actions mf-ig">
          <button type="button" class="mf-act mf-ig-like ${liked ? "liked" : ""}" data-mf-like="${escapeAttr(memory.id)}" aria-pressed="${liked}" aria-label="${escapeAttr(L("ចូលចិត្ត", "Like"))}">${heartIcon(liked)}</button>
          <button type="button" class="mf-act" data-mf-comments="${escapeAttr(memory.id)}" aria-label="${escapeAttr(L("មតិ", "Comments"))}">${COMMENT_ICON}</button>
        </div>
        <div class="mf-body mf-ig-body">
          <p class="mf-likes" data-mf-likes ${likeCount ? "" : "hidden"}>${likeText(likeCount)}</p>
          ${memory.title || caption ? `<p class="mf-caption"><strong>${escapeHtml(me.name)}</strong> ${memory.title ? `<b class="mf-ig-title">${escapeHtml(memory.title)}</b>${caption ? " · " : ""}` : ""}${escapeHtml(caption)}</p>` : ""}
          ${tags.length ? `<p class="mf-with">${escapeHtml(L("ជាមួយ", "with"))} ${tags.map(name => `<b>${escapeHtml(name)}</b>`).join(tags.length === 2 ? ` ${escapeHtml(L("និង", "and"))} ` : ", ")}</p>` : ""}
          ${comments.length > 1 ? `<button type="button" class="mf-all-comments" data-mf-comments="${escapeAttr(memory.id)}">${escapeHtml(L(`មើលមតិទាំង ${comments.length}`, `View all ${comments.length} comments`))}</button>` : ""}
          ${comments.length ? `<button type="button" class="mf-last-comment mf-ig-comment" data-mf-comments="${escapeAttr(memory.id)}">${comments[comments.length - 1].who ? `<strong>${escapeHtml(comments[comments.length - 1].who)}</strong> ` : ""}${escapeHtml(comments[comments.length - 1].text)}</button>` : `<button type="button" class="mf-all-comments" data-mf-comments="${escapeAttr(memory.id)}">${escapeHtml(L("សរសេរមតិ…", "Add a comment…"))}</button>`}
        </div>
      </article>`;
  }

  // Instagram-style action icons (outline heart / red filled heart, speech bubble)
  const heartIcon = on => `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.4-9.4-9.1C1.3 8.1 3.4 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.5 0 5.6 3.6 4.3 6.9-1.9 4.7-9.4 9.1-9.4 9.1z" fill="${on ? "#ff3b5c" : "none"}" stroke="${on ? "#ff3b5c" : "currentColor"}" stroke-width="1.9" stroke-linejoin="round"/></svg>`;
  const COMMENT_ICON = '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.4L3.5 20.5l1.5-4.5a8.4 8.4 0 1 1 15.5-4.4z"/></svg>';
  const likeText = count => (count ? L(`${count} នាក់ចូលចិត្ត`, `${count} ${count === 1 ? "like" : "likes"}`) : "");

  function gridCell(memory, big) {
    const media = mediaOf(memory);
    const item = media[0];
    return `<button type="button" class="mf-cell mf-media-box${big ? " is-big" : ""}" data-mf-jump="${escapeAttr(memory.id)}" aria-label="${escapeAttr(memory.title || memory.description || formatDate(memory.date))}">
        ${item ? mediaTag(item, { thumb: true }) : `<span class="mf-noimg">${escapeHtml(initials(memory.title || "★"))}</span>`}
        ${isVideoPost(memory) ? `<span class="mf-cell-badge">▶</span>` : media.length > 1 ? `<span class="mf-cell-badge">${media.length}</span>` : ""}
      </button>`;
  }

  function gridHtml(posts) {
    const videos = posts.filter(isVideoPost);
    const reels = videos.length ? `<div class="mf-month"><span>Reels <em>· ${videos.length} ${L("វីដេអូ", videos.length === 1 ? "video" : "videos")}</em></span></div>
      <div class="mf2-reels">${videos.slice(0, 12).map(memory => {
        const item = mediaOf(memory)[0];
        return `<button type="button" class="mf2-reel mf-media-box" data-mf2-reel="${escapeAttr(memory.id)}" aria-label="Reel">${item ? mediaTag(item, { thumb: true }) : ""}<b>▶</b></button>`;
      }).join("")}</div>` : "";
    const groups = [];
    posts.forEach(memory => {
      const key = String(memory.date || "").slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(memory);
      else groups.push({ key, date: memory.date, items: [memory] });
    });
    return reels + groups.map(group => `<div class="mf-month"><span>${escapeHtml(monthLabel(group.date))} <em>· ${group.items.length}</em></span></div>
      <div class="mf-grid">${group.items.map((memory, index) => gridCell(memory, index === 0 && group.items.length >= 3)).join("")}</div>`).join("");
  }

  document.addEventListener("click", event => {
    if (!event.target.closest("[data-mf-grid-more]")) return;
    state.gridLimit += GRID_PAGE;
    rerender();
  });

  /* ---------- binding ---------- */
  function bind() {
    const page = document.querySelector(".mf-page");
    if (!page) return;
    page.querySelectorAll("[data-mf-new]").forEach(button => button.addEventListener("click", () => openComposer()));
    page.querySelectorAll("[data-mf-person]").forEach(button => button.addEventListener("click", () => {
      state.person = state.person === button.dataset.mfPerson ? "" : button.dataset.mfPerson;
      state.limit = PAGE;
      rerender();
    }));
    page.querySelectorAll("[data-mf-view]").forEach(button => button.addEventListener("click", () => {
      if (button.dataset.mfView === "reels") return openReels();
      state.view = button.dataset.mfView;
      rerender();
    }));
    let timer;
    page.querySelector("[data-mf-search]")?.addEventListener("input", event => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.search = event.target.value;
        state.limit = PAGE;
        const caret = event.target.selectionStart;
        rerender();
        const input = document.querySelector("[data-mf-search]");
        if (input) { input.focus(); try { input.setSelectionRange(caret, caret); } catch (error) { /* ignore */ } }
      }, 250);
    });
    page.querySelector("[data-mf2-search]")?.addEventListener("click", () => {
      state.searchOpen = !(state.searchOpen || state.search);
      if (!state.searchOpen) state.search = "";
      rerender();
      if (state.searchOpen) document.querySelector("[data-mf-search]")?.focus();
    });
    page.querySelectorAll("[data-mf2-reel]").forEach(button => button.addEventListener("click", () => openReels(button.dataset.mf2Reel)));
    page.querySelectorAll("[data-mf-jump]").forEach(button => button.addEventListener("click", () => jumpTo(button.dataset.mfJump)));
    page.querySelectorAll("[data-mf-scope]").forEach(button => button.addEventListener("click", () => {
      state.scope = button.dataset.mfScope;
      state.limit = PAGE;
      rerender();
    }));
    page.querySelector("[data-mf-share-old]")?.addEventListener("click", shareOld);
    loadFamily();
    bindPosts(page);
    setupMore(page);
    resolveAll(page);
  }

  function bindPosts(root) {
    root.querySelectorAll("[data-mf-post]:not([data-mf-bound])").forEach(post => {
      post.dataset.mfBound = "1";
      const id = post.dataset.mfPost;
      const car = post.querySelector("[data-mf-car]");
      if (car) {
        const dots = [...post.querySelectorAll(".mf-dots i")];
        car.addEventListener("scroll", () => {
          const index = Math.round(car.scrollLeft / Math.max(1, car.clientWidth));
          dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
          const count = post.querySelector("[data-mf2-count]");
          if (count) count.textContent = `${index + 1}/${dots.length}`;
          car.querySelectorAll("video").forEach((video, i) => { if (i !== index) video.pause(); });
        }, { passive: true });
      }
      // double tap / double click on the photo = ❤️
      let lastTap = 0;
      post.querySelectorAll("[data-mf-tap]").forEach(area => area.addEventListener("pointerup", event => {
        if (event.target.closest("video[controls]") && event.pointerType === "mouse") return;
        const now = Date.now();
        if (now - lastTap < 320) { like(id, true, post); lastTap = 0; } else lastTap = now;
      }));
      post.querySelector("[data-mf-like]")?.addEventListener("click", () => like(id, null, post));
      post.querySelectorAll("[data-mf-comments]").forEach(button => button.addEventListener("click", () => openComments(id)));
      post.querySelector("[data-mf-menu]")?.addEventListener("click", () => openMenu(id));
    });
  }

  function setupMore(page) {
    if (observer) observer.disconnect();
    const more = page.querySelector("[data-mf-more]");
    if (!more || !("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      const posts = filtered();
      const from = state.limit;
      state.limit += PAGE;
      const feed = document.querySelector("[data-mf-feed]");
      if (!feed) return;
      feed.insertAdjacentHTML("beforeend", feedHtml(posts, from, state.limit));
      bindPosts(feed);
      resolveAll(feed);
      if (state.limit >= posts.length) { observer.disconnect(); more.remove(); }
    }, { rootMargin: "600px 0px" });
    observer.observe(more);
  }

  // fetch family posts in the background; redraw only when something changed
  function familySignature() {
    if (typeof FamilyPosts === "undefined") return "";
    const fp = FamilyPosts.state;
    return [fp.status, fp.role, FamilyPosts.active(), fp.posts.map(post => `${post.id}:${post.updated_at}`).join(","), fp.likes.length, fp.comments.length].join("|");
  }
  function loadFamily() {
    if (typeof FamilyPosts === "undefined") return;
    if (!familySig) familySig = familySignature();
    FamilyPosts.load().then(() => {
      const next = familySignature();
      if (next === familySig) return;
      familySig = next;
      if (!fam() && state.scope !== "all") state.scope = "all";
      if (document.querySelector(".mf-page")) rerender();
    });
  }

  function rerender() {
    const page = document.querySelector(".mf-page");
    if (!page) return App.render();
    const wrapper = document.createElement("div");
    wrapper.innerHTML = render();
    page.replaceWith(wrapper.firstElementChild);
    bind();
  }

  function jumpTo(id) {
    const posts = filtered();
    const index = posts.findIndex(memory => memory.id === id);
    if (index === -1) { state.person = ""; state.search = ""; }
    const all = filtered();
    const at = all.findIndex(memory => memory.id === id);
    state.view = "feed";
    state.limit = Math.max(PAGE, at + 1);
    rerender();
    const post = document.getElementById(`mf-post-${id}`);
    if (post) {
      post.scrollIntoView({ behavior: "smooth", block: "start" });
      post.classList.add("mf-flash");
      setTimeout(() => post.classList.remove("mf-flash"), 1300);
    }
  }

  /* ---------- like / comments (saved without re-rendering the page) ---------- */
  function record(id) {
    return (appData.memories || []).find(memory => memory.id === id) || (fam()?.othersAsMemories() || []).find(memory => memory.id === id);
  }

  function isLiked(memory) {
    const fpId = fpIdOf(memory);
    if (memory.family) return fam().iLike(fpId);
    return Boolean(memory.liked) || Boolean(fpId && fam().iLike(fpId));
  }

  // my own comments (in my memory) + family comments (table), oldest first
  function allComments(memory) {
    const own = memory.family ? [] : (Array.isArray(memory.comments) ? memory.comments : []).map(comment => ({ id: comment.id, text: comment.text, at: comment.at, who: "", own: true }));
    const fpId = fpIdOf(memory);
    const family = fpId ? fam().commentsOf(fpId).map(comment => ({ id: comment.id, text: comment.text, at: comment.created_at, who: fam().nameOf(comment.user_id), family: true, raw: comment })) : [];
    return [...own, ...family].sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  }

  function familyError(error) {
    console.warn("MYLIFE family posts:", error);
    Toast.show(error?.message === "not_shareable" ? L("Post នេះមិនមានរូបក្នុង cloud — ចែករំលែកមិនបាន", "This post has no cloud photos — can't share it") : L("មិនបានរក្សាទុកទៅគ្រួសារ — សាកម្ដងទៀត", "Couldn't save to the family — try again"), "warning");
  }

  function saveQuietly(memory) {
    memory.updatedAt = new Date().toISOString();
    Store.save();
  }

  function like(id, force, post) {
    const memory = record(id);
    if (!memory) return;
    const next = force === null ? !isLiked(memory) : Boolean(force);
    const fpId = fpIdOf(memory);
    if (!memory.family) { memory.liked = next; saveQuietly(memory); }
    if (fpId) fam().setLike(fpId, next).catch(familyError);
    const button = post?.querySelector("[data-mf-like]");
    if (button) {
      const count = fpId ? fam().likesOf(fpId).length : 0;
      button.innerHTML = button.closest(".mf-ig") ? heartIcon(next) : `${next ? "❤️" : "🤍"}${count ? `<b data-mf-like-count>${count}</b>` : ""}`;
      const likesLine = post.querySelector("[data-mf-likes]");
      if (likesLine) { likesLine.textContent = likeText(count); likesLine.hidden = !count; }
      button.classList.toggle("liked", next);
      button.setAttribute("aria-pressed", String(next));
      button.classList.remove("mf-pop");
      void button.offsetWidth;
      button.classList.add("mf-pop");
    }
    if (force && post) {
      const heart = post.querySelector(".mf-heart");
      if (heart) { heart.classList.remove("show"); void heart.offsetWidth; heart.classList.add("show"); }
    }
  }

  function openSheet(html, className = "") {
    const root = document.getElementById("modalRoot");
    if (Modal.escapeHandler) document.removeEventListener("keydown", Modal.escapeHandler);
    root.innerHTML = `<div class="modal glass-card event-modal mf-sheet ${className}">${html}</div>`;
    root.classList.add("open");
    Modal.escapeHandler = event => { if (event.key === "Escape") Modal.close(); };
    document.addEventListener("keydown", Modal.escapeHandler);
    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => Modal.close()));
    return root;
  }

  function sheetHead(title, icon = "📸") {
    return `<div class="ev-head"><div class="ev-head-icon mf-head-icon">${icon}</div><h2 class="section-title">${escapeHtml(title)}</h2><button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button></div>`;
  }

  function openComments(id) {
    const memory = record(id);
    if (!memory) return;
    const fpId = fpIdOf(memory);
    const fpPost = fpId ? fam().postById(fpId) : null;
    const canWrite = !memory.family || fam().canPost();
    const canDelete = comment => comment.own || (comment.family && fam().canDeleteComment(comment.raw, fpPost));
    const list = () => allComments(memory).map(comment => `<div class="mf-comment"><div><strong>${escapeHtml(comment.who || appData.profile?.name || L("ខ្ញុំ", "Me"))}</strong> ${escapeHtml(comment.text)}<small>${escapeHtml(relative(String(comment.at || "").slice(0, 10)))}</small></div>${canDelete(comment) ? `<button type="button" class="mf-icon" data-mf-del-comment="${escapeAttr(comment.id)}" data-mf-family-comment="${comment.family ? "1" : ""}" aria-label="${escapeAttr(t("delete"))}">✕</button>` : ""}</div>`).join("") || `<p class="secondary mf-no-comments">${escapeHtml(canWrite ? L("មិនទាន់មានមតិ — សរសេរមួយ", "No comments yet — write one") : L("មិនទាន់មានមតិ", "No comments yet"))}</p>`;
    const root = openSheet(`${sheetHead(L("មតិ", "Comments"), "💬")}
      <div class="mf-comments" data-mf-comment-list>${list()}</div>
      ${canWrite ? "" : `<p class="secondary mf-viewer-note">👀 ${escapeHtml(L("អ្នកមើលអាច ❤️ បាន តែមិនអាចសរសេរមតិទេ", "Viewers can ❤️ but can't comment"))}</p>`}
      ${canWrite ? `<form class="mf-comment-form" data-mf-comment-form><input name="text" maxlength="500" autocomplete="off" placeholder="${escapeAttr(L("សរសេរមតិ…", "Write a comment…"))}"><button class="button ev-submit" type="submit">${escapeHtml(L("ផ្ញើ", "Send"))}</button></form>` : ""}`);
    const refresh = () => {
      root.querySelector("[data-mf-comment-list]").innerHTML = list();
      bindDelete();
      const post = document.querySelector(`[data-mf-post="${CSS.escape(id)}"]`);
      if (post) {
        const fresh = document.createElement("div");
        fresh.innerHTML = postHtml(memory);
        post.replaceWith(fresh.firstElementChild);
        const feed = document.querySelector("[data-mf-feed]");
        if (feed) { bindPosts(feed); resolveAll(feed); }
      }
    };
    const bindDelete = () => root.querySelectorAll("[data-mf-del-comment]").forEach(button => button.addEventListener("click", async () => {
      if (button.dataset.mfFamilyComment) {
        try { await fam().deleteComment(button.dataset.mfDelComment); } catch (error) { familyError(error); return; }
      } else {
        memory.comments = (memory.comments || []).filter(comment => comment.id !== button.dataset.mfDelComment);
        saveQuietly(memory);
      }
      refresh();
    }));
    bindDelete();
    root.querySelector("[data-mf-comment-form]")?.addEventListener("submit", event => {
      event.preventDefault();
      const input = event.currentTarget.elements.text;
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      if (fpId && fam().canPost()) {
        // shared post: the comment goes to the family so everyone sees it
        fam().addComment(fpId, text).then(refresh).catch(error => { input.value = text; familyError(error); });
      } else {
        memory.comments = [...(memory.comments || []), { id: `c-${Date.now()}`, text, at: new Date().toISOString() }];
        saveQuietly(memory);
        refresh();
      }
      input.focus();
    });
    setTimeout(() => root.querySelector("[data-mf-comment-form] input")?.focus(), 60);
  }

  function openMenu(id) {
    const memory = record(id);
    if (!memory) return;
    if (memory.family) return openFamilyMenu(memory);
    const family = fam();
    const shared = Boolean(fpIdOf(memory));
    const canShare = family && family.canPost() && family.shareable(memory);
    const root = openSheet(`${sheetHead(L("ជម្រើស", "Options"), "⋯")}
      <div class="mf-menu">
        ${canShare || shared ? `<button type="button" class="button ghost-button" data-mf-share>${shared ? `🔒 ${escapeHtml(L("ឈប់ចែករំលែកជាមួយគ្រួសារ", "Stop sharing with family"))}` : `👨‍👩‍👧 ${escapeHtml(L("ចែករំលែកជាមួយគ្រួសារ", "Share with family"))}`}</button>` : ""}
        <button type="button" class="button ghost-button" data-mf-edit>${Icons.edit()} ${escapeHtml(L("កែ caption / ថ្ងៃ / ទីកន្លែង", "Edit caption / date / place"))}</button>
        <button type="button" class="button danger-button" data-mf-delete>${Icons.trash()} ${escapeHtml(L("លុប post នេះ", "Delete this post"))}</button>
      </div>`, "mf-menu-sheet");
    root.querySelector("[data-mf-share]")?.addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      try {
        if (shared) { await family.unshare(memory.id); Toast.show(L("ឈប់ចែករំលែកហើយ — post នៅតែមានក្នុងរបស់អ្នក", "No longer shared — the post stays in yours")); }
        else { await family.share(memory, taggedPeople(memory)); Toast.show(L("បានចែករំលែកជាមួយគ្រួសារ 👨‍👩‍👧", "Shared with family 👨‍👩‍👧"), "success"); }
        Modal.close();
        rerender();
      } catch (error) { familyError(error); event.currentTarget.disabled = false; }
    });
    root.querySelector("[data-mf-edit]").addEventListener("click", () => {
      if (!Array.isArray(memory.media) && typeof MemoryForm !== "undefined") return MemoryForm.open(memory);
      openComposer(memory);
    });
    root.querySelector("[data-mf-delete]").addEventListener("click", () => {
      Modal.confirm({
        title: L("លុប post?", "Delete post?"),
        message: L("Post នេះ និងរូប/វីដេអូរបស់វានឹងត្រូវលុប។ មិនអាចយកវិញបានទេ។", "This post and its photos/video will be deleted. This cannot be undone."),
        confirmText: t("delete"),
        onConfirm: async () => {
          // shared? remove the family copy first, so nobody is left with broken photos
          if (fpIdOf(memory)) {
            try { await fam().unshare(memory.id); } catch (error) { familyError(error); return; }
          }
          const paths = (memory.media || []).flatMap(item => [item.path, item.thumb]).filter(Boolean);
          if (paths.length && window.supabaseClient?.storage) {
            try { await window.supabaseClient.storage.from(BUCKET).remove(paths); } catch (error) { console.warn("MYLIFE memories: files not removed", error); }
          }
          Store.delete("memories", id);
          Toast.show(L("បានលុប post", "Post deleted"));
        }
      });
    });
  }

  // a post shared by another member: only an admin can take it off the family feed
  function openFamilyMenu(memory) {
    const family = fam();
    const root = openSheet(`${sheetHead(L("ជម្រើស", "Options"), "⋯")}
      <div class="mf-menu">
        <p class="secondary">👨‍👩‍👧 ${escapeHtml(L(`Post របស់ ${memory.authorName}`, `Shared by ${memory.authorName}`))}</p>
        ${family.isAdmin() ? `<button type="button" class="button danger-button" data-mf-family-remove>${Icons.trash()} ${escapeHtml(L("ដកចេញពី feed គ្រួសារ", "Remove from family feed"))}</button>` : ""}
      </div>`, "mf-menu-sheet");
    root.querySelector("[data-mf-family-remove]")?.addEventListener("click", () => {
      Modal.confirm({
        title: L("ដកចេញពីគ្រួសារ?", "Remove from family?"),
        message: L(`Post នេះនឹងលែងបង្ហាញក្នុងគ្រួសារ។ ${memory.authorName} នៅតែមាន post ក្នុងរបស់គាត់។`, `This post leaves the family feed. ${memory.authorName} still keeps it in their own memories.`),
        confirmText: L("ដកចេញ", "Remove"),
        onConfirm: async () => {
          try { await family.remove(memory.familyPostId); Toast.show(L("បានដកចេញ", "Removed")); rerender(); } catch (error) { familyError(error); }
        }
      });
    });
  }

  function shareOld() {
    const family = fam();
    const list = (appData.memories || []).filter(memory => family.shareable(memory) && !family.postBySource(memory.id));
    if (!list.length) return;
    Modal.confirm({
      title: L("ចែករំលែកអនុស្សាវរីយ៍ចាស់ៗ?", "Share older memories?"),
      message: L(`${list.length} post នឹងបង្ហាញឲ្យគ្រួសារមើល (ចម្លង មិនមែនផ្លាស់ទី — post នៅតែជារបស់អ្នក)។ អ្នកអាចឈប់ចែករំលែកម្ដងមួយៗពេលក្រោយ។`, `${list.length} posts will be visible to your family (a copy — they stay yours). You can stop sharing any of them later.`),
      confirmText: L("ចែករំលែក", "Share"),
      onConfirm: async () => {
        let done = 0;
        for (const memory of list) {
          try { await family.share(memory, taggedPeople(memory)); done += 1; } catch (error) { console.warn("MYLIFE family posts: share failed", memory.id, error); }
        }
        Toast.show(L(`បានចែករំលែក ${done}/${list.length}`, `Shared ${done}/${list.length}`), done === list.length ? "success" : "warning");
        rerender();
      }
    });
  }

  /* ---------- Reels ---------- */
  function openReels(startId) {
    const reels = filtered().filter(isVideoPost);
    if (!reels.length) { Toast.show(L("មិនទាន់មានវីដេអូ — ចុច ＋ ដើម្បី post", "No videos yet — tap ＋ to post one")); return; }
    closeReels();
    const box = document.createElement("div");
    box.className = "mf-reels";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Reels");
    box.innerHTML = `
      <button type="button" class="mf-reels-close" data-mf-reels-close aria-label="Close">${Icons.close()}</button>
      <div class="mf-reels-track">${reels.map(memory => {
        const video = mediaOf(memory).find(item => item.type === "video");
        return `<section class="mf-reel" data-mf-reel="${escapeAttr(memory.id)}">
          ${mediaTag(video, { reel: true })}
          <span class="mf-reel-sound" data-mf-sound>${reelsMuted ? "🔇" : "🔊"}</span>
          <div class="mf-reel-info">
            <strong>${escapeHtml(memory.family ? memory.authorName : appData.profile?.name || "")}</strong> · ${escapeHtml(relative(memory.date))}${memory.location ? ` · 📍 ${escapeHtml(memory.location)}` : ""}
            ${memory.description || memory.title ? `<p>${escapeHtml(memory.description || memory.title)}</p>` : ""}
          </div>
          <button type="button" class="mf-reel-like ${isLiked(memory) ? "liked" : ""}" data-mf-reel-like="${escapeAttr(memory.id)}">${isLiked(memory) ? "❤️" : "🤍"}</button>
        </section>`;
      }).join("")}</div>`;
    document.body.appendChild(box);
    document.body.classList.add("mf-reels-open");
    box.querySelector("[data-mf-reels-close]").addEventListener("click", closeReels);
    box._esc = event => { if (event.key === "Escape") closeReels(); };
    document.addEventListener("keydown", box._esc);
    box.querySelectorAll("[data-mf-reel]").forEach(reel => {
      const video = reel.querySelector("video");
      video.muted = reelsMuted;
      reel.addEventListener("click", event => {
        if (event.target.closest("[data-mf-reel-like]")) return;
        reelsMuted = !reelsMuted;
        box.querySelectorAll("video").forEach(item => { item.muted = reelsMuted; });
        box.querySelectorAll("[data-mf-sound]").forEach(item => { item.textContent = reelsMuted ? "🔇" : "🔊"; item.classList.remove("show"); void item.offsetWidth; item.classList.add("show"); });
        if (video.paused) video.play().catch(() => {});
      });
      reel.querySelector("[data-mf-reel-like]").addEventListener("click", event => {
        const memory = record(reel.dataset.mfReel);
        if (!memory) return;
        const next = !isLiked(memory);
        like(memory.id, next, null);
        event.currentTarget.textContent = next ? "❤️" : "🤍";
        event.currentTarget.classList.toggle("liked", next);
      });
    });
    reelObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      const video = entry.target.querySelector("video");
      if (!video) return;
      if (entry.isIntersecting && entry.intersectionRatio > 0.6) video.play().catch(() => {});
      else video.pause();
    }), { root: box.querySelector(".mf-reels-track"), threshold: [0, 0.6, 1] });
    box.querySelectorAll("[data-mf-reel]").forEach(reel => reelObserver.observe(reel));
    resolveAll(box).then(() => {
      if (startId) box.querySelector(`[data-mf-reel="${CSS.escape(startId)}"]`)?.scrollIntoView();
    });
  }

  function closeReels() {
    const box = document.querySelector(".mf-reels");
    if (!box) return;
    reelObserver?.disconnect();
    box.querySelectorAll("video").forEach(video => { video.pause(); video.removeAttribute("src"); video.load(); });
    if (box._esc) document.removeEventListener("keydown", box._esc);
    box.remove();
    document.body.classList.remove("mf-reels-open");
  }

  /* ---------- new post / edit ---------- */
  async function compressImage(file, maxSide, quality) {
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (error) {
      bitmap = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
      });
    }
    const w = bitmap.width || bitmap.naturalWidth;
    const h = bitmap.height || bitmap.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    return { blob, w: canvas.width, h: canvas.height };
  }

  function videoInfo(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        const duration = video.duration;
        video.currentTime = Math.min(0.5, (duration || 1) / 2);
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 640 / Math.max(video.videoWidth || 640, video.videoHeight || 640));
        canvas.width = Math.max(1, Math.round((video.videoWidth || 640) * scale));
        canvas.height = Math.max(1, Math.round((video.videoHeight || 360) * scale));
        try { canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height); } catch (error) { /* poster stays blank */ }
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          resolve({ duration: video.duration, w: video.videoWidth, h: video.videoHeight, poster: blob });
        }, "image/jpeg", 0.75);
      };
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("video")); };
      video.src = url;
    });
  }

  async function currentUserId() {
    try {
      const { data } = await window.supabaseClient.auth.getSession();
      return data?.session?.user?.id || "";
    } catch (error) {
      return "";
    }
  }

  function openComposer(memory) {
    const editing = Boolean(memory);
    const people = (appData.family || []).filter(member => member.name);
    const selected = new Set(editing ? (memory.tagIds || people.filter(member => personMatch(memory, member)).map(member => member.id)) : (state.person ? [state.person] : []));
    let files = [];
    const root = openSheet(`${sheetHead(editing ? L("កែ post", "Edit post") : L("Post ថ្មី", "New post"))}
      <form class="mf-compose" data-mf-compose novalidate>
        ${editing ? "" : `
        <label class="mf-drop" data-mf-drop>
          <input type="file" accept="image/*,video/*" multiple data-mf-files>
          <span class="mf-drop-icon">📷</span>
          <strong>${escapeHtml(L("ជ្រើសរូប (1–10) ឬវីដេអូ 1", "Choose photos (1–10) or 1 video"))}</strong>
          <em>${escapeHtml(L(`វីដេអូ ≤ ${MAX_VIDEO_SECONDS} វិនាទី · ≤ ${MAX_VIDEO_BYTES / 1024 / 1024} MB`, `Video ≤ ${MAX_VIDEO_SECONDS}s · ≤ ${MAX_VIDEO_BYTES / 1024 / 1024} MB`))}</em>
        </label>
        <div class="mf-previews" data-mf-previews></div>
        <div class="field-error" data-mf-file-error></div>`}
        <textarea name="caption" rows="3" maxlength="2000" placeholder="${escapeAttr(L("សរសេរ caption…", "Write a caption…"))}">${escapeHtml(editing ? memory.description || "" : "")}</textarea>
        <div class="mf-compose-row">
          <label><span>📅 ${escapeHtml(t("date"))}</span><input type="date" name="date" value="${escapeAttr(editing ? memory.date || "" : localDateInput())}"></label>
          <label><span>📍 ${escapeHtml(L("ទីកន្លែង", "Place"))}</span><input type="text" name="place" maxlength="80" value="${escapeAttr(editing ? memory.location || "" : "")}" placeholder="${escapeAttr(L("ឧ. កែប", "e.g. Kep"))}"></label>
        </div>
        ${people.length ? `<div class="mf-tag-pick"><span>👥 ${escapeHtml(L("មនុស្សក្នុងរូប", "People in it"))}</span><div>${people.map(member => `<button type="button" class="mf-tag-chip ${selected.has(member.id) ? "active" : ""}" data-mf-tag="${escapeAttr(member.id)}">${avatar(member, "mf-face-xs")}${escapeHtml(member.name)}</button>`).join("")}</div></div>` : ""}
        ${!editing && fam()?.canPost() ? `<label class="mf-share-row"><span>👨‍👩‍👧 <strong>${escapeHtml(L("ចែករំលែកជាមួយគ្រួសារ", "Share with family"))}</strong><small>${escapeHtml(L("សមាជិកដែលមានសិទ្ធិ Memories នឹងឃើញ", "Members allowed to see Memories will see it"))}</small></span><input type="checkbox" name="share" checked></label>` : ""}
        <div class="mf-progress" data-mf-progress hidden><i></i><span></span></div>
        <div class="ev-foot">
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ev-submit" type="submit" data-mf-submit>${Icons.check()} ${escapeHtml(editing ? t("save") : L("Post", "Post"))}</button>
        </div>
      </form>`, "mf-compose-sheet");
    const form = root.querySelector("[data-mf-compose]");
    root.querySelectorAll("[data-mf-tag]").forEach(chip => chip.addEventListener("click", () => {
      const id = chip.dataset.mfTag;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      chip.classList.toggle("active", selected.has(id));
    }));

    const fileError = text => { const slot = root.querySelector("[data-mf-file-error]"); if (slot) slot.textContent = text || ""; };
    const drawPreviews = () => {
      const box = root.querySelector("[data-mf-previews]");
      if (!box) return;
      box.innerHTML = files.map((file, index) => `<div class="mf-prev">${file.type.startsWith("video/") ? `<video src="${escapeAttr(file._url)}" muted playsinline></video><span class="mf-prev-badge">▶</span>` : `<img src="${escapeAttr(file._url)}" alt="">`}<button type="button" data-mf-remove="${index}" aria-label="${escapeAttr(t("delete"))}">✕</button></div>`).join("");
      box.querySelectorAll("[data-mf-remove]").forEach(button => button.addEventListener("click", () => {
        const [removed] = files.splice(Number(button.dataset.mfRemove), 1);
        if (removed?._url) URL.revokeObjectURL(removed._url);
        drawPreviews();
      }));
      root.querySelector("[data-mf-drop]")?.classList.toggle("has-files", files.length > 0);
    };
    root.querySelector("[data-mf-files]")?.addEventListener("change", event => {
      const picked = [...event.target.files];
      event.target.value = "";
      const all = [...files, ...picked];
      const videos = all.filter(file => file.type.startsWith("video/"));
      const images = all.filter(file => file.type.startsWith("image/"));
      if (videos.length && images.length) return fileError(L("Post មួយ: រូបភាព ឬវីដេអូ (មិនលាយគ្នា)", "One post: photos or a video, not both"));
      if (videos.length > 1) return fileError(L("វីដេអូបានតែ 1 ក្នុងមួយ post", "Only 1 video per post"));
      if (images.length > MAX_PHOTOS) return fileError(L(`រូបភាពបានច្រើនបំផុត ${MAX_PHOTOS}`, `Up to ${MAX_PHOTOS} photos`));
      if (videos[0] && videos[0].size > MAX_VIDEO_BYTES) return fileError(L(`វីដេអូធំពេក (${mb(videos[0].size)}) — ត្រូវ ≤ 30 MB`, `Video too big (${mb(videos[0].size)}) — max 30 MB`));
      fileError("");
      picked.forEach(file => { file._url = URL.createObjectURL(file); });
      files = all;
      drawPreviews();
    });

    const progress = (fraction, text) => {
      const bar = root.querySelector("[data-mf-progress]");
      bar.hidden = false;
      bar.querySelector("i").style.width = `${Math.round(fraction * 100)}%`;
      bar.querySelector("span").textContent = text;
    };

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = root.querySelector("[data-mf-submit]");
      const caption = form.elements.caption.value.trim();
      const date = form.elements.date.value || localDateInput();
      const place = form.elements.place.value.trim();
      const tagIds = [...selected];
      const familyMembers = tagIds.map(id => (appData.family || []).find(member => member.id === id)?.name).filter(Boolean).join(", ");
      if (editing) {
        Store.edit("memories", memory.id, { description: caption, date, location: place, tagIds, familyMembers });
        // shared? keep the family copy the same
        if (fpIdOf(memory)) fam().share(record(memory.id), familyMembers ? familyMembers.split(", ") : []).catch(familyError);
        Modal.close();
        Toast.show(L("បានរក្សាទុក", "Saved"));
        return;
      }
      const shareIt = Boolean(form.elements.share?.checked);
      if (!files.length) return fileError(L("សូមជ្រើសរូប ឬវីដេអូ", "Choose photos or a video"));
      if (!window.supabaseClient?.storage) return fileError(L("ត្រូវ login ហើយ online ដើម្បី post", "Log in and go online to post"));
      const userId = await currentUserId();
      if (!userId) return fileError(L("ត្រូវ login ដើម្បី post", "Log in to post"));

      submit.disabled = true;
      const postId = `memories-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const folder = `users/${userId}/posts/${postId}`;
      const uploaded = [];
      const media = [];
      const storage = window.supabaseClient.storage.from(BUCKET);
      const put = async (path, blob, type) => {
        const { error } = await storage.upload(path, blob, { contentType: type, upsert: false, cacheControl: "31536000" });
        if (error) throw error;
        uploaded.push(path);
      };
      try {
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          progress(index / files.length, L(`កំពុង upload ${index + 1}/${files.length}…`, `Uploading ${index + 1}/${files.length}…`));
          if (file.type.startsWith("video/")) {
            const info = await videoInfo(file);
            if (info.duration > MAX_VIDEO_SECONDS + 0.5) throw new Error(L(`វីដេអូវែងពេក (${Math.round(info.duration)} វិនាទី) — ត្រូវ ≤ ${MAX_VIDEO_SECONDS}`, `Video too long (${Math.round(info.duration)}s) — max ${MAX_VIDEO_SECONDS}s`));
            const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
            const path = `${folder}/video.${ext}`;
            await put(path, file, file.type || "video/mp4");
            let thumb = "";
            if (info.poster) { thumb = `${folder}/video-poster.jpg`; await put(thumb, info.poster, "image/jpeg"); }
            media.push({ path, thumb, type: "video", w: info.w, h: info.h, size: file.size, thumbSize: info.poster?.size || 0, duration: Math.round(info.duration) });
          } else {
            const big = await compressImage(file, 1600, 0.85);
            const small = await compressImage(file, 480, 0.75);
            const path = `${folder}/${index + 1}.jpg`;
            const thumb = `${folder}/${index + 1}-thumb.jpg`;
            await put(path, big.blob, "image/jpeg");
            await put(thumb, small.blob, "image/jpeg");
            media.push({ path, thumb, type: "image", w: big.w, h: big.h, size: big.blob.size, thumbSize: small.blob.size });
          }
        }
        progress(1, L("រួចរាល់", "Done"));
        files.forEach(file => file._url && URL.revokeObjectURL(file._url));
        state.view = "feed";
        state.limit = PAGE;
        const newPost = { id: postId, kind: "post", title: "", description: caption, date, location: place, tagIds, familyMembers, tags: "", media, liked: false, comments: [] };
        Store.add("memories", newPost);
        Modal.close();
        if (shareIt && fam()?.canPost()) {
          fam().share(newPost, familyMembers ? familyMembers.split(", ") : [])
            .then(() => { Toast.show(L("បាន post និងចែករំលែកជាមួយគ្រួសារ 👨‍👩‍👧", "Posted and shared with family 👨‍👩‍👧"), "success"); rerender(); })
            .catch(error => { familyError(error); });
        } else {
          Toast.show(L("បាន post អនុស្សាវរីយ៍ 📸", "Memory posted 📸"));
        }
      } catch (error) {
        console.warn("MYLIFE memories: post failed", error);
        // never leave half a post behind: remove only the files this attempt uploaded
        if (uploaded.length) { try { await storage.remove(uploaded); } catch (cleanup) { /* ignore */ } }
        submit.disabled = false;
        root.querySelector("[data-mf-progress]").hidden = true;
        const missingBucket = /bucket/i.test(String(error?.message || "")) && /not\s*found/i.test(String(error?.message || ""));
        fileError(missingBucket ? L("Storage \"family-media\" មិនទាន់បង្កើត — សូម run SQL ក្នុង Supabase", "Storage \"family-media\" is not set up yet — run the SQL in Supabase") : (error?.message || L("Post មិនបាន — សាកម្តងទៀត", "Could not post — try again")));
      }
    });
  }

  /* ---------- Family page teaser ---------- */
  function familyTeaser() {
    const posts = allPosts().slice(0, 6);
    return `<a class="mf-teaser glass-card" href="#memories">
      <div class="mf-teaser-head"><strong>📸 ${escapeHtml(L("អនុស្សាវរីយ៍គ្រួសារ", "Family memories"))}</strong><span>${escapeHtml(L("មើលទាំងអស់", "See all"))} →</span></div>
      ${posts.length ? `<div class="mf-teaser-row">${posts.map(memory => { const item = mediaOf(memory)[0]; return `<span class="mf-teaser-cell mf-media-box">${item ? mediaTag(item, { thumb: true }) : "★"}${isVideoPost(memory) ? `<i>▶</i>` : ""}</span>`; }).join("")}</div>` : `<p class="secondary">${escapeHtml(L("ចុចដើម្បី post រូបដំបូង", "Tap to post your first photos"))}</p>`}
    </a>`;
  }

  function afterFamilyRender() {
    const teaser = document.querySelector(".mf-teaser");
    if (teaser) resolveAll(teaser);
  }

  window.addEventListener("hashchange", closeReels);

  return { render, bind, openComposer, openReels, closeReels, familyTeaser, afterFamilyRender, mediaOf, BUCKET };
})();
