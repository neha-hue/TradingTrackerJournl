import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getStats, cc, fmtC } from '../../lib/utils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export const QuarterlyResults: React.FC = () => {
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

  const qs = [
    { name: 'Q1', label: 'Jan – Mar', months: [0, 1, 2] },
    { name: 'Q2', label: 'Apr – Jun', months: [3, 4, 5] },
    { name: 'Q3', label: 'Jul – Sep', months: [6, 7, 8] },
    { name: 'Q4', label: 'Oct – Dec', months: [9, 10, 11] }
  ];

  const qd = qs.map((q) => {
    const qt = activeTrades.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear && q.months.includes(d.getMonth());
    });
    return {
      ...q,
      trades: qt
    };
  });

  const quarterlyPLs = qd.map(q => q.trades.reduce((sum, t) => sum + (t.pl || 0), 0));
  const maxPL = Math.max(1, ...quarterlyPLs.map(Math.abs));

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
        labels: qd.map(q => `${q.name} (${q.label})`),
        datasets: [{
          label: 'Quarterly P&L',
          data: quarterlyPLs,
          backgroundColor: quarterlyPLs.map(v => v >= 0 ? 'rgba(16, 217, 130, 0.75)' : 'rgba(247, 79, 110, 0.75)'),
          borderRadius: 10,
          borderSkipped: false,
          barThickness: 70
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
            ticks: { color: colors.text, font: { size: 12 } }
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
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="card-title">
            <i className="fa-solid fa-chart-pie"></i> Quarterly Performance Overview
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
      </div>

      {/* Quarterly Cards */}
      <div className="grid-2 gap-[18px]" id="quarterlyCards">
        {qd.map((q) => {
          const s = getStats(q.trades);
          const currentPL = quarterlyPLs[qd.findIndex(item => item.name === q.name)];
          return (
            <div className="card m-0" key={q.name}>
              <div className="card-title mb-3">
                <i className="fa-solid fa-chart-bar text-accent"></i>{' '}
                {q.name} – {q.label} {selectedYear}
              </div>
              <div className={`stat-value ${s.totalPL >= 0 ? 'green' : 'red'} text-[26px] mb-3`}>
                {fmtC(s.totalPL)}
              </div>
              <div className="grid-2 text-[12px] gap-1.5">
                <div><span className="text-muted">Trades:</span> <strong>{s.total}</strong></div>
                <div>
                  <span className="text-muted">Win Rate:</span>{' '}
                  <strong className={s.winRate >= 50 ? 'text-green' : 'text-red'}>
                    {s.winRate.toFixed(1)}%
                  </strong>
                </div>
                <div><span className="text-muted">Wins:</span> <strong className="text-green">{s.wins}</strong></div>
                <div><span className="text-muted">Losses:</span> <strong className="text-red">{s.losses}</strong></div>
                <div><span className="text-muted">Avg Win:</span> <strong className="text-green">${s.avgWin.toFixed(2)}</strong></div>
                <div><span className="text-muted">Avg Loss:</span> <strong className="text-red">-${s.avgLoss.toFixed(2)}</strong></div>
                <div>
                  <span className="text-muted">Expectancy:</span>{' '}
                  <strong className={s.expectancy >= 0 ? 'text-green' : 'text-red'}>
                    {fmtC(s.expectancy)}
                  </strong>
                </div>
                <div>
                  <span className="text-muted">Profit Factor:</span>{' '}
                  <strong className="text-purple">
                    {isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'}
                  </strong>
                </div>
              </div>
              <div className="progress-bar-wrap mt-3">
                <div
                  className={`progress-bar ${s.totalPL >= 0 ? 'green' : 'red'}`}
                  style={{ width: `${(Math.abs(currentPL) / maxPL) * 100}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default QuarterlyResults;
