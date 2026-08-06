import { Trade, TradeStats } from './types';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function fmtC(n: number): string {
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);
}

export function fmtK(n: number): string {
  return (n >= 0 ? '+$' : '-$') + (Math.abs(n) >= 1000 ? (Math.abs(n) / 1000).toFixed(1) + 'K' : Math.abs(n).toFixed(2));
}

export function cc(isDarkTheme: boolean) {
  return {
    grid: isDarkTheme ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    text: isDarkTheme ? '#8892ab' : '#4a5580',
    tBg: isDarkTheme ? '#1a1e30' : '#ffffff',
    tBorder: isDarkTheme ? '#252a40' : '#d4d9ee'
  };
}

export function getWeekNum(d: string | Date): number {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + 3 - (dt.getDay() + 6) % 7);
  const w1 = new Date(dt.getFullYear(), 0, 4);
  return 1 + Math.round(((dt.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
}

export function getStats(arr: Trade[]): TradeStats {
  if (!arr.length) {
    return {
      totalPL: 0,
      wins: 0,
      losses: 0,
      be: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      expectancy: 0,
      profitFactor: 0,
      maxDD: 0,
      total: 0,
      grossWin: 0,
      grossLoss: 0
    };
  }

  const wins = arr.filter(t => t.result === 'Win');
  const losses = arr.filter(t => t.result === 'Loss');
  const be = arr.filter(t => t.result === 'Break Even');

  const totalPL = arr.reduce((s, t) => s + (t.pl || 0), 0);
  const grossWin = wins.reduce((s, t) => s + (t.pl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pl || 0), 0));

  const winRate = arr.length ? (wins.length / arr.length) * 100 : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = (winRate / 100) * avgWin - ((1 - winRate / 100) * avgLoss);
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);

  let peak = 0;
  let maxDD = 0;
  let running = 0;
  const sorted = [...arr].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (const t of sorted) {
    running += t.pl || 0;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    totalPL,
    wins: wins.length,
    losses: losses.length,
    be: be.length,
    winRate,
    avgWin,
    avgLoss,
    expectancy,
    profitFactor,
    maxDD,
    total: arr.length,
    grossWin,
    grossLoss
  };
}
