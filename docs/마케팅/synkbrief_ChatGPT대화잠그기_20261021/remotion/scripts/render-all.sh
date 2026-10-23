#!/usr/bin/env bash
# 본편 A·B를 차례로 렌더하고 소리를 마감한다(휴대폰판도). 쓰는 법: bash scripts/render-all.sh v4g
# v4(10-23)부터 소리 마감은 공용 도구 tools/음량마감.mjs(−14.5 LUFS · 최대 −1.2 dBFS 통과 범위). 옛 scripts/finish.mjs는 최대 −1.1 dBFS가 나와 올리기 전 검사에 걸렸다.
set -e
V=${1:-v1}
cd "$(dirname "$0")/.."
for X in a b; do
  npx remotion render lock-$X out/lock-$X-$V-raw.mp4 --log=error > out/render-$X-$V.log 2>&1
  node ../../../../tools/음량마감.mjs out/lock-$X-$V-raw.mp4 out/lock-$X-$V.mp4 --휴대폰 out/lock-$X-$V-phone.mp4 --덮어쓰기 --json >> out/render-$X-$V.log 2>&1
done
echo done
