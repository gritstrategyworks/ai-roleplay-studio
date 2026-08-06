import {
  createSession,
  isRateLimited,
  recordRateLimit,
  validateCredentials,
  verifyPassword,
} from '../../_lib/auth.js';
import { assertSameOrigin, errorResponse, json, readJson } from '../../_lib/http.js';

const DUMMY_PASSWORD = {
  salt: 'AAAAAAAAAAAAAAAAAAAAAA',
  hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  iterations: 600000,
};

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    if (!env.BILLING_DB) throw new Error('BILLING_DB is not configured.');
    if (!env.AUTH_PEPPER) throw new Error('AUTH_PEPPER is not configured.');

    const body = await readJson(request);
    const validation = validateCredentials(body.email, body.password);
    if (!validation.valid) {
      return json({ error: 'メールアドレスまたはパスワードが正しくありません。', code: 'invalid_credentials' }, { status: 401 });
    }

    const rate = await isRateLimited(request, env, validation.email, 'login', 5, 600);
    if (rate.limited) {
      return json({ error: 'ログイン試行回数が多すぎます。10分後にお試しください。', code: 'rate_limited' }, { status: 429 });
    }

    const user = await env.BILLING_DB.prepare(`
      SELECT id, email, password_hash, password_salt, password_iterations
      FROM users WHERE email = ? COLLATE NOCASE
    `).bind(validation.email).first();
    const verified = await verifyPassword(validation.password, env.AUTH_PEPPER, user ? {
      hash: user.password_hash,
      salt: user.password_salt,
      iterations: user.password_iterations,
    } : DUMMY_PASSWORD);

    if (!user || !verified) {
      await recordRateLimit(env, rate);
      return json({ error: 'メールアドレスまたはパスワードが正しくありません。', code: 'invalid_credentials' }, { status: 401 });
    }

    const now = Math.floor(Date.now() / 1000);
    await env.BILLING_DB.batch([
      env.BILLING_DB.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').bind(now, now, user.id),
      env.BILLING_DB.prepare('DELETE FROM auth_rate_limits WHERE rate_key = ?').bind(rate.key),
    ]);
    const session = await createSession(request, env, user.id);
    return json({
      authenticated: true,
      user: { id: user.id, email: user.email },
      expiresAt: session.expiresAt,
    }, { headers: { 'set-cookie': session.cookie } });
  } catch (error) {
    return errorResponse(error, 'ログインできませんでした。');
  }
}
