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
  question: string;
  answer: string;
  category: string;
}

const FAQ_CATEGORIES = [
  { id: 'all', label: 'Бүгд', icon: HelpCircle },
  { id: 'fridge', label: 'Хөргөгч', icon: Refrigerator },
  { id: 'cooking', label: 'Хоол хийх', icon: Flame },
  { id: 'store', label: 'Захиалга', icon: ShoppingCart },
  { id: 'account', label: 'Бүртгэл', icon: User },
  { id: 'subscription', label: 'Сунгалт', icon: CreditCard },
  { id: 'ai', label: 'AI Туслагч', icon: Sparkles },
];

const FAQS: FAQ[] = [
  // Fridge
  {
    id: 'f1',
    category: 'fridge',
    question: 'Хөргөгчдөө орц яаж нэмэх вэ?',
    answer: 'Хөргөгч хэсэгт орж "Баримт уншуулах / AI Сканнер" товч дарна. Камераа орцын баримт луу чиглүүлж OCR технологиор автоматаар таниулах боломжтой. Эсвэл гар оруулалтаар "+" товч дарж нэмнэ. Орцны нэр, хэмжээ, дуусах хугацааг оруулна уу.',
  },
  {
    id: 'f2',
    category: 'fridge',
    question: 'Муудах дөхсөн орцын анхааруулга яаж ажилладаг вэ?',
    answer: 'Орцны дуусах хугацаа 3 хоног эсвэл түүнээс бага үлдсэн үед систем автоматаар улаан анхааруулга харуулна. Зүүн доод буланд "Муудах дөхсөн" бэж мөн гарч ирнэ. Эдгээр орцыг аль болох эрт хэрэглэхийг зөвлөж байна.',
  },
  {
    id: 'f3',
    category: 'fridge',
    question: 'Орцоо ангиллаар шүүж харах боломжтой юу?',
    answer: 'Тийм! Хөргөгч хэсгийн дээд хэсэгт "Бүгд", "Ногоо", "Мах", "Сүү, өндөг", "Амтлагч", "Жимс" гэх ангиллын товчнууд байдаг. Хүссэн ангиллаа дарж шүүлт хэрэглэнэ.',
  },
  {
    id: 'f4',
    category: 'fridge',
    question: 'Орцны зургийг яаж оруулах вэ?',
    answer: 'Орц нэмэх эсвэл засах үед "Зураг оруулах" хэсэгт товчийг дарж баримт/зургийн санаас сонгоно. Зурагтай орц харахад илүү таньдаг болж хоолны жорыг илүү нарийн тааруулдаг.',
  },
  // Cooking
  {
    id: 'c1',
    category: 'cooking',
    question: 'Хоол хийх горим яаж эхлүүлэх вэ?',
    answer: 'Жор хэсгээс хүссэн жораа сонгоод "Хоол хийх горим эхлэх" товч дарна. Эсвэл Хоол хийх табд орж аль хэдийн сонгосон жораа харна. Алхам бүр нарийн заавар, цаг хэмжигч, орцын жагсаалттайгаар харуулагдана.',
  },
  {
    id: 'c2',
    category: 'cooking',
    question: 'Алхамын цаг хэмжигч яаж ашиглах вэ?',
    answer: 'Тухайн алхамд цаг хэмжигч байвал "Эхлүүлэх" товч дарна. Цаг тоолох эхэлнэ. "Зогсоох" товчоор зогсоож, "Шинэчлэх" товчоор дахин эхлүүлнэ. Хугацаа дуусхад дуут дохио болон дэлгэцийн мэдэгдэл гарна.',
  },
  {
    id: 'c3',
    category: 'cooking',
    question: 'Дуут зааварчлах функц хэрхэн ажилладаг вэ?',
    answer: 'Хоол хийх горимд "🔊 Дуут заавар" товч дарахад алхамын гарчиг, тайлбар, Эгчийн зөвлөгөөг дуут уншиж өгнө. Гараа бохирдсон үед дэлгэцэнд хүрэлгүй заавар сонсох боломжтой. Дахин дарвал зогсоно.',
  },
  {
    id: 'c4',
    category: 'cooking',
    question: 'Орцын жагсаалтаас чеклист яаж тэмдэглэх вэ?',
    answer: 'Хоол хийх горимын алхам бүрт тухайн алхамд шаардлагатай орцын жагсаалт харагдана. Орц бэлэн болсны дараа орцны нэр дээр дарвал чеклист тэмдэглэгдэж эмх цэгц харуулна.',
  },
  // Store
  {
    id: 's1',
    category: 'store',
    question: 'QPay-ээр яаж төлөх вэ?',
    answer: 'Дэлгүүр хэсэгт хүссэн бүтээгдэхүүнээ сагсанд нэмэнэ. Сагсны дүн харуулдаг хэсгийн "QPay-ээр захиалах" товч дарна. QR код гарч ирэх бөгөөд банкны апп-аараа сканнердаж төлнө. Төлбөр амжилттай болмогц захиалга баталгаажна.',
  },
  {
    id: 's2',
    category: 'store',
    question: 'Хаяг хэрхэн оруулах вэ?',
    answer: 'Захиалах үед хүргэлтийн хаягаа оруулна. Хаягийг хожим солих боломжтой. Дараагийн захиалгад хадгалагдсан хаягийг ашиглах эсвэл шинэ хаяг нэмэх боломжтой.',
  },
  {
    id: 's3',
    category: 'store',
    question: 'Хүргэлт хэдий хугацаанд ирэх вэ?',
    answer: 'Ихэвчлэн захиалга өгснөөс хойш 30-90 минутын дотор хүргэгдэнэ. Захиалгын статус "Хүлээгдэж буй" → "Төлөгдсөн" → "Хүргэгдэж байна" → "Гүйцэтгэгдсэн" гэж шинэчлэгдэнэ.',
  },
  // Account
  {
    id: 'a1',
    category: 'account',
    question: 'Профайлын зургаа яаж солих вэ?',
    answer: 'Профайл хэсэгт орж "Зураг өөрчлөх" товч дарна. Төхөөрөмжийн зургийн санаас сонгоно. Зураг автоматаар тойрог хэлбэрт тайрагдаж хадгалагдана.',
  },
  {
    id: 'a2',
    category: 'account',
    question: 'Загвар (Theme) болон өнгийг яаж солих вэ?',
    answer: 'Профайл хэсгийн "Загвар & Өнгөний тохиргоо" хэсэгт 8 өнгийн сонголт байдаг: Нил ягаан, Ягаан, Цэнхэр, Ногоон, Улбар шар, Нил цэнхэр, Чулуун, Ягаан алт. Сонгосон өнгө тухайн мөчид аппликейшний бүх хэсэгт тарж, лого, товчнуур, идэвхтэй цэс болон бусад элементүүдийг бүгдийг нэгэн зэрэг солино.',
  },
  {
    id: 'a3',
    category: 'account',
    question: 'Хэлийг яаж солих вэ?',
    answer: 'Дээд цэсний баруун талд байх хэл солих товч дарвал Монгол / English хооронд солигдоно. Сонгосон хэл хадгалагдаж дараагийн нэвтрэлтэд ч ижил хэлтэй нээгдэнэ.',
  },
  // Subscription
  {
    id: 'sub1',
    category: 'subscription',
    question: 'PRO болон FREE TIER-ийн ялгаа юу вэ?',
    answer: 'FREE TIER: Хөргөгч удирдлага, Дэлгүүр, Жор үзэх. PRO TIER (₮7,900/сар): AI жор зохиол, OCR баримт сканнер, AI дахин төлөвлөлт, Хязгааргүй жор, Ойролцоо орц олж нэмэх. FAMILY TIER (₮15,900/сар): PRO бүх функц + 5 гишүүний нэгдсэн хөргөгч.',
  },
  {
    id: 'sub2',
    category: 'subscription',
    question: 'Сунгалтаа яаж цуцлах вэ?',
    answer: 'Профайл хэсэгт орж "Миний сунгалт & Эрхийн төлөв" хэсэгт очно. Тэндэс "Сунгалт удирдах" эсвэл "Цуцлах" сонголт хийж болно. Цуцалсаны дараа тухайн сарын эцсийг хүртэл PRO функц ажиллана.',
  },
  {
    id: 'sub3',
    category: 'subscription',
    question: 'Төлбөрийн баримт авах боломжтой юу?',
    answer: 'Тийм! Захиалга амжилттай болмогц бүртгэлтэй и-мэйл рүү автоматаар баримт илгээгдэнэ. Профайл → Сунгалтын түүхэд өнгөрсөн баримтуудыг татаж авах боломжтой.',
  },
  // AI
  {
    id: 'ai1',
    category: 'ai',
    question: 'AI Эгч ямар асуултанд хариулах вэ?',
    answer: 'AI Эгч хоол хийх заавар, орцын орлуулах, хоолны тооцоо, хадгалалтын зөвлөгөө, хоолны эрүүл мэндийн мэдээлэл гэх мэт хоол хийхтэй холбоотой бүх асуудалд тусална. "Хөргөгчид байгаа орцоороо ямар хоол хийж болох вэ?" гэх мэт асуулт тавьж болно.',
  },
  {
    id: 'ai2',
    category: 'ai',
    question: 'AI жор зохиол яаж ажилладаг вэ?',
    answer: 'PRO хэрэглэгчид Жор хэсгээс "AI жор зохиол" товч дарна. Хөргөгчид байгаа орцуудаа, хоолны ангилал болон хоолны уран чадварыг зааж өгвөл AI нарийн тусгай жор үүсгэж өгнө.',
  },
  {
    id: 'ai3',
    category: 'ai',
    question: 'AI-д зургаар орц таниулж болох уу?',
    answer: 'Тийм! PRO хэрэглэгчид хөргөгч дэлгэцэнд "AI Сканнер" товч дарж камераар дэлгүүрийн баримт эсвэл орцны зургийг авахад AI автоматаар таних болно. OCR технологи Монгол ба Англи хэлний текст хоёуланг дэмждэг.',
  },
];

