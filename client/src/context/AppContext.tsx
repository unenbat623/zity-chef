import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Ingredient, SubscriptionTier, CartItem, Order, Language, Recipe, UserProfile, Currency, UnitSystem } from '../types';
import { translations } from '../lib/i18n';
import { formatCurrency } from '../lib/currency';
import { useInventory } from '../hooks/useInventory';
import { useOrders } from '../hooks/useOrders';

interface PendingPayment {
  amount: number;
  title: string;
  onSuccess?: (paymentMethod: 'qpay' | 'socialpay' | 'card') => void;
  preferredMethod?: 'qpay' | 'socialpay' | 'card';
}

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
  formatPrice: (amountInMNT: number) => string;
  isDark: boolean;
  toggleDarkMode: () => void;
  inventory: Ingredient[];
  inventoryLoading: boolean;
  inventoryError: boolean;
  refetchInventory: () => void;
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
  ordersLoading: boolean;
  ordersError: boolean;
  createOrder: (address: string, paymentMethod: 'qpay' | 'socialpay' | 'card') => Order;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeCookingRecipe: Recipe | null;
  setActiveCookingRecipe: (recipe: Recipe | null) => void;

  // User profile & saved recipes
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  savedRecipeIds: string[];
  toggleSaveRecipe: (recipeId: string) => void;

  // Modals state
  showSubModal: boolean;
  setShowSubModal: (show: boolean) => void;
  showScanModal: boolean;
  setShowScanModal: (show: boolean) => void;
  paymentModalState: PendingPayment | null;
  triggerPayment: (
    amount: number,
    title: string,
    onSuccess?: (paymentMethod: 'qpay' | 'socialpay' | 'card') => void,
    preferredMethod?: 'qpay' | 'socialpay' | 'card'
  ) => void;
  closePaymentModal: () => void;

  // Translation helper (accepts any key; falls back to mn then the key itself)
  t: (key: string, params?: Record<string, string | number>) => string;
}

const VALID_TABS = ['fridge', 'calendar', 'cooking', 'store', 'recipe', 'community', 'dashboard', 'profile', 'help'];
const SUPPORTED_LANGUAGES: Language[] = ['mn', 'en'];

function getStoredLanguage(): Language {
  const saved = localStorage.getItem('zity_lang') as Language | null;
  return saved && SUPPORTED_LANGUAGES.includes(saved) ? saved : 'mn';
}

