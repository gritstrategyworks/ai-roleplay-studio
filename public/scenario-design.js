'use strict';

((root) => {
  const MODES = Object.freeze({
    auto: 'AIにおまかせ',
    guided: '方向性だけ指定',
    manual: 'すべて自分で設定',
  });

  const CATEGORY_COPY = Object.freeze({
    sales: {
      publicLabel: '事前に分かっている顧客情報',
      publicHelp: '問い合わせ内容など、商談前から営業担当者が知っている情報だけを入力します。潜在ニーズはAIが非公開で保持します。',
      publicPlaceholder: '例：営業部から「商談力を高めたい」と問い合わせがあった',
      directionLabel: '潜在ニーズの方向性',
      directionPlaceholder: '例：価格よりも、現場に定着するかを不安に感じている',
      truthLabel: '顧客の本当のニーズ・背景',
      truthPlaceholder: '例：過去の導入失敗から、現場の反発と運用負荷を最も心配している',
      conditionsLabel: '意思決定条件・譲れないこと',
      conditionsPlaceholder: '例：決裁者へ説明できる効果指標と導入計画が必要',
    },
    manager: {
      publicLabel: '観察できている部下の状況',
      publicHelp: '遅刻や成果変化など、上司が面談前に確認できている事実だけを入力します。本音や悩みは非公開設定にします。',
      publicPlaceholder: '例：目標未達が続き、会議での発言が減っている',
      directionLabel: '悩みの方向性',
      directionPlaceholder: '例：能力よりも、上司から期待されていないと感じている',
      truthLabel: '部下の本音・背景',
      truthPlaceholder: '例：業務を抱え込んでいるが、能力不足と思われるのが怖くて相談できない',
      conditionsLabel: '望んでいる支援・譲れないこと',
      conditionsPlaceholder: '例：指示ではなく、優先順位を一緒に整理してほしい',
    },
    interview: {
      publicLabel: '履歴書・応募書類で分かっていること',
      publicHelp: '職歴や資格など、面接官が事前に確認できる情報を入力します。転職理由や価値観はヒアリング対象として非公開にします。',
      publicPlaceholder: '例：SaaS法人営業3年、チームリーダー経験あり',
      directionLabel: '応募者の本音の方向性',
      directionPlaceholder: '例：給与よりも、専門性と裁量を重視している',
      truthLabel: '応募者の本当の動機・価値観',
      truthPlaceholder: '例：現職では専門性を高められず、事業づくりへ関われる環境を求めている',
      conditionsLabel: '懸念点・入社判断条件',
      conditionsPlaceholder: '例：若手への裁量と入社後の具体的な成長機会を確認したい',
    },
    support: {
      publicLabel: '顧客が最初に伝えている要求',
      publicHelp: '受付時点で顧客が表明している要求だけを入力します。怒りの背景や許容できる解決策は非公開設定にします。',
      publicPlaceholder: '例：本日中の復旧と、遅延理由の説明を求めている',
      directionLabel: '困りごとの方向性',
      directionPlaceholder: '例：返金よりも、説明がなく軽視されたことに怒っている',
      truthLabel: '顧客の本当の困りごと・感情',
      truthPlaceholder: '例：自社の顧客へ説明できず困っており、連絡がなかったことに強く不満を感じている',
      conditionsLabel: '受け入れ可能な解決・譲れないこと',
      conditionsPlaceholder: '例：本日中の状況報告と、次回連絡時刻が明確なら待てる',
    },
  });

  const AUTO_PROFILES = Object.freeze({
    sales: [
      { truth: '過去の導入で現場に定着せず、担当者は同じ失敗を繰り返すことを恐れている', conditions: '現場の運用負荷、定着支援、効果測定の方法が具体的であれば検討を進められる' },
      { truth: '社内で課題の優先順位が揃っておらず、担当者だけでは決裁者へ説明できない', conditions: '決裁者向けの根拠、費用対効果、導入までの手順が必要' },
      { truth: '表面上は価格を気にしているが、最大の懸念は導入後に担当業務が増えること', conditions: '既存業務との連携と、担当者の追加負担が小さいことが判断条件' },
      { truth: '課題は認識しているが、失敗した場合に自分が責任を負うことを警戒している', conditions: '小さく試せる範囲、責任分担、失敗時の対応が明確なら前向きになれる' },
    ],
    manager: [
      { truth: '仕事量そのものより、相談すると能力不足だと思われることを恐れて抱え込んでいる', conditions: '評価を決めつけず、優先順位と支援方法を一緒に整理してほしい' },
      { truth: '成果よりも、自分の努力や工夫を上司が見ていないと感じて意欲を失っている', conditions: 'まず事実と気持ちを聞いた上で、期待を具体的に伝えてほしい' },
      { truth: '将来の成長イメージが持てず、配置転換や転職を考え始めている', conditions: 'すぐ引き止めず、本人の希望と選択肢を一緒に考えてほしい' },
      { truth: '周囲との関係に悩んでいるが、相手を悪者にしたくないため曖昧に話している', conditions: '守秘と公平さを保ち、具体的な出来事から整理してほしい' },
    ],
    interview: [
      { truth: '現職への不満より、専門性を高められず成長が止まることを心配している', conditions: '入社後に任される役割と成長機会が具体的に分かれば志望度が上がる' },
      { truth: '役職や給与より、意思決定に関われる裁量と仕事の影響範囲を重視している', conditions: '裁量の範囲、評価基準、上司との役割分担を確認したい' },
      { truth: '実績にはチームの貢献も大きく、自分だけの成果として話すことに迷いがある', conditions: '本人の役割を公平に聞き、失敗経験も含めて評価してほしい' },
      { truth: '志望度は高いが、組織文化や働き方が自分に合うかを慎重に見極めている', conditions: '良い面だけでなく、実際の課題や期待水準も率直に説明してほしい' },
    ],
    support: [
      { truth: '発生した問題以上に、連絡がなく軽く扱われたと感じたことへ強く不満を持っている', conditions: '事実確認、次回連絡時刻、担当者が明確なら落ち着いて待てる' },
      { truth: '自分の顧客や社内へ説明できず、信用を失うことを最も恐れている', conditions: '原因と暫定対応を説明できる情報が、約束した時刻までに必要' },
      { truth: '返金が目的というより、期待した支援を受けられなかったことを理解してほしい', conditions: '何が起きたかを確認し、再発防止と現実的な代替案を示してほしい' },
      { truth: '繰り返し説明させられたことで感情的になっており、責任ある対応を求めている', conditions: '窓口を一本化し、対応可能な範囲と期限を明確にしてほしい' },
    ],
  });

  const DISCOVERY_SIGNALS = Object.freeze({
    sales: [
      ['現状・課題', /(現状|課題|困|悩|問題|きっかけ|背景)/],
      ['影響・優先度', /(影響|優先|このまま|どの程度|成果|損失)/],
      ['意思決定', /(決裁|誰が|関係者|判断|承認|選定)/],
      ['予算・時期', /(予算|費用|価格|時期|いつ|期限|スケジュール)/],
      ['導入条件', /(条件|懸念|不安|運用|定着|負担|比較)/],
    ],
    manager: [
      ['本人の認識', /(どう感じ|どのように感じ|認識|気持ち|今の状況)/],
      ['背景・原因', /(背景|理由|なぜ|きっかけ|いつから|何があった)/],
      ['仕事への影響', /(影響|困|負担|業務量|優先順位)/],
      ['希望する支援', /(支援|手伝|サポート|どうしてほしい|必要なこと)/],
      ['次の行動', /(次に|まず|試せ|いつまで|フォロー|一緒に)/],
    ],
    interview: [
      ['経験の背景', /(背景|状況|課題|目標|なぜ)/],
      ['本人の役割・行動', /(あなた自身|役割|行動|工夫|判断|具体的)/],
      ['結果・学び', /(結果|成果|学び|改善|振り返)/],
      ['転職・志望理由', /(転職理由|志望理由|なぜ当社|きっかけ)/],
      ['価値観・判断条件', /(価値観|重視|大切|条件|懸念|将来|キャリア)/],
    ],
    support: [
      ['感情の受容', /(申し訳|ご不便|ご迷惑|お気持ち|大変|不安)/],
      ['事実・経緯', /(いつ|どこ|何が|状況|経緯|確認)/],
      ['具体的な影響', /(影響|困|支障|必要|期限|どの程度)/],
      ['希望する解決', /(希望|どうしてほしい|必要な対応|解決|代替|返金)/],
      ['次の連絡・条件', /(次回|連絡|時刻|担当|期限|できる範囲|引き継)/],
    ],
  });

  function clean(value, max = 700) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  function categoryCopy(category) {
    return CATEGORY_COPY[category] || CATEGORY_COPY.sales;
  }

  function stableIndex(value, length) {
    let hash = 2166136261;
    for (const char of String(value || '')) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0) % Math.max(1, length);
  }

  function buildPublicBriefing(category, config = {}) {
    const supplied = clean(config.customer?.needs);
    if (supplied) return supplied;
    const product = clean(config.product?.name) || '今回のテーマ';
    const scene = clean(config.deal?.scene) || '対話';
    if (category === 'manager') return `${scene}を実施する。本人の本音や背景はまだ確認できていない。`;
    if (category === 'interview') return `${product}の応募者。応募書類以外の動機や価値観は面接で確認する必要がある。`;
    if (category === 'support') return `${product}について問い合わせがあった。顧客への具体的な影響と希望する解決はまだ確認できていない。`;
    return `${product}に関心を示している${scene}の相手。具体的な課題、意思決定条件、予算はまだ確認できていない。`;
  }

  function buildHiddenProfile({ category = 'sales', config = {}, scenario = {}, difficulty = 'normal' } = {}) {
    const customer = config.customer || {};
    const mode = Object.hasOwn(MODES, customer.scenarioMode) ? customer.scenarioMode : 'auto';
    const templates = AUTO_PROFILES[category] || AUTO_PROFILES.sales;
    const seed = [category, scenario.id, config.product?.name, config.deal?.scene, customer.gender, customer.ageGroup].join('|');
    const selected = templates[stableIndex(seed, templates.length)];
    const baseline = clean(scenario.hiddenNeed) || selected.truth;
    const direction = clean(customer.hiddenDirection);
    let hiddenTruth;
    let hiddenConditions;
    if (mode === 'manual') {
      hiddenTruth = clean(customer.hiddenTruth) || baseline;
      hiddenConditions = clean(customer.hiddenConditions) || selected.conditions;
    } else if (mode === 'guided') {
      hiddenTruth = direction ? `${direction}。その背景として、${baseline}` : baseline;
      hiddenConditions = selected.conditions;
    } else {
      hiddenTruth = `${baseline}。さらに、${selected.truth}`;
      hiddenConditions = selected.conditions;
    }
    const revealPolicy = difficulty === 'easy'
      ? '関連する質問を受けたら率直に答える。ただし開始直後に自分から本音をすべて話さない。'
      : difficulty === 'hard'
        ? '共感、具体的な質問、信頼がそろうまで断片的にだけ答える。一般的な質問には曖昧に答える。'
        : '一般的な質問には概要だけ答え、具体的な深掘りを受けたときに本音と判断条件を段階的に明かす。';
    return Object.freeze({
      mode,
      modeLabel: MODES[mode],
      publicFacts: buildPublicBriefing(category, config),
      hiddenTruth: clean(hiddenTruth),
      hiddenConditions: clean(hiddenConditions),
      revealPolicy,
      successCriteria: (DISCOVERY_SIGNALS[category] || DISCOVERY_SIGNALS.sales).map(([label]) => label),
    });
  }

  function analyzeDiscovery({ category = 'sales', conversation = [], profile = {} } = {}) {
    const userText = conversation
      .filter((message) => message?.role === 'user')
      .map((message) => clean(message.text, 1000))
      .join('\n');
    const signals = DISCOVERY_SIGNALS[category] || DISCOVERY_SIGNALS.sales;
    const discoveredItems = signals.filter(([, pattern]) => pattern.test(userText)).map(([label]) => label);
    const missedItems = signals.filter(([, pattern]) => !pattern.test(userText)).map(([label]) => label);
    const score = Math.round((discoveredItems.length / signals.length) * 100);
    return {
      score,
      discoveredItems,
      missedItems,
      discovered: discoveredItems.length
        ? `${discoveredItems.join('、')}を確認する質問ができました。`
        : '相手の本音につながる確認は、まだ十分にできていません。',
      missed: missedItems.length
        ? `${missedItems.join('、')}をさらに確認すると、本音と判断条件へ近づけます。`
        : '主要な確認項目を一通り聞くことができました。',
      hiddenSummary: [clean(profile.hiddenTruth), clean(profile.hiddenConditions) && `判断条件：${clean(profile.hiddenConditions)}`].filter(Boolean).join(' '),
    };
  }

  root.ScenarioDesign = Object.freeze({ MODES, categoryCopy, buildPublicBriefing, buildHiddenProfile, analyzeDiscovery });
})(globalThis);
