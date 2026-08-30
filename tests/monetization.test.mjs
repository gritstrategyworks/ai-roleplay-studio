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

test('Ninja AdMax is configured for the free-plan placement', () => {
  assert.doesNotMatch(html, /pagead2\.googlesyndication\.com|adsbygoogle|google-adsense-account|ca-pub-/);
  assert.match(html, /id="freeMonetizationPlacement"/);
  assert.match(css, /\.admax-card/);
  assert.equal(config.enabled, true);
  assert.equal(config.kind, 'admax');
  assert.equal(config.home.admaxId, 'admax-banner-c8a625c8-b327-4357-a173-3098f9e0c81f');
  assert.match(app, /https:\/\/adm\.shinobi\.jp\/st\/t\.js/);
  assert.doesNotMatch(app, /adm\.shinobi\.jp\/s\/b71b8cdc712059daf201c73e64f1aaef/);
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
  assert.match(serviceWorker, /v1-65-advisor-daily-limit/);
});