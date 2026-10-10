# このリポジトリで作業するAIへ

- 最初に必ず `SPEC.md` を最後まで読む。仕様はすべてそこにある。
- 文章・リンクは `public/content/site.json`、AIの知識は `data/ai-knowledge.md`。コードに文章を直書きしない。
- `public/assets/` と `public/vendor/` の既存ファイルは消さない・作り替えない。
- 秘密情報（ADMIN_TOKEN など）をファイルに書かない。`.dev.vars` はコミットしない。
- ファイルを消す・大きく作り直すときは、先に一言確認する。
- 各フェーズの終わりに `npx wrangler pages dev` で動作確認し、何をしたかを短く日本語で報告する。
- 文章・写真の追加は本人が編集画面（`public/edit/`）から行う。編集画面は main の `public/content/site.json` と gh-pages の `content/site.json` の両方に直接保存する。
- コードを変えたら main に push し、`scripts/publish-pages.sh` で gh-pages（GitHub Pages）にも反映する。
