import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmtC, fmtK } from '../../lib/utils';
import { Trade } from '../../lib/types';
import Modal from '../shared/Modal';

interface CalendarProps {
  onSelectTrade: (id: string) => void;
}

export const Calendar: React.FC<CalendarProps> = ({ onSelectTrade }) => {
  const { trades, currentAccId } = useApp();
  const [calDate, setCalDate] = useState<Date>(new Date());
  const [selectedDayTrades, setSelectedDayTrades] = useState<{ date: string; trades: Trade[] } | null>(null);

  const activeTrades = trades.filter((t) => (t.accountId || 'acc-live') === currentAccId);

  const year = calDate.getFullYear();
  const mon = calDate.getMonth();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Build day->data map
  const dayMap: Record<string, { pl: number; count: number; wins: number; rr: number[] }> = {};
  activeTrades.forEach((t) => {
    const key = t.date ? t.date.slice(0, 10) : null;
    if (!key) return;
    if (!dayMap[key]) {
      dayMap[key] = { pl: 0, count: 0, wins: 0, rr: [] };
    }
    dayMap[key].pl += t.pl || 0;
    dayMap[key].count++;
    if (t.result === 'Win') dayMap[key].wins++;
    if (t.rr) {
      const parsedRR = parseFloat(t.rr);
      if (!isNaN(parsedRR)) dayMap[key].rr.push(parsedRR);
    }
  });

  // Calculate monthly stats
  const monthTrades = activeTrades.filter((t) => {
    if (!t.date) return false;
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === mon;
  });
  const monthlyPL = monthTrades.reduce((sum, t) => sum + (t.pl || 0), 0);
  const tradingDaysCount = new Set(
    monthTrades.map((t) => t.date ? t.date.slice(0, 10) : null).filter(Boolean)
  ).size;

  // Build calendar grid days
  const firstDay = new Date(year, mon, 1).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const today = new Date();

  // Create calendar cells array
  const cells: { type: 'empty' | 'day'; dayNum?: number; dateStr?: string }[] = [];

  // Empty cells before first day of month
  for (let e = 0; e < firstDay; e++) {
    cells.push({ type: 'empty' });
  }

  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ type: 'day', dayNum: d, dateStr });
  }

  // Empty cells after end of month to fill grid row
  const totalCells = cells.length;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let r = 0; r < remaining; r++) {
    cells.push({ type: 'empty' });
  }

  // Group cells into weeks
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // Calculate weekly stats
  const weekData = weeks.map((week) => {
    let pl = 0;
    let days = 0;
    week.forEach((cell) => {
      if (cell.type === 'day' && cell.dateStr && dayMap[cell.dateStr]) {
        pl += dayMap[cell.dateStr].pl;
        days++;
      }
    });
    return { pl, days };
  });

  const handleCellClick = (dateStr: string) => {
    const dayTrades = activeTrades.filter(t => t.date && t.date.startsWith(dateStr));
    if (dayTrades.length === 0) return;
    setSelectedDayTrades({ date: dateStr, trades: dayTrades });
  };

  const handleTradeClick = (tradeId: string) => {
    setSelectedDayTrades(null);
    onSelectTrade(tradeId);
  };

  const handleMonthChange = (delta: number) => {
    const newDate = new Date(calDate);
    newDate.setMonth(calDate.getMonth() + delta);
    setCalDate(newDate);
  };

  const handleGoToday = () => {
    setCalDate(new Date());
  };

  const totalDayPL = selectedDayTrades
    ? selectedDayTrades.trades.reduce((sum, t) => sum + (t.pl || 0), 0)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Calendar Navigation & Stats Header */}
      <div className="card">
        <div className="cal-nav">
          <div className="cal-nav-left">
            <div className="cal-nav-arrows">
              <button className="cal-arrow-btn" onClick={() => handleMonthChange(-1)}>
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <button className="cal-arrow-btn" onClick={() => handleMonthChange(1)}>
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
            <button className="today-btn" onClick={handleGoToday}>Today</button>
            <h2 className="cal-month-year" id="calMonthYear">
              {monthNames[mon]} {year}
            </h2>
          </div>
          <div className="flex gap-4 flex-wrap" id="calMonthStats">
            <div className="cal-stat-item">
              <span className="text-muted text-[12px]">Monthly P&L: </span>
              <strong className={monthlyPL >= 0 ? 'text-green' : 'text-red'}>{fmtC(monthlyPL)}</strong>
            </div>
            <div className="cal-stat-item">
              <span className="text-muted text-[12px]">Trading Days: </span>
              <strong>{tradingDaysCount}</strong>
            </div>
            <div className="cal-stat-item">
              <span className="text-muted text-[12px]">Trades: </span>
              <strong>{monthTrades.length}</strong>
            </div>
          </div>
        </div>

        <div className="divider my-3"></div>

        {/* Calendar Body */}
        <div className="cal-body">
          {/* Main Grid */}
          <div className="cal-grid-area">
            <table className="cal-table" id="calTable">
              <thead>
                <tr>
                  <th className="cal-dow-th">Sun</th>
                  <th className="cal-dow-th">Mon</th>
                  <th className="cal-dow-th">Tue</th>
                  <th className="cal-dow-th">Wed</th>
                  <th className="cal-dow-th">Thu</th>
                  <th className="cal-dow-th">Fri</th>
                  <th className="cal-dow-th">Sat</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wIdx) => (
                  <tr key={wIdx}>
                    {week.map((cell, cIdx) => {
                      if (cell.type === 'empty') {
                        return <td key={cIdx} className="cal-cell empty"></td>;
                      }

                      const dStr = cell.dateStr!;
                      const dData = dayMap[dStr];
                      const isCellToday = today.getFullYear() === year &&
                        today.getMonth() === mon &&
                        today.getDate() === cell.dayNum;

                      let cellClass = 'cal-cell';
                      if (isCellToday) cellClass += ' today-cell';

                      if (dData) {
                        if (Math.abs(dData.pl) < 0.01) {
                          cellClass += ' be';
                        } else if (dData.pl > 0) {
                          cellClass += ' profit';
                        } else {
                          cellClass += ' loss';
                        }
                      }

                      const avgRR = dData && dData.rr.length
                        ? (dData.rr.reduce((s, v) => s + v, 0) / dData.rr.length).toFixed(2)
                        : '—';
                      const wr = dData && dData.count ? Math.round((dData.wins / dData.count) * 100) : 0;

                      return (
                        <td
                          key={cIdx}
                          className={cellClass}
                          onClick={() => handleCellClick(dStr)}
                        >
                          <div className="cal-day-num">{cell.dayNum}</div>
                          {dData && (
                            <>
                              <div className={`cal-day-pl ${dData.pl >= 0 ? 'pos' : 'neg'}`}>
                                {fmtK(dData.pl)}
                              </div>
                              <div className="cal-day-trades">{dData.count} trade{dData.count !== 1 ? 's' : ''}</div>
                              <div className="cal-day-meta">{avgRR}R, {wr}%</div>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Weekly Summary Sidebar */}
          <div className="cal-week-sidebar" id="calWeekSidebar">
            {weekData.map((w, idx) => (
              <div className="week-summary-card" key={idx}>
                <div className="ws-label">Week {idx + 1}</div>
                <div className={`ws-val ${w.pl > 0 ? 'pos' : w.pl < 0 ? 'neg' : 'zero'}`}>{fmtC(w.pl)}</div>
                <div className="ws-days">{w.days} trading day{w.days !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDayTrades && (
        <Modal
          id="dayDetailModal"
          isOpen={!!selectedDayTrades}
          onClose={() => setSelectedDayTrades(null)}
          title={`Trades on ${selectedDayTrades.date} — ${fmtC(totalDayPL)}`}
          size="sm"
        >
          <div className="flex flex-col gap-2">
            {selectedDayTrades.trades.map((t) => (
              <div
                key={t.id}
                className="bg-surface-input border border-border rounded-[10px] p-3 cursor-pointer"
                onClick={() => handleTradeClick(t.id)}
              >
                <div className="flex-center between">
                  <div>
                    <strong>{t.instrument}</strong>{' '}
                    <span className={`badge ${t.direction === 'Long' ? 'badge-green' : 'badge-red'}`}>
                      {t.direction}
                    </span>
                  </div>
                  <div className={`mono fw-700 ${t.pl >= 0 ? 'text-green' : 'text-red'}`}>
                    {fmtC(t.pl)}
                  </div>
                </div>
                <div className="text-muted text-[11.5px] mt-1">
                  {t.setup} · RR: {t.rr || 'N/A'} ·{' '}
                  <span className={`badge ${t.result === 'Win' ? 'badge-green' : t.result === 'Loss' ? 'badge-red' : 'badge-yellow'}`}>
                    {t.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};
export default Calendar;
