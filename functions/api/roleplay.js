const MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'access-control-allow-origin': '*',
};

export async function onRequestGet(context) {
  return Response.json({
    ok: true,
    service: 'AI Roleplay Studio API',
    aiConfigured: Boolean(context.env.AI),
    model: context.env.AI ? MODEL : null,
  }, { headers: HEADERS });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...HEADERS,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}

export async function onRequestPost(context) {
  try {
    if (!context.env.AI) {
      return Response.json({ error: 'Workers AI binding "AI" is not configured.' }, { status: 503, headers: HEADERS });
    }

    const body = await context.request.json();
    if (!body || !['reply', 'evaluate'].includes(body.action)) {
      return Response.json({ error: 'Invalid action.' }, { status: 400, headers: HEADERS });
    }

    const data = sanitizePayload(body);
    const result = data.action === 'reply'
      ? await createReply(context.env.AI, data)
      : await createEvaluation(context.env.AI, data);

    return Response.json(result, { headers: HEADERS });
  } catch (error) {
    console.error('roleplay api error', error);
    return Response.json({ error: 'AI response failed.' }, { status: 500, headers: HEADERS });
  }
}

function sanitizeText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function clampNumber(value, fallback = 50) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}
function clampPositive(value, max = 10000) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
}
function sanitizePayload(body) {
  const scenario = body.scenario || {};
  const avatar = body.avatar || {};
  const persona = body.persona || {};
  const difficulty = body.difficulty || {};
  const conversation = Array.isArray(body.conversation)
    ? body.conversation.slice(-20).map((m) => ({
        role: m?.role === 'user' ? 'user' : 'assistant',
        text: sanitizeText(m?.text, 700),
      })).filter((m) => m.text)
    : [];

  return {
    action: body.action,
    category: sanitizeText(body.category, 30),
    scenario: {
      title: sanitizeText(scenario.title, 80),
      sceneRole: sanitizeText(scenario.sceneRole, 80),
      objective: sanitizeText(scenario.objective, 200),
      hiddenNeed: sanitizeText(scenario.hiddenNeed, 200),
      phases: Array.isArray(scenario.phases) ? scenario.phases.slice(0, 8).map((p) => sanitizeText(p, 40)) : [],
    },
    avatar: {
      name: sanitizeText(avatar.name, 60),
      age: sanitizeText(avatar.age, 20),
      industry: sanitizeText(avatar.industry, 60),
      role: sanitizeText(avatar.role, 80),
      traits: sanitizeText(avatar.traits, 160),
      description: sanitizeText(avatar.description, 180),
    },
    persona: {
      label: sanitizeText(persona.label, 40),
      description: sanitizeText(persona.description, 120),
    },
    difficulty: { label: sanitizeText(difficulty.label, 30) },
    topic: sanitizeText(body.topic, 140),
    context: sanitizeText(body.context, 800),
    roleplayConfig: body.roleplayConfig || null,
    promptSettings: {
      meetingStage: sanitizeText(body.promptSettings?.meetingStage, 100),
      knownIssue: sanitizeText(body.promptSettings?.knownIssue, 240),
      conversationGoal: sanitizeText(body.promptSettings?.conversationGoal, 200),
      constraints: sanitizeText(body.promptSettings?.constraints, 240),
    },
    phase: sanitizeText(body.phase, 50),
    userText: sanitizeText(body.userText, 700),
    metrics: {
      trust: clampNumber(body.metrics?.trust),
      interest: clampNumber(body.metrics?.interest),
      stress: clampNumber(body.metrics?.stress),
    },
    audioStats: {
      speechTurns: clampPositive(body.audioStats?.speechTurns, 200),
      fillerCount: clampPositive(body.audioStats?.fillerCount, 1000),
      totalChars: clampPositive(body.audioStats?.totalChars, 50000),
      totalSeconds: clampPositive(body.audioStats?.totalSeconds, 10000),
    },
    conversation,
  };
}

