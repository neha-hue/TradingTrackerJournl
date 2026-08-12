/**
 * A trade ready to insert, already in the `trades` table's own shape.
 *
 * Numeric fields are `number | null` rather than strings because the schema puts CHECK
 * constraints on several columns - `grade` only accepts 'A'..'F', so an empty string is
 * rejected where NULL is fine. The importer therefore builds rows directly instead of
 * going through the form's string-based Trade type.
 */
export interface TradeDraft {
  date: string;
  instrument: string;
  direction: 'Long' | 'Short';
  session: string;
  entry: number | null;
  exit_price: number | null;
  sl: number | null;
  tp: number | null;
  lots: number | null;
  pl: number;
  risk: number | null;
  rr: number | null;
  setup: string;
  result: 'Win' | 'Loss' | 'Break Even';
}

/** One row of the exported CSV, normalised. */
export interface CsvTradeRow {
  /** 1-based line number in the file, so problems can be pointed at. */
  rowNum: number;
  /** The export's own trade id, shown in the report. */
  sourceId: string;
  trade: TradeDraft;
  /** `dateStart` as epoch ms - the value screenshots are matched against. */
  startMs: number;
  /** Entry price, kept separately for the optional visual confirmation. */
  entryPrice: number | null;
  issues: string[];
  fatal: boolean;
}

export interface CsvParseResult {
  rows: CsvTradeRow[];
  headers: string[];
  /** Which CSV column fed each field, for the mapping summary. */
  mapping: Record<string, string>;
  errors: string[];
}

/** A date+time read off a chart's time axis. */
export interface ReadDate {
  /** Local-naive 'YYYY-MM-DDTHH:mm'. */
  iso: string;
  ms: number;
  /** The raw OCR fragment it came from, shown when the user edits it. */
  raw: string;
}

/** OCR output for one screenshot. */
export interface ShotRead {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  /** SHA-256 of the bytes; identical files are the same capture twice. */
  hash: string;
  /** Every date badge found on the time axis, earliest first. */
  dates: ReadDate[];
  /**
   * Whether the blue date badge was anywhere on the image. False means this is almost
   * certainly not a chart capture - an analytics or session page - rather than a chart
   * whose badge would not read.
   */
  badgeSeen: boolean;
  /** Numbers read off the right-hand price axis, for soft confirmation only. */
  prices: number[];
  timeAxisText: string;
  error?: string;
}

export interface Candidate {
  rowNum: number;
  /** Minutes between the screenshot's badge and the row's dateStart. */
  deltaMin: number;
  /** The badge that produced this candidate. */
  dateIso: string;
  /** True when the row's entry price was also visible on the chart. */
  priceConfirmed: boolean;
}

export type PairStatus =
  | 'matched'
  | 'ambiguous'
  | 'unmatched'
  | 'duplicate'
  | 'no-date'
  | 'error';

export interface ShotPairing {
  shot: ShotRead;
  status: PairStatus;
  /** Best candidates first. */
  candidates: Candidate[];
  /** The CSV row this screenshot will attach to; null means it is skipped. */
  chosenRowNum: number | null;
  /** Set when the user picked or edited by hand - outranks any computed score. */
  pinned?: boolean;
  /** Replaces the OCR reading when the user corrects a misread date. */
  overrideDateIso?: string;
  reason: string;
}

export interface MatchOptions {
  /** How far a badge may sit from dateStart and still match, in minutes. */
  toleranceMin: number;
  /** Use the price axis to break ties between candidates. Never rejects on its own. */
  usePriceConfirmation: boolean;
}
