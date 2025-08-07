export type NotificationType = 'success' | 'error' | 'info';
export type Notification = { message: string; type: NotificationType };

const listeners = new Set<(n: Notification) => void>();

export function notify(message: string, type: NotificationType = 'info') {
  const notification: Notification = { message, type };
  listeners.forEach(l => l(notification));
}

export function onNotify(listener: (n: Notification) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
