import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, AlertTriangle, Utensils, Sparkles, Check, Trash2, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { requestNotificationPermission, sendExpiryNotification, subscribeToPush } from '../lib/notificationService';
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

export const NotificationCenter: React.FC = () => {
  const { inventory, setActiveTab, t } = useApp();
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

  // Dynamic notification list
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => [
    {
      id: 'notif-1',
      title: '⚠️ Муудах дөхсөн орцын сануулга',
      body: `Хөргөгчинд ${expiringItems.length > 0 ? expiringItems.map(i => i.name).slice(0, 3).join(', ') : 'орцууд'} дуусах дөхсөн байна. Амттай хоол хийж идээрэй!`,
      time: 'Түрүүхэн',
      type: 'warning',
      read: false,
      actionTab: 'fridge',
    },
    {
      id: 'notif-2',
      title: '🍳 Өнөөдрийн хоолны төлөвлөгөө',
      body: 'Zity Тогооч танд зориулсан долоо хоногийн хоолны цэсийг бэлтгэлээ.',
      time: '2 цагийн өмнө',
      type: 'meal',
      read: false,
      actionTab: 'calendar',
    },
    {
      id: 'notif-3',
      title: '📸 AI Зураг & Баримт уншигч бэлэн',
      body: 'Дэлгүүрийн баримтын зургийг аваад хөргөгчиндөө автоматаар материал нэмээрэй!',
      time: 'Өчигдөр',
      type: 'tip',
      read: true,
      actionTab: 'fridge',
    },
  ]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const handleTogglePush = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setPushEnabled(true);
      await subscribeToPush();
      toastSuccess('Мэдэгдэл амжилттай идэвхжлээ!', 'Браузер болон утсан дээр сануулга ирэх болно.');
      sendExpiryNotification(expiringItems);
    } else {
      toastInfo('Мэдэгдлийн зөвшөөрөл олгогдсонгүй', 'Браузерын тохиргооноос зөвшөөрөл олгоно уу.');
    }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    // Mark clicked notification as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    if (notif.actionTab) {
      setActiveTab(notif.actionTab);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-8 h-8 sm:w-9 sm:h-9 bg-pestle-card border border-pestle-border hover:border-mango/60 rounded-xl flex items-center justify-center text-pestle-text shadow-xs transition-all active:scale-95 cursor-pointer"
        title="Notification Center"
      >
        <Bell size={16} className={unreadCount > 0 ? 'text-mango animate-bounce' : 'text-gray-400'} />
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
            <div
              className="fixed inset-0 z-[160]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-pestle-card/95 backdrop-blur-xl border border-pestle-border rounded-3xl shadow-2xl z-[170] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-pestle-border/60 flex items-center justify-between bg-pestle-bg/50">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-mango" />
                  <h3 className="font-black text-xs text-pestle-text uppercase tracking-wider">
                    Мэдэгдлийн төв ({notifications.length})
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] font-bold text-mango hover:underline px-2 py-1 rounded-lg"
                    >
                      Уншсанаар тэмдэглэх
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-6 h-6 rounded-lg text-gray-400 hover:text-pestle-text flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Push Permission Switcher Banner */}
              <div className="p-3 bg-mango/10 border-b border-mango/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-mango" />
                  <div>
                    <p className="text-[11px] font-bold text-pestle-text">Web Push Сануулга</p>
                    <p className="text-[9px] text-gray-400 font-medium">Апп хаалттай үед сануулна</p>
                  </div>
                </div>
                <button
                  onClick={handleTogglePush}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                    pushEnabled
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-mango text-white hover:opacity-90'
                  }`}
                >
                  {pushEnabled ? '✓ Идэвхтэй' : 'Идэвхжүүлэх'}
                </button>
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-pestle-border/40 p-1">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 font-medium">
                    Шинэ мэдэгдэл байхгүй байна 🎉
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
                        {notif.type === 'warning' && <AlertTriangle size={15} className="text-amber-500" />}
                        {notif.type === 'meal' && <Utensils size={15} className="text-mango" />}
                        {notif.type === 'tip' && <Sparkles size={15} className="text-purple-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold text-pestle-text line-clamp-1">{notif.title}</h4>
                          <span className="text-[9px] text-gray-400 font-medium shrink-0">{notif.time}</span>
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
                <div className="p-2 border-t border-pestle-border/60 bg-pestle-bg/50 flex justify-center">
                  <button
                    onClick={clearAll}
                    className="text-[10px] font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 py-1 px-3 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} /> Мэдэгдлүүдийг цэвэрлэх
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
