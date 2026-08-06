import { getBillingIdentity, getSubscription, hasPremiumAccess } from '../../_lib/billing.js';
import { errorResponse, json } from '../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  try {
    const { accountId, cookie } = await getBillingIdentity(request, env);
    const subscription = await getSubscription(env, accountId);
    return json({
      premium: hasPremiumAccess(subscription),
      status: subscription?.status || 'free',
      currentPeriodEnd: subscription?.current_period_end || null,
      canManage: Boolean(subscription?.stripe_customer_id),
      billingAvailable: env.BILLING_ENABLED === 'true' && Boolean(env.STRIPE_PAYMENT_LINK_URL || env.STRIPE_SECRET_KEY),
    }, { headers: cookie ? { 'set-cookie': cookie } : {} });
  } catch (error) {
    return errorResponse(error);
  }
}
