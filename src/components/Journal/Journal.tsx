import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtC } from '../../lib/utils';

interface JournalProps {
  onSelectTrade: (id: string) => void;
  onEditTrade: (id: string) => void;
}

export const Journal: React.FC<JournalProps> = ({ onSelectTrade, onEditTrade }) => {
  const { trades, currentAccId, accounts, deleteTrade, bulkDeleteTrades, showToast } = useApp();

  const [search, setSearch] = useState('');
  const [filterResult, setFilterResult] = useState('');
  const [filterDirection, setFilterDirection] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeAccount = accounts.find(a => a.id === currentAccId) || { name: 'Account' };
  const accountTrades = trades.filter((t) => (t.accountId || 'acc-live') === currentAccId);

  // Filter trades
  const filteredTrades = accountTrades.filter((t) => {
    if (search && !t.instrument.toLowerCase().includes(search.toLowerCase()) && !(t.setup || '').toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterResult && t.result !== filterResult) return false;
    if (filterDirection && t.direction !== filterDirection) return false;
    if (filterMonth && (!t.date || !t.date.startsWith(filterMonth))) return false;
    return true;
  });

  // Extract unique months for filter dropdown
  const uniqueMonths = Array.from(
    new Set(
      accountTrades
        .map((t) => t.date ? t.date.slice(0, 7) : '')
        .filter(Boolean)
    )
  ).sort().reverse();

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredTrades.map(t => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected trades?`)) return;

    await bulkDeleteTrades(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleDeleteOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this trade?')) return;
    await deleteTrade(id);
  };

  const handleEditOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onEditTrade(id);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredTrades.length === 0) {
      showToast('No trades to export', 'error');
      return;
    }

    const headers = [
      'Date', 'Instrument', 'Direction', 'Session', 'Entry', 'Exit', 'SL', 'TP', 'Lots',
      'P&L', 'Risk', 'R:R', 'Setup', 'Result', 'Grade', 'Emotion Before', 'Emotion After', 'Mistakes', 'Pre Notes', 'Post Notes'
    ];

    const rows = filteredTrades.map((t) => [
      t.date ? new Date(t.date).toLocaleString('en-IN') : '',
      t.instrument,
      t.direction,
      t.session,
      t.entry,
      t.exit,
      t.sl,
      t.tp,
      t.lots,
      t.pl,
      t.risk,
      t.rr,
      t.setup,
      t.result,
      t.grade,
      t.emotionBefore,
      t.emotionAfter,
      t.mistakes,
      t.preNotes,
      t.postNotes
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TradeVault_${activeAccount.name.replace(/ /g, '_')}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Exported successfully!');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card mb-0">
        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="search-box">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              className="form-control"
              placeholder="Search instrument or setup..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

            <select
              className="form-control w-[130px]"
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
          >
            <option value="">All Results</option>
            <option value="Win">Wins</option>
            <option value="Loss">Losses</option>
            <option value="Break Even">Break Even</option>
          </select>

            <select
              className="form-control w-[120px]"
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
          >
            <option value="">All Directions</option>
            <option value="Long">Long</option>
            <option value="Short">Short</option>
          </select>

            <select
              className="form-control w-[140px]"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            <option value="">All Months</option>
            {uniqueMonths.map((m) => {
              const [y, mon] = m.split('-');
              const label = new Date(parseInt(y), parseInt(mon) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
              return (
                <option key={m} value={m}>
                  {label}
                </option>
              );
            })}
          </select>

          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            <i className="fa-solid fa-file-csv"></i> Export CSV
          </button>
        </div>

        {/* Bulk Action Bar */}
        <div className={`bulk-bar ${selectedIds.size > 0 ? 'show' : ''}`}>
          <span className="bulk-count">{selectedIds.size} trades selected</span>
          <button className="btn btn-danger btn-xs" onClick={handleBulkDelete}>
            <i className="fa-solid fa-trash"></i> Delete Selected
          </button>
        </div>

        {/* Trades Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="cb-col">
                  <input
                    type="checkbox"
                    checked={filteredTrades.length > 0 && selectedIds.size === filteredTrades.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="w-[30px]"><i className="fa-solid fa-camera text-[11px]"></i></th>
                <th>Date</th>
                <th>Instrument</th>
                <th className="hidden sm:table-cell">Direction</th>
                <th className="hidden md:table-cell">Setup</th>
                <th className="hidden lg:table-cell">Entry</th>
                <th className="hidden lg:table-cell">Exit</th>
                <th>P&L</th>
                <th className="hidden sm:table-cell">R:R</th>
                <th className="hidden sm:table-cell">Result</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length > 0 ? (
                filteredTrades.map((t) => (
                  <tr key={t.id} onClick={() => onSelectTrade(t.id)} className="cursor-pointer">
                    <td className="cb-col" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={(e) => handleSelectOne(t.id, e.target.checked)}
                      />
                    </td>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      {t.screenshots && t.screenshots.length > 0 ? (
                        <i className="fa-solid fa-camera text-text-muted hover:text-accent cursor-pointer text-[12px]" title={`${t.screenshots.length} screenshot${t.screenshots.length > 1 ? 's' : ''}`}></i>
                      ) : (
                        <i className="fa-solid fa-camera text-border opacity-30 text-[12px]"></i>
                      )}
                    </td>
                    <td className="mono text-[11.5px]">
                      {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td><strong>{t.instrument}</strong></td>
                    <td className="hidden sm:table-cell">
                      <span className={`badge ${t.direction === 'Long' ? 'badge-green' : 'badge-red'}`}>
                        {t.direction === 'Long' ? '▲' : '▼'} {t.direction}
                      </span>
                    </td>
                    <td className="hidden md:table-cell text-[12px]">{t.setup || '—'}</td>
                    <td className="hidden lg:table-cell mono">{t.entry || '—'}</td>
                    <td className="hidden lg:table-cell mono">{t.exit || '—'}</td>
                    <td
                      className={`mono fw-700 ${t.pl >= 0 ? 'text-green' : 'text-red'}`}
                    >
                      {fmtC(t.pl)}
                    </td>
                    <td className="hidden sm:table-cell mono">{t.rr || '—'}</td>
                    <td className="hidden sm:table-cell">
                      <span className={`badge ${t.result === 'Win' ? 'badge-green' : t.result === 'Loss' ? 'badge-red' : 'badge-yellow'}`}>
                        {t.result}
                      </span>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex gap-1">
                        <button className="btn btn-secondary btn-xs" onClick={(e) => handleEditOne(e, t.id)}>
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="btn btn-danger btn-xs" onClick={(e) => handleDeleteOne(e, t.id)}>
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="text-center py-[30px] text-text-muted">
                    No trades match your search filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default Journal;
