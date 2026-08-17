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

test('iPhone browsers keep text and microphone controls inside the visual viewport', () => {
  assert.match(html, /id="messageInput"[^>]+inputmode="text"[^>]+enterkeyhint="send"/);
  assert.match(styles, /@supports \(-webkit-touch-callout:none\)/);
  assert.match(styles, /roleplay-active \.topbar\{display:none\}/);
  assert.match(styles, /roleplay-active \.composer\{[\s\S]*display:block!important;[\s\S]*position:relative!important/);
  assert.doesNotMatch(app, /beginRoleplay=async function\(\)\{state\.interaction='voice'/);
});

test('asset cache is bumped for the layout fix', () => {
  assert.match(worker, /v1-48-iphone-composer/);
  assert.match(worker, /styles\.css\?v=1\.48/);
});
