#!/bin/bash
# 1단계 후보를 X′(주석 이름 지운 export)로 다시 짓고 기계 확인을 돈다.
set -e
P="C:/Users/q1212/AppData/Local/Temp/claude/357faf1081559b8e/d582e432-081a-4b0f-9469-c1e332c883ac/scratchpad/probe45/wf"
E=D:/SYNK-worktrees/world-export-atlas-20261120b
X=1ebc932569d817343f5175fe63ee03ff9582bd74
cd "$P"
rm -rf $E/.tmp/cand-step1-resolved
MINE_ROOT=$E node cand.cjs $X > $E/.tmp/cand-1.txt 2>&1 || true
tail -3 $E/.tmp/cand-1.txt
node resolve.cjs
MINE_ROOT=$E node cand.cjs $X 2>&1 | tail -3
echo "== 자유 변수"; node scope.cjs $E/.tmp/cand-step1/new/world $E/.tmp/world-public-atlas-20261120/live-blobs 2>&1 | grep -v "자유 변수 0$" | head -30
echo "== AI 이름"; node pubprep.cjs && node ainames.cjs
echo "== import"; node imports.cjs $E/.tmp/cand-step1/new $E/.tmp/atlas-release 2>&1 | tail -16 || true
