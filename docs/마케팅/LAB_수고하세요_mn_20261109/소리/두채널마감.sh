#!/bin/bash
# LAB M32 두 채널 판(샤오훙수 간체 · 틱톡 버마어) — 렌더 → 음량 마감 → CBR 10M 올림본 → (간체) 10MB 판 · 표지(6.5초 얼어붙은 교수님 + 뜻풀이).
# 워크트리(저장소) 뿌리에서: bash docs/마케팅/LAB_수고하세요_mn_20261109/소리/두채널마감.sh <판 접미사, 예: v3>
set -e
V=${1:-v3}
D=docs/마케팅/LAB_수고하세요_mn_20261109
O=$D/remotion/out
for L in cn mm; do
  [ $L = cn ] && P=$D/게시/03-xiaohongshu-cn || P=$D/게시/04-tiktok-mm
  mkdir -p "$P"
  (cd $D/remotion && npx remotion render m32-$L out/m32_${L}_$V.mp4 --log=error)
  node tools/음량마감.mjs "$O/m32_${L}_$V.mp4" "$O/m32_${L}_${V}_final.mp4" --덮어쓰기
  ffmpeg -y -v error -i "$O/m32_${L}_${V}_final.mp4" -map 0:v -map 0:a -c:a copy -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 10M -minrate 10M -maxrate 10M -bufsize 10M -x264-params nal-hrd=cbr -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$P/video.mp4"
  ffmpeg -y -v error -i "$P/video.mp4" -vf "select=eq(n\,195)" -frames:v 1 "$P/cover.png"
done
P=$D/게시/03-xiaohongshu-cn
ffmpeg -y -v error -i "$O/m32_cn_${V}_final.mp4" -c:v libx264 -preset slow -b:v 2900k -pass 1 -passlogfile "$O/p_cn" -an -f mp4 NUL
ffmpeg -y -v error -i "$O/m32_cn_${V}_final.mp4" -c:v libx264 -preset slow -b:v 2900k -pass 2 -passlogfile "$O/p_cn" -pix_fmt yuv420p -af "alimiter=limit=0.76:level=false:attack=1:release=60" -c:a aac -b:a 128k -ar 48000 -movflags +faststart "$P/upload_10MB.mp4"
rm -f "$O"/p_cn*
echo "마감 끝 $V"
