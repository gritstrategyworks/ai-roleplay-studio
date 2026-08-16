import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [html, app, styles, worker] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
]);

test('setup offers 5, 10 and 15 minute sessions with Premium locks', () => {
  assert.match(html, /id="roleplayTimeLimitSelect"/);
  assert.match(html, /value="300">5分/);
  assert.match(html, /value="600" data-premium-time>10分（Premium）/);
  assert.match(html, /value="900" data-premium-time>15分（Premium）/);
  assert.match(app, /return hasPremiumFeatures\(\)&&\[300,600,900\]\.includes\(requested\)\?requested:300/);
  assert.match(app, /option\.disabled=!premium/);
});

test('expiry gives three turns and reveals an inline end action', () => {
  assert.match(app, /設定時間になりました。3ターン以内に会話を終わらせてください。/);
  assert.match(app, /if\(state\.timeExpired\)\{state\.turnsAfterTimeExpired\+\+;updateTimeLimitAction\(\)\}/);
  assert.match(app, /state\.turnsAfterTimeExpired>=3[\s\S]*await finishRoleplay\(\)/);
  assert.match(html, /id="timeLimitAction"[^>]+hidden/);
  assert.match(html, /ロープレを終了する/);
  assert.match(styles, /\.time-limit-action\{/);
  assert.match(worker, /v1-47-admin-menu-visibility/);
});
