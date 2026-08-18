import React from 'react';
import { motion } from 'motion/react';
import { Refrigerator, Store, BookOpen, Flame, Users, User, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, cart, profile, t } = useApp();

  // The chef dashboard (admin-only) gave up its slot to the meal planner: the
  // planner had NO mobile entry point at all, while the dashboard remains
  // reachable from the store view's operations card.
  // `label` is the accessible name (full wording); `short` is what fits in the
  // ~43px each of seven tabs gets at 320px — the full names were truncated
  // mid-word ("Төлөвлөгөө" → "Телевл…") on every phone.
  const tabs = [
    { id: 'fridge', icon: Refrigerator, label: t('tabFridge'), short: t('bottomnav_fridge') },
    { id: 'recipe', icon: BookOpen, label: t('tabRecipe'), short: t('bottomnav_recipe') },
    { id: 'calendar', icon: Calendar, label: t('tabCalendar'), short: t('bottomnav_calendar') },
    { id: 'cooking', icon: Flame, label: t('tabCooking'), short: t('bottomnav_cooking') },
    { id: 'community', icon: Users, label: t('bottomnav_community'), short: t('bottomnav_community') },
    {
      id: 'store',
      icon: Store,
      label: t('tabStore'),
      short: t('bottomnav_store'),
      badge: cart.length > 0 ? cart.length : null,
    },
    { id: 'profile', icon: User, label: t('bottomnav_profile'), short: t('bottomnav_profile'), isProfile: true },
  ];

  return (
    // md:hidden — hidden on desktop (sidebar handles navigation there)
    // All seven tabs share the row instead of scrolling sideways: a bottom nav
    // that has to be swiped hides its last tabs on every phone under 420px.
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-pestle-card/95 backdrop-blur-md border-t border-pestle-border px-1 py-2 pb-safe flex items-stretch gap-0.5 z-50 shadow-2xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex-1 min-w-0 basis-0 flex flex-col items-center gap-0.5 py-1 group active:scale-95 transition-transform"
          >
            <div className="relative">
              {tab.isProfile ? (
                <div
                  className={`w-6 h-6 rounded-full overflow-hidden flex items-center justify-center border-2 transition-all ${
                    isActive ? 'border-emerald-500' : 'border-transparent'
                  }`}
                  style={isActive ? { background: profile.accentColor } : {}}
                >
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${profile.coverGradient} flex items-center justify-center`}>
                      <User size={13} className="text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <Icon
                  size={20}
                  className={`transition-colors ${
                    isActive
                      ? 'text-mango-ink'
                      : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                  }`}
                />
              )}
              {tab.badge && (
                <span className="absolute -top-1.5 -right-2 bg-mango text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                  {tab.badge}
                </span>
              )}
            </div>
            <span
              className={`w-full text-center text-[8px] min-[360px]:text-[9px] sm:text-[10px] tracking-tight truncate ${
                isActive ? 'font-black text-mango-ink' : 'text-gray-400'
              }`}
            >
              {tab.short}
            </span>
            {isActive && (
              <motion.div
                layoutId="activeDot"
                className="absolute -bottom-1 w-1 h-1 rounded-full"
                style={{ backgroundColor: profile.accentColor }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};
