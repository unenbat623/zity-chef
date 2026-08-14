import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Refrigerator,
  Flame,
  ShoppingCart,
  User,
  CreditCard,
  Sparkles,
  MessageCircle,
  BookOpen,
  Mail,
  ExternalLink,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface FAQ {
  id: string;
  questionKey: string;
  answerKey: string;
  category: string;
}

const FAQ_CATEGORIES = [
  { id: 'all', labelKey: 'help_catAll', icon: HelpCircle },
  { id: 'fridge', labelKey: 'help_catFridge', icon: Refrigerator },
  { id: 'cooking', labelKey: 'help_catCooking', icon: Flame },
  { id: 'store', labelKey: 'help_catStore', icon: ShoppingCart },
  { id: 'account', labelKey: 'help_catAccount', icon: User },
  { id: 'subscription', labelKey: 'help_catSubscription', icon: CreditCard },
  { id: 'ai', labelKey: 'help_catAi', icon: Sparkles },
];

const FAQS: FAQ[] = [
  // Fridge
  { id: 'f1', category: 'fridge', questionKey: 'help_faqF1Q', answerKey: 'help_faqF1A' },
  { id: 'f2', category: 'fridge', questionKey: 'help_faqF2Q', answerKey: 'help_faqF2A' },
  { id: 'f3', category: 'fridge', questionKey: 'help_faqF3Q', answerKey: 'help_faqF3A' },
  { id: 'f4', category: 'fridge', questionKey: 'help_faqF4Q', answerKey: 'help_faqF4A' },
  // Cooking
  { id: 'c1', category: 'cooking', questionKey: 'help_faqC1Q', answerKey: 'help_faqC1A' },
  { id: 'c2', category: 'cooking', questionKey: 'help_faqC2Q', answerKey: 'help_faqC2A' },
  { id: 'c3', category: 'cooking', questionKey: 'help_faqC3Q', answerKey: 'help_faqC3A' },
  { id: 'c4', category: 'cooking', questionKey: 'help_faqC4Q', answerKey: 'help_faqC4A' },
  // Store
  { id: 's1', category: 'store', questionKey: 'help_faqS1Q', answerKey: 'help_faqS1A' },
  { id: 's2', category: 'store', questionKey: 'help_faqS2Q', answerKey: 'help_faqS2A' },
  { id: 's3', category: 'store', questionKey: 'help_faqS3Q', answerKey: 'help_faqS3A' },
  // Account
  { id: 'a1', category: 'account', questionKey: 'help_faqA1Q', answerKey: 'help_faqA1A' },
  { id: 'a2', category: 'account', questionKey: 'help_faqA2Q', answerKey: 'help_faqA2A' },
  { id: 'a3', category: 'account', questionKey: 'help_faqA3Q', answerKey: 'help_faqA3A' },
  // Subscription
  { id: 'sub1', category: 'subscription', questionKey: 'help_faqSub1Q', answerKey: 'help_faqSub1A' },
  { id: 'sub2', category: 'subscription', questionKey: 'help_faqSub2Q', answerKey: 'help_faqSub2A' },
  { id: 'sub3', category: 'subscription', questionKey: 'help_faqSub3Q', answerKey: 'help_faqSub3A' },
  // AI
  { id: 'ai1', category: 'ai', questionKey: 'help_faqAi1Q', answerKey: 'help_faqAi1A' },
  { id: 'ai2', category: 'ai', questionKey: 'help_faqAi2Q', answerKey: 'help_faqAi2A' },
  { id: 'ai3', category: 'ai', questionKey: 'help_faqAi3Q', answerKey: 'help_faqAi3A' },
];

