import React, { createContext, useContext, useState, useEffect } from 'react';
import { Ingredient, SubscriptionTier, CartItem, Order, Language, Recipe, UserProfile } from '../types';
import { translations } from '../lib/i18n';
import { useInventory } from '../hooks/useInventory';
import { useOrders } from '../hooks/useOrders';

interface PendingPayment {
  amount: number;
  title: string;
  onSuccess?: () => void;
}

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
  inventory: Ingredient[];
  addIngredient: (item: Partial<Ingredient>) => void;
  updateIngredient: (item: Ingredient) => void;
  removeIngredient: (id: string) => void;
  subscription: SubscriptionTier;
  setSubscription: (tier: SubscriptionTier) => void;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  totalCartAmount: number;
  orders: Order[];
  createOrder: (address: string, paymentMethod: 'qpay' | 'socialpay' | 'card') => Order;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeCookingRecipe: Recipe | null;
  setActiveCookingRecipe: (recipe: Recipe | null) => void;

  // User profile
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;

  // Modals state
  showSubModal: boolean;
  setShowSubModal: (show: boolean) => void;
  showScanModal: boolean;
  setShowScanModal: (show: boolean) => void;
  paymentModalState: PendingPayment | null;
  triggerPayment: (amount: number, title: string, onSuccess?: () => void) => void;
  closePaymentModal: () => void;

  // Translation helper
  t: (key: keyof (typeof translations)['mn'], params?: Record<string, string | number>) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('zity_lang') as Language) || 'mn';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('zity_theme') === 'dark';
  });

  // ── TanStack Query server state ──────────────────────────────────────────
  const { inventory, addIngredient, updateIngredient, removeIngredient } = useInventory();
  const { orders, createOrder: createOrderMutation } = useOrders();

  const [subscription, setSubscriptionState] = useState<SubscriptionTier>(() => {
    return (localStorage.getItem('zity_subscription') as SubscriptionTier) || 'free';
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('zity_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<string>('fridge');
  const [activeCookingRecipe, setActiveCookingRecipe] = useState<Recipe | null>(null);

  const DEFAULT_PROFILE: UserProfile = {
    name: 'Таны Нэр',
    username: '@chef_mongolia',
    bio: 'Хоол хийх дуртай, Zity Chef-ийн хэрэглэгч 🍳',
    avatarUrl: null,
    coverGradient: 'from-violet-600 via-purple-600 to-fuchsia-600',
    accentColor: '#8B5CF6',
    postsCount: 3,
    followersCount: 128,
    followingCount: 47,
    recipesCreated: 12,
  };

  const [profile, setProfileState] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('zity_profile');
    return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE;
  });

  const setProfile = (p: UserProfile) => {
    setProfileState(p);
    localStorage.setItem('zity_profile', JSON.stringify(p));
  };

  const [showSubModal, setShowSubModal] = useState<boolean>(false);
  const [showScanModal, setShowScanModal] = useState<boolean>(false);
  const [paymentModalState, setPaymentModalState] = useState<PendingPayment | null>(null);

  useEffect(() => {
    localStorage.setItem('zity_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('zity_theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (profile?.accentColor) {
      document.documentElement.style.setProperty('--color-accent', profile.accentColor);
      document.documentElement.style.setProperty('--color-mango', profile.accentColor);
      document.documentElement.style.setProperty(
        '--color-accent-shadow',
        profile.accentColor + '55'
      );
      document.documentElement.style.setProperty(
        '--color-accent-light',
        profile.accentColor + '18'
      );
    }
  }, [profile?.accentColor]);

  useEffect(() => {
    localStorage.setItem('zity_subscription', subscription);
  }, [subscription]);

  useEffect(() => {
    localStorage.setItem('zity_cart', JSON.stringify(cart));
  }, [cart]);

  const toggleDarkMode = () => setIsDark((prev) => !prev);

  const setSubscription = (tier: SubscriptionTier) => {
    setSubscriptionState(tier);
  };

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.name === item.name);
      if (existing) {
        return prev.map((i) =>
          i.name === item.name
            ? {
                ...i,
                quantity: i.quantity + item.quantity,
                totalPrice: (i.quantity + item.quantity) * i.pricePerUnit,
              }
            : i
        );
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => setCart([]);

  const totalCartAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleCreateOrder = (
    address: string,
    paymentMethod: 'qpay' | 'socialpay' | 'card'
  ): Order => {
    const newOrder: Order = {
      id: `ZITY-${Math.floor(100000 + Math.random() * 900000)}`,
      items: [...cart],
      totalAmount: totalCartAmount,
      status: 'paid',
      paymentMethod,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      address,
    };

    createOrderMutation({
      items: cart,
      totalAmount: totalCartAmount,
      deliveryAddress: address,
      paymentMethod,
    });

    clearCart();
    return newOrder;
  };

  const triggerPayment = (amount: number, title: string, onSuccess?: () => void) => {
    setPaymentModalState({ amount, title, onSuccess });
  };

  const closePaymentModal = () => {
    setPaymentModalState(null);
  };

  const t = (
    key: keyof (typeof translations)['mn'],
    params?: Record<string, string | number>
  ): string => {
    let str = translations[lang][key] || translations['mn'][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  };

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        isDark,
        toggleDarkMode,
        inventory: inventory || [],
        addIngredient,
        updateIngredient,
        removeIngredient,
        subscription,
        setSubscription,
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        totalCartAmount,
        orders: (orders as unknown as Order[]) || [],
        createOrder: handleCreateOrder,
        activeTab,
        setActiveTab,
        activeCookingRecipe,
        setActiveCookingRecipe,
        profile,
        setProfile,
        showSubModal,
        setShowSubModal,
        showScanModal,
        setShowScanModal,
        paymentModalState,
        triggerPayment,
        closePaymentModal,
        t,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
