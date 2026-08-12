/**
 * Backs up the local database and the uploaded screenshots into a timestamped folder.
 *
 * Safe to run while the app is running: the database is copied with SQLite's VACUUM INTO,
 * which writes a consistent snapshot rather than a half-written file the way a plain file
 * copy can when the server happens to be mid-write.
 *
 * Usage:
 *   npm run backup                       # -> backups/2026-08-12_1430/
 *   BACKUP_DIR=D:/my-backups npm run backup
 *   KEEP=20 npm run backup               # keep the 20 most recent (default 10)
 *
 * Put BACKUP_DIR on a different drive (or a synced folder like OneDrive/Google Drive) if
 * you want the backup to survive this machine's disk failing.
 */
import 'dotenv/config';
import { existsSync, mkdirSync, cpSync, statSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATABASE_PATH = process.env.DATABASE_PATH || 'server/data/trading-journal.db';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'server/uploads';
const BACKUP_DIR = process.env.BACKUP_DIR || 'backups';
const KEEP = Number(process.env.KEEP) || 10;

/** 2026-08-12_1430 - sorts chronologically as plain text, which the rotation relies on. */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function dirSize(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true }).reduce((total, e) => {
    const full = join(dir, e.name);
    return total + (e.isDirectory() ? dirSize(full) : statSync(full).size);
  }, 0);
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

if (!existsSync(DATABASE_PATH)) {
  console.error(`No database at ${DATABASE_PATH}. Run 'npm run db:migrate' first.`);
  process.exit(1);
}

const target = join(BACKUP_DIR, stamp());
if (existsSync(target)) {
  console.error(`${target} already exists - wait a minute and run again.`);
  process.exit(1);
}
mkdirSync(target, { recursive: true });

// 1. Database. VACUUM INTO also compacts, so the copy is usually smaller than the original.
const db = new DatabaseSync(DATABASE_PATH, { readOnly: true });
const dbTarget = join(target, 'trading-journal.db');
db.exec(`VACUUM INTO '${dbTarget.replace(/\\/g, '/').replace(/'/g, "''")}'`);

const counts = ['users', 'accounts', 'strategies', 'trades', 'trade_screenshots']
  .map(t => `${t}=${(db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as any).c}`)
  .join(' ');
db.close();

// 2. Screenshots.
let shotCount = 0;
if (existsSync(UPLOAD_DIR)) {
  cpSync(UPLOAD_DIR, join(target, 'uploads'), { recursive: true });
  shotCount = readdirSync(join(target, 'uploads')).filter(f => f !== '.gitkeep').length;
}

console.log(`Backup written to ${target}`);
console.log(`  database:    ${mb(statSync(dbTarget).size)}  (${counts})`);
console.log(`  screenshots: ${shotCount} files, ${mb(dirSize(join(target, 'uploads')))}`);

// 3. Rotate - drop the oldest once there are more than KEEP.
const all = readdirSync(BACKUP_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(e.name))
  .map(e => e.name)
  .sort();

for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
  rmSync(join(BACKUP_DIR, old), { recursive: true, force: true });
  console.log(`  removed old backup: ${old}`);
}
console.log(`  ${Math.min(all.length, KEEP)} backup(s) kept in ${BACKUP_DIR}`);
