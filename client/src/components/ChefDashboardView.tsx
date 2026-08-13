import React from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  ChefHat,
  Clock3,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Store,
  UserPlus,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useChefDashboard } from '../hooks/useChefDashboard';

const formatMoney = (amount: number) => `₮${Math.round(amount).toLocaleString()}`;

export const ChefDashboardView: React.FC = () => {
  const { orders, inventory, cart, setActiveTab, t } = useApp();
  const { dashboard, loading, error, refetch } = useChefDashboard();

  const fallbackStats = {
    customers: 1,
    orders: orders.length,
    revenue: orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    products: inventory.length,
    pendingOrders: orders.filter((order) => order.status === 'pending' || order.status === 'paid').length,
  };

  const stats = dashboard?.stats ?? fallbackStats;
  const recentOrders = dashboard?.recentOrders ?? orders.slice(0, 5).map((order) => ({
    id: order.id,
    customerName: t('auth_defaultUserName'),
    customerEmail: '',
    totalAmount: order.totalAmount,
    status: order.status,
    createdAt: order.createdAt,
    address: order.address,
  }));
  const recentCustomers = dashboard?.recentCustomers ?? [];
  const adminNotice = dashboard?.adminEnabled === false ? dashboard.message : error;

  const cards = [
    { label: t('dashboard_customers'), value: stats.customers, icon: Users },
    { label: t('dashboard_orders'), value: stats.orders, icon: ShoppingBag },
    { label: t('dashboard_revenue'), value: formatMoney(stats.revenue), icon: Activity },
    { label: t('dashboard_products'), value: stats.products, icon: Store },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-5 sm:p-6 text-white shadow-xl border border-emerald-500/20">
        <ChefHat className="absolute -right-8 -bottom-8 h-40 w-40 text-emerald-500/10 rotate-12 pointer-events-none hidden sm:block" />
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="min-w-0 relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200 border border-emerald-400/30">
              <ChefHat size={14} />
              <span>{t('dashboard_liveOps')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-3 text-white">
              {t('dashboard_title')}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-emerald-100/80 mt-1 max-w-xl">{t('dashboard_subtitle')}</p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1.5 text-[11px] font-black text-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              {dashboard?.realtime ? t('dashboard_realtimeOn') : t('dashboard_realtimeFallback')}
            </span>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-black text-white hover:bg-white/15"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {t('dashboard_refresh')}
            </button>
          </div>
        </div>
      </header>

      {adminNotice && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs font-semibold text-amber-700 dark:text-amber-300">
          {t(
            adminNotice.includes('CHEF_ADMIN_EMAILS')
              ? 'dashboard_adminLocked'
              : 'dashboard_adminNotConfigured'
          )}
        </div>
      )}

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              layout
              className="pestle-card p-4 min-h-28 flex flex-col justify-between hover:border-emerald-500/50"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/15">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400">{card.label}</p>
                <p className="text-lg sm:text-xl font-black text-pestle-text truncate">{card.value}</p>
              </div>
            </motion.div>
          );
        })}
      </section>

      <section className="pestle-card rounded-3xl p-4 sm:p-5 border-emerald-500/20 bg-emerald-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {t('dashboard_storePipeline')}
            </p>
            <h3 className="mt-1 text-base font-black text-pestle-text">{t('dashboard_storePipelineTitle')}</h3>
            <p className="text-[11px] font-semibold text-gray-400">{t('dashboard_storePipelineSub')}</p>
          </div>
          <button
            onClick={() => setActiveTab('store')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-md shadow-emerald-600/15"
          >
            <Store size={16} />
            {t('dashboard_openStore')}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            [t('dashboard_cartNow'), cart.length],
            [t('dashboard_pending'), stats.pendingOrders],
            [t('dashboard_realtimeOn'), dashboard?.realtime ? t('store_syncLive') : t('dashboard_realtimeFallback')],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-pestle-card border border-pestle-border/70 p-3">
              <p className="text-[9px] font-black uppercase text-gray-400">{label}</p>
              <p className="mt-1 text-sm sm:text-lg font-black text-pestle-text truncate">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-4">
        <div className="pestle-card p-4 sm:p-5 space-y-4 overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-pestle-text">{t('dashboard_recentOrders')}</h3>
              <p className="text-[11px] text-gray-400 font-semibold">{t('dashboard_recentOrdersSub')}</p>
            </div>
            <button
              onClick={() => setActiveTab('store')}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-md shadow-emerald-600/15"
            >
              {t('dashboard_openStore')}
            </button>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <div className="min-w-[620px] space-y-2">
              {loading && !dashboard ? (
                [0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-pestle-bg animate-pulse" />)
              ) : recentOrders.length === 0 ? (
                <div className="rounded-xl bg-pestle-bg p-6 text-center text-xs font-semibold text-gray-400">
                  {t('dashboard_noOrders')}
                </div>
              ) : (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="grid grid-cols-[1fr_1fr_120px_100px] items-center gap-3 rounded-xl border border-pestle-border/70 bg-pestle-bg/55 px-3 py-3 hover:border-emerald-500/40"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-pestle-text truncate">{order.id}</p>
                      <p className="text-[10px] text-gray-400 font-semibold truncate">{order.createdAt}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-pestle-text truncate">{order.customerName}</p>
                      <p className="text-[10px] text-gray-400 truncate">{order.address}</p>
                    </div>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{formatMoney(order.totalAmount)}</span>
                    <span className="inline-flex items-center justify-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                      <Clock3 size={10} />
                      {order.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="pestle-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-pestle-text">{t('dashboard_customersTitle')}</h3>
                <p className="text-[11px] text-gray-400 font-semibold">{t('dashboard_customersSub')}</p>
              </div>
              <UserPlus size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-2">
              {recentCustomers.length === 0 ? (
                <div className="rounded-xl bg-pestle-bg p-4 text-xs font-semibold text-gray-400">
                  {adminNotice ? t('dashboard_adminNeedConfig') : t('dashboard_noCustomers')}
                </div>
              ) : (
                recentCustomers.slice(0, 5).map((customer) => (
                  <div key={customer.id} className="flex items-center gap-3 rounded-xl bg-pestle-bg/60 p-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                      {customer.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-pestle-text truncate">{customer.name}</p>
                      <p className="text-[10px] font-semibold text-gray-400 truncate">{customer.email}</p>
                    </div>
                    <span className="text-[9px] font-black uppercase text-gray-400">
                      {customer.subscriptionTier}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pestle-card p-4 sm:p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400">{t('dashboard_cartNow')}</p>
              <p className="text-lg font-black text-pestle-text">{cart.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400">{t('dashboard_pending')}</p>
              <p className="text-lg font-black text-pestle-text">{stats.pendingOrders}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/15">
              <PackageCheck size={20} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
