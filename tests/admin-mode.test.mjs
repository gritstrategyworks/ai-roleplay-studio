import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [html, app, worker, config] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
]);

test('administrator account gets a protected Premium mode menu', () => {
  assert.match(config, /"ADMIN_EMAILS": "hirofumi\.koizumi@gmail\.com"/);
  assert.match(worker, /env\.ADMIN_MODE_PASSWORD \|\| env\.DEVELOPER_PREVIEW_COMMAND/);
  assert.match(worker, /verifyDeveloperPreviewCommand\(body\.command, expectedPassword\)/);
  assert.match(worker, /const developerAvailable = isDeveloperUser\(user, env\)/);
  assert.match(worker, /configured: developerConfigured/);
  assert.match(html, /id="adminMenuButton"/);
  assert.match(html, /管理者メニュー/);
  assert.match(html, /管理者パスワード/);
  assert.match(html, /管理者Premium/);
  assert.match(app, /menuButton\.hidden=billingState\.loading\|\|!preview\.available/);
  assert.match(app, /ADMIN_MODE_PASSWORD.+実行中のWorkerに反映されていません/);
});

test('administrator mode is temporary and does not modify Stripe state', () => {
  assert.match(html, /4時間で自動終了/);
  assert.match(html, /Stripeの契約・請求データは変更しません/);
  assert.match(worker, /DEVELOPER_PREVIEW_TTL_SECONDS/);
  assert.match(worker, /SameSite=Strict/);
});
