import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequestPost } from '../roleplay.js';

const root = new URL('../', import.meta.url);

const cases = {
  sales: {
    userRole: '営業担当者・提案者',
    aiRole: '見込み顧客または既存顧客',
    reversed: '現在の営業活動で感じている課題や、改善したい点を教えてください。',
    valid: '現在は情報共有に時間がかかっている点に困っています。',
  },
  manager: {
    userRole: '上司・管理職',
    aiRole: '面談を受ける部下・社員',
    reversed: '最近の仕事で困っていることはありますか。上司としてお聞きします。',
    valid: '最近、優先順位の付け方に少し悩んでいます。',
  },
  interview: {
    userRole: '面接官・採用担当者',
    aiRole: '応募者・候補者',
    reversed: 'それでは面接を始めます。これまでの経歴を教えてください。',
    valid: 'はい。これまで法人のお客様への提案業務を経験してきました。',
  },
  support: {
    userRole: '問い合わせ・クレーム対応担当者',
    aiRole: '困りごとや不満を抱えた顧客',
    reversed: 'ご不便をおかけして申し訳ありません。返金対応いたします。',
    valid: '昨日から利用できず、仕事に支障が出ていて困っています。',
  },
};

function requestFor(category) {
  return new Request('https://example.com/api/roleplay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'reply',
      category,
      scenario: { title: 'テスト場面', sceneRole: '対話相手', objective: '対話を進める' },
      avatar: { name: 'テスト相手' },
      userText: 'よろしくお願いします。',
      conversation: [{ role: 'user', text: 'よろしくお願いします。' }],
    }),
  });
}

function modelReply(reply, category) {
  return {
    reply,
    speakerRole: `${category}_counterpart`,
    emotion: 'neutral',
    deltas: { trust: 0, interest: 0, stress: 0 },
  };
}

test('all modes send an explicit and immutable user/AI role contract to Workers AI', async () => {
  for (const [category, expected] of Object.entries(cases)) {
    const calls = [];
    const AI = {
      async run(_model, options) {
        calls.push(options);
        return modelReply(expected.valid, category);
      },
    };

    const response = await onRequestPost({ env: { AI }, request: requestFor(category) });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    const system = calls[0].messages[0].content;
    assert.match(system, new RegExp(`利用者の役: ${expected.userRole}`));
    assert.match(system, new RegExp(`あなた（AI）の役: ${expected.aiRole}`));
    assert.match(system, /会話中の役割交代は禁止/);
    assert.deepEqual(calls[0].response_format.json_schema.properties.speakerRole.enum, [`${category}_counterpart`]);
  }
});

test('valid counterpart text is accepted when Workers AI omits the auxiliary speakerRole field', async () => {
  const calls = [];
  const AI = {
    async run(_model, options) {
      calls.push(options);
      return {
        reply: cases.sales.valid,
        emotion: 'neutral',
        deltas: { trust: 0, interest: 0, stress: 0 },
      };
    },
  };
  const response = await onRequestPost({ env: { AI }, request: requestFor('sales') });
  const body = await response.json();
  assert.equal(calls.length, 1);
  assert.equal(body.reply, cases.sales.valid);
});

test('an unmistakably reversed response is regenerated once in every mode', async () => {
  for (const [category, expected] of Object.entries(cases)) {
    const calls = [];
    const AI = {
      async run(_model, options) {
        calls.push(options);
        return calls.length === 1
          ? modelReply(expected.reversed, category)
          : modelReply(expected.valid, category);
      },
    };

    const response = await onRequestPost({ env: { AI }, request: requestFor(category) });
    const body = await response.json();
    assert.equal(calls.length, 2, `${category} should retry once`);
    assert.equal(body.reply, expected.valid);
    assert.match(calls[1].messages[0].content, /直前の生成は役割違反/);
  }
});

test('a second reversed response is replaced by a category-safe counterpart fallback', async () => {
  const AI = {
    async run() {
      return modelReply(cases.sales.reversed, 'sales');
    },
  };
  const response = await onRequestPost({ env: { AI }, request: requestFor('sales') });
  const body = await response.json();
  assert.equal(body.reply, 'ありがとうございます。まず、どのようなご提案か概要を伺えますか。');
});

test('frontend opening and local AI include the same role-lock safeguards', async () => {
  const [app, localAI] = await Promise.all([
    readFile(new URL('app.js', root), 'utf8'),
    readFile(new URL('local-ai.js', root), 'utf8'),
  ]);
  assert.doesNotMatch(app, /本日はありがとうございます。お時間は30分ほどでよろしかったでしょうか。/);
  assert.match(app, /本日はよろしくお願いします。今日はどのようなご提案でしょうか。/);
  assert.match(localAI, /roleContractV121/);
  assert.match(localAI, /roleReversedV121/);
  for (const expected of Object.values(cases)) {
    assert.match(localAI, new RegExp(expected.userRole));
    assert.match(localAI, new RegExp(expected.aiRole));
  }
});
