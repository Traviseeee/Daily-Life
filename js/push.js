function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

window.PushNotifications = {
  async enable() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      Toast.show(t("pushUnsupported"), "warning");
      return false;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInstalled = navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    if (isIOS && !isInstalled) {
      Toast.show(t("pushInstallPrompt"), "warning");
      return false;
    }

    try {
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") {
        Toast.show(t("alertsRemainOff"), "warning");
        return false;
      }

      const { data: { session } = {} } = await window.MYLIFE_SUPABASE_API?.getSession?.() || {};
      if (!session?.access_token) {
        Toast.show(t("pushSignInRequired"), "warning");
        return false;
      }

      const configResponse = await fetch("/api/push-config", { cache: "no-store" });
      if (!configResponse.ok) throw new Error("push-config");
      const { publicKey } = await configResponse.json();
      if (!publicKey) throw new Error("push-config");

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        })
      });
      if (response.status === 401) {
        Toast.show(t("pushSignInRequired"), "warning");
        return false;
      }
      if (!response.ok) throw new Error("push-save");

      Toast.show(t("alertsEnabled"), "success");
      return true;
    } catch (error) {
      console.warn("MYLIFE could not enable Web Push.", error);
      Toast.show(error.message === "push-config" ? t("pushSetupIncomplete") : t("pushEnableFailed"), "warning");
      return false;
    }
  },

  async disable() {
    try {
      const registration = await navigator.serviceWorker?.getRegistration("/");
      const subscription = await registration?.pushManager?.getSubscription();
      const { data: { session } = {} } = await window.MYLIFE_SUPABASE_API?.getSession?.() || {};
      if (subscription) {
        if (session?.access_token) {
          await fetch("/api/unsubscribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
        }
        await subscription.unsubscribe();
      }
      return true;
    } catch (error) {
      console.warn("MYLIFE could not disable Web Push on this device.", error);
      return false;
    }
  }
};