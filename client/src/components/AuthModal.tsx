import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Mail,
  Lock,
  User,
  KeyRound,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Eye,
  EyeOff,
  ChefHat,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthView = 'login' | 'register' | 'otp' | 'forgot' | 'profile';

const GoogleSvgIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { subscription, setShowSubModal, profile, setActiveTab, t } = useApp();
  const {
    user: authUser,
    isAnonymous,
    signInWithPassword,
    signUpWithPassword,
    verifyEmailOtp,
    resendEmailOtp,
    signInWithGoogle,
    resetPassword,
    signOut,
  } = useAuth();

  // A "real" (non-anonymous) signed-in user, shaped for the profile view JSX.
  const isLoggedIn = Boolean(authUser && !isAnonymous);
  const user = isLoggedIn
    ? {
        name:
          (authUser!.user_metadata?.full_name as string) ||
          authUser!.email?.split('@')[0] ||
          t('auth_defaultUserName'),
        email: authUser!.email || authUser!.phone || '',
        avatarUrl: (authUser!.user_metadata?.avatar_url as string) || '',
      }
    : null;

  const [view, setView] = useState<AuthView>(isLoggedIn ? 'profile' : 'login');

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');


  // OTP State
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState<number>(60);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Keep the view in sync with real auth state (e.g. after OAuth redirect).
    if (isLoggedIn && view !== 'profile') {
      setView('profile');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, isOpen]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (view === 'otp' && otpTimer > 0) {
      const interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [view, otpTimer]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newValues = [...otpValues];
    newValues[index] = value.slice(-1);
    setOtpValues(newValues);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg(t('auth_errEmailPassword'));
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const res = await signInWithPassword(email, password);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error || t('auth_errLoginFailed'));
      return;
    }
    onClose();
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setErrorMsg(t('auth_errFillAll'));
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const res = await signUpWithPassword(email, password, fullName);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error || t('auth_errRegisterFailed'));
      return;
    }
    if (res.pendingVerification) {
      setOtpValues(['', '', '', '', '', '']);
      setOtpTimer(60);
      setSuccessMsg(t('auth_otpSent'));
      setView('otp');
    } else {
      onClose();
    }
  };

  const handleOtpVerify = async () => {
    const code = otpValues.join('');
    if (code.length < 6) {
      setErrorMsg(t('auth_errOtpIncomplete'));
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const res = await verifyEmailOtp(email, code);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error || t('auth_errOtpWrong'));
      return;
    }
    onClose();
  };

  const handleResendOtp = async () => {
    setErrorMsg('');
    const res = await resendEmailOtp(email);
    if (!res.ok) {
      setErrorMsg(res.error || t('auth_errResendFailed'));
      return;
    }
    setOtpTimer(60);
    setSuccessMsg(t('auth_newCodeSent'));
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    const res = await signInWithGoogle();
    setLoading(false);
    // On success, Supabase redirects browser to Google — we only handle error.
    if (!res.ok) {
      setErrorMsg(res.error || t('auth_errGoogleFailed'));
    }
  };

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg(t('auth_errEnterEmail'));
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const res = await resetPassword(email);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error || t('auth_errGeneric'));
      return;
    }
    setSuccessMsg(t('auth_resetLinkSent'));
  };

  const renderSocialAuthSection = () => (
    <div className="pt-1 space-y-2">
      <div className="relative my-3 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-pestle-border/80" />
        </div>
        <span className="relative bg-pestle-card px-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {t('auth_orSocial')}
        </span>
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-mango dark:hover:border-mango text-gray-800 dark:text-gray-100 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] group"
      >
        {loading ? (
          <RefreshCw size={14} className="animate-spin text-gray-400" />
        ) : (
          <GoogleSvgIcon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
        )}
        <span>{t('auth_googleLogin')}</span>
      </button>
    </div>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 240 }}
          className="w-full max-w-[390px] bg-pestle-card border border-pestle-border/80 rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden relative"
        >
          {/* Mobile Bottom-Sheet Pull Bar */}
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden" />
          {/* Top Decorative Banner */}
          <div className="px-5 pt-4 pb-3 bg-gradient-to-br from-mango/12 via-amber-500/5 to-transparent border-b border-pestle-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-mango text-white flex items-center justify-center shadow-md shadow-mango/20">
                <ChefHat size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-pestle-text">
                  {view === 'login' && t('auth_titleLogin')}
                  {view === 'register' && t('auth_titleRegister')}
                  {view === 'otp' && t('auth_titleOtp')}
                  {view === 'forgot' && t('auth_titleForgot')}
                  {view === 'profile' && t('auth_titleProfile')}
                </h3>
                <p className="text-[10px] text-gray-400 font-semibold">AI Kitchen Ecosystem</p>
              </div>
            </div>

            <button onClick={onClose} aria-label={t('close')} className="modal-close-btn">
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <div className="px-5 py-4 space-y-3">
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl flex items-center gap-2">
                <span>⚠️ {errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-mint/15 border border-mint/30 text-mint text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* 1️⃣ LOGIN VIEW */}
            {view === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                    <Mail size={14} className="text-mango" /> {t('auth_emailLabel')}
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-pestle-text flex items-center gap-1">
                      <Lock size={12} className="text-mango" /> {t('auth_passwordLabel')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setView('forgot')}
                      className="text-[11px] font-bold text-mango hover:underline"
                    >
                      {t('auth_forgotQ')}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-pestle-bg border border-pestle-border rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pestle-text"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-mango/15"
                >
                  {loading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <>
                      <span>{t('auth_loginBtn')}</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

                {/* Social Login Section */}
                {renderSocialAuthSection()}

                <div className="text-center pt-1">
                  <span className="text-xs text-gray-400 font-medium">{t('auth_newUserQ')} </span>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setView('register');
                    }}
                    className="text-xs font-bold text-mango hover:underline"
                  >
                    {t('auth_registerBtn')}
                  </button>
                </div>
              </form>
            )}

            {/* 2️⃣ REGISTER VIEW */}
            {view === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                    <User size={14} className="text-mango" /> {t('auth_fullNameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('auth_fullNamePlaceholder')}
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                    <Mail size={14} className="text-mango" /> {t('auth_emailLabel')}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                    <Lock size={14} className="text-mango" /> {t('auth_createPasswordLabel')}
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-mango/20"
                >
                  {loading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <>
                      <span>{t('auth_getOtpBtn')}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                {/* Social Login Section */}
                {renderSocialAuthSection()}

                <div className="text-center pt-2">
                  <span className="text-xs text-gray-400 font-medium">{t('auth_haveAccountQ')} </span>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setView('login');
                    }}
                    className="text-xs font-bold text-mango hover:underline"
                  >
                    {t('auth_loginBtn')}
                  </button>
                </div>
              </form>
            )}

            {/* 3️⃣ OTP VIEW */}
            {view === 'otp' && (
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 bg-mango/15 text-mango rounded-2xl flex items-center justify-center mx-auto">
                  <KeyRound size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-pestle-text">
                    {t('auth_otpHeading')}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('auth_otpSentPrefix')}{' '}
                    <span className="font-bold text-mango">{email}</span>{' '}
                    {t('auth_otpSentSuffix')}
                  </p>
                </div>

                <div className="flex justify-center gap-2 my-2">
                  {otpValues.map((val, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      maxLength={1}
                      value={val}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-lg font-black bg-pestle-bg border border-pestle-border rounded-xl text-pestle-text focus:outline-none focus:border-mango"
                    />
                  ))}
                </div>

                <button
                  onClick={handleOtpVerify}
                  disabled={loading}
                  className="w-full btn-primary py-3.5 text-xs font-bold shadow-lg shadow-mango/20"
                >
                  {loading ? (
                    <RefreshCw size={16} className="animate-spin mx-auto" />
                  ) : (
                    t('auth_verifyBtn')
                  )}
                </button>

                <div className="text-xs text-gray-400 font-medium">
                  {otpTimer > 0 ? (
                    <span>
                      {t('auth_resendIn')} <strong className="text-mango">{otpTimer}s</strong>
                    </span>
                  ) : (
                    <button
                      onClick={handleResendOtp}
                      className="text-mango font-bold hover:underline"
                    >
                      {t('auth_resendCode')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 4️⃣ FORGOT VIEW */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-gray-400">
                  {t('auth_forgotDesc')}
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                    <Mail size={14} className="text-mango" /> {t('auth_emailLabel')}
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3.5 text-xs font-bold shadow-lg shadow-mango/20"
                >
                  {loading ? (
                    <RefreshCw size={16} className="animate-spin mx-auto" />
                  ) : (
                    t('auth_sendCodeBtn')
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="w-full text-xs font-bold text-gray-400 hover:text-pestle-text py-2"
                >
                  ← {t('auth_backToLogin')}
                </button>
              </form>
            )}

            {/* 5️⃣ PROFILE VIEW */}
            {view === 'profile' && (
              <div className="space-y-4">
                {/* Profile Card Header */}
                <div className="flex items-center gap-3.5 p-4 bg-pestle-bg border border-pestle-border/80 rounded-2xl">
                  <div
                    className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 shadow-md bg-gradient-to-br ${profile.coverGradient}`}
                  >
                    {profile.avatarUrl || user?.avatarUrl ? (
                      <img
                        src={profile.avatarUrl || user?.avatarUrl || ''}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={26} className="text-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-sm text-pestle-text flex items-center gap-1.5 truncate">
                      <span>{profile.name || user?.name || t('auth_yourName')}</span>
                      <ShieldCheck size={16} className="text-mint shrink-0" />
                    </h4>
                    <p className="text-xs text-gray-400 font-medium truncate">
                      {profile.username || user?.email || '@chef_mongolia'}
                    </p>
                    <span className="inline-block mt-1 text-[9px] font-black bg-mango/15 text-mango px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-mango/20">
                      {subscription.toUpperCase()} CHEF TIER
                    </span>
                  </div>
                </div>

                {/* Quick Action List */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      onClose();
                      setActiveTab('profile');
                    }}
                    className="w-full bg-pestle-bg border border-pestle-border p-3.5 rounded-2xl text-xs font-bold text-pestle-text flex items-center justify-between hover:border-mango transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-2.5">
                      <User size={16} className="text-mango" />
                      <span>{t('auth_goToProfile')}</span>
                    </span>
                    <ArrowRight size={14} className="text-gray-400" />
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      setShowSubModal(true);
                    }}
                    className="w-full bg-pestle-bg border border-pestle-border p-3.5 rounded-2xl text-xs font-bold text-pestle-text flex items-center justify-between hover:border-mango transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-2.5">
                      <Sparkles size={16} className="text-amber-500" />
                      <span>{t('auth_subscriptionStatus')}</span>
                    </span>
                    <span className="text-[10px] font-black bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-lg uppercase">
                      {subscription}
                    </span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full bg-red-500/10 border border-red-500/20 p-3.5 rounded-2xl text-xs font-bold text-red-500 flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all cursor-pointer active:scale-[0.98] shadow-xs"
                  >
                    <LogOut size={16} />
                    <span>{t('auth_logout')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
