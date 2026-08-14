import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sparkles,
  Check,
  Crown,
  Users,
  Zap,
  Camera,
  BarChart3,
  BookOpen,
  MessageSquare,
  ShoppingCart,
  RefreshCcw,
  Star,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useQueryClient } from '@tanstack/react-query';
import type { SubscriptionTier } from '../types';

// ── Plan definitions (single source of truth) ─────────────────────────────────
interface PlanDef {
  id: SubscriptionTier;
  name: string;
  price: string;
  priceRaw: number;        // for payment trigger
  period: string;
  tagline: string;
  color: string;           // tailwind accent
  bgClass: string;
  borderClass: string;
  icon: React.ReactNode;
  badge?: string;
  features: { icon: React.ReactNode; text: string }[];
  ctaLabel: string;
  ctaClass: string;
}

const getPlanDefs = (
  t: (key: string, params?: Record<string, string | number>) => string,
  formatPrice: (amount: number) => string
): PlanDef[] => [
  {
    id: 'free',
    name: t('subFree'),
    price: formatPrice(0),
    priceRaw: 0,
    period: t('sub_periodFree'),
    tagline: t('sub_taglineFree'),
    color: 'text-gray-500',
    bgClass: 'bg-pestle-bg',
    borderClass: 'border-pestle-border',
    icon: <Star size={20} className="text-gray-400" />,
    features: [
      { icon: <MessageSquare size={13} className="text-gray-400" />, text: t('sub_featFree1') },
      { icon: <Check size={13} className="text-gray-400" />, text: t('sub_featFree2') },
      { icon: <Check size={13} className="text-gray-400" />, text: t('sub_featFree3') },
    ],
    ctaLabel: t('sub_ctaCurrentFree'),
    ctaClass: '',
  },
  {
    id: 'pro',
    name: t('subPro'),
    price: formatPrice(7900),
    priceRaw: 7900,
    period: t('sub_perMonth'),
    tagline: t('sub_taglinePro'),
    color: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-gradient-to-br from-amber-500/8 to-orange-500/10',
    borderClass: 'border-amber-400/60',
    icon: <Crown size={20} className="text-amber-400" />,
    badge: t('sub_badgePopular'),
    features: [
      { icon: <Zap size={13} className="text-mango-ink" />, text: t('sub_featPro1') },
      { icon: <Camera size={13} className="text-mango-ink" />, text: t('sub_featPro2') },
      { icon: <BarChart3 size={13} className="text-mango-ink" />, text: t('sub_featPro3') },
      { icon: <BookOpen size={13} className="text-mango-ink" />, text: t('sub_featPro4') },
      { icon: <ShoppingCart size={13} className="text-mango-ink" />, text: t('sub_featPro5') },
      { icon: <Star size={13} className="text-mango-ink" />, text: t('sub_featPro6') },
    ],
    ctaLabel: t('sub_ctaActivatePro'),
    ctaClass: 'btn-primary shadow-lg shadow-mango/25',
  },
  {
    id: 'family',
    name: t('subFamily'),
    price: formatPrice(14900),
    priceRaw: 14900,
    period: t('sub_perMonth'),
    tagline: t('sub_taglineFamily'),
    color: 'text-teal-600 dark:text-teal-400',
    bgClass: 'bg-gradient-to-br from-teal-500/8 to-cyan-500/10',
    borderClass: 'border-teal-400/60',
    icon: <Users size={20} className="text-teal-500" />,
    features: [
      { icon: <Check size={13} className="text-teal-500" />, text: t('sub_featFam1') },
      { icon: <Users size={13} className="text-teal-500" />, text: t('sub_featFam2') },
      { icon: <ShoppingCart size={13} className="text-teal-500" />, text: t('sub_featFam3') },
      { icon: <RefreshCcw size={13} className="text-teal-500" />, text: t('sub_featFam4') },
    ],
    ctaLabel: t('sub_ctaSelectFamily'),
    ctaClass: 'bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-500/20',
  },
];


