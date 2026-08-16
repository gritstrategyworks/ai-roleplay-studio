import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';

const origin = 'https://app.test';
const developerEmail = 'gritstrategyworks@gmail.com';
const developerCommand = 'local-test-command';

class D1Statement {
  constructor(database, query, values = []) {
    this.database = database;
    this.query = query;
    this.values = values;
  }

  bind(...values) {
    return new D1Statement(this.database, this.query, values);
  }

  async first() {
    return this.database.prepare(this.query).get(...this.values) || null;
  }

  async run() {
    const result = this.database.prepare(this.query).run(...this.values);
    return {
      success: true,
      results: [],
      meta: { changes: Number(result.changes || 0), last_row_id: Number(result.lastInsertRowid || 0) }
    };
  }
}

class D1TestDatabase {
  constructor(database) {
    this.database = database;
  }

  prepare(query) {
    return new D1Statement(this.database, query);
  }

  async batch(statements) {
    this.database.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

function createDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    );
    CREATE TABLE auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );
    CREATE TABLE auth_rate_limits (
      rate_key TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );
    CREATE TABLE billing_accounts (
      account_id TEXT PRIMARY KEY,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      status TEXT NOT NULL,
      current_period_end INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return database;
}

function responseCookie(response) {
  return (response.headers.get('set-cookie') || '').split(';', 1)[0];
}

async function request(env, path, { method = 'GET', body, cookies = [] } = {}) {
  const headers = new Headers({ origin });
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (cookies.length) headers.set('cookie', cookies.join('; '));
  return worker.fetch(new Request(origin + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  }), env, {
    waitUntil() {},
    passThroughOnException() {}
  });
}

async function register(env, email) {
  const response = await request(env, '/api/auth/register', {
    method: 'POST',
    body: { email, password: 'local-password-12345' }
  });
  assert.equal(response.status, 201);
  return responseCookie(response);
}

