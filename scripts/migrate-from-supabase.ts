/**
 * One-off migration: copies accounts, strategies, trades and screenshots out of the old
 * Supabase project into the local SQLite database, downloading each screenshot from
 * Supabase Storage into UPLOAD_DIR so nothing depends on Supabase afterwards.
 *
 * Safe to re-run: rows keep their original Supabase UUIDs as local primary keys, and every
 * insert is INSERT OR IGNORE, so a second run re-downloads nothing and duplicates nothing.
 *
 * Usage (credentials are read from the environment and never written to disk):
 *
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_ANON_KEY=<anon key> \
 *   SUPABASE_EMAIL=<email> \
 *   SUPABASE_PASSWORD=<password> \
 *   LOCAL_EMAIL=<email of the local account to import into> \
 *   npx tsx scripts/migrate-from-supabase.ts
 */
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { db } from '../server/db/connection.ts';

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_EMAIL,
  SUPABASE_PASSWORD,
  LOCAL_EMAIL
} = process.env;

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'server/uploads';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_EMAIL || !SUPABASE_PASSWORD || !LOCAL_EMAIL) {
  console.error('Missing required env vars. See the usage comment at the top of this file.');
  process.exit(1);
}

async function main() {
  // 1. Sign in - the tables are behind RLS, so an anonymous read returns nothing.
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SUPABASE_EMAIL, password: SUPABASE_PASSWORD })
  });
  const authBody = await authRes.json() as any;
  if (!authBody.access_token) throw new Error(`Supabase sign-in failed: ${JSON.stringify(authBody)}`);
  const token = authBody.access_token;

  const fetchTable = async (table: string) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` }
    });
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(`Reading ${table} failed: ${JSON.stringify(rows)}`);
    return rows as any[];
  };

  const [accounts, strategies, trades, screenshots] = await Promise.all(
    ['accounts', 'strategies', 'trades', 'trade_screenshots'].map(fetchTable)
  );
  console.log(`Fetched: ${accounts.length} accounts, ${strategies.length} strategies, ` +
              `${trades.length} trades, ${screenshots.length} screenshots`);

  // 2. Resolve the local user that owns the imported data.
  const localUser = db.prepare('SELECT id FROM users WHERE email = ?').get(LOCAL_EMAIL) as { id: string } | undefined;
  if (!localUser) throw new Error(`No local user '${LOCAL_EMAIL}'. Open the app once to create it, then re-run.`);
  const userId = localUser.id;

  // 3. Drop the empty accounts the app auto-seeds on first launch when an incoming account
  //    has the same name, so the import does not leave visible duplicates. Only ever
  //    removes accounts with no trades, so real data can never be lost here.
  const dropDefault = db.prepare(`
    DELETE FROM accounts
    WHERE user_id = ? AND name = ? AND id NOT IN (SELECT DISTINCT account_id FROM trades WHERE account_id IS NOT NULL)
      AND id != ?
  `);
  for (const a of accounts) dropDefault.run(userId, a.name, a.id);

  // 4. Insert everything, preserving the original UUIDs so trades.account_id still resolves.
  const insAccount = db.prepare(
    'INSERT OR IGNORE INTO accounts (id, user_id, name, type, color, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  let accountsAdded = 0;
  for (const a of accounts) {
    accountsAdded += insAccount.run(a.id, userId, a.name, a.type, a.color, a.created_at ?? null).changes;
  }

  const insStrategy = db.prepare(
    'INSERT OR IGNORE INTO strategies (id, user_id, name, created_at) VALUES (?, ?, ?, ?)'
  );
  let strategiesAdded = 0;
  for (const s of strategies) {
    strategiesAdded += insStrategy.run(s.id, userId, s.name, s.created_at ?? null).changes;
  }

  const TRADE_COLS = [
    'account_id', 'date', 'instrument', 'direction', 'session', 'entry', 'exit_price',
    'sl', 'tp', 'lots', 'pl', 'risk', 'rr', 'setup', 'result', 'grade',
    'emotion_before', 'emotion_after', 'mistakes', 'pre_notes', 'post_notes', 'created_at'
  ];
  const insTrade = db.prepare(
    `INSERT OR IGNORE INTO trades (id, user_id, ${TRADE_COLS.join(', ')})
     VALUES (?, ?, ${TRADE_COLS.map(() => '?').join(', ')})`
  );
  let tradesAdded = 0;
  for (const t of trades) {
    tradesAdded += insTrade.run(t.id, userId, ...TRADE_COLS.map(c => t[c] ?? null)).changes;
  }

  // 5. Pull each screenshot down from Storage so the images survive without Supabase.
  await mkdir(UPLOAD_DIR, { recursive: true });
  const insShot = db.prepare(
    'INSERT OR IGNORE INTO trade_screenshots (id, trade_id, url, name, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const existsShot = db.prepare('SELECT 1 FROM trade_screenshots WHERE id = ?');

  let downloaded = 0, kept = 0, failed = 0;
  for (const [i, s] of screenshots.entries()) {
    if (existsShot.get(s.id)) { kept++; continue; }

    let url: string = s.url;
    if (/^https?:/.test(s.url)) {
      try {
        const res = await fetch(s.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const name = basename(new URL(s.url).pathname) || `${s.id}.png`;
        await writeFile(join(UPLOAD_DIR, name), Buffer.from(await res.arrayBuffer()));
        url = `/uploads/${name}`;
        downloaded++;
      } catch (err: any) {
        // Keep the remote URL rather than dropping the image: it still renders while the
        // Supabase project is up, and the trade itself is what matters most.
        failed++;
        console.warn(`  ! screenshot ${s.id} download failed (${err.message}); kept remote URL`);
      }
    }
    // data: URLs are already self-contained and are carried over untouched.

    insShot.run(s.id, s.trade_id, url, s.name ?? null, s.created_at ?? null);
    if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${screenshots.length} screenshots`);
  }

  console.log('\nImported into the local database:');
  console.log(`  accounts:   +${accountsAdded}`);
  console.log(`  strategies: +${strategiesAdded}`);
  console.log(`  trades:     +${tradesAdded}`);
  console.log(`  screenshots: ${downloaded} downloaded, ${kept} already present, ${failed} kept as remote URLs`);
}

main().catch(err => { console.error(err); process.exit(1); });
