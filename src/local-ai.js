import { CreateWebWorkerMLCEngine, deleteModelAllInfoInCache, hasModelInCache, prebuiltAppConfig } from '@mlc-ai/web-llm';

const MODELS = {
  compatible: { id: 'Qwen3-0.6B-q4f32_1-MLC', label: '互換性優先 Qwen 0.6B', requiredVRAMMB: 1925 },
  standard: { id: 'Qwen3-1.7B-q4f32_1-MLC', label: '標準 Qwen 1.7B', requiredVRAMMB: 2636 },
  quality: { id: 'Qwen3-4B-q4f32_1-MLC', label: '高品質 Qwen 4B', requiredVRAMMB: 4328 },
};
const LEGACY_MODELS = {
  'Qwen3-1.7B-q4f16_1-MLC': MODELS.compatible.id,
  'Qwen3-4B-q4f16_1-MLC': MODELS.compatible.id,
};
let engine = null;
let currentModelId = '';
let loadingPromise = null;
let lastDiagnostics = null;

function normalizeModelId(modelId) { return LEGACY_MODELS[modelId] || modelId || MODELS.compatible.id; }
function modelRecord(modelId) { return prebuiltAppConfig.model_list.find((item) => item.model_id === normalizeModelId(modelId)); }
function proxiedModelRecord(record) {
  const base = `${globalThis.location.origin}/api/local-model`;
  return { ...record, model: `${base}/model/${encodeURIComponent(record.model_id)}`, model_lib: `${base}/lib/${encodeURIComponent(record.model_id)}` };
}
function support() { return { webgpu: Boolean(globalThis.navigator?.gpu), secureContext: globalThis.isSecureContext, deviceMemoryGB: Number(globalThis.navigator?.deviceMemory || 0) }; }
function describeError(error) {
  const parts = [error?.name, error?.message, error?.cause?.message, typeof error === 'string' ? error : ''].filter(Boolean);
  return [...new Set(parts)].join(': ') || '詳細不明のエラー';
}
async function inspectGPU() {
  if (!globalThis.navigator?.gpu) throw new Error('WebGPUを利用できません。ChromeまたはEdgeのハードウェアアクセラレーションを有効にしてください。');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }) || await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('WebGPU対応GPUを初期化できません。ブラウザのハードウェアアクセラレーションまたは組織のブラウザポリシーを確認してください。');
  const info = adapter.info || {};
  return { shaderF16: adapter.features.has('shader-f16'), vendor: info.vendor || '', architecture: info.architecture || '', device: info.device || '', description: info.description || '' };
}
async function endpointStatus(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'cors', cache: 'no-store' });
    return { ok: response.ok || response.status === 405, status: response.status, host: new URL(url).host };
  } catch (error) { return { ok: false, status: 0, host: new URL(url).host, error: describeError(error) }; }
}
async function diagnoseFailure(record, gpu, error, workerIssue) {
  const modelConfig = await endpointStatus(`${record.model}/resolve/main/mlc-chat-config.json`);
  const modelLib = await endpointStatus(record.model_lib);
  lastDiagnostics = { modelId: record.model_id, gpu, modelConfig, modelLib, error: describeError(error), workerIssue };
  if (!modelConfig.ok) return `モデル配信元（${modelConfig.host}）へ接続できません。会社のプロキシ、Webフィルター、広告ブロッカーを確認してください。`;
  if (!modelLib.ok) return `実行ライブラリ配信元（${modelLib.host}）へ接続できません。会社のWebフィルターを確認してください。`;
  const detail = workerIssue || describeError(error);
  if (/memory|out of memory|device lost|allocation/i.test(detail)) return 'GPUメモリが不足したかGPU接続が失われました。互換性優先 Qwen 0.6Bを選び、他のタブを閉じて再実行してください。';
  if (/shader-f16/i.test(detail)) return 'このGPUは16ビットシェーダー非対応です。互換性優先モデルへ変更して再実行してください。';
  return `端末内AIの初期化に失敗しました：${detail}`;
}
function parseJSON(value) {
  if (value && typeof value === 'object') return value;
  return JSON.parse(String(value || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
}
async function prepare({ modelId, onProgress } = {}) {
  const selected = normalizeModelId(modelId);
  if (engine && currentModelId === selected) return { modelId: selected, diagnostics: lastDiagnostics };
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    onProgress?.({ progress: 0.01, text: 'GPUの互換性を確認しています' });
    const gpu = await inspectGPU();
    const sourceRecord = modelRecord(selected);
    if (!sourceRecord) throw new Error(`モデル設定が見つかりません：${selected}`);
    const record = proxiedModelRecord(sourceRecord);
    if (engine) await engine.unload();
    let workerIssue = '';
    const worker = new Worker(new URL('local-ai-worker.js?v=1.15', document.baseURI), { type: 'module' });
    worker.addEventListener('error', (event) => { workerIssue = event.message || 'Web Workerを開始できませんでした'; });
    try {
      engine = await CreateWebWorkerMLCEngine(worker, selected, {
        appConfig: { ...prebuiltAppConfig, cacheBackend: 'indexeddb', model_list: prebuiltAppConfig.model_list.map((item) => item.model_id === selected ? record : item) },
        initProgressCallback: (progress) => onProgress?.({ progress: Math.max(0, Math.min(1, Number(progress.progress || 0))), text: progress.text || 'モデルを準備しています' }),
      });
    } catch (error) {
      worker.terminate();
      engine = null;
      throw new Error(await diagnoseFailure(record, gpu, error, workerIssue));
    }
    onProgress?.({ progress: 0.99, text: '初回応答を高速化しています' });
    try {
      await engine.chat.completions.create({ messages: [{ role: 'user', content: 'はい' }], max_tokens: 1, temperature: 0, extra_body: { enable_thinking: false } });
    } catch (error) { console.warn('Local model warmup skipped', error); }
    currentModelId = selected;
    lastDiagnostics = { modelId: selected, gpu, ready: true };
    return { modelId: selected, diagnostics: lastDiagnostics };
  })();
  try { return await loadingPromise; }
  catch (error) { engine = null; currentModelId = ''; throw error; }
  finally { loadingPromise = null; }
}
function interruptGeneration() {
  try {
    const result = engine?.interruptGenerate();
    if (result && typeof result.catch === 'function') result.catch(() => {});
    return result;
  } catch { return undefined; }
}
async function complete(messages, maxTokens = 520, temperature = 0.28) {
  if (!engine) throw new Error('端末内AIモデルが準備されていません。');
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; interruptGeneration(); }, 45000);
  try {
    const output = await engine.chat.completions.create({ messages, temperature, max_tokens: maxTokens, response_format: { type: 'json_object' }, extra_body: { enable_thinking: false } });
    if (timedOut) throw new Error('端末内AIの採点がタイムアウトしました。');
    return parseJSON(output.choices?.[0]?.message?.content);
  } finally { clearTimeout(timer); }
}
function clippedConfig(payload) {
  return JSON.stringify({ category: payload.category, product: payload.roleplayConfig?.product, customer: payload.roleplayConfig?.customer, deal: payload.roleplayConfig?.deal, advanced: payload.roleplayConfig?.advancedEnabled ? payload.roleplayConfig?.advanced : undefined, companyProfile: String(payload.companyProfile || '').slice(0, 2500) }, (key, value) => typeof value === 'string' ? value.slice(0, key === 'companyProfile' ? 2500 : 500) : value);
}
function cleanGeneratedText(value) {
  return String(value || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/, '').trim();
}
async function generateFastReply(messages) {
  if (!engine) throw new Error('端末内AIモデルが準備されていません。');
  let text = '';
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; interruptGeneration(); }, 20000);
  try {
    const chunks = await engine.chat.completions.create({ messages, temperature: 0.42, top_p: 0.82, max_tokens: 72, stream: true, extra_body: { enable_thinking: false } });
    for await (const chunk of chunks) {
      text += chunk.choices?.[0]?.delta?.content || '';
      const cleaned = cleanGeneratedText(text);
      if (cleaned.length >= 24 && /[。！？!?]$/.test(cleaned)) {
        await interruptGeneration();
        break;
      }
      if (cleaned.length >= 100) {
        await interruptGeneration();
        break;
      }
    }
  } catch (error) {
    if (!cleanGeneratedText(text)) throw error;
  } finally { clearTimeout(timer); }
  const cleaned = cleanGeneratedText(text).slice(0, 140);
  if (!cleaned || timedOut) throw new Error('端末内AIの応答が20秒を超えました。');
  return cleaned;
}
async function reply(payload) {
  const appearance = payload.avatar?.name || '会話相手';
  const system = `日本語ロールプレイで「${appearance}」だけを演じます。設定:${clippedConfig(payload)}\n直前の利用者発言へ直接答え、自然な口語1文、80文字以内にしてください。利用者・コーチ・解説者を演じず、設定にない事実や個人名を創作しません。返答本文だけを出力してください。`;
  const history = (payload.conversation || []).slice(-6).map((item) => ({ role: item.role === 'user' ? 'user' : 'assistant', content: String(item.text || '').slice(0, 500) }));
  if (!history.length || history.at(-1)?.content !== payload.userText) history.push({ role: 'user', content: String(payload.userText || '').slice(0, 500) });
  const generated = await generateFastReply([{ role: 'system', content: system }, ...history]);
  return { reply: generated, emotion: 'neutral', deltas: { trust: 1, interest: 1, stress: 0 } };
}
async function evaluate(payload) {
  const rubrics = { sales: ['関係構築', '質問力', '傾聴・共感', '課題の深掘り', '提案・価値訴求', '次の行動'], manager: ['安心感', '質問力', '傾聴・共感', '事実整理', '本人の気づき', '行動合意'], interview: ['場づくり', '質問設計', '深掘り', '具体性確認', '公平性', '相互理解'], support: ['感情受容', '事実確認', '影響把握', '説明の明確さ', '解決策', '適切な境界'] };
  const rubric = rubrics[payload.category] || rubrics.sales;
  const transcript = (payload.conversation || []).map((item) => `${item.role === 'user' ? '利用者' : '相手'}:${item.text}`).join('\n');
  const prompt = `次の日本語ロールプレイを評価してください。カテゴリーを混同せず、会話にない個人名・役職・商品を創作しません。\n設定:${clippedConfig(payload)}\n評価項目:${rubric.join('、')}\n会話:\n${transcript}\nJSONのみを返してください。形式:{"scores":[{"name":"評価項目","score":70}],"headline":"見出し","summary":"要約","good":"良かった点","improve":"改善点","nextPhrase":"次に使う一言","hiddenNeed":"相手の本音"}`;
  return complete([{ role: 'system', content: 'あなたは企業向けロールプレイの対話スキルコーチです。具体的で実行可能な日本語フィードバックをJSONで返します。' }, { role: 'user', content: prompt }], 520, 0.28);
}
async function cached(modelId) { return hasModelInCache(normalizeModelId(modelId), { ...prebuiltAppConfig, cacheBackend: 'indexeddb' }); }
async function remove(modelId) {
  const selected = normalizeModelId(modelId || currentModelId);
  if (engine) await engine.unload();
  engine = null; currentModelId = '';
  await deleteModelAllInfoInCache(selected, { ...prebuiltAppConfig, cacheBackend: 'indexeddb' });
}
function diagnostics() { return lastDiagnostics; }
globalThis.LocalAI = { MODELS, support, prepare, reply, evaluate, cached, remove, modelRecord, normalizeModelId, diagnostics };