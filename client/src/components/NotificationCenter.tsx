import React, { useState, useMemo, useEffect } from 'react';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { m, AnimatePresence } from 'motion/react';
import {
  Bell,
  AlertTriangle,
  Utensils,
  Sparkles,
  Check,
  Trash2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  requestNotificationPermission,
  sendExpiryNotification,
  subscribeToPush,
} from '../lib/notificationService';
import { useToast } from './Toast';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  type: 'warning' | 'meal' | 'system' | 'tip';
  read: boolean;
  actionTab?: string;
}

interface NotificationReadState {
  readIds: string[];
  /** What the fridge looked like when the user last cleared the list. */
  clearedSignature: string | null;
  clearedAt: number | null;
}

const DEFAULT_READ_STATE: NotificationReadState = {
  readIds: ['notif-3'],
  clearedSignature: null,
  clearedAt: null,
};

/** A cleared list comes back after this long even if nothing changed, so an
 *  expiry warning is never silenced permanently. */
const CLEAR_TTL_MS = 24 * 60 * 60 * 1000;

/** Read/dismissed state lives in localStorage so a refresh does not resurrect
 *  notifications the user already went through. Scoped per account. */
function readNotificationState(accountId: string): NotificationReadState {
  try {
    const raw = localStorage.getItem(`zity_notif_state:${accountId}`);
    if (!raw) return DEFAULT_READ_STATE;
    const parsed = JSON.parse(raw) as Partial<NotificationReadState> & { cleared?: boolean };
    return {
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds : DEFAULT_READ_STATE.readIds,
      // Migrates the old permanent `cleared: true` flag onto the timed one.
      clearedSignature:
        typeof parsed.clearedSignature === 'string' ? parsed.clearedSignature : null,
      clearedAt:
        typeof parsed.clearedAt === 'number'
          ? parsed.clearedAt
          : parsed.cleared
            ? Date.now()
            : null,
    };
  } catch {
    return DEFAULT_READ_STATE;
  }
}

