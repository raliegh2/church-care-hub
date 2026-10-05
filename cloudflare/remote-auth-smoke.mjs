import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import assert from 'node:assert/strict';

// Only synthetic records are created or removed by this verification.
const id = crypto.randomUUID(), visitorId = crypto.randomUUID();
const email = `migration-smoke-${id}@example.invalid`;
const password = 'Test-' + randomBytes(18).toString('hex') + '!';
const origin = 'https://church-care-hub.church-care-hub.workers.dev';
const org = 'a9456be1-5b06-4fbb-b5c1-cd5b66b3ff6a';
const now = new Date().toISOString();
const lit = value => "'" + String(value).replaceAll("'", "''") + "'";
const runSql = (file, sql) => {
  writeFileSync(file, sql);
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js','d1','execute','churchcarehub-migration','--remote','--file',file], {encoding:'utf8'});
  if (result.status !== 0) throw new Error('Synthetic test database operation failed');
};
const cleanup = `DELETE FROM visitors WHERE id=${lit(visitorId)}; DELETE FROM user_profiles WHERE id=${lit(id)}; DELETE FROM cf_auth_sessions WHERE userId=${lit(id)}; DELETE FROM cf_auth_accounts WHERE userId=${lit(id)}; DELETE FROM cf_auth_users WHERE id=${lit(id)}; DELETE FROM _identity_users WHERE id=${lit(id)};`;
try {
  const hash = await bcrypt.hash(password,10);
  runSql('.migration/smoke-auth-create.sql', `INSERT INTO _identity_users(id) VALUES (${lit(id)}); INSERT INTO cf_auth_users(id,name,email,emailVerified,createdAt,updatedAt) VALUES (${lit(id)},'Synthetic migration check',${lit(email)},1,${lit(now)},${lit(now)}); INSERT INTO cf_auth_accounts(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (${lit(crypto.randomUUID())},${lit(id)},'credential',${lit(id)},${lit(hash)},${lit(now)},${lit(now)}); INSERT INTO user_profiles(id,organization_id,display_name,role,requested_role,role_status,auth_not_before) VALUES (${lit(id)},${lit(org)},'Synthetic migration check','administrator','administrator','approved','2000-01-01T00:00:00Z');`);
  const login = await fetch(origin+'/api/auth/secure-login', {method:'POST', headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if (login.status !== 200) throw new Error(`Deployed sign-in failed (${login.status}): ${(await login.text()).slice(0,300)}`);
  const payload = await login.json();
  assert.equal(payload.user.id,id); assert.equal(payload.token,undefined);
  const header = login.headers.get('set-cookie');
  assert.match(header,/HttpOnly/i); assert.match(header,/Secure/i);
  const cookie = header.split(';')[0];
  const call = (path, method='GET', body) => fetch(origin+path, {method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',Prefer:'return=representation'},...(body ? {body:JSON.stringify(body)} : {})});
  const profile = await call('/api/rest/v1/user_profiles?select=id&id=eq.'+id);
  assert.equal(profile.status,200); assert.equal((await profile.json())[0].id,id);
  const visitor = await call('/api/rest/v1/visitors','POST',{id:visitorId,organization_id:org,full_name:'Synthetic migration check',first_visit_date:'2026-10-05',created_by:id});
  assert.equal(visitor.status,201); assert.equal((await visitor.json())[0].id,visitorId);
  const edited = await call('/api/rest/v1/visitors?id=eq.'+visitorId,'PATCH',{full_name:'Synthetic migration check updated'});
  assert.equal(edited.status,200);
  const reopened = await call('/api/rest/v1/visitors?id=eq.'+visitorId);
  assert.equal((await reopened.json())[0].full_name,'Synthetic migration check updated');
  const out = await call('/api/auth/sign-out','POST',{}); assert.equal(out.status,200);
  const stale = await call('/api/rest/v1/visitors?select=id'); assert.equal(stale.status,401);
  console.log('Remote checks passed: bcrypt sign-in, secure cookie, account mapping, create/edit/reopen record, sign-out revocation.');
} finally {
  runSql('.migration/smoke-auth-cleanup.sql', cleanup);
  console.log('Synthetic test records removed.');
}
