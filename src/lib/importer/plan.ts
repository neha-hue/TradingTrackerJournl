import { CsvTradeRow, ShotPairing, ShotRead } from './types';
import { Trade } from '../types';

export type PlanStatus = 'ready' | 'already-in-journal' | 'no-screenshot' | 'invalid';

/** One CSV row paired with its screenshot, and whether it will actually be written. */
export interface PlanItem {
  row: CsvTradeRow;
  shot: ShotRead | null;
  status: PlanStatus;
  note: string;
  /** Only 'ready' rows can be selected; the user may still untick one. */
  selected: boolean;
}

export interface PlanOptions {
  /**
   * Whether a trade the CSV lists is imported even when no screenshot could be paired
   * with it. On by default: the CSV is the record of what was traded, and a missing chart
   * is a missing attachment, not a reason to leave the trade out of the journal.
   */
  includeWithoutScreenshot: boolean;
}

/**
 * Fingerprint for "is this trade already in the journal?".
 *
 * Built from the instrument, direction, price levels and P&L rather than the timestamp:
 * dates make a round trip through Postgres as UTC and come back shifted, which would make
 * an already-imported trade look new every time. Two trades sharing all of these to the
 * cent are the same trade.
 */
export function tradeSignature(t: {
  instrument: string;
  direction: string;
  entry: number | string | null;
  sl: number | string | null;
  tp: number | string | null;
  pl: number;
}): string {
  const num = (v: number | string | null) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return n === null || n === undefined || !isFinite(n) ? '' : n.toFixed(5);
  };
  return [
    (t.instrument || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    t.direction,
    num(t.entry),
    num(t.sl),
    num(t.tp),
    isFinite(t.pl) ? t.pl.toFixed(2) : ''
  ].join('|');
}

/** Signatures of what the chosen account already holds. */
export function existingSignatures(trades: Trade[], accountId: string): Set<string> {
  const set = new Set<string>();
  for (const t of trades) {
    if (t.accountId !== accountId) continue;
    set.add(
      tradeSignature({
        instrument: t.instrument,
        direction: t.direction,
        entry: t.entry === '' ? null : t.entry,
        sl: t.sl === '' ? null : t.sl,
        tp: t.tp === '' ? null : t.tp,
        pl: t.pl
      })
    );
  }
  return set;
}

export function buildPlan(
  rows: CsvTradeRow[],
  pairings: ShotPairing[],
  existing: Set<string>,
  options: PlanOptions
): PlanItem[] {
  const shotByRow = new Map<number, ShotRead>();
  for (const p of pairings) {
    if (p.status === 'matched' && p.chosenRowNum !== null) shotByRow.set(p.chosenRowNum, p.shot);
  }

  return rows.map(row => {
    const shot = shotByRow.get(row.rowNum) ?? null;

    if (row.fatal) {
      return { row, shot, status: 'invalid' as const, note: row.issues.join('; '), selected: false };
    }

    if (existing.has(tradeSignature(row.trade))) {
      return {
        row,
        shot,
        status: 'already-in-journal' as const,
        note: 'This account already holds an identical trade',
        selected: false
      };
    }

    if (!shot) {
      return {
        row,
        shot,
        status: 'no-screenshot' as const,
        note: options.includeWithoutScreenshot
          ? 'Importing from the CSV — no chart attached'
          : 'No screenshot matched this trade',
        selected: options.includeWithoutScreenshot
      };
    }

    return { row, shot, status: 'ready' as const, note: `Screenshot: ${shot.name}`, selected: true };
  });
}

export interface ImportSummary {
  screenshotsProcessed: number;
  screenshotsMatched: number;
  screenshotsUnmatched: number;
  screenshotsAmbiguous: number;
  screenshotsDuplicate: number;
  screenshotsNoDate: number;
  screenshotsUnreadable: number;
  csvRows: number;
  tradesReady: number;
  tradesAlreadyPresent: number;
  tradesWithoutScreenshot: number;
  tradesInvalid: number;
}

export function summarise(
  rows: CsvTradeRow[],
  pairings: ShotPairing[],
  plan: PlanItem[]
): ImportSummary {
  const shots = (s: ShotPairing['status']) => pairings.filter(p => p.status === s).length;
  const items = (s: PlanStatus) => plan.filter(p => p.status === s).length;
  return {
    screenshotsProcessed: pairings.length,
    screenshotsMatched: shots('matched'),
    screenshotsUnmatched: shots('unmatched'),
    screenshotsAmbiguous: shots('ambiguous'),
    screenshotsDuplicate: shots('duplicate'),
    screenshotsNoDate: shots('no-date'),
    screenshotsUnreadable: shots('error'),
    csvRows: rows.length,
    tradesReady: items('ready'),
    tradesAlreadyPresent: items('already-in-journal'),
    tradesWithoutScreenshot: items('no-screenshot'),
    tradesInvalid: items('invalid')
  };
}

/* ------------------------------------------------------------------ *
 * Downloadable crosscheck report
 * ------------------------------------------------------------------ */

const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const LABEL: Record<string, string> = {
  matched: 'Matched',
  ambiguous: 'Ambiguous - needs a decision',
  unmatched: 'Unmatched screenshot',
  duplicate: 'Duplicate screenshot',
  'no-date': 'No date read',
  error: 'Unreadable image',
  ready: 'Imported',
  'already-in-journal': 'Skipped - already in journal',
  'no-screenshot': 'No screenshot',
  invalid: 'Skipped - invalid row'
};

export function buildReportCsv(pairings: ShotPairing[], plan: PlanItem[]): string {
  const lines: string[] = ['SCREENSHOTS'];
  lines.push(['File', 'Status', 'Date read', 'Paired with row', 'Detail'].map(cell).join(','));
  for (const p of pairings) {
    lines.push(
      [
        p.shot.name,
        LABEL[p.status] ?? p.status,
        p.overrideDateIso ?? p.shot.dates.map(d => d.iso).join(' | '),
        p.chosenRowNum ?? '',
        p.reason
      ]
        .map(cell)
        .join(',')
    );
  }

  lines.push('', 'TRADES');
  lines.push(
    ['CSV row', 'Source id', 'Date', 'Instrument', 'Direction', 'Entry', 'SL', 'TP', 'P&L', 'Result', 'Status', 'Detail', 'Screenshot']
      .map(cell)
      .join(',')
  );
  for (const item of plan) {
    const t = item.row.trade;
    lines.push(
      [
        item.row.rowNum,
        item.row.sourceId,
        t.date,
        t.instrument,
        t.direction,
        t.entry ?? '',
        t.sl ?? '',
        t.tp ?? '',
        t.pl,
        t.result,
        LABEL[item.status] ?? item.status,
        [item.note, ...item.row.issues].filter(Boolean).join('; '),
        item.shot?.name ?? ''
      ]
        .map(cell)
        .join(',')
    );
  }

  return lines.join('\n');
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
