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
import { getWeekDays } from '../constants';
import type { Recipe } from '../types';
import { MacroProgressWidget } from './MacroProgressWidget';
import { SmartImage } from './SmartImage';
import { useRecipes } from '../hooks/useRecipes';
import { useStoreProducts } from '../hooks/useStoreProducts';
import { formatDifficulty } from '../lib/format';
import {
  matchIngredientToProduct,
  buildProductCartItem,
  FALLBACK_INGREDIENT_PRICE,
  type CatalogProduct,
} from '../lib/recipeStore';

// Meal time slots
type MealType = 'breakfast' | 'lunch' | 'dinner';

/** A stored week plan: three recipe ids per day, in weekday order. */
interface SavedPlan {
  days: { b?: string; l?: string; d?: string }[];
}

function readSavedPlan(key: string): SavedPlan | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPlan;
    return Array.isArray(parsed.days) && parsed.days.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

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
  const { lang, inventory, cart, addToCart, setActiveCookingRecipe, setActiveTab, formatPrice, accountId, t } = useApp();
  const { recipes, isLoading: recipesLoading, isError: recipesError, refetch: refetchRecipes } = useRecipes();
  const { products: storeCatalog } = useStoreProducts();
  // Recomputed per mount so the plan always covers the current week, and opens
  // on today rather than always on Monday.
  const weekDays = useMemo(() => getWeekDays(), []);
  const [selectedDayId, setSelectedDayId] = useState<string>(
    () => (weekDays.find((d) => d.isToday) ?? weekDays[0]).day
  );
  const planKey = `zity_meal_plan:${accountId}:${weekDays[0].date}`;
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [addedToast, setAddedToast] = useState<string | null>(null);
  // Starts empty: the week used to be pre-built from a bundled recipe list, so
  // the plan a user saw first was never their catalog's.
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);

  // Build the schedule from the catalog once it loads. A saved plan for THIS
  // week wins — the view is lazily mounted per tab, so without persistence a
  // re-planned week was thrown away the moment the user switched tabs.
  React.useEffect(() => {
    if (!recipes || recipes.length === 0) return;

    const saved = readSavedPlan(planKey);
    if (saved) {
      const byId = new Map(recipes.map((r) => [r.id, r]));
      const restored = weekDays.map((w, idx) => {
        const ids = saved.days[idx];
        return {
          dayId: w.day,
          dayLabel: w.day,
          dateStr: w.date,
          breakfast: byId.get(ids?.b ?? '') ?? recipes[0],
          lunch: byId.get(ids?.l ?? '') ?? recipes[0],
          dinner: byId.get(ids?.d ?? '') ?? recipes[0],
          targetCalories: 2000 + (idx % 3) * 100,
        };
      });
      setSchedule(restored);
      return;
    }

    const b = recipes.filter((r) => r.category === 'Өглөөний цай');
    const l = recipes.filter((r) => r.category === 'Үндсэн хоол' || r.category === 'Салат ба Хөнгөн зууш');
    const d = recipes.filter((r) => r.category === 'Шөл ба Бүлээн хоол' || r.category === 'Үндсэн хоол');
    setSchedule(
      weekDays.map((w, idx) => ({
        dayId: w.day, dayLabel: w.day, dateStr: w.date,
        breakfast: b[idx % b.length] || recipes[3] || recipes[0],
        lunch: l[idx % l.length] || recipes[0],
        dinner: d[(idx + 2) % d.length] || recipes[1] || recipes[0],
        targetCalories: 2000 + (idx % 3) * 100,
      }))
    );
  }, [recipes, weekDays, planKey]);

  // Persist whatever is on screen, keyed by account AND week start, so a stale
  // plan never leaks into the next week or another account.
  React.useEffect(() => {
    if (schedule.length === 0) return;
    try {
      localStorage.setItem(
        planKey,
        JSON.stringify({
          days: schedule.map((s) => ({ b: s.breakfast?.id, l: s.lunch?.id, d: s.dinner?.id })),
        })
      );
    } catch {
      /* private mode — the plan simply won't outlive this session */
    }
  }, [schedule, planKey]);

  // Current active day schedule
  const activeDaySchedule = useMemo(() => {
    return schedule.find((s) => s.dayId === selectedDayId) || schedule[0];
  }, [schedule, selectedDayId]);

  // Current active recipe based on meal type — guard against empty schedule
  const activeRecipe: Recipe | null = useMemo(() => {
    if (!activeDaySchedule) return null;
    if (selectedMealType === 'breakfast') return activeDaySchedule.breakfast;
    if (selectedMealType === 'lunch') return activeDaySchedule.lunch;
    return activeDaySchedule.dinner;
  }, [activeDaySchedule, selectedMealType]);

  // Dynamic calculation of ingredients available vs missing. Missing ones
  // resolve against the real store catalog — the cart used to be filled with
  // invented products at guessed prices, which no order could actually settle.
  const ingredientStatus = useMemo(() => {
    const fridgeNames = inventory.map((i) => i.name.toLowerCase());
    const available: string[] = [];
    const missing: {
      name: string;
      estimatedPrice: number;
      quantityStr: string;
      product: CatalogProduct | null;
    }[] = [];
    if (!activeRecipe) return { available, missing, matchPct: 100 };

    activeRecipe.ingredients.forEach((ing) => {
      const lower = ing.toLowerCase();
      const hasItem = fridgeNames.some((f) => lower.includes(f) || f.includes(lower.split(' ')[0]));
      if (hasItem) {
        available.push(ing);
      } else {
        const product = matchIngredientToProduct(ing, storeCatalog);
        missing.push({
          name: ing,
          estimatedPrice: product?.pricePerUnit || FALLBACK_INGREDIENT_PRICE,
          quantityStr: product ? `1 ${product.unit}` : '—',
          product,
        });
      }
    });

    const totalCount = activeRecipe.ingredients.length;
    const matchPct = totalCount > 0 ? Math.round((available.length / totalCount) * 100) : 100;
    return { available, missing, matchPct };
  }, [activeRecipe, inventory, storeCatalog]);

  // Total daily nutrition for all 3 meals
  const dailyNutrition = useMemo(() => {
    if (!activeDaySchedule) return { totalCals: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };
    const b = activeDaySchedule.breakfast.nutrition;
    const l = activeDaySchedule.lunch.nutrition;
    const d = activeDaySchedule.dinner.nutrition;
    const totalCals = b.calories + l.calories + d.calories;
    const totalProtein = b.protein + l.protein + d.protein;
    const totalCarbs = b.carbs + l.carbs + d.carbs;
    const totalFat = b.fat + l.fat + d.fat;

    return { totalCals, totalProtein, totalCarbs, totalFat };
  }, [activeDaySchedule]);

  // Add the missing ingredients that exist in the store catalog to the cart.
  const handleAddMissingToCart = () => {
    const purchasable = ingredientStatus.missing.filter((item) => item.product);
    if (purchasable.length === 0) return;

    purchasable.forEach((item) => {
      addToCart(buildProductCartItem(item.product!, item.name));
    });

    setAddedToast(t('calendar_ingredientsAddedToCart', { n: purchasable.length }));
    setTimeout(() => setAddedToast(null), 3000);
  };

  // Re-plan the week by picking new recipes for each day.
  const handleRegeneratePlan = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      const pool = recipes;
      if (pool.length === 0) {
        setIsRegenerating(false);
        return;
      }
      setSchedule((prev) =>
        prev.map((s) => {
          const randB = pool[Math.floor(Math.random() * pool.length)];
          const randL = pool[Math.floor(Math.random() * pool.length)];
          const randD = pool[Math.floor(Math.random() * pool.length)];
          return {
            ...s,
            breakfast: randB,
            lunch: randL,
            dinner: randD,
          };
        })
      );
      setIsRegenerating(false);
      setAddedToast(t('calendar_planRegenerated'));
      setTimeout(() => setAddedToast(null), 3500);
    }, 800);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto pb-24">
      {/* Without a bundled catalog to fall back on, a failed load has to say so
          rather than spin forever. */}
      {!activeRecipe && (recipesLoading || (!recipesError && recipes.length > 0)) && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 rounded-xl bg-mango/80 text-white font-black flex items-center justify-center animate-pulse">Z</div>
        </div>
      )}
      {!activeRecipe && !recipesLoading && (recipesError || recipes.length === 0) && (
        <div className="pestle-card border border-pestle-border rounded-3xl py-12 px-6 text-center space-y-3">
          <p className="text-sm font-black text-pestle-text">{t('catalog_unavailableTitle')}</p>
          <p className="text-xs text-gray-400 font-medium max-w-sm mx-auto">
            {t('catalog_unavailableBody')}
          </p>
          <button
            onClick={() => refetchRecipes()}
            className="text-xs font-bold px-4 py-2 rounded-xl shadow-md on-accent"
          >
            {t('fridge_retry')}
          </button>
        </div>
      )}
      {activeRecipe && (<>

      {/* Toast Notification */}
      <AnimatePresence>
        {addedToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-[calc(5rem+env(safe-area-inset-top,0px))] left-3 right-3 sm:left-auto sm:right-6 sm:max-w-sm z-[290] bg-mint text-white px-4 py-2.5 rounded-2xl shadow-xl font-black text-xs flex items-center gap-2 border border-white/20"
          >
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="min-w-0">{addedToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-pestle-text tracking-tight flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{t('calendar_title')}</span>
            <span className="text-xs font-black bg-mango/15 text-mango-ink px-2.5 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
              <Sparkles size={12} /> {t('calendar_aiPlannerBadge')}
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            {t('calendar_subtitle')}
          </p>
        </div>

        <button
          onClick={handleRegeneratePlan}
          disabled={isRegenerating}
          className="bg-pestle-card border border-pestle-border text-pestle-text hover:border-mango font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer hover:shadow-md shrink-0"
        >
          <RotateCw size={14} className={`text-mango-ink ${isRegenerating ? 'animate-spin' : ''}`} />
          <span>{isRegenerating ? t('calendar_planning') : t('calendar_regenerateWithAi')}</span>
        </button>
      </header>

      {/* ── WEEK DAYS CAROUSEL ──────────────────────────────────────────────────────── */}
      <div className="bg-pestle-card border border-pestle-border rounded-3xl p-2.5 shadow-xs">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekDays.map((d) => {
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
                {/* getWeekDays formats DD.MM — the day number is the FIRST part.
                    (The old hardcoded list was MM.DD, so this read the month and
                    every chip showed the same number.) */}
                <span className="text-xs sm:text-sm font-black mt-0.5">{d.date.split('.')[0]}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── DAILY CALORIE BUDGET BAR ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-mango/15 border border-mango/25 p-4 rounded-3xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-mango-ink" />
            <span className="text-xs font-black text-pestle-text">
              {t('calendar_dailyCaloriesNutrition')}
            </span>
          </div>
          <span className="text-xs font-black text-mango-ink">
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
            <p className="text-[9px] font-bold text-gray-400 uppercase">{t('calendar_proteinLabel')}</p>
            <p className="text-xs font-black text-pestle-text">{dailyNutrition.totalProtein}g</p>
          </div>
          <div className="bg-pestle-card/80 border border-pestle-border/60 py-1.5 rounded-xl">
            <p className="text-[9px] font-bold text-gray-400 uppercase">{t('calendar_carbsLabel')}</p>
            <p className="text-xs font-black text-pestle-text">{dailyNutrition.totalCarbs}g</p>
          </div>
          <div className="bg-pestle-card/80 border border-pestle-border/60 py-1.5 rounded-xl">
            <p className="text-[9px] font-bold text-gray-400 uppercase">{t('calendar_fatLabel')}</p>
            <p className="text-xs font-black text-pestle-text">{dailyNutrition.totalFat}g</p>
          </div>
        </div>
      </div>

      {/* Interactive Macro Nutrient Progress Tracker */}
      <MacroProgressWidget
        planned={{
          calories: dailyNutrition.totalCals,
          protein: dailyNutrition.totalProtein,
          carbs: dailyNutrition.totalCarbs,
          fat: dailyNutrition.totalFat,
        }}
        targetCalories={activeDaySchedule.targetCalories}
      />

      {/* ── MEAL TIME SLOTS (Өглөө, Өдөр, Орой) ──────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 className="text-base font-black text-pestle-text tracking-tight">
            {t('calendar_mealSchedule')}
          </h3>
          <span className="text-xs font-bold text-gray-400">{t('calendar_selectedDay', { n: activeDaySchedule.dayLabel })}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-pestle-card border border-pestle-border p-1.5 rounded-2xl">
          {[
            { id: 'breakfast' as MealType, label: t('calendar_breakfast'), icon: Sun, recipe: activeDaySchedule.breakfast },
            { id: 'lunch' as MealType, label: t('calendar_lunch'), icon: SunMedium, recipe: activeDaySchedule.lunch },
            { id: 'dinner' as MealType, label: t('calendar_dinner'), icon: Moon, recipe: activeDaySchedule.dinner },
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
        <div className="h-48 sm:h-64 relative overflow-hidden group">
          {/* SmartImage, not a bare <img>: a recipe photo that fails to load left
              a blank banner with white badges floating on it. */}
          <SmartImage
            src={activeRecipe.image}
            alt={activeRecipe.title}
            emoji="🍽️"
            className="w-full h-full group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-wrap items-center gap-2 pr-24">
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 border border-white/10">
              <Clock size={13} className="text-emerald-300" /> {activeRecipe.time}
            </div>
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 border border-white/10">
              <ChefHat size={13} className="text-amber-400" /> {formatDifficulty(activeRecipe.difficulty, t)}
            </div>
          </div>

          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2">
            <span
              className={`text-xs font-black px-3 py-1 rounded-xl shadow-md ${
                ingredientStatus.matchPct >= 75
                  ? 'bg-mint text-white'
                  : 'bg-amber-600 text-white'
              }`}
            >
              {t('calendar_match', { n: ingredientStatus.matchPct })}
            </span>
          </div>

          {/* Bottom Title overlay */}
          <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 text-white space-y-1">
            <span className="text-[10px] font-extrabold uppercase bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-white/90">
              {activeRecipe.category || t('calendar_featuredRecipe')}
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white drop-shadow-md leading-tight">
              {lang === 'mn' ? activeRecipe.title : activeRecipe.titleEn}
            </h3>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5 space-y-5">
          {/* Nutrition Info Pills */}
          <div className="grid grid-cols-4 gap-2 bg-pestle-bg p-3 rounded-2xl border border-pestle-border/60 text-center">
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase">{t('calendar_calories')}</span>
              <p className="text-xs sm:text-sm font-black text-mango-ink">{activeRecipe.nutrition.calories} kcal</p>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase">{t('calendar_protein')}</span>
              <p className="text-xs sm:text-sm font-black text-pestle-text">{activeRecipe.nutrition.protein}g</p>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase">{t('calendar_carbs')}</span>
              <p className="text-xs sm:text-sm font-black text-pestle-text">{activeRecipe.nutrition.carbs}g</p>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase">{t('calendar_fat')}</span>
              <p className="text-xs sm:text-sm font-black text-pestle-text">{activeRecipe.nutrition.fat}g</p>
            </div>
          </div>

          {/* ── INGREDIENTS STATUS (ХӨРГӨГЧИД БАЙГАА / ДУТУУ) ──────────────── */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black text-pestle-text flex items-center justify-between">
              <span>{t('calendar_ingredientAnalysis')}</span>
              <span className="text-[11px] text-gray-400 font-bold">
                {t('calendar_totalIngredients', { n: activeRecipe.ingredients.length })}
              </span>
            </h4>

            {/* Available Ingredients */}
            {ingredientStatus.available.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-extrabold text-mint-ink uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={12} /> {t('calendar_availableIngredients', { n: ingredientStatus.available.length })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ingredientStatus.available.map((ing, idx) => (
                    <span
                      key={idx}
                      className="bg-mint/10 border border-mint/25 text-mint-ink text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5"
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
                <p className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle size={12} /> {t('calendar_missingIngredients', { n: ingredientStatus.missing.length })}
                </p>

                <div className="space-y-2 bg-pestle-bg p-3 rounded-2xl border border-pestle-border/60">
                  {ingredientStatus.missing.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 text-xs font-bold text-pestle-text border-b border-pestle-border/40 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 shrink-0 rounded-full bg-amber-500" />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="text-mango-ink font-mono font-black shrink-0">
                        {formatPrice(item.estimatedPrice)}
                      </span>
                    </div>
                  ))}

                  <button
                    onClick={handleAddMissingToCart}
                    className="w-full mt-2 bg-mint hover:bg-mint/90 text-white py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-mint/20 transition-all cursor-pointer active:scale-95"
                  >
                    <ShoppingCart size={15} />
                    <span>{t('calendar_addMissingToCart')}</span>
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
            <span>{t('calendar_cookNow')}</span>
          </button>
        </div>
      </motion.div>
      </>)}
    </div>
  );
};
