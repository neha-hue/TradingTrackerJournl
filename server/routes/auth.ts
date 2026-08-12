import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection.ts';
import { ah, HttpError } from '../utils.ts';

export const authRouter = Router();

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

const getUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const getUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const insertUser = db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');

// Off when the server is reachable from the internet (see npm run share), where an open
// registration endpoint would let anyone create accounts on this machine.
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP !== 'false';

authRouter.post('/signup', ah(async (req, res) => {
  if (!ALLOW_SIGNUP) throw new HttpError(403, 'Sign-ups are disabled on this server');

  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required');
  if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');

  const existing = getUserByEmail.get(email) as UserRow | undefined;
  if (existing) throw new HttpError(400, 'An account with this email already exists');

  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  insertUser.run(id, email, passwordHash);

  req.session.userId = id;
  res.json({ id, email });
}));

authRouter.post('/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const user = getUserByEmail.get(email) as UserRow | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new HttpError(400, 'Invalid email or password');
  }

  req.session.userId = user.id;
  res.json({ id: user.id, email: user.email });
}));

authRouter.post('/logout', ah(async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
}));

authRouter.get('/session', ah(async (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }
  const user = getUserById.get(req.session.userId) as UserRow | undefined;
  if (!user) {
    res.json({ user: null });
    return;
  }
  res.json({ user: { id: user.id, email: user.email } });
}));
