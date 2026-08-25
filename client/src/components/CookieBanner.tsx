import React, { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { ShieldCheck, Cookie, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useScrollLock } from '../hooks/useScrollLock';

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

  useEscapeClose(() => setShowModal(null), showModal !== null);
  useScrollLock(showModal !== null);

  const handleAccept = () => {
    localStorage.setItem('zity_cookie_consent', 'true');
    setShowBanner(false);
  };

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <m.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            // Mobile: sits ABOVE the floating assistant bubble (which anchors
            // at 4.75rem); desktop: bottom-left, away from the assistant's
            // bottom-right corner. It used to share the assistant's exact spot
            // with a higher z-index, hiding the button until dismissed.
            className="fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 md:bottom-4 md:left-6 md:right-auto md:max-w-md z-[180] bg-pestle-card/95 backdrop-blur-xl border border-pestle-border p-2 sm:p-4 rounded-2xl shadow-2xl flex flex-col gap-2 sm:gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="hidden sm:flex w-10 h-10 bg-mango/15 text-mango-ink rounded-2xl items-center justify-center shrink-0">
                <Cookie size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-pestle-text flex items-center gap-1.5 pr-6">
                  <ShieldCheck size={14} className="text-emerald-700 dark:text-emerald-400" /> GDPR
                  & Cookie Notice
                </h4>
                <p className="hidden sm:block text-[11px] text-gray-500 font-medium mt-1 leading-relaxed line-clamp-2">
                  {t('cookieNotice')}
                </p>
                <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-mango-ink mt-1 -ml-1.5">
                  <button
                    onClick={() => setShowModal('privacy')}
                    className="hover:underline px-1.5 py-1.5 rounded-md"
                  >
                    {t('privacyPolicy')}
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => setShowModal('terms')}
                    className="hover:underline px-1.5 py-1.5 rounded-md"
                  >
                    {t('termsOfService')}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowBanner(false)}
                className="absolute right-2 top-2 w-9 h-9 rounded-full bg-pestle-bg border border-pestle-border text-gray-400 hover:text-pestle-text flex items-center justify-center"
                aria-label={t('close')}
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAccept}
                className="flex-1 bg-mango text-white text-xs font-bold py-2 sm:py-2 rounded-xl hover:opacity-90 transition-opacity shadow-xs"
              >
                {t('acceptCookies')}
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="px-3 py-2 bg-pestle-bg border border-pestle-border text-gray-400 hover:text-pestle-text text-xs font-bold rounded-xl transition-colors"
              >
                {t('declineCookies')}
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Terms & Privacy Modal */}
      <AnimatePresence>
        {showModal && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(null)}
            role="dialog"
            aria-modal="true"
            aria-label={showModal === 'privacy' ? t('privacyPolicy') : t('termsOfService')}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[210] flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <m.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-pestle-card border border-pestle-border w-full max-w-lg rounded-t-[32px] sm:rounded-3xl p-6 pb-sheet-safe sm:pb-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto overscroll-contain"
            >
              <div className="flex justify-between items-center border-b border-pestle-border pb-3">
                <h3 className="text-base font-black text-pestle-text">
                  {showModal === 'privacy' ? t('privacyPolicy') : t('termsOfService')}
                </h3>
                <button
                  onClick={() => setShowModal(null)}
                  aria-label={t('close')}
                  className="w-8 h-8 rounded-full bg-pestle-bg text-gray-400 hover:text-pestle-text flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Two distinct documents. The body used to render the privacy
                  text under both headings — the Terms link opened the wrong
                  document entirely, in English, in an otherwise Mongolian app. */}
              <div className="text-xs text-pestle-text space-y-3 font-medium leading-relaxed">
                {showModal === 'privacy' ? (
                  <>
                    <p>{t('legal_privacyIntro')}</p>
                    <h4 className="font-bold text-mango-ink">{t('legal_privacyH1')}</h4>
                    <p>{t('legal_privacyP1')}</p>
                    <h4 className="font-bold text-mango-ink">{t('legal_privacyH2')}</h4>
                    <p>{t('legal_privacyP2')}</p>
                    <h4 className="font-bold text-mango-ink">{t('legal_privacyH3')}</h4>
                    <p>{t('legal_privacyP3')}</p>
                  </>
                ) : (
                  <>
                    <p>{t('legal_termsIntro')}</p>
                    <h4 className="font-bold text-mango-ink">{t('legal_termsH1')}</h4>
                    <p>{t('legal_termsP1')}</p>
                    <h4 className="font-bold text-mango-ink">{t('legal_termsH2')}</h4>
                    <p>{t('legal_termsP2')}</p>
                    <h4 className="font-bold text-mango-ink">{t('legal_termsH3')}</h4>
                    <p>{t('legal_termsP3')}</p>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowModal(null)}
                className="w-full btn-primary py-2.5 text-xs font-bold mt-4"
              >
                {t('close')}
              </button>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
};
