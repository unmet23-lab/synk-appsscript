#!/usr/bin/env bash
# 본편 만들기(굽고 나서): bash 본편.sh — 렌더 → 배경음 → 음량 마감 → 올림용·신청 페이지용. 출력은 out/final/(git 밖).
#   목소리를 다시 구웠으면 먼저 node 음성시각.mjs --폴더 범수.
#   렌더 값은 LAB 편들과 같다(12M · x264 slow · bt709). 단순한 판이라 12M을 다 안 쓰므로 올림용은 CBR 10M으로 다시 담는다
#   (현장노트 영상·소리 「videoBitrate 12M으로 렌더해도 … 8Mbps에 걸린다」).
#   배경음은 06 견본과 같은 비율 — 보유 곡 「따뜻_118」 0.086(목소리보다 약 20dB 아래), 처음 1.2초 페이드 인 · 끝 1.5초 페이드 아웃(유호님 10-23 「배경음 깐 판」).
set -euo pipefail
cd "$(dirname "$0")"
# out/final에는 완성본 넷(master·upload·web·phone)만 둔다 — 원본창고 보존 규칙이 경로의 「final」 표시를 금고(두 군데 영구)로 본다.
# 목소리만 렌더한 판·배경음 믹스는 다시 만들 수 있는 중간 파일이라 out/work에 둔다.
OUT=out/final
WORK=out/work
mkdir -p "$OUT" "$WORK"
PROPS='{"shot":"shots/world-homework.png"}'

echo "== 렌더(목소리만)"
npx remotion render src/index.ts lesson "$WORK/lesson-voice.mp4" --codec=h264 --video-bitrate=12M --x264-preset=slow --color-space=bt709 --props="$PROPS" --log=error

echo "== 배경음"
D=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$WORK/lesson-voice.mp4")
FO=$(node -e "console.log((Number(process.argv[1]) - 1.5).toFixed(2))" "$D")
ffmpeg -v error -y -i "$WORK/lesson-voice.mp4" -stream_loop -1 -i public/music/warm-118.wav \
  -filter_complex "[1:a]atrim=0:$D,asetpts=N/SR/TB,volume=0.086,afade=t=in:st=0:d=1.2,afade=t=out:st=$FO:d=1.5[b];[0:a][b]amix=inputs=2:duration=first:normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a pcm_f32le "$WORK/lesson-mix.mov"

echo "== 음량 마감(−14.5 LUFS) + 휴대폰 판"
node ../../../../tools/음량마감.mjs "$WORK/lesson-mix.mov" "$OUT/lesson-master.mp4" --휴대폰 "$OUT/lesson-phone.mp4" --덮어쓰기

echo "== 올림용(CBR 10M, bt709 그대로)"
ffmpeg -v error -y -i "$OUT/lesson-master.mp4" -map 0:v -map 0:a -c:a copy -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p \
  -b:v 10M -minrate 10M -maxrate 10M -bufsize 10M -x264-params nal-hrd=cbr \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$OUT/lesson-upload.mp4"

echo "== 신청 페이지용(1080p, 50MB 안쪽)"
# AAC 384k → 128k로 다시 담으면 봉우리가 솟는다(10-28 −1.3 → 0.0 dBFS, 꽉 찬 표본 3) — 담기 직전에 봉우리만 누른다
# (현장노트 영상·소리 「이미 AAC인 소리를 다시 AAC로 뽑으면 순간 최대가 올라간다」).
ffmpeg -v error -y -i "$OUT/lesson-master.mp4" -map 0:v -map 0:a -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -crf 23 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -af "alimiter=limit=0.76:level=false:attack=1:release=60" -c:a aac -b:a 128k -movflags +faststart "$OUT/lesson-web.mp4"

ls -la "$OUT"
for f in lesson-upload.mp4 lesson-web.mp4 lesson-phone.mp4; do
  printf '%s  ' "$f"; ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate,width,height -of csv=p=0 "$OUT/$f"
done
echo DONE
