#!/usr/bin/env bash
# 재료 옮기기 — 앞 세 편의 실제 결과를 영상용 사본(public/img, git 밖)으로 가져온다. remotion 폴더에서: bash scripts/재료.sh
# 옛날 사진의 움직이는 결과(V2_한줄.mp4)는 Drive 원본 창고에 있다. 되살린 뒤 public/img/photo_after.mp4로 둔다
#   (원본 창고 공간지킴이 「되살리기」 — docs/마케팅/synkbrief_옛사진복원_20261030/그림/Drive로_옮긴_파일.txt).
set -e
M=../..
cp "$M/synkbrief_빈방채우기_20261027/시안/전_빈방.jpg" public/img/room_before.jpg
cp "$M/synkbrief_빈방채우기_20261027/시안/후_채워진방.jpg" public/img/room_after.jpg
ffmpeg -v error -y -i "$M/synkbrief_메뉴판정리_20261030/그림/전_메뉴판.png" -q:v 2 public/img/menu_before.jpg
# 새 메뉴판은 나눌 자료 2번 요청문 그대로의 결과(그 편 기획 A2 · 후_조건셋.png)다. 후_결과.png(A3)는 꾸밈 한 줄과 고침 한 번이 더 들어간 판이라 쓰지 않는다
ffmpeg -v error -y -i "$M/synkbrief_메뉴판정리_20261030/그림/후_조건셋.png" -q:v 2 public/img/menu_after.jpg
ffmpeg -v error -y -i "$M/synkbrief_옛사진복원_20261030/그림/전_옛사진.png" -q:v 2 public/img/photo_before.jpg
# 움직이는 결과: 되살린 원본(public/img/V2_한줄_원본.mp4 · 10초 · 720×1280)에서 요청문과 맞는 구간만 쓴다 — 4.7초부터 4초(입 다문 옅은 웃음 · 8.21~8.42초 눈 깜빡임 한 번).
#   앞 1.5~4초는 이가 보이는 큰 웃음, 8.6초 뒤는 고개가 기울며 다시 크게 웃어 쓰지 않는다. 소리 없이 장마다 열쇠 장으로 다시 담는다(렌더가 장을 빨리 꺼내게)
if [ -f public/img/V2_한줄_원본.mp4 ]; then
  ffmpeg -v error -y -ss 4.7 -i public/img/V2_한줄_원본.mp4 -t 4 -an -c:v libx264 -crf 12 -preset slow -g 1 -pix_fmt yuv420p -vf "scale=out_color_matrix=bt709" -colorspace bt709 -color_primaries bt709 -color_trc bt709 public/img/photo_after.mp4
fi
# 효과음(앞 편과 같은 보유 효과음)
for f in pop swish thud tick tok earn snap; do cp "$M/synkbrief_메뉴판정리_20261030/remotion/public/sfx/$f.wav" public/sfx/ 2>/dev/null || true; done
# 배경음: 보유곡 시티팝_147의 27초부터(곡 안 빈 마디 26.25~27초 뒤) 26초 — 끝 0.9초는 Film.tsx 볼륨으로 닫는다
ffmpeg -v error -y -ss 27.0 -t 26 -i "$M/../홍보물/BGM/시티팝_147.wav" -c:a pcm_s16le -ar 48000 public/bgm.wav
ls -la public/img public/sfx public/bgm.wav
