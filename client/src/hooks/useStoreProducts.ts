import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '../lib/apiClient';

export interface StoreProduct {
  id: string;
  name: string;
  nameEn: string | null;
  emoji: string;
  category: string | null;
  unit: string;
  pricePerUnit: number;
  imageUrl: string | null;
}

async function fetchProducts(): Promise<StoreProduct[]> {
  const res = await fetch(`${API_BASE}/api/store/products`);
  if (!res.ok) throw new Error('Failed to load products');
  const data = await res.json();
  return data.products || [];
}

export function useStoreProducts() {
  const query = useQuery({ queryKey: ['store', 'products'], queryFn: fetchProducts });
  return { products: query.data ?? [], loading: query.isLoading };
}
