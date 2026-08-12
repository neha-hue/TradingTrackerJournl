import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, bootstrap, accountsApi, strategiesApi, tradesApi } from '../lib/api';
import type { SessionUser } from '../lib/api';
import { AUTO_LOGIN_EMAIL, AUTO_LOGIN_PASSWORD, AUTO_LOGIN_ENABLED } from '../lib/config';
import { Account, Trade } from '../lib/types';
import { uploadScreenshot } from '../lib/storage';
import { TradeDraft } from '../lib/importer/types';

interface Toast {
  msg: string;
  type: 'success' | 'error';
}

interface AppContextType {
  user: SessionUser | null;
  loading: boolean;
  authError: string | null;
  page: string;
  setPage: (page: string) => void;
  accounts: Account[];
  currentAccId: string;
  setCurrentAccId: (id: string) => void;
  trades: Trade[];
  strategies: string[];
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  toast: Toast | null;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  addAccount: (name: string, type: Account['type'], color: string) => Promise<void>;
  renameAccount: (id: string, name: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addStrategy: (name: string) => Promise<void>;
  deleteStrategy: (name: string) => Promise<void>;
  addTrade: (trade: Omit<Trade, 'id'>) => Promise<void>;
  updateTrade: (id: string, trade: Partial<Trade>) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  bulkDeleteTrades: (ids: string[]) => Promise<void>;
  importTrades: (
    items: ImportItem[],
    onProgress?: (done: number, total: number) => void
  ) => Promise<ImportOutcome>;
  ensureStrategy: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  seedDemoData: () => Promise<void>;
}

/** One trade to write, with the screenshot that was paired with it. */
export interface ImportItem {
  trade: TradeDraft;
  accountId: string;
  file: File | null;
  /** Identifies the item in the outcome report - the CSV row number. */
  ref: number;
}

export interface ImportOutcome {
  imported: number;
  screenshotsAttached: number;
  failures: { ref: number; error: string }[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_STRATEGIES = [
  'ICT Breaker', 'Order Block', 'Fair Value Gap', 'Liquidity Grab', 'Mitigation Block',
  'VWAP Reclaim', 'Support/Resistance', 'Breakout', 'News Trade', 'Scalp', 'Swing'
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [page, setPage] = useState('dashboard');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentAccId, setCurrentAccId] = useState<string>('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<string[]>(DEFAULT_STRATEGIES);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('tv_theme') as 'dark' | 'light' | null;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('tv_theme', newTheme);
  };

  // Runs once per page load: check for an existing session, then fall back to
  // auto sign-in (see lib/config.ts) if it's enabled, then the login screen.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { user: sessionUser } = await auth.getSession();
        if (cancelled) return;
        if (sessionUser) {
          setUser(sessionUser);
          return;
        }
      } catch {
        if (!cancelled) {
          setAuthError('Could not reach the local server. Is it running? (npm run dev:server)');
          setLoading(false);
        }
        return;
      }

      if (!AUTO_LOGIN_ENABLED) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const signedInUser = await auth.signIn(AUTO_LOGIN_EMAIL, AUTO_LOGIN_PASSWORD);
        if (!cancelled) setUser(signedInUser);
        return;
      } catch {
        // Expected on a brand-new local database - there is no such account yet. Unlike
        // Supabase, local sign-up is instant with no email-confirmation step, so it is
        // safe to create the account here. If the account already exists, this fails
        // too (email taken) and that error is the one shown - it means the configured
        // password is wrong.
      }

