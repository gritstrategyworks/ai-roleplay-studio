import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app, css, serviceWorker, config] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/monetization.json', import.meta.url), 'utf8').then(JSON.parse)
]);

test('AdSense is removed and the free-plan native placement is available', () => {
  assert.doesNotMatch(html, /pagead2\.googlesyndication\.com|adsbygoogle|google-adsense-account|ca-pub-/);
  assert.match(html, /id="freeMonetizationPlacement"/);
  assert.match(css, /\.monetization-card/);
  assert.equal(config.enabled, true);
  assert.equal(config.kind, 'house');
});

test('monetization is visible only after free-plan state is known', () => {
  assert.match(app, /monetizationConfig\?\.enabled&&offer&&!billingState\.loading&&!billingState\.premium/);
  assert.match(app, /renderMonetizationPlacement\(\)/);
});

test('external sponsor and affiliate links are safely marked', () => {
  assert.match(app, /\['https:','http:'\]\.includes/);
  assert.match(app, /noopener noreferrer sponsored/);
});

test('monetization configuration is shipped in the PWA cache', () => {
  assert.match(serviceWorker, /monetization\.json/);
  assert.match(serviceWorker, /v1-63-native-monetization/);
});