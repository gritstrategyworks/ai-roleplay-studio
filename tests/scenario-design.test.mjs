import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
await import(new URL('../scenario-design.js?scenario-design-tests', import.meta.url));
const design = globalThis.ScenarioDesign;

function config(overrides = {}) {
  return {
    product: { name: '営業研修', target: 'BtoB', type: '無形商材', price: '月額3万円', description: '対話研修', benefits: '商談力向上' },
    customer: { gender: 'male', ageGroup: 'middle', needs: '', scenarioMode: 'auto', hiddenDirection: '', hiddenTruth: '', hiddenConditions: '', ...overrides },
    deal: { scene: '初回訪問', attitude: '普通', difficulty: 'normal', goal: 'ニーズを把握する' },
  };
}

const scenario = {
  id: 'sales_discovery',
  hiddenNeed: '表面的な要望だけでなく、意思決定条件を整理できていない',
};

test('auto mode fixes a deterministic hidden scenario without requiring public facts', () => {
  const first = design.buildHiddenProfile({ category: 'sales', config: config(), scenario, difficulty: 'normal' });
  const second = design.buildHiddenProfile({ category: 'sales', config: config(), scenario, difficulty: 'normal' });
  assert.deepEqual(first, second);
  assert.equal(first.mode, 'auto');
  assert.match(first.publicFacts, /具体的な課題/);
  assert.match(first.hiddenTruth, /意思決定条件/);
  assert.ok(first.hiddenConditions.length > 10);
  assert.equal(first.successCriteria.length, 5);
});

test('guided and manual modes preserve the trainer intent while remaining internally complete', () => {
  const guided = design.buildHiddenProfile({
    category: 'manager',
    config: config({ scenarioMode: 'guided', hiddenDirection: '評価よりも、期待されていないと感じている' }),
    scenario: { id: 'manager_1on1', hiddenNeed: '相談すると能力不足と思われるのが怖い' },
    difficulty: 'hard',
  });
  assert.match(guided.hiddenTruth, /期待されていない/);
  assert.match(guided.revealPolicy, /断片的/);

  const manual = design.buildHiddenProfile({
    category: 'support',
    config: config({
      scenarioMode: 'manual',
      hiddenTruth: '説明がなく軽視されたことに怒っている',
      hiddenConditions: '本日17時までの状況報告なら待てる',
    }),
    scenario: { id: 'support_delay', hiddenNeed: '遅延自体より説明できないことに困っている' },
    difficulty: 'normal',
  });
  assert.equal(manual.hiddenTruth, '説明がなく軽視されたことに怒っている');
  assert.equal(manual.hiddenConditions, '本日17時までの状況報告なら待てる');
});

test('discovery review separates what was asked from important missed areas', () => {
  const review = design.analyzeDiscovery({
    category: 'sales',
    conversation: [
      { role: 'assistant', text: '今日はよろしくお願いします。' },
      { role: 'user', text: '現在どのような課題があり、業務へどの程度影響していますか？' },
      { role: 'user', text: '意思決定には誰が関わりますか？' },
    ],
    profile: { hiddenTruth: '現場定着を心配している', hiddenConditions: '効果測定が必要' },
  });
  assert.equal(review.score, 60);
  assert.deepEqual(review.discoveredItems, ['現状・課題', '影響・優先度', '意思決定']);
  assert.deepEqual(review.missedItems, ['予算・時期', '導入条件']);
  assert.match(review.hiddenSummary, /判断条件/);
});

test('frontend and Workers AI share the hidden scenario contract', async () => {
  const [index, app, auth, worker, serviceWorker] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../auth.js', import.meta.url), 'utf8'),
    readFile(new URL('../roleplay.js', import.meta.url), 'utf8'),
    readFile(new URL('../service-worker.js', import.meta.url), 'utf8'),
  ]);
  for (const marker of ['AIにおまかせ', '方向性だけ指定', 'すべて自分で設定', 'ヒアリング到達度']) {
    assert.match(index, new RegExp(marker));
  }
  assert.match(app, /buildHiddenProfile/);
  assert.match(app, /analyzeDiscovery/);
  assert.doesNotMatch(app, /\['customerNeedsInput','顧客ニーズ'\]/);
  assert.match(worker, /開始前から利用者が知っている公開情報/);
  assert.match(worker, /AIだけが知る非公開の本音・背景/);
  assert.match(worker, /discoveryScore/);
  assert.match(auth, /scenario-design\.js\?v=1\.19/);
  assert.match(serviceWorker, /scenario-design\.js\?v=1\.19/);
});
