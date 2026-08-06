import { getSessionUser } from './_lib/auth.js';
import { json } from './_lib/http.js';

const PUBLIC_API_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/session',
  '/api/billing/webhook',
]);

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  if (!path.startsWith('/api/') || PUBLIC_API_PATHS.has(path)) return context.next();

  try {
    const session = await getSessionUser(context.request, context.env);
    if (!session) {
      return json({ error: 'ログインが必要です。', code: 'auth_required' }, { status: 401 });
    }
    context.data.user = session.user;
    return context.next();
  } catch (error) {
    console.error('authentication middleware error', error);
    return json({ error: '認証状態を確認できませんでした。', code: 'auth_unavailable' }, { status: 503 });
  }
}
