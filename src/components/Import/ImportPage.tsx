import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, ImportItem, ImportOutcome } from '../../context/AppContext';
import { parseTradesCsv } from '../../lib/importer/csv';
import { readScreenshots, terminateOcr, OcrProgress } from '../../lib/importer/ocr';
import { pairScreenshots, reassign, applyDateOverride } from '../../lib/importer/match';
import {
  buildPlan,
  summarise,
  buildReportCsv,
  downloadText,
  existingSignatures,
  PlanItem
} from '../../lib/importer/plan';
import { CsvParseResult, ShotPairing } from '../../lib/importer/types';
import ImportReview from './ImportReview';
import Lightbox from '../shared/Lightbox';

type Step = 'upload' | 'scanning' | 'review' | 'importing' | 'done';

const IMAGE_TYPES = /^image\/(png|jpe?g|webp|bmp)$/i;
const DEFAULT_SETUP = 'ICT Silver Bullet';
const DEFAULT_SESSION = 'New York';

/**
 * How far a chart's timestamp may sit from the trade's start time.
 *
 * The badge sits wherever the crosshair was left, not on the entry candle, so some slack
 * is unavoidable. 45 minutes was measured against a month of real charts: the largest
 * genuine gap was 39 minutes, and tightening to 30 threw away four correct pairings.
 * It is fixed rather than offered as a setting - it is a property of how the charts are
 * captured, not a preference.
 */
const TOLERANCE_MIN = 45;

