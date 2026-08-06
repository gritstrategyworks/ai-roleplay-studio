const encoder = new TextEncoder();

export const AUTH_COOKIE_NAME = '__Host-roleplay_session';
export const LOCAL_AUTH_COOKIE_NAME = 'roleplay_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const PASSWORD_ITERATIONS = 600000;

function toBase64Url(bytes) {
  let value = '';
  for (const byte of new Uint8Array(bytes)) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

function equalBytes(left, right) {
  const size = Math.max(left.length, right.length, 32);
  let difference = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

function cookieNameFor(request) {
  return new URL(request.url).protocol === 'https:' ? AUTH_COOKIE_NAME : LOCAL_AUTH_COOKIE_NAME;
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateCredentials(emailValue, passwordValue, options = {}) {
  const email = normalizeEmail(emailValue);
  const password = String(passwordValue || '');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: '有効なメールアドレスを入力してください。' };
  }
  const characterLength = Array.from(password).length;
  if (!options.registration) {
    return characterLength > 0 && characterLength <= 128
      ? { valid: true, email, password }
      : { valid: false, error: 'メールアドレスまたはパスワードが正しくありません。' };
  }
  if (characterLength < 10 || characterLength > 128) {
    return { valid: false, error: 'パスワードは10文字以上128文字以内で入力してください。' };
  }
  return { valid: true, email, password };
}

async function hmac(value, secret) {
  if (!secret) throw new Error('AUTH_PEPPER is not configured.');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

async function derivePassword(password, pepper, salt, iterations) {
  const peppered = await hmac(password, pepper);
  const baseKey = await crypto.subtle.importKey('raw', peppered, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations,
  }, baseKey, 256));
}

export async function hashPassword(password, pepper, iterations = PASSWORD_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, pepper, salt, iterations);
  return {
    algorithm: 'pbkdf2-hmac-sha256',
    iterations,
    salt: toBase64Url(salt),
    hash: toBase64Url(hash),
  };
}

export async function verifyPassword(password, pepper, stored) {
  const iterations = Math.min(1000000, Math.max(100000, Number(stored?.iterations) || PASSWORD_ITERATIONS));
  const salt = fromBase64Url(stored?.salt);
  const expected = fromBase64Url(stored?.hash);
  const safeSalt = salt.length === 16 ? salt : new Uint8Array(16);
  const actual = await derivePassword(password, pepper, safeSalt, iterations);
  return salt.length === 16 && expected.length === 32 && equalBytes(actual, expected);
}

export function generateSessionToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSessionToken(token) {
  return toBase64Url(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
}

export function buildSessionCookie(token, request, maxAge = SESSION_TTL_SECONDS) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return cookieNameFor(request) + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + secure;
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return cookieNameFor(request) + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + secure;
}

export function readSessionToken(request) {
  const cookies = parseCookies(request);
  return cookies[AUTH_COOKIE_NAME] || cookies[LOCAL_AUTH_COOKIE_NAME] || null;
}

export async function createSession(request, env, userId) {
  if (!env.BILLING_DB) throw new Error('BILLING_DB is not configured.');
  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  await env.BILLING_DB.batch([
    env.BILLING_DB.prepare('DELETE FROM auth_sessions WHERE user_id = ? AND expires_at <= ?').bind(userId, now),
    env.BILLING_DB.prepare(
      'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(tokenHash, userId, now, expiresAt, now),
  ]);
  return { token, tokenHash, expiresAt, cookie: buildSessionCookie(token, request) };
}

export async function getSessionUser(request, env) {
  if (!env.BILLING_DB) return null;
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.BILLING_DB.prepare(`
    SELECT s.token_hash, s.expires_at, s.last_seen_at, u.id, u.email
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(tokenHash, now).first();
  if (!row) return null;
  if (Number(row.last_seen_at || 0) < now - 86400) {
    await env.BILLING_DB.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?')
      .bind(now, tokenHash).run();
  }
  return {
    tokenHash,
    expiresAt: Number(row.expires_at),
    user: { id: row.id, email: row.email },
  };
}

export async function deleteSession(request, env) {
  const token = readSessionToken(request);
  if (!token || !env.BILLING_DB) return;
  await env.BILLING_DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
    .bind(await hashSessionToken(token)).run();
}

async function rateLimitKey(request, email, action, pepper, windowStart) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  return toBase64Url(await hmac([action, ip, normalizeEmail(email), windowStart].join('|'), pepper));
}

export async function isRateLimited(request, env, email, action, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const key = await rateLimitKey(request, email, action, env.AUTH_PEPPER, windowStart);
  const row = await env.BILLING_DB.prepare('SELECT attempts FROM auth_rate_limits WHERE rate_key = ? AND reset_at > ?')
    .bind(key, now).first();
  return { limited: Number(row?.attempts || 0) >= limit, key, resetAt: windowStart + windowSeconds };
}

export async function recordRateLimit(env, rate) {
  const now = Math.floor(Date.now() / 1000);
  await env.BILLING_DB.batch([
    env.BILLING_DB.prepare(`
      INSERT INTO auth_rate_limits (rate_key, attempts, reset_at)
      VALUES (?, 1, ?)
      ON CONFLICT(rate_key) DO UPDATE SET attempts = attempts + 1, reset_at = excluded.reset_at
    `).bind(rate.key, rate.resetAt),
    env.BILLING_DB.prepare('DELETE FROM auth_rate_limits WHERE reset_at < ?').bind(now - 86400),
  ]);
}

export async function clearRateLimit(env, key) {
  await env.BILLING_DB.prepare('DELETE FROM auth_rate_limits WHERE rate_key = ?').bind(key).run();
}
