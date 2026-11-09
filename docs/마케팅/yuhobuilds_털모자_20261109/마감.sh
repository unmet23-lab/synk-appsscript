#!/usr/bin/env bash
# yuhobuilds 11-13 「벗은 모자」 마감 — 렌더는 git 밖 synk-vendor/yuhobuilds-털모자-20261109(node render.mjs --name=<판>).
# 사용: bash docs/마케팅/yuhobuilds_털모자_20261109/마감.sh <판 이름>
# 단순한 화면은 올림 기준(8Mbps) 아래로 나와 음량 마감 뒤 CBR 10M으로 다시 담는다(현장 노트 영상_ffmpeg_자막 「videoBitrate 12M으로 렌더해도…」).
set -e
V="C:/Users/q1212/Documents/synk-vendor/yuhobuilds-털모자-20261109"
D="docs/마케팅/yuhobuilds_털모자_20261109"
node tools/음량마감.mjs "$V/out/$1.mp4" "$V/out/$1_마감.mp4" --덮어쓰기
ffmpeg -v error -y -i "$V/out/$1_마감.mp4" -map 0:v -map 0:a -c:a copy -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 10M -minrate 10M -maxrate 10M -bufsize 10M -x264-params nal-hrd=cbr -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$D/최종.mp4"
ffprobe -v error -show_entries format=duration,bit_rate -of csv=p=0 "$D/최종.mp4"
