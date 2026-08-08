import { getBillingIdentity, getSubscription } from '../../_lib/billing.js';
import { assertSameOrigin, errorResponse, json } from '../../_lib/http.js';
import { stripeRequest } from '../../_lib/stripe.js';

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    if (env.STRIPE_PORTAL_LOGIN_URL) {
      return json({ url: env.STRIPE_PORTAL_LOGIN_URL });
    }
    const { accountId } = await getBillingIdentity(request, env);
    const subscription = await getSubscription(env, accountId);
    if (!subscription?.stripe_customer_id) {
      return json({ error: 'Stripe customer not found.', code: 'customer_not_found' }, { status: 404 });
    }

    const appUrl = String(env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');
    const form = new URLSearchParams({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/?billing=returned`,
    });
    const session = await stripeRequest(env, '/billing_portal/sessions', { method: 'POST', body: form });
    return json({ url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
}
