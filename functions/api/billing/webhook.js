import { subscriptionPeriodEnd, upsertSubscription } from '../../_lib/billing.js';
import { json } from '../../_lib/http.js';
import { stripeRequest, verifyStripeWebhook } from '../../_lib/stripe.js';

function objectId(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

async function syncSubscription(env, subscription, fallbackAccountId = null) {
  let accountId = subscription?.metadata?.account_id || fallbackAccountId;
  if (!accountId && subscription?.id) {
    const existing = await env.BILLING_DB.prepare(
      'SELECT account_id FROM billing_accounts WHERE stripe_subscription_id = ?',
    ).bind(subscription.id).first();
    accountId = existing?.account_id || null;
  }
  if (!accountId) return false;
  await upsertSubscription(env, {
    accountId,
    customerId: objectId(subscription.customer),
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
  });
  return true;
}

export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const valid = await verifyStripeWebhook(
    payload,
    request.headers.get('stripe-signature'),
    env.STRIPE_WEBHOOK_SECRET,
  );
  if (!valid) return json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  if (!env.BILLING_DB) return json({ error: 'BILLING_DB is not configured.' }, { status: 503 });

  try {
    const event = JSON.parse(payload);
    const processed = await env.BILLING_DB.prepare(
      'SELECT event_id FROM stripe_events WHERE event_id = ?',
    ).bind(event.id).first();
    if (processed) return json({ received: true, duplicate: true });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.subscription) {
        if (env.STRIPE_SECRET_KEY) {
          const subscription = await stripeRequest(env, `/subscriptions/${objectId(session.subscription)}`);
          await syncSubscription(env, subscription, session.client_reference_id || session.metadata?.account_id);
        } else {
          await syncSubscription(env, {
            id: objectId(session.subscription), customer: session.customer,
            status: session.payment_status === 'paid' ? 'active' : 'incomplete',
            metadata: {},
          }, session.client_reference_id || session.metadata?.account_id);
        }
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      await syncSubscription(env, event.data.object);
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const subscriptionId = objectId(invoice.subscription || invoice.parent?.subscription_details?.subscription);
      if (subscriptionId) {
        await syncSubscription(env, {
          id: subscriptionId,
          customer: invoice.customer,
          status: event.type === 'invoice.paid' ? 'active' : 'past_due',
          metadata: {},
        });
      }
    }

    await env.BILLING_DB.prepare(
      'INSERT OR IGNORE INTO stripe_events (event_id, event_type, received_at) VALUES (?, ?, ?)',
    ).bind(event.id, event.type, Math.floor(Date.now() / 1000)).run();
    return json({ received: true });
  } catch (error) {
    console.error('stripe webhook error', error);
    return json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
