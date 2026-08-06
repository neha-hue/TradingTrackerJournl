import React, { useEffect, useRef } from 'react';
import { Trade } from '../../lib/types';
import { cc } from '../../lib/utils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface WinLossChartProps {
  trades: Trade[];
  theme: 'dark' | 'light';
}

export const WinLossChart: React.FC<WinLossChartProps> = ({ trades, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const wins = trades.filter(t => t.result === 'Win').length;
    const losses = trades.filter(t => t.result === 'Loss').length;
    const be = trades.filter(t => t.result === 'Break Even').length;

    const isDarkTheme = theme === 'dark';
    const colors = cc(isDarkTheme);

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Wins', 'Losses', 'Break Even'],
        datasets: [{
          data: [wins, losses, be],
          backgroundColor: [
            'rgba(16, 217, 130, 0.85)',
            'rgba(247, 79, 110, 0.85)',
            'rgba(251, 191, 36, 0.85)'
          ],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.text,
              padding: 14,
              font: { size: 11 }
            }
          },
          tooltip: {
            backgroundColor: colors.tBg,
            borderColor: colors.tBorder,
            borderWidth: 1,
            titleColor: colors.text,
            bodyColor: colors.text
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
          <i className="fa-solid fa-chart-pie"></i> Win/Loss Ratio
        </h3>
      </div>
      <div className="chart-container">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
};
export default WinLossChart;
