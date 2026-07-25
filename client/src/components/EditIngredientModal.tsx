import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Minus, Camera, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { Ingredient, Category } from '../types';
import { CATEGORIES } from '../constants';
import { useApp } from '../context/AppContext';
import { getIngredientImageUrl } from '../lib/imageService';
import { SmartImage } from './SmartImage';

interface EditIngredientModalProps {
  ingredient: Ingredient;
  onClose: () => void;
}

export const EditIngredientModal: React.FC<EditIngredientModalProps> = ({
  ingredient,
  onClose,
}) => {
  const { updateIngredient, removeIngredient } = useApp();

  const [name, setName] = useState<string>(ingredient.name);
  const [category, setCategory] = useState<Category>(ingredient.category);
  const [quantity, setQuantity] = useState<number>(ingredient.quantity);
  const [unit, setUnit] = useState<any>(ingredient.unit);
  const [expiryDays, setExpiryDays] = useState<number>(ingredient.expiryDays);
  const [imageBase64, setImageBase64] = useState<string | null>(ingredient.imageUrl || null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    updateIngredient({
      ...ingredient,
      name: name.trim(),
      category,
      quantity,
      unit,
      expiryDays,
      imageUrl: imageBase64 || ingredient.imageUrl,
    });
    onClose();
  };

  const handleDelete = () => {
    removeIngredient(ingredient.id);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/65 backdrop-blur-md z-[210] flex items-end sm:items-center sm:justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="bg-pestle-card border border-pestle-border w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-6 max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-pestle-border/60">
          <div>
            <h2 className="text-lg font-extrabold text-pestle-text">Материал Засах / Шинэчлэх</h2>
            <p className="text-xs text-gray-400 font-medium">{ingredient.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-pestle-bg border border-pestle-border rounded-full flex items-center justify-center text-gray-400 hover:text-pestle-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Image Upload / Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-pestle-text flex justify-between">
              <span>Материалын Зураг</span>
              <span className="text-[10px] text-mango font-semibold">Солихын тулд товшино уу</span>
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
              className="w-full h-36 bg-pestle-bg border-2 border-dashed border-pestle-border hover:border-mango rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden relative group transition-colors"
            >
              {imageBase64 ? (
                <>
                  <img src={imageBase64} alt={name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                    <Camera size={16} /> Зураг солих
                  </div>
                </>
              ) : (
                <SmartImage
                  src={getIngredientImageUrl(name, ingredient.nameEn)}
                  alt={name}
                  emoji={ingredient.emoji}
                  className="w-full h-full"
                />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-pestle-text">Нэр</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-2.5 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-pestle-text">Ангилал</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-3 py-2.5 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-pestle-text">Хадгалах хугацаа (хоног)</label>
              <input
                type="number"
                min={1}
                max={180}
                value={expiryDays}
                onChange={(e) => setExpiryDays(parseInt(e.target.value) || 1)}
                className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-2.5 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
              />
            </div>
          </div>

          {/* Quantity Controls */}
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
                onClick={() => setQuantity(Math.max(1, quantity - (unit === 'гр' ? 50 : 1)))}
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
                onClick={() => setQuantity(quantity + (unit === 'гр' ? 50 : 1))}
                className="w-10 h-10 rounded-xl bg-pestle-bg border border-pestle-border flex items-center justify-center text-pestle-text"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-pestle-border/60">
            <button
              type="button"
              onClick={handleDelete}
              className="bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white px-4 py-3 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={16} />
              <span>Устгах</span>
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 py-3 text-xs shadow-md shadow-mango/20"
            >
              Өөрчлөлтийг хадгалах
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
