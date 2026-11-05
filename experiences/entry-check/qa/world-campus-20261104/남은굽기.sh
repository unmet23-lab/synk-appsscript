#!/usr/bin/env bash
# 입장 검사 캠퍼스 판: 빠진 판만 골라 굽는다(이어 돌려도 있는 판은 건너뛴다). 한도로 실패한 판은 다음 돌림에서 다시 굽는다.
#   bash experiences/entry-check/qa/world-campus-20261104/남은굽기.sh [돌림 수=3]   (저장소 뿌리에서)
Q=experiences/entry-check/qa/world-campus-20261104/굽기순서.mjs
B="${SYNK_SHARED:-/c/Users/q1212/Documents/SYNK-appsscript}/.tmp/entry-check-world-20261104/판"
PAR=6
have() { ls "$B" | grep -qE "^$1_[0-9]{6}(_[0-9]+)?\.(png|jpe?g|webp)$"; }
ALL="bear raccoon rabbit fox squirrel hedgehog penguin ducks otter deer panda sheep"
SLY="raccoon fox penguin panda otter"   # world-content.mjs SNEAKY의 손님만 몰래 표정이 쓰인다
ITEMS="swim-cap towel water-bottle gimbap snack swim-ring book coffee-lid coffee-open phone purse camera picnic-mat chair"
VENUES="pool library museum concert"
for round in $(seq 1 "${1:-3}"); do
  # 1. 말함 바탕(표정의 원본이라 먼저)
  jobs_=(); for g in $ALL; do have "$g-talk" || jobs_+=("$g"); done
  [ ${#jobs_[@]} -gt 0 ] && printf '%s\n' "${jobs_[@]}" | xargs -P $PAR -I{} sh -c "node $Q 바탕 {} 2>&1 | tail -1 | cut -c1-110"
  # 2. 표정 · 짐 · 근무지
  list=(); for g in $ALL; do have "$g-talk" || continue
    for m in idle nervous pass sorry puzzled; do have "$g-$m" || list+=("표정:$g:$m"); done
    case " $SLY " in *" $g "*) have "$g-sly" || list+=("표정:$g:sly");; esac
  done
  for k in $ITEMS; do have "item-$k" || list+=("짐:$k"); done
  for v in $VENUES; do have "venue-$v" || list+=("바닥:venue-$v"); done
  echo "[돌림 $round] 빠진 판 ${#list[@]}"
  [ ${#list[@]} -eq 0 ] && break
  printf '%s\n' "${list[@]}" | xargs -P $PAR -I{} sh -c '
    IFS=: read -r s a m <<EOF
{}
EOF
    if [ "$s" = "표정" ]; then MOODS=$m node '"$Q"' 표정 "$a" 2>&1 | tail -1 | cut -c1-110; else node '"$Q"' "$s" "$a" 2>&1 | tail -1 | cut -c1-110; fi'
done
# 3. 얼굴 안쪽만 바탕에 붙이기
for g in penguin ducks panda sheep; do node "$Q" 합성 "$g" 2>&1 | tail -1 | cut -c1-110; done
missing=0
for g in $ALL; do for m in talk idle nervous pass sorry puzzled; do have "$g-$m" || { echo "없음 $g-$m"; missing=$((missing+1)); }; done; done
for g in $SLY; do have "$g-sly" || { echo "없음 $g-sly"; missing=$((missing+1)); }; done
for k in $ITEMS; do have "item-$k" || { echo "없음 item-$k"; missing=$((missing+1)); }; done
for v in $VENUES; do have "venue-$v" || { echo "없음 venue-$v"; missing=$((missing+1)); }; done
echo "[끝] 빠진 판 $missing"
