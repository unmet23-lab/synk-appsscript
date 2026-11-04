#!/usr/bin/env bash
# 주문 폭주 손님 목소리 — 일레븐 v4 줄을 힉스필드 founder 계정으로 낸다(2026-11-04). 먼저 node 손님목소리.mjs 일레븐계획.
#   bash 손님목소리내기.sh [손님…]     (주지 않으면 계획에 남은 줄 전부)
# node에서 부르면 「No workspace selected」로 멈추는 일이 있어 셸에서 HOME · USERPROFILE을 바꿔 부른다. CLI는 stdin이 열려 있으면 접수에서 멈춘다 — 모든 호출에 < /dev/null(현장노트 higgsfield).
# 받은 줄은 다시 내지 않는다. 접수 번호는 <줄>.job. 넷씩 내고 받는다. 잔액이 한 줄 값(0.46)보다 적으면 멈춘다.
set -u
작업="C:/Users/q1212/Documents/SYNK-appsscript/.tmp/order-rush-voices-20261104"
계획="$작업/일레븐계획"
받음="$작업/받음"
export HOME="$USERPROFILE/.ai-accounts/higgsfield-founder" USERPROFILE="$USERPROFILE/.ai-accounts/higgsfield-founder"
잔액() { higgsfield account status --json < /dev/null 2>&1 | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.email+" "+j.credits)}catch{console.log("?")}})'; }
who=$(잔액); echo "계정: $who"
case "$who" in founder@synk.im*) ;; *) echo "founder 계정이 아니다 — 내지 않는다"; exit 1;; esac
list=""
for f in "$계획"/*.json; do
  [ -f "$f" ] || continue
  n=$(basename "$f" .json); g=${n%%-*}; id=${n#*-}
  if [ $# -gt 0 ]; then case " $* " in *" $g "*) ;; *) continue;; esac; fi
  [ -f "$받음/$g/$id.mp3" ] && { rm -f "$f"; continue; }
  list="$list $n"
done
set -- $list
echo "낼 줄 $#"
받기() {
  n=$1; g=${n%%-*}; id=${n#*-}; job=$(cat "$계획/$n.job")
  res=$(higgsfield generate wait "$job" --json < /dev/null 2>&1)
  url=$(echo "$res" | grep -oE '"result_url"[^,}]*' | head -1 | sed 's/.*: *"\(.*\)"/\1/')
  [ -n "$url" ] || { echo "$n 결과 주소 없음: ${res:0:300}"; return 1; }
  mkdir -p "$받음/$g"
  curl -sL "$url" -o "$받음/$g/$id.mp3" && rm -f "$계획/$n.json" && echo "$n 받음 $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$받음/$g/$id.mp3")초"
}
while [ $# -gt 0 ]; do
  묶음=""
  for k in 1 2 3 4; do
    [ $# -gt 0 ] || break
    n=$1; shift
    if [ ! -s "$계획/$n.job" ]; then
      out=$(higgsfield generate create elevenlabs_v4 --dialogue "$(cat "$계획/$n.json")" --stability 0.75 --json < /dev/null 2>&1)   # 0.75: 유호님 「발음이 아주 약간만 더 좋았으면」(11-04) — 0.5보다 거친 프레임이 적다
      job=$(echo "$out" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
      [ -n "$job" ] || { echo "$n 접수 번호를 못 읽음: ${out:0:300}"; 잔액; exit 1; }
      echo "$job" > "$계획/$n.job"
    fi
    묶음="$묶음 $n"
  done
  for n in $묶음; do 받기 "$n" || { 잔액; exit 1; }; done
done
echo "끝 — $(잔액)"
