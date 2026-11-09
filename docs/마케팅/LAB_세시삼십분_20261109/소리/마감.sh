#!/bin/bash
# LAB E32 「세 시 삼십 분」 마감 — 렌더 → 음량 마감 → CBR 10M 올림본(게시/0x/video.mp4) → 10MB 판(유튜브 · 샤오훙수).
# 워크트리(저장소) 뿌리에서: bash docs/마케팅/LAB_세시삼십분_20261109/소리/마감.sh <판 이름 접미사, 예: v10> [en cn mm]
set -e
V=${1:-v10}
shift || true
LANGS=${*:-en}
D=docs/마케팅/LAB_세시삼십분_20261109
O=$D/remotion/out
cbr() { # 마감본 → CBR 10M(현장 노트 영상_ffmpeg_자막)
  ffmpeg -y -v error -i "$1" -map 0:v -map 0:a -c:a copy -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 10M -minrate 10M -maxrate 10M -bufsize 10M -x264-params nal-hrd=cbr -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$2"
}
small() { # 10MB 판 — 2패스 2.3M + AAC 128k, 담기 전 리미터 0.76
  ffmpeg -y -v error -i "$1" -c:v libx264 -preset slow -b:v 2300k -pass 1 -passlogfile "$O/p_$3" -an -f mp4 NUL
  ffmpeg -y -v error -i "$1" -c:v libx264 -preset slow -b:v 2300k -pass 2 -passlogfile "$O/p_$3" -pix_fmt yuv420p -af "alimiter=limit=0.76:level=false:attack=1:release=60" -c:a aac -b:a 128k -ar 48000 -movflags +faststart "$2"
  rm -f "$O"/p_$3*
}
for L in $LANGS; do
  if [ "$L" = en ]; then R=$O/e32_$V.mp4; T=01-youtube-en; else R=$O/e32_${L}_$V.mp4; fi
  [ "$L" = cn ] && T=03-xiaohongshu-cn
  [ "$L" = mm ] && T=04-tiktok-mm
  node tools/음량마감.mjs "$R" "$O/e32_${L}_${V}_final.mp4" --덮어쓰기
  cbr "$O/e32_${L}_${V}_final.mp4" "$D/게시/$T/video.mp4"
  if [ "$L" != mm ]; then small "$O/e32_${L}_${V}_final.mp4" "$D/게시/$T/upload_10MB.mp4" "$L"; fi
done
echo "마감 끝 $V $LANGS"
