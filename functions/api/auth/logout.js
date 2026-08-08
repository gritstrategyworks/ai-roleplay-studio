import { clearGuestCookie, clearSessionCookie, deleteSession } from '../../_lib/auth.js';
import { assertSameOrigin, errorResponse, json } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    await deleteSession(request, env);
    const response = json({ authenticated: false }, {
      headers: { 'set-cookie': clearSessionCookie(request) },
    });
    response.headers.append('set-cookie', clearGuestCookie(request));
    return response;
  } catch (error) {
    return errorResponse(error, 'ログアウトできませんでした。');
  }
}
