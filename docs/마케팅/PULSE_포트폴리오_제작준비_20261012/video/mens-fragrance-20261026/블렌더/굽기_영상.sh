#!/usr/bin/env bash
# 2번 블렌더 컷을 프레임으로 굽는다(2026-11-03, 크레딧 0). 02_콘티 2절 시각을 24fps로 옮긴 프레임 수(2번 10 · 3번 17 · 17번 24 · 18번 100).
# --t는 그 컷 안의 진행(원본 카메라 곡선을 그대로 따라감) — 이미 구운 프레임은 건너뛰니 멈춰도 다시 돌리면 이어진다.
#   bash 굽기_영상.sh [컷…] → Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p2/렌더/영상/<컷>/NNNN.png
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
OUT="$USERPROFILE/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p2/렌더/영상"
cd "$(dirname "$0")"
declare -A N=([s02]=10 [s03]=17 [s17]=24 [s18]=100)
for sh in ${@:-s02 s03 s17 s18}; do
  n=${N[$sh]}
  mkdir -p "$OUT/$sh"
  for ((i=0;i<n;i++)); do
    f=$(printf "%s/%s/%04d.png" "$OUT" "$sh" "$i")
    [ -f "$f" ] && continue
    t=$(python3 -c "print(round($i/($n-1),5))")
    "$B" -b --python 솔서리병.py -- --shot "$sh" --t "$t" --samples 64 --res 1920x1080 --out "$f" 2>&1 | grep -E "저장|Traceback|Error:" | cut -c1-160
  done
done
