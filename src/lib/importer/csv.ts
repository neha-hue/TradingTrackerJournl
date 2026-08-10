import { CsvParseResult, CsvTradeRow, TradeDraft } from './types';

/* ------------------------------------------------------------------ *
 * Raw text -> cells
 * ------------------------------------------------------------------ */

const DELIMITERS = [',', ';', '\t'];

function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  let best = ',';
  let bestCount = 0;
  for (const d of DELIMITERS) {
    let count = 0;
    let inQuotes = false;
    for (const ch of first) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** RFC 4180 parse: quoted cells, escaped quotes, newlines inside cells. */
export function parseCsvText(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim()));
}

/* ------------------------------------------------------------------ *
 * Column lookup
 * ------------------------------------------------------------------ */

const normHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Columns this importer reads, each with the header spellings it accepts. Aliases are
 * tried in order, so the preferred one wins over a near-miss sitting earlier in the file:
 * that is what makes `rPnL` (realised) beat the `uPnL` immediately to its left, which is
 * always zero on a closed trade.
 */
const COLUMNS: [string, string[]][] = [
  ['sourceId', ['id', 'tradeid']],
  ['dateStart', ['datestart', 'date', 'datetime', 'opentime', 'entrytime', 'opened']],
  ['dateEnd', ['dateend', 'closetime', 'exittime', 'closed']],
  ['pair', ['pair', 'symbol', 'instrument', 'ticker']],
  ['side', ['side', 'direction', 'type', 'buysell']],
  ['entryPrice', ['entryprice', 'entry', 'openprice', 'avgentryprice']],
  ['initialSL', ['initialsl', 'sl', 'stoploss', 'stop']],
  ['idealTP', ['idealtp', 'tp', 'takeprofit', 'target']],
  ['maxTP', ['maxtp', 'maxtakeprofit']],
  ['avgClosePrice', ['avgcloseprice', 'closeprice', 'exitprice', 'avgexitprice']],
  ['amount', ['amount', 'lots', 'volume', 'size', 'quantity']],
  ['rPnL', ['rpnl', 'realizedpnl', 'realisedpnl', 'pnl', 'pl', 'profit']],
  ['maxRiskReward', ['maxriskreward', 'maxrr']],
  ['avgRiskReward', ['avgriskreward', 'avgrr', 'riskreward', 'rr']],
  ['tags', ['tags', 'tag', 'setup', 'strategy']]
];

function resolveColumns(headers: string[]): Record<string, number> {
  const norm = headers.map(normHeader);
  const used = new Set<number>();
  const map: Record<string, number> = {};

  for (const [field, aliases] of COLUMNS) {
    for (const alias of aliases) {
      const idx = norm.findIndex((h, i) => !used.has(i) && h === alias);
      if (idx >= 0) {
        map[field] = idx;
        used.add(idx);
        break;
      }
    }
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * Values
 * ------------------------------------------------------------------ */

/** Reads a number from a cell, coping with thousands separators and (1.23) negatives. */
export function parseNum(value: string): number | null {
  if (!value) return null;
  let s = value.trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.includes('-');
  s = s.replace(/[()]/g, '').replace(/[^0-9.,]/g, '');
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const after = s.length - lastComma - 1;
    const count = (s.match(/,/g) || []).length;
    s = count > 1 || after === 3 ? s.replace(/,/g, '') : s.replace(',', '.');
  }

  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Parses the export's timestamps, e.g. "2026/04/02 10:04:05".
 *
 * The result is a local-naive 'YYYY-MM-DDTHH:mm' string, matching what the trade form
 * writes, and the epoch ms is taken in local time as well. Both the CSV clock and the
 * chart's time-axis badge are wall-clock readings in the same zone, so comparing them
 * directly is correct - converting either to UTC would introduce an offset that is not
 * really there.
 */
export function parseCsvDate(value: string): { iso: string; ms: number } | null {
  const s = (value || '').trim();
  if (!s) return null;

  const m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})[T ]?(\d{1,2})?:?(\d{2})?:?(\d{2})?/);
  if (!m) {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return {
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      ms: d.getTime()
    };
  }

  const [, y, mo, d, h = '0', mi = '0'] = m;
  const year = +y;
  const month = +mo;
  const day = +d;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dt = new Date(year, month - 1, day, +h, +mi, 0, 0);
  return {
    iso: `${year}-${pad(month)}-${pad(day)}T${pad(+h)}:${pad(+mi)}`,
    ms: dt.getTime()
  };
}

