export const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new Response('Forbidden', { status: 403 });
  }
}

export async function readJson(request, maxBytes = 16384) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw new Response('Payload Too Large', { status: 413 });
  if (!request.body) return {};

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel();
      throw new Response('Payload Too Large', { status: 413 });
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Response('Bad Request', { status: 400 });
  }
}

export function errorResponse(error, message = 'Billing request failed.') {
  if (error instanceof Response) return error;
  console.error('api error', error);
  return json({ error: message }, { status: 500 });
}
