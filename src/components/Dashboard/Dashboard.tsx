import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Trade } from '../../lib/types';
import { fmtC } from '../../lib/utils';
import { computeKpis } from '../../lib/score';
import { latestTradedMonth, monthLabel, tradesInMonth } from '../../lib/monthly';
import Modal from '../shared/Modal';
import KpiStrip from './KpiStrip';
import DashCalendar from './DashCalendar';
import ScoreCard from './ScoreCard';
import { HalfGauge } from './Gauges';
import DailyBreakdown from './DailyBreakdown';
import EquityChart from './EquityChart';
import TopInstruments from './TopInstruments';
import SessionChart from './SessionChart';
import RecentTrades from './RecentTrades';

interface DashboardProps {
  onSelectTrade: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectTrade }) => {
  const { trades, currentAccId, theme } = useApp();

  const activeTrades = useMemo(
    () => trades.filter((t) => (t.accountId || 'acc-live') === currentAccId),
    [trades, currentAccId]
  );

  // Opens on the last month that was traded rather than on a current month that may well
  // be empty; the Today button goes to the real current month.
  const [month, setMonth] = useState<string | null>(null);
  const shownMonth = month ?? latestTradedMonth(activeTrades);

  const monthTrades = useMemo(
    () => tradesInMonth(activeTrades, shownMonth),
    [activeTrades, shownMonth]
  );

  const kpis = useMemo(() => computeKpis(monthTrades), [monthTrades]);
  const [openDay, setOpenDay] = useState<{ day: string; trades: Trade[] } | null>(null);

  const dayPL = openDay ? openDay.trades.reduce((s, t) => s + (t.pl || 0), 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      <KpiStrip kpis={kpis} theme={theme} />

      {/* Calendar on the left, the read-outs that judge it down the right. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] gap-4 items-start">
        <DashCalendar
          trades={monthTrades}
          month={shownMonth}
          onChangeMonth={setMonth}
          onOpenDay={(day, dayTrades) => setOpenDay({ day, trades: dayTrades })}
        />

        <div className="flex flex-col gap-4">
          <div className="card mb-0">
            <div className="card-header">
              <h3 className="card-title"><i className="fa-solid fa-trophy"></i> Trade Win %</h3>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="stat-value blue">{kpis.winRate.toFixed(2)}%</div>
                <div className="stat-sub">
                  <span className="text-green">{kpis.wins}W</span> ·{' '}
                  <span className="text-yellow">{kpis.breakEven}BE</span> ·{' '}
                  <span className="text-red">{kpis.losses}L</span>
                </div>
              </div>
              <HalfGauge percent={kpis.winRate} theme={theme} />
            </div>
          </div>

          <div className="card mb-0">
            <div className="card-header">
              <h3 className="card-title"><i className="fa-solid fa-calendar-check"></i> Day Win %</h3>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="stat-value blue">{kpis.dayWinRate.toFixed(2)}%</div>
                <div className="stat-sub">
                  <span className="text-green">{kpis.winningDays}</span> green ·{' '}
                  <span className="text-yellow">{kpis.flatDays}</span> flat ·{' '}
                  <span className="text-red">{kpis.losingDays}</span> red
                </div>
              </div>
              <HalfGauge percent={kpis.dayWinRate} theme={theme} />
            </div>
          </div>

          <ScoreCard kpis={kpis} theme={theme} />
        </div>
      </div>

      <DailyBreakdown
        trades={monthTrades}
        allTrades={activeTrades}
        month={shownMonth}
        onSelectMonth={setMonth}
        theme={theme}
        onSelectTrade={onSelectTrade}
      />

      <div className="grid-2">
        <EquityChart trades={monthTrades} theme={theme} />
        <SessionChart trades={monthTrades} theme={theme} />
      </div>

      <TopInstruments trades={monthTrades} />

      <RecentTrades trades={monthTrades} onSelectTrade={onSelectTrade} />

      {openDay && (
        <Modal
          id="dashDayModal"
          isOpen={!!openDay}
          onClose={() => setOpenDay(null)}
          title={`Trades on ${openDay.day} — ${fmtC(dayPL)}`}
          size="sm"
        >
          <div className="flex flex-col gap-2">
            {openDay.trades.map(t => (
              <div
                key={t.id}
                className="bg-surface-input border border-border rounded-[10px] p-3 cursor-pointer"
                onClick={() => { setOpenDay(null); onSelectTrade(t.id); }}
              >
                <div className="flex-center between">
                  <div>
                    <strong>{t.instrument}</strong>{' '}
                    <span className={`badge ${t.direction === 'Long' ? 'badge-green' : 'badge-red'}`}>
                      {t.direction}
                    </span>
                  </div>
                  <div className={`mono fw-700 ${t.pl >= 0 ? 'text-green' : 'text-red'}`}>
                    {fmtC(t.pl)}
                  </div>
                </div>
                <div className="text-muted text-[11.5px] mt-1">
                  {t.setup || '—'} · RR: {t.rr || 'N/A'} ·{' '}
                  <span className={`badge ${t.result === 'Win' ? 'badge-green' : t.result === 'Loss' ? 'badge-red' : 'badge-yellow'}`}>
                    {t.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      <p className="text-[11px] text-muted text-center">
        Showing {monthLabel(shownMonth)} on this account.
      </p>
    </div>
  );
};
export default Dashboard;
