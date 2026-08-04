# AI ROLEPLAY STUDIO — GitHub Test Edition v3.1

GitHub Pagesへそのまま公開してテストプレイできる、AI音声ロールプレイWebアプリです。

## 実装済み

- 営業・商談、管理職面談、採用面接、クレーム対応
- 14シナリオ、10人のアバター、各5表情
- 相手の性格8種類、難易度3段階、練習／実践モード
- 信頼・関心・負荷とアバター表情の連動
- 音声認識、ハンズフリー会話、端末標準音声
- Kokoro-82Mの日本語5音声（ブラウザ内生成）
- AI未接続時のローカル会話
- AI採点またはローカル採点、会話履歴、成績保存
- 結果テキスト保存、全履歴JSON書き出し
- 無料／プレミアム表示の課金UIテスト
- スマートフォン対応、PWAキャッシュ
- 外部Cloudflare WorkerのAIエンドポイント設定

## GitHub Pagesで公開

1. このフォルダの中身をGitHubの新しいリポジトリ直下へアップロードします。
2. GitHubの `Settings → Pages` を開きます。
3. `Deploy from a branch`、ブランチ `main`、フォルダ `/(root)` を選択します。
4. 表示された `https://ユーザー名.github.io/リポジトリ名/` をChromeまたはEdgeで開きます。

GitHub Pagesだけで公開した場合、会話はローカル会話モードです。音声認識、端末音声、Kokoro、アバター、採点、履歴は利用できます。

## 本物のAI自由会話へ接続

Cloudflare WorkerまたはPages Functionsで `functions/api/roleplay.js` を公開し、アプリの
`設定 → AI APIエンドポイント` に次の形式で入力します。

```text
https://あなたのWorker名.workers.dev/api/roleplay
```

このプロジェクトのAPIはCORSを許可する設定です。Workers AIバインディング名は `AI` にしてください。

## Kokoro音声

- 初回に約90MBのモデルを取得します。
- HTTPSまたはlocalhostで動作します。
- 端末やブラウザで利用できない場合は標準音声へ自動切替します。
- KokoroライブラリはjsDelivr、モデルはHugging Faceから取得します。

## ローカル確認

静的機能だけ試す場合：

```bash
python -m http.server 8000
```

Cloudflare Workers AIを含めて試す場合：

```bash
npm install
npx wrangler login
npm run dev
```

## 注意

- GitHub Pagesは静的ホスティングなので、Workers AIそのものは実行しません。
- APIキーをHTMLやJavaScriptへ直接書かないでください。
- 音声認識はブラウザ依存です。ChromeまたはEdgeを推奨します。
- 成績と設定は利用者のブラウザのLocalStorageへ保存されます。

## 外部ライセンス

- Kokoro-82M / kokoro-js: Apache License 2.0
- 詳細は `THIRD_PARTY_NOTICES.md` を確認してください。
