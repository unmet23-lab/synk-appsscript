#!/usr/bin/env bash
# 본편 A·B를 차례로 렌더하고 소리를 마감한다(휴대폰판도). 쓰는 법: bash scripts/render-all.sh v1
set -e
V=${1:-v1}
cd "$(dirname "$0")/.."
for X in a b; do
  npx remotion render lock-$X out/lock-$X-$V-raw.mp4 --log=error > out/render-$X-$V.log 2>&1
  node scripts/finish.mjs out/lock-$X-$V-raw.mp4 out/lock-$X-$V.mp4 out/lock-$X-$V-phone.mp4 >> out/render-$X-$V.log 2>&1
done
echo done
