const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/lib/reliableFetch.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exportsObject = {};
new Function('exports', compiled)(exportsObject);
const { createReliableFetch } = exportsObject;
const url = 'https://example.test/rest/v1/members?limit=51';

test('1,000 simultaneous identical reads use one request and independent response bodies', async () => {
  let calls = 0;
  const request = createReliableFetch(async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json([{ id: 'example' }]);
  });
  const results = await Promise.all(Array.from({ length: 1000 }, async () => (await request(url)).json()));
  assert.equal(calls, 1);
  assert.equal(results.length, 1000);
  assert.equal(results[999][0].id, 'example');
  await request(url);
  assert.equal(calls, 2, 'settled responses are not cached');
});

test('different user tokens never share an in-flight response', async () => {
  let calls = 0;
  const request = createReliableFetch(async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json([]); });
  await Promise.all(['user-a', 'user-b'].map(token => request(url, { headers: { Authorization: `Bearer ${token}` } })));
  assert.equal(calls, 2);
});

test('temporary reads retry at most three times', async () => {
  let calls = 0;
  const request = createReliableFetch(async () => { calls++; return new Response('', { status: calls < 3 ? 503 : 200 }); });
  assert.equal((await request(url)).status, 200);
  assert.equal(calls, 3);
  calls = 0;
  const fail = createReliableFetch(async () => { calls++; throw new TypeError('offline'); });
  await assert.rejects(fail(url), /offline/);
  assert.equal(calls, 3);
});

test('writes, authentication and permanent failures are not replayed', async () => {
  let calls = 0;
  const request = createReliableFetch(async () => { calls++; return new Response('', { status: 503 }); });
  await request(url, { method: 'POST', body: '{}' });
  await request('https://example.test/auth/v1/token');
  assert.equal(calls, 2);
  const forbidden = createReliableFetch(async () => { calls++; return new Response('', { status: 403 }); });
  await forbidden(url);
  assert.equal(calls, 3);
});

test('an aborted read stops without retrying', async () => {
  let calls = 0;
  const controller = new AbortController(); controller.abort();
  const request = createReliableFetch(async (_input, init) => { calls++; init.signal.throwIfAborted(); return Response.json([]); });
  await assert.rejects(request(url, { signal: controller.signal }));
  assert.equal(calls, 1);
});
