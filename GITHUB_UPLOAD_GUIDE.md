# GitHubアップロード用ガイド

このフォルダ内のファイルとフォルダを、GitHubリポジトリの最上位（ルート）へすべてアップロードしてください。

## 必須ファイル

- `index.html`
- `styles.css`
- `app.js`
- `kokoro-worker.js`
- `service-worker.js`
- `manifest.webmanifest`
- `package.json`
- `wrangler.jsonc`
- `README.md`
- `THIRD_PARTY_NOTICES.md`
- `functions/`
- `assets/`

## GitHub上の正しい構成

```text
リポジトリ直下/
├─ index.html
├─ styles.css
├─ app.js
├─ kokoro-worker.js
├─ service-worker.js
├─ manifest.webmanifest
├─ package.json
├─ wrangler.jsonc
├─ README.md
├─ THIRD_PARTY_NOTICES.md
├─ functions/
│  └─ api/
│     └─ roleplay.js
└─ assets/
   ├─ icon.svg
   └─ avatars/
```

ZIPファイル自体をGitHubへ置くのではなく、ZIPを展開し、中身をアップロードしてください。

## CloudflareでAIを使う際の重要設定

Workers AIのバインディング名を `AI` に設定してください。
`functions/api/roleplay.js` がAI会話APIです。

## 注意

- APIキーや秘密鍵をGitHubへアップロードしないでください。
- GitHub Pagesでは画面・ローカル会話・音声を確認できます。
- Workers AIを含めたテストはCloudflareへデプロイして確認してください。
