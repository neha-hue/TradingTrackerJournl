import React from 'react';
import { useApp } from '../../context/AppContext';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const { page, accounts, currentAccId, setPage, trades, seedDemoData } = useApp();

  const acc = accounts.find((a) => a.id === currentAccId);

  const getPageTitle = (pageId: string) => {
    switch (pageId) {
      case 'dashboard':
        return 'Dashboard';
      case 'analytics':
        return 'Analytics';
      case 'calendar':
        return 'Monthly Calendar';
      case 'journal':
        return 'Trade Log';
      case 'add-trade':
        return 'Add New Trade';
      case 'weekly':
        return 'Weekly Results';
      case 'monthly':
        return 'Monthly Results';
      case 'quarterly':
        return 'Quarterly Results';
      case 'calculators':
        return 'Calculators';
      default:
        return 'TradeVault Pro';
    }
  };

  const hasTrades = trades.length > 0;

  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        <button
          className="btn btn-secondary btn-sm md:!hidden px-[10px] py-1.5"
          onClick={onToggleSidebar}
          id="mobile-menu-btn"
        >
          <i className="fa-solid fa-bars"></i>
        </button>
        <h2 className="topbar-title" id="topbarTitle">
          {getPageTitle(page)}
        </h2>
      </div>

      <div className="topbar-actions">
        {acc && (
          <div className="topbar-account-badge" id="topbarAccount">
            <span className="account-dot" style={{ backgroundColor: acc.color }}></span>
            {acc.name}
          </div>
        )}

        {!hasTrades && (
          <button className="btn btn-secondary btn-sm" onClick={seedDemoData}>
            <i className="fa-solid fa-seedling"></i> Seed Demo
          </button>
        )}

        {page !== 'add-trade' && (
          <button className="btn btn-primary btn-sm" onClick={() => setPage('add-trade')}>
            <i className="fa-solid fa-plus"></i> New Trade
          </button>
        )}
      </div>
    </header>
  );
};
export default Topbar;
