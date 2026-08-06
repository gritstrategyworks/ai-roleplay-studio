import { createGuestSession } from '../../_lib/auth.js';
import { assertSameOrigin, errorResponse, json } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const session = await createGuestSession(request, env);
    return json({
      authenticated: false,
      guest: true,
      user: session.user,
      expiresAt: session.expiresAt,
    }, {
      headers: { 'set-cookie': session.cookie },
    });
  } catch (error) {
    return errorResponse(error, 'ゲストモードを開始できませんでした。');
  }
}
