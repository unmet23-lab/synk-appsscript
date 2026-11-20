#!/usr/bin/env bash
# 재료 옮기기 — 실제로 받은 결과를 영상용 사본(public/img, git 밖)으로 가져온다. remotion 폴더에서: bash scripts/재료.sh
# 모든 사진 · 영상은 원래 사진(941×1672)과 같은 짜임이다 — 제미나이는 보낸 사진을 같은 자리 그대로 키워 돌려줬다(기획.md 「만들기」).
#   원래 사진: ../../synkbrief_옛사진복원_20261030/그림/전_옛사진.png(AI로 만든 예시 인물)
#   깨끗하게: 같은 폴더 후1_깨끗하게만.jpg(10-30 제미나이 앱 「이 사진 깨끗하게 복원해 줘」)
#   V1_대충_원본.mp4는 Drive 원본 창고에서 한 번 받아 둔 것(sha256은 기획.md). M2_원본.mp4 · M3_원본.mp4는 11-20 실험 1 · 4(../그림/실험1_M2_입다문채.mp4 · 실험4_M3_깨끗한사진_입다문채.mp4와 같은 파일)
set -e
M=../..
cp "$M/synkbrief_옛사진복원_20261030/그림/전_옛사진.png" public/img/orig.png
cp "$M/synkbrief_옛사진복원_20261030/그림/후1_깨끗하게만.jpg" public/img/restored.jpg
enc(){ ffmpeg -v error -y -ss "$2" -i "$1" -t "$3" -an -c:v libx264 -crf 12 -preset slow -g 1 -pix_fmt yuv420p -vf "scale=out_color_matrix=bt709" -colorspace bt709 -color_primaries bt709 -color_trc bt709 "$4"; }
# 「살아 움직이게 해 줘」(V1): 0초부터(사진 그대로 → 스스로 다가가며 말하기 시작) · 큰 판에서 이어 보는 말하는 구간
enc public/img/V1_대충_원본.mp4 0.0 2.6 public/img/v1.mp4
enc public/img/V1_대충_원본.mp4 2.35 2.3 public/img/v1_talk.mp4
# 「입은 다문 채」(M2): 10초 내내 이가 보이지 않는다(12fps 120장 확인 — 기획.md 「실험 1」). 앞에서부터 차례로 나눠 쓴다(끝 판만 0.25초 겹침)
enc public/img/M2_원본.mp4 0.0 2.6 public/img/m1_a.mp4
enc public/img/M2_원본.mp4 2.5 2.5 public/img/m1_p.mp4
# 나란히 칸의 왼쪽: 「살아 움직이게 해 줘」(V1)의 이어지는 구간(손짓 · 얼굴이 둥글어지기 시작)
enc public/img/V1_대충_원본.mp4 4.6 2.5 public/img/v1_pair.mp4
# 끝 판: 덧붙인 실험 4(M3 — 1단계에서 받은 깨끗한 사진 + 같은 「입은 다문 채」 요청문). 10초 내내 이가 보이지 않는다. 눈을 오래 감는 1.0~1.6초는 빼고 4.6초부터
enc public/img/M3_원본.mp4 4.6 5.15 public/img/m1_c.mp4
# 효과음(앞 편과 같은 보유 효과음)
for f in pop swish thud tick tok earn snap; do cp "$M/synkbrief_메뉴판정리_20261030/remotion/public/sfx/$f.wav" public/sfx/ 2>/dev/null || true; done
# 배경음: 보유곡 따뜻_118의 20초부터 30초(곡 안 빈 마디는 62.25초부터라 들지 않는다)
ffmpeg -v error -y -ss 20.0 -t 30 -i "$M/../홍보물/BGM/따뜻_118.wav" -c:a pcm_s16le -ar 48000 public/bgm.wav
ls -la public/img public/sfx public/bgm.wav
