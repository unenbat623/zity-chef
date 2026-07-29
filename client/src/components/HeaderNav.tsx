import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Sun, Moon, User } from 'lucide-react';
import { AuthModal } from './AuthModal';

export const HeaderNav: React.FC = () => {
  const { lang, setLang, isDark, toggleDarkMode, subscription, setShowSubModal, profile, setProfile, t } =
    useApp();
  const { user: authUser, isAnonymous } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Display info for the header avatar/name, derived from the real session.
  const isLoggedIn = Boolean(authUser && !isAnonymous);
  const user = isLoggedIn
    ? {
        name:
          (authUser!.user_metadata?.full_name as string) ||
          authUser!.email?.split('@')[0] ||
          profile.name,
        email: authUser!.email || authUser!.phone || '',
        avatarUrl: (authUser!.user_metadata?.avatar_url as string) || '',
      }
    : null;

  // When a real user signs in, seed the local profile once from their identity.
  useEffect(() => {
    if (isLoggedIn && user) {
      setProfile({
        ...profile,
        name: profile.name && profile.name !== t('header_defaultName') ? profile.name : user.name,
        avatarUrl: profile.avatarUrl || user.avatarUrl || null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  return (
    <>
      <header className="pt-[calc(0.65rem+env(safe-area-inset-top,0px))] pb-3 px-3 sm:px-6 flex justify-between items-center bg-pestle-bg/95 border-b border-pestle-border/60 sticky top-0 z-30 backdrop-blur-md w-full shrink-0 transition-colors duration-300">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2 min-w-0 shrink">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr ${profile.coverGradient} text-white font-black rounded-xl flex items-center justify-center shadow-sm shrink-0 text-sm sm:text-base`}
          >
            Z
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h1 className="font-extrabold text-sm sm:text-lg leading-tight tracking-tight flex items-center gap-1 text-pestle-text truncate">
              <span className="truncate">Zity Chef</span>
              {subscription === 'pro' && (
                <span className="text-[8px] sm:text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider flex items-center gap-0.5 shadow-xs shrink-0">
                  <Sparkles size={8} /> PRO
                </span>
              )}
            </h1>
            <p className="hidden sm:block text-[10px] sm:text-[11px] text-gray-400 font-medium truncate leading-none">
              Smart AI Culinary Assistant
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* User Profile / Auth trigger button */}
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-1.5 bg-pestle-card border border-pestle-border p-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold text-pestle-text hover:border-mango transition-all active:scale-95 shadow-xs cursor-pointer"
            title={t('header_profileTitle')}
          >
            <div
              className={`w-6 h-6 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br ${profile.coverGradient} shrink-0`}
            >
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
            <span className="hidden md:inline text-xs font-bold text-pestle-text truncate max-w-[80px]">
              {profile.name || user?.name || t('header_defaultName')}
            </span>
          </button>

          {/* Subscription Upgrade Pill */}
          {subscription === 'free' && (
            <button
              onClick={() => setShowSubModal(true)}
              className="text-[10px] font-extrabold bg-mango/15 text-mango border border-mango/30 px-2 py-1.5 sm:px-3 rounded-xl hover:bg-mango hover:text-white transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap shadow-xs"
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
            className="relative h-8 px-2 sm:px-2.5 bg-pestle-card border border-pestle-border hover:border-mango/60 rounded-xl flex items-center justify-center gap-1 text-xs font-bold text-pestle-text shadow-xs transition-all shrink-0 cursor-pointer overflow-hidden group"
            title={t('header_switchLang')}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={lang}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 10, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="text-sm sm:text-base leading-none select-none flex items-center gap-1"
              >
                <span>{lang === 'mn' ? '🇲🇳' : '🇺🇸'}</span>
                <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-gray-500 uppercase group-hover:text-mango transition-colors">
                  {lang === 'mn' ? 'MN' : 'EN'}
                </span>
              </motion.span>
            </AnimatePresence>
          </motion.button>

          {/* Animated Dark Mode Toggle */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleDarkMode}
            className={`relative w-8 h-8 border rounded-xl flex items-center justify-center shadow-xs transition-all shrink-0 cursor-pointer overflow-hidden ${
              isDark
                ? 'bg-slate-900 border-slate-700 hover:border-amber-400/60'
                : 'bg-amber-500/10 border-amber-500/30 hover:border-mango'
            }`}
            title={t('header_toggleTheme')}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isDark ? (
                <motion.div
                  key="dark"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Sun size={15} className="text-amber-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="light"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Moon size={15} className="text-slate-700" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </header>

      {/* Auth & Profile Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
};
