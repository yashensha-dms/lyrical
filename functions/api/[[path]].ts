export async function onRequest(context: { request: Request; params: { path: string[] } }): Promise<Response> {
  const url = new URL(context.request.url);
  const target = new URL(url.pathname + url.search, 'https://songwriting-api.m-yashensha.workers.dev');
  
  // Forward request with original method, headers, and body
  const forwardReq = new Request(target.toString(), {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.method !== 'GET' && context.request.method !== 'HEAD' ? context.request.body : undefined,
    redirect: 'follow'
  });

  return fetch(forwardReq);
}
