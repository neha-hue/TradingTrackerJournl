import React, { useEffect, useRef, useState } from 'react';
import { Trade } from '../../lib/types';
import { cc } from '../../lib/utils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface EquityChartProps {
  trades: Trade[];
  theme: 'dark' | 'light';
}

export const EquityChart: React.FC<EquityChartProps> = ({ trades, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const [period, setPeriod] = useState<'all' | '1w' | '1m' | '3m'>('all');

  useEffect(() => {
    if (!canvasRef.current) return;

    // Filter and sort trades by date ascending
    const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let filtered = sorted;
    const now = new Date();

    if (period === '1w') {
      filtered = sorted.filter(t => new Date(t.date) >= new Date(now.getTime() - 7 * 86400000));
    } else if (period === '1m') {
      filtered = sorted.filter(t => new Date(t.date) >= new Date(now.getTime() - 30 * 86400000));
    } else if (period === '3m') {
      filtered = sorted.filter(t => new Date(t.date) >= new Date(now.getTime() - 90 * 86400000));
    }

    let cum = 0;
    const labels: string[] = [];
    const data: number[] = [];

    filtered.forEach((t) => {
      cum += t.pl || 0;
      labels.push(new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
      data.push(parseFloat(cum.toFixed(2)));
    });

    const isDarkTheme = theme === 'dark';
    const colors = cc(isDarkTheme);
    const pos = data.length > 0 && data[data.length - 1] >= 0;

    // Destroy old chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Equity',
          data,
          borderColor: pos ? '#10d982' : '#f74f6e',
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx: chartCtx, chartArea } = chart;
            if (!chartArea) return 'transparent';
            const g = chartCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, pos ? 'rgba(16,217,130,0.2)' : 'rgba(247,79,110,0.2)');
            g.addColorStop(1, pos ? 'rgba(16,217,130,0)' : 'rgba(247,79,110,0)');
            return g;
          },
          fill: true,
          tension: 0.4,
          pointRadius: data.length > 60 ? 0 : 3,
          borderWidth: 2
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
              label: (context) => `Equity: $${context.raw}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.text,
              font: { size: 10 },
              maxTicksLimit: 8
            }
          },
          y: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.text,
              font: { size: 10 },
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
  }, [trades, theme, period]);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <i className="fa-solid fa-chart-line"></i> Equity Curve
        </h3>
        <div className="period-tabs">
          {(['all', '1w', '1m', '3m'] as const).map((p) => (
            <button
              key={p}
              className={`period-tab ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-container-lg">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
};
export default EquityChart;
