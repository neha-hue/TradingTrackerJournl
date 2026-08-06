import React from 'react';
import { Trade, Account } from '../../lib/types';
import { fmtC } from '../../lib/utils';
import Modal from './Modal';

interface TradeDetailModalProps {
  trade: Trade | null;
  accounts: Account[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (tradeId: string) => void;
  onDelete: (tradeId: string) => void;
  onOpenLightbox: (src: string) => void;
}

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({
  trade,
  accounts,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onOpenLightbox
}) => {
  if (!trade) return null;

  const acc = accounts.find(a => a.id === trade.accountId) || { name: 'Unknown', color: '#888' };
  const tradeDate = new Date(trade.date);
  const title = `${trade.instrument} — ${tradeDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onClose}>Close</button>
      <button className="btn btn-danger" onClick={() => onDelete(trade.id)}>
        <i className="fa-solid fa-trash"></i> Delete
      </button>
      <button className="btn btn-primary" onClick={() => onEdit(trade.id)}>
        <i className="fa-solid fa-pen"></i> Edit
      </button>
    </>
  );

  return (
    <Modal
      id="tradeModal"
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
    >
      <div className="grid-2 mb-[14px]">
        <div className={`stat-card ${trade.pl >= 0 ? 'green' : 'red'} m-0`}>
          <div className="stat-label">P&L</div>
          <div className={`stat-value ${trade.pl >= 0 ? 'green' : 'red'}`}>{fmtC(trade.pl)}</div>
        </div>
        <div className="stat-card blue m-0">
          <div className="stat-label">R:R Ratio</div>
          <div className="stat-value blue">{trade.rr || 'N/A'}</div>
        </div>
      </div>

      <div className="grid-2 text-[13px] gap-2 mb-[14px]">
        <div><span className="text-text-muted">Date:</span> <strong>{tradeDate.toLocaleString('en-IN')}</strong></div>
        <div><span className="text-text-muted">Account:</span> <strong style={{ color: acc.color }}>{acc.name}</strong></div>
        <div><span className="text-text-muted">Instrument:</span> <strong>{trade.instrument}</strong></div>
        <div>
          <span className="text-text-muted">Direction:</span>{' '}
          <span className={`badge ${trade.direction === 'Long' ? 'badge-green' : 'badge-red'}`}>
            {trade.direction === 'Long' ? '▲' : '▼'} {trade.direction}
          </span>
        </div>
        <div><span className="text-text-muted">Entry:</span> <strong className="font-mono">{trade.entry || '—'}</strong></div>
        <div><span className="text-text-muted">Exit:</span> <strong className="font-mono">{trade.exit || '—'}</strong></div>
        <div><span className="text-text-muted">SL:</span> <strong className="font-mono">{trade.sl || '—'}</strong></div>
        <div><span className="text-text-muted">TP:</span> <strong className="font-mono">{trade.tp || '—'}</strong></div>
        <div><span className="text-text-muted">Lots:</span> <strong>{trade.lots || '—'}</strong></div>
        <div><span className="text-text-muted">Setup:</span> <span className="badge badge-blue">{trade.setup}</span></div>
        <div><span className="text-text-muted">Grade:</span> <span className="badge badge-purple">{trade.grade}</span></div>
        <div>
          <span className="text-text-muted">Result:</span>{' '}
          <span className={`badge ${trade.result === 'Win' ? 'badge-green' : trade.result === 'Loss' ? 'badge-red' : 'badge-yellow'}`}>
            {trade.result}
          </span>
        </div>
        <div><span className="text-text-muted">Emotion Before:</span> <strong>{trade.emotionBefore || '—'}</strong></div>
        <div><span className="text-text-muted">Emotion After:</span> <strong>{trade.emotionAfter || '—'}</strong></div>
        {trade.mistakes && (
          <div><span className="text-text-muted">Mistakes:</span> <strong className="text-red">{trade.mistakes}</strong></div>
        )}
      </div>

      {trade.preNotes && (
        <div className="mb-[14px]">
          <div className="form-label">Pre-Trade Notes</div>
          <div className="bg-surface-input border border-border rounded-[8px] p-[11px] text-[13px] leading-[1.6] mt-[5px]">
            {trade.preNotes}
          </div>
        </div>
      )}

      {trade.postNotes && (
        <div className="mb-[14px]">
          <div className="form-label">Post-Trade Notes</div>
          <div className="bg-surface-input border border-border rounded-[8px] p-[11px] text-[13px] leading-[1.6] mt-[5px]">
            {trade.postNotes}
          </div>
        </div>
      )}

      <div>
        <div className="form-label mb-[7px]">Screenshots</div>
        {trade.screenshots && trade.screenshots.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 mt-2">
            {trade.screenshots.map((s, idx) => (
              <div
                key={idx}
                onClick={() => onOpenLightbox(s.dataUrl)}
                className="rounded-[8px] overflow-hidden border border-border cursor-pointer aspect-[16/9] bg-surface-input flex items-center justify-center"
              >
                <img
                  src={s.dataUrl}
                  alt={s.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '';
                    (e.target as HTMLImageElement).classList.add('hidden');
                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<i class="fa-solid fa-image text-text-muted text-2xl"></i>';
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-xs">No screenshots</p>
        )}
      </div>
    </Modal>
  );
};
export default TradeDetailModal;
