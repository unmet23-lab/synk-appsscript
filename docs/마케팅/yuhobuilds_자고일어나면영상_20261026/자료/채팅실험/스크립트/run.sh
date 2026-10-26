#!/bin/bash
# 사용: bash run.sh <라운드 본문.js>  — 공용 도우미를 앞에 붙여 표준 입력으로 넘긴다(파일 import는 ego에서 멈춤).
D=/c/Users/q1212/ego/y9v2-20261027
cat "$D/common_inline.js" "$D/$1" > "$D/_run_$1"
ego-browser nodejs < "$D/_run_$1"
