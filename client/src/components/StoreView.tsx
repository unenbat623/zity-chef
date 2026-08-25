import React, { useEffect, useId, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Store,
  ShoppingBag,
  Plus,
  Trash2,
  MapPin,
  CheckCircle,
  ShieldCheck,
  ChevronRight,
  Activity,
  LayoutDashboard,
  ChefHat,
  Sparkles,
  Refrigerator,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from './Toast';
import { OrderError } from '../hooks/useOrders';
import { validateCheckout } from '../hooks/useCheckoutValidation';
import { useLoyalty } from '../hooks/useLoyalty';
import { SmartImage } from './SmartImage';
import { getIngredientImageUrl } from '../lib/imageService';
import { useStoreProducts } from '../hooks/useStoreProducts';
import { useRecipes } from '../hooks/useRecipes';
import {
  CatalogProduct,
  buildProductCartItem,
  buildRecipeBundle,
  matchIngredientToProduct,
} from '../lib/recipeStore';

type CatalogItem = CatalogProduct;

// Orders were all rendered as "paid • delivering" regardless of their real
// status, so a cancelled or completed order looked like one still on its way.
const ORDER_STATUS_KEYS: Record<string, string> = {
  pending: 'store_statusPending',
  paid: 'store_statusPaid',
  packing: 'store_statusPacking',
  shipping: 'store_statusShipping',
  delivered: 'store_statusDelivered',
  delivering: 'store_statusDelivering',
  completed: 'store_statusCompleted',
  cancelled: 'store_statusCancelled',
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  paid: 'bg-mint/15 text-mint-ink',
  packing: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  shipping: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  delivered: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  delivering: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-500',
};

/** Mirrors what POST /api/orders/:id/cancel accepts — anything already on its
 *  way is refused there, so offering the button would only produce an error. */
const CANCELLABLE_STATUSES = ['pending', 'paid', 'packing'];

export const StoreView: React.FC = () => {
  const {
    cart,
    inventory,
    addToCart,
    repriceCart,
    removeFromCart,
    totalCartAmount,
    triggerPayment,
    createOrder,
    cancelOrder,
    cancellingOrder,
    orders,
    ordersLoading,
    ordersError,
    setActiveTab,
    lang,
    savedRecipeIds,
    formatPrice,
    t,
  } = useApp();
  const { toastSuccess, toastError } = useToast();
  const { balance: pointsBalance } = useLoyalty();
  const [usePoints, setUsePoints] = useState(false);
  const [validating, setValidating] = useState(false);
  const {
    products,
    delivery,
    loading,
    isError: catalogError,
    refetch: refreshCatalog,
  } = useStoreProducts();
  const { recipes } = useRecipes();
  const catalog: CatalogItem[] = products;

  // A basket kept in localStorage otherwise quotes the price of the day it was
  // filled, which the server will not honour.
  useEffect(() => {
    if (catalog.length === 0) return;
    const priceById = new Map(catalog.map((product) => [product.id, product.pricePerUnit]));
    repriceCart((productId) => priceById.get(productId) ?? null);
  }, [catalog, repriceCart]);

  // The shop had no idea what was already in the fridge, so it happily sold a
  // second litre of milk to someone who had one at home.
  const stockedProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of inventory) {
      const product = matchIngredientToProduct(item.name, catalog);
      if (product) ids.add(product.id);
    }
    return ids;
  }, [inventory, catalog]);
  const nameOf = (item: CatalogItem) => (lang === 'en' && item.nameEn ? item.nameEn : item.name);

  const addressId = useId();
  const [address, setAddress] = useState<string>('Сүхбаатар дүүрэг, 1-р хороо, Zity Tower 402');
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'cart' | 'orders'>('catalog');
  const [addedBundleIds, setAddedBundleIds] = useState<string[]>([]);

  // "Added" is a property of the current cart, not a permanent flag. Checkout
  // empties the cart but this view stays mounted, so a bought bundle used to
  // stay disabled forever and could never be ordered again.
  useEffect(() => {
    if (cart.length === 0 && addedBundleIds.length > 0) setAddedBundleIds([]);
  }, [cart.length, addedBundleIds.length]);

  // Recipes mapped onto the store catalog: buyable ingredient bundles.
  // Saved recipes come first, then the ones the store covers best.
  const recipeBundles = useMemo(() => {
    return recipes
      .map((recipe) => buildRecipeBundle(recipe, catalog))
      .filter((bundle) => bundle.matched.length > 0)
      .sort((a, b) => {
        const aSaved = savedRecipeIds.includes(a.recipe.id) ? 1 : 0;
        const bSaved = savedRecipeIds.includes(b.recipe.id) ? 1 : 0;
        if (aSaved !== bSaved) return bSaved - aSaved;
        return b.matched.length / b.totalIngredients - a.matched.length / a.totalIngredients;
      })
      .slice(0, 4);
  }, [recipes, catalog, savedRecipeIds]);

  const handleAddToCart = (item: CatalogItem, displayName: string) => {
    addToCart(buildProductCartItem(item, displayName));
  };

  const handleAddBundle = (bundle: (typeof recipeBundles)[number]) => {
    bundle.matched.forEach(({ product }) => {
      addToCart(buildProductCartItem(product, nameOf(product)));
    });
    setAddedBundleIds((prev) =>
      prev.includes(bundle.recipe.id) ? prev : [...prev, bundle.recipe.id]
    );
  };

  // Mirrors maxRedeemablePoints() on the server: one point is one tugrik, and
  // at least MIN_PAYABLE has to stay chargeable so there is still an invoice.
  const deliveryFee =
    delivery.freeFrom > 0 && totalCartAmount >= delivery.freeFrom ? 0 : delivery.fee;
  const orderTotal = totalCartAmount + deliveryFee;

  const MIN_PAYABLE = 1000;
  const redeemablePoints = Math.max(
    0,
    Math.min(pointsBalance, Math.floor(orderTotal - MIN_PAYABLE))
  );
  const pointsDiscount = usePoints ? redeemablePoints : 0;
  const payableAmount = Math.max(0, orderTotal - pointsDiscount);

  const addressValid = address.trim().length >= 8;

  const handleCheckout = async () => {
    // An empty or throwaway address used to sail straight through to payment.
    if (cart.length === 0 || !addressValid) return;

    // Stock and prices are confirmed before the payment sheet opens, so a
    // sold-out basket is refused while the customer still has their money.
    setValidating(true);
    const preflight = await validateCheckout(cart);
    setValidating(false);
    if (!preflight.ok) {
      // Ordering groceries as a guest used to reach the payment sheet and then
      // file the order into per-instance memory, so the money was real and the
      // order was not.
      if (preflight.code === 'AUTH_REQUIRED') {
        toastError(t('store_signInRequiredTitle'), t('store_signInRequiredBody'));
        return;
      }
      toastError(t('store_orderOutOfStockTitle'), preflight.message || t('store_orderFailedBody'));
      return;
    }
    if (preflight.subtotal !== undefined && preflight.subtotal !== totalCartAmount) {
      // Pull the new prices in and let the customer confirm the new total,
      // rather than refusing a basket nothing was updating.
      const fresh = await refreshCatalog();
      const priceById = new Map<string, number>(
        (fresh.data?.products ?? catalog).map((product) => [product.id, product.pricePerUnit])
      );
      repriceCart((productId) => priceById.get(productId) ?? null);
      toastError(t('store_priceChangedTitle'), t('store_priceChangedBody'));
      return;
    }

    // The quote the server just gave is what the payment is raised for:
    // order creation recomputes the same number and refuses anything else, so
    // a basket paid for at a stale total would come back as PAYMENT_REQUIRED.
    const quoted = Math.max(0, (preflight.totalAmount ?? orderTotal) - pointsDiscount);

    triggerPayment(
      quoted,
      t('store_checkoutTitle'),
      async (paymentMethod, invoiceId) => {
        // The payment has already gone through by the time this runs, so a
        // failure here is the one the customer most needs to hear about: the
        // cart stays exactly as it was and the reason is named.
        try {
          const order = await createOrder(address, paymentMethod, invoiceId, pointsDiscount);
          setActiveSubTab('orders');
          toastSuccess(t('store_orderPlacedTitle'), t('store_orderPlacedBody', { ref: order.id }));
        } catch (err) {
          const failure = err as OrderError;
          if (failure?.code === 'OUT_OF_STOCK') {
            toastError(
              t('store_orderOutOfStockTitle'),
              t('store_orderOutOfStockBody', {
                product: failure.product || '',
                available: failure.available ?? 0,
              })
            );
          } else {
            toastError(t('store_orderFailedTitle'), t('store_orderFailedBody'));
          }
        }
      },
      'qpay'
    );
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder(orderId);
      toastSuccess(t('store_orderCancelledTitle'), t('store_orderCancelledBody'));
    } catch {
      toastError(t('store_orderCancelFailedTitle'), t('store_orderCancelFailedBody'));
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-5 sm:p-6 text-white shadow-xl border border-emerald-500/20">
        <Store className="absolute -right-8 -bottom-8 h-40 w-40 text-emerald-500/10 rotate-12 pointer-events-none hidden sm:block" />
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="min-w-0 relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200 border border-emerald-400/30">
              <Store size={14} />
              <span>{t('store_opsLabel')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-3 text-white">
              {t('storeTitle')}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-emerald-100/80 mt-1 max-w-xl">
              {t('storeSub')}
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1.5 text-[11px] font-black text-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {t('store_onlineStatus')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-black text-white">
              <Activity size={14} className="text-emerald-300" />
              {orders.length} {t('dashboard_orders')}
            </span>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-3.5 py-2.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-50"
            >
              <LayoutDashboard size={14} />
              {t('store_openDashboard')}
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 bg-pestle-card border border-pestle-border p-1 rounded-2xl text-xs font-bold shadow-xs">
        {[
          ['catalog', t('store_subtabStore')],
          ['cart', `${t('store_subtabCart')} (${cart.length})`],
          ['orders', t('store_subtabOrders')],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveSubTab(id as 'catalog' | 'cart' | 'orders')}
            aria-pressed={activeSubTab === id}
            className={`px-2 sm:px-3 py-2 rounded-lg transition-all text-center truncate ${
              activeSubTab === id
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-pestle-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeSubTab === 'catalog' && (
        <div className="space-y-6">
          {/* Nearest Supermarket Banner */}
          {/* Informational only — it used to show a chevron affordance with no
              onClick behind it, so tapping the card did nothing. */}
          <div className="pestle-card p-4 flex items-center gap-3 bg-emerald-500/8 border-emerald-500/20 rounded-3xl">
            <div className="w-10 h-10 shrink-0 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md">
              <Store size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-pestle-text truncate">Zity Supermarket #04</h4>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold line-clamp-2">
                {t('store_nearestInfo')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              [t('store_syncCart'), cart.length],
              [t('store_syncOrders'), orders.length],
              [t('store_syncDashboard'), t('store_syncLive')],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-pestle-border bg-pestle-card p-3"
              >
                <p className="text-[10px] font-black uppercase text-gray-400">{label}</p>
                <p className="mt-1 text-lg font-black text-pestle-text">{value}</p>
              </div>
            ))}
          </div>

          {/* Recipe Bundles — buy a recipe's ingredients in one tap */}
          {recipeBundles.length > 0 && (
            <section className="space-y-3 bg-gradient-to-r from-mango/10 via-amber-500/5 to-emerald-500/10 p-4 sm:p-5 rounded-3xl border border-mango/20">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-pestle-text flex items-center gap-2">
                  <ChefHat size={18} className="text-mango-ink" />
                  <span>{t('store_recipeBundles')}</span>
                </h3>
                <button
                  onClick={() => setActiveTab('recipe')}
                  className="text-[11px] font-black text-mango-ink hover:text-amber-600 bg-mango/10 hover:bg-mango/20 px-3.5 py-2.5 rounded-full transition-colors flex items-center gap-1 shrink-0"
                >
                  {t('store_openRecipes')} <ChevronRight size={13} />
                </button>
              </div>

              {/* Two columns only from lg up. At 768px the sidebar (224px) plus a
                  2-column split left each card ~228px — image + button ate all
                  of it and the middle column collapsed to ~40px, rendering the
                  text one character per line. */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {recipeBundles.map((bundle) => {
                  const isAdded = addedBundleIds.includes(bundle.recipe.id);
                  const title =
                    lang === 'mn'
                      ? bundle.recipe.title
                      : bundle.recipe.titleEn || bundle.recipe.title;
                  return (
                    <div
                      key={bundle.recipe.id}
                      className="bg-pestle-card border border-pestle-border rounded-2xl p-3 flex items-center gap-3 shadow-xs hover:shadow-md transition-all"
                    >
                      <SmartImage
                        src={bundle.recipe.image}
                        alt={title}
                        emoji="🍽️"
                        className="w-16 h-16 rounded-xl shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="text-xs font-black text-pestle-text truncate">{title}</h4>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block whitespace-nowrap max-w-full truncate">
                          {t('store_bundleAvailable', {
                            matched: bundle.matched.length,
                            total: bundle.totalIngredients,
                          })}
                        </span>
                        <span className="text-xs font-black text-mango-ink block whitespace-nowrap truncate">
                          ≈ {formatPrice(bundle.totalPrice)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAddBundle(bundle)}
                        disabled={isAdded}
                        className={`shrink-0 text-[10px] font-black px-3 py-2 rounded-xl flex items-center gap-1 transition-all ${
                          isAdded
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 cursor-default'
                            : 'bg-mango text-white shadow-md shadow-mango/25 active:scale-95'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <CheckCircle size={13} /> {t('store_bundleAdded')}
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={13} /> {t('store_addBundle')}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Product Catalog Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-pestle-text">{t('store_freshProducts')}</h3>
            {loading && products.length === 0 ? (
              /* Loading skeleton grid */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="pestle-card overflow-hidden animate-pulse">
                    <div className="h-32 w-full bg-pestle-bg" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 w-2/3 bg-pestle-bg rounded" />
                      <div className="h-3 w-1/3 bg-pestle-bg rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !loading && catalog.length === 0 ? (
              /* Empty or unreachable catalog. These used to be indistinguishable
                 because a bundled list stood in for both. */
              <div className="pestle-card text-center py-16 px-6">
                <Store size={48} className="mx-auto text-gray-300 mb-3" />
                <h4 className="text-base font-bold text-pestle-text mb-1">
                  {catalogError ? t('catalog_storeUnavailable') : t('store_freshProducts')}
                </h4>
                <p className="text-xs text-gray-400">
                  {catalogError ? t('catalog_unavailableBody') : t('store_emptyCatalog')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {catalog.map((item) => {
                  const displayName = nameOf(item);
                  return (
                    <div
                      key={item.id}
                      className="pestle-card rounded-3xl overflow-hidden flex flex-col hover:border-emerald-500/70 hover:shadow-lg transition-all group cursor-pointer"
                    >
                      {/* Product Photo */}
                      <SmartImage
                        src={
                          item.imageUrl ||
                          getIngredientImageUrl(item.name, item.nameEn ?? undefined)
                        }
                        alt={displayName}
                        emoji={item.emoji}
                        fallbackLabel={displayName}
                        className="h-32 w-full"
                      />

                      <div className="p-3 flex flex-col flex-1 justify-between">
                        <div>
                          <h4 className="font-bold text-xs text-pestle-text line-clamp-1">
                            {displayName}
                          </h4>
                          {stockedProductIds.has(item.id) ? (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Refrigerator size={11} className="shrink-0" />
                              {t('store_inYourFridge')}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-medium">
                              {t('store_productTag')}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] text-gray-400 font-bold block">
                              {t('store_unitPrice')}
                            </span>
                            <span className="text-xs font-black text-mango-ink">
                              {formatPrice(item.pricePerUnit || 3000)}
                            </span>
                          </div>

                          <button
                            onClick={() => handleAddToCart(item, displayName)}
                            className="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform shadow-md shadow-emerald-600/20"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'cart' && (
        <div className="space-y-5">
          {cart.length === 0 ? (
            <div className="text-center py-16 bg-pestle-card border border-pestle-border rounded-2xl p-6">
              <ShoppingBag size={48} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-bold text-pestle-text mb-1">{t('cartEmpty')}</h3>
              <p className="text-xs text-gray-400 mb-4">{t('store_cartEmptyHint')}</p>
              <button
                onClick={() => setActiveSubTab('catalog')}
                className="btn-primary py-2.5 px-6 text-xs"
              >
                {t('store_browseStore')}
              </button>
            </div>
          ) : (
            <>
              {/* Cart List */}
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="pestle-card p-3.5 sm:p-4 flex justify-between items-center gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{item.emoji}</span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-pestle-text truncate">{item.name}</h4>
                        <span className="text-[10px] text-gray-400 block truncate">
                          {item.quantity} {item.unit} × {formatPrice(item.pricePerUnit)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <span className="text-xs font-black text-mango-ink tabular-nums">
                        {formatPrice(item.totalPrice)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        aria-label={`${t('store_subtabCart')}: ${item.name}`}
                        className="text-gray-400 hover:text-red-500 p-1.5 -m-0.5 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Address Input */}
              <div className="space-y-2">
                <label
                  htmlFor={addressId}
                  className="text-xs font-bold text-pestle-text flex items-center gap-1.5"
                >
                  <MapPin size={14} className="text-mango-ink" />
                  <span>{t('deliveryAddress')}</span>
                </label>
                <input
                  id={addressId}
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('enterAddress')}
                  aria-invalid={!addressValid}
                  className="w-full bg-pestle-card border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                />
                {!addressValid && (
                  <p className="text-[10px] font-semibold text-red-500">
                    {t('store_addressRequired')}
                  </p>
                )}
              </div>

              {/* Order Summary & QPay Checkout */}
              <div className="bg-pestle-card border border-pestle-border p-5 rounded-2xl space-y-4">
                {/* The delivery fee was charged by the server and shown
                    nowhere, so the amount on this screen was not the amount
                    taken. It only appears when the shop actually charges one. */}
                {deliveryFee > 0 && (
                  <div className="space-y-1.5 border-b border-pestle-border/60 pb-3">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                      <span>{t('store_subtotal')}</span>
                      <span className="tabular-nums">{formatPrice(totalCartAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                      <span>{t('store_deliveryFee')}</span>
                      <span className="tabular-nums">{formatPrice(deliveryFee)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm font-bold border-b border-pestle-border/60 pb-3">
                  <span className="text-pestle-text">{t('total')}</span>
                  <span className="text-xl font-black text-mango-ink">
                    {formatPrice(orderTotal)}
                  </span>
                </div>

                {/* Points had nowhere to go: they accumulated and could never be
                    spent on anything. One point is one tugrik off. */}
                {redeemablePoints > 0 && (
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-mango/25 bg-mango/8 px-4 py-3 cursor-pointer">
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={usePoints}
                        onChange={(event) => setUsePoints(event.target.checked)}
                        className="h-4 w-4 shrink-0 accent-emerald-600"
                      />
                      <span className="text-xs font-bold text-pestle-text min-w-0">
                        {t('loyalty_usePoints', { n: redeemablePoints })}
                      </span>
                    </span>
                    <span className="text-xs font-black text-mango-ink shrink-0 tabular-nums">
                      −{formatPrice(redeemablePoints)}
                    </span>
                  </label>
                )}

                {pointsDiscount > 0 && (
                  <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                    <span>{t('loyalty_afterPoints')}</span>
                    <span className="tabular-nums text-pestle-text font-black">
                      {formatPrice(payableAmount)}
                    </span>
                  </div>
                )}

                <button
                  onClick={handleCheckout}
                  disabled={!addressValid || validating}
                  className="w-full btn-primary py-4 font-bold flex items-center justify-center gap-2 shadow-xl shadow-mango/25 disabled:opacity-50"
                >
                  <ShieldCheck size={20} />
                  <span>
                    {validating
                      ? t('store_checkingStock')
                      : `${t('checkout')} (${formatPrice(payableAmount)})`}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-pestle-text">
              {t('store_orderHistory', { n: orders.length })}
            </h3>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mango/10 px-3 py-1.5 text-[11px] font-black text-mango-ink border border-mango/20">
              <Sparkles size={12} className="shrink-0" />
              {t('loyalty_balance', { n: pointsBalance })}
            </span>
          </div>
          {ordersLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="pestle-card p-4 h-24 animate-pulse bg-pestle-bg/50" />
              ))}
            </div>
          ) : ordersError ? (
            <div className="text-center py-8 bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-2">
              <p className="text-xs font-bold text-red-500">{t('store_ordersLoadError')}</p>
              <p className="text-[11px] text-gray-400">{t('store_serverError')}</p>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-xs text-gray-400">{t('store_noOrders')}</p>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="pestle-card p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-pestle-text block truncate">
                      {order.id}
                    </span>
                    <span className="text-[10px] text-gray-400 block truncate">
                      {order.createdAt}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 whitespace-nowrap ${
                      ORDER_STATUS_STYLES[order.status] ?? ORDER_STATUS_STYLES.paid
                    }`}
                  >
                    <CheckCircle size={10} className="shrink-0" />{' '}
                    {t(ORDER_STATUS_KEYS[order.status] ?? 'store_statusPaid')}
                  </span>
                </div>

                <div className="text-xs text-gray-500 line-clamp-2">
                  {order.items.map((i) => i.name).join(', ')}
                </div>

                <div className="flex justify-between items-start gap-3 pt-2 border-t border-pestle-border/60 text-xs">
                  <span className="text-gray-400 font-medium min-w-0 line-clamp-2">
                    {order.address}
                  </span>
                  <span className="font-black text-mango-ink shrink-0 tabular-nums">
                    {formatPrice(order.totalAmount)}
                  </span>
                </div>

                {/* Cancelling was server-only until now: the endpoint existed,
                    releases the stock and reverses the Odoo invoice, but no
                    screen ever called it. Only orders that have not left the
                    building can still be stopped. */}
                {CANCELLABLE_STATUSES.includes(order.status) && (
                  <button
                    type="button"
                    disabled={cancellingOrder}
                    onClick={() => {
                      if (window.confirm(t('store_orderCancelTitle'))) handleCancelOrder(order.id);
                    }}
                    className="w-full min-h-11 rounded-xl border border-red-500/30 text-red-500 text-[11px] font-black hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                  >
                    {t('store_orderCancel')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
