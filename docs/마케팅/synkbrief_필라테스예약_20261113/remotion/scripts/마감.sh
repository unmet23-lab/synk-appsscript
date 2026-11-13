#!/usr/bin/env bash
# B44 마감(B39 판을 옮김): 렌더(섞은 소리) → 통합 −14.5 LUFS · 봉우리 −1.5 dBFS로 맞춘 master.wav → 그 한 줄만 깔아 다시 렌더(PCM에서 바로 AAC 384k).
# 11-13 B47: 조용한 끝 칸 때문에 AAC가 317kbps에 멈춰(기준 320) 두 렌더에 --audio-bitrate 384k(틀 파일 remotion.config.ts는 고치지 않는다)
# 11-14 v0.7: 새 V8 대사 봉우리로 0.84(−1.5 dBFS 목표)가 참피크 −1.1에 걸려(공용 기준 −1.2) 0.8로
#   bash scripts/마감.sh <판 이름> <마스터.mp4>      (remotion 폴더에서)
set -e
N=$1; OUT=$2
rm -f public/master.wav
npx remotion render src/index.ts b47 out/${N}_raw.mp4 --concurrency 6 --audio-bitrate 384k 2>&1 | tail -1
meas(){ ffmpeg -hide_banner -nostats -i "$1" -vn -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | grep -E "^ +I:" | tail -1 | awk '{print $2}'; }
I=$(meas out/${N}_raw.mp4); G=$(python -c "print(round(-14.5-($I),2))")
ffmpeg -v error -y -i out/${N}_raw.mp4 -vn -af "volume=${G}dB,alimiter=limit=0.8:level=false:attack=1:release=60" -ar 48000 -c:a pcm_s24le public/master.wav
I2=$(meas public/master.wav); G2=$(python -c "print(round($G+(-14.5-($I2)),2))")
ffmpeg -v error -y -i out/${N}_raw.mp4 -vn -af "volume=${G2}dB,alimiter=limit=0.8:level=false:attack=1:release=60" -ar 48000 -c:a pcm_s24le public/master.wav
REMOTION_MASTER=1 npx remotion render src/index.ts b47 out/${N}_m.mp4 --concurrency 6 --audio-bitrate 384k 2>&1 | tail -1
ffmpeg -v error -y -i out/${N}_raw.mp4 -i out/${N}_m.mp4 -map 0:v -map 1:a -c copy -movflags +faststart "$OUT"
rm -f public/master.wav
ffprobe -v error -select_streams a:0 -show_entries stream=bit_rate -of csv=p=0 "$OUT"
ffmpeg -hide_banner -nostats -i "$OUT" -vn -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | grep -E "^ +(I|Peak):" | tail -2
