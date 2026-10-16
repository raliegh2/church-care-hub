import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleData, scope, filters } from './api.mjs';
import { handleSecureLogin } from './secure-login.mjs';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON;');
  sqlite.exec(readFileSync(new URL('./migrations/0001_initial.sql', import.meta.url), 'utf8'));
  const db = {
    prepare(sql) {
      let bindings = [];
      return { bind(...args) { bindings = args; return this; }, async all() { return { results: sqlite.prepare(sql).all(...bindings) }; }, async first() { return sqlite.prepare(sql).get(...bindings) || null; }, async run() { return { results: [], meta: sqlite.prepare(sql).run(...bindings) }; } };
    },
    async batch(statements) { sqlite.exec('BEGIN;'); try { const results = []; for (const statement of statements) results.push(await statement.all()); sqlite.exec('COMMIT;'); return results; } catch (failure) { sqlite.exec('ROLLBACK;'); throw failure; } }
  };
  return { sqlite, db };
}
function fixture() {
  const { sqlite, db } = database();
  sqlite.exec("INSERT INTO organizations(id,name) VALUES ('org-a','Church A'),('org-b','Church B');");
  for (const [id, org, role] of [['usher','org-a','usher'],['pastor','org-a','pastor'],['admin','org-a','administrator'],['other','org-b','usher']]) {
    sqlite.prepare('INSERT INTO user_profiles(id,organization_id,display_name,role,requested_role) VALUES (?,?,?,?,?)').run(id,org,'Test '+id,role,role);
  }
  for (const [id, org, owner] of [['visitor-a','org-a','usher'],['visitor-b','org-b','other']]) {
    sqlite.prepare('INSERT INTO visitors(id,organization_id,full_name,first_visit_date,created_by) VALUES (?,?,?,?,?)').run(id,org,'Test visitor','2026-10-05',owner);
  }
  const actor = id => ({ id, approved: true, profile: sqlite.prepare('SELECT * FROM user_profiles WHERE id=?').get(id) });
  return { sqlite, db, actor };
}
const request = (path, options) => new Request('https://example.test/api/rest/v1/' + path, options);

test('organization boundaries apply even when client filters request another church', async () => {
  const { sqlite, db, actor } = fixture();
  const response = await handleData(request('visitors?select=*&organization_id=eq.org-b'), { DB: db }, actor('admin'));
  assert.deepEqual(await response.json(), []);
  const own = await handleData(request('visitors?select=id,active'), { DB: db }, actor('usher'));
  assert.deepEqual(await own.json(), [{ id: 'visitor-a', active: true }]);
  sqlite.close();
});
test('usher and inactive accounts cannot obtain pastoral records or privileged profiles', async () => {
  const { sqlite, db, actor } = fixture();
  await assert.rejects(handleData(request('members?select=*'), { DB: db }, actor('usher')), { status: 403 });
  await assert.rejects(handleData(request('visitors?select=*'), { DB: db }, { ...actor('usher'), approved: false }), { status: 403 });
  const profiles = await handleData(request('user_profiles?select=id'), { DB: db }, actor('usher'));
  assert.deepEqual(await profiles.json(), [{ id: 'usher' }]);
  assert.throws(() => scope('visitors', 'GET', { ...actor('usher'), profile: { ...actor('usher').profile, role: 'auditor' } }), { status: 403 });
  sqlite.close();
});
test('writes reject forged actors and person links across organizations', async () => {
  const { sqlite, db, actor } = fixture();
  const send = body => request('visit_records', { method: 'POST', body: JSON.stringify(body) });
  await assert.rejects(handleData(send({organization_id:'org-a',visited_by:'admin',visitor_id:'visitor-a'}), {DB:db}, actor('usher')), {status:403});
  await assert.rejects(handleData(send({organization_id:'org-a',visited_by:'usher',visitor_id:'visitor-b'}), {DB:db}, actor('usher')), {status:403});
  assert.equal(sqlite.prepare('SELECT count(*) n FROM visit_records').get().n, 0);
  sqlite.close();
});
test('multi-record inserts roll back completely when a later record violates a constraint', async () => {
  const { sqlite, db, actor } = fixture();
  const rows = [
    { id:'new-a', organization_id:'org-a', created_by:'usher', full_name:'Valid visitor', first_visit_date:'2026-10-05' },
    { id:'new-b', organization_id:'org-a', created_by:'usher', full_name:'', first_visit_date:'2026-10-05' }
  ];
  await assert.rejects(handleData(request('visitors', { method:'POST', body:JSON.stringify(rows) }), { DB: db }, actor('usher')));
  assert.equal(sqlite.prepare("SELECT count(*) n FROM visitors WHERE id LIKE 'new-%'").get().n, 0);
  sqlite.close();
});
test('idempotent attendance writes preserve the first saved record', async () => {
  const { sqlite, db, actor } = fixture();
  const body = {id:'service-one',organization_id:'org-a',created_by:'pastor',service_name:'Sabbath',service_date:'2026-10-05',new_visitors:2,returning_visitors:3};
  const send = data => handleData(request('attendance_sessions?on_conflict=id', { method:'POST', headers:{ Prefer:'resolution=ignore-duplicates' }, body:JSON.stringify(data) }), {DB:db}, actor('pastor'));
  assert.equal((await send(body)).status, 201);
  assert.equal((await send({...body,new_visitors:100})).status, 201);
  assert.equal(sqlite.prepare("SELECT total_attendance FROM attendance_sessions WHERE id='service-one'").get().total_attendance, 5);
  sqlite.close();
});
test('updates cannot transfer ownership or modify a different organization', async () => {
  const { sqlite, db, actor } = fixture();
  await assert.rejects(handleData(request('visitors?id=eq.visitor-a', {method:'PATCH',body:JSON.stringify({organization_id:'org-b'})}), {DB:db}, actor('admin')), {status:403});
  await handleData(request('visitors?id=eq.visitor-b', {method:'PATCH',body:JSON.stringify({full_name:'Changed'})}), {DB:db}, actor('admin'));
  assert.equal(sqlite.prepare("SELECT full_name FROM visitors WHERE id='visitor-b'").get().full_name, 'Test visitor');
  sqlite.close();
});
test('filter values remain parameters and unknown column names are rejected', () => {
  const injection = "x' OR 1=1 --";
  const result = filters('visitors', new URLSearchParams({ full_name: 'eq.' + injection }));
  assert.equal(result.sql, ' AND "full_name" = ?');
  assert.deepEqual(result.values, [injection]);
  assert.throws(() => filters('visitors', new URLSearchParams({ 'id) OR 1=1 --': 'eq.a' })), { status: 400 });
});
test('login throttling blocks after five failures and fails closed on database errors', async () => {
  const { sqlite, db } = database();
  const env = {DB:db,PUBLIC_BASE_URL:'https://example.test'};
  const attempt = () => handleSecureLogin(new Request('https://example.test/api/auth/secure-login', {method:'POST',headers:{Origin:'https://example.test','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({email:'test@example.test',password:'invalid'})}), env, async () => Response.json({error:'invalid credentials'}, {status:401}));
  try {
    for(let n=0;n<4;n++) assert.equal((await attempt()).status,401);
    const limited = await attempt();
    assert.equal(limited.status,429);
    assert.ok(Number(limited.headers.get('Retry-After')) > 0);
    assert.equal((await attempt()).status,429);
    env.DB = { prepare() { throw new Error('Database unavailable'); } };
    assert.equal((await attempt()).status,503);
  } finally { sqlite.close(); }
});