async function createReply(ai, data) {
  const userRoles = {
    sales: '任意の商品・サービスを提案する営業担当者',
    manager: '面談を行う上司・管理職',
    interview: '採用面接を行う面接官',
    support: '問い合わせ・苦情へ対応する担当者',
  };
  const detail = data.promptSettings || {};
  const q = data.roleplayConfig;
  const quickPrompt = q ? '【主要設定（カテゴリーに応じた入力）】'+JSON.stringify(q.product)+'\n【顧客】'+JSON.stringify(q.customer)+'\n【商談】'+JSON.stringify(q.deal)+'\n重要: アバターのgenderとageGroupは見た目だけ。性格・価値観・態度・話し方を推測しない。\n【詳細設定】'+(q.advancedEnabled?JSON.stringify(q.advanced):'なし')+'\n' : '';
  const system = `${quickPrompt}`+`あなたは日本語の実践ロールプレイで「${data.avatar.name || '対話相手'}」だけを演じます。利用者の役を演じたり、コーチ・営業担当・解説者になったりしてはいけません。

【役割を絶対に固定する】
- あなた: ${data.avatar.industry || '組織'}の${data.avatar.role || data.scenario.sceneRole || '対話相手'}、${data.avatar.name || '対話相手'}
- 利用者: ${userRoles[data.category] || 'あなたと対話する担当者'}
- あなたは自分の組織・立場の状況を答える側。利用者は質問・提案する側。
- 自社の課題を利用者に説明させたり、利用者へ営業・面談・対応方法を助言したりしない。

【詳細設定＝今回の会話プロンプト】
- 会話・商談段階: ${detail.meetingStage || 'シナリオに沿って判断'}
- テーマ・提案内容: ${data.topic || '未指定'}
- あなたが認識している課題・事実: ${detail.knownIssue || data.context || '会話から段階的に明らかにする'}
- 今回合意したいこと: ${detail.conversationGoal || data.scenario.objective || '未設定'}
- 制約・避けたいこと: ${detail.constraints || '未設定'}
- その他の前提・背景: ${data.context || '未設定'}
これらは利用者側の課題ではなく、今回の場面とあなたの組織・立場に関する事実として扱う。ただし、利用者がまだ確認していない本音は段階的に明かす。

【人物と現在状態】
年代: ${data.avatar.age || '未設定'}
人物像: ${data.avatar.traits || data.avatar.description || '未設定'}
今回の役: ${data.scenario.sceneRole || '対話相手'}
性格: ${data.persona.label}（${data.persona.description}）
シナリオ: ${data.scenario.title} / 難易度: ${data.difficulty.label} / 現在フェーズ: ${data.phase}
相手に見せない本音: ${data.scenario.hiddenNeed}
信頼${data.metrics.trust}/100、関心${data.metrics.interest}/100、負荷${data.metrics.stress}/100

【返答手順】
1. 直前の利用者発言が質問・共感・要約・提案・価格説明のどれかを判断する。
2. まず、その直前発言へ直接反応する。話題を予定された台詞へ飛ばさない。
3. 自分が知っている事実だけを、会話段階・性格・難易度に応じて答える。
4. 必要な場合だけ、顧客・部下・応募者・利用者として自然な確認質問を最大1つ返す。

【品質ルール】
- 自然な日本語の口語で1〜3文、原則120文字以内。
- 「お伺いしますか」のような不自然な表現は禁止。
- 詳細設定にない事実を勝手に確定しない。不明なら「まだ整理できていません」「確認が必要です」と答える。
- 利用者の仮説を簡単に肯定せず、事実と違えば訂正し、曖昧なら具体化を求める。
- 提案・価格には、効果、根拠、実行性、定着、判断条件のうち場面に合う観点で反応する。
- 過去の発言と矛盾しない。同じ質問には自然に指摘する。
- 採点、助言、メタ説明、AIであることへの言及は禁止。
- JSON以外の文字を出力しない。`;
  const history = data.conversation.map((m) => ({ role: m.role, content: m.text }));
  const last = history.at(-1);
  if (!last || last.role !== 'user' || last.content !== data.userText) {
    history.push({ role: 'user', content: data.userText });
  }

  const schema = {
    type: 'object',
    properties: {
      reply: { type: 'string', description: '人物としての自然な日本語の返答' },
      emotion: { type: 'string', enum: ['positive', 'curious', 'neutral', 'skeptical', 'angry'] },
      deltas: {
        type: 'object',
        properties: {
          trust: { type: 'integer', minimum: -7, maximum: 7 },
          interest: { type: 'integer', minimum: -7, maximum: 7 },
          stress: { type: 'integer', minimum: -7, maximum: 7 },
        },
        required: ['trust', 'interest', 'stress'],
      },
    },
    required: ['reply', 'emotion', 'deltas'],
  };

  const output = await ai.run(MODEL, {
    messages: [{ role: 'system', content: system }, ...history],
    temperature: 0.55,
    max_tokens: 260,
    response_format: { type: 'json_schema', json_schema: schema },
  });

  const parsed = parseModelResponse(output);
  return {
    reply: sanitizeText(parsed.reply, 300) || 'もう少し具体的に教えていただけますか。',
    emotion: ['positive', 'curious', 'neutral', 'skeptical', 'angry'].includes(parsed.emotion) ? parsed.emotion : 'neutral',
    deltas: {
      trust: clampDelta(parsed.deltas?.trust),
      interest: clampDelta(parsed.deltas?.interest),
      stress: clampDelta(parsed.deltas?.stress),
    },
  };
}

