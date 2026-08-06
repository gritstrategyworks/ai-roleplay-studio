import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequest as localModel } from '../functions/api/local-model/[[path]].js';

const root = new URL('../', import.meta.url);

test('restored UI includes advanced settings, avatars, internal mode and Google tags', async () => {
  const index = await readFile(new URL('index.html', root), 'utf8');
  for (const marker of [
    '詳細設定',
    '顧客アバター',
    '社内情報モード',
    'AI Roleplay Studio Premium',
    '月額980円（税込）',
    'G-XH93D31BKJ',
    'zbpYn_l9DVdW1Ev0OZdQOJDWLreuTin9i0nqUele1Mo',
  ]) assert.match(index, new RegExp(marker));
});

test('Qwen server prompt receives restored detailed settings', async () => {
  const roleplay = await readFile(new URL('roleplay.js', root), 'utf8');
  assert.match(roleplay, /roleplayConfig: sanitizeStructured/);
  assert.match(roleplay, /promptSettings: sanitizeStructured/);
  assert.match(roleplay, /利用者が入力した詳細条件/);
  assert.match(roleplay, /@cf\/qwen\/qwen3-30b-a3b-fp8/);
});

test('local model proxy rejects models outside the Qwen allowlist', async () => {
  const response = await localModel({
    request: new Request('https://example.com/api/local-model/lib/Unknown-Model'),
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Unknown model asset.' });
});

test('production billing remains off until Stripe activation is complete', async () => {
  const config = await readFile(new URL('wrangler.jsonc', root), 'utf8');
  const status = await readFile(new URL('functions/api/billing/status.js', root), 'utf8');
  const checkout = await readFile(new URL('functions/api/billing/checkout.js', root), 'utf8');
  assert.match(config, /"BILLING_ENABLED": "false"/);
  assert.match(status, /env\.BILLING_ENABLED === 'true'/);
  assert.match(checkout, /code: 'billing_unavailable'/);
});
