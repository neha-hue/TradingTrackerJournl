import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/connection.ts';
import { requireAuth } from '../auth.ts';
import { ah } from '../utils.ts';
import { DEFAULT_STRATEGIES } from '../constants.ts';
import { getTradesWithScreenshots } from './trades.ts';

export const bootstrapRouter = Router();

const getAccounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY name');
const insertAccount = db.prepare(
  'INSERT INTO accounts (id, user_id, name, type, color) VALUES (?, ?, ?, ?, ?)'
);
const getStrategies = db.prepare('SELECT name FROM strategies WHERE user_id = ? ORDER BY name');
const insertStrategy = db.prepare('INSERT INTO strategies (id, user_id, name) VALUES (?, ?, ?)');

bootstrapRouter.get('/', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;

  let accounts = getAccounts.all(userId) as any[];
  if (accounts.length === 0) {
    const defaults: [string, string][] = [
      ['Live Account', 'Live'],
      ['Prop Firm', 'Prop']
    ];
    const colors: Record<string, string> = { Live: '#10d982', Prop: '#4f6ef7' };
    for (const [name, type] of defaults) {
      insertAccount.run(randomUUID(), userId, name, type, colors[type]);
    }
    accounts = getAccounts.all(userId) as any[];
  }

  let strategies = (getStrategies.all(userId) as { name: string }[]).map(s => s.name);
  if (strategies.length === 0) {
    for (const name of DEFAULT_STRATEGIES) {
      insertStrategy.run(randomUUID(), userId, name);
    }
    strategies = DEFAULT_STRATEGIES;
  }

  const trades = getTradesWithScreenshots(userId);

  res.json({ accounts, strategies, trades });
}));
