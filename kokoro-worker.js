const KOKORO_IMPORT_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const DEFAULT_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';

let tts = null;
let loadingPromise = null;
let activeModel = DEFAULT_MODEL;
let activeDtype = 'q8';

function postError(error, id = null) {
  self.postMessage({
    type: 'error',
    id,
    message: error instanceof Error ? error.message : String(error || 'Unknown Kokoro error'),
  });
}

function normalizeProgress(data) {
  if (!data || typeof data !== 'object') return { progress: 0, detail: 'モデルを読み込み中' };
  const fallback = data.loaded && data.total ? (data.loaded / data.total) * 100 : 0;
  const raw = Number(data.progress ?? fallback);
  const progress = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw)) : 0;
  const file = data.file || data.name || data.status || '';
  return { progress, detail: file ? `モデルを読み込み中：${file}` : 'モデルを読み込み中' };
}

async function loadModel(model = DEFAULT_MODEL, dtype = 'q8') {
  if (tts && activeModel === model && activeDtype === dtype) return tts;
  if (loadingPromise) return loadingPromise;

  activeModel = model;
  activeDtype = dtype;
  loadingPromise = (async () => {
    self.postMessage({ type: 'progress', progress: 1, detail: 'Kokoroライブラリを読み込み中' });
    const { KokoroTTS } = await import(KOKORO_IMPORT_URL);
    self.postMessage({ type: 'progress', progress: 4, detail: '音声モデルへ接続中' });
    tts = await KokoroTTS.from_pretrained(model, {
      dtype,
      device: 'wasm',
      progress_callback: (data) => {
        const progress = normalizeProgress(data);
        self.postMessage({ type: 'progress', ...progress });
      },
    });
    self.postMessage({ type: 'ready', model, dtype });
    return tts;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

function cleanText(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) throw new Error('読み上げる文章がありません');
  return /[。！？!?]$/.test(value) ? value : `${value}。`;
}

self.addEventListener('message', async (event) => {
  const message = event.data || {};
  try {
    if (message.type === 'load') {
      await loadModel(message.model || DEFAULT_MODEL, message.dtype || 'q8');
      return;
    }

    if (message.type === 'generate') {
      const model = await loadModel(message.model || activeModel, message.dtype || activeDtype);
      const text = cleanText(message.text);
      const voice = message.voice || 'jm_kumo';
      const speed = Math.max(0.65, Math.min(1.35, Number(message.speed || 1)));
      const audio = await model.generate(text, { voice, speed });
      const blob = audio.toBlob();
      const buffer = await blob.arrayBuffer();
      self.postMessage({
        type: 'audio',
        id: message.id,
        buffer,
        mime: blob.type || 'audio/wav',
      }, [buffer]);
    }
  } catch (error) {
    postError(error, message.id || null);
  }
});
