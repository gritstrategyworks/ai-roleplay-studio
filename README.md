# AI ROLEPLAY STUDIO Ver.1.0

Cloudflare Workers AIを使い、営業・マネジメント・採用・顧客対応を音声またはテキストで練習できるWebアプリです。AIが利用できない場合もローカル会話へ自動で切り替わります。

## 主な機能

- 4カテゴリー・14シナリオ、6種類のアバター、8性格、3難易度
- 選択候補と自由入力を併用できる「詳細設定（会話のプロンプト）」
- 音声認識、Kokoro音声、ブラウザ標準音声、ハンズフリー会話
- Workers AIによる自由会話と採点（`/api/roleplay`、`/api/analyze`）
- ローカル会話・ローカル採点、履歴保存、結果エクスポート
- PWA、スマートフォン対応、Cloudflare Workers Static Assets

## ローカル検証

```bash
npm ci
npm run typecheck
npm run test
npm run build
npm run dev
```

`npm run build`は公開用静的アセットを`dist/`へ出力します。`npm run dev`にはCloudflareへのログインとWorkers AI利用権限が必要です。

## Cloudflare Git連携設定

Cloudflare Workers & Pagesで本GitHubリポジトリを接続し、次を設定してください。

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`
- Workers AI binding: `AI`
- Static assets directory: `dist`（`wrangler.jsonc`で設定済み）

`wrangler.jsonc`はWorker entrypoint、Static Assets、SPA fallback、`AI` bindingを定義しています。mainへのpushをProduction branchのトリガーに設定すると、PRマージ後に自動ビルド・デプロイされます。APIキーや秘密鍵は不要で、Cloudflareのbindingを使用します。必要なCloudflareアカウント権限・デプロイトークンは管理画面側のGit連携にだけ設定し、GitHubへコミットしないでください。

## API

- `GET /api/health`: 稼働状態とAI binding状態
- `GET /api/roleplay`: AI接続状態
- `POST /api/roleplay`: `reply`（会話）または`evaluate`（採点）
- `POST /api/analyze`: 会話終了後の採点専用endpoint

## 既知の制約

- Workers AI未設定・障害時はローカルモードになります。
- 音声認識はブラウザ依存で、ChromeまたはEdgeを推奨します。
- Kokoroは初回に約90MBのモデルを外部配信元から取得します。
- 履歴と設定はブラウザのLocalStorageに保存され、端末間同期はありません。

## セキュリティ

会話本文はAI接続時にWorkers AIへ送信されます。秘密鍵、APIトークン、`.env`、`.dev.vars`はリポジトリへ含めないでください。

## ライセンス

外部ライブラリ・モデルの詳細は`THIRD_PARTY_NOTICES.md`を参照してください。



