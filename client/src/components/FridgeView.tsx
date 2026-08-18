import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Scan, AlertTriangle, Edit, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATEGORIES } from '../constants';
import { Ingredient } from '../types';
import { formatQuantity } from '../lib/utils';
import { IngredientPicker } from './IngredientPicker';
import { IngredientImage } from './SmartImage';
import { getIngredientImageUrl } from '../lib/imageService';
import { EditIngredientModal } from './EditIngredientModal';

export const FridgeView: React.FC = () => {
  const {
    inventory,
    inventoryLoading,
    inventoryError,
    refetchInventory,
    removeIngredient,
    updateIngredient,
    setShowScanModal,
    unitSystem,
    t,
  } = useApp();
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [filterExpiringOnly, setFilterExpiringOnly] = useState<boolean>(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  const expiringItems = inventory.filter((item) => item.expiryDays <= 3);
  const expiringCount = expiringItems.length;

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCat === 'all' || item.category === selectedCat;
    const matchesExpiry = !filterExpiringOnly || item.expiryDays <= 3;
    return matchesSearch && matchesCat && matchesExpiry;
  });

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header Banner */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-pestle-text tracking-tight">
            {t('fridgeTitle')}
          </h2>
          <p className="text-xs font-semibold text-gray-400 mt-0.5">
            {t('fridgeSub', { count: inventory.length })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScanModal(true)}
            className="w-full sm:w-auto justify-center bg-mint/15 text-mint-ink border border-mint/30 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-mint hover:text-white transition-all active:scale-95 shadow-sm"
          >
            <Scan size={16} />
            <span>{t('scanReceipt')}</span>
          </button>
        </div>
      </header>

      {/* Expiring Soon Alert Card */}
      {expiringCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setFilterExpiringOnly(!filterExpiringOnly)}
          className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 transition-all ${
            filterExpiringOnly
              ? 'bg-red-500 text-white border-red-600 shadow-md'
              : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/15'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold">
                {t('expiringAlert')} ({expiringCount})
              </h4>
              <p className="text-[10px] opacity-80 line-clamp-2">
                {filterExpiringOnly ? t('fridge_clearFilter') : t('fridge_expiringSubtitle')}
              </p>
            </div>
          </div>
          <span className="text-xs font-extrabold underline shrink-0">
            {filterExpiringOnly ? t('fridge_view') : t('fridge_filter')}
          </span>
        </motion.div>
      )}

      {/* Search & Categories Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('fridge_searchPlaceholder')}
            placeholder={t('fridge_searchPlaceholder')}
            className="w-full bg-pestle-card border border-pestle-border rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium focus:outline-none focus:border-mango transition-colors text-pestle-text shadow-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 sm:-mx-6 px-4 sm:px-6 no-scrollbar">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCat === 'all'
                ? 'bg-mango text-white'
                : 'bg-pestle-card border border-pestle-border text-gray-400 hover:text-pestle-text'
            }`}
          >
            {t('fridge_all')}
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCat === cat
                  ? 'bg-mango text-white'
                  : 'bg-pestle-card border border-pestle-border text-gray-400 hover:text-pestle-text'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {inventoryError && (
        <div className="text-center py-10 bg-red-500/5 border border-red-500/20 rounded-2xl p-6 space-y-3">
          <AlertTriangle size={28} className="text-red-500 mx-auto" />
          <p className="text-sm font-bold text-red-500">{t('fridge_loadError')}</p>
          <p className="text-xs text-gray-400">{t('fridge_serverError')}</p>
          <button
            onClick={() => refetchInventory()}
            className="btn-primary px-5 py-2.5 text-xs font-bold inline-flex items-center gap-2"
          >
            <Sparkles size={14} /> {t('fridge_retry')}
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {inventoryLoading && !inventoryError && inventory.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="pestle-card p-3.5 animate-pulse opacity-70">
              <div className="w-full h-24 rounded-xl bg-pestle-bg mb-3" />
              <div className="h-3 w-2/3 rounded bg-pestle-bg mb-2" />
              <div className="h-2 w-1/3 rounded bg-pestle-bg" />
            </div>
          ))}
        </div>
      )}

      {/* Inventory Grid */}
      {!inventoryError && (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {filteredInventory.map((item) => {
          const isExpiring = item.expiryDays <= 3;

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setEditingIngredient(item)}
              className={`pestle-card p-3.5 flex flex-col items-center text-center cursor-pointer relative overflow-hidden transition-all hover:border-mango group ${
                isExpiring ? 'border-red-400/50 bg-red-500/5' : ''
              }`}
            >
              {/* Ingredient Photo with shimmer + emoji fallback */}
              <div className="mb-3 w-full h-28 relative overflow-hidden rounded-xl">
                <IngredientImage
                  src={item.imageUrl || getIngredientImageUrl(item.name, item.nameEn)}
                  emoji={item.emoji}
                  name={item.name}
                  size="full"
                />
                {isExpiring && (
                  <div className="absolute inset-0 bg-red-500/10 rounded-xl border border-red-400/40" />
                )}

                {/* Edit affordance. Hover-only meant a touch user had no hint
                    the card was editable at all, so phones get a permanent
                    corner badge and pointers keep the full-cover overlay. */}
                <span className="md:hidden absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/45 backdrop-blur-sm text-white flex items-center justify-center">
                  <Edit size={13} />
                </span>
                <div className="hidden md:flex absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center text-white text-xs font-bold gap-1">
                  <Edit size={14} /> {t('fridge_edit')}
                </div>
              </div>

              <h3 className="font-bold text-xs text-pestle-text tracking-tight mb-1 line-clamp-1 w-full text-center">
                {item.name}
              </h3>
              <span className="text-[11px] font-mono font-semibold text-mango-ink mb-2">
                {formatQuantity(item.quantity, item.unit, unitSystem)}
              </span>

              {/* Freshness Bar */}
              <div className="w-full bg-pestle-bg rounded-full h-1.5 overflow-hidden border border-pestle-border/40">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.expiryDays <= 2
                      ? 'bg-red-500'
                      : item.expiryDays <= 5
                        ? 'bg-amber-400'
                        : 'bg-emerald-600 dark:bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, (item.expiryDays / 14) * 100)}%` }}
                />
              </div>

              <span className="text-[10px] text-gray-400 font-medium mt-1">
                {item.expiryDays <= 1 ? (
                  <span className="text-red-500 font-bold">{t('expiringToday')}</span>
                ) : (
                  t('expiryDays', { days: item.expiryDays })
                )}
              </span>
            </motion.div>
          );
        })}
      </div>
      )}

      {!inventoryLoading && !inventoryError && filteredInventory.length === 0 && (
        <div className="text-center py-14 bg-pestle-card border border-pestle-border rounded-3xl p-6">
          <div className="w-12 h-12 rounded-2xl bg-mango/10 text-mango-ink mx-auto flex items-center justify-center mb-3">
            <Plus size={22} />
          </div>
          <p className="text-sm font-black text-pestle-text">{t('fridge_noItems')}</p>
          <p className="text-xs font-semibold text-gray-400 mt-1">{t('store_cartEmptyHint')}</p>
        </div>
      )}

      {/* Add Floating Action Button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowPicker(true)}
        className="btn-primary w-full py-4 flex items-center justify-center gap-2 shadow-xl shadow-mango/25 text-sm font-bold"
      >
        <Plus size={20} />
        <span>{t('addIngredient')}</span>
      </motion.button>

      {/* Modal Picker */}
      <AnimatePresence>
        {showPicker && <IngredientPicker onClose={() => setShowPicker(false)} />}
      </AnimatePresence>

      {/* Edit Ingredient Modal */}
      <AnimatePresence>
        {editingIngredient && (
          <EditIngredientModal
            ingredient={editingIngredient}
            onClose={() => setEditingIngredient(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
