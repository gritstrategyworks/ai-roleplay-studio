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

export function errorResponse(error) {
  if (error instanceof Response) return error;
  console.error('billing api error', error);
  return json({ error: 'Billing request failed.' }, { status: 500 });
}
