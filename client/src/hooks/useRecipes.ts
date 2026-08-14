import { useQuery } from '@tanstack/react-query';
import { authedFetch } from '../lib/apiClient';
import type { Recipe } from '../types';

/**
 * The recipe catalog, served from the database.
 *
 * A bundled copy used to stand in whenever the request failed or came back
 * empty, so a broken catalog looked like a working app with different content
 * — and the 25 bundled recipes silently replaced whatever the database held.
 * Callers now get an explicit empty list plus `isError`, and render a state
 * that says so.
 */
async function fetchRecipes(): Promise<Recipe[]> {
  const res = await authedFetch('/api/recipes');
  if (!res.ok) throw new Error(`Failed to load recipes (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.recipes) ? (data.recipes as Recipe[]) : [];
}

// Frozen so an empty result keeps a stable identity across renders.
const NO_RECIPES: Recipe[] = [];

export function useRecipes() {
  const query = useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn: fetchRecipes,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    recipes: query.data ?? NO_RECIPES,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
