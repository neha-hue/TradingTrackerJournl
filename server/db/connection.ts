import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATABASE_PATH = process.env.DATABASE_PATH || 'server/data/trading-journal.db';

mkdirSync(dirname(DATABASE_PATH), { recursive: true });

export const db = new DatabaseSync(DATABASE_PATH);
db.exec('PRAGMA foreign_keys = ON');

// Applied here (rather than in index.ts) so the schema exists before any router module's
// top-level db.prepare() calls run - those execute during import, ahead of index.ts's own code.
const here = dirname(fileURLToPath(import.meta.url));
db.exec(readFileSync(join(here, 'schema.sql'), 'utf-8'));
