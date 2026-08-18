import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('new-hire setup uses joining period instead of a duplicate time field', () => {
  assert.match(
    app,
    /newhire:\{title:'新入社員ロープレ設定',labels:\['練習テーマ','相手の立場','会話形式','入社時期'/,
  );
  assert.doesNotMatch(
    app,
    /newhire:\{title:'新入社員ロープレ設定',labels:\[[^\]]*'目安時間'/,
  );
  assert.match(
    app,
    /newhire:\{product:\{name:'報告・連絡・相談',target:'直属の上司',type:'対面',price:'入社3か月'/,
  );
  assert.match(app, /state\.category==='newhire'&&\/\^5分/);
  assert.match(app, /details:\['所属部署・担当業務','これまでの実務経験'/);
  assert.match(
    html,
    /id="roleplayTimeLimitSelect"[\s\S]*value="300">5分[\s\S]*value="600" data-premium-time>10分（Premium）[\s\S]*value="900" data-premium-time>15分（Premium）/,
  );
});