const FaqItem: React.FC<{ faq: FAQ; isOpen: boolean; onToggle: () => void }> = ({
  faq,
  isOpen,
  onToggle,
}) => {
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
        <span className={`text-sm font-bold leading-snug ${isOpen ? 'text-mango' : 'text-pestle-text'}`}>
          {faq.question}
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
                <CheckCircle2 size={16} className="text-mint shrink-0 mt-0.5" />
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                  {faq.answer}
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
  const { setActiveTab } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
      const matchesSearch =
        !searchQuery ||
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-8 pb-10">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-mango/15 via-amber-500/8 to-transparent border border-mango/20 rounded-3xl p-6 sm:p-8 overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-mango/10 rounded-full blur-2xl" />
        <div className="relative space-y-2">
          <div className="flex items-center gap-2 text-mango">
            <HelpCircle size={22} />
            <span className="text-xs font-extrabold uppercase tracking-widest">Тусламжийн Төв</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-pestle-text leading-tight">
            Ямар тусламж хэрэгтэй вэ?
          </h1>
          <p className="text-sm text-gray-500 font-medium max-w-md">
            Zity Chef-ийн бүх функц, асуудал шийдэх заавар, дэлгэрэнгүй мэдээллийг энд олно.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mt-5">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Асуулт хайх... (жн: QPay, жор, AI, хөргөгч...)"
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
                  : 'bg-pestle-card border-pestle-border text-gray-500 hover:border-mango hover:text-mango'
              }`}
            >
              <Icon size={13} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* FAQ List */}
      <div className="space-y-3">
        {filteredFaqs.length > 0 ? (
          <>
            <p className="text-xs font-bold text-gray-400 px-1">
              {filteredFaqs.length} асуулт олдлоо
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
            <div className="w-16 h-16 bg-mango/10 text-mango rounded-2xl flex items-center justify-center mx-auto">
              <Search size={28} />
            </div>
            <div>
              <h3 className="text-base font-black text-pestle-text">Хайлтын үр дүн олдсонгүй</h3>
              <p className="text-xs text-gray-400 mt-1">
                "{searchQuery}" гэдэг асуулт манай FAQ-д байхгүй байна.
              </p>
            </div>
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
              className="btn-secondary text-xs px-4 py-2"
            >
              Хайлтыг арилгах
            </button>
          </div>
        )}
      </div>

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-base font-black text-pestle-text mb-3 flex items-center gap-2">
          <Lightbulb size={18} className="text-mango" />
          Хурдан холбоос
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Хөргөгч удирдах', tab: 'fridge', icon: Refrigerator, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
            { label: 'Жор үзэх', tab: 'recipe', icon: BookOpen, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
            { label: 'Хоол хийх горим', tab: 'cooking', icon: Flame, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
            { label: 'Дэлгүүр & Захиалга', tab: 'store', icon: ShoppingCart, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
            { label: 'Профайл тохиргоо', tab: 'profile', icon: User, color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
            { label: 'PRO болох', tab: 'profile', icon: Sparkles, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
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
          <div className="w-11 h-11 bg-mango/15 text-mango rounded-2xl flex items-center justify-center">
            <MessageCircle size={22} />
          </div>
          <div>
            <h3 className="font-black text-sm text-pestle-text">Хариулт олдсонгүй юу?</h3>
            <p className="text-xs text-gray-400 font-medium">AI Эгч эсвэл манай баг тусалъя</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setActiveTab('fridge')}
            className="flex items-center justify-center gap-2 bg-mango text-white py-3 px-4 rounded-xl text-xs font-bold shadow-md shadow-mango/20 hover:bg-mango/90 transition-all cursor-pointer"
          >
            <Sparkles size={15} />
            <span>AI Эгчээс асуух</span>
          </button>
          <a
            href="mailto:support@zitychef.mn"
            className="flex items-center justify-center gap-2 bg-pestle-bg border border-pestle-border py-3 px-4 rounded-xl text-xs font-bold text-pestle-text hover:border-mango transition-all cursor-pointer"
          >
            <Mail size={15} className="text-mango" />
            <span>И-мэйлээр холбогдох</span>
            <ExternalLink size={11} className="text-gray-400" />
          </a>
        </div>
      </div>
    </div>
  );
};
