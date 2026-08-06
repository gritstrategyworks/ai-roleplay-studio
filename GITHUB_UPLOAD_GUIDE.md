# GitHub手動アップロードガイド

ローカルで確認後、個人Forkの専用ブランチへpushし、元リポジトリ宛てのDraft PRを作成します。

## 必須ファイル

- index.html / styles.css / auth.css / auth.js / app.js
- _headers
- local-ai.js / local-ai-worker.js
- service-worker.js / manifest.webmanifest
- assets/icon.svg
- roleplay.js
- functions/（middleware、auth、roleplay、local-model、billing）
- migrations/
- tests/
- package.json / wrangler.jsonc
- README.md / THIRD_PARTY_NOTICES.md
- .dev.vars.example（値はダミーのみ）

## アップロードしないもの

- .dev.vars
- Stripe、Cloudflare、Webhookの秘密鍵
- node_modules/
- .wrangler/
- deploy-*/
- ローカルの一時スクリプトやスクリーンショット

## GitHub上の構成

```text
リポジトリ直下/
├─ index.html
├─ styles.css
├─ auth.css
├─ auth.js
├─ app.js
├─ local-ai.js
├─ local-ai-worker.js
├─ roleplay.js
├─ service-worker.js
├─ manifest.webmanifest
├─ package.json
├─ wrangler.jsonc
├─ functions/
│  ├─ _middleware.js
│  ├─ _lib/auth.js
│  └─ api/
│     ├─ auth/
│     ├─ roleplay.js
│     ├─ local-model/[[path]].js
│     └─ billing/
├─ migrations/
├─ tests/
└─ assets/icon.svg
```

## Cloudflare設定

- Workers AIバインディング：AI
- D1バインディング：BILLING_DB
- 本番Price ID：price_1U1JSkJYbwf4eLAfkVOYv6kq
- AUTH_PEPPERはCloudflare Secretで管理
- SIGNUP_ENABLEDは新規登録を受け付ける間だけtrue
- BILLING_ENABLEDはStripe本番決済と法定表示の準備完了までfalse

秘密鍵はGitHubへ置かず、Cloudflare Secretsで管理してください。
