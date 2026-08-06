import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getStats, cc, fmtC } from '../../lib/utils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export const MonthlyResults: React.FC = () => {
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

  // Monthly names
  const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months = Array.from({ length: 12 }, (_, i) => {
    const monthKey = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
    const mt = activeTrades.filter(t => t.date && t.date.startsWith(monthKey));
    return {
      name: mNames[i],
      key: monthKey,
      trades: mt
    };
  });

  const monthlyPLs = months.map(m => m.trades.reduce((sum, t) => sum + (t.pl || 0), 0));

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
        labels: mNames,
        datasets: [{
          label: 'Monthly P&L',
          data: monthlyPLs,
          backgroundColor: monthlyPLs.map(v => v >= 0 ? 'rgba(16, 217, 130, 0.75)' : 'rgba(247, 79, 110, 0.75)'),
          borderRadius: 8,
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
            bodyColor: colors.text
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
  }, [trades, theme, selectedYear]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card mb-0">
        <div className="card-header flex items-center justify-between">
          <h3 className="card-title">
            <i className="fa-solid fa-calendar-plus"></i> Monthly Performance Overview
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

        {/* Monthly summaries grid */}
        <div className="period-cards mb-[18px]" id="monthlyCards">
          {months.map((m) => {
            const s = getStats(m.trades);
            return (
              <div className="period-card" key={m.key}>
                <div className="period-card-label">{m.name} {selectedYear}</div>
                <div className={`period-card-val ${s.totalPL >= 0 ? 'pos' : 'neg'}`}>
                  {fmtC(s.totalPL)}
                </div>
                <div className="period-card-trades">
                  {s.total} trades · {s.winRate.toFixed(0)}% WR
                </div>
              </div>
            );
          })}
        </div>

        {/* Table summary */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Trades</th>
                <th className="hidden sm:table-cell">Wins</th>
                <th className="hidden sm:table-cell">Losses</th>
                <th>Win Rate</th>
                <th>Net P&L</th>
                <th className="hidden lg:table-cell">Avg Win</th>
                <th className="hidden lg:table-cell">Avg Loss</th>
                <th className="hidden lg:table-cell">Expectancy</th>
              </tr>
            </thead>
            <tbody id="monthlyBody">
              {months.map((m) => {
                const s = getStats(m.trades);
                if (!s.total) {
                  return (
                    <tr key={m.key}>
                      <td><strong>{m.name}</strong></td>
                      <td colSpan={8} className="text-text-muted text-[12px] text-center">
                        No trades logged
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={m.key}>
                    <td><strong>{m.name} {selectedYear}</strong></td>
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
                    <td className="hidden lg:table-cell mono text-green">${s.avgWin.toFixed(2)}</td>
                    <td className="hidden lg:table-cell mono text-red">-${s.avgLoss.toFixed(2)}</td>
                    <td className={`hidden lg:table-cell mono ${s.expectancy >= 0 ? 'text-green' : 'text-red'}`}>
                      {fmtC(s.expectancy)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default MonthlyResults;
