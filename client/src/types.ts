export type Category = '🥦 Ногоо' | '🥩 Мах' | '🥛 Сүү, өндөг' | '🧂 Амтлагч' | '🍎 Жимс';

export type Language = 'mn' | 'en';

export type SubscriptionTier = 'free' | 'pro' | 'family';

export type PaymentMethod = 'qpay' | 'socialpay' | 'card';

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

export interface RecipeStep {
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  image: string;
  sisterTip: string;
  sisterTipEn?: string;
  timerMinutes?: number;
}

export interface Recipe {
  id: string;
  title: string;
  titleEn?: string;
  image: string;
  time: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  cuisine?: string;
  ingredients: string[];
  ingredientsEn?: string[];
  nutrition: NutritionalInfo;
  steps: RecipeStep[];
  isPremium?: boolean;
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
  icon: string;
  color: string;
  deepLink: string;
}
