# AI ROLEPLAY STUDIO

Cloudflare Workers AIと端末内Qwenに対応した、日本語の対話ロールプレイWebアプリです。

## 実装済み

- メールアドレス＋パスワードの独自ログイン（30日保持・明示ログアウト）
- ログイン不要のゲストモード（24時間、端末内データを分離、課金操作は不可）
- 営業・商談、管理職面談、採用面接、クレーム対応の4カテゴリ
- 開始前の公開情報とAIだけが知る非公開シナリオを分離
- 非公開設定は「AIにおまかせ」「方向性だけ指定」「すべて自分で設定」の3方式
- 終了後にヒアリング到達度、聞き出せた点、聞けなかった点を表示
- 基本12項目と、BtoB・BtoC・カテゴリ別の詳細設定
- 外見だけを表す6種類の顧客アバター
- 通常モード：Cloudflare Workers AIのQwen3 30Bで会話・採点
- 社内情報モード：Qwen 0.6B / 1.7B / 4Bをブラウザ端末内で実行
- 音声認識、ハンズフリー会話、端末標準音声、履歴保存、PWA
- Stripe Checkout / Customer Portal / Webhook / D1による月額980円（税込）のPremium
- Google Analytics 4（G-XH93D31BKJ）
- Google Search Console所有権確認メタタグ

## AI実行モード

通常モードは同一ドメインの `/api/roleplay` を利用します。使用モデルは
`@cf/qwen/qwen3-30b-a3b-fp8` です。詳細設定と非公開シナリオはサニタイズ後に会話・採点へ反映し、本音は適切な質問を受けた場合だけ段階的に開示します。

社内情報モードはWebGPU対応の最新版ChromeまたはEdgeが必要です。会話、採点、自社情報は
AI APIへ送信しません。初回だけモデルと実行ライブラリをダウンロードし、ブラウザ内へ保存します。

## ローカル確認

`npm install` 後、次を実行します。

```bash
npm test
npx wrangler pages dev . --ai AI
```

秘密情報は `.dev.vars` に置き、Gitへ追加しないでください。

## ログインとセッション

パスワードはPBKDF2-HMAC-SHA256（Cloudflare対応上限の100,000回）とユーザー別Salt、Cloudflare Secretの
`AUTH_PEPPER` で保護してD1へ保存します。ログインCookieは本番で `Secure`、`HttpOnly`、
`SameSite=Lax`、30日間有効です。AI APIは有効なログインまたは署名付きゲストセッションを必須とし、課金APIはログインユーザーだけに許可します。

## Stripe月額課金

- 商品：AI Roleplay Studio Premium
- 価格：月額980円（税込）
- Stripe本番Price ID：`price_1U1JSkJYbwf4eLAfkVOYv6kq`
- D1：`ai-roleplay-billing`
- Webhook：`/api/billing/webhook`

必要なSecretsは `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、認証用の
`AUTH_PEPPER` です。秘密鍵はHTML、ブラウザJavaScript、GitHubへ保存しません。

本番設定の `BILLING_ENABLED` は現在 `false` です。Stripeアカウントの本番決済有効化と、
販売事業者情報・専用問い合わせ先の掲載が完了した後にだけ `true` へ変更してください。

## デプロイ

現在の本番URL：

```text
https://ai-roleplay-studio.ai-roleplay-studio.workers.dev/
```

ローカルで確認後、個人Forkの専用ブランチへpushし、元リポジトリ宛てのDraft PRでレビューします。

## データと注意事項

- 設定・履歴・自社情報はログインユーザー別に分離して利用者のブラウザへ保存します。
- 社内情報モードでも、モデル初回取得時には外部通信が発生します。
- Premiumの利用権はログインユーザーIDに紐づき、同じアカウントで確認できます。
- 利用規約、プライバシーポリシー、特定商取引法表示は本番画面内にあります。
- 外部ライセンスは `THIRD_PARTY_NOTICES.md` を確認してください。
