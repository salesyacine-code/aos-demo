class NotificationStore {
  constructor() {
    this.notifications = [];
  }

  record(item) {
    const entry = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...item
    };
    this.notifications.unshift(entry);
    return entry;
  }

  getAll() {
    return this.notifications;
  }

  getByRequestId(requestId) {
    return this.notifications.filter(n => n.requestId === requestId);
  }
}

export const notificationStore = new NotificationStore();

