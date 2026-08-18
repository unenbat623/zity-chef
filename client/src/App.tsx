import React, { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { HeaderNav } from './components/HeaderNav';
import { BottomNav } from './components/BottomNav';
import { SidebarNav } from './components/SidebarNav';
import { FridgeView } from './components/FridgeView';
import { useRealtimeSync } from './hooks/useRealtimeSync';

// ── Global overlays ───────────────────────────────────────────────────────────
// Mounted on every screen but shown rarely, so they load on demand rather than
// riding along in the entry chunk. Each already renders null while closed, so
// there is nothing to show behind a Suspense fallback.
const PaymentModal = lazy(() =>
  import('./components/PaymentModal').then((m) => ({ default: m.PaymentModal }))
);
const SubscriptionModal = lazy(() =>
  import('./components/SubscriptionModal').then((m) => ({ default: m.SubscriptionModal }))
);
const ReceiptScannerModal = lazy(() =>
  import('./components/ReceiptScannerModal').then((m) => ({ default: m.ReceiptScannerModal }))
);
const PasswordRecoveryModal = lazy(() =>
  import('./components/PasswordRecoveryModal').then((m) => ({ default: m.PasswordRecoveryModal }))
);
const OfflineBanner = lazy(() =>
  import('./components/OfflineBanner').then((m) => ({ default: m.OfflineBanner }))
);
const CookieBanner = lazy(() =>
  import('./components/CookieBanner').then((m) => ({ default: m.CookieBanner }))
);

// ── Route-level code splitting ────────────────────────────────────────────────
// FridgeView (the default tab) stays eager for an instant first paint; the rest
// load on demand so the initial bundle no longer ships every heavy view.
const CalendarView = lazy(() =>
  import('./components/CalendarView').then((m) => ({ default: m.CalendarView }))
);
const StoreView = lazy(() =>
  import('./components/StoreView').then((m) => ({ default: m.StoreView }))
);
const CookingModeView = lazy(() =>
  import('./components/CookingModeView').then((m) => ({ default: m.CookingModeView }))
);
const RecipeView = lazy(() =>
  import('./components/RecipeView').then((m) => ({ default: m.RecipeView }))
);
const CommunityView = lazy(() =>
  import('./components/CommunityView').then((m) => ({ default: m.CommunityView }))
);
const ProfileView = lazy(() =>
  import('./components/ProfileView').then((m) => ({ default: m.ProfileView }))
);
const ChefDashboardView = lazy(() =>
  import('./components/ChefDashboardView').then((m) => ({ default: m.ChefDashboardView }))
);
const HelpView = lazy(() =>
  import('./components/HelpView').then((m) => ({ default: m.HelpView }))
);
const NotFoundView = lazy(() =>
  import('./components/NotFoundView').then((m) => ({ default: m.NotFoundView }))
);

// Peripheral AI widgets — lazy so their (heavy) recipe data stays out of the
// initial bundle. Rendered without a visible fallback.
const FloatingAssistant = lazy(() =>
  import('./components/FloatingAssistant').then((m) => ({ default: m.FloatingAssistant }))
);
const DesktopWidgetPanel = lazy(() =>
  import('./components/DesktopWidgetPanel').then((m) => ({ default: m.DesktopWidgetPanel }))
);
const ViewFallback: React.FC = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-8 h-8 rounded-xl bg-mango/80 text-white font-black flex items-center justify-center animate-pulse">
      Z
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { activeTab, activeCookingRecipe } = useApp();
  useRealtimeSync();

  // Tabs that are known/valid
  const validTabs = ['fridge', 'calendar', 'cooking', 'store', 'recipe', 'community', 'dashboard', 'profile', 'help'];
  const is404 = !validTabs.includes(activeTab);

  return (
    // `100dvh`, not `h-screen`: on mobile Safari/Chrome `100vh` is the height
    // with the URL bar collapsed, so the bottom nav sat below the fold until you
    // scrolled. `w-full` rather than `w-screen` — `100vw` ignores the desktop
    // scrollbar and produced a horizontal scroll on every page.
    <div className="h-[100dvh] w-full overflow-hidden bg-pestle-bg text-pestle-text flex flex-row transition-colors duration-500">
      {/* Desktop Left Sidebar — hidden on mobile, shown md+ */}
      <SidebarNav />

      {/* Center content — full width on mobile, max-w-4xl on desktop */}
      <div className="flex-1 min-w-0 h-full flex flex-col bg-pestle-bg border-x border-pestle-border/20 overflow-hidden">
        {/* Sticky Header */}
        <HeaderNav />

        {/* Main scrollable content area. The inner wrapper caps line length on
            wide monitors — without it the views stretched edge to edge and a
            four-column grid spread across ~2000px of empty space. */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-6">
          <div className="w-full max-w-5xl mx-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              <Suspense fallback={<ViewFallback />}>
                {activeTab === 'fridge' && <FridgeView />}
                {activeTab === 'calendar' && <CalendarView />}
                {activeTab === 'cooking' && <CookingModeView recipe={activeCookingRecipe} />}
                {activeTab === 'store' && <StoreView />}
                {activeTab === 'recipe' && <RecipeView />}
                {activeTab === 'community' && <CommunityView />}
                {activeTab === 'dashboard' && <ChefDashboardView />}
                {activeTab === 'profile' && <ProfileView />}
                {activeTab === 'help' && <HelpView />}
                {is404 && <NotFoundView />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
          </div>
        </main>

        {/* Below xl there is no room for the side panel, so the assistant lives
            in a floating bubble instead. Exactly one of the two is ever shown. */}
        <div className="xl:hidden">
          <Suspense fallback={null}>
            <FloatingAssistant />
          </Suspense>
        </div>

        {/* Mobile bottom nav */}
        <BottomNav />
      </div>

      {/* Right-hand assistant & nutrition panel — xl and up */}
      <Suspense fallback={null}>
        <DesktopWidgetPanel />
      </Suspense>

      {/* Global modals */}
      <Suspense fallback={null}>
        <PaymentModal />
        <SubscriptionModal />
        <ReceiptScannerModal />
        <PasswordRecoveryModal />
        <OfflineBanner />
        <CookieBanner />
      </Suspense>
    </div>
  );
};

/**
 * Blocks rendering the app until the initial auth session is resolved, so the
 * very first data fetch already carries a token (avoids a guest→user refetch
 * race). Shows a brief branded splash.
 */
const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-pestle-bg text-pestle-text gap-3">
        <div className="w-12 h-12 rounded-2xl bg-mango text-white font-black flex items-center justify-center text-xl shadow-lg animate-pulse">
          Z
        </div>
        <p className="text-xs font-semibold text-gray-400">Ачаалж байна…</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <AppProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AppProvider>
      </AuthGate>
    </AuthProvider>
  );
}
