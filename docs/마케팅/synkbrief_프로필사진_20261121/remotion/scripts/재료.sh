#!/usr/bin/env bash
# 소리 재료 옮기기 — remotion 폴더에서: bash scripts/재료.sh   (그림은 scripts/재료.py)
set -e
M=../..
# 목소리(범수) — 음성/범수의 줄 파일 사본
cp ../음성/범수/*.wav public/vo/
# 효과음(앞 편과 같은 보유 효과음)
for f in pop swish thud tick tok; do cp "$M/synkbrief_메뉴판정리_20261030/remotion/public/sfx/$f.wav" public/sfx/; done
# 배경음: 보유곡 시티팝_147의 30초부터 30초(곡 안 빈 마디는 26.25~27초 · 104초~라 들지 않는다)
ffmpeg -v error -y -ss 30.0 -t 30 -i "$M/../홍보물/BGM/시티팝_147.wav" -c:a pcm_s16le -ar 48000 public/bgm.wav
ls public/vo public/sfx public/bgm.wav
