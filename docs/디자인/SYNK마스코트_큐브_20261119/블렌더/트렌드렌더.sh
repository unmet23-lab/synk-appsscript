#!/usr/bin/env bash
# 2027 트렌드 컬러 다섯 벌로 한 바퀴 도는 영상(180장)과 고개를 젓는 영상(150장)을 렌더해 mp4로 묶는다.
# 작업 폴더(.tmp/synk-cube-blender-20261119)에서 돌린다. 영상과 첫 장 그림은 시안 폴더의 assets에 놓는다.
#   bash <이 파일> <스크립트.py> [색 이름…]      색 이름을 주면 그 색만 한다
set -u
SCRIPT="$1"; shift
BL="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
ASSETS="../../docs/디자인/SYNK마스코트_큐브_20261119/assets"
# 이름 몸 눈 세모
SETS=("blue 26409B F4ECDD F2683C" "orange F2683C F4ECDD 26409B" "pink EE9CC0 2B2320 26409B" "green 9DA85C 2B2320 EE9CC0" "clay B98C7E F4ECDD 26409B")
for set in "${SETS[@]}"; do
  read -r NAME BODY EYE ACCENT <<< "$set"
  if [ "$#" -gt 0 ] && [[ " $* " != *" $NAME "* ]]; then continue; fi
  D="out/trend/$NAME"; mkdir -p "$D"
  "$BL" -b --factory-startup -P "$SCRIPT" -- --out "$D" --name turn --anim turn --frames 180 --res 720 --samples 128 --body "$BODY" --eye "$EYE" --accent "$ACCENT" > "$D/turn.log" 2>&1
  "$BL" -b --factory-startup -P "$SCRIPT" -- --out "$D" --name sway --anim sway --frames 150 --res 720 --samples 128 --body "$BODY" --eye "$EYE" --accent "$ACCENT" > "$D/sway.log" 2>&1
  grep -h "RENDER_DONE\|Traceback" "$D/turn.log" "$D/sway.log" | cut -c1-160
  for KIND in turn sway; do
    ffmpeg -y -loglevel error -framerate 30 -i "$D/${KIND}_%04d.png" -c:v libx264 -preset slow -crf 20 -g 15 -pix_fmt yuv420p -movflags +faststart -an "$ASSETS/tr-$NAME-$KIND.mp4"
  done
  echo "COLOR_DONE $NAME $(ls "$D" | grep -c png)"
done
echo "TREND_DONE"
