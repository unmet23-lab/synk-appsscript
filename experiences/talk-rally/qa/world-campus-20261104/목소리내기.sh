#!/usr/bin/env bash
# 말 랠리 캠퍼스 판 — 태오 목소리 묶음을 힉스필드 founder 계정(일레븐 v4)으로 낸다(2026-11-04). 목소리굽기.mjs 준비 뒤.
#   bash 목소리내기.sh 1 2 …   (주지 않으면 아직 받지 않은 묶음 전부)
# node에서 부르면 「No workspace selected」로 멈추는 일이 있어(현장노트 higgsfield) 셸에서 HOME · USERPROFILE을 바꿔 부른다.
# CLI는 stdin이 열려 있으면 접수에서 멈춘다(11-04 — 10분 넘게 말이 없고 접수도 안 됨) — 모든 호출에 < /dev/null.
# 받은 묶음(묶음-N.mp3)은 다시 내지 않는다. 접수 번호는 묶음-N.job, 청구는 끝에 거래 내역으로 본다.
set -u
V="C:/Users/q1212/Documents/SYNK-appsscript/.tmp/talk-rally-world-20261104/voice"
export HOME="$USERPROFILE/.ai-accounts/higgsfield-founder" USERPROFILE="$USERPROFILE/.ai-accounts/higgsfield-founder"
who=$(higgsfield account status --json < /dev/null 2>&1 | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.email+" "+j.credits)}catch{console.log("?")}})')
echo "계정: $who"
case "$who" in founder@synk.im*) ;; *) echo "founder 계정이 아니다 — 내지 않는다"; exit 1;; esac
list="$*"; [ -n "$list" ] || list=$(ls "$V" | sed -n 's/^묶음-\([0-9]*\)\.json$/\1/p' | sort -n)
for n in $list; do
  [ -f "$V/묶음-$n.mp3" ] && { echo "묶음-$n 이미 받음"; continue; }
  job=$(cat "$V/묶음-$n.job" 2>/dev/null)
  if [ -z "$job" ]; then
    out=$(higgsfield generate create elevenlabs_v4 --dialogue "$(cat "$V/묶음-$n.json")" --stability 0.5 --json < /dev/null 2>&1)
    job=$(echo "$out" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
    [ -n "$job" ] || { echo "묶음-$n 접수 번호를 못 읽음: ${out:0:300}"; exit 1; }
    echo "$job" > "$V/묶음-$n.job"
    echo "묶음-$n 접수 $job"
  fi
  res=$(higgsfield generate wait "$job" --json < /dev/null 2>&1)
  url=$(echo "$res" | grep -oE '"result_url"[^,}]*' | head -1 | sed 's/.*: *"\(.*\)"/\1/')
  [ -n "$url" ] || url=$(echo "$res" | grep -oE 'https://[^" ]+\.(mp3|wav)' | head -1)
  [ -n "$url" ] || { echo "묶음-$n 결과 주소 없음: ${res:0:300}"; exit 1; }
  ext="${url##*.}"; curl -sL "$url" -o "$V/묶음-$n.받은.$ext" && ffmpeg -v error -y -i "$V/묶음-$n.받은.$ext" -ar 44100 -ac 1 "$V/묶음-$n.mp3" && echo "묶음-$n 받음 $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V/묶음-$n.mp3")초"
done
higgsfield account status --json < /dev/null 2>&1 | grep -o '"credits": [0-9.]*'
