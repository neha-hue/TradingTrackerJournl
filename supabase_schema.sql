-- Supabase Database Schema for TradeVault Pro

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Live', 'Prop', 'Demo', 'Other')),
  color TEXT NOT NULL DEFAULT '#10d982',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Strategies table
CREATE TABLE IF NOT EXISTS strategies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  date TIMESTAMPTZ NOT NULL,
  instrument TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('Long', 'Short')),
  session TEXT CHECK (session IN ('Asia', 'London', 'New York', 'Other')),
  entry NUMERIC,
  exit_price NUMERIC,
  sl NUMERIC,
  tp NUMERIC,
  lots NUMERIC,
  pl NUMERIC NOT NULL,
  risk NUMERIC,
  rr NUMERIC,
  setup TEXT, -- strategy name
  result TEXT NOT NULL CHECK (result IN ('Win', 'Loss', 'Break Even')),
  grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
  emotion_before TEXT,
  emotion_after TEXT,
  mistakes TEXT,
  pre_notes TEXT,
  post_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trade screenshots table
CREATE TABLE IF NOT EXISTS trade_screenshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  url TEXT NOT NULL, -- can be base64 data URL or storage bucket URL
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_screenshots ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Accounts policies
CREATE POLICY "Users can manage their own accounts" ON accounts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Strategies policies
CREATE POLICY "Users can manage their own strategies" ON strategies
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trades policies
CREATE POLICY "Users can manage their own trades" ON trades
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trade screenshots policies
CREATE POLICY "Users can manage screenshots of their own trades" ON trade_screenshots
  FOR ALL TO authenticated
  USING (trade_id IN (SELECT id FROM trades WHERE user_id = auth.uid()))
  WITH CHECK (trade_id IN (SELECT id FROM trades WHERE user_id = auth.uid()));
