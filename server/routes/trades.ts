import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/connection.ts';
import { requireAuth } from '../auth.ts';
import { ah, HttpError } from '../utils.ts';

export const tradesRouter = Router();

const TRADE_FIELDS = [
  'account_id', 'date', 'instrument', 'direction', 'session', 'entry', 'exit_price',
  'sl', 'tp', 'lots', 'pl', 'risk', 'rr', 'setup', 'result', 'grade',
  'emotion_before', 'emotion_after', 'mistakes', 'pre_notes', 'post_notes'
] as const;

const getTradesStmt = db.prepare('SELECT * FROM trades WHERE user_id = ? ORDER BY date DESC');
const getTradeStmt = db.prepare('SELECT * FROM trades WHERE id = ? AND user_id = ?');
const getScreenshotsForTradesStmt = (ids: string[]) =>
  db.prepare(`SELECT * FROM trade_screenshots WHERE trade_id IN (${ids.map(() => '?').join(',')})`);
const insertScreenshotStmt = db.prepare(
  'INSERT INTO trade_screenshots (id, trade_id, url, name) VALUES (?, ?, ?, ?)'
);
const deleteScreenshotsForTradeStmt = db.prepare('DELETE FROM trade_screenshots WHERE trade_id = ?');
const deleteTradeStmt = db.prepare('DELETE FROM trades WHERE id = ? AND user_id = ?');

/** Fetches trades for a user (or a specific set of ids) with their screenshots attached. */
export function getTradesWithScreenshots(userId: string, ids?: string[]): any[] {
  const trades = ids
    ? (ids.map(id => getTradeStmt.get(id, userId)).filter(Boolean) as any[])
    : (getTradesStmt.all(userId) as any[]);

  if (trades.length === 0) return trades;

  const shots = getScreenshotsForTradesStmt(trades.map(t => t.id)).all(...trades.map(t => t.id)) as any[];
  const byTrade = new Map<string, any[]>();
  for (const s of shots) {
    if (!byTrade.has(s.trade_id)) byTrade.set(s.trade_id, []);
    byTrade.get(s.trade_id)!.push(s);
  }

  return trades.map(t => ({ ...t, trade_screenshots: byTrade.get(t.id) || [] }));
}

function insertTrade(userId: string, body: any): string {
  const id = randomUUID();
  const values = TRADE_FIELDS.map(f => body[f] ?? null);
  db.prepare(
    `INSERT INTO trades (id, user_id, ${TRADE_FIELDS.join(', ')}) VALUES (?, ?, ${TRADE_FIELDS.map(() => '?').join(', ')})`
  ).run(id, userId, ...values);
  return id;
}

function insertScreenshots(tradeId: string, screenshots: { url: string; name?: string }[] | undefined) {
  if (!screenshots || screenshots.length === 0) return;
  for (const s of screenshots) {
    insertScreenshotStmt.run(randomUUID(), tradeId, s.url, s.name || null);
  }
}

tradesRouter.post('/', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;
  const body = req.body || {};
  if (!body.date || !body.instrument || !body.direction || !body.result || body.pl === undefined) {
    throw new HttpError(400, 'Missing required trade fields');
  }

  const id = insertTrade(userId, body);
  insertScreenshots(id, body.screenshots);

  const [trade] = getTradesWithScreenshots(userId, [id]);
  res.json(trade);
}));

tradesRouter.post('/bulk', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;
  const rows: any[] = req.body?.trades || [];
  const ids = rows.map(row => insertTrade(userId, row));
  res.json(getTradesWithScreenshots(userId, ids));
}));

tradesRouter.post('/bulk-delete', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;
  const ids: string[] = req.body?.ids || [];
  const stmt = db.prepare('DELETE FROM trades WHERE id = ? AND user_id = ?');
  for (const id of ids) stmt.run(id, userId);
  res.json({ ok: true });
}));

tradesRouter.patch('/:id', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;
  const { id } = req.params;
  const body = req.body || {};

  const existing = getTradeStmt.get(id, userId);
  if (!existing) throw new HttpError(404, 'Trade not found');

  const fieldsToUpdate = TRADE_FIELDS.filter(f => body[f] !== undefined);
  if (fieldsToUpdate.length > 0) {
    const setClause = fieldsToUpdate.map(f => `${f} = ?`).join(', ');
    db.prepare(`UPDATE trades SET ${setClause} WHERE id = ? AND user_id = ?`)
      .run(...fieldsToUpdate.map(f => body[f]), id, userId);
  }

  if (body.screenshots !== undefined) {
    deleteScreenshotsForTradeStmt.run(id);
    insertScreenshots(id, body.screenshots);
  }

  const [trade] = getTradesWithScreenshots(userId, [id]);
  res.json(trade);
}));

tradesRouter.delete('/:id', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;
  deleteTradeStmt.run(req.params.id, userId);
  res.json({ ok: true });
}));
