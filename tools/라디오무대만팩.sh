#!/usr/bin/env bash
# 라디오24 «무대만 팩» 굽기 (2026-09-07 · 인계문 §4-ⓒ)
#
# ■ 무엇을 하나
#   옛 팩(마스코트가 그림으로 박힌 곡 파일)에서 «소리»만 뽑아, 마스코트 없는 무대 위에 얹어 새 팩을 만든다.
#   그래야 마스코트가 방송 층(bots/오버레이/마스코트.html)에서 따로 움직인다 — 결(장르)마다 DJ 가 서고, 인사에 고개를 숙인다.
#   무대 = 시티팝·전자는 Veo 영상(8초 반복) · 차분은 정지 그림.
#   🔴 09-07 저녁 «판정 철회» — 전자(house) 영상을 「카메라가 밀려 들어가 8초마다 튄다」고 적고 정지 그림으로 돌렸으나,
#      다시 재보니 카메라는 고정이다. 자 셋: ① 첫↔끝 psnr 38.75dB(거의 같다) ② 첫 프레임을 2% 키워 견주면 18.58dB 로
#      «떨어진다»(확대가 있었다면 올라야 한다) ③ 첫↔끝 차분 그림에 건물 윤곽선 0, 첫↔중간에는 창문 네모만 뜬다.
#      ⇒ 유호 지시 09-06 「창문에 있는 불이 깜빡거려야지」 그대로 구워진 판이다. 다시 구울 돈 0원.
#   덮개(docs/라디오/무대덮개/<장르>.png · 공기 비네팅 + 「synk · ORIGINAL SOUND」 각인)를 무대 위에 얹는다 —
#   옛 팩에는 무대 굽기(라디오배경굽기.js)가 그려 넣었던 것이라 빠지면 방송 결이 달라진다.
#   무대 자리(확대·위치)는 라디오배경굽기.js 장르표의 무대자리를 그대로: house·citypop 106% 44%/40% · calm 118% 44%/26%.
#   🔑 정지 그림은 «한 번만» 줄여 판을 만들어 두고 반복한다 — 원본(5,504px)을 매 프레임 다시 읽으면 한 곡에 8분이 걸린다(09-07 실측).
#
# ■ 규격 = 옛 팩과 같게 1280x720 · 30fps · h264 · 소리는 복사(aac 그대로) · mpegts. 송출(겹쳐송출.js)이 다시 인코딩하므로 화질은 아낀다(crf 23 · 상한 1.5Mbps).
#
# ■ 쓰기
#   1) 서버에서 소리 뽑기(가벼운 복사 · CPU 최저 우선순위):
#        ssh synk@34.71.111.97 'mkdir -p /tmp/오디오 && for f in /opt/synk-radio/팩/*.ts; do b=$(basename "${f%.ts}"); nice -n 19 ffmpeg -y -loglevel error -i "$f" -vn -c:a copy /tmp/오디오/$b.aac; done'
#        scp 'synk@34.71.111.97:/tmp/오디오/*.aac' <오디오폴더>/
#   2) 덮개 굽기(0원): node tools/라디오배경굽기.js --장르 house --무대덮개  (citypop · calm 도)
#   3) 이 스크립트:  bash tools/라디오무대만팩.sh <오디오폴더> <낼폴더>
#   4) 낼폴더에 playlist.txt · playlist.원래.txt · 재생목록.json 을 옛 팩에서 복사해 넣고 서버 /opt/synk-radio/팩_무대만/ 로 올린 뒤
#      mv 팩 팩_옛_마스코트박힘 && mv 팩_무대만 팩 && fuser -k -n tcp 8790   (송출이 5초 뒤 되살아난다 · sudo 불필요)
#   되돌리기: mv 팩 팩_무대만 && mv 팩_옛_마스코트박힘 팩 && 겹쳐송출에 --층 전광판 (기본값이 마스코트,전광판 으로 뒤집혔다)
set -u
IN="${1:?오디오 폴더}"
OUT="${2:?낼 폴더}"
R="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$OUT" "$OUT/_판"
ok=0; bad=0

