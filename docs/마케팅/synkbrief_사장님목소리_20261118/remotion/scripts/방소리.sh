#!/usr/bin/env bash
# 방 소리(B49 판을 옮김 · B53은 48초 — 61초 판은 11.7MB라 저장 용량 한도 10MB에 걸렸다)(넓은 대역 · 씨앗 고정) — public/sfx/room.wav(git 밖)를 다시 만든다. remotion 폴더에서 돌린다.
mkdir -p public/sfx
ffmpeg -v error -y -f lavfi -i "anoisesrc=color=pink:duration=48:sample_rate=48000:seed=53" -f lavfi -i "anoisesrc=color=white:duration=48:sample_rate=48000:seed=7" -filter_complex "[0]highpass=f=150,volume=0.5[a];[1]highpass=f=3000,lowpass=f=16000,volume=0.12[b];[a][b]amix=2:normalize=0,aformat=channel_layouts=stereo,stereotools=slev=1.6" public/sfx/room.wav
