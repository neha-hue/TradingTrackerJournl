import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  supabase,
  AUTO_LOGIN_EMAIL,
  AUTO_LOGIN_PASSWORD,
  AUTO_LOGIN_ENABLED
} from '../lib/supabase';
import { Account, Trade, Screenshot } from '../lib/types';
import { uploadScreenshot } from '../lib/storage';
import { TradeDraft } from '../lib/importer/types';
import { User } from '@supabase/supabase-js';

interface Toast {
  msg: string;
  type: 'success' | 'error';
}

interface AppContextType {
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const autoLoginRef = useRef<Promise<void> | null>(null);
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

  // Silently sign into the single owner account. Runs at most once per page load;
  // the resolved session arrives via onAuthStateChange below.
  const ensureSignedIn = () => {
    if (autoLoginRef.current) return autoLoginRef.current;

    autoLoginRef.current = (async () => {
      if (!AUTO_LOGIN_ENABLED) {
        // Expected on the deployed site - fall through to the login screen.
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: AUTO_LOGIN_EMAIL,
        password: AUTO_LOGIN_PASSWORD
      });
      if (data?.session) return;

      // Deliberately no signUp() fallback here: on a wrong password Supabase would try to
      // send a confirmation email and fail with "email rate limit exceeded", hiding the
      // real cause. Create the account once in the Supabase dashboard instead.
      setAuthError(
        `${error?.message || 'Auto sign-in failed'} (${AUTO_LOGIN_EMAIL})`
      );
      setLoading(false);
    })();

