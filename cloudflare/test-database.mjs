import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function testDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON;');
  for (const file of ['0001_initial.sql', '0002_auth.sql']) sqlite.exec(readFileSync(new URL('./migrations/' + file, import.meta.url), 'utf8'));
  const db = {
    async exec(sql) { sqlite.exec(sql); return { count: 0, duration: 0 }; },
    prepare(sql) {
      let bindings = [];
      return {
        bind(...args) { bindings = args; return this; },
        async all() { const results = sqlite.prepare(sql).all(...bindings); return { results, success: true, meta: { changes: sqlite.prepare('SELECT changes() n').get().n } }; },
        async first() { return sqlite.prepare(sql).get(...bindings) || null; },
        async run() { return { success: true, meta: sqlite.prepare(sql).run(...bindings), results: [] }; }
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN;');
      try { const results = []; for (const statement of statements) results.push(await statement.all()); sqlite.exec('COMMIT;'); return results; }
      catch (error) { sqlite.exec('ROLLBACK;'); throw error; }
    }
  };
  return { db, sqlite };
}
