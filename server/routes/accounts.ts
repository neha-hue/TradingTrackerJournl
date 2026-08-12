import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/connection.ts';
import { requireAuth } from '../auth.ts';
import { ah, HttpError } from '../utils.ts';

export const accountsRouter = Router();

const insertAccount = db.prepare(
  'INSERT INTO accounts (id, user_id, name, type, color) VALUES (?, ?, ?, ?, ?)'
);
const getAccount = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?');
const renameAccountStmt = db.prepare('UPDATE accounts SET name = ? WHERE id = ? AND user_id = ?');
const deleteAccountStmt = db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?');

accountsRouter.post('/', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;
  const { name, type, color } = req.body || {};
  if (!name || !type || !color) throw new HttpError(400, 'Missing account fields');

  const id = randomUUID();
  insertAccount.run(id, userId, name, type, color);
  res.json(getAccount.get(id, userId));
}));

accountsRouter.patch('/:id', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;
  const { name } = req.body || {};
  if (!name) throw new HttpError(400, 'Missing name');

  renameAccountStmt.run(name, req.params.id, userId);
  const account = getAccount.get(req.params.id, userId);
  if (!account) throw new HttpError(404, 'Account not found');
  res.json(account);
}));

accountsRouter.delete('/:id', requireAuth, ah(async (req, res) => {
  const userId = req.session.userId!;
  deleteAccountStmt.run(req.params.id, userId);
  res.json({ ok: true });
}));
