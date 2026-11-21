#!/usr/bin/env bash
# 두 판을 렌더 → 12Mbps CBR로 다시 담기 → 음량 마감. 쓰는 법: bash scripts/build.sh <판 번호(r2 같은)>
set -e
N="$1"; EP="$(cd "$(dirname "$0")/../.." && pwd)"; R="$EP/remotion"; REPO="$(cd "$EP/../../.." && pwd)"
cd "$R"
for pair in "main:m" "post:g"; do
  comp="${pair%%:*}"; tag="${pair##*:}"
  npx remotion render src/index.ts "$comp" "out/${tag}${N}.mp4" --log=error
  ffmpeg -hide_banner -nostdin -loglevel error -y -i "out/${tag}${N}.mp4" -map 0:v:0 -map 0:a:0 -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 12M -minrate 12M -maxrate 12M -bufsize 24M -x264-params nal-hrd=cbr -c:a copy -movflags +faststart "out/${tag}${N}_12m.mp4"
done
cd "$REPO"
node tools/음량마감.mjs "$R/out/m${N}_12m.mp4" "$EP/최종.mp4" --덮어쓰기
node tools/음량마감.mjs "$R/out/g${N}_12m.mp4" "$EP/최종_게시글판.mp4" --덮어쓰기
echo BUILD_DONE "$N"
