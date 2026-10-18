#!/usr/bin/env bash
# 나라별 채널판 현지어 검문(10-18): 언어마다 tools/현지어대조.js를 차례로 돌린다(agy를 동시에 여러 개 띄우지 않음).
#   bash 돌리기.sh            → 결과_<코드>.txt · 요약.txt
#   bash 돌리기.sh km my      → 그 언어만
cd "$(dirname "$0")/../../../../../.." || exit 1
D=docs/마케팅/LAB_관용구퀴즈2_20261017/게시/03-나라별/검문
declare -A NAME=([es]="스페인어(중남미)" [pt]="포르투갈어(브라질)" [fil]="필리핀어(타갈로그·영어 섞임)" [zh]="번체 중국어(대만)" [ja]="일본어" [vi]="베트남어" [th]="태국어" [id]="인도네시아어" [ms]="말레이어(말레이시아)" [hi]="힌디어" [ky]="키르기스어" [si]="싱할라어" [my]="미얀마어" [ru]="러시아어" [ne]="네팔어" [km]="크메르어" [uz]="우즈베크어(라틴)" [zhs]="간체 중국어(중국 본토)")
LIST=("$@"); [ ${#LIST[@]} -eq 0 ] && LIST=(es pt fil zh ja vi th id ms hi ky si my ru ne km uz zhs)
for c in "${LIST[@]}"; do
  start=$(date +%s)
  node tools/현지어대조.js --언어 "${NAME[$c]}" --파일 "$D/$c.txt" > "$D/결과_$c.txt" 2>&1
  code=$?
  verdict=$(grep -m1 -o "판정: [^ ]*" "$D/결과_$c.txt")  # cut -c는 한글 바이트를 잘라 깨진 글자가 남았다(10-18)
  echo "$c 종료 $code · $(( $(date +%s) - start ))초 · $verdict" | tee -a "$D/요약.txt"
done
echo 끝 | tee -a "$D/요약.txt"
