import { Ingredient } from '../types';
import { authedFetch, API_BASE } from './apiClient';

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
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return;
  }

  if (expiringItems.length === 0) return;

  const names = expiringItems.map((i) => i.name).join(', ');
  const title = `⚠️ Zity Chef: Муудах дөхсөн орц байна! (${expiringItems.length})`;
  const body = `${names} орцуудын хугацаа 3 ба түүнээс бага хоног үлдлээ. Амттай хоол хийж идээрэй! 🍳`;

  try {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
  } catch (e) {
    console.error('Notification error:', e);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Subscribes this device to Web Push (VAPID) so the server can deliver expiry
 * reminders even when the app is closed. Returns true on success.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const res = await fetch(`${API_BASE}/api/push/vapid-public-key`);
    const { publicKey, configured } = await res.json();
    if (!configured || !publicKey) return false;

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    await authedFetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: sub }),
    });
    return true;
  } catch (e) {
    console.warn('[Zity Chef] Push subscribe failed:', e);
    return false;
  }
}
