#!/usr/bin/env bash
# 팩이 다 올라가기를 기다렸다가 → 재생목록 → 설치까지 한 줄기로 잇는다 (유호 지시 09-06).
#
# 🔑 왜 한 줄기인가: 올리기가 30분 넘게 걸리는데 그 뒤 단계는 몇 초다.
#   사람이 지켜보다 이어 붙이면 그 사이가 통째로 죽는다.
#
# 🔴 설치는 송출을 «켜지 않는다» — 개통.sh 가 radio-stream 을 enable 만 하고 start 는 안 한다.
#   첫 화면은 유호님이 보시고 켠다(talk README §설치).
#
# ⚠ 변수명이 영어인 까닭: bash 는 비ASCII 식별자를 못 받는다.
set -uo pipefail

KEY="$HOME/.ssh/synk_radio"
HOST="synk@34.71.111.97"
SSHOPT=(-i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=15)
LOCAL_PACKS=("$HOME/Documents/SYNK-talk/팩"/*.ts "$HOME/Documents/SYNK-talk/팩2"/*.ts)

# ① 로컬 팩의 «온전한 총합»을 센다 — 이것이 도달 목표다
want_total=0; want_count=0
for f in "${LOCAL_PACKS[@]}"; do
  [ -f "$f" ] || continue
  sz=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")
  want_total=$((want_total + sz)); want_count=$((want_count + 1))
done
echo "[잇기] 목표 = 팩 ${want_count}개 · ${want_total} 바이트"

# ② 다 올라갈 때까지 기다린다(올리는 일은 다른 작업이 한다)
for i in $(seq 1 240); do
  got=$(ssh "${SSHOPT[@]}" "$HOST" "cat /home/synk/팩/*.ts 2>/dev/null | wc -c" 2>/dev/null | tr -d '\r')
  cnt=$(ssh "${SSHOPT[@]}" "$HOST" "ls /home/synk/팩/*.ts 2>/dev/null | wc -l" 2>/dev/null | tr -d '\r')
  got=${got:-0}; cnt=${cnt:-0}
  if [ "$got" = "$want_total" ] && [ "$cnt" = "$want_count" ]; then
    echo "[잇기] ✅ 다 올라왔다 — ${cnt}개 · ${got} 바이트"
    break
  fi
  [ $((i % 6)) -eq 1 ] && echo "[잇기] 기다리는 중… ${cnt}/${want_count}개 · ${got}/${want_total} 바이트"
  [ "$i" = "240" ] && { echo "[잇기] 🔴 20분을 기다려도 안 찼다 — 올리기가 멈췄는지 본다"; exit 1; }
  sleep 5
done

# ③ 팩을 제자리로 옮기고 재생목록을 만든다
echo "[잇기] 팩을 /opt/synk-radio/팩 으로 옮기고 재생목록을 만든다"
ssh "${SSHOPT[@]}" "$HOST" '
  set -e
  sudo mkdir -p /opt/synk-radio/팩
  sudo cp -f /home/synk/팩/*.ts /opt/synk-radio/팩/
  sudo chown -R synk:synk /opt/synk-radio/팩
  cd /opt/synk-radio/팩
  node ~/talk/bots/송출/재생목록.js /opt/synk-radio/팩
  echo "--- playlist.txt ---"
  head -6 /opt/synk-radio/팩/playlist.txt
  echo "줄 수: $(wc -l < /opt/synk-radio/팩/playlist.txt)"
' 2>&1 | tail -15

# ④ 설치 — 점검이 통과해야 설치가 돈다
echo
echo "[잇기] 개통 점검 → 설치"
ssh "${SSHOPT[@]}" "$HOST" 'cd ~/talk && bash bots/송출/개통.sh --점검' 2>&1 | tail -22
echo
ssh "${SSHOPT[@]}" "$HOST" 'cd ~/talk && sudo bash bots/송출/개통.sh --설치' 2>&1 | tail -25

# ⑤ 되읽기 — 「섰다」를 응답이 아니라 상태로 잰다
echo
echo "[잇기] 되읽기"
ssh "${SSHOPT[@]}" "$HOST" '
  echo "--- 서비스 ---"
  systemctl is-enabled radio-bot radio-stream 2>&1 | paste -sd" " -
  systemctl is-active radio-bot radio-stream 2>&1 | paste -sd" " -
  echo "--- 봇 최근 줄 ---"
  sudo journalctl -u radio-bot -n 8 --no-pager 2>/dev/null | tail -8
' 2>&1 | tail -16
