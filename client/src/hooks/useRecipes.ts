import { useQuery } from '@tanstack/react-query';
import { authedFetch } from '../lib/apiClient';
import { MOCK_RECIPES } from '../data/recipes';
import type { Recipe } from '../types';

/**
 * Fetches recipes from the backend API.
 * Falls back to MOCK_RECIPES if the server returns an error or is unreachable —
 * this ensures the app always has content to display even in offline/demo mode.
 */
async function fetchRecipes(): Promise<Recipe[]> {
  try {
    const res = await authedFetch('/api/recipes');
    if (!res.ok) return MOCK_RECIPES;
    const data = await res.json();
    const recipes = data.recipes;
    // If Supabase has no rows yet, fall back to the bundled mock data
    if (!Array.isArray(recipes) || recipes.length === 0) return MOCK_RECIPES;
    return recipes as Recipe[];
  } catch {
    return MOCK_RECIPES;
  }
}

export function useRecipes() {
  const query = useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn: fetchRecipes,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  return {
    recipes: query.data ?? MOCK_RECIPES,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
