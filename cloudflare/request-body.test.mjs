import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundedText } from './request-body.mjs';
import worker from './api.mjs';
const origin='https://example.test';
function streamed(chunks,headers={},open=false) {
  let cancelled=false;
  const request=new Request(origin+'/api/auth/sign-up/email',{method:'POST',duplex:'half',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(new TextEncoder().encode(chunk));if(!open)controller.close();},cancel(){cancelled=true;}})});
  return {request,cancelled:()=>cancelled};
}
test('bounded reader handles chunk boundaries and rejects byte rather than character overflow', async () => {
  const normal=streamed(['{"name":"', 'é', '"}']);
  assert.equal(await boundedText(normal.request,14),'{"name":"é"}');
  const oversized=streamed(['é'.repeat(4000),'é'.repeat(1000)],{},true);
  await assert.rejects(boundedText(oversized.request,8192),failure=>failure.status===413);
  assert.equal(oversized.cancelled(),true);
  const declared=streamed(['small'],{'Content-Length':'9999'});
  await assert.rejects(boundedText(declared.request,8192),failure=>failure.status===413);
});
test('all auth entry points reject oversized streaming bodies before invoking authentication/database', async () => {
  const env={PUBLIC_BASE_URL:origin,SMTP_HOST:'smtp.example.test',SMTP_USER:'synthetic@example.test',SMTP_PASSWORD:'synthetic',MAIL_FROM:'synthetic@example.test'};
  for(const path of ['/api/auth/secure-login','/api/auth/sign-in/email','/api/auth/sign-up/email','/api/auth/reset-password']) {
    const {request}=streamed(['x'.repeat(5000),'x'.repeat(5000)]);
    const response=await worker.fetch(new Request(origin+path,request),env);
    assert.equal(response.status,413,path);
  }
});
test('Worker never serves maps while ordinary assets continue to the asset binding', async () => {
  const env={ASSETS:{fetch:()=>new Response('ordinary asset')}};
  assert.equal((await worker.fetch(new Request(origin+'/assets/index.js.map'),env)).status,404);
  assert.equal(await (await worker.fetch(new Request(origin+'/assets/index.js'),env)).text(),'ordinary asset');
});
