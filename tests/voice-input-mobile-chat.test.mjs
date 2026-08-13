import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const worker = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');

test('hands-free recognition retries transient desktop failures', () => {
  assert.match(app, /function scheduleRecognitionRestart\(delay=500\)/);
  assert.match(app, /e\.error==='no-speech'\|\|e\.error==='network'\|\|e\.error==='audio-capture'/);
  assert.match(app, /if\(!started&&attempt<4\)scheduleRecognitionRestart/);
  assert.match(app, /function stopVoiceRuntime\(cancelSpeech=true\)\{clearRecognitionRestart\(\)/);
});

test('mobile roleplay prioritizes LINE-like message history', () => {
  assert.match(styles, /Mobile conversation view: prioritize the message history/);
  assert.match(styles, /grid-template-rows:64px minmax\(0,1fr\)/);
  assert.match(styles, /\.message\.user \.bubble\{[^}]*background:#9bea72/);
  assert.match(styles, /\.composer-tools\{display:none\}/);
  assert.match(worker, /v1-38-email-reset/);
});
