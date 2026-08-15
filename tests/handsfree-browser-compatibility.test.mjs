import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');

test('hands-free reports unsupported Brave and recovers stalled recognition', () => {
  assert.match(app, /async function isBraveBrowser\(\)/);
  assert.match(app, /Braveは音声認識サービスに対応していません。ChromeまたはEdgeで開いてください/);
  assert.match(app, /recognitionWatchdogTimer=setTimeout/);
  assert.match(app, /recognition\.onspeechend=/);
  assert.match(worker, /v1-39-mobile-composer-end/);
});
