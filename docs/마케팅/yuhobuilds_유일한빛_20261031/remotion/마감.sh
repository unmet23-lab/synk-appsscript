#!/bin/sh
# Y25 마감 한 번에(한 판이 모든 계정): 렌더 → 음량 마감 → CBR 10M → 10MB 아래 올리기판 → 표지. remotion 폴더에서 sh 마감.sh <판 이름 r1 …>
set -e
R=${1:?판 이름}
o=y25
npx remotion render src/index.ts main out/${o}_$R.mp4 >/dev/null 2>&1
rm -f out/${o}_마감.mp4 out/${o}_final.mp4 out/${o}_upload.mp4
node ../../../../tools/음량마감.mjs out/${o}_$R.mp4 out/${o}_마감.mp4 | head -1
ffmpeg -y -v error -i out/${o}_마감.mp4 -map 0:v -map 0:a -c:a aac -b:a 384k -ar 48000 -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 10M -minrate 10M -maxrate 10M -bufsize 10M -x264-params nal-hrd=cbr -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart out/${o}_final.mp4
node scripts/upload.mjs out/${o}_final.mp4 out/${o}_upload.mp4
npx remotion still src/index.ts cover out/cover.png >/dev/null 2>&1
