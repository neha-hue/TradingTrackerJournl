import React, { useState } from 'react';
import { CsvTradeRow, PairStatus, ShotPairing } from '../../lib/importer/types';
import { PlanItem, PlanStatus } from '../../lib/importer/plan';
import { fmtC } from '../../lib/utils';

interface ImportReviewProps {
  plan: PlanItem[];
  pairings: ShotPairing[];
  rows: CsvTradeRow[];
  onToggleRow: (rowNum: number) => void;
  /** Pair a screenshot with a row, or null to skip it. */
  onReassign: (shotId: string, rowNum: number | null) => void;
  /** Re-match a screenshot against a date the user typed in. */
  onEditDate: (shotId: string, iso: string) => void;
  onPreview: (src: string) => void;
}

const PLAN_BADGE: Record<PlanStatus, { cls: string; label: string }> = {
  ready: { cls: 'badge-green', label: 'Will import' },
  'already-in-journal': { cls: 'badge-blue', label: 'Already logged' },
  'no-screenshot': { cls: 'badge-yellow', label: 'No screenshot' },
  invalid: { cls: 'badge-red', label: 'Invalid' }
};

const SHOT_BADGE: Record<PairStatus, { cls: string; label: string }> = {
  matched: { cls: 'badge-green', label: 'Matched' },
  ambiguous: { cls: 'badge-yellow', label: 'Needs a decision' },
  unmatched: { cls: 'badge-red', label: 'Unmatched' },
  duplicate: { cls: 'badge-purple', label: 'Duplicate' },
  'no-date': { cls: 'badge-yellow', label: 'No date read' },
  error: { cls: 'badge-red', label: 'Unreadable' }
};

const shortDate = (iso: string) => (iso ? iso.replace('T', ' ').slice(0, 16) : '-');

const rowLabel = (row: CsvTradeRow | undefined): string => {
  if (!row) return 'Unknown row';
  const t = row.trade;
  return `Row ${row.rowNum} · ${shortDate(t.date)} · ${t.direction} @ ${t.entry ?? '?'}`;
};

