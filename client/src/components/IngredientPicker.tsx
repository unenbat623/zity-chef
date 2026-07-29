import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Minus,
  Scan,
  Search,
  Camera,
  Upload,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATEGORIES, MOCK_INGREDIENTS } from '../constants';
import { Category, Ingredient } from '../types';
import { formatQuantity } from '../lib/utils';
import { SmartImage } from './SmartImage';
import { getIngredientImageUrl } from '../lib/imageService';

export const IngredientPicker: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addIngredient, setShowScanModal, t } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState<number>(100);
  const [unit, setUnit] = useState<'гр' | 'л' | 'ш'>('гр');

  // Custom ingredient form state
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<Category>(CATEGORIES[0]);
  const [customExpiryDays, setCustomExpiryDays] = useState<number>(7);
  const [customImageBase64, setCustomImageBase64] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredItems = MOCK_INGREDIENTS.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmAdd = () => {
    if (!selectedIngredient) return;
    addIngredient({
      ...selectedIngredient,
      quantity,
      unit,
    });
    onClose();
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    addIngredient({
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      emoji: '🥦',
      category: customCategory,
      quantity,
      unit,
      expiryDays: customExpiryDays,
      pricePerUnit: 3000,
      imageUrl: customImageBase64 || getIngredientImageUrl(customName) || undefined,
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/65 backdrop-blur-md z-[200] flex items-end sm:items-center sm:justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="bg-pestle-card border border-pestle-border w-full max-w-2xl rounded-t-[32px] sm:rounded-[32px] p-6 max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-pestle-border/60">
          <div>
            <h2 className="text-xl font-extrabold text-pestle-text">
              {isCustomMode
                ? 'Шинэ материал нэмэх'
                : selectedIngredient
                  ? 'Хэмжээ тохируулах'
                  : 'Хөргөгчинд материал нэмэх'}
            </h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              {isCustomMode
                ? 'Зураг, нэр болон төрлийг оруулна уу'
                : selectedIngredient
                  ? selectedIngredient.name
                  : 'Жагсаалтаас сонгох эсвэл хайх'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-pestle-bg border border-pestle-border rounded-full flex items-center justify-center text-gray-400 hover:text-pestle-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {!selectedIngredient && !isCustomMode && (
            <>
              {/* Search input & Custom button */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Материал хайх..."
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                  />
                </div>
                <button
                  onClick={() => setIsCustomMode(true)}
                  className="bg-mango text-white border border-mango/30 px-3.5 py-2.5 rounded-xl text-xs font-bold hover:bg-mango/90 transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-md shadow-mango/20"
                >
                  <Plus size={16} />
                  <span>Гараар нэмэх</span>
                </button>
              </div>

              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-mango text-white shadow-sm'
                      : 'bg-pestle-bg border border-pestle-border text-gray-400 hover:text-pestle-text'
                  }`}
                >
                  Бүгд
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-mango text-white shadow-sm'
                        : 'bg-pestle-bg border border-pestle-border text-gray-400 hover:text-pestle-text'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Ingredients Grid with High Quality Photos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredItems.map((item) => (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setSelectedIngredient(item);
                      setUnit((item.unit as any) || 'гр');
                      setQuantity(item.unit === 'гр' || item.unit === 'g' ? 500 : 1);
                    }}
                    className="pestle-card overflow-hidden flex flex-col items-center hover:border-mango transition-all group text-left cursor-pointer"
                  >
                    <SmartImage
                      src={item.imageUrl || getIngredientImageUrl(item.name, item.nameEn)}
                      alt={item.name}
                      emoji={item.emoji}
                      className="w-full h-24"
                    />
                    <div className="p-2.5 w-full text-center">
                      <h4 className="font-bold text-xs text-pestle-text line-clamp-1">
                        {item.name}
                      </h4>
                      <span className="text-[10px] text-mango font-semibold block mt-0.5">
                        {item.category}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Receipt OCR Trigger Button */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    onClose();
                    setShowScanModal(true);
                  }}
                  className="w-full bg-pestle-bg border border-pestle-border py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-pestle-text hover:border-mango transition-colors"
                >
                  <Scan size={16} className="text-mango" />
                  <span>Баримт уншуулах / AI Сканнер</span>
                </button>
              </div>
            </>
          )}

          {/* Custom Ingredient Entry Form with IMAGE UPLOAD */}
          {isCustomMode && (
            <form onSubmit={handleAddCustom} className="space-y-4 py-2">
              {/* 📸 IMAGE UPLOAD DROPZONE / PREVIEW */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-pestle-text flex items-center justify-between">
                  <span>Материиалын Зураг (Заавал биш)</span>
                  <span className="text-[10px] text-mango font-medium">
                    Камераар дарах / Файл сонгох
                  </span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 bg-pestle-bg border-2 border-dashed border-pestle-border hover:border-mango rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative transition-colors group"
                >
                  {customImageBase64 ? (
                    <>
                      <img
                        src={customImageBase64}
                        alt="Custom Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                        <Camera size={16} /> Солих
                      </div>
                    </>
                  ) : (
                    <div className="text-center space-y-1 p-4">
                      <div className="w-10 h-10 bg-mango/15 text-mango rounded-full flex items-center justify-center mx-auto mb-1">
                        <Upload size={20} />
                      </div>
                      <span className="text-xs font-bold text-pestle-text block">
                        Зураг оруулах бол товшино уу
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium block">
                        (Оруулахгүй бол нэрэнд тохирох зураг автоматаар очно)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-pestle-text">Материалын нэр</label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="ж: Алим, Шинэ сүү, Хонь мах..."
                  className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-pestle-text">Ангилал</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as Category)}
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-3 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-pestle-text">
                    Хадгалах хугацаа (хоног)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={customExpiryDays}
                    onChange={(e) => setCustomExpiryDays(parseInt(e.target.value) || 7)}
                    className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                  />
                </div>
              </div>

              {/* Quantity Picker */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-pestle-text">Хэмжээ ба Нэгж</label>
                  <div className="flex bg-pestle-bg p-1 rounded-xl border border-pestle-border text-xs font-bold">
                    {(['гр', 'л', 'ш'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        className={`px-3 py-1 rounded-lg transition-colors ${
                          unit === u ? 'bg-mango text-white' : 'text-gray-400'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - (unit === 'гр' ? 100 : 1)))}
                    aria-label="Хэмжээ хасах"
                    className="w-10 h-10 rounded-xl bg-pestle-bg border border-pestle-border flex items-center justify-center text-pestle-text"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="flex-1 text-center font-black text-lg bg-pestle-bg border border-pestle-border rounded-xl py-2 text-mango"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + (unit === 'гр' ? 100 : 1))}
                    aria-label="Хэмжээ нэмэх"
                    className="w-10 h-10 rounded-xl bg-pestle-bg border border-pestle-border flex items-center justify-center text-pestle-text"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(false)}
                  className="btn-secondary flex-1 py-3 text-xs"
                >
                  Буцах
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 py-3 text-xs shadow-md shadow-mango/20"
                >
                  Хөргөгчинд нэмэх
                </button>
              </div>
            </form>
          )}

          {/* Preset Ingredient Selected — Quantity Slider */}
          {selectedIngredient && !isCustomMode && (
            <div className="flex flex-col items-center py-4 space-y-5">
              <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-lg border border-pestle-border">
                <SmartImage
                  src={
                    selectedIngredient.imageUrl ||
                    getIngredientImageUrl(selectedIngredient.name, selectedIngredient.nameEn)
                  }
                  alt={selectedIngredient.name}
                  emoji={selectedIngredient.emoji}
                  className="w-full h-full"
                />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-black text-pestle-text">{selectedIngredient.name}</h3>
                <span className="text-xs text-mango font-bold">{selectedIngredient.category}</span>
              </div>

              <div className="w-full space-y-3 bg-pestle-bg p-4 rounded-2xl border border-pestle-border">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400">Нэмэх хэмжээ</span>
                  <span className="text-lg font-black text-mango">
                    {formatQuantity(quantity, unit)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    aria-label="Хэмжээ хасах"
                    onClick={() => setQuantity(Math.max(1, quantity - (unit === 'гр' ? 50 : 1)))}
                    className="w-10 h-10 rounded-xl bg-pestle-card border border-pestle-border flex items-center justify-center text-pestle-text"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="range"
                    min="1"
                    max={unit === 'гр' ? 3000 : 50}
                    step={unit === 'гр' ? 50 : 1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-mango"
                  />
                  <button
                    aria-label="Хэмжээ нэмэх"
                    onClick={() => setQuantity(quantity + (unit === 'гр' ? 50 : 1))}
                    className="w-10 h-10 rounded-xl bg-pestle-card border border-pestle-border flex items-center justify-center text-pestle-text"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 w-full pt-2">
                <button
                  onClick={() => setSelectedIngredient(null)}
                  className="btn-secondary flex-1 py-3 text-xs"
                >
                  Буцах
                </button>
                <button
                  onClick={handleConfirmAdd}
                  className="btn-primary flex-1 py-3 text-xs shadow-lg shadow-mango/20"
                >
                  Хөргөгчинд нэмэх
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
