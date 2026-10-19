#!/usr/bin/env bash
# 라이브 synk.im/try/travel의 바뀐 30개 파일이 공개 커밋 blob과 바이트가 같아질 때까지 확인(최대 20분).
C=7222a347d471ec8311510ba5e3d4c98d726aa416
P=/c/Users/q1212/Documents/synk-policy
FILES=$(git -C $P diff --name-only $C~1 $C)
N=$(echo "$FILES" | wc -l)
declare -A WANT
for f in $FILES; do WANT[$f]=$(git -C $P show $C:$f | sha256sum | cut -c1-16); done
for i in $(seq 1 80); do
  ok=0; bad=""
  for f in $FILES; do
    got=$(curl -s -H 'Cache-Control: no-cache' "https://synk.im/${f}?probe=$RANDOM$i" | sha256sum | cut -c1-16)
    if [ "$got" = "${WANT[$f]}" ]; then ok=$((ok+1)); else bad="$bad ${f##*/}"; fi
  done
  echo "$(date +%H:%M:%S) 일치 $ok/$N${bad:+ · 아직:$bad}"
  [ $ok -eq $N ] && exit 0
  sleep 15
done
exit 1
