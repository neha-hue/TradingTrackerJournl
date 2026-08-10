import { Candidate, CsvTradeRow, MatchOptions, ShotPairing, ShotRead } from './types';

/** A price counts as seen when it lands within a cent - grid lines sit points apart. */
function priceSeen(target: number | null, prices: number[]): boolean {
  if (target === null || prices.length === 0) return false;
  const tol = Math.max(0.01, Math.abs(target) * 2e-6);
  return prices.some(p => Math.abs(p - target) <= tol);
}

/** Best candidate first: a price-confirmed match outranks a merely closer one. */
function rankCandidates(a: Candidate, b: Candidate): number {
  if (a.priceConfirmed !== b.priceConfirmed) return a.priceConfirmed ? -1 : 1;
  return a.deltaMin - b.deltaMin;
}

function buildCandidates(
  shot: ShotRead,
  rows: CsvTradeRow[],
  options: MatchOptions,
  overrideMs?: number
): Candidate[] {
  const stamps =
    overrideMs !== undefined
      ? [{ ms: overrideMs, iso: new Date(overrideMs).toISOString().slice(0, 16) }]
      : shot.dates;

  // A screenshot can carry two badges (entry and exit). Each is tried, and the row keeps
  // whichever badge lands closest to it.
  const bestByRow = new Map<number, Candidate>();

  for (const stamp of stamps) {
    for (const row of rows) {
      if (row.fatal) continue;
      const deltaMin = Math.abs(stamp.ms - row.startMs) / 60000;
      if (deltaMin > options.toleranceMin) continue;

      const candidate: Candidate = {
        rowNum: row.rowNum,
        deltaMin,
        dateIso: stamp.iso,
        priceConfirmed: options.usePriceConfirmation && priceSeen(row.entryPrice, shot.prices)
      };
      const held = bestByRow.get(row.rowNum);
      if (!held || rankCandidates(candidate, held) < 0) bestByRow.set(row.rowNum, candidate);
    }
  }

  return Array.from(bestByRow.values()).sort(rankCandidates);
}

const describe = (c: Candidate) =>
  `${c.deltaMin.toFixed(1)} min from dateStart${c.priceConfirmed ? ', entry price confirmed on chart' : ''}`;

/**
 * Pairs each screenshot with a CSV row on date and time.
 *
 * The order of business:
 *   1. byte-identical screenshots collapse, keeping the first;
 *   2. every remaining screenshot is scored against every importable row;
 *   3. no candidate leaves it unmatched, and two candidates too close to separate leave
 *      it ambiguous for the user to settle;
 *   4. where several screenshots claim one trade, the best reading keeps it.
 *
 * Nothing is attached on a guess: steps 3 and 4 push doubt into the review list.
 */
export function pairScreenshots(
  shots: ShotRead[],
  rows: CsvTradeRow[],
  options: MatchOptions
): ShotPairing[] {
  const firstByHash = new Map<string, string>();
  const pairings: ShotPairing[] = [];

  for (const shot of shots) {
    if (shot.error) {
      pairings.push({ shot, status: 'error', candidates: [], chosenRowNum: null, reason: shot.error });
      continue;
    }

    const seenAs = firstByHash.get(shot.hash);
    if (seenAs) {
      pairings.push({
        shot,
        status: 'duplicate',
        candidates: [],
        chosenRowNum: null,
        reason: `Identical file to "${seenAs}"`
      });
      continue;
    }
    firstByHash.set(shot.hash, shot.name);

    if (shot.dates.length === 0) {
      pairings.push({
        shot,
        status: 'no-date',
        candidates: [],
        chosenRowNum: null,
        // Whether the blue badge was on screen at all separates "not a chart" from "a
        // chart the reader could not manage", which need different things from the user.
        reason: shot.badgeSeen
          ? 'The date badge was found but could not be read - type the date in to match this one'
          : 'No date badge on this image - it looks like a stats or session page rather than a chart'
      });
      continue;
    }

    const candidates = buildCandidates(shot, rows, options);

    if (candidates.length === 0) {
      pairings.push({
        shot,
        status: 'unmatched',
        candidates: [],
        chosenRowNum: null,
        reason: `No trade starts within ${options.toleranceMin} min of ${shot.dates[0].iso.replace('T', ' ')}`
      });
      continue;
    }

    // More than one trade inside the window means the timestamp alone cannot settle it,
    // and a smaller delta is not evidence - the badge sits wherever the crosshair was
    // left, so being nearer by a few minutes is luck. The one exception is the price
    // axis: if exactly one of the candidates has its entry price drawn on this chart,
    // that is real evidence and the pairing is safe to make. Everything else is a
    // question for the user rather than a guess.
    const confirmed = candidates.filter(c => c.priceConfirmed);
    const decided =
      candidates.length === 1 ? candidates[0] : confirmed.length === 1 ? confirmed[0] : null;

    if (!decided) {
      pairings.push({
        shot,
        status: 'ambiguous',
        candidates,
        chosenRowNum: null,
        reason: `${candidates.length} trades start within ${options.toleranceMin} min of ${shot.dates[0].iso.replace('T', ' ')} - pick one or skip it`
      });
      continue;
    }

    pairings.push({
      shot,
      status: 'matched',
      candidates,
      chosenRowNum: decided.rowNum,
      reason: describe(decided)
    });
  }

  return resolveContention(pairings);
}

