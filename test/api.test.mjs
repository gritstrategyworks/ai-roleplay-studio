import assert from 'node:assert/strict';import test from 'node:test';import {onRequestGet,onRequestPost} from '../functions/api/roleplay.js';test('status reports missing AI binding',async()=>{const r=await onRequestGet({env:{}});assert.equal(r.status,200);assert.equal((await r.json()).aiConfigured,false)});test('rejects invalid actions',async()=>{const request=new Request('https://x/api/roleplay',{method:'POST',headers:{'content-type':'application/json'},body:'{"action":"invalid"}'});assert.equal((await onRequestPost({request,env:{AI:{}}})).status,400)});test('returns AI reply',async()=>{const AI={run:async()=>({response:{reply:'承知しました。',emotion:'positive',deltas:{trust:3,interest:2,stress:-1}}})};const request=new Request('https://x/api/roleplay',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'reply',userText:'状況を教えてください。',conversation:[]})});assert.equal((await(await onRequestPost({request,env:{AI}})).json()).reply,'承知しました。')});


test('detail settings become role-locked system instructions', async () => {
  let captured;
  const AI = { run: async (_model, input) => { captured = input; return { response: { reply: '費用対効果を確認したいです。', emotion: 'skeptical', deltas: { trust: 0, interest: 1, stress: 0 } } }; } };
  const request = new Request('https://x/api/roleplay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reply', category: 'sales', avatar: { name: '鈴木社長', role: '代表取締役', industry: '建設業' }, scenario: { title: '課題ヒアリング', sceneRole: '見込み顧客', objective: '次回提案の合意' }, promptSettings: { meetingStage: '前回ヒアリング後', knownIssue: '在庫管理が属人化している', conversationGoal: '課題を具体化', constraints: '費用対効果を重視' }, userText: '在庫管理SaaSは年間180万円です', conversation: [] }) });
  const response = await onRequestPost({ request, env: { AI } });
  assert.equal(response.status, 200);
  const system = captured.messages[0].content;
  assert.match(system, /詳細設定＝今回の会話プロンプト/);
  assert.match(system, /在庫管理が属人化している/);
  assert.match(system, /利用者: 任意の商品・サービスを提案する営業担当者/);
  assert.match(system, /自社の課題を利用者に説明させたり/);
});

test('setup supports selectable free-form prompt fields and contextual fallback', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile('index.html', 'utf8');
  const app = await readFile('app.js', 'utf8');
  for (const id of ['dealSceneSelect', 'customerNeedsInput', 'roleplayGoalSelect', 'advancedToggle']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /<datalist/);
  assert.match(app, /function localReply\(text,a\)/);
  assert.match(app, /費用対効果と現場への定着/);
});


test('sales presets are product-agnostic', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile('app.js', 'utf8');
  const api = await readFile('functions/api/roleplay.js', 'utf8');
  assert.match(app, /業務効率化SaaS・クラウドサービス/);
  assert.match(app, /設備・機器・業務用品/);
  assert.match(app, /物流・保守・業務委託サービス/);
  assert.doesNotMatch(api, /研修・サービスを提案する営業担当者/);
});


test('non-sales categories have dedicated setup schemas', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile('app.js', 'utf8');
  for (const text of ['管理職面談設定','採用面接設定','クレーム対応設定','具体的に観察した事実','必須経験・スキル','保証・利用規約の範囲']) assert.match(app, new RegExp(text));
  assert.match(app, /state\.category=CATEGORY_SETUP_SCHEMAS\[cat\]/);
  assert.match(app, /scenarioIdForCategory/);
});
test('home and setup use exactly six neutral avatar labels', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile('app.js', 'utf8');
  for (const label of ['男性A','男性B','男性C','女性A','女性B','女性C']) assert.match(app, new RegExp(label));
  assert.match(app, /homeAvatarStrip.*CUSTOMER_APPEARANCES/);
  assert.doesNotMatch(app, /CUSTOMER_APPEARANCES=.*若手男性/);
});

test('hidden category detail blocks cannot be forced visible by grid styles', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile('styles.css', 'utf8');
  assert.match(css, /\[hidden\]\{display:none!important\}/);
});
test('non-sales setup explicitly hides every sales detail group and home avatar section', async () => {
  const { readFile } = await import('node:fs/promises');
  const [app, html] = await Promise.all([readFile('app.js','utf8'), readFile('index.html','utf8')]);
  for (const id of ['btobDetails','btocDetails','commonSalesDetails']) assert.match(app, new RegExp(id));
  assert.match(app, /style\.display=sales/);
  assert.doesNotMatch(html, /<h2>会話相手<\/h2>/);
  assert.match(html, /id="homeAvatarStrip" hidden/);
});
test('copy and examples match the six-avatar category-specific specification', async () => {
  const { readFile } = await import('node:fs/promises');
  const [app, html, readme] = await Promise.all([readFile('app.js','utf8'),readFile('index.html','utf8'),readFile('README.md','utf8')]);
  assert.doesNotMatch(html + readme, /10人の/);
  assert.match(html, /6種類のアバター/);
  for (const example of ['今期の評価と今後の成長','法人営業3年以上','訪問予定日に担当者が来なかった']) assert.match(app, new RegExp(example));
  assert.match(app, /categoryDraftKey=function\(\).*_v2/);
});
