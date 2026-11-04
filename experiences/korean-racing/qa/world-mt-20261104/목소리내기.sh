#!/usr/bin/env bash
# MT 바닷가 레이스 — 태오 목소리 일곱 줄을 힉스필드 founder 계정(일레븐 v4)으로 낸다(말 랠리 목소리내기.sh와 같은 길, 2026-11-04). 목소리굽기.mjs 준비 뒤.
# node에서 부르면 「No workspace selected」로 멈추는 일이 있어 셸에서 HOME · USERPROFILE을 바꿔 부르고, stdin이 열려 있으면 접수에서 멈춰 < /dev/null을 붙인다.
set -u
V="C:/Users/q1212/Documents/SYNK-appsscript/.tmp/world-mt-20261104/voice"
export HOME="$USERPROFILE/.ai-accounts/higgsfield-founder" USERPROFILE="$USERPROFILE/.ai-accounts/higgsfield-founder"
who=$(higgsfield account status --json < /dev/null 2>&1 | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.email+" "+j.credits)}catch{console.log("?")}})')
echo "계정: $who"
case "$who" in founder@synk.im*) ;; *) echo "founder 계정이 아니다 — 내지 않는다"; exit 1;; esac
for key in start ahead passed praise win mid lose; do
  ls "$V/$key.받은."* > /dev/null 2>&1 && { echo "$key 이미 받음"; continue; }
  job=$(cat "$V/$key.job" 2>/dev/null)
  if [ -z "$job" ]; then
    out=$(higgsfield generate create elevenlabs_v4 --dialogue "$(cat "$V/$key.json")" --stability 0.5 --json < /dev/null 2>&1)
    job=$(echo "$out" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
    [ -n "$job" ] || { echo "$key 접수 번호를 못 읽음: ${out:0:300}"; exit 1; }
    echo "$job" > "$V/$key.job"; echo "$key 접수 $job"
  fi
  res=$(higgsfield generate wait "$job" --json < /dev/null 2>&1)
  url=$(echo "$res" | grep -oE '"result_url"[^,}]*' | head -1 | sed 's/.*: *"\(.*\)"/\1/')
  [ -n "$url" ] || url=$(echo "$res" | grep -oE 'https://[^" ]+\.(mp3|wav)' | head -1)
  [ -n "$url" ] || { echo "$key 결과 주소 없음: ${res:0:300}"; exit 1; }
  ext="${url##*.}"; curl -sL "$url" -o "$V/$key.받은.$ext" && echo "$key 받음"
done
higgsfield account status --json < /dev/null 2>&1 | grep -o '"credits": [0-9.]*'
