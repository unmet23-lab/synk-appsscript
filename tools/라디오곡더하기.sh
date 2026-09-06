#!/usr/bin/env bash
# 새 곡을 방송에 «더한다» — 굽기 완료 대기 → 인코딩 → 올리기 → 재생목록 → 송출 다시 켜기.
#
# 🔑 왜 «더하기»인가: 이미 올라간 팩은 그대로 두고 새 결만 보탠다(talk README 「늘리는 것은 목록에
#   파일만 더한다」). 350MB 를 다시 올리지 않는다.
#
# 🔴 화면은 곡 결마다 바뀐다(유호 확정 09-06 「화면은 장르(캐릭터) 마다 바뀌어야해」).
#   인코딩.sh 가 곡 이름 꼬리 `-<결>-air` 를 읽어 `<배경폴더>/<결>.png` 를 고르므로,
#   배경을 «폴더»로 준다. 한 장으로 고정하지 않는다.
#
# 쓰는 법: bash tools/라디오곡더하기.sh <곡폴더> <팩폴더>
# ⚠ 변수명이 영어인 까닭: bash 는 비ASCII 식별자를 못 받는다.
set -uo pipefail

SRC=${1:?곡 폴더를 달라}
OUT=${2:?팩 폴더를 달라}
BG="$HOME/Documents/SYNK-appsscript/docs/라디오/배경"
KEY="$HOME/.ssh/synk_radio"
HOST="synk@34.71.111.97"
SSHOPT=(-i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=15)
WANT=${3:-4}

echo "[더하기] ① 곡이 ${WANT}벌 될 때까지 기다린다"
for i in $(seq 1 180); do
  n=$(ls "$SRC"/*.mp3 2>/dev/null | wc -l)
  [ "$n" -ge "$WANT" ] && { echo "[더하기] 곡 ${n}벌 나왔다"; break; }
  # 굽기가 죽었으면 나온 만큼으로 간다
  # 🔴 `pgrep -f` 는 Git Bash 에서 **윈도우 프로세스를 못 본다**(09-06 실측 — 도는 굽기를
  #   「끝났다」로 읽고 즉시 죽었다). 윈도우 쪽은 PowerShell 로 물어야 한다.
  alive=$(powershell -NoProfile -Command "if (Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match '라디오곡생산' }) { 'Y' } else { 'N' }" 2>/dev/null | tr -d '\r\n ')
  if [ "$alive" = "N" ]; then
    [ "$n" -gt 0 ] && { echo "[더하기] 굽기가 끝났다 — 나온 ${n}벌로 간다"; break; }
    echo "[더하기] 🔴 굽기가 끝났는데 곡이 0벌이다"; exit 1
  fi
  [ $((i % 6)) -eq 1 ] && echo "[더하기] 기다리는 중… ${n}/${WANT}벌"
  sleep 10
done

echo "[더하기] ② 배경을 입혀 방송 규격으로 굽는다(배경은 «폴더» — 결마다 다른 무대가 붙는다)"
mkdir -p "$OUT"
bash "$HOME/Documents/SYNK-talk/bots/송출/인코딩.sh" "$SRC" "$OUT" "$BG" > "$HOME/Documents/SYNK-talk/인코딩3.log" 2>&1
echo "[더하기] 나온 팩 $(ls "$OUT"/*.ts 2>/dev/null | wc -l)개"

echo "[더하기] ③ 서버에 올린다(하나씩 · 크기로 검산)"
bash "$HOME/Documents/SYNK-appsscript/tools/라디오팩올리기.sh" "$OUT"/*.ts

echo "[더하기] ④ 제자리로 옮기고 재생목록을 다시 만든다"
ssh "${SSHOPT[@]}" "$HOST" '
  sudo cp -f /home/synk/팩/*.ts /opt/synk-radio/팩/ 2>/dev/null
  sudo chown -R synk:synk /opt/synk-radio/팩
  node ~/talk/bots/송출/재생목록.js /opt/synk-radio/팩 2>&1 | tail -6
' 2>&1 | tail -8

echo "[더하기] ⑤ 송출을 다시 켠다(새 목록을 읽게)"
ssh "${SSHOPT[@]}" "$HOST" '
  sudo systemctl restart radio-stream
  sleep 8
  echo "송출: $(systemctl is-active radio-stream)"
  echo "팩 $(ls /opt/synk-radio/팩/*.ts | wc -l)벌 · 목록 $(wc -l < /opt/synk-radio/팩/playlist.txt)줄"
' 2>&1 | tail -4
