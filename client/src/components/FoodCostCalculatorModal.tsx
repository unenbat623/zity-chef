import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Calculator, X, Plus, Trash2, DollarSign, TrendingUp, Sparkles, ChefHat } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface IngredientCostItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  wastePercentage: number; // e.g. 10% waste during cleaning/cooking
}

export const FoodCostCalculatorModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { formatPrice } = useApp();
  const [dishName, setDishName] = useState('Тусгай Гурилан Цуйван');
  const [portions, setPortions] = useState(4);
  const [targetMargin, setTargetMargin] = useState(65); // 65% Gross Margin

  const [ingredients, setIngredients] = useState<IngredientCostItem[]>([
    { id: '1', name: 'Үхрийн цул мах', quantity: 600, unit: 'г', pricePerUnit: 22000 / 1000, wastePercentage: 5 },
    { id: '2', name: 'Дээд гурил', quantity: 500, unit: 'г', pricePerUnit: 3500 / 1000, wastePercentage: 2 },
    { id: '3', name: 'Сонгино, лууван', quantity: 250, unit: 'г', pricePerUnit: 4000 / 1000, wastePercentage: 12 },
    { id: '4', name: 'Ургамлын тос & амтлагч', quantity: 1, unit: 'порц', pricePerUnit: 1500, wastePercentage: 0 },
  ]);

  const addIngredientRow = () => {
    setIngredients((prev) => [
      ...prev,
      {
        id: `ing-${Date.now()}`,
        name: 'Шинэ орц',
        quantity: 100,
        unit: 'г',
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

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[350] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 20 }}
        className="bg-pestle-card border border-pestle-border w-full max-w-2xl rounded-[32px] p-5 sm:p-6 space-y-6 shadow-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-mango/15 text-mango rounded-2xl flex items-center justify-center font-bold">
              <Calculator size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-pestle-text flex items-center gap-1.5">
                <span>Хоолны Өртөг & Ашгийн Тооцоолуур</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full font-bold">
                  Pro Chef Tool
                </span>
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                Хоолны өртөг (Food Cost %), ашиг болон санал болгох зарагдах үнийг бодно.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-pestle-border flex items-center justify-center text-gray-400 hover:text-pestle-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Top Controls: Dish Name & Portions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-pestle-bg p-3.5 rounded-2xl border border-pestle-border/60">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase">Хоолны нэр</label>
            <input
              type="text"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              className="w-full bg-pestle-card border border-pestle-border rounded-xl px-3 py-2 text-xs font-bold text-pestle-text focus:outline-none focus:border-mango"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase">Нэг удаад хийх порц</label>
            <input
              type="number"
              min={1}
              value={portions}
              onChange={(e) => setPortions(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-pestle-card border border-pestle-border rounded-xl px-3 py-2 text-xs font-bold text-pestle-text focus:outline-none focus:border-mango"
            />
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-pestle-bg border border-pestle-border/80 p-3 rounded-2xl text-center">
            <span className="text-[9px] font-extrabold text-gray-400 uppercase">Нийт Өртөг</span>
            <p className="text-sm sm:text-base font-black text-pestle-text mt-0.5">
              {formatPrice(Math.round(totalBatchCost))}
            </p>
          </div>
          <div className="bg-mango/10 border border-mango/25 p-3 rounded-2xl text-center">
            <span className="text-[9px] font-extrabold text-mango uppercase">1 Порцын Өртөг</span>
            <p className="text-sm sm:text-base font-black text-mango mt-0.5">
              {formatPrice(Math.round(costPerPortion))}
            </p>
          </div>
          <div className="bg-mint/10 border border-mint/25 p-3 rounded-2xl text-center">
            <span className="text-[9px] font-extrabold text-mint uppercase">Санал болгох Зарах Үнэ</span>
            <p className="text-sm sm:text-base font-black text-mint mt-0.5">
              {formatPrice(Math.round(recommendedSellingPrice))}
            </p>
          </div>
        </div>

        {/* Profit Margin Slider */}
        <div className="space-y-2 bg-pestle-bg p-3.5 rounded-2xl border border-pestle-border/60">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-pestle-text flex items-center gap-1.5">
              <TrendingUp size={14} className="text-mint" /> Зорилтот Ашгийн Нийт Хувь (Gross Margin):
            </span>
            <span className="text-mint font-black font-mono">{targetMargin}% (Food Cost: {foodCostPercentage}%)</span>
          </div>
          <input
            type="range"
            min={20}
            max={85}
            value={targetMargin}
            onChange={(e) => setTargetMargin(parseInt(e.target.value))}
            className="w-full accent-mango cursor-pointer"
          />
        </div>

        {/* Ingredients Cost Breakdown Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-pestle-text">
            <span>Орцын Жагсаалт ба Нэгжийн Өртөг</span>
            <button
              onClick={addIngredientRow}
              className="bg-mango text-white text-[10px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1 hover:bg-mango/90 cursor-pointer shadow-xs"
            >
              <Plus size={12} /> Орц нэмэх
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar pr-1">
            {ingredients.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-2 items-center bg-pestle-bg p-2 rounded-xl border border-pestle-border/60 text-xs"
              >
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateRow(item.id, 'name', e.target.value)}
                  placeholder="Орцын нэр"
                  className="col-span-4 bg-pestle-card border border-pestle-border rounded-lg px-2 py-1 font-bold text-pestle-text"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateRow(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                  placeholder="Хэмжээ"
                  className="col-span-2 bg-pestle-card border border-pestle-border rounded-lg px-2 py-1 font-mono text-pestle-text text-center"
                />
                <input
                  type="number"
                  value={item.pricePerUnit}
                  onChange={(e) => updateRow(item.id, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                  placeholder="Нэгжийн үнэ"
                  className="col-span-3 bg-pestle-card border border-pestle-border rounded-lg px-2 py-1 font-mono text-pestle-text text-center"
                />
                <div className="col-span-2 text-right font-mono font-black text-mango">
                  ₮{Math.round(item.quantity * (1 + item.wastePercentage / 100) * item.pricePerUnit).toLocaleString()}
                </div>
                <button
                  onClick={() => removeIngredientRow(item.id)}
                  className="col-span-1 text-gray-400 hover:text-rose-500 flex justify-end cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Button */}
        <button
          onClick={onClose}
          className="w-full btn-primary py-3 font-black text-xs shadow-lg shadow-mango/20 cursor-pointer rounded-2xl"
        >
          Тооцоог Дуусгах
        </button>
      </motion.div>
    </motion.div>
  );
};
