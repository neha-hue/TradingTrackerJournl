import React, { useEffect, useRef } from 'react';
import { Kpis, computeScore } from '../../lib/score';
import { cc } from '../../lib/utils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

/**
 * Six measures of the account on one radar, with their mean underneath.
 *
 * The targets behind each axis are ours rather than an industry standard - see
 * computeScore - so this is a shape to read, not a grade to chase. A leg that collapses
 * inward is the one worth working on.
 */
export const ScoreCard: React.FC<{ kpis: Kpis; theme: 'dark' | 'light' }> = ({ kpis, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const score = computeScore(kpis);

  const shape = score.parts.map(p => Math.round(p.value)).join(',');

  useEffect(() => {
    if (!canvasRef.current) return;
    const colors = cc(theme === 'dark');

    chartRef.current?.destroy();
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: score.parts.map(p => p.label),
        datasets: [{
          label: 'Score',
          data: score.parts.map(p => p.value),
          backgroundColor: 'rgba(79, 110, 247, 0.22)',
          borderColor: '#4f6ef7',
          borderWidth: 2,
          pointBackgroundColor: '#4f6ef7',
          pointRadius: 3
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
              label: item => {
                const part = score.parts[item.dataIndex];
                return `${part.detail}  (scores ${part.value.toFixed(0)}/100)`;
              }
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            angleLines: { color: colors.grid },
            grid: { color: colors.grid },
            pointLabels: { color: colors.text, font: { size: 10.5 } },
            ticks: { display: false, stepSize: 25 }
          }
        }
      }
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [shape, theme]);

  const tone =
    score.overall >= 70 ? 'text-green' : score.overall >= 45 ? 'text-yellow' : 'text-red';

  return (
    <div className="card mb-0">
      <div className="card-header">
        <h3 className="card-title"><i className="fa-solid fa-gauge-high"></i> Performance Score</h3>
      </div>

      <div className="h-[210px]">
        <canvas ref={canvasRef}></canvas>
      </div>

      <div className="text-center mt-2">
        <div className="text-[11px] text-muted uppercase tracking-wide font-bold">Your score</div>
        <div className={`text-[26px] font-extrabold mono ${tone}`}>
          {score.overall.toFixed(2)}
        </div>
        {!score.meaningful && (
          <div className="text-[11px] text-muted mt-1">
            Based on {kpis.totalTrades} trade{kpis.totalTrades === 1 ? '' : 's'} — too few to
            read much into.
          </div>
        )}
      </div>

      <div className="divider my-3"></div>

      <div className="flex flex-col gap-1.5">
        {score.parts.map(p => (
          <div key={p.key} className="flex items-center gap-2 text-[11.5px]">
            <span className="text-secondary w-[92px] shrink-0">{p.label}</span>
            <span className="flex-1 h-1.5 rounded-full bg-surface-input overflow-hidden">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${p.value}%`,
                  background: p.value >= 70 ? '#10d982' : p.value >= 45 ? '#fbbf24' : '#f74f6e'
                }}
              />
            </span>
            <span className="mono text-muted w-[52px] text-right shrink-0">{p.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScoreCard;
