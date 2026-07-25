import { Ingredient } from '../types';

/**
 * Web Notification API & Push Reminder Manager
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function sendExpiryNotification(expiringItems: Ingredient[]) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  if (expiringItems.length === 0) return;

  const names = expiringItems.map((i) => i.name).join(', ');
  const title = `⚠️ Zity Chef: Муудах дөхсөн орц байна! (${expiringItems.length})`;
  const body = `${names} орцуудын хугацаа 3 ба түүнээс бага хоног үлдлээ. Амттай хоол хийж идээрэй! 🍳`;

  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    });
  } catch (e) {
    console.log('Notification error:', e);
  }
}