export const NotificationCenter: React.FC = () => {
  const { inventory, setActiveTab, accountId, t } = useApp();
  const { toastSuccess, toastInfo } = useToast();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  // Calculate expiring ingredients
  const expiringItems = useMemo(() => {
    return inventory.filter((item) => item.expiryDays <= 3);
  }, [inventory]);

  const [readIds, setReadIds] = useState<string[]>(() => readNotificationState(accountId).readIds);
  const [clearedSignature, setClearedSignature] = useState<string | null>(
    () => readNotificationState(accountId).clearedSignature
  );
  const [clearedAt, setClearedAt] = useState<number | null>(
    () => readNotificationState(accountId).clearedAt
  );

  // Re-read when the account changes (sign in / sign out swaps the identity).
  useEffect(() => {
    const next = readNotificationState(accountId);
    setReadIds(next.readIds);
    setClearedSignature(next.clearedSignature);
    setClearedAt(next.clearedAt);
  }, [accountId]);

  useEffect(() => {
    localStorage.setItem(
      `zity_notif_state:${accountId}`,
      JSON.stringify({ readIds, clearedSignature, clearedAt })
    );
  }, [accountId, readIds, clearedSignature, clearedAt]);

  const expiringNames =
    expiringItems.length > 0
      ? expiringItems
          .map((i) => i.name)
          .slice(0, 3)
          .join(', ')
      : t('notif_expiringFallback');

  // Clearing hides what is on screen *now*. It used to set a permanent flag, so
  // one tap meant the user never saw another expiry warning — the list comes
  // back when the fridge changes, or after a day.
  const cleared = useMemo(() => {
    if (clearedAt === null) return false;
    if (Date.now() - clearedAt > CLEAR_TTL_MS) return false;
    return clearedSignature === expiringNames;
  }, [clearedAt, clearedSignature, expiringNames]);

  const notifications = useMemo<NotificationItem[]>(() => {
    if (cleared) return [];
    return [
      {
        id: 'notif-1',
        title: t('notif_expiringTitle'),
        body: t('notif_expiringBody', { items: expiringNames }),
        time: t('notif_justNow'),
        type: 'warning',
        read: readIds.includes('notif-1'),
        actionTab: 'fridge',
      },
      {
        id: 'notif-2',
        title: t('notif_mealPlanTitle'),
        body: t('notif_mealPlanBody'),
        time: t('notif_twoHoursAgo'),
        type: 'meal',
        read: readIds.includes('notif-2'),
        actionTab: 'calendar',
      },
      {
        id: 'notif-3',
        title: t('notif_scannerTitle'),
        body: t('notif_scannerBody'),
        time: t('notif_yesterday'),
        type: 'tip',
        read: readIds.includes('notif-3'),
        actionTab: 'fridge',
      },
    ];
  }, [cleared, expiringNames, readIds, t]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const handleTogglePush = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setPushEnabled(true);
      await subscribeToPush();
      toastSuccess(t('notif_pushEnabledTitle'), t('notif_pushEnabledBody'));
      sendExpiryNotification(expiringItems);
    } else {
      toastInfo(t('notif_pushDeniedTitle'), t('notif_pushDeniedBody'));
    }
  };

  const markAllAsRead = () => {
    setReadIds(notifications.map((n) => n.id));
  };

  const clearAll = () => {
    setClearedSignature(expiringNames);
    setClearedAt(Date.now());
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    // Mark clicked notification as read
    setReadIds((prev) => (prev.includes(notif.id) ? prev : [...prev, notif.id]));
    if (notif.actionTab) {
      setActiveTab(notif.actionTab);
    }
    setIsOpen(false);
  };

  useEscapeClose(() => setIsOpen(false), isOpen);

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-8 h-8 sm:w-9 sm:h-9 bg-pestle-card border border-pestle-border hover:border-mango/60 rounded-xl flex items-center justify-center text-pestle-text shadow-xs transition-all active:scale-95 cursor-pointer"
        title={t('notif_centerTitle')}
        aria-label={t('notif_centerTitle')}
        aria-expanded={isOpen}
      >
        <Bell
          size={16}
          className={unreadCount > 0 ? 'text-mango-ink animate-bounce' : 'text-gray-400'}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center shadow-md animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[160]" onClick={() => setIsOpen(false)} />
            <m.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              role="dialog"
              aria-label={t('notif_centerTitle')}
              className="fixed left-3 right-3 top-[calc(4.5rem+env(safe-area-inset-top,0px))] max-h-[calc(100dvh-7rem)] bg-pestle-card/95 backdrop-blur-xl border border-pestle-border rounded-3xl shadow-2xl z-[170] overflow-hidden flex flex-col sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 sm:max-h-[80dvh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-pestle-border/60 flex items-center justify-between gap-3 bg-pestle-bg/50 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Bell size={16} className="text-mango-ink" />
                  <h3 className="font-black text-xs text-pestle-text uppercase tracking-wider truncate">
                    {t('notif_centerTitle')} ({notifications.length})
                  </h3>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] font-bold text-mango-ink hover:underline px-2 py-1 rounded-lg"
                    >
                      {t('notif_markAllRead')}
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    aria-label={t('close')}
                    className="w-8 h-8 rounded-lg text-gray-400 hover:text-pestle-text flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Push Permission Switcher Banner */}
              <div className="p-3 bg-mango/10 border-b border-mango/20 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck size={16} className="text-mango-ink" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-pestle-text truncate">
                      {t('notif_pushTitle')}
                    </p>
                    <p className="text-[9px] text-gray-400 font-medium truncate">
                      {t('notif_pushSubtitle')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleTogglePush}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all shrink-0 ${
                    pushEnabled
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-mango text-white hover:opacity-90'
                  }`}
                >
                  {pushEnabled ? t('notif_pushActive') : t('notif_pushActivate')}
                </button>
              </div>

              {/* Notification List — takes the space the panel actually has
                  rather than a fixed 320px, which left a gap under the list on
                  a tall phone and clipped it on a short one. */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-pestle-border/40 p-1">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 font-medium">
                    {t('notif_empty')}
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3 rounded-2xl transition-all cursor-pointer flex items-start gap-3 ${
                        notif.read
                          ? 'opacity-70 hover:opacity-100 hover:bg-pestle-bg/40'
                          : 'bg-mango/5 border-l-4 border-mango hover:bg-mango/10'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-pestle-bg border border-pestle-border flex items-center justify-center shrink-0 mt-0.5">
                        {notif.type === 'warning' && (
                          <AlertTriangle size={15} className="text-amber-700 dark:text-amber-400" />
                        )}
                        {notif.type === 'meal' && <Utensils size={15} className="text-mango-ink" />}
                        {notif.type === 'tip' && <Sparkles size={15} className="text-purple-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold text-pestle-text line-clamp-1">
                            {notif.title}
                          </h4>
                          <span className="text-[9px] text-gray-400 font-medium shrink-0">
                            {notif.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium line-clamp-2 mt-0.5 leading-relaxed">
                          {notif.body}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-2 pb-safe sm:pb-2 border-t border-pestle-border/60 bg-pestle-bg/50 flex justify-center shrink-0">
                  <button
                    onClick={clearAll}
                    className="text-[10px] font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 py-1 px-3 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} /> {t('notif_clearAll')}
                  </button>
                </div>
              )}
            </m.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
