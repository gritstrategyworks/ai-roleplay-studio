const MODELS = Object.freeze({
  'gemma-3-4b-it-q4f16_1-MLC': {
    repo: 'mlc-ai/gemma-3-4b-it-q4f16_1-MLC',
    revision: 'af1fe173321285b526dd3dd9b9d8f5000f324baf',
    library: 'https://huggingface.co/Phreak87/gemma3-4b-it-q4f16_1-MLC-wasm/resolve/eb69d439a177714feeda310e04edfd1e6ce10932/gemma3-4b.wasm',
  },
  'Qwen3-4B-q4f32_1-MLC': {
    repo: 'mlc-ai/Qwen3-4B-q4f32_1-MLC',
    revision: 'b7e4eb1ba80728187fb5df44055cc1a7c32310e0',
    library: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/025bcaf3780fa8254f5e5efd3bfea0a5397248f4/web-llm-models/v0_2_84/base/Qwen3-4B-q4f32_1_cs1k-webgpu.wasm',
  },
  'Llama-3.2-3B-Instruct-q4f32_1-MLC': {
    repo: 'mlc-ai/Llama-3.2-3B-Instruct-q4f32_1-MLC',
    revision: '6083cfdaaf08d2dd4872d7f5b87fb0242aa7d75c',
    library: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/025bcaf3780fa8254f5e5efd3bfea0a5397248f4/web-llm-models/v0_2_84/base/Llama-3.2-3B-Instruct-q4f32_1_cs1k-webgpu.wasm',
  },
});

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

function json(body, status = 400) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function copyRequestHeaders(request) {
  const headers = new Headers();
  for (const name of ['range', 'if-none-match', 'if-modified-since']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function copyResponseHeaders(upstream) {
  const headers = new Headers();
  for (const name of [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified',
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('cache-control', IMMUTABLE_CACHE);
  headers.set('access-control-allow-origin', '*');
  headers.set('cross-origin-resource-policy', 'cross-origin');
  headers.set('x-content-type-options', 'nosniff');
  return headers;
}

function resolveUpstream(pathname) {
  const prefix = '/api/local-model/';
  if (!pathname.startsWith(prefix)) return null;

  const parts = pathname.slice(prefix.length).split('/').map(decodeURIComponent);
  const [kind, modelId, ...rest] = parts;
  const model = MODELS[modelId];
  if (!model) return null;

  if (kind === 'lib' && rest.length === 0) return model.library;

  if (
    kind === 'model' &&
    rest.length >= 3 &&
    rest[0] === 'resolve' &&
    rest[1] === 'main' &&
    rest.slice(2).every((part) => part && part !== '.' && part !== '..' && !part.includes('/') && !part.includes('\\'))
  ) {
    const safePath = rest.slice(2).map(encodeURIComponent).join('/');
    return `https://huggingface.co/${model.repo}/resolve/${model.revision}/${safePath}`;
  }

  return null;
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, HEAD, OPTIONS',
        'access-control-allow-headers': 'range, if-none-match, if-modified-since',
        'access-control-max-age': '86400',
      },
    });
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    return json({ error: 'Method not allowed.' }, 405);
  }

  let upstreamUrl;
  try {
    upstreamUrl = resolveUpstream(new URL(request.url).pathname);
  } catch {
    return json({ error: 'Invalid model path.' });
  }
  if (!upstreamUrl) return json({ error: 'Unknown model asset.' }, 404);

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: copyRequestHeaders(request),
    redirect: 'follow',
  });
  if (!upstream.ok && upstream.status !== 304 && upstream.status !== 206) {
    return json({ error: 'Model asset is unavailable.' }, upstream.status === 404 ? 404 : 502);
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    headers: copyResponseHeaders(upstream),
  });
}
