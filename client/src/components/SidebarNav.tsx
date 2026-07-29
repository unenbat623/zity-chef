import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Refrigerator,
  Calendar,
  Flame,
  Store,
  BookOpen,
  Crown,
  Moon,
  Sun,
  Globe,
  Sparkles,
  Users,
  ChefHat,
  UserCircle,
  User,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SidebarNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    lang,
    setLang,
    isDark,
    toggleDarkMode,
    subscription,
    setShowSubModal,
    cart,
    inventory,
    profile,
    t,
  } = useApp();

  const navItems = [
    { id: 'fridge', label: t('tabFridge'), icon: Refrigerator, count: inventory.length },
    { id: 'calendar', label: t('tabCalendar'), icon: Calendar, badge: 'AI' },
    { id: 'cooking', label: t('tabCooking'), icon: Flame },
    { id: 'store', label: t('tabStore'), icon: Store, count: cart.length },
    { id: 'recipe', label: t('tabRecipe'), icon: BookOpen },
    { id: 'community', label: t('sidebar_community'), icon: Users, badge: 'NEW' },
    { id: 'help', label: t('sidebar_help'), icon: HelpCircle },
  ];

  const expiringCount = inventory.filter((i) => i.expiryDays <= 3).length;

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-pestle-card border-r border-pestle-border p-6 justify-between shrink-0 h-full overflow-y-auto shadow-sm z-30">
      {/* Brand Header */}
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${profile.coverGradient} flex items-center justify-center text-white shadow-lg`}
          >
            <ChefHat size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-lg text-pestle-text tracking-tight">Zity Chef</h1>
              <span
                className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider text-white"
                style={{ backgroundColor: profile.accentColor }}
              >
                PRO
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-semibold">AI Kitchen Ecosystem</p>
          </div>
        </div>

        {/* Pro Banner Pill */}
        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-mango/15 border border-mango/30 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-mango tracking-wider flex items-center gap-1">
              <Sparkles size={12} /> {subscription === 'free' ? t('sidebar_freeTier') : t('sidebar_proTier')}
            </span>
            <Crown size={16} className="text-amber-500" />
          </div>
          <p className="text-xs text-pestle-text font-bold">
            {subscription === 'free' ? t('sidebar_freeDesc') : t('sidebar_proDesc')}
          </p>
          {subscription === 'free' && (
            <button
              onClick={() => setShowSubModal(true)}
              className="w-full bg-mango text-white text-xs font-bold py-2 rounded-xl shadow-md shadow-mango/20 hover:bg-mango/90 transition-colors"
            >
              {t('sidebar_activate')}
            </button>
          )}
        </div>

        {/* Main Nav Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-mango text-white shadow-md shadow-mango/20'
                    : 'text-gray-500 hover:bg-pestle-bg hover:text-pestle-text'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>

                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-pestle-bg text-mango border border-pestle-border'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
                {item.badge && (
                  <span className="text-[9px] bg-mint text-white px-2 py-0.5 rounded-full font-black uppercase">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Controls: Profile Mini Card */}
      <div className="space-y-4 pt-4 border-t border-pestle-border/60">
        {expiringCount > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center justify-between text-red-500 text-xs font-bold">
            <span>⚠️ {t('sidebar_expiring')}</span>
            <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px]">
              {expiringCount}
            </span>
          </div>
        )}

        {/* Profile Mini Card (clickable to Profile tab) */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border transition-all hover:shadow-sm ${
            activeTab === 'profile'
              ? 'border-violet-500/40 bg-violet-500/10'
              : 'border-pestle-border hover:border-violet-400/50 bg-pestle-bg'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-gradient-to-br ${profile.coverGradient}`}
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={18} className="text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[11px] font-black text-pestle-text truncate">{profile.name}</p>
            <p className="text-[9px] text-gray-400 font-medium truncate">{profile.username}</p>
          </div>
          <UserCircle size={15} className="text-violet-500 shrink-0" />
        </button>
      </div>
    </aside>
  );
};
