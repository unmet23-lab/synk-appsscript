#!/usr/bin/env bash
# 본편을 렌더하고 소리를 마감한다(휴대폰판도). 쓰는 법: bash scripts/render.sh v1
set -e
V=${1:-v1}
cd "$(dirname "$0")/.."
npx remotion render b16 out/b16-$V-raw.mp4 --log=error > out/render-$V.log 2>&1
node scripts/finish.mjs out/b16-$V-raw.mp4 out/b16-$V.mp4 out/b16-$V-phone.mp4 >> out/render-$V.log 2>&1
echo done
