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
  /** Shelf life in days, used when the product is added to the fridge. */
  expiryDays: number;
}

/** What delivery costs, so the cart can show a total before checkout. */
export interface DeliveryTerms {
  fee: number;
  /** Basket value from which delivery is free; 0 when there is no such rule. */
  freeFrom: number;
}

const NO_PRODUCTS: StoreProduct[] = [];
const NO_DELIVERY: DeliveryTerms = { fee: 0, freeFrom: 0 };

interface Catalog {
  products: StoreProduct[];
  delivery: DeliveryTerms;
}

async function fetchProducts(): Promise<Catalog> {
  const res = await fetch(`${API_BASE}/api/store/products`);
  if (!res.ok) throw new Error('Failed to load products');
  const data = await res.json();
  return {
    products: data.products || NO_PRODUCTS,
    delivery: {
      fee: Number(data.delivery?.fee ?? 0),
      freeFrom: Number(data.delivery?.freeFrom ?? 0),
    },
  };
}

export function useStoreProducts() {
  const query = useQuery({
    queryKey: ['store', 'products'],
    queryFn: fetchProducts,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  return {
    products: query.data?.products ?? NO_PRODUCTS,
    delivery: query.data?.delivery ?? NO_DELIVERY,
    loading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
