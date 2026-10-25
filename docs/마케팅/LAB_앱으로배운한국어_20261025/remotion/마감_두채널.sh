#!/usr/bin/env bash
# 두 채널 판(샤오훙수 간체) 렌더 → 음량마감 → CBR 10M → 표지 → 10MB 판. 10-26 대기 표 T3(처음 쓰는 ㄹ 편 마감_두채널.sh를 옮김).
#   bash 마감_두채널.sh <판 이름(v1 등)>
# 영어 목소리로 짠 편이라 간체판만 낸다(기획장부/LAB.md 머리말 「두 채널 판」 3번). 표지는 영어판과 같은 36프레임(1.2초).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../.." && pwd)"
TAG="$1"
L=zhs
D="$HERE/../게시/03-xiaohongshu-cn"
mkdir -p "$D" "$HERE/out"
cd "$HERE"
npx remotion render src/index.ts "appkr-$L" "$HERE/out/appkr_${L}_${TAG}.mp4" --log=error > "$HERE/out/render_${L}_${TAG}.log" 2>&1
node "$REPO/tools/음량마감.mjs" "$HERE/out/appkr_${L}_${TAG}.mp4" "$HERE/out/appkr_${L}_${TAG}_final.mp4" --덮어쓰기 | tail -2 | head -1
ffmpeg -v error -y -i "$HERE/out/appkr_${L}_${TAG}_final.mp4" -map 0:v -map 0:a -c:a copy -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p \
  -b:v 10M -minrate 10M -maxrate 10M -bufsize 10M -x264-params nal-hrd=cbr -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -movflags +faststart "$D/video.mp4"
npx remotion still src/index.ts "appkr-$L" "$D/cover.png" --frame=36 --log=error > /dev/null 2>&1
node 올림판_10MB.mjs "$D/video.mp4" | tail -1
echo "$L $TAG 끝 · CBR $(ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate -of csv=p=0 "$D/video.mp4")"
