"""시안 HTML에 심을 글꼴을 쓰인 글자만큼 줄여 base64로 준다(2026-11-13).

- SYNK Sans: SUIT Variable을 시안에 나오는 글자 + 기본 라틴으로 줄인 판. SUIT는 OFL 「Reserved Font Name SUIT」라
  줄인 수정본의 글꼴 이름을 SYNK Sans로 바꾼다 — tools/build-platform-fonts.py와 같은 방식(저작권 · 라이선스 항목은 그대로).
- Inter Tight 400 · 500 · 600: 숫자 · 라틴(쓰인 글자 + 기본 라틴). 예약 이름 없음.
쓰기: python -X utf8 fonts.py <글자 파일>  →  표준 출력에 {"sans": b64, "inter": {"400": b64, ...}}
"""
import base64
import io
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[4]
SUIT = ROOT / 'docs' / '브랜드_폰트' / 'SUIT' / 'SUIT-Variable.woff2'
INTER = {
    '400': ROOT / 'docs' / '브랜드_폰트' / 'InterTight' / 'InterTight-Regular.ttf',
    '500': ROOT / 'docs' / '브랜드_폰트' / 'InterTight' / 'InterTight-Medium.ttf',
    '600': ROOT / 'docs' / '브랜드_폰트' / 'InterTight' / 'InterTight-SemiBold.ttf',
}


def cut(source, points, rename=False):
    font = TTFont(source, recalcTimestamp=False)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.hinting = False
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.glyph_names = False
    sub = subset.Subsetter(options)
    sub.populate(unicodes=sorted(points))
    sub.subset(font)
    if rename:
        names = font['name']
        for record in names.names:
            value = record.toUnicode()
            if 'SUIT' in value:
                names.setName(value.replace('SUITVariable', 'SYNKSansVariable').replace('SUIT Variable', 'SYNK Sans').replace('SUIT', 'SYNK Sans'),
                              record.nameID, record.platformID, record.platEncID, record.langID)
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    return base64.b64encode(buf.getvalue()).decode('ascii')


def main():
    text = Path(sys.argv[1]).read_text(encoding='utf-8')
    base = set(range(0x20, 0x7F))
    used = {ord(c) for c in text if not c.isspace()} | base
    latin = {p for p in used if p < 0x3000}
    out = {'sans': cut(SUIT, used, rename=True), 'inter': {w: cut(p, latin) for w, p in INTER.items()}}
    sys.stdout.write(json.dumps(out))


if __name__ == '__main__':
    main()
