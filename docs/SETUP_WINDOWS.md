# 公開手順（Windows・コマンドプロンプト版）

> スマホだけで公開するなら `docs/DEPLOY.md` のほうが簡単。こちらはPCのコマンドで公開する場合。
> 最初に `copy wrangler.example.toml wrangler.toml` を実行してから進める。

サイトはもう動く状態。ここに書いた手順で公開URLが出る。所要時間は10分くらい。

## 1. 初回だけ（5分）
1. Cloudflareの無料アカウントを作る：https://dash.cloudflare.com/sign-up
2. コマンドプロンプトで、上から順に：
```
cd %USERPROFILE%\GensparkCode\tsubasa-card
npm install
npx wrangler login
```
（ブラウザが開くので「Allow」）
```
npx wrangler d1 create tsubasa-card
```
3. 表示された `database_id = "…"` の値をコピーして、`wrangler.toml` の `database_id` の行に貼る
```
notepad wrangler.toml
```
4. 続き：
```
npm run db:init:remote
npx wrangler pages project create tsubasa-yamashita --production-branch main
npx wrangler pages secret put ADMIN_TOKEN --project-name tsubasa-yamashita
```
（最後のコマンドで聞かれたら、管理画面用の合言葉を入力。自分だけが知る長い文字列にする）

## 2. 公開
```
npm run deploy
```
最後に出る `https://tsubasa-yamashita.pages.dev`（名前が使われていたら末尾に文字が付く）が公開URL。

## 3. 公開したあと
- スマホで `https://○○.pages.dev/?via=nfc` を開いて確認
- 管理画面：`https://○○.pages.dev/admin`（さっきの合言葉で入る）
  - 当日のイベント名を入れておくと、「連絡先に保存」のメモ欄に入る
  - 届いた「出会いの羽根」を承認する
- `public/content/site.json` の `site.url` を公開URLにして、もう一度 `npm run deploy`
- NFCへの書き込みは `docs/NFC.md`

## 文章や写真を変えたいとき
- 文章・リンク：`public/content/site.json`
- AIの知識：`data/ai-knowledge.md`
- 変えたら `npm run deploy`

## 手元で確認したいとき（任意）
```
copy .dev.vars.example .dev.vars
npm run db:init:local
npm run dev
```
→ http://localhost:8788
