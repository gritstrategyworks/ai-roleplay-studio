const COOKIE_NAME = '__Host-roleplay_account';
const PREMIUM_STATUSES = new Set(['active', 'trialing']);

function parseCookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

function toBase64Url(bytes) {
  let value = '';
  for (const byte of new Uint8Array(bytes)) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}


async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

async function readAccountId(request, secret) {
  const value = parseCookies(request)[COOKIE_NAME];
  if (!value) return null;
  const splitAt = value.lastIndexOf('.');
  if (splitAt < 0) return null;
  const accountId = value.slice(0, splitAt);
  const signature = value.slice(splitAt + 1);
  return safeEqual(signature, await sign(accountId, secret)) ? accountId : null;
}

export async function getBillingIdentity(request, env) {
  if (!env.BILLING_SESSION_SECRET) throw new Error('BILLING_SESSION_SECRET is not configured.');
  const existing = await readAccountId(request, env.BILLING_SESSION_SECRET);
  if (existing) return { accountId: existing, cookie: null };
  const accountId = crypto.randomUUID();
  const signature = await sign(accountId, env.BILLING_SESSION_SECRET);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return {
    accountId,
    cookie: `${COOKIE_NAME}=${accountId}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
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
