import { createScheduler, createWorker, PSM } from 'tesseract.js';
import { ReadDate, ShotRead } from './types';

type Scheduler = Awaited<ReturnType<typeof createScheduler>>;

/**
 * Regions of a TradingView/FXReplay capture, as fractions of width and height.
 *
 * Cropping matters more than it looks. The date badge is roughly 200x30 pixels inside a
 * 1920x1080 frame; handed the whole screenshot, Tesseract reads it about half the time.
 * Cropped to the time-axis strip and enlarged, it reads on essentially every capture.
 *
 * Where that strip sits depends on the layout, though - turning the bottom trading panel
 * on or off moves it by half a screen height. So the band is found rather than assumed
 * (see locateAxis); these two are only the fallback for when the badge cannot be seen.
 */
const TIME_AXIS_BANDS = [
  { x0: 0, x1: 1, y0: 0.815, y1: 0.878, scale: 4 },
  { x0: 0, x1: 1, y0: 0.86, y1: 0.925, scale: 4 }
];
const PRICE_AXIS = { x0: 0.885, x1: 0.972, y0: 0.03, y1: 0.83, scale: 3 };

/**
 * TradingView paints the date badge in its house blue, #2962FF, in both the light and the
 * dark theme. A run of rows in the lower half carrying a lot of it is the time axis,
 * whatever else the layout has been rearranged into.
 */
const BADGE_RGB = [41, 98, 255];
const BADGE_TOLERANCE = 40;

let schedulerPromise: Promise<Scheduler> | null = null;

async function getScheduler(): Promise<Scheduler> {
  if (!schedulerPromise) {
    schedulerPromise = (async () => {
      const scheduler = createScheduler();
      const count = Math.max(1, Math.min(3, navigator.hardwareConcurrency || 2));
      const workers = await Promise.all(
        Array.from({ length: count }, () => createWorker('eng'))
      );
      workers.forEach(w => scheduler.addWorker(w));
      return scheduler;
    })();
  }
  return schedulerPromise;
}

/** Releases the workers and their language data. */
export async function terminateOcr(): Promise<void> {
  if (!schedulerPromise) return;
  const scheduler = await schedulerPromise;
  schedulerPromise = null;
  await scheduler.terminate();
}

/* ------------------------------------------------------------------ *
 * Image preparation
 * ------------------------------------------------------------------ */

interface Region {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  scale: number;
}

/** Crops a region, enlarges it, and flattens it to greyscale (optionally inverted). */
function cropRegion(bitmap: ImageBitmap, region: Region, invert: boolean): HTMLCanvasElement {
  const sx = Math.round(bitmap.width * region.x0);
  const sy = Math.round(bitmap.height * region.y0);
  const sw = Math.round(bitmap.width * (region.x1 - region.x0));
  const sh = Math.round(bitmap.height * (region.y1 - region.y0));

  const canvas = document.createElement('canvas');
  canvas.width = sw * region.scale;
  canvas.height = sh * region.scale;

  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const grey = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = invert ? 255 - grey : grey;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const release = (canvas: HTMLCanvasElement) => {
  canvas.width = 0;
  canvas.height = 0;
};

/**
 * Finds the time-axis strip by looking for the blue date badge, so a capture taken with a
 * different panel layout still reads. Returns null when no badge is on screen - a chart
 * with the crosshair parked off it, or a screenshot that is not a chart at all - and the
 * caller falls back to the fixed bands.
 */
function locateAxis(bitmap: ImageBitmap): Region | null {
  const top = Math.floor(bitmap.height * 0.5);
  const height = bitmap.height - top;

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, top, bitmap.width, height, 0, 0, bitmap.width, height);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, bitmap.width, height).data;
  } finally {
    release(canvas);
  }

  // A badge is a couple of hundred pixels wide; anything less is a stray blue candle.
  const minRun = Math.max(30, Math.round(bitmap.width * 0.02));
  let best: { y0: number; y1: number } | null = null;
  let start = -1;

  for (let y = 0; y <= height; y++) {
    let blue = 0;
    if (y < height) {
      for (let x = 0; x < bitmap.width; x++) {
        const i = (y * bitmap.width + x) << 2;
        if (
          Math.abs(data[i] - BADGE_RGB[0]) <= BADGE_TOLERANCE &&
          Math.abs(data[i + 1] - BADGE_RGB[1]) <= BADGE_TOLERANCE &&
          Math.abs(data[i + 2] - BADGE_RGB[2]) <= BADGE_TOLERANCE
        ) {
          blue++;
          if (blue >= minRun) break;
        }
      }
    }

    const onBadge = y < height && blue >= minRun;
    if (onBadge && start < 0) start = y;
    if (!onBadge && start >= 0) {
      if (!best || y - start > best.y1 - best.y0) best = { y0: start, y1: y };
      start = -1;
    }
  }

  if (!best) return null;

  // A few pixels of margin, since the surrounding axis labels sit on the same line and
  // carry the times that the badge itself sometimes crops.
  const padding = 6;
  const y0 = Math.max(0, top + best.y0 - padding);
  const y1 = Math.min(bitmap.height, top + best.y1 + padding);
  if (y1 - y0 < 8) return null;

  return { x0: 0, x1: 1, y0: y0 / bitmap.height, y1: y1 / bitmap.height, scale: 4 };
}

/* ------------------------------------------------------------------ *
 * Reading the date badge
 * ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

/**
 * Matches "Thu 09 Apr '26 UTC-4 07:29" and its OCR mangles.
 *
 * Two details are load-bearing. The weekday is not required: it is the part Tesseract
 * most often garbles ("Fri" read as "Fn"), and it carries no information the rest of the
 * date does not. And the gap before the clock is lazy and forbidden from crossing a
 * colon, because the timezone suffix contains a digit - a greedy gap lets "UTC-4" supply
 * the hour and the match collapses.
 */
