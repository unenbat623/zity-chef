import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import { HeaderNav } from './components/HeaderNav';
import { BottomNav } from './components/BottomNav';
import { SidebarNav } from './components/SidebarNav';
import { DesktopWidgetPanel } from './components/DesktopWidgetPanel';
import { FridgeView } from './components/FridgeView';
import { CalendarView } from './components/CalendarView';
import { StoreView } from './components/StoreView';
import { CookingModeView } from './components/CookingModeView';
import { RecipeView } from './components/RecipeView';
import { CommunityView } from './components/CommunityView';
import { FloatingAssistant } from './components/FloatingAssistant';
import { PaymentModal } from './components/PaymentModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';

const AppContent: React.FC = () => {
  const { activeTab, activeCookingRecipe } = useApp();

  return (
    <div className="min-h-screen bg-pestle-bg text-pestle-text flex flex-row w-full transition-colors duration-500 overflow-x-hidden">
      {/* Desktop Left Sidebar — hidden on mobile, shown md+ */}
      <SidebarNav />

      {/* Center content — full width on mobile, max-w-4xl on desktop */}
      <div className="flex-1 min-w-0 min-h-screen flex flex-col bg-pestle-bg border-x border-pestle-border/20">
        {/* Sticky Header */}
        <HeaderNav />

        {/* Main scrollable content area */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'fridge'     && <FridgeView />}
              {activeTab === 'calendar'   && <CalendarView />}
              {activeTab === 'cooking'    && <CookingModeView recipe={activeCookingRecipe} />}
              {activeTab === 'store'      && <StoreView />}
              {activeTab === 'recipe'     && <RecipeView />}
              {activeTab === 'community'  && <CommunityView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile floating AI assistant (hidden on xl — right panel shows instead) */}
        <div className="xl:hidden">
          <FloatingAssistant />
        </div>

        {/* Mobile bottom nav */}
        <BottomNav />
      </div>

      {/* Desktop Right Widget Panel — hidden below xl */}
      <DesktopWidgetPanel />

      {/* Global modals */}
      <PaymentModal />
      <SubscriptionModal />
      <ReceiptScannerModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
