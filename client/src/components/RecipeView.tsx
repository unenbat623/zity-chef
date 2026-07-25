import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Clock, Flame, Lock, Sparkles, ChevronLeft, X, Utensils } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MOCK_RECIPES } from '../constants';
import { Recipe } from '../types';
import { SmartImage } from './SmartImage';

export const RecipeDetailModal: React.FC<{ recipe: Recipe; onClose: () => void }> = ({
  recipe,
  onClose,
}) => {
  const { lang, subscription, setShowSubModal, setActiveCookingRecipe, setActiveTab, t } = useApp();

  const handleStartCooking = () => {
    if (recipe.isPremium && subscription === 'free') {
      setShowSubModal(true);
      return;
    }
    setActiveCookingRecipe(recipe);
    setActiveTab('cooking');
    onClose();
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="fixed inset-0 bg-pestle-bg z-[170] overflow-y-auto"
    >
      {/* Cover Image with shimmer loader */}
      <div className="relative h-72">
        <SmartImage src={recipe.image} alt={recipe.title} emoji="🍽️" className="w-full h-72" />
        <button
          onClick={onClose}
          className="absolute top-6 left-6 w-10 h-10 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg"
        >
          <ChevronLeft size={22} />
        </button>

        {recipe.isPremium && (
          <div className="absolute top-6 right-6 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-widest shadow-md">
            <Sparkles size={12} /> PRO RECIPE
          </div>
        )}
      </div>

      <div className="p-6 -mt-8 bg-pestle-bg rounded-t-[32px] relative z-10 space-y-6">
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto" />

        <div>
          <span className="text-[10px] font-extrabold uppercase text-mango tracking-widest bg-mango/15 px-2.5 py-0.5 rounded-full">
            {recipe.cuisine || 'International'}
          </span>
          <h1 className="text-2xl font-black text-pestle-text mt-1">
            {lang === 'mn' ? recipe.title : recipe.titleEn || recipe.title}
          </h1>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 bg-pestle-card p-4 rounded-2xl border border-pestle-border text-center shadow-sm">
          <div className="flex flex-col items-center gap-1">
            <Clock size={18} className="text-mango" />
            <span className="text-[10px] text-gray-400 font-bold uppercase">Хугацаа</span>
            <span className="text-xs font-black text-pestle-text">{recipe.time}</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-x border-pestle-border/60">
            <Flame size={18} className="text-mint" />
            <span className="text-[10px] text-gray-400 font-bold uppercase">Түвшин</span>
            <span className="text-xs font-black text-pestle-text">{recipe.difficulty}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Utensils size={18} className="text-amber-500" />
            <span className="text-[10px] text-gray-400 font-bold uppercase">Илчлэг</span>
            <span className="text-xs font-black text-pestle-text">
              {recipe.nutrition.calories} kcal
            </span>
          </div>
        </div>

        {/* Nutrition Detail Box */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-pestle-text uppercase tracking-wider">
            {lang === 'mn' ? 'Шим тэжээлийн мэдээлэл' : 'Nutritional Information'}
          </h3>
          <div className="grid grid-cols-3 gap-2 bg-pestle-card p-3 rounded-xl border border-pestle-border text-center text-xs">
            <div>
              <span className="text-[9px] text-gray-400 font-bold block">{t('protein')}</span>
              <span className="font-black text-pestle-text">{recipe.nutrition.protein}g</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 font-bold block">{t('carbs')}</span>
              <span className="font-black text-pestle-text">{recipe.nutrition.carbs}g</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 font-bold block">{t('fat')}</span>
              <span className="font-black text-pestle-text">{recipe.nutrition.fat}g</span>
            </div>
          </div>
        </div>

        {/* Ingredients list */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-pestle-text uppercase tracking-wider">
            Шаардлагатай орцууд
          </h3>
          <div className="flex flex-wrap gap-2">
            {(lang === 'mn' ? recipe.ingredients : recipe.ingredientsEn || recipe.ingredients).map(
              (ing, i) => (
                <span
                  key={i}
                  className="bg-pestle-card border border-pestle-border px-3 py-1.5 rounded-xl text-xs font-bold text-pestle-text"
                >
                  ✓ {ing}
                </span>
              )
            )}
          </div>
        </div>

        {/* Start Cooking Action */}
        <button
          onClick={handleStartCooking}
          className="w-full btn-primary py-4 font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-mango/25"
        >
          {recipe.isPremium && subscription === 'free' ? (
            <>
              <Lock size={18} />
              <span>Pro Chef идэвхжүүлж хийх</span>
            </>
          ) : (
            <>
              <Flame size={18} />
              <span>Хоол хийж эхлэх</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export const RecipeView: React.FC = () => {
  const { lang, subscription, t } = useApp();
  const [search, setSearch] = useState<string>('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const filtered = MOCK_RECIPES.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.titleEn?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header className="space-y-3">
        <h2 className="text-2xl font-black text-pestle-text tracking-tight">{t('tabRecipe')}</h2>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Олон улсын хоолны жор хайх..."
            className="w-full bg-pestle-card border border-pestle-border rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium focus:outline-none focus:border-mango transition-colors text-pestle-text shadow-sm"
          />
        </div>
      </header>

      {/* Recipe Cards List */}
      <div className="grid gap-4">
        {filtered.map((recipe) => (
          <motion.div
            key={recipe.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedRecipe(recipe)}
            className="pestle-card overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Recipe Card Cover with shimmer loading */}
            <div className="h-40 relative">
              <SmartImage
                src={recipe.image}
                alt={recipe.title}
                emoji="🍽️"
                className="w-full h-40"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              {recipe.isPremium && (
                <div className="absolute top-3 right-3 bg-amber-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-widest shadow-md">
                  <Lock size={10} /> PRO
                </div>
              )}

              <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                <div>
                  <span className="text-[10px] font-extrabold text-mango uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                    {recipe.cuisine || 'Global'}
                  </span>
                  <h3 className="text-base font-black text-white mt-1">
                    {lang === 'mn' ? recipe.title : recipe.titleEn || recipe.title}
                  </h3>
                </div>

                <div className="flex gap-1.5 text-white text-[10px] font-bold">
                  <span className="bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1">
                    <Clock size={10} className="text-mango" /> {recipe.time}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedRecipe && (
          <RecipeDetailModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};
