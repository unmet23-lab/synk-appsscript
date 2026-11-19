#!/usr/bin/env bash
# 한 스크립트로 좌우로 도는 아홉 장과 구, 크림 색 한 장씩을 640 픽셀로 렌더한다. 작업 폴더(.tmp/synk-cube-blender-20261119)에서 돌린다.
#   bash <이 파일> <스크립트.py> <이름 머리>      예: bash 묶음렌더.sh scripts/felt_cube_gpt_r2.py gpt
set -u
SCRIPT="$1"; TAG="$2"
BL="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
mkdir -p "out/$TAG"
one() { # 이름 인자…
  local name="$1"; shift
  "$BL" -b --factory-startup -P "$SCRIPT" -- --out "out/$TAG" --name "$name" --res 640 --samples 96 "$@" > "out/$TAG/$name.log" 2>&1
  grep -h "RENDER_DONE\|Error\|Traceback" "out/$TAG/$name.log" | cut -c1-200
}
i=0
for yaw in -32 -24 -16 -8 0 8 16 24 32; do
  one "turn_$i" --yaw "$yaw"; i=$((i+1))
done
one sphere --morph 1
one half --morph 0.5
one cream --body EDE4D3 --eye 2B2320
echo "SET_DONE $TAG"
