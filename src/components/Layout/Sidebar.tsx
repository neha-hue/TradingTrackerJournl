import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AUTO_LOGIN_ENABLED } from '../../lib/config';
import { Account } from '../../lib/types';
import Modal from '../shared/Modal';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const {
    page,
    setPage,
    accounts,
    currentAccId,
    setCurrentAccId,
    theme,
    toggleTheme,
    addAccount,
    renameAccount,
    deleteAccount,
    signOut
  } = useApp();

  const [isAccModalOpen, setIsAccModalOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<Account['type']>('Live');
  const [newAccColor, setNewAccColor] = useState('#10d982');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-gauge' },
    { id: 'analytics', label: 'Analytics', icon: 'fa-chart-simple' },
    { id: 'calendar', label: 'Monthly Calendar', icon: 'fa-calendar-days' },
    { id: 'journal', label: 'Trade Log', icon: 'fa-list' },
    { id: 'add-trade', label: 'Add New Trade', icon: 'fa-plus' },
    { id: 'import', label: 'Bulk Import', icon: 'fa-file-import' },
  ];

  const resultsItems = [
    { id: 'weekly', label: 'Weekly Results', icon: 'fa-calendar-minus' },
    { id: 'monthly', label: 'Monthly Results', icon: 'fa-calendar-plus' },
    { id: 'quarterly', label: 'Quarterly Results', icon: 'fa-calendar' },
  ];

  const helperItems = [
    { id: 'calculators', label: 'Calculators', icon: 'fa-calculator' },
  ];

  const handleNavClick = (pageId: string) => {
    setPage(pageId);
    closeSidebar();
  };

  const closeSidebar = () => {
    setIsOpen(false);
  };

  const accTypeClass = (type: Account['type']) => {
    if (type === 'Live') return 'acc-tag-live';
    if (type === 'Prop') return 'acc-tag-prop';
    if (type === 'Demo') return 'acc-tag-demo';
    return 'acc-tag-other';
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    await addAccount(newAccName, newAccType, newAccColor);
    setNewAccName('');
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[199] md:hidden"
          onClick={closeSidebar}
        />
      )}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-brand">
            <div className="logo-icon">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <div className="logo-text font-bold">
              TradeVault <span>Pro</span>
            </div>
          </div>
        </div>

        <div className="account-switcher">
          <div className="account-switcher-label">
            <span>Trading Accounts</span>
            <span className="acc-manage-btn" onClick={() => setIsAccModalOpen(true)}>Manage</span>
          </div>
          <div className="account-list">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className={`account-item ${acc.id === currentAccId ? 'active' : ''}`}
                onClick={() => { setCurrentAccId(acc.id); closeSidebar(); }}
              >
                <span className="account-dot" style={{ backgroundColor: acc.color }}></span>
                <span className="flex-1 truncate">
                  {acc.name}
                </span>
                <span className={`account-tag ${accTypeClass(acc.type)}`}>{acc.type}</span>
              </div>
            ))}
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Navigation</div>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              {item.label}
            </button>
          ))}

          <div className="nav-section-title">Reports</div>
          {resultsItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              {item.label}
            </button>
          ))}

          <div className="nav-section-title">Tools</div>
          {helperItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="theme-toggle mb-2" onClick={() => { toggleTheme(); closeSidebar(); }}>
            <span id="themeLabel">
              {theme === 'dark' ? (
                <span><i className="fa-solid fa-moon mr-[5px]"></i>Dark Mode</span>
              ) : (
                <span><i className="fa-solid fa-sun mr-[5px]"></i>Light Mode</span>
              )}
            </span>
            <div className={`toggle-sw ${theme === 'dark' ? 'on' : ''}`}></div>
          </div>

          {/* Hidden when auto sign-in is on, where signing out would just log straight back in */}
          {!AUTO_LOGIN_ENABLED && (
            <button
              onClick={signOut}
              className="btn btn-danger btn-xs w-full justify-center px-3 py-2"
            >
              <i className="fa-solid fa-right-from-bracket"></i> Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Account Management Modal */}
      <Modal
        id="accountModal"
        title="Manage Accounts"
        isOpen={isAccModalOpen}
        onClose={() => setIsAccModalOpen(false)}
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div id="accModalList" className="max-h-[200px] overflow-y-auto flex flex-col gap-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="acc-manage-item">
                <span className="account-dot w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }}></span>
                <input
                  className="acc-name-input"
                  value={acc.name}
                  onChange={(e) => renameAccount(acc.id, e.target.value)}
                  placeholder="Account name"
                />
                <span className={`account-tag ${accTypeClass(acc.type)}`}>{acc.type}</span>
                {accounts.length > 1 && (
                  <button className="btn btn-danger btn-xs" onClick={() => deleteAccount(acc.id)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="h-px bg-border my-3.5"></div>

          <form onSubmit={handleAddAccount} className="flex flex-col gap-3">
            <div className="form-label text-[11px]">Add New Account</div>
            <div className="form-grid-3">
              <div className="form-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Account Name"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <select
                  className="form-control"
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value as Account['type'])}
                >
                  <option value="Live">Live</option>
                  <option value="Prop">Prop</option>
                  <option value="Demo">Demo</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group flex-row items-center gap-2">
                <input
                  type="color"
                  className="form-control w-10 p-0.5 cursor-pointer h-9"
                  value={newAccColor}
                  onChange={(e) => setNewAccColor(e.target.value)}
                />
                <button type="submit" className="btn btn-primary flex-1 h-9 justify-center">
                  Add
                </button>
              </div>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
};
export default Sidebar;
