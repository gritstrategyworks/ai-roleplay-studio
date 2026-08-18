'use strict';

(() => {
  const STORAGE_SCOPE = globalThis.AuthGate?.user?.id || 'guest';
  const STORAGE_KEY = 'aiRoleplayStudio_advisor_v1:' + STORAGE_SCOPE;
  const MAX_STORED_MESSAGES = 10;
  const MAX_HISTORY_MESSAGES = 8;
  const MAX_QUESTION_LENGTH = 800;
  const SUBMIT_COOLDOWN_MS = 3000;
  const ADVISOR_AVATAR = 'assets/avatars/portraits/advisor.webp';
  const EXAMPLES = [
    '上司に進捗が遅れていることをどう報告すればよい？',
    '曖昧な指示を失礼なく確認したい',
    '仕事でミスをした。最初に何と伝える？',
    'お客様に納期変更を説明したい',
    '電話で担当者不在を感じよく伝えたい',
    '同僚に急ぎの協力をお願いしたい',
    '依頼を断りたいが、関係を悪くしたくない',
    '部下へ改善点を具体的に伝えたい',
    '1on1で本音を引き出す質問を知りたい',
    '会議で反対意見を角が立たないように伝えたい',
    '強いクレームにどう対応すればよい？',
    '商談の次の一歩を自然に確認したい'
  ];
  const WELCOME = {
    advice: '相談したい相手・場面・困っていることを、そのまま入力してください。状況が完全に整理できていなくても大丈夫です。',
    example: '例：上司に、納期が1日遅れそうだと早めに報告したいです。',
    points: ['相手との関係と目的に合わせて、具体的な伝え方を一緒に整理します。'],
    avoid: '',
    followUp: ''
  };

  let advisorMessages = loadMessages();
  let advisorBusy = false;
  let lastSubmitted = { text: '', at: 0 };

  function cleanText(value, max = 800) {
    return String(value ?? '').trim().slice(0, max);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function loadMessages() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.slice(-MAX_STORED_MESSAGES) : [];
    } catch {
      return [];
    }
  }

  function saveMessages() {
    advisorMessages = advisorMessages.slice(-MAX_STORED_MESSAGES);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(advisorMessages));
    } catch {
      // The advisor remains usable when storage is unavailable.
    }
  }

  function normalizeAdvisorReply(value) {
    const points = Array.isArray(value?.points)
      ? value.points.map((point) => cleanText(point, 180)).filter(Boolean).slice(0, 4)
      : [];
    const roleplay = value?.roleplay && typeof value.roleplay === 'object' ? {
      scenario: cleanText(value.roleplay.scenario, 60),
      topic: cleanText(value.roleplay.topic, 100),
      context: cleanText(value.roleplay.context, 500),
      goal: cleanText(value.roleplay.goal, 160),
      difficulty: ['easy', 'normal', 'hard'].includes(value.roleplay.difficulty) ? value.roleplay.difficulty : 'normal'
    } : null;
    return {
      advice: cleanText(value?.advice, 600) || '状況をもう少し具体的に教えてください。',
      example: cleanText(value?.example, 600),
      points,
      avoid: cleanText(value?.avoid, 350),
      followUp: cleanText(value?.followUp, 240),
      roleplay: roleplay?.scenario ? roleplay : null
    };
  }

  function assistantContent(payload) {
    return [payload.advice, payload.example, ...(payload.points || []), payload.avoid, payload.followUp]
      .filter(Boolean).join('\n');
  }

  function assistantCard(payload, messageIndex = -1) {
    const points = payload.points?.length
      ? `<section><h4>ポイント</h4><ul>${payload.points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul></section>`
      : '';
    const example = payload.example
      ? `<section class="advisor-example"><h4>こんなふうに伝えてみましょう</h4><p>${escapeHtml(payload.example)}</p></section>`
      : '';
    const avoid = payload.avoid
      ? `<section class="advisor-avoid"><h4>避けた方がよい言い方</h4><p>${escapeHtml(payload.avoid)}</p></section>`
      : '';
    const followUp = payload.followUp
      ? `<p class="advisor-follow-up">確認できれば教えてください：${escapeHtml(payload.followUp)}</p>`
      : '';
    const practice = payload.roleplay && messageIndex >= 0
      ? `<button class="advisor-practice-btn" type="button" data-advisor-practice="${messageIndex}">この場面をロープレで練習する <span aria-hidden="true">→</span></button>`
      : '';
    return `<div class="advisor-response-card"><section><h4>アドバイス</h4><p>${escapeHtml(payload.advice)}</p></section>${example}${points}${avoid}${followUp}${practice}</div>`;
  }

  function renderMessages() {
    const list = document.getElementById('advisorMessages');
    if (!list) return;
    const rows = [
      `<article class="advisor-message assistant"><img src="${ADVISOR_AVATAR}" alt="AIビジネス対話アドバイザー"><div>${assistantCard(WELCOME)}</div></article>`
    ];
    advisorMessages.forEach((message, index) => {
      if (message.role === 'user') {
        rows.push(`<article class="advisor-message user"><div class="advisor-user-bubble">${escapeHtml(message.text)}</div></article>`);
        return;
      }
      const payload = normalizeAdvisorReply(message.payload || {});
      rows.push(`<article class="advisor-message assistant"><img src="${ADVISOR_AVATAR}" alt=""><div>${assistantCard(payload, index)}</div></article>`);
    });
    if (advisorBusy) {
      rows.push(`<article class="advisor-message assistant" id="advisorThinking"><img src="${ADVISOR_AVATAR}" alt=""><div class="advisor-thinking" role="status"><i></i><i></i><i></i><span>伝え方を整理しています</span></div></article>`);
    }
    list.innerHTML = rows.join('');
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  function renderExampleChips() {
    const container = document.getElementById('advisorExamples');
    if (!container || container.childElementCount) return;
    container.innerHTML = EXAMPLES.map((example) => `<button type="button" class="advisor-chip" data-advisor-example="${escapeHtml(example)}">${escapeHtml(example)}</button>`).join('');
  }

  function updateComposer() {
    const input = document.getElementById('advisorInput');
    const count = document.getElementById('advisorCharCount');
    const button = document.getElementById('advisorSubmit');
    if (count && input) count.textContent = `${Array.from(input.value).length}/${MAX_QUESTION_LENGTH}`;
    if (button) {
      button.disabled = advisorBusy || !input?.value.trim();
      button.textContent = advisorBusy ? '回答を作成中…' : 'AIに相談する';
    }
  }

  function showAdvisor() {
    globalThis.showScreen?.('advisor');
    renderExampleChips();
    renderMessages();
    updateComposer();
    setTimeout(() => document.getElementById('advisorInput')?.focus(), 80);
  }

  function buildHistory() {
    return advisorMessages.slice(0, -1).slice(-MAX_HISTORY_MESSAGES).map((message) => ({
      role: message.role,
      content: message.role === 'user' ? cleanText(message.text, 600) : cleanText(assistantContent(normalizeAdvisorReply(message.payload || {})), 900)
    })).filter((message) => message.content);
  }

  function requestId() {
    return globalThis.crypto?.randomUUID?.() || `advisor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function submitAdvisorQuestion(event) {
    event?.preventDefault?.();
    const input = document.getElementById('advisorInput');
    const question = cleanText(input?.value, MAX_QUESTION_LENGTH);
    const now = Date.now();
    if (!question || advisorBusy) return;
    if (question === lastSubmitted.text && now - lastSubmitted.at < 10000) {
      globalThis.toast?.('同じ相談を送信済みです。少し待ってからお試しください。');
      return;
    }
    if (now - lastSubmitted.at < SUBMIT_COOLDOWN_MS) {
      globalThis.toast?.('連続送信を防ぐため、少し待ってからお試しください。');
      return;
    }
    lastSubmitted = { text: question, at: now };
    advisorMessages.push({ role: 'user', text: question });
    saveMessages();
    if (input) input.value = '';
    advisorBusy = true;
    renderMessages();
    updateComposer();
    try {
      const response = await fetch('/api/advisor', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, history: buildHistory(), requestId: requestId() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || 'AIアドバイザーから回答を取得できませんでした。');
        error.code = data.code || '';
        throw error;
      }
      advisorMessages.push({ role: 'assistant', payload: normalizeAdvisorReply(data) });
      saveMessages();
    } catch (error) {
      const detail = error?.code === 'rate_limited'
        ? '短時間に複数の相談が送信されました。数秒待ってから、もう一度お試しください。'
        : '現在、回答を取得できませんでした。入力内容は残っていますので、少し待ってからもう一度送信してください。';
      advisorMessages.push({ role: 'assistant', payload: { advice: detail, example: '', points: [], avoid: '', followUp: '', roleplay: null } });
      saveMessages();
    } finally {
      advisorBusy = false;
      renderMessages();
      updateComposer();
    }
  }

  function useExample(example) {
    const input = document.getElementById('advisorInput');
    if (!input) return;
    input.value = cleanText(example, MAX_QUESTION_LENGTH);
    updateComposer();
    input.focus();
  }

  function clearAdvisorHistory() {
    if (!advisorMessages.length) return;
    if (!globalThis.confirm('この端末のAIアドバイザー相談履歴を消去しますか？')) return;
    advisorMessages = [];
    saveMessages();
    renderMessages();
    globalThis.toast?.('相談履歴を消去しました');
  }

  function startAdvisorPractice(index) {
    const message = advisorMessages[Number(index)];
    if (!message?.payload?.roleplay) return;
    const question = [...advisorMessages.slice(0, Number(index))].reverse().find((item) => item.role === 'user')?.text || '';
    if (typeof globalThis.startRoleplayFromAdvisor !== 'function') {
      globalThis.toast?.('ロープレ設定を準備できませんでした');
      return;
    }
    globalThis.startRoleplayFromAdvisor(message.payload.roleplay, question);
  }

  document.addEventListener('click', (event) => {
    const exampleButton = event.target.closest?.('[data-advisor-example]');
    if (exampleButton) useExample(exampleButton.dataset.advisorExample);
    const practiceButton = event.target.closest?.('[data-advisor-practice]');
    if (practiceButton) startAdvisorPractice(practiceButton.dataset.advisorPractice);
  });
  document.getElementById('advisorForm')?.addEventListener('submit', submitAdvisorQuestion);
  document.getElementById('advisorInput')?.addEventListener('input', updateComposer);
  document.getElementById('advisorClear')?.addEventListener('click', clearAdvisorHistory);

  globalThis.showAdvisor = showAdvisor;
  globalThis.submitAdvisorQuestion = submitAdvisorQuestion;
  renderExampleChips();
  renderMessages();
  updateComposer();
})();
