const AUTH_STORAGE_KEY = "mylife:supabase-auth:v1";
const AUTH_STORAGE_DB_NAME = "mylife-auth-storage";
const AUTH_STORAGE_STORE_NAME = "sessions";
const AUTH_STORAGE_DB_VERSION = 1;
const getSupabaseProjectRef = () => {
  const configuredUrl = String(window.MYLIFE_SUPABASE?.url || window.SUPABASE_URL || "");
  return configuredUrl.match(/^https:\/\/([^.]+)/)?.[1] || "";
};

const isLegacyAuthKey = key => {
  const normalizedKey = String(key || "");
  const projectRef = getSupabaseProjectRef();
  return normalizedKey === "supabase.auth.token" || (projectRef && normalizedKey === `sb-${projectRef}-auth-token`);
};

const readLegacyAuthKey = () => {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (isLegacyAuthKey(key) && localStorage.getItem(key)) return key;
    }
  } catch (error) {
    return null;
  }
  return null;
};

const removeLegacyAuthKeys = () => {
  try {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (isLegacyAuthKey(key)) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    return null;
  }
};

const createMemoryAuthStorage = () => {
  const values = new Map();
  return {
    async getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    async setItem(key, value) {
      values.set(String(key), String(value));
    },
    async removeItem(key) {
      values.delete(String(key));
    }
  };
};

const createIndexedDbAuthStorage = () => {
  if (typeof indexedDB === "undefined") return null;

  let databasePromise = null;
  const openDatabase = () => {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = indexedDB.open(AUTH_STORAGE_DB_NAME, AUTH_STORAGE_DB_VERSION);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(AUTH_STORAGE_STORE_NAME)) {
          database.createObjectStore(AUTH_STORAGE_STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Auth storage database is unavailable."));
    }).catch(error => {
      databasePromise = null;
      throw error;
    });
    return databasePromise;
  };

  const runTransaction = (mode, operation) => openDatabase().then(database => new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = database.transaction(AUTH_STORAGE_STORE_NAME, mode);
    } catch (error) {
      reject(error);
      return;
    }
    let request;
    try {
      request = operation(transaction.objectStore(AUTH_STORAGE_STORE_NAME));
    } catch (error) {
      reject(error);
      return;
    }
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error("Auth storage transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Auth storage transaction was aborted."));
  }));

  return {
    async getItem(key) {
      const record = await runTransaction("readonly", store => store.get(String(key)));
      return record?.value ?? null;
    },
    async setItem(key, value) {
      await runTransaction("readwrite", store => store.put({ key: String(key), value: String(value) }));
    },
    async removeItem(key) {
      await runTransaction("readwrite", store => store.delete(String(key)));
    }
  };
};

const readSessionStorage = key => {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

const writeSessionStorage = (key, value) => {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    return null;
  }
};

const removeSessionStorage = key => {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
  } catch (error) {
    return null;
  }
};

const createSafeAuthStorage = () => {
  const indexedStorage = createIndexedDbAuthStorage();
  const memoryStorage = createMemoryAuthStorage();

  const readIndexed = async key => {
    if (!indexedStorage) return null;
    try {
      return await indexedStorage.getItem(key);
    } catch (error) {
      return null;
    }
  };

  const writeIndexed = async (key, value) => {
    if (!indexedStorage) return false;
    try {
      await indexedStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  };

  const removeIndexed = async key => {
    if (!indexedStorage) return;
    try {
      await indexedStorage.removeItem(key);
    } catch (error) {
      return null;
    }
  };

  return {
    async getItem(key) {
      const normalizedKey = String(key);
      const indexedValue = await readIndexed(normalizedKey);
      if (indexedValue !== null) return indexedValue;

      const sessionValue = readSessionStorage(normalizedKey);
      if (sessionValue !== null) return sessionValue;

      const legacyKey = readLegacyAuthKey();
      if (legacyKey) {
        try {
          const legacyValue = localStorage.getItem(legacyKey);
          if (legacyValue) {
            const migrated = await writeIndexed(normalizedKey, legacyValue);
            if (!migrated) writeSessionStorage(normalizedKey, legacyValue);
            if (migrated || readSessionStorage(normalizedKey) === legacyValue) {
              removeLegacyAuthKeys();
            }
            return legacyValue;
          }
        } catch (error) {
          return null;
        }
      }
      return memoryStorage.getItem(normalizedKey);
    },
    async setItem(key, value) {
      const normalizedKey = String(key);
      const normalizedValue = String(value);
      await memoryStorage.setItem(normalizedKey, normalizedValue);
      const persisted = await writeIndexed(normalizedKey, normalizedValue);
      if (!persisted) writeSessionStorage(normalizedKey, normalizedValue);
      if ((persisted || readSessionStorage(normalizedKey) === normalizedValue) && normalizedKey === AUTH_STORAGE_KEY) {
        removeLegacyAuthKeys();
      }
    },
    async removeItem(key) {
      const normalizedKey = String(key);
      await Promise.all([
        removeIndexed(normalizedKey),
        Promise.resolve(memoryStorage.removeItem(normalizedKey))
      ]);
      removeSessionStorage(normalizedKey);
      try {
        localStorage.removeItem(normalizedKey);
      } catch (error) {
      }
      if (normalizedKey === AUTH_STORAGE_KEY) removeLegacyAuthKeys();
    }
  };
};

const safeAuthStorage = createSafeAuthStorage();
const supabaseConfig = window.MYLIFE_SUPABASE || {};
const supabaseUrl = String(supabaseConfig.url || window.SUPABASE_URL || "").trim();
const supabaseAnonKey = String(supabaseConfig.anonKey || window.SUPABASE_ANON_KEY || "").trim();
const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("YOUR-PROJECT") && !supabaseAnonKey.includes("YOUR-"));

if (supabaseEnabled && window.supabase?.createClient) {
  window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: AUTH_STORAGE_KEY,
      storage: safeAuthStorage
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

const getAppBaseUrl = () => {
  const configuredUrl = String(window.MYLIFE_APP_URL || "").trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  return String(window.location.origin || "").replace(/\/$/, "");
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
      redirectTo: `${getAppBaseUrl()}${window.location.pathname}`
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
      const url = publicUrl.data?.publicUrl || "";
      return url ? `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}` : null;
    } catch (error) {
      console.warn("Supabase image upload failed, using fallback data URL.", error);
      return null;
    }
  },
  async uploadImageDataUrl(dataUrl, folder = "uploads") {
    if (!String(dataUrl || "").startsWith("data:image/") || !window.supabaseClient) return null;

    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const extension = blob.type.split("/")[1] || "jpeg";
      const file = new File([blob], `mylife-${Date.now()}.${extension}`, { type: blob.type });
      return window.MYLIFE_SUPABASE_API.uploadImage(file, folder);
    } catch (error) {
      console.warn("Supabase data URL upload failed.", error);
      return null;
    }
  }
};
