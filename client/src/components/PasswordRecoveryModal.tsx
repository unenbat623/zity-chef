import React, { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { X, KeyRound, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useEscapeClose } from '../hooks/useEscapeClose';

/**
 * Completes the "forgot password" flow. The email link signs the user in with
 * their *old* password still in place — this modal is where the new one is
 * actually set. Without it the reset link was a dead end: the user got logged
 * in silently and the password never changed.
 */
export const PasswordRecoveryModal: React.FC = () => {
  const { passwordRecovery, clearPasswordRecovery, updatePassword } = useAuth();
  const { t } = useApp();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);

  useEscapeClose(clearPasswordRecovery, passwordRecovery && !loading);

  const dialogRef = useFocusTrap<HTMLDivElement>(Boolean(passwordRecovery));

  if (!passwordRecovery) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (password.length < 6) {
      setErrorMsg(t('auth_recoveryTooShort'));
      return;
    }
    if (password !== confirm) {
      setErrorMsg(t('auth_recoveryMismatch'));
      return;
    }
    setLoading(true);
    const res = await updatePassword(password);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error || t('auth_recoveryFailed'));
      return;
    }
    setDone(true);
    setTimeout(() => {
      setDone(false);
      clearPasswordRecovery();
    }, 1600);
  };

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => {
          if (!loading) clearPasswordRecovery();
        }}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('auth_recoveryTitle')}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[220] flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        <m.div
          initial={{ scale: 0.94, y: 24, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.94, y: 24, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 240 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-pestle-card border border-pestle-border/80 w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        >
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

          <div className="p-5 sm:p-6 pb-sheet-safe sm:pb-6 flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {done ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 bg-mint/20 text-mint-ink rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-pestle-text">{t('auth_recoveryDone')}</h3>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 bg-mango/15 text-mango-ink rounded-xl flex items-center justify-center">
                      <KeyRound size={20} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-black text-pestle-text">
                        {t('auth_recoveryTitle')}
                      </h2>
                      <p className="text-[11px] text-gray-400 font-medium">
                        {t('auth_recoveryDesc')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearPasswordRecovery}
                    aria-label={t('close')}
                    className="w-8 h-8 shrink-0 border border-pestle-border rounded-xl flex items-center justify-center text-gray-400 hover:text-pestle-text transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth_recoveryNewPassword')}
                      autoComplete="new-password"
                      minLength={6}
                      required
                      className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 pr-11 text-base sm:text-sm text-pestle-text focus:outline-none focus:border-mango"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t('auth_hidePassword') : t('auth_showPassword')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pestle-text"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder={t('auth_recoveryConfirmPassword')}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-base sm:text-sm text-pestle-text focus:outline-none focus:border-mango"
                  />

                  {errorMsg && (
                    <p className="text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary py-3 disabled:opacity-50"
                  >
                    {loading ? t('auth_recoverySaving') : t('auth_recoverySave')}
                  </button>
                </form>
              </>
            )}
          </div>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
};
