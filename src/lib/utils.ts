export function formatQuantity(quantity: number, unit: string): string {
  if (unit === 'гр' && quantity >= 1000) {
    const kg = quantity / 1000;
    // If it's a whole number, don't show .0
    return `${Number(kg.toFixed(1))} кг`;
  }
  return `${quantity} ${unit}`;
}
