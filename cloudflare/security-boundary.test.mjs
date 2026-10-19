import {test} from 'node:test';
import assert from 'node:assert/strict';
import {securityBoundary} from './security-boundary.mjs';
test('cross-site writes are blocked before application side effects and emit only safe metadata',async()=>{
 let calls=0;const logs=[];const handler=securityBoundary('test-project',async()=>{calls++;return Response.json({ok:true});},e=>logs.push(e));
 const r=await handler(new Request('https://example.test/api/auth/login?token=do-not-log',{method:'POST',headers:{Origin:'https://untrusted.invalid',Authorization:'Bearer hidden'},body:'password=hidden'}),{PUBLIC_BASE_URL:'https://example.test'});
 assert.equal(r.status,403);assert.equal(calls,0);assert.equal(logs[0].kind,'origin_rejected');assert.doesNotMatch(JSON.stringify(logs),/do-not-log|hidden|untrusted/);assert.match(r.headers.get('X-Request-ID'),/^[a-f0-9-]{36}$/);assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('normal responses retain status, cookies and body while authentication failures are correlated',async()=>{
 const logs=[];const handler=securityBoundary('test-project',async()=>Response.json({error:'Denied'},{status:401,headers:{'Set-Cookie':'session=synthetic; HttpOnly; Secure'}}),e=>logs.push(e));
 const r=await handler(new Request('https://example.test/api/auth/session'),{PUBLIC_BASE_URL:'https://example.test'});
 assert.equal(r.status,401);assert.equal((await r.json()).error,'Denied');assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);assert.equal(logs[0].kind,'auth_failure');assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');assert.match(r.headers.get('Permissions-Policy'),/camera=\(\)/);
});
test('unexpected exceptions are sanitized and static responses remain cacheable',async()=>{
 const fail=securityBoundary('test-project',async()=>{throw Error('password=hidden');},()=>{throw Error('logger offline');});
 const r=await fail(new Request('https://example.test/api/data'),{});
 assert.equal(r.status,500);assert.doesNotMatch(await r.text(),/hidden/);
 const asset=securityBoundary('test-project',async()=>new Response('asset',{headers:{'Cache-Control':'public, max-age=3600'}}),()=>{});
 const a=await asset(new Request('https://example.test/style.css'),{});assert.equal(a.headers.get('Cache-Control'),'public, max-age=3600');
});

