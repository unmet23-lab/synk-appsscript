#!/usr/bin/env bash
# 이미지 콘티용 제품 컷 아홉 장(1280×720, 96샘플) + 12번 손 병(1080 정사각, 투명) — 원본 컷 첫 프레임 자리(18번은 끝 자리도)
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
cd "$(dirname "$0")"
for sh in s02 s03 s06 s07 s09 s10 s17 s18; do "$B" -b --python 솔서리병.py -- --shot $sh --samples 96 --res 1280x720 2>&1 | grep -E "저장|Traceback|Error:"; done
"$B" -b --python 솔서리병.py -- --shot s18 --t 1 --samples 96 --res 1280x720 2>&1 | grep -E "저장|Traceback|Error:"
"$B" -b --python 솔서리병.py -- --shot hand --samples 96 --res 1080x1080 2>&1 | grep -E "저장|Traceback|Error:"
