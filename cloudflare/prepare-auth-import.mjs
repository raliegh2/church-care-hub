import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from './auth.mjs';

const db = new DatabaseSync(':memory:');
const auth = createAuth({ DB: db, AUTH_SECRET: 'local-schema-generation-only-secret-12345', PUBLIC_BASE_URL: 'https://example.test' }, { schemaOnly: true });
const migration = await getMigrations(auth.options);
const schema = await migration.compileMigrations();
writeFileSync(new URL('./migrations/0002_auth.sql', import.meta.url), schema + '\n');
db.exec(schema);
const users = JSON.parse(readFileSync(new URL('../.migration/auth-users.json', import.meta.url), 'utf8'));
const literal = value => value == null ? 'NULL' : typeof value === 'number' ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
const insert = (table, row) => `INSERT INTO "${table}" (${Object.keys(row).map(k => '"' + k + '"').join(',')}) VALUES (${Object.values(row).map(literal).join(',')});`;
const statements = [];
for (const user of users) {
  if (user.deleted_at || (user.banned_until && Date.parse(user.banned_until) > Date.now())) throw new Error('Account is unavailable for migration');
  if (!user.email_confirmed_at || !/^\$2[aby]\$/.test(user.encrypted_password)) throw new Error('Account needs a different migration flow');
  const createdAt = new Date(user.created_at).toISOString(), updatedAt = new Date(user.updated_at || user.created_at).toISOString();
  statements.push(insert('cf_auth_users', { id: user.id, name: user.display_name || 'Church Care Hub user', email: user.email.toLowerCase(), emailVerified: 1, image: null, createdAt, updatedAt }));
  statements.push(insert('cf_auth_accounts', { id: crypto.randomUUID(), accountId: user.id, providerId: 'credential', userId: user.id, password: user.encrypted_password, createdAt, updatedAt }));
}
db.exec(statements.join('\n'));
if (db.prepare('SELECT count(*) n FROM cf_auth_users').get().n !== users.length) throw new Error('Identity count mismatch');
writeFileSync(new URL('../.migration/import-auth.sql', import.meta.url), statements.join('\n') + '\n');
console.log('Auth schema generated and private account import validated:', users.length, 'accounts');
db.close();
