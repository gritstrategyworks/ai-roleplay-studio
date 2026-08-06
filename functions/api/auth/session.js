import { getSessionUser } from '../../_lib/auth.js';
import { errorResponse, json } from '../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  try {
    const session = await getSessionUser(request, env);
    if (!session) {
      return json({ authenticated: false, signupEnabled: env.SIGNUP_ENABLED !== 'false' });
    }
    return json({
      authenticated: true,
      user: session.user,
      expiresAt: session.expiresAt,
      signupEnabled: env.SIGNUP_ENABLED !== 'false',
    });
  } catch (error) {
    return errorResponse(error, '認証状態を確認できませんでした。');
  }
}
