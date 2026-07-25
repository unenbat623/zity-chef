/**
 * Smart Image Service
 * - Curated Unsplash images for every ingredient + recipe
 * - Blur placeholder before load (shimmer effect)
 * - Fallback to emoji-based gradient if image fails
 * - Browser-native lazy loading
 */

// ── Curated ingredient image map ──────────────────────────────────────────────
const INGREDIENT_IMAGE_MAP: Record<string, string> = {
  // Mongolian names
  'лууван': 'https://images.unsplash.com/photo-1447175008436-054170c2e979?w=400&q=75&auto=format&fit=crop',
  'үхрийн мах': 'https://images.unsplash.com/photo-1546964124-0cce460c74f2?w=400&q=75&auto=format&fit=crop',
  'гахайн мах': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=75&auto=format&fit=crop',
  'тахианы мах': 'https://images.unsplash.com/photo-1604503468506-a8da13d11d36?w=400&q=75&auto=format&fit=crop',
  'сүү': 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=75&auto=format&fit=crop',
  'өндөг': 'https://images.unsplash.com/photo-1491524062933-cb0289261700?w=400&q=75&auto=format&fit=crop',
  'сонгино': 'https://images.unsplash.com/photo-1508747703725-719777637510?w=400&q=75&auto=format&fit=crop',
  'алим': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=75&auto=format&fit=crop',
  'гурил': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=75&auto=format&fit=crop',
  'бяслаг': 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&q=75&auto=format&fit=crop',
  'том': 'https://images.unsplash.com/photo-1546470427-0d4b8e6a3e4c?w=400&q=75&auto=format&fit=crop',
  'улаан лооль': 'https://images.unsplash.com/photo-1546470427-0d4b8e6a3e4c?w=400&q=75&auto=format&fit=crop',
  'мөөг': 'https://images.unsplash.com/photo-1517805686688-47dd930554b2?w=400&q=75&auto=format&fit=crop',
  'буудайн талх': 'https://images.unsplash.com/photo-1534620808146-d33bb39128b2?w=400&q=75&auto=format&fit=crop',
  'тосон': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=75&auto=format&fit=crop',
  'чинжүү': 'https://images.unsplash.com/photo-1590005354167-6da97870c757?w=400&q=75&auto=format&fit=crop',
  'часнай': 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=400&q=75&auto=format&fit=crop',
  'самар': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=75&auto=format&fit=crop',

  // English names
  'carrot': 'https://images.unsplash.com/photo-1447175008436-054170c2e979?w=400&q=75&auto=format&fit=crop',
  'beef': 'https://images.unsplash.com/photo-1546964124-0cce460c74f2?w=400&q=75&auto=format&fit=crop',
  'pork': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=75&auto=format&fit=crop',
  'chicken': 'https://images.unsplash.com/photo-1604503468506-a8da13d11d36?w=400&q=75&auto=format&fit=crop',
  'milk': 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=75&auto=format&fit=crop',
  'eggs': 'https://images.unsplash.com/photo-1491524062933-cb0289261700?w=400&q=75&auto=format&fit=crop',
  'egg': 'https://images.unsplash.com/photo-1491524062933-cb0289261700?w=400&q=75&auto=format&fit=crop',
  'onion': 'https://images.unsplash.com/photo-1508747703725-719777637510?w=400&q=75&auto=format&fit=crop',
  'apple': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=75&auto=format&fit=crop',
  'flour': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=75&auto=format&fit=crop',
  'cheese': 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&q=75&auto=format&fit=crop',
  'tomato': 'https://images.unsplash.com/photo-1546470427-0d4b8e6a3e4c?w=400&q=75&auto=format&fit=crop',
  'mushroom': 'https://images.unsplash.com/photo-1517805686688-47dd930554b2?w=400&q=75&auto=format&fit=crop',
  'pepper': 'https://images.unsplash.com/photo-1590005354167-6da97870c757?w=400&q=75&auto=format&fit=crop',
  'garlic': 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=400&q=75&auto=format&fit=crop',
  'bread': 'https://images.unsplash.com/photo-1534620808146-d33bb39128b2?w=400&q=75&auto=format&fit=crop',
  'butter': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=75&auto=format&fit=crop',
  'salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=75&auto=format&fit=crop',
  'shrimp': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&q=75&auto=format&fit=crop',
};

// ── Emoji → background gradient color for fallback card ──────────────────────
const EMOJI_GRADIENT_MAP: Record<string, string> = {
  '🥕': 'from-orange-400 to-amber-300',
  '🥩': 'from-red-400 to-rose-600',
  '🥛': 'from-sky-200 to-blue-100',
  '🥚': 'from-yellow-200 to-amber-100',
  '🧅': 'from-amber-300 to-yellow-200',
  '🍎': 'from-red-400 to-red-300',
  '🌾': 'from-amber-400 to-yellow-300',
  '🧀': 'from-yellow-400 to-amber-300',
  '🍅': 'from-red-500 to-orange-400',
  '🫑': 'from-green-400 to-emerald-300',
  '🧄': 'from-gray-100 to-slate-200',
  '🍄': 'from-amber-600 to-yellow-500',
  '📦': 'from-slate-300 to-gray-200',
  '🍋': 'from-yellow-300 to-lime-200',
  '🥦': 'from-green-500 to-emerald-400',
  '🍊': 'from-orange-400 to-amber-400',
  '🫐': 'from-indigo-400 to-purple-400',
};

/**
 * Get image URL for a named ingredient.
 * Searches by lowercase keyword match.
 */
export function getIngredientImageUrl(name: string, nameEn?: string): string | null {
  const lower = name.toLowerCase().trim();
  const lowerEn = (nameEn || '').toLowerCase().trim();

  // Try exact match first
  if (INGREDIENT_IMAGE_MAP[lower]) return INGREDIENT_IMAGE_MAP[lower];
  if (lowerEn && INGREDIENT_IMAGE_MAP[lowerEn]) return INGREDIENT_IMAGE_MAP[lowerEn];

  // Substring match
  for (const [key, url] of Object.entries(INGREDIENT_IMAGE_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return url;
    if (lowerEn && (lowerEn.includes(key) || key.includes(lowerEn))) return url;
  }

  return null;
}

/**
 * Get gradient class for an emoji fallback card background.
 */
export function getEmojiGradient(emoji: string): string {
  return EMOJI_GRADIENT_MAP[emoji] || 'from-slate-200 to-gray-100';
}
