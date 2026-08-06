import React from 'react';
import { Trade } from '../../lib/types';
import { getStats, fmtC } from '../../lib/utils';

interface StatsGridProps {
  trades: Trade[];
}

export const StatsGrid: React.FC<StatsGridProps> = ({ trades }) => {
  const stats = getStats(trades);

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">Net Profit/Loss</div>
        <div className={`stat-value ${stats.totalPL >= 0 ? 'green' : 'red'}`}>
          {fmtC(stats.totalPL)}
        </div>
        <div className="stat-sub">Across all trades</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Win Rate</div>
        <div className="stat-value blue">
          {stats.winRate.toFixed(1)}%
        </div>
        <div className="stat-sub">
          {stats.wins}W / {stats.losses}L / {stats.be}BE
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Profit Factor</div>
        <div className="stat-value purple">
          {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
        </div>
        <div className="stat-sub">Gross Win / Gross Loss</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Expectancy</div>
        <div className="stat-value yellow">
          {stats.expectancy >= 0 ? '+' : ''}{stats.expectancy.toFixed(2)}
        </div>
        <div className="stat-sub">Expected P&L per trade</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Max Drawdown</div>
        <div className="stat-value red text-red">
          {fmtC(stats.maxDD)}
        </div>
        <div className="stat-sub">Peak-to-trough drop</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Total Trades</div>
        <div className="stat-value text-secondary text-text-secondary">
          {stats.total}
        </div>
        <div className="stat-sub">Executed entries</div>
      </div>
    </div>
  );
};
export default StatsGrid;
