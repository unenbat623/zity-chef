export function formatQuantity(
  quantity: number,
  unit: string,
  unitSystem: 'metric' | 'imperial' = 'metric'
): string {
  if (unitSystem === 'imperial') {
    if (unit === 'гр' || unit === 'g') {
      const ounces = quantity / 28.3495;
      if (ounces >= 16) return `${Number((ounces / 16).toFixed(1))} lb`;
      return `${Number(ounces.toFixed(1))} oz`;
    }
    if (unit === 'л' || unit === 'l') {
      return `${Number((quantity * 33.814).toFixed(1))} fl oz`;
    }
    if (unit === 'ш' || unit === 'pcs') {
      return `${quantity} pcs`;
    }
  }

  if (unit === 'гр' && quantity >= 1000) {
    const kg = quantity / 1000;
    // If it's a whole number, don't show .0
    return `${Number(kg.toFixed(1))} кг`;
  }
  return `${quantity} ${unit}`;
}
