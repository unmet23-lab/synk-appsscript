#!/usr/bin/env bash
# 11-07 슬롭 점검표 25번 고침(05_콘티_15초 10절) — N08s 신발 숨 · N11 바닥 연기 대신 실제 물리 판 넷을 구독 경로로 굽는다(크레딧 0).
#   N08b  역광 니트(N08을 Image 1로 편집 — 숨구멍으로 빛이 샘, 아무것도 안 나옴)
#   N08h  채원이 찬 밤공기에 숨을 내쉼(얼굴 없이 뒤옆 실루엣 — 원본 1:1 밖의 새 컷, 비교판)
#   N02n  N02에서 밑창 밑 연기 구름을 뺌(Fable 확인 「가장 위험」)
#   N11n  N11에서 바닥 연기만 뺌        N11en  N11e에서 연기 · 먼지 구름을 빼고 알갱이 · 물방울만
# 실행: bash 굽기_1107.sh [컷…]   (이미 있으면 건너뜀)
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../../../.." && pwd)"
V="$USERPROFILE/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n"
declare -A TXT=( [N02n]="N02n_편집.txt" [N08b]="N08b_역광_편집.txt" [N08h]="N08h_사람숨.txt" [N11n]="N11n_편집.txt" [N11en]="N11en_편집.txt" )
declare -A REFS=( [N02n]="정지컷/N02.png" [N08b]="정지컷/N08.png" [N08h]="../p5/정지컷/R2.png /c/SYNK-LoRA/validation/F07_chaewon/refs/04_fullbody.jpg" [N11n]="정지컷/N11.png" [N11en]="정지컷/N11e.png" )
names=("$@"); [ ${#names[@]} -eq 0 ] && names=(N08b N11n N11en N08h)
for n in "${names[@]}"; do
  out="$V/정지컷/$n.png"
  [ -f "$out" ] && { echo "$n 있음"; continue; }
  args=(); for r in ${REFS[$n]}; do case "$r" in /*) args+=("$r");; *) args+=("$V/$r");; esac; done
  echo "== $n $(date +%H:%M:%S)"
  (cd "$REPO" && timeout 900 node tools/GPT콘티굽기.mjs "$HERE/${TXT[$n]}" "$out" "${args[@]}" --크기 1152x2048 2>&1 | tail -2)
done