const DATE_RE = /(\d{1,2})\s*([A-Za-z]{3})\W{0,4}(\d{2})\b[^:]{0,12}?(\d{1,2}):(\d{2})/g;

const pad = (n: number) => String(n).padStart(2, '0');

export function extractDates(text: string): ReadDate[] {
  const flat = (text || '').replace(/\s+/g, ' ');
  const out: ReadDate[] = [];
  const seen = new Set<string>();

  const re = new RegExp(DATE_RE.source, 'g');
  let m: RegExpExecArray | null;

  while ((m = re.exec(flat)) !== null) {
    const day = parseInt(m[1], 10);
    const month = MONTHS[m[2].toLowerCase()];
    const year = 2000 + parseInt(m[3], 10);
    const hour = parseInt(m[4], 10);
    const minute = parseInt(m[5], 10);

    // Without this the month test is the only thing stopping "05:30 Mon 13" and similar
    // axis noise from parsing as a date.
    if (!month || day < 1 || day > 31 || hour > 23 || minute > 59) {
      // Resume one character on rather than past the whole rejected match. Two badges sit
      // side by side on the axis and OCR often clips the first one's clock, which lets a
      // bogus reading spanning both ("...26 0 Tue 14 Jul 26 08:03", weekday where the
      // month should be) match first. Skipping past it would swallow the good date
      // hiding inside it.
      re.lastIndex = m.index + 1;
      continue;
    }

    const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
    if (seen.has(iso)) continue;
    seen.add(iso);

    out.push({ iso, ms: new Date(year, month - 1, day, hour, minute).getTime(), raw: m[0].trim() });
  }

  return out.sort((a, b) => a.ms - b.ms);
}

/** Numbers on the right-hand axis, used only to confirm a match, never to reject one. */
export function extractPrices(text: string): number[] {
  const matches = (text || '').match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+/g) || [];
  const values = matches
    .map(raw => parseFloat(raw.replace(/,/g, '')))
    .filter(n => isFinite(n));
  return Array.from(new Set(values));
}

/* ------------------------------------------------------------------ *
 * Hashing
 * ------------------------------------------------------------------ */

async function hashFile(file: File): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // crypto.subtle needs a secure context; this is a weaker but serviceable stand-in.
    return `${file.name}:${file.size}:${file.lastModified}`;
  }
}

/* ------------------------------------------------------------------ *
 * Top level
 * ------------------------------------------------------------------ */

export interface OcrProgress {
  done: number;
  total: number;
  current: string;
}

export interface ReadOptions {
  /** Also read the price axis, so prices can break ties between candidate trades. */
  readPrices: boolean;
}

export async function readScreenshots(
  files: File[],
  options: ReadOptions,
  onProgress?: (p: OcrProgress) => void,
  signal?: { cancelled: boolean }
): Promise<ShotRead[]> {
  const scheduler = await getScheduler();
  let done = 0;

  const run = async (file: File, index: number): Promise<ShotRead> => {
    const shot: ShotRead = {
      id: `${index}-${file.name}-${file.size}`,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      hash: '',
      dates: [],
      badgeSeen: false,
      prices: [],
      timeAxisText: ''
    };

    try {
      shot.hash = await hashFile(file);
      if (signal?.cancelled) return shot;

      const bitmap = await createImageBitmap(file);
      try {
        // Where the badge actually is, then the two layouts it has historically sat in.
        const located = locateAxis(bitmap);
        shot.badgeSeen = located !== null;
        const regions = located ? [located, ...TIME_AXIS_BANDS] : TIME_AXIS_BANDS;

        // The badge is white on blue, so the plain pass usually wins; inverting and the
        // sparse mode are only worth their time once the cheap pass has come back empty.
        const passes: { invert: boolean; psm: PSM }[] = [
          { invert: false, psm: PSM.SINGLE_LINE },
          { invert: true, psm: PSM.SINGLE_LINE },
          { invert: false, psm: PSM.SPARSE_TEXT }
        ];

        outer:
        for (const pass of passes) {
          for (const region of regions) {
            if (signal?.cancelled) break outer;

            const canvas = cropRegion(bitmap, region, pass.invert);
            const { data } = await scheduler.addJob('recognize', canvas, {
              tessedit_pageseg_mode: pass.psm
            } as any);
            release(canvas);

            const text = data.text || '';
            shot.timeAxisText = [shot.timeAxisText, text].filter(Boolean).join(' | ');

            // Each pass is read on its own. Pooling the text first would let the tail of
            // one crop and the head of another splice into a date that was never on screen.
            const dates = extractDates(text);
            if (dates.length > 0) {
              shot.dates = dates;
              break outer;
            }
          }
        }

        if (options.readPrices && !signal?.cancelled) {
          const canvas = cropRegion(bitmap, PRICE_AXIS, false);
          const { data } = await scheduler.addJob('recognize', canvas, {
            tessedit_pageseg_mode: PSM.SPARSE_TEXT
          } as any);
          release(canvas);
          shot.prices = extractPrices(data.text || '');
        }
      } finally {
        bitmap.close();
      }
    } catch (err: any) {
      shot.error = err?.message || 'Could not read this image';
    }

    done++;
    onProgress?.({ done, total: files.length, current: file.name });
    return shot;
  };

  // The scheduler caps real concurrency at the worker count, so queueing everything is safe.
  return Promise.all(files.map((f, i) => run(f, i)));
}
