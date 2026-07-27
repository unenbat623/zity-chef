import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Scan, Camera, Upload, CheckCircle2, Loader2, Sparkles, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from './Toast';
import { parseReceiptImage } from '../services/geminiService';
import { Ingredient } from '../types';

export const ReceiptScannerModal: React.FC = () => {
  const { showScanModal, setShowScanModal, addIngredient, t } = useApp();
  const { toastSuccess } = useToast();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [detectedItems, setDetectedItems] = useState<Partial<Ingredient>[]>([]);
  const [isDone, setIsDone] = useState<boolean>(false);

  if (!showScanModal) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setSelectedImage(reader.result as string);

      // Start OCR
      setIsAnalyzing(true);
      const items = await parseReceiptImage(base64, file.type || 'image/jpeg');
      setDetectedItems(items);
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSimulatePresetSample = async () => {
    // Demo sample receipt image
    setSelectedImage(
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'
    );
    setIsAnalyzing(true);
    setTimeout(() => {
      setDetectedItems([
        {
          name: 'Шинэ Сүү 1L',
          category: '🥛 Сүү, өндөг',
          quantity: 1,
          unit: 'л',
          expiryDays: 4,
          pricePerUnit: 3900,
        },
        {
          name: 'Үхрийн Гуяны Мах',
          category: '🥩 Мах',
          quantity: 800,
          unit: 'гр',
          expiryDays: 3,
          pricePerUnit: 24000,
        },
        {
          name: 'Шинэхэн Банан',
          category: '🍎 Жимс',
          quantity: 6,
          unit: 'ш',
          expiryDays: 5,
          pricePerUnit: 8900,
        },
        {
          name: 'Сонгино',
          category: '🥦 Ногоо',
          quantity: 500,
          unit: 'гр',
          expiryDays: 14,
          pricePerUnit: 2200,
        },
      ]);
      setIsAnalyzing(false);
    }, 1500);
  };

  const handleAddAllDetected = () => {
    detectedItems.forEach((item) => addIngredient(item));
    setIsDone(true);
    toastSuccess(
      `${detectedItems.length} орц нэмэгдлээ! 🎉`,
      'Хөргөгчийн жагсаалт амжилттай шинэчлэгдлээ.'
    );
    setTimeout(() => {
      setIsDone(false);
      setSelectedImage(null);
      setDetectedItems([]);
      setShowScanModal(false);
    }, 1200);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[180] flex items-end sm:items-center justify-center p-0 sm:p-4"
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
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-mint bg-mint/15 px-2.5 py-1 rounded-full flex items-center gap-1 w-max mb-1">
                <Sparkles size={12} /> Gemini Vision AI Scanner
              </span>
              <h2 className="text-xl font-bold text-pestle-text">{t('scanReceipt')}</h2>
            </div>
            <button
              onClick={() => {
                setShowScanModal(false);
                setSelectedImage(null);
                setDetectedItems([]);
              }}
              className="modal-close-btn"
            >
              <X size={18} />
            </button>
          </div>

          {isDone ? (
            <div className="py-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-mint/20 text-mint rounded-full flex items-center justify-center mb-4 animate-bounce">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-xl font-bold text-pestle-text mb-1">
                Материал амжилттай нэмэгдлээ!
              </h3>
              <p className="text-xs text-gray-400">Хөргөгчний жагсаалт шинэчлэгдлээ</p>
            </div>
          ) : (
            <div className="space-y-5">
              {!selectedImage ? (
                <div className="flex flex-col gap-3">
                  <label className="border-2 border-dashed border-pestle-border rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-mango transition-colors bg-pestle-bg">
                    <div className="w-14 h-14 bg-mango/10 text-mango rounded-2xl flex items-center justify-center">
                      <Camera size={28} />
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-bold text-pestle-text block">
                        Зураг эсвэл баримт оруулах
                      </span>
                      <span className="text-[11px] text-gray-400">
                        PNG, JPG эсвэл Камераар дарах
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={handleSimulatePresetSample}
                    className="w-full bg-pestle-bg border border-pestle-border py-3 rounded-xl text-xs font-bold text-mango hover:bg-mango/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles size={16} />
                    <span>Демо баримтаар туршиж үзэх</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Preview Image */}
                  <div className="h-44 rounded-2xl overflow-hidden relative border border-pestle-border">
                    <img src={selectedImage} alt="Receipt" className="w-full h-full object-cover" />
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4">
                        <Loader2 size={32} className="animate-spin text-mango mb-2" />
                        <span className="text-xs font-bold">Gemini AI уншиж байна...</span>
                      </div>
                    )}
                  </div>

                  {/* Detected items list */}
                  {!isAnalyzing && detectedItems.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-pestle-text">
                          Илрүүлсэн орцууд ({detectedItems.length})
                        </span>
                        <span className="text-[10px] text-mint font-bold uppercase tracking-wider">
                          Auto-Categorized
                        </span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {detectedItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-pestle-bg border border-pestle-border p-3 rounded-xl flex justify-between items-center"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">
                                {item.category?.split(' ')[0] || '📦'}
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-pestle-text">{item.name}</h4>
                                <span className="text-[10px] text-gray-400">
                                  Хугацаа: {item.expiryDays} хоног
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-mono font-bold text-mango">
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
                        <span>Бүх орцыг хөргөгчинд нэмэх ({detectedItems.length})</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
