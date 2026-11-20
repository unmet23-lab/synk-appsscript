"""synk.im 새 홈(v11) 글꼴 줄이기 — 짓기.mjs가 부른다(2026-11-20).

  python 글꼴줄이기.py <SUIT-Variable.woff2> <글자.txt> <나갈 woff2>

글자.txt의 글자(새 쪽 열여섯 장 · 질문창 자료 · 공개본 site.js · 엔진의 모든 글자) + 기본 문장 부호 범위 가운데 SUIT에 있는 것만 남긴다.
굵기 축(wght)과 글자 기능은 그대로 둔다. SUIT는 OFL이고 예약 이름이 「SUIT」라, 줄인 판은 이름 표의 이름 칸을 SYNK Sans v11로 새로 쓴다
(저작권 · 디자이너 · 주소 · 라이선스 칸은 그대로 — 현장 노트 「OFL 서체를 글자만 골라 넣으면」 11-05). 글자 목록은 줄바꿈도 지우지 않고 그대로 읽는다.
끝에 JSON 한 줄: 남은 글자 수 · 바이트 · 글자.txt 가운데 SUIT에는 있는데 줄인 판에서 빠진 글자(늘 0이어야 한다).
"""
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

sys.stdout.reconfigure(encoding='utf-8')
src, chars_path, out = sys.argv[1:4]
with open(chars_path, encoding='utf-8', newline='') as f:
    text = f.read()

ks = []
for hi in range(0xB0, 0xC9):
    for lo in range(0xA1, 0xFF):
        try:
            ks.append(bytes([hi, lo]).decode('euc-kr'))
        except UnicodeDecodeError:
            pass
ranges = [(0x20, 0x7E), (0xA0, 0xFF), (0x2000, 0x206F), (0x2190, 0x21FF), (0x2460, 0x24FF), (0x25A0, 0x25FF), (0x3000, 0x303F), (0xFF01, 0xFF5E)]
# KS X 1001 한글 2,350자를 다 넣으면 SUIT가 거의 그대로라(520KB) 쓰는 글자만 남긴다. 방문자가 질문 칸에 친 드문 글자는 대체 글꼴로 보인다(공개본 v10 글꼴과 같은 방식)
want = {ord(c) for c in text} | ({ord(c) for c in ks} if os.environ.get('SYNK_FONT_KSX') == '1' else set())
for a, b in ranges:
    want |= set(range(a, b + 1))

font = TTFont(src)
cmap = font.getBestCmap()
keep = sorted(u for u in want if u in cmap)

opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
opts.name_IDs = ['*']
opts.name_languages = ['*']
opts.name_legacy = True
opts.notdef_outline = True
opts.hinting = False
sub = subset.Subsetter(opts)
sub.populate(unicodes=keep)
sub.subset(font)

KEEP_IDS = {0, 7, 8, 9, 10, 11, 12, 13, 14}
for rec in font['name'].names:
    if rec.nameID in KEEP_IDS:
        continue
    s = rec.toUnicode()
    if 'SUIT' not in s:
        continue
    rec.string = s.replace('SUIT Variable', 'SYNK Sans v11').replace('SUITVariable', 'SYNKSansv11').replace('SUIT', 'SYNK Sans')
font.flavor = 'woff2'
font.save(out)

check = TTFont(out)
cm2 = check.getBestCmap()
page = {ord(c) for c in text}
missing = sorted(chr(u) for u in page if u in cmap and u not in cm2)
left_names = [r.toUnicode() for r in check['name'].names if r.nameID not in KEEP_IDS and 'SUIT' in r.toUnicode()]
print(json.dumps({
    'glyphs': len(cm2),
    'bytes': os.path.getsize(out),
    'wght': [(a.minValue, a.maxValue) for a in check['fvar'].axes if a.axisTag == 'wght'] if 'fvar' in check else None,
    'missing': missing,
    'leftNames': left_names,
    'notInFont': ''.join(sorted(chr(u) for u in page if u not in cmap and u > 0x7F))[:300],
}, ensure_ascii=False))
