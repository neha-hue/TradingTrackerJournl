import { Trade } from './types';

/**
 * The numbers behind the overview dashboard.
 *
 * Everything here is derived from closed trades only - the journal has no concept of an
 * open position. A day is the first ten characters of a trade's timestamp, the same key
 * the calendar uses, so a "winning day" here is the same green square there.
 */

export interface DayStat {
  day: string;
  pl: number;
  count: number;
}

/** One entry per day that was traded, oldest first. */
export function dayStats(trades: Trade[]): DayStat[] {
  const byDay = new Map<string, DayStat>();
  for (const t of trades) {
    const day = (t.date || '').slice(0, 10);
    if (!day) continue;
    const held = byDay.get(day) ?? { day, pl: 0, count: 0 };
    held.pl += t.pl || 0;
    held.count++;
    byDay.set(day, held);
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

/** A day within a cent of flat is flat, not a win - floating point noise is not an edge. */
const FLAT = 0.005;

export interface Streak {
  /** The run still going at the end of the record. Positive wins, negative losses. */
  current: number;
  /** Longest winning run anywhere in the record. */
  bestWin: number;
  /** Longest losing run anywhere in the record, as a positive number. */
  worstLoss: number;
}

/**
 * Walks a series of outcomes in order and measures the runs.
 *
 * Flat results (a scratch, a day that closed level) break neither run - they are simply
 * skipped, so two winning days either side of a flat one still read as a streak of two.
 */
function streakOf(outcomes: number[]): Streak {
  let current = 0;
  let bestWin = 0;
  let worstLoss = 0;

  for (const outcome of outcomes) {
    if (outcome === 0) continue;
    if (outcome > 0) current = current > 0 ? current + 1 : 1;
    else current = current < 0 ? current - 1 : -1;

    if (current > bestWin) bestWin = current;
    if (-current > worstLoss) worstLoss = -current;
  }

  return { current, bestWin, worstLoss };
}

export interface Kpis {
  netPL: number;
  totalTrades: number;

  wins: number;
  losses: number;
  breakEven: number;
  /** Share of trades that won, as a percentage. */
  winRate: number;

  grossWin: number;
  grossLoss: number;
  /** Gross win over gross loss. Infinity when nothing was lost and something was won. */
  profitFactor: number;

  tradingDays: number;
  winningDays: number;
  losingDays: number;
  flatDays: number;
  /** Share of traded days that closed green, as a percentage. */
  dayWinRate: number;

  avgWin: number;
  /** Positive number - the size of the average loser. */
  avgLoss: number;
  /** Average winner over average loser. Infinity when nothing was lost. */
  avgWinLossRatio: number;

  largestWin: number;
  largestLoss: number;
  avgDailyPL: number;
  bestDay: DayStat | null;
  worstDay: DayStat | null;

  /** (win rate x average win) - (loss rate x average loss): what one trade is worth. */
  expectancy: number;

  /** Runs at the tail of the record. Positive is a winning run, negative a losing one. */
  dayStreak: Streak;
  tradeStreak: Streak;

  /** Largest peak-to-trough drop of the running total, as a positive number. */
  maxDrawdown: number;
  /** Net profit over max drawdown - how far the account climbs per unit of pain. */
  recoveryFactor: number;

  /**
   * How evenly profit is spread across the winning days, 0 to 1.
   *
   * 1 means every winning day contributed the same; 0 means a single day carried the whole
   * month. Fewer than two winning days is not enough to judge and returns 0.
   */
  consistency: number;

  days: DayStat[];
}

const EMPTY_KPIS: Kpis = {
  netPL: 0, totalTrades: 0,
  wins: 0, losses: 0, breakEven: 0, winRate: 0,
  grossWin: 0, grossLoss: 0, profitFactor: 0,
  tradingDays: 0, winningDays: 0, losingDays: 0, flatDays: 0, dayWinRate: 0,
  avgWin: 0, avgLoss: 0, avgWinLossRatio: 0,
  largestWin: 0, largestLoss: 0, avgDailyPL: 0, bestDay: null, worstDay: null,
  expectancy: 0,
  dayStreak: { current: 0, bestWin: 0, worstLoss: 0 },
  tradeStreak: { current: 0, bestWin: 0, worstLoss: 0 },
  maxDrawdown: 0, recoveryFactor: 0, consistency: 0,
  days: []
};

export function computeKpis(trades: Trade[]): Kpis {
  if (trades.length === 0) return { ...EMPTY_KPIS };

  const pls = trades.map(t => t.pl || 0);
  const netPL = pls.reduce((s, v) => s + v, 0);

  // Result is taken from the recorded outcome rather than from the sign of P&L, so a
  // deliberate break-even scratch is not counted as a loss because of commission.
  const wins = trades.filter(t => t.result === 'Win');
  const losses = trades.filter(t => t.result === 'Loss');
  const breakEven = trades.filter(t => t.result === 'Break Even');

  const grossWin = wins.reduce((s, t) => s + (t.pl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pl || 0), 0));

  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;

  const days = dayStats(trades);
  const winningDays = days.filter(d => d.pl > FLAT);
  const losingDays = days.filter(d => d.pl < -FLAT);
  const flatDays = days.length - winningDays.length - losingDays.length;

  // Drawdown and streaks walk the trades in time order, not in the order they arrived.
  const inOrder = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of inOrder) {
    running += t.pl || 0;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const tradeStreak = streakOf(
    inOrder.map(t => (t.result === 'Win' ? 1 : t.result === 'Loss' ? -1 : 0))
  );
  const dayStreak = streakOf(days.map(d => (d.pl > FLAT ? 1 : d.pl < -FLAT ? -1 : 0)));

  const winDayTotal = winningDays.reduce((s, d) => s + d.pl, 0);
  const bestWinDay = winningDays.reduce((a, b) => (b.pl > a.pl ? b : a), winningDays[0]);
  let consistency = 0;
  if (winningDays.length >= 2 && winDayTotal > 0) {
    // Share of the winning total taken by the single best day, rescaled so that a perfectly
    // even spread lands on 1 whatever the number of days.
    const share = bestWinDay.pl / winDayTotal;
    const even = 1 / winningDays.length;
    consistency = Math.max(0, Math.min(1, 1 - (share - even) / (1 - even)));
  }

  return {
    netPL,
    totalTrades: trades.length,

    wins: wins.length,
    losses: losses.length,
    breakEven: breakEven.length,
    winRate: (wins.length / trades.length) * 100,

    grossWin,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,

    tradingDays: days.length,
    winningDays: winningDays.length,
    losingDays: losingDays.length,
    flatDays,
    dayWinRate: days.length ? (winningDays.length / days.length) * 100 : 0,

    avgWin,
    avgLoss,
    avgWinLossRatio: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,

    largestWin: Math.max(0, ...pls),
    largestLoss: Math.min(0, ...pls),
    avgDailyPL: days.length ? netPL / days.length : 0,
    bestDay: days.length ? days.reduce((a, b) => (b.pl > a.pl ? b : a)) : null,
    worstDay: days.length ? days.reduce((a, b) => (b.pl < a.pl ? b : a)) : null,

    // Break-evens sit in the denominator: they are trades taken, and pretending otherwise
    // would flatter the number.
    expectancy:
      (wins.length / trades.length) * avgWin - (losses.length / trades.length) * avgLoss,

    dayStreak,
    tradeStreak,

    maxDrawdown,
    recoveryFactor: maxDrawdown > 0 ? netPL / maxDrawdown : netPL > 0 ? Infinity : 0,

    consistency,
    days
  };
}

/* ------------------------------------------------------------------ *
 * Overall score
 * ------------------------------------------------------------------ */

export interface ScorePart {
  key: string;
  label: string;
  /** 0 to 100. */
  value: number;
  /** The underlying figure, already formatted. */
  detail: string;
}

export interface Score {
  /** 0 to 100 - the mean of the parts below. */
  overall: number;
  parts: ScorePart[];
  /** False when there is not enough history for the number to mean anything. */
  meaningful: boolean;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Maps a metric onto 0-100, treating `good` as full marks. Infinity scores full marks. */
const scale = (value: number, good: number): number =>
  !isFinite(value) ? 100 : clamp((value / good) * 100);

const fmt = (v: number, digits = 2) => (isFinite(v) ? v.toFixed(digits) : '∞');

/**
 * A single 0-100 read on the account, averaged from six measures.
 *
 * The targets below are ours, not a standard: profit factor 2, an average winner twice the
 * average loser, and net profit three times the worst drawdown are all "full marks". They
 * are a rough guide for spotting which leg is dragging, not a grade.
 */
export function computeScore(k: Kpis): Score {
  const parts: ScorePart[] = [
    {
      key: 'winRate',
      label: 'Win %',
      value: clamp(k.winRate),
      detail: `${k.winRate.toFixed(1)}%`
    },
    {
      key: 'profitFactor',
      label: 'Profit factor',
      value: scale(k.profitFactor, 2),
      detail: fmt(k.profitFactor)
    },
    {
      key: 'winLoss',
      label: 'Avg win/loss',
      value: scale(k.avgWinLossRatio, 2),
      detail: fmt(k.avgWinLossRatio)
    },
    {
      key: 'dayWin',
      label: 'Day win %',
      value: clamp(k.dayWinRate),
      detail: `${k.dayWinRate.toFixed(1)}%`
    },
    {
      key: 'recovery',
      label: 'Recovery',
      value: scale(k.recoveryFactor, 3),
      detail: fmt(k.recoveryFactor)
    },
    {
      key: 'consistency',
      label: 'Consistency',
      value: clamp(k.consistency * 100),
      detail: `${(k.consistency * 100).toFixed(0)}%`
    }
  ];

  return {
    overall: parts.reduce((s, p) => s + p.value, 0) / parts.length,
    parts,
    // Under a handful of trades every one of these swings wildly on a single result.
    meaningful: k.totalTrades >= 5 && k.tradingDays >= 2
  };
}
