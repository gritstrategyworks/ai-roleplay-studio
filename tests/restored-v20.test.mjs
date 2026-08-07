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

test('quick setup is preset, hides internal scenario controls and uses real avatar assets', async () => {
  const [index, app] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);
  assert.match(index, /各項目は入力済み/);
  assert.doesNotMatch(index, /CLOUDFLARE EDITION|v1\.1 LOGIN|音声ロープレを始める|公開情報＋非公開設定|HIDDEN SCENARIO/);
  assert.match(app, /const QUICK_PRESETS=/);
  assert.match(app, /ロープレ時間（5分固定）/);
  assert.doesNotMatch(app, /labels:\[[^\n]*'顧客ニーズ'|labels:\[[^\n]*'部下の状況・悩み'|labels:\[[^\n]*'応募者の経歴・特徴'|labels:\[[^\n]*'顧客の要求・困りごと'/);
  for (const avatar of ['saito', 'yamamoto', 'suzuki', 'nakamura', 'kato', 'ito']) {
    const svg = await readFile(new URL('assets/avatars/' + avatar + '.svg', root), 'utf8');
    assert.match(svg, /<svg/);
  }
});

test('local AI selector offers exactly the requested model families', async () => {
  const [index, app, proxy, localAI] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('functions/api/local-model/[[path]].js', root), 'utf8'),
    readFile(new URL('local-ai.js', root), 'utf8'),
  ]);
  for (const model of ['Gemma 3 4B', 'Qwen3 4B', 'Llama 3.2 3B']) assert.match(index, new RegExp(model));
  assert.match(app, /LOCAL_MODEL_IDS=new Set/);
  assert.match(proxy, /gemma-3-4b-it-q4f16_1-MLC/);
  assert.match(proxy, /Qwen3-4B-q4f32_1-MLC/);
  assert.match(proxy, /Llama-3\.2-3B-Instruct-q4f32_1-MLC/);
  assert.match(localAI, /gemma-3-4b-it-q4f16_1-MLC/);
  assert.match(localAI, /some\(ig=>ig\.model_id===t\)/);
});

test('Qwen server prompt receives restored detailed settings', async () => {
  const roleplay = await readFile(new URL('roleplay.js', root), 'utf8');
  assert.match(roleplay, /roleplayConfig: sanitizeStructured/);
  assert.match(roleplay, /promptSettings: sanitizeStructured/);
  assert.match(roleplay, /利用者が入力した詳細条件/);
  assert.match(roleplay, /@cf\/qwen\/qwen3-30b-a3b-fp8/);
});

test('local model proxy rejects models outside the three-model allowlist', async () => {
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
