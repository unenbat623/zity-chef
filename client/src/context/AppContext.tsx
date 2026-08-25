import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Ingredient,
  SubscriptionTier,
  CartItem,
  Order,
  Language,
  Recipe,
  UserProfile,
  Currency,
  UnitSystem,
} from '../types';
import { translations, loadLanguage } from '../lib/i18n';
import { formatCurrency } from '../lib/currency';
import { ensureContrast, readableTextOn } from '../lib/contrast';
import { useInventory } from '../hooks/useInventory';
import { useOrders } from '../hooks/useOrders';
import { useAiQuota } from '../hooks/useAiQuota';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface PendingPayment {
  amount: number;
  title: string;
  /** invoiceId identifies the verified payment; order creation must pass it
   *  back so the server can match the order against what was actually paid. */
  onSuccess?: (paymentMethod: 'qpay' | 'socialpay' | 'card', invoiceId?: string) => void;
  preferredMethod?: 'qpay' | 'socialpay' | 'card';
  /** Set when the invoice buys a subscription, so the server can grant it. */
  plan?: 'pro' | 'family';
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
  /** Brings every cart line back in line with the catalog's current price. */
  repriceCart: (priceOf: (productId: string) => number | null | undefined) => void;
  totalCartAmount: number;
  orders: Order[];
  ordersLoading: boolean;
  ordersError: boolean;
  /**
   * Places the paid basket. Resolves with the order the server actually
   * created — never a locally invented one — or rejects with an OrderError the
   * caller is expected to show. The cart is only cleared on success.
   */
  createOrder: (
    address: string,
    paymentMethod: 'qpay' | 'socialpay' | 'card',
    invoiceId?: string,
    redeemPoints?: number
  ) => Promise<Order>;
  cancelOrder: (orderId: string) => Promise<void>;
  cancellingOrder: boolean;
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
    onSuccess?: (paymentMethod: 'qpay' | 'socialpay' | 'card', invoiceId?: string) => void,
    preferredMethod?: 'qpay' | 'socialpay' | 'card',
    plan?: 'pro' | 'family'
  ) => void;
  closePaymentModal: () => void;

  /** Id of the signed-in (or anonymous) account, for scoping local storage. */
  accountId: string;

  // Translation helper (accepts any key; falls back to mn then the key itself)
  t: (key: string, params?: Record<string, string | number>) => string;
}

const VALID_TABS = [
  'fridge',
  'calendar',
  'cooking',
  'store',
  'recipe',
  'community',
  'dashboard',
  'profile',
  'help',
];
const SUPPORTED_LANGUAGES: Language[] = ['mn', 'en'];
const DEFAULT_SAVED_RECIPE_IDS: string[] = [];
const DEFAULT_PROFILE: UserProfile = {
  name: 'Таны Нэр',
  username: '@chef_mongolia',
  bio: 'Хоол хийх дуртай, Zity Chef-ийн хэрэглэгч 🍳',
  avatarUrl: null,
  coverGradient: 'from-emerald-600 via-teal-600 to-slate-800',
  accentColor: '#10B981',
  postsCount: 0,
  followersCount: 0,
  followingCount: 0,
  recipesCreated: 0,
};

function getStoredLanguage(): Language {
  const saved = localStorage.getItem('zity_lang') as Language | null;
  return saved && SUPPORTED_LANGUAGES.includes(saved) ? saved : 'mn';
}

function getTabFromUrl(): string {
  if (typeof window === 'undefined') return 'fridge';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return tab && VALID_TABS.includes(tab) ? tab : 'fridge';
}

