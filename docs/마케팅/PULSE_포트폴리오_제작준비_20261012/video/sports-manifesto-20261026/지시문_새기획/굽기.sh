#!/usr/bin/env bash
# 5번 새 기획 이미지 콘티 — 작업.json의 컷을 차례로 GPT콘티굽기로 굽는다(이미 있으면 건너뜀). 참고 그림 경로는 콘티/p5n 기준.
# 실행: bash 굽기.sh [컷 이름…]   (주지 않으면 전부)
HERE="$(cd "$(dirname "$0")" && pwd)"
HW="$(cygpath -w "$HERE")"
REPO="$(cd "$HERE/../../../../../.." && pwd)"
V="$USERPROFILE/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n"
names=("$@")
[ ${#names[@]} -eq 0 ] && names=($(python -I -X utf8 -c "import json;print(' '.join(a['컷'] for a in json.load(open(r'$HW\작업.json',encoding='utf-8'))))"))
for n in "${names[@]}"; do
  out="$V/정지컷/$n.png"
  [ -f "$out" ] && { echo "$n 있음"; continue; }
  refs=$(python -I -X utf8 -c "import json;a=[x for x in json.load(open(r'$HW\작업.json',encoding='utf-8')) if x['컷']=='$n'][0];print(' '.join(a['refs']))")
  args=(); for r in $refs; do args+=("$V/$r"); done
  [ ${#args[@]} -lt 3 ] && { echo "$n 참고 그림을 못 읽음 — 멈춤"; exit 2; }
  (cd "$REPO" && timeout 900 node tools/GPT콘티굽기.mjs "$HERE/$n.txt" "$out" "${args[@]}" --크기 1152x2048 2>&1 | tail -1)
done
