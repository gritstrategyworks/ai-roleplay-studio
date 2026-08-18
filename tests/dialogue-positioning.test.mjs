import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [html, manifest, worker] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'),
  readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
]);

test('marketing copy positions the product as practical dialogue training', () => {
  const head = html.match(/<head>[\s\S]*?<\/head>/)?.[0] || '';
  const hero = html.match(/<div class="hero">[\s\S]*?<\/div>\s*<section id="developerPreviewPanel"/)?.[0] || '';
  assert.doesNotMatch(head, /音声ロープレ|音声で実践|音声で会話/);
  assert.doesNotMatch(hero, /AI音声|声で話/);
  assert.match(hero, /AI実践ロールプレイ/);
  assert.match(hero, /文章入力またはマイク入力/);
  assert.match(manifest, /AIビジネスロールプレイスタジオ/);
});

test('microphone and read-aloud features remain available', () => {
  assert.match(html, /id="micButton"/);
  assert.match(html, /id="speechSwitch"/);
  assert.match(html, /ハンズフリーを開始/);
  assert.match(worker, /v1-55-newhire-video-end/);
});
