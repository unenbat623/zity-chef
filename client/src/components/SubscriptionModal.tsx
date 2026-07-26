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

const PLAN_DEFS: PlanDef[] = [
  {
    id: 'free',
    name: 'Үнэгүй Багц',
    price: '₮0',
    priceRaw: 0,
    period: '/ Үнэгүй',
    tagline: 'Анхан шатны хэрэглээнд',
    color: 'text-gray-500',
    bgClass: 'bg-pestle-bg',
    borderClass: 'border-pestle-border',
    icon: <Star size={20} className="text-gray-400" />,
    features: [
      { icon: <MessageSquare size={13} className="text-gray-400" />, text: 'Өдөрт 5 удаа AI Эгчээс зөвлөгөө авах' },
      { icon: <Check size={13} className="text-gray-400" />, text: 'Хөргөгчний орцууд бүртгэх & хугацаа хянах' },
      { icon: <Check size={13} className="text-gray-400" />, text: 'Энгийн жорын санг үзэх' },
    ],
    ctaLabel: 'Одоо ашиглаж байна',
    ctaClass: '',
  },
  {
    id: 'pro',
    name: 'Pro Chef Багц',
    price: '₮7,900',
    priceRaw: 7900,
    period: '/ сар',
    tagline: 'Тогооч ба хувь хүнд зориулсан',
    color: 'text-amber-500',
    bgClass: 'bg-gradient-to-br from-amber-500/8 to-orange-500/10',
    borderClass: 'border-amber-400/60',
    icon: <Crown size={20} className="text-amber-400" />,
    badge: 'Хамгийн алдартай',
    features: [
      { icon: <Zap size={13} className="text-mango" />, text: 'Хязгааргүй AI Эгч туслах (24/7)' },
      { icon: <Camera size={13} className="text-mango" />, text: 'AI Баримт ба Зураг уншигч (OCR)' },
      { icon: <BarChart3 size={13} className="text-mango" />, text: 'Шим тэжээл, Калори & Илчлэг тооцоолуур' },
      { icon: <BookOpen size={13} className="text-mango" />, text: 'Алхамчилсан хоол хийх тогооч горим' },
      { icon: <ShoppingCart size={13} className="text-mango" />, text: 'Дутуу орцыг 1 даралтаар сагслах' },
      { icon: <Star size={13} className="text-mango" />, text: 'Бүрэн Премиум жорын сан' },
    ],
    ctaLabel: 'Pro Chef-ээр идэвхжүүлэх',
    ctaClass: 'btn-primary shadow-lg shadow-mango/25',
  },
  {
    id: 'family',
    name: 'Family Багц',
    price: '₮14,900',
    priceRaw: 14900,
    period: '/ сар',
    tagline: 'Гэр бүлээрээ ашиглахад',
    color: 'text-teal-600 dark:text-teal-400',
    bgClass: 'bg-gradient-to-br from-teal-500/8 to-cyan-500/10',
    borderClass: 'border-teal-400/60',
    icon: <Users size={20} className="text-teal-500" />,
    features: [
      { icon: <Check size={13} className="text-teal-500" />, text: 'Pro Chef-ийн БҮХ боломж багтсан' },
      { icon: <Users size={13} className="text-teal-500" />, text: '5 хүртэл гишүүн нэг хөргөгч хамтран удирдах' },
      { icon: <ShoppingCart size={13} className="text-teal-500" />, text: 'Гэр бүлийн дундын худалдан авалтын сагс' },
      { icon: <RefreshCcw size={13} className="text-teal-500" />, text: '7 хоногийн нэгдсэн хоолны төлөвлөгөө' },
    ],
    ctaLabel: 'Family Багц сонгох',
    ctaClass: 'bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-500/20',
  },
];


// ── Plan Card ─────────────────────────────────────────────────────────────────
const PlanCard: React.FC<{
  plan: PlanDef;
  isCurrent: boolean;
  onSelect: () => void;
}> = ({ plan, isCurrent, onSelect }) => {
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
            ? 'bg-mango/15 text-mango border border-mango/30'
            : plan.id === 'family'
            ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
            : 'bg-pestle-bg text-gray-400 border border-pestle-border'
        }`}>
          ✓ Одоо ашиглаж буй багц
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
  const { showSubModal, setShowSubModal, subscription, setSubscription, triggerPayment } = useApp();

  if (!showSubModal) return null;

  const handleUpgrade = (plan: PlanDef) => {
    if (plan.priceRaw === 0) return;
    triggerPayment(plan.priceRaw, `Zity ${plan.name}`, () => {
      setSubscription(plan.id);
    });
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
              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-mango bg-mango/15 px-3 py-1 rounded-full">
                <Sparkles size={11} /> Zity Premium
              </span>
              <h2 className="text-xl font-black text-pestle-text">Гишүүнчлэлийн багцууд</h2>
              <p className="text-xs text-gray-400 font-medium">
                Хэрэгцээндээ тохирсон багцаа сонгоно уу
              </p>
            </div>
            <button
              onClick={() => setShowSubModal(false)}
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
              🔒 Аюулгүй төлбөр · QPay / SocialPay / Карт · Хүссэн үедээ цуцлах боломжтой
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