const FaqItem: React.FC<{ faq: FAQ; isOpen: boolean; onToggle: () => void }> = ({
  faq,
  isOpen,
  onToggle,
}) => {
  const { t } = useApp();
  return (
    <div
      className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
        isOpen ? 'border-mango/40 shadow-md shadow-mango/10' : 'border-pestle-border'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left bg-pestle-card hover:bg-pestle-bg transition-colors cursor-pointer gap-3"
      >
        <span className={`text-sm font-bold leading-snug ${isOpen ? 'text-mango-ink' : 'text-pestle-text'}`}>
          {t(faq.questionKey)}
        </span>
        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bg-mango text-white' : 'bg-pestle-bg border border-pestle-border text-gray-400'}`}>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-pestle-border/60 bg-pestle-card">
              <div className="flex gap-2.5 pt-3">
                <CheckCircle2 size={16} className="text-mint-ink shrink-0 mt-0.5" />
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                  {t(faq.answerKey)}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const HelpView: React.FC = () => {
  const { setActiveTab, t } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
      const matchesSearch =
        !searchQuery ||
        t(faq.questionKey).toLowerCase().includes(searchQuery.toLowerCase()) ||
        t(faq.answerKey).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory, t]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-8 pb-10">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-mango/15 via-amber-500/8 to-transparent border border-mango/20 rounded-3xl p-6 sm:p-8 overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-mango/10 rounded-full blur-2xl" />
        <div className="relative space-y-2">
          <div className="flex items-center gap-2 text-mango-ink">
            <HelpCircle size={22} />
            <span className="text-xs font-extrabold uppercase tracking-widest">{t('help_center')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-pestle-text leading-tight">
            {t('help_heading')}
          </h1>
          <p className="text-sm text-gray-500 font-medium max-w-md">
            {t('help_subtitle')}
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mt-5">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('help_searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-pestle-card border border-pestle-border rounded-2xl pl-10 pr-4 py-3.5 text-sm font-medium text-pestle-text focus:outline-none focus:border-mango transition-all shadow-sm placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FAQ_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setOpenFaqId(null); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-mango text-white border-mango shadow-md shadow-mango/20'
                  : 'bg-pestle-card border-pestle-border text-gray-500 hover:border-mango hover:text-mango-ink'
              }`}
            >
              <Icon size={13} />
              <span>{t(cat.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* FAQ List */}
      <div className="space-y-3">
        {filteredFaqs.length > 0 ? (
          <>
            <p className="text-xs font-bold text-gray-400 px-1">
              {t('help_resultsCount', { n: filteredFaqs.length })}
            </p>
            {filteredFaqs.map((faq) => (
              <FaqItem
                key={faq.id}
                faq={faq}
                isOpen={openFaqId === faq.id}
                onToggle={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
              />
            ))}
          </>
        ) : (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-mango/10 text-mango-ink rounded-2xl flex items-center justify-center mx-auto">
              <Search size={28} />
            </div>
            <div>
              <h3 className="text-base font-black text-pestle-text">{t('help_noResultsTitle')}</h3>
              <p className="text-xs text-gray-400 mt-1">
                {t('help_noResultsDesc', { n: searchQuery })}
              </p>
            </div>
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
              className="btn-secondary text-xs px-4 py-2"
            >
              {t('help_clearSearch')}
            </button>
          </div>
        )}
      </div>

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-base font-black text-pestle-text mb-3 flex items-center gap-2">
          <Lightbulb size={18} className="text-mango-ink" />
          {t('help_quickLinks')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: t('help_linkFridge'), tab: 'fridge', icon: Refrigerator, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
            { label: t('help_linkRecipe'), tab: 'recipe', icon: BookOpen, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
            { label: t('help_linkCooking'), tab: 'cooking', icon: Flame, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
            { label: t('help_linkStore'), tab: 'store', icon: ShoppingCart, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
            { label: t('help_linkProfile'), tab: 'profile', icon: User, color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
            { label: t('help_linkPro'), tab: 'profile', icon: Sparkles, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.label}
                onClick={() => setActiveTab(link.tab)}
                className={`flex items-center gap-2.5 p-3.5 rounded-2xl border text-left transition-all cursor-pointer hover:shadow-md active:scale-[0.98] bg-pestle-card ${link.color}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${link.color}`}>
                  <Icon size={16} />
                </div>
                <span className="text-xs font-bold text-pestle-text leading-snug">{link.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contact Support CTA */}
      <div className="bg-gradient-to-br from-pestle-card to-pestle-bg border border-pestle-border rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-mango/15 text-mango-ink rounded-2xl flex items-center justify-center">
            <MessageCircle size={22} />
          </div>
          <div>
            <h3 className="font-black text-sm text-pestle-text">{t('help_ctaTitle')}</h3>
            <p className="text-xs text-gray-400 font-medium">{t('help_ctaSubtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setActiveTab('fridge')}
            className="flex items-center justify-center gap-2 bg-mango text-white py-3 px-4 rounded-xl text-xs font-bold shadow-md shadow-mango/20 hover:bg-mango/90 transition-all cursor-pointer"
          >
            <Sparkles size={15} />
            <span>{t('help_askAi')}</span>
          </button>
          <a
            href="mailto:support@zitychef.mn"
            className="flex items-center justify-center gap-2 bg-pestle-bg border border-pestle-border py-3 px-4 rounded-xl text-xs font-bold text-pestle-text hover:border-mango transition-all cursor-pointer"
          >
            <Mail size={15} className="text-mango-ink" />
            <span>{t('help_emailContact')}</span>
            <ExternalLink size={11} className="text-gray-400" />
          </a>
        </div>
      </div>
    </div>
  );
};
