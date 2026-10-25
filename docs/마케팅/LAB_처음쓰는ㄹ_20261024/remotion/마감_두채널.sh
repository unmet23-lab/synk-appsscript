#!/usr/bin/env bash
# 두 채널 판(간체 · 버마어) 렌더 → 음량마감 → CBR 10M → 표지 → 10MB 판. 10-25 처음 쓰는 ㄹ.
#   bash 마감_두채널.sh <판 이름(v6 등)> [zhs] [my]
# 버마어판은 첫 장을 0.7배로 줄인 시간표(REMOTION_FAST_INTRO=1, timeline.ts)로 굽고 표지도 그 시간표의 틀린 시도 셋 장면(142프레임)이다.
# 음량: 목소리 없이 연필 소리 순간 최대가 높아 리미터 0.78(기본으로는 −0.5 dBFS), 첫 장을 줄인 버마어판은 연필 소리가 겹쳐 0.7. 10MB 판은 9.1MB 목표(9.4로는 버마어판이 10.03MB).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../.." && pwd)"
TAG="$1"; shift
LOCS=("$@")
[ $# -eq 0 ] && LOCS=(zhs my)
cd "$HERE"
for L in "${LOCS[@]}"; do
  case "$L" in
    zhs) D="$HERE/../게시/03-xiaohongshu-cn"; FAST=0; COVER=196; LIM=0.78 ;;
    my) D="$HERE/../게시/04-tiktok-mm"; FAST=1; COVER=142; LIM=0.7 ;;
    *) echo "모르는 판: $L"; exit 2 ;;
  esac
  export REMOTION_FAST_INTRO=$FAST
  npx remotion render src/index.ts "rieul-$L" "$HERE/out/rieul_${L}_${TAG}.mp4" --log=error > "$HERE/out/render_${L}_${TAG}.log" 2>&1
  node "$REPO/tools/음량마감.mjs" "$HERE/out/rieul_${L}_${TAG}.mp4" "$HERE/out/rieul_${L}_${TAG}_final.mp4" --덮어쓰기 --리미터 "$LIM" | tail -2 | head -1
  ffmpeg -v error -y -i "$HERE/out/rieul_${L}_${TAG}_final.mp4" -map 0:v -map 0:a -c:a copy -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p \
    -b:v 10M -minrate 10M -maxrate 10M -bufsize 10M -x264-params nal-hrd=cbr -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -movflags +faststart "$D/video.mp4"
  npx remotion still src/index.ts "rieul-$L" "$D/cover.png" --frame=$COVER --log=error > /dev/null 2>&1
  UPLOAD_TARGET_MB=9.1 node 올림판_10MB.mjs "$D/video.mp4" | tail -1
  echo "$L $TAG 끝 · CBR $(ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate -of csv=p=0 "$D/video.mp4")"
done
