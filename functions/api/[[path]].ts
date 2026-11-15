export async function onRequest(context: { request: Request; params: { path: string[] } }): Promise<Response> {
  const url = new URL(context.request.url);
  const target = new URL(url.pathname + url.search, 'https://songwriting-api.m-yashensha.workers.dev');
  
  const hasBody = context.request.method !== 'GET' && context.request.method !== 'HEAD';
  const forwardReq = new Request(target.toString(), {
    method: context.request.method,
    headers: context.request.headers,
    body: hasBody && context.request.body ? context.request.body : undefined,
    redirect: 'follow'
  });

  return fetch(forwardReq);
}
