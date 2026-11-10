#!/bin/bash
# LAB E34 「리나 둘」 마감 — 렌더 → 음량 마감 → CBR 10M 올림본(게시/01-youtube-en/video.mp4) → 10MB 판 · 표지.
# 워크트리(저장소) 뿌리에서: bash docs/마케팅/LAB_리나둘_20261110/소리/마감.sh <판 이름 접미사, 예: v6>
set -e
V=${1:-v6}
D=docs/마케팅/LAB_리나둘_20261110
O=$D/remotion/out
P=$D/게시/01-youtube-en
mkdir -p "$P"
node tools/음량마감.mjs "$O/e34_$V.mp4" "$O/e34_${V}_final.mp4" --덮어쓰기
ffmpeg -y -v error -i "$O/e34_${V}_final.mp4" -map 0:v -map 0:a -c:a copy -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 10M -minrate 10M -maxrate 10M -bufsize 10M -x264-params nal-hrd=cbr -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$P/video.mp4"
ffmpeg -y -v error -i "$O/e34_${V}_final.mp4" -c:v libx264 -preset slow -b:v 2300k -pass 1 -passlogfile "$O/p_en" -an -f mp4 NUL
ffmpeg -y -v error -i "$O/e34_${V}_final.mp4" -c:v libx264 -preset slow -b:v 2300k -pass 2 -passlogfile "$O/p_en" -pix_fmt yuv420p -af "alimiter=limit=0.76:level=false:attack=1:release=60" -c:a aac -b:a 128k -ar 48000 -movflags +faststart "$P/upload_10MB.mp4"
rm -f "$O"/p_en*
# 표지 — 4.7초(같은 「리나」 컵을 양쪽에서 잡고 몽글이 끼인 장면 + Rina → 리나 · Lina → 리나)
ffmpeg -y -v error -i "$P/video.mp4" -vf "select=eq(n\,141)" -frames:v 1 "$P/cover.png"
echo "마감 끝 $V"
