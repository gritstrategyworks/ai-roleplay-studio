import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { hasPremiumAccess } from '../functions/_lib/billing.js';
import { verifyStripeWebhook } from '../functions/_lib/stripe.js';
import { onRequestGet as getStatus } from '../functions/api/billing/status.js';
import { onRequestPost as createCheckout } from '../functions/api/billing/checkout.js';

function fakeDb(options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const user = options.user || {
    token_hash: 'stored-token-hash',
    id: 'user_test_123',
    email: 'member@example.com',
    expires_at: now + 3600,
    last_seen_at: now,
  };
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            first: async () => {
              if (sql.includes('FROM auth_sessions')) return user;
              if (sql.includes('FROM billing_accounts')) return options.subscription || null;
              return null;
            },
            run: async () => ({ success: true }),
          };
        },
      };
    },
  };
}

function authenticatedRequest(url, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('cookie', '__Host-roleplay_session=test-session-token');
  return new Request(url, { ...init, headers });
}

test('premium access only accepts active and trialing subscriptions', () => {
  assert.equal(hasPremiumAccess({ status: 'active' }), true);
  assert.equal(hasPremiumAccess({ status: 'trialing' }), true);
  assert.equal(hasPremiumAccess({ status: 'past_due' }), false);
  assert.equal(hasPremiumAccess({ status: 'canceled' }), false);
  assert.equal(hasPremiumAccess(null), false);
});

test('Stripe webhook signature is verified with timestamp tolerance', async () => {
  const payload = JSON.stringify({ id: 'evt_test', type: 'customer.subscription.updated' });
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = 'whsec_test_secret';
  const signature = createHmac('sha256', secret).update(timestamp + '.' + payload).digest('hex');
  assert.equal(await verifyStripeWebhook(payload, 't=' + timestamp + ',v1=' + signature, secret), true);
  assert.equal(await verifyStripeWebhook(payload + 'x', 't=' + timestamp + ',v1=' + signature, secret), false);
});

test('billing status uses the authenticated account without creating an anonymous cookie', async () => {
  const response = await getStatus({
    request: authenticatedRequest('https://example.com/api/billing/status'),
    env: { BILLING_DB: fakeDb() },
  });
  const data = await response.json();
  assert.equal(data.premium, false);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('checkout ties the Stripe subscription to the logged-in user', async () => {
  const originalFetch = globalThis.fetch;
  let submitted;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    submitted = new URLSearchParams(init.body);
    return Response.json({ url: 'https://checkout.stripe.com/test/session' });
  };
  try {
    const request = authenticatedRequest('https://example.com/api/billing/checkout', {
      method: 'POST',
      headers: { origin: 'https://example.com', 'content-type': 'application/json' },
      body: '{}',
    });
    const response = await createCheckout({
      request,
      env: {
        STRIPE_SECRET_KEY: 'sk_test_example',
        STRIPE_PRICE_ID: 'price_monthly_980',
        BILLING_ENABLED: 'true',
        BILLING_DB: fakeDb(),
        APP_URL: 'https://example.com',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(submitted.get('mode'), 'subscription');
    assert.equal(submitted.get('line_items[0][price]'), 'price_monthly_980');
    assert.equal(submitted.get('metadata[account_id]'), 'user_test_123');
    assert.equal(submitted.get('customer_email'), 'member@example.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
