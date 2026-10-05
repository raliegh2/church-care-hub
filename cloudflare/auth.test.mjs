import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import worker, { authenticate } from './api.mjs';
import { createAuth, hashPassword, verifyPassword } from './auth.mjs';
import { testDatabase } from './test-database.mjs';

const origin = 'https://example.test';
const password = 'Migration-Test-Password1!';
async function fixture() {
  const { db, sqlite } = testDatabase();
  const env = { DB: db, AUTH_SECRET: 'synthetic-test-secret-at-least-32-characters', PUBLIC_BASE_URL: origin };
  const now = new Date().toISOString();
  sqlite.prepare('INSERT INTO cf_auth_users(id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run('user-a','Test user','test@example.test',1,now,now);
  sqlite.prepare('INSERT INTO cf_auth_accounts(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run('account-a','user-a','credential','user-a',await bcrypt.hash(password,10),now,now);
  sqlite.exec("INSERT INTO organizations(id,name) VALUES ('org-a','Test Church'); INSERT INTO _identity_users(id) VALUES ('user-a'); INSERT INTO user_profiles(id,organization_id,display_name,role,requested_role,role_status,auth_not_before) VALUES ('user-a','org-a','Test user','usher','usher','approved','2000-01-01T00:00:00Z');");
  const request = (path, body, cookie, requestOrigin = origin) => new Request(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : {Origin:requestOrigin,'Content-Type':'application/json'}), ...(cookie ? {Cookie:cookie} : {}), 'CF-Connecting-IP':'192.0.2.1' },
    ...(body === undefined ? {} : {body:JSON.stringify(body)})
  });
  const login = () => worker.fetch(request('/api/auth/secure-login',{email:'test@example.test',password}),env);
  return { sqlite, env, request, login };
}

test('migrated bcrypt password creates an HttpOnly session and sign-out revokes it', async () => {
  const { sqlite, env, request, login } = await fixture();
  const response = await login();
  assert.equal(response.status,200);
  const payload = await response.json();
  assert.equal(payload.user.id,'user-a');
  assert.equal(payload.token,undefined);
  assert.equal(payload.access_token,undefined);
  const cookieHeader = response.headers.get('set-cookie');
  assert.match(cookieHeader,/__Host-churchcarehub\.session=/);
  assert.match(cookieHeader,/HttpOnly/i); assert.match(cookieHeader,/Secure/i); assert.match(cookieHeader,/SameSite=Lax/i);
  const cookie = cookieHeader.split(';')[0];
  const sessionResponse = await worker.fetch(request('/api/auth/get-session',undefined,cookie),env);
  const sessionData = await sessionResponse.json();
  assert.equal(sessionData.session.token,undefined);
  assert.equal(sessionData.user.id,'user-a');
  assert.equal((await authenticate(request('/api/rest/v1/user_profiles',undefined,cookie),env)).approved,true);
  assert.equal((await worker.fetch(request('/api/auth/sign-out',{},cookie),env)).status,200);
  await assert.rejects(authenticate(request('/api/rest/v1/user_profiles',undefined,cookie),env),{status:401});
  sqlite.close();
});

test('forged cookies, expired sessions and legacy bearer tokens grant no access', async () => {
  const { sqlite, env, request, login } = await fixture();
  await assert.rejects(authenticate(request('/api/rest/v1/visitors',undefined,'__Host-churchcarehub.session=forged'),env),{status:401});
  const bearer = request('/api/rest/v1/visitors'); bearer.headers.set('Authorization','Bearer legacy-token');
  await assert.rejects(authenticate(bearer,env),{status:401});
  const response = await login(), cookie = response.headers.get('set-cookie').split(';')[0];
  sqlite.prepare('UPDATE cf_auth_sessions SET expiresAt=?').run('2000-01-01T00:00:00Z');
  await assert.rejects(authenticate(request('/api/rest/v1/visitors',undefined,cookie),env),{status:401});
  sqlite.close();
});

