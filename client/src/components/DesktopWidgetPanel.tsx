import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShoppingBag,
  Flame,
  Send,
  CheckCircle2,
  Mic,
  Droplets,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSisterAdvice, getServerHealth } from '../services/geminiService';
import { MOCK_RECIPES } from '../data/recipes';

export const DesktopWidgetPanel: React.FC = () => {
  const {
    lang,
    inventory,
    cart,
    totalCartAmount,
    triggerPayment,
    createOrder,
    setActiveCookingRecipe,
    setActiveTab,
    t,
  } = useApp();
  const [healthData, setHealthData] = useState<any>(null);
  const [inputVal, setInputVal] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);

  // Nutrition state
  const [calories, setCalories] = useState<number>(520);
  const [waterGlasses, setWaterGlasses] = useState<number>(4);

  const [chatLog, setChatLog] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    { role: 'assistant', text: t('aiInitialGreeting') },
  ]);

  useEffect(() => {
    getServerHealth().then((data) => setHealthData(data));
  }, []);

  const handleSendText = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;
    const msg = textToSend.trim();
    setChatLog((prev) => [...prev, { role: 'user', text: msg }]);
    setInputVal('');
    setLoading(true);

    const reply = await getSisterAdvice(msg, inventory, lang);
    const actionMatch = reply.match(/\[ACTION: OPEN_COOKING_MODE, RECIPE_ID: '(.*?)'\]/);

    if (actionMatch) {
      const recipeId = actionMatch[1];
      const clean = reply.replace(/\[ACTION: .*?\]/, '').trim();
      setChatLog((prev) => [...prev, { role: 'assistant', text: clean }]);
      const target = MOCK_RECIPES.find((r) => r.id === recipeId) || MOCK_RECIPES[0];
      setActiveCookingRecipe(target);
      setActiveTab('cooking');
    } else {
      setChatLog((prev) => [...prev, { role: 'assistant', text: reply }]);
    }
    setLoading(false);
  };

  const handleMicClick = () => {
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      handleSendText(t('widget_promptMic'));
    }, 2000);
  };

  return (
    <aside className="hidden xl:flex flex-col w-80 bg-pestle-card border-l border-pestle-border p-6 justify-between shrink-0 h-full overflow-y-auto shadow-sm z-30 space-y-5">
      {/* Top AI Assistant Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-mango/15 text-mango flex items-center justify-center font-bold text-sm shadow-sm">
              👩‍🍳
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-pestle-text">{t('assistantName')}</h3>
              <p className="text-[10px] text-mint font-bold">Gemini 3 Flash • {t('online')}</p>
            </div>
          </div>
          <span className="text-[9px] bg-mint/15 text-mint font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles size={10} /> {t('widget_active')}
          </span>
        </div>

        {/* Chat Messages Box */}
        <div className="bg-pestle-bg border border-pestle-border/60 rounded-2xl p-3 h-52 overflow-y-auto space-y-2 no-scrollbar">
          {chatLog.map((m, i) => (
            <div
              key={i}
              className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                m.role === 'assistant'
                  ? 'bg-pestle-card border border-pestle-border text-pestle-text'
                  : 'bg-mango text-white font-medium ml-4'
              }`}
            >
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="text-[10px] text-mango font-bold animate-pulse p-2">
              ✨ {t('widget_preparing')}
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => handleSendText(t('widget_promptExpiring'))}
            className="text-[10px] font-bold bg-pestle-bg border border-pestle-border px-2.5 py-1 rounded-lg text-gray-500 hover:text-mango hover:border-mango transition-colors whitespace-nowrap"
          >
            💡 {t('widget_chipExpiring')}
          </button>
          <button
            onClick={() => handleSendText(t('widget_promptBreakfast'))}
            className="text-[10px] font-bold bg-pestle-bg border border-pestle-border px-2.5 py-1 rounded-lg text-gray-500 hover:text-mango hover:border-mango transition-colors whitespace-nowrap"
          >
            ⚡ {t('widget_chipBreakfast')}
          </button>
        </div>

        {/* Input Controls with Voice Support */}
        <div className="flex gap-1.5">
          <button
            onClick={handleMicClick}
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
              isListening
                ? 'bg-red-500 text-white border-red-500 animate-pulse'
                : 'bg-pestle-bg border-pestle-border text-gray-400 hover:text-mango'
            }`}
            title={t('widget_micTitle')}
          >
            <Mic size={15} />
          </button>

          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText(inputVal)}
            aria-label={t('placeholderMsg')}
            placeholder={t('placeholderMsg')}
            className="flex-1 bg-pestle-bg border border-pestle-border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-mango text-pestle-text"
          />

          <button
            onClick={() => handleSendText(inputVal)}
            disabled={loading}
            className="bg-mango text-white w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-transform shrink-0 shadow-sm"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* Daily Nutrition & Water Tracker Widget */}
      <div className="bg-pestle-bg border border-pestle-border rounded-2xl p-3.5 space-y-3">
        <div className="flex justify-between items-center text-xs font-bold">
          <span className="text-pestle-text flex items-center gap-1.5">
            <Flame size={14} className="text-mango" /> {t('calories')}
          </span>
          <span className="text-mango font-black">{calories} / 2,000 kcal</span>
        </div>
        <div className="w-full bg-pestle-card h-2 rounded-full border border-pestle-border overflow-hidden">
          <div
            className="bg-mango h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (calories / 2000) * 100)}%` }}
          />
        </div>

        {/* Water Tracker */}
        <div className="pt-2 border-t border-pestle-border/60 flex items-center justify-between text-xs">
          <span className="font-bold text-pestle-text flex items-center gap-1">
            <Droplets size={14} className="text-sky-500" /> {t('widget_water')}:{' '}
            <strong className="text-sky-500">{waterGlasses * 250}ml</strong>
          </span>
          <button
            onClick={() => setWaterGlasses((prev) => prev + 1)}
            className="text-[10px] font-bold bg-sky-500/10 text-sky-500 border border-sky-500/20 px-2 py-0.5 rounded-lg hover:bg-sky-500 hover:text-white transition-colors"
          >
            +250ml
          </button>
        </div>

        <div className="grid grid-cols-3 text-center text-[10px] text-gray-400 font-bold pt-1 border-t border-pestle-border/40">
          <div>
            {t('widget_protein')}: <span className="text-pestle-text">42g</span>
          </div>
          <div>
            {t('widget_carbs')}: <span className="text-pestle-text">68g</span>
          </div>
          <div>
            {t('widget_fat')}: <span className="text-pestle-text">18g</span>
          </div>
        </div>
      </div>

      {/* Cart Quick Summary Widget */}
      {cart.length > 0 && (
        <div className="bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border border-teal-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-teal-600" /> {t('widget_cart', { n: cart.length })}
            </span>
            <span className="text-xs font-black text-mango">
              ₮{totalCartAmount.toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => {
              triggerPayment(totalCartAmount, 'Quick Grocery Store Delivery', () => {
                createOrder('Zity Tower 402', 'qpay');
              });
            }}
            className="w-full bg-teal-600 text-white text-xs font-bold py-2.5 rounded-xl shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-colors"
          >
            {t('widget_qpayOrder')}
          </button>
        </div>
      )}

      {/* System Health / Cache Savings Badge — reflects the real health check */}
      <div className="pt-2 border-t border-pestle-border/60 flex items-center justify-between text-[10px] text-gray-400 font-bold">
        <span className={`flex items-center gap-1 ${healthData ? 'text-mint' : 'text-gray-400'}`}>
          <CheckCircle2 size={12} /> {healthData ? t('widget_connected') : t('widget_connecting')}
        </span>
        {healthData?.cache?.totalCacheHits > 0 && (
          <span className="text-mango">Cache hits: {healthData.cache.totalCacheHits}</span>
        )}
      </div>
    </aside>
  );
};
