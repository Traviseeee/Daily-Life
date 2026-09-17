const supabaseConfig = window.MYLIFE_SUPABASE || {};
const supabaseUrl = String(supabaseConfig.url || window.SUPABASE_URL || "").trim();
const supabaseAnonKey = String(supabaseConfig.anonKey || window.SUPABASE_ANON_KEY || "").trim();
const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("YOUR-PROJECT") && !supabaseAnonKey.includes("YOUR-"));

if (supabaseEnabled && window.supabase?.createClient) {
  window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
} else {
  window.supabaseClient = null;
  console.info("Supabase is not configured yet. Update the URL and anon key in index.html.");
}

window.MYLIFE_SUPABASE = {
  ...supabaseConfig,
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  enabled: supabaseEnabled
};

window.MYLIFE_SUPABASE_API = {
  async signIn(email, password) {
    if (!window.supabaseClient) {
      throw new Error("Supabase is not configured.");
    }
    return window.supabaseClient.auth.signInWithPassword({ email, password });
  },
  async signUp(email, password) {
    if (!window.supabaseClient) {
      throw new Error("Supabase is not configured.");
    }
    return window.supabaseClient.auth.signUp({ email, password });
  },
  async resetPassword(email) {
    if (!window.supabaseClient) {
      throw new Error("Supabase is not configured.");
    }
    return window.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`
    });
  },
  async signOut() {
    if (!window.supabaseClient) return { error: null };
    return window.supabaseClient.auth.signOut();
  },
  async getUser() {
    if (!window.supabaseClient) return { data: { user: null }, error: null };
    return window.supabaseClient.auth.getUser();
  },
  async getSession() {
    if (!window.supabaseClient) return { data: { session: null }, error: null };
    return window.supabaseClient.auth.getSession();
  },
  async uploadImage(file, folder = "uploads") {
    if (!file || !file.type?.startsWith("image/")) return null;
    if (!window.supabaseClient) return null;

    try {
      const bucket = "images";
      const name = `${Date.now()}-${String(file.name || "upload").replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
      const path = `${folder}/${name}`;
      const { data, error } = await window.supabaseClient.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "image/jpeg"
        });

      if (error) {
        console.warn("Supabase image upload failed, using fallback data URL.", error);
        return null;
      }

      const publicUrl = window.supabaseClient.storage.from(bucket).getPublicUrl(data.path);
      return publicUrl.data?.publicUrl || null;
    } catch (error) {
      console.warn("Supabase image upload failed, using fallback data URL.", error);
      return null;
    }
  }
};
