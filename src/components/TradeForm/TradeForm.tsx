import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Screenshot } from '../../lib/types';
import Modal from '../shared/Modal';

interface TradeFormProps {
  editTradeId: string | null;
  onSuccess: () => void;
}

export const TradeForm: React.FC<TradeFormProps> = ({ editTradeId, onSuccess }) => {
  const {
    trades,
    strategies,
    currentAccId,
    accounts,
    addTrade,
    updateTrade,
    addStrategy,
    deleteStrategy,
    showToast
  } = useApp();

  const [date, setDate] = useState('');
  const [instrument, setInstrument] = useState('');
  const [direction, setDirection] = useState('Long');
  const [session, setSession] = useState('London');
  const [entry, setEntry] = useState('');
  const [exit, setExit] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [lots, setLots] = useState('');
  const [pl, setPl] = useState('');
  const [risk, setRisk] = useState('');
  const [rr, setRr] = useState('');
  const [setup, setSetup] = useState('');
  const [result, setResult] = useState('Win');
  const [grade, setGrade] = useState('A');
  const [emotionBefore, setEmotionBefore] = useState('Calm');
  const [emotionAfter, setEmotionAfter] = useState('Happy');
  const [mistakes, setMistakes] = useState('');
  const [preNotes, setPreNotes] = useState('');
  const [postNotes, setPostNotes] = useState('');
  
  const [pendingShots, setPendingShots] = useState<Screenshot[]>([]);
  const [isStratModalOpen, setIsStratModalOpen] = useState(false);
  const [newStratName, setNewStratName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Track File objects for blob URLs (new screenshots not yet uploaded)
  const fileMapRef = useRef<Map<string, File>>(new Map());
  // Collect blob URLs for cleanup on unmount
  const blobUrlsRef = useRef<string[]>([]);

  const activeAcc = accounts.find(a => a.id === currentAccId) || { name: 'Live Account', color: '#10d982' };

  // Set initial form states
  useEffect(() => {
    if (editTradeId) {
      const t = trades.find(x => x.id === editTradeId);
      if (t) {
        setDate(t.date ? t.date.slice(0, 16) : '');
        setInstrument(t.instrument);
        setDirection(t.direction);
        setSession(t.session);
        setEntry(t.entry);
        setExit(t.exit);
        setSl(t.sl);
        setTp(t.tp);
        setLots(t.lots);
        setPl(t.pl.toString());
        setRisk(t.risk);
        setRr(t.rr);
        setSetup(t.setup);
        setResult(t.result);
        setGrade(t.grade);
        setEmotionBefore(t.emotionBefore);
        setEmotionAfter(t.emotionAfter);
        setMistakes(t.mistakes);
        setPreNotes(t.preNotes);
        setPostNotes(t.postNotes);
        setPendingShots(t.screenshots || []);
      }
    } else {
      // Reset form
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDate(local);
      setInstrument('');
      setDirection('Long');
      setSession('London');
      setEntry('');
      setExit('');
      setSl('');
      setTp('');
      setLots('');
      setPl('');
      setRisk('');
      setRr('');
      setSetup(strategies[0] || '');
      setResult('Win');
      setGrade('A');
      setEmotionBefore('Calm');
      setEmotionAfter('Happy');
      setMistakes('');
      setPreNotes('');
      setPostNotes('');
      setPendingShots([]);
    }
  }, [editTradeId, trades, strategies]);

  // Set default setup if strategies loaded and setup is empty
  useEffect(() => {
    if (strategies.length > 0 && !setup) {
      setSetup(strategies[0]);
    }
  }, [strategies, setup]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, []);

  // Upload a single file to Supabase Storage, return public URL
  const uploadToStorage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data, error } = await supabase.storage
      .from('screenshots')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('screenshots')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const handleScreenshots = (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      const previewUrl = URL.createObjectURL(f);
      fileMapRef.current.set(previewUrl, f);
      blobUrlsRef.current.push(previewUrl);
      setPendingShots(prev => [...prev, { dataUrl: previewUrl, name: f.name }]);
    }
  };

  const removeShot = (idx: number) => {
    const shot = pendingShots[idx];
    if (shot?.dataUrl.startsWith('blob:')) {
      URL.revokeObjectURL(shot.dataUrl);
      fileMapRef.current.delete(shot.dataUrl);
    }
    setPendingShots(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instrument.trim()) {
      showToast('Please enter instrument', 'error');
      return;
    }
    if (!pl) {
      showToast('Please enter P&L', 'error');
      return;
    }
    if (!date) {
      showToast('Please select date', 'error');
      return;
    }

    setUploading(true);
    try {
      // Upload new (blob) screenshots to Supabase Storage
      const uploadedShots: Screenshot[] = [];
      for (const shot of pendingShots) {
        if (shot.dataUrl.startsWith('blob:')) {
          const file = fileMapRef.current.get(shot.dataUrl);
          if (file) {
            const url = await uploadToStorage(file);
            uploadedShots.push({ dataUrl: url, name: shot.name });
          }
        } else {
          uploadedShots.push(shot); // already a storage URL (existing screenshot)
        }
      }

      const tradeData = {
        accountId: currentAccId,
        date,
        instrument: instrument.toUpperCase(),
        direction,
        session,
        entry,
        exit,
        sl,
        tp,
        lots,
        pl: parseFloat(pl),
        risk,
        rr,
        setup,
        result,
        grade,
        emotionBefore,
        emotionAfter,
        mistakes,
        preNotes,
        postNotes,
        screenshots: uploadedShots
      };

      if (editTradeId) {
        await updateTrade(editTradeId, tradeData);
      } else {
        await addTrade(tradeData);
      }
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Failed to save trade', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleAddStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStratName.trim()) return;
    await addStrategy(newStratName.trim());
    setNewStratName('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fa-solid fa-pen-to-square"></i>{' '}
            <span id="formTitle">{editTradeId ? 'Edit Trade' : 'Log New Trade'}</span>
          </h3>
          <span className="topbar-account-badge" id="formAccountBadge">
            <span className="account-dot" style={{ backgroundColor: activeAcc.color }}></span>
            {activeAcc.name}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Date & Time</label>
              <input
                type="datetime-local"
                className="form-control"
                id="tradeDate"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Instrument / Pair</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. EURUSD, XAUUSD"
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Direction</label>
              <select
                className="form-control"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="Long">Long</option>
                <option value="Short">Short</option>
              </select>
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Session</label>
              <select
                className="form-control"
                value={session}
                onChange={(e) => setSession(e.target.value)}
              >
                <option value="London">London</option>
                <option value="New York">New York</option>
                <option value="Asia">Asia</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Strategy Setup</label>
              <div className="strategy-inline">
                <select
                  className="form-control"
                  value={setup}
                  onChange={(e) => setSetup(e.target.value)}
                >
                  {strategies.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm add-strategy-btn"
                  onClick={() => setIsStratModalOpen(true)}
                >
                  Manage
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Trade Result</label>
              <select
                className="form-control"
                value={result}
                onChange={(e) => setResult(e.target.value)}
              >
                <option value="Win">Win</option>
                <option value="Loss">Loss</option>
                <option value="Break Even">Break Even</option>
              </select>
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Lots / Volume</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 1.0, 0.25"
                value={lots}
                onChange={(e) => setLots(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Net Profit / Loss ($)</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 250.50 or -120"
                value={pl}
                onChange={(e) => setPl(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Grade</label>
              <select
                className="form-control"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Entry Price</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 1.0842"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Exit Price</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 1.0895"
                value={exit}
                onChange={(e) => setExit(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Risk Amount ($)</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 100"
                value={risk}
                onChange={(e) => setRisk(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Stop Loss (SL)</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 1.0820"
                value={sl}
                onChange={(e) => setSl(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Take Profit (TP)</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 1.0920"
                value={tp}
                onChange={(e) => setTp(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Risk : Reward (R:R)</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 2.5"
                value={rr}
                onChange={(e) => setRr(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Emotion Before</label>
              <select
                className="form-control"
                value={emotionBefore}
                onChange={(e) => setEmotionBefore(e.target.value)}
              >
                <option value="Calm">Calm</option>
                <option value="Focused">Focused</option>
                <option value="Anxious">Anxious</option>
                <option value="Greedy">Greedy</option>
                <option value="FOMO">FOMO</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Emotion After</label>
              <select
                className="form-control"
                value={emotionAfter}
                onChange={(e) => setEmotionAfter(e.target.value)}
              >
                <option value="Happy">Happy</option>
                <option value="Satisfied">Satisfied</option>
                <option value="Neutral">Neutral</option>
                <option value="Angry">Angry</option>
                <option value="Frustrated">Frustrated</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mistakes Committed</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Early exit, Chasing price, None"
              value={mistakes}
              onChange={(e) => setMistakes(e.target.value)}
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Pre-Trade Notes / Context</label>
              <textarea
                className="form-control"
                placeholder="Market bias, news calendar, daily range expectations..."
                value={preNotes}
                onChange={(e) => setPreNotes(e.target.value)}
              ></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Post-Trade Notes / Review</label>
              <textarea
                className="form-control"
                placeholder="How did the trade execute? What could be improved? Psychological review..."
                value={postNotes}
                onChange={(e) => setPostNotes(e.target.value)}
              ></textarea>
            </div>
          </div>

          {/* Screenshots Upload */}
          <div className="form-group">
            <label className="form-label">Trade Screenshots</label>
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleScreenshots(e.dataTransfer.files); }}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <i className="fa-solid fa-cloud-arrow-up"></i>
              <span className="upload-text">Drag and drop screenshots here, or click to browse</span>
              <span className="upload-sub">Supports PNG, JPG, JPEG</span>
              <input
                type="file"
                id="fileInput"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => { if (e.target.files) handleScreenshots(e.target.files); }}
              />
            </div>
            <div className="screenshots-preview">
              {pendingShots.map((shot, idx) => (
                <div key={idx} className="screenshot-thumb">
                  <img src={shot.dataUrl} alt={shot.name} />
                  <div className="screenshot-del" onClick={() => removeShot(idx)}>
                    <i className="fa-solid fa-xmark"></i>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-[10px]">
            <button
              type="submit"
              className="btn btn-primary px-6 py-2.5"
              disabled={uploading}
            >
              {uploading ? (
                <span id="saveLabel"><i className="fa-solid fa-spinner fa-spin"></i> Uploading...</span>
              ) : (
                <span id="saveLabel">{editTradeId ? 'Update Trade' : 'Save Trade'}</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Strategy Management Modal */}
      <Modal
        id="strategyModal"
        title="Manage Strategies"
        isOpen={isStratModalOpen}
        onClose={() => setIsStratModalOpen(false)}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div id="strategyList" className="max-h-[200px] overflow-y-auto flex flex-col gap-1">
            {strategies.map((strat) => (
              <div
                key={strat}
                className="flex-center between py-[6px] border-b border-border"
              >
                <span className="text-[13px]">{strat}</span>
                <button className="btn btn-danger btn-xs" onClick={() => deleteStrategy(strat)}>
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            ))}
          </div>

          <div className="divider my-2"></div>

          <form onSubmit={handleAddStrategy} className="flex gap-2">
            <input
              type="text"
              id="newStratInput"
              className="form-control"
              placeholder="Strategy name"
              value={newStratName}
              onChange={(e) => setNewStratName(e.target.value)}
              required
            />
              <button type="submit" className="btn btn-primary btn-sm whitespace-nowrap">
              Add
            </button>
          </form>
        </div>
      </Modal>
    </div>
  );
};
export default TradeForm;