test('account suspension and access-change timestamps are checked on every data request', async () => {
  const { sqlite, env, request, login } = await fixture();
  const response = await login(), cookie = response.headers.get('set-cookie').split(';')[0];
  sqlite.prepare('UPDATE user_profiles SET auth_not_before=?').run(new Date(Date.now()+10000).toISOString());
  assert.equal((await authenticate(request('/api/rest/v1/visitors',undefined,cookie),env)).approved,false);
  sqlite.exec('UPDATE user_profiles SET active=0');
  assert.equal((await authenticate(request('/api/rest/v1/visitors',undefined,cookie),env)).approved,false);
  assert.notEqual((await login()).status,200);
  sqlite.close();
});

test('cross-site writes and sign-in are blocked; unconfigured email fails explicitly', async () => {
  const { sqlite, env, request } = await fixture();
  assert.equal((await worker.fetch(request('/api/auth/secure-login',{email:'test@example.test',password},null,'https://evil.test'),env)).status,403);
  assert.equal((await worker.fetch(request('/api/rest/v1/visitors',{},null,'https://evil.test'),env)).status,403);
  assert.equal((await worker.fetch(request('/api/auth/sign-up/email',{email:'new@example.test',password,name:'Test user'}),env)).status,503);
  assert.equal((await worker.fetch(request('/api/auth/request-password-reset',{email:'test@example.test'}),env)).status,503);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM cf_auth_users').get().n,1);
  sqlite.close();
});

test('native password hashing verifies valid passwords and rejects altered hashes', async () => {
  const hash = await hashPassword(password);
  assert.equal(await verifyPassword({hash,password}),true);
  assert.equal(await verifyPassword({hash,password:'wrong'}),false);
  assert.equal(await verifyPassword({hash:'invalid',password}),false);
});

test('email verification gates signup; password reset tokens are one-use and revoke old sessions', async () => {
  const { sqlite, env, request } = await fixture();
  const messages = [];
  Object.assign(env,{MAIL_FROM:'sender@example.test',SMTP_HOST:'smtp.example.test',SMTP_USER:'sender',SMTP_PASSWORD:'synthetic-test-only'});
  const auth = createAuth(env,{sendEmail:async (_env,to,subject,url) => messages.push({to,subject,url})});
  const signup = await auth.handler(request('/api/auth/sign-up/email',{name:'New test user',email:'new@example.test',password,callbackURL:origin}));
  assert.equal(signup.status,200);
  const attempt = () => auth.handler(request('/api/auth/sign-in/email',{email:'new@example.test',password}));
  assert.equal((await attempt()).status,403);
  const confirmation = messages.find(message => message.subject === 'Verify your email address');
  assert.equal(confirmation.to,'new@example.test');
  const verified = await auth.handler(new Request(confirmation.url));
  assert.equal(verified.status,302);
  const signedIn = await attempt(); assert.equal(signedIn.status,200);
  const cookie = signedIn.headers.get('set-cookie').split(';')[0];
  const resetRequest = await auth.handler(request('/api/auth/request-password-reset',{email:'new@example.test',redirectTo:origin+'/reset-password'}));
  assert.equal(resetRequest.status,200);
  const resetEmail = messages.find(message => message.subject === 'Reset your password');
  const resetLanding = await auth.handler(new Request(resetEmail.url));
  assert.equal(resetLanding.status,302);
  const token = new URL(resetLanding.headers.get('Location')).searchParams.get('token');
  assert.ok(token);
  const newPassword = 'New-Test-Password-123!';
  const reset = () => auth.handler(request('/api/auth/reset-password',{token,newPassword}));
  assert.equal((await reset()).status,200);
  assert.equal(await auth.api.getSession({headers:new Headers({Cookie:cookie})}),null);
  assert.notEqual((await reset()).status,200);
  assert.equal((await attempt()).status,401);
  // The final attempt represents the next sign-in window; earlier checks
  // intentionally used up the library's three-attempt short-window limit.
  sqlite.exec('DELETE FROM cf_auth_rate_limits');
  assert.equal((await auth.handler(request('/api/auth/sign-in/email',{email:'new@example.test',password:newPassword}))).status,200);
  sqlite.close();
});
