#!/bin/bash
# T0(공용 14개 · 묶음 셋 = 라이브)과 T1(공용 14개 = 후보, 묶음 셋 = 라이브)에서 같은 WORLD 시험을 차례로 돈다(시험마다 90초 한도).
# 두 트리 모두에서 멈추는 시험 둘(world-position-account-progress · life-ui-path)은 앞 회차처럼 뺀다.
P="C:/Users/q1212/AppData/Local/Temp/claude/357faf1081559b8e/d582e432-081a-4b0f-9469-c1e332c883ac/scratchpad/probe45/wf3"
E=/d/SYNK-worktrees/world-export-atlas-20261120b
for MODE in live cand; do
  (cd "$P" && MODE=$MODE node t1.cjs | tail -1)
  FILES=$(cd $E && ls experiences/synk-world-app/qa/*.test.mjs experiences/brand-opening/qa/*.test.mjs | grep -vE "world-position-account-progress|life-ui-path")
  (cd $E && timeout 1800 node --test --test-reporter=tap --test-concurrency=6 --test-timeout=90000 $FILES > $E/.tmp/tap-$MODE.txt 2>&1; echo "exit $?" >> $E/.tmp/tap-$MODE.txt)
  echo "$MODE: $(grep -E '^# (tests|pass|fail)' $E/.tmp/tap-$MODE.txt | tr '\n' ' ')"
done
