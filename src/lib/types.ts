export interface Account {
  id: string;
  name: string;
  type: 'Live' | 'Prop' | 'Demo' | 'Other';
  color: string;
  user_id?: string;
  created_at?: string;
}

export interface Strategy {
  id: string;
  name: string;
  user_id?: string;
  created_at?: string;
}

export interface Screenshot {
  dataUrl: string;
  name: string;
}

export interface Trade {
  id: string;
  accountId: string;
  date: string;
  instrument: string;
  direction: string;
  session: string;
  entry: string;
  exit: string;
  sl: string;
  tp: string;
  lots: string;
  pl: number;
  risk: string;
  rr: string;
  setup: string;
  result: string;
  grade: string;
  emotionBefore: string;
  emotionAfter: string;
  mistakes: string;
  preNotes: string;
  postNotes: string;
  screenshots: Screenshot[];
  user_id?: string;
  created_at?: string;
}

export interface TradeStats {
  totalPL: number;
  wins: number;
  losses: number;
  be: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  profitFactor: number;
  maxDD: number;
  total: number;
  grossWin: number;
  grossLoss: number;
}
