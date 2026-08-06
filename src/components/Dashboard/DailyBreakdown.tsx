import React, { useEffect, useRef, useState } from 'react';
import { Trade } from '../../lib/types';
import { cc, fmtC } from '../../lib/utils';
import { Chart, registerables } from 'chart.js';
import Modal from '../shared/Modal';

Chart.register(...registerables);

interface DailyBreakdownProps {
  trades: Trade[];
  theme: 'dark' | 'light';
  onSelectTrade: (id: string) => void;
}

export const DailyBreakdown: React.FC<DailyBreakdownProps> = ({ trades, theme, onSelectTrade }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [selectedDayTrades, setSelectedDayTrades] = useState<{ date: string; trades: Trade[] } | null>(null);

  // Prepare day map data
  const now = new Date();
  const dayMap: Record<string, { label: string; date: Date; pl: number; count: number; wins: number }> = {};

  if (mode === 'week') {
    // Current week: Mon to Sun
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0, Sun=6
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);
    const dNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { label: dNames[i], date: d, pl: 0, count: 0, wins: 0 };
    }

    trades.forEach((t) => {
      const key = t.date ? t.date.slice(0, 10) : null;
      if (key && dayMap[key]) {
        dayMap[key].pl += t.pl || 0;
        dayMap[key].count++;
        if (t.result === 'Win') dayMap[key].wins++;
      }
    });
  } else {
    // Current month: each day
    const year = now.getFullYear();
    const mon = now.getMonth();
    const daysInMonth = new Date(year, mon + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, mon, d);
      const key = dt.toISOString().slice(0, 10);
      dayMap[key] = { label: `${d}`, date: dt, pl: 0, count: 0, wins: 0 };
    }

    trades.forEach((t) => {
      const key = t.date ? t.date.slice(0, 10) : null;
      if (key && dayMap[key]) {
        dayMap[key].pl += t.pl || 0;
        dayMap[key].count++;
        if (t.result === 'Win') dayMap[key].wins++;
      }
    });
  }

  const entries = Object.entries(dayMap).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  useEffect(() => {
    if (!canvasRef.current) return;

    const labels = entries.map(([, d]) => d.label);
    const data = entries.map(([, d]) => parseFloat(d.pl.toFixed(2)));

    const isDarkTheme = theme === 'dark';
    const colors = cc(isDarkTheme);

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Daily P&L',
          data,
          backgroundColor: data.map(v => v > 0 ? 'rgba(16, 217, 130, 0.75)' : v < 0 ? 'rgba(247, 79, 110, 0.75)' : 'rgba(251, 191, 36, 0.5)'),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tBg,
            borderColor: colors.tBorder,
            borderWidth: 1,
            titleColor: colors.text,
            bodyColor: colors.text,
            callbacks: {
              label: (context) => `P&L: $${(context.raw as number).toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: colors.text,
              font: { size: mode === 'month' ? 9 : 11 }
            }
          },
          y: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.text,
              callback: (val) => `$${val}`
            }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [trades, theme, mode, entries]);

  const handleCardClick = (dateStr: string) => {
    const dayTrades = trades.filter(t => t.date && t.date.startsWith(dateStr));
    if (dayTrades.length === 0) return;
    setSelectedDayTrades({ date: dateStr, trades: dayTrades });
  };

  const handleTradeClick = (tradeId: string) => {
    setSelectedDayTrades(null);
    onSelectTrade(tradeId);
  };

  const totalSelectedDayPL = selectedDayTrades
    ? selectedDayTrades.trades.reduce((sum, t) => sum + (t.pl || 0), 0)
    : 0;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <i className="fa-solid fa-chart-column"></i> Daily Breakdown
        </h3>
        <div className="period-tabs">
          <button
            className={`period-tab ${mode === 'week' ? 'active' : ''}`}
            onClick={() => setMode('week')}
          >
            Week
          </button>
          <button
            className={`period-tab ${mode === 'month' ? 'active' : ''}`}
            onClick={() => setMode('month')}
          >
            Month
          </button>
        </div>
      </div>

      {mode === 'week' && (
        <div className="daily-grid mb-[14px]">
          {entries.map(([k, d]) => {
            const hasTrades = d.count > 0;
            const wr = d.count ? Math.round((d.wins / d.count) * 100) : 0;
            return (
              <div
                key={k}
                className={`daily-card ${!hasTrades ? 'nodata' : d.pl >= 0 ? 'profit' : 'loss'} ${hasTrades ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => handleCardClick(k)}
              >
                <div className="dc-day">{d.label}</div>
                <div className={`dc-pl ${!hasTrades ? 'zero' : d.pl >= 0 ? 'pos' : 'neg'}`}>
                  {hasTrades ? fmtC(d.pl) : '—'}
                </div>
                <div className="dc-trades">
                  {hasTrades ? `${d.count} trade${d.count > 1 ? 's' : ''} · ${wr}% WR` : 'No trades'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="chart-container mt-[14px]">
        <canvas ref={canvasRef}></canvas>
      </div>

      {/* Daily Detail Modal */}
      {selectedDayTrades && (
        <Modal
          id="dayDetailModal"
          isOpen={!!selectedDayTrades}
          onClose={() => setSelectedDayTrades(null)}
          title={`Trades on ${selectedDayTrades.date} — ${fmtC(totalSelectedDayPL)}`}
          size="sm"
        >
          <div className="flex flex-col gap-2">
            {selectedDayTrades.trades.map((t) => (
              <div
                key={t.id}
                className="bg-surface-input border border-border rounded-[10px] p-3 cursor-pointer"
                onClick={() => handleTradeClick(t.id)}
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
                  {t.setup} · RR: {t.rr || 'N/A'} ·{' '}
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
