import React, { useEffect, useId, useState, useMemo } from 'react';
import { m } from 'motion/react';
import {
  Calculator,
  X,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Sparkles,
  ChefHat,
} from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useApp } from '../context/AppContext';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useScrollLock } from '../hooks/useScrollLock';

interface IngredientCostItem {
  id: string;
  name: string;
  quantity: number;
  unit: UnitCode;
  pricePerUnit: number; // price for ONE base unit (1 g, 1 ml, 1 pc...)
  wastePercentage: number; // e.g. 10% waste during cleaning/cooking
}

type UnitCode = 'g' | 'kg' | 'ml' | 'l' | 'pc' | 'portion';

// The price is typed in the unit people actually buy in (₮ per kg / per litre / per piece),
// while quantity is typed in the unit people cook with (g / ml / pc).
const UNIT_OPTIONS: { code: UnitCode; priceBasis: UnitCode; factor: number }[] = [
  { code: 'g', priceBasis: 'kg', factor: 1000 },
  { code: 'kg', priceBasis: 'kg', factor: 1 },
  { code: 'ml', priceBasis: 'l', factor: 1000 },
  { code: 'l', priceBasis: 'l', factor: 1 },
  { code: 'pc', priceBasis: 'pc', factor: 1 },
  { code: 'portion', priceBasis: 'portion', factor: 1 },
];

const getUnitMeta = (unit: UnitCode) =>
  UNIT_OPTIONS.find((u) => u.code === unit) ?? UNIT_OPTIONS[0];

/**
 * The costing worksheet, persisted locally. It is a personal scratchpad rather
 * than shared data, so localStorage is the right home for it.
 */
const COSTING_KEY = 'zity_food_costing';

interface SavedCosting {
  dishName: string;
  portions: number;
  targetMargin: number;
  ingredients: IngredientCostItem[];
}

