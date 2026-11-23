#!/usr/bin/env bash
# 2단계 생성물(계정 · 생활 묶음 · 생활 css) 재현: master 커밋을 새 사본으로 꺼내 C 되돌리기 → 묶음 빌더 → 공개 빌드 → 후보와 sha256 대조.
#   bash reproduce.sh <커밋> <사본 폴더>
set -euo pipefail
COMMIT="$1"; EXP="$2"
WT=D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5
REPO=C:/Users/q1212/Documents/SYNK-appsscript
S=C:/Users/q1212/AppData/Local/Temp/claude/357faf1081559b8e/d582e432-081a-4b0f-9469-c1e332c883ac/scratchpad/probe45/s2c
CAND=D:/SYNK-worktrees/world-export-step2-20261120/.tmp/cand-step2/full
[ -e "$EXP" ] && { echo "이미 있다: $EXP"; exit 1; }
mkdir -p "$EXP"
TAR="${EXP}.tar"
git -C "$WT" -c core.autocrlf=false archive --format=tar -o "$TAR" "$COMMIT" experiences atlas strata tools packages/atlas package.json
tar -x -f "$(cygpath -u "$TAR")" -C "$(cygpath -u "$EXP")"
rm -f "$TAR"
echo "$COMMIT" > "$EXP/EXPORT_COMMIT"
powershell -NoProfile -Command "New-Item -ItemType Junction -Path '$EXP/node_modules' -Target '$REPO/node_modules' | Out-Null; New-Item -ItemType Junction -Path '$EXP/experiences/synk-account/node_modules' -Target '$REPO/experiences/synk-account/node_modules' | Out-Null"
node "$S/revert.cjs" "$EXP"
(cd "$EXP" && node tools/build-world-account.mjs && node tools/build-world-life.mjs)
sed -e "s#world-export-step2-20261120#$(basename "$EXP")#g" "$S/prep-ignored2.cjs" > "$S/prep-ignored-repro.cjs"
node "$S/prep-ignored-repro.cjs"
(cd "$EXP" && node tools/build-world-app-public.mjs --config "$REPO/.tmp/world-redesign-20261014/tools/account-config.json" --out .tmp/world-public-repro > "$EXP/../$(basename "$EXP")-build.log" 2>&1 || true)
for f in world/world-account.bundle.mjs world/brand-opening/content/life-standalone.mjs world/brand-opening/content/life-ui.css; do
  a=$(sha256sum "$CAND/$f" | cut -c1-64); b=$(sha256sum "$EXP/.tmp/world-public-repro/$f" | cut -c1-64)
  [ "$a" = "$b" ] && echo "같음 $f $a" || echo "다름 $f 후보 $a 재현 $b"
done
