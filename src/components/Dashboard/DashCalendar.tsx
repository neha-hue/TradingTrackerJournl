import React from 'react';
import { Trade } from '../../lib/types';
import { fmtC, fmtK } from '../../lib/utils';
import { currentMonth, monthLabel, shiftMonth, weeksOfMonth } from '../../lib/monthly';

interface DashCalendarProps {
  /** Already narrowed to the month being shown. */
  trades: Trade[];
  month: string;
  onChangeMonth: (key: string) => void;
  onOpenDay: (day: string, trades: Trade[]) => void;
}

interface DayCell {
  pl: number;
  count: number;
  wins: number;
  rr: number[];
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The month grid, with a running total per week down the side.
 *
 * Weeks come from weeksOfMonth, which cuts on Sundays exactly where the calendar page's
 * rows cut, so the two views can never disagree about which week a day belongs to.
 */
export const DashCalendar: React.FC<DashCalendarProps> = ({
  trades,
  month,
  onChangeMonth,
  onOpenDay
}) => {
  const byDay = new Map<string, DayCell>();
  for (const t of trades) {
    const day = (t.date || '').slice(0, 10);
    if (!day) continue;
    const held = byDay.get(day) ?? { pl: 0, count: 0, wins: 0, rr: [] };
    held.pl += t.pl || 0;
    held.count++;
    if (t.result === 'Win') held.wins++;
    const rr = parseFloat(t.rr);
    if (!isNaN(rr)) held.rr.push(rr);
    byDay.set(day, held);
  }

  const weeks = weeksOfMonth(month);
  const today = new Date().toISOString().slice(0, 10);

  const monthPL = trades.reduce((sum, t) => sum + (t.pl || 0), 0);
  const tradingDays = byDay.size;

  const openDay = (day: string) => {
    const dayTrades = trades.filter(t => (t.date || '').startsWith(day));
    if (dayTrades.length > 0) onOpenDay(day, dayTrades);
  };

  return (
    <div className="card mb-0">
      <div className="cal-nav">
        <div className="cal-nav-left">
          <div className="cal-nav-arrows">
            <button className="cal-arrow-btn" onClick={() => onChangeMonth(shiftMonth(month, -1))}>
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button className="cal-arrow-btn" onClick={() => onChangeMonth(shiftMonth(month, 1))}>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
          <button className="today-btn" onClick={() => onChangeMonth(currentMonth())}>Today</button>
          <h2 className="cal-month-year">{monthLabel(month)}</h2>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <span className={`mono fw-700 text-[16px] ${monthPL >= 0 ? 'text-green' : 'text-red'}`}>
            {fmtK(monthPL)}
          </span>
          <span className="badge">{tradingDays} day{tradingDays === 1 ? '' : 's'}</span>
          <span className="badge">{trades.length} trade{trades.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="divider my-3"></div>

      <div className="cal-body">
        <div className="cal-grid-area">
          <table className="cal-table">
            <thead>
              <tr>{DOW.map(d => <th key={d} className="cal-dow-th">{d}</th>)}</tr>
            </thead>
            <tbody>
              {weeks.map((week, wIdx) => {
                // The first and last rows are short; pad them out so the grid stays square.
                const lead = wIdx === 0 ? 7 - week.days.length : 0;
                const tail = wIdx === weeks.length - 1 ? 7 - week.days.length : 0;
                return (
                  <tr key={week.num}>
                    {Array.from({ length: lead }, (_, i) => (
                      <td key={`lead-${i}`} className="cal-cell empty"></td>
                    ))}
                    {week.days.map(day => {
                      const cell = byDay.get(day);
                      const classes = ['cal-cell'];
                      if (day === today) classes.push('today-cell');
                      if (cell) {
                        classes.push(Math.abs(cell.pl) < 0.01 ? 'be' : cell.pl > 0 ? 'profit' : 'loss');
                      }
                      const avgRR = cell && cell.rr.length
                        ? (cell.rr.reduce((s, v) => s + v, 0) / cell.rr.length).toFixed(2)
                        : '—';
                      const wr = cell && cell.count ? Math.round((cell.wins / cell.count) * 100) : 0;

                      return (
                        <td key={day} className={classes.join(' ')} onClick={() => openDay(day)}>
                          <div className="cal-day-num">{Number(day.slice(8))}</div>
                          {cell && (
                            <>
                              <div className={`cal-day-pl ${cell.pl >= 0 ? 'pos' : 'neg'}`}>
                                {fmtK(cell.pl)}
                              </div>
                              <div className="cal-day-trades">
                                {cell.count} trade{cell.count === 1 ? '' : 's'}
                              </div>
                              <div className="cal-day-meta">{avgRR}R, {wr}%</div>
                            </>
                          )}
                        </td>
                      );
                    })}
                    {Array.from({ length: tail }, (_, i) => (
                      <td key={`tail-${i}`} className="cal-cell empty"></td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="cal-week-sidebar">
          {weeks.map(week => {
            const wTrades = week.days.reduce((s, d) => s + (byDay.get(d)?.count ?? 0), 0);
            const wPL = week.days.reduce((s, d) => s + (byDay.get(d)?.pl ?? 0), 0);
            const wDays = week.days.filter(d => byDay.has(d)).length;
            return (
              <div className="week-summary-card" key={week.num}>
                <div className="ws-label">Week {week.num}</div>
                <div className={`ws-val ${wPL > 0 ? 'pos' : wPL < 0 ? 'neg' : 'zero'}`}>
                  {fmtC(wPL)}
                </div>
                <div className="ws-days">
                  {wDays} day{wDays === 1 ? '' : 's'}
                  {wTrades > 0 && ` · ${wTrades} trade${wTrades === 1 ? '' : 's'}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashCalendar;
