import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MOCK_INGREDIENTS } from '../constants';
import { SmartImage } from './SmartImage';
import { getIngredientImageUrl } from '../lib/imageService';
import { useStoreProducts } from '../hooks/useStoreProducts';

interface CatalogItem {
  id: string;
  name: string;
  nameEn?: string | null;
  emoji: string;
  unit: string;
  pricePerUnit?: number;
}

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
    lang,
    t,
  } = useApp();
  const { products, loading } = useStoreProducts();
  // Real DB catalog when available; fall back to the bundled mock list.
  const catalog: CatalogItem[] = products.length ? products : (MOCK_INGREDIENTS as CatalogItem[]);
  const nameOf = (item: CatalogItem) => (lang === 'en' && item.nameEn ? item.nameEn : item.name);

  const [address, setAddress] = useState<string>('Сүхбаатар дүүрэг, 1-р хороо, Zity Tower 402');
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'cart' | 'orders'>('catalog');

  const handleAddToCart = (item: CatalogItem, displayName: string) => {
    addToCart({
      id: `cart-${item.id}-${Date.now()}`,
      name: displayName,
      emoji: item.emoji,
      unit: item.unit,
      quantity: item.unit === 'гр' ? 500 : 1,
      pricePerUnit: item.pricePerUnit || 3000,
      totalPrice: (item.pricePerUnit || 3000) * (item.unit === 'гр' ? 1 : 1),
    });
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    triggerPayment(totalCartAmount, 'Zity Grocery Store Delivery Order', () => {
      createOrder(address, 'qpay');
      setActiveSubTab('orders');
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-pestle-text tracking-tight">
            {t('storeTitle')}
          </h2>
          <p className="text-xs font-semibold text-gray-400 mt-0.5">{t('storeSub')}</p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex w-full sm:w-auto bg-pestle-card border border-pestle-border p-1 rounded-xl text-xs font-bold justify-stretch sm:justify-start">
          <button
            onClick={() => setActiveSubTab('catalog')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all text-center ${
              activeSubTab === 'catalog'
                ? 'bg-mango text-white'
                : 'text-gray-400 hover:text-pestle-text'
            }`}
          >
            {t('store_subtabStore')}
          </button>
          <button
            onClick={() => setActiveSubTab('cart')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all text-center relative ${
              activeSubTab === 'cart'
                ? 'bg-mango text-white'
                : 'text-gray-400 hover:text-pestle-text'
            }`}
          >
            {t('store_subtabCart')} ({cart.length})
          </button>
          <button
            onClick={() => setActiveSubTab('orders')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all text-center ${
              activeSubTab === 'orders'
                ? 'bg-mango text-white'
                : 'text-gray-400 hover:text-pestle-text'
            }`}
          >
            {t('store_subtabOrders')}
          </button>
        </div>
      </header>

      {activeSubTab === 'catalog' && (
        <div className="space-y-6">
          {/* Nearest Supermarket Banner */}
          <div className="pestle-card p-4 flex items-center justify-between bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border-teal-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 text-white rounded-xl flex items-center justify-center shadow-md">
                <Store size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-pestle-text">Zity Supermarket #04</h4>
                <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                  {t('store_nearestInfo')}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-teal-600" />
          </div>

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
                  className="pestle-card overflow-hidden flex flex-col hover:border-mango transition-colors group cursor-pointer"
                >
                  {/* Product Photo */}
                  <SmartImage
                    src={getIngredientImageUrl(item.name, item.nameEn ?? undefined)}
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
                        <span className="text-xs font-black text-mango">
                          ₮{(item.pricePerUnit || 3000).toLocaleString()}
                        </span>
                      </div>

                      <button
                        onClick={() => handleAddToCart(item, displayName)}
                        className="w-8 h-8 bg-mango text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform shadow-md shadow-mango/20"
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
                      <span className="text-xs font-black text-mango">
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
                  <MapPin size={14} className="text-mango" />
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
                  <span className="text-xl font-black text-mango">
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
                  <span className="text-[10px] font-bold bg-mint/15 text-mint px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle size={10} /> {t('store_paidDelivering')}
                  </span>
                </div>

                <div className="text-xs text-gray-500">
                  {order.items.map((i) => i.name).join(', ')}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-pestle-border/60 text-xs">
                  <span className="text-gray-400 font-medium">{order.address}</span>
                  <span className="font-black text-mango">
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
