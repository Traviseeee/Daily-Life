const NotificationManager = {
  getPlugin() {
    return window.Capacitor?.Plugins?.LocalNotifications || null;
  },

  async requestPermission() {
    if (window.appData?.profile?.notificationsEnabled === false) return "denied";
    const plugin = this.getPlugin();
    if (!plugin) {
      if (!("Notification" in window)) return "denied";
      return Notification.requestPermission();
    }
    const result = await plugin.requestPermissions();
    return result.display;
  },

  async sync() {
    if (window.appData?.profile?.notificationsEnabled === false) return false;
    const plugin = this.getPlugin();
    if (!plugin) return false;

    try {
      const permission = await plugin.checkPermissions();
      if (permission.display !== "granted") return false;
      const pending = await plugin.getPending();
      if (pending.notifications?.length) {
        await plugin.cancel({ notifications: pending.notifications.map(item => ({ id: item.id })) });
      }

      const notifications = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const addNotification = (item, title, body, id) => {
        if (!item.date || item.done) return;
        const date = new Date(`${item.date}T${item.time || "09:00"}:00`);
        if (Number.isNaN(date.getTime()) || date < new Date()) return;
        notifications.push({ id, title, body, schedule: { at: date }, sound: "default" });
      };

      appData.reminders.forEach((item, index) => addNotification(item, item.title || "MYLIFE reminder", item.notes || item.category || "Upcoming reminder", 1000 + index));
      appData.calendarEvents.forEach((item, index) => addNotification(item, item.title || "MYLIFE event", item.notes || item.category || "Upcoming event", 2000 + index));
      if (notifications.length) await plugin.schedule({ notifications: notifications.slice(0, 50) });
      return true;
    } catch (error) {
      console.warn("MYLIFE could not schedule native notifications.", error);
      return false;
    }
  }
};