// ── Plan Card ─────────────────────────────────────────────────────────────────
const PlanCard: React.FC<{
  plan: PlanDef;
  isCurrent: boolean;
  onSelect: () => void;
}> = ({ plan, isCurrent, onSelect }) => {
  const { t } = useApp();
  const isActive = plan.id !== 'free';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative p-5 rounded-2xl border transition-all duration-200 ${plan.bgClass} ${
        isCurrent
          ? plan.id === 'pro'
            ? 'border-mango ring-2 ring-mango/20'
            : plan.id === 'family'
            ? 'border-teal-500 ring-2 ring-teal-500/20'
            : 'border-mango/40'
          : plan.borderClass
      }`}
    >
      {/* Most Popular Badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-mango to-amber-500 text-white text-[10px] font-extrabold px-4 py-1 rounded-full shadow-md whitespace-nowrap uppercase tracking-wide">
          ⭐ {plan.badge}
        </div>
      )}

      {/* Plan Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
            plan.id === 'pro'
              ? 'bg-amber-500 text-white'
              : plan.id === 'family'
              ? 'bg-teal-600 text-white'
              : 'bg-pestle-card border border-pestle-border'
          }`}>
            {plan.icon}
          </div>
          <div>
            <h3 className="font-black text-sm text-pestle-text">{plan.name}</h3>
            <p className="text-[10px] text-gray-400 font-medium">{plan.tagline}</p>
          </div>
        </div>

        <div className="text-right">
          <p className={`text-lg font-black ${plan.color}`}>{plan.price}</p>
          <p className="text-[10px] text-gray-400 font-bold">{plan.period}</p>
        </div>
      </div>

      {/* Features List */}
      <ul className="space-y-2 mb-4">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2.5 text-xs font-medium text-pestle-text">
            <span className="shrink-0">{f.icon}</span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      {isCurrent ? (
        <div className={`w-full py-2.5 rounded-xl text-xs font-extrabold text-center ${
          plan.id === 'pro'
            ? 'bg-mango/15 text-mango-ink border border-mango/30'
            : plan.id === 'family'
            ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
            : 'bg-pestle-bg text-gray-400 border border-pestle-border'
        }`}>
          ✓ {t('sub_currentPlan')}
        </div>
      ) : (
        isActive && (
          <button
            onClick={onSelect}
            className={`w-full py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 ${plan.ctaClass}`}
          >
            {plan.id === 'pro' && <Sparkles size={15} />}
            {plan.id === 'family' && <Users size={15} />}
            {plan.ctaLabel} — {plan.price}
          </button>
        )
      )}
    </motion.div>
  );
};

// ── Main Modal ─────────────────────────────────────────────────────────────────
export const SubscriptionModal: React.FC = () => {
  const { showSubModal, setShowSubModal, subscription, setSubscription, triggerPayment, formatPrice, t } = useApp();
  const queryClient = useQueryClient();
  const PLAN_DEFS = getPlanDefs(t, formatPrice);

  if (!showSubModal) return null;

  const handleUpgrade = (plan: PlanDef) => {
    if (plan.priceRaw === 0 || plan.id === 'free') return;
    triggerPayment(
      plan.priceRaw,
      `Zity ${plan.name}`,
      () => {
        // Optimistic only. The server grants the tier when the payment clears,
        // and the next /api/ai/quota poll replaces this with the real value.
        setSubscription(plan.id);
        queryClient.invalidateQueries({ queryKey: ['ai', 'quota'] });
      },
      'qpay',
      plan.id as 'pro' | 'family'
    );
    setShowSubModal(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowSubModal(false)}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[190] flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-pestle-card border border-pestle-border/80 w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden"
        >
          {/* Pull Handle (mobile) */}
          <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mt-3 sm:hidden" />

          {/* Header */}
          <div className="px-6 pt-5 pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-mango-ink bg-mango/15 px-3 py-1 rounded-full">
                <Sparkles size={11} /> Zity Premium
              </span>
              <h2 className="text-xl font-black text-pestle-text">{t('sub_membershipPlans')}</h2>
              <p className="text-xs text-gray-400 font-medium">
                {t('sub_choosePlan')}
              </p>
            </div>
            <button
              onClick={() => setShowSubModal(false)}
              aria-label={t('close')}
              className="w-9 h-9 border border-pestle-border rounded-2xl flex items-center justify-center text-gray-400 hover:text-pestle-text hover:border-pestle-text transition-colors mt-1"
            >
              <X size={17} />
            </button>
          </div>

          {/* Plan Cards */}
          <div className="px-6 pb-6 space-y-4 overflow-y-auto max-h-[70vh]">
            {PLAN_DEFS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={subscription === plan.id}
                onSelect={() => handleUpgrade(plan)}
              />
            ))}

            {/* Trust Footer */}
            <p className="text-[10px] text-gray-400 text-center font-medium pt-1 pb-2">
              {t('sub_trustFooter')}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
