import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Flame,
  ShoppingCart,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Sun,
  SunMedium,
  Moon,
  RotateCw,
  ChefHat,
  TrendingUp,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WEEK_DAYS } from '../constants';
import { MOCK_RECIPES } from '../data/recipes';
import type { Recipe } from '../types';

// Meal time slots
type MealType = 'breakfast' | 'lunch' | 'dinner';

interface DaySchedule {
  dayId: string;
  dayLabel: string;
  dateStr: string;
  breakfast: Recipe;
  lunch: Recipe;
  dinner: Recipe;
  targetCalories: number;
}

export const CalendarView: React.FC = () => {
  const { lang, inventory, cart, addToCart, setActiveCookingRecipe, setActiveTab, t } = useApp();
  const [selectedDayId, setSelectedDayId] = useState<string>(WEEK_DAYS[0].day);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Map 7 days to 3 distinct meals each from MOCK_RECIPES
  const [schedule, setSchedule] = useState<DaySchedule[]>(() => {
    const b = MOCK_RECIPES.filter((r) => r.category === 'Өглөөний цай');
    const l = MOCK_RECIPES.filter((r) => r.category === 'Үндсэн хоол' || r.category === 'Салат ба Хөнгөн зууш');
    const d = MOCK_RECIPES.filter((r) => r.category === 'Шөл ба Бүлээн хоол' || r.category === 'Үндсэн хоол');

    return WEEK_DAYS.map((w, idx) => ({
      dayId: w.day,
      dayLabel: w.day,
      dateStr: w.date,
      breakfast: b[idx % b.length] || MOCK_RECIPES[3],
      lunch: l[idx % l.length] || MOCK_RECIPES[0],
      dinner: d[(idx + 2) % d.length] || MOCK_RECIPES[1],
      targetCalories: 2000 + (idx % 3) * 100,
    }));
  });

  // Current active day schedule
  const activeDaySchedule = useMemo(() => {
    return schedule.find((s) => s.dayId === selectedDayId) || schedule[0];
  }, [schedule, selectedDayId]);

  // Current active recipe based on meal type
  const activeRecipe: Recipe = useMemo(() => {
    if (selectedMealType === 'breakfast') return activeDaySchedule.breakfast;
    if (selectedMealType === 'lunch') return activeDaySchedule.lunch;
    return activeDaySchedule.dinner;
  }, [activeDaySchedule, selectedMealType]);

  // Dynamic calculation of ingredients available vs missing
  const ingredientStatus = useMemo(() => {
    const fridgeNames = inventory.map((i) => i.name.toLowerCase());

    const available: string[] = [];
    const missing: { name: string; estimatedPrice: number; quantityStr: string }[] = [];

    activeRecipe.ingredients.forEach((ing) => {
      const lower = ing.toLowerCase();
      const hasItem = fridgeNames.some((f) => lower.includes(f) || f.includes(lower.split(' ')[0]));

      if (hasItem) {
        available.push(ing);
      } else {
        // Price estimation based on ingredient type
        let estPrice = 4500;
        if (lower.includes('мах') || lower.includes('сэлмон') || lower.includes('загас')) estPrice = 14500;
        else if (lower.includes('бяслаг') || lower.includes('авокадо') || lower.includes('уураг')) estPrice = 8500;
        else if (lower.includes('тос') || lower.includes('соус') || lower.includes('амтлагч')) estPrice = 3200;

        missing.push({
          name: ing,
          estimatedPrice: estPrice,
          quantityStr: '1 порц',
        });
      }
    });

    const totalCount = activeRecipe.ingredients.length;
    const matchPct = totalCount > 0 ? Math.round((available.length / totalCount) * 100) : 100;

    return { available, missing, matchPct };
  }, [activeRecipe, inventory]);

  // Total daily nutrition for all 3 meals
  const dailyNutrition = useMemo(() => {
    const b = activeDaySchedule.breakfast.nutrition;
    const l = activeDaySchedule.lunch.nutrition;
    const d = activeDaySchedule.dinner.nutrition;

    const totalCals = b.calories + l.calories + d.calories;
    const totalProtein = b.protein + l.protein + d.protein;
    const totalCarbs = b.carbs + l.carbs + d.carbs;
    const totalFat = b.fat + l.fat + d.fat;

    return { totalCals, totalProtein, totalCarbs, totalFat };
  }, [activeDaySchedule]);

  // Handle adding missing ingredients to shopping cart
  const handleAddMissingToCart = () => {
    if (ingredientStatus.missing.length === 0) return;

    ingredientStatus.missing.forEach((item, idx) => {
      addToCart({
        id: `cart-missing-${Date.now()}-${idx}`,
        name: item.name,
        emoji: item.name.includes('мах') ? '🥩' : item.name.includes('ногоо') ? '🥦' : '🛒',
        unit: 'порц',
        quantity: 1,
        pricePerUnit: item.estimatedPrice,
        totalPrice: item.estimatedPrice,
      });
    });

    setAddedToast(`${ingredientStatus.missing.length} орц сагсанд нэмэгдлээ! 🛒`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  // Re-plan the week by picking new recipes for each day.
  // (Genuine inventory-aware AI planning is a Phase 2 server endpoint.)
  const handleRegeneratePlan = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setSchedule((prev) =>
        prev.map((s) => {
          const randB = MOCK_RECIPES[Math.floor(Math.random() * MOCK_RECIPES.length)];
          const randL = MOCK_RECIPES[Math.floor(Math.random() * MOCK_RECIPES.length)];
          const randD = MOCK_RECIPES[Math.floor(Math.random() * MOCK_RECIPES.length)];
          return {
            ...s,
            breakfast: randB,
            lunch: randL,
            dinner: randD,
          };
        })
      );
      setIsRegenerating(false);
      setAddedToast('🍳 Долоо хоногийн хоолны хуваарь шинэчлэгдлээ!');
      setTimeout(() => setAddedToast(null), 3500);
    }, 800);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto pb-24">
      {/* Toast Notification */}
      <AnimatePresence>
        {addedToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-[300] bg-mint text-white px-4 py-2.5 rounded-2xl shadow-xl font-black text-xs flex items-center gap-2 border border-white/20"
          >
            <CheckCircle2 size={16} />
            <span>{addedToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-pestle-text tracking-tight flex items-center gap-2">
            <span>Төлөвлөгөө</span>
            <span className="text-xs font-black bg-mango/15 text-mango px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={12} /> AI Meal Planner
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            7 хоногийн ухаалаг хоолны төлөвлөгөө, калори ба хөргөгчний орцын тохироо
          </p>
        </div>

        <button
          onClick={handleRegeneratePlan}
          disabled={isRegenerating}
          className="bg-pestle-card border border-pestle-border text-pestle-text hover:border-mango font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer hover:shadow-md shrink-0"
        >
          <RotateCw size={14} className={`text-mango ${isRegenerating ? 'animate-spin' : ''}`} />
          <span>{isRegenerating ? 'Төлөвлөж байна...' : 'AI-гаар дахин төлөвлөх'}</span>
        </button>
      </header>

      {/* ── WEEK DAYS CAROUSEL ──────────────────────────────────────────────────────── */}
      <div className="bg-pestle-card border border-pestle-border rounded-3xl p-2.5 shadow-xs">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEK_DAYS.map((d) => {
            const isSelected = selectedDayId === d.day;
            return (
              <motion.button
                key={d.day}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDayId(d.day)}
                className={`py-3 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-mango text-white shadow-lg shadow-mango/30 ring-2 ring-mango/40 scale-105'
                    : 'bg-pestle-bg text-gray-400 hover:text-pestle-text hover:bg-pestle-card'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {lang === 'mn' ? d.day : d.dayEn}
                </span>
                <span className="text-xs sm:text-sm font-black mt-0.5">{d.date.split('.')[1]}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── DAILY CALORIE BUDGET BAR ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-mango/15 border border-mango/25 p-4 rounded-3xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-mango" />
            <span className="text-xs font-black text-pestle-text">
              Өдрийн нийт калори & Шим тэжээл
            </span>
          </div>
          <span className="text-xs font-black text-mango">
            {dailyNutrition.totalCals} / {activeDaySchedule.targetCalories} kcal
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-pestle-bg rounded-full h-2.5 overflow-hidden border border-pestle-border/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${Math.min(
                100,
                Math.round((dailyNutrition.totalCals / activeDaySchedule.targetCalories) * 100)
              )}%`,
            }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-mango rounded-full"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-pestle-card/80 border border-pestle-border/60 py-1.5 rounded-xl">
            <p className="text-[9px] font-bold text-gray-400 uppercase">Уураг (Protein)</p>
            <p className="text-xs font-black text-pestle-text">{dailyNutrition.totalProtein}g</p>
          </div>
          <div className="bg-pestle-card/80 border border-pestle-border/60 py-1.5 rounded-xl">
            <p className="text-[9px] font-bold text-gray-400 uppercase">Нүүрс ус (Carbs)</p>
            <p className="text-xs font-black text-pestle-text">{dailyNutrition.totalCarbs}g</p>
          </div>
          <div className="bg-pestle-card/80 border border-pestle-border/60 py-1.5 rounded-xl">
            <p className="text-[9px] font-bold text-gray-400 uppercase">Өөх тос (Fat)</p>
            <p className="text-xs font-black text-pestle-text">{dailyNutrition.totalFat}g</p>
          </div>
        </div>
      </div>

      {/* ── MEAL TIME SLOTS (Өглөө, Өдөр, Орой) ──────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-pestle-text tracking-tight">
            Хоолны цагийн хуваарь
          </h3>
          <span className="text-xs font-bold text-gray-400">Сонгосон өдөр: {activeDaySchedule.dayLabel}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-pestle-card border border-pestle-border p-1.5 rounded-2xl">
          {[
            { id: 'breakfast' as MealType, label: 'Өглөөний цай', icon: Sun, recipe: activeDaySchedule.breakfast },
            { id: 'lunch' as MealType, label: 'Өдрийн хоол', icon: SunMedium, recipe: activeDaySchedule.lunch },
            { id: 'dinner' as MealType, label: 'Оройн хоол', icon: Moon, recipe: activeDaySchedule.dinner },
          ].map((m) => {
            const Icon = m.icon;
            const isSelected = selectedMealType === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMealType(m.id)}
                className={`py-2.5 px-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-mango text-white shadow-md font-black'
                    : 'text-gray-400 hover:text-pestle-text font-bold'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <Icon size={14} />
                  <span>{m.label}</span>
                </div>
                <span className="text-[10px] truncate max-w-full opacity-80">{m.recipe.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ACTIVE RECOMMENDED MEAL CARD ─────────────────────────────────────── */}
      <motion.div
        key={`${selectedDayId}-${selectedMealType}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="pestle-card rounded-3xl overflow-hidden border border-pestle-border shadow-lg space-y-0"
      >
        {/* Recipe Image Banner */}
        <div className="h-56 sm:h-64 relative overflow-hidden group">
          <img
            src={activeRecipe.image}
            alt={activeRecipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Badges */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 border border-white/10">
              <Clock size={13} className="text-mango" /> {activeRecipe.time}
            </div>
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 border border-white/10">
              <ChefHat size={13} className="text-amber-400" /> {activeRecipe.difficulty}
            </div>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span
              className={`text-xs font-black px-3 py-1 rounded-xl shadow-md ${
                ingredientStatus.matchPct >= 75
                  ? 'bg-mint text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              Тохироо: {ingredientStatus.matchPct}%
            </span>
          </div>

          {/* Bottom Title overlay */}
          <div className="absolute bottom-4 left-4 right-4 text-white space-y-1">
            <span className="text-[10px] font-extrabold uppercase bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-white/90">
              {activeRecipe.category || 'Онцлох жор'}
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white drop-shadow-md leading-tight">
              {lang === 'mn' ? activeRecipe.title : activeRecipe.titleEn}
            </h3>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 space-y-5">
          {/* Nutrition Info Pills */}
          <div className="grid grid-cols-4 gap-2 bg-pestle-bg p-3 rounded-2xl border border-pestle-border/60 text-center">
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase">Илчлэг</span>
              <p className="text-xs sm:text-sm font-black text-mango">{activeRecipe.nutrition.calories} kcal</p>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase">Уураг</span>
              <p className="text-xs sm:text-sm font-black text-pestle-text">{activeRecipe.nutrition.protein}g</p>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase">Нүүрс ус</span>
              <p className="text-xs sm:text-sm font-black text-pestle-text">{activeRecipe.nutrition.carbs}g</p>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase">Өөх тос</span>
              <p className="text-xs sm:text-sm font-black text-pestle-text">{activeRecipe.nutrition.fat}g</p>
            </div>
          </div>

          {/* ── INGREDIENTS STATUS (ХӨРГӨГЧИД БАЙГАА / ДУТУУ) ──────────────── */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black text-pestle-text flex items-center justify-between">
              <span>Хэрэгцээт орцын шинжилгээ</span>
              <span className="text-[11px] text-gray-400 font-bold">
                Нийт {activeRecipe.ingredients.length} орц
              </span>
            </h4>

            {/* Available Ingredients */}
            {ingredientStatus.available.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-extrabold text-mint uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={12} /> Хөргөгчид бэлэн байгаа орц ({ingredientStatus.available.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ingredientStatus.available.map((ing, idx) => (
                    <span
                      key={idx}
                      className="bg-mint/10 border border-mint/25 text-mint text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5"
                    >
                      <Check size={12} /> {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Ingredients */}
            {ingredientStatus.missing.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle size={12} /> Дутуу байгаа орц ({ingredientStatus.missing.length})
                </p>

                <div className="space-y-2 bg-pestle-bg p-3 rounded-2xl border border-pestle-border/60">
                  {ingredientStatus.missing.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs font-bold text-pestle-text border-b border-pestle-border/40 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {item.name}
                      </span>
                      <span className="text-mango font-mono font-black">
                        ₮{item.estimatedPrice.toLocaleString()}
                      </span>
                    </div>
                  ))}

                  <button
                    onClick={handleAddMissingToCart}
                    className="w-full mt-2 bg-mint hover:bg-mint/90 text-white py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-mint/20 transition-all cursor-pointer active:scale-95"
                  >
                    <ShoppingCart size={15} />
                    <span>Дутуу орцуудыг сагсанд нэмэх</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* COOK NOW BUTTON */}
          <button
            onClick={() => {
              setActiveCookingRecipe(activeRecipe);
              setActiveTab('cooking');
            }}
            className="w-full btn-primary py-3.5 font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-mango/25 active:scale-95 transition-all cursor-pointer rounded-2xl"
          >
            <Flame size={18} />
            <span>Одоо хийх — Алхамчилсан тогооч горим</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
