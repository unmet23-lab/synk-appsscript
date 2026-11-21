#!/usr/bin/env bash
# build.sh가 중간에 멈췄을 때 남은 단계만: bash scripts/build_rest.sh <판 번호>
set -e
N="$1"; EP="$(cd "$(dirname "$0")/../.." && pwd)"; R="$EP/remotion"; REPO="$(cd "$EP/../../.." && pwd)"
cd "$R"
for pair in "main:m" "post:g"; do
  comp="${pair%%:*}"; tag="${pair##*:}"
  if [ ! -s "out/${tag}${N}.mp4" ]; then npx remotion render src/index.ts "$comp" "out/${tag}${N}.mp4" --log=error --timeout=120000; fi
  if [ ! -s "out/${tag}${N}_12m.mp4" ]; then ffmpeg -hide_banner -nostdin -loglevel error -y -i "out/${tag}${N}.mp4" -map 0:v:0 -map 0:a:0 -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 12M -minrate 12M -maxrate 12M -bufsize 24M -x264-params nal-hrd=cbr -c:a copy -movflags +faststart "out/${tag}${N}_12m.mp4"; fi
done
cd "$REPO"
node tools/음량마감.mjs "$R/out/m${N}_12m.mp4" "$EP/최종.mp4" --덮어쓰기
node tools/음량마감.mjs "$R/out/g${N}_12m.mp4" "$EP/최종_게시글판.mp4" --덮어쓰기
echo BUILD_DONE "$N"