function readStoredJson<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;

  try {
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

function getScopedKey(base: string, accountId: string): string {
  return `${base}:${accountId}`;
}

function normalizeProfile(profile: Partial<UserProfile> | null | undefined): UserProfile {
  const parsed = { ...DEFAULT_PROFILE, ...(profile ?? {}) };
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, isAnonymous } = useAuth();
  const accountId = authUser?.id ?? 'local';
  // State, not a ref: a ref set inside the hydration effect is already equal by
  // the time the persist effects run in the SAME commit, so they would write the
  // outgoing account's still-unapplied state into the incoming account's keys.
  const [hydratedAccount, setHydratedAccount] = useState<string | null>(null);

  const [lang, setLang] = useState<Language>(() => {
    return getStoredLanguage();
  });

  // Switching to a language whose chunk is not here yet: load it, then re-render
  // so `t()` stops falling back to Mongolian.
  const [languageRevision, setLanguageRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void loadLanguage(lang).then(() => {
      if (!cancelled) setLanguageRevision((revision) => revision + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const [currency, setCurrency] = useState<Currency>(() => {
    return (localStorage.getItem('zity_currency') as Currency) || 'MNT';
  });

  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => {
    return (localStorage.getItem('zity_unit_system') as UnitSystem) || 'metric';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    // Explicit choice wins; otherwise follow the OS (same logic as the inline
    // pre-hydration script in index.html, so React agrees with the first paint).
    const stored = localStorage.getItem('zity_theme');
    if (stored) return stored === 'dark';
    return (
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    );
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
    cancelOrder,
    cancellingOrder,
  } = useOrders();

  // The tier of record lives in Postgres. localStorage is only a first paint
  // hint — trusting it would let anyone hand themselves Pro from DevTools.
  const { quota: aiQuota } = useAiQuota();

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

  const [profile, setProfileState] = useState<UserProfile>(() => {
    return normalizeProfile(readStoredJson<Partial<UserProfile>>('zity_profile', DEFAULT_PROFILE));
  });

  const setProfile = useCallback(
    (p: UserProfile) => {
      setProfileState(p);
      // Push the identity fields to Postgres so the edit survives a reload.
      // Previously the profile lived in localStorage only, and hydration
      // overwrote the name from auth metadata on every visit.
      if (supabase && authUser && !isAnonymous) {
        void supabase
          .from('profiles')
          .update({ display_name: p.name, avatar_url: p.avatarUrl || null })
          .eq('id', authUser.id)
          .then(({ error }) => {
            if (error) console.warn('[Zity Chef] Profile save failed:', error.message);
          });
      }
    },
    [authUser, isAnonymous]
  );

  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('zity_saved_recipes');
    return saved ? JSON.parse(saved) : DEFAULT_SAVED_RECIPE_IDS;
  });

  const toggleSaveRecipe = useCallback((recipeId: string) => {
    setSavedRecipeIds((prev) => {
      const next = prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId];
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

  const accountStorage = useMemo(
    () => ({
      profile: getScopedKey('zity_profile', accountId),
      cart: getScopedKey('zity_cart', accountId),
      savedRecipes: getScopedKey('zity_saved_recipes', accountId),
      subscription: getScopedKey('zity_subscription', accountId),
    }),
    [accountId]
  );

  useEffect(() => {
    const hasRealAccount = Boolean(authUser && !isAnonymous);
    const metadata = authUser?.user_metadata ?? {};
    const displayName =
      (metadata.full_name as string | undefined) ||
      (metadata.name as string | undefined) ||
      authUser?.email?.split('@')[0] ||
      authUser?.phone ||
      DEFAULT_PROFILE.name;
    const username = authUser?.email
      ? `@${authUser.email.split('@')[0]}`
      : authUser?.phone
        ? `@${authUser.phone}`
        : DEFAULT_PROFILE.username;
    const avatarUrl =
      (metadata.avatar_url as string | undefined) ||
      (metadata.picture as string | undefined) ||
      null;

    const legacyAllowed = !hasRealAccount;
    const storedProfileKey = localStorage.getItem(accountStorage.profile)
      ? accountStorage.profile
      : legacyAllowed && localStorage.getItem('zity_profile')
        ? 'zity_profile'
        : null;
    const nextProfile = normalizeProfile(
      storedProfileKey
        ? readStoredJson<Partial<UserProfile>>(storedProfileKey, DEFAULT_PROFILE)
        : DEFAULT_PROFILE
    );

    setProfileState(
      hasRealAccount
        ? {
            ...nextProfile,
            // Auth metadata is a FALLBACK, not the source of truth: it used to
            // overwrite these unconditionally, so a name edited in the profile
            // screen was reset to the signup value on every reload.
            name: storedProfileKey ? nextProfile.name : displayName,
            username: storedProfileKey ? nextProfile.username : username,
            avatarUrl: nextProfile.avatarUrl || avatarUrl,
            postsCount: 0,
            followersCount: 0,
            followingCount: 0,
            recipesCreated: 0,
          }
        : nextProfile
    );

    // The database is authoritative across devices — reconcile once the row
    // is read, without waiting for it on first paint.
    if (hasRealAccount && supabase && authUser) {
      void supabase
        .from('profiles')
        .select('display_name,avatar_url')
        .eq('id', authUser.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          setProfileState((prev) => ({
            ...prev,
            name: (data.display_name as string) || prev.name,
            avatarUrl: (data.avatar_url as string) || prev.avatarUrl,
          }));
        });
    }

    setSubscriptionState(
      (localStorage.getItem(accountStorage.subscription) as SubscriptionTier | null) ||
        (legacyAllowed
          ? (localStorage.getItem('zity_subscription') as SubscriptionTier | null)
          : null) ||
        'free'
    );
    setCart(
      localStorage.getItem(accountStorage.cart)
        ? readStoredJson<CartItem[]>(accountStorage.cart, [])
        : legacyAllowed
          ? readStoredJson<CartItem[]>('zity_cart', [])
          : []
    );
    setSavedRecipeIds(
      localStorage.getItem(accountStorage.savedRecipes)
        ? readStoredJson<string[]>(accountStorage.savedRecipes, DEFAULT_SAVED_RECIPE_IDS)
        : legacyAllowed
          ? readStoredJson<string[]>('zity_saved_recipes', DEFAULT_SAVED_RECIPE_IDS)
          : DEFAULT_SAVED_RECIPE_IDS
    );
    setHydratedAccount(accountId);
  }, [accountId, accountStorage, authUser, isAnonymous]);

  // Server tier wins as soon as it arrives — the local value is a hint only.
  useEffect(() => {
    if (aiQuota.limit > 0 && aiQuota.tier !== subscription) {
      setSubscriptionState(aiQuota.tier);
    }
  }, [aiQuota.tier, aiQuota.limit, subscription]);

  const formatPrice = useCallback(
    (amountInMNT: number) => {
      return formatCurrency(amountInMNT, currency);
    },
    [currency]
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Keep the browser chrome (status bar) on the app's actual background —
    // the static media-query metas track the OS, not the in-app toggle.
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute('content', isDark ? '#0B0F17' : '#F8FAFB'));
  }, [isDark]);

  // Derive accessible shades from the (user-picked) accent. The accent plays two
  // roles that need opposite adjustments: a filled surface behind white text,
  // and a text/icon colour on the page background — so each gets its own token.
  useEffect(() => {
    const accent = profile?.accentColor;
    if (!accent) return;

    // Check the ink against the worst-case surface it actually lands on: in dark
    // mode that is the card (#131A26), which is lighter than the page; in light
    // mode it is the page (#F8FAFB), which is darker than the white card.
    const inkBg = isDark ? '#131A26' : '#F8FAFB';
    const surface = ensureContrast(accent, '#FFFFFF', 4.5);
    const ink = ensureContrast(accent, inkBg, 4.5);
    const root = document.documentElement.style;

    root.setProperty('--color-accent', surface);
    root.setProperty('--color-accent-ink', ink);
    root.setProperty('--color-accent-fg', readableTextOn(surface));
    root.setProperty('--color-accent-shadow', accent + '55');
    root.setProperty('--color-accent-light', accent + '18');
  }, [profile?.accentColor, isDark]);

  useEffect(() => {
    if (hydratedAccount !== accountId) return;
    localStorage.setItem(accountStorage.subscription, subscription);
  }, [accountId, hydratedAccount, accountStorage.subscription, subscription]);

  useEffect(() => {
    if (hydratedAccount !== accountId) return;
    localStorage.setItem(accountStorage.cart, JSON.stringify(cart));
  }, [accountId, hydratedAccount, accountStorage.cart, cart]);

  useEffect(() => {
    if (hydratedAccount !== accountId) return;
    localStorage.setItem(accountStorage.profile, JSON.stringify(profile));
  }, [accountId, hydratedAccount, accountStorage.profile, profile]);

  useEffect(() => {
    if (hydratedAccount !== accountId) return;
    localStorage.setItem(accountStorage.savedRecipes, JSON.stringify(savedRecipeIds));
  }, [accountId, hydratedAccount, accountStorage.savedRecipes, savedRecipeIds]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.newValue === null) return;

      try {
        if (event.key === accountStorage.cart) {
          setCart(JSON.parse(event.newValue));
        } else if (event.key === accountStorage.profile) {
          setProfileState(normalizeProfile(JSON.parse(event.newValue)));
        } else if (event.key === accountStorage.savedRecipes) {
          setSavedRecipeIds(JSON.parse(event.newValue));
        } else if (event.key === accountStorage.subscription) {
          setSubscriptionState(event.newValue as SubscriptionTier);
        }
      } catch {
        // Ignore malformed cross-tab payloads; the current tab keeps its state.
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [accountStorage]);

  // Persist only on an explicit toggle — a visitor who never touched the
  // switch keeps following their OS preference on future visits.
  const toggleDarkMode = useCallback(
    () =>
      setIsDark((prev) => {
        const next = !prev;
        localStorage.setItem('zity_theme', next ? 'dark' : 'light');
        return next;
      }),
    []
  );

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

  /**
   * Re-prices the basket from the catalog.
   *
   * The cart is persisted in localStorage and used to keep whatever price a
   * line had the day it was added. The server re-prices every order from the
   * catalog, so a stale cart could never be paid for — and the pre-flight check
   * that now catches it would have refused the same basket for ever, because
   * nothing updated the prices it was complaining about.
   */
  const repriceCart = useCallback((priceOf: (productId: string) => number | null | undefined) => {
    setCart((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const price = item.productId ? priceOf(item.productId) : null;
        if (price == null || price === item.pricePerUnit) return item;
        changed = true;
        return {
          ...item,
          pricePerUnit: price,
          totalPrice: Math.round(price * item.quantity),
        };
      });
      // Same array when nothing moved: a new identity every catalog poll would
      // re-render the store and rewrite localStorage twenty times a minute.
      return changed ? next : prev;
    });
  }, []);

  const totalCartAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleCreateOrder = useCallback(
    async (
      address: string,
      paymentMethod: 'qpay' | 'socialpay' | 'card',
      invoiceId?: string,
      redeemPoints?: number
    ): Promise<Order> => {
      // The order the server writes is the order — its reference, total and
      // status. A locally invented one used to be returned instead, so the
      // customer memorised an order number that existed nowhere, and a failed
      // request (out of stock, unverified payment, database down) still emptied
      // the cart and looked like success.
      const order = await createOrderMutation({
        items: cart,
        totalAmount: totalCartAmount,
        deliveryAddress: address,
        paymentMethod,
        invoiceId,
        redeemPoints,
      });

      clearCart();
      return order;
    },
    [cart, totalCartAmount, createOrderMutation, clearCart]
  );

  const triggerPayment = useCallback(
    (
      amount: number,
      title: string,
      onSuccess?: (paymentMethod: 'qpay' | 'socialpay' | 'card', invoiceId?: string) => void,
      preferredMethod: 'qpay' | 'socialpay' | 'card' = 'qpay',
      plan?: 'pro' | 'family'
    ) => {
      setPaymentModalState({ amount, title, onSuccess, preferredMethod, plan });
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
    // `languageRevision` is what re-renders the tree after a language chunk
    // arrives; without it the callback identity never changes and the UI keeps
    // the fallback wording.
    [lang, languageRevision]
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
      inventory,
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
      repriceCart,
      totalCartAmount,
      orders: orders as unknown as Order[],
      ordersLoading,
      ordersError,
      createOrder: handleCreateOrder,
      cancelOrder,
      cancellingOrder,
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
      accountId,
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
      repriceCart,
      totalCartAmount,
      orders,
      ordersLoading,
      ordersError,
      handleCreateOrder,
      cancelOrder,
      cancellingOrder,
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
      accountId,
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
