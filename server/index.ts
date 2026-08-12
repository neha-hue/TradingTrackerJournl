import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Importing this applies the schema before any router's top-level db.prepare() runs.
import './db/connection.ts';
import { authRouter } from './routes/auth.ts';
import { bootstrapRouter } from './routes/bootstrap.ts';
import { accountsRouter } from './routes/accounts.ts';
import { strategiesRouter } from './routes/strategies.ts';
import { tradesRouter } from './routes/trades.ts';
import { screenshotsRouter } from './routes/screenshots.ts';
import { HttpError } from './utils.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'server/uploads';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-secret-change-me';

const app = express();

app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

app.use('/uploads', express.static(UPLOAD_DIR));

app.use('/api/auth', authRouter);
app.use('/api/bootstrap', bootstrapRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/screenshots', screenshotsRouter);

// Serves the built frontend when running `npm run server` against a production build,
// so the whole app can run from this one process without the Vite dev server.
const distDir = path.join(here, '..', 'dist');
app.use(express.static(distDir));
app.get(/^(?!\/api|\/uploads).*/, (_req, res, next) => {
  res.sendFile(path.join(distDir, 'index.html'), err => { if (err) next(); });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Internal server error';
  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
