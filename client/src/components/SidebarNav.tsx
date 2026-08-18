import React from 'react';
import {
  Refrigerator,
  Calendar,
  Flame,
  Store,
  BookOpen,
  Users,
  UserCircle,
  User,
  HelpCircle,
  LayoutDashboard,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from './BrandLogo';

export const SidebarNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    subscription,
    cart,
    inventory,
    profile,
    t,
  } = useApp();

  const mainNavItems = [
    { id: 'fridge', label: t('tabFridge'), icon: Refrigerator, count: inventory.length },
    { id: 'store', label: t('tabStore'), icon: Store, count: cart.length },
    { id: 'recipe', label: t('tabRecipe'), icon: BookOpen },
    { id: 'dashboard', label: t('tabDashboard'), icon: LayoutDashboard },
  ];

  const secondaryNavItems = [
    { id: 'calendar', label: t('tabCalendar'), icon: Calendar },
    { id: 'cooking', label: t('tabCooking'), icon: Flame },
    { id: 'community', label: t('sidebar_community'), icon: Users },
    { id: 'help', label: t('sidebar_help'), icon: HelpCircle },
  ];

  const expiringCount = inventory.filter((i) => i.expiryDays <= 3).length;

  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-60 bg-pestle-card border-r border-pestle-border p-5 justify-between shrink-0 h-full overflow-y-auto shadow-sm z-30">
      {/* Brand Header */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BrandLogo className="w-10 h-10 shrink-0 drop-shadow-md" />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-base text-pestle-text tracking-tight">Zity Chef</h1>
              {/* Gated on the real tier, like HeaderNav. This badge used to be
                  hardcoded, so every free user was told they had Pro. */}
              {subscription !== 'free' && (
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider on-accent">
                  {subscription === 'family' ? 'FAMILY' : 'PRO'}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 font-semibold">{t('brand_sidebarSubtitle')}</p>
          </div>
        </div>

        {/* Main Nav Items */}
        <nav className="space-y-1.5">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all ${
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
                        : 'bg-pestle-bg text-mango-ink border border-pestle-border'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <nav className="space-y-1 pt-2 border-t border-pestle-border/60">
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                  isActive
                    ? 'bg-mango/10 text-mango-ink'
                    : 'text-gray-400 hover:bg-pestle-bg hover:text-pestle-text'
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
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
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-pestle-border hover:border-emerald-400/50 bg-pestle-bg'
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
          <UserCircle size={15} className="text-emerald-700 dark:text-emerald-400 shrink-0" />
        </button>
      </div>
    </aside>
  );
};
