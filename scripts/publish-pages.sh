#!/usr/bin/env bash
# main の public/ を gh-pages ブランチ（GitHub Pages の公開用）に反映する。
# 編集画面は両方のブランチに直接保存するので、これはコードを変えたときだけ使う。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch -q origin gh-pages
tmp=$(mktemp -d)
git worktree add -q "$tmp" origin/gh-pages
rsync -a --delete --exclude .git public/ "$tmp"/
cd "$tmp"
git add -A
if git diff --cached --quiet; then echo "gh-pages: 変更なし"; else
  git commit -q -m "Publish public/ from main ($(git -C "$OLDPWD" rev-parse --short HEAD))"
  git push -q origin HEAD:gh-pages
  echo "gh-pages: 公開しました"
fi
cd - >/dev/null
git worktree remove --force "$tmp"
