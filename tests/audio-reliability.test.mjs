import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const appSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const serviceWorkerSource = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');

test('browser speech keeps utterances alive and retries a turn that does not start', () => {
  assert.match(appSource, /let currentBrowserUtterance = null/);
  assert.match(appSource, /splitSpeechText\(text,maxLength=90\)/);
  assert.match(appSource, /if\(!played&&token===speechToken\).*speakBrowserChunk\(chunk,options,token,1\)/s);
  assert.match(appSource, /currentBrowserUtterance=utter;synthesis\.speak\(utter\)/);
});

test('audio reliability release invalidates cached app assets', () => {
  assert.match(indexSource, /auth\.js\?v=1\.55/);
  assert.match(serviceWorkerSource, /v1-55-newhire-video-end/);
  assert.match(serviceWorkerSource, /app\.js\?v=1\.55/);
});
