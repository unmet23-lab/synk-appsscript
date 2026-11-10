#!/bin/bash
# LAB M40 「네. 마침표」 마감 — 렌더 → 음량 마감 → CBR 10M 올림본(게시/0x/video.mp4) → 10MB 판 · 표지(세 판).
# 워크트리(저장소) 뿌리에서: bash docs/마케팅/LAB_네마침표_mn_20261110/소리/마감.sh <판 이름 접미사, 예: v6>
set -e
V=${1:-v6}
D=docs/마케팅/LAB_네마침표_mn_20261110
O=$D/remotion/out
cbr() {
  ffmpeg -y -v error -i "$1" -map 0:v -map 0:a -c:a copy -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 10M -minrate 10M -maxrate 10M -bufsize 10M -x264-params nal-hrd=cbr -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$2"
}
small() {
  ffmpeg -y -v error -i "$1" -c:v libx264 -preset slow -b:v 2300k -pass 1 -passlogfile "$O/p_$3" -an -f mp4 NUL
  ffmpeg -y -v error -i "$1" -c:v libx264 -preset slow -b:v 2300k -pass 2 -passlogfile "$O/p_$3" -pix_fmt yuv420p -af "alimiter=limit=0.76:level=false:attack=1:release=60" -c:a aac -b:a 128k -ar 48000 -movflags +faststart "$2"
  rm -f "$O"/p_$3*
}
mkdir -p "$D/게시/01-ig-fb-mn" "$D/게시/03-xiaohongshu-cn" "$D/게시/04-tiktok-mm"
for L in mn cn mm; do node tools/음량마감.mjs "$O/m40_${L}_$V.mp4" "$O/m40_${L}_${V}_final.mp4" --덮어쓰기; done
cbr "$O/m40_mn_${V}_final.mp4" "$D/게시/01-ig-fb-mn/video.mp4"
cbr "$O/m40_cn_${V}_final.mp4" "$D/게시/03-xiaohongshu-cn/video.mp4"
cbr "$O/m40_mm_${V}_final.mp4" "$D/게시/04-tiktok-mm/video.mp4"
small "$O/m40_mn_${V}_final.mp4" "$D/게시/01-ig-fb-mn/upload_10MB.mp4" mn
small "$O/m40_cn_${V}_final.mp4" "$D/게시/03-xiaohongshu-cn/upload_10MB.mp4" cn
# 표지 — 3.3초(마침표 공이 침대에 떨어지고 지우가 굳은 장면 + 「혹시… 화났어?」)
for P in 01-ig-fb-mn 03-xiaohongshu-cn 04-tiktok-mm; do ffmpeg -y -v error -i "$D/게시/$P/video.mp4" -vf "select=eq(n\,99)" -frames:v 1 "$D/게시/$P/cover.png"; done
echo "마감 끝 $V"
