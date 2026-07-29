import { Recipe } from '../types';

export const MOCK_RECIPES: Recipe[] = [
  // ================= 0. МОНГОЛ АМТНЫ ДЭЭЖ (ҮНДЭСНИЙ УЛАМЖЛАЛТ) =================
  {
    id: 'mongolian-huushuur',
    title: 'Шүүслэг Мөнгөн Хуушуур',
    titleEn: 'Juicy Silver Mongolian Huushuur',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
    time: '8 мин',
    difficulty: 'Medium',
    cuisine: 'Mongolian Traditional',
    category: 'Үндсэн хоол',
    rating: 5.0,
    tags: ['Монгол хоол', 'Хуушуур', 'Үндсэн хоол'],
    ingredients: ['Үхрийн мах', 'Гурил', 'Сонгино', 'Сармис', 'Давс', 'Хар перец', 'Тос'],
    ingredientsEn: ['Beef/Mutton', 'Wheat Flour', 'Onion', 'Garlic', 'Salt', 'Black Pepper', 'Oil'],
    nutrition: { calories: 540, protein: 28, carbs: 48, fat: 26 },
    isPremium: false,
    steps: [
      {
        title: 'Гурил зуурах ба амраах',
        titleEn: 'Knead & Rest Dough',
        description: 'Гурилдаа 1 чимх давс хийж бүлээн усаар дунд хатуулагтай зуурна. Гялгар уутанд боож 20 минут амраана. Зуурсаны дараа дотроо агаарын бөмбөлөг байхгүйг хянаарай.',
        descriptionEn: 'Add a pinch of salt to flour and knead with warm water to medium-firm. Cover in plastic wrap and rest 20 minutes.',
        image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Гурилаа хэт хатуу бөгөөд хэт зөөлөн зуурсан бол элдхэд урагдах аюултай. Дунд зэрэг хатуулаг нь хамгийн зөв!',
        sisterTipEn: 'The dough should feel like soft clay — too stiff tears, too soft sticks.',
        timerMinutes: 20,
        stepIngredients: ['Гурил (500 гр)', 'Бүлээн ус (150-180 мл)', 'Давс (1 чимх)'],
        toolsNeeded: ['Гурилын аяга', 'Гялгар уут']
      },
      {
        title: 'Мах жижиглэх ба амтлах',
        titleEn: 'Mince & Season Meat',
        description: 'Мах, сонгино, сармисыг нарийн жижиглэнэ. Давс, хар перец нэмж сайн холино. Бүлээн ус 2-3 хоолны халбага бага багаар нэмж шингэтэл нь базан холино.',
        descriptionEn: 'Finely chop meat, onion, garlic. Season with salt and pepper. Gradually fold in 2-3 tbsp warm water until absorbed.',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Маханд бүлээн ус шингээж базвал шарсаны дараа шүүс нь гадагшлахгүй дотроо үлдэж хуушуур нэн шүүслэг болдог!',
        sisterTipEn: 'Massaging warm water into filling locks moisture inside — the real secret to juicy huushuur.',
        timerMinutes: 5,
        stepIngredients: ['Үхрийн мах (500 гр жижиглэсэн)', 'Сонгино (2 ш нарийн хэрчсэн)', 'Сармис (2 хүүш)', 'Давс, Хар перец', 'Бүлээн ус (3 хоолны халбага)'],
        toolsNeeded: ['Мах жижиглэх хутга', 'Холих аяга']
      },
      {
        title: 'Гурилыг элдэж хэвлэх',
        titleEn: 'Roll Dough into Circles',
        description: 'Амарсан гурилыг 30-35 гр-аар тасалж, тойрог хэлбэрт элдэнэ. Дунд хэсэг нь бага зэрэг зузаан, захыг нь нимгэн элдэх нь чимхэлтийг бат бэх болгоно.',
        descriptionEn: 'Divide dough into 30-35g portions. Roll into rounds — edges thinner than the center for strong crimping.',
        image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Захыг нимгэн элдэхгүй бол чимхэлтийн хэсэгт гурил давхардаж шарахад болоогүй хочигдоно.',
        sisterTipEn: 'Thin edges are critical — thick seams create raw doughy crimps that never cook through.',
        stepIngredients: ['Амарсан Гурилан Бөмбөлөг'],
        toolsNeeded: ['Гурил элдэх бариул', 'Гурилын шороо']
      },
      {
        title: 'Мах хийж чимхэх',
        titleEn: 'Fill & Crimp Tightly',
        description: 'Гурилан тойрогны нэг талд 1 хоолны халбага мах тавьж нугалаад, дотор агаар гаргахгүйгээр сонгодог монгол чимхэлтээр сайн чимхэнэ.',
        descriptionEn: 'Place 1 tablespoon of filling on one half. Fold and press out all air. Crimp tightly using traditional Mongolian pinch pattern.',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Агаар дотор үлдвэл шарах үед хуушуур дэлбэрэх аюултай — чимхэхийн өмнө дотроос сайн дарж агаарыг гарга!',
        sisterTipEn: 'Trapped air = huushuur burst in hot oil. Press out every bit of air before crimping.',
        stepIngredients: ['Амтлагдсан Мах (1 халбага)', 'Элдсэн Гурилан Тойрог'],
        toolsNeeded: ['Гар — монгол чимхэлтийн техник']
      },
      {
        title: 'Тосонд шарах (170-180°C)',
        titleEn: 'Deep Fry at 170-180°C',
        description: 'Тосоо 170-180°C хүртэл халааж хуушуурыг 4-5 аар нэг дор хийнэ. Тал бүрийг 3-4 минут алтан шар, шаржигнасан болтол шарна. Цаасан алчуур дээр тавьж илүүдэл тосыг шингээнэ.',
        descriptionEn: 'Heat oil to 170-180°C. Fry in batches of 4-5 for 3-4 mins per side until golden brown. Drain on paper towels.',
        image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Хэт олон нэг дор хийвэл тосны дулаан буурч тос сордог — 4-5-аас хэтрүүлэхгүй байгаарай.',
        sisterTipEn: 'Overcrowding lowers oil temperature and makes huushuur greasy. Max 4-5 at a time.',
        timerMinutes: 8,
        heatLevel: 'High',
        stepIngredients: ['Чимхсэн Хуушуур', 'Шарах тос (эрдэнэ шишийн, 1 л)'],
        toolsNeeded: ['Гүн тогоо / Фритюр', 'Цаасан алчуур', 'Шүүгч сэрээ']
      }
    ]
  },
  {
    id: 'nomad-tsuivan',
    title: 'Уламжлалт Нүүдэлчний Цүйван',
    titleEn: 'Traditional Nomad Tsuivan',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    time: '25 мин',
    difficulty: 'Medium',
    cuisine: 'Mongolian Traditional',
    category: 'Үндсэн хоол',
    rating: 5.0,
    tags: ['Монгол хоол', 'Цүйван', 'Нүүдэлчин'],
    ingredients: ['Үхрийн мах', 'Гурил', 'Сонгино', 'Лууван', 'Сармис', 'Давс', 'Хар перец', 'Тос'],
    ingredientsEn: ['Beef/Mutton', 'Wheat Flour', 'Onion', 'Carrot', 'Garlic', 'Salt', 'Black Pepper', 'Oil'],
    nutrition: { calories: 580, protein: 32, carbs: 58, fat: 22 },
    isPremium: false,
    steps: [
      {
        title: 'Гурил зуурч, хайруулын тавагт хайрах',
        titleEn: 'Knead, Sear & Slice Dough',
        description: 'Гурилыг давс, бүлээн усаар чангавтар зуурч 10 минут амраана. Нимгэн (2-3мм) элдэж нэг талыг бага тосолж, хуурай халаасан тавагт хоёр талыг тус бүр 45 секунд хайраад, 5-7мм зурааснуудад нарийн хэрчинэ.',
        descriptionEn: 'Knead firm dough, rest 10 mins. Roll thin (2-3mm), oil one side, sear 45 sec per side in a dry hot pan, then slice into 5-7mm thin noodles.',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Гурилаа хайрч хэрчвэл жигнэх үед нэг нэгэндээ наалдахгүй салж гүйлтэй хөвсгөр болдог — энэ бол цүйвангийн гол нууц!',
        sisterTipEn: 'Searing before slicing is the Mongolian trick that keeps noodles perfectly separate and fluffy.',
        timerMinutes: 15,
        stepIngredients: ['Гурил (400 гр)', 'Давстай бүлээн ус (130 мл)', 'Шарах тос (1 цааны халбага)'],
        toolsNeeded: ['Гурил элдэх бариул', 'Хайруулын таваг', 'Хутга']
      },
      {
        title: 'Мах нарийн зурааслан шарах',
        titleEn: 'Sear Beef Strips',
        description: 'Үхрийн мах нарийн, урт зуранд хэрчнэ. Тосоо 1 хоолны халбага хийж утаа гарах хүртэл халааж, махаа нэг давхаргаар хийж тогтмол хөдөлгөлгүй 2 минут шаргалдуулна.',
        descriptionEn: 'Slice beef into thin strips. Heat 1 tbsp oil until smoking, sear strips in a single layer for 2 mins without stirring.',
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Махаа хольж хутгахгүйгээр нэг талыг нь шаргалдуулах нь Maillard реакц үүсгэж цүйвангийн амтыг гүнзгийрүүлдэг!',
        sisterTipEn: 'Do NOT stir the meat — let it sear undisturbed for the Maillard reaction and deep rich flavor.',
        timerMinutes: 5,
        heatLevel: 'High',
        stepIngredients: ['Үхрийн/Хонины мах (400 гр нарийн зуранд)', 'Тос (1 хоолны халбага)'],
        toolsNeeded: ['Таваг/Вок', 'Модон хутгуур']
      },
      {
        title: 'Ногоо нэмж хуурах',
        titleEn: 'Add Vegetables & Stir-Fry',
        description: 'Шаржигнасан маханд сонгино, сармис, луувангаа нэмж дунд гал дээр 3-4 минут хуурна. Давс, хар перецэр амтлаад, халуун ус 1/2 аяга нэмж жигнэх суурь бий болгоно.',
        descriptionEn: 'Add onions, garlic, carrot strips. Stir-fry 3-4 mins on medium. Season with salt and pepper. Add ½ cup hot water.',
        image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Луувангаа мах шиг нимгэн зурааслан хэрчвэл жигнэгдэх хугацаа ижил болж хоол хоорондоо тэгш болдог.',
        sisterTipEn: 'Cut carrots in thin julienne strips matching the meat size for even, synchronized cooking.',
        timerMinutes: 4,
        heatLevel: 'Medium',
        stepIngredients: ['Сонгино (2 ш зурааслан)', 'Лууван (2 ш нарийн зурааслан)', 'Сармис (3 хүүш)', 'Давс & Хар перец', 'Халуун ус (1/2 аяга)'],
        toolsNeeded: ['Модон хутгуур', 'Таглаа бүхий гүн таваг']
      },
      {
        title: 'Гурилаа давхарлан жигнэх',
        titleEn: 'Layer Noodles & Steam',
        description: 'Мах-ногооны дээр хэрчсэн гурилыг тэгш дэлгэнэ. Тагийг нягт таглаж дунд гал дээр яг 15 минут жигнэнэ. Жигнэх явцад тагийг онгойлгохгүй байхыг анхааруулж байна!',
        descriptionEn: 'Layer noodles evenly over meat-veg base. Cover TIGHTLY and steam on medium heat for exactly 15 mins. Do NOT open lid.',
        image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Тагийг жигнэх явцад онгойлговол уур гараад гурил хатаж хуурай болдог — 15 минутыг тэвчин хүлээх хэрэгтэй!',
        sisterTipEn: 'NEVER lift the lid while steaming — escaping steam ruins perfectly cooking tsuivan noodles.',
        timerMinutes: 15,
        heatLevel: 'Medium',
        stepIngredients: ['Хэрчсэн Гурилан Зураас', 'Мах-Ногооны Суурь'],
        toolsNeeded: ['Нягт таглаатай гүн таваг']
      },
      {
        title: '2 сэрээгээр агаар оруулж сугалах',
        titleEn: 'Toss & Fluff with Two Forks',
        description: 'Тагийг авч 2 сэрээгээр гурилыг доороос нь өргөж, агаар оруулж, 1-2 минут хурдан сугалан хутгана. Гурил тус тусдаа салж, мах-ногоо хооронд жигд хуваарилагдсан байх хэрэгтэй.',
        descriptionEn: 'Uncover and toss vigorously with two forks for 1-2 mins until noodles separate and puff up with meat evenly distributed.',
        image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
        sisterTip: '2 сэрээгээр зэрэг өргөж хутгах нь ресторан чанартай цүйвангийн нууц — нэг сэрээгээр тэр амт гардаггүй шүү!',
        sisterTipEn: 'Two forks simultaneously = restaurant-grade fluffy tsuivan. One fork just doesn\'t cut it!',
        timerMinutes: 2,
        toolsNeeded: ['2 ширхэг сэрээ', 'Халуун хоолны аяга']
      }
    ]
  },
  {
    id: 'bortts-dumpling-tea',
    title: 'Борцтой Банштай Цай',
    titleEn: 'Mongolian Bortts Dumpling Milk Tea',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
    time: '20 мин',
    difficulty: 'Medium',
    cuisine: 'Mongolian Traditional',
    category: 'Шөл ба Бүлээн хоол',
    rating: 5.0,
    tags: ['Монгол цай', 'Борц', 'Банштай цай'],
    ingredients: ['Борц', 'Гурил', 'Сүү', 'Шар тос / Сүүлний тос', 'Үхрийн мах', 'Сонгино', 'Давс', 'Хар перец'],
    ingredientsEn: ['Dried Beef (Bortts)', 'Flour', 'Milk', 'Yellow Butter', 'Minced Meat', 'Onion', 'Salt', 'Pepper'],
    nutrition: { calories: 430, protein: 29, carbs: 30, fat: 22 },
    isPremium: false,
    steps: [
      {
        title: 'Борц дэвтээх ба банш чимхэх',
        titleEn: 'Soak Dried Beef & Fold Dumplings',
        description: 'Борцоо бага зэрэг халуун усанд 15 минут дэвтээнэ. Махаа сонгино, давс, перецээр амтлан гуриланд чимхэж банш бэлтгэнэ.',
        descriptionEn: 'Soak dried beef in warm water. Mix minced meat with onions and spices, fold into dumplings.',
        image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Борцыг дэвтээснээр шөлөнд амт нь түргэн уусаж маш сайхан үнэр орно.',
        sisterTipEn: 'Soaking dried beef releases deep umami into the milk tea.'
      },
      {
        title: 'Цай сүлдэх ба борц сойх',
        titleEn: 'Brew Milk Tea & Sauté Bortts',
        description: 'Ногоон цайгаа чанаж шүүгээд, дээр нь сүү, давс нэмж сүүлэн самрна. Шар тосонд дэвтээсэн борцоо нэмж 2-3 минут хөнгөн хуурна.',
        descriptionEn: 'Brew green tea, add milk and salt, churn well. Sauté soaked dried beef in yellow butter.',
        image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Шар тосонд борцоо хуурч цайгаа сүүлбэл жинхэнэ нүүдэлчдийн тансаг цай болно.',
        sisterTipEn: 'Sautéing dried beef in ghee adds traditional richness.'
      },
      {
        title: 'Чанаж гүйцээх',
        titleEn: 'Simmer Tea & Cook Dumplings',
        description: 'Хуурсан борц дээрээ сүүлсэн цайгаа хийж буцалгана. Цай буцалмагц баншаа нэмж, тагийг таглан 8-10 минут буцалгахад банш босно.',
        descriptionEn: 'Pour milk tea into the pot with sautéed bortts, bring to boil, drop in dumplings and simmer 8-10 mins.',
        image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Банш хөвж гараад цайны дээж буцалмагц халуунаар нь таваглаарай.',
        sisterTipEn: 'Serve steaming hot as soon as the dumplings float.'
      }
    ]
  },
  // ================= 1. ӨГЛӨӨНИЙ ЦАЙ БА БРАНЧ =================
  {
    id: 'avocado-toast',
    title: 'Авокадотой Бүрээн Үрийн Тост ба Шэглэсэн Өндөг',
    titleEn: 'Avocado Toast & Poached Egg',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
    time: '10 мин',
    difficulty: 'Easy',
    cuisine: 'Healthy Fusion',
    category: 'Өглөөний цай',
    rating: 4.9,
    tags: ['Өглөөний цай', 'Эрүүл', 'Протеин'],
    ingredients: ['Гурил', 'Өндөг', 'Авокадо', 'Оливын тос', 'Давс', 'Хар перец'],
    ingredientsEn: ['Whole Grain Bread', 'Eggs', 'Avocado', 'Olive Oil', 'Salt', 'Black Pepper'],
    nutrition: { calories: 320, protein: 14, carbs: 28, fat: 18 },
    isPremium: false,
    steps: [
      {
        title: 'Талх ба авокадо бэлтгэх',
        titleEn: 'Prepare Toast & Mash Avocado',
        description: 'Бүрэн үрийн талхаа шарж, авокадогоо сэрээгээр нухаж оливын тос, нимбэгийн шүүсээр амтална.',
        descriptionEn: 'Toast whole grain bread and mash avocado with olive oil, lemon juice, and seasonings.',
        image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Авокадо дээрээ чили флейкс цацвал өглөөний эрч хүч нэмэгдэнэ!',
        sisterTipEn: 'Add chili flakes for a morning boost!'
      },
      {
        title: 'Өндөг чанах (Poached Egg)',
        titleEn: 'Poach Eggs',
        description: 'Буцалж буй усанд уксас нэмж, өндгөө 3 минут чанаж зөөлөн шар үлдээнэ.',
        descriptionEn: 'Poach eggs in simmering water with vinegar for 3 minutes until yolk remains runny.',
        image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Усаа эргүүлж хуйлруулж байгаад өндгөө дунд нь хийвэл хэлбэр нь төгс гардаг шүү.',
        sisterTipEn: 'Create a whirlpool in the water before dropping the egg in.'
      }
    ]
  },
  {
    id: 'overnight-oats',
    title: 'Овьёосны Шөнө Хоносон Пуддинг (Chia Overnight Oats)',
    titleEn: 'Chia Overnight Oats with Berries',
    image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=800&q=80',
    time: '5 мин',
    difficulty: 'Easy',
    cuisine: 'Global',
    category: 'Өглөөний цай',
    rating: 4.8,
    tags: ['Овьёос', 'Детокс', 'Түргэн'],
    ingredients: ['Овьёос', 'Сүү', 'Чиа үр', 'Зөгийн балы', 'Жимс', 'Самрын тос'],
    ingredientsEn: ['Rolled Oats', 'Milk', 'Chia Seeds', 'Honey', 'Berries', 'Peanut Butter'],
    nutrition: { calories: 280, protein: 11, carbs: 42, fat: 8 },
    isPremium: false,
    steps: [
      {
        title: 'Хольж бэлтгэх',
        titleEn: 'Mix Ingredients',
        description: 'Шилэн саванд овьёос, чиа үр, сүү, зөгийн балаа сайтар хутгаж хөргөгчинд хонуулна.',
        descriptionEn: 'Combine oats, chia seeds, milk, and honey in a jar. Chill overnight.',
        image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Өглөө нь шинэхэн бөөрөлзгөнө, самрын тос нэмж амтлаарай!',
        sisterTipEn: 'Top with berries and peanut butter in the morning.'
      }
    ]
  },
  {
    id: 'green-smoothie-bowl',
    title: 'Шпинат ба Бууцайтай Ногоон Смузи Боул',
    titleEn: 'Green Spinach & Mango Smoothie Bowl',
    image: 'https://images.unsplash.com/photo-1626078436896-1c2105151515?auto=format&fit=crop&w=800&q=80',
    time: '8 мин',
    difficulty: 'Easy',
    cuisine: 'Healthy',
    category: 'Өглөөний цай',
    rating: 4.7,
    tags: ['Смузи', 'Ногооны', 'Бага калори'],
    ingredients: ['Шпинат', 'Банан', 'Киви', 'Кокосын ус', 'Гранола'],
    ingredientsEn: ['Spinach', 'Banana', 'Kiwi', 'Coconut Water', 'Granola'],
    nutrition: { calories: 210, protein: 6, carbs: 45, fat: 3 },
    isPremium: false,
    steps: [
      {
        title: 'Блендерт миксдэх',
        titleEn: 'Blend Smoothie',
        description: 'Шпинат, хөлдөөсөн банан, киви ба кокосын усыг блендерт өтгөн болтол блендердэнэ.',
        descriptionEn: 'Blend spinach, frozen banana, kiwi, and coconut water until smooth and thick.',
        image: 'https://images.unsplash.com/photo-1626078436896-1c2105151515?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Мөсний оронд хөлдөөсөн банан хэрэглэвэл илүү крем шиг зөөлөн болно.',
        sisterTipEn: 'Use frozen banana instead of ice for a creamier texture.'
      }
    ]
  },
  {
    id: 'greek-protein-omelet',
    title: 'Грек Тарагтай Уургийн Омлет',
    titleEn: 'Greek Yogurt Protein Omelet',
    image: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=800&q=80',
    time: '12 мин',
    difficulty: 'Easy',
    cuisine: 'Mediterranean',
    category: 'Өглөөний цай',
    rating: 4.9,
    tags: ['Омлет', 'Үхрийн/Өндөг', 'High Protein'],
    ingredients: ['Өндөг', 'Грек тараг', 'Черри томат', 'Шпинат', 'Оливын тос'],
    ingredientsEn: ['Eggs', 'Greek Yogurt', 'Cherry Tomatoes', 'Spinach', 'Olive Oil'],
    nutrition: { calories: 310, protein: 26, carbs: 7, fat: 19 },
    isPremium: true,
    steps: [
      {
        title: 'Өндөг хутгах',
        titleEn: 'Whisk & Fry',
        description: 'Өндгөө Грек тарагтай сайтар миксдэж, бага тосонд зөөлөн галаар шарж гурвалжин нугална.',
        descriptionEn: 'Whisk eggs with Greek yogurt for extra fluffiness and fry gently in olive oil.',
        image: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Грек тараг нэмснээр омлет өндөр уурагтай бөгөөд хөвсгөр зөөлөн болно.',
        sisterTipEn: 'Greek yogurt makes the omelet ultra-fluffy and protein-dense.'
      }
    ]
  },

  // ================= 2. САЛАТ БА ХӨНГӨН ЗУУШ =================
  {
    id: 'salmon-nicoise-salad',
    title: 'Сэлмон Загастай Нисуаз Салат',
    titleEn: 'Salmon Nicoise Salad',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    time: '20 мин',
    difficulty: 'Medium',
    cuisine: 'French',
    category: 'Салат ба Хөнгөн зууш',
    rating: 4.9,
    tags: ['Сэлмон', 'Салат', 'Омега3'],
    ingredients: ['Сэлмон загас', 'Өндөг', 'Черри томат', 'Оливтой соус', 'Ногоон салат'],
    ingredientsEn: ['Salmon Fillet', 'Boiled Eggs', 'Cherry Tomatoes', 'Olives', 'Salad Greens'],
    nutrition: { calories: 380, protein: 32, carbs: 12, fat: 22 },
    isPremium: false,
    steps: [
      {
        title: 'Загас шарах ба цуглуулах',
        titleEn: 'Sear Salmon & Assemble',
        description: 'Сэлмон загасаа оливын тос, нимбэгээр амталж 5 минут шараад чанасан өндөг, черри томаттай таваглана.',
        descriptionEn: 'Pan-sear salmon, slice eggs, toss with fresh greens, cherry tomatoes and Dijon vinaigrette.',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Сэлмоноо хэт шарж хатаахгүй, голыг нь шүүслэг үлдээгээрэй!',
        sisterTipEn: 'Keep the salmon juicy in the middle!'
      }
    ]
  },
  {
    id: 'quinoa-greek-salad',
    title: 'Киноа ба Грек Салат',
    titleEn: 'Quinoa Greek Mediterranean Salad',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    time: '15 мин',
    difficulty: 'Easy',
    cuisine: 'Greek',
    category: 'Салат ба Хөнгөн зууш',
    rating: 4.8,
    tags: ['Киноа', 'Вегетариан', 'Грек'],
    ingredients: ['Киноа', 'Дөнгөж хэрчсэн өргөст хэмх', 'Фета бяслаг', 'Олив', 'Улаан сонгино'],
    ingredientsEn: ['Quinoa', 'Cucumber', 'Feta Cheese', 'Kalamata Olives', 'Red Onion'],
    nutrition: { calories: 310, protein: 12, carbs: 36, fat: 14 },
    isPremium: false,
    steps: [
      {
        title: 'Киноа чанах ба салат хутгах',
        titleEn: 'Cook Quinoa & Toss',
        description: 'Чанаж хөргөсөн киноаг өргөст хэмх, фета бяслаг, оливын тос ба ореганогоор амтлан холино.',
        descriptionEn: 'Combine cooked cool quinoa with diced cucumber, olives, feta, olive oil and oregano.',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Фета бяслагаа гараараа буталж хийвэл амт нь жигд тардаг.',
        sisterTipEn: 'Crumble feta by hand for even flavor distribution.'
      }
    ]
  },
  {
    id: 'chicken-kale-caesar',
    title: 'Тахианы Цээж Малтай Кейл Цезарь Салат',
    titleEn: 'Chicken Kale Caesar Salad',
    image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=800&q=80',
    time: '20 мин',
    difficulty: 'Easy',
    cuisine: 'American',
    category: 'Салат ба Хөнгөн зууш',
    rating: 4.9,
    tags: ['Тахиа', 'Цезарь', 'Кейл'],
    ingredients: ['Тахианы цээж мах', 'Кейл / Романо салат', 'Пармезан бяслаг', 'Сухари', 'Цезарь соус'],
    ingredientsEn: ['Chicken Breast', 'Kale Leaves', 'Parmesan Cheese', 'Croutons', 'Caesar Dressing'],
    nutrition: { calories: 390, protein: 35, carbs: 16, fat: 20 },
    isPremium: false,
    steps: [
      {
        title: 'Тахиа гриллдэх',
        titleEn: 'Grill Chicken & Toss',
        description: 'Тахианы цээж махаа амталж гриллдээд, кейл навч, пармезан, хөнгөн соустай цуг таваглана.',
        descriptionEn: 'Grill seasoned chicken breast, slice thinly, and toss with massaged kale and Parmesan.',
        image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Кейл навчаа оливын тосоор 1 минут базвал зөөлөн бөгөөд амттай болно.',
        sisterTipEn: 'Massage kale leaves with olive oil to soften them.'
      }
    ]
  },
  {
    id: 'hummus-veggie-platter',
    title: 'Хумустай Ногооны Таваг (Hummus Platter)',
    titleEn: 'Fresh Hummus & Fresh Veggie Platter',
    image: 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=800&q=80',
    time: '10 мин',
    difficulty: 'Easy',
    cuisine: 'Middle Eastern',
    category: 'Салат ба Хөнгөн зууш',
    rating: 4.7,
    tags: ['Хумус', 'Веган', 'Снэк'],
    ingredients: ['Гурвалжин нут шош', 'Лууван', 'Өргөст хэмх', 'Чипс / Пита талх', 'Оливын тос'],
    ingredientsEn: ['Chickpeas Hummus', 'Carrots', 'Cucumbers', 'Pita Chips', 'Olive Oil'],
    nutrition: { calories: 250, protein: 9, carbs: 32, fat: 10 },
    isPremium: false,
    steps: [
      {
        title: 'Ногоо хэрчих ба таваглах',
        titleEn: 'Slice & Serve',
        description: 'Лууван, өргөст хэмхийг урт нарийн хэрчиж, хумус болон паприка, оливын тостой хамт дэлгэнэ.',
        descriptionEn: 'Slice fresh carrots, cucumbers, and celery into sticks. Serve around fresh hummus.',
        image: 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Хумус дээрээ чимх паприка дуслуулж чихэрлэг тос нэмээрэй.',
        sisterTipEn: 'Drizzle extra virgin olive oil and paprika over the hummus.'
      }
    ]
  },

  // ================= 3. ҮНДСЭН ХООЛ =================
  {
    id: 'lasagna',
    title: 'Лазанья',
    titleEn: 'Classic Beef Lasagna',
    image: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=800&q=80',
    time: '60 мин',
    difficulty: 'Hard',
    cuisine: 'Italian',
    category: 'Үндсэн хоол',
    rating: 4.9,
    tags: ['Лазанья', 'Үхрийн мах', 'Итали'],
    ingredients: ['Үхрийн мах', 'Гурил', 'Сүү', 'Бяслаг', 'Томат соус', 'Сонгино'],
    ingredientsEn: ['Beef', 'Flour', 'Milk', 'Mozzarella Cheese', 'Tomato Sauce', 'Onion'],
    nutrition: { calories: 680, protein: 38, carbs: 54, fat: 32 },
    isPremium: false,
    steps: [
      {
        title: 'Сонгино & Сармис сотолж бэлтгэх',
        titleEn: 'Sauté Onions & Garlic',
        description: 'Гүн хайруулын тавгаа дунд гал дээр халааж, 2 хоолны халбага оливын тосонд нарийн жижиглэсэн сонгино, сармисаа алтан шар өнгөтэй, анхилуун үнэртэй болтол 4-5 минут сотолно.',
        descriptionEn: 'Heat olive oil in a deep pan, sauté finely chopped onions and garlic until translucent and fragrant.',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Сонгиноо зөөлөн гал дээр карамельжуулбал соусны амт байгалийн чихэрлэг бөгөөд тансаг болдог.',
        sisterTipEn: 'Slowly caramelizing onions creates a naturally sweet flavor base.',
        timerMinutes: 5,
        heatLevel: 'Medium',
        stepIngredients: ['Сонгино (1 ш жижиглэсэн)', 'Сармис (3 хүүш)', 'Оливын тос (2 хоолны халбага)'],
        toolsNeeded: ['Гүн хайруулын таваг', 'Модон хутгуур']
      },
      {
        title: 'Үхрийн мах & Болоньез соус бэлтгэх',
        titleEn: 'Bolognese Meat Sauce',
        description: 'Сотолсон сонгино дээр үхрийн татсан махаа нэмж бөөгнөрүүлэхгүй задартал хуурна. Дараа нь томат паста, орегано, давс, хар перец нэмж 12 минут зөөлөн гал дээр самран буцалгана.',
        descriptionEn: 'Add minced beef, cook until browned. Stir in tomato sauce, oregano, salt, and pepper. Simmer for 12 mins.',
        image: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Соус буцалж байхад 1 чимх саахар нэмбэл томатын хүчиллэг чанарыг зөөллөж амтыг нь тэнцвэржүүлнэ.',
        sisterTipEn: 'Adding a pinch of sugar balances the acidity of the tomatoes.',
        timerMinutes: 12,
        heatLevel: 'Low',
        stepIngredients: ['Үхрийн татсан мах (500 гр)', 'Томат паста (300 мл)', 'Орегано амтлагч (1 цааны халбага)', 'Давс & Хар перец'],
        toolsNeeded: ['Модон хутгуур', 'Таглаа']
      },
      {
        title: 'Бешамель (Цагаан соус) чанах',
        titleEn: 'Prepare Béchamel Sauce',
        description: 'Жижиг саванд шар тосоо хайлуулж гурилаа нэмэн 1 минут хуурна. Бүлээн сүүгээ бага багаар гоожуулан хутгууртаар тасралтгүй хутгаж, өтгөртөл 6-8 минут зөөлөн гал дээр чанана.',
        descriptionEn: 'Melt butter, add flour, cook 1 min. Gradually whisk in warm milk and cook until thick and creamy.',
        image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Сүүгээ бүлээнээр нь бага багаар нэмж хутгуурыг зогсолтгүй хөдөлгөвөл соус бөөгнөрөхгүй торгомсог болно.',
        sisterTipEn: 'Whisk continuously while pouring warm milk to achieve a silky smooth texture.',
        timerMinutes: 8,
        heatLevel: 'Low',
        stepIngredients: ['Шар тос / Маргарин (50 гр)', 'Гурил (2 хоолны халбага)', 'Бүлээн сүү (500 мл)', 'Задь жимс (1 чимх)'],
        toolsNeeded: ['Шөлний жижиг сав', 'Гар хутгуур (Whisk)']
      },
      {
        title: 'Лазанья гоймон чанах ба зөөлрүүлэх',
        titleEn: 'Boil Lasagna Sheets',
        description: 'Том тогоонд усаа сайн буцалгаж 1 чимх давс нэмнэ. Гоймонгийн хуудаснуудыг 5-6 минут чанаж зөөлрүүлээд шүүж, наалдуулахгүйн тулд цэвэр алчуур дээр дэлгэн тавина.',
        descriptionEn: 'Boil lasagna sheets in salted water for 5-6 mins. Drain and lay flat on a clean cloth to prevent sticking.',
        image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281318?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Чанах усандаа хэдэн дусал оливын тос дусгавал гоймон чанах үед бие биедээ наалдахгүй.',
        sisterTipEn: 'A drop of olive oil in boiling water keeps sheets from sticking together.',
        timerMinutes: 6,
        heatLevel: 'High',
        stepIngredients: ['Лазанья гоймон (12 хуудас)', 'Давстай буцалсан ус'],
        toolsNeeded: ['Том тогоо', 'Шүүгч сэрээ']
      },
      {
        title: 'Хэвэнд давхарлан угсрах (Layering)',
        titleEn: 'Assemble Lasagna Layers',
        description: 'Дөрвөлжин шилэн хэвний ёроолд бешамель соус тонгоруулж түрхэнэ. Гоймон -> Болоньез махны соус -> Бешамель цагаан соус -> Моцарелла бяслаг гэх дарааллаар 3-4 үе давхарлана.',
        descriptionEn: 'Spread béchamel on baking dish bottom. Layer sheets, meat sauce, béchamel, and mozzarella cheese.',
        image: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Хамгийн дээд талын үе дээр бешамель соус болон Моцарелла бяслагаа маш сайн зузаан бүрж цацаарай.',
        sisterTipEn: 'Top with a rich layer of béchamel and shredded mozzarella for maximum cheesiness.',
        timerMinutes: 5,
        stepIngredients: ['Моцарелла бяслаг (250 гр хэрчсэн)', 'Үрсэн Пармезан бяслаг (50 гр)'],
        toolsNeeded: ['Шарах шүүгээний дөрвөлжин шилэн хэв']
      },
      {
        title: 'Шарах шүүгээнд жигнэж шаргалдуулах',
        titleEn: 'Bake to Golden Perfection',
        description: '190°C хүртэл халаасан шарах шүүгээнд фольга цаасаар таглаж 20 минут, дараа нь цаасыг авч бяслагийг алтан бор шаржигнасан болтол 8 минут шарна. Гаргаад 10 минут амраасны дараа зүснэ.',
        descriptionEn: 'Cover with foil and bake at 190°C for 20 mins. Uncover and bake 8 mins until cheese is golden brown. Rest 10 mins.',
        image: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Шарах шүүгэнээс гарсан дор нь шууд зүсэлгүй 10 минут амраавал давхаргууд нь нурахгүй тэгш сайхан зүсэгдэнэ.',
        sisterTipEn: 'Letting the lasagna rest for 10 mins sets the layers perfectly for neat slicing.',
        timerMinutes: 28,
        heatLevel: 'Medium',
        stepIngredients: ['Амраасан Лазанья'],
        toolsNeeded: ['Шарах шүүгээ (190°C)', 'Фольга цаас', 'Тогоочийн хутга']
      }
    ]
  },
  {
    id: 'carbonara',
    title: 'Карбонара Паста',
    titleEn: 'Spaghetti Carbonara',
    image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=800&q=80',
    time: '20 мин',
    difficulty: 'Medium',
    cuisine: 'Italian',
    category: 'Үндсэн хоол',
    rating: 4.8,
    tags: ['Гоймон', 'Өндөг', 'Итали'],
    ingredients: ['Гурил', 'Өндөг', 'Бяслаг', 'Сармис'],
    ingredientsEn: ['Pasta', 'Eggs', 'Parmesan Cheese', 'Garlic'],
    nutrition: { calories: 520, protein: 24, carbs: 62, fat: 20 },
    isPremium: false,
    steps: [
      {
        title: 'Спагетти гоймон чанах',
        titleEn: 'Boil Spaghetti Al Dente',
        description: 'Том тогоонд ус буцалгаж 1 хоолны халбага давс нэмнэ. Спагетти гоймонгоо хийж сав дахь заавар дагуу (ихэвчлэн 9-10 мин) al dente буюу хэсэгчлэн зуурдаг болтол чанана. Чанасан уснаас 1 аяга нөөцлөж авна.',
        descriptionEn: 'Boil pasta in heavily salted water for 9-10 mins until al dente. Reserve 1 cup of pasta water before draining.',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Гоймон чанасан давстай усыг заавал нөөцлөж аваарай — энэ бол карбонарагийн соусыг хамгийн торгомсог, кремлэг болгодог нууц зэвсэг!',
        sisterTipEn: 'Pasta water is liquid gold for carbonara — its starch makes the sauce unbelievably silky and emulsified.',
        timerMinutes: 10,
        heatLevel: 'High',
        stepIngredients: ['Спагетти гоймон (400 гр)', 'Давстай буцалсан ус (4 л)', 'Нөөцлөх ус (1 аяга)'],
        toolsNeeded: ['Том тогоо', 'Аяга (уснд нөөцлөхөд)', 'Шүүгч сэрээ']
      },
      {
        title: 'Гуанчале / Бекон шарах',
        titleEn: 'Render Guanciale / Bacon',
        description: 'Хайруулын тавагт тос хийлгүй гуанчале буюу бекон мах нарийн зурааслан хэрчсэнийг тавьж зөөлөн гал дээр 4-5 минут тосоо гаргах ба шаржигнасан болтол хуурна.',
        descriptionEn: 'Without any added oil, render guanciale/bacon strips in pan on medium-low for 4-5 mins until crispy fat renders out.',
        image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6288307?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Тос нэмэхгүйгээр өөрийн тосыг нь гаргах нь бекон/гуанчале-г маш шаржигнасан, дотор нь хайлмаг болгодог шүү.',
        sisterTipEn: 'No added oil — render the fat from the pork itself for the most authentic, rich carbonara flavor.',
        timerMinutes: 5,
        heatLevel: 'Low',
        stepIngredients: ['Гуанчале / Бекон (150 гр нарийн зурааслан)'],
        toolsNeeded: ['Хайруулын таваг', 'Металл хутгуур']
      },
      {
        title: 'Өндөг & Бяслагны холимог бэлтгэх',
        titleEn: 'Whisk Egg & Cheese Mixture',
        description: 'Том аяганд өндгийн 3 шар, Пармезан (эсвэл Пекорино) бяслаг сайн үрж хийж, хар перец сайтар нэмнэ. Сугалан зорч сайн холино. Энэ холимог нь галд тусахгүй — зөвхөн гоймоны дулааноор зуурагдана.',
        descriptionEn: 'In a bowl, whisk 3 egg yolks with finely grated parmesan and generous black pepper. This MUST never touch direct heat.',
        image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Өндгийг галд шууд тавивал хурдан гурвалжин хатаж сэлгэлдэнэ — Scrambled Eggs болно! Бүх зоригоороо галаас холдоорой.',
        sisterTipEn: 'NEVER put eggs near heat — they WILL scramble instantly. The only heat they need is from the warm pasta itself.',
        stepIngredients: ['Өндгийн шар (3 ширхэг)', 'Пармезан бяслаг (80 гр нарийн үрсэн)', 'Хар перец (1 цааны халбага шинэ бутарсан)'],
        toolsNeeded: ['Холих аяга', 'Хутгуур', 'Бяслаг үрэх утасны шүүр']
      },
      {
        title: 'Бүх зүйлийг нэгтгэх — Галаас гаргасны дараа!',
        titleEn: 'Combine Off Heat — This Step is Sacred',
        description: 'Гоймонг шүүж беконтой хайруулын тавагт хийнэ. ГАЛААС ГАРГА. Өндгийн холимогоо хийж хурдан хутгана. Нөөцлөсөн гоймоны усны 2-3 хоолны халбагыг нэмэн сугалан торгомсог кремлэг болтол хутгана.',
        descriptionEn: 'Drain pasta into bacon pan. REMOVE FROM HEAT. Add egg mixture immediately. Toss rapidly. Add pasta water 1 tbsp at a time until glossy and creamy.',
        image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Гоймоны ус нэмэх нь өндгийг тогтвортой эмульс болгодог — хэт их нэмэлгүй 1-2 хоолны халбагаар тохируулж сугал.',
        sisterTipEn: 'Add pasta water one spoon at a time — it emulsifies the eggs into glossy silk. This is the soul of real carbonara.',
        timerMinutes: 3,
        stepIngredients: ['Чанасан Спагетти', 'Шаржигнасан Бекон', 'Өндөг-Бяслагны Холимог', 'Нөөцлөсөн Гоймоны Ус (2-4 хоолны халбага)'],
        toolsNeeded: ['2 халбага (хурдан хутгахад)', 'Дулаан хоолны аяга']
      }
    ]
  },
  {
    id: 'lemon-herb-grilled-salmon',
    title: 'Нимбэг ба Ургамалтай Гриллдсэн Сэлмон Загас',
    titleEn: 'Lemon Herb Grilled Salmon with Asparagus',
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
    time: '20 мин',
    difficulty: 'Easy',
    cuisine: 'Gourmet',
    category: 'Үндсэн хоол',
    rating: 5.0,
    tags: ['Сэлмон', 'Зөөлөн', 'Keto'],
    ingredients: ['Сэлмон загас', 'Нимбэг', 'Сармис', 'Розмарин', 'Оливын тос', 'Ногоон мөөг'],
    ingredientsEn: ['Salmon Fillet', 'Lemon', 'Garlic', 'Rosemary', 'Olive Oil', 'Asparagus'],
    nutrition: { calories: 420, protein: 36, carbs: 6, fat: 28 },
    isPremium: true,
    steps: [
      {
        title: 'Сэлмон гриллдэх',
        titleEn: 'Sear & Roast Salmon',
        description: 'Сэлмон загасаа нимбэгийн шүүс, сармис, розмаринаар амтлан 12 минут гриллдэнэ.',
        descriptionEn: 'Season salmon fillet with fresh lemon juice, minced garlic, and rosemary. Pan-sear then bake.',
        image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Аспарагус (ногоон мөөг/ногоо)-той хамт шарахад төгс зохицдог.',
        sisterTipEn: 'Roast asparagus alongside for the perfect side dish.'
      }
    ]
  },
  {
    id: 'broccoli-chicken-grill',
    title: 'Брокколи ба Сармистай Тахианы Цээж Махны Грилл',
    titleEn: 'Garlic Broccoli Chicken Stir-Fry',
    image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
    time: '25 мин',
    difficulty: 'Medium',
    cuisine: 'Asian',
    category: 'Үндсэн хоол',
    rating: 4.8,
    tags: ['Тахиа', 'Брокколи', 'Fit'],
    ingredients: ['Тахианы цээж мах', 'Брокколи', 'Сармис', 'Сой соус', 'Гүнжид'],
    ingredientsEn: ['Chicken Breast', 'Broccoli', 'Garlic', 'Soy Sauce', 'Sesame Seeds'],
    nutrition: { calories: 380, protein: 44, carbs: 14, fat: 12 },
    isPremium: false,
    steps: [
      {
        title: 'Тахиа ба брокколи хуурах',
        titleEn: 'Stir-Fry Chicken & Broccoli',
        description: 'Тахианы махаа дөрвөлжин хэрчиж сой соусаар амтлаад брокколитой өндөр гал дээр хуурна.',
        descriptionEn: 'Diced chicken breasts sautéed with broccoli florets, garlic, and light soy sauce.',
        image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Гүнжидийн тос сүүлд нь дусгавал Ази ресторанд байгаа юм шиг анхилуун болно.',
        sisterTipEn: 'Drizzle sesame oil at the end for an authentic aroma.'
      }
    ]
  },
  {
    id: 'low-carb-beef-stew',
    title: 'Үхрийн Мах ба Нүүрс Ус Багатай Бүрэн Ногооны Гуляш',
    titleEn: 'Low-Carb Beef Veggie Stew',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    time: '35 мин',
    difficulty: 'Medium',
    cuisine: 'Traditional',
    category: 'Үндсэн хоол',
    rating: 4.9,
    tags: ['Үхрийн мах', 'Гуляш', 'Шөлтэй'],
    ingredients: ['Үхрийн мах', 'Цэцэгт байцаа', 'Лууван', 'Томат паста', 'Сонгино'],
    ingredientsEn: ['Beef Chuck', 'Cauliflower', 'Carrot', 'Tomato Paste', 'Onion'],
    nutrition: { calories: 410, protein: 42, carbs: 16, fat: 20 },
    isPremium: false,
    steps: [
      {
        title: 'Үхрийн мах ба ногоо жигнэх',
        titleEn: 'Slow Simmer Beef & Veggies',
        description: 'Үхрийн махаа дөрвөлжин хэрчин сонгино, томатад жигнэж ногоонуудаа зөөлөртөл буцалгана.',
        descriptionEn: 'Simmer tender beef cubes with cauliflower, carrots, and tomato broth.',
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Төмсний оронд цэцэгт байцаа хэрэглэснээр нүүрс ус маш багатай болно.',
        sisterTipEn: 'Swap potatoes for cauliflower for a low-carb alternative.'
      }
    ]
  },
  {
    id: 'pad-thai',
    title: 'Пад Тай',
    titleEn: 'Authentic Shrimp Pad Thai',
    image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80',
    time: '25 мин',
    difficulty: 'Medium',
    cuisine: 'Thai',
    category: 'Үндсэн хоол',
    rating: 4.9,
    tags: ['Пад Тай', 'Сам хорхой', 'Тайланд'],
    ingredients: ['Гоймон', 'Сам хорхой', 'Өндөг', 'Самрын үйрмэг', 'Лимон'],
    ingredientsEn: ['Rice Noodles', 'Shrimp', 'Eggs', 'Peanuts', 'Lime'],
    nutrition: { calories: 450, protein: 26, carbs: 58, fat: 14 },
    isPremium: true,
    steps: [
      {
        title: 'Будааны гоймон бэлтгэх',
        titleEn: 'Soak Noodles & Wok Fry',
        description: 'Будааны гоймонгоо дэвтээж, сам хорхой ба өндөгтэй хамт вок тогоонд хуурна.',
        descriptionEn: 'Soak rice noodles, then stir-fry with shrimp, scrambled egg, tamarind sauce.',
        image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Лимоны шүүс ба газрын самар нэмж өгвөл Тайланд амт бэлэн болно.',
        sisterTipEn: 'Finish with fresh lime juice and crushed peanuts.'
      }
    ]
  },

  // ================= 4. ШӨЛ БА БҮЛЭЭН ХООЛ =================
  {
    id: 'pumpkin-soup',
    title: 'Ногоон Хулдангийн (Pumpkin) Зутан Шөл',
    titleEn: 'Creamy Roasted Pumpkin Soup',
    image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=800&q=80',
    time: '30 мин',
    difficulty: 'Easy',
    cuisine: 'European',
    category: 'Шөл ба Бүлээн хоол',
    rating: 4.8,
    tags: ['Хулдаа', 'Шөл', 'Зутан'],
    ingredients: ['Амтат хулдаа', 'Сүү', 'Сонгино', 'Сармис', 'Тос'],
    ingredientsEn: ['Pumpkin', 'Cream/Milk', 'Onion', 'Garlic', 'Butter'],
    nutrition: { calories: 210, protein: 5, carbs: 32, fat: 8 },
    isPremium: false,
    steps: [
      {
        title: 'Хулдаа шарж миксдэх',
        titleEn: 'Roast & Blend',
        description: 'Хулдаагаа шарах шүүгээнд шарж, сонгино сармистай хуурснаар блендерт миксдэн зутан шөл болгоно.',
        descriptionEn: 'Roast pumpkin slices, saute onions and garlic, then blend into a silky creamy soup.',
        image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Хулдааны үр эсвэл сухари дээр нь цацвал яг ресторанд идэж байгаа мэт болно.',
        sisterTipEn: 'Top with toasted pumpkin seeds and croutons.'
      }
    ]
  },
  {
    id: 'italian-tomato-soup',
    title: 'Томат ба Базиликтай Итали Зутан Шөл',
    titleEn: 'Italian Tomato Basil Soup',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
    time: '25 мин',
    difficulty: 'Easy',
    cuisine: 'Italian',
    category: 'Шөл ба Бүлээн хоол',
    rating: 4.7,
    tags: ['Томат', 'Шөл', 'Итали'],
    ingredients: ['Улаан лооль', 'Базилик', 'Сармис', 'Оливын тос', 'Бальзамик уксус'],
    ingredientsEn: ['Tomatoes', 'Fresh Basil', 'Garlic', 'Olive Oil', 'Balsamic Vinegar'],
    nutrition: { calories: 190, protein: 4, carbs: 24, fat: 9 },
    isPremium: false,
    steps: [
      {
        title: 'Томат буцалгах',
        titleEn: 'Simmer & Puree',
        description: 'Шинэхэн улаан лоолийг сармис, базиликтэй 15 минут буцалгаж блендерээр зөөлөн зутан болгоно.',
        descriptionEn: 'Simmer ripe tomatoes with fresh basil and garlic, then puree until velvety smooth.',
        image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Халуун талх дүрж идвэл маш сайхан амттай!',
        sisterTipEn: 'Pair with warm toasted garlic bread.'
      }
    ]
  },
  {
    id: 'broccoli-cheddar-soup',
    title: 'Брокколи ба Чеддар Бяслагтай Эрүүл Шөл',
    titleEn: 'Healthy Broccoli Cheddar Soup',
    image: 'https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?auto=format&fit=crop&w=800&q=80',
    time: '25 мин',
    difficulty: 'Medium',
    cuisine: 'American',
    category: 'Шөл ба Бүлээн хоол',
    rating: 4.9,
    tags: ['Брокколи', 'Бяслаг', 'Суп'],
    ingredients: ['Брокколи', 'Чеддар бяслаг', 'Сүү', 'Сонгино', 'Гурил'],
    ingredientsEn: ['Broccoli', 'Cheddar Cheese', 'Milk', 'Onion', 'Flour'],
    nutrition: { calories: 260, protein: 14, carbs: 18, fat: 16 },
    isPremium: false,
    steps: [
      {
        title: 'Брокколи чанаж бяслаг холих',
        titleEn: 'Simmer & Melt Cheese',
        description: 'Брокколигоо ногооны шөлөнд чанаад чеддар бяслаг ба сүү нэмэн өтгөрүүлж бэлтгэнэ.',
        descriptionEn: 'Simmer fresh broccoli in vegetable stock, melt cheddar cheese into a warm savory soup.',
        image: 'https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Брокколин хэсгүүдийг бүтнээр нь бага зэрэг үлдээвэл зажлахад гоё амттай.',
        sisterTipEn: 'Leave a few small broccoli florets whole for texture.'
      }
    ]
  },
  {
    id: 'miso-tofu-soup',
    title: 'Мисо Шөл ба Тофу, Вакаме Замаг',
    titleEn: 'Authentic Miso Tofu Soup',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
    time: '10 мин',
    difficulty: 'Easy',
    cuisine: 'Japanese',
    category: 'Шөл ба Бүлээн хоол',
    rating: 4.8,
    tags: ['Мисо', 'Тофу', 'Япон'],
    ingredients: ['Мисо паста', 'Тофу', 'Вакаме замаг', 'Ногоон сонгино', 'Даши шөл'],
    ingredientsEn: ['Miso Paste', 'Silken Tofu', 'Wakame Seaweed', 'Green Onion', 'Dashi Broth'],
    nutrition: { calories: 140, protein: 10, carbs: 12, fat: 5 },
    isPremium: false,
    steps: [
      {
        title: 'Мисо уусгах',
        titleEn: 'Dissolve Miso & Serve',
        description: 'Халуун усанд мисо пастагаа уусгаж тофу ба вакаме замгаа хийж 2 минут зөөлөн галаар халаана.',
        descriptionEn: 'Whisk miso paste into warm dashi broth, add cubed silken tofu and seaweed.',
        image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Мисогоо хэт буцалгаж болохгүй, шим тэжээл нь алдагдах аюултай.',
        sisterTipEn: 'Do not boil miso paste directly; keep it simmering gently.'
      }
    ]
  },

  // ================= 5. ЭРҮҮЛ ДЕССЕРТ БА УНДАА =================
  {
    id: 'avocado-chocolate-mousse',
    title: 'Авокадо ба Какаотой Шоколадан Мусс',
    titleEn: 'Avocado Dark Chocolate Mousse',
    image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80',
    time: '10 мин',
    difficulty: 'Easy',
    cuisine: 'Healthy Sweet',
    category: 'Эрүүл дессерт ба Ундаа',
    rating: 4.9,
    tags: ['Шоколад', 'Дессерт', 'Авокадо'],
    ingredients: ['Авокадо', 'Какао нунтаг', 'Кленовын сироп / Зөгийн бал', 'Ваниль', 'Бөөрөлзгөнө'],
    ingredientsEn: ['Avocado', 'Cocoa Powder', 'Maple Syrup/Honey', 'Vanilla', 'Raspberries'],
    nutrition: { calories: 230, protein: 4, carbs: 22, fat: 15 },
    isPremium: false,
    steps: [
      {
        title: 'Блендерт өтгөрүүлэх',
        titleEn: 'Blend Creamy Mousse',
        description: 'Зөөлөрсөн авокадо, какао нунтаг ба сиропыг блендерт хилэн шиг торгомсог болтол блендердэнэ.',
        descriptionEn: 'Blend ripe avocado, dark cocoa powder, and natural sweetener until velvety smooth.',
        image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Хөргөгчинд 30 минут хүйтэн байлгавал яг жинхэнэ мусс шиг өтгөрнө.',
        sisterTipEn: 'Chill for 30 minutes before serving.'
      }
    ]
  },
  {
    id: 'matcha-oat-latte',
    title: 'Матча (Matcha) Лате ба Овьёосны Сүү',
    titleEn: 'Iced Matcha Latte with Oat Milk',
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80',
    time: '5 мин',
    difficulty: 'Easy',
    cuisine: 'Japanese Drink',
    category: 'Эрүүл дессерт ба Ундаа',
    rating: 4.9,
    tags: ['Матча', 'Ундаа', 'Овьёос сүү'],
    ingredients: ['Япон матча нунтаг', 'Халуун ус', 'Овьёосны сүү', 'Мөс', 'Стевиа / Зөгийн бал'],
    ingredientsEn: ['Japanese Matcha Powder', 'Hot Water', 'Oat Milk', 'Ice', 'Honey'],
    nutrition: { calories: 110, protein: 3, carbs: 14, fat: 4 },
    isPremium: false,
    steps: [
      {
        title: 'Матча хутгах ба сүү юүлэх',
        titleEn: 'Whisk Matcha & Pour Milk',
        description: 'Матча нунтгаа халуун усанд хуулшаар хутган уусгаад, мөстэй овьёосны сүүн дээрээ асгана.',
        descriptionEn: 'Whisk matcha powder with hot water until foamy, pour over iced oat milk.',
        image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Матча нь кофеноос илүү зөөлөн, удаан хугацааны эрч хүч өгдөг шүү!',
        sisterTipEn: 'Matcha provides sustained calm energy without jitters.'
      }
    ]
  },
  {
    id: 'ginger-lemon-detox-tea',
    title: 'Цагаан Гаа ба Лимонтой Детокс Цай',
    titleEn: 'Warm Ginger Lemon Detox Tea',
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
    time: '5 мин',
    difficulty: 'Easy',
    cuisine: 'Detox Drink',
    category: 'Эрүүл дессерт ба Ундаа',
    rating: 4.8,
    tags: ['Детокс', 'Цай', 'Цагаан гаа'],
    ingredients: ['Шинэ цагаан гаа', 'Куркума нунтаг', 'Лимоны шүүс', 'Зөгийн бал', 'Халуун ус'],
    ingredientsEn: ['Fresh Ginger', 'Turmeric Powder', 'Lemon Juice', 'Honey', 'Hot Water'],
    nutrition: { calories: 45, protein: 1, carbs: 10, fat: 0 },
    isPremium: false,
    steps: [
      {
        title: 'Цай хандалах',
        titleEn: 'Brew & Infuse',
        description: 'Цагаан гаа ба куркумаг халуун усанд 5 минут хандалж, лимон ба зөгийн балаар амтална.',
        descriptionEn: 'Steep freshly grated ginger and turmeric in hot water for 5 mins. Add lemon and honey.',
        image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Өглөө өлөн дээрээ уувал дархлаа дэмжиж, хоол холиход тустай.',
        sisterTipEn: 'Drink first thing in the morning to boost immunity.'
      }
    ]
  },
  {
    id: 'berry-greek-energy-bowl',
    title: 'Грек Тарагтай Бөөрөлзгөний Энержи Боул',
    titleEn: 'Greek Yogurt Raspberry Energy Bowl',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
    time: '5 мин',
    difficulty: 'Easy',
    cuisine: 'Healthy Snack',
    category: 'Эрүүл дессерт ба Ундаа',
    rating: 4.9,
    tags: ['Тараг', 'Бөөрөлзгөнө', 'Дессерт'],
    ingredients: ['Грек тараг', 'Бөөрөлзгөнө', 'Гранола', 'Самрын үр', 'Зөгийн бал'],
    ingredientsEn: ['Greek Yogurt', 'Raspberries', 'Granola', 'Mixed Nuts', 'Honey'],
    nutrition: { calories: 220, protein: 15, carbs: 24, fat: 6 },
    isPremium: false,
    steps: [
      {
        title: 'Боул таваглах',
        titleEn: 'Assemble Energy Bowl',
        description: 'Грек таргаа аяганд хийж, бөөрөлзгөнө, шаржигнасан гранола ба зөгийн балаар чимэглэнэ.',
        descriptionEn: 'Spoon thick Greek yogurt into a bowl. Top with fresh berries, granola, and honey drizzle.',
        image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
        sisterTip: 'Дессерт идэх хүслээ дарах хамгийн эрүүл бөгөөд уураглаг сонголт!',
        sisterTipEn: 'The healthiest way to satisfy a dessert craving!'
      }
    ]
  }
];
