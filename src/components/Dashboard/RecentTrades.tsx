import React from 'react';
import { Trade } from '../../lib/types';
import { fmtC } from '../../lib/utils';

interface RecentTradesProps {
  trades: Trade[];
  onSelectTrade: (id: string) => void;
}

export const RecentTrades: React.FC<RecentTradesProps> = ({ trades, onSelectTrade }) => {
  const recent = trades.slice(0, 6);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <i className="fa-solid fa-clock-rotate-left"></i> Recent Trades
        </h3>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Instrument</th>
              <th>Direction</th>
              <th>Setup</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>P&L</th>
              <th>R:R</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody id="recentTrades">
            {recent.length > 0 ? (
              recent.map((t) => (
                <tr key={t.id} onClick={() => onSelectTrade(t.id)} className="cursor-pointer">
                  <td className="mono text-[11.5px]">
                    {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </td>
                  <td><strong>{t.instrument}</strong></td>
                  <td>
                    <span className={`badge ${t.direction === 'Long' ? 'badge-green' : 'badge-red'}`}>
                      {t.direction === 'Long' ? '▲' : '▼'} {t.direction}
                    </span>
                  </td>
                  <td className="text-[12px]">{t.setup || '—'}</td>
                  <td className="mono">{t.entry || '—'}</td>
                  <td className="mono">{t.exit || '—'}</td>
                  <td className={`mono fw-700 ${t.pl >= 0 ? 'text-green' : 'text-red'}`}>
                    {fmtC(t.pl)}
                  </td>
                  <td className="mono">{t.rr || '—'}</td>
                  <td>
                    <span className={`badge ${t.result === 'Win' ? 'badge-green' : t.result === 'Loss' ? 'badge-red' : 'badge-yellow'}`}>
                      {t.result}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="text-center p-[30px] text-text-muted">
                  No trades yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default RecentTrades;
