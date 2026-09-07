#!/usr/bin/env bash
# 라디오 곡 팩을 «방송을 안 끊고» 갈아 끼운다 (2026-09-08).
#
# ■ 어디서 도나
#   **서버에서** 돈다. 올리는 것은 tools/라디오팩올리기.sh 가 하고(스테이징 = /home/synk/팩),
#   이 스크립트가 그것을 방송 폴더(/opt/synk-radio/팩)로 옮긴다.
#     scp -i ~/.ssh/synk_radio tools/라디오팩갈기.sh synk@34.71.111.97:/tmp/
#     ssh -i ~/.ssh/synk_radio synk@34.71.111.97 'bash /tmp/라디오팩갈기.sh <옛판폴더> <파일이름들…>'
#
# ■ 왜 안 끊기나
#   스테이징과 방송 폴더가 «같은 디스크»라 mv 는 이름 바꾸기다(원자적 · 반쯤 쓰인 파일이 안 생긴다).
#   지금 재생 중인 파일은 ffmpeg 이 이미 연 inode 로 계속 읽히고, 다음 바퀴부터 새 판이 나간다.
#   ⇒ 송출을 되살릴 까닭이 없다. (되살려야 하는 것은 재생목록·코드·.env 가 바뀐 때다.)
#
# ■ 지키는 것
#   30MB 아래는 «잘린 것»으로 보고 안 옮긴다(09-06 에 끊긴 업로드가 반쪽 파일을 남긴 적이 있다).
#   옛 판은 지우지 않고 <옛판폴더>에 남긴다 — 되돌리기는 반대로 mv.
set -u
old_dir="$1"; shift
cd /opt/synk-radio || exit 1
mkdir -p "$old_dir"
for f in "$@"; do
  new="/home/synk/팩/$f"
  if [ ! -f "$new" ]; then echo "🔴 $f — 스테이징에 없다"; continue; fi
  sz=$(stat -c%s "$new")
  if [ "$sz" -lt 30000000 ]; then echo "🔴 $f — 스테이징 파일이 작다($sz) · 잘린 것"; continue; fi
  [ -f "팩/$f" ] && mv -f "팩/$f" "$old_dir/$f"
  mv -f "$new" "팩/$f" && echo "✅ $f 갈아 끼움 · $(stat -c%s "팩/$f") 바이트"
done
echo "--- 옛 판($old_dir)"; ls "$old_dir/"
