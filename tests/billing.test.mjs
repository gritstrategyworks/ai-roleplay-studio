import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { hasPremiumAccess } from '../functions/_lib/billing.js';
import { verifyStripeWebhook } from '../functions/_lib/stripe.js';
import { onRequestGet as getStatus } from '../functions/api/billing/status.js';
import { onRequestPost as createCheckout } from '../functions/api/billing/checkout.js';

function fakeDb(row = null) {
  return {
    prepare() {
      return {
        bind() {
          return {
            first: async () => row,
            run: async () => ({ success: true }),
          };
        },
      };
    },
  };
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
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  assert.equal(await verifyStripeWebhook(payload, `t=${timestamp},v1=${signature}`, secret), true);
  assert.equal(await verifyStripeWebhook(`${payload}x`, `t=${timestamp},v1=${signature}`, secret), false);
});

test('billing status creates a signed HttpOnly identity cookie', async () => {
  const response = await getStatus({
    request: new Request('https://example.com/api/billing/status'),
    env: { BILLING_SESSION_SECRET: 'a'.repeat(32), BILLING_DB: fakeDb() },
  });
  const data = await response.json();
  assert.equal(data.premium, false);
  assert.match(response.headers.get('set-cookie'), /__Host-roleplay_account=.*HttpOnly.*SameSite=Lax.*Secure/);
});

test('checkout creates a JPY monthly-price subscription session', async () => {
  const originalFetch = globalThis.fetch;
  let submitted;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    submitted = new URLSearchParams(init.body);
    return Response.json({ url: 'https://checkout.stripe.com/test/session' });
  };
  try {
    const request = new Request('https://example.com/api/billing/checkout', {
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
        BILLING_SESSION_SECRET: 'b'.repeat(32),
        BILLING_DB: fakeDb(),
        APP_URL: 'https://example.com',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(submitted.get('mode'), 'subscription');
    assert.equal(submitted.get('line_items[0][price]'), 'price_monthly_980');
    assert.ok(submitted.get('subscription_data[metadata][account_id]'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
