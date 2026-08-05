# AI ROLEPLAY STUDIO Ver.1.0

Cloudflare Workers AIを利用する「通常モード」と、ブラウザ内Qwenを利用する「社内情報モード」を選べるロールプレイWebアプリです。営業・管理職面談・採用面接・クレーム対応を練習できます。

## 主な機能

- 4カテゴリー、6種類の外見アバター、3難易度
- カテゴリー別の通常設定と「詳細設定（会話のプロンプト）」
- 通常モード：Workers AIによる会話・採点、音声認識、ブラウザ標準音声
- 社内情報モード：WebLLMとQwenによる端末内会話・採点
- PWA、レスポンシブUI、履歴・結果エクスポート
- Cloudflare Workers Static Assets対応

## AI実行モード

### 通常モード

会話と採点をCloudflare Workers AIで処理します。音声会話を利用できます。入力した会話・設定はAPIへ送信されるため、機密情報を入力しないでください。Workers AIが利用できない場合は機密情報を含まない基本会話へ切り替わります。

### 社内情報モード

設定画面でQwen 1.7B（軽量）またはQwen 4B（標準）を選び、初回だけモデルを端末へダウンロードします。モデルはブラウザのIndexedDBへ保存され、会話・社内情報・採点はWeb Worker内で処理されます。

- 社内情報モードからCloudflare AIへ自動フォールバックしません。
- 音声認識・読み上げは無効となり、テキスト会話だけを使用します。
- 履歴保存は初期状態で無効です。
- 設定画面から保存済みモデルを削除できます。
- 最新版ChromeまたはEdge、HTTPS、WebGPU対応GPUが必要です。
- Qwen 1.7Bは約2GB、Qwen 4Bは約3.4GBのGPUメモリを使用する目安です。端末によってはより多く必要です。
- 初回のモデル取得時のみ外部配信元への通信が発生します。入力した社内情報はモデル配信元へ送信しません。
- 社内情報はブラウザのLocalStorageに平文保存されます。パスワード、秘密鍵、個人情報などは入力しないでください。

## ローカル検証

```bash
npm ci
npm run typecheck
npm run test
npm run build
npm run dev
```

`npm run build`は公開用静的アセットを`dist/`へ出力し、WebLLM本体とローカルAI用Web Workerもバンドルします。

## Cloudflare Git連携設定

Cloudflare Workers & Pagesで本GitHubリポジトリを接続し、次を設定してください。

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`
- Workers AI binding: `AI`
- Static assets directory: `dist`（`wrangler.jsonc`で設定済み）

`wrangler.jsonc`はWorker entrypoint、Static Assets、SPA fallback、`AI` bindingを定義しています。mainへのpushをProduction branchのトリガーに設定すると、PRマージ後に自動ビルド・デプロイされます。Cloudflareの権限・デプロイトークンは管理画面側のGit連携だけに設定し、GitHubへコミットしないでください。

## API

- `GET /api/health`: 稼働状態とAI binding状態
- `GET /api/roleplay`: AI接続状態
- `POST /api/roleplay`: 通常モードの会話または採点
- `POST /api/analyze`: 通常モードの採点専用endpoint

社内情報モードはこれらのAPIを呼び出しません。

## 既知の制約

- WebGPU非対応端末では社内情報モードを利用できません。
- モバイル端末やGPUメモリの少ない端末ではモデルを読み込めない場合があります。
- ブラウザがストレージを自動整理すると、モデルの再ダウンロードが必要です。
- 端末内Qwenの応答品質・速度は端末性能と選択モデルに依存します。
- 音声認識はブラウザ依存で、通常モードではChromeまたはEdgeを推奨します。
- 履歴と設定は端末間同期されません。

## セキュリティ

秘密鍵、APIトークン、`.env`、`.dev.vars`はリポジトリへ含めません。社内情報モードでも、端末の共有、ブラウザ拡張機能、マルウェア、LocalStorageの平文保存に対する防御を保証するものではありません。

## ライセンス

外部ライブラリ・モデルの詳細は`THIRD_PARTY_NOTICES.md`を参照してください。