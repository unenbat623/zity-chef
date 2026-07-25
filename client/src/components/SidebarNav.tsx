import React from 'react';
import { motion } from 'motion/react';
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
    t,
  } = useApp();

  const navItems = [
    { id: 'fridge', label: t('tabFridge'), icon: Refrigerator, count: inventory.length },
    { id: 'calendar', label: t('tabCalendar'), icon: Calendar, badge: 'AI' },
    { id: 'cooking', label: t('tabCooking'), icon: Flame },
    { id: 'store', label: t('tabStore'), icon: Store, count: cart.length },
    { id: 'recipe', label: t('tabRecipe'), icon: BookOpen },
    { id: 'community', label: 'Хамтын орчин', icon: Users, badge: 'NEW' },
  ];

  const expiringCount = inventory.filter((i) => i.expiryDays <= 3).length;

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-pestle-card border-r border-pestle-border p-6 justify-between shrink-0 h-screen sticky top-0 shadow-sm z-30">
      {/* Brand Header */}
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-mango to-amber-400 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-mango/30">
            🍳
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-lg text-pestle-text tracking-tight">Zity Chef</h1>
              <span className="text-[9px] font-extrabold bg-mango/15 text-mango px-2 py-0.5 rounded-full uppercase tracking-wider">
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
              <Sparkles size={12} /> {subscription === 'free' ? 'Free Tier' : 'Pro Chef Tier'}
            </span>
            <Crown size={16} className="text-amber-500" />
          </div>
          <p className="text-xs text-pestle-text font-bold">
            {subscription === 'free' ? 'AI жор & OCR скан идэвхжүүлэх' : 'Бүх боломж идэвхтэй'}
          </p>
          {subscription === 'free' && (
            <button
              onClick={() => setShowSubModal(true)}
              className="w-full bg-mango text-white text-xs font-bold py-2 rounded-xl shadow-md shadow-mango/20 hover:bg-mango/90 transition-colors"
            >
              Идэвхжүүлэх (₮14,900)
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

      {/* Footer Controls: Language & Dark Mode */}
      <div className="space-y-4 pt-4 border-t border-pestle-border/60">
        {expiringCount > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center justify-between text-red-500 text-xs font-bold">
            <span>⚠️ Муудах дөхсөн</span>
            <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px]">
              {expiringCount}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {/* Language Toggle Button */}
          <button
            onClick={() => setLang(lang === 'mn' ? 'en' : 'mn')}
            className="flex-1 bg-pestle-bg border border-pestle-border py-2.5 px-3 rounded-xl text-xs font-bold text-pestle-text flex items-center justify-center gap-2 hover:border-mango transition-colors"
          >
            <Globe size={14} className="text-mango" />
            <span>{lang === 'mn' ? 'Монгол' : 'English'}</span>
          </button>

          {/* Dark Mode Toggle Button */}
          <button
            onClick={toggleDarkMode}
            className="w-10 h-10 bg-pestle-bg border border-pestle-border rounded-xl flex items-center justify-center text-pestle-text hover:border-mango transition-colors"
          >
            {isDark ? (
              <Sun size={16} className="text-amber-400" />
            ) : (
              <Moon size={16} className="text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
