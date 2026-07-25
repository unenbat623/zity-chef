import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Clock, ChevronLeft, ChevronRight, CheckCircle2, Sparkles, Volume2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Recipe } from '../types';

export const CookingModeView: React.FC<{ recipe: Recipe | null }> = ({ recipe }) => {
  const { lang, setActiveTab, t } = useApp();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  if (!recipe) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-mango/10 text-mango rounded-full flex items-center justify-center shadow-lg">
          <Flame size={40} />
        </div>
        <h3 className="text-xl font-bold text-pestle-text">{t('noRecipeSelected')}</h3>
        <p className="text-xs text-gray-400 max-w-[220px] leading-relaxed">
          {t('chooseFromAssistant')}
        </p>
        <button
          onClick={() => setActiveTab('recipe')}
          className="btn-primary py-3 px-6 text-xs font-bold shadow-md shadow-mango/20"
        >
          Жор хэсэг рүү шилжих
        </button>
      </div>
    );
  }

  const steps = recipe.steps;
  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <span className="text-[10px] font-extrabold text-mango uppercase tracking-widest bg-mango/10 px-2.5 py-0.5 rounded-full">
            {recipe.cuisine || 'International'}
          </span>
          <h2 className="text-2xl font-black text-pestle-text mt-1">{recipe.title}</h2>
        </div>
        <div className="flex items-center gap-1.5 bg-pestle-card border border-pestle-border px-3 py-1.5 rounded-xl text-xs font-bold text-gray-500">
          <Clock size={14} className="text-mango" />
          <span>{recipe.time}</span>
        </div>
      </header>

      {isCompleted ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="py-12 text-center bg-pestle-card border border-pestle-border rounded-[28px] p-8 shadow-xl space-y-4"
        >
          <div className="w-20 h-20 bg-mint/20 text-mint rounded-full flex items-center justify-center mx-auto shadow-lg animate-bounce">
            <CheckCircle2 size={48} />
          </div>
          <h3 className="text-2xl font-black text-pestle-text">Амжилттай бэлэн боллоо! 🎉</h3>
          <p className="text-xs text-gray-400 max-w-[240px] mx-auto leading-relaxed">
            Сайхан хооллоорой дүү минь! AI Эгч нь чамаар бахархаж байна. ✨
          </p>
          <button
            onClick={() => {
              setIsCompleted(false);
              setCurrentStep(0);
              setActiveTab('fridge');
            }}
            className="btn-primary py-3.5 px-8 text-xs font-bold shadow-lg shadow-mango/20"
          >
            Хөргөгч рүү буцах
          </button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-bold text-gray-400">
              <span>{t('step')} {currentStep + 1} / {steps.length}</span>
              <span className="text-mango font-black">
                {Math.round(((currentStep + 1) / steps.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-pestle-card h-2 rounded-full border border-pestle-border overflow-hidden">
              <motion.div
                className="h-full bg-mango rounded-full"
                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Current Step Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="pestle-card p-6 space-y-5 shadow-lg relative overflow-hidden"
            >
              <div className="h-48 rounded-2xl overflow-hidden border border-pestle-border">
                <img src={step.image} alt={step.title} className="w-full h-full object-cover" />
              </div>

              <div>
                <h3 className="text-lg font-black text-pestle-text mb-2">
                  {currentStep + 1}. {lang === 'mn' ? step.title : step.titleEn || step.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  {lang === 'mn' ? step.description : step.descriptionEn || step.description}
                </p>
              </div>

              {/* Sister Tip Card */}
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Sparkles size={14} /> {t('sisterTip')}
                </span>
                <p className="text-xs text-pestle-text leading-relaxed font-medium">
                  {lang === 'mn' ? step.sisterTip : step.sisterTipEn || step.sisterTip}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex gap-3">
            <button
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="btn-secondary flex-1 py-3.5 text-xs font-bold disabled:opacity-40"
            >
              {t('prevStep')}
            </button>
            <button
              onClick={handleNext}
              className="btn-primary flex-1 py-3.5 text-xs font-bold shadow-lg shadow-mango/20"
            >
              {currentStep === steps.length - 1 ? t('finishCooking') : t('nextStep')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