function readSavedCosting(): SavedCosting | null {
  try {
    const raw = localStorage.getItem(COSTING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedCosting;
    return Array.isArray(parsed.ingredients) && parsed.ingredients.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export const FoodCostCalculatorModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { formatPrice, t } = useApp();
  // Real label↔control association; the per-row ids are suffixed with the
  // item id so every ingredient row stays unique.
  const uid = useId();
  // A costing takes real work to enter, and closing the sheet used to discard
  // all of it. The whole worksheet is restored on reopen.
  const saved = readSavedCosting();
  const [dishName, setDishName] = useState(saved?.dishName ?? t('cost_defaultDishName'));
  const [portions, setPortions] = useState(saved?.portions ?? 4);
  const [targetMargin, setTargetMargin] = useState(saved?.targetMargin ?? 65); // 65% Gross Margin

  const [ingredients, setIngredients] = useState<IngredientCostItem[]>(
    saved?.ingredients ?? [
      {
        id: '1',
        name: 'Үхрийн цул мах',
        quantity: 600,
        unit: 'g',
        pricePerUnit: 22000 / 1000,
        wastePercentage: 5,
      },
      {
        id: '2',
        name: 'Дээд гурил',
        quantity: 500,
        unit: 'g',
        pricePerUnit: 3500 / 1000,
        wastePercentage: 2,
      },
      {
        id: '3',
        name: 'Сонгино, лууван',
        quantity: 250,
        unit: 'g',
        pricePerUnit: 4000 / 1000,
        wastePercentage: 12,
      },
      {
        id: '4',
        name: 'Ургамлын тос & амтлагч',
        quantity: 1,
        unit: 'portion',
        pricePerUnit: 1500,
        wastePercentage: 0,
      },
    ]
  );

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(
        COSTING_KEY,
        JSON.stringify({ dishName, portions, targetMargin, ingredients })
      );
    } catch {
      /* private mode — the worksheet just won't outlive this session */
    }
  }, [isOpen, dishName, portions, targetMargin, ingredients]);

  const addIngredientRow = () => {
    setIngredients((prev) => [
      ...prev,
      {
        id: `ing-${Date.now()}`,
        name: t('cost_newIngredient'),
        quantity: 100,
        unit: 'g',
        pricePerUnit: 5,
        wastePercentage: 0,
      },
    ]);
  };

  const removeIngredientRow = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  const updateRow = (id: string, field: keyof IngredientCostItem, value: any) => {
    setIngredients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // The user types the price per purchase unit (₮/kg), so keep that number stable
  // when the unit changes and convert the stored per-base-unit price instead.
  const updateUnit = (id: string, unit: UnitCode) => {
    setIngredients((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const shownPrice = item.pricePerUnit * getUnitMeta(item.unit).factor;
        return { ...item, unit, pricePerUnit: shownPrice / getUnitMeta(unit).factor };
      })
    );
  };

  const updateShownPrice = (id: string, shownPrice: number) => {
    setIngredients((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, pricePerUnit: shownPrice / getUnitMeta(item.unit).factor }
          : item
      )
    );
  };

  // Calculations
  const totalBatchCost = useMemo(() => {
    return ingredients.reduce((sum, item) => {
      const effectiveQty = item.quantity * (1 + item.wastePercentage / 100);
      return sum + effectiveQty * item.pricePerUnit;
    }, 0);
  }, [ingredients]);

  const costPerPortion = useMemo(() => {
    return portions > 0 ? totalBatchCost / portions : 0;
  }, [totalBatchCost, portions]);

  // Recommended Retail Price = Cost Per Portion / (1 - Target Margin %)
  const recommendedSellingPrice = useMemo(() => {
    const marginDecimal = targetMargin / 100;
    if (marginDecimal >= 1) return costPerPortion;
    return costPerPortion / (1 - marginDecimal);
  }, [costPerPortion, targetMargin]);

  const foodCostPercentage = useMemo(() => {
    if (recommendedSellingPrice === 0) return 0;
    return Math.round((costPerPortion / recommendedSellingPrice) * 100);
  }, [costPerPortion, recommendedSellingPrice]);

  useEscapeClose(onClose, isOpen);
  useScrollLock(isOpen);

  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

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
      aria-label={t('cost_title')}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      <m.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-pestle-card border border-pestle-border w-full max-w-2xl rounded-t-[32px] sm:rounded-[32px] p-4 sm:p-6 pb-sheet-safe sm:pb-6 space-y-5 sm:space-y-6 shadow-2xl my-auto max-h-[94dvh] overflow-y-auto overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 bg-mango/15 text-mango-ink rounded-2xl flex items-center justify-center font-bold">
              <Calculator size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-pestle-text flex flex-wrap items-center gap-1.5">
                <span>{t('cost_title')}</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
                  {t('cost_badge')}
                </span>
              </h3>
              <p className="text-xs text-gray-400 font-medium">{t('cost_subtitle')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="w-8 h-8 shrink-0 rounded-full border border-pestle-border flex items-center justify-center text-gray-400 hover:text-pestle-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Top Controls: Dish Name & Portions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-pestle-bg p-3.5 rounded-2xl border border-pestle-border/60">
          <div className="sm:col-span-2 space-y-1">
            <label
              htmlFor={`${uid}-dish`}
              className="text-[10px] font-extrabold text-gray-400 uppercase"
            >
              {t('cost_dishName')}
            </label>
            <input
              id={`${uid}-dish`}
              type="text"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              className="w-full bg-pestle-card border border-pestle-border rounded-xl px-3 py-2 text-xs font-bold text-pestle-text focus:outline-none focus:border-mango"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`${uid}-portions`}
              className="text-[10px] font-extrabold text-gray-400 uppercase"
            >
              {t('cost_portions')}
            </label>
            <input
              id={`${uid}-portions`}
              type="number"
              min={1}
              value={portions}
              onChange={(e) => setPortions(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-pestle-card border border-pestle-border rounded-xl px-3 py-2 text-xs font-bold text-pestle-text focus:outline-none focus:border-mango"
            />
          </div>
        </div>

        {/* Summary Metric Cards */}
        {/* Money can run to seven digits; the tiles wrap the figure instead of
            letting it spill out of a 100px column. */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-pestle-bg border border-pestle-border/80 p-2.5 sm:p-3 rounded-2xl text-center min-w-0">
            <span className="text-[9px] font-extrabold text-gray-400 uppercase block leading-tight">
              {t('cost_totalCost')}
            </span>
            <p className="text-xs sm:text-base font-black text-pestle-text mt-0.5 tabular-nums break-words leading-tight">
              {formatPrice(Math.round(totalBatchCost))}
            </p>
          </div>
          <div className="bg-mango/10 border border-mango/25 p-2.5 sm:p-3 rounded-2xl text-center min-w-0">
            <span className="text-[9px] font-extrabold text-mango-ink uppercase block leading-tight">
              {t('cost_perPortion')}
            </span>
            <p className="text-xs sm:text-base font-black text-mango-ink mt-0.5 tabular-nums break-words leading-tight">
              {formatPrice(Math.round(costPerPortion))}
            </p>
          </div>
          <div className="bg-mint/10 border border-mint/25 p-2.5 sm:p-3 rounded-2xl text-center min-w-0">
            <span className="text-[9px] font-extrabold text-mint-ink uppercase block leading-tight">
              {t('cost_suggestedPrice')}
            </span>
            <p className="text-xs sm:text-base font-black text-mint-ink mt-0.5 tabular-nums break-words leading-tight">
              {formatPrice(Math.round(recommendedSellingPrice))}
            </p>
          </div>
        </div>

        {/* Profit Margin Slider */}
        <div className="space-y-2 bg-pestle-bg p-3.5 rounded-2xl border border-pestle-border/60">
          <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-xs font-bold">
            <span className="text-pestle-text flex items-center gap-1.5">
              <TrendingUp size={14} className="text-mint-ink shrink-0" /> {t('cost_targetMargin')}
            </span>
            <span className="text-mint-ink font-black font-mono">
              {targetMargin}% ({t('cost_foodCost')}: {foodCostPercentage}%)
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={85}
            value={targetMargin}
            onChange={(e) => setTargetMargin(parseInt(e.target.value))}
            aria-label={t('cost_targetMargin')}
            className="w-full accent-mango cursor-pointer"
          />
        </div>

        {/* Ingredients Cost Breakdown Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-pestle-text">
            <span>{t('cost_ingredientsTitle')}</span>
            <button
              onClick={addIngredientRow}
              className="bg-mango text-white text-[10px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1 hover:bg-mango/90 cursor-pointer shadow-xs"
            >
              <Plus size={12} /> {t('cost_addIngredient')}
            </button>
          </div>

          <p className="text-[10px] text-gray-400 font-medium leading-snug">
            {t('cost_ingredientsHint')}
          </p>

          {/* No nested scroller on phones — the sheet itself scrolls, and two
              stacked scroll areas made the list nearly impossible to reach. */}
          <div className="space-y-2 sm:max-h-72 sm:overflow-y-auto no-scrollbar sm:pr-1">
            {ingredients.map((item) => {
              const unitMeta = getUnitMeta(item.unit);
              const unitLabel = t(`cost_unit_${item.unit}`);
              const basisLabel = t(`cost_unit_${unitMeta.priceBasis}`);
              const shownPrice = Math.round(item.pricePerUnit * unitMeta.factor * 100) / 100;
              const lineTotal = Math.round(
                item.quantity * (1 + item.wastePercentage / 100) * item.pricePerUnit
              );

              return (
                <div
                  key={item.id}
                  className="bg-pestle-bg p-2.5 rounded-xl border border-pestle-border/60 text-xs space-y-2"
                >
                  {/* Ingredient name */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateRow(item.id, 'name', e.target.value)}
                      placeholder={t('cost_ingredientName')}
                      className="flex-1 min-w-0 bg-pestle-card border border-pestle-border rounded-lg px-2 py-1.5 font-bold text-pestle-text focus:outline-none focus:border-mango"
                    />
                    <button
                      onClick={() => removeIngredientRow(item.id)}
                      className="text-gray-400 hover:text-rose-500 cursor-pointer shrink-0"
                      aria-label={t('cost_removeIngredient')}
                      title={t('cost_removeIngredient')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Labelled inputs: amount + unit + purchase price + waste */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-0.5">
                      <label
                        htmlFor={`${uid}-qty-${item.id}`}
                        className="text-[9px] font-extrabold text-gray-400 uppercase block"
                      >
                        {t('cost_quantity')}
                      </label>
                      <div className="flex items-center bg-pestle-card border border-pestle-border rounded-lg px-2 focus-within:border-mango">
                        <input
                          id={`${uid}-qty-${item.id}`}
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={(e) =>
                            updateRow(item.id, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="w-full min-w-0 bg-transparent py-1.5 font-mono text-pestle-text focus:outline-none"
                        />
                        <span className="text-[10px] font-bold text-gray-400 pl-1 shrink-0">
                          {unitLabel}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <label
                        htmlFor={`${uid}-unit-${item.id}`}
                        className="text-[9px] font-extrabold text-gray-400 uppercase block"
                      >
                        {t('cost_unit')}
                      </label>
                      <select
                        id={`${uid}-unit-${item.id}`}
                        value={item.unit}
                        onChange={(e) => updateUnit(item.id, e.target.value as UnitCode)}
                        className="w-full bg-pestle-card border border-pestle-border rounded-lg px-2 py-1.5 font-bold text-pestle-text cursor-pointer focus:outline-none focus:border-mango"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u.code} value={u.code}>
                            {t(`cost_unit_${u.code}`)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <label
                        htmlFor={`${uid}-price-${item.id}`}
                        className="text-[9px] font-extrabold text-gray-400 uppercase block truncate"
                      >
                        {t('cost_purchasePrice', { unit: basisLabel })}
                      </label>
                      <div className="flex items-center bg-pestle-card border border-pestle-border rounded-lg px-2 focus-within:border-mango">
                        <span className="text-[10px] font-bold text-gray-400 pr-1 shrink-0">₮</span>
                        <input
                          id={`${uid}-price-${item.id}`}
                          type="number"
                          min={0}
                          value={shownPrice}
                          onChange={(e) =>
                            updateShownPrice(item.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-full min-w-0 bg-transparent py-1.5 font-mono text-pestle-text focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <label
                        htmlFor={`${uid}-waste-${item.id}`}
                        className="text-[9px] font-extrabold text-gray-400 uppercase block truncate"
                      >
                        {t('cost_waste')}
                      </label>
                      <div className="flex items-center bg-pestle-card border border-pestle-border rounded-lg px-2 focus-within:border-mango">
                        <input
                          id={`${uid}-waste-${item.id}`}
                          type="number"
                          min={0}
                          max={100}
                          value={item.wastePercentage}
                          onChange={(e) =>
                            updateRow(
                              item.id,
                              'wastePercentage',
                              Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                            )
                          }
                          className="w-full min-w-0 bg-transparent py-1.5 font-mono text-pestle-text focus:outline-none"
                        />
                        <span className="text-[10px] font-bold text-gray-400 pl-1 shrink-0">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Plain-language formula so the line total is never a mystery number */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-pestle-border/60 pt-1.5">
                    <span className="text-[10px] text-gray-400 font-mono">
                      {item.quantity.toLocaleString()} {unitLabel} × {formatPrice(shownPrice)}/
                      {basisLabel}
                      {item.wastePercentage > 0 &&
                        ` + ${item.wastePercentage}% ${t('cost_wasteShort')}`}
                    </span>
                    <span className="font-mono font-black text-mango-ink">
                      = {formatPrice(lineTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Button */}
        <button
          onClick={onClose}
          className="w-full btn-primary py-3 font-black text-xs shadow-lg shadow-mango/20 cursor-pointer rounded-2xl"
        >
          {t('cost_done')}
        </button>
      </m.div>
    </m.div>
  );
};
