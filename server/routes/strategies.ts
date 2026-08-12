import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/connection.ts';
import { requireAuth } from '../auth.ts';
import { ah, HttpError } from '../utils.ts';

export const strategiesRouter = Router();

const insertStrategy = db.prepare('INSERT INTO strategies (id, user_id, name) VALUES (?, ?, ?)');
const deleteStrategyStmt = db.prepare('DELETE FROM strategies WHERE user_id = ? AND name = ?');

strategiesRouter.post('/', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;
  const { name } = req.body || {};
  if (!name) throw new HttpError(400, 'Missing strategy name');

  try {
    insertStrategy.run(randomUUID(), userId, name);
  } catch {
    throw new HttpError(400, 'Strategy already exists');
  }
  res.json({ name });
}));

strategiesRouter.delete('/:name', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;
  deleteStrategyStmt.run(userId, req.params.name);
  res.json({ ok: true });
}));
