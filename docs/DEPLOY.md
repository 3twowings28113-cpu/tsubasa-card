# 公開手順（スマホだけでOK・GitHub × Cloudflare）

## 1. GitHub にリポジトリを作る（1分）
- https://github.com/new
- Repository name：`tsubasa-card`
- **Private** を選ぶ／README などは追加しない → **Create repository**
- 作ったら Claude に「作った」と伝える（コードは Claude が入れる）

## 2. Cloudflare で公開（5分）
1. https://dash.cloudflare.com/sign-up で無料登録（メール認証あり）
2. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. GitHub を連携して `tsubasa-card` を選ぶ → **Begin setup**
4. 設定
   - Project name：`tsubasa-yamashita`（これが URL になる）
   - Production branch：`main`
   - Framework preset：**None**
   - Build command：空のまま
   - Build output directory：`public`
5. **Save and Deploy** → `https://tsubasa-yamashita.pages.dev` が公開URL

この時点で、オープニング・連絡先ボックス・連絡先に保存・My Story・スライドが動く。

## 3. サーバー機能をオンにする（任意・5分）
「○人目のゲスト」「出会いの羽根」「山下翼AI」「管理画面」を使うとき。
1. **Storage & Databases** → **D1** → **Create** → 名前 `tsubasa-card`（テーブルは自動で作られる）
2. **Workers & Pages** → `tsubasa-yamashita` → **Settings** → **Bindings** → **Add**
   - **D1 database**：Variable name `DB` → `tsubasa-card`
   - **Workers AI**：Variable name `AI`
3. **Settings** → **Variables and Secrets** → **Add**
   - Name `ADMIN_TOKEN`、Type **Secret**、値は自分だけが知る長い文字列
4. **Deployments** → 最新の右の「…」→ **Retry deployment**（設定を反映）
5. 管理画面：`https://tsubasa-yamashita.pages.dev/admin`

## 更新のしかた
GitHub の `main` に変更が入ると自動で公開に反映される（Claude や GenCode が push するだけ）。
