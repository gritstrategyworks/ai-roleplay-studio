# GitHub手動アップロードガイド

この作業環境からGitHubへ直接書き込みません。ローカルで確認後、次のファイルだけをリポジトリのルートへ手動アップロードしてください。

## 必須ファイル

- index.html / styles.css / app.js
- local-ai.js / local-ai-worker.js
- service-worker.js / manifest.webmanifest
- assets/icon.svg
- roleplay.js
- functions/（roleplay、local-model、billing）
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
├─ app.js
├─ local-ai.js
├─ local-ai-worker.js
├─ roleplay.js
├─ service-worker.js
├─ manifest.webmanifest
├─ package.json
├─ wrangler.jsonc
├─ functions/
│  └─ api/
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
- BILLING_ENABLEDはStripe本番決済と法定表示の準備完了までfalse

秘密鍵はGitHubへ置かず、Cloudflare Secretsで管理してください。
