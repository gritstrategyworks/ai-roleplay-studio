import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app, advisor, worker, migration, serviceWorker] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/advisor.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../migrations/0001_advisor_daily_usage.sql', import.meta.url), 'utf8'),
  readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8')
]);

test('the first two lectures in all five roleplay themes are free', () => {
  assert.match(app, /FREE_LECTURE_IDS=new Set\(\['1\.1','1\.2','2\.1','2\.2','3\.1','3\.2','4\.1','4\.2','5\.1','5\.2'\]\)/);
  assert.match(html, /全5テーマの(?:入門|導入)講義は各2本無料/);
  assert.match(html, /全5テーマ 各2本/);
});

test('free advisor quota is visible and refreshed by the client', () => {
  assert.match(html, /id="advisorQuota"/);
  assert.match(html, /AI対話アドバイザー<\/strong><span role="cell">1日5回<\/span><span role="cell">無制限/);
  assert.match(advisor, /fetch\('\/api\/advisor', \{ method: 'GET'/);
  assert.match(advisor, /本日の無料相談：残り\$\{advisorQuota\.remaining\}\/\$\{advisorQuota\.limit\}回/);
  assert.match(advisor, /data\.quota\) applyAdvisorQuota\(data\.quota\)/);
  assert.match(advisor, /daily_limit_reached/);
});

test('worker enforces an atomic five-per-day JST quota per account or guest cookie', () => {
  assert.match(worker, /ADVISOR_FREE_DAILY_LIMIT = 5/);
  assert.match(worker, /nowMs \+ 9 \* 60 \* 60 \* 1000/);
  assert.match(worker, /guest:" \+ await hashSessionToken\(guestToken\)/);
  assert.match(worker, /PRIMARY KEY \(actor_id, usage_date\)/);
  assert.match(worker, /WHERE advisor_daily_usage\.used_count < \?/);
  assert.match(worker, /RETURNING used_count/);
  assert.match(worker, /modules: \[onRequestGetAdvisor\]/);
  assert.match(worker, /code: "daily_limit_reached"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS advisor_daily_usage/);
  assert.match(serviceWorker, /v1-65-advisor-daily-limit/);
});