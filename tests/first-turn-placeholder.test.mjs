import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [app, html, worker] = await Promise.all([
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
]);

test('the opening prompt is limited to the first user turn', () => {
  assert.match(app, /FIRST_TURN_MESSAGE_PLACEHOLDER='挨拶と目的から話してください'/);
  assert.match(app, /showRoleplayStartGuide[\s\S]*setMessagePlaceholder\(FIRST_TURN_MESSAGE_PLACEHOLDER\)/);
  assert.match(app, /async function sendUserMessage[\s\S]*if\(state\.isBusy\)return;\s*setMessagePlaceholder\(\);/);
});

test('new sessions and later turns use the neutral prompt', () => {
  assert.match(app, /DEFAULT_MESSAGE_PLACEHOLDER='メッセージを入力してください'/);
  assert.match(html, /id="messageInput"[^>]+placeholder="メッセージを入力してください"/);
  assert.match(worker, /v1-42-first-turn-placeholder/);
});
