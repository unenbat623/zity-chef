import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Clock,
  Flame,
  Lock,
  Sparkles,
  ChevronLeft,
  X,
  Utensils,
  ChevronDown,
  Star,
  ChefHat,
  ShoppingBag,
  RotateCcw,
  Bookmark,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useRecipes } from '../hooks/useRecipes';
import { useStoreProducts } from '../hooks/useStoreProducts';
import { MOCK_INGREDIENTS } from '../constants';
import {
  CatalogProduct,
  buildIngredientCartItem,
  matchIngredientToProduct,
  FALLBACK_INGREDIENT_PRICE,
} from '../lib/recipeStore';
import { Recipe, RecipeCategory } from '../types';
import { SmartImage } from './SmartImage';

const CATEGORY_OPTIONS: { labelKey: string; value: RecipeCategory | 'all'; icon: string }[] = [
  { labelKey: 'recipe_categoryAll', value: 'all', icon: '🍽️' },
  { labelKey: 'recipe_categoryBreakfast', value: 'Өглөөний цай', icon: '🌅' },
  { labelKey: 'recipe_categorySalad', value: 'Салат ба Хөнгөн зууш', icon: '🥗' },
  { labelKey: 'recipe_categoryMain', value: 'Үндсэн хоол', icon: '🥩' },
  { labelKey: 'recipe_categorySoup', value: 'Шөл ба Бүлээн хоол', icon: '🥣' },
  { labelKey: 'recipe_categoryDessert', value: 'Эрүүл дессерт ба Ундаа', icon: '🍨' },
];