# 정지 그림 판 — 장르마다 한 번만(무대 + 덮개를 1280x720 으로)
판만들기() {  # $1 장르 · $2 scale · $3 crop
  local g="$1" cover="$R/docs/라디오/무대덮개/$1.png" out="$OUT/_판/$1.png"
  [ -f "$out" ] && return 0
  ffmpeg -y -loglevel error -i "$R/docs/라디오/무대/$g.png" -i "$cover" \
    -filter_complex "[0:v]scale=$2:flags=lanczos,crop=$3[s];[s][1:v]overlay=0:0:format=auto,format=rgb24[v]" -map "[v]" -frames:v 1 "$out"
}

for a in "$IN"/*.aac; do
  n=$(basename "${a%.aac}")
  genre=$(echo "$n" | sed -E 's/^synk-radio-[0-9]+-([a-z_]+)-air$/\1/')
  out="$OUT/$n.ts"
  cover="$R/docs/라디오/무대덮개/$genre.png"
  [ -f "$cover" ] || { echo "🔴 $n — 덮개가 없다: $cover (node tools/라디오배경굽기.js --장르 $genre --무대덮개)"; bad=$((bad+1)); continue; }
  t0=$(date +%s)
  case "$genre" in
    citypop|house)   # Veo 영상 반복 — 끝 장면 = 첫 장면이라 이음매가 없다(둘 다 09-07 실측 · 위 «판정 철회» 참고)
      ffmpeg -y -loglevel error -stream_loop -1 -i "$R/docs/라디오/무대영상/$genre.mp4" -i "$a" -i "$cover" \
        -filter_complex "[0:v]scale=1357:-2:flags=lanczos,crop=1280:720:34:17[s];[s][2:v]overlay=0:0:format=auto,format=yuv420p[v]" \
        -map "[v]" -map 1:a -shortest \
        -c:v libx264 -preset veryfast -crf 23 -maxrate 1500k -bufsize 3000k -r 30 -g 60 -c:a copy -f mpegts "$out" ;;
    calm)      # 정지 그림 — 118% 로 키워 아래 나무 탁자를 잘라 낸다(장르표 그대로)
      판만들기 calm 1510:-2 1280:720:101:32 && \
      ffmpeg -y -loglevel error -loop 1 -framerate 30 -i "$OUT/_판/calm.png" -i "$a" -map 0:v -map 1:a -shortest -pix_fmt yuv420p \
        -c:v libx264 -tune stillimage -preset veryfast -crf 23 -maxrate 1500k -bufsize 3000k -r 30 -g 60 -c:a copy -f mpegts "$out" ;;
    *)         # 그 밖 — 정지 그림(무대 영상이 아직 없다)
      판만들기 "$genre" 1357:-2 1280:720:34:17 && \
      ffmpeg -y -loglevel error -loop 1 -framerate 30 -i "$OUT/_판/$genre.png" -i "$a" -map 0:v -map 1:a -shortest -pix_fmt yuv420p \
        -c:v libx264 -tune stillimage -preset veryfast -crf 23 -maxrate 1500k -bufsize 3000k -r 30 -g 60 -c:a copy -f mpegts "$out" ;;
  esac
  rc=$?
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out" 2>/dev/null)
  sz=$(stat -c %s "$out" 2>/dev/null)
  if [ $rc -eq 0 ] && [ -n "$sz" ]; then ok=$((ok+1)); echo "✅ $n ($genre) ${d}s $((sz/1024/1024))MB $(( $(date +%s)-t0 ))초"; else bad=$((bad+1)); echo "🔴 $n 실패 rc=$rc"; fi
done
echo "합계 성공 $ok 실패 $bad → $OUT"