    return autoLoginRef.current;
  };

  // Listen for Auth status changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setAccounts([]);
        setTrades([]);
        void ensureSignedIn();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
      } else {
        void ensureSignedIn();
      }
    });

    return () => subscription.unsubscribe();
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
        // Fetch accounts
        let { data: dbAccounts, error: accError } = await supabase
          .from('accounts')
          .select('*')
          .order('name');

        if (accError) throw accError;

        // If no accounts exist for the user, create default ones
        if (!dbAccounts || dbAccounts.length === 0) {
          const defaultAccs = [
            { user_id: user.id, name: 'Live Account', type: 'Live' as const, color: '#10d982' },
            { user_id: user.id, name: 'Prop Firm', type: 'Prop' as const, color: '#4f6ef7' }
          ];
          const { data: inserted, error: insertError } = await supabase
            .from('accounts')
            .insert(defaultAccs)
            .select();

          if (insertError) throw insertError;
          dbAccounts = inserted;
        }

        const formattedAccounts: Account[] = (dbAccounts || []).map(a => ({
          id: a.id,
          name: a.name,
          type: a.type as Account['type'],
          color: a.color
        }));

        setAccounts(formattedAccounts);

        // Set current account ID
        const savedAccId = localStorage.getItem('tv_curAcc');
        const activeAcc = formattedAccounts.find(a => a.id === savedAccId) || formattedAccounts[0];
        setCurrentAccId(activeAcc.id);
        localStorage.setItem('tv_curAcc', activeAcc.id);

        // Fetch strategies
        const { data: dbStrats, error: stratError } = await supabase
          .from('strategies')
          .select('name')
          .order('name');

        if (stratError) throw stratError;

        if (dbStrats && dbStrats.length > 0) {
          setStrategies(dbStrats.map(s => s.name));
        } else {
          // insert default strategies
          const defaultStrats = DEFAULT_STRATEGIES.map(name => ({ user_id: user.id, name }));
          await supabase.from('strategies').insert(defaultStrats);
          setStrategies(DEFAULT_STRATEGIES);
        }

        // Fetch trades
        const { data: dbTrades, error: tradeError } = await supabase
          .from('trades')
          .select(`
            *,
            trade_screenshots (*)
          `)
          .order('date', { ascending: false });

        if (tradeError) throw tradeError;

        const formattedTrades = (dbTrades || []).map(mapDbTrade);
        setTrades(formattedTrades);

      } catch (err: any) {
        console.error('Error loading data from Supabase:', err);
        showToast('Error syncing with Supabase: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // Keyed on the id so that a second setUser() with an equivalent session object
    // (getSession + onAuthStateChange both fire on load) does not refetch everything.
  }, [user?.id]);

  // Account actions
  const addAccount = async (name: string, type: Account['type'], color: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('accounts')
        .insert([{ user_id: user.id, name, type, color }])
        .select();

      if (error) throw error;
      if (data && data[0]) {
        const newAcc: Account = { id: data[0].id, name: data[0].name, type: data[0].type, color: data[0].color };
        setAccounts(prev => [...prev, newAcc]);
        showToast('Account added!');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const renameAccount = async (id: string, name: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ name })
        .eq('id', id);

      if (error) throw error;
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
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

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
      const { error } = await supabase
        .from('strategies')
        .insert([{ user_id: user.id, name }]);

      if (error) throw error;
      setStrategies(prev => [...prev, name]);
      showToast('Strategy added!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const deleteStrategy = async (name: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('strategies')
        .delete()
        .eq('name', name);

      if (error) throw error;
      setStrategies(prev => prev.filter(s => s !== name));
      showToast('Strategy removed');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Trade actions
  const addTrade = async (newTradeData: Omit<Trade, 'id'>) => {
    if (!user) return;
    try {
      // 1. Insert trade
      const { data: dbTrade, error } = await supabase
        .from('trades')
        .insert([{
          user_id: user.id,
          account_id: newTradeData.accountId,
          date: newTradeData.date,
          instrument: newTradeData.instrument,
          direction: newTradeData.direction,
          session: newTradeData.session,
          entry: newTradeData.entry ? parseFloat(newTradeData.entry) : null,
          exit_price: newTradeData.exit ? parseFloat(newTradeData.exit) : null,
          sl: newTradeData.sl ? parseFloat(newTradeData.sl) : null,
          tp: newTradeData.tp ? parseFloat(newTradeData.tp) : null,
          lots: newTradeData.lots ? parseFloat(newTradeData.lots) : null,
          pl: newTradeData.pl,
          risk: newTradeData.risk ? parseFloat(newTradeData.risk) : null,
          rr: newTradeData.rr ? parseFloat(newTradeData.rr) : null,
          setup: newTradeData.setup,
          result: newTradeData.result,
          grade: newTradeData.grade,
          emotion_before: newTradeData.emotionBefore,
          emotion_after: newTradeData.emotionAfter,
          mistakes: newTradeData.mistakes,
          pre_notes: newTradeData.preNotes,
          post_notes: newTradeData.postNotes
        }])
        .select()
        .single();

      if (error) throw error;

      // 2. Insert screenshots if any
      const screenshotsInserted: Screenshot[] = [];
      if (newTradeData.screenshots && newTradeData.screenshots.length > 0) {
        const shotRows = newTradeData.screenshots.map(s => ({
          trade_id: dbTrade.id,
          url: s.dataUrl,
          name: s.name
        }));

        const { data: dbShots, error: shotError } = await supabase
          .from('trade_screenshots')
          .insert(shotRows)
          .select();

        if (shotError) throw shotError;
        if (dbShots) {
          dbShots.forEach(s => screenshotsInserted.push({ dataUrl: s.url, name: s.name }));
        }
      }

      // Add to state
      const createdTrade: Trade = {
        ...newTradeData,
        id: dbTrade.id,
        screenshots: screenshotsInserted
      };

      setTrades(prev => [createdTrade, ...prev]);
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

      // Update trade in Supabase
      const { error } = await supabase
        .from('trades')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      // Handle screenshots updates if present in fields
      let finalScreenshots = updatedFields.screenshots;
      if (updatedFields.screenshots !== undefined) {
        // Delete all old screenshots for this trade
        await supabase
          .from('trade_screenshots')
          .delete()
          .eq('trade_id', id);

        if (updatedFields.screenshots.length > 0) {
          const shotRows = updatedFields.screenshots.map(s => ({
            trade_id: id,
            url: s.dataUrl,
            name: s.name
          }));
          const { data: dbShots, error: shotError } = await supabase
            .from('trade_screenshots')
            .insert(shotRows)
            .select();

          if (shotError) throw shotError;
          if (dbShots) {
            finalScreenshots = dbShots.map(s => ({ dataUrl: s.url, name: s.name }));
          }
        }
      }

      setTrades(prev => prev.map(t => {
        if (t.id === id) {
          const updated: Trade = { ...t, ...updatedFields };
          if (finalScreenshots !== undefined) {
            updated.screenshots = finalScreenshots;
          }
          return updated;
        }
        return t;
      }));

      showToast('Trade updated!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const deleteTrade = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTrades(prev => prev.filter(t => t.id !== id));
      showToast('Trade deleted');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const bulkDeleteTrades = async (ids: string[]) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .in('id', ids);

      if (error) throw error;
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
      const { error } = await supabase.from('strategies').insert([{ user_id: user.id, name: trimmed }]);
      if (error) throw error;
      setStrategies(prev => [...prev, trimmed]);
    } catch {
      // A missing strategy only affects the Trade Form dropdown; the trade still saves
      // with it as free text, so this is not worth failing an import over.
    }
  };

  /**
   * Writes a batch of confirmed trades, each with the screenshot it was paired with.
   *
   * One trade at a time, so progress is honest and Storage is not swamped. A bad row
   * never takes the batch down - its error is collected and the run carries on. When an
   * upload fails the trade is still saved and the failure reported: losing a trade to
   * save an image would be the wrong way round, and the image can be attached later by
   * editing the trade.
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
        const { data: dbTrade, error } = await supabase
          .from('trades')
          .insert([{
            user_id: user.id,
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
            post_notes: null
          }])
          .select()
          .single();

        if (error) throw error;

        const screenshots: Screenshot[] = [];
        if (item.file) {
          try {
            const url = await uploadScreenshot(item.file);
            // trade_screenshots RLS resolves through trades.user_id, so the trade has to
            // exist before its screenshot row can be written.
            const { error: shotError } = await supabase
              .from('trade_screenshots')
              .insert([{ trade_id: dbTrade.id, url, name: item.file.name }]);
            if (shotError) throw shotError;

            screenshots.push({ dataUrl: url, name: item.file.name });
            outcome.screenshotsAttached++;
          } catch (shotErr: any) {
            outcome.failures.push({
              ref: item.ref,
              error: `Trade saved, but the screenshot could not be attached: ${shotErr.message || shotErr}`
            });
          }
        }

        created.push({
          id: dbTrade.id,
          accountId: item.accountId,
          date: t.date,
          instrument: t.instrument,
          direction: t.direction,
          session: t.session,
          entry: t.entry?.toString() ?? '',
          exit: t.exit_price?.toString() ?? '',
          sl: t.sl?.toString() ?? '',
          tp: t.tp?.toString() ?? '',
          lots: t.lots?.toString() ?? '',
          pl: t.pl,
          risk: t.risk?.toString() ?? '',
          rr: t.rr?.toString() ?? '',
          setup: t.setup,
          result: t.result,
          grade: '',
          emotionBefore: '',
          emotionAfter: '',
          mistakes: '',
          preNotes: '',
          postNotes: '',
          screenshots
        });
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
    // Leave autoLoginRef resolved so the sign-out is not immediately undone by a
    // fresh auto sign-in; a page reload starts the cycle over.
    await supabase.auth.signOut();
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
          user_id: user.id,
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

      const { data: dbTrades, error: tradeInsertError } = await supabase
        .from('trades')
        .insert(demoTradesToInsert)
        .select();

      if (tradeInsertError) throw tradeInsertError;

      const formatted = (dbTrades || []).map(mapDbTrade);
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
