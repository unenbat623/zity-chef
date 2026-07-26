import React from 'react';
import { motion } from 'motion/react';
import { ChefHat, Home, BookOpen, HelpCircle, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const NotFoundView: React.FC = () => {
  const { setActiveTab, profile } = useApp();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-12 space-y-8">
      {/* Animated Chef Illustration */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
        className="relative"
      >
        <div
          className={`w-28 h-28 rounded-[32px] bg-gradient-to-br ${profile.coverGradient} flex items-center justify-center shadow-2xl mx-auto`}
        >
          <ChefHat size={56} className="text-white" strokeWidth={1.5} />
        </div>

        {/* Floating 404 badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 300 }}
          className="absolute -top-3 -right-3 bg-red-500 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-lg"
        >
          404
        </motion.div>

        {/* Subtle orbit rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          className="absolute -inset-6 rounded-full border border-dashed border-pestle-border opacity-40 pointer-events-none"
        />
      </motion.div>

      {/* Text Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="space-y-3 max-w-sm"
      >
        <h1 className="text-3xl sm:text-4xl font-black text-pestle-text tracking-tight">
          Хуудас олдсонгүй!
        </h1>
        <p className="text-sm text-gray-500 font-medium leading-relaxed">
          Таны хайсан хуудас нүүгдсэн, устгагдсан эсвэл огт байхгүй байна. Эгч уучлаарай! 🙏
        </p>
        <p className="text-xs text-gray-400 font-medium bg-pestle-card border border-pestle-border px-4 py-2 rounded-xl inline-block">
          Алдааны код: <strong className="text-red-500">404 Not Found</strong>
        </p>
      </motion.div>

      {/* Navigation CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-3 w-full max-w-sm"
      >
        <button
          onClick={() => setActiveTab('fridge')}
          className="flex-1 btn-primary py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-mango/20 cursor-pointer"
        >
          <Home size={17} />
          <span>Нүүр хуудас руу</span>
        </button>
        <button
          onClick={() => setActiveTab('help')}
          className="flex-1 btn-secondary py-3.5 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          <HelpCircle size={17} />
          <span>Тусламж авах</span>
        </button>
      </motion.div>

      {/* Suggested Pages */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="w-full max-w-sm space-y-2"
      >
        <p className="text-xs font-bold text-gray-400 text-left">Магадгүй эдгээр хуудсуудыг хайсан байж болох:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Миний хөргөгч', tab: 'fridge', icon: '🧊' },
            { label: 'Жорын ном', tab: 'recipe', icon: '📖' },
            { label: 'Дэлгүүр', tab: 'store', icon: '🛒' },
            { label: 'Профайл', tab: 'profile', icon: '👤' },
          ].map((page) => (
            <button
              key={page.tab}
              onClick={() => setActiveTab(page.tab)}
              className="flex items-center gap-2 p-3 bg-pestle-card border border-pestle-border rounded-xl text-xs font-bold text-pestle-text hover:border-mango transition-all cursor-pointer active:scale-[0.97] text-left"
            >
              <span className="text-base">{page.icon}</span>
              <span>{page.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
