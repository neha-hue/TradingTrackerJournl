import React, { useState } from 'react';

export const Calculators: React.FC = () => {
  // Position Size Calculator States
  const [balance, setBalance] = useState('10000');
  const [riskPct, setRiskPct] = useState('1');
  const [stopLossPips, setStopLossPips] = useState('20');
  const [pipValue, setPipValue] = useState('10');
  const [lotSizeResult, setLotSizeResult] = useState<number | null>(null);
  const [riskAmountResult, setRiskAmountResult] = useState<number | null>(null);

  // RR Calculator States
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [direction, setDirection] = useState<'Long' | 'Short'>('Long');
  const [rrResult, setRrResult] = useState<number | null>(null);
  const [slPips, setSlPips] = useState<number | null>(null);
  const [tpPips, setTpPips] = useState<number | null>(null);

  // P&L Calculator States
  const [plEntry, setPlEntry] = useState('');
  const [plExit, setPlExit] = useState('');
  const [plLots, setPlLots] = useState('1');
  const [plDirection, setPlDirection] = useState<'Long' | 'Short'>('Long');
  const [plPerLot, setPlPerLot] = useState('10');
  const [plResult, setPlResult] = useState<{ pips: number; profit: number } | null>(null);

  // Pip Calculator States
  const [lots, setLots] = useState('1');
  const [pipsMoved, setPipsMoved] = useState('10');
  const [profitUSD, setProfitUSD] = useState('');
  const [pipValueResult, setPipValueResult] = useState<number | null>(null);

  const calculatePosition = (e: React.FormEvent) => {
    e.preventDefault();
    const bal = parseFloat(balance);
    const risk = parseFloat(riskPct);
    const slP = parseFloat(stopLossPips);
    const pipV = parseFloat(pipValue);

    if (isNaN(bal) || isNaN(risk) || isNaN(slP) || isNaN(pipV) || slP === 0) return;

    const rAmount = bal * (risk / 100);
    const standardLots = rAmount / (slP * pipV);

    setRiskAmountResult(rAmount);
    setLotSizeResult(parseFloat(standardLots.toFixed(2)));
  };

  const calculatePL = (e: React.FormEvent) => {
    e.preventDefault();
    const entryVal = parseFloat(plEntry);
    const exitVal = parseFloat(plExit);
    const lotVal = parseFloat(plLots);
    const pipVal = parseFloat(plPerLot);

    if (isNaN(entryVal) || isNaN(exitVal) || isNaN(lotVal) || isNaN(pipVal)) return;

    const multiplier = entryVal > 50 ? 100 : 10000;
    const priceDiff = plDirection === 'Long' ? exitVal - entryVal : entryVal - exitVal;
    const pips = priceDiff * multiplier;
    const profit = pips * lotVal * pipVal;

    setPlResult({
      pips: parseFloat(pips.toFixed(1)),
      profit: parseFloat(profit.toFixed(2))
    });
  };

  const calculateRR = (e: React.FormEvent) => {
    e.preventDefault();
    const entVal = parseFloat(entry);
    const slVal = parseFloat(sl);
    const tpVal = parseFloat(tp);

    if (isNaN(entVal) || isNaN(slVal) || isNaN(tpVal)) return;

    let stopDistance = 0;
    let targetDistance = 0;

    if (direction === 'Long') {
      stopDistance = entVal - slVal;
      targetDistance = tpVal - entVal;
    } else {
      stopDistance = slVal - entVal;
      targetDistance = entVal - tpVal;
    }

    if (stopDistance <= 0 || targetDistance <= 0) {
      alert('Invalid prices. Check direction, stop loss, and target values.');
      return;
    }

    const rrRatio = targetDistance / stopDistance;
    setRrResult(parseFloat(rrRatio.toFixed(2)));

    // Assuming Forex standard decimals for pips representation
    const multiplier = entVal > 50 ? 100 : 10000; // JPY pairs vs others
    setSlPips(parseFloat((stopDistance * multiplier).toFixed(1)));
    setTpPips(parseFloat((targetDistance * multiplier).toFixed(1)));
  };

  const calculatePipValue = (e: React.FormEvent) => {
    e.preventDefault();
    const lotVal = parseFloat(lots);
    const pipM = parseFloat(pipsMoved);
    const profit = parseFloat(profitUSD);

    if (isNaN(lotVal) || isNaN(pipM) || isNaN(profit) || lotVal === 0 || pipM === 0) return;

    const pipValPerLot = profit / (lotVal * pipM);
    setPipValueResult(parseFloat(pipValPerLot.toFixed(2)));
  };

  return (
    <div className="grid-2 gap-[18px]">
      {/* Position Size & Lot Calculator */}
      <div className="card m-0">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fa-solid fa-scale-unbalanced"></i> Position Size & Lot Calculator
          </h3>
        </div>
        <form onSubmit={calculatePosition} className="flex flex-col gap-3">
          <div className="form-group">
            <label className="form-label">Account Balance ($)</label>
            <input
              type="number"
              className="form-control"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Risk Percentage (%)</label>
            <input
              type="number"
              step="any"
              className="form-control"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Stop Loss (Pips)</label>
            <input
              type="number"
              className="form-control"
              value={stopLossPips}
              onChange={(e) => setStopLossPips(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Pip Value ($ per standard lot - default 10)</label>
            <input
              type="number"
              step="any"
              className="form-control"
              value={pipValue}
              onChange={(e) => setPipValue(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary justify-center">
            Calculate Lots
          </button>
        </form>

        {lotSizeResult !== null && (
          <div className="mt-5 p-[14px] bg-surface-input rounded-[8px] border border-border">
            <div className="flex justify-between text-[13px] mb-2">
              <span className="text-muted">Amount at Risk:</span>
              <strong className="text-red">${riskAmountResult?.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-muted">Standard Lots:</span>
              <strong className="text-green text-[18px]">{lotSizeResult} lots</strong>
            </div>
          </div>
        )}
      </div>

      {/* Risk Reward Ratio Calculator */}
      <div className="card m-0">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fa-solid fa-arrow-up-right-dots"></i> Risk-to-Reward Calculator
          </h3>
        </div>
        <form onSubmit={calculateRR} className="flex flex-col gap-3">
          <div className="form-group">
            <label className="form-label">Direction</label>
            <select
              className="form-control"
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'Long' | 'Short')}
            >
              <option value="Long">Long (Buy)</option>
              <option value="Short">Short (Sell)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Entry Price</label>
            <input
              type="number"
              step="any"
              className="form-control"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Stop Loss (SL)</label>
            <input
              type="number"
              step="any"
              className="form-control"
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Take Profit (TP)</label>
            <input
              type="number"
              step="any"
              className="form-control"
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary justify-center">
            Calculate R:R
          </button>
        </form>

        {rrResult !== null && (
          <div className="mt-5 p-[14px] bg-surface-input rounded-[8px] border border-border">
            <div className="flex justify-between text-[13px] mb-2">
              <span className="text-muted">SL Distance:</span>
              <strong>{slPips} pips</strong>
            </div>
            <div className="flex justify-between text-[13px] mb-2">
              <span className="text-muted">TP Distance:</span>
              <strong>{tpPips} pips</strong>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-muted">R:R Ratio:</span>
              <strong className="text-accent text-[18px]">1 : {rrResult}</strong>
            </div>
          </div>
        )}
      </div>

      {/* P&L Calculator */}
      <div className="card m-0 col-span-full">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fa-solid fa-dollar-sign"></i> P&L Calculator
          </h3>
        </div>
        <form onSubmit={calculatePL} className="flex flex-col gap-3">
          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Direction</label>
              <select className="form-control" value={plDirection} onChange={(e) => setPlDirection(e.target.value as 'Long' | 'Short')}>
                <option value="Long">Long (Buy)</option>
                <option value="Short">Short (Sell)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Entry Price</label>
              <input type="number" step="any" className="form-control" value={plEntry} onChange={(e) => setPlEntry(e.target.value)} placeholder="1.0842" required />
            </div>
            <div className="form-group">
              <label className="form-label">Exit Price</label>
              <input type="number" step="any" className="form-control" value={plExit} onChange={(e) => setPlExit(e.target.value)} placeholder="1.0895" required />
            </div>
          </div>
          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Lots / Contracts</label>
              <input type="number" step="any" className="form-control" value={plLots} onChange={(e) => setPlLots(e.target.value)} placeholder="1.0" required />
            </div>
            <div className="form-group">
              <label className="form-label">Pip Value ($ per lot)</label>
              <input type="number" step="any" className="form-control" value={plPerLot} onChange={(e) => setPlPerLot(e.target.value)} placeholder="10" required />
              <span className="text-[10px] text-text-muted mt-[2px]">Default $10 for standard forex lots</span>
            </div>
            <div className="form-group justify-end">
              <button type="submit" className="btn btn-primary justify-center">Calculate P&L</button>
            </div>
          </div>
        </form>

        {plResult !== null && (
          <div className="mt-5 p-[14px] bg-surface-input rounded-[8px] border border-border">
            <div className="flex justify-between text-[13px] mb-2">
              <span className="text-text-muted">Pips Moved:</span>
              <strong className={plResult.pips >= 0 ? 'text-green' : 'text-red'}>{plResult.pips >= 0 ? '+' : ''}{plResult.pips} pips</strong>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-text-muted">Profit / Loss:</span>
              <strong className={plResult.profit >= 0 ? 'text-green text-[18px]' : 'text-red text-[18px]'}>
                {plResult.profit >= 0 ? '+' : '-'}${Math.abs(plResult.profit).toFixed(2)}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Pip Value Calculator */}
      <div className="card m-0 col-span-full">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fa-solid fa-coins"></i> Pip Value Calculator
          </h3>
        </div>
        <form onSubmit={calculatePipValue} className="flex gap-3.5 flex-wrap items-end">
          <div className="form-group flex-1 min-w-[150px]">
            <label className="form-label">Lots Used</label>
            <input
              type="number"
              step="any"
              className="form-control"
              value={lots}
              onChange={(e) => setLots(e.target.value)}
              required
            />
          </div>
          <div className="form-group flex-1 min-w-[150px]">
            <label className="form-label">Pips Moved</label>
            <input
              type="number"
              className="form-control"
              value={pipsMoved}
              onChange={(e) => setPipsMoved(e.target.value)}
              required
            />
          </div>
          <div className="form-group flex-1 min-w-[150px]">
            <label className="form-label">Profit / Loss ($)</label>
            <input
              type="number"
              step="any"
              className="form-control"
              value={profitUSD}
              onChange={(e) => setProfitUSD(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary h-[38px] justify-center">
            Calculate Pip Value
          </button>
        </form>

        {pipValueResult !== null && (
          <div className="mt-5 p-[14px] bg-surface-input rounded-[8px] border border-border">
            <div className="flex justify-between text-[14px]">
              <span className="text-muted">Pip Value ($ per lot):</span>
              <strong className="text-green text-[18px]">${pipValueResult}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default Calculators;
