import { Trade } from './types';

/**
 * Month helpers shared by the dashboard.
 *
 * A month is a 'YYYY-MM' string matched against the first seven characters of a trade's
 * stored timestamp - the same key the calendar and the monthly report already use, so all
 * three agree on which month a trade belongs to whatever the viewer's timezone.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const pad = (n: number) => String(n).padStart(2, '0');

export const monthKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const currentMonth = (): string => monthKey(new Date());

/** Month arithmetic via the Date constructor, which rolls the year over for us. */
export const shiftMonth = (key: string, n: number): string => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};

export const monthLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1] ?? '?'} ${y}`;
};

/** Trades that fall in the given month, in the order they were handed over. */
export const tradesInMonth = (trades: Trade[], key: string): Trade[] =>
  trades.filter(t => t.date && t.date.startsWith(key));

/**
 * The month the dashboard should open on: the most recent one that was actually traded,
 * falling back to the current month. Opening on an empty month when the journal is being
 * caught up on past data would just look broken.
 */
export function latestTradedMonth(trades: Trade[]): string {
  let latest = '';
  for (const t of trades) {
    const key = (t.date || '').slice(0, 7);
    if (key > latest) latest = key;
  }
  return latest || currentMonth();
}

/** Every day of the month as 'YYYY-MM-DD', in order. */
export function daysOfMonth(key: string): string[] {
  const [y, m] = key.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${key}-${pad(i + 1)}`);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type BreakdownMode = 'week' | 'day' | 'month';

/** One column of the dashboard's breakdown chart. */
export interface Bar {
  /** Days this bar covers, so a click can pull the right trades back out. */
  days: string[];
  label: string;
  sub: string;
  /** Set on month bars only - the month this bar stands for. */
  monthKey?: string;
  pl: number;
  count: number;
  wins: number;
}

/**
 * Groups trades into the bars for one breakdown view.
 *
 * 'week' and 'day' cover the given month and expect trades already narrowed to it;
 * 'month' covers the twelve months of that month's year and expects the whole account,
 * since it deliberately reaches outside the month being shown.
 */
export function buildBars(month: string, mode: BreakdownMode, trades: Trade[]): Bar[] {
  const byDay = new Map<string, { pl: number; count: number; wins: number }>();
  for (const t of trades) {
    const day = (t.date || '').slice(0, 10);
    if (!day) continue;
    const held = byDay.get(day) ?? { pl: 0, count: 0, wins: 0 };
    held.pl += t.pl || 0;
    held.count++;
    if (t.result === 'Win') held.wins++;
    byDay.set(day, held);
  }

  const totals = (days: string[]) =>
    days.reduce(
      (acc, d) => {
        const held = byDay.get(d);
        return held
          ? { pl: acc.pl + held.pl, count: acc.count + held.count, wins: acc.wins + held.wins }
          : acc;
      },
      { pl: 0, count: 0, wins: 0 }
    );

  if (mode === 'month') {
    // Every month of the year, so one that was not traded reads as a gap rather than
    // quietly closing ranks.
    const year = month.slice(0, 4);
    return MONTH_NAMES.map((name, i) => {
      const key = `${year}-${pad(i + 1)}`;
      const days = daysOfMonth(key);
      return { days, monthKey: key, label: name.slice(0, 3), sub: year, ...totals(days) };
    });
  }

  if (mode === 'day') {
    return daysOfMonth(month).map(day => {
      const [y, m, d] = day.split('-').map(Number);
      return {
        days: [day],
        label: `${d}`,
        sub: DAY_NAMES[new Date(y, m - 1, d).getDay()],
        ...totals([day])
      };
    });
  }

  return weeksOfMonth(month).map(week => {
    const first = Number(week.days[0].slice(8));
    const last = Number(week.days[week.days.length - 1].slice(8));
    return {
      days: week.days,
      label: `Week ${week.num}`,
      sub: `${first}–${last}`,
      ...totals(week.days)
    };
  });
}

export interface MonthWeek {
  /** 1-based, matching the calendar page's weekly sidebar. */
  num: number;
  days: string[];
}

/**
 * The month split into calendar weeks. Weeks are cut on Sunday so the grouping lines up
 * with the calendar page, whose grid starts each row on a Sunday - the two views should
 * never disagree about which week a day sits in.
 */
export function weeksOfMonth(key: string): MonthWeek[] {
  const weeks: MonthWeek[] = [];
  let current: string[] = [];

  for (const day of daysOfMonth(key)) {
    const [y, m, d] = day.split('-').map(Number);
    // A Sunday opens a new week, except for the first day, which opens the first one.
    if (new Date(y, m - 1, d).getDay() === 0 && current.length > 0) {
      weeks.push({ num: weeks.length + 1, days: current });
      current = [];
    }
    current.push(day);
  }
  if (current.length > 0) weeks.push({ num: weeks.length + 1, days: current });

  return weeks;
}
