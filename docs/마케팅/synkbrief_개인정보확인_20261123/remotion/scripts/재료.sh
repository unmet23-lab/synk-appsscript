#!/usr/bin/env bash
# 소리 재료 옮기기 — remotion 폴더에서: bash scripts/재료.sh   (그림은 python -I -X utf8 scripts/재료.py, 편 폴더에서)
set -e
M=../..
mkdir -p public/vo public/sfx
# 목소리(범수) — 음성/범수의 줄 파일 사본
cp ../음성/범수/*.wav public/vo/
# 효과음(앞 편과 같은 보유 효과음)
for f in pop swish thud tick tok; do cp "$M/synkbrief_메뉴판정리_20261030/remotion/public/sfx/$f.wav" public/sfx/; done
# 배경음: 보유곡 퀴즈120_테크팝의 39초부터 29초(곡 안 빈 마디 37.25~38.75초 · 67.25~68.75초 사이라 들지 않는다)
ffmpeg -v error -y -ss 39.0 -t 29 -i "$M/../홍보물/BGM/퀴즈120_테크팝_f4f3682d.wav" -c:a pcm_s16le -ar 48000 public/bgm.wav
ls public/vo public/sfx public/bgm.wav
