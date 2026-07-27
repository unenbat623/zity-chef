import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/Toast';
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
import { ProfileView } from './components/ProfileView';
import { FloatingAssistant } from './components/FloatingAssistant';
import { PaymentModal } from './components/PaymentModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { HelpView } from './components/HelpView';
import { NotFoundView } from './components/NotFoundView';

const AppContent: React.FC = () => {
  const { activeTab, activeCookingRecipe } = useApp();

  // Tabs that are known/valid
  const validTabs = ['fridge', 'calendar', 'cooking', 'store', 'recipe', 'community', 'profile', 'help'];
  const is404 = !validTabs.includes(activeTab);

  return (
    <div className="h-screen w-screen overflow-hidden bg-pestle-bg text-pestle-text flex flex-row transition-colors duration-500">
      {/* Desktop Left Sidebar — hidden on mobile, shown md+ */}
      <SidebarNav />

      {/* Center content — full width on mobile, max-w-4xl on desktop */}
      <div className="flex-1 min-w-0 h-full flex flex-col bg-pestle-bg border-x border-pestle-border/20 overflow-hidden">
        {/* Sticky Header */}
        <HeaderNav />

        {/* Main scrollable content area */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              {activeTab === 'fridge' && <FridgeView />}
              {activeTab === 'calendar' && <CalendarView />}
              {activeTab === 'cooking' && <CookingModeView recipe={activeCookingRecipe} />}
              {activeTab === 'store' && <StoreView />}
              {activeTab === 'recipe' && <RecipeView />}
              {activeTab === 'community' && <CommunityView />}
              {activeTab === 'profile' && <ProfileView />}
              {activeTab === 'help' && <HelpView />}
              {is404 && <NotFoundView />}
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
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AppProvider>
  );
}
