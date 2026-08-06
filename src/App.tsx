import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { SUPABASE_CONFIGURED } from './lib/supabase';
import AuthPage from './components/Auth/AuthPage';
import Sidebar from './components/Layout/Sidebar';
import Topbar from './components/Layout/Topbar';
import Toast from './components/shared/Toast';
import Lightbox from './components/shared/Lightbox';
import TradeDetailModal from './components/shared/TradeDetailModal';

// Pages
import Dashboard from './components/Dashboard/Dashboard';
import Analytics from './components/Analytics/Analytics';
import Calendar from './components/Calendar/Calendar';
import Journal from './components/Journal/Journal';
import TradeForm from './components/TradeForm/TradeForm';
import WeeklyResults from './components/Results/WeeklyResults';
import MonthlyResults from './components/Results/MonthlyResults';
import QuarterlyResults from './components/Results/QuarterlyResults';
import Calculators from './components/Calculators/Calculators';

const MainApp: React.FC = () => {
  const { user, loading, authError, page, setPage, trades, accounts, deleteTrade } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [editTradeId, setEditTradeId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Without these the Supabase client cannot talk to anything, so say so plainly
  // rather than sitting on a spinner or a blank page.
  if (!SUPABASE_CONFIGURED) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-6">
        <div className="text-center max-w-md">
          <i className="fa-solid fa-plug-circle-xmark fa-3x text-danger mb-4"></i>
          <h3 className="mb-2">Database not configured</h3>
          <p className="text-secondary text-[13px]">
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> were missing
            when this site was built. Set them in your hosting provider's environment
            variables (or <code>.env.local</code> when running locally) and rebuild.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin fa-3x text-accent mb-4"></i>
          <h3>Connecting to database...</h3>
        </div>
      </div>
    );
  }

  // Reached only when auto sign-in is off (the deployed build) or it failed.
  // Supabase stores the session in localStorage, so this is asked once per device.
  if (!user) {
    return (
      <>
        <AuthPage authError={authError} />
        <Toast />
      </>
    );
  }

  // Active trade details object
  const activeTradeDetails = selectedTradeId ? trades.find(t => t.id === selectedTradeId) || null : null;

  const renderActivePage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard onSelectTrade={setSelectedTradeId} />;
      case 'analytics':
        return <Analytics />;
      case 'calendar':
        return <Calendar onSelectTrade={setSelectedTradeId} />;
      case 'journal':
        return (
          <Journal
            onSelectTrade={setSelectedTradeId}
            onEditTrade={(id) => {
              setEditTradeId(id);
              setPage('add-trade');
            }}
          />
        );
      case 'add-trade':
        return (
          <TradeForm
            editTradeId={editTradeId}
            onSuccess={() => {
              setEditTradeId(null);
              setPage('journal');
            }}
          />
        );
      case 'weekly':
        return <WeeklyResults />;
      case 'monthly':
        return <MonthlyResults />;
      case 'quarterly':
        return <QuarterlyResults />;
      case 'calculators':
        return <Calculators />;
      default:
        return <Dashboard onSelectTrade={setSelectedTradeId} />;
    }
  };

  const handleEditFromModal = (id: string) => {
    setSelectedTradeId(null);
    setEditTradeId(id);
    setPage('add-trade');
  };

  const handleDeleteFromModal = async (id: string) => {
    setSelectedTradeId(null);
    await deleteTrade(id);
  };

  return (
    <div className="app-wrapper">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="main-content">
        <Topbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className="page active">
          {renderActivePage()}
        </main>
      </div>

      {/* Shared Overlays */}
      <TradeDetailModal
        isOpen={!!selectedTradeId}
        trade={activeTradeDetails}
        accounts={accounts}
        onClose={() => setSelectedTradeId(null)}
        onEdit={handleEditFromModal}
        onDelete={handleDeleteFromModal}
        onOpenLightbox={setLightboxSrc}
      />

      <Lightbox
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />

      <Toast />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
};

export default App;
