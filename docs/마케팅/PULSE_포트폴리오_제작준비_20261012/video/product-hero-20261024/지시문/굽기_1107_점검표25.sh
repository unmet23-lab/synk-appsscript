#!/usr/bin/env bash
# 11-07 슬롭 점검표 25번 고침(02_콘티 12절) — 1컷 아이스박스 처음 · 끝 그림의 위로 감기는 김을 「아래로 흘러넘치는 짙은 냉기」로 고친 판을 구독 경로로 굽는다(크레딧 0).
# 이 그림으로 드리미나 첫 · 끝 프레임 판 p1-01e를, 5컷은 같은 얼음 시작 그림에 왕관 · 물기둥 없는 지시문으로 p1-05q를 낸다(02_콘티 13절).
# 실행: bash 굽기_1107_점검표25.sh
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../../../.." && pwd)"
S="$USERPROFILE/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3/시작그림_20261105"
for pair in "c1첫_냉기:c1_첫A.png:c1_첫B.png" "c1끝_냉기:c1_끝A.png:c1_끝B.png"; do
  IFS=: read -r txt src out <<< "$pair"
  [ -f "$S/$out" ] && { echo "$out 있음"; continue; }
  echo "== $out $(date +%H:%M:%S)"
  (cd "$REPO" && timeout 900 node tools/GPT콘티굽기.mjs "$HERE/시작그림_${txt}_GPT.txt" "$S/$out" "$S/$src" --크기 1152x2048 2>&1 | tail -2)
done
