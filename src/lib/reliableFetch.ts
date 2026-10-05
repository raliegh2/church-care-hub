// Reads may be retried. Writes are never replayed automatically.
export function createReliableFetch(fetcher: typeof fetch = fetch) {
  const reads = new Map<string, Promise<Response>>();
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = String(input instanceof Request ? input.url : input);
    const safeRead = (method === 'GET' || method === 'HEAD') && url.includes('/rest/v1/');
    const attempts = safeRead ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController();
      const external = init?.signal || (input instanceof Request ? input.signal : null);
      const abort = () => controller.abort(external?.reason);
      if (external?.aborted) abort();
      external?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error('The request timed out. Please retry.')), 12000);
      try {
        const response = await fetcher(input, { ...init, signal: controller.signal });
        if (safeRead && [429, 502, 503, 504].includes(response.status) && attempt + 1 < attempts) {
          await response.body?.cancel();
          const retryAfter = Number(response.headers.get('Retry-After'));
          await sleep(Math.min(2000, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt + Math.random() * 200));
          continue;
        }
        return response;
      } catch (error) {
        if (external?.aborted || !safeRead || attempt + 1 >= attempts) throw error;
        await sleep(250 * 2 ** attempt + Math.random() * 200);
      } finally {
        clearTimeout(timer);
        external?.removeEventListener('abort', abort);
      }
    }
    throw new Error('Unable to connect. Please retry.');
  }
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = String(input instanceof Request ? input.url : input);
    if (!['GET', 'HEAD'].includes(method) || !url.includes('/rest/v1/') || init?.signal || input instanceof Request) return request(input, init);
    // Authorization is part of the key; responses are never shared across users.
    const headers = [...new Headers(init?.headers).entries()].sort().map(([key, value]) => `${key}:${value}`).join('|');
    const key = `${method}:${url}:${headers}`;
    let pending = reads.get(key);
    if (!pending) {
      pending = request(input, init).finally(() => reads.delete(key));
      reads.set(key, pending);
    }
    return (await pending).clone();
  };
}
