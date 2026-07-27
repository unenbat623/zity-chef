import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Flame,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Utensils,
  Wrench,
  CheckSquare,
  Square,
  Award,
  Layers,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from './Toast';
import { Recipe, RecipeStep } from '../types';

export const CookingModeView: React.FC<{ recipe: Recipe | null }> = ({ recipe }) => {
  const { lang, setActiveTab, t } = useApp();
  const { toastWarning, toastSuccess } = useToast();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Step Timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Voice narration state
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Ingredient check off for current step
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});

  // Reset timer & audio on step change
  useEffect(() => {
    if (recipe && recipe.steps[currentStep]) {
      const step = recipe.steps[currentStep];
      if (step.timerMinutes) {
        setTimerSeconds(step.timerMinutes * 60);
      } else {
        setTimerSeconds(0);
      }
      setIsTimerRunning(false);
      setCheckedIngredients({});
    }
  }, [currentStep, recipe]);

  // Timer Countdown Effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      // Toast the user that the timer is done
      toastSuccess('Цаг хугацаа дууслаа! ⏰', 'Дараагийн алхам руу шилжихэд бэлэн.');
      // Play alert tone if browser supports
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.frequency.value = 587.33; // D5 note
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch (e) {
        // ignore audio context restrictions
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

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
          className="btn-primary py-3 px-6 text-xs font-bold shadow-md shadow-mango/20 cursor-pointer"
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

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const toggleVoiceGuide = () => {
    if (!('speechSynthesis' in window)) {
      toastWarning(
        'Дуут заавар дэмжигдэхгүй байна',
        'Таны хөтөч Speech Synthesis API-г дэмжихгүй байна.'
      );
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const textToRead = `${currentStep + 1}-р алхам. ${
        lang === 'mn' ? step.title : step.titleEn || step.title
      }. ${lang === 'mn' ? step.description : step.descriptionEn || step.description}. Эгчийн зөвлөгөө: ${
        lang === 'mn' ? step.sisterTip : step.sisterTipEn || step.sisterTip
      }`;

      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = lang === 'mn' ? 'mn-MN' : 'en-US';
      utterance.rate = 0.95;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleCheckIngredient = (item: string) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-pestle-card border border-pestle-border p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={() => setActiveTab('recipe')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-pestle-bg border border-pestle-border text-pestle-text hover:border-mango hover:text-mango transition-all cursor-pointer shadow-xs shrink-0"
            title="Жор цэс рүү буцах"
          >
            <ChevronLeft size={18} />
            <span>Жор руу буцах</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-mango uppercase tracking-widest bg-mango/10 px-2.5 py-0.5 rounded-full">
                {recipe.cuisine || 'International'}
              </span>
              <span className="text-[10px] font-bold text-gray-400">
                • {recipe.difficulty} • {steps.length} Алхамтай
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-pestle-text mt-1">{recipe.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={toggleVoiceGuide}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
              isSpeaking
                ? 'bg-mango text-white border-mango animate-pulse'
                : 'bg-pestle-bg border-pestle-border text-pestle-text hover:border-mango'
            }`}
            title="Дуут зааварчлах"
          >
            {isSpeaking ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="hidden sm:inline">{isSpeaking ? 'Уншиж байна...' : 'Дуут заавар'}</span>
          </button>

          <div className="flex items-center gap-1.5 bg-pestle-bg border border-pestle-border px-3 py-2 rounded-xl text-xs font-bold text-pestle-text">
            <Clock size={15} className="text-mango" />
            <span>{recipe.time}</span>
          </div>
        </div>
      </header>

      {isCompleted ? (
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="py-14 text-center bg-pestle-card border border-pestle-border rounded-[32px] p-8 shadow-2xl space-y-5"
        >
          <div className="w-24 h-24 bg-mint/20 text-mint rounded-full flex items-center justify-center mx-auto shadow-xl animate-bounce">
            <Award size={54} />
          </div>
          <div className="space-y-2">
            <h3 className="text-3xl font-black text-pestle-text">Амжилттай бэлэн боллоо! 🎉</h3>
            <p className="text-sm text-gray-400 max-w-[320px] mx-auto leading-relaxed font-medium">
              Сайхан хооллоорой! Та masterclass түвшний хоолыг амжилттай хийж дуусгалаа. ✨
            </p>
          </div>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                setIsCompleted(false);
                setCurrentStep(0);
              }}
              className="btn-secondary py-3 px-5 text-xs font-bold cursor-pointer"
            >
              Дахин эхнээс нь үзэх
            </button>
            <button
              onClick={() => {
                setIsCompleted(false);
                setCurrentStep(0);
                setActiveTab('recipe');
              }}
              className="btn-primary py-3.5 px-7 text-xs font-bold shadow-lg shadow-mango/20 cursor-pointer flex items-center gap-1.5"
            >
              <ChevronLeft size={16} />
              <span>Жор руу буцах</span>
            </button>
            <button
              onClick={() => {
                setIsCompleted(false);
                setCurrentStep(0);
                setActiveTab('fridge');
              }}
              className="btn-secondary py-3 px-5 text-xs font-bold cursor-pointer"
            >
              Хөргөгч рүү буцах
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Step Timeline Pills */}
          <div className="bg-pestle-card border border-pestle-border p-3 rounded-2xl shadow-xs space-y-2">
            <div className="flex justify-between items-center text-xs font-bold px-1">
              <span className="text-pestle-text flex items-center gap-1.5">
                <Layers size={15} className="text-mango" />
                <span>Алхам {currentStep + 1} / {steps.length}</span>
              </span>
              <span className="text-mango font-black">
                {Math.round(((currentStep + 1) / steps.length) * 100)}% Гүйцэтгэл
              </span>
            </div>

            {/* Step Progress Line */}
            <div className="w-full bg-pestle-bg h-2 rounded-full border border-pestle-border overflow-hidden">
              <motion.div
                className="h-full bg-mango rounded-full"
                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Quick Step Selector Tabs */}
            <div className="flex gap-1.5 pt-1 overflow-x-auto no-scrollbar">
              {steps.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`flex-1 min-w-[36px] py-1.5 px-2 text-[11px] font-bold rounded-xl border transition-all cursor-pointer text-center truncate ${
                    idx === currentStep
                      ? 'bg-mango text-white border-mango shadow-sm scale-102'
                      : idx < currentStep
                      ? 'bg-mint/15 text-mint border-mint/30'
                      : 'bg-pestle-bg text-gray-400 border-pestle-border hover:border-gray-400'
                  }`}
                >
                  {idx + 1}. {s.title.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Current Step Detailed Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="bg-pestle-card border border-pestle-border rounded-[28px] p-5 sm:p-7 space-y-6 shadow-xl relative overflow-hidden"
            >
              {/* Step Image with Overlay Badges */}
              <div className="relative h-56 sm:h-72 rounded-2xl overflow-hidden border border-pestle-border shadow-inner">
                <img
                  src={step.image}
                  alt={step.title}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end text-white">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-mango px-2.5 py-0.5 rounded-full text-white shadow-md">
                      Алхам {currentStep + 1}
                    </span>
                    <h3 className="text-lg sm:text-2xl font-black text-white mt-1 drop-shadow-md">
                      {lang === 'mn' ? step.title : step.titleEn || step.title}
                    </h3>
                  </div>

                  {/* Heat Level Badge if specified */}
                  {step.heatLevel && (
                    <div className="bg-black/60 backdrop-blur-md border border-white/20 px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 text-amber-300">
                      <Flame size={14} className="text-amber-400" />
                      <span>{step.heatLevel} Heat</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed Description */}
              <div className="space-y-3">
                <p className="text-sm sm:text-base text-pestle-text leading-relaxed font-medium">
                  {lang === 'mn' ? step.description : step.descriptionEn || step.description}
                </p>

                {/* Step Ingredients & Tools Grid */}
                {((step.stepIngredients && step.stepIngredients.length > 0) ||
                  (step.toolsNeeded && step.toolsNeeded.length > 0)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* Step Ingredients Checklist */}
                    {step.stepIngredients && step.stepIngredients.length > 0 && (
                      <div className="bg-pestle-bg border border-pestle-border/80 p-3.5 rounded-2xl space-y-2">
                        <span className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                          <Utensils size={14} className="text-mango" />
                          <span>Энэ алхамд орох орцууд:</span>
                        </span>
                        <div className="space-y-1.5">
                          {step.stepIngredients.map((item, i) => {
                            const isChecked = checkedIngredients[item];
                            return (
                              <button
                                key={i}
                                onClick={() => toggleCheckIngredient(item)}
                                className={`w-full flex items-center gap-2 text-xs text-left p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isChecked
                                    ? 'line-through text-gray-400 bg-mint/10'
                                    : 'text-pestle-text hover:bg-pestle-card'
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare size={14} className="text-mint shrink-0" />
                                ) : (
                                  <Square size={14} className="text-gray-400 shrink-0" />
                                )}
                                <span>{item}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Tools Needed */}
                    {step.toolsNeeded && step.toolsNeeded.length > 0 && (
                      <div className="bg-pestle-bg border border-pestle-border/80 p-3.5 rounded-2xl space-y-2">
                        <span className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                          <Wrench size={14} className="text-amber-500" />
                          <span>Ашиглах багаж:</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {step.toolsNeeded.map((tool, i) => (
                            <span
                              key={i}
                              className="text-[11px] font-semibold bg-pestle-card border border-pestle-border px-2.5 py-1 rounded-xl text-pestle-text"
                            >
                              🛠️ {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Interactive Step Timer (if specified for this step) */}
              {step.timerMinutes && (
                <div className="bg-gradient-to-r from-mango/15 via-amber-500/10 to-transparent border border-mango/30 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-mango text-white flex items-center justify-center font-black text-lg shadow-md">
                      <Clock size={24} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-mango">
                        Алхмын Цаг Хэмжигч
                      </span>
                      <h4 className="text-2xl font-black text-pestle-text font-mono">
                        {formatTimer(timerSeconds)}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsTimerRunning(!isTimerRunning)}
                      className="btn-primary p-3 rounded-xl shadow-md shadow-mango/20 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    >
                      {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
                      <span>{isTimerRunning ? 'Зогсоох' : 'Эхлүүлэх'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsTimerRunning(false);
                        setTimerSeconds(step.timerMinutes! * 60);
                      }}
                      className="bg-pestle-bg border border-pestle-border p-3 rounded-xl text-pestle-text hover:border-mango transition-all cursor-pointer"
                      title="Шинэчлэх"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* AI Sister Pro Tip Card */}
              <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/25 p-4 rounded-2xl space-y-1.5 shadow-xs">
                <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Sparkles size={16} /> {t('sisterTip')}
                </span>
                <p className="text-xs sm:text-sm text-pestle-text leading-relaxed font-semibold">
                  {lang === 'mn' ? step.sisterTip : step.sisterTipEn || step.sisterTip}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex gap-3 pt-2">
            <button
              disabled={currentStep === 0}
              onClick={handlePrev}
              className="btn-secondary flex-1 py-4 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft size={18} />
              <span>{t('prevStep')}</span>
            </button>
            <button
              onClick={handleNext}
              className="btn-primary flex-1 py-4 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-mango/25 cursor-pointer"
            >
              <span>{currentStep === steps.length - 1 ? t('finishCooking') : t('nextStep')}</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
