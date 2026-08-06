import { getGuestUser, getSessionUser } from './_lib/auth.js';
import { json } from './_lib/http.js';

const PUBLIC_API_PATHS = new Set([
  '/api/auth/guest',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/session',
  '/api/billing/webhook',
]);

export async function onRequest(context) {
  const requestPath = new URL(context.request.url).pathname;
  if (!requestPath.startsWith('/api/') || PUBLIC_API_PATHS.has(requestPath)) return context.next();

  try {
    const session = await getSessionUser(context.request, context.env);
    if (session) {
      context.data.user = session.user;
      context.data.auth = { guest: false };
      return context.next();
    }
    const guest = await getGuestUser(context.request, context.env);
    if (guest) {
      if (requestPath.startsWith('/api/billing/')) {
        return json({ error: 'プレミアム機能にはログインが必要です。', code: 'guest_login_required' }, { status: 403 });
      }
      context.data.user = guest.user;
      context.data.auth = { guest: true };
      return context.next();
    }
    return json({ error: 'ログインまたはゲストモードが必要です。', code: 'auth_required' }, { status: 401 });
  } catch (error) {
    console.error('authentication middleware error', error);
    return json({ error: '認証状態を確認できませんでした。', code: 'auth_unavailable' }, { status: 503 });
  }
}