test('developer can preview free and Premium without changing the subscription', async () => {
  const database = createDatabase();
  const env = {
    APP_URL: origin,
    AUTH_PEPPER: 'local-test-pepper-1234567890123456',
    BILLING_DB: new D1TestDatabase(database),
    BILLING_ENABLED: 'false',
    DEVELOPER_EMAILS: developerEmail,
    DEVELOPER_PREVIEW_COMMAND: developerCommand,
    SIGNUP_ENABLED: 'true',
    AI: {
      run: async () => ({
        response: JSON.stringify({
          scores: [],
          headline: 'テスト評価',
          summary: 'テスト',
          good: 'テスト',
          improve: 'テスト',
          nextPhrase: 'テスト',
          hiddenNeed: ''
        })
      })
    },
    ASSETS: { fetch: () => new Response('Not found', { status: 404 }) }
  };

  const sessionCookie = await register(env, developerEmail);
  assert.match(sessionCookie, /^__Host-roleplay_session=/);

  let response = await request(env, '/api/billing/status', { cookies: [sessionCookie] });
  let state = await response.json();
  assert.deepEqual(state.developerPreview, { available: true, mode: 'actual', expiresAt: null });
  assert.equal(state.premium, false);
  assert.equal(state.subscriptionPremium, false);

  response = await request(env, '/api/developer/preview', {
    method: 'POST',
    cookies: [sessionCookie],
    body: { command: 'wrong-command', mode: 'premium' }
  });
  assert.equal(response.status, 403);

  response = await request(env, '/api/developer/preview', {
    method: 'POST',
    cookies: [sessionCookie],
    body: { command: developerCommand, mode: 'premium' }
  });
  assert.equal(response.status, 200);
  const premiumCookie = responseCookie(response);
  assert.match(premiumCookie, /^__Host-roleplay_dev_preview=/);

  response = await request(env, '/api/billing/status', { cookies: [sessionCookie, premiumCookie] });
  state = await response.json();
  assert.equal(state.premium, true);
  assert.equal(state.subscriptionPremium, false);
  assert.equal(state.developerPreview.mode, 'premium');
  assert.ok(state.developerPreview.expiresAt > Math.floor(Date.now() / 1000));

  response = await request(env, '/api/roleplay', {
    method: 'POST',
    cookies: [sessionCookie, premiumCookie],
    body: { action: 'evaluate', category: 'sales', conversation: [] }
  });
  assert.equal(response.status, 200);

  const account = database.prepare('SELECT id FROM users WHERE email = ?').get(developerEmail);
  const now = Math.floor(Date.now() / 1000);
  database.prepare(`
    INSERT INTO billing_accounts (account_id, status, created_at, updated_at)
    VALUES (?, 'active', ?, ?)
  `).run(account.id, now, now);

  response = await request(env, '/api/developer/preview', {
    method: 'POST',
    cookies: [sessionCookie, premiumCookie],
    body: { command: developerCommand, mode: 'free' }
  });
  assert.equal(response.status, 200);
  const freeCookie = responseCookie(response);

  response = await request(env, '/api/billing/status', { cookies: [sessionCookie, freeCookie] });
  state = await response.json();
  assert.equal(state.subscriptionPremium, true);
  assert.equal(state.premium, false);
  assert.equal(state.developerPreview.mode, 'free');

  response = await request(env, '/api/roleplay', {
    method: 'POST',
    cookies: [sessionCookie, freeCookie],
    body: { action: 'evaluate', category: 'sales', conversation: [] }
  });
  assert.equal(response.status, 402);
  assert.equal((await response.json()).code, 'premium_required');

  response = await request(env, '/api/developer/preview', {
    method: 'POST',
    cookies: [sessionCookie, freeCookie],
    body: { command: developerCommand, mode: 'actual' }
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') || '', /Max-Age=0/);

  const ordinaryCookie = await register(env, 'ordinary@example.com');
  response = await request(env, '/api/billing/status', { cookies: [ordinaryCookie] });
  state = await response.json();
  assert.equal(state.developerPreview.available, false);
  response = await request(env, '/api/developer/preview', {
    method: 'POST',
    cookies: [ordinaryCookie],
    body: { command: developerCommand, mode: 'premium' }
  });
  assert.equal(response.status, 404);

  // Password reset sends a single-use link without revealing whether an account exists.
  env.RESEND_API_KEY = 're_test_key';
  env.PASSWORD_RESET_FROM = 'AI Roleplay Studio <no-reply@example.com>';
  const nativeFetch = globalThis.fetch;
  let resetUrl = '';
  let rejectResetEmail = true;
  globalThis.fetch = async (url, init) => {
    if (String(url) === 'https://api.resend.com/emails') {
      if (rejectResetEmail) return Response.json({ name: 'validation_error', message: 'Rejected for test' }, { status: 403 });
      const payload = JSON.parse(init.body);
      resetUrl = payload.html.match(/href="([^"]+)/)?.[1] || '';
      return Response.json({ id: 'email-test' });
    }
    return nativeFetch(url, init);
  };
  try {
    response = await request(env, '/api/auth/password-reset/request', {
      method: 'POST', body: { email: 'ordinary@example.com' }
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, 'email_delivery_failed');
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM password_reset_tokens").get().count, 0);

    rejectResetEmail = false;
    response = await request(env, '/api/auth/password-reset/request', {
      method: 'POST', body: { email: developerEmail }
    });
    assert.equal(response.status, 200);
    assert.match((await response.json()).message, /登録されている場合/);
    assert.match(resetUrl, /reset_token=/);

    const resetToken = new URL(resetUrl).searchParams.get('reset_token');
    response = await request(env, '/api/auth/password-reset/confirm', {
      method: 'POST', body: { token: resetToken, password: 'new-local-password-67890' }
    });
    assert.equal(response.status, 200);

    response = await request(env, '/api/auth/password-reset/confirm', {
      method: 'POST', body: { token: resetToken, password: 'another-password-67890' }
    });
    assert.equal(response.status, 400);

    response = await request(env, '/api/auth/login', {
      method: 'POST', body: { email: developerEmail, password: 'local-password-12345' }
    });
    assert.equal(response.status, 401);
    response = await request(env, '/api/auth/login', {
      method: 'POST', body: { email: developerEmail, password: 'new-local-password-67890' }
    });
    assert.equal(response.status, 200);
  } finally {
    globalThis.fetch = nativeFetch;
  }

  database.close();
});
