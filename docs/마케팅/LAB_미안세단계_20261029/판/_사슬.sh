#!/bin/bash
# 칸 N을 칸 N-1의 가장 최근 그림에서 굽는다(3~9 사슬). 쓰는 법: bash 판/_사슬.sh <시작칸> <끝칸>
cd "$(dirname "$0")/../../../.."
E=docs/마케팅/LAB_미안세단계_20261029
for n in $(seq $1 $2); do
  p=$((n-1)); prev=$(ls -t $E/판/칸${p}_*.png 2>/dev/null | head -1)
  [ -z "$prev" ] && { echo "칸$p 그림 없음"; exit 1; }
  echo "칸$n ← $prev"
  node $E/굽기.cjs $E/판/칸$n.txt 칸$n "$prev" $E/판/참고/몽글_정본_본체.jpg 2>&1 | tail -2 || exit 1
done
