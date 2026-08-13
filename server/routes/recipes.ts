import express from 'express';
import { isSupabaseConfigured, supabasePublic } from '../supabase.js';

const router = express.Router();

const RECIPES_CATALOG = [
  {
    id: 'r1',
    title: 'Монгол цуйван (Уламжлалт хэв маяг)',
    titleEn: 'Mongolian Tsuivan (Homemade Noodle)',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    tags: ['Уламжлалт', 'Үндсэн хоол', 'Шүүстэй'],
    time: '35 мин',
    difficulty: 'Дунд',
    category: 'Үндсэн хоол',
    cuisine: 'Монгол',
    nutrition: { calories: 650, protein: 32, carbs: 78, fat: 22 },
    ingredients: ['Үхрийн мах (300г)', 'Гурил (400г)', 'Сонгино (1ш)', 'Лууван (1ш)', 'Ургамлын тос (2 х/х)', 'Давс, хар перец'],
    steps: [
      {
        stepNumber: 1,
        title: 'Мах ба ногоо бэлтгэх',
        description: 'Үхрийн махаа нарийн урт хэрчинэ. Сонгино, лууванг мөн адил нарийн хэрчиж бэлтгэнэ.',
        image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80',
        timerMinutes: 5,
        sisterTip: 'Махаа хөлдүү дээр нь хэрчвэл илүү нарийн тэгшхэн хэрчигддэг шүү!',
      },
      {
        stepNumber: 2,
        title: 'Гурил элдэж жигнэх',
        description: 'Гурилаа хатуухан зуурч элдээд, тос түрхэж давхарлан хуушуур шиг хайруулын тавганд жигнэнэ.',
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
        timerMinutes: 10,
        sisterTip: 'Гурилаа элдэхдээ ургамлын тосыг жигд түрхвэл наалдахгүй салж хэрчигдэнэ.',
      },
      {
        stepNumber: 3,
        title: 'Хуурах ба жигнэх',
        description: 'Мах, ногоогоо өндөр галаар шаргалтал хуураад, хэрчсэн гурилаа дээр нь тавьж таглаад 15 минут жигнэнэ.',
        image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
        timerMinutes: 15,
        sisterTip: 'Усаа хэт ихдүүлж болохгүй, гурилын чийгээр цуйван амттай сайхан жигнэгддэг.',
      },
    ],
  },
  {
    id: 'r2',
    title: 'Авокадотой өндөгний тост',
    titleEn: 'Avocado Egg Toast',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
    tags: ['Өглөөний цай', 'Эрүүл хоол', 'Хурдан'],
    time: '12 мин',
    difficulty: 'Хялбар',
    category: 'Өглөөний цай',
    cuisine: 'Европ',
    nutrition: { calories: 380, protein: 16, carbs: 32, fat: 20 },
    ingredients: ['Бүхэл үрийн талх (2 зүсэм)', 'Авокадо (1ш)', 'Өндөг (2ш)', 'Оливын тос (1 ч/х)', 'Лемоны шүүс'],
    steps: [
      {
        stepNumber: 1,
        title: 'Авокадо нухаж талх шарах',
        description: 'Авокадог халбагаар нухаж, лемоны шүүс, давсаар амтална. Талхаа шарж шаржигнасан болгоно.',
        image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
        timerMinutes: 3,
        sisterTip: 'Лемоны шүүс нь авокадог харлуулахгүй шинэлэг өнгөтэй байлгана.',
      },
    ],
  },
];

// ── GET /api/recipes (list recipes) ──────────────────────────────────────────
router.get('/', async (_req, res) => {
  if (!isSupabaseConfigured || !supabasePublic) {
    return res.json({ recipes: RECIPES_CATALOG, source: 'fallback' });
  }

  const { data, error } = await supabasePublic
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return res.json({ recipes: RECIPES_CATALOG, source: 'fallback' });
  }

  return res.json({ recipes: data, source: 'supabase' });
});

// ── GET /api/recipes/:id (single recipe) ────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const recipe = RECIPES_CATALOG.find((r) => r.id === id);
  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found' });
  }
  return res.json({ recipe });
});

export default router;
