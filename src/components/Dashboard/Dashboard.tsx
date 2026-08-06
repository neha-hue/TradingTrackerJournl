import React from 'react';
import { useApp } from '../../context/AppContext';
import StatsGrid from './StatsGrid';
import DailyBreakdown from './DailyBreakdown';
import EquityChart from './EquityChart';
import WinLossChart from './WinLossChart';
import TopInstruments from './TopInstruments';
import SessionChart from './SessionChart';
import RecentTrades from './RecentTrades';

interface DashboardProps {
  onSelectTrade: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectTrade }) => {
  const { trades, currentAccId, theme } = useApp();

  // Filter trades by current active account
  const activeTrades = trades.filter((t) => (t.accountId || 'acc-live') === currentAccId);

  return (
    <div className="flex flex-col gap-4">
      <StatsGrid trades={activeTrades} />
      
      <DailyBreakdown
        trades={activeTrades}
        theme={theme}
        onSelectTrade={onSelectTrade}
      />

      <div className="grid-2">
        <EquityChart trades={activeTrades} theme={theme} />
        <WinLossChart trades={activeTrades} theme={theme} />
      </div>

      <div className="grid-2">
        <SessionChart trades={activeTrades} theme={theme} />
        <TopInstruments trades={activeTrades} />
      </div>

      <RecentTrades trades={activeTrades} onSelectTrade={onSelectTrade} />
    </div>
  );
};
export default Dashboard;