async function createEvaluation(ai, data) {
  const rubricMap = {
    sales: ['関係構築', '質問力', '傾聴・共感', '課題の深掘り', '提案・価値訴求', '次の行動'],
    manager: ['安心感', '質問力', '傾聴・共感', '事実整理', '本人の気づき', '行動合意'],
    interview: ['場づくり', '質問設計', '深掘り', '具体性確認', '公平性', '相互理解'],
    support: ['感情受容', '事実確認', '影響把握', '説明の明確さ', '解決策', '適切な境界'],
  };
  const rubric = rubricMap[data.category] || rubricMap.sales;
  const transcript = data.conversation.map((m) => `${m.role === 'user' ? '利用者' : data.avatar.name || '相手'}: ${m.text}`).join('\n');
  const averageChars = data.audioStats.speechTurns ? Math.round(data.audioStats.totalChars / data.audioStats.speechTurns) : 0;

  const prompt = `以下の日本語ロールプレイを、企業向けロールプレイの対話スキルコーチとして評価してください。

場面: ${data.scenario.title}
対話相手: ${data.avatar.name}（${data.avatar.traits}）
目的: ${data.scenario.objective}
評価項目: ${rubric.join('、')}
相手の隠れた本音: ${data.scenario.hiddenNeed}
難易度: ${data.difficulty.label}
最終状態: 信頼${data.metrics.trust}/100、関心${data.metrics.interest}/100、負荷${data.metrics.stress}/100
音声指標: 音声発話${data.audioStats.speechTurns}回、フィラー語${data.audioStats.fillerCount}回、平均${averageChars}文字

会話:
${transcript}

条件:
- 各項目を0〜100点で採点する。
- 良かった点と改善点は、会話中の具体的な発言・行動に基づく。
- 根拠なく高得点にしないが、学習意欲を損なう表現は避ける。
- 音声指標がある場合、フィラー語や一発言の長さも必要に応じて改善点へ反映する。
- 「次に使う一言」は、そのまま使える自然な日本語にする。
- JSON以外は出力しない。`;

  const schema = {
    type: 'object',
    properties: {
      scores: {
        type: 'array', minItems: rubric.length, maxItems: rubric.length,
        items: { type: 'object', properties: { name: { type: 'string' }, score: { type: 'integer', minimum: 0, maximum: 100 } }, required: ['name', 'score'] },
      },
      headline: { type: 'string' }, summary: { type: 'string' }, good: { type: 'string' }, improve: { type: 'string' }, nextPhrase: { type: 'string' }, hiddenNeed: { type: 'string' },
    },
    required: ['scores', 'headline', 'summary', 'good', 'improve', 'nextPhrase', 'hiddenNeed'],
  };

  const output = await ai.run(MODEL, {
    messages: [
      { role: 'system', content: 'あなたは企業向けロールプレイの対話スキルコーチです。具体的で実行可能な日本語フィードバックを返します。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.28,
    max_tokens: 820,
    response_format: { type: 'json_schema', json_schema: schema },
  });

  const parsed = parseModelResponse(output);
  return {
    scores: Array.isArray(parsed.scores)
      ? parsed.scores.slice(0, rubric.length).map((s, i) => ({ name: rubric[i], score: clampNumber(s?.score, 60) }))
      : rubric.map((name) => ({ name, score: 60 })),
    headline: sanitizeText(parsed.headline, 100),
    summary: sanitizeText(parsed.summary, 300),
    good: sanitizeText(parsed.good, 300),
    improve: sanitizeText(parsed.improve, 300),
    nextPhrase: sanitizeText(parsed.nextPhrase, 220),
    hiddenNeed: sanitizeText(parsed.hiddenNeed, 220) || data.scenario.hiddenNeed,
  };
}

function parseModelResponse(output) {
  let value = output?.response ?? output?.result?.response ?? output;
  if (typeof value === 'object' && value !== null) return value;
  if (typeof value !== 'string') throw new Error('Unexpected model response');
  const cleaned = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}
function clampDelta(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(-7, Math.min(7, Math.round(n))) : 0;
}







