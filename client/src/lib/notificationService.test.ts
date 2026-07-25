import { describe, it, expect } from 'vitest';
import { requestNotificationPermission, sendExpiryNotification } from './notificationService';

describe('Notification Service Unit Tests', () => {
  it('should export notification functions correctly', () => {
    expect(typeof requestNotificationPermission).toBe('function');
    expect(typeof sendExpiryNotification).toBe('function');
  });

  it('should handle non-expiring items array gracefully', () => {
    expect(() => sendExpiryNotification([])).not.toThrow();
  });
});
