import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [route, worker] = await Promise.all([
  readFile(new URL('../public/roleplay.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/index.js', import.meta.url), 'utf8'),
]);

for (const [label, source] of [['route', route], ['worker', worker]]) {
  test(`${label} keeps the roleplay counterpart out of the coaching role`, () => {
    assert.match(source, /相手役は利用者を指導・コーチングしたり/);
    assert.match(source, /管理職面談で部下・社員を演じる場合/);
    assert.match(source, /今後の\(\?:具体的な\)\?取り組み/);
    assert.match(source, /役割違反または指導的な発言/);
  });
}
