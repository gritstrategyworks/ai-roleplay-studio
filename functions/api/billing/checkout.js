import { getBillingIdentity, getSubscription, hasPremiumAccess } from '../../_lib/billing.js';
import { assertSameOrigin, errorResponse, json } from '../../_lib/http.js';
import { stripeRequest } from '../../_lib/stripe.js';

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    if (!env.BILLING_DB) throw new Error('BILLING_DB is not configured.');
    if (env.BILLING_ENABLED !== 'true') {
      return json({ error: 'Billing is not yet available.', code: 'billing_unavailable' }, { status: 503 });
    }

    const { accountId, cookie } = await getBillingIdentity(request, env);
    const subscription = await getSubscription(env, accountId);
    if (hasPremiumAccess(subscription)) {
      return json({ error: 'Subscription is already active.', code: 'already_subscribed' }, { status: 409 });
    }

    if (env.STRIPE_PAYMENT_LINK_URL) {
      const paymentLink = new URL(env.STRIPE_PAYMENT_LINK_URL);
      paymentLink.searchParams.set('client_reference_id', accountId);
      paymentLink.searchParams.set('locale', 'ja');
      return json({ url: paymentLink.toString() }, { headers: cookie ? { 'set-cookie': cookie } : {} });
    }
    if (!env.STRIPE_PRICE_ID) throw new Error('STRIPE_PRICE_ID is not configured.');
    const appUrl = String(env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');
    const form = new URLSearchParams({
      mode: 'subscription',
      locale: 'ja',
      'line_items[0][price]': env.STRIPE_PRICE_ID,
      'line_items[0][quantity]': '1',
      client_reference_id: accountId,
      'metadata[account_id]': accountId,
      'subscription_data[metadata][account_id]': accountId,
      success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
    });
    if (subscription?.stripe_customer_id) form.set('customer', subscription.stripe_customer_id);

    const session = await stripeRequest(env, '/checkout/sessions', { method: 'POST', body: form });
    return json({ url: session.url }, { headers: cookie ? { 'set-cookie': cookie } : {} });
  } catch (error) {
    return errorResponse(error);
  }
}