/**
 * Two captures of the same trade are not byte-identical, so they survive the hash check
 * and both land on one row. The better reading keeps it; the other is reported rather
 * than quietly attached as a second image.
 */
function resolveContention(pairings: ShotPairing[]): ShotPairing[] {
  const bestByRow = new Map<number, ShotPairing>();

  const better = (a: ShotPairing, b: ShotPairing) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const ca = a.candidates[0];
    const cb = b.candidates[0];
    if (!ca || !cb) return ca ? -1 : 1;
    return rankCandidates(ca, cb);
  };

  for (const p of pairings) {
    if (p.status !== 'matched' || p.chosenRowNum === null) continue;
    const held = bestByRow.get(p.chosenRowNum);
    if (!held || better(p, held) < 0) bestByRow.set(p.chosenRowNum, p);
  }

  return pairings.map(p => {
    if (p.status !== 'matched' || p.chosenRowNum === null) return p;
    const winner = bestByRow.get(p.chosenRowNum);
    if (winner === p) return p;
    return {
      ...p,
      status: 'duplicate' as const,
      chosenRowNum: null,
      reason: `"${winner?.shot.name}" matches the same trade more closely`
    };
  });
}

/** Applies a manual pairing: a row number to attach, or null to skip the screenshot. */
export function reassign(pairings: ShotPairing[], shotId: string, rowNum: number | null): ShotPairing[] {
  const updated = pairings.map(p => {
    if (p.shot.id !== shotId) return p;
    if (rowNum === null) {
      return { ...p, status: 'unmatched' as const, chosenRowNum: null, pinned: false, reason: 'Skipped by you' };
    }
    return { ...p, status: 'matched' as const, chosenRowNum: rowNum, pinned: true, reason: 'Paired by you' };
  });

  // Anything previously bumped off gets another chance; the resolver decides again.
  const revived = updated.map(p =>
    p.status === 'duplicate' && !p.pinned && p.candidates.length > 0
      ? { ...p, status: 'matched' as const, chosenRowNum: p.candidates[0].rowNum }
      : p
  );

  return resolveContention(revived);
}

/**
 * Re-runs matching for one screenshot against a date the user typed in, for when OCR
 * misread the badge or could not find it at all.
 */
export function applyDateOverride(
  pairings: ShotPairing[],
  rows: CsvTradeRow[],
  options: MatchOptions,
  shotId: string,
  iso: string
): ShotPairing[] {
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) return pairings;

  const updated = pairings.map(p => {
    if (p.shot.id !== shotId) return p;

    const candidates = buildCandidates(p.shot, rows, options, ms);
    if (candidates.length === 0) {
      return {
        ...p,
        status: 'unmatched' as const,
        candidates: [],
        chosenRowNum: null,
        overrideDateIso: iso,
        pinned: false,
        reason: `No trade starts within ${options.toleranceMin} min of ${iso.replace('T', ' ')}`
      };
    }

    return {
      ...p,
      status: 'matched' as const,
      candidates,
      chosenRowNum: candidates[0].rowNum,
      overrideDateIso: iso,
      pinned: true,
      reason: `Date corrected by you - ${describe(candidates[0])}`
    };
  });

  return resolveContention(updated);
}
