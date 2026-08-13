import React from 'react';
import { motion } from 'motion/react';
import { Flame, Activity, Zap, PieChart } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const MacroProgressWidget: React.FC = () => {
  const { t } = useApp();

  // Mocked daily target vs actual progress for the active plan
  const dailyTarget = { calories: 2200, protein: 90, carbs: 250, fat: 70 };
  const currentProgress = { calories: 1450, protein: 68, carbs: 165, fat: 42 };

  const calPercent = Math.min(100, Math.round((currentProgress.calories / dailyTarget.calories) * 100));
  const proteinPercent = Math.min(100, Math.round((currentProgress.protein / dailyTarget.protein) * 100));
  const carbsPercent = Math.min(100, Math.round((currentProgress.carbs / dailyTarget.carbs) * 100));
  const fatPercent = Math.min(100, Math.round((currentProgress.fat / dailyTarget.fat) * 100));

  return (
    <div className="bg-pestle-card border border-pestle-border p-4 sm:p-5 rounded-3xl shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-mango/15 text-mango flex items-center justify-center">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black text-pestle-text uppercase tracking-wider">
              {t('macro_title')}
            </h3>
            <p className="text-[10px] text-gray-400 font-medium">{t('macro_subtitle')}</p>
          </div>
        </div>
        <span className="text-[10px] font-black text-mango bg-mango/10 px-2.5 py-1 rounded-full flex items-center gap-1">
          <Flame size={12} /> {currentProgress.calories} / {dailyTarget.calories} kcal
        </span>
      </div>

      {/* Calorie Main Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-bold text-pestle-text">
          <span>{t('macro_calories')}</span>
          <span className="text-mango">{calPercent}%</span>
        </div>
        <div className="w-full bg-pestle-bg h-3 rounded-full border border-pestle-border overflow-hidden p-0.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${calPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-mango to-amber-400 rounded-full"
          />
        </div>
      </div>

      {/* 3 Macros Breakdown */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {/* Protein */}
        <div className="bg-pestle-bg border border-pestle-border p-2.5 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
            <span>{t('protein')}</span>
            <span className="text-emerald-500">{proteinPercent}%</span>
          </div>
          <p className="text-xs font-black text-pestle-text">{currentProgress.protein}g / {dailyTarget.protein}g</p>
          <div className="w-full bg-pestle-card h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${proteinPercent}%` }} />
          </div>
        </div>

        {/* Carbs */}
        <div className="bg-pestle-bg border border-pestle-border p-2.5 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
            <span>{t('carbs')}</span>
            <span className="text-blue-500">{carbsPercent}%</span>
          </div>
          <p className="text-xs font-black text-pestle-text">{currentProgress.carbs}g / {dailyTarget.carbs}g</p>
          <div className="w-full bg-pestle-card h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${carbsPercent}%` }} />
          </div>
        </div>

        {/* Fat */}
        <div className="bg-pestle-bg border border-pestle-border p-2.5 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
            <span>{t('fat')}</span>
            <span className="text-amber-500">{fatPercent}%</span>
          </div>
          <p className="text-xs font-black text-pestle-text">{currentProgress.fat}g / {dailyTarget.fat}g</p>
          <div className="w-full bg-pestle-card h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${fatPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};
