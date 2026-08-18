import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';

const [html, app, advisor, styles, auth, worker, serviceWorker] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/advisor.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/auth.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
]);

test('home and primary navigation expose the business dialogue advisor', () => {
  assert.match(html, /AI BUSINESS DIALOGUE ADVISOR/);
  assert.match(html, /職場での「どう話せばいい？」をAIに相談/);
  assert.match(html, /id="screen-advisor"/);
  assert.match(html, /id="navAdvisor"/);
  assert.match(html, /講義で学ぶ[\s\S]*AIに聞く[\s\S]*ロープレで試す[\s\S]*AI採点で振り返る/);
  assert.match(app, /advisor:'navAdvisor'/);
});

test('advisor UI offers examples, concise structured answers, and follow-up chat', () => {
  assert.match(html, /id="advisorExamples"/);
  assert.match(html, /id="advisorMessages"/);
  assert.match(html, /id="advisorForm"/);
  assert.match(advisor, /アドバイス/);
  assert.match(advisor, /こんなふうに伝えてみましょう/);
  assert.match(advisor, /避けた方がよい言い方/);
  assert.match(advisor, /MAX_STORED_MESSAGES = 10/);
  assert.match(advisor, /MAX_HISTORY_MESSAGES = 8/);
  assert.match(advisor, /sessionStorage/);
});

test('advisor prevents duplicate submissions and limits payload size', () => {
  assert.match(advisor, /SUBMIT_COOLDOWN_MS = 3000/);
  assert.match(advisor, /question === lastSubmitted\.text/);
  assert.match(advisor, /maxlength="800"|MAX_QUESTION_LENGTH = 800/);
  assert.match(worker, /sanitizeText\(body\?\.question, 800\)/);
  assert.match(worker, /history\.slice\(-8\)/);
  assert.match(worker, /advisor_request_limits/);
  assert.match(worker, /status: 429/);
});

test('worker reuses authenticated Workers AI with structured bounded output', () => {
  assert.match(worker, /routePath: "\/api\/advisor"/);
  assert.match(worker, /createAdvisorReply\(context\.env\.AI, data\)/);
  assert.match(worker, /あなたは「AIビジネス対話アドバイザー」です/);
  assert.match(worker, /response_format: \{ type: "json_schema"/);
  assert.match(worker, /max_tokens: 760/);
  assert.match(worker, /temperature: 0\.45/);
  assert.match(worker, /人事・法務・専門家|上司・人事・法務・専門家/);
});

test('every AI reply can prepare a real existing roleplay scenario', () => {
  assert.match(advisor, /この場面をロープレで練習する/);
  assert.match(advisor, /startRoleplayFromAdvisor/);
  assert.match(app, /ADVISOR_ROLEPLAY_PRESETS/);
  for (const scenario of ['newhire_report', 'manager_feedback', 'support_solution', 'sales_discovery']) {
    assert.match(app, new RegExp(`${scenario}:\\{category:`));
  }
  assert.match(app, /populateRoleplayConfig\(config\)/);
  assert.match(app, /updateSetupDraft\(\)/);
});

test('dedicated avatar and mobile advisor layout are production assets', async () => {
  const avatar = await stat(new URL('../public/assets/avatars/portraits/advisor.webp', import.meta.url));
  assert.ok(avatar.size > 10_000);
  assert.match(html, /assets\/avatars\/portraits\/advisor\.webp/);
  assert.match(styles, /@media\(max-width:650px\)[^{]*\{\.advisor-page-header/);
  assert.match(styles, /\.advisor-composer\{position:sticky/);
  assert.match(auth, /advisor\.js\?v=1\.57/);
  assert.match(serviceWorker, /advisor\.js\?v=1\.57/);
  assert.match(serviceWorker, /assets\/avatars\/portraits\/advisor\.webp/);
});

test('VOICEVOX commercial credit remains visible', () => {
  assert.match(html, /新入社員講義の音声：VOICEVOX:四国めたん/);
  assert.match(app, /音声：VOICEVOX:四国めたん/);
});
