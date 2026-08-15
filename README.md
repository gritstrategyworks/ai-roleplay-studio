# AI ROLEPLAY STUDIO

Cloudflare Workersで公開する、AI実践ロールプレイWebアプリです。

公開URL: https://roleplay.gritstrategyworks.com/

## 実装済み

- 営業・商談、管理職面談、採用面接、クレーム対応
- 14シナリオ、6種類の顧客アバター、各5表情
- 相手の性格8種類、難易度3段階、練習／実践モード
- 信頼・関心・負荷とアバター表情の連動
- 音声認識、ハンズフリー会話、端末標準音声
- Kokoro-82Mの日本語5音声（ブラウザ内生成）
- AI未接続時のローカル会話
- AI採点またはローカル採点、会話履歴、成績保存
- 結果テキスト保存、全履歴JSON書き出し
- Stripeによる無料／Premium（月額980円）の契約管理
- 無料2本・Premium全16本のレクチャー動画
- Premium限定の研修担当者・上級者向け詳細設定
- 公開リンクとQRコードによるアプリ共有
- AdSense所有権確認・ads.txt対応（広告枠は審査承認後に追加）
- スマートフォン対応、PWAキャッシュ
- Cloudflare Workers AI、D1、静的アセット配信

## プラン別機能

| 機能 | 無料 | Premium |
| --- | --- | --- |
| 基本設定・AIロープレ・文字・マイク入力 | 利用可 | 利用可 |
| 総合評価 | 利用可 | 利用可 |
| レクチャー動画 | 入門2本 | 全16本 |
| 研修担当者・上級者向け詳細設定 | ロック | 利用可 |
| 項目別スコア・改善ポイント・会話記録 | ロック | 利用可 |
| 広告 | 審査承認後、ロープレ外で表示予定 | 非表示 |

## Cloudflareへ公開

Workers AIバインディング `AI`、D1バインディング `BILLING_DB`、Stripe用Secretを設定したうえでデプロイします。

```bash
npm install
npx wrangler login
npm run check
npm run deploy
```

本番URLは `wrangler.jsonc` の `APP_URL` とCloudflareのCustom Domainを一致させてください。

## 試用期間中の開発者テスト表示（一時機能）

`DEVELOPER_EMAILS` に登録されたメールアドレスでログインした場合だけ、ホームに無料／Premium表示の切替欄が表示されます。切替にはCloudflare Secretの `DEVELOPER_PREVIEW_COMMAND` が必要で、選択内容は署名付きHttpOnly Cookieとして4時間だけ保持されます。Stripeの契約や課金状態は変更しません。

```bash
npx wrangler secret put DEVELOPER_PREVIEW_COMMAND
```

- 秘密コマンドはソースコード、`wrangler.jsonc`、ブラウザ保存領域へ書かないでください。
- 5回失敗すると10分間ロックされます。
- 無料表示では、実際にPremium契約中でも無料版のサーバー制限を確認できます。
- Premium表示では、未契約でも全講義・詳細設定・詳細評価を確認できます。
- 試用期間終了後は、`DEVELOPER_EMAILS` と `DEVELOPER_PREVIEW_COMMAND`、`/api/developer/preview`、`developerPreview`関連UI／Cookie処理を削除します。

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
## デプロイ

`main` ブランチへの更新はCloudflare Workers Buildsから本番環境へデプロイされます。
