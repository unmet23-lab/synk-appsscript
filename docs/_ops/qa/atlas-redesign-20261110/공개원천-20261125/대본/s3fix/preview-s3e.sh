#!/usr/bin/env bash
# ③ (나) 두 단계 후보 미리 보기 — 공용 작업본의 tools/공개.js(origin/master와 같을 때만), 지금 라이브 위.
#   bash preview-s3e.sh <1|2> <후보폴더 이름>
set -u
STEP=$1; OUT=$2
E=D:/SYNK-worktrees/world-export-atlas-20261120b
ITEMS=$(cat $E/.tmp/cand-step1c/items.txt | tr -d '\r' | tr '\n' ' ')
if [ "$STEP" = 1 ]; then
  ONLY="world/world-client.mjs world/world-session.mjs world/life-progress.mjs world/life-ui.mjs world/life-ui.css world/world-learning-ui.mjs world/world-month-answer.mjs world/brand-opening/home.mjs world/brand-opening/home-tutor.mjs world/brand-opening/home-tutor-lines.mjs world/world-reminder-device.mjs"
else
  ONLY="world/app-shell.mjs world/brand-opening/home.css"
fi
ARGS=""
for p in $ONLY; do ARGS="$ARGS --만 $p"; done
(
  cd /c/Users/q1212/Documents/SYNK-appsscript || exit 9
  git diff --quiet origin/master -- tools/공개.js || { echo "공용 tools/공개.js가 origin/master와 다르다"; exit 8; }
  node tools/공개.js 올리기 --원본 $E/.tmp/${SRC:-cand-step1d}/pub --기준폴더 $E/.tmp/cand-step1c/pubbase $ITEMS $ARGS ${EXTRA:-} --후보폴더 $E/.tmp/$OUT
)
