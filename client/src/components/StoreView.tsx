import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MOCK_INGREDIENTS } from '../constants';
import { SmartImage } from './SmartImage';
import { getIngredientImageUrl } from '../lib/imageService';
import { useStoreProducts } from '../hooks/useStoreProducts';
import { useRecipes } from '../hooks/useRecipes';
import {
  CatalogProduct,
  buildProductCartItem,
  buildRecipeBundle,
} from '../lib/recipeStore';

type CatalogItem = CatalogProduct;

export const StoreView: React.FC = () => {
  const {
    cart,
    addToCart,
    removeFromCart,
    totalCartAmount,
    triggerPayment,
    createOrder,
    orders,
    ordersLoading,
    ordersError,
    setActiveTab,
    lang,
    savedRecipeIds,
    t,
  } = useApp();
  const { products, loading } = useStoreProducts();
  const { recipes } = useRecipes();
  // Real DB catalog when available; fall back to the bundled mock list.
  const catalog: CatalogItem[] = products.length ? products : (MOCK_INGREDIENTS as CatalogItem[]);
  const nameOf = (item: CatalogItem) => (lang === 'en' && item.nameEn ? item.nameEn : item.name);

  const [address, setAddress] = useState<string>('Сүхбаатар дүүрэг, 1-р хороо, Zity Tower 402');
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'cart' | 'orders'>('catalog');
  const [addedBundleIds, setAddedBundleIds] = useState<string[]>([]);

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

  const handleCheckout = () => {
    if (cart.length === 0) return;
    triggerPayment(totalCartAmount, t('store_checkoutTitle'), (paymentMethod) => {
      createOrder(address, paymentMethod);
      setActiveSubTab('orders');
    }, 'qpay');
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
            <p className="text-xs sm:text-sm font-semibold text-emerald-100/80 mt-1 max-w-xl">{t('storeSub')}</p>
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
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-3 py-1.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-50"
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
              className={`px-3 py-2 rounded-lg transition-all text-center ${
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
          <div className="pestle-card p-4 flex items-center justify-between bg-emerald-500/8 border-emerald-500/20 rounded-3xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md">
                <Store size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-pestle-text">Zity Supermarket #04</h4>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  {t('store_nearestInfo')}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-emerald-700 dark:text-emerald-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              [t('store_syncCart'), cart.length],
              [t('store_syncOrders'), orders.length],
              [t('store_syncDashboard'), t('store_syncLive')],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-pestle-border bg-pestle-card p-3">
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
                  className="text-[11px] font-black text-mango-ink hover:text-amber-600 bg-mango/10 hover:bg-mango/20 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 shrink-0"
                >
                  {t('store_openRecipes')} <ChevronRight size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
                          {t('store_bundleAvailable', {
                            matched: bundle.matched.length,
                            total: bundle.totalIngredients,
                          })}
                        </span>
                        <span className="text-xs font-black text-mango-ink block">
                          ≈ ₮{bundle.totalPrice.toLocaleString()}
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
              /* Empty catalog state */
              <div className="pestle-card text-center py-16 px-6">
                <Store size={48} className="mx-auto text-gray-300 mb-3" />
                <h4 className="text-base font-bold text-pestle-text mb-1">
                  {t('store_freshProducts')}
                </h4>
                <p className="text-xs text-gray-400">{t('store_emptyCatalog')}</p>
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
                    src={item.imageUrl || getIngredientImageUrl(item.name, item.nameEn ?? undefined)}
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
                      <span className="text-[10px] text-gray-400 font-medium">
                        {t('store_productTag')}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-gray-400 font-bold block">{t('store_unitPrice')}</span>
                        <span className="text-xs font-black text-mango-ink">
                          ₮{(item.pricePerUnit || 3000).toLocaleString()}
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
                  <div key={item.id} className="pestle-card p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.emoji}</span>
                      <div>
                        <h4 className="text-xs font-bold text-pestle-text">{item.name}</h4>
                        <span className="text-[10px] text-gray-400">
                          {item.quantity} {item.unit} x ₮{item.pricePerUnit.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-mango-ink">
                        ₮{item.totalPrice.toLocaleString()}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Address Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-pestle-text flex items-center gap-1.5">
                  <MapPin size={14} className="text-mango-ink" />
                  <span>{t('deliveryAddress')}</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('enterAddress')}
                  className="w-full bg-pestle-card border border-pestle-border rounded-xl px-4 py-3 text-xs font-medium text-pestle-text focus:outline-none focus:border-mango"
                />
              </div>

              {/* Order Summary & QPay Checkout */}
              <div className="bg-pestle-card border border-pestle-border p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center text-sm font-bold border-b border-pestle-border/60 pb-3">
                  <span className="text-pestle-text">{t('total')}</span>
                  <span className="text-xl font-black text-mango-ink">
                    ₮{totalCartAmount.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full btn-primary py-4 font-bold flex items-center justify-center gap-2 shadow-xl shadow-mango/25"
                >
                  <ShieldCheck size={20} />
                  <span>
                    {t('checkout')} (₮{totalCartAmount.toLocaleString()})
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-pestle-text">
            {t('store_orderHistory', { n: orders.length })}
          </h3>
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
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-pestle-text">{order.id}</span>
                    <span className="text-[10px] text-gray-400 block">{order.createdAt}</span>
                  </div>
                  <span className="text-[10px] font-bold bg-mint/15 text-mint-ink px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle size={10} /> {t('store_paidDelivering')}
                  </span>
                </div>

                <div className="text-xs text-gray-500">
                  {order.items.map((i) => i.name).join(', ')}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-pestle-border/60 text-xs">
                  <span className="text-gray-400 font-medium">{order.address}</span>
                  <span className="font-black text-mango-ink">
                    ₮{order.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
