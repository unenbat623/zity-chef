import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (opts: Omit<ToastItem, 'id'>) => void;
  toastSuccess: (title: string, message?: string) => void;
  toastError: (title: string, message?: string) => void;
  toastWarning: (title: string, message?: string) => void;
  toastInfo: (title: string, message?: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────
export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

// ── Config ────────────────────────────────────────────────────────────────────
const TOAST_CONFIG: Record<
  ToastType,
  { icon: React.ReactNode; bg: string; border: string; iconColor: string; titleColor: string }
> = {
  success: {
    icon: <CheckCircle2 size={18} />,
    bg: 'bg-emerald-500/12',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    titleColor: 'text-emerald-700 dark:text-emerald-300',
  },
  error: {
    icon: <XCircle size={18} />,
    bg: 'bg-red-500/12',
    border: 'border-red-500/30',
    iconColor: 'text-red-500',
    titleColor: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: <AlertTriangle size={18} />,
    bg: 'bg-amber-500/12',
    border: 'border-amber-500/30',
    iconColor: 'text-amber-700 dark:text-amber-400',
    titleColor: 'text-amber-700 dark:text-amber-300',
  },
  info: {
    icon: <Info size={18} />,
    bg: 'bg-sky-500/12',
    border: 'border-sky-500/30',
    iconColor: 'text-sky-700 dark:text-sky-400',
    titleColor: 'text-sky-700 dark:text-sky-300',
  },
};

// ── Single Toast Card ─────────────────────────────────────────────────────────
const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const cfg = TOAST_CONFIG[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.88 }}
      transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      className={`relative flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-2xl border shadow-xl backdrop-blur-md pointer-events-auto ${cfg.bg} ${cfg.border}`}
    >
      {/* Progress bar — shrinks over the toast's lifetime. scaleX rather than
          width: animating width relayouts the card on every frame. */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 w-full origin-left rounded-b-2xl bg-current opacity-25"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: (toast.duration ?? 3500) / 1000, ease: 'linear' }}
      />

      {/* Icon */}
      <span className={`shrink-0 mt-0.5 ${cfg.iconColor}`}>{cfg.icon}</span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-extrabold leading-snug ${cfg.titleColor}`}>{toast.title}</p>
        {toast.message && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5 leading-relaxed">
            {toast.message}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        aria-label="Хаах"
        className="shrink-0 w-9 h-9 -m-1.5 flex items-center justify-center text-gray-400 hover:text-pestle-text rounded-full hover:bg-black/10 transition-all"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

// ── Provider ──────────────────────────────────────────────────────────────────
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ type, title, message, duration = 3500 }: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-4), { id, type, title, message, duration }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const toastSuccess = useCallback(
    (title: string, message?: string) => toast({ type: 'success', title, message }),
    [toast]
  );
  const toastError = useCallback(
    (title: string, message?: string) => toast({ type: 'error', title, message }),
    [toast]
  );
  const toastWarning = useCallback(
    (title: string, message?: string) => toast({ type: 'warning', title, message }),
    [toast]
  );
  const toastInfo = useCallback(
    (title: string, message?: string) => toast({ type: 'info', title, message }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, toastSuccess, toastError, toastWarning, toastInfo }}>
      {children}

      {/* Toast Viewport — top-right corner, above all modals. z-[400] because
          several sheets sit at z-[350]/z-[360]; a toast fired from inside one
          of them was rendered invisibly behind it at the old z-[300]. */}
      <div className="fixed top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 z-[400] flex flex-col gap-2 w-[340px] max-w-[calc(100%-2rem)] pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
