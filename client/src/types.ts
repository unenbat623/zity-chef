import type { ReactNode } from 'react';

export type Category = '🥦 Ногоо' | '🥩 Мах' | '🥛 Сүү, өндөг' | '🧂 Амтлагч' | '🍎 Жимс';

export type Language = 'mn' | 'en';

export type Currency = 'MNT' | 'USD' | 'EUR' | 'JPY' | 'KRW';

export type UnitSystem = 'metric' | 'imperial';

export type SubscriptionTier = 'free' | 'pro' | 'family';

export type PaymentMethod = 'qpay' | 'socialpay' | 'card' | 'stripe' | 'paypal' | 'applepay';

export interface NutritionalInfo {
  calories: number; // kcal
  protein: number; // g
  carbs: number; // g
  fat: number; // g
}

export interface Ingredient {
  id: string;
  name: string;
  nameEn?: string;
  emoji: string;
  category: Category;
  quantity: number;
  unit: 'гр' | 'л' | 'ш' | 'g' | 'l' | 'pcs';
  expiryDays: number;
  pricePerUnit?: number; // ₮
  imageUrl?: string;
}

export type RecipeCategory =
  | 'Өглөөний цай'
  | 'Салат ба Хөнгөн зууш'
  | 'Үндсэн хоол'
  | 'Шөл ба Бүлээн хоол'
  | 'Эрүүл дессерт ба Ундаа';

export interface RecipeStep {
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  image: string;
  sisterTip: string;
  sisterTipEn?: string;
  timerMinutes?: number;
  heatLevel?: 'High' | 'Medium' | 'Low' | 'Simmer';
  stepIngredients?: string[];
  toolsNeeded?: string[];
}

export interface Recipe {
  id: string;
  title: string;
  titleEn?: string;
  image: string;
  time: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  cuisine?: string;
  category?: RecipeCategory;
  ingredients: string[];
  ingredientsEn?: string[];
  nutrition: NutritionalInfo;
  steps: RecipeStep[];
  isPremium?: boolean;
  rating?: number;
  tags?: string[];
}

export interface MealPlanDay {
  day: string;
  dayEn: string;
  date: string;
  recipe?: Recipe;
  targetCalories?: number;
}

export interface CartItem {
  id: string;
  /** The store_products id this line resolves to. The server re-prices every
   *  order from the catalog by this id — a line without one can't be bought. */
  productId?: string;
  name: string;
  emoji: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  totalAmount: number;
  status: 'pending' | 'paid' | 'delivering' | 'completed';
  paymentMethod: PaymentMethod;
  createdAt: string;
  address: string;
}

export type OrderRecord = Order;

export interface BankApp {
  id: string;
  name: string;
  icon: string; // emoji fallback
  svgLogo: ReactNode;
  color: string;
  deepLink: string;
}

/** Another chef, as the feed/stories know them. `id` is their Supabase uid. */
export interface CommunityUser {
  id?: string;
  name: string;
  avatar: string;
}

export interface UserProfile {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string | null;       // base64 or URL
  coverGradient: string;          // tailwind gradient class
  accentColor: string;            // hex or tailwind color token
  postsCount: number;
  followersCount: number;
  followingCount: number;
  recipesCreated: number;
}
