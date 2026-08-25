import React, { useId, useState, useRef } from 'react';
import { m } from 'motion/react';
import { X, Plus, Minus, Camera, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Ingredient, Category } from '../types';
import { CATEGORIES } from '../constants';
import { useApp } from '../context/AppContext';
import { getIngredientImageUrl } from '../lib/imageService';
import { uploadImage } from '../lib/storage';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useScrollLock } from '../hooks/useScrollLock';
import { SmartImage } from './SmartImage';

/** Photos are stored in Supabase Storage, not inlined into the row — a phone
 *  photo as a base64 data URL is megabytes of text in the database and in
 *  every subsequent inventory response. */
export const MAX_INGREDIENT_IMAGE_BYTES = 5 * 1024 * 1024;

interface EditIngredientModalProps {
  ingredient: Ingredient;
  onClose: () => void;
}

export const EditIngredientModal: React.FC<EditIngredientModalProps> = ({
  ingredient,
  onClose,
}) => {
  const { updateIngredient, removeIngredient, t } = useApp();

  const [name, setName] = useState<string>(ingredient.name);
  const [category, setCategory] = useState<Category>(ingredient.category);
  const [quantity, setQuantity] = useState<number>(ingredient.quantity);
  const [unit, setUnit] = useState<any>(ingredient.unit);
  const [expiryDays, setExpiryDays] = useState<number>(ingredient.expiryDays);
  const [imageBase64, setImageBase64] = useState<string | null>(ingredient.imageUrl || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Labels were only visually adjacent to their controls — screen readers
  // announced every field as unlabelled, and tapping a label did nothing.
  const uid = useId();

  useEscapeClose(onClose);
  useScrollLock(true);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    if (!file.type.startsWith('image/')) {
      setImageError(t('edit_imageTypeError'));
      return;
    }
    if (file.size > MAX_INGREDIENT_IMAGE_BYTES) {
      setImageError(t('edit_imageTooLarge'));
      return;
    }
    setImageFile(file);
    // Instant local preview; the real upload happens on save.
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);

    let imageUrl = imageBase64 || ingredient.imageUrl;
    if (imageFile) {
      const uploaded = await uploadImage(imageFile, 'ingredients');
      // Without Storage the base64 preview is the only thing left; keeping it
      // is better than losing the photo the user just picked.
      if (uploaded) imageUrl = uploaded;
    }

    updateIngredient({
      ...ingredient,
      name: name.trim(),
      category,
      quantity,
      unit,
      expiryDays,
      imageUrl,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = () => {
    // Deleting used to be a single unconfirmed tap with no undo.
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    removeIngredient(ingredient.id);
    onClose();
  };

  // Always mounted by its parent only while open, so the trap is always active.
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t('edit_title')}
      className="fixed inset-0 bg-black/65 backdrop-blur-md z-[210] flex items-end sm:items-center sm:justify-center p-0 sm:p-4"
    >
      <m.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-pestle-card border border-pestle-border/80 w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-6 max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden relative"
      >
        {/* Mobile Bottom-Sheet Pull Bar */}
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />
        {/* Modal Header */}
        <div className="flex justify-between items-start gap-3 pb-4 border-b border-pestle-border/60 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-pestle-text">{t('edit_title')}</h2>
            <p className="text-xs text-gray-400 font-medium truncate">{ingredient.name}</p>
          </div>
          <button onClick={onClose} aria-label={t('close')} className="modal-close-btn shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-4 pb-sheet-safe sm:pb-4 space-y-4"
        >
          {/* Image Upload / Preview */}
          <div className="space-y-1.5">
            {/* A caption, not a <label>: the real control is the dropzone below. */}
            <p className="text-xs font-bold text-pestle-text flex justify-between">
              <span>{t('edit_ingredientImage')}</span>
              <span className="text-[10px] text-mango-ink font-semibold">
                {t('edit_tapToChange')}
              </span>
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />

            <div
              role="button"
              tabIndex={0}
              aria-label={t('edit_ingredientImage')}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="w-full h-36 bg-pestle-bg border-2 border-dashed border-pestle-border hover:border-mango rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden relative group transition-colors"
            >
              {imageBase64 ? (
                <>
                  <img src={imageBase64} alt={name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                    <Camera size={16} /> {t('edit_changeImage')}
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
            <label htmlFor={`${uid}-name`} className="text-xs font-bold text-pestle-text">
              {t('edit_name')}
            </label>
            <input
              id={`${uid}-name`}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-2.5 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={`${uid}-category`} className="text-xs font-bold text-pestle-text">
                {t('edit_category')}
              </label>
              <select
                id={`${uid}-category`}
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
              <label htmlFor={`${uid}-expiry`} className="text-xs font-bold text-pestle-text">
                {t('edit_expiryDays')}
              </label>
              <input
                id={`${uid}-expiry`}
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
            {/* Wraps rather than overflowing: label + three unit chips do not fit
                on one line at 320px. */}
            <div className="flex flex-wrap justify-between items-center gap-2">
              <label htmlFor={`${uid}-quantity`} className="text-xs font-bold text-pestle-text">
                {t('edit_quantityAndUnit')}
              </label>
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
                    {u === 'гр'
                      ? t('edit_unitGram')
                      : u === 'л'
                        ? t('edit_unitLiter')
                        : t('edit_unitPiece')}
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
                id={`${uid}-quantity`}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="flex-1 text-center font-black text-lg bg-pestle-bg border border-pestle-border rounded-xl py-2 text-mango-ink"
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

          {imageError && (
            <p className="text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {imageError}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-pestle-border/60">
            <button
              type="button"
              onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
              aria-label={confirmDelete ? t('edit_deleteConfirm') : t('edit_delete')}
              className={`px-3.5 sm:px-4 py-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shrink-0 border ${
                confirmDelete
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white'
              }`}
            >
              <Trash2 size={16} className="shrink-0" />
              <span>{confirmDelete ? t('edit_deleteConfirm') : t('edit_delete')}</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 py-3 text-xs shadow-md shadow-mango/20 disabled:opacity-50"
            >
              {saving ? t('edit_saving') : t('edit_saveChanges')}
            </button>
          </div>
        </form>
      </m.div>
    </m.div>
  );
};
