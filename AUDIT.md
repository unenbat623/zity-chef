# Zity Chef — Үлдсэн ажлын жагсаалт

**Огноо:** 2026-08-18
**Статус:** Аудитаар илэрсэн бүх код-түвшний асуудал засагдсан. Доор зөвхөн **үлдсэн** зүйлс.

Кодын өөрчлөлтийн түүхийг git-ээс үзнэ үү.

---

## 🔴 Production гаргахын өмнө заавал

### 1. QPay merchant credentials тохируулах

```bash
QPAY_USERNAME=...
QPAY_PASSWORD=...
QPAY_INVOICE_CODE=...
QPAY_CALLBACK_URL=https://<домэйн>/api/payments/qpay/callback
```

Эдгээргүйгээр production-д төлбөр **зориудаар идэвхгүй** байна — `/api/payments/qpay/create`
нь `503 PAYMENTS_UNAVAILABLE` буцаана.

> Яагаад чухал вэ: өмнө нь credentials байхгүй үед симуляц ажиллаж, **бүх багц үнэгүй**
> олгогддог байсан. Одоо чимээгүй үнэгүй олгохын оронд шударгаар татгалзана.

### 2. Supabase-д өөрийн SMTP холбох

Үнэгүй tier дээр имэйлийн хязгаар цагт ~2 — туршилтын үеэр бодитоор
`429 email rate limit exceeded` тулгарсан. Үүнгүйгээр бодит хэрэглэгчид бүртгүүлж чадахгүй.

Supabase Dashboard → Project Settings → Authentication → SMTP Settings.

---

## 🟠 Тохиргоо (нэг удаагийн)

### 3. Имэйл баталгаажуулалтын хэлбэрээ сонгох

Одоогийн байдал (бодитоор шалгасан): Supabase **линк** илгээдэг, апп нь
хоёуланг нь дэмждэг ("линк дээр дар, эсвэл код ирсэн бол оруул").

- **Линкээр үлдээх** → нэмэлт ажил байхгүй.
- **6 оронтой код руу шилжих** → Dashboard → Authentication → Email Templates дотор
  `{{ .Token }}`-той template тохируулна.

### 4. Sentry source map upload

`vite.config.ts`-д `sourcemap: 'hidden'` асаалттай — map файлууд үүсдэг ч Sentry рүү
илгээгддэггүй тул production-ийн stack trace минифкац хэвээр байна.

Deploy pipeline-д нэмэх:
```bash
sentry-cli sourcemaps upload ./dist --release "$VITE_SENTRY_RELEASE"
```

### 5. Vercel ашиглах бол `maxDuration` шалгах

`vercel.json` дээр `maxDuration: 30` — Hobby tier дээр 10 секундын хязгаартай тул
татгалзагдах эсвэл чимээгүй хасагдана. Pro tier бол асуудалгүй.

---

## Дахин шалгах

```bash
npm run dev                 # UI + API (порт эзэлсэн бол Vite 3001 руу шилжинэ)
npm run lint && npm test    # type check + 10 тест
npm run build               # production bundle
npm run db:push             # migration-ууд (бүгд хэрэгжсэн)
```

Хамгийн сүүлийн бүрэн шалгалтын үр дүн:

| Шалгалт | Үр дүн |
|---|---|
| Responsive скан (5 өргөн × 9 таб) | 0 асуудал |
| Label ↔ input холболт | 31/31 |
| Төлбөр/захиалгын аюулгүй байдал (бодит session) | 12/12 |
| RLS хамгаалалт + жинхэнэ засварууд эвдрээгүй | 6/6 |
| Bundle split + demo feed тусгаарлалт + DM формат | 10/10 |
| lint / build / test | ✅ |

**Үндсэн JS chunk:** 282 kB (gzip 63 kB) — vendor-ууд тусад нь кэшлэгдэнэ.
