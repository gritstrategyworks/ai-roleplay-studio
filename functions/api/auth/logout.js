import { clearSessionCookie, deleteSession } from '../../_lib/auth.js';
import { assertSameOrigin, errorResponse, json } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    await deleteSession(request, env);
    return json({ authenticated: false }, {
      headers: { 'set-cookie': clearSessionCookie(request) },
    });
  } catch (error) {
    return errorResponse(error, 'ログアウトできませんでした。');
  }
}
