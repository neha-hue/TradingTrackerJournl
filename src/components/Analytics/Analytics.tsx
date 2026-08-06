import React, { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { getStats, cc, fmtC } from '../../lib/utils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export const Analytics: React.FC = () => {
  const { trades, currentAccId, theme } = useApp();
  const activeTrades = trades.filter((t) => (t.accountId || 'acc-live') === currentAccId);
  const stats = getStats(activeTrades);

  const mplRef = useRef<HTMLCanvasElement | null>(null);
  const dowRef = useRef<HTMLCanvasElement | null>(null);
  const rrRef = useRef<HTMLCanvasElement | null>(null);

  const mplChart = useRef<Chart | null>(null);
  const dowChart = useRef<Chart | null>(null);
  const rrChart = useRef<Chart | null>(null);

  useEffect(() => {
    const isDarkTheme = theme === 'dark';
    const colors = cc(isDarkTheme);

    // 1. Monthly P&L Chart
    if (mplRef.current) {
      const mm: Record<string, number> = {};
      activeTrades.forEach((t) => {
        const m = t.date ? t.date.slice(0, 7) : null;
        if (!m) return;
        if (!mm[m]) mm[m] = 0;
        mm[m] += t.pl || 0;
      });

      const labels = Object.keys(mm).sort();
      const data = labels.map((l) => mm[l]);

      if (mplChart.current) mplChart.current.destroy();

      mplChart.current = new Chart(mplRef.current, {
        type: 'bar',
        data: {
          labels: labels.map((l) => {
            const [y, m] = l.split('-');
            return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
          }),
          datasets: [{
            label: 'Monthly P&L',
            data,
            backgroundColor: data.map((v) => (v >= 0 ? 'rgba(16, 217, 130, 0.75)' : 'rgba(247, 79, 110, 0.75)')),
            borderRadius: 6,
            borderSkipped: false,
          }],
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
                label: (ctx) => `P&L: $${(ctx.raw as number).toFixed(2)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: colors.text },
            },
            y: {
              grid: { color: colors.grid },
              ticks: {
                color: colors.text,
                callback: (v) => `$${v}`,
              },
            },
          },
        },
      });
    }

    // 2. Day of Week Chart
    if (dowRef.current) {
      const dow: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      activeTrades.forEach((t) => {
        const d = new Date(t.date).getDay();
        const idx = (d + 6) % 7; // Mon=0, Sun=6
        dow[idx] += t.pl || 0;
      });

      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data = labels.map((_, i) => dow[i]);

      if (dowChart.current) dowChart.current.destroy();

      dowChart.current = new Chart(dowRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: data.map((v) => (v >= 0 ? 'rgba(16, 217, 130, 0.75)' : 'rgba(247, 79, 110, 0.75)')),
            borderRadius: 6,
            borderSkipped: false,
          }],
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
                label: (ctx) => `P&L: $${(ctx.raw as number).toFixed(2)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: colors.text },
            },
            y: {
              grid: { color: colors.grid },
              ticks: {
                color: colors.text,
                callback: (v) => `$${v}`,
              },
            },
          },
        },
      });
    }

    // 3. Risk Reward Ratio Chart
    if (rrRef.current) {
      const buckets = { '<1': 0, '1-1.5': 0, '1.5-2': 0, '2-3': 0, '3+': 0 };
      activeTrades.forEach((t) => {
        const rr = parseFloat(t.rr || '0');
        if (!rr) return;
        if (rr < 1) buckets['<1']++;
        else if (rr < 1.5) buckets['1-1.5']++;
        else if (rr < 2) buckets['1.5-2']++;
        else if (rr < 3) buckets['2-3']++;
        else buckets['3+']++;
      });

      if (rrChart.current) rrChart.current.destroy();

      rrChart.current = new Chart(rrRef.current, {
        type: 'bar',
        data: {
          labels: Object.keys(buckets),
          datasets: [{
            data: Object.values(buckets),
            backgroundColor: 'rgba(79, 110, 247, 0.75)',
            borderRadius: 6,
            borderSkipped: false,
          }],
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
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: colors.text },
            },
            y: {
              grid: { color: colors.grid },
              ticks: {
                color: colors.text,
                stepSize: 1,
              },
            },
          },
        },
      });
    }

    return () => {
      if (mplChart.current) mplChart.current.destroy();
      if (dowChart.current) dowChart.current.destroy();
      if (rrChart.current) rrChart.current.destroy();
    };
  }, [activeTrades, theme]);

  // Strategy performance calculations
  const setupMap: Record<string, { wins: number; losses: number; pl: number }> = {};
  activeTrades.forEach((t) => {
    const s = t.setup || 'Other';
    if (!setupMap[s]) setupMap[s] = { wins: 0, losses: 0, pl: 0 };
    if (t.result === 'Win') setupMap[s].wins++;
    else if (t.result === 'Loss') setupMap[s].losses++;
    setupMap[s].pl += t.pl || 0;
  });

  const sortedSetups = Object.entries(setupMap).sort((a, b) => b[1].pl - a[1].pl);

  // Streaks Analysis
  let maxW = 0;
  let maxL = 0;
  let cW = 0;
  let cL = 0;
  let curStr = '';
  let curCnt = 0;

  const sortedTradesChronological = [...activeTrades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const t of sortedTradesChronological) {
    if (t.result === 'Win') {
      cW++;
      cL = 0;
    } else if (t.result === 'Loss') {
      cL++;
      cW = 0;
    } else {
      cW = 0;
      cL = 0;
    }
    if (cW > maxW) maxW = cW;
    if (cL > maxL) maxL = cL;
  }

  for (let i = sortedTradesChronological.length - 1; i >= 0; i--) {
    const r = sortedTradesChronological[i].result;
    if (i === sortedTradesChronological.length - 1) {
      curStr = r;
      curCnt = 1;
    } else if (sortedTradesChronological[i].result === curStr) {
      curCnt++;
    } else {
      break;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sub Header Stats */}
      <div className="stats-grid" id="analyticsStats">
        <div className="stat-card green">
          <div className="stat-label">Avg Win</div>
          <div className="stat-value green text-[20px]">
            ${stats.avgWin.toFixed(2)}
          </div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Avg Loss</div>
          <div className="stat-value red text-[20px]">
            -${stats.avgLoss.toFixed(2)}
          </div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Total Trades</div>
          <div className="stat-value blue text-[20px]">
            {stats.total}
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Profit Factor</div>
          <div className="stat-value purple text-[20px]">
            {isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'}
          </div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Gross Win</div>
          <div className="stat-value yellow text-[20px]">
            ${(stats.grossWin || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Monthly and DOW charts */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <i className="fa-solid fa-chart-column"></i> Monthly P&L Breakdown
            </h3>
          </div>
          <div className="chart-container">
            <canvas ref={mplRef}></canvas>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <i className="fa-solid fa-chart-bar"></i> Performance by Day of Week
            </h3>
          </div>
          <div className="chart-container">
            <canvas ref={dowRef}></canvas>
          </div>
        </div>
      </div>

      {/* Setup Performance & RR Distribution */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <i className="fa-solid fa-gears"></i> Setup Performance
            </h3>
          </div>
          <div id="setupPerformance" className="flex flex-col gap-2.5">
            {sortedSetups.length > 0 ? (
              sortedSetups.map(([setupName, data]) => {
                const tot = data.wins + data.losses;
                const wr = tot ? (data.wins / tot) * 100 : 0;
                return (
                  <div className="heatmap-row" key={setupName}>
                    <div className="heatmap-label w-[110px] text-[10.5px]">
                      {setupName}
                    </div>
                    <div className="flex-1">
                      <div className="flex-center between text-[11px] mb-[2px]">
                        <span className="text-muted">{tot} trades · WR {wr.toFixed(0)}%</span>
                        <span className={`${data.pl >= 0 ? 'text-green' : 'text-red'} font-bold`}>
                          {fmtC(data.pl)}
                        </span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className={`progress-bar ${data.pl >= 0 ? 'green' : 'red'}`} style={{ width: `${wr}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-muted p-5 text-center">No data</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <i className="fa-solid fa-scale-balanced"></i> R:R Distribution
            </h3>
          </div>
          <div className="chart-container">
            <canvas ref={rrRef}></canvas>
          </div>
        </div>
      </div>

      {/* Streak Analysis */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fa-solid fa-bolt"></i> Streak Analysis
          </h3>
        </div>
        <div className="grid-3" id="streakAnalysis">
          <div className="stat-card green m-0">
            <div className="stat-label">Best Win Streak</div>
            <div className="stat-value green">{maxW}</div>
            <div className="stat-sub">Consecutive wins</div>
          </div>
          <div className="stat-card red m-0">
            <div className="stat-label">Worst Loss Streak</div>
            <div className="stat-value red">{maxL}</div>
            <div className="stat-sub">Consecutive losses</div>
          </div>
          <div className="stat-card cur-streak m-0" style={{ borderColor: curStr === 'Win' ? 'rgba(16, 217, 130, 0.3)' : curStr === 'Loss' ? 'rgba(247, 79, 110, 0.3)' : 'var(--border)' }}>
            <div className="stat-label">Current Streak</div>
            <div className={`stat-value ${curStr === 'Win' ? 'green' : curStr === 'Loss' ? 'red' : ''}`}>
              {curCnt} {curStr || '—'}
            </div>
            <div className="stat-sub">Latest run</div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Analytics;
