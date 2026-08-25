import React, { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { X, Scan, Camera, Upload, CheckCircle2, Loader2, Sparkles, Plus } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useApp } from '../context/AppContext';
import { useToast } from './Toast';
import { parseReceiptImage } from '../services/geminiService';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useScrollLock } from '../hooks/useScrollLock';
import { Ingredient } from '../types';

export const ReceiptScannerModal: React.FC = () => {
  const { showScanModal, setShowScanModal, addIngredient, t } = useApp();
  const { toastSuccess, toastError } = useToast();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [detectedItems, setDetectedItems] = useState<Partial<Ingredient>[]>([]);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [scanFailed, setScanFailed] = useState<boolean>(false);

  const handleClose = () => {
    setShowScanModal(false);
    setSelectedImage(null);
    setDetectedItems([]);
    setScanFailed(false);
  };

  useEscapeClose(handleClose, showScanModal && !isAnalyzing);
  useScrollLock(showScanModal);

  const dialogRef = useFocusTrap<HTMLDivElement>(showScanModal);

  if (!showScanModal) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setSelectedImage(reader.result as string);
      setScanFailed(false);

      // Start OCR. A failure used to come back as two invented ingredients,
      // which the user then added to their fridge believing they were scanned.
      setIsAnalyzing(true);
      try {
        const items = await parseReceiptImage(base64, file.type || 'image/jpeg');
        setDetectedItems(items);
        // An empty result rendered no branch at all — the user was left
        // staring at the preview with nothing to read and nothing to press.
        if (items.length === 0) {
          setScanFailed(true);
          toastError(t('scan_emptyTitle'), t('scan_emptyBody'));
        }
      } catch {
        setScanFailed(true);
        toastError(t('scan_failedTitle'), t('scan_failedBody'));
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddAllDetected = () => {
    detectedItems.forEach((item) => addIngredient(item));
    setIsDone(true);
    toastSuccess(t('scan_toastTitle', { n: detectedItems.length }), t('scan_toastBody'));
    setTimeout(() => {
      setIsDone(false);
      setSelectedImage(null);
      setDetectedItems([]);
      setShowScanModal(false);
    }, 1200);
  };

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => {
          if (!isAnalyzing) handleClose();
        }}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('scanReceipt')}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[180] flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        <m.div
          initial={{ y: '100%', opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: '100%', opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 25, stiffness: 240 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-pestle-card border border-pestle-border/80 w-full max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl p-5 sm:p-6 pb-sheet-safe sm:pb-6 overflow-y-auto overscroll-contain max-h-[92dvh] relative"
        >
          {/* Mobile Bottom-Sheet Pull Bar */}
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
          {/* Header */}
          <div className="flex justify-between items-start gap-3 mb-6">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-mint-ink bg-mint/15 px-2.5 py-1 rounded-full inline-flex items-center gap-1 max-w-full mb-1">
                <Sparkles size={12} className="shrink-0" />
                <span className="truncate">{t('scanner_engineLabel')}</span>
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-pestle-text">{t('scanReceipt')}</h2>
            </div>
            <button
              onClick={handleClose}
              aria-label={t('close')}
              className="modal-close-btn shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {isDone ? (
            <div className="py-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-mint/20 text-mint-ink rounded-full flex items-center justify-center mb-4 animate-bounce">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-xl font-bold text-pestle-text mb-1">{t('scan_addedSuccess')}</h3>
              <p className="text-xs text-gray-400">{t('scan_fridgeUpdated')}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {!selectedImage ? (
                <div className="flex flex-col gap-3">
                  <label className="border-2 border-dashed border-pestle-border rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-mango transition-colors bg-pestle-bg">
                    <div className="w-14 h-14 bg-mango/10 text-mango-ink rounded-2xl flex items-center justify-center">
                      <Camera size={28} />
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-bold text-pestle-text block">
                        {t('scan_uploadTitle')}
                      </span>
                      <span className="text-[11px] text-gray-400">{t('scan_uploadHint')}</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Preview Image */}
                  <div className="h-44 rounded-2xl overflow-hidden relative border border-pestle-border">
                    <img
                      src={selectedImage}
                      alt={t('scanner_receiptAlt')}
                      className="w-full h-full object-cover"
                    />
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4">
                        <Loader2 size={32} className="animate-spin text-mango-ink mb-2" />
                        <span className="text-xs font-bold">{t('scan_analyzing')}</span>
                      </div>
                    )}
                  </div>

                  {!isAnalyzing && scanFailed && (
                    <div className="text-center space-y-2 py-2">
                      <p className="text-xs font-bold text-pestle-text">{t('scan_failedTitle')}</p>
                      <p className="text-[11px] text-gray-400">{t('scan_failedBody')}</p>
                      <button
                        onClick={() => {
                          setSelectedImage(null);
                          setScanFailed(false);
                        }}
                        className="text-xs font-bold px-4 py-2 rounded-xl shadow-md on-accent"
                      >
                        {t('fridge_retry')}
                      </button>
                    </div>
                  )}

                  {/* Detected items list */}
                  {!isAnalyzing && detectedItems.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-pestle-text">
                          {t('scan_detectedItems', { n: detectedItems.length })}
                        </span>
                        <span className="text-[10px] text-mint-ink font-bold uppercase tracking-wider">
                          {t('scanner_autoCategorized')}
                        </span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {detectedItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-pestle-bg border border-pestle-border p-3 rounded-xl flex justify-between items-center gap-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xl shrink-0">
                                {item.category?.split(' ')[0] || '📦'}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-pestle-text truncate">
                                  {item.name}
                                </h4>
                                <span className="text-[10px] text-gray-400">
                                  {t('scan_expiryLabel', { n: item.expiryDays ?? 0 })}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-mono font-bold text-mango-ink shrink-0">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleAddAllDetected}
                        className="w-full btn-primary py-3.5 mt-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-mango/20"
                      >
                        <Plus size={18} />
                        <span>{t('scan_addAll', { n: detectedItems.length })}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </m.div>
      </m.div>
    </AnimatePresence>
  );
};
