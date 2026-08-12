import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trade } from '../../lib/types';
import { cc, fmtC } from '../../lib/utils';
import { Bar, BreakdownMode, buildBars, monthLabel } from '../../lib/monthly';
import { Chart, registerables } from 'chart.js';
import Modal from '../shared/Modal';

Chart.register(...registerables);

interface DailyBreakdownProps {
  /** Already narrowed to the month being shown - drives the week and day views. */
  trades: Trade[];
  /** Every trade on the account - the month view needs the whole year, not one month. */
  allTrades: Trade[];
  /** 'YYYY-MM' - the month the dashboard is on. */
  month: string;
  /** Clicking a month in the year view switches the dashboard to it. */
  onSelectMonth: (key: string) => void;
  theme: 'dark' | 'light';
  onSelectTrade: (id: string) => void;
}

export const DailyBreakdown: React.FC<DailyBreakdownProps> = ({
  trades,
  allTrades,
  month,
  onSelectMonth,
  theme,
  onSelectTrade
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const [mode, setMode] = useState<BreakdownMode>('week');
  const [selected, setSelected] = useState<{ title: string; trades: Trade[] } | null>(null);

  // The year view reaches outside the month the dashboard is on, so it reads from the
  // whole account rather than from the month's slice.
  const source = mode === 'month' ? allTrades : trades;

  const bars = useMemo(() => buildBars(month, mode, source), [month, mode, source]);

  /** A month bar moves the whole dashboard; a week or day bar opens its trades. */
  const clickBar = (bar: Bar) => {
    if (bar.monthKey) {
      onSelectMonth(bar.monthKey);
      return;
    }
    if (bar.count === 0) return;
    const inBar = trades.filter(t => bar.days.includes((t.date || '').slice(0, 10)));
    const title =
      bar.days.length === 1
        ? bar.days[0]
        : `${bar.label} of ${monthLabel(month)} (${bar.sub})`;
    setSelected({ title, trades: inBar });
  };

  // Keyed on what the chart actually draws, so a re-render that changes nothing visible
  // does not tear the canvas down and rebuild it.
  const chartKey = `${month}|${mode}|${bars.map(b => `${b.label}:${b.pl.toFixed(2)}`).join('|')}`;

  useEffect(() => {
    if (!canvasRef.current) return;

    const data = bars.map(b => parseFloat(b.pl.toFixed(2)));
    const colors = cc(theme === 'dark');

    chartRef.current?.destroy();
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: bars.map(b => b.label),
        datasets: [{
          label: 'P&L',
          data,
          backgroundColor: bars.map(b =>
            b.count === 0
              ? 'rgba(136, 146, 171, 0.18)'
              : b.pl > 0
                ? 'rgba(16, 217, 130, 0.75)'
                : b.pl < 0
                  ? 'rgba(247, 79, 110, 0.75)'
                  : 'rgba(251, 191, 36, 0.5)'
          ),
          // The month the dashboard is on gets an outline, so the year view shows where
          // everything else on the page is coming from.
          borderColor: bars.map(b => (b.monthKey === month ? '#4f6ef7' : 'transparent')),
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_evt, elements) => {
          const hit = elements[0];
          if (hit) clickBar(bars[hit.index]);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tBg,
            borderColor: colors.tBorder,
            borderWidth: 1,
            titleColor: colors.text,
            bodyColor: colors.text,
            callbacks: {
              title: items => {
                const b = bars[items[0].dataIndex];
                if (b.monthKey) return monthLabel(b.monthKey);
                return b.days.length === 1 ? b.days[0] : `${b.label} · ${b.sub}`;
              },
              label: context => {
                const b = bars[context.dataIndex];
                const wr = b.count ? Math.round((b.wins / b.count) * 100) : 0;
                return b.count
                  ? [`P&L: ${fmtC(b.pl)}`, `${b.count} trade${b.count > 1 ? 's' : ''} · ${wr}% WR`]
                  : 'No trades';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { size: mode === 'day' ? 9 : 11 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.text, callback: (val) => `$${val}` }
          }
        }
      }
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [chartKey, theme]);

  const totalSelectedPL = selected
    ? selected.trades.reduce((sum, t) => sum + (t.pl || 0), 0)
    : 0;

  return (
    <div className="card">
      <div className="card-header flex-wrap gap-2">
        <h3 className="card-title">
          <i className="fa-solid fa-chart-column"></i> Breakdown
          <span className="text-muted text-[11.5px] font-normal ml-2">
            {mode === 'month' ? month.slice(0, 4) : monthLabel(month)}
          </span>
        </h3>
        <div className="period-tabs">
          {([['week', 'Weeks'], ['day', 'Days'], ['month', 'Months']] as const).map(([id, label]) => (
            <button
              key={id}
              className={`period-tab ${mode === id ? 'active' : ''}`}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards earn their space for the handful of weeks in a month and the twelve months
          in a year; thirty-odd day cards would be a wall, so Days goes straight to the chart. */}
      {mode !== 'day' && (
        <div className="daily-grid mb-[14px]">
          {bars.map(b => {
            const hasTrades = b.count > 0;
            const isShown = b.monthKey === month;
            const wr = b.count ? Math.round((b.wins / b.count) * 100) : 0;
            return (
              <div
                key={b.label}
                className={`daily-card ${!hasTrades ? 'nodata' : b.pl >= 0 ? 'profit' : 'loss'} ${hasTrades || b.monthKey ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => clickBar(b)}
                style={isShown ? { borderColor: 'var(--accent)', opacity: 1 } : undefined}
              >
                <div className="dc-day">
                  {b.label}
                  {isShown && <i className="fa-solid fa-circle-check text-accent ml-1"></i>}
                </div>
                <div className={`dc-pl ${!hasTrades ? 'zero' : b.pl >= 0 ? 'pos' : 'neg'}`}>
                  {hasTrades ? fmtC(b.pl) : '—'}
                </div>
                <div className="dc-trades">
                  {hasTrades ? `${b.count} trade${b.count > 1 ? 's' : ''} · ${wr}% WR` : `${b.sub} · no trades`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="chart-container mt-[14px]">
        <canvas ref={canvasRef}></canvas>
      </div>

      {mode === 'month' && (
        <p className="text-[11px] text-muted mt-2">
          Every month of {month.slice(0, 4)} on this account. Click one to point the whole
          dashboard at it.
        </p>
      )}

      {/* Detail Modal */}
      {selected && (
        <Modal
          id="dayDetailModal"
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          title={`Trades on ${selected.title} — ${fmtC(totalSelectedPL)}`}
          size="sm"
        >
          <div className="flex flex-col gap-2">
            {selected.trades.map((t) => (
              <div
                key={t.id}
                className="bg-surface-input border border-border rounded-[10px] p-3 cursor-pointer"
                onClick={() => { setSelected(null); onSelectTrade(t.id); }}
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
                  {(t.date || '').slice(0, 10)} · {t.setup} · RR: {t.rr || 'N/A'} ·{' '}
                  <span className={`badge ${t.result === 'Win' ? 'badge-green' : t.result === 'Loss' ? 'badge-red' : 'badge-yellow'}`}>
                    {t.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};
export default DailyBreakdown;
