import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [html, authCss, authJs, styles, manifest, appJs] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/auth.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/auth.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
]);

test('official service names are used in branding and metadata', () => {
  assert.match(html, /AI BUSINESS ROLEPLAY STUDIO/);
  assert.match(html, /AIビジネスロールプレイスタジオ/);
  assert.match(html, /AI Business Roleplay Studio/);
  assert.match(html, /brand-name-short[^>]*>AIロープレスタジオ/);
  assert.doesNotMatch(html, />AI ROLEPLAY STUDIO</);
  assert.match(manifest, /"name": "AIビジネスロールプレイスタジオ"/);
  assert.match(manifest, /"short_name": "AIロープレスタジオ"/);
});

test('logged-out page explains the three-step service and sample score', () => {
  assert.match(html, /3分で分かる/);
  assert.match(html, /練習内容を選ぶ/);
  assert.match(html, /AIと会話する/);
  assert.match(html, /AIの採点を受ける/);
  assert.match(html, /採点結果のサンプル/);
  assert.match(html, /<strong>82<\/strong>/);
  assert.match(html, /質問力[\s\S]*85/);
  assert.match(html, /その課題によって、現在どのような影響が出ていますか/);
});

test('plan comparisons reflect enforced limits and reuse existing actions', () => {
  assert.match(html, /ロープレ時間[\s\S]*5分[\s\S]*5分・10分・15分/);
  assert.match(html, /詳細設定[\s\S]*利用不可[\s\S]*利用可能/);
  assert.match(html, /入門2本[\s\S]*全20本/);
  assert.match(html, /data-auth-guest-cta/);
  assert.match(html, /data-auth-premium-cta/);
  assert.match(html, /onclick="startCheckout\(\)"/);
  assert.match(authJs, /POST_AUTH_ACTION_KEY/);
  assert.match(authJs, /startCheckoutWhenReady/);
});

test('new hire lecture category adds four YouTube videos', () => {
  assert.match(appJs, /newhire:\{label:/);
  assert.match(appJs, /id:'5\.1'[\s\S]*id:'5\.4'/);
  assert.match(appJs, /youtubeId:'qi4Jh8xOdLI'/);
  assert.match(appJs, /youtubeId:'_o3hRtZYWJc'/);
  assert.match(appJs, /youtubeId:'eV4LqLNY25Q'/);
  assert.match(appJs, /youtubeId:'H7B-p-ygOBc'/);
  assert.doesNotMatch(appJs, /mediaSrc:'media\/lectures\/5-[1-4]\.mp4'/);
  assert.match(html, /VOICEVOX:\u56db\u56fd\u3081\u305f\u3093/);
});

test('responsive styles avoid wide fixed layouts at phone width', () => {
  assert.match(authCss, /@media\(max-width:520px\)/);
  assert.match(authCss, /plan-comparison-row\{grid-template-columns:minmax\(92px/);
  assert.match(authCss, /overflow-x:hidden/);
  assert.match(styles, /brand-name-short\{display:none\}/);
  assert.match(styles, /@media\(max-width:720px\)/);
});
