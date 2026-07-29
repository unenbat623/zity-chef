import React from 'react';
import { motion } from 'motion/react';
import { Refrigerator, Calendar, Store, BookOpen, Flame, Users, User } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, cart, profile, t } = useApp();

  const tabs = [
    { id: 'fridge', icon: Refrigerator, label: t('tabFridge') },
    { id: 'recipe', icon: BookOpen, label: t('tabRecipe') },
    { id: 'cooking', icon: Flame, label: t('tabCooking') },
    { id: 'community', icon: Users, label: t('bottomnav_community') },
    { id: 'store', icon: Store, label: t('tabStore'), badge: cart.length > 0 ? cart.length : null },
    { id: 'profile', icon: User, label: t('bottomnav_profile'), isProfile: true },
  ];

  return (
    // md:hidden — hidden on desktop (sidebar handles navigation there)
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-pestle-card/95 backdrop-blur-md border-t border-pestle-border px-2 py-2 pb-safe flex justify-around items-center z-50 shadow-2xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative flex-1 flex flex-col items-center gap-0.5 py-1 group active:scale-95 transition-transform min-w-0"
          >
            <div className="relative">
              {tab.isProfile ? (
                <div
                  className={`w-6 h-6 rounded-full overflow-hidden flex items-center justify-center border-2 transition-all ${
                    isActive ? 'border-violet-500' : 'border-transparent'
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
                      ? 'text-mango'
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
              className={`text-[9px] sm:text-[10px] tracking-tight whitespace-nowrap truncate max-w-[52px] ${
                isActive ? 'font-black' : 'text-gray-400'
              }`}
              style={isActive ? { color: profile.accentColor } : {}}
            >
              {tab.label}
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

