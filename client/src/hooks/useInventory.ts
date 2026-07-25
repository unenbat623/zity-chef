import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ingredient } from '../types';
import { MOCK_INGREDIENTS } from '../constants';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

async function fetchInventory(): Promise<Ingredient[]> {
  try {
    const res = await fetch(`${API_BASE}/api/inventory`);
    if (!res.ok) throw new Error('Failed to fetch inventory');
    const data = await res.json();
    return data.items || MOCK_INGREDIENTS;
  } catch {
    return MOCK_INGREDIENTS;
  }
}

async function addInventoryItem(item: Partial<Ingredient>): Promise<Ingredient> {
  const res = await fetch(`${API_BASE}/api/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error('Failed to add item');
  const data = await res.json();
  return data.item;
}

async function updateInventoryItem(item: Ingredient): Promise<Ingredient> {
  try {
    const res = await fetch(`${API_BASE}/api/inventory/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) return item;
    const data = await res.json();
    return data.item;
  } catch {
    return item;
  }
}

async function deleteInventoryItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/inventory/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete item');
}

export function useInventory() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['inventory'],
    queryFn: fetchInventory,
    initialData: MOCK_INGREDIENTS,
  });

  const addItemMutation = useMutation({
    mutationFn: addInventoryItem,
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['inventory'] });
      const previous = queryClient.getQueryData<Ingredient[]>(['inventory']) || [];
      const tempItem: Ingredient = {
        id: newItem.id || `temp-${Date.now()}`,
        name: newItem.name || 'Шинэ материал',
        emoji: newItem.emoji || '📦',
        category: newItem.category || '🥦 Ногоо',
        quantity: newItem.quantity || 1,
        unit: newItem.unit || 'ш',
        expiryDays: newItem.expiryDays || 7,
        pricePerUnit: newItem.pricePerUnit || 3000,
        imageUrl: newItem.imageUrl,
      };
      queryClient.setQueryData(['inventory'], [tempItem, ...previous]);
      return { previous };
    },
    onError: (_err, _newItem, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['inventory'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: updateInventoryItem,
    onMutate: async (updatedItem) => {
      await queryClient.cancelQueries({ queryKey: ['inventory'] });
      const previous = queryClient.getQueryData<Ingredient[]>(['inventory']) || [];
      queryClient.setQueryData(
        ['inventory'],
        previous.map((i) => (i.id === updatedItem.id ? { ...i, ...updatedItem } : i))
      );
      return { previous };
    },
    onError: (_err, _updatedItem, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['inventory'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: deleteInventoryItem,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['inventory'] });
      const previous = queryClient.getQueryData<Ingredient[]>(['inventory']) || [];
      queryClient.setQueryData(
        ['inventory'],
        previous.filter((item) => item.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['inventory'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  return {
    inventory: query.data,
    isLoading: query.isLoading,
    addIngredient: addItemMutation.mutate,
    updateIngredient: updateItemMutation.mutate,
    removeIngredient: removeItemMutation.mutate,
  };
}
