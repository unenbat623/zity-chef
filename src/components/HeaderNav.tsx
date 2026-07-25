import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Sun, Moon, User } from 'lucide-react';
import { AuthModal, UserProfile } from './AuthModal';

export const HeaderNav: React.FC = () => {
  const { lang, setLang, isDark, toggleDarkMode, subscription, setShowSubModal, t } = useApp();
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('zity_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  const handleLoginSuccess = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('zity_user', JSON.stringify(profile));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('zity_user');
    setShowAuthModal(false);
  };

  return (
    <>
      <header className="px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center bg-pestle-bg/95 border-b border-pestle-border/50 sticky top-0 z-30 backdrop-blur-md w-full">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-mango text-white font-extrabold rounded-xl flex items-center justify-center shadow-md shadow-mango/20 shrink-0 text-sm sm:text-base">
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
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate">Smart AI Culinary Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* User Profile / Auth trigger button */}
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-1.5 bg-pestle-card border border-pestle-border px-2.5 py-1.5 rounded-xl text-xs font-bold text-pestle-text hover:border-mango transition-colors active:scale-95"
            title="User Profile"
          >
            {user ? (
              <img src={user.avatarUrl} alt={user.name} className="w-5 h-5 rounded-full bg-mango/20" />
            ) : (
              <User size={15} className="text-mango" />
            )}
            <span className="hidden sm:inline text-xs font-semibold">
              {user ? user.name : 'Нэвтрэх'}
            </span>
          </button>

          {/* Subscription Upgrade Pill */}
          {subscription === 'free' && (
            <button
              onClick={() => setShowSubModal(true)}
              className="text-[10px] sm:text-[11px] font-bold bg-mango/15 text-mango border border-mango/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl hover:bg-mango hover:text-white transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap"
            >
              <Sparkles size={11} />
              <span className="hidden xs:inline">{t('upgradeBtn')}</span>
              <span className="xs:hidden">PRO</span>
            </button>
          )}

          {/* Language Switcher */}
          <button
            onClick={() => setLang(lang === 'mn' ? 'en' : 'mn')}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-pestle-card border border-pestle-border rounded-xl flex items-center justify-center text-xs font-bold text-pestle-text hover:border-mango transition-colors active:scale-95 shrink-0"
            title="Switch Language"
          >
            {lang === 'mn' ? '🇲🇳' : '🇺🇸'}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-pestle-card border border-pestle-border rounded-xl flex items-center justify-center text-pestle-text hover:border-mango transition-colors active:scale-95 shrink-0"
            title="Toggle Theme"
          >
            {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-600" />}
          </button>
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