function getTabFromUrl(): string {
  if (typeof window === 'undefined') return 'fridge';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return tab && VALID_TABS.includes(tab) ? tab : 'fridge';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    return getStoredLanguage();
  });

  const [currency, setCurrency] = useState<Currency>(() => {
    return (localStorage.getItem('zity_currency') as Currency) || 'MNT';
  });

  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => {
    return (localStorage.getItem('zity_unit_system') as UnitSystem) || 'metric';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('zity_theme') === 'dark';
  });

  // ── TanStack Query server state ──────────────────────────────────────────
  const {
    inventory,
    isLoading: inventoryLoading,
    isError: inventoryError,
    refetch: refetchInventory,
    addIngredient,
    updateIngredient,
    removeIngredient,
  } = useInventory();
  const {
    orders,
    isLoading: ordersLoading,
    isError: ordersError,
    createOrder: createOrderMutation,
  } = useOrders();

  const [subscription, setSubscriptionState] = useState<SubscriptionTier>(() => {
    return (localStorage.getItem('zity_subscription') as SubscriptionTier) || 'free';
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('zity_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTabState] = useState<string>(getTabFromUrl);
  const [activeCookingRecipe, setActiveCookingRecipe] = useState<Recipe | null>(null);

  // Keep the active tab in the URL so deep links (?tab=recipe), the browser back
  // button, and the PWA manifest shortcuts all work.
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({ tab }, '', url);
  }, []);

  useEffect(() => {
    const onPop = () => setActiveTabState(getTabFromUrl());
    window.addEventListener('popstate', onPop);
    // Ensure the initial entry carries the current tab (for a clean first Back).
    const url = new URL(window.location.href);
    if (!url.searchParams.get('tab')) {
      url.searchParams.set('tab', activeTab);
      window.history.replaceState({ tab: activeTab }, '', url);
    }
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const DEFAULT_PROFILE: UserProfile = {
    name: 'Таны Нэр',
    username: '@chef_mongolia',
    bio: 'Хоол хийх дуртай, Zity Chef-ийн хэрэглэгч 🍳',
    avatarUrl: null,
    coverGradient: 'from-emerald-600 via-teal-600 to-slate-800',
    accentColor: '#10B981',
    postsCount: 3,
    followersCount: 128,
    followingCount: 47,
    recipesCreated: 12,
  };

  const [profile, setProfileState] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('zity_profile');
    if (!saved) return DEFAULT_PROFILE;

    const parsed = { ...DEFAULT_PROFILE, ...JSON.parse(saved) };
    const hasLegacyDefaultTheme =
      parsed.accentColor === '#8B5CF6' &&
      parsed.coverGradient === 'from-violet-600 via-purple-600 to-fuchsia-600';

    return hasLegacyDefaultTheme
      ? {
          ...parsed,
          coverGradient: DEFAULT_PROFILE.coverGradient,
          accentColor: DEFAULT_PROFILE.accentColor,
        }
      : parsed;
  });

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    localStorage.setItem('zity_profile', JSON.stringify(p));
  }, []);

  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('zity_saved_recipes');
    return saved ? JSON.parse(saved) : ['r1', 'r3'];
  });

  const toggleSaveRecipe = useCallback((recipeId: string) => {
    setSavedRecipeIds((prev) => {
      const next = prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId];
      localStorage.setItem('zity_saved_recipes', JSON.stringify(next));
      return next;
    });
  }, []);

  const [showSubModal, setShowSubModal] = useState<boolean>(false);
  const [showScanModal, setShowScanModal] = useState<boolean>(false);
  const [paymentModalState, setPaymentModalState] = useState<PendingPayment | null>(null);

  useEffect(() => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      setLang('mn');
      return;
    }
    localStorage.setItem('zity_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('zity_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('zity_unit_system', unitSystem);
  }, [unitSystem]);

  const formatPrice = useCallback((amountInMNT: number) => {
    return formatCurrency(amountInMNT, currency);
  }, [currency]);

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

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.newValue === null) return;

      try {
        if (event.key === 'zity_cart') {
          setCart(JSON.parse(event.newValue));
        } else if (event.key === 'zity_profile') {
          setProfileState({ ...DEFAULT_PROFILE, ...JSON.parse(event.newValue) });
        } else if (event.key === 'zity_saved_recipes') {
          setSavedRecipeIds(JSON.parse(event.newValue));
        } else if (event.key === 'zity_subscription') {
          setSubscriptionState(event.newValue as SubscriptionTier);
        }
      } catch {
        // Ignore malformed cross-tab payloads; the current tab keeps its state.
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleDarkMode = useCallback(() => setIsDark((prev) => !prev), []);

  const setSubscription = useCallback((tier: SubscriptionTier) => {
    setSubscriptionState(tier);
  }, []);

  const addToCart = useCallback((item: CartItem) => {
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
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const totalCartAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleCreateOrder = useCallback(
    (address: string, paymentMethod: 'qpay' | 'socialpay' | 'card'): Order => {
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
    },
    [cart, totalCartAmount, createOrderMutation, clearCart]
  );

  const triggerPayment = useCallback(
    (
      amount: number,
      title: string,
      onSuccess?: (paymentMethod: 'qpay' | 'socialpay' | 'card') => void,
      preferredMethod: 'qpay' | 'socialpay' | 'card' = 'card'
    ) => {
      setPaymentModalState({ amount, title, onSuccess, preferredMethod });
    },
    []
  );

  const closePaymentModal = useCallback(() => {
    setPaymentModalState(null);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dictMn = translations.mn as Record<string, string>;
      const dict = translations[lang] as Record<string, string>;
      let str = dict[key] || dictMn[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          str = str.replace(`{${k}}`, String(v));
        });
      }
      return str;
    },
    [lang]
  );

  const handleRefetchInventory = useCallback(() => {
    refetchInventory();
  }, [refetchInventory]);

  const value = useMemo<AppContextType>(
    () => ({
      lang,
      setLang,
      currency,
      setCurrency,
      unitSystem,
      setUnitSystem,
      formatPrice,
      isDark,
      toggleDarkMode,
      inventory: inventory || [],
      inventoryLoading,
      inventoryError,
      refetchInventory: handleRefetchInventory,
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
      ordersLoading,
      ordersError,
      createOrder: handleCreateOrder,
      activeTab,
      setActiveTab,
      activeCookingRecipe,
      setActiveCookingRecipe,
      profile,
      setProfile,
      savedRecipeIds,
      toggleSaveRecipe,
      showSubModal,
      setShowSubModal,
      showScanModal,
      setShowScanModal,
      paymentModalState,
      triggerPayment,
      closePaymentModal,
      t,
    }),
    [
      lang,
      currency,
      unitSystem,
      formatPrice,
      isDark,
      toggleDarkMode,
      inventory,
      inventoryLoading,
      inventoryError,
      handleRefetchInventory,
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
      orders,
      ordersLoading,
      ordersError,
      handleCreateOrder,
      activeTab,
      activeCookingRecipe,
      profile,
      setProfile,
      savedRecipeIds,
      toggleSaveRecipe,
      showSubModal,
      showScanModal,
      paymentModalState,
      triggerPayment,
      closePaymentModal,
      t,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
