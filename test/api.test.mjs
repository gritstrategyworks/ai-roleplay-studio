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

test('evaluation uses neutral six-avatar labels and category settings', async () => {
  let captured;
  const AI = { run: async (_model, input) => {
    captured = input;
    return { response: { scores: Array.from({length: 6}, () => ({score: 70})), headline: '適切な面接でした', summary: '応募者の経験を確認しました', good: '質問が明確でした', improve: 'さらに深掘りしましょう', nextPhrase: '具体的な役割を教えてください', hiddenNeed: '経験を正しく伝えたい' } };
  } };
  const body = { action: 'evaluate', category: 'interview', avatar: {name: '伊藤部長', traits: '成果重視'}, roleplayConfig: {customer: {gender: 'female', ageGroup: 'middle'}, product: {name: '法人営業'}, deal: {scene: '一次面接'}}, scenario: {title: '一次面接', objective: '経験を深掘りする'}, conversation: [{role: 'assistant', text: 'よろしくお願いします。'}, {role: 'user', text: 'これまでの経験を教えてください。'}] };
  const request = new Request('https://x/api/roleplay', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  const response = await onRequestPost({request, env: {AI}});
  assert.equal(response.status, 200);
  const prompt = captured.messages[1].content;
  assert.match(prompt, /対話相手: 女性B/);
  assert.match(prompt, /入力されたロープレ設定/);
  assert.match(prompt, /interviewの場面/);
  assert.doesNotMatch(prompt, /伊藤部長/);
});

test('client sanitizes legacy avatar names and exposes billing/legal information', async () => {
  const {readFile} = await import('node:fs/promises');
  const [app, html, css] = await Promise.all([readFile('app.js','utf8'), readFile('index.html','utf8'), readFile('styles.css','utf8')]);
  assert.match(app, /function roleplayAvatarPayload/);
  assert.match(app, /function sanitizeAvatarReferences/);
  assert.match(app, /avatar:roleplayAvatarPayload\(\)/);
  for (const label of ['料金','運営者：Grit Strategy Works','特定商取引法に基づく表記','利用規約','プライバシーポリシー','解約方法','返金方針','問い合わせ先']) assert.match(html, new RegExp(label));
  assert.match(html, /現在は無料ベータ版です/);
  assert.match(html, /決済機能は有効化しません/);
  assert.match(css, /information-layout/);
});

test('AI modes separate cloud processing from on-device Qwen processing', async () => {
  const {readFile} = await import('node:fs/promises');
  const [app, html, localAI, build, serviceWorker] = await Promise.all([
    readFile('app.js','utf8'), readFile('index.html','utf8'), readFile('src/local-ai.js','utf8'),
    readFile('scripts/build.mjs','utf8'), readFile('service-worker.js','utf8')
  ]);
  for (const id of ['cloudModeCard','localModeCard','localAISettings','localModelSelect','companyProfileInput','localHistorySwitch']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /if\(isLocalMode\(\)\)response=await fetchLocalAIReply\(text\)/);
  assert.match(app, /if\(isLocalMode\(\)\)result=await fetchLocalAIEvaluation\(\)/);
  assert.match(app, /probeAPI=async function\(\)\{if\(isLocalMode\(\)\)/);
  assert.match(app, /localSaveHistory:false/);
  assert.match(app, /if\(isLocalMode\(\)&&!settings\.localSaveHistory\)return/);
  assert.match(localAI, /CreateWebWorkerMLCEngine/);
  assert.match(localAI, /cacheBackend: 'indexeddb'/);
  assert.match(localAI, /Qwen3-1\.7B-q4f16_1-MLC/);
  assert.match(localAI, /Qwen3-4B-q4f32_1-MLC/);
  assert.match(localAI, /companyProfile/);
  assert.match(localAI, /inspectGPU/);
  assert.match(localAI, /diagnoseFailure/);
  assert.match(localAI, /q4f32_1-MLC/);
  assert.match(build, /src\/local-ai-worker\.js/);
  for (const file of ['local-ai.js','local-ai-worker.js']) assert.match(serviceWorker, new RegExp(file.replace('.', '\\.')));
});

test('internal information mode is text-only with no cloud fallback', async () => {
  const {readFile} = await import('node:fs/promises');
  const [app, html, readme] = await Promise.all([readFile('app.js','utf8'), readFile('index.html','utf8'), readFile('README.md','utf8')]);
  assert.match(app, /if\(isLocalMode\(\)\|\|!settings\.speech\|\|!text\)return/);
  assert.match(app, /社内情報モードでは音声認識を使用しません/);
  assert.match(app, /社内情報モードはテキスト会話です/);
  assert.match(html, /クラウドへ自動送信しません/);
  assert.match(html, /音声会話は利用できません/);
  assert.match(readme, /Cloudflare AIへ自動フォールバックしません/);
  assert.doesNotMatch(readme, /Kokoro/);
});
test('Cloudflare relays only allowlisted public Qwen model files', async () => {
  const {readFile} = await import('node:fs/promises');
  const [worker, localAI, html, serviceWorker] = await Promise.all([
    readFile('src/worker.ts','utf8'), readFile('src/local-ai.js','utf8'), readFile('index.html','utf8'), readFile('service-worker.js','utf8')
  ]);
  assert.match(worker, /MODEL_LIBS/);
  assert.match(worker, /Model not allowed/);
  assert.match(worker, /resolve\/main\//);
  assert.match(worker, /\['GET','HEAD'\]/);
  assert.match(localAI, /\/api\/local-model/);
  assert.match(localAI, /proxiedModelRecord/);
  assert.match(localAI, /const record = proxiedModelRecord\(sourceRecord\)/);
  assert.match(html, /local-ai\.js\?v=1\.14/);
  assert.match(html, /app\.js\?v=1\.14/);
  assert.match(serviceWorker, /v1-14-model-relay/);
});