#!/usr/bin/env bash
# 라디오 팩(.ts)을 서버에 «하나씩» 올리고 크기로 검산한다.
#
# 🔴 왜 이렇게 하나 (09-06 실측):
#   `tar | ssh` 로 통째 올리다가 두 번 다 `Connection reset by peer` 로 끊겼다.
#   끊기면 **잘린 파일이 남는다**(03번 16MB/44MB · 06번 24MB/44MB) — 그대로 두면 방송이 중간에 깨진다.
#   ⇒ 파일마다 올리고, 올린 «뒤» 크기를 견줘 다르면 다시 올린다. 세 번 실패하면 그 파일을 이름째 알린다.
#   ⚠ 동시에 둘을 올리면 더 잘 끊긴다(서버 램 1GB) — 순서대로 하나씩 간다.
#
# ⚠ 변수명이 영어인 까닭: bash 는 비ASCII 식별자를 못 받는다(기억 · 09-06 에 또 밟았다).
set -uo pipefail

KEY="$HOME/.ssh/synk_radio"
HOST="synk@34.71.111.97"
SSHOPT=(-i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=15)
REMOTE="/home/synk/팩"

ok=0; ng=0; skip=0
fail_list=""

for src in "$@"; do
  [ -f "$src" ] || continue
  name=$(basename "$src")
  want=$(stat -c%s "$src" 2>/dev/null || stat -f%z "$src")
  done_one=0
  for try in 1 2 3; do
    got=$(ssh "${SSHOPT[@]}" "$HOST" "stat -c%s '$REMOTE/$name' 2>/dev/null || echo 0" 2>/dev/null | tr -d '\r')
    if [ "$got" = "$want" ]; then
      if [ "$try" = "1" ]; then echo "  = $name 이미 온전하다 ($want)"; skip=$((skip+1)); else echo "  ✅ $name ($want)"; ok=$((ok+1)); fi
      done_one=1; break
    fi
    [ "$try" = "1" ] && echo "  ↑ $name 올린다 ($want 바이트)" || echo "  ↻ $name 다시 올린다 (받은 것 $got)"
    ssh "${SSHOPT[@]}" "$HOST" "rm -f '$REMOTE/$name'" >/dev/null 2>&1
    scp "${SSHOPT[@]}" -q "$src" "$HOST:$REMOTE/" >/dev/null 2>&1
  done
  if [ "$done_one" = "0" ]; then
    echo "  🔴 $name — 세 번 다 실패"
    ng=$((ng+1)); fail_list="$fail_list $name"
  fi
done

echo
echo "합계: 새로 올림 $ok · 이미 있던 것 $skip · 실패 $ng"
[ -n "$fail_list" ] && echo "실패한 것:$fail_list"
exit $ng
