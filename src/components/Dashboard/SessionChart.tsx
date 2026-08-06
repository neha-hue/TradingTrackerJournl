import React, { useEffect, useRef } from 'react';
import { Trade } from '../../lib/types';
import { cc } from '../../lib/utils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface SessionChartProps {
  trades: Trade[];
  theme: 'dark' | 'light';
}

export const SessionChart: React.FC<SessionChartProps> = ({ trades, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const sessions: Record<string, { pl: number }> = {};
    trades.forEach((t) => {
      const s = t.session || 'Other';
      if (!sessions[s]) sessions[s] = { pl: 0 };
      sessions[s].pl += t.pl || 0;
    });

    const labels = Object.keys(sessions);
    const pls = labels.map(l => sessions[l].pl);

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
          label: 'P&L',
          data: pls,
          backgroundColor: pls.map(v => v >= 0 ? 'rgba(16, 217, 130, 0.7)' : 'rgba(247, 79, 110, 0.7)'),
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
              label: (context) => `P&L: $${parseFloat((context.raw as number).toFixed(2))}`
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
  }, [trades, theme]);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <i className="fa-solid fa-clock"></i> Performance by Session
        </h3>
      </div>
      <div className="chart-container">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
};
export default SessionChart;
