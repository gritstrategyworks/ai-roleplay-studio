import {
  createSession,
  hashPassword,
  isRateLimited,
  normalizeEmail,
  recordRateLimit,
  validateCredentials,
} from '../../_lib/auth.js';
import { assertSameOrigin, errorResponse, json, readJson } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    if (!env.BILLING_DB) throw new Error('BILLING_DB is not configured.');
    if (!env.AUTH_PEPPER) throw new Error('AUTH_PEPPER is not configured.');
    if (env.SIGNUP_ENABLED === 'false') {
      return json({ error: '現在、新規アカウント作成を停止しています。', code: 'signup_disabled' }, { status: 403 });
    }

    const body = await readJson(request);
    const validation = validateCredentials(body.email, body.password, { registration: true });
    if (!validation.valid) return json({ error: validation.error, code: 'invalid_input' }, { status: 400 });

    const rate = await isRateLimited(request, env, '*', 'register', 3, 3600);
    if (rate.limited) {
      return json({ error: 'しばらく待ってから、もう一度お試しください。', code: 'rate_limited' }, { status: 429 });
    }
    await recordRateLimit(env, rate);

    const existing = await env.BILLING_DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
      .bind(normalizeEmail(validation.email)).first();
    if (existing) {
      return json({ error: 'このメールアドレスは登録済みです。ログインしてください。', code: 'email_exists' }, { status: 409 });
    }

    const password = await hashPassword(validation.password, env.AUTH_PEPPER);
    const userId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await env.BILLING_DB.prepare(`
      INSERT INTO users (
        id, email, password_hash, password_salt, password_iterations, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      validation.email,
      password.hash,
      password.salt,
      password.iterations,
      now,
      now,
      now,
    ).run();

    const session = await createSession(request, env, userId);
    return json({
      authenticated: true,
      user: { id: userId, email: validation.email },
      expiresAt: session.expiresAt,
    }, { status: 201, headers: { 'set-cookie': session.cookie } });
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(String(error?.message || error))) {
      return json({ error: 'このメールアドレスは登録済みです。ログインしてください。', code: 'email_exists' }, { status: 409 });
    }
    return errorResponse(error, 'アカウントを作成できませんでした。');
  }
}
