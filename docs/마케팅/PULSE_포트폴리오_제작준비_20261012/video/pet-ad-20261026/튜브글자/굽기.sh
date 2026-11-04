#!/bin/bash
# 첨벙댕 튜브 글자 낱장 셋(11-04) — 자모를 굵은 획으로 그려(튜브글꼴.py) 블렌더 천 압력으로 부풀리고(튜브글자.py) 글자마다 알파 PNG로. ㅇ은 구명 튜브. 물 판 마지막 프레임을 환경으로 비친다
#   bash 굽기.sh [샘플 수] → git 밖 최종/p11/튜브글자/l0.png · l1.png · l2.png(끝합성.py가 읽음)
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p11/튜브글자"
WATER="C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음/p11-11w.mp4"
BLENDER="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
mkdir -p "$OUT/_일"
python -X utf8 "$HERE/튜브글꼴.py" "$OUT/_일/g.json" 0.215
ffmpeg -v error -y -i "$WATER" -vf "select='eq(n\\,92)'" -frames:v 1 -update 1 "$OUT/_일/env.png"
for i in 0 1 2; do
  "$BLENDER" -b -P "$HERE/튜브글자.py" -- --glyphs "$OUT/_일/g.json" --out "$OUT/_일/l$i" --env "$OUT/_일/env.png" --frames 16 --only 16 --samples "${1:-64}" --force 10 --res 1080x820 --span 3.4 --pitch 1.09 --foil 0 --letter "$i" > "$OUT/_일/l$i.log" 2>&1 || exit 1
  cp "$OUT/_일/l$i/f0016.png" "$OUT/l$i.png"
done
ls -la "$OUT"
