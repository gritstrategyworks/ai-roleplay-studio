import { getSessionUser } from './auth.js';

const PREMIUM_STATUSES = new Set(['active', 'trialing']);

export async function getBillingIdentity(request, env) {
  const session = await getSessionUser(request, env);
  if (!session) throw new Response('Unauthorized', { status: 401 });
  return {
    accountId: session.user.id,
    user: session.user,
    cookie: null,
  };
}

export async function getSubscription(env, accountId) {
  if (!env.BILLING_DB) return null;
  return env.BILLING_DB.prepare(
    'SELECT stripe_customer_id, stripe_subscription_id, status, current_period_end FROM billing_accounts WHERE account_id = ?',
  ).bind(accountId).first();
}

export function hasPremiumAccess(subscription) {
  return Boolean(subscription && PREMIUM_STATUSES.has(subscription.status));
}

export function subscriptionPeriodEnd(subscription) {
  return subscription?.current_period_end ?? subscription?.items?.data?.[0]?.current_period_end ?? null;
}

export async function upsertSubscription(env, values) {
  if (!env.BILLING_DB) throw new Error('BILLING_DB is not configured.');
  const now = Math.floor(Date.now() / 1000);
  await env.BILLING_DB.prepare(`
    INSERT INTO billing_accounts (
      account_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      updated_at = excluded.updated_at
  `).bind(
    values.accountId,
    values.customerId || null,
    values.subscriptionId || null,
    values.status || 'incomplete',
    values.currentPeriodEnd || null,
    now,
    now,
  ).run();
}