export const ImportReview: React.FC<ImportReviewProps> = ({
  plan,
  pairings,
  rows,
  onToggleRow,
  onReassign,
  onEditDate,
  onPreview
}) => {
  const [tab, setTab] = useState<'screenshots' | 'trades'>('screenshots');
  const [onlyProblems, setOnlyProblems] = useState(false);

  const importable = rows.filter(r => !r.fatal);

  const visiblePairings = onlyProblems ? pairings.filter(p => p.status !== 'matched') : pairings;
  const visiblePlan = onlyProblems ? plan.filter(p => p.status !== 'ready') : plan;

  return (
    <div className="card">
      <div className="card-header flex-wrap gap-3">
        <h3 className="card-title">
          <i className="fa-solid fa-clipboard-check"></i> Crosscheck report
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-[12px] text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={onlyProblems}
              onChange={e => setOnlyProblems(e.target.checked)}
            />
            Only show problems
          </label>
          <div className="period-tabs">
            <button
              className={`period-tab ${tab === 'screenshots' ? 'active' : ''}`}
              onClick={() => setTab('screenshots')}
            >
              Screenshots ({pairings.length})
            </button>
            <button
              className={`period-tab ${tab === 'trades' ? 'active' : ''}`}
              onClick={() => setTab('trades')}
            >
              Trades ({plan.length})
            </button>
          </div>
        </div>
      </div>

      {tab === 'screenshots' ? (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Preview</th>
                <th>File</th>
                <th>Status</th>
                <th>Date read (editable)</th>
                <th>Paired with</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {visiblePairings.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-secondary py-6">Nothing to show.</td>
                </tr>
              )}
              {visiblePairings.map(p => {
                const badge = SHOT_BADGE[p.status];
                const shownDate = p.overrideDateIso ?? p.shot.dates[0]?.iso ?? '';
                return (
                  <tr key={p.shot.id}>
                    <td>
                      <img
                        src={p.shot.previewUrl}
                        alt={p.shot.name}
                        className="w-[72px] h-[46px] object-cover rounded border border-border cursor-pointer"
                        onClick={() => onPreview(p.shot.previewUrl)}
                      />
                    </td>
                    <td className="max-w-[150px] truncate" title={p.shot.name}>{p.shot.name}</td>
                    <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                    <td>
                      <input
                        type="datetime-local"
                        className="form-control text-[11.5px] w-[185px]"
                        value={shownDate}
                        onChange={e => e.target.value && onEditDate(p.shot.id, e.target.value)}
                      />
                      {p.shot.dates.length > 1 && (
                        <div className="text-[10.5px] text-muted mt-1">
                          also read: {p.shot.dates.slice(1).map(d => shortDate(d.iso)).join(', ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <select
                        className="form-control text-[11.5px] min-w-[250px]"
                        value={p.chosenRowNum ?? ''}
                        onChange={e =>
                          onReassign(p.shot.id, e.target.value ? parseInt(e.target.value, 10) : null)
                        }
                      >
                        <option value="">— skip this screenshot —</option>
                        {importable.map(r => (
                          <option key={r.rowNum} value={r.rowNum}>
                            {rowLabel(r)}
                            {p.candidates.some(c => c.rowNum === r.rowNum) ? '  ★' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-[11px] text-muted max-w-[230px]">{p.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-muted mt-2">
            ★ marks trades whose start time is inside the tolerance window. Any trade can be
            picked regardless. Nothing is deleted — unmatched screenshots are only listed.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="cb-col"></th>
                <th>Row</th>
                <th>Date</th>
                <th>Instrument</th>
                <th>Dir</th>
                <th>Entry</th>
                <th>SL</th>
                <th>TP</th>
                <th>P&amp;L</th>
                <th>Result</th>
                <th>Screenshot</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlan.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center text-secondary py-6">Nothing to show.</td>
                </tr>
              )}
              {visiblePlan.map(item => {
                const t = item.row.trade;
                // A CSV row with no chart still goes in when "import every CSV row" is on,
                // so say that rather than showing it as a gap.
                const badge =
                  item.status === 'no-screenshot' && item.selected
                    ? { cls: 'badge-green', label: 'Will import · no chart' }
                    : PLAN_BADGE[item.status];
                const selectable = item.status === 'ready' || item.status === 'no-screenshot';
                return (
                  <tr key={item.row.rowNum}>
                    <td className="cb-col">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        disabled={!selectable}
                        onChange={() => onToggleRow(item.row.rowNum)}
                      />
                    </td>
                    <td className="text-muted">{item.row.rowNum}</td>
                    <td className="whitespace-nowrap">{shortDate(t.date)}</td>
                    <td className="font-semibold">{t.instrument}</td>
                    <td>
                      <span className={`badge ${t.direction === 'Long' ? 'badge-green' : 'badge-red'}`}>
                        {t.direction}
                      </span>
                    </td>
                    <td>{t.entry ?? '-'}</td>
                    <td>{t.sl ?? '-'}</td>
                    <td>{t.tp ?? '-'}</td>
                    <td className={t.pl >= 0 ? 'text-green' : 'text-red'}>{fmtC(t.pl)}</td>
                    <td className="text-[11.5px]">{t.result}</td>
                    <td>
                      {item.shot ? (
                        <img
                          src={item.shot.previewUrl}
                          alt={item.shot.name}
                          title={item.shot.name}
                          className="w-[54px] h-[36px] object-cover rounded border border-border cursor-pointer"
                          onClick={() => onPreview(item.shot!.previewUrl)}
                        />
                      ) : (
                        <span className="text-muted text-[11px]">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      {(item.note || item.row.issues.length > 0) && (
                        <div className="text-[10.5px] text-muted mt-1 max-w-[200px]">
                          {[item.note, ...item.row.issues].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ImportReview;
