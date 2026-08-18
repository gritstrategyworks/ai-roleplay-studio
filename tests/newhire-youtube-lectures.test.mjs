import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';

const [app, html] = await Promise.all([
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
]);

test('new-hire lessons use their exact YouTube video IDs', () => {
  const expected = new Map([
    ['5.1', 'qi4Jh8xOdLI'],
    ['5.2', '_o3hRtZYWJc'],
    ['5.3', 'eV4LqLNY25Q'],
    ['5.4', 'H7B-p-ygOBc'],
  ]);
  const actual = new Map(
    [...app.matchAll(/\{id:'(5\.[1-4])',category:'newhire',youtubeId:'([^']+)'/g)]
      .map((match) => [match[1], match[2]]),
  );
  assert.deepEqual(actual, expected);
  assert.doesNotMatch(app, /mediaSrc:'media\/lectures\/5-[1-4]\.mp4'/);
});

test('lecture modal is YouTube-only and bundled new-hire media is absent', async () => {
  assert.match(app, /www\.youtube-nocookie\.com\/embed/);
  assert.doesNotMatch(app, /lectureLocalPlayer/);
  assert.doesNotMatch(html, /lectureLocalPlayer/);
  const entries = await readdir(new URL('../public/media/lectures/', import.meta.url)).catch(() => []);
  assert.deepEqual(entries.filter((entry) => /^5-[1-4]\.(?:mp4|png)$/.test(entry)), []);
});
