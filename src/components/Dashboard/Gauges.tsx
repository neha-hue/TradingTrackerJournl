import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const GREEN = '#10d982';
const RED = '#f74f6e';
const AMBER = '#fbbf24';

/**
 * The half-circle dial used for the win-rate widgets.
 *
 * Chart.js has no gauge type; a doughnut rotated a quarter turn and cut to half a circle
 * gives the same thing without another dependency.
 */
export const HalfGauge: React.FC<{
  /** 0 to 100. */
  percent: number;
  theme: 'dark' | 'light';
}> = ({ percent, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const value = Math.max(0, Math.min(100, percent));

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Reached', 'Remaining'],
        datasets: [{
          data: [value, 100 - value],
          backgroundColor: [
            value >= 50 ? GREEN : value >= 33 ? AMBER : RED,
            theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
          ],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        events: [],
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [value, theme]);

  return (
    <div className="relative w-[112px] h-[58px] shrink-0">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

/**
 * The small ring beside the profit factor, split into the gross win and gross loss that
 * produced it - the ring is the ratio, not a percentage of anything.
 */
export const SplitRing: React.FC<{
  win: number;
  loss: number;
  theme: 'dark' | 'light';
}> = ({ win, loss, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const empty = win <= 0 && loss <= 0;

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Gross win', 'Gross loss'],
        datasets: [{
          data: empty ? [1, 0] : [win, loss],
          backgroundColor: empty
            ? [theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', 'transparent']
            : [GREEN, RED],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        events: [],
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [win, loss, empty, theme]);

  return (
    <div className="relative w-[54px] h-[54px] shrink-0">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};