      try {
        const signedUpUser = await auth.signUp(AUTO_LOGIN_EMAIL, AUTO_LOGIN_PASSWORD);
        if (!cancelled) setUser(signedUpUser);
      } catch (err: any) {
        if (!cancelled) {
          setAuthError(`${err.message || 'Auto sign-in failed'} (${AUTO_LOGIN_EMAIL})`);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Map db trade row to frontend Trade object
  const mapDbTrade = (dbTrade: any): Trade => {
    return {
      id: dbTrade.id,
      accountId: dbTrade.account_id,
      date: dbTrade.date,
      instrument: dbTrade.instrument,
      direction: dbTrade.direction,
      session: dbTrade.session || 'Other',
      entry: dbTrade.entry?.toString() || '',
      exit: dbTrade.exit_price?.toString() || '',
      sl: dbTrade.sl?.toString() || '',
      tp: dbTrade.tp?.toString() || '',
      lots: dbTrade.lots?.toString() || '',
      pl: parseFloat(dbTrade.pl || 0),
      risk: dbTrade.risk?.toString() || '',
      rr: dbTrade.rr?.toString() || '',
      setup: dbTrade.setup || '',
      result: dbTrade.result,
      grade: dbTrade.grade || 'A',
      emotionBefore: dbTrade.emotion_before || 'Calm',
      emotionAfter: dbTrade.emotion_after || 'Happy',
      mistakes: dbTrade.mistakes || '',
      preNotes: dbTrade.pre_notes || '',
      postNotes: dbTrade.post_notes || '',
      screenshots: (dbTrade.trade_screenshots || []).map((s: any) => ({
        dataUrl: s.url,
        name: s.name || 'screenshot'
      }))
    };
  };

  // Fetch accounts & strategies & trades when user changes
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const loadData = async () => {
      try {
        const { accounts: dbAccounts, strategies: dbStrategies, trades: dbTrades } = await bootstrap();

        const formattedAccounts: Account[] = dbAccounts.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type as Account['type'],
          color: a.color
        }));

        setAccounts(formattedAccounts);

        const savedAccId = localStorage.getItem('tv_curAcc');
        const activeAcc = formattedAccounts.find(a => a.id === savedAccId) || formattedAccounts[0];
        setCurrentAccId(activeAcc.id);
        localStorage.setItem('tv_curAcc', activeAcc.id);

        setStrategies(dbStrategies);
        setTrades(dbTrades.map(mapDbTrade));
      } catch (err: any) {
        console.error('Error loading data from the local server:', err);
        showToast('Error syncing with the local server: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // Keyed on the id so a second setUser() with an equivalent user does not refetch everything.
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const signedInUser = await auth.signIn(email, password);
    setAuthError(null);
    setUser(signedInUser);
  };

  const signUp = async (email: string, password: string) => {
    const signedUpUser = await auth.signUp(email, password);
    setAuthError(null);
    setUser(signedUpUser);
  };

  // Account actions
  const addAccount = async (name: string, type: Account['type'], color: string) => {
    if (!user) return;
    try {
      const data = await accountsApi.create({ name, type, color });
      const newAcc: Account = { id: data.id, name: data.name, type: data.type, color: data.color };
      setAccounts(prev => [...prev, newAcc]);
      showToast('Account added!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const renameAccount = async (id: string, name: string) => {
    if (!user) return;
    try {
      await accountsApi.rename(id, name);
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, name } : a));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const deleteAccount = async (id: string) => {
    if (!user) return;
    if (accounts.length <= 1) {
      showToast('Cannot delete the only account', 'error');
      return;
    }
    try {
      await accountsApi.remove(id);

      const remaining = accounts.filter(a => a.id !== id);
      setAccounts(remaining);
      if (currentAccId === id) {
        setCurrentAccId(remaining[0].id);
        localStorage.setItem('tv_curAcc', remaining[0].id);
      }
      showToast('Account deleted');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Strategy actions
  const addStrategy = async (name: string) => {
    if (!user) return;
    if (strategies.includes(name)) {
      showToast('Strategy already exists', 'error');
      return;
    }
    try {
      await strategiesApi.create(name);
      setStrategies(prev => [...prev, name]);
      showToast('Strategy added!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const deleteStrategy = async (name: string) => {
    if (!user) return;
    try {
      await strategiesApi.remove(name);
      setStrategies(prev => prev.filter(s => s !== name));
      showToast('Strategy removed');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  /** Builds the snake_case API payload shared by addTrade/updateTrade for a full trade. */
  const toTradePayload = (t: Omit<Trade, 'id'>) => ({
    account_id: t.accountId,
    date: t.date,
    instrument: t.instrument,
    direction: t.direction,
    session: t.session,
    entry: t.entry ? parseFloat(t.entry) : null,
    exit_price: t.exit ? parseFloat(t.exit) : null,
    sl: t.sl ? parseFloat(t.sl) : null,
    tp: t.tp ? parseFloat(t.tp) : null,
    lots: t.lots ? parseFloat(t.lots) : null,
    pl: t.pl,
    risk: t.risk ? parseFloat(t.risk) : null,
    rr: t.rr ? parseFloat(t.rr) : null,
    setup: t.setup,
    result: t.result,
    grade: t.grade,
    emotion_before: t.emotionBefore,
    emotion_after: t.emotionAfter,
    mistakes: t.mistakes,
    pre_notes: t.preNotes,
    post_notes: t.postNotes,
    screenshots: (t.screenshots || []).map(s => ({ url: s.dataUrl, name: s.name }))
  });

  // Trade actions
  const addTrade = async (newTradeData: Omit<Trade, 'id'>) => {
    if (!user) return;
    try {
      const dbTrade = await tradesApi.create(toTradePayload(newTradeData));
      setTrades(prev => [mapDbTrade(dbTrade), ...prev]);
      showToast('Trade saved!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const updateTrade = async (id: string, updatedFields: Partial<Trade>) => {
    if (!user) return;
    try {
      // Prepare payload mapping camelCase fields to snake_case
      const payload: any = {};
      if (updatedFields.accountId !== undefined) payload.account_id = updatedFields.accountId;
      if (updatedFields.date !== undefined) payload.date = updatedFields.date;
      if (updatedFields.instrument !== undefined) payload.instrument = updatedFields.instrument;
      if (updatedFields.direction !== undefined) payload.direction = updatedFields.direction;
      if (updatedFields.session !== undefined) payload.session = updatedFields.session;
      if (updatedFields.entry !== undefined) payload.entry = updatedFields.entry ? parseFloat(updatedFields.entry) : null;
      if (updatedFields.exit !== undefined) payload.exit_price = updatedFields.exit ? parseFloat(updatedFields.exit) : null;
      if (updatedFields.sl !== undefined) payload.sl = updatedFields.sl ? parseFloat(updatedFields.sl) : null;
      if (updatedFields.tp !== undefined) payload.tp = updatedFields.tp ? parseFloat(updatedFields.tp) : null;
      if (updatedFields.lots !== undefined) payload.lots = updatedFields.lots ? parseFloat(updatedFields.lots) : null;
      if (updatedFields.pl !== undefined) payload.pl = updatedFields.pl;
      if (updatedFields.risk !== undefined) payload.risk = updatedFields.risk ? parseFloat(updatedFields.risk) : null;
      if (updatedFields.rr !== undefined) payload.rr = updatedFields.rr ? parseFloat(updatedFields.rr) : null;
      if (updatedFields.setup !== undefined) payload.setup = updatedFields.setup;
      if (updatedFields.result !== undefined) payload.result = updatedFields.result;
      if (updatedFields.grade !== undefined) payload.grade = updatedFields.grade;
      if (updatedFields.emotionBefore !== undefined) payload.emotion_before = updatedFields.emotionBefore;
      if (updatedFields.emotionAfter !== undefined) payload.emotion_after = updatedFields.emotionAfter;
      if (updatedFields.mistakes !== undefined) payload.mistakes = updatedFields.mistakes;
      if (updatedFields.preNotes !== undefined) payload.pre_notes = updatedFields.preNotes;
      if (updatedFields.postNotes !== undefined) payload.post_notes = updatedFields.postNotes;
      if (updatedFields.screenshots !== undefined) {
        payload.screenshots = updatedFields.screenshots.map(s => ({ url: s.dataUrl, name: s.name }));
      }

      const dbTrade = await tradesApi.update(id, payload);
      const updated = mapDbTrade(dbTrade);
      setTrades(prev => prev.map(t => t.id === id ? updated : t));
      showToast('Trade updated!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const deleteTrade = async (id: string) => {
    if (!user) return;
    try {
      await tradesApi.remove(id);
      setTrades(prev => prev.filter(t => t.id !== id));
      showToast('Trade deleted');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const bulkDeleteTrades = async (ids: string[]) => {
    if (!user) return;
    try {
      await tradesApi.bulkDelete(ids);
      setTrades(prev => prev.filter(t => !ids.includes(t.id)));
      showToast(`Deleted ${ids.length} trades`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  /** Adds a strategy if the list does not already carry it. Used by the importer. */
  const ensureStrategy = async (name: string) => {
    const trimmed = name.trim();
    if (!user || !trimmed || strategies.includes(trimmed)) return;
    try {
      await strategiesApi.create(trimmed);
      setStrategies(prev => [...prev, trimmed]);
    } catch {
      // A missing strategy only affects the Trade Form dropdown; the trade still saves
      // with it as free text, so this is not worth failing an import over.
    }
  };

  /**
   * Writes a batch of confirmed trades, each with the screenshot it was paired with.
   *
   * One trade at a time, so progress is honest and the uploads folder is not swamped. A
   * bad row never takes the batch down - its error is collected and the run carries on.
   * When an upload fails the trade is still saved and the failure reported: losing a
   * trade to save an image would be the wrong way round, and the image can be attached
   * later by editing the trade.
   */
  const importTrades = async (
    items: ImportItem[],
    onProgress?: (done: number, total: number) => void
  ): Promise<ImportOutcome> => {
    const outcome: ImportOutcome = { imported: 0, screenshotsAttached: 0, failures: [] };
    if (!user) {
      outcome.failures.push({ ref: 0, error: 'Not signed in' });
      return outcome;
    }

    const created: Trade[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const t = item.trade;
      try {
        let screenshotUrl: string | null = null;
        let screenshotError: string | null = null;
        if (item.file) {
          try {
            screenshotUrl = await uploadScreenshot(item.file);
          } catch (shotErr: any) {
            screenshotError = shotErr.message || String(shotErr);
          }
        }

        const dbTrade = await tradesApi.create({
          account_id: item.accountId,
          date: t.date,
          instrument: t.instrument,
          direction: t.direction,
          session: t.session,
          entry: t.entry,
          exit_price: t.exit_price,
          sl: t.sl,
          tp: t.tp,
          lots: t.lots,
          pl: t.pl,
          risk: t.risk,
          rr: t.rr,
          setup: t.setup,
          result: t.result,
          // grade, emotion_* and the note columns are left unset on purpose. grade in
          // particular carries a CHECK constraint of 'A'..'F', which an empty string
          // would violate - NULL is the only valid "not recorded".
          grade: null,
          emotion_before: null,
          emotion_after: null,
          mistakes: null,
          pre_notes: null,
          post_notes: null,
          screenshots: screenshotUrl && item.file ? [{ url: screenshotUrl, name: item.file.name }] : []
        });

        if (screenshotUrl) outcome.screenshotsAttached++;
        if (screenshotError) {
          outcome.failures.push({
            ref: item.ref,
            error: `Trade saved, but the screenshot could not be attached: ${screenshotError}`
          });
        }

        created.push(mapDbTrade(dbTrade));
        outcome.imported++;
      } catch (err: any) {
        outcome.failures.push({ ref: item.ref, error: err.message || String(err) });
      }

      onProgress?.(i + 1, items.length);
    }

    if (created.length > 0) setTrades(prev => [...created, ...prev]);
    return outcome;
  };

  const signOut = async () => {
    await auth.signOut();
    // Auto sign-in only runs once per page load (see the session-bootstrap effect above),
    // so signing out here sticks until the page is reloaded rather than being immediately
    // undone by a fresh auto sign-in.
    setUser(null);
    setAccounts([]);
    setTrades([]);
  };

  const seedDemoData = async () => {
    if (!user || accounts.length === 0) return;
    setLoading(true);
    try {
      const demoAccount = accounts[0];
      const demoTradesToInsert = [];
      const now = new Date();

      // Seed 10 trades spaced over the last few days
      for (let i = 0; i < 10; i++) {
        const tradeDate = new Date(now);
        tradeDate.setDate(now.getDate() - i);
        const isWin = Math.random() > 0.4;
        const pl = isWin ? (Math.random() * 500 + 100) : -(Math.random() * 300 + 50);

        demoTradesToInsert.push({
          account_id: demoAccount.id,
          date: tradeDate.toISOString(),
          instrument: ['EURUSD', 'GBPUSD', 'NAS100', 'XAUUSD', 'BTCUSD'][Math.floor(Math.random() * 5)],
          direction: Math.random() > 0.5 ? 'Long' : 'Short',
          session: ['London', 'New York', 'Asia'][Math.floor(Math.random() * 3)],
          entry: (1.1000 + Math.random() * 0.05).toFixed(4),
          exit_price: (1.1000 + Math.random() * 0.05).toFixed(4),
          sl: '1.0950',
          tp: '1.1100',
          lots: (Math.random() * 2 + 0.5).toFixed(2),
          pl: parseFloat(pl.toFixed(2)),
          risk: '150',
          rr: (1.5 + Math.random() * 2).toFixed(1),
          setup: DEFAULT_STRATEGIES[Math.floor(Math.random() * DEFAULT_STRATEGIES.length)],
          result: isWin ? 'Win' : 'Loss',
          grade: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
          emotion_before: 'Focused',
          emotion_after: isWin ? 'Satisfied' : 'Disappointed',
          mistakes: isWin ? '' : 'FOMO Entry',
          pre_notes: 'Standard setup according to rules.',
          post_notes: isWin ? 'Target hit smoothly.' : 'Stop loss hit. Need to manage entry better.'
        });
      }

      const dbTrades = await tradesApi.bulkCreate(demoTradesToInsert);
      const formatted = dbTrades.map(mapDbTrade);
      setTrades(prev => [...formatted, ...prev]);
      showToast('Demo data seeded!');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      loading,
      authError,
      page,
      setPage,
      accounts,
      currentAccId,
      setCurrentAccId,
      trades,
      strategies,
      theme,
      toggleTheme,
      toast,
      showToast,
      signIn,
      signUp,
      addAccount,
      renameAccount,
      deleteAccount,
      addStrategy,
      deleteStrategy,
      addTrade,
      updateTrade,
      deleteTrade,
      bulkDeleteTrades,
      importTrades,
      ensureStrategy,
      signOut,
      seedDemoData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
