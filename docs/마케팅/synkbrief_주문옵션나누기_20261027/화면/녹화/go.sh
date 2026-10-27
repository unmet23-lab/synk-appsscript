#!/usr/bin/env bash
# 라운드 하나: rec.tpl의 __TAG__를 바꿔 표준 입력으로 ego에 넘긴다(현장노트 — -e import는 멈춤). 40초 안에 「시작」이 없으면 끄고 다시(3번).
D=/c/Users/q1212/ego/synkbrief-b10-20261027; T="$1"; TO="${2:-300}"
EGO="$HOME/.local/share/ego/active_version_dir/ego-browser.exe"
sed "s/__TAG__/$T/g" $D/rec.tpl > $D/_run_$T.js
rm -f "$D/claim-$T"
for t in 1 2 3; do
  b=$(grep -c " $T 시작" $D/steps.log 2>/dev/null); b=${b:-0}
  timeout $TO "$EGO" nodejs < $D/_run_$T.js > "$D/$T.t$t.out" 2>&1 &
  P=$!; st=0
  for j in $(seq 1 20); do n=$(grep -c " $T 시작" $D/steps.log 2>/dev/null); n=${n:-0}; [ "$n" -gt "$b" ] && { st=1; break; }; kill -0 $P 2>/dev/null || break; sleep 2; done
  if [ $st -eq 1 ] || ! kill -0 $P 2>/dev/null; then wait $P; echo "rc=$? 시도 $t"; grep -v notice "$D/$T.t$t.out" | tail -c 5000; exit 0; fi
  [ -f "$D/claim-$T" ] && { echo "표지 있음 — 기다림"; wait $P; grep -v notice "$D/$T.t$t.out" | tail -c 5000; exit 0; }
  kill $P 2>/dev/null; echo "시도 $t 시작 안 함 $(date +%T)"; sleep 5
done
echo "세 번 모두 시작 안 함"; exit 3