export const ImportPage: React.FC = () => {
  const { accounts, currentAccId, trades, importTrades, ensureStrategy, showToast, setPage } = useApp();

  const [step, setStep] = useState<Step>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [shotFiles, setShotFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState<'csv' | 'shots' | null>(null);

  const [accountId, setAccountId] = useState(currentAccId);
  const [session, setSession] = useState(DEFAULT_SESSION);
  const [setup, setSetup] = useState(DEFAULT_SETUP);
  const [usePriceConfirmation, setUsePriceConfirmation] = useState(true);
  // The CSV is the record of what was traded; the screenshots are evidence attached to it.
  // So every row it lists is imported by default, with or without a chart to go with it.
  const [includeWithoutScreenshot, setIncludeWithoutScreenshot] = useState(true);

  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [pairings, setPairings] = useState<ShotPairing[]>([]);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress>({ done: 0, total: 0, current: '' });
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const cancelRef = useRef({ cancelled: false });
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => setAccountId(currentAccId), [currentAccId]);

  useEffect(() => {
    return () => {
      cancelRef.current.cancelled = true;
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
      // The recognition workers hold a lot of memory; drop them when leaving the page.
      void terminateOcr();
    };
  }, []);

  const chosenAccount = accounts.find(a => a.id === accountId);
  const matchOptions = { toleranceMin: TOLERANCE_MIN, usePriceConfirmation };

  const summary = useMemo(
    () => (parsed ? summarise(parsed.rows, pairings, plan) : null),
    [parsed, pairings, plan]
  );

  const selectedCount = plan.filter(p => p.selected).length;

  /**
   * When not one screenshot found a trade, the cause is almost never the matching - it is
   * the wrong CSV, an export from a different month than the charts. Comparing the two
   * date spans says that outright instead of leaving a wall of red badges to interpret.
   */
  const spanCheck = useMemo(() => {
    if (!parsed || pairings.length === 0) return null;
    if (!summary || summary.screenshotsMatched > 0) return null;

    const csvDays = parsed.rows.filter(r => !r.fatal).map(r => r.trade.date.slice(0, 10)).sort();
    const shotDays = pairings.flatMap(p => p.shot.dates.map(d => d.iso.slice(0, 10))).sort();
    if (csvDays.length === 0 || shotDays.length === 0) return null;

    const csv = { from: csvDays[0], to: csvDays[csvDays.length - 1] };
    const shots = { from: shotDays[0], to: shotDays[shotDays.length - 1] };
    return { csv, shots, overlap: shots.to >= csv.from && shots.from <= csv.to };
  }, [parsed, pairings, summary]);

  /* ---------------------------------------------------------------- *
   * Files
   * ---------------------------------------------------------------- */

  const takeFiles = (files: FileList | null) => {
    if (!files) return;
    const images: File[] = [];
    let csv: File | null = null;

    for (const file of Array.from(files)) {
      if (IMAGE_TYPES.test(file.type)) images.push(file);
      else if (/\.(csv|tsv|txt)$/i.test(file.name) || file.type === 'text/csv') csv = file;
    }

    if (csv) setCsvFile(csv);
    if (images.length > 0) {
      setShotFiles(prev => {
        const seen = new Set(prev.map(f => `${f.name}:${f.size}`));
        return [...prev, ...images.filter(f => !seen.has(`${f.name}:${f.size}`))];
      });
    }
  };

  /* ---------------------------------------------------------------- *
   * Scan and match
   * ---------------------------------------------------------------- */

  const rebuildPlan = (
    result: CsvParseResult,
    nextPairings: ShotPairing[],
    keepSelection = true,
    includeAll = includeWithoutScreenshot
  ) => {
    const rebuilt = buildPlan(
      result.rows,
      nextPairings,
      existingSignatures(trades, accountId),
      { includeWithoutScreenshot: includeAll }
    );
    if (!keepSelection) return rebuilt;

    const chosen = new Map(plan.map(p => [p.row.rowNum, p.selected]));
    return rebuilt.map(p =>
      chosen.has(p.row.rowNum) && (p.status === 'ready' || p.status === 'no-screenshot')
        ? { ...p, selected: chosen.get(p.row.rowNum)! }
        : p
    );
  };

  const handleScan = async () => {
    if (!csvFile) {
      showToast('Add your CSV export first', 'error');
      return;
    }
    if (!accountId) {
      showToast('Choose which account these trades belong to', 'error');
      return;
    }

    cancelRef.current = { cancelled: false };
    setStep('scanning');
    setOcrProgress({ done: 0, total: shotFiles.length, current: '' });

    try {
      const result = parseTradesCsv(await csvFile.text(), { session, setup });
      if (result.errors.length > 0) {
        showToast(result.errors[0], 'error');
        setParsed(result);
        setStep('upload');
        return;
      }
      if (result.rows.length === 0) {
        showToast('That CSV has a header but no trade rows', 'error');
        setStep('upload');
        return;
      }
      setParsed(result);

      const shots = await readScreenshots(
        shotFiles,
        { readPrices: usePriceConfirmation },
        setOcrProgress,
        cancelRef.current
      );
      previewUrlsRef.current.push(...shots.map(s => s.previewUrl));
      if (cancelRef.current.cancelled) {
        setStep('upload');
        return;
      }

      const nextPairings = pairScreenshots(shots, result.rows, matchOptions);
      setPairings(nextPairings);
      setPlan(rebuildPlan(result, nextPairings, false));
      setStep('review');
    } catch (err: any) {
      showToast(err?.message || 'Could not read those files', 'error');
      setStep('upload');
    }
  };

  /** Toggling "import every CSV row" on the review screen re-selects without a re-scan. */
  const handleIncludeAllChange = (value: boolean) => {
    setIncludeWithoutScreenshot(value);
    if (parsed && step === 'review') setPlan(rebuildPlan(parsed, pairings, false, value));
  };

  const applyPairings = (next: ShotPairing[]) => {
    setPairings(next);
    if (parsed) setPlan(rebuildPlan(parsed, next));
  };

  const handleToggleRow = (rowNum: number) => {
    setPlan(prev =>
      prev.map(p =>
        p.row.rowNum === rowNum && (p.status === 'ready' || p.status === 'no-screenshot')
          ? { ...p, selected: !p.selected }
          : p
      )
    );
  };

  /* ---------------------------------------------------------------- *
   * Write
   * ---------------------------------------------------------------- */

  const handleImport = async () => {
    const items: ImportItem[] = plan
      .filter(p => p.selected && (p.status === 'ready' || p.status === 'no-screenshot'))
      .map(p => ({ trade: p.row.trade, accountId, file: p.shot?.file ?? null, ref: p.row.rowNum }));

    if (items.length === 0) {
      showToast('Nothing is selected to import', 'error');
      return;
    }
    if (
      !window.confirm(
        `Import ${items.length} trades into "${chosenAccount?.name ?? 'this account'}"?\n\n` +
          `${items.filter(i => i.file).length} will have a screenshot attached.`
      )
    ) {
      return;
    }

    setStep('importing');
    setImportProgress({ done: 0, total: items.length });

    // Register the setup so it appears in the Trade Form dropdown when these are edited.
    await ensureStrategy(setup);

    const result = await importTrades(items, (done, total) => setImportProgress({ done, total }));
    setOutcome(result);
    setStep('done');

    if (result.failures.length === 0) showToast(`Imported ${result.imported} trades`);
    else showToast(`Imported ${result.imported}, ${result.failures.length} problems`, 'error');
  };

  const handleReset = () => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setCsvFile(null);
    setShotFiles([]);
    setParsed(null);
    setPairings([]);
    setPlan([]);
    setOutcome(null);
    setStep('upload');
  };

  const handleDownloadReport = () =>
    downloadText(
      `TradeVault_crosscheck_${new Date().toISOString().slice(0, 10)}.csv`,
      buildReportCsv(pairings, plan)
    );

  /* ---------------------------------------------------------------- *
   * Render
   * ---------------------------------------------------------------- */

  const stepIndex = { upload: 0, scanning: 1, review: 2, importing: 3, done: 3 }[step];
  const stepNames = ['Upload', 'Read & match', 'Crosscheck', 'Import'];

  return (
    <div className="flex flex-col gap-4">
      <div className="card mb-0">
        <div className="card-header flex-wrap gap-2">
          <h3 className="card-title"><i className="fa-solid fa-file-import"></i> Bulk import</h3>
          <div className="flex gap-1.5 flex-wrap">
            {stepNames.map((name, i) => (
              <span
                key={name}
                className={`badge ${i < stepIndex ? 'badge-green' : i === stepIndex ? 'badge-blue' : ''}`}
                style={i > stepIndex ? { background: 'var(--bg-input)', color: 'var(--text-muted)' } : undefined}
              >
                {i < stepIndex ? <i className="fa-solid fa-check"></i> : `${i + 1}.`} {name}
              </span>
            ))}
          </div>
        </div>
        <p className="text-secondary text-[12.5px]">
          The CSV is the record — every trade in it gets logged. The screenshots are the evidence:
          each chart's date and time is read off its time axis and attached to the trade that starts
          closest to it. A trade with no matching chart is still imported, just without one. You see
          the full crosscheck — and can correct any date or pairing — before a single row is written.
        </p>
      </div>

      {step === 'upload' && (
        <>
          {/* Account choice comes first: these trades have to land in the right book. */}
          <div className="card mb-0">
            <div className="card-header">
              <h3 className="card-title"><i className="fa-solid fa-wallet"></i> Import into which account?</h3>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => setAccountId(acc.id)}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-lg border transition text-left"
                  style={{
                    borderColor: acc.id === accountId ? 'var(--accent)' : 'var(--border)',
                    background: acc.id === accountId ? 'var(--accent-glow)' : 'var(--bg-input)',
                    minWidth: '190px'
                  }}
                >
                  <span className="account-dot" style={{ backgroundColor: acc.color }}></span>
                  <span className="flex-1">
                    <span className="block text-[13.5px] font-semibold">{acc.name}</span>
                    <span className="block text-[10.5px] text-muted uppercase tracking-wide">{acc.type}</span>
                  </span>
                  {acc.id === accountId && <i className="fa-solid fa-circle-check text-accent"></i>}
                </button>
              ))}
            </div>
            {accounts.length === 0 && (
              <p className="text-[12px] text-red">No accounts yet — add one from the sidebar first.</p>
            )}
          </div>

          <div className="grid-2">
            <div className="card mb-0">
              <div className="card-header">
                <h3 className="card-title"><i className="fa-solid fa-file-csv"></i> Trade CSV</h3>
                {csvFile && (
                  <button className="btn btn-secondary btn-xs" onClick={() => setCsvFile(null)}>Remove</button>
                )}
              </div>
              <div
                className={`upload-zone ${dragOver === 'csv' ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver('csv'); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); setDragOver(null); takeFiles(e.dataTransfer.files); }}
                onClick={() => document.getElementById('importCsvInput')?.click()}
              >
                <i className="fa-solid fa-file-csv"></i>
                <span className="upload-text">{csvFile ? csvFile.name : 'Drop your CSV export here, or click to browse'}</span>
                <span className="upload-sub">
                  {csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'Columns are detected automatically'}
                </span>
                <input
                  type="file"
                  id="importCsvInput"
                  className="hidden"
                  accept=".csv,.tsv,.txt,text/csv"
                  onChange={e => takeFiles(e.target.files)}
                />
              </div>
            </div>

            <div className="card mb-0">
              <div className="card-header">
                <h3 className="card-title"><i className="fa-solid fa-images"></i> Screenshots ({shotFiles.length})</h3>
                {shotFiles.length > 0 && (
                  <button className="btn btn-secondary btn-xs" onClick={() => setShotFiles([])}>Clear</button>
                )}
              </div>
              <div
                className={`upload-zone ${dragOver === 'shots' ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver('shots'); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); setDragOver(null); takeFiles(e.dataTransfer.files); }}
                onClick={() => document.getElementById('importShotsInput')?.click()}
              >
                <i className="fa-solid fa-cloud-arrow-up"></i>
                <span className="upload-text">Drop the whole month's screenshots here</span>
                <span className="upload-sub">Select the folder's files all at once — PNG or JPG</span>
                <input
                  type="file"
                  id="importShotsInput"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={e => takeFiles(e.target.files)}
                />
              </div>
              {shotFiles.length > 0 && (
                <div className="text-[11px] text-muted mt-2">
                  {shotFiles.slice(0, 3).map(f => f.name).join(', ')}
                  {shotFiles.length > 3 ? ` and ${shotFiles.length - 3} more` : ''}
                </div>
              )}
            </div>
          </div>

          <div className="card mb-0">
            <div className="card-header">
              <h3 className="card-title"><i className="fa-solid fa-sliders"></i> Defaults for every imported trade</h3>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Session</label>
                <select className="form-control" value={session} onChange={e => setSession(e.target.value)}>
                  <option value="London">London</option>
                  <option value="New York">New York</option>
                  <option value="Asia">Asia</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Strategy / setup</label>
                <input
                  type="text"
                  className="form-control"
                  value={setup}
                  onChange={e => setSetup(e.target.value)}
                  placeholder="e.g. ICT Silver Bullet"
                />
              </div>
            </div>

            <div className="divider"></div>

            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-2 text-[12.5px] text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePriceConfirmation}
                  onChange={e => setUsePriceConfirmation(e.target.checked)}
                />
                Also read the price axis, to separate two trades that started close together
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeWithoutScreenshot}
                  onChange={e => handleIncludeAllChange(e.target.checked)}
                />
                Import every trade in the CSV, including those no screenshot matched
                <span className="text-[11px] text-muted">
                  (untick to log only the trades that have a chart)
                </span>
              </label>
            </div>

            {parsed && parsed.errors.length > 0 && (
              <div className="text-[12px] text-red mt-3">{parsed.errors.join(' ')}</div>
            )}

            <div className="flex justify-end mt-4">
              <button
                className="btn btn-primary px-6 py-2.5"
                onClick={handleScan}
                disabled={!csvFile || !accountId}
              >
                <i className="fa-solid fa-magnifying-glass-chart"></i> Read &amp; crosscheck
              </button>
            </div>
          </div>
        </>
      )}

      {step === 'scanning' && (
        <div className="card mb-0">
          <div className="text-center py-8">
            <i className="fa-solid fa-spinner fa-spin fa-2x text-accent mb-4"></i>
            <h3 className="mb-1">Reading timestamps off the charts</h3>
            <p className="text-secondary text-[12.5px] mb-4">
              {ocrProgress.total === 0
                ? 'Parsing the CSV…'
                : `${ocrProgress.done} of ${ocrProgress.total} — ${ocrProgress.current || 'starting'}`}
            </p>
            <div className="w-full max-w-[420px] mx-auto h-2 rounded-full bg-surface-input border border-border overflow-hidden">
              <div
                className="h-full bg-accent transition-[width] duration-300"
                style={{ width: ocrProgress.total ? `${Math.round((ocrProgress.done / ocrProgress.total) * 100)}%` : '5%' }}
              />
            </div>
            <button
              className="btn btn-secondary btn-sm mt-5"
              onClick={() => { cancelRef.current.cancelled = true; setStep('upload'); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(step === 'review' || step === 'done') && summary && parsed && (
        <>
          <div className="stats-grid">
            <SummaryCard label="Screenshots processed" value={summary.screenshotsProcessed} />
            <SummaryCard label="Matched to a trade" value={summary.screenshotsMatched} tone="green" />
            <SummaryCard label="Need a decision" value={summary.screenshotsAmbiguous + summary.screenshotsNoDate} tone={summary.screenshotsAmbiguous + summary.screenshotsNoDate ? 'yellow' : undefined} />
            <SummaryCard label="Unmatched screenshots" value={summary.screenshotsUnmatched + summary.screenshotsUnreadable} tone={summary.screenshotsUnmatched + summary.screenshotsUnreadable ? 'red' : undefined} />
            <SummaryCard label="Duplicate screenshots" value={summary.screenshotsDuplicate} tone={summary.screenshotsDuplicate ? 'purple' : undefined} />
            <SummaryCard
              label={step === 'done' ? 'Trades imported' : 'Selected to import'}
              value={step === 'done' ? outcome?.imported ?? 0 : selectedCount}
              tone="blue"
            />
            <SummaryCard label="Trades without a screenshot" value={summary.tradesWithoutScreenshot} />
            <SummaryCard label="Already in this account" value={summary.tradesAlreadyPresent} />
          </div>

          {spanCheck && (
            <div
              className="card mb-0"
              style={{ borderColor: 'var(--red)', background: 'rgba(247,79,110,0.06)' }}
            >
              <div className="card-header">
                <h3 className="card-title text-red">
                  <i className="fa-solid fa-triangle-exclamation"></i> Nothing matched — the CSV
                  and the screenshots are from {spanCheck.overlap ? 'different times' : 'different months'}
                </h3>
              </div>
              <div className="flex gap-6 flex-wrap text-[12.5px] mb-2">
                <span className="text-secondary">
                  CSV covers <strong className="mono">{spanCheck.csv.from}</strong> to{' '}
                  <strong className="mono">{spanCheck.csv.to}</strong>
                </span>
                <span className="text-secondary">
                  Screenshots are dated <strong className="mono">{spanCheck.shots.from}</strong> to{' '}
                  <strong className="mono">{spanCheck.shots.to}</strong>
                </span>
              </div>
              <p className="text-[12px] text-secondary">
                {spanCheck.overlap
                  ? 'The dates overlap but no chart landed within 45 minutes of a trade. Check that the CSV is the right export for these charts.'
                  : 'These two do not overlap at all, so no screenshot can match any trade. Go back and pick the CSV exported for the same month as these charts.'}
              </p>
              <div className="flex justify-end mt-3">
                <button className="btn btn-secondary btn-sm" onClick={() => setStep('upload')}>
                  <i className="fa-solid fa-arrow-left"></i> Choose a different CSV
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="card mb-0 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-[12px] text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWithoutScreenshot}
                    onChange={e => handleIncludeAllChange(e.target.checked)}
                  />
                  Import every CSV row
                </label>
              </div>
              <span className="topbar-account-badge">
                <span className="account-dot" style={{ backgroundColor: chosenAccount?.color }}></span>
                {chosenAccount?.name}
              </span>
            </div>
          )}

          {step === 'done' && outcome && (
            <div className="card mb-0">
              <div className="card-header">
                <h3 className="card-title"><i className="fa-solid fa-circle-check"></i> Import finished</h3>
              </div>
              <p className="text-[13px]">
                {outcome.imported} trades written to <strong>{chosenAccount?.name}</strong>, with{' '}
                {outcome.screenshotsAttached} screenshots attached.
              </p>
              {outcome.failures.length > 0 && (
                <div className="mt-3">
                  <div className="text-[12px] text-red font-semibold mb-1">{outcome.failures.length} problems:</div>
                  <ul className="text-[11.5px] text-secondary list-disc pl-5 max-h-[160px] overflow-y-auto">
                    {outcome.failures.map((f, i) => <li key={i}>Row {f.ref}: {f.error}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex gap-2 mt-4 flex-wrap">
                <button className="btn btn-primary btn-sm" onClick={() => setPage('journal')}>
                  <i className="fa-solid fa-list"></i> Open trade log
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleDownloadReport}>
                  <i className="fa-solid fa-download"></i> Download report
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleReset}>
                  <i className="fa-solid fa-rotate-left"></i> Import another month
                </button>
              </div>
            </div>
          )}

          <ImportReview
            plan={plan}
            pairings={pairings}
            rows={parsed.rows}
            onToggleRow={handleToggleRow}
            onReassign={(id, rowNum) => applyPairings(reassign(pairings, id, rowNum))}
            onEditDate={(id, iso) =>
              applyPairings(applyDateOverride(pairings, parsed.rows, matchOptions, id, iso))
            }
            onPreview={setLightboxSrc}
          />

          {step === 'review' && (
            <div className="card mb-0 flex items-center justify-between flex-wrap gap-3">
              <div className="text-[12.5px] text-secondary">
                <strong className="text-[15px]">{selectedCount}</strong> trades selected ·{' '}
                {plan.filter(p => p.selected && p.shot).length} with a screenshot
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className="btn btn-secondary btn-sm" onClick={handleDownloadReport}>
                  <i className="fa-solid fa-download"></i> Download report
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleReset}>Start over</button>
                <button className="btn btn-primary px-6" onClick={handleImport} disabled={selectedCount === 0}>
                  <i className="fa-solid fa-cloud-arrow-up"></i> Import into {chosenAccount?.name}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {step === 'importing' && (
        <div className="card mb-0">
          <div className="text-center py-8">
            <i className="fa-solid fa-spinner fa-spin fa-2x text-accent mb-4"></i>
            <h3 className="mb-1">Writing to your journal</h3>
            <p className="text-secondary text-[12.5px] mb-4">
              {importProgress.done} of {importProgress.total} trades
            </p>
            <div className="w-full max-w-[420px] mx-auto h-2 rounded-full bg-surface-input border border-border overflow-hidden">
              <div
                className="h-full bg-accent transition-[width] duration-300"
                style={{ width: importProgress.total ? `${Math.round((importProgress.done / importProgress.total) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      )}

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number; tone?: string }> = ({ label, value, tone }) => (
  <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className={`stat-value ${tone || ''}`}>{value}</div>
  </div>
);

export default ImportPage;
