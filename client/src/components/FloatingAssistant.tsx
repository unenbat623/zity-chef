import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, ChevronRight, Sparkles, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSisterAdvice } from '../services/geminiService';
import { MOCK_RECIPES } from '../constants';

export const FloatingAssistant: React.FC = () => {
  const { lang, inventory, setActiveCookingRecipe, setActiveTab, t } = useApp();
  const [showBubble, setShowBubble] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    { role: 'assistant', text: t('aiInitialGreeting') },
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowBubble(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInputValue('');
    setIsLoading(true);

    const response = await getSisterAdvice(userMsg, inventory, lang);

    // Check for action code
    const actionMatch = response.match(/\[ACTION: OPEN_COOKING_MODE, RECIPE_ID: '(.*?)'\]/);
    if (actionMatch) {
      const recipeId = actionMatch[1];
      const cleanResponse = response.replace(/\[ACTION: .*?\]/, '').trim();
      setMessages((prev) => [...prev, { role: 'assistant', text: cleanResponse }]);

      const targetRecipe = MOCK_RECIPES.find((r) => r.id === recipeId) || MOCK_RECIPES[0];
      setTimeout(() => {
        setActiveCookingRecipe(targetRecipe);
        setActiveTab('cooking');
        setIsOpen(false);
      }, 1500);
    } else {
      setMessages((prev) => [...prev, { role: 'assistant', text: response }]);
    }

    setIsLoading(false);
  };

  return (
    <>
      {/* Floating Trigger Button & Greeting Bubble */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 right-3 sm:right-5 z-40 flex flex-col items-end gap-2 pointer-events-none">
        <AnimatePresence>
          {showBubble && !isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-pestle-card p-2.5 pr-5 rounded-2xl shadow-xl border border-pestle-border max-w-[170px] relative pointer-events-auto"
            >
              <button
                onClick={() => setShowBubble(false)}
                className="absolute top-1 right-1 p-0.5 text-gray-400 hover:text-pestle-text transition-colors"
              >
                <X size={10} />
              </button>
              <p className="text-[11px] font-semibold leading-tight text-pestle-text">
                {lang === 'mn'
                  ? 'Сайн уу! Zity Тогоочоос зөвлөгөө авах уу? ✨'
                  : 'Hello! Need chef tips today? ✨'}
              </p>
              <div className="absolute -bottom-1 right-4 w-2.5 h-2.5 bg-pestle-card border-r border-b border-pestle-border rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-12 h-12 sm:w-14 sm:h-14 bg-mango rounded-full shadow-xl flex items-center justify-center text-white active:scale-90 transition-transform pointer-events-auto border-2 border-white dark:border-slate-900 cursor-pointer"
        >
          {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        </motion.button>
      </div>

      {/* Floating Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-24 right-3 left-3 sm:left-auto sm:right-6 sm:w-84 bg-pestle-card border border-pestle-border rounded-[28px] shadow-2xl z-[150] overflow-hidden flex flex-col h-[420px] max-h-[68vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-mango to-amber-500 p-3.5 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-bold text-base">
                  👨‍🍳
                </div>
                <div>
                  <p className="font-extrabold text-xs sm:text-sm flex items-center gap-1.5">
                    {t('assistantName')} <Sparkles size={13} className="text-amber-200" />
                  </p>
                  <p className="text-[9px] text-white/80 font-medium">
                    Gemini 3 Flash • {t('online')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Chat Body */}
            <div className="p-3.5 flex-1 overflow-y-auto flex flex-col gap-3 bg-pestle-bg/50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`${
                    msg.role === 'assistant'
                      ? 'bg-pestle-card border border-pestle-border rounded-2xl rounded-tl-none self-start text-pestle-text'
                      : 'bg-mango text-white rounded-2xl rounded-tr-none self-end font-medium'
                  } p-3 max-w-[85%] shadow-xs`}
                >
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              ))}

              {isLoading && (
                <div className="bg-pestle-card border border-pestle-border p-3 rounded-2xl rounded-tl-none self-start shadow-xs flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-mango rounded-full animate-ping" />
                  <span className="text-[11px] font-bold text-gray-400">Zity Тогооч бодож байна...</span>
                </div>
              )}
            </div>

            {/* Input Box */}
            <div className="p-3 border-t border-pestle-border flex gap-2 shrink-0 bg-pestle-card">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('placeholderMsg')}
                className="flex-1 bg-pestle-bg border border-pestle-border rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-mango transition-colors text-pestle-text"
              />
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="w-9 h-9 bg-mango text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 shadow-xs cursor-pointer shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
