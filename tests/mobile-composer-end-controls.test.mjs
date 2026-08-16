import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [html, app, styles, worker] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
]);

test('roleplay has an always-visible header end control', () => {
  assert.match(html, /class="roleplay-end-header"[^>]+onclick="requestEndRoleplay\(\)"/);
  assert.match(styles, /\.roleplay-end-header\{/);
});

test('mobile composer follows the visual viewport and keyboard', () => {
  assert.match(app, /--roleplay-viewport-offset-top/);
  assert.match(app, /roleplay-keyboard-open/);
  assert.match(app, /setupMobileComposer\(\)/);
  assert.match(styles, /position:sticky;\s*bottom:0/);
  assert.match(styles, /roleplay-keyboard-open \.customer-panel\{display:none\}/);
});

test('asset cache is bumped for the layout fix', () => {
  assert.match(worker, /v1-45-password-reset-delivery/);
  assert.match(worker, /styles\.css\?v=1\.45/);
});
