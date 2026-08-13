import type { CartItem, Recipe } from '../types';

/**
 * Shared "recipe ingredient ↔ store product" bridge.
 * Both RecipeView (order missing ingredients) and StoreView (recipe bundles)
 * use this so a recipe ingredient always resolves to the same real catalog
 * product, price and unit instead of ad-hoc hardcoded values.
 */
export interface CatalogProduct {
  id: string;
  name: string;
  nameEn?: string | null;
  emoji: string;
  unit: string;
  pricePerUnit?: number;
  imageUrl?: string | null;
}

export const FALLBACK_INGREDIENT_PRICE = 3500;

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

/** Find the catalog product matching a free-text recipe ingredient (mn/en). */
export function matchIngredientToProduct<T extends CatalogProduct>(
  ingredient: string,
  catalog: T[]
): T | null {
  const ing = normalize(ingredient);
  if (!ing) return null;

  const exact = catalog.find(
    (p) => normalize(p.name) === ing || (p.nameEn ? normalize(p.nameEn) === ing : false)
  );
  if (exact) return exact;

  return (
    catalog.find((p) => {
      const name = normalize(p.name);
      const nameEn = p.nameEn ? normalize(p.nameEn) : '';
      return (
        ing.includes(name) ||
        name.includes(ing) ||
        (nameEn !== '' && (ing.includes(nameEn) || nameEn.includes(ing)))
      );
    }) ?? null
  );
}

/** Build a cart line straight from a catalog product (used by the store grid too). */
export function buildProductCartItem(product: CatalogProduct, displayName?: string): CartItem {
  const pricePerUnit = product.pricePerUnit || FALLBACK_INGREDIENT_PRICE;
  return {
    id: `cart-${product.id}-${Date.now()}`,
    name: displayName || product.name,
    emoji: product.emoji,
    unit: product.unit,
    quantity: product.unit === 'гр' ? 500 : 1,
    pricePerUnit,
    totalPrice: pricePerUnit,
  };
}

/**
 * Build a cart line for a recipe ingredient. Resolves to the real store
 * product (name, emoji, unit, price) when one matches; otherwise falls back
 * to a generic priced line so checkout still works.
 */
export function buildIngredientCartItem(
  ingredient: string,
  catalog: CatalogProduct[],
  lang: 'mn' | 'en' = 'mn'
): CartItem {
  const product = matchIngredientToProduct(ingredient, catalog);
  if (product) {
    const displayName = lang === 'en' && product.nameEn ? product.nameEn : product.name;
    return buildProductCartItem(product, displayName);
  }
  return {
    id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: ingredient,
    emoji: '🛒',
    unit: 'ш',
    quantity: 1,
    pricePerUnit: FALLBACK_INGREDIENT_PRICE,
    totalPrice: FALLBACK_INGREDIENT_PRICE,
  };
}

export interface RecipeBundle {
  recipe: Recipe;
  /** Ingredients resolved to real store products. */
  matched: { ingredient: string; product: CatalogProduct }[];
  /** Ingredients with no catalog product (spices etc.). */
  unmatched: string[];
  totalIngredients: number;
  /** Estimated price of buying every matched product once. */
  totalPrice: number;
}

/** Map a whole recipe onto the store catalog: which ingredients can be bought and for how much. */
export function buildRecipeBundle(recipe: Recipe, catalog: CatalogProduct[]): RecipeBundle {
  const matched: RecipeBundle['matched'] = [];
  const unmatched: string[] = [];

  recipe.ingredients.forEach((ingredient) => {
    const product = matchIngredientToProduct(ingredient, catalog);
    if (product) {
      matched.push({ ingredient, product });
    } else {
      unmatched.push(ingredient);
    }
  });

  return {
    recipe,
    matched,
    unmatched,
    totalIngredients: recipe.ingredients.length,
    totalPrice: matched.reduce(
      (sum, m) => sum + (m.product.pricePerUnit || FALLBACK_INGREDIENT_PRICE),
      0
    ),
  };
}
