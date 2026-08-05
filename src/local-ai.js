import { CreateWebWorkerMLCEngine, deleteModelAllInfoInCache, hasModelInCache, prebuiltAppConfig } from '@mlc-ai/web-llm';

const MODELS = {
  light: { id: 'Qwen3-1.7B-q4f16_1-MLC', label: '軽量 Qwen 1.7B', requiredMemoryGB: 3 },
  standard: { id: 'Qwen3-4B-q4f16_1-MLC', label: '標準 Qwen 4B', requiredMemoryGB: 6 },
};
let engine = null;
let currentModelId = '';
let loadingPromise = null;

function modelRecord(modelId) { return prebuiltAppConfig.model_list.find((item) => item.model_id === modelId); }
function support() { return { webgpu: Boolean(globalThis.navigator?.gpu), secureContext: globalThis.isSecureContext, deviceMemoryGB: Number(globalThis.navigator?.deviceMemory || 0) }; }
function parseJSON(value) {
  if (value && typeof value === 'object') return value;
  return JSON.parse(String(value || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
}
async function prepare({ modelId, onProgress } = {}) {
  const selected = modelId || MODELS.light.id;
  if (!support().webgpu) throw new Error('この端末またはブラウザはWebGPUに対応していません。');
  if (engine && currentModelId === selected) return true;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    if (engine) await engine.unload();
    const worker = new Worker(new URL('local-ai-worker.js', document.baseURI), { type: 'module' });
    engine = await CreateWebWorkerMLCEngine(worker, selected, {
      appConfig: { ...prebuiltAppConfig, cacheBackend: 'indexeddb' },
      initProgressCallback: (progress) => onProgress?.({ progress: Math.max(0, Math.min(1, Number(progress.progress || 0))), text: progress.text || 'モデルを準備しています' }),
    });
    currentModelId = selected;
    return true;
  })();
  try { return await loadingPromise; }
  catch (error) { engine = null; currentModelId = ''; throw error; }
  finally { loadingPromise = null; }
}
async function complete(messages, maxTokens = 360, temperature = 0.55) {
  if (!engine) throw new Error('端末内AIモデルが準備されていません。');
  const output = await engine.chat.completions.create({ messages, temperature, max_tokens: maxTokens, response_format: { type: 'json_object' }, extra_body: { enable_thinking: false } });
  return parseJSON(output.choices?.[0]?.message?.content);
}
function compactConfig(payload) {
  return JSON.stringify({ category: payload.category, product: payload.roleplayConfig?.product, customer: payload.roleplayConfig?.customer, deal: payload.roleplayConfig?.deal, advanced: payload.roleplayConfig?.advancedEnabled ? payload.roleplayConfig?.advanced : undefined, companyProfile: payload.companyProfile || undefined });
}
async function reply(payload) {
  const appearance = payload.avatar?.name || '会話相手';
  const system = `あなたは日本語の実践ロールプレイで「${appearance}」だけを演じます。利用者の役、コーチ、解説者を演じてはいけません。\n設定:${compactConfig(payload)}\n性格・態度・話し方は設定から判断し、アバターの性別や年代から推測しません。直前の利用者発言へ直接反応し、自然な口語1〜3文、原則120文字以内で答えてください。設定にない事実は創作しません。JSONのみを返してください。形式:{"reply":"返答","emotion":"positive|curious|neutral|skeptical|angry","deltas":{"trust":0,"interest":0,"stress":0}}`;
  const history = (payload.conversation || []).slice(-12).map((item) => ({ role: item.role === 'user' ? 'user' : 'assistant', content: item.text }));
  if (!history.length || history.at(-1)?.content !== payload.userText) history.push({ role: 'user', content: payload.userText });
  const result = await complete([{ role: 'system', content: system }, ...history]);
  return { reply: String(result.reply || 'もう少し具体的に教えていただけますか。').slice(0, 300), emotion: ['positive', 'curious', 'neutral', 'skeptical', 'angry'].includes(result.emotion) ? result.emotion : 'neutral', deltas: { trust: Number(result.deltas?.trust || 0), interest: Number(result.deltas?.interest || 0), stress: Number(result.deltas?.stress || 0) } };
}
async function evaluate(payload) {
  const rubrics = { sales: ['関係構築', '質問力', '傾聴・共感', '課題の深掘り', '提案・価値訴求', '次の行動'], manager: ['安心感', '質問力', '傾聴・共感', '事実整理', '本人の気づき', '行動合意'], interview: ['場づくり', '質問設計', '深掘り', '具体性確認', '公平性', '相互理解'], support: ['感情受容', '事実確認', '影響把握', '説明の明確さ', '解決策', '適切な境界'] };
  const rubric = rubrics[payload.category] || rubrics.sales;
  const transcript = (payload.conversation || []).map((item) => `${item.role === 'user' ? '利用者' : '相手'}:${item.text}`).join('\n');
  const prompt = `次の日本語ロールプレイを評価してください。カテゴリーを混同せず、会話にない個人名・役職・商品を創作しません。\n設定:${compactConfig(payload)}\n評価項目:${rubric.join('、')}\n会話:\n${transcript}\nJSONのみを返してください。形式:{"scores":[{"name":"評価項目","score":70}],"headline":"見出し","summary":"要約","good":"良かった点","improve":"改善点","nextPhrase":"次に使う一言","hiddenNeed":"相手の本音"}`;
  return complete([{ role: 'system', content: 'あなたは企業向けロールプレイの対話スキルコーチです。具体的で実行可能な日本語フィードバックをJSONで返します。' }, { role: 'user', content: prompt }], 820, 0.28);
}
async function cached(modelId) { return hasModelInCache(modelId || MODELS.light.id, { ...prebuiltAppConfig, cacheBackend: 'indexeddb' }); }
async function remove(modelId) {
  const selected = modelId || currentModelId || MODELS.light.id;
  if (engine) await engine.unload();
  engine = null; currentModelId = '';
  await deleteModelAllInfoInCache(selected, { ...prebuiltAppConfig, cacheBackend: 'indexeddb' });
}
globalThis.LocalAI = { MODELS, support, prepare, reply, evaluate, cached, remove, modelRecord };
