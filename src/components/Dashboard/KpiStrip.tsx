import React from 'react';
import { Kpis } from '../../lib/score';
import { fmtC } from '../../lib/utils';
import { SplitRing } from './Gauges';

const num = (v: number, digits = 2) => (isFinite(v) ? v.toFixed(digits) : '∞');

/** The strip of headline figures across the top of the dashboard. */
export const KpiStrip: React.FC<{ kpis: Kpis; theme: 'dark' | 'light' }> = ({ kpis, theme }) => {
  const streakTone = (n: number) => (n > 0 ? 'text-green' : n < 0 ? 'text-red' : 'text-muted');

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">
          Net P&amp;L <span className="badge ml-1">{kpis.totalTrades}</span>
        </div>
        <div className={`stat-value ${kpis.netPL >= 0 ? 'green' : 'red'}`}>{fmtC(kpis.netPL)}</div>
        <div className="stat-sub">
          {kpis.tradingDays} trading day{kpis.tradingDays === 1 ? '' : 's'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Profit Factor</div>
        <div className="flex items-center justify-between gap-2">
          <div className="stat-value purple">{num(kpis.profitFactor)}</div>
          <SplitRing win={kpis.grossWin} loss={kpis.grossLoss} theme={theme} />
        </div>
        <div className="stat-sub">
          <span className="text-green">{fmtC(kpis.grossWin)}</span> won ·{' '}
          <span className="text-red">-${kpis.grossLoss.toFixed(2)}</span> lost
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Avg Win / Avg Loss</div>
        <div className="stat-value blue">{num(kpis.avgWinLossRatio)}</div>
        {/* The two bars are drawn against the larger of the pair, so the shorter one shows
            at a glance which side is bigger. */}
        <div className="flex flex-col gap-1 mt-1.5">
          {([['win', kpis.avgWin, '#10d982'], ['loss', kpis.avgLoss, '#f74f6e']] as const).map(
            ([key, value, colour]) => {
              const scale = Math.max(kpis.avgWin, kpis.avgLoss) || 1;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 rounded-full bg-surface-input overflow-hidden">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(value / scale) * 100}%`, background: colour }}
                    />
                  </span>
                  <span className="mono text-[10.5px] text-muted w-[62px] text-right">
                    ${value.toFixed(2)}
                  </span>
                </div>
              );
            }
          )}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Trade Expectancy</div>
        <div className={`stat-value ${kpis.expectancy >= 0 ? 'green' : 'red'}`}>
          {fmtC(kpis.expectancy)}
        </div>
        <div className="stat-sub">Expected per trade</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Current Streak</div>
        <div className="flex gap-5">
          <div>
            <div className={`stat-value ${streakTone(kpis.dayStreak.current)}`}>
              {Math.abs(kpis.dayStreak.current)}
            </div>
            <div className="stat-sub">
              {kpis.dayStreak.current >= 0 ? 'winning' : 'losing'} day
              {Math.abs(kpis.dayStreak.current) === 1 ? '' : 's'}
            </div>
          </div>
          <div>
            <div className={`stat-value ${streakTone(kpis.tradeStreak.current)}`}>
              {Math.abs(kpis.tradeStreak.current)}
            </div>
            <div className="stat-sub">
              {kpis.tradeStreak.current >= 0 ? 'winning' : 'losing'} trade
              {Math.abs(kpis.tradeStreak.current) === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="stat-sub mt-1">
          Best run {kpis.dayStreak.bestWin}d · worst {kpis.dayStreak.worstLoss}d
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Max Drawdown</div>
        <div className="stat-value red">-${kpis.maxDrawdown.toFixed(2)}</div>
        <div className="stat-sub">Recovery factor {num(kpis.recoveryFactor)}</div>
      </div>
    </div>
  );
};

export default KpiStrip;
