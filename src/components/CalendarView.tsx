import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Flame, ShoppingCart, ChevronRight, Sparkles, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WEEK_DAYS, MOCK_RECIPES } from '../constants';
import { formatQuantity } from '../lib/utils';

export const CalendarView: React.FC = () => {
  const { lang, addToCart, setActiveCookingRecipe, setActiveTab, t } = useApp();
  const [selectedDay, setSelectedDay] = useState<string>(WEEK_DAYS[0].day);

  const activeRecipe = MOCK_RECIPES[0];

  const handleAddMissingToCart = () => {
    // Add missing ingredients to cart
    addToCart({
      id: 'cart-beef',
      name: 'Үхрийн мах',
      emoji: '🥩',
      unit: 'гр',
      quantity: 500,
      pricePerUnit: 22,
      totalPrice: 11000
    });
    addToCart({
      id: 'cart-cheese',
      name: 'Бяслаг',
      emoji: '🧀',
      unit: 'гр',
      quantity: 300,
      pricePerUnit: 35,
      totalPrice: 10500
    });
    setActiveTab('store');
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">

      <header>
        <h2 className="text-2xl font-black text-pestle-text tracking-tight">{t('tabCalendar')}</h2>
        <p className="text-xs font-semibold text-gray-400 mt-1">
          {lang === 'mn' ? '7 хоногийн ухаалаг хоолны төлөвлөгөө ба илчлэг' : '7-Day Smart Meal Plan & Nutrition Tracker'}
        </p>
      </header>

      {/* Week Days Carousel */}
      <div className="flex justify-between gap-1.5 overflow-x-auto pb-2 no-scrollbar">
        {WEEK_DAYS.map((d) => {
          const isSelected = selectedDay === d.day;
          return (
            <button
              key={d.day}
              onClick={() => setSelectedDay(d.day)}
              className={`flex-1 min-w-[44px] py-3 rounded-2xl flex flex-col items-center transition-all ${
                isSelected
                  ? 'bg-mango text-white shadow-lg shadow-mango/30'
                  : 'bg-pestle-card border border-pestle-border text-gray-400 hover:text-pestle-text'
              }`}
            >
              <span className="text-[10px] font-extrabold uppercase">{lang === 'mn' ? d.day : d.dayEn}</span>
              <span className="text-xs font-black mt-1">{d.date.split('.')[1]}</span>
            </button>
          );
        })}
      </div>

      {/* Recommended Recipe for Selected Day */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-pestle-text">
            {lang === 'mn' ? 'Өнөөдрийн санал болгох хоол' : "Today's Recommended Meal"}
          </h3>
          <span className="text-[10px] font-extrabold bg-mint/15 text-mint px-2 py-0.5 rounded-full uppercase">
            Match: 95%
          </span>
        </div>

        <div className="pestle-card overflow-hidden group shadow-md">
          <div className="h-44 relative">
            <img
              src={activeRecipe.image}
              alt={activeRecipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] font-bold text-white flex items-center gap-1">
              <Clock size={12} className="text-mango" /> {activeRecipe.time}
            </div>
            <div className="absolute top-3 right-3 bg-mango text-white px-2.5 py-1 rounded-xl text-[10px] font-bold">
              {activeRecipe.nutrition.calories} kcal
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <h4 className="text-lg font-black text-pestle-text">
                {lang === 'mn' ? activeRecipe.title : activeRecipe.titleEn}
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                Хөргөгчинд байгаа орцуудад яг тохирсон амттай хоол.
              </p>
            </div>

            {/* Nutrition Breakdown Grid */}
            <div className="grid grid-cols-4 gap-2 bg-pestle-bg p-3 rounded-xl border border-pestle-border/60 text-center">
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase">{t('calories')}</span>
                <p className="text-xs font-black text-mango">{activeRecipe.nutrition.calories}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase">{t('protein')}</span>
                <p className="text-xs font-black text-pestle-text">{activeRecipe.nutrition.protein}g</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase">{t('carbs')}</span>
                <p className="text-xs font-black text-pestle-text">{activeRecipe.nutrition.carbs}g</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase">{t('fat')}</span>
                <p className="text-xs font-black text-pestle-text">{activeRecipe.nutrition.fat}g</p>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveCookingRecipe(activeRecipe);
                setActiveTab('cooking');
              }}
              className="w-full btn-primary py-3 font-bold flex items-center justify-center gap-2 shadow-md shadow-mango/20"
            >
              <Flame size={16} />
              <span>Одоо хийх</span>
            </button>
          </div>
        </div>
      </div>

      {/* Missing Ingredients & Cart Sync */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-pestle-text">
            {lang === 'mn' ? 'Дутуу орцуудын хураангуй' : 'Missing Ingredients Summary'}
          </h3>
          <span className="text-xs text-gray-400">2 орц дутуу</span>
        </div>

        <div className="pestle-card p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-pestle-border/50 pb-2">
            <span className="text-xs font-bold text-pestle-text flex items-center gap-2">
              <span>🥩</span> Үхрийн Рибай Мах (500г)
            </span>
            <span className="text-xs font-mono font-bold text-mango">₮11,000</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-pestle-text flex items-center gap-2">
              <span>🧀</span> Моццарелла Бяслаг (300г)
            </span>
            <span className="text-xs font-mono font-bold text-mango">₮10,500</span>
          </div>

          <button
            onClick={handleAddMissingToCart}
            className="w-full bg-mint text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md shadow-mint/20 mt-2"
          >
            <ShoppingCart size={16} />
            <span>{t('missingIngredients')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
