import React from 'react';
import { Trade } from '../../lib/types';
import { fmtC } from '../../lib/utils';

interface TopInstrumentsProps {
  trades: Trade[];
}

export const TopInstruments: React.FC<TopInstrumentsProps> = ({ trades }) => {
  const map: Record<string, { pl: number; count: number }> = {};
  trades.forEach((t) => {
    if (!map[t.instrument]) map[t.instrument] = { pl: 0, count: 0 };
    map[t.instrument].pl += t.pl || 0;
    map[t.instrument].count++;
  });

  const sorted = Object.entries(map)
    .sort((a, b) => b[1].pl - a[1].pl)
    .slice(0, 6);

  const max = sorted.length > 0 ? Math.max(...sorted.map(s => Math.abs(s[1].pl))) : 1;

  if (sorted.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fa-solid fa-fire"></i> Top Instruments
          </h3>
        </div>
        <div className="empty-state p-5">
          <i className="fa-solid fa-chart-simple"></i>
          <p>No trades yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <i className="fa-solid fa-fire"></i> Top Instruments
        </h3>
      </div>
      <div id="topInstruments" className="flex flex-col gap-2">
        {sorted.map(([ins, d]) => (
          <div className="heatmap-row" key={ins}>
            <div className="heatmap-label">{ins}</div>
            <div style={{ flex: 1 }}>
              <div className="flex-center between text-[11px] mb-0.5">
                <span className="text-muted">{d.count} trades</span>
                <span className={`${d.pl >= 0 ? 'text-green' : 'text-red'} font-bold`}>
                  {fmtC(d.pl)}
                </span>
              </div>
              <div className="progress-bar-wrap">
                <div
                  className={`progress-bar ${d.pl >= 0 ? 'green' : 'red'}`}
                  style={{ width: `${(Math.abs(d.pl) / max) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default TopInstruments;
