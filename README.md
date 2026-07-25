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

Ensure the following environment variables are set in your `.env` file:

```env
# Google Gemini AI Key
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Backend BFF API URL
VITE_API_URL=http://localhost:3000

# Supabase Credentials (Optional for Backend persistence)
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 🛠 Backend BFF & Database Schema

To launch the Express backend BFF server:

```bash
# Start backend server
npm run server
```

The database schema is located in `server/db/schema.sql` and includes tables for:
- `users`: User profiles and authentication metadata.
- `inventory`: Ingredient names, quantities, units, categories, and expiration dates.
- `orders`: Grocery store transactions and cart items.

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

**Zity Chef** нь хиймэл оюун ухаанд суурилсан ухаалаг хөргөгчийн бүртгэл, хоолны жор санал болгох, хөөрөнгө муудах сэмэглэл мэдээлэх push notification, баримт OCR сканнер болон тогооч нарын нийгмийн сүлжээ (Stories, Пост, Шууд Чат)-ийн бүрэн цогц систем юм.

### Гол онцлогууд:
- **Ухаалаг хөргөгч**: Орцын үлдэгдэл, хугацааг хянах.
- **AI Эчнээ Тогооч**: Gemini 3 Flash загвараар амттай жорууд санал болгох.
- **OCR Сканнер**: Нэхэмжлэх/баримтын зургийг уншиж автомат хөргөгчинд бүртгэх.
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
