import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildSessionCookie,
  clearGuestCookie,
  clearSessionCookie,
  createGuestSession,
  generateSessionToken,
  getGuestUser,
  hashPassword,
  hashSessionToken,
  PASSWORD_ITERATIONS,
  normalizeEmail,
  validateCredentials,
  verifyPassword,
} from '../functions/_lib/auth.js';
import { onRequest as authMiddleware } from '../functions/_middleware.js';

test('email and password registration input is normalized and validated', () => {
  assert.equal(normalizeEmail(' User@Example.COM '), 'user@example.com');
  assert.equal(validateCredentials('bad-address', 'long-enough-password', { registration: true }).valid, false);
  assert.equal(validateCredentials('user@example.com', 'short', { registration: true }).valid, false);
  assert.deepEqual(
    validateCredentials(' User@Example.COM ', 'long-enough-password', { registration: true }),
    { valid: true, email: 'user@example.com', password: 'long-enough-password' },
  );
});

test('passwords use salted PBKDF2 and reject the wrong password', async () => {
  assert.equal(PASSWORD_ITERATIONS, 100000);
  const first = await hashPassword('correct horse battery staple', 'test-pepper', 600000);
  const second = await hashPassword('correct horse battery staple', 'test-pepper', 100000);
  assert.equal(first.iterations, 100000);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword('correct horse battery staple', 'test-pepper', first), true);
  assert.equal(await verifyPassword('wrong password', 'test-pepper', first), false);
});

test('production session cookie is persistent and protected', () => {
  const request = new Request('https://ai-roleplay-studio.ai-roleplay-studio.workers.dev/');
  const cookie = buildSessionCookie('token-value', request);
  assert.match(cookie, /^__Host-roleplay_session=token-value;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=2592000/);
  assert.match(clearSessionCookie(request), /Max-Age=0/);
});

test('session tokens are random and only their digest is stored', async () => {
  const first = generateSessionToken();
  const second = generateSessionToken();
  assert.notEqual(first, second);
  assert.equal((await hashSessionToken(first)).length, 43);
});

test('guest sessions are signed, time limited and use a separate cookie', async () => {
  const request = new Request('https://ai-roleplay-studio.ai-roleplay-studio.workers.dev/');
  const env = { AUTH_PEPPER: 'test-guest-pepper' };
  const guest = await createGuestSession(request, env);
  assert.equal(guest.user.id, 'guest');
  assert.equal(guest.user.guest, true);
  assert.match(guest.cookie, /^__Host-roleplay_guest=/);
  assert.match(guest.cookie, /Max-Age=86400/);
  const cookie = guest.cookie.split(';', 1)[0];
  const restored = await getGuestUser(new Request(request.url, { headers: { cookie } }), env);
  assert.equal(restored.user.guest, true);
  const tampered = cookie.replace(/.$/, cookie.endsWith('a') ? 'b' : 'a');
  assert.equal(await getGuestUser(new Request(request.url, { headers: { cookie: tampered } }), env), null);
  assert.match(clearGuestCookie(request), /Max-Age=0/);
});

test('middleware rejects unauthenticated protected APIs', async () => {
  const response = await authMiddleware({
    request: new Request('https://example.com/api/roleplay'),
    env: {},
    data: {},
    next() { throw new Error('protected request must not continue'); },
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'auth_required');
});

test('middleware allows signed guests to roleplay but blocks billing', async () => {
  const request = new Request('https://example.com/');
  const env = { AUTH_PEPPER: 'test-guest-pepper' };
  const guest = await createGuestSession(request, env);
  const cookie = guest.cookie.split(';', 1)[0];
  const marker = new Response('next');
  const data = {};
  const roleplay = await authMiddleware({
    request: new Request('https://example.com/api/roleplay', { headers: { cookie } }),
    env,
    data,
    next() { return marker; },
  });
  assert.equal(roleplay, marker);
  assert.equal(data.user.guest, true);
  const billing = await authMiddleware({
    request: new Request('https://example.com/api/billing/status', { headers: { cookie } }),
    env,
    data: {},
    next() { throw new Error('guest billing request must not continue'); },
  });
  assert.equal(billing.status, 403);
  assert.equal((await billing.json()).code, 'guest_login_required');
});

test('middleware leaves public authentication and static routes accessible', async () => {
  for (const path of ['/api/auth/guest', '/api/auth/login', '/api/auth/session', '/index.html']) {
    const marker = new Response('next');
    const response = await authMiddleware({
      request: new Request('https://example.com' + path),
      env: {},
      data: {},
      next() { return marker; },
    });
    assert.equal(response, marker);
  }
});

test('frontend requires authentication before loading the application bundles', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const auth = fs.readFileSync(new URL('../auth.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(index, /id="authGate"/);
  assert.match(index, /id="appShell" class="app-shell" hidden/);
  assert.match(index, /id="authGuest"/);
  assert.match(index, /auth\.js\?v=1\.21/);
  assert.doesNotMatch(index, /<script src="app\.js/);
  assert.match(auth, /\/api\/auth\/session/);
  assert.match(auth, /\/api\/auth\/guest/);
  assert.match(auth, /local-ai\.js\?v=1\.21/);
  assert.match(auth, /scenario-design\.js\?v=1\.21/);
  assert.match(auth, /app\.js\?v=1\.21/);
  assert.match(app, /STORAGE_SCOPE = globalThis\.AuthGate\?\.user\?\.id/);
});

test('login dummy hash also stays within the Cloudflare PBKDF2 limit', () => {
  const login = fs.readFileSync(new URL('../functions/api/auth/login.js', import.meta.url), 'utf8');
  assert.match(login, /iterations: 100000/);
  assert.doesNotMatch(login, /iterations: 600000/);
});

test('billing identity is sourced from the authenticated user session', () => {
  const billing = fs.readFileSync(new URL('../functions/_lib/billing.js', import.meta.url), 'utf8');
  assert.match(billing, /getSessionUser/);
  assert.match(billing, /accountId: session\.user\.id/);
  assert.doesNotMatch(billing, /BILLING_SESSION_SECRET/);
});
