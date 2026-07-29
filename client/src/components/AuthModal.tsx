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

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { subscription, setShowSubModal, profile, setActiveTab } = useApp();
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
          'Хэрэглэгч',
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
      setErrorMsg('И-мэйл болон нууц үгээ оруулна уу.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const res = await signInWithPassword(email, password);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'Нэвтрэхэд алдаа гарлаа.');
      return;
    }
    onClose();
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setErrorMsg('Бүх талбарыг бөглөнө үү.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const res = await signUpWithPassword(email, password, fullName);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'Бүртгэл үүсгэхэд алдаа гарлаа.');
      return;
    }
    if (res.pendingVerification) {
      setOtpValues(['', '', '', '', '', '']);
      setOtpTimer(60);
      setSuccessMsg('Баталгаажуулах код и-мэйл рүү илгээгдлээ.');
      setView('otp');
    } else {
      onClose();
    }
  };

  const handleOtpVerify = async () => {
    const code = otpValues.join('');
    if (code.length < 6) {
      setErrorMsg('6 оронтой баталгаажуулах кодыг бүтэн оруулна уу.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const res = await verifyEmailOtp(email, code);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'Код буруу байна.');
      return;
    }
    onClose();
  };

  const handleResendOtp = async () => {
    setErrorMsg('');
    const res = await resendEmailOtp(email);
    if (!res.ok) {
      setErrorMsg(res.error || 'Код дахин илгээхэд алдаа гарлаа.');
      return;
    }
    setOtpTimer(60);
    setSuccessMsg('Шинэ код илгээгдлээ.');
  };

  const handleSocialLogin = async (provider: 'Google' | 'Apple') => {
    if (provider !== 'Google') return;
    setLoading(true);
    setErrorMsg('');
    const res = await signInWithGoogle();
    // On success the browser redirects to Google, so we only handle errors here.
    if (!res.ok) {
      setLoading(false);
      setErrorMsg(res.error || 'Google-ээр нэвтрэхэд алдаа гарлаа.');
    }
  };

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('И-мэйл хаягаа оруулна уу.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const res = await resetPassword(email);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'Алдаа гарлаа.');
      return;
    }
    setSuccessMsg('Нууц үг сэргээх холбоос и-мэйл рүү очлоо!');
  };

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
                  {view === 'login' && 'Zity Chef Нэвтрэх'}
                  {view === 'register' && 'Шинэ бүртгэл үүсгэх'}
                  {view === 'otp' && 'И-мэйл баталгаажуулах'}
                  {view === 'forgot' && 'Нууц үг сэргээх'}
                  {view === 'profile' && 'Миний бүртгэл'}
                </h3>
                <p className="text-[10px] text-gray-400 font-semibold">AI Kitchen Ecosystem</p>
              </div>
            </div>

            <button onClick={onClose} aria-label="Хаах" className="modal-close-btn">
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
                    <Mail size={14} className="text-mango" /> И-мэйл хаяг
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
                      <Lock size={12} className="text-mango" /> Нууц үг
                    </label>
                    <button
                      type="button"
                      onClick={() => setView('forgot')}
                      className="text-[11px] font-bold text-mango hover:underline"
                    >
                      Мартсан уу?
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
                      <span>Нэвтрэх</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

                {/* Social Login Buttons */}
                <div className="pt-2 border-t border-pestle-border space-y-2">
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('Google')}
                    className="w-full bg-pestle-bg border border-pestle-border py-2 rounded-xl text-xs font-bold text-pestle-text flex items-center justify-center gap-2 hover:border-mango transition-colors"
                  >
                    <span>🌐 Google-ээр нэвтрэх</span>
                  </button>
                </div>

                <div className="text-center">
                  <span className="text-xs text-gray-400 font-medium">Шинэ хэрэглэгч үү? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setView('register');
                    }}
                    className="text-xs font-bold text-mango hover:underline"
                  >
                    Бүртгүүлэх
                  </button>
                </div>
              </form>
            )}

            {/* 2️⃣ REGISTER VIEW */}
            {view === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                    <User size={14} className="text-mango" /> Бүтэн нэр
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Бат-Эрдэнэ"
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                    <Mail size={14} className="text-mango" /> И-мэйл хаяг
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
                    <Lock size={14} className="text-mango" /> Нууц үг үүсгэх
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
                      <span>Код хүлээн авах (OTP)</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <span className="text-xs text-gray-400 font-medium">Бүртгэлтэй юу? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setView('login');
                    }}
                    className="text-xs font-bold text-mango hover:underline"
                  >
                    Нэвтрэх
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
                    6 Оронтой Код Оруулна уу
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    <span className="font-bold text-mango">{email}</span> хаяг руу баталгаажуулах
                    код очив.
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
                    'Баталгаажуулах'
                  )}
                </button>

                <div className="text-xs text-gray-400 font-medium">
                  {otpTimer > 0 ? (
                    <span>
                      Дахин илгээх: <strong className="text-mango">{otpTimer}s</strong>
                    </span>
                  ) : (
                    <button
                      onClick={handleResendOtp}
                      className="text-mango font-bold hover:underline"
                    >
                      Дахин код авах
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 4️⃣ FORGOT VIEW */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-gray-400">
                  Бүртгэлтэй и-мэйл хаягаа оруулбал нууц үг сэргээх холбоос очих болно.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                    <Mail size={14} className="text-mango" /> И-мэйл хаяг
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
                    'Код Илгээх'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="w-full text-xs font-bold text-gray-400 hover:text-pestle-text py-2"
                >
                  ← Нэвтрэх рүү буцах
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
                      <span>{profile.name || user?.name || 'Таны Нэр'}</span>
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
                      <span>Миний профайл хуудас рүү очих</span>
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
                      <span>Миний сунгалт & Эрхийн төлөв</span>
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
                    <span>Системээс Гарах</span>
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
