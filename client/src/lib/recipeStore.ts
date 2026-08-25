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

/**
 * Quantities, units and preparation words: they say how much and how, never
 * what, so they must not decide which product an ingredient resolves to.
 */
const STOP_WORDS = new Set([
  'гр',
  'кг',
  'мл',
  'литр',
  'ширхэг',
  'хоолны',
  'цайны',
  'халбага',
  'аяга',
  'чимх',
  'багц',
  'том',
  'жижиг',
  'дунд',
  'зэрэг',
  'бага',
  'хэрчсэн',
  'жижиглэсэн',
  'зүсэм',
  'зүссэн',
  'нарийн',
  'амтлах',
  'бэлэн',
  'and',
  'the',
  'of',
  'cup',
  'cups',
  'tbsp',
  'tsp',
  'chopped',
  'sliced',
  'fresh',
]);

/** Case endings that Mongolian glues onto a noun without changing the noun. */
const SUFFIXES = [
  'уудын',
  'үүдийн',
  'ийнх',
  'ынх',
  'ийн',
  'ын',
  'ний',
  'ны',
  'нд',
  'ийг',
  'ыг',
  'аас',
  'ээс',
  'оос',
  'өөс',
  'тай',
  'тэй',
  'той',
  'той',
  'уудыг',
  'ууд',
  'үүд',
];

/**
 * Reduces a word to the part that carries its meaning.
 *
 * Substring matching used to decide this: "сүүлний тос" (tail fat) contains the
 * letters of "сүү", so the app offered to sell milk for it, and a plain "тос"
 * (oil) resolved to 9,500₮ butter. Stems are compared as whole words, so a
 * longer word that merely starts the same no longer counts as a match.
 */
function stem(word: string): string {
  const base = word.replace(/[ьъ]$/u, '');
  for (const suffix of SUFFIXES) {
    if (base.length > suffix.length + 2 && base.endsWith(suffix)) {
      return base.slice(0, -suffix.length);
    }
  }
  return base;
}

function tokenize(value: string): string[] {
  return (
    normalize(value)
      // "(500 гр жижиглэсэн)" and "1.5 л" describe the amount, not the product.
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\d+([.,]\d+)?/g, ' ')
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
      .map(stem)
  );
}

/**
 * Qualifiers that make an ingredient a *different* thing from the product whose
 * name it contains. Oat milk is not milk, and tail fat is not milk at all.
 */
const DISQUALIFIERS: Record<string, string[]> = {
  сүү: ['овъёос', 'бадам', 'кокос', 'сүүл', 'шар', 'соя'],
  'цөцгийн тос': ['ургамл', 'олив', 'наранцэцэг', 'сүүл'],
  тос: ['сүүл'],
};

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // A prefix only counts once both words are long enough for it to mean
  // something: "сүү" must not swallow "сүүл".
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 5 && longer.startsWith(shorter);
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

  const ingredientTokens = tokenize(ingredient);
  if (ingredientTokens.length === 0) return null;

  const candidates = catalog.filter((product) => {
    const disqualifiers = DISQUALIFIERS[normalize(product.name)] || [];
    if (disqualifiers.some((bad) => ingredientTokens.some((token) => token.startsWith(bad)))) {
      return false;
    }

    // Every word of the product name has to appear in the ingredient: "улаан
    // сонгино" is still сонгино, but "тос" alone is not "цөцгийн тос".
    const matchesAllTokens = (words: string[]) =>
      words.length > 0 &&
      words.every((word) => ingredientTokens.some((token) => tokensMatch(token, word)));

    return (
      matchesAllTokens(tokenize(product.name)) ||
      (product.nameEn ? matchesAllTokens(tokenize(product.nameEn)) : false)
    );
  });

  if (candidates.length === 0) return null;
  // The most specific name wins: "тахианы мах" beats "мах" for chicken breast.
  return candidates.sort((a, b) => tokenize(b.name).length - tokenize(a.name).length)[0];
}

/** Build a cart line straight from a catalog product (used by the store grid too). */
export function buildProductCartItem(product: CatalogProduct, displayName?: string): CartItem {
  const pricePerUnit = product.pricePerUnit || FALLBACK_INGREDIENT_PRICE;
  return {
    id: `cart-${product.id}-${Date.now()}`,
    productId: product.id,
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
 * product (name, emoji, unit, price) when one matches. Returns null for
 * unmatched ingredients: the server prices every order from the catalog, so
 * an invented generic line can no longer be checked out.
 */
export function buildIngredientCartItem(
  ingredient: string,
  catalog: CatalogProduct[],
  lang: 'mn' | 'en' = 'mn'
): CartItem | null {
  const product = matchIngredientToProduct(ingredient, catalog);
  if (!product) return null;
  const displayName = lang === 'en' && product.nameEn ? product.nameEn : product.name;
  return buildProductCartItem(product, displayName);
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
