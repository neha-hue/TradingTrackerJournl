import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getStats, getWeekNum, cc, fmtC } from '../../lib/utils';
import { Chart, registerables } from 'chart.js';
import { Trade } from '../../lib/types';

Chart.register(...registerables);

export const WeeklyResults: React.FC = () => {
  const { trades, currentAccId, theme } = useApp();
  const activeTrades = trades.filter((t) => (t.accountId || 'acc-live') === currentAccId);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  // Year filter logic
  const years = Array.from(
    new Set(
      activeTrades.map(t => t.date ? new Date(t.date).getFullYear() : null).filter(Boolean)
    )
  );
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.push(currentYear);
  years.sort((a, b) => b! - a!);

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Filter trades for selected year
  const yearTrades = activeTrades.filter((t) => {
    if (!t.date) return false;
    return new Date(t.date).getFullYear() === selectedYear;
  });

  // Group by week
  const weeklyGroups: Record<string, { trades: Trade[]; wk: number }> = {};
  yearTrades.forEach((t) => {
    const d = new Date(t.date);
    const wk = getWeekNum(d);
    const key = `W${String(wk).padStart(2, '0')}`;
    if (!weeklyGroups[key]) {
      weeklyGroups[key] = { trades: [], wk };
    }
    weeklyGroups[key].trades.push(t);
  });

  const sortedWeeks = Object.keys(weeklyGroups).sort();
  const weeklyPLs = sortedWeeks.map((wk) =>
    weeklyGroups[wk].trades.reduce((sum, t) => sum + (t.pl || 0), 0)
  );

  useEffect(() => {
    if (!canvasRef.current) return;

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
        labels: sortedWeeks,
        datasets: [{
          label: 'Weekly P&L',
          data: weeklyPLs,
          backgroundColor: weeklyPLs.map(v => v >= 0 ? 'rgba(16, 217, 130, 0.75)' : 'rgba(247, 79, 110, 0.75)'),
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
              label: (ctx) => `P&L: $${(ctx.raw as number).toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text }
          },
          y: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.text,
              callback: (v) => `$${v}`
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
  }, [trades, theme, selectedYear, sortedWeeks, weeklyPLs]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card mb-0">
        <div className="card-header flex items-center justify-between">
          <h3 className="card-title">
            <i className="fa-solid fa-calendar-minus"></i> Weekly Performance Overview
          </h3>
          <select
            className="form-control w-[100px]"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y!}>{y}</option>
            ))}
          </select>
        </div>

        <div className="chart-container-lg my-[14px]">
          <canvas ref={canvasRef}></canvas>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th className="hidden sm:table-cell">Date Range</th>
                <th>Trades</th>
                <th className="hidden sm:table-cell">Wins</th>
                <th className="hidden sm:table-cell">Losses</th>
                <th>Win Rate</th>
                <th>Net P&L</th>
                <th className="hidden lg:table-cell">Best Day</th>
                <th className="hidden lg:table-cell">Worst Day</th>
              </tr>
            </thead>
            <tbody>
              {sortedWeeks.length > 0 ? (
                sortedWeeks.map((wk) => {
                  const wt = weeklyGroups[wk].trades;
                  const s = getStats(wt);

                  const dates = wt.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
                  const dr = dates.length > 0
                    ? `${dates[0].toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${dates[dates.length - 1].toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                    : '-';

                  // Best and worst day in the week calculations
                  const dayPLs: Record<string, number> = {};
                  wt.forEach((t) => {
                    const dk = t.date ? t.date.slice(0, 10) : null;
                    if (!dk) return;
                    if (!dayPLs[dk]) dayPLs[dk] = 0;
                    dayPLs[dk] += t.pl || 0;
                  });

                  const values = Object.values(dayPLs);
                  const best = values.length > 0 ? Math.max(...values) : 0;
                  const worst = values.length > 0 ? Math.min(...values) : 0;

                  return (
                    <tr key={wk}>
                      <td><strong>{wk}</strong></td>
                      <td className="hidden sm:table-cell text-[11.5px]">{dr}</td>
                      <td>{s.total}</td>
                      <td className="hidden sm:table-cell text-green">{s.wins}</td>
                      <td className="hidden sm:table-cell text-red">{s.losses}</td>
                      <td>
                        <span className={`badge ${s.winRate >= 50 ? 'badge-green' : 'badge-red'}`}>
                          {s.winRate.toFixed(0)}%
                        </span>
                      </td>
                      <td className={`mono fw-700 ${s.totalPL >= 0 ? 'text-green' : 'text-red'}`}>
                        {fmtC(s.totalPL)}
                      </td>
                      <td className="hidden lg:table-cell mono text-green">${best.toFixed(2)}</td>
                      <td className="hidden lg:table-cell mono text-red">-${Math.abs(worst).toFixed(2)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="text-center p-5 text-text-muted">
                    No trades for selected year
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
export default WeeklyResults;
