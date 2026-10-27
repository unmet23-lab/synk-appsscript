#!/usr/bin/env bash
# 본편 A·B·C를 차례로 렌더하고 소리를 마감한다(휴대폰판도). 쓰는 법: bash scripts/render-all.sh v4 [a|b|c|abc]
set -e
V=${1:-v1}
WHICH=${2:-abc}
cd "$(dirname "$0")/.."
for X in a b c; do
  case "$WHICH" in *$X*) ;; *) continue ;; esac
  npx remotion render room-$X out/room-$X-$V-raw.mp4 --log=error > out/render-$X-$V.log 2>&1
  node scripts/finish.mjs out/room-$X-$V-raw.mp4 out/room-$X-$V.mp4 out/room-$X-$V-phone.mp4 >> out/render-$X-$V.log 2>&1
done
echo done
