import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const worker = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
const auth = await readFile(new URL('../public/auth.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('password recovery uses email links instead of a browser secret command', () => {
  assert.doesNotMatch(html, /authResetCommand|秘密コマンド.*パスワード/);
  assert.match(auth, /password-reset\/request/);
  assert.match(auth, /password-reset\/confirm/);
  assert.match(worker, /password_reset_tokens/);
  assert.match(worker, /https:\/\/api\.resend\.com\/emails/);
  assert.match(worker, /DELETE FROM auth_sessions WHERE user_id = \?/);
  assert.match(worker, /PASSWORD_RESET_TTL_SECONDS = 60 \* 30/);
  assert.match(worker, /email_delivery_failed/);
  assert.match(worker, /providerStatus/);
  assert.match(worker, /DELETE FROM auth_rate_limits WHERE rate_key = \?/);
  assert.match(worker, /no-reply@mail\.gritstrategyworks\.com/);
  assert.match(auth, /迷惑メールフォルダ/);
});
