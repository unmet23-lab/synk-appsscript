#!/usr/bin/env bash
# 빈칸 베기 캠퍼스 판 WORLD 공개 빌드(11-04, 싱크타운 공개 빌드와 같은 꼴) — 원천 커밋을 깨끗한 사본으로 꺼내 빌드한다. git 밖 자산은 공용 작업본에서.
#   bash 공개빌드.sh <원천 커밋> <이름>   → 공용 작업본 .tmp/blank-slice-publish-20261104/<이름>/.tmp/pub/world/…
set -euo pipefail
repo=/c/Users/q1212/Documents/SYNK-appsscript; M="$repo"; W="$M/.tmp/blank-slice-publish-20261104"; mkdir -p "$W"
SRC=$(git -C "$repo" rev-parse --short=9 "$1"); NAME="${2:-new}"
FOLDERS="experiences/brand-opening experiences/synk-world-app experiences/hangul-stage experiences/korean-runner experiences/korean-rhythm experiences/order-rush experiences/synk-world-home experiences/synk-account experiences/synk-town experiences/play-common experiences/korean-racing experiences/social-conversion.mjs experiences/blank-slice experiences/entry-check experiences/teacher-world experiences/topik-items experiences/drama atlas strata tools package.json"
B="$HOME/Documents/synk-vendor/synk-policy-publish.git"
GIT_NO_LAZY_FETCH=0 git -C "$B" fetch -q --filter=blob:none origin main
echo "원천 $SRC · 공개본 $(git -C "$B" rev-parse --short origin/main)" > "$W/source-$NAME.txt"
GIT_NO_LAZY_FETCH=0 git -C "$B" cat-file -p origin/main:world/world-config.json > "$W/world-config.public.json"
D="$W/$NAME"; rm -rf "$D"; mkdir -p "$D"
git -C "$repo" -c core.autocrlf=false archive --format=tar "$SRC" -- $FOLDERS | tar -x -C "$D"
mkdir -p "$D/experiences/synk-town/assets/district"
GIT_NO_LAZY_FETCH=0 git -C "$B" ls-tree origin/main world/town/assets/district/ | while read -r mode type sha p; do GIT_NO_LAZY_FETCH=0 git -C "$B" cat-file blob "$sha" > "$D/experiences/synk-town/assets/district/$(basename "$p")"; done
cp "$M/experiences/brand-opening/assets/world-menu-desktop-stable-v10-web.mp4" "$M/experiences/brand-opening/assets/world-menu-mobile-stable-v10-web.mp4" "$D/experiences/brand-opening/assets/"
[ -d "$M/experiences/synk-world-home/assets/avatar-textiles-v1" ] && cp -r "$M/experiences/synk-world-home/assets/avatar-textiles-v1" "$D/experiences/synk-world-home/assets/"
[ -d "$M/experiences/synk-town/assets/music" ] && { mkdir -p "$D/experiences/synk-town/assets/music"; cp "$M"/experiences/synk-town/assets/music/*.mp3 "$D/experiences/synk-town/assets/music/" 2>/dev/null || true; }
[ -d "$M/experiences/drama/pilot/media" ] && { mkdir -p "$D/experiences/drama/pilot/media"; cp -r "$M"/experiences/drama/pilot/media/. "$D/experiences/drama/pilot/media/"; }
(cd "$D" && node tools/build-world-app-public.mjs --config "$W/world-config.public.json" --out "$D/.tmp/pub" > "$W/build-$NAME.json" 2> "$W/build-$NAME.err") || { echo "빌드 실패"; tail -8 "$W/build-$NAME.err" | cut -c1-300; head -c 800 "$W/build-$NAME.json"; exit 3; }
echo "$NAME: $(node -e "const r=require(process.argv[1]);console.log('ok '+r.ok+' · 파일 '+(r.files??r.entries?.length??'?')+' · missing '+JSON.stringify(r.missing)+' · 도구이름 '+JSON.stringify(r.publicToolNames))" "$W/build-$NAME.json" 2>/dev/null || head -c 300 "$W/build-$NAME.json")"
