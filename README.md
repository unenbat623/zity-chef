# 🍳 Zity Chef — Smart AI Cooking & Grocery Ecosystem

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Google Gemini API](https://img.shields.io/badge/Google_Gemini-3.x-8E44AD?style=for-the-badge&logo=googlecloud&logoColor=white)](https://ai.google.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-4A154B?style=for-the-badge&logo=pwa&logoColor=white)](#pwa--native-capabilities)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

An enterprise-grade, AI-powered smart kitchen, meal planner, automated receipt scanner, and social culinary ecosystem designed for seamless international kitchen management.

---

## 📖 Table of Contents
- [✨ Key Features](#-key-features)
- [🏗 Architecture & Technology Stack](#-architecture--technology-stack)
- [📱 PWA & Native Capabilities](#-pwa--native-capabilities)
- [⚡ Quick Start & Installation](#-quick-start--installation)
- [⚙️ Environment Variables](#️-environment-variables)
- [🛠 Backend BFF & Database Schema](#-backend-bff--database-schema)
- [🚢 Production Deployment](#-production-deployment)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)

---

## ✨ Key Features

### 🧊 1. Smart Fridge & Inventory Management (CRUD)
- **Real-time Inventory Tracking**: Monitor ingredients, quantities, unit metrics, and expiration dates.
- **Expiry Alerts & Push Notifications**: Web Push notifications notify users of ingredients nearing expiration within 3 days.
- **Visual Asset Management**: Automatic fallback to curated imagery or dynamic emojis when photos are absent.

### 🤖 2. Gemini 3 Flash AI Culinary Assistant
- **Friendly Chef AI Chatbot**: Interactive real-time culinary advice tailored to available fridge ingredients.
- **Zero-Waste Recipe Generator**: Dynamically suggests dishes based strictly on existing stock to minimize food waste.

### 🧾 3. Instant OCR Receipt Scanner
- **AI-Powered OCR**: Automatically extracts item names, quantities, and dates from grocery store receipts and syncs them directly to inventory.

### 📅 4. AI Meal Planner & Cooking Mode
- **Weekly Meal Schedules**: AI-driven weekly meal plans optimized for nutritional balance and available stock.
- **Interactive Step-by-Step Cooking Mode**: Guided timer-assisted cooking instructions with audio & visual prompts.

### 🛒 5. Smart Grocery Store & Cart
- **Automated Shopping List**: One-tap addition of missing recipe ingredients into an organized shopping cart.
- **Seamless QPay / Credit Card Integration**: Fast checkout workflow for store delivery.

### 👥 6. Social Culinary Community & Direct Messaging
- **Instagram-Style Stories Strip**: Upload custom culinary stories with images and text overlays.
- **Interactive Community Feed**: Share recipes, photos, tips, likes (❤️), and comments.
- **Direct Messaging (DM)**: Real-time chat drawer to talk with other home chefs and share custom recipes.

---

## 🏗 Architecture & Technology Stack

```
zity-chef/
├── public/                # Static assets, Web App Manifest & Service Worker
├── server/                # Express & Supabase Backend For Frontend (BFF)
│   ├── routes/            # Inventory & Order API endpoints
│   ├── middleware/        # Authentication & security handlers
│   └── db/                # SQL Schemas & migration scripts
├── src/
│   ├── components/        # Modern UI components (Fridge, Cooking, Social, AI)
│   ├── context/           # React Global AppContext & State Providers
│   ├── hooks/             # Custom React Hooks (useInventory, useOrders)
│   ├── lib/               # Utilities, i18n, Push Notifications, Query Client
│   └── services/          # Google Gemini 3 AI API service integration
├── index.html             # HTML5 Entry point with PWA meta headers
└── vite.config.ts         # Vite bundler & Rollup code-splitting setup
```

- **Frontend Core**: React 18 + TypeScript + Vite 6
- **Styling & UI**: Custom Vanilla CSS Tokens + Tailwind CSS + Lucide Icons + Motion (Framer Motion)
- **State Management & Caching**: TanStack Query (React Query) + React Context API
- **AI Engine**: Google Gemini API (`gemini-2.5-flash` / `gemini-3.0-flash`)
- **Backend & Database**: Node.js Express BFF + Supabase PostgreSQL

---

## 📱 PWA & Native Capabilities

Zity Chef is built to deliver a native app experience on iOS, Android, and Desktop:
- **Standalone App Display**: Launches cleanly without browser chrome.
- **Service Worker (`sw.js`)**: Offline asset caching and background push sync.
- **Web Push Notifications**: Browser-native push reminders for expiring ingredients.

---

## ⚡ Quick Start & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **yarn** / **pnpm**

### 1. Clone the Repository
```bash
git clone https://github.com/unenbat623/zity-chef.git
cd zity-chef
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

### 4. Run Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## ⚙️ Environment Variables

Copy `.env.example` → `.env` and fill it in. See that file for the full,
commented list. The essentials:

```env
# AI (server-side only — never exposed to the browser)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase — Auth + per-user database (server)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key           # used for RLS-scoped clients
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key     # server only
SUPABASE_JWT_SECRET=your_jwt_secret                 # fast local token verify

# Supabase — same project, exposed to the browser (anon key is safe with RLS)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3002
```

## 🔐 Authentication & Per-User Data (Setup)

Auth is real (Supabase Auth) and each user's fridge/orders are isolated by
**Row Level Security**. To enable it:

1. Create a project at [supabase.com](https://supabase.com).
2. Set `DIRECT_URL` in `.env` and run `npm run db:push` — this applies
   [`supabase/migrations/`](supabase/migrations/): tables, RLS policies, the
   profile-on-signup trigger, the `uploads` storage bucket, and the recipe and
   store catalog.
3. **Authentication → Providers**: enable **Anonymous sign-ins** (every device
   gets its own isolated data instantly), **Email**, and **Google** (optional).
   For phone OTP, configure an SMS provider (e.g. Twilio) under Phone.
4. Copy the keys from **Project Settings → API** into `.env` (see above).
5. Restart `npm run dev`.

**Optional — shared cache/rate-limit at scale:** create an
[Upstash Redis](https://upstash.com) database and set `UPSTASH_REDIS_REST_URL` +
`UPSTASH_REDIS_REST_TOKEN`. Without them the server uses an in-memory cache
(fine for a single instance).

> Without Supabase configured the app runs in a **local development mode**: no
> accounts, data kept in the server's in-memory store (per session, lost on
> restart) and no recipe or store catalog — those are served from the database
> only. `NODE_ENV=production` refuses to start without Supabase credentials.

---

## 🛠 Backend BFF & Database Schema

To launch the Express backend BFF server:

```bash
# Start backend server
npm run server
```

The schema lives in `supabase/migrations/` (applied with `npm run db:push`) and
includes, among others:
- `profiles`: user profiles and authentication metadata.
- `inventory_items`: ingredient names, quantities, units, categories, expiry.
- `orders`: grocery store transactions and cart items.
- `recipes` / `store_products`: the catalog the app serves.
- `community_posts`, `stories`, `direct_messages`, `user_follows`: the social side.

### Odoo Bridge

Chef backend exposes the Odoo bridge under `/api/odoo/*`. Odoo credentials stay
server-side only (`ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`).

Supported production checks:

```bash
npm run db:push
SMOKE_API_URL=https://YOUR_DOMAIN SMOKE_ACCESS_TOKEN=... SMOKE_ORDER_ID=ZITY-123456 npm run odoo:smoke
```

`SMOKE_ORDER_ID` is optional. When set, the smoke test verifies idempotent
sale.order sync, invoice creation, status sync, reconciliation, and sync logs.

---

## 🚢 Production Deployment

### Build Bundle
To generate a production-ready optimized build:

```bash
npm run build
```

The compiled output will be generated in the `dist/` directory.

### Docker Deployment
Build and run using Docker:

```bash
docker build -t zity-chef .
docker run -p 3000:3000 zity-chef
```

---

## 🇲🇳 Монгол Хэлээрх Товч Танилцуулга

**Zity Chef** нь хиймэл оюун ухаанд суурилсан ухаалаг хөргөгчийн бүртгэл, хоолны жор санал болгох, хүнс муудахаас сэрэмжлүүлэх push мэдэгдэл, баримтын OCR сканнер болон тогооч нарын нийгмийн сүлжээ (Story, Пост, Шууд чат)-г нэгтгэсэн цогц систем юм.

### Гол онцлогууд:
- **Ухаалаг хөргөгч**: Орцын үлдэгдэл, хадгалах хугацааг хянах.
- **AI Zity Тогооч**: Gemini загвар дээр суурилж амттай жор санал болгох.
- **OCR Сканнер**: Нэхэмжлэх/баримтын зургийг уншиж хөргөгчид автоматаар бүртгэх.
- **Хамтын Орчин**: Story нийтлэх, жор хуваалцах, бусадтай шууд чатлах.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to open a Pull Request or issue.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  <sub>Built with ❤️ for culinary enthusiasts worldwide.</sub>
</div>
