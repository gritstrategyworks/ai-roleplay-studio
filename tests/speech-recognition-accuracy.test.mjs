import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [app, worker] = await Promise.all([
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
]);

test('speech recognition uses alternatives and business context', () => {
  assert.match(app, /recognition\.maxAlternatives=5/);
  assert.match(app, /function speechContextTerms\(\)/);
  assert.match(app, /SpeechRecognitionPhrase\(term,5\)/);
  assert.match(app, /function chooseRecognitionAlternative\(result\)/);
  assert.match(app, /confidence\*10\+contextScore/);
});

test('common sales recognition errors are normalized before sending', () => {
  assert.match(app, /製薬率\/g,'成約率'/);
  assert.match(app, /configureRecognitionContext\(\);try\{recognition\.start/);
  assert.match(worker, /v1-49-speech-accuracy/);
});
