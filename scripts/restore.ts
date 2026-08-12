/**
 * Restores the database and screenshots from a backup made by scripts/backup.ts.
 *
 * Stop the server first (Ctrl+C in the `npm run dev` window). Windows will not let the
 * database file be overwritten while the server still has it open, and the restore fails
 * with EBUSY/EPERM rather than doing anything half-way.
 *
 * Usage:
 *   npm run restore                    # lists what is available
 *   npm run restore 2026-08-12_1430    # restores that backup
 *
 * The current database and uploads are themselves copied to backups/_before-restore-<stamp>/
 * first, so an accidental restore is always undoable.
 */
import 'dotenv/config';
import { existsSync, mkdirSync, cpSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATABASE_PATH = process.env.DATABASE_PATH || 'server/data/trading-journal.db';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'server/uploads';
const BACKUP_DIR = process.env.BACKUP_DIR || 'backups';

const which = process.argv[2];

function describe(dir: string): string {
  const dbFile = join(dir, 'trading-journal.db');
  if (!existsSync(dbFile)) return 'no database in this folder';
  try {
    const db = new DatabaseSync(dbFile, { readOnly: true });
    const trades = (db.prepare('SELECT COUNT(*) c FROM trades').get() as any).c;
    db.close();
    const shots = existsSync(join(dir, 'uploads'))
      ? readdirSync(join(dir, 'uploads')).filter(f => f !== '.gitkeep').length
      : 0;
    return `${trades} trades, ${shots} screenshots`;
  } catch (err: any) {
    return `unreadable (${err.message})`;
  }
}

const available = existsSync(BACKUP_DIR)
  ? readdirSync(BACKUP_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('_'))
      .map(e => e.name)
      .sort()
  : [];

if (!which) {
  if (available.length === 0) {
    console.log(`No backups in ${BACKUP_DIR}. Run 'npm run backup' first.`);
  } else {
    console.log('Available backups (newest last):\n');
    for (const name of available) console.log(`  ${name}   ${describe(join(BACKUP_DIR, name))}`);
    console.log(`\nRestore one with:  npm run restore ${available[available.length - 1]}`);
  }
  process.exit(0);
}

const source = join(BACKUP_DIR, which);
if (!existsSync(source)) {
  console.error(`No backup named '${which}' in ${BACKUP_DIR}.`);
  console.error(`Available: ${available.join(', ') || '(none)'}`);
  process.exit(1);
}
if (!existsSync(join(source, 'trading-journal.db'))) {
  console.error(`${source} has no trading-journal.db - refusing to restore from it.`);
  process.exit(1);
}

console.log(`Restoring from ${source}  (${describe(source)})`);

// 1. Preserve whatever is there now, so this is reversible.
const p = (n: number) => String(n).padStart(2, '0');
const d = new Date();
const safety = join(BACKUP_DIR, `_before-restore-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`);
mkdirSync(safety, { recursive: true });
if (existsSync(DATABASE_PATH)) cpSync(DATABASE_PATH, join(safety, 'trading-journal.db'));
if (existsSync(UPLOAD_DIR)) cpSync(UPLOAD_DIR, join(safety, 'uploads'), { recursive: true });
console.log(`  current state saved to ${safety}`);

// 2. Swap in the backup.
try {
  mkdirSync(join(DATABASE_PATH, '..'), { recursive: true });
  cpSync(join(source, 'trading-journal.db'), DATABASE_PATH);

  if (existsSync(join(source, 'uploads'))) {
    rmSync(UPLOAD_DIR, { recursive: true, force: true });
    cpSync(join(source, 'uploads'), UPLOAD_DIR, { recursive: true });
  }
} catch (err: any) {
  // Windows reports a sharing violation on the open database file inconsistently -
  // EBUSY, EPERM, EACCES and EPIPE have all been seen, so key off errno 32 too.
  const locked = ['EBUSY', 'EPERM', 'EACCES', 'EPIPE'].includes(err.code) || err.errno === 32;
  if (locked) {
    console.error(`\nCould not overwrite - the server still has the database open.`);
    console.error(`Stop it (Ctrl+C in the 'npm run dev' window, or: taskkill /F /IM node.exe)`);
    console.error(`and run this again.`);
    console.error(`\nNothing was changed. Your data is intact, and also copied to:`);
    console.error(`  ${safety}`);
    process.exit(1);
  }
  throw err;
}

const shots = existsSync(UPLOAD_DIR) ? readdirSync(UPLOAD_DIR).filter(f => f !== '.gitkeep').length : 0;
console.log(`\nRestored. Database ${(statSync(DATABASE_PATH).size / 1024).toFixed(0)} KB, ${shots} screenshots.`);
console.log(`Start the app again with 'npm run dev'.`);
