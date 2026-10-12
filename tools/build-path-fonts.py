"""PATH 면접실 글꼴을 두 조각으로 나눈다(웹 첫 불러오기 줄이기).

- 화면판: 면접실 원문(interview/ 아래 html·mjs·json)에 나오는 글자 + 기본 라틴·문장부호
- 나머지판: 원본 SUIT Variable에 있는 그 밖의 글자(사용자가 입력·발화한 글자가 화면판에 없을 때만 받는다)

SUIT는 OFL 「Reserved Font Name SUIT」라 줄인 수정본의 내부 이름을 PATH Sans로 바꾼다.
CSS용 unicode-range 두 줄도 함께 만든다. 실행: python -X utf8 tools/build-path-fonts.py
면접실 글이나 tools/package-path-interview.mjs가 공개 묶음에 넣는 머리글·바닥글 문구를 바꾸면 다시 돌린다.
(묶음 도구는 읽지 않는다 — 그 파일의 다른 글자까지 화면판에 들어가지 않게. 지금 문구는 화면판 안에 있다.)
"""
import io, json, pathlib
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'experiences/path-vr'
SOURCE = ROOT / 'assets/SUIT.woff2'
OUT_UI = ROOT / 'assets/PathSans-ui.woff2'
OUT_REST = ROOT / 'assets/PathSans-rest.woff2'
OUT_META = ROOT / 'assets/PathSans.json'
TEXT_DIRS = [ROOT / 'interview']
SKIP = {'production', 'qa'}

def ranges(points):
    points = sorted(points)
    out, start, prev = [], None, None
    for p in points:
        if start is None:
            start = prev = p
        elif p == prev + 1:
            prev = p
        else:
            out.append((start, prev)); start = prev = p
    if start is not None:
        out.append((start, prev))
    return ','.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in out)

base = TTFont(SOURCE)
cmap = set(base.getBestCmap())
text = set()
for folder in TEXT_DIRS:
    for path in folder.rglob('*'):
        if path.is_file() and path.suffix in {'.html', '.mjs', '.js', '.json', '.css'} and not (SKIP & set(path.parts)):
            text.update(ord(ch) for ch in path.read_text(encoding='utf-8', errors='ignore'))
basic = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | set(range(0x2010, 0x2070)) | set(range(0x3000, 0x3040)) | {0x2190, 0x2192, 0x00B7, 0x00D7, 0x2026}
ui = (text | basic) & cmap
rest = cmap - ui
# 나머지판 CSS 범위는 화면판 글자와 겹치지 않게 둔다. 겹치면 화면판을 받는 동안 크롬이
# 같은 글자를 나머지판에서도 찾으며 첫 화면에 둘 다 받는다. 한글 음절 칸에서는 원본에 없는
# 드문 음절까지 이어 붙여 범위를 짧게 한다(그 글자는 어차피 기본 글꼴로 그린다).
rest_range = rest | (set(range(0xAC00, 0xD7A4)) - ui - text)
# 화면판 CSS 범위는 한글 음절 칸을 통째로 둔다(목록 3.5KB→0.2KB). 화면판에 없는 음절은 이미 받은
# 화면판에서 글자를 못 찾고 나머지판으로 넘어간다. 나머지판 범위에 화면판 글자가 없으니 두 번 받지 않는다.
ui_range = ui | set(range(0xAC00, 0xD7A4))

def build(points, out):
    font = TTFont(SOURCE, recalcTimestamp=False)  # 같은 입력이면 같은 바이트
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.hinting = False
    options.name_IDs = ['*']
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(points))
    subsetter.subset(font)
    names = font['name']
    for record in names.names:
        value = record.toUnicode()
        if 'SUIT' in value:
            # 글꼴 이름만 바꾼다(저작권·라이선스 항목에는 SUIT가 없다). PostScript 계열 이름은 공백 없이.
            names.setName(value.replace('SUITVariable', 'PATHSansVariable').replace('SUIT Variable', 'PATH Sans').replace('SUIT', 'PATH Sans'), record.nameID, record.platformID, record.platEncID, record.langID)
    for record in names.names:
        if record.nameID == 6:
            names.setName(record.toUnicode().replace(' ', ''), 6, record.platformID, record.platEncID, record.langID)
    buffer = io.BytesIO(); font.flavor = 'woff2'; font.save(buffer)
    out.write_bytes(buffer.getvalue())
    return len(buffer.getvalue())

meta = {
    'source': 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2 (experiences/path-vr/assets/SUIT.woff2와 같은 바이트)',
    'license': 'SIL OFL 1.1, Reserved Font Name SUIT → 수정본 내부 이름 PATH Sans',
    'ui': {'file': OUT_UI.name, 'codepoints': len(ui), 'bytes': build(ui, OUT_UI), 'unicodeRange': ranges(ui_range)},
    'rest': {'file': OUT_REST.name, 'codepoints': len(rest), 'bytes': build(rest, OUT_REST), 'unicodeRange': ranges(rest_range)},
}
assert not (rest_range & ui), '나머지판 범위가 화면판 글자와 겹친다'
OUT_META.write_text(json.dumps(meta, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
# 면접실 CSS의 두 글자 범위를 지금 원문과 맞춘다.
import re
css_path = ROOT / 'interview/film/rehearsal.css'
css = css_path.read_text(encoding='utf-8')
for part in ('ui', 'rest'):
    pattern = re.compile(r"(src:url\('\.\./\.\./assets/PathSans-" + part + r"\.woff2'\) format\('woff2'\);font-weight:100 900;font-display:swap)(?:;unicode-range:[^}]*)?(\})")
    css, count = pattern.subn(lambda m: m.group(1) + ';unicode-range:' + meta[part]['unicodeRange'] + m.group(2), css)
    assert count == 1, f'rehearsal.css PathSans-{part} rule not found'
import os, time
temporary = css_path.with_name(css_path.name + '.tmp-fonts')
temporary.write_text(css, encoding='utf-8', newline='')
for attempt in range(20):  # 윈도에서 파일 검사가 잠깐 잡고 있을 때가 있다
    try:
        os.replace(temporary, css_path); break
    except OSError:
        time.sleep(0.5)
else:
    raise SystemExit('rehearsal.css 교체 실패')
print(json.dumps({k: (v if not isinstance(v, dict) else {kk: vv for kk, vv in v.items() if kk != 'unicodeRange'}) for k, v in meta.items()}, ensure_ascii=False, indent=1))
print('ui range chars', len(meta['ui']['unicodeRange']), 'rest range chars', len(meta['rest']['unicodeRange']))
