import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Cookie, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const CookieBanner: React.FC = () => {
  const { t } = useApp();
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<'privacy' | 'terms' | null>(null);

  useEffect(() => {
    const accepted = localStorage.getItem('zity_cookie_consent');
    if (!accepted) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('zity_cookie_consent', 'true');
    setShowBanner(false);
  };

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[180] bg-pestle-card/90 backdrop-blur-xl border border-pestle-border p-4 rounded-3xl shadow-2xl flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-mango/15 text-mango rounded-2xl flex items-center justify-center shrink-0">
                <Cookie size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-pestle-text flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" /> GDPR & Cookie Notice
                </h4>
                <p className="text-[11px] text-gray-500 font-medium mt-1 leading-relaxed">
                  {t('cookieNotice')}
                </p>
                <div className="flex gap-3 text-[10px] font-bold text-mango mt-1">
                  <button onClick={() => setShowModal('privacy')} className="hover:underline">
                    {t('privacyPolicy')}
                  </button>
                  <span>•</span>
                  <button onClick={() => setShowModal('terms')} className="hover:underline">
                    {t('termsOfService')}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAccept}
                className="flex-1 bg-mango text-white text-xs font-bold py-2 rounded-xl hover:opacity-90 transition-opacity shadow-xs"
              >
                {t('acceptCookies')}
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="px-3 bg-pestle-bg border border-pestle-border text-gray-400 hover:text-pestle-text text-xs font-bold rounded-xl transition-colors"
              >
                {t('declineCookies')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terms & Privacy Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[210] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-pestle-card border border-pestle-border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-pestle-border pb-3">
                <h3 className="text-base font-black text-pestle-text">
                  {showModal === 'privacy' ? t('privacyPolicy') : t('termsOfService')}
                </h3>
                <button
                  onClick={() => setShowModal(null)}
                  className="w-8 h-8 rounded-full bg-pestle-bg text-gray-400 hover:text-pestle-text flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="text-xs text-pestle-text space-y-3 font-medium leading-relaxed">
                <p>
                  Welcome to Zity Chef! We are committed to protecting your privacy and ensuring your personal data is handled safely in compliance with international standards (GDPR, CCPA).
                </p>
                <h4 className="font-bold text-mango">1. Data Collection</h4>
                <p>
                  We only store essential data (pantry items, meal plans, and account preferences) to provide intelligent culinary recommendations.
                </p>
                <h4 className="font-bold text-mango">2. AI & Data Security</h4>
                <p>
                  All vision receipt scans and AI chat queries are processed securely via encrypted proxies. We do not sell your personal data to third parties.
                </p>
              </div>

              <button
                onClick={() => setShowModal(null)}
                className="w-full btn-primary py-2.5 text-xs font-bold mt-4"
              >
                {t('close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
