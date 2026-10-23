/* MYLIFE Part 2B: shared family Memories.
 * Tables family_posts / family_post_likes / family_post_comments
 * (supabase/migrations/20261023_family_posts.sql). RLS decides who sees what.
 *
 * "Copy, not move": my memory stays in appData.memories. Sharing it adds a row
 * that points to the same files in the private "family-media" bucket, so no
 * photo is uploaded twice. Family members can then read exactly those files.
 *
 * This file only talks to Supabase and keeps a small cache; MemoryFeed draws.
 */
const FamilyPosts = (() => {
  const TTL = 60 * 1000;
  const state = { status: "idle", familyId: "", me: "", role: "", perms: {}, posts: [], likes: [], comments: [], loadedAt: 0, error: "" };
  let loading = null;
  const listeners = new Set();

  const client = () => (typeof window !== "undefined" ? window.supabaseClient : null);
  const missingTable = error => /does not exist|schema cache|PGRST205|42P01|42883|could not find/i.test(`${error?.code || ""} ${error?.message || ""}`);
  const emit = () => listeners.forEach(fn => { try { fn(state); } catch (error) { console.warn(error); } });

  const canSee = () => state.status === "ready" && (state.role === "admin" || Boolean(state.perms.memories));
  const canPost = () => canSee() && (state.role === "admin" || state.role === "member");
  const active = () => canSee();
  const isAdmin = () => state.role === "admin";

  async function load(force = false) {
    if (!force && state.loadedAt && Date.now() - state.loadedAt < TTL) return state;
    if (loading) return loading;
    loading = (async () => {
      try {
        if (!client()?.from || typeof FamilyGroup === "undefined") { state.status = "offline"; return state; }
        const group = await FamilyGroup.load(force);
        if (group.status !== "ready" || !group.family) { state.status = group.status || "none"; state.posts = []; return state; }
        const me = group.members.find(member => member.user_id === group.me);
        state.familyId = group.family.id;
        state.me = group.me;
        state.role = me?.role || "";
        state.perms = me?.permissions || {};
        if (!(state.role === "admin" || state.perms.memories)) { state.status = "ready"; state.posts = []; state.likes = []; state.comments = []; state.loadedAt = Date.now(); return state; }
        const posts = await client().from("family_posts").select("*").eq("family_id", state.familyId).order("taken_on", { ascending: false }).order("created_at", { ascending: false }).limit(300);
        if (posts.error) { state.status = missingTable(posts.error) ? "notsetup" : "error"; state.error = posts.error.message; return state; }
        state.posts = posts.data || [];
        const ids = state.posts.map(post => post.id);
        if (ids.length) {
          const [likes, comments] = await Promise.all([
            client().from("family_post_likes").select("post_id, user_id").in("post_id", ids),
            client().from("family_post_comments").select("*").in("post_id", ids).order("created_at", { ascending: true })
          ]);
          state.likes = likes.data || [];
          state.comments = comments.data || [];
        } else {
          state.likes = [];
          state.comments = [];
        }
        state.status = "ready";
        state.loadedAt = Date.now();
        return state;
      } catch (error) {
        console.warn("MYLIFE family posts: load failed", error);
        state.status = "error";
        state.error = error?.message || String(error);
        return state;
      }
    })().finally(() => { loading = null; emit(); });
    return loading;
  }

  /* ---------- names ---------- */
  function member(userId) {
    return (typeof FamilyGroup !== "undefined" ? FamilyGroup.state.members : []).find(item => item.user_id === userId) || null;
  }
  function nameOf(userId) {
    if (userId === state.me) return appData.profile?.name || (languageCode() === "km" ? "ខ្ញុំ" : "Me");
    return member(userId)?.display_name || (languageCode() === "km" ? "សមាជិក" : "Member");
  }

  /* ---------- reading ---------- */
  const postBySource = sourceId => state.posts.find(post => post.author_id === state.me && post.source_id === sourceId) || null;
  const postById = id => state.posts.find(post => post.id === id) || null;
  const likesOf = postId => state.likes.filter(like => like.post_id === postId);
  const iLike = postId => state.likes.some(like => like.post_id === postId && like.user_id === state.me);
  const commentsOf = postId => state.comments.filter(comment => comment.post_id === postId);

  // a post from someone else, shaped like a memory so the feed can draw it
  function asMemory(post) {
    return {
      id: `fp-${post.id}`,
      kind: "post",
      family: true,
      familyPostId: post.id,
      authorId: post.author_id,
      authorName: nameOf(post.author_id),
      title: "",
      description: post.caption || "",
      location: post.place || "",
      date: post.taken_on || String(post.created_at || "").slice(0, 10),
      createdAt: post.created_at,
      familyMembers: (post.tag_names || []).join(", "),
      tagIds: [],
      media: Array.isArray(post.media) ? post.media : [],
      liked: iLike(post.id),
      comments: []
    };
  }
  // posts by other members (mine are already in my own memories)
  const othersAsMemories = () => (canSee() ? state.posts.filter(post => post.author_id !== state.me).map(asMemory) : []);

  /* ---------- writing ---------- */
  function shareable(memory) {
    return Array.isArray(memory?.media) && memory.media.some(item => item.path && !item.legacy && !item.url);
  }

  function rowFor(memory, tagNames) {
    return {
      family_id: state.familyId,
      source_id: memory.id,
      caption: String(memory.description || memory.title || "").slice(0, 2200),
      place: String(memory.location || "").slice(0, 120),
      taken_on: /^\d{4}-\d{2}-\d{2}$/.test(memory.date || "") ? memory.date : null,
      tag_names: (tagNames || []).slice(0, 30),
      media: (memory.media || []).filter(item => item.path).map(item => ({ path: item.path, thumb: item.thumb || "", type: item.type, w: item.w || 0, h: item.h || 0, duration: item.duration || 0 }))
    };
  }

  // share (or update the shared copy of) one of my memories
  async function share(memory, tagNames = []) {
    if (!canPost()) throw new Error("not_allowed");
    if (!shareable(memory)) throw new Error("not_shareable");
    const existing = postBySource(memory.id);
    const row = rowFor(memory, tagNames);
    const result = existing
      ? await client().from("family_posts").update({ caption: row.caption, place: row.place, taken_on: row.taken_on, tag_names: row.tag_names, media: row.media }).eq("id", existing.id).select()
      : await client().from("family_posts").insert(row).select();
    if (result.error) throw result.error;
    const saved = (result.data || [])[0];
    if (saved) state.posts = [saved, ...state.posts.filter(post => post.id !== saved.id)];
    emit();
    return saved;
  }

  async function unshare(memoryId) {
    const post = postBySource(memoryId);
    if (!post) return false;
    const { error } = await client().from("family_posts").delete().eq("id", post.id);
    if (error) throw error;
    state.posts = state.posts.filter(item => item.id !== post.id);
    state.likes = state.likes.filter(like => like.post_id !== post.id);
    state.comments = state.comments.filter(comment => comment.post_id !== post.id);
    emit();
    return true;
  }

  // admin (or author) removes a post shared by someone else
  async function remove(postId) {
    const { error } = await client().from("family_posts").delete().eq("id", postId);
    if (error) throw error;
    state.posts = state.posts.filter(item => item.id !== postId);
    emit();
  }

  async function setLike(postId, on) {
    const had = iLike(postId);
    if (on === had) return on;
    if (on) {
      state.likes.push({ post_id: postId, user_id: state.me });
      const { error } = await client().from("family_post_likes").insert({ post_id: postId });
      if (error && !/duplicate|23505/i.test(`${error.code} ${error.message}`)) { state.likes = state.likes.filter(like => !(like.post_id === postId && like.user_id === state.me)); throw error; }
    } else {
      state.likes = state.likes.filter(like => !(like.post_id === postId && like.user_id === state.me));
      const { error } = await client().from("family_post_likes").delete().eq("post_id", postId).eq("user_id", state.me);
      if (error) { state.likes.push({ post_id: postId, user_id: state.me }); throw error; }
    }
    return on;
  }

  async function addComment(postId, text) {
    const { data, error } = await client().from("family_post_comments").insert({ post_id: postId, text: String(text).slice(0, 500) }).select();
    if (error) throw error;
    const row = (data || [])[0] || { id: `tmp-${Date.now()}`, post_id: postId, user_id: state.me, text, created_at: new Date().toISOString() };
    state.comments.push(row);
    return row;
  }

  async function deleteComment(commentId) {
    const { error } = await client().from("family_post_comments").delete().eq("id", commentId);
    if (error) throw error;
    state.comments = state.comments.filter(comment => comment.id !== commentId);
  }

  const canDeleteComment = (comment, post) => comment.user_id === state.me || post?.author_id === state.me || isAdmin();

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  return {
    state, load, onChange, active, canSee, canPost, isAdmin, nameOf,
    postBySource, postById, likesOf, iLike, commentsOf, othersAsMemories, shareable,
    share, unshare, remove, setLike, addComment, deleteComment, canDeleteComment
  };
})();
