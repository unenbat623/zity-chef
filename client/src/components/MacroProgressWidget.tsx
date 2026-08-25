import React from 'react';
import { m } from 'motion/react';
import { Flame, Activity, Zap, PieChart } from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Macro split behind the gram targets: 25% of calories from protein, 45% from
 * carbohydrate, 30% from fat (4/4/9 kcal per gram).
 */
function targetsFor(targetCalories: number): MacroTotals {
  return {
    calories: targetCalories,
    protein: Math.round((targetCalories * 0.25) / 4),
    carbs: Math.round((targetCalories * 0.45) / 4),
    fat: Math.round((targetCalories * 0.3) / 9),
  };
}

/**
 * Progress of the day's planned meals against its calorie target.
 *
 * It used to render one hardcoded number for everybody — "1450 / 2200 kcal"
 * regardless of the plan, the day, or the user — which read as tracked personal
 * nutrition data and was not.
 */
export const MacroProgressWidget: React.FC<{
  planned: MacroTotals;
  targetCalories: number;
}> = ({ planned, targetCalories }) => {
  const { t } = useApp();

  const dailyTarget = targetsFor(targetCalories);
  const currentProgress = planned;

  const calPercent = Math.min(
    100,
    Math.round((currentProgress.calories / dailyTarget.calories) * 100)
  );
  const proteinPercent = Math.min(
    100,
    Math.round((currentProgress.protein / dailyTarget.protein) * 100)
  );
  const carbsPercent = Math.min(100, Math.round((currentProgress.carbs / dailyTarget.carbs) * 100));
  const fatPercent = Math.min(100, Math.round((currentProgress.fat / dailyTarget.fat) * 100));

  return (
    <div className="bg-pestle-card border border-pestle-border p-4 sm:p-5 rounded-3xl shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-mango/15 text-mango-ink flex items-center justify-center">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black text-pestle-text uppercase tracking-wider">
              {t('macro_title')}
            </h3>
            <p className="text-[10px] text-gray-400 font-medium">{t('macro_subtitle')}</p>
          </div>
        </div>
        <span className="text-[10px] font-black text-mango-ink bg-mango/10 px-2.5 py-1 rounded-full flex items-center gap-1">
          <Flame size={12} /> {currentProgress.calories} / {dailyTarget.calories} kcal
        </span>
      </div>

      {/* Calorie Main Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-bold text-pestle-text">
          <span>{t('macro_calories')}</span>
          <span className="text-mango-ink">{calPercent}%</span>
        </div>
        <div className="w-full bg-pestle-bg h-3 rounded-full border border-pestle-border overflow-hidden p-0.5">
          <m.div
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
            <span className="text-emerald-700 dark:text-emerald-400">{proteinPercent}%</span>
          </div>
          <p className="text-xs font-black text-pestle-text">
            {currentProgress.protein}g / {dailyTarget.protein}g
          </p>
          <div className="w-full bg-pestle-card h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${proteinPercent}%` }}
            />
          </div>
        </div>

        {/* Carbs */}
        <div className="bg-pestle-bg border border-pestle-border p-2.5 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
            <span>{t('carbs')}</span>
            <span className="text-blue-700 dark:text-blue-400">{carbsPercent}%</span>
          </div>
          <p className="text-xs font-black text-pestle-text">
            {currentProgress.carbs}g / {dailyTarget.carbs}g
          </p>
          <div className="w-full bg-pestle-card h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${carbsPercent}%` }}
            />
          </div>
        </div>

        {/* Fat */}
        <div className="bg-pestle-bg border border-pestle-border p-2.5 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
            <span>{t('fat')}</span>
            <span className="text-amber-700 dark:text-amber-400">{fatPercent}%</span>
          </div>
          <p className="text-xs font-black text-pestle-text">
            {currentProgress.fat}g / {dailyTarget.fat}g
          </p>
          <div className="w-full bg-pestle-card h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${fatPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};