export const RecipeDetailModal: React.FC<{ recipe: Recipe; onClose: () => void }> = ({
  recipe,
  onClose,
}) => {
  const { lang, subscription, setShowSubModal, setActiveCookingRecipe, setActiveTab, inventory, addToCart, savedRecipeIds, toggleSaveRecipe, t } =
    useApp();
  const { products } = useStoreProducts();
  // Same catalog the store tab sells from — recipe orders resolve to real products.
  const storeCatalog: CatalogProduct[] = products.length
    ? products
    : (MOCK_INGREDIENTS as CatalogProduct[]);

  const isSaved = savedRecipeIds.includes(recipe.id);
  const [missingAdded, setMissingAdded] = useState(false);

  const handleStartCooking = () => {
    if (recipe.isPremium && subscription === 'free') {
      setShowSubModal(true);
      return;
    }
    setActiveCookingRecipe(recipe);
    setActiveTab('cooking');
    onClose();
  };

  // Calculate fridge match for ingredients
  const recipeIngredients = lang === 'mn' ? recipe.ingredients : recipe.ingredientsEn || recipe.ingredients;
  const matchDetails = useMemo(() => {
    const inventoryNames = inventory.map((inv) => inv.name.toLowerCase());
    const present: string[] = [];
    const missing: string[] = [];

    recipeIngredients.forEach((ing) => {
      const ingLower = ing.toLowerCase();
      const hasItem = inventoryNames.some(
        (invName) => invName.includes(ingLower) || ingLower.includes(invName)
      );
      if (hasItem) {
        present.push(ing);
      } else {
        missing.push(ing);
      }
    });

    return { present, missing, count: present.length, total: recipeIngredients.length };
  }, [recipeIngredients, inventory]);

  // Resolve each missing ingredient against the store catalog once.
  const missingWithProducts = useMemo(
    () =>
      matchDetails.missing.map((ing) => ({
        ingredient: ing,
        product: matchIngredientToProduct(ing, storeCatalog),
      })),
    [matchDetails.missing, storeCatalog]
  );

  const missingTotalPrice = useMemo(
    () =>
      missingWithProducts.reduce(
        (sum, m) => sum + (m.product?.pricePerUnit || FALLBACK_INGREDIENT_PRICE),
        0
      ),
    [missingWithProducts]
  );

  const handleAddMissingToCart = (ingName: string) => {
    addToCart(buildIngredientCartItem(ingName, storeCatalog, lang));
  };

  const handleAddAllMissing = () => {
    matchDetails.missing.forEach((ing) => {
      addToCart(buildIngredientCartItem(ing, storeCatalog, lang));
    });
    setMissingAdded(true);
  };

  const handleGoToStore = () => {
    setActiveTab('store');
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="fixed inset-0 bg-pestle-bg z-[170] overflow-y-auto"
    >
      {/* Cover Image */}
      <div className="relative h-72 sm:h-96">
        <SmartImage src={recipe.image} alt={recipe.title} emoji="🍽️" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

        <button
          onClick={onClose}
          aria-label={t('recipe_back')}
          className="absolute top-6 left-6 w-11 h-11 bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-xl hover:bg-mango transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="absolute top-6 right-6 flex items-center gap-2">
          <button
            onClick={() => toggleSaveRecipe(recipe.id)}
            className={`w-11 h-11 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl transition-all ${
              isSaved
                ? 'bg-mango text-white'
                : 'bg-black/60 text-white hover:bg-black/80'
            }`}
            title={isSaved ? 'Remove from saved' : 'Save recipe'}
          >
            <Bookmark size={20} className={isSaved ? 'fill-white' : ''} />
          </button>

          {recipe.isPremium && (
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-black px-3.5 py-1.5 rounded-full flex items-center gap-1.5 uppercase tracking-widest shadow-lg">
              <Sparkles size={14} /> PRO VIP
            </div>
          )}
        </div>

        <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-extrabold uppercase text-mango tracking-widest bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-mango/30">
              {recipe.category || recipe.cuisine || 'Healthy'}
            </span>
            {recipe.rating && (
              <span className="text-xs font-bold bg-amber-500/90 text-white px-2.5 py-1 rounded-full flex items-center gap-1 backdrop-blur-md">
                <Star size={12} fill="currentColor" /> {recipe.rating}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black leading-tight drop-shadow-md">
            {lang === 'mn' ? recipe.title : recipe.titleEn || recipe.title}
          </h1>
        </div>
      </div>

      <div className="p-5 sm:p-8 -mt-6 bg-pestle-bg rounded-t-[36px] relative z-10 space-y-6 max-w-4xl mx-auto border-t border-pestle-border">
        <div className="w-14 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto" />

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 bg-pestle-card p-4 rounded-2xl border border-pestle-border text-center shadow-md">
          <div className="flex flex-col items-center gap-1">
            <Clock size={20} className="text-mango" />
            <span className="text-[10px] text-gray-400 font-extrabold uppercase">{t('recipe_timeLabel')}</span>
            <span className="text-xs sm:text-sm font-black text-pestle-text">{recipe.time}</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-x border-pestle-border/60">
            <Flame size={20} className="text-mint" />
            <span className="text-[10px] text-gray-400 font-extrabold uppercase">{t('recipe_levelLabel')}</span>
            <span className="text-xs sm:text-sm font-black text-pestle-text">{recipe.difficulty}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Utensils size={20} className="text-amber-500" />
            <span className="text-[10px] text-gray-400 font-extrabold uppercase">{t('calories')}</span>
            <span className="text-xs sm:text-sm font-black text-pestle-text">
              {recipe.nutrition.calories} kcal
            </span>
          </div>
        </div>

        {/* Fridge Availability Box */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-4 rounded-2xl border border-emerald-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ChefHat size={16} /> {t('recipe_fridgeReadiness', { count: matchDetails.count, total: matchDetails.total })}
            </span>
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
              {t('recipe_percentReady', { n: Math.round((matchDetails.count / matchDetails.total) * 100) })}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${(matchDetails.count / matchDetails.total) * 100}%` }}
            />
          </div>
        </div>

        {/* Nutrition Detail Box */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-pestle-text uppercase tracking-wider">
            {t('recipe_nutritionInfo')}
          </h3>
          <div className="grid grid-cols-3 gap-3 bg-pestle-card p-3.5 rounded-xl border border-pestle-border text-center text-xs">
            <div>
              <span className="text-[10px] text-gray-400 font-bold block uppercase">{t('protein')}</span>
              <span className="text-sm font-black text-pestle-text">{recipe.nutrition.protein}g</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold block uppercase">{t('carbs')}</span>
              <span className="text-sm font-black text-pestle-text">{recipe.nutrition.carbs}g</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold block uppercase">{t('fat')}</span>
              <span className="text-sm font-black text-pestle-text">{recipe.nutrition.fat}g</span>
            </div>
          </div>
        </div>

        {/* Ingredients list */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-pestle-text uppercase tracking-wider">
            {t('recipe_requiredIngredients')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recipeIngredients.map((ing, i) => {
              const isPresent = matchDetails.present.includes(ing);
              const storeProduct = isPresent
                ? null
                : missingWithProducts.find((m) => m.ingredient === ing)?.product ?? null;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all text-xs font-bold ${
                    isPresent
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-pestle-card border-pestle-border text-pestle-text'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isPresent ? (
                      <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    ) : (
                      <span className="w-5 h-5 bg-gray-200 dark:bg-slate-700 text-gray-500 rounded-full flex items-center justify-center text-[10px]">
                        •
                      </span>
                    )}
                    <span>{ing}</span>
                  </div>

                  {!isPresent && (
                    <button
                      onClick={() => handleAddMissingToCart(ing)}
                      className="text-[10px] bg-mango/15 hover:bg-mango text-mango hover:text-white px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-bold shrink-0"
                      title={
                        storeProduct
                          ? t('recipe_inStoreAs', { name: storeProduct.name })
                          : t('recipe_order')
                      }
                    >
                      <ShoppingBag size={11} />
                      <span>
                        {storeProduct ? storeProduct.emoji : ''} ₮
                        {(storeProduct?.pricePerUnit || FALLBACK_INGREDIENT_PRICE).toLocaleString()}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Order every missing ingredient from the store in one tap */}
          {matchDetails.missing.length > 0 && (
            <div className="bg-mango/8 border border-mango/25 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-pestle-text flex items-center gap-1.5">
                  <ShoppingBag size={15} className="text-mango" />
                  {t('recipe_missingFromStore', { n: matchDetails.missing.length })}
                </span>
                <span className="text-xs font-black text-mango">
                  ≈ ₮{missingTotalPrice.toLocaleString()}
                </span>
              </div>
              {missingAdded ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <span className="flex-1 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl py-2.5">
                    ✓ {t('recipe_missingAdded')}
                  </span>
                  <button
                    onClick={handleGoToStore}
                    className="flex-1 btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag size={14} /> {t('recipe_goToStoreCart')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddAllMissing}
                  className="w-full btn-primary py-3 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <ShoppingBag size={15} />
                  <span>{t('recipe_addAllMissing', { n: matchDetails.missing.length })}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Cooking Steps */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-pestle-text uppercase tracking-wider">
            {t('recipe_cookingSteps', { n: recipe.steps.length })}
          </h3>
          <div className="space-y-3">
            {recipe.steps.map((step, idx) => (
              <div
                key={idx}
                className="bg-pestle-card border border-pestle-border rounded-2xl p-4 space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-mango bg-mango/10 px-3 py-1 rounded-full">
                    {t('step')} {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-pestle-text">
                    {lang === 'mn' ? step.title : step.titleEn || step.title}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                  {lang === 'mn' ? step.description : step.descriptionEn || step.description}
                </p>
                {step.sisterTip && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2 font-medium">
                    <Sparkles size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>{t('sisterTip')}</strong>{' '}
                      {lang === 'mn' ? step.sisterTip : step.sisterTipEn || step.sisterTip}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Start Cooking Action */}
        <button
          onClick={handleStartCooking}
          className="w-full btn-primary py-4 font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-mango/25 hover:scale-[1.01] transition-transform"
        >
          {recipe.isPremium && subscription === 'free' ? (
            <>
              <Lock size={18} />
              <span>{t('recipe_activateProChef')}</span>
            </>
          ) : (
            <>
              <Flame size={18} className="animate-bounce" />
              <span>{t('recipe_startCooking')}</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export const RecipeView: React.FC = () => {
  const { lang, inventory, savedRecipeIds, toggleSaveRecipe, t } = useApp();
  const { recipes, isLoading: recipesLoading } = useRecipes();
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'fridgeMatch' | 'rating' | 'time'>('fridgeMatch');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Search autocomplete dropdown state
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute fridge ingredient match for each recipe
  const recipesWithMatch = useMemo(() => {
    const inventoryNames = inventory.map((item) => item.name.toLowerCase());

    return recipes.map((recipe) => {
      const recipeIngredients = lang === 'mn' ? recipe.ingredients : recipe.ingredientsEn || recipe.ingredients;
      let matchedCount = 0;

      recipeIngredients.forEach((ing) => {
        const ingLower = ing.toLowerCase();
        if (inventoryNames.some((invName) => invName.includes(ingLower) || ingLower.includes(invName))) {
          matchedCount++;
        }
      });

      const matchRatio = recipeIngredients.length > 0 ? matchedCount / recipeIngredients.length : 0;

      return {
        ...recipe,
        matchedCount,
        totalIngredients: recipeIngredients.length,
        matchRatio,
      };
    });
  }, [inventory, lang]);

  // Autocomplete Suggestions popup list
  const searchSuggestions = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.toLowerCase().trim();
    return recipesWithMatch.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.titleEn?.toLowerCase().includes(query) ||
        r.ingredients.some((ing) => ing.toLowerCase().includes(query)) ||
        r.cuisine?.toLowerCase().includes(query)
    );
  }, [search, recipesWithMatch]);

  // Filtered & Sorted recipes for main grid
  const filteredRecipes = useMemo(() => {
    let result = recipesWithMatch;

    // Search query filter
    if (search.trim()) {
      const query = search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.titleEn?.toLowerCase().includes(query) ||
          r.ingredients.some((ing) => ing.toLowerCase().includes(query)) ||
          r.cuisine?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((r) => r.category === selectedCategory);
    }

    // Difficulty filter
    if (selectedDifficulty !== 'all') {
      result = result.filter((r) => r.difficulty.toLowerCase() === selectedDifficulty.toLowerCase());
    }

    // Sorting logic
    return [...result].sort((a, b) => {
      if (sortBy === 'fridgeMatch') {
        return b.matchRatio - a.matchRatio;
      }
      if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === 'time') {
        const timeA = parseInt(a.time) || 99;
        const timeB = parseInt(b.time) || 99;
        return timeA - timeB;
      }
      return 0;
    });
  }, [recipesWithMatch, search, selectedCategory, selectedDifficulty, sortBy]);

  // High Fridge Match suggestions (Top Fridge Recommendations)
  const fridgeRecommendedRecipes = useMemo(() => {
    return recipesWithMatch
      .filter((r) => r.matchedCount > 0)
      .sort((a, b) => b.matchRatio - a.matchRatio)
      .slice(0, 4);
  }, [recipesWithMatch]);

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedDifficulty('all');
    setSortBy('fridgeMatch');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Title */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-pestle-text tracking-tight flex items-center gap-2">
            <span>{t('tabRecipe')}</span>
            <span className="text-xs bg-mango/15 text-mango px-2.5 py-1 rounded-full font-bold">
              {t('recipe_recipeCount', { n: recipes.length })}
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            {t('recipe_subtitle')}
          </p>
        </div>

        {/* Sort selector dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:inline">
            {t('recipe_sortBy')}
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-pestle-card border border-pestle-border rounded-xl px-3 py-2 text-xs font-bold text-pestle-text focus:outline-none focus:border-mango shadow-xs cursor-pointer"
          >
            <option value="fridgeMatch">{t('recipe_sortFridgeMatch')}</option>
            <option value="rating">{t('recipe_sortRating')}</option>
            <option value="time">{t('recipe_sortTime')}</option>
          </select>
        </div>
      </header>

      {/* SEARCH BAR WITH LIVE AUTOCOMPLETE DROPDOWN */}
      <div ref={searchRef} className="relative z-30">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-mango" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            aria-label={t('recipe_searchAria')}
            placeholder={t('recipe_searchPlaceholder')}
            className="w-full bg-pestle-card border border-pestle-border rounded-2xl py-3.5 pl-11 pr-10 text-xs sm:text-sm font-semibold focus:outline-none focus:border-mango focus:ring-2 focus:ring-mango/20 transition-all text-pestle-text shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pestle-text p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Live Autocomplete Dropdown */}
        <AnimatePresence>
          {isSearchFocused && searchSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="absolute top-full left-0 right-0 mt-2 bg-pestle-card border border-pestle-border rounded-2xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto divide-y divide-pestle-border/40"
            >
              <div className="p-2 bg-mango/5 text-[11px] font-bold text-mango uppercase tracking-wider px-4 flex justify-between items-center">
                <span>{t('recipe_searchResults', { n: searchSuggestions.length })}</span>
                <span className="text-gray-400 text-[10px]">{t('recipe_clickToView')}</span>
              </div>
              {searchSuggestions.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => {
                    setSelectedRecipe(rec);
                    setIsSearchFocused(false);
                  }}
                  className="flex items-center gap-3 p-3 hover:bg-mango/10 cursor-pointer transition-colors"
                >
                  <img
                    src={rec.image}
                    alt={rec.title}
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-pestle-border"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-extrabold text-pestle-text truncate">
                        {lang === 'mn' ? rec.title : rec.titleEn || rec.title}
                      </h4>
                      {rec.isPremium && (
                        <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md">
                          PRO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                      <span>{rec.category || rec.cuisine}</span>
                      <span>•</span>
                      <span>{rec.time}</span>
                      <span>•</span>
                      <span className="text-emerald-500 font-bold">
                        {t('recipe_ingredientsReady', { matched: rec.matchedCount, total: rec.totalIngredients })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CONTROLS ROW: CATEGORY DROPDOWN & DIFFICULTY FILTERS */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Category Dropdown Select */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 sm:max-w-xs">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="w-full appearance-none bg-pestle-card border border-pestle-border rounded-xl py-2.5 pl-3.5 pr-9 text-xs font-bold text-pestle-text focus:outline-none focus:border-mango shadow-xs cursor-pointer"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.icon} {t(cat.labelKey)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>

          {/* Difficulty Dropdown */}
          <div className="relative sm:w-36">
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full appearance-none bg-pestle-card border border-pestle-border rounded-xl py-2.5 pl-3.5 pr-8 text-xs font-bold text-pestle-text focus:outline-none focus:border-mango shadow-xs cursor-pointer"
            >
              <option value="all">{t('recipe_difficultyAll')}</option>
              <option value="easy">{t('recipe_difficultyEasy')}</option>
              <option value="medium">{t('recipe_difficultyMedium')}</option>
              <option value="hard">{t('recipe_difficultyHard')}</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Quick Reset Button if filters active */}
        {(selectedCategory !== 'all' || selectedDifficulty !== 'all' || search) && (
          <button
            onClick={resetFilters}
            className="flex items-center justify-center gap-1.5 text-xs font-bold text-mango hover:text-amber-600 bg-mango/10 hover:bg-mango/20 px-3 py-2 rounded-xl transition-colors shrink-0"
          >
            <RotateCcw size={14} /> {t('recipe_clear')}
          </button>
        )}
      </div>

      {/* QUICK SCROLLABLE CATEGORY PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORY_OPTIONS.map((cat) => {
          const isSelected = selectedCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-mango text-white shadow-md shadow-mango/25 scale-[1.02]'
                  : 'bg-pestle-card border border-pestle-border text-pestle-text hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{t(cat.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* SMART RECOMMENDATIONS SECTION (If user has fridge items matching recipes) */}
      {!search && selectedCategory === 'all' && fridgeRecommendedRecipes.length > 0 && (
        <section className="space-y-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-mango/10 p-4 sm:p-5 rounded-3xl border border-emerald-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-pestle-text flex items-center gap-2">
              <Sparkles size={18} className="text-emerald-500 animate-pulse" />
              <span>{t('recipe_fridgeRecommendations')}</span>
            </h3>
            <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/15 px-2.5 py-1 rounded-full">
              AI Smart Suggest
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {fridgeRecommendedRecipes.map((recipe) => (
              <motion.div
                key={recipe.id}
                whileHover={{ y: -3 }}
                onClick={() => setSelectedRecipe(recipe)}
                className="bg-pestle-card border border-pestle-border p-2.5 rounded-2xl cursor-pointer shadow-xs hover:shadow-md transition-all flex items-center gap-3"
              >
                <img
                  src={recipe.image}
                  alt={recipe.title}
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
                    ✓ {t('recipe_ingredientsReady', { matched: recipe.matchedCount, total: recipe.totalIngredients })}
                  </span>
                  <h4 className="text-xs font-black text-pestle-text truncate mt-1">
                    {lang === 'mn' ? recipe.title : recipe.titleEn || recipe.title}
                  </h4>
                  <span className="text-[10px] text-gray-400 font-bold block mt-0.5">
                    ⏱️ {recipe.time} • 🔥 {recipe.nutrition.calories} kcal
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* MAIN RECIPES GRID (Responsive: 1 col on mobile, 2 on tablet, 3 on desktop) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
            {t('recipe_recipeCollection', { n: filteredRecipes.length })}
          </span>
        </div>

        {filteredRecipes.length === 0 ? (
          <div className="bg-pestle-card border border-pestle-border rounded-3xl p-10 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-mango/10 text-mango rounded-full flex items-center justify-center mx-auto text-2xl">
              🔍
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-pestle-text">{t('recipe_noRecipesTitle')}</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                {t('recipe_noRecipesDesc')}
              </p>
            </div>
            <button onClick={resetFilters} className="btn-primary py-2.5 px-6 text-xs font-bold">
              {t('recipe_viewAllRecipes')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRecipes.map((recipe) => (
              <motion.div
                key={recipe.id}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedRecipe(recipe)}
                className="pestle-card overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-all duration-300 border border-pestle-border rounded-3xl flex flex-col justify-between"
              >
                {/* Recipe Cover Image */}
                <div className="h-48 relative overflow-hidden">
                  <SmartImage
                    src={recipe.image}
                    alt={recipe.title}
                    emoji="🍽️"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                  {/* Top Badges Row */}
                  <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
                    <span className="text-[10px] font-black text-white bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full uppercase tracking-wider border border-white/20">
                      {recipe.category || recipe.cuisine || 'Global'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveRecipe(recipe.id);
                        }}
                        className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center transition-transform hover:scale-110 ${
                          savedRecipeIds.includes(recipe.id)
                            ? 'bg-mango text-white'
                            : 'bg-black/60 text-white hover:bg-black/80'
                        }`}
                        title={savedRecipeIds.includes(recipe.id) ? t('recipe_removeBookmark') : t('recipe_saveBookmark')}
                      >
                        <Bookmark size={13} className={savedRecipeIds.includes(recipe.id) ? 'fill-white' : ''} />
                      </button>

                      {recipe.isPremium && (
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-widest shadow-md">
                          <Lock size={10} /> PRO
                        </span>
                      )}
                      {recipe.rating && (
                        <span className="bg-black/60 backdrop-blur-md text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-amber-500/30">
                          <Star size={10} fill="currentColor" /> {recipe.rating}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fridge Match Badge */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-white leading-tight drop-shadow-sm group-hover:text-mango transition-colors">
                        {lang === 'mn' ? recipe.title : recipe.titleEn || recipe.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md border ${
                            recipe.matchedCount > 0
                              ? 'bg-emerald-500/80 text-white border-emerald-400/40'
                              : 'bg-black/50 text-gray-300 border-white/10'
                          }`}
                        >
                          ✓ {t('recipe_ingredientsInFridge', { matched: recipe.matchedCount, total: recipe.totalIngredients })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recipe Footer Details */}
                <div className="p-4 bg-pestle-card flex items-center justify-between border-t border-pestle-border/40 text-xs font-bold text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-mango" />
                    <span>{recipe.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flame size={13} className="text-mint" />
                    <span>{recipe.difficulty}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Utensils size={13} className="text-amber-500" />
                    <span>{recipe.nutrition.calories} kcal</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* RECIPE DETAIL MODAL */}
      <AnimatePresence>
        {selectedRecipe && (
          <RecipeDetailModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};
