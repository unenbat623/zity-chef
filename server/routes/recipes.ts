import express from 'express';
import { isSupabaseConfigured, supabasePublic } from '../supabase.js';

const router = express.Router();

/**
 * The catalog lives in Postgres (`public.recipes`, seeded by migration). There
 * used to be a two-recipe copy hardcoded here as a fallback, which quietly
 * replaced the real catalog whenever a query failed — users saw a two-recipe
 * app and nothing said why. A failure is now reported as one.
 */
interface RecipeRow {
  id: string;
  title: string;
  title_en: string | null;
  image: string | null;
  tags: string[] | null;
  time: string | null;
  difficulty: string | null;
  category: string | null;
  cuisine: string | null;
  nutrition: unknown;
  ingredients: string[] | null;
  steps: unknown;
}

/** Postgres columns are snake_case; the client's Recipe type is camelCase. */
function toRecipe(row: RecipeRow) {
  return {
    id: row.id,
    title: row.title,
    titleEn: row.title_en ?? undefined,
    image: row.image,
    tags: row.tags ?? [],
    time: row.time,
    difficulty: row.difficulty,
    category: row.category,
    cuisine: row.cuisine,
    nutrition: row.nutrition ?? {},
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
  };
}

function catalogUnavailable(res: express.Response) {
  return res.status(503).json({ error: 'CATALOG_UNAVAILABLE' });
}

// ── GET /api/recipes (list recipes) ──────────────────────────────────────────
router.get('/', async (_req, res) => {
  if (!isSupabaseConfigured || !supabasePublic) return catalogUnavailable(res);

  const { data, error } = await supabasePublic
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Recipes list error]', error.message);
    return catalogUnavailable(res);
  }

  return res.json({ recipes: (data || []).map((r) => toRecipe(r as RecipeRow)), source: 'supabase' });
});

// ── GET /api/recipes/:id (single recipe) ────────────────────────────────────
router.get('/:id', async (req, res) => {
  if (!isSupabaseConfigured || !supabasePublic) return catalogUnavailable(res);

  const { data, error } = await supabasePublic
    .from('recipes')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) {
    console.error('[Recipe fetch error]', error.message);
    return catalogUnavailable(res);
  }
  // This route only ever searched the two hardcoded recipes, so every real
  // catalog id 404'd here.
  if (!data) return res.status(404).json({ error: 'Recipe not found' });

  return res.json({ recipe: toRecipe(data as RecipeRow) });
});

export default router;
