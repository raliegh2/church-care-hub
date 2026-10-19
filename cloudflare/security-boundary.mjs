// Allowlisted security metadata only; never log headers, bodies, account IDs or URLs.
export function securityBoundary(projectId,handle,log=event=>console.info(JSON.stringify(event))) {
  return async function fetch(request,env,context) {
    const correlationId=crypto.randomUUID(),url=new URL(request.url);
    const api=url.pathname.startsWith('/api/'),unsafe=!['GET','HEAD','OPTIONS'].includes(request.method);
    let response,denied=false;
    try {
      const origin=request.headers.get('Origin'),expected=env.PUBLIC_BASE_URL?new URL(env.PUBLIC_BASE_URL).origin:url.origin;
      if(api&&unsafe&&(request.headers.get('Sec-Fetch-Site')==='cross-site'||origin&&origin!==expected)) {
        denied=true;response=Response.json({error:'Request origin is not allowed.'},{status:403});
      } else response=await handle(request,env,context);
    } catch {response=Response.json({error:'The request could not be completed.'},{status:500});}
    const headers=new Headers(response.headers);
    headers.set('X-Request-ID',correlationId);
    headers.set('X-Content-Type-Options','nosniff');
    headers.set('Referrer-Policy','no-referrer');
    headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    if(url.protocol==='https:'&&!headers.has('Strict-Transport-Security'))headers.set('Strict-Transport-Security','max-age=15552000');
    if(api) {
      headers.set('Cache-Control','no-store');headers.set('X-Frame-Options','DENY');
      if(headers.get('Content-Type')?.includes('application/json'))headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    }
    if(response.status>=400||api&&unsafe) {
      const kind=denied?'origin_rejected':response.status===401?'auth_failure':response.status===403?'authorization_denied':response.status===429?'rate_limited':response.status>=500?'service_error':'request_outcome';
      try{log({schemaVersion:'1.0',projectId,kind,at:new Date().toISOString(),status:response.status,route:api?(url.pathname.startsWith('/api/auth/')||url.pathname.includes('/clerk/')?'auth':'api'):'asset',correlationId});}catch{/* Telemetry failure must not replay or lose an application response. */}
    }
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  };
}

