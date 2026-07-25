import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Check, Crown, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SubscriptionModal: React.FC = () => {
  const { showSubModal, setShowSubModal, subscription, setSubscription, triggerPayment, t } =
    useApp();

  if (!showSubModal) return null;

  const handleUpgrade = (tier: 'pro' | 'family', price: number, title: string) => {
    triggerPayment(price, title, () => {
      setSubscription(tier);
    });
    setShowSubModal(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[190] flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: '100%', opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: '100%', opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 25, stiffness: 240 }}
          className="bg-pestle-card border border-pestle-border/80 w-full max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl p-6 overflow-y-auto max-h-[90vh] relative"
        >
          {/* Mobile Bottom-Sheet Pull Bar */}
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-mango bg-mango/15 px-2.5 py-1 rounded-full flex items-center gap-1 w-max mb-1">
                <Sparkles size={12} /> Zity Premium Tiers
              </span>
              <h2 className="text-2xl font-bold text-pestle-text">Гишүүнчлэлийн багцууд</h2>
            </div>
            <button onClick={() => setShowSubModal(false)} className="modal-close-btn">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Free Tier */}
            <div
              className={`p-5 rounded-2xl border transition-all ${subscription === 'free' ? 'border-mango bg-mango/5' : 'border-pestle-border bg-pestle-bg'}`}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-base text-pestle-text flex items-center gap-2">
                  {t('subFree')}
                </h3>
                <span className="text-xs font-bold text-gray-400">₮0 / Үнэгүй</span>
              </div>
              <ul className="text-xs text-gray-500 space-y-1.5 mb-3">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-mint" /> Өдөрт 3 удаа AI Эгчээс зөвлөгөө авах
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-mint" /> Хөргөгчний орцууд бүртгэх
                </li>
              </ul>
              {subscription === 'free' && (
                <span className="text-[11px] font-bold text-mango bg-mango/10 px-3 py-1 rounded-lg block text-center">
                  Одоо ашиглаж буй багц
                </span>
              )}
            </div>

            {/* Pro Chef Tier */}
            <div
              className={`p-5 rounded-2xl border relative overflow-hidden transition-all ${subscription === 'pro' ? 'border-mango bg-mango/10 shadow-lg' : 'border-amber-400/50 bg-gradient-to-br from-amber-500/5 to-orange-500/10'}`}
            >
              <div className="absolute top-0 right-0 bg-gradient-to-l from-mango to-amber-500 text-white text-[9px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                Most Popular
              </div>

              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-md">
                  <Crown size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-pestle-text">{t('subPro')}</h3>
                  <span className="text-sm font-extrabold text-mango">{t('subPricePro')}</span>
                </div>
              </div>

              <ul className="text-xs text-pestle-text space-y-2 my-4">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-mango" /> {t('proFeature1')}
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-mango" /> {t('proFeature2')}
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-mango" /> {t('proFeature3')}
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-mango" /> {t('proFeature4')}
                </li>
              </ul>

              {subscription === 'pro' ? (
                <span className="text-[11px] font-bold text-mint bg-mint/10 px-3 py-2 rounded-xl block text-center border border-mint/20">
                  Одоо ашиглаж буй PRO багц ✨
                </span>
              ) : (
                <button
                  onClick={() => handleUpgrade('pro', 14900, 'Zity Pro Chef Membership')}
                  className="w-full btn-primary py-3 font-bold flex items-center justify-center gap-2 shadow-lg shadow-mango/20"
                >
                  <Sparkles size={16} />
                  <span>Pro Chef-ээр идэвхжүүлэх (₮14,900)</span>
                </button>
              )}
            </div>

            {/* Family Plan Tier */}
            <div
              className={`p-5 rounded-2xl border transition-all ${subscription === 'family' ? 'border-teal-500 bg-teal-500/10' : 'border-pestle-border bg-pestle-bg'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-teal-500 text-white rounded-xl flex items-center justify-center shadow-md">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-pestle-text">{t('subFamily')}</h3>
                  <span className="text-sm font-extrabold text-teal-600 dark:text-teal-400">
                    {t('subPriceFamily')}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Гэр бүлийн 5 хүртэл гишүүн хамтран хөргөгчөө удирдаж, худалдан авалтын жагсаалт синк
                хийнэ.
              </p>

              {subscription === 'family' ? (
                <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-3 py-2 rounded-xl block text-center">
                  Одоо ашиглаж буй Family багц
                </span>
              ) : (
                <button
                  onClick={() => handleUpgrade('family', 29900, 'Zity Family Plan Membership')}
                  className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-md shadow-teal-500/20"
                >
                  <Users size={16} />
                  <span>Family Багц Сонгох (₮29,900)</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