/** "OANDA:XAUUSD" -> "XAUUSD". Charting platforms prefix the exchange; the journal does not. */
export function stripExchange(pair: string): string {
  const s = (pair || '').trim().toUpperCase();
  const colon = s.lastIndexOf(':');
  return (colon >= 0 ? s.slice(colon + 1) : s).trim();
}

function normSide(value: string): 'Long' | 'Short' | null {
  const s = (value || '').toLowerCase().trim();
  if (s.includes('sell') || s.includes('short')) return 'Short';
  if (s.includes('buy') || s.includes('long')) return 'Long';
  return null;
}

/* ------------------------------------------------------------------ *
 * Top level
 * ------------------------------------------------------------------ */

export interface CsvParseOptions {
  /** Applied to every imported trade; chosen in the UI. */
  session: string;
  setup: string;
}

export function parseTradesCsv(text: string, options: CsvParseOptions): CsvParseResult {
  const grid = parseCsvText(text);
  if (grid.length === 0) {
    return { rows: [], headers: [], mapping: {}, errors: ['The CSV file is empty.'] };
  }

  const headers = grid[0].map(h => h.trim());
  const columns = resolveColumns(headers);
  const errors: string[] = [];

  for (const required of ['dateStart', 'pair', 'side', 'rPnL']) {
    if (!(required in columns)) {
      errors.push(`No column found for "${required}". Is this the right export?`);
    }
  }

  const cell = (row: string[], field: string) => {
    const i = columns[field];
    return i === undefined ? '' : (row[i] ?? '').trim();
  };

  const rows: CsvTradeRow[] = grid.slice(1).map((row, i) => {
    const rowNum = i + 2;
    const issues: string[] = [];

    const start = parseCsvDate(cell(row, 'dateStart'));
    if (!start) issues.push(`Unreadable dateStart "${cell(row, 'dateStart')}"`);

    const instrument = stripExchange(cell(row, 'pair'));
    if (!instrument) issues.push('No instrument');

    const direction = normSide(cell(row, 'side'));
    if (!direction) issues.push(`Unrecognised side "${cell(row, 'side')}"`);

    const pl = parseNum(cell(row, 'rPnL'));
    if (pl === null) issues.push('No realised P&L');

    // idealTP is the planned target; maxTP is only filled in on trades that ran to one,
    // so it stands in when the plan was not recorded.
    const idealTp = parseNum(cell(row, 'idealTP'));
    const maxTp = parseNum(cell(row, 'maxTP'));

    const entryPrice = parseNum(cell(row, 'entryPrice'));
    const plValue = pl ?? 0;

    const trade: TradeDraft = {
      date: start?.iso ?? '',
      instrument,
      direction: direction ?? 'Long',
      session: options.session,
      entry: entryPrice,
      exit_price: parseNum(cell(row, 'avgClosePrice')),
      sl: parseNum(cell(row, 'initialSL')),
      tp: idealTp ?? maxTp,
      lots: parseNum(cell(row, 'amount')),
      pl: plValue,
      risk: null,
      rr: parseNum(cell(row, 'maxRiskReward')),
      setup: cell(row, 'tags') || options.setup,
      result: plValue > 0 ? 'Win' : plValue < 0 ? 'Loss' : 'Break Even'
    };

    // date, instrument, direction, pl and result are all NOT NULL in the schema.
    const fatal = !start || !instrument || !direction || pl === null;
    if (fatal) issues.push('Cannot be imported - a required field is missing');

    return {
      rowNum,
      sourceId: cell(row, 'sourceId'),
      trade,
      startMs: start?.ms ?? 0,
      entryPrice,
      issues,
      fatal
    };
  });

  const mapping: Record<string, string> = {};
  for (const [field, idx] of Object.entries(columns)) mapping[field] = headers[idx];

  return { rows, headers, mapping, errors };
}
