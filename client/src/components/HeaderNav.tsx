import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Sparkles, Sun, Moon, User } from 'lucide-react';
import { AuthModal, UserProfile } from './AuthModal';

export const HeaderNav: React.FC = () => {
  const { lang, setLang, isDark, toggleDarkMode, subscription, setShowSubModal, profile, setProfile, setActiveTab, t } = useApp();
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('zity_user');
    return saved ? JSON.parse(saved) : { name: profile.name, email: 'user@zity.mn', avatarUrl: profile.avatarUrl || '', isVerified: true };
  });
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    localStorage.setItem('zity_user', JSON.stringify(loggedInUser));
    setProfile({
      ...profile,
      name: loggedInUser.name,
      avatarUrl: loggedInUser.avatarUrl,
    });
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('zity_user');
    setShowAuthModal(false);
  };

  return (
    <>
      <header className="px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center bg-pestle-bg/95 border-b border-pestle-border/50 sticky top-0 z-30 backdrop-blur-md w-full shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr ${profile.coverGradient} text-white font-extrabold rounded-xl flex items-center justify-center shadow-md shrink-0 text-sm sm:text-base`}>
            Z
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-lg leading-none tracking-tight flex items-center gap-1.5 text-pestle-text truncate">
              Zity Chef
              {subscription === 'pro' && (
                <span className="text-[9px] sm:text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm shrink-0">
                  <Sparkles size={9} /> PRO
                </span>
              )}
              {subscription === 'family' && (
                <span className="text-[9px] sm:text-[10px] bg-gradient-to-r from-teal-400 to-emerald-500 text-white font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm shrink-0">
                  FAMILY
                </span>
              )}
            </h1>
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate">
              Smart AI Culinary Assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* User Profile / Auth trigger button */}
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2 bg-pestle-card border border-pestle-border px-3 py-1.5 rounded-xl text-xs font-bold text-pestle-text hover:border-mango transition-all active:scale-95 shadow-sm cursor-pointer"
            title="User Profile & Account"
          >
            <div className={`w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br ${profile.coverGradient} shrink-0`}>
              {profile.avatarUrl || user?.avatarUrl ? (
                <img
                  src={profile.avatarUrl || user?.avatarUrl || ''}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={13} className="text-white" />
              )}
            </div>
            <span className="hidden sm:inline text-xs font-bold text-pestle-text">
              {profile.name || user?.name || 'Таны Нэр'}
            </span>
          </button>

          {/* Subscription Upgrade Pill */}
          {subscription === 'free' && (
            <button
              onClick={() => setShowSubModal(true)}
              className="text-[10px] sm:text-[11px] font-bold bg-mango/15 text-mango border border-mango/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl hover:bg-mango hover:text-white transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap shadow-sm"
            >
              <Sparkles size={11} />
              <span className="hidden xs:inline">{t('upgradeBtn')}</span>
              <span className="xs:hidden">PRO</span>
            </button>
          )}

          {/* Animated Language Switcher */}
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setLang(lang === 'mn' ? 'en' : 'mn')}
            className="relative h-8 sm:h-9 px-2 sm:px-2.5 bg-pestle-card border border-pestle-border hover:border-mango/60 rounded-xl flex items-center justify-center gap-1 text-xs font-bold text-pestle-text shadow-sm hover:shadow-md transition-all shrink-0 cursor-pointer overflow-hidden group"
            title="Switch Language / Хэл солих"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={lang}
                initial={{ y: -12, opacity: 0, scale: 0.5, rotate: -20 }}
                animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                exit={{ y: 12, opacity: 0, scale: 0.5, rotate: 20 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="text-base leading-none select-none flex items-center gap-1"
              >
                <span>{lang === 'mn' ? '🇲🇳' : '🇺🇸'}</span>
                <span className="text-[10px] font-extrabold tracking-wider text-gray-500 uppercase group-hover:text-mango transition-colors">
                  {lang === 'mn' ? 'MN' : 'EN'}
                </span>
              </motion.span>
            </AnimatePresence>
          </motion.button>

          {/* Animated Dark Mode Toggle */}
          <motion.button
            whileHover={{ scale: 1.08, rotate: isDark ? -15 : 15 }}
            whileTap={{ scale: 0.9, rotate: isDark ? 45 : -45 }}
            onClick={toggleDarkMode}
            className={`relative w-8 h-8 sm:w-9 sm:h-9 border rounded-xl flex items-center justify-center shadow-sm hover:shadow-md transition-all shrink-0 cursor-pointer overflow-hidden ${
              isDark
                ? 'bg-slate-900 border-slate-700 hover:border-amber-400/60'
                : 'bg-amber-500/10 border-amber-500/30 hover:border-mango'
            }`}
            title="Toggle Dark / Light Theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              {isDark ? (
                <motion.div
                  key="dark"
                  initial={{ scale: 0, rotate: -90, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, rotate: 90, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Sun
                    size={17}
                    className="text-amber-400 filter drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="light"
                  initial={{ scale: 0, rotate: 90, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, rotate: -90, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Moon
                    size={17}
                    className="text-slate-700 filter drop-shadow-[0_0_4px_rgba(15,23,42,0.3)]"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </header>

      {/* Auth & Profile Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={user}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
    </>
  );
};
