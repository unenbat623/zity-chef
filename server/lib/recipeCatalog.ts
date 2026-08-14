import { isSupabaseConfigured, supabasePublic } from '../supabase.js';

interface CatalogEntry {
  id: string;
  title: string;
  category?: string | null;
  time?: string | null;
  ingredients: string[];
}

let cache: { entries: CatalogEntry[]; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

/**
 * The recipe ids the assistant is allowed to hand back.
 *
 * The prompt asks the model to emit [ACTION: OPEN_COOKING_MODE, RECIPE_ID: 'id']
 * but never told it which ids exist, so it invented them; the client's
 * `recipes.find(...)` then missed and silently opened `recipes[0]` — the user
 * got a different dish from the one the assistant had just described.
 */
export async function getRecipeCatalog(): Promise<CatalogEntry[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.entries;
  if (!isSupabaseConfigured || !supabasePublic) return cache?.entries ?? [];

  try {
    const { data, error } = await supabasePublic
      .from('recipes')
      .select('id,title,category,time,ingredients')
      .limit(120);
    if (error || !data) return cache?.entries ?? [];

    const entries: CatalogEntry[] = data.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      category: r.category,
      time: r.time,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(String) : [],
    }));
    cache = { entries, at: Date.now() };
    return entries;
  } catch {
    return cache?.entries ?? [];
  }
}

/** Compact, token-cheap rendering of the catalog for the system prompt. */
export function renderCatalog(entries: CatalogEntry[], limit = 40): string {
  if (!entries.length) return '';
  return entries
    .slice(0, limit)
    .map((r) => `- ${r.id} | ${r.title}${r.category ? ` (${r.category})` : ''} | ${r.ingredients.slice(0, 6).join(', ')}`)
    .join('\n');
}
