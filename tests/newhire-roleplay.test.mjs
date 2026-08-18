import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [app, design, html, worker] = await Promise.all([
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/scenario-design.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/index.js', import.meta.url), 'utf8'),
]);

test('home and setup expose the new-hire roleplay category', () => {
  assert.match(html, /startSetup\('newhire'\)/);
  assert.match(html, /<h3>新入社員<\/h3>/);
  assert.match(app, /newhire:'新入社員'/);
  assert.match(app, /title:'新入社員ロープレ設定'/);
  assert.match(app, /scene:\['報告・連絡・相談','指示を受ける','電話・社内対話','途中報告','ミス報告・振り返り'\]/);
});

test('new-hire roleplay has four lecture-aligned scenarios', () => {
  for (const id of ['newhire_report', 'newhire_instruction', 'newhire_dialogue', 'newhire_workflow']) {
    assert.match(app, new RegExp(`id:'${id}'`));
    assert.match(app, new RegExp(`${id}:\\[`));
  }
  assert.match(app, /newhire:\['基本姿勢','要点の明確さ','事実・認識整理','確認・質問','期限・途中共有','次の行動'\]/);
  assert.match(app, /newhireAiStarts=state\.category==='newhire'/);
});

test('all four new-hire lectures can start their matching practice', () => {
  const newhireLectures = [...app.matchAll(/\{id:'5\.[1-4]',category:'newhire'[^\n]+\}/g)].map(match => match[0]);
  assert.equal(newhireLectures.length, 4);
  for (const lecture of newhireLectures) {
    assert.match(lecture, /scene:'/);
    assert.match(lecture, /goal:'/);
    assert.doesNotMatch(lecture, /practice:false/);
  }
});

test('scenario design supports hidden needs and discovery feedback for new hires', () => {
  assert.match(design, /newhire: \{/);
  assert.match(design, /上司・先輩の本音・判断基準/);
  assert.match(design, /利用者は新入社員として/);
  assert.match(design, /\['確認・完成イメージ'/);
});

test('worker keeps AI in the supervisor or counterpart role and scores new-hire skills', () => {
  assert.match(worker, /newhire: Object\.freeze\(\{/);
  assert.match(worker, /userRole: "新入社員・若手社員"/);
  assert.match(worker, /aiRole: "指示・報告を受ける上司・先輩、または社内外の相手役"/);
  assert.match(worker, /speakerRole: "newhire_counterpart"/);
  assert.match(worker, /新入社員として利用者の代わりに報告・復唱・質問・電話対応を行う/);
  assert.match(worker, /newhire: \["基本姿勢", "要点の明確さ", "事実・認識整理", "確認・質問", "期限・途中共有", "次の行動"\]/);
});
